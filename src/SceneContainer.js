import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Camera } from "./components/Camera";
import { SimpleLoader } from "./components/SimpleLoader";
import create from 'zustand';
import { IndexMenu } from "./components/IndexMenu";
import { ProjectsMenu } from "./components/ProjectsMenu";
import { OrbitingPointLight } from './components/OrbitingPointLights';
import { GraphicalModeSetter } from './components/GraphicalModeSetter';
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { OrbitingMenu } from "./components/OrbitingMenu";
import { FloatingTextSkills } from "./components/FloatingTextSkills";

const useStore = create((set) => ({
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({desired_path: desired})),
    transitionEnded: false,
    setTransitionEnded: (ended) => set(() => ({transitionEnded: ended})),
    graphicalModes: ["potato", "potatoPremium", "normal", "high"],
    currentGraphicalMode: "",
    // if graphicalModes wont be out of range, update currentGraphicalMode
    setGraphicalMode: (mode) => set((state) => ({currentGraphicalMode: mode})),
    finishedBenchmark: false,
    setFinishedBenchmark: (finished) => set(() => ({finishedBenchmark: finished})),
    }))

export function SceneContainer() {
    const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const finishedBenchmark = useStore((state) => state.finishedBenchmark);

    return(
        <>
            <Suspense fallback = {null}>
                <SimpleLoader></SimpleLoader>
                {/* <directionalLight intensity={0.4} position={[63,96,41]}></directionalLight> */}
                <Environment files={process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files={process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                {/* <ambientLight intensity={0.1}></ambientLight> */}
                {finishedBenchmark == false && <GraphicalModeSetter {...{useStore}} />}
                <Camera {...{useStore}} />
                <FloatingTextSkills></FloatingTextSkills >
                <OrbitingMenu orbitDistance={7.5} orbitCenterPosition={[-17, -34, -4]}/>
                <OrbitingMenu orbitDistance={7.5}></OrbitingMenu>
            </Suspense>
            {(currentGraphicalMode == "potato")
            && 
            <group>
                <Suspense fallback = {null}>
                    <ambientLight />
                    <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} />
                    <SimpleLoader></SimpleLoader>
                </Suspense>
            </group>}
            {(currentGraphicalMode == "potatoExtra")
            && 
            <group>
                <Suspense fallback = {null}>
                    <OrbitingPointLight></OrbitingPointLight>
                    <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} /> 
                    <SimpleLoader></SimpleLoader>
                </Suspense>
            </group>}
            {(currentGraphicalMode == "potatoPremium")
            && 
            <group>
                <Suspense fallback = {null}>
                    <OrbitingPointLight></OrbitingPointLight>
                    <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} />
                    <SimpleLoader></SimpleLoader>
                </Suspense>
            </group>}
            {(currentGraphicalMode == "normal")
            && 
            <group>
                <Suspense fallback = {null}>
                    <OrbitingPointLight></OrbitingPointLight>
                    {/* <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} /> */}
                </Suspense>
            </group>}
            {(currentGraphicalMode == "high")
            && <group>
                <Suspense fallback = {null}>
                <OrbitingMenu orbitCenterPosition={[15.5, 1.1, 0]}></OrbitingMenu>
                {/* <OrbitingPointLight></OrbitingPointLight> */}
                {/* <IndexMenu {...{useStore}}></IndexMenu>
                <ProjectsMenu {...{useStore}} />  */}
                {/* <EffectComposer renderPriority={1}>
                    <Bloom luminanceThreshold={1} mipmapBlur />
                </EffectComposer> */}
                </Suspense>
            </group>}
        </>
    );
}