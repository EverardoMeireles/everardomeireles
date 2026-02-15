import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { CalculateAverageOfArray, hasTriggerName, isNamedTriggerActive, setNamedTrigger } from "../Helper";
import SystemStore from "../SystemStore";

//////////////////////////////////////////
/////////////// Props ////////////////////
//////////////////////////////////////////
// Manual 1x1 FPS benchmark probe.
/**
 * @param {boolean} [enable] - Whether this feature is enabled.
 * @param {number} [benchmarkSampleSeconds] - Timing value for benchmark sample seconds.
 * @param {number} [fpsToFallBack] - Fps to fall back.
 * @param {string} [benchmarkScene] - Benchmark scene.
 * @param {boolean} [showFps] - Whether to fps.
 * @param {string} [startMode] - "on_mount", "after_delay" or "on_trigger".
 * @param {number} [waitSeconds] - Timing value for wait seconds.
 * @param {boolean} [triggerInStart] - Trigger value used to start this behavior.
 * @param {string} [triggerOutFallbackTriggered] - Trigger key set when this behavior finishes.
 * @param {*} [fpsNToTriggerOut] - Fps nto trigger out.
 * @param {string} [triggerOutFpsReachedN] - Trigger key set when this behavior finishes.
 * @param {string} [fallbackMode] - Mode value for fallback mode.
 * @param {string} [fallbackRedirectPath] - Fallback redirect path.
 */
export const FpsBenchmarkProbe = React.memo((props) => {
  const {enable = true} = props;
  const {benchmarkSampleSeconds = 3} = props;
  const {fpsToFallBack = 30} = props;
  const {benchmarkScene = ""} = props;
  const {showFps = false} = props;
  const {startMode = "on_mount"} = props;
  const {waitSeconds = 0} = props;
  const {triggerInStart = false} = props;
  const {triggerOutFallbackTriggered = ""} = props;
  const {fpsNToTriggerOut = undefined} = props;
  const {triggerOutFpsReachedN = ""} = props;
  const {fallbackMode = "disable_canvas"} = props;
  const {fallbackRedirectPath = "/"} = props;

  //////////////////////////////////////////
  /////////////// State ////////////////////
  //////////////////////////////////////////
  const setCanvasEnabled = SystemStore((state) => state.setCanvasEnabled);
  const setTrigger = SystemStore((state) => state.setTrigger);
  const triggers = SystemStore((state) => state.triggers);

  //////////////////////////////////////////
  /////////////// Tracking /////////////////
  //////////////////////////////////////////
  const fallbackTriggeredRef = useRef(false);
  const startTimerRef = useRef(null);
  const [startReady, setStartReady] = useState(startMode === "on_mount");
  const [runId, setRunId] = useState(0);
  const previousTriggerRef = useRef(false);
  const liveFpsAccuRef = useRef({ deltas: 0, frames: 0 });
  const wasAtOrAboveFpsNRef = useRef(false);

  //////////////////////////////////////////
  /////////////// Helpers //////////////////
  //////////////////////////////////////////
  useEffect(() => {
    setNamedTrigger(setTrigger, triggerOutFallbackTriggered, false);
    setNamedTrigger(setTrigger, triggerOutFpsReachedN, false);
    liveFpsAccuRef.current = { deltas: 0, frames: 0 };
    wasAtOrAboveFpsNRef.current = false;
  }, [setTrigger, triggerOutFallbackTriggered, triggerOutFpsReachedN, fpsNToTriggerOut]);

  const triggerFallback = () => {
    if (fallbackTriggeredRef.current) return;
    fallbackTriggeredRef.current = true;
    setNamedTrigger(setTrigger, triggerOutFallbackTriggered, true);

    if (fallbackMode === "redirect") {
      if (typeof window !== "undefined") {
        window.location.assign(fallbackRedirectPath);
      }
    } else {
      setCanvasEnabled(false);
    }
  };

  //////////////////////////////////////////
  /////////////// Start Gate ///////////////
  //////////////////////////////////////////
  useEffect(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    if (!enable) {
      setStartReady(false);
      return;
    }

    if (startMode === "on_trigger") {
      const triggerNow = hasTriggerName(triggerInStart)
        ? isNamedTriggerActive(triggers, triggerInStart)
        : Boolean(triggerInStart);
      if (triggerNow && !previousTriggerRef.current) {
        // Allow re-running the benchmark on each rising edge.
        fallbackTriggeredRef.current = false;
        setStartReady(true);
        setRunId((value) => value + 1);
      }
      if (!triggerNow) {
        setStartReady(false);
      }
      previousTriggerRef.current = triggerNow;
      return;
    }

    previousTriggerRef.current = false;

    if (startMode === "on_mount") {
      setStartReady(true);
      return;
    }

    if (startMode === "after_delay") {
      const delayMs = Math.max(0, waitSeconds) * 1000;
      if (delayMs === 0) {
        setStartReady(true);
        return;
      }
      setStartReady(false);
      startTimerRef.current = setTimeout(() => {
        setStartReady(true);
        startTimerRef.current = null;
      }, delayMs);
      return () => {
        if (startTimerRef.current) {
          clearTimeout(startTimerRef.current);
          startTimerRef.current = null;
        }
      };
    }

  }, [enable, startMode, waitSeconds, triggerInStart, startReady, triggers]);

  //////////////////////////////////////////
  /////////////// Benchmark ////////////////
  //////////////////////////////////////////
  useEffect(() => {
    if (!enable || !startReady) return;
    if (fallbackTriggeredRef.current) return;

    let cancelled = false;
    let rafId = 0;
    let benchmarkReady = false;

    // Off-screen 1x1 canvas to avoid visible impact.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.position = "fixed";
    canvas.style.left = "-9999px";
    canvas.style.top = "-9999px";
    canvas.style.width = "1px";
    canvas.style.height = "1px";
    canvas.style.opacity = "0";
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(1, 1, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10);
    camera.position.z = 2;

    const benchmarkRoot = new THREE.Group();
    scene.add(benchmarkRoot);

    const disposeObject = (object) => {
      object.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat?.dispose?.());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };

    const addCube = () => {
      // Default benchmark: a simple rotating cube.
      if (benchmarkReady) return;
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshNormalMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      benchmarkRoot.add(mesh);
      benchmarkReady = true;
    };

    const scenePath =
      typeof benchmarkScene === "string" ? benchmarkScene.trim() : "";
    if (scenePath) {
      // Optional GLB benchmark; fall back to cube on load error.
      const loader = new GLTFLoader();
      loader.load(
        scenePath,
        (gltf) => {
          if (cancelled) {
            disposeObject(gltf.scene);
            return;
          }
          const model = gltf.scene;
          model.updateMatrixWorld(true);

          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scale = 1 / maxDim;
            model.scale.setScalar(scale);
          }

          model.updateMatrixWorld(true);
          const centeredBox = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          centeredBox.getCenter(center);
          model.position.sub(center);

          benchmarkRoot.add(model);
          benchmarkReady = true;
        },
        undefined,
        () => {
          if (cancelled) return;
          addCube();
        }
      );
    } else {
      addCube();
    }

    const targetSamples = Math.max(1, benchmarkSampleSeconds);
    const samples = [];
    let lastTime = performance.now();
    let frameCount = 0;
    let timeAccumulator = 0;

    const cleanup = () => {
      if (cancelled) return;
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      renderer.dispose();
      disposeObject(benchmarkRoot);
      canvas.remove();
    };

    const finishBenchmark = (avgFPS) => {
      if (
        Number.isFinite(avgFPS) &&
        Number.isFinite(fpsToFallBack) &&
        avgFPS <= fpsToFallBack
      ) {
        triggerFallback();
      }
      cleanup();
    };

    const tick = (now) => {
      if (cancelled) return;
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (!benchmarkReady) {
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(tick);
        return;
      }

      frameCount += 1;
      timeAccumulator += delta;

      benchmarkRoot.rotation.x += delta;
      benchmarkRoot.rotation.y += delta * 0.7;
      renderer.render(scene, camera);

      if (timeAccumulator >= 1) {
        const fpsSample = frameCount / timeAccumulator;
        samples.push(fpsSample);
        if (showFps) {
          console.log(`Benchmark FPS: ${fpsSample.toFixed(1)}`);
        }
        frameCount = 0;
        timeAccumulator = 0;
        if (samples.length >= targetSamples) {
          finishBenchmark(CalculateAverageOfArray(samples));
          return;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return cleanup;
  }, [
    enable,
    startReady,
    runId,
    benchmarkSampleSeconds,
    fpsToFallBack,
    benchmarkScene,
    showFps,
    fallbackMode,
    fallbackRedirectPath,
  ]);

  //////////////////////////////////////////
  /////////// Live FPS Trigger /////////////
  //////////////////////////////////////////
  useFrame((state, delta) => {
    if (!enable || !startReady) return;
    if (!Number.isFinite(delta) || delta <= 0) return;

    liveFpsAccuRef.current.deltas += delta;
    liveFpsAccuRef.current.frames += 1;

    if (liveFpsAccuRef.current.deltas < 1) return;

    const fpsSample = liveFpsAccuRef.current.frames / liveFpsAccuRef.current.deltas;
    liveFpsAccuRef.current = { deltas: 0, frames: 0 };

    const threshold = Number(fpsNToTriggerOut);
    if (!Number.isFinite(threshold)) return;

    const reachedThreshold = fpsSample >= threshold;
    if (reachedThreshold && !wasAtOrAboveFpsNRef.current) {
      setNamedTrigger(setTrigger, triggerOutFpsReachedN, true);
    }
    wasAtOrAboveFpsNRef.current = reachedThreshold;
  });
});

FpsBenchmarkProbe.displayName = "FpsBenchmarkProbe";
