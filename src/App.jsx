import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config.json';
import { TutorialOverlay } from "./components/TutorialOverlay"; // eslint-disable-line no-unused-vars
import { Alert } from "./components/Alert";

function App() {
  const useStore = create((set) => ({
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
    currentLanguage:"English", // Languages: ["English", "French"],
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
    currentSkillHovered: "Python", // skills: ["Python", "C#", "JavaScript", "React", "Three.js", "blender", "SQL", "HTML/CSS", "anglais", "portugais"],
    setSkillHovered: (skill) => set((state) => ({currentSkillHovered: skill})),
    tutorialClosed: false,
    setTutorialClosed: (closed) => set(() => ({tutorialClosed: closed})),
    triggers: {"trigger1": false, "trigger2": false, "trigger3": false, "trigger4": false, "trigger5": false},
    toggleTrigger: (key) => set((state) => ({ // Use like this: toggleTrigger("exampleTrigger")
      triggers: {
          ...state.triggers,
          [key]: !state.triggers[key]
      }
    })),

    }))

  const ResponsiveWidthHeight = {width: window.innerWidth, height: window.innerHeight};

  return (
    <>
      <Alert {...{useStore}} />
      {/* <TutorialOverlay {...{useStore}}/> */}
      <HudMenu responsive={ResponsiveWidthHeight} {...{useStore}}/>
      <Canvas>
        <SceneContainer responsive={ResponsiveWidthHeight} {...{useStore}}/>
      </Canvas>
    </>
  );
}

export default App;