import { Canvas, useFrame } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config.json';
import { TutorialOverlay } from "./components/TutorialOverlay"; // eslint-disable-line no-unused-vars
import { Alert } from "./components/Alert";
import { ToolTip } from "./components/ToolTip";
import { ToolTipCircle } from "./components/ToolTipCircle";

function App() {
  const useStore = create((set) => ({
    initialSceneLoaded: false,
    setInitialSceneLoaded: (loaded) => set(() => ({initialSceneLoaded: loaded})),
    preloadDone: false,
    setPreloadDone: (preloaded) => set(() => ({preloadDone: preloaded})),
    trigger: false,
    setTrigger: (trig) => set(() => ({trigger: trig})),
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({desired_path: desired})),
    transitionEnded: false,
    setTransitionEnded: (ended) => set(() => ({transitionEnded: ended})),
    currentGraphicalMode: config.default_graphical_setting,
    setGraphicalMode: (mode) => set((state) => ({currentGraphicalMode: mode})), // if graphicalModes wont be out of range, update currentGraphicalMode
    finishedBenchmark: false,
    setFinishedBenchmark: (finished) => set(() => ({finishedBenchmark: finished})),
    currentLanguage:"Portuguese", // Languages: ["English", "French, Portuguese"],
    setLanguage: (language) => set((state) => ({currentLanguage: language})),
    currentCameraMovements:{"zoom":true, "pan":true, "rotate":true},
    setcurrentCameraMovements: (cameraMovements) => set((state) => ({currentCameraMovements: cameraMovements})),
    currentCameraMode:"NormalMovement", // Camera modes: ["NormalMovement", "panOnly", "rotateOnly", "zoomOnly", "panDirectional"]
    setCurrentCameraMode: (cameraMode) => set((state) => ({currentCameraMode: cameraMode})),
    panDirectionalAxis:['+z','+y'],
    setPanDirectionalAxis: (axis) => set((state) => ({panDirectionalAxis: axis})),
    panDirectionalEdgethreshold:150,
    setPanDirectionalEdgethreshold: (threshold) => set((state) => ({panDirectionalEdgethreshold: threshold})),
    alertProperties: {
      active: false,
      type: 'Success', // 'Error', 'Warning', 'Success'
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
      type: 'Success', // 'Error', 'Warning', 'Success'
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
    currentSkillHovered: "Python", // skills: ["Python", "C#", "JavaScript", "React", "Three.js", "blender", "SQL", "HTML/CSS", "anglais", "portugais"],
    setSkillHovered: (skill) => set((state) => ({currentSkillHovered: skill})),
    mouseClicked: false,
    toggleMouseClicked: () => set((state) => ({mouseClicked: !state.mouseClicked})),
    currentObjectClicked: "",
    setCurrentObjectClicked: (object) => set((state) => ({currentObjectClicked: object})),
    tutorialClosed: false,
    setTutorialClosed: (closed) => set(() => ({tutorialClosed: closed})),
    triggers: {"trigger1": false, "trigger2": false, "trigger3": false, "trigger4": false, "trigger5": false},
    toggleTrigger: (key) => set((state) => ({ // Use like this: toggleTrigger("exampleTrigger")
      triggers: {
          ...state.triggers,
          [key]: !state.triggers[key]
      }
    })),

    tooltipVisible: false,
    setTooltipVisible: (visible) => set(() => ({tooltipVisible: visible})),

    tooltipText: "Example text",
    setTooltipText: (text) => set(() => ({tooltipText: text})),

    tooltipImage: "",
    setTooltipImage: (image) => set(() => ({tooltipImage: image})),

    isCircleOnLeft: false,
    setIsCircleOnLeft: (isLeft) => set(() => ({isCircleOnLeft: isLeft})),
    }))

  const ResponsiveWidthHeight = {width: window.innerWidth, height: window.innerHeight};

  const tooltipText = useStore((state) => state.tooltipText);
  const tooltipVisible = useStore((state) => state.tooltipVisible);
  const tooltipImage = useStore((state) => state.tooltipImage);

  return (
    <>
      <Alert {...{useStore}} />

      {/* <ToolTip {...{useStore}} text={tooltipText} image={tooltipImage} visible={tooltipVisible}  position = {[30, 40]} />
      <ToolTipCircle {...{useStore}} pathToShow = "MainMenu" position={[30, 40]} text="Right text" image={process.env.PUBLIC_URL + "textures/4x3.png"} />
      <ToolTipCircle {...{useStore}} pathToShow = "MainMenu" position={[70, 40]} text="Left text" image={process.env.PUBLIC_URL + "textures/ortAfficheBTS.png"} /> */}
      {/* <TutorialOverlay {...{useStore}}/> */}
      <HudMenu responsive={ResponsiveWidthHeight} {...{useStore}}/>
      <Canvas onClick={() => useStore.getState().toggleMouseClicked()} dpr={1} /*dpr={0.3} style={{ width: '60vw', height: '60vh' }}*/>
        <SceneContainer responsive={ResponsiveWidthHeight} {...{useStore}}/>
      </Canvas>
    </>
  );
}

export default App;