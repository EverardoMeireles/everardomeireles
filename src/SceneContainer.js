import { Environment } from "@react-three/drei";
import { Suspense, useState } from "react";
import { Camera } from "./components/Camera";
import { SimpleLoader } from "./components/SimpleLoader";
import { OrbitingPointLight } from './components/OrbitingPointLights';
import { GraphicalModeSetter } from './components/GraphicalModeSetter';
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { OrbitingMenu } from "./components/OrbitingMenu";
import { FloatingTextSkills } from "./components/FloatingTextSkills";
import { FadingText } from "./components/FadingText";
import { useFrame, useThree } from "@react-three/fiber"; // eslint-disable-line no-unused-vars
import { VideoLoader } from "./components/VideoLoader";
import { PathNavigation } from "./components/PathNavigation";
import { FadingTitle } from "./components/FadingTitle";
import { TranslationTable } from "./TranslationTable";
import { ResponsiveTable } from "./Styles";
import { Raycaster } from "./components/Raycaster";
import config from './config.json';

export function SceneContainer(props) {
    const useStore = props.useStore;

    // const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const finishedBenchmark = useStore((state) => state.finishedBenchmark);
    const currentSkillHovered = useStore((state) => state.currentSkillHovered); // eslint-disable-line no-unused-vars
    const currentLanguage = useStore((state) => state.currentLanguage);
    const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const triggers = useStore((state) => state.triggers);

    const { gl } = useThree(); // eslint-disable-line no-unused-vars
useFrame(() => {
    //console.log(i)
    // console.log("calls" + gl.info.render.calls)
    // console.log("triangles" + gl.info.render.triangles)
    // console.log("geometries" + gl.info.memory.geometries)
    // console.log("textures" + gl.info.memory.textures)

});
<VideoLoader rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>

var fadingTitlePosition0, fadingTitleScale0, fadingTitlePosition1, fadingTitleScale1,
fadingTextPosition0, fadingTextScale0, fadingTextPosition1, fadingTextScale1, 
fadingTextPosition2, fadingTextScale2, fadingTextPosition3, fadingTextScale3, fadingTextPosition4, fadingTextScale4, 
fadingTextPosition5, fadingTextScale5, FloatingTextSkillsPosition

if(window.innerWidth < 500){
    fadingTitlePosition0 = ResponsiveTable["Mobile"]["fadingTitlePosition0"]
    fadingTitleScale0 = ResponsiveTable["Mobile"]["fadingTitleScale0"]
    fadingTitlePosition1 = ResponsiveTable["Mobile"]["fadingTitlePosition1"]
    fadingTitleScale1 = ResponsiveTable["Mobile"]["fadingTitleScale1"]
    fadingTextPosition0 = ResponsiveTable["Mobile"]["fadingTextPosition0"]
    fadingTextScale0 = ResponsiveTable["Mobile"]["fadingTextScale0"]
    fadingTextPosition1 = ResponsiveTable["Mobile"]["fadingTextPosition1"]
    fadingTextScale1 = ResponsiveTable["Mobile"]["fadingTextScale1"]
    fadingTextPosition2 = ResponsiveTable["Mobile"]["fadingTextPosition2"]
    fadingTextScale2 = ResponsiveTable["Mobile"]["fadingTextScale2"]
    fadingTextPosition3 = ResponsiveTable["Mobile"]["fadingTextPosition3"]
    fadingTextScale3 = ResponsiveTable["Mobile"]["fadingTextScale3"]
    fadingTextPosition4 = ResponsiveTable["Mobile"]["fadingTextPosition3"]
    fadingTextScale4 = ResponsiveTable["Mobile"]["fadingTextScale3"]
    fadingTextPosition5 = ResponsiveTable["Mobile"]["fadingTextPosition3"]
    fadingTextScale5 = ResponsiveTable["Mobile"]["fadingTextScale3"]
    FloatingTextSkillsPosition = ResponsiveTable["Mobile"]["FloatingTextSkillsPosition"]

}else if(window.innerWidth < 1200){
    fadingTitlePosition0 = ResponsiveTable["Tablet"]["fadingTitlePosition0"]
    fadingTitleScale0 = ResponsiveTable["Tablet"]["fadingTitleScale0"]
    fadingTitlePosition1 = ResponsiveTable["Tablet"]["fadingTitlePosition1"]
    fadingTitleScale1 = ResponsiveTable["Tablet"]["fadingTitleScale1"]
    fadingTextPosition0 = ResponsiveTable["Tablet"]["fadingTextPosition0"]
    fadingTextScale0 = ResponsiveTable["Tablet"]["fadingTextScale0"]
    fadingTextPosition1 = ResponsiveTable["Tablet"]["fadingTextPosition1"]
    fadingTextScale1 = ResponsiveTable["Tablet"]["fadingTextScale1"]
    fadingTextPosition2 = ResponsiveTable["Tablet"]["fadingTextPosition2"]
    fadingTextScale2 = ResponsiveTable["Tablet"]["fadingTextScale2"]
    fadingTextPosition3 = ResponsiveTable["Tablet"]["fadingTextPosition3"]
    fadingTextScale3 = ResponsiveTable["Tablet"]["fadingTextScale3"]
    fadingTextPosition4 = ResponsiveTable["Tablet"]["fadingTextPosition3"]
    fadingTextScale4 = ResponsiveTable["Tablet"]["fadingTextScale3"]
    fadingTextPosition5 = ResponsiveTable["Tablet"]["fadingTextPosition3"]
    fadingTextScale5 = ResponsiveTable["Tablet"]["fadingTextScale3"]
    FloatingTextSkillsPosition = ResponsiveTable["Tablet"]["FloatingTextSkillsPosition"]


}else if(window.innerWidth <= 1800){
    fadingTitlePosition0 = ResponsiveTable["Widescreen"]["fadingTitlePosition0"]
    fadingTitleScale0 = ResponsiveTable["Widescreen"]["fadingTitleScale0"]
    fadingTitlePosition1 = ResponsiveTable["Widescreen"]["fadingTitlePosition1"]
    fadingTitleScale1 = ResponsiveTable["Widescreen"]["fadingTitleScale1"]
    fadingTextPosition0 = ResponsiveTable["Widescreen"]["fadingTextPosition0"]
    fadingTextScale0 = ResponsiveTable["Widescreen"]["fadingTextScale0"]
    fadingTextPosition1 = ResponsiveTable["Widescreen"]["fadingTextPosition1"]
    fadingTextScale1 = ResponsiveTable["Widescreen"]["fadingTextScale1"]
    fadingTextPosition2 = ResponsiveTable["Widescreen"]["fadingTextPosition2"]
    fadingTextScale2 = ResponsiveTable["Widescreen"]["fadingTextScale2"]
    fadingTextPosition3 = ResponsiveTable["Widescreen"]["fadingTextPosition3"]
    fadingTextScale3 = ResponsiveTable["Widescreen"]["fadingTextScale3"]
    fadingTextPosition4 = ResponsiveTable["Widescreen"]["fadingTextPosition4"]
    fadingTextScale4 = ResponsiveTable["Widescreen"]["fadingTextScale4"]
    fadingTextPosition5 = ResponsiveTable["Widescreen"]["fadingTextPosition5"]
    fadingTextScale5 = ResponsiveTable["Widescreen"]["fadingTextScale5"]
    FloatingTextSkillsPosition = ResponsiveTable["Widescreen"]["FloatingTextSkillsPosition"]
}
const { mouse } = useThree();

    return(
        <>
            <FadingTitle {...{useStore}} initialPosition = {fadingTitlePosition0} scale = {fadingTitleScale0} text = {"Everardo Meireles"} visible = {false} textColor = {"#000000"} delay = {5000} transitionDuration = {1500} />
            <FadingTitle {...{useStore}} initialPosition = {fadingTitlePosition1} scale = {fadingTitleScale1} text = {"Developpeur Fullstack"} visible = {false} textColor = {"#000000"} delay = {5600} transitionDuration = {1500} />
            <PathNavigation {...{useStore}} possiblePaths = {["MainMenu", "Education", "Skills", "ProfessionalExpProjects0"]} />
            <Suspense fallback = {null} >
                {(!finishedBenchmark && config.check_graphics) && <GraphicalModeSetter {...{useStore}} numberOfPasses = {1} fpsToDecreaseGraphics = {55} />}
                <Environment files = {process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files = {process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                <Camera {...{useStore}}></Camera>
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["prospere_itb_presentation"]} lettersPerUnit = {5} textModelMenu = "ProfessionalExpProjects0" scale = {fadingTextScale0} initialPosition = {fadingTextPosition0} rotation = {2 * Math.PI} visible = {false} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["drim_presentation"]} textModelMenu = "ProfessionalExpProjects1" scale = {fadingTextScale1} initialPosition = {fadingTextPosition1} rotation = {Math.PI/2} visible = {false} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["everial_presentation"]} textModelMenu = "ProfessionalExpProjects2" scale = {fadingTextScale2} initialPosition = {fadingTextPosition2} rotation = {Math.PI} visible = {false} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["bresil_ecobuggy_presentation"]} textModelMenu = "ProfessionalExpProjects3" lettersPerUnit = {10} scale = {fadingTextScale3} initialPosition = {fadingTextPosition3} rotation = {3*(Math.PI/2)} visible = {false} textColor={"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["efn1_presentation"]} textModelMenu = "ProfessionalExpProjects4" lettersPerUnit = {9} scale = {fadingTextScale4} initialPosition = {fadingTextPosition4} rotation = {2 * Math.PI} visible = {false} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["efn2_presentation"]} textModelMenu = "ProfessionalExpProjects5" scale = {fadingTextScale5} lettersPerUnit = {7} initialPosition = {fadingTextPosition5} rotation = {Math.PI/2} visible = {false} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                {/* {/* <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
                {/* <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
                <FloatingTextSkills {...{useStore}} initialPosition = {[-9, 30, -15]} textPosition = {FloatingTextSkillsPosition} />
                <OrbitingMenu {...{useStore}} visible = { (config.check_graphics === false || finishedBenchmark === true) ? true : false} orbitDistance = {7.5} orbitCenterPosition = {[-17, 97, 27]}/>
                <ambientLight intensity = {1}></ambientLight>
                <Suspense>
                    <Raycaster mouse={mouse} frameInterval={10}>
                        <SimpleLoader animationToPlay={["LeftDoorOpen","RightDoorOpen"]} animationTrigger={triggers["trigger1"]} /*position={[160, 143, 62]}*/ sceneName = {"NewthreeJsScene.glb"} 
                        hoverAffectedObjects={["LeftDoor","RightDoor", "MainBody"]} hoverLinkedObjects={[["LeftDoor","RightDoor", "MainBody"], ["Monitor_1", "Monitor_2"]]} 
                        ></SimpleLoader>
                    </Raycaster>
                </Suspense>
                {/* <VideoLoader triggerMode={true} triggerType = {"valueString"} trigger={currentSkillHovered} defaultVideo = {"Python"} rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>
                {/* <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI/2 + 0.5235, 0]} position={[-6.45, 46.5, 14.65]} planeDimensions={[31, 16.1]}></VideoLoader>
                <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI*2 + 1.048, 0]} position={[-6.4, 46.5, -48.9]} planeDimensions={[31, 16.1]}></VideoLoader> */}
            </Suspense>
        
            {(currentGraphicalMode === "high")
            && <group>
                <OrbitingPointLight orbitDirection = {[0, 1, 0]} orbitSpeed = {0.01} orbitAxis = {"x"} orbitDistance = {60} orbitCenterPosition = {[-40, 30, 0]} lightIntensivity = {1}></OrbitingPointLight>
                <EffectComposer renderPriority = {1}>
                    <Bloom luminanceThreshold = {1} mipmapBlur />
                </EffectComposer>
                <Suspense>
                    {/* {(finishedBenchmark === true) && <SimpleLoader modelName = {"threeJsSceneIslandProjectsNormal.glb"}></SimpleLoader>} */}
                </Suspense>
            </group>}
        </>
    );
}