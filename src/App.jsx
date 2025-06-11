import { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config';
import { Alert } from "./components/Alert";
import { ToolTip } from "./components/ToolTip";
import { ToolTipCircle } from "./components/ToolTipCircle";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { parseJson, removeFileExtensionString } from "./Helper";
import * as THREE from "three";
import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const useStore = create((set) => ({
  mainScene: undefined,
  setMainScene: (loaded) => set(() => ({ mainScene: loaded })),

  forceDisableRender: false, // will disable the app's render
  setForceDisableRender: (DisableRender) => set(() => ({ forceDisableRender: DisableRender })),

  raycasterEnabled: true,
  setRaycasterEnabled: (loaded) => set(() => ({ raycasterEnabled: loaded })),

  preloadDone: false,
  setPreloadDone: (preloaded) => set(() => ({ preloadDone: preloaded })),

  // The named position that the transition is aiming to go
  transitionDestination: "MainMenu",
  setDesiredPath: (desired) => set(() => ({ transitionDestination: desired })),

  transitionEnded: false,
  setTransitionEnded: (ended) => set(() => ({ transitionEnded: ended })),

  currentGraphicalMode: config.default_graphical_setting,
  setGraphicalMode: (mode) => set(() => ({ currentGraphicalMode: mode })),

  enableDynamicGraphicalModeSetting: true,
  setEnableDynamicGraphicalModeSetting: (trueOrFalse) => set(() => ({ enableDynamicGraphicalModeSetting: trueOrFalse })),

  currentLanguage: "Portuguese",
  setLanguage: (language) => set(() => ({ currentLanguage: language })),

  currentCameraMovements: { zoom: true, pan: true, rotate: true },
  setcurrentCameraMovements: (cameraMovements) => set(() => ({ currentCameraMovements: cameraMovements })),

  currentCameraMode: "NormalMovement",
  setCurrentCameraMode: (cameraMode) => set(() => ({ currentCameraMode: cameraMode })),

  panDirectionalAxis: ['+z', '+y'],
  setPanDirectionalAxis: (axis) => set(() => ({ panDirectionalAxis: axis })),

  panDirectionalEdgethreshold: 150,
  setPanDirectionalEdgethreshold: (threshold) => set(() => ({ panDirectionalEdgethreshold: threshold })),

  cameraState: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  setCameraState: (position, rotation) => set(() => ({
    cameraState: { position, rotation }
  })),

  cameraStateTracking: false,
  setCameraStateTracking: (tracking) => set(() => ({ cameraStateTracking: tracking })),

  forcedCameraTarget: [], // will force the camera's rotation pivot if not empty
  setForcedCameraTarget: (target) => set(() => ({ forcedCameraTarget: target })),

  forcedCameraMovePathCurve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)]), // custom camera curve path
  setForcedCameraMovePathCurve: (curve) => set(() => ({ forcedCameraMovePathCurve: curve })), // Will move the camera according to the provided THREE.CatmullRomCurve3

  alertProperties: {
    active: false,
    type: 'Success',
    displaySide: 'topRight',
    duration: 5,
    width: '300px',
    height: '50px',
    transitionDuration: 0.5,
    text: 'Lorem Ipsum Dolor!'
  },
  setAlertProperties: (newProperties) => set((state) => ({
    alertProperties: {
      ...state.alertProperties,
      ...newProperties
    }
  })),

  isCanvasHovered: false,
  setIsCanvasHovered: (hovered) => set(() => ({ isCanvasHovered: hovered })),

  mouseClicked: false,
  toggleMouseClicked: () => set((state) => ({ mouseClicked: !state.mouseClicked })),

  isMouseDown: false,
  setIsMouseDown: () => set((state) => ({ isMouseDown: !state.isMouseDown })),

  isDragging: false,
  setIsDragging: (dragging) => set(() => ({ isDragging: dragging })),

  currentObjectClicked: "",
  setCurrentObjectClicked: (object) => set(() => ({ currentObjectClicked: object })),

  tutorialClosed: false,
  setTutorialClosed: (closed) => set(() => ({ tutorialClosed: closed })),

  triggers: { "trigger1": false, "trigger2": false, "trigger3": false, "trigger4": false, "trigger5": false },
  toggleTrigger: (key) => set((state) => ({
    triggers: {
      ...state.triggers,
      [key]: !state.triggers[key]
    }
  })),
  setTrigger: (key, value) => set((state) => ({
    triggers: {
      ...state.triggers,
      [key]: value
    }
  })),

  tooltipProperties: {
    active: false,
    visible: false,
    type: 'Success',
    displaySide: 'topRight',
    transitionDuration: 0.5,
    text: 'Lorem Ipsum Dolor!',
    image: ""
  },
  setTooltipProperties: (newProperties) => set((state) => ({
    tooltipProperties: {
      ...state.tooltipProperties,
      ...newProperties
    }
  })), // to be used like this: setTooltipProperties({active:false, visible:false});

  tooltipCirclesData: [],
  setTooltipCirclesData: (data) => set(() => ({ tooltipCirclesData: data })),
  addTooltipCirclesData: (newData) => set((state) => { // Add new data, in case of duplicate keys, the object will be overwritten
    const updatedData = [...state.tooltipCirclesData];
    newData.forEach(newItem => {
      const existingIndex = updatedData.findIndex(item => item.objectName === newItem.objectName);
      if (existingIndex !== -1) {
        updatedData[existingIndex] = newItem;
      } else {
        updatedData.push(newItem);
      }
    });
    return {
      tooltipCirclesData: updatedData
    };
  }),
  modifyTooltipCircleData: (objectName, newProperties) => set((state) => {
    const updatedData = state.tooltipCirclesData.map(item =>
      item.objectName === objectName ? { ...item, ...newProperties } : item
    );
    return {
      tooltipCirclesData: updatedData
    };
  }),

  isCircleOnLeftSelected: false,
  setIsCircleOnLeftSelected: (isLeft) => set(() => ({ isCircleOnLeftSelected: isLeft })),

  isCircleOnTopSelected: false,
  setIsCircleOnTopSelected: (isTop) => set(() => ({ isHoveredCircleOnTop: isTop })),

  tooltipCurrentObjectNameSelected: undefined,
  setTooltipCurrentObjectNameSelected: (object) => set(() => ({ tooltipCurrentObjectNameSelected: object })),

  message: {
    type: undefined,
    payload: undefined,
  },
  setMessage: (type, payload) => set(() => ({
    message: { type, payload }
  })),

  productInformationFromMessage: {},
  setProductInformationFromMessage: (productInformation) => set(() => ({ productInformationFromMessage: productInformation })),
  
  currentSkillHovered: "Python", // try to put this on the component itself
  setSkillHovered: (skill) => set(() => ({ currentSkillHovered: skill })),

  siteMode: "store",
  setSiteMode: (mode) => set(() => ({ siteMode: mode })),

  animationTriggerState: false,
  setAnimationTriggerState: (playing) => set(() => ({ animationTriggerState: playing })),

  explodeAnimationEnded: false,
  setExplodeAnimationEnded: (ended) => set(() => ({ explodeAnimationEnded: ended })),
}));

