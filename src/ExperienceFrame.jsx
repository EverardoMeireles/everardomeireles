import { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./system_components/HudMenu";
import { Alert } from "./system_components/Alert";
import { ToolTip } from "./system_components/ToolTip";
import { ToolTipCircle } from "./system_components/ToolTipCircle";
import { TutorialOverlay } from "./system_components/TutorialOverlay";
import useSystemStore from "./SystemStore";
import useUserStore from "./SystemStore";
import * as THREE from "three";
import { useFrame } from '@react-three/fiber'

import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom";



function ExperienceFrame() {
  THREE.Cache.enabled = true;
  
  const setIsCanvasHovered = useSystemStore((state) => state.setIsCanvasHovered);
  const tooltipCirclesData = useSystemStore((state) => state.tooltipCirclesData);
  const setTooltipCirclesData = useSystemStore((state) => state.setTooltipCirclesData);
  const tooltipProperties = useSystemStore((state) => state.tooltipProperties);
  const forceDisableRender = useSystemStore((state) => state.forceDisableRender);
  const setIsDragging = useSystemStore((state) => state.setIsDragging);
  const isDragging = useSystemStore((state) => state.isDragging);
  const setIsMouseDown = useSystemStore((state) => state.setIsMouseDown);
  const isMouseDown = useSystemStore((state) => state.isMouseDown);
  const setIsReturnButtonPressed = useSystemStore((state) => state.setIsReturnButtonPressed);
  const returnButtonPosition = useSystemStore((state) => state.returnButtonPosition);
  const showReturnButton = useSystemStore((state) => state.showReturnButton);
  const cameraState = useSystemStore((state) => state.cameraState);
  const hudMenuEnabled = useSystemStore((state) => state.hudMenuEnabled);

  const ResponsiveWidthHeight = { width: window.innerWidth, height: window.innerHeight };

  const transitionEnded = useSystemStore((state) => state.transitionEnded);

  const message = useSystemStore((state) => state.message);
  const setMessage = useSystemStore((state) => state.setMessage);
  const setProductInformationFromMessage = useSystemStore((state) => state.setProductInformationFromMessage);

  const [enableTutorial, setEnableTutorial] = useState(false);
  const setViewerBounds = useSystemStore((state) => state.setViewerBounds);
  const viewerBounds = useSystemStore((state) => state.viewerBounds);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    setCanvasReady(true);
  }, []);

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
      window.useSystemStore = useSystemStore;
      window.useUserStore = useUserStore;
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
              <HudMenu responsive={ResponsiveWidthHeight} enabled={hudMenuEnabled} />

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
              {canvasReady ? (
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
                  >
                    <SceneContainer
                      responsive={ResponsiveWidthHeight}
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

export default ExperienceFrame;

