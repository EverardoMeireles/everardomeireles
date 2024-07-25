import { useEffect } from 'react';
import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config.json';
import { Alert } from "./components/Alert";
import { ToolTip } from "./components/ToolTip";
import { ToolTipCircle } from "./components/ToolTipCircle";
import * as THREE from "three";

const useStore = create((set) => ({
  toolTipCirclePositions: [],
  setToolTipCirclePositions: (positions) => set(() => ({ toolTipCirclePositions: positions })),
  raycasterEnabled: false,
  setRaycasterEnabled: (loaded) => set(() => ({ raycasterEnabled: loaded })),
  initialSceneLoaded: false,
  setInitialSceneLoaded: (loaded) => set(() => ({ initialSceneLoaded: loaded })),
  preloadDone: false,
  setPreloadDone: (preloaded) => set(() => ({ preloadDone: preloaded })),
  desired_path: "MainMenu",
  setPath: (desired) => set(() => ({ desired_path: desired })),
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
  tooltipProperties: {
    active: false,
    type: 'Success',
    displaySide: 'topRight',
    duration: 5,
    transitionDuration: 0.5,
    text: 'Lorem Ipsum Dolor!'
  },
  setTooltipProperties: (newProperties) => set((state) => ({
    tooltipProperties: {
      ...state.tooltipProperties,
      ...newProperties
    }
  })),
  currentSkillHovered: "Python",
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
  tooltipVisible: false,
  setTooltipVisible: (visible) => set(() => ({ tooltipVisible: visible })),
  tooltipText: "Example text",
  setTooltipText: (text) => set(() => ({ tooltipText: text })),
  tooltipImage: "",
  setTooltipImage: (image) => set(() => ({ tooltipImage: image })),
  isCircleOnLeft: false,
  setIsCircleOnLeft: (isLeft) => set(() => ({ isCircleOnLeft: isLeft })),
  isCircleOnTop: false,
  setIsCircleOnTop: (isTop) => set(() => ({ isCircleOnTop: isTop })),
  
  tooltipCirclesData: [],
  setTooltipCirclesData: (data) => set(() => ({ tooltipCirclesData: data })),
  tooltipCurrentObjectNameSelected: undefined,
  setTooltipCurrentObjectNameSelected: (object) => set(() => ({ tooltipCurrentObjectNameSelected: object })),
  tooltipCurrentObjectSelected: {},
  setTooltipCurrentObjectSelected: (object) => set(() => ({ tooltipCurrentObjectSelected: object })),
  cameraState: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  setCameraState: (position, rotation) => set(() => ({
    cameraState: { position, rotation }
  })),

  cameraStateTracking: false,
  setCameraStateTracking: (tracking) => set(() => ({ cameraStateTracking: tracking })),
  
  animationIsPlaying: false,
  setAnimationIsPlaying: (playing) => set(() => ({ animationIsPlaying: playing })),

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

  tooltipCircleFadeMode: "OnAnimationEnd", // "OnTransitionEnd", "OnAnimationEnd"
  setTooltipCircleFadeMode: (text) => set(() => ({ tooltipText: text })),

  forcedCameraTarget: [], // will force the camera's rotation pivot if not empty
  setForcedCameraTarget: (target) => set(() => ({ forcedCameraTarget: target })),

  forcedCameraPathCurve: new THREE.CatmullRomCurve3([        
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)]), // custom camera curve path
  setForcedCameraPathCurve: (curve) => set(() => ({ forcedCameraPathCurve: curve })),

}));

function App() {
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const setTooltipCirclesData = useStore((state) => state.setTooltipCirclesData);
  const setToolTipCirclePositions = useStore((state) => state.setToolTipCirclePositions);
  const toolTipCirclePositions = useStore((state) => state.toolTipCirclePositions);

  const ResponsiveWidthHeight = { width: window.innerWidth, height: window.innerHeight };

  const tooltipText = useStore((state) => state.tooltipText);
  const tooltipVisible = useStore((state) => state.tooltipVisible);
  const tooltipImage = useStore((state) => state.tooltipImage);
  const explodingModelName = useStore((state) => state.explodingModelName);

  useEffect(() => {
    if(explodingModelName != ""){
      console.log(explodingModelName)
      fetch("/models/" + explodingModelName + ".json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setTooltipCirclesData(data);
      })
      .catch((error) => {
        console.error('Error fetching the JSON:', error);
      });
    }
  }, [explodingModelName]); // Empty dependency array to run the effect only once

  useEffect(() => {
    // console.log(toolTipCirclePositions)

  }, [toolTipCirclePositions, setTooltipCirclesData]);

  return (
    <>
      <Alert {...{ useStore }} />
      <ToolTip {...{ useStore }} text={tooltipText} image={tooltipImage} visible={tooltipVisible} position={[30, 40]} />
      {tooltipCirclesData.length > 0 && tooltipCirclesData.map((props) => (
        <ToolTipCircle
          key={props.objectName}
          {...{ useStore }}
          pathToShow={props.pathToShow}
          position={toolTipCirclePositions[props.objectName] || [0, 0]}
          text={props.text}
          image={props.image}
          objectName={props.objectName}
          rotatingObjectCoordinates={[props.rotatingObjectNDCLeft, props.rotatingObjectNDCRight, props.rotatingObjectNDCTop, props.rotatingObjectNDCBottom]}
          size={props.circleSize}
          playPulseAnimation={props.playPulseAnimation}
        />
      ))}
      {/* <TutorialOverlay {...{useStore}}/> */}
      <HudMenu responsive={ResponsiveWidthHeight} {...{ useStore }} />
      <Canvas onClick={() => useStore.getState().toggleMouseClicked()} dpr={1} /*dpr={0.3} style={{ width: '60vw', height: '60vh' }}*/>
        <SceneContainer responsive={ResponsiveWidthHeight} {...{ useStore }} />
      </Canvas>
    </>
  );
}

export default App;
