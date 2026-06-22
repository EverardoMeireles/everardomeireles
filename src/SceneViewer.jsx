import { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./user_components/HudMenu";
import { Alert } from "./system_components/Alert";
import { ToolTip } from "./system_components/ToolTip";
import { Circle } from "./system_components/Circle";
import { TutorialOverlay } from "./system_components/TutorialOverlay";
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
 * Relationships: Mounts SceneContainer inside Canvas and coordinates HudMenu, ToolTip, Circle, TutorialOverlay, Alert, and ProgressBar with SystemStore.
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
  const isMouseDown = SystemStore((state) => state.isMouseDown);
  const setIsReturnButtonPressed = SystemStore((state) => state.setIsReturnButtonPressed);
  const returnButtonPosition = SystemStore((state) => state.returnButtonPosition);
  const showReturnButton = SystemStore((state) => state.showReturnButton);
  const cameraState = SystemStore((state) => state.cameraState);
  const triggers = SystemStore((state) => state.triggers);
  const isCameraMoving = SystemStore((state) => state.isCameraMoving);
  const message = SystemStore((state) => state.message);
  const setMessage = SystemStore((state) => state.setMessage);
  const setProductInformationFromMessage = SystemStore((state) => state.setProductInformationFromMessage);
  const productInformationFromMessage = SystemStore((state) => state.productInformationFromMessage);
  const setViewerModelSelection = SystemStore((state) => state.setViewerModelSelection);
  const canvasEnabled = SystemStore((state) => state.canvasEnabled);

  const siteMode = UserStore((state) => state.siteMode);

  //////////////////////////////////////
  ////////// Local state ///////////////
  //////////////////////////////////////

  const [enableTutorial, setEnableTutorial] = useState(false);
  const [tooltipProps, setTooltipProps] = useState({
    active: false,
    text: "",
    image: ""
  });
  const setViewerBounds = SystemStore((state) => state.setViewerBounds);
  const viewerBounds = SystemStore((state) => state.viewerBounds);
  const [canvasReady, setCanvasReady] = useState(false);
  const cameraMovedOnce = useRef(false);
  const previousCircleData = useRef();

  //////////////////////////////////////
  ////////// Derived data //////////////
  //////////////////////////////////////

  const selectedCircleData = circlesData.find((circle) => circle.circleName === currentCircleNameSelected);
  const selectedCirclePositionX = selectedCircleData?.position?.[0];

  //////////////////////////////////////
  ////////// Viewer setup //////////////
  //////////////////////////////////////

  // Mark the Canvas as ready after the first render.
  useEffect(() => {
    setCanvasReady(true);
  }, []);

  // Keep viewer bounds current for fixed-position overlays.
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

    updateBounds();

    window.addEventListener("resize", updateBounds);
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(viewerEl);

    // Remove bound listeners and observers.
    return () => {
      window.removeEventListener("resize", updateBounds);
      resizeObserver.disconnect();
    };
  }, [setViewerBounds]);

  //////////////////////////////////////
  ////////// Overlay state /////////////
  //////////////////////////////////////

  // Enable the tutorial after the first camera movement.
  useEffect(() => {
    if(isCameraMoving){
      cameraMovedOnce.current = true;
      return;
    }

    if(cameraMovedOnce.current){
      setEnableTutorial(true)
    }
  }, [isCameraMoving]);

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
        text: selectedCircleData.text,
        image: selectedCircleData.image
      });
      setTooltipProps((previousTooltipProps) => (
        previousTooltipProps.active
          ? { ...previousTooltipProps, active: false }
          : previousTooltipProps
      ));
      return;
    }

    setTooltipProps({active: true,
      text: selectedCircleData.text ?? "",
      image: selectedCircleData.image ?? ""});
  }, [
    circleProperties.active,
    selectedCircleData?.circleName,
    selectedCircleData?.textShowMode,
    selectedCircleData?.text,
    selectedCircleData?.image,
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

  const mouseDownPosition = useRef({ x: 0, y: 0 });

  // Track drag state after pointer down.
  useEffect(() => {
    // Mark pointer as dragging after a movement threshold.
    const handlePointerMove = (e) => {
      if (!isMouseDown) return;

      const dx = e.clientX - mouseDownPosition.current.x;
      const dy = e.clientY - mouseDownPosition.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) {
        setIsDragging(true);
      }
    };

    // Clear dragging when the pointer is released.
    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isMouseDown]);

  // Mark the return button as pressed.
  const handleReturnButtonMouseDown = () => {
    setIsReturnButtonPressed(true);
  };

  // Mark the return button as released.
  const handleReturnButtonMouseUp = () => {
    setIsReturnButtonPressed(false);
  };

  // Start mouse tracking for Canvas interactions.
  const handleCanvasPointerDown = (e) => {
    setIsMouseDown(true);
    mouseDownPosition.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  };

  // Clear mouse-down state after Canvas pointer release.
  const handleCanvasPointerUp = () => {
    setIsMouseDown(false);
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
              <Alert />
              <ToolTip
                active={tooltipProps.active}
                text={tooltipProps.text}
                image={tooltipProps.image}
                selectedCirclePositionX={selectedCirclePositionX}
                viewerBounds={viewerBounds}
                transitionDuration={0.5}
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
                />
              ))}
              <TutorialOverlay enable = {enableTutorial}/>
              <HudMenu enabled={siteMode === "resume"} />
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
                    onPointerUp={handleCanvasPointerUp}
                    onPointerEnter={handleCanvasPointerEnter}
                    onPointerLeave={handleCanvasPointerLeave}
                    dpr={1}
                    gl={{ powerPreference: "high-performance" }}
                  >
                    <SceneContainer />
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

