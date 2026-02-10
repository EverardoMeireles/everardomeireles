import { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./HudMenu";
import { Alert } from "./system_components/Alert";
import { ToolTip } from "./system_components/ToolTip";
import { ToolTipCircle } from "./system_components/ToolTipCircle";
import { TutorialOverlay } from "./system_components/TutorialOverlay";
import SystemStore from "./SystemStore";
import UserStore from "./SystemStore";
import * as THREE from "three";
import { useFrame } from '@react-three/fiber'
import config from "./config.js";
import { useResponsive } from "./Styles.jsx";
import { TwoDSplashScreen } from "./system_components/TwoDSplashScreen.jsx";

import {
  BrowserRouter as Router,
  Routes,
Route
} from "react-router-dom";



function SceneViewer() {
  THREE.Cache.enabled = true;
  
  const setIsCanvasHovered = SystemStore((state) => state.setIsCanvasHovered);
  const tooltipCirclesData = SystemStore((state) => state.tooltipCirclesData);
  const setTooltipCirclesData = SystemStore((state) => state.setTooltipCirclesData);
  const tooltipProperties = SystemStore((state) => state.tooltipProperties);
  const forceDisableRender = SystemStore((state) => state.forceDisableRender);
  const setIsDragging = SystemStore((state) => state.setIsDragging);
  const isDragging = SystemStore((state) => state.isDragging);
  const setIsMouseDown = SystemStore((state) => state.setIsMouseDown);
  const isMouseDown = SystemStore((state) => state.isMouseDown);
  const setIsReturnButtonPressed = SystemStore((state) => state.setIsReturnButtonPressed);
  const returnButtonPosition = SystemStore((state) => state.returnButtonPosition);
  const showReturnButton = SystemStore((state) => state.showReturnButton);
  const cameraState = SystemStore((state) => state.cameraState);
  const hudMenuEnabled = SystemStore((state) => state.hudMenuEnabled);

  const transitionEnded = SystemStore((state) => state.transitionEnded);

  const message = SystemStore((state) => state.message);
  const setMessage = SystemStore((state) => state.setMessage);
  const setProductInformationFromMessage = SystemStore((state) => state.setProductInformationFromMessage);
  const productInformationFromMessage = SystemStore((state) => state.productInformationFromMessage);
  const setViewerModelSelection = SystemStore((state) => state.setViewerModelSelection);
  const setCameraStartingPosition = SystemStore((state) => state.setCameraStartingPosition);
  const canvasEnabled = SystemStore((state) => state.canvasEnabled);

  const [enableTutorial, setEnableTutorial] = useState(false);
  const setViewerBounds = SystemStore((state) => state.setViewerBounds);
  const viewerBounds = SystemStore((state) => state.viewerBounds);
  const [canvasReady, setCanvasReady] = useState(false);
  // Use scene layout key to pick responsive camera start position
  const { key: sceneLayoutKey } = useResponsive("scene");

  useEffect(() => {
    setCanvasReady(true);
  }, []);

  // Keep camera start position in sync with responsive layout
  useEffect(() => {
    const nextPosition = config.default_Camera_starting_position?.[sceneLayoutKey]
      ?? config.default_Camera_starting_position?.Widescreen
      ?? config.default_Camera_starting_position;
    setCameraStartingPosition(nextPosition);
  }, [sceneLayoutKey, setCameraStartingPosition]);

  useLayoutEffect(() => {
    const viewerEl = document.getElementById("viewer-root");
    if (!viewerEl) return;

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

    return () => {
      window.removeEventListener("resize", updateBounds);
      resizeObserver.disconnect();
    };
  }, [setViewerBounds]);

  useEffect(() => {
    // console.log(tooltipCirclesData)
  }, [tooltipCirclesData]);

  // Handle events when transition ends
  useEffect(() => {
    // enable the tutorial when the transition ends, if the tutorial is shown only at the first transition end, the showOnlyOnce prop is set to true in the TutorialOverlay
    if(transitionEnded){
      setEnableTutorial(true)
    }
    
  }, [transitionEnded]);

  useEffect(() => {
    // console.log(toolTipCirclePositions)

  }, [tooltipProperties, setTooltipCirclesData]);

  // Select model/material based on product info + modelRecords.json
  useEffect(() => {
    let isActive = true;
    const productId = Number(productInformationFromMessage?.id);
    if (!Number.isFinite(productId)) return () => {};

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

    return () => {
      isActive = false;
    };
  }, [productInformationFromMessage, setViewerModelSelection]);

  //////////////////////////////////////
  ////////// Message handling //////////
  //////////////////////////////////////

  // Handle sending messages to parent
  useEffect(() => {
    if (message?.type && message.payload !== undefined) {
      window.parent.postMessage(message, "*");
    }
  }, [message]);

  // Request product information
  useEffect(() => {
  setMessage('REQUEST_PRODUCT_INFORMATION', 'TRUE')
  window.addEventListener('message', handleMessage);

  }, []);

  // Handle receiving e-comerce product information
		function handleMessage(event) {
			if (
				typeof event.data === 'object' &&
				event.data.type === 'PRODUCT_INFO' &&
				event.data.payload
			) {
				setProductInformationFromMessage(event.data.payload);
			}
		}
    
    // exposes the store to the global context to change states on chrome devtools
    if (typeof window !== "undefined") {
      window.SystemStore = SystemStore;
      window.UserStore = UserStore;
    }

  // Console logs the current fps
  function FPSLogger() {
    const frameCount = useRef(0);
    const timeAccumulator = useRef(0);

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

  const mouseDownPosition = useRef({ x: 0, y: 0 });

  // Tracks actual drag distance after pointer down
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isMouseDown) return;

      const dx = e.clientX - mouseDownPosition.current.x;
      const dy = e.clientY - mouseDownPosition.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) {
        setIsDragging(true);
      }
    };

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

  function UnauthorizedPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px", fontSize: "24px" }}>
      🚫 Unauthorized Access
    </div>
  );
}

  return (
    <>
      <Router>
        <Routes>
          <Route path="/401" element={<UnauthorizedPage /> } />
          <Route path="*" element=
            {!forceDisableRender && (
              <>
              <Alert />
              <ToolTip transitionDuration={0.5} />
              {/* Create info circles on the screen */}
              {tooltipCirclesData?.length > 0 && tooltipCirclesData?.map((props, index) => (
                <ToolTipCircle
                  key={props.objectName || `tooltip-${index}`}
                  objectName={props.objectName}
                  textShowMode={props.textShowMode}
                  text={props.text}
                  image={props.image}
                  circleSize={props.circleSize}
                  playPulseAnimation={props.playPulseAnimation}
                  position={props.position || [0, 0]}
                  circleIsVisible = {props.circleIsVisible}
                  isFocusable = {props.isFocusable}
                  focusTarget = {props.focusTarget}
                  focusGroup = {props.focusGroup}
                />
              ))}
              <TutorialOverlay enable = {enableTutorial}/> 
              <HudMenu enabled={hudMenuEnabled} />

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
                    onMouseDown = {()  => setIsReturnButtonPressed(true)}
                    onMouseUp = {()    => setIsReturnButtonPressed(false)}
                    // drag to reposition
                    alt="Return"
              />
              {/* <TwoDSplashScreen
                scale={1}
                duration={3000}
                animationDuration={1000}
                animation="3D_x_rotate_back"
                effect="lateral_glow"
                color="#ffffff"
                sfxAnimationEnd="click.wav"
                interpolationAlgorithm="lerp"
                backgroundColor="#000"
                image="tutorial_rotate_video.png"
              /> */}
              {canvasReady && canvasEnabled ? (
                <Suspense>
                    <Canvas
                      onPointerDown={(e) => {
                        setIsMouseDown(true);
                        mouseDownPosition.current = { x: e.clientX, y: e.clientY };
                        setIsDragging(false);
                    }}
                    onPointerUp={() => {
                      setIsMouseDown(false);
                    }}
                    onPointerEnter={() => setIsCanvasHovered(true)}
                    onPointerLeave={() => setIsCanvasHovered(false)}
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