function App() {
  THREE.Cache.enabled = true;
  
  const setIsCanvasHovered = useStore((state) => state.setIsCanvasHovered);
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const setTooltipCirclesData = useStore((state) => state.setTooltipCirclesData);
  const tooltipProperties = useStore((state) => state.tooltipProperties);
  const forceDisableRender = useStore((state) => state.forceDisableRender);
  const setMainScene = useStore((state) => state.setMainScene);
  const setIsDragging = useStore((state) => state.setIsDragging);
  const isDragging = useStore((state) => state.isDragging);
  const setIsMouseDown = useStore((state) => state.setIsMouseDown);
  const isMouseDown = useStore((state) => state.isMouseDown);

  const ResponsiveWidthHeight = { width: window.innerWidth, height: window.innerHeight };

  const transitionEnded = useStore((state) => state.transitionEnded);

  const message = useStore((state) => state.message);
  const setMessage = useStore((state) => state.setMessage);
  const setProductInformationFromMessage = useStore((state) => state.setProductInformationFromMessage);

  const [enableTutorial, setEnableTutorial] = useState(false);

  const scene = useLoader(GLTFLoader, config.resource_path + '/models/' + 'NewthreeJsScene.glb')

  // Load initial main scene
  useEffect(() => {
    setMainScene(scene)
}, [scene]);

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
      window.useStore = useStore;
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

  return (
    <>
    {!forceDisableRender && (
      <>
      <Alert {...{ useStore }} />
      <ToolTip {...{ useStore }} transitionDuration={0.5} />
      {/* Create info circles on the screen */}
      {tooltipCirclesData?.length > 0 && tooltipCirclesData?.map((props) => (
        <ToolTipCircle
          key={props.objectName}
          {...{ useStore }}
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
      <TutorialOverlay enable = {enableTutorial} {...{useStore}}/>
      <HudMenu responsive={ResponsiveWidthHeight} {...{ useStore }} />
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
      <SceneContainer responsive={ResponsiveWidthHeight} {...{ useStore }} />
                {/* <FPSLogger /> */}

      </Canvas>
      </Suspense>
      </>
      )}
    </>
  );
}

export default App;
