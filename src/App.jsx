import { Suspense, useEffect, useState } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config.json';
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

  raycasterEnabled: false,
  setRaycasterEnabled: (loaded) => set(() => ({ raycasterEnabled: loaded })),

  initialSceneLoaded: false,
  setInitialSceneLoaded: (loaded) => set(() => ({ initialSceneLoaded: loaded })),

  preloadDone: false,
  setPreloadDone: (preloaded) => set(() => ({ preloadDone: preloaded })),

  desired_path: "MainMenu",
  setDesiredPath: (desired) => set(() => ({ desired_path: desired })),

  transitionEnded: false,
  setTransitionEnded: (ended) => set(() => ({ transitionEnded: ended })),

  currentGraphicalMode: config.default_graphical_setting,
  setGraphicalMode: (mode) => set(() => ({ currentGraphicalMode: mode })),

  finishedBenchmark: false,
  setFinishedBenchmark: (finished) => set(() => ({ finishedBenchmark: finished })),

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

  currentSkillHovered: "Python", // try to put this on the component itself
  setSkillHovered: (skill) => set(() => ({ currentSkillHovered: skill })),

  mouseClicked: false,
  toggleMouseClicked: () => set((state) => ({ mouseClicked: !state.mouseClicked })),

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
    duration: 5,
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
  // addTooltipCirclesData: (newData) => set((state) => ({
  //   tooltipCirclesData: [...state.tooltipCirclesData, ...newData] // Add new data without overwriting
  // })),
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

  cameraState: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  setCameraState: (position, rotation) => set(() => ({
    cameraState: { position, rotation }
  })),

  cameraStateTracking: false,
  setCameraStateTracking: (tracking) => set(() => ({ cameraStateTracking: tracking })),

  animationTriggerState: false,
  setAnimationTriggerState: (playing) => set(() => ({ animationTriggerState: playing })),

  animationDirection: true,
  setAnimationDirection: (direction) => set(() => ({ animationDirection: direction })),

  explodingModelName: "", // will force the camera's rotation pivot if not empty
  setExplodingModelName: (name) => set(() => ({ explodingModelName: name })),

  explodeAnimationEnded: false,
  setExplodeAnimationEnded: (ended) => set(() => ({ explodeAnimationEnded: ended })),

  rotatingObjectViewportArray: [-0.5, 0.5, 0.25, -0.25],
  setRotatingObjectViewportArray: (index, value) =>
    set((state) => {
      const newArray = [...state.rotatingObjectViewportArray];
      newArray[index] = value;
      return { rotatingObjectViewportArray: newArray };
    }), // Define the NDC viewport coordinates(-1 to 1) that the rotating object is supposed to be on the left, right, top, bottom sides. Usage: setRotatingObjectViewportArray(1, 0.75)

  rotatingObjectForcedAxisOfRotation: [], // the axis that the rotating object will rotate when its tooltip circle is hovered, takes a three element array
  setRotatingObjectForcedAxisOfRotation: (axis) => set(() => ({ rotatingObjectForcedAxisOfRotation: axis })),

  forcedCameraTarget: [], // will force the camera's rotation pivot if not empty
  setForcedCameraTarget: (target) => set(() => ({ forcedCameraTarget: target })),

  forcedCameraPathCurve: new THREE.CatmullRomCurve3([        
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)]), // custom camera curve path
  setForcedCameraPathCurve: (curve) => set(() => ({ forcedCameraPathCurve: curve })),

  forceDisableRender: false, // will disable the app's render
  setForceDisableRender: (DisableRender) => set(() => ({ forceDisableRender: DisableRender })),

}));

function App() {
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const setTooltipCirclesData = useStore((state) => state.setTooltipCirclesData);
  const addTooltipCirclesData = useStore((state) => state.addTooltipCirclesData);
  const tooltipProperties = useStore((state) => state.tooltipProperties);
  const forceDisableRender = useStore((state) => state.forceDisableRender);
  const mainScene = useStore((state) => state.mainScene);
  const setMainScene = useStore((state) => state.setMainScene);

  const ResponsiveWidthHeight = { width: window.innerWidth, height: window.innerHeight };

  const explodingModelName = useStore((state) => state.explodingModelName);
  const transitionEnded = useStore((state) => state.transitionEnded);
  
  const [enableTutorial, setEnableTutorial] = useState(false);

  const scene = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + 'NewthreeJsScene.glb')

  // Load initial main sceneeeeee
  useEffect(() => {
    setMainScene(scene)
    console.log(mainScene)
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

  return (
    <>
    {!forceDisableRender && (
      <>
      <Alert {...{ useStore }} />
      <ToolTip showOnlyOnce = {true} {...{ useStore }} text={tooltipProperties.text} image={tooltipProperties.image} visible={tooltipProperties.visible} position={[30, 40]} />
      {/* Create info circles on the screen */}
      {tooltipCirclesData?.length > 0 && tooltipCirclesData?.map((props) => (
        <ToolTipCircle
          key={props.objectName}
          {...{ useStore }}
          pathToShow={props.pathToShow}
          position={props.position || [0, 0]}
          text={props.text}
          image={props.image}
          objectName={props.objectName}
          rotatingObjectCoordinates={[props.rotatingObjectNDCLeft, props.rotatingObjectNDCRight, props.rotatingObjectNDCTop, props.rotatingObjectNDCBottom]}
          rotatingObjectAxisOfRotation={props.axisOfRotation}
          size={props.circleSize}
          playPulseAnimation={props.playPulseAnimation}
        />
      ))}
      <TutorialOverlay enable = {enableTutorial} {...{useStore}}/>
      <HudMenu responsive={ResponsiveWidthHeight} {...{ useStore }} />
      <Suspense>
        <Canvas onClick={() => useStore.getState().toggleMouseClicked()} dpr={1} /*dpr={0.3} style={{ width: '60vw', height: '60vh' }}*/>
          <SceneContainer responsive={ResponsiveWidthHeight} {...{ useStore }} />
        </Canvas>
      </Suspense>
      </>
      )}
    </>
  );
}

export default App;
