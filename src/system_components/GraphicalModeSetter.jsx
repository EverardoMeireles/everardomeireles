import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import { hasTriggerName, increaseOrDecreaseGraphics, isNamedTriggerActive, setNamedTrigger } from "../Helper";
import SystemStore from "../SystemStore";

//////////////////////////////////////////
/////////////// Props ////////////////////
//////////////////////////////////////////
// FPS-based graphical mode setter (continuous or timeboxed).
/**
 * @param {boolean} [enable] - Whether this feature is enabled.
 * @param {number} [fpsToIncreaseGraphics] - Fps to increase graphics.
 * @param {number} [fpsToDecreaseGraphics] - Fps to decrease graphics.
 * @param {number} [increaseStreakSeconds] - Timing value for increase streak seconds.
 * @param {number} [decreaseStreakSeconds] - Timing value for decrease streak seconds.
 * @param {*} [fallbackStreakSeconds] - Timing value for fallback streak seconds.
 * @param {boolean} [continous] - Continous.
 * @param {boolean} [showFps] - Whether to fps.
 * @param {string} [startMode] - "on_mount", "after_delay" or "on_trigger".
 * @param {number} [waitSeconds] - Timing value for wait seconds.
 * @param {boolean} [triggerInStart] - Trigger value used to start this behavior.
 * @param {string} [triggerOutFallbackTriggered] - Trigger key set when this behavior finishes.
 * @param {number} [fpsToFallBackHigh] - Fps to fall back high.
 * @param {number} [fpsToFallBackNormal] - Fps to fall back normal.
 * @param {number} [fpsToFallBackPotato] - Fps to fall back potato.
 * @param {string} [fallbackMode] - Mode value for fallback mode.
 * @param {string} [fallbackRedirectPath] - Fallback redirect path.
 */
