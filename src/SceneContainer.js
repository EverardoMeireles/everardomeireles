import { Environment } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
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
import { FadingSlideShowModel } from "./components/FadingSlideShowModel";
import { FadingTextModel } from "./components/FadingTextModel";
import { ExperienceMenu } from "./components/ExperienceMenu";
import { Title } from "./components/Title";
import { Text } from "./Text.jsx";

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

const directSun = useRef()

useEffect(()=>{
    console.log(directSun.current)
    // directSun.current.target.position = [-38, -1, 66]
    // directSun.current.target.position = [-38, -1, 66]
})

    return(
        <>
                        {/* <directionalLight ref={directSun} intensity={2} target-position={[-38, -1, 66]}  position={[-19, 18, 97]}></directionalLight>  */}
            {/* <pointLight position={[-32, 16, 91]} intensity={.3} ></pointLight> */}
            <Suspense fallback = {null} >
                {/* <SimpleLoader></SimpleLoader> */}
                {/* <directionalLight  intensity={.4} position={[63,96,41]}></directionalLight>  */}
                <Environment files={process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files={process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                {/* <OrbitingPointLight lightIntensivity={.3}></OrbitingPointLight> */}
                {finishedBenchmark == false && <GraphicalModeSetter {...{useStore}} />}
                <Camera {...{useStore}}></Camera>
                <FloatingTextSkills initialPosition={[-41, 0, 68]} rotation={3*(Math.PI/2)}></FloatingTextSkills >
                
                {/* <OrbitingPointLight orbitDirection={[0, 0, 1]} orbitAxis={"y"} orbitDistance={8} orbitCenterPosition={[-34, -1, 70]} lightIntensivity={2}></OrbitingPointLight> */}


                <OrbitingMenu orbitDistance={7.5} orbitCenterPosition={[-6, -35, -4]}/>
                {/* <FadingSlideShowModel {...{useStore}} />
                <FadingTextModel {...{useStore}} initialPosition={[0, 0, -10]} ></FadingTextModel> */}
                {/* <SimpleLoader></SimpleLoader> */}
                <FadingTextModel {...{useStore}} textToFade={Text["PROSPERE-ITB-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects0" scale={2} initialPosition={[1, 4, -82]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                <FadingTextModel {...{useStore}} textToFade={Text["DRIM-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects1" scale={1.8} initialPosition={[11.5, 5.5, -94]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                <FadingTextModel {...{useStore}} textToFade={Text["EVERIAL-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects2" scale={2} initialPosition={[-2, 5.5, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                <FadingTextModel {...{useStore}} textToFade={Text["BRESIL-ECOBUGGY-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects3" lettersPerUnit={10} scale={1.7} initialPosition={[-11, 7.5, -94.5]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                <FadingTextModel {...{useStore}} textToFade={Text["EFN1-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects4" lettersPerUnit={9} scale={1.8} initialPosition={[-0.5, 27, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                <FadingTextModel {...{useStore}} textToFade={Text["EFN2-PRESENTATION"]["FR"]} textModelMenu="ProfessionalExpProjects5" scale={2.5} lettersPerUnit={7} initialPosition={[11.5, 23, -96]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} istext3d={false}/>
                {/* <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} text3dMode={false}/>
                <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} text3dMode={false}/>
                <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} text3dMode={false}/>
                <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} text3dMode={false}/>
                <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} text3dMode={false}/>
                <FadingTextModel {...{useStore}} textModelMenu="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} text3dMode={false}/> */}
                <ExperienceMenu {...{useStore}} scale={1} /*position={[-7, 0, -81]} rotation={-Math.PI/3}*/></ExperienceMenu>
                <Title initialPosition={[0, 4, 5.4]}/>
                <IndexMenu {...{useStore}} isMainMenu></IndexMenu>
                <IndexMenu {...{useStore}} position={[-13, -38.5, -1.3]} rotation={2 * Math.PI/12} scale={0.23} ></IndexMenu>
                <IndexMenu {...{useStore}} position={[-50, -2, 65]} rotation={  Math.PI} scale={0.35} ></IndexMenu>
                {/* <ambientLight intensity={1}></ambientLight> */}

            </Suspense>
            {(currentGraphicalMode == "potato")
            &&
            <group>
                <Suspense fallback = {null}>
                    <SimpleLoader modelName={"threeJsScenePotato.glb"}></SimpleLoader>
                    <ambientLight intensity={1}></ambientLight>
                    {/* <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} /> */}
                </Suspense>
            </group>}
            {(currentGraphicalMode == "potatoPremium")
            && 
            <group>
                <Suspense fallback = {null}>
                    <SimpleLoader modelName={"threeJsSceneNormal.glb"}></SimpleLoader>
                    
                    {/* <OrbitingPointLight></OrbitingPointLight> */}
                    {/* <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} /> */}
                    {/* <SimpleLoader></SimpleLoader> */}
                </Suspense>
            </group>}
            {(currentGraphicalMode == "normal")
            && 
            <group>
                <Suspense fallback = {null}>
                    <SimpleLoader modelName={"threeJsSceneNormal.glb"}></SimpleLoader>
                    {/* <OrbitingPointLight></OrbitingPointLight> */}
                    {/* <IndexMenu {...{useStore}}></IndexMenu>
                    <ProjectsMenu {...{useStore}} /> */}
                </Suspense>
            </group>}
            {(currentGraphicalMode == "high")
            && <group>
                <Suspense fallback = {null}>
                <SimpleLoader modelName={"threeJsSceneNormal.glb"}></SimpleLoader>
                <OrbitingPointLight orbitDirection={[0, 1, 0]} orbitSpeed={0.01} orbitAxis={"x"} orbitDistance={60} orbitCenterPosition={[-40, 30, 0]} lightIntensivity={10}></OrbitingPointLight>
                {/* <pointLight position={[-11, 3, -124]}></pointLight> */}
                {/* <SimpleLoader modelName={"threeJsScenePotato.glb"}></SimpleLoader> */}
                {/* <directionalLight  intensity={.4} position={[63,96,41]}></directionalLight>  */}
                {/* <OrbitingPointLight orbitDirection={[0, 1, 0]} orbitSpeed={0.05} orbitAxis={"x"} orbitDistance={2} orbitCenterPosition={[0, 0, 0]} lightIntensivity={2}></OrbitingPointLight> */}
                {/* <OrbitingMenu orbitCenterPosition={[15.5, 1.1, 0]}></OrbitingMenu> */}
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