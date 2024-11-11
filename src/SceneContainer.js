import { Environment } from "@react-three/drei";
import { Suspense, useState, useEffect } from "react";
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
import { GraphicalModeSetter2 } from "./components/GraphicalModeSetter2";
import { FadingTitle } from "./components/FadingTitle";
import { TranslationTable } from "./TranslationTable";
import { ResponsiveTable } from "./Styles";
import { Raycaster } from "./components/Raycaster";
import { CurveInstanceAnimation } from "./components/CurveInstanceAnimation";
import { InstanceLoader } from "./components/InstanceLoader";
import { PreloadAssets } from "./components/PreloadAssets";
import { ExplodingModelLoader } from "./components/ExplodingModelLoader";
import { customInstanceRotation, customInstanceColor } from "./PathPoints";

import * as THREE from 'three';


import config from './config.json';
// import Raycaster from './components/Raycaster';

export function SceneContainer(props) {
    const useStore = props.useStore;

    // const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const desired_path = useStore((state) => state.desired_path);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const finishedBenchmark = useStore((state) => state.finishedBenchmark);
    const currentSkillHovered = useStore((state) => state.currentSkillHovered); // eslint-disable-line no-unused-vars
    const currentLanguage = useStore((state) => state.currentLanguage);
    const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const triggers = useStore((state) => state.triggers);
    const currentObjectClicked = useStore((state) => state.currentObjectClicked);
    const mouseClicked = useStore((state) => state.mouseClicked);
    const initialSceneLoaded = useStore((state) => state.initialSceneLoaded);
    const preloadDone = useStore((state) => state.preloadDone);
    const raycasterEnabled = useStore((state) => state.raycasterEnabled);
    const setForcedCameraTarget = useStore((state) => state.setForcedCameraTarget);
    const setTrigger = useStore((state) => state.setTrigger);
    const animationTriggerState = useStore((state) => state.animationTriggerState);
    const setAnimationTriggerState = useStore((state) => state.setAnimationTriggerState);
    
    const { gl } = useThree(); // eslint-disable-line no-unused-vars
    const postloadingDelay = 3000
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


    }else if(window.innerWidth <= 4000){
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

    const [customMaterial, setCustomMaterial] = useState("");
    // Place trigger code
    useEffect(() => {
        switch (triggers) {
            case 'trigger 9':
                // console.log("clicked")
                // setCustomMaterial("NoMaterial.glb")
                break;
          }
       
    }, [triggers]);

    // Place transition code
    useEffect(() => {
        setTrigger("trigger4", false)
        setForcedCameraTarget([])
        // setTrigger("forceTransitionSpeedTrigger", true)
        switch (desired_path) {
            case 'MainMenu':
                // For now, the ExplodingModelLoader appears in the MainMenu
                // Trigger change in the camera's target
                setTrigger("trigger4", true)
                break;
          }
       
    }, [desired_path]);

    const [clickedTimes, setClickedTimes] = useState(0);

    // Place conditions for when the mouse is clicked here:
    useEffect(() => {
        // Clicked 3D objects:
        
        // CLICK COUNTER FOR DEBUG
        // setClickedTimes(clickedTimes+1)
        // console.log(clickedTimes)
        // if(clickedTimes == 5){
        //     console.log("Material CHANGE!")
        //     setCustomMaterial("LightBlueMaterial.glb")
        // }

        switch(currentObjectClicked) 
        {
            case "MainBody":
                console.log("Main body clicked!")
            break;
        }
        // Clicked 3D objects END
    }, [mouseClicked]);

    const [postloadStart, setPostloadStart] = useState(false);

    // post-loading, set the state that will post load some components a first time, so that their meshes and materials can be cached
    useEffect(() => {
        const timer1 = setTimeout(() => {
            setPostloadStart(true);
            // console.log("post load 1")
        }, postloadingDelay);

        const timer2 = setTimeout(() => {
            setPostloadStart(false);
            // console.log("post load 2")
        }, postloadingDelay+500);

        return () => {clearTimeout(timer1); clearTimeout(timer2);}; // Cleanup the timer if the component unmounts
    }, []);

    useEffect(() => {
        // Clicked 3D objects:
        console.log("animationTriggerState: " + animationTriggerState)
        // Clicked 3D objects END
    }, [animationTriggerState]);

    return(
        <>
            {(desired_path === "Education" || postloadStart) && (
            <OrbitingMenu {...{ useStore }} visible={!postloadStart} orbitDistance={7.5} orbitCenterPosition={[-17, 97, 27]} />
            )}
            <GraphicalModeSetter2 {...{useStore}} ></GraphicalModeSetter2>
            {/* <FadingTitle {...{useStore}} initialPosition = {fadingTitlePosition0} scale = {fadingTitleScale0} text = {TranslationTable[currentLanguage]["Fading_Title_1"]} textColor = {"#FFFFFF"} delay = {4000} transitionDuration = {1500} />
            <FadingTitle {...{useStore}} initialPosition = {fadingTitlePosition1} scale = {fadingTitleScale1} text = {TranslationTable[currentLanguage]["Fading_Title_2"]} textColor = {"#FFFFFF"} delay = {4600} transitionDuration = {1500} /> */}
            {/* <ExplodingModelLoader {...{useStore}} animationIsPlaying={animationTriggerState} sceneName={"Roomba.glb"} position={[163, 110, 72]} setCameraTargetTrigger={"trigger4"} ></ExplodingModelLoader> */}
            <ExplodingModelLoader {...{useStore}} materialName={customMaterial} animationIsPlaying={animationTriggerState} sceneName={"Roomba.glb"} position={[163, 110, 72]} setCameraTargetTrigger={"trigger4"} ></ExplodingModelLoader>
            <PathNavigation {...{useStore}} possiblePaths = {["MainMenu", "Education", "Skills", "ProfessionalExpProjects0"]} />
            <Suspense fallback = {null} >
                {(!finishedBenchmark && config.check_graphics) && <GraphicalModeSetter {...{useStore}} numberOfPasses = {1} fpsToDecreaseGraphics = {55} />}
                <Environment files = {process.env.PUBLIC_URL + "/textures/dikhololo_night_1k.hdr"} background />
                <Environment files = {process.env.PUBLIC_URL + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} />
                <Camera {...{useStore}} ></Camera>
                {/* {(desired_path.includes("ProfessionalExpProjects")) && 
                <> */}
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["prospere_itb_presentation"]} lettersPerUnit = {5} textModelMenu = "ProfessionalExpProjects0"     scale = {fadingTextScale0} initialPosition = {fadingTextPosition0} rotation = {2 * Math.PI} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["drim_presentation"]} textModelMenu = "ProfessionalExpProjects1"                                  scale = {fadingTextScale1} initialPosition = {fadingTextPosition1} rotation = {Math.PI/2} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["everial_presentation"]} textModelMenu = "ProfessionalExpProjects2"                               scale = {fadingTextScale2} initialPosition = {fadingTextPosition2} rotation = {Math.PI} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["bresil_ecobuggy_presentation"]} textModelMenu = "ProfessionalExpProjects3" lettersPerUnit = {10} scale = {fadingTextScale3} initialPosition = {fadingTextPosition3} rotation = {3*(Math.PI/2)} textColor={"#FFFFFF"} manualLineBreaks = {true} />
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["efn1_presentation"]} textModelMenu = "ProfessionalExpProjects4" lettersPerUnit = {9}             scale = {fadingTextScale4} initialPosition = {fadingTextPosition4} rotation = {2 * Math.PI} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                    <FadingText {...{useStore}} textToFade = {TranslationTable[currentLanguage]["efn2_presentation"]} textModelMenu = "ProfessionalExpProjects5" lettersPerUnit = {7}             scale = {fadingTextScale5} initialPosition = {fadingTextPosition5} rotation = {Math.PI/2} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                {/* </>
                } */}
                {/* {/* <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
                {/* <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText {...{useStore}} textModelMenu="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
                {(desired_path=="Skills" && transitionEnded) &&
                <FloatingTextSkills {...{useStore}} initialPosition = {[-9, 30, -15]} textPosition = {FloatingTextSkillsPosition} /> 
                }
                <ambientLight intensity = {1}></ambientLight>
                <Suspense>
                    {/* <Raycaster {...{useStore}} enabled={raycasterEnabled} mouse={mouse} frameInterval={10}> */}
                        <SimpleLoader  {...{useStore}} objectsRevealTriggers={{"Wardrobe001":"trigger3"}} animationToPlay={["ArmatureAction.002","IcosphereAction"]} loopMode={"Loop"} animationTrigger={triggers["trigger1"]} 
                        animationTimesToTrigger={{"CharacterAction": 0.50}} animationTriggerNames={{"CharacterAction": "trigger2"}} sceneName = {"NewthreeJsScene.glb"} 
                        hoverAffectedObjects={["LeftDoor","RightDoor", "MainBody"]} hoverLinkedObjects={[["LeftDoor","RightDoor", "MainBody"], ["Monitor_1", "Monitor_2"]]} 
                        ></SimpleLoader>
                        {/* <SimpleLoader {...{useStore}} animationToPlay={["Animation01"]} loopMode={"Loop"} sceneName = {"first_anim.glb"}>

                        </SimpleLoader> */}
                    {/* </Raycaster> */}
                    <InstanceLoader instancedObject={"Book.glb"} initialPosition = {[-2, 75, 32]} directionX = {0} directionY = {0} directionZ = {-1} 
                        customRotation = {customInstanceRotation} customColors = {customInstanceColor} NumberOfInstances={35} distanceBetweenInstances={3}>
                    </InstanceLoader>
                    {/* <SimpleLoader {...{useStore}} sceneName={"Book.glb"}></SimpleLoader> */}
                </Suspense>
                {/* <pointLight intensity={1} position={[43, 155, -88]}></pointLight> */}
                {/* <CurveInstanceAnimation tubeWireframe={true} instancedObject={"Plant.glb"} position={[0, 0, 0]} curve={new THREE.CatmullRomCurve3([new THREE.Vector3(-250, 40, 20), new THREE.Vector3(47, 20, -20), new THREE.Vector3(47, 40, -40)])} /> */}
                
                {/* <CurveInstanceAnimation instancedObject={"Plant.glb"} position={[0, 500, 0]} />
                {/* <VideoLoader triggerMode={true} triggerType = {"valueString"} trigger={currentSkillHovered} defaultVideo = {"Python"} rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>
                {/* <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI/2 + 0.5235, 0]} position={[-6.45, 46.5, 14.65]} planeDimensions={[31, 16.1]}></VideoLoader>
                <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI*2 + 1.048, 0]} position={[-6.4, 46.5, -48.9]} planeDimensions={[31, 16.1]}></VideoLoader> */}
            </Suspense>
            
            {(initialSceneLoaded)
            &&
            <Suspense fallback={"Loading additional scenes..."}>
                <PreloadAssets {...{useStore}} texturesToLoad={["AfficheDUT-French.png", "AfficheDUT-Portuguese.png", "AfficheEDHC-French.png", "AfficheEDHC-Portuguese.png", "AfficheMicrolins1-French.png", "AfficheMicrolins1-Portuguese.png", "AfficheMicrolins2-French.png", "AfficheMicrolins2-Portuguese.png", "AfficheUNIRN-French.png", "AfficheUNIRN-Portuguese.png"]} scenesToLoad={[]}></PreloadAssets>
            </Suspense>
            }

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