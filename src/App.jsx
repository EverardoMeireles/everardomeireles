import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";
import { create } from 'zustand';
import config from './config.json';
import { TutorialOverlay } from "./components/TutorialOverlay";
import { Alert } from "./components/Alert";

function App() {
  const useStore = create((set) => ({
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({desired_path: desired})),
    transitionEnded: false,
    setTransitionEnded: (ended) => set(() => ({transitionEnded: ended})),
    graphicalModes: ["potato", "potatoPremium", "normal", "high"],
    currentGraphicalMode: config.default_graphical_setting,
    // if graphicalModes wont be out of range, update currentGraphicalMode
    setGraphicalMode: (mode) => set((state) => ({currentGraphicalMode: mode})),
    finishedBenchmark: false,
    setFinishedBenchmark: (finished) => set(() => ({finishedBenchmark: finished})),
    //skills: ["Python", "C#", "JavaScript", "React", "Three.js", "blender", "SQL", "HTML/CSS", "anglais", "portugais"],
    currentSkillHovered: "Python",
    setSkillHovered: (skill) => set((state) => ({currentSkillHovered: skill})),
    //Languages: ["English", "French"],
    currentLanguage:"English",
    setLanguage: (language) => set((state) => ({currentLanguage: language})),
    currentCameraMovements:{"zoom":true, "pan":true, "rotate":true},
    setcurrentCameraMovements: (cameraMovements) => set((state) => ({currentCameraMovements: cameraMovements})),
    //Camera modes: ["NormalMovement", "panOnly", "rotateOnly", "zoomOnly", "panDirectional"]
    currentCameraMode:"NormalMovement",
    setCurrentCameraMode: (cameraMode) => set((state) => ({currentCameraMode: cameraMode})),
    panDirectionalAxis:['+z','+y'],
    setPanDirectionalAxis: (axis) => set((state) => ({panDirectionalAxis: axis})),
    panDirectionalEdgethreshold:150,
    setPanDirectionalEdgethreshold: (threshold) => set((state) => ({panDirectionalEdgethreshold: threshold})),
    tutorialClosed: false,
    setTutorialClosed: (closed) => set(() => ({tutorialClosed: closed})),
    alertProperties: {
      active: false,
      type: 'Success', //'Error', 'Warning', 'Success'
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
    }))
    }))

  const ResponsiveWidthHeight = {width: window.innerWidth, height: window.innerHeight}
  const finishedBenchmark = useStore((state) => state.finishedBenchmark);
  const transitionEnded = useStore((state) => state.transitionEnded);

  return (
    <>
      {/* <Alert {...{useStore}} /> */}
      {/* <TutorialOverlay {...{useStore}}/> */}
      <HudMenu responsive={ResponsiveWidthHeight} {...{useStore}}/>
      <Canvas>
        <SceneContainer responsive={ResponsiveWidthHeight} {...{useStore}}/>
      </Canvas>
    </>
  );
}

export default App;