import { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Canvas } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./user_components/HudMenu";
import { Hud } from "./user_components/Hud.jsx";
import { Tutorial } from "./user_components/Tutorial.jsx";
import { Alert } from "./system_components/Alert";
import { ToolTip } from "./system_components/ToolTip";
import { Circle } from "./system_components/Circle";
import SystemStore from "./SystemStore";
import UserStore from "./UserStore.js";
import { ProgressBar } from "./user_components/ProgressBar.jsx";
import * as THREE from "three";
import { useFrame } from '@react-three/fiber'
import config from "./config.js";
import { TwoDSplashScreen } from "./system_components/TwoDSplashScreen.jsx";

import {
  BrowserRouter as Router,
  Routes,
Route
} from "react-router-dom";

/**
 * Purpose: Top-level 3D viewer shell with routing, overlays, and the Canvas.
 * Relationships: Mounts SceneContainer inside Canvas and coordinates Tutorial, Hud, ToolTip, Circle, Alert, and ProgressBar with SystemStore.
 * Example:
 * <SceneViewer />
 */
function SceneViewer() {
  THREE.Cache.enabled = true;

  //////////////////////////////////////
  ////////// Store selectors ///////////
  //////////////////////////////////////

  const setIsCanvasHovered = SystemStore((state) => state.setIsCanvasHovered);
  const circlesData = SystemStore((state) => state.circlesData);
  const circleProperties = SystemStore((state) => state.circleProperties);
  const currentCircleNameSelected = SystemStore((state) => state.currentCircleNameSelected);
  const forceDisableRender = SystemStore((state) => state.forceDisableRender);
  const setIsDragging = SystemStore((state) => state.setIsDragging);
  const isDragging = SystemStore((state) => state.isDragging);
  const setIsMouseDown = SystemStore((state) => state.setIsMouseDown);
  const setIsReturnButtonPressed = SystemStore((state) => state.setIsReturnButtonPressed);
  const returnButtonPosition = SystemStore((state) => state.returnButtonPosition);
  const showReturnButton = SystemStore((state) => state.showReturnButton);
  const cameraState = SystemStore((state) => state.cameraState);
  const triggers = SystemStore((state) => state.triggers);
  const message = SystemStore((state) => state.message);
  const setMessage = SystemStore((state) => state.setMessage);
  const setProductInformationFromMessage = SystemStore((state) => state.setProductInformationFromMessage);
  const productInformationFromMessage = SystemStore((state) => state.productInformationFromMessage);
  const setViewerModelSelection = SystemStore((state) => state.setViewerModelSelection);
  const canvasEnabled = SystemStore((state) => state.canvasEnabled);
  const r3fPerfEnabled = SystemStore((state) => state.r3fPerfEnabled);
  const realTimeGiEnabled = SystemStore((state) => state.realTimeGiEnabled);
  const setRealTimeGiEnabled = SystemStore((state) => state.setRealTimeGiEnabled);
  const showBakedPvs = SystemStore((state) => state.showBakedPvs);
  const setShowBakedPvs = SystemStore((state) => state.setShowBakedPvs);
  const anisotropicFilteringEnabled = SystemStore((state) => state.anisotropicFilteringEnabled);
  const setAnisotropicFilteringEnabled = SystemStore((state) => state.setAnisotropicFilteringEnabled);
  const viewerDpr = SystemStore((state) => state.viewerDpr);
  const setViewerDpr = SystemStore((state) => state.setViewerDpr);
  const tutorialClosed = SystemStore((state) => state.tutorialClosed);
  const setTutorialClosed = SystemStore((state) => state.setTutorialClosed);

  const siteMode = UserStore((state) => state.siteMode);

  //////////////////////////////////////
  ////////// Local state ///////////////
  //////////////////////////////////////

  const [azertyMode, setAzertyMode] = useState(() => navigator.language?.toLowerCase().startsWith("fr") === true);
  const [keyboardLayoutReady, setKeyboardLayoutReady] = useState(false);
  const [touchNavigationMode, setTouchNavigationMode] = useState("gyroscope");
  const [objectsHidden, setObjectsHidden] = useState(false);
  const [tooltipProps, setTooltipProps] = useState({
    active: false,
    html: undefined,
    style: undefined,
    tooltipPosition: "opposite",
    housemakerTourCircle: false,
    pinned: false
  });
  const setViewerBounds = SystemStore((state) => state.setViewerBounds);
  const viewerBounds = SystemStore((state) => state.viewerBounds);
  const [canvasReady, setCanvasReady] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [pointerLockError, setPointerLockError] = useState("");
  const [gyroscopeStatus, setGyroscopeStatus] = useState("inactive");
  const firstPersonNavigationRef = useRef(null);
  const desktopPointerLockRequested = useRef(false);
  const previousCircleData = useRef();

  //////////////////////////////////////
  ////////// Derived data //////////////
  //////////////////////////////////////

  const selectedCircleData = circlesData.find((circle) => circle.circleName === currentCircleNameSelected);
  const selectedCirclePositionX = selectedCircleData?.position?.[0];

  // Keep fullscreen entry available for touch devices in either orientation.
  const isTouchDevice = navigator.maxTouchPoints > 0
    || window.matchMedia?.("(pointer: coarse)")?.matches === true;
  const dprValues = [1, 1.25, 1.5, 2];
  const hideObjectsKey = azertyMode ? "a" : "q";
  const pointerLockFailureMessage = "Mouse control could not start. Click the scene to try again.";

  //////////////////////////////////////
  ////////// Viewer setup //////////////
  //////////////////////////////////////

  // Mark the Canvas as ready after the first render.
  useEffect(() => {
    setCanvasReady(true);
  }, []);

  // Share one keyboard layout across instructions and actual controls.
  useLayoutEffect(() => {
    if (isTouchDevice) return;
    let cancelled = false;
    let request = 0;
    const updateKeyboardLayout = async () => {
      const currentRequest = ++request;
      if (typeof navigator.keyboard?.getLayoutMap !== "function") {
        setKeyboardLayoutReady(true);
        return;
      }
      setKeyboardLayoutReady(false);
      try {
        const layout = await navigator.keyboard.getLayoutMap();
        if (cancelled || currentRequest !== request || !layout) return;
        const keyW = layout.get("KeyW")?.toLowerCase();
        const keyA = layout.get("KeyA")?.toLowerCase();
        if (keyW === "z" && keyA === "q") setAzertyMode(true);
        else if (keyW === "w" && keyA === "a") setAzertyMode(false);
      } catch {
        // Restricted browsers retain language and physical-key detection.
      } finally {
        if (!cancelled && currentRequest === request) setKeyboardLayoutReady(true);
      }
    };
    const learnKeyboardLayout = (event) => {
      const key = event.key?.toLowerCase();
      if ((event.code === "KeyW" && key === "z") || (event.code === "KeyA" && key === "q")) {
        request += 1;
        setAzertyMode(true);
        setKeyboardLayoutReady(true);
      } else if ((event.code === "KeyW" && key === "w") || (event.code === "KeyA" && key === "a")) {
        request += 1;
        setAzertyMode(false);
        setKeyboardLayoutReady(true);
      }
    };
    updateKeyboardLayout();
    navigator.keyboard?.addEventListener?.("layoutchange", updateKeyboardLayout);
    window.addEventListener("keydown", learnKeyboardLayout, true);
    return () => {
      cancelled = true;
      navigator.keyboard?.removeEventListener?.("layoutchange", updateKeyboardLayout);
      window.removeEventListener("keydown", learnKeyboardLayout, true);
    };
  }, [isTouchDevice]);

  // Reflect keyboard and chair actions in the shared HUD.
  useEffect(() => {
    const updateObjectVisibility = (event) => setObjectsHidden(event.detail?.hidden === true);
    window.addEventListener("housemaker-objects-visibility-change", updateObjectVisibility);
    return () => window.removeEventListener("housemaker-objects-visibility-change", updateObjectVisibility);
  }, []);

  // Keep failed pointer-lock requests recoverable without automatic retries.
  useEffect(() => {
    if (isTouchDevice) return;
    const handlePointerLockChange = () => {
      desktopPointerLockRequested.current = false;
      setPointerLockError("");
    };
    const handlePointerLockError = () => {
      if (!desktopPointerLockRequested.current) return;
      desktopPointerLockRequested.current = false;
      setPointerLockError(pointerLockFailureMessage);
    };
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      const viewer = document.getElementById("viewer-root");
      if (viewer?.contains(document.pointerLockElement)) document.exitPointerLock?.();
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    window.addEventListener("keydown", handleEscape);
    return () => {
      desktopPointerLockRequested.current = false;
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isTouchDevice, pointerLockFailureMessage]);

  // Keep fullscreen controls and overlays aligned with the viewer.
  useLayoutEffect(() => {
    const viewerEl = document.getElementById("viewer-root");
    if (!viewerEl) return;

    // Read the current viewer DOM bounds.
    const updateBounds = () => {
      const rect = viewerEl.getBoundingClientRect();

      setViewerBounds({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    // Follow browser fullscreen changes, including native exit gestures.
    const updateFullscreen = () => {
      setFullscreenAvailable(Boolean(
        (viewerEl.requestFullscreen && document.fullscreenEnabled !== false)
        || (viewerEl.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false)
      ));
      setIsFullscreen(
        (document.fullscreenElement || document.webkitFullscreenElement) === viewerEl
      );
      updateBounds();
    };

    updateFullscreen();

    window.addEventListener("resize", updateBounds);
    document.addEventListener("fullscreenchange", updateFullscreen);
    document.addEventListener("webkitfullscreenchange", updateFullscreen);
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(viewerEl);

    // Remove bound listeners and observers.
    return () => {
      window.removeEventListener("resize", updateBounds);
      document.removeEventListener("fullscreenchange", updateFullscreen);
      document.removeEventListener("webkitfullscreenchange", updateFullscreen);
      resizeObserver.disconnect();
    };
  }, [setViewerBounds]);

  // Request fullscreen directly from a deliberate user interaction.
  const handleFullscreenToggle = async () => {
    const viewerEl = document.getElementById("viewer-root");
    if (!viewerEl || fullscreenPending) return;

    const exiting = (document.fullscreenElement || document.webkitFullscreenElement) === viewerEl;
    setFullscreenError("");
    setFullscreenPending(true);

    try {
      if (exiting) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          await document.webkitExitFullscreen();
        }
      } else if (viewerEl.requestFullscreen) {
        await viewerEl.requestFullscreen({ navigationUI: "hide" });
      } else {
        await viewerEl.webkitRequestFullscreen();
      }
    } catch {
      setFullscreenError(`Could not ${exiting ? "exit" : "enter"} fullscreen. Please try again.`);
    } finally {
      setFullscreenPending(false);
    }
  };

  // Keep browser permissions inside the mobile selection gesture.
  const handleControlSelection = (mode) => {
    setTouchNavigationMode(mode);
    if (mode === "gyroscope") firstPersonNavigationRef.current?.enableGyroscope();
    const viewer = document.getElementById("viewer-root");
    if ((document.fullscreenElement || document.webkitFullscreenElement) !== viewer) {
      handleFullscreenToggle();
    }
  };

  // Capture the mouse before the desktop tutorial starts fading.
  const handleDesktopStart = () => {
    const navigation = firstPersonNavigationRef.current;
    if (!navigation?.requestPointerLock) return false;
    setPointerLockError("");
    desktopPointerLockRequested.current = true;
    if (!navigation.requestPointerLock()) {
      desktopPointerLockRequested.current = false;
      setPointerLockError(pointerLockFailureMessage);
    }
    return true;
  };

  //////////////////////////////////////
  ////////// Overlay state /////////////
  //////////////////////////////////////

  // Update tooltip props from the currently hovered circle.
  useEffect(() => {
    if (!circleProperties.active || !selectedCircleData) {
      if (previousCircleData.current?.textShowMode === "Page") {
        setMessage('3D_TOOLTIP_HOVER_LEAVE', '');
      }

      previousCircleData.current = undefined;
      setTooltipProps((previousTooltipProps) => (
        previousTooltipProps.active
          ? { ...previousTooltipProps, active: false }
          : previousTooltipProps
      ));
      return;
    }

    if (previousCircleData.current?.textShowMode === "Page" && previousCircleData.current.circleName !== selectedCircleData.circleName
    ) {
      setMessage('3D_TOOLTIP_HOVER_LEAVE', '');
    }

    previousCircleData.current = selectedCircleData;

    if (selectedCircleData.textShowMode === "Page") {
      setMessage('3D_TOOLTIP_HOVER', {
        html: selectedCircleData.html,
        style: selectedCircleData.style
      });
      setTooltipProps((previousTooltipProps) => (
        previousTooltipProps.active
          ? { ...previousTooltipProps, active: false }
          : previousTooltipProps
      ));
      return;
    }

    setTooltipProps({
      active: true,
      html: selectedCircleData.html,
      style: selectedCircleData.style,
      tooltipPosition: selectedCircleData.tooltipPosition,
      housemakerTourCircle: Boolean(selectedCircleData.housemakerTourCircle),
      pinned: circleProperties.pinnedCircleName === selectedCircleData.circleName
    });
  }, [
    circleProperties.active,
    circleProperties.pinnedCircleName,
    selectedCircleData?.circleName,
    selectedCircleData?.textShowMode,
    selectedCircleData?.html,
    selectedCircleData?.style,
    selectedCircleData?.tooltipPosition,
    selectedCircleData?.housemakerTourCircle,
    setMessage
  ]);

  //////////////////////////////////////
  ////////// Product selection /////////
  //////////////////////////////////////

  // Select model/material based on product info and modelRecords.json.
  useEffect(() => {
    let isActive = true;
    const productId = Number(productInformationFromMessage?.id);
    if (!Number.isFinite(productId)) return () => {};

    // Normalize product attributes for variation matching.
    const normalizeAttributes = (attrs = {}) => {
      const normalized = {};
      if (!attrs || typeof attrs !== "object") return normalized;
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === "") continue;
        const rawKey = key.startsWith("attribute_")
          ? key.slice("attribute_".length)
          : key;
        normalized[rawKey] = value;
        if (rawKey.startsWith("pa_")) {
          normalized[rawKey.slice(3)] = value;
        }
      }
      return normalized;
    };

    // Load the matching model and material selection.
    const loadSelection = async () => {
      try {
        const recordsRes = await fetch(`${config.models_path}/modelRecords.json`);
        if (!recordsRes.ok) {
          console.warn("Failed to load modelRecords.json");
          return;
        }
        const records = await recordsRes.json();
        const list = Array.isArray(records) ? records : [];
        const matchingRecord = list.find(
          (record) => Number(record?.id) === productId
        );

        if (!matchingRecord?.model) {
          console.warn("No matching record found for product id:", productId);
          return;
        }

        const modelName = matchingRecord.model;
        const modelBaseName = modelName.replace(/\.glb$/i, "");
        const configFilename = `${modelBaseName}.json`;

        let modelJson = null;
        try {
          const modelResponse = await fetch(`${config.models_path}/${configFilename}`);
          if (modelResponse.ok) {
            modelJson = await modelResponse.json();
          }
        } catch (err) {
          console.warn("Failed to load model config:", configFilename, err);
        }

        const selection = {
          modelName,
          configFile: configFilename,
          materialName: matchingRecord.default_material || "",
        };

        const productAttrs = normalizeAttributes(productInformationFromMessage?.attributes);
        const variations = modelJson?.ExternalProperties?.variations || [];
        let matchedVariation = null;
        for (const variation of variations) {
          const variationAttrs = variation?.attributes || {};
          let allMatch = true;
          for (const key in variationAttrs) {
            if (!(key in productAttrs) || variationAttrs[key] !== productAttrs[key]) {
              allMatch = false;
              break;
            }
          }

          if (allMatch) {
            matchedVariation = variation;
            break;
          }
        }

        if (matchedVariation) {
          const type = (matchedVariation.type || "").toLowerCase();
          if (type === "model" && matchedVariation.file) {
            selection.modelName = matchedVariation.file;
          } else if (type === "material" && matchedVariation.file) {
            selection.materialName = matchedVariation.file;
          }
        }

        if (isActive) {
          setViewerModelSelection(selection);
        }
      } catch (err) {
        console.error("Failed to resolve product model selection:", err);
      }
    };

    loadSelection();

    // Prevent stale async results from updating state.
    return () => {
      isActive = false;
    };
  }, [productInformationFromMessage, setViewerModelSelection]);

  //////////////////////////////////////
  ////////// Message handling //////////
  //////////////////////////////////////

  // Post outbound messages to the parent page.
  useEffect(() => {
    if (message?.type && message.payload !== undefined) {
      window.parent.postMessage(message, "*");
    }
  }, [message]);

  // Request product information from the parent page.
  useEffect(() => {
    setMessage('REQUEST_PRODUCT_INFORMATION', 'TRUE')
    window.addEventListener('message', handleMessage);

  }, []);

  // Handle incoming e-commerce product information.
  function handleMessage(event) {
    if (
      typeof event.data === 'object' &&
      event.data.type === 'PRODUCT_INFO' &&
      event.data.payload
    ) {
      setProductInformationFromMessage(event.data.payload);
    }
  }

  //////////////////////////////////////
  ////////// Debug helpers /////////////
  //////////////////////////////////////

  // Expose stores for Chrome DevTools debugging.
  if (typeof window !== "undefined") {
    window.SystemStore = SystemStore;
    window.UserStore = UserStore;
  }

  /**
   * Purpose: Logs the current React Three Fiber frame rate once per second.
   * Relationships: Intended as a local debug child of Canvas.
   * Example:
   * <FPSLogger />
   */
  function FPSLogger() {
    const frameCount = useRef(0);
    const timeAccumulator = useRef(0);

    // Count rendered frames during each one-second window.
    useFrame((state, delta) => {
      frameCount.current += 1;
      timeAccumulator.current += delta;
      if (timeAccumulator.current >= 1.0) {
        const fps = frameCount.current / timeAccumulator.current;
        console.log(`FPS: ${fps.toFixed(1)}`);

        // Reset counters
        frameCount.current = 0;
        timeAccumulator.current = 0;
      }
    });

    return null; // No visual component
  }

  //////////////////////////////////////
  ////////// Pointer tracking //////////
  //////////////////////////////////////

  const activeCanvasPointers = useRef(new Map());

  // Track concurrent pointers without interrupting the remaining finger.
  useEffect(() => {
    // Mark pointer as dragging after a movement threshold.
    const handlePointerMove = (e) => {
      const origin = activeCanvasPointers.current.get(e.pointerId);
      if (!origin) return;

      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) {
        setIsDragging(true);
      }
    };

    // Clear input after the final tracked pointer ends.
    const handlePointerEnd = (event) => {
      if (!activeCanvasPointers.current.delete(event.pointerId)) return;
      if (activeCanvasPointers.current.size > 0) return;
      setIsMouseDown(false);
      setIsDragging(false);
    };

    // Reset interrupted gestures before accepting another interaction.
    const resetPointers = () => {
      activeCanvasPointers.current.clear();
      setIsMouseDown(false);
      setIsDragging(false);
    };

    // Ignore visibility changes while the page remains visible.
    const handleVisibilityChange = () => {
      if (document.hidden) resetPointers();
    };

    if (!canvasEnabled || forceDisableRender) {
      resetPointers();
      return undefined;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("lostpointercapture", handlePointerEnd);
    window.addEventListener("blur", resetPointers);
    window.addEventListener("resize", resetPointers);
    window.addEventListener("orientationchange", resetPointers);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("lostpointercapture", handlePointerEnd);
      window.removeEventListener("blur", resetPointers);
      window.removeEventListener("resize", resetPointers);
      window.removeEventListener("orientationchange", resetPointers);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resetPointers();
    };
  }, [canvasEnabled, forceDisableRender, setIsMouseDown, setIsDragging]);

  // Mark the return button as pressed.
  const handleReturnButtonMouseDown = () => {
    setIsReturnButtonPressed(true);
  };

  // Mark the return button as released.
  const handleReturnButtonMouseUp = () => {
    setIsReturnButtonPressed(false);
  };

  // Track each drag origin without resetting another finger.
  const handleCanvasPointerDown = (e) => {
    if (activeCanvasPointers.current.size === 0) {
      setIsDragging(false);
    }
    activeCanvasPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsMouseDown(true);
  };

  // Mark the Canvas as hovered.
  const handleCanvasPointerEnter = () => {
    setIsCanvasHovered(true);
  };

  // Mark the Canvas as not hovered.
  const handleCanvasPointerLeave = () => {
    setIsCanvasHovered(false);
  };

  //////////////////////////////////////
  ////////// Route helpers /////////////
  //////////////////////////////////////

  /**
   * Purpose: Shows a simple blocked-access route page.
   * Relationships: Rendered by SceneViewer's /401 route.
   * Example:
   * <UnauthorizedPage />
   */
  function UnauthorizedPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px", fontSize: "24px" }}>
      🚫 Unauthorized Access
    </div>
  );
}

  //////////////////////////////////////
  ////////// Render output /////////////
  //////////////////////////////////////

  return (
    <>
      <Router>
        <Routes>
          <Route path="/401" element={<UnauthorizedPage /> } />
          <Route path="*" element=
            {!forceDisableRender && (
              <>
              {/* 2D HTML overlays belong above the Canvas. */}
              <div className="viewer-fullscreen-controls" data-viewer-control="true" inert={tutorialClosed ? undefined : ""}>
                {canvasReady && canvasEnabled && tutorialClosed && (
                  <Hud
                    isTouchDevice={isTouchDevice}
                    isFullscreen={isFullscreen}
                    fullscreenPending={fullscreenPending}
                    onExitFullscreen={handleFullscreenToggle}
                    onExitControls={() => {
                      const viewer = document.getElementById("viewer-root");
                      if (viewer?.contains(document.pointerLockElement)) document.exitPointerLock?.();
                    }}
                    onToggleObjects={() => window.dispatchEvent(new Event("housemaker-toggle-objects"))}
                    objectsHidden={objectsHidden}
                    hideObjectsKey={hideObjectsKey}
                  />
                )}
                {isTouchDevice && !isFullscreen && (
                  <>
                    <button
                      type="button"
                      onClick={handleFullscreenToggle}
                      disabled={!fullscreenAvailable || fullscreenPending}
                      aria-pressed={isFullscreen}
                      title={fullscreenAvailable ? undefined : "Fullscreen is unavailable in this browser or embedded page."}
                    >
                      {fullscreenAvailable
                        ? "Enter fullscreen"
                        : "Fullscreen unavailable"}
                    </button>
                  </>
                )}
                {fullscreenError && <span role="status">{fullscreenError}</span>}
                {pointerLockError && <span role="status">{pointerLockError}</span>}
                <button
                  type="button"
                  onClick={() => setRealTimeGiEnabled(!realTimeGiEnabled)}
                  aria-pressed={realTimeGiEnabled}
                  title="Compare experimental screen-space bounce lighting. SSAO stays enabled."
                >
                  Real-time GI: {realTimeGiEnabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBakedPvs(!showBakedPvs)}
                  aria-pressed={showBakedPvs}
                  title="Cyan: baked visibility cells. Green: current camera cells. Culling remains enabled."
                >
                  {showBakedPvs ? "Hide baked pvs" : "Show baked pvs"}
                </button>
                <button
                  type="button"
                  onClick={() => setAnisotropicFilteringEnabled(!anisotropicFilteringEnabled)}
                  aria-pressed={anisotropicFilteringEnabled}
                  title="Sharpen angled model textures with up to 8x filtering, limited by your GPU."
                >
                  Anisotropic filtering: {anisotropicFilteringEnabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setViewerDpr(dprValues[(dprValues.indexOf(viewerDpr) + 1) % dprValues.length])}
                  title="Cycle rendering resolution: 1, 1.25, 1.5, 2. Higher values increase GPU load."
                >
                  DPR: {viewerDpr}
                </button>
                {canvasReady && canvasEnabled && gyroscopeStatus !== "inactive" && (
                  <>
                    {gyroscopeStatus !== "unavailable" && (
                      <button
                        type="button"
                        disabled={gyroscopeStatus === "waiting"}
                        onClick={() => {
                          if (gyroscopeStatus === "active") {
                            firstPersonNavigationRef.current?.recenterGyroscope();
                          } else {
                            firstPersonNavigationRef.current?.enableGyroscope();
                          }
                        }}
                      >
                        {gyroscopeStatus === "active"
                          ? "Recenter view"
                          : gyroscopeStatus === "waiting"
                            ? "Waiting for motion…"
                            : "Enable gyroscope"}
                      </button>
                    )}
                    {(gyroscopeStatus === "denied" || gyroscopeStatus === "unavailable") && (
                      <span role="status">
                        {gyroscopeStatus === "denied" ? "Motion access was denied." : "Motion controls are unavailable."}
                        {" Use the left side to move and the right side to look."}
                      </span>
                    )}
                  </>
                )}
              </div>
              <Alert />
              <ToolTip
                active={tooltipProps.active}
                html={tooltipProps.html}
                style={tooltipProps.style}
                selectedCirclePositionX={selectedCirclePositionX}
                viewerBounds={viewerBounds}
                transitionDuration={0.5}
                tooltipPosition={tooltipProps.tooltipPosition}
                housemakerTourCircle={tooltipProps.housemakerTourCircle}
                pinned={tooltipProps.pinned}
              />
              {/* Create info circles on the screen */}
              {circlesData?.length > 0 && circlesData?.map((props, index) => (
                <Circle
                  key={props.circleName || `circle-${index}`}
                  circleName={props.circleName}
                  circleSize={props.circleSize}
                  playPulseAnimation={props.playPulseAnimation}
                  position={props.position || [0, 0]}
                  circleIsVisible = {props.circleIsVisible}
                  housemakerTourCircle={props.housemakerTourCircle}
                  ariaLabel={props.ariaLabel}
                />
              ))}
              {!tutorialClosed && (
                <Tutorial
                  isTouchDevice={isTouchDevice}
                  azertyMode={azertyMode}
                  keyboardLayoutReady={keyboardLayoutReady}
                  controlsReady={Boolean(firstPersonNavigationRef.current)}
                  onDesktopStart={handleDesktopStart}
                  onSelectControl={handleControlSelection}
                  onClose={() => setTutorialClosed(true)}
                />
              )}
              {/* <HudMenu enabled={siteMode === "resume"} /> */}
              {(siteMode === "resume") &&
                <ProgressBar
                  progressBarPosition="bottom"
                  progressBarSize={[300, 8]}
                  progressBarCssPreset={0}
                  progress={Number(triggers?.curveScrollNavigationProgress)}
                />
              }
              <img
                    src = "textures/back_arrow.png"
                    width = {64}
                    height = {64}
                    style = {{
                      position: 'fixed',
                      left:   `${returnButtonPosition[0]}px`,
                      top:    `${returnButtonPosition[1]}px`,
                      cursor: 'pointer',
                      opacity: showReturnButton ? 1 : 0,
                          transition: 'opacity 0.5s ease',

                      userSelect: 'none',
                      cursor:'pointer',
                      zIndex: 100000
                    }}
                    // press state
                    onMouseDown = {handleReturnButtonMouseDown}
                    onMouseUp = {handleReturnButtonMouseUp}
                    // drag to reposition
                    alt="Return"
              />
              {/* <TwoDSplashScreen
                scale={1}
                duration={1000}
                animationDuration={1000}
                animation="3D_x_rotate_back"
                effect="explosive_blur"
                color="#ffffff"
                // interpolationAlgorithm="lerp"
                backgroundColor="#000"
                image="tutorial_rotate_video.png"
              /> */}
              {canvasReady && canvasEnabled ? (
                <Suspense>
                    <Canvas
                    onPointerDown={handleCanvasPointerDown}
                    onPointerEnter={handleCanvasPointerEnter}
                    onPointerLeave={handleCanvasPointerLeave}
                    shadows
                    dpr={viewerDpr}
                    gl={{ powerPreference: "high-performance", toneMappingExposure: 1 }}
                  >
                    {r3fPerfEnabled && <Perf />}
                    <SceneContainer
                      navigationRef={firstPersonNavigationRef}
                      onGyroscopeStatusChange={setGyroscopeStatus}
                      azertyMode={azertyMode}
                      hideObjectsKey={hideObjectsKey}
                      touchNavigationMode={touchNavigationMode}
                      inputBlocked={!tutorialClosed}
                    />
                    {/* <FPSLogger /> */}
                  </Canvas>
                </Suspense>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f5f5f5",
                  }}
                >
                  Initializing viewer...
                </div>
              )}
              </>
              )}
          />
        </Routes>
      </Router>
    </>
  );
}

export default SceneViewer;

