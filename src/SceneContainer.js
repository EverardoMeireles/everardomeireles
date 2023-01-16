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
                <Environment background = {"only"} files = {process.env.PUBLIC_URL + "/textures/bg.hdr"} />
                <Environment background = {false} files = {process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
                {finishedBenchmark == false && <GraphicalModeSetter {...{useStore}} />}

            </Suspense>
            <Camera {...{useStore}} />
            
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
                    <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} />
                </Suspense>
            </group>}
            {(currentGraphicalMode == "masterpiece")
            && <group>
                <Suspense fallback = {null}>
                <OrbitingPointLight></OrbitingPointLight>
                <IndexMenu {...{useStore}}></IndexMenu>
                <ProjectsMenu {...{useStore}} /> 
                <SimpleLoader></SimpleLoader>
                {/* <EffectComposer renderPriority={1}>
                    <Bloom luminanceThreshold={1} mipmapBlur />
                </EffectComposer> */}
                </Suspense>
            </group>}
        </>
    );
}