export const GraphicalModeSetter = React.memo((props) => {
  const {enable = true} = props;
  const {fpsToIncreaseGraphics = 60} = props;
  const {fpsToDecreaseGraphics = 30} = props;
  const {increaseStreakSeconds = 6} = props;
  const {decreaseStreakSeconds = 3} = props;
  const {fallbackStreakSeconds = decreaseStreakSeconds} = props;
  const {continous = true} = props;
  const {showFps = false} = props;
  const {startMode = "on_mount"} = props;
  const {waitSeconds = 0} = props;
  const {triggerInStart = false} = props;
  const {triggerOutFallbackTriggered = ""} = props;
  const {fpsToFallBackHigh = 5} = props;
  const {fpsToFallBackNormal = 10} = props;
  const {fpsToFallBackPotato = 15} = props;
  const {fallbackMode = "disable_canvas"} = props;
  const {fallbackRedirectPath = "/"} = props;


  //////////////////////////////////////////
  /////////////// State ////////////////////
  //////////////////////////////////////////
  const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
  const setGraphicalMode = SystemStore((state) => state.setGraphicalMode);
  const setCanvasEnabled = SystemStore((state) => state.setCanvasEnabled);
  const setTrigger = SystemStore((state) => state.setTrigger);
  const triggers = SystemStore((state) => state.triggers);

  //////////////////////////////////////////
  /////////////// Tracking /////////////////
  //////////////////////////////////////////
  const fpsAccuRef = useRef({ deltas: 0, frames: 0 });
  const increaseStreakRef = useRef(0);
  const decreaseStreakRef = useRef(0);
  const fallbackStreakRef = useRef(0);
  const fallbackTriggeredRef = useRef(false);
  const elapsedSecondsRef = useRef(0);
  const disableChecksRef = useRef(false);
  const startTimerRef = useRef(null);
  const [startReady, setStartReady] = useState(startMode === "on_mount");
  const previousTriggerRef = useRef(false);

  const autoDisableAfterSeconds =
    ((increaseStreakSeconds + decreaseStreakSeconds) / 2) * 3;

  //////////////////////////////////////////
  /////////////// Start Gate ///////////////
  //////////////////////////////////////////
  useEffect(() => {
    const resetTracking = () => {
      elapsedSecondsRef.current = 0;
      disableChecksRef.current = false;
      increaseStreakRef.current = 0;
      decreaseStreakRef.current = 0;
      fallbackStreakRef.current = 0;
      fpsAccuRef.current = { deltas: 0, frames: 0 };
    };

    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    if (!enable) {
      resetTracking();
      setStartReady(false);
      return;
    }

    if (startMode === "on_trigger") {
      const triggerNow = hasTriggerName(triggerInStart)
        ? isNamedTriggerActive(triggers, triggerInStart)
        : Boolean(triggerInStart);
      if (triggerNow && !previousTriggerRef.current) {
        // Re-run on every rising edge.
        fallbackTriggeredRef.current = false;
        resetTracking();
        setStartReady(true);
      }
      if (!triggerNow) setStartReady(false);
      previousTriggerRef.current = triggerNow;
      return;
    }

    previousTriggerRef.current = false;
    resetTracking();

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

  }, [
    enable,
    continous,
    increaseStreakSeconds,
    decreaseStreakSeconds,
    startMode,
    waitSeconds,
    triggerInStart,
    startReady,
    triggers,
  ]);

  //////////////////////////////////////////
  /////////////// Helpers //////////////////
  //////////////////////////////////////////
  const getFallbackThreshold = (mode) => {
    switch (mode) {
      case "high":
        return fpsToFallBackHigh;
      case "normal":
        return fpsToFallBackNormal;
      case "potato":
        return fpsToFallBackPotato;
      default:
        return fpsToFallBackNormal;
    }
  };

  //////////////////////////////////////////
  /////////////// Fallback //////////////////
  //////////////////////////////////////////
  useEffect(() => {
    setNamedTrigger(setTrigger, triggerOutFallbackTriggered, false);
  }, [setTrigger, triggerOutFallbackTriggered]);

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
  /////////////// Sampling //////////////////
  //////////////////////////////////////////
  useFrame((state, delta) => {
    if (!enable || fallbackTriggeredRef.current) return;
    if (!startReady) return;
    if (!continous && disableChecksRef.current) return;

    fpsAccuRef.current.deltas += delta;
    fpsAccuRef.current.frames += 1;

    if (!continous) {
      // Timebox the checks when continous is disabled.
      elapsedSecondsRef.current += delta;
      if (elapsedSecondsRef.current >= autoDisableAfterSeconds) {
        disableChecksRef.current = true;
        return;
      }
    }

    if (fpsAccuRef.current.deltas >= 1) {
      const fpsSample =
        fpsAccuRef.current.frames / fpsAccuRef.current.deltas;
      fpsAccuRef.current.deltas = 0;
      fpsAccuRef.current.frames = 0;

      if (showFps) {
        console.log(`FPS: ${fpsSample.toFixed(1)}`);
      }

      const canIncrease = currentGraphicalMode !== "high";
      const canDecrease = currentGraphicalMode !== "potato";
      const fallbackThreshold = getFallbackThreshold(currentGraphicalMode);

      if (fpsSample >= fpsToIncreaseGraphics) {
        increaseStreakRef.current += 1;
      } else {
        increaseStreakRef.current = 0;
      }

      if (fpsSample <= fpsToDecreaseGraphics) {
        decreaseStreakRef.current += 1;
      } else {
        decreaseStreakRef.current = 0;
      }

      if (
        Number.isFinite(fallbackThreshold) &&
        fpsSample <= fallbackThreshold
      ) {
        fallbackStreakRef.current += 1;
      } else {
        fallbackStreakRef.current = 0;
      }

      if (fallbackStreakRef.current >= fallbackStreakSeconds) {
        triggerFallback();
        fallbackStreakRef.current = 0;
        return;
      }

      if (canIncrease && increaseStreakRef.current >= increaseStreakSeconds) {
        increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, 1);
        increaseStreakRef.current = 0;
      }

      if (canDecrease && decreaseStreakRef.current >= decreaseStreakSeconds) {
        const decreaseSteps =
          fpsSample < fpsToDecreaseGraphics / 2 ? 2 : 1;
        increaseOrDecreaseGraphics(
          currentGraphicalMode,
          setGraphicalMode,
          -decreaseSteps
        );
        decreaseStreakRef.current = 0;
      }
    }
  });
});

GraphicalModeSetter.displayName = "GraphicalModeSetter";
