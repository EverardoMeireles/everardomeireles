import { Environment, Float } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
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
import { TranslationTable } from "./TranslationTable";
import { ResponsiveTable } from "./Styles";
import config from './config.json';

export function SceneContainer(props) {
    const useStore = props.useStore;

    // const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const finishedBenchmark = useStore((state) => state.finishedBenchmark);
    const currentSkillHovered = useStore((state) => state.currentSkillHovered);
    const currentLanguage = useStore((state) => state.currentLanguage);

    const { gl } = useThree();

// useFrame(() => {
//     console.log("calls" + gl.info.render.calls)
//     console.log("triangles" + gl.info.render.triangles)
//     console.log("geometries" + gl.info.memory.geometries)
//     console.log("textures" + gl.info.memory.textures)
// });
<VideoLoader rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>

var titlePosition0, titleScale0, titlePosition1, titleScale1,
fTextText0, fTextPosition0, fTextScale0, fTextLettersPerUnit0, fTextText1, fTextPosition1, fTextScale1, fTextLettersPerUnit1, fTextPosition2, fTextScale2, fTextLettersPerUnit2, fTextPosition3, fTextScale3, fTextLettersPerUnit3,
FloatingTextPosition,
videoLoaderPosition


//width
if(window.innerWidth < 500){
    titlePosition0 = ResponsiveTable["titlePosition0"]/*[170, 148, 58]*/
    titleScale0 = 17
    titlePosition1 = [170, 146, 59.5]
    titleScale1 = 17
    fTextText0 = "prospere_itb_presentation_mobile"
    fTextPosition0 = [1, 4, -82]
    fTextScale0 = 2
    fTextLettersPerUnit0 = 5
    fTextText1 = "drim_presentation_mobile"
    fTextPosition1 = [11.5, 4.5, -95]

}else if(window.width < 1200){

}else if(window.width <= 1920){
    titlePosition0 = [170, 148, 58]
    titleScale0 = 17
    titlePosition1 = [170, 146, 59.5]
    titleScale1 = 17
    fTextPosition0 = [1, 4, -82]
    fTextScale0 = 2
    fTextLettersPerUnit0 = 5
    // textToFade0 = "prospere_itb_presentation_mobile"

}
// titlePosition0 = [170, 148, 58]
// titleScale0 = 17
// titlePosition1 = [170, 146, 59.5]
// titleScale1 = 17

    return(
        <>
            <FadingTitle responsive={props.responsive} initialPosition={titlePosition0} {...{useStore}} scale = {titleScale0} text={"Everardo Meireles"} visible={false} textColor={"#000000"} delay={4800} transitionDuration = {1500} />
            <FadingTitle initialPosition={titlePosition1} {...{useStore}} scale = {titleScale1} text={"Developpeur Fullstack"} visible={false} textColor={"#000000"} delay={5400} transitionDuration = {1500} />
            <PathNavigation {...{useStore}} possiblePaths = {["MainMenu", "Education", "Skills", "ProfessionalExpProjects0"]} />
            <Suspense fallback = {null} >
                {(finishedBenchmark == false && config.check_graphics) && <GraphicalModeSetter {...{useStore}} numberOfPasses={1} fpsToDecreaseGraphics={55} />}
                <Environment files={process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files={process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                <Camera {...{useStore}}></Camera>
                <FadingText {...{useStore}} textToFade={TranslationTable[currentLanguage][fTextText0]} lettersPerUnit = {fTextLettersPerUnit0} textModelMenu="ProfessionalExpProjects0" scale={fTextScale0} initialPosition={fTextPosition0} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textToFade={TranslationTable[currentLanguage][fTextText1]} textModelMenu="ProfessionalExpProjects1" scale={1.8} initialPosition={fTextPosition1} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
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
                <FloatingTextSkills {...{useStore}} initialPosition={[-9, 30, -15]} />
                {/* <Title initialPosition={[0, 4, 5.4]}/> */}
                <OrbitingMenu visible={finishedBenchmark == true ? true : false} orbitDistance={7.5} orbitCenterPosition={[-17, 97, 27]}/>
                <ambientLight intensity={1}></ambientLight>
                <Suspense>
                    <SimpleLoader modelName={"NewthreeJsScene.glb"} ambientOcclusionIntensivity={2.5}></SimpleLoader>
                </Suspense>
                {/* <VideoLoader triggerMode={true} triggerType = {"valueString"} trigger={currentSkillHovered} defaultVideo = {"Python"} rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>
                {/* <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI/2 + 0.5235, 0]} position={[-6.45, 46.5, 14.65]} planeDimensions={[31, 16.1]}></VideoLoader>
                <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI*2 + 1.048, 0]} position={[-6.4, 46.5, -48.9]} planeDimensions={[31, 16.1]}></VideoLoader> */}
            </Suspense>
        
            {/* {(currentGraphicalMode == "high")
            && <group>
                <OrbitingPointLight orbitDirection = {[0, 1, 0]} orbitSpeed = {0.01} orbitAxis = {"x"} orbitDistance = {60} orbitCenterPosition = {[-40, 30, 0]} lightIntensivity = {1}></OrbitingPointLight>
                <EffectComposer renderPriority = {1}>
                    <Bloom luminanceThreshold = {1} mipmapBlur />
                </EffectComposer>
                <Suspense>
                    {(finishedBenchmark == true) && <SimpleLoader modelName = {"threeJsSceneIslandProjectsNormal.glb"}></SimpleLoader>}
                </Suspense>
            </group>} */}
        </>
    );
}