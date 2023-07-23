import { Environment, Float } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import { Camera } from "./components/Camera";
import { SimpleLoader } from "./components/SimpleLoader";
import create from 'zustand';
import { IndexMenu } from "./components/IndexMenu";
import { OrbitingPointLight } from './components/OrbitingPointLights';
import { GraphicalModeSetter } from './components/GraphicalModeSetter';
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { OrbitingMenu } from "./components/OrbitingMenu";
import { FloatingTextSkills } from "./components/FloatingTextSkills";
import { FadingText } from "./components/FadingText";
import { ExperienceMenu } from "./components/ExperienceMenu";
import { Title } from "./components/Title";
import { Text } from "./Text.jsx";
import { RegularFlickeringLight } from "./components/RegularFlickeringLight";
import { useFrame, useThree } from "@react-three/fiber";
import { FadingText3D } from "./components/FadingText3D";
import { VideoLoader } from "./components/VideoLoader";
import { PathNavigation } from "./components/PathNavigation";
import { FadingTitle } from "./components/FadingTitle";

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
    skills: ["Python", "C#", "JavaScript", "React", "Three.js", "blender", "SQL", "HTML/CSS", "anglais", "portugais"],
    currentSkillHovered: "Python",
    // if graphicalModes wont be out of range, update currentGraphicalMode
    setSkillHovered: (skill) => set((state) => ({currentSkillHovered: skill})),
    }))

export function SceneContainer() {
    const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const finishedBenchmark = useStore((state) => state.finishedBenchmark);
    const currentSkillHovered = useStore((state) => state.currentSkillHovered);
    const { gl } = useThree();

// useFrame(() => {
//     console.log("calls" + gl.info.render.calls)
//     console.log("triangles" + gl.info.render.triangles)
//     console.log("geometries" + gl.info.memory.geometries)
//     console.log("textures" + gl.info.memory.textures)
// });

    return(
        <>
            <FadingTitle initialPosition={[170, 148, 58]} {...{useStore}} textModelMenu="MainMenu" visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
            <PathNavigation {...{useStore}} possiblePaths = {["MainMenu", "Education", "Skills", "ProfessionalExpProjects0"]} />
            <Suspense fallback = {null} >
                {finishedBenchmark == false && <GraphicalModeSetter {...{useStore}} numberOfPasses={1} fpsToDecreaseGraphics={55} />}
                {/* <directionalLight  intensity={.4} position={[63,96,41]}></directionalLight>  */}
                <Environment files={process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files={process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                <Camera {...{useStore}}></Camera>
                {/* <OrbitingPointLight orbitDirection={[0, 0, 1]} orbitAxis={"y"} orbitDistance={8} orbitCenterPosition={[-34, -1, 70]} lightIntensivity={2}></OrbitingPointLight> */}
                <FadingText {...{useStore}} textToFade={Text["PROSPERE-ITB-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects0" scale={2} initialPosition={[1, 4, -82]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={Text["DRIM-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects1" scale={1.8} initialPosition={[11.5, 5.5, -94]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={Text["EVERIAL-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects2" scale={2} initialPosition={[-2, 5.5, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={Text["BRESIL-ECOBUGGY-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects3" lettersPerUnit={10} scale={1.7} initialPosition={[-11, 7, -94.5]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={Text["EFN1-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects4" lettersPerUnit={9} scale={1.8} initialPosition={[-0.5, 25, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={Text["EFN2-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects5" scale={2} lettersPerUnit={7} initialPosition={[11.5, 25, -95]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                {/* <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
                <FloatingTextSkills {...{useStore}} initialPosition={[-9, 30, -15]} /*rotation={3*(Math.PI/2)}*/></FloatingTextSkills >
                <Title initialPosition={[0, 4, 5.4]}/>
                {/* {finishedBenchmark == true && */}
                 {/* <group> */}
                    <OrbitingMenu visible={finishedBenchmark == true ? true : false} orbitDistance={7.5} orbitCenterPosition={[-17, 97, 27]}/>
                {/* </group>} */}
                <ambientLight intensity={1}></ambientLight>
                {/* <RegularFlickeringLight></RegularFlickeringLight> */}
                <Suspense>
                    <SimpleLoader modelName={"NewthreeJsScene.glb"} ambientOcclusionIntensivity={2.5}></SimpleLoader>
                </Suspense>
                <VideoLoader triggerMode={true} triggerType = {"valueString"} trigger={currentSkillHovered} defaultVideo = {"Python"} rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>
                {/* <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI/2 + 0.5235, 0]} position={[-6.45, 46.5, 14.65]} planeDimensions={[31, 16.1]}></VideoLoader>
                <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI*2 + 1.048, 0]} position={[-6.4, 46.5, -48.9]} planeDimensions={[31, 16.1]}></VideoLoader> */}
            </Suspense>
            {/* {(currentGraphicalMode == "potato")
            &&
            <group>
                <SimpleLoader modelName={"threeJsScenePotato.glb"}></SimpleLoader>
            </group>}
            {(currentGraphicalMode == "potatoPremium")
            &&
            <group>
                    <SimpleLoader modelName={"threeJsScenePotatoPremium.glb"}></SimpleLoader>
                <Float>
                    <SimpleLoader modelName={"threeJsScenePotatoPremiumFloating.glb"}></SimpleLoader>
                </Float>
            </group>}
            {(currentGraphicalMode == "normal")
            && 
            <group>
                <SimpleLoader modelName={"threeJsSceneMainMenuEducationNormal.glb"}></SimpleLoader>
                <Float>
                    <SimpleLoader modelName={"threeJsSceneNormalFloating.glb"}></SimpleLoader>
                </Float>
                <Suspense>
                    {(finishedBenchmark == true) && <SimpleLoader modelName={"threeJsSceneIslandProjectsNormal.glb"}></SimpleLoader>}
                </Suspense>
                <Suspense>
                    {(finishedBenchmark == true) && <SimpleLoader modelName={"threeJsSceneRiverNormal.glb"}></SimpleLoader>}
                </Suspense>
            </group>}
            {(currentGraphicalMode == "high")
            && <group> */}
                

                {/* <OrbitingPointLight orbitDirection={[0, 1, 0]} orbitSpeed={0.01} orbitAxis={"x"} orbitDistance={60} orbitCenterPosition={[-40, 30, 0]} lightIntensivity={1}></OrbitingPointLight> */}
                {/* <EffectComposer renderPriority={1}>
                    <Bloom luminanceThreshold={1} mipmapBlur />
                // </EffectComposer> */}
                {/* <Suspense>
                    {(finishedBenchmark == true) && <SimpleLoader modelName={"threeJsSceneIslandProjectsNormal.glb"}></SimpleLoader>}
                </Suspense> */}
            {/* </group>} */}
        </>
    );
}