import { Environment } from "@react-three/drei";
import React, { Suspense, useState, useEffect, useRef, useMemo  } from "react";
import { Camera } from "./system_components/Camera.jsx";
import { SimpleLoader } from "./system_components/SimpleLoader.jsx";
import { OrbitingPointLight } from './system_components/OrbitingPointLights.jsx';
import { GraphicalModeSetter } from './system_components/GraphicalModeSetter.jsx';
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { OrbitingMenu } from "./system_components/OrbitingMenu.jsx";
import { FloatingTextSkills } from "./user_components/FloatingTextSkills.jsx";
import { FadingText } from "./system_components/FadingText.jsx";
import { useFrame, useThree, useLoader } from "@react-three/fiber"; // eslint-disable-line no-unused-vars
import { VideoLoader } from "./system_components/VideoLoader.jsx";
import { GraphicalModeSetter2 } from "./system_components/GraphicalModeSetter2.jsx";
import { FadingTitle } from "./system_components/FadingTitle.jsx";
import { Raycaster } from "./system_components/Raycaster.jsx";
import { CurveInstanceAnimation } from "./system_components/CurveInstanceAnimation.jsx";
import { InstanceLoader } from "./system_components/InstanceLoader.jsx";
import { PreloadAssets } from "./system_components/PreloadAssets.jsx";
import { ExplodingModelLoader } from "./system_components/ExplodingModelLoader.jsx";
import { CurveLightAnimation } from "./system_components/CurveLightAnimation.jsx";
import { PointLightAnimation } from "./system_components/PointLightAnimation.jsx";
import { ObjectLink } from "./system_components/ObjectLink.jsx";
import { ParticleEmitter } from "./system_components/ParticleEmitter.jsx";
import { DynamicMaterialLoader } from "./system_components/DynamicMaterialLoader.jsx";
import { CircularScrollLoader } from "./system_components/CircularScrollLoader.jsx";
import { AnimationMixer } from 'three';
import { customInstanceRotation, customInstanceColor } from "./PathPoints.jsx";
import { TranslationTable } from "./TranslationTable.jsx";
import { useResponsive } from "./Styles.jsx";
import { pollForFilesInTHREECache, createTimer } from "./Helper.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import * as THREE from 'three';

import config from './config.js';
import SystemStore from "./SystemStore.js";
import UserStore from "./UserStore.js";

export const SceneContainer = React.memo((props) => {
    const transitionDestination = SystemStore((state) => state.transitionDestination);
    const transitionEnded = SystemStore((state) => state.transitionEnded);
    const currentLanguage = SystemStore((state) => state.currentLanguage);
    const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
    const triggers = SystemStore((state) => state.triggers);
    const currentObjectClicked = SystemStore((state) => state.currentObjectClicked);
    const mouseClicked = SystemStore((state) => state.mouseClicked);
    const preloadDone = SystemStore((state) => state.preloadDone);
    const raycasterEnabled = SystemStore((state) => state.raycasterEnabled);
    const setForcedCameraTarget = SystemStore((state) => state.setForcedCameraTarget);
    const setForcedCameraMovePathCurve = SystemStore((state) => state.setForcedCameraMovePathCurve);
    const setTrigger = SystemStore((state) => state.setTrigger);
    const setMainScene = SystemStore((state) => state.setMainScene);
    const mainScene = SystemStore((state) => state.mainScene);
    const viewerModelName = SystemStore((state) => state.viewerModelName);
    const viewerConfigFile = SystemStore((state) => state.viewerConfigFile);
    const viewerMaterialName = SystemStore((state) => state.viewerMaterialName);
    const hudMenuEnabled = SystemStore((state) => state.hudMenuEnabled);
    const setHudMenuEnabled = SystemStore((state) => state.setHudMenuEnabled);

    const currentSkillHovered = UserStore((state) => state.currentSkillHovered);
    const animationTriggerState = UserStore((state) => state.animationTriggerState);
    const setAnimationTriggerState = UserStore((state) => state.setAnimationTriggerState);
    const siteMode = UserStore((state) => state.siteMode);

    const sceneName = useMemo(
        () => siteMode === "resume" ? "NewthreeJsScene.glb" : "base_cube_DO_NOT_REMOVE.glb",
        [siteMode]
    );
    const scene = useLoader(GLTFLoader, `${config.resource_path}/models/${sceneName}`);

    useEffect(() => {
        setMainScene(scene);
    }, [scene, setMainScene]);

    const { gl } = useThree();
    const { mouse } = useThree();
    let mixer;

    const animTimeRef = useRef(0);


    const [forceLowresMaterial, setForceLowresMaterial] = useState(false);
    const [forceMidresMaterial, setForceMidresMaterial] = useState(false);
    const [forceHighResMaterial, setForceHighResMaterial] = useState(false);

    const [enableMaterialSwap, setEnableMaterialSwap] = useState(false);

    const filesToLoadBeforeEnablingMaterialSwap = ["/materials/low_512.glb", "/materials/high_4096_NOPBR.glb", "/materials/high_4096_PBR.glb"]; 

    const { layout } = useResponsive("scene");

    ////////////////////////////////////////////////////
    ///////////////// One-time effects /////////////////
    ////////////////////////////////////////////////////

    // Block forcing the scene's materials to change until the materials are properly loaded
    useEffect(() => {
        let cancelled = false;
        const intervalId = setInterval(() => {
        if (!cancelled) {
            const success = pollForFilesInTHREECache(filesToLoadBeforeEnablingMaterialSwap);
            if (success) {
                setEnableMaterialSwap(true);
                clearInterval(intervalId);
            }
        }
        }, 1000); // Check every 1000 milliseconds

        return () => {
        cancelled = true;
        clearInterval(intervalId);
        };
    }, [setEnableMaterialSwap]);

    // Force swap the scene's materials if graphical mode changes
    useEffect(() => {
        if(enableMaterialSwap){
            setForceLowresMaterial(false);
            setForceMidresMaterial(false);
            setForceHighResMaterial(false);
            switch (currentGraphicalMode) {
                case "potato":
                    setForceLowresMaterial(true)
                    break;
                case "potatoPremium":
                case "normal":
                    setForceMidresMaterial(true)
                    break;
                case "high":
                    setForceHighResMaterial(true)
                    break;
            }
        }
        
    },[currentGraphicalMode])

    useEffect(() => {
        if (!mainScene || !mainScene.animations?.length) return; // Ensure there are animations in the GLTF
        
        mixer = new AnimationMixer(mainScene.scene); // Create an AnimationMixer

        const action = mixer.clipAction(mainScene.animations[0]); // Get the first animation clip (index 0)

        action.play(); // Play the animation

        // Update the mixer in your render loop
        const clock = new THREE.Clock();
        const tick = () => {
        const delta = clock.getDelta(); // Time since last frame
        mixer.update(delta); // Update mixer with delta time
        requestAnimationFrame(tick); // Continue the loop
        animTimeRef.current = action.time.toFixed(2)
        };

        tick(); // Start the loop

        // Cleanup function to stop the mixer when the component unmounts
        return () => mixer.stopAllAction();
    }, [mainScene]);

    ////////////////////////////////////////////////////
    //////////////// Functional effects ////////////////
    ////////////////////////////////////////////////////

    // Place trigger code
    useEffect(() => {
        switch (triggers) {
            case 'trigger 9':
                // console.log("clicked")
                // setCustomMaterial("base_material_DO_NOT_REMOVE.glb")
                break;
          }
       
    }, [triggers]);

    // Place transition code
    useEffect(() => {
        switch (transitionDestination) {
            case 'MainMenu':
                
                break;
          }
       
    }, [transitionDestination]);

    // Place conditions for when the mouse is clicked here:
    useEffect(() => {
        // Clicked 3D objects:
        switch(currentObjectClicked) 
        {
            case "MainBody":
                console.log("Main body clicked!")
            break;
        }
        // Clicked 3D objects END
    }, [mouseClicked]);

    // For ExplodingModelLoader
    useEffect(() => {
        // Clicked 3D objects:
        // console.log("animationTriggerState: " + animationTriggerState)
        // Clicked 3D objects END
    }, [animationTriggerState]);
    
    ////////////////////////////////////////////////////
    /////////////////////// Debug //////////////////////
    ////////////////////////////////////////////////////

    //3D info
    // useEffect(() => {
    //     const intervalId = setInterval(() => {
    //         console.clear()
    //         console.log("calls: " + gl.info.render.calls)
    //         console.log("triangles: " + gl.info.render.triangles)
    //         console.log("geometries: " + gl.info.memory.geometries)
    //         console.log("textures: " + gl.info.memory.textures)
    //         // console.log("---------------------")
    //         }, 500); // Check every 1000 milliseconds
        
    //         return () => {
    //             clearInterval(intervalId);
    //         };
    // },[])

    // FPS counter
    // const accuDeltasForFPS = useRef(0);
    // const accuFramesForFPS = useRef(0);
    useFrame((state, delta)=>{
        // accuDeltasForFPS.current += delta;
        // accuFramesForFPS.current += 1;
        // if(accuDeltasForFPS.current >= 1){
        //     console.log("FPS:" + accuFramesForFPS.current);
        //     accuDeltasForFPS.current = 0;
        //     accuFramesForFPS.current = 0;
        // }
                            //   console.log(modelsConfiguration)

    });
    
    ///////////////////////////
    // E-comerce integration //
    ///////////////////////////

    useEffect(() => {
        setHudMenuEnabled(siteMode === "resume");
    }, [siteMode, hudMenuEnabled]);

    const explodingModelPath = viewerModelName || "base_cube_DO_NOT_REMOVE.glb";
    const explodingConfigFile = viewerConfigFile || "base_cube_DO_NOT_REMOVE.json";
    const explodingMaterialPath = viewerMaterialName || "";

    function TubeCurve({
        curve,
        tubularSegments = 64,
        radius = 0.1,
        radialSegments = 8,
        closed = false,
      }) {
        return (
          <mesh>
            <tubeGeometry
              args={[curve, tubularSegments, radius, radialSegments, closed]}
            />
            <meshBasicMaterial wireframe={true} />
          </mesh>
        )
      }

    const [trig, setTrig] = useState(false);

    //////////////////////////////////
    // Temporary initial transition //
    //////////////////////////////////
    
    // Temporary useEffect to initialize the position and camera target of both scenes
    useEffect(() => {
        if(siteMode == "resume"){
            const tempCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(278, 206, -6),
                new THREE.Vector3(260, 190, 18),
                new THREE.Vector3(199, 150, 46)])

                setForcedCameraTarget([45, 21, -50])
                setForcedCameraMovePathCurve(tempCurve);
        }else{
            // setForcedCameraTarget([166, 137, 49])
            setForcedCameraTarget([0, 0, 0])

        }
    }, []);

    //////////////////////////
    // Memoization of props //
    //////////////////////////

    const texturesToLoad = useMemo(() => [
        "AfficheDUT-French.jpg",
        "AfficheDUT-Portuguese.jpg",
        "AfficheEDHC-French.jpg",
        "AfficheEDHC-Portuguese.jpg",
        "AfficheMicrolins1-French.jpg",
        "AfficheMicrolins1-Portuguese.jpg",
        "AfficheMicrolins2-French.jpg",
        "AfficheMicrolins2-Portuguese.jpg",
        "AfficheUNIRN-French.jpg",
        "AfficheUNIRN-Portuguese.jpg",
        "AfficheOrtBTS-French.jpg",
        "AfficheOrtBTS-Portuguese.jpg",
        "AfficheOrt3CSI-French.jpg",
        "AfficheOrt3CSI-Portuguese.jpg"
    ], []);

    const scenesToLoad = useMemo(() => [], []);

    const orbitCenterPosition = useMemo(() => [-17, 97, 27], []);

    const TranslationTable0 = useMemo(() => TranslationTable[currentLanguage]["prospere_itb_presentation"], []);
    const TranslationTable1 = useMemo(() => TranslationTable[currentLanguage]["drim_presentation"], []);
    const TranslationTable2 = useMemo(() => TranslationTable[currentLanguage]["everial_presentation"], []);
    const TranslationTable3 = useMemo(() => TranslationTable[currentLanguage]["bresil_ecobuggy_presentation"], []);
    const TranslationTable4 = useMemo(() => TranslationTable[currentLanguage]["efn1_presentation"], []);
    const TranslationTable5 = useMemo(() => TranslationTable[currentLanguage]["efn2_presentation"], []);

    const initialPosition = useMemo(() => [-2, 75, 32], []);

    const objectsRevealTriggers = useMemo(() => ({"Wardrobe001":"trigger3"}), []);
    const animationTimesToTrigger = useMemo(() => ({"CharacterAction": 0.50}), []);
    const animationTriggerNames = useMemo(() => ({"CharacterAction": "trigger2"}), []);
    const animationToPlay = useMemo(() => ["LampAction.001","RopeAction"], []);
    const animationTrigger = useMemo(() => triggers["trigger1"], []);
    const hoverAffectedObjects = useMemo(() => ["LeftDoor","RightDoor", "MainBody"], []);
    const hoverLinkedObjects = useMemo(() => [["LeftDoor","RightDoor", "MainBody"], ["Monitor_1", "Monitor_2"]], []);

    const objectLinkPosition1 = useMemo(() => [48, 89, -49], []);
    const objectLinkScale = useMemo(() => [1, 1, 1], []);

    const stableOrbitingPointLightParticleEmitterAndPointLightAnimation = useMemo(() => [
        <ParticleEmitter key="particles" imageNames={["fire.png", "fire2.png"]} count={15} speed={10} initialSize={10}
            maxSizeOverLifespan={15} fadeInOut={true} faceCamera={false} faceCameraFrameCheck={80}
            faceCameraAxisLock={[1, 1, 1]} instanceMaxRandomDelay={10} lifespan={0.3}
            spread={3} position={[0, -1, 0]} rotation={[0, 1, 0]} direction={[0, 1, 0]} />,

        <PointLightAnimation key="pointlight" position={[0, 0, 0]} colors={[0x773502, 0xff8c00, 0xffd700]}
            colorFrameIntervals={[7, 5, 6]} randomIntensitiyMargin={[0.05, 0.1]}
            enableRandomColorFrameIntervals={true} />,
        <OrbitingPointLight key="OrbitingPointLight" lightColor = {0xb8774f} orbitDirection = {[0, 1, 0]} orbitSpeed = {0.007} orbitAxis = {"x"} 
            orbitDistance = {50} orbitCenterPosition = {[0,20,0]} lightIntensivity = {1} />
    ], []);

    const stableSimpleLoader = useMemo(() => {
                    if (!mainScene) return null;
                    return (
                        <SimpleLoader
                            scene={mainScene}
                            objectsRevealTriggers={objectsRevealTriggers}
                            animationToPlay={animationToPlay}
                            loopMode={"Loop"}
                            animationTrigger={animationTrigger}
                            animationTimesToTrigger={animationTimesToTrigger}
                            animationTriggerNames={animationTriggerNames}
                            hoverAffectedObjects={hoverAffectedObjects}
                            hoverLinkedObjects={hoverLinkedObjects}
                        />
                    );
    }, [
        mainScene,
        objectsRevealTriggers,
        animationToPlay,
        animationTrigger,
        animationTimesToTrigger,
        animationTriggerNames,
        hoverAffectedObjects,
        hoverLinkedObjects
    ]);

    const isOrbitingMenuVisible = useRef(false)

    useEffect(() => {
        if(transitionDestination === "Education" && transitionEnded){
            isOrbitingMenuVisible.current = true;
        }else{
            isOrbitingMenuVisible.current = false;
        }
    }, [transitionDestination, transitionEnded]);

    if (!mainScene) {
        return null;
    }

    return(
    <>
        <Camera position = {config.default_Camera_starting_position} ></Camera>
        <CircularScrollLoader />
        {(siteMode === "resume") && 
        <>
            {/* /////////////////////
                //System system_components//
                ///////////////////// */}

            <PreloadAssets delay={4000} texturesToLoad={texturesToLoad} scenesToLoad={scenesToLoad}></PreloadAssets>
            {/* <Raycaster enabled={raycasterEnabled} mouse={mouse} frameInterval={10} /> */}
            {(config.check_graphics)
            && 
            <GraphicalModeSetter enableGraphicalModeSwapping = {false} fpsToDecreaseGraphics = {55} />
            }

            {/* /////////////////////
                //Content system_components//
                ///////////////////// */}



            {/* <Environment files = {config.resource_path + "/textures/dikhololo_night_1k.hdr"} background /> */}
            {/* <Environment files = {config.resource_path + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} /> */}
            {(transitionDestination === "Education") 
            && (
            <OrbitingMenu transitionDestinationToRestrictKeyboardControl = {"Education"} visible={isOrbitingMenuVisible.current} orbitDistance={7.5} orbitCenterPosition={orbitCenterPosition} />
                        )}
            <FadingTitle initialPosition = {layout.fadingTitlePosition0} scale = {layout.fadingTitleScale0} 
                text = {TranslationTable[currentLanguage]["Fading_Title_1"]} textColor = {"#FFFFFF"} delay = {2000} transitionDuration = {1500} />
            <FadingTitle initialPosition = {layout.fadingTitlePosition1} scale = {layout.fadingTitleScale1} 
                text = {TranslationTable[currentLanguage]["Fading_Title_2"]} textColor = {"#FFFFFF"} delay = {2600} transitionDuration = {1500} />
            <>
                <FadingText textToFade = {TranslationTable0} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects0" lettersPerUnit = {5}  scale = {layout.fadingTextScale0} initialPosition = {layout.fadingTextPosition0} rotation = {2 * Math.PI}   textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable1} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects1"                       scale = {layout.fadingTextScale1} initialPosition = {layout.fadingTextPosition1} rotation = {Math.PI/2}     textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable2} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects2"                       scale = {layout.fadingTextScale2} initialPosition = {layout.fadingTextPosition2} rotation = {Math.PI}       textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable3} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects3" lettersPerUnit = {10} scale = {layout.fadingTextScale3} initialPosition = {layout.fadingTextPosition3} rotation = {3*(Math.PI/2)} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable4} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects4" lettersPerUnit = {9}  scale = {layout.fadingTextScale4} initialPosition = {layout.fadingTextPosition4} rotation = {2 * Math.PI}   textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable5} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects5" lettersPerUnit = {7}  scale = {layout.fadingTextScale5} initialPosition = {layout.fadingTextPosition5} rotation = {Math.PI/2}     textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                {/* <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
            </>
            
            {/* {(transitionDestination=="Skills" && transitionEnded) &&
            <FloatingTextSkills initialPosition = {[-9, 30, -15]} textPosition = {layout.FloatingTextSkillsPosition} /> 
            } */}

            {(currentGraphicalMode === "potato")
            && 
            <ambientLight intensity = {0.5}></ambientLight>
            }

            {(currentGraphicalMode !== "potato")
            && 
            <ambientLight intensity = {0.1}></ambientLight>
            }

            {/* <DynamicMaterialLoader lowResFile="low_512.glb" midResFile="high_4096_NOPBR.glb" highResFile="high_4096_PBR.glb"
            forceLowResTrigger={forceLowresMaterial} forceMidResTrigger={forceMidresMaterial} forceHighResTrigger={forceHighResMaterial}>
                {stableSimpleLoader}
            </DynamicMaterialLoader> */}
            {(currentGraphicalMode !== "potato")
            &&
            <>
                <ObjectLink position={objectLinkPosition1} scale={objectLinkScale} scene={mainScene} linkedObjectName = {"Lamp"} >
                    {/* <pointLight position={ [46, 83, -47]} color={0xb8774f}></pointLight> */}
 
                    {stableOrbitingPointLightParticleEmitterAndPointLightAnimation}

                </ObjectLink>
                
                <InstanceLoader instancedObject={"Book.glb"} initialPosition = {initialPosition} directionX = {0} directionY = {0} 
                    directionZ = {-1} customRotation = {customInstanceRotation} customColors = {customInstanceColor} NumberOfInstances={35} 
                    distanceBetweenInstances={3} />
            </>
            }
            {/* <VideoLoader triggerMode={true} triggerType = {"valueString"} trigger={currentSkillHovered} defaultVideo = {"Python"} rotation={[0, Math.PI/2, 0]} position={[-13.5, 46.2, -17.1]} planeDimensions={[31, 16.1]}></VideoLoader>
            <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI/2 + 0.5235, 0]} position={[-6.45, 46.5, 14.65]} planeDimensions={[31, 16.1]}></VideoLoader>
            <VideoLoader triggerMode={false} defaultVideo = {"JavaScript"} rotation={[0, Math.PI*2 + 1.048, 0]} position={[-6.4, 46.5, -48.9]} planeDimensions={[31, 16.1]}></VideoLoader> */}
            {/* <CurveInstanceAnimation curveNumber = {5} instanceInterval = {1000} tubeWireframe={false} instancedObject={"Plant.glb"} position={[0, 0, 0]} curve={new THREE.CatmullRomCurve3([new THREE.Vector3(-250, 40, 20), new THREE.Vector3(47, 20, -20), new THREE.Vector3(47, 40, -40)])} /> */}
            
            {(currentGraphicalMode === "high")
            &&
            <group>
                {/* <OrbitingPointLight orbitDirection = {[0, 1, 0]} orbitSpeed = {0.01} orbitAxis = {"x"} orbitDistance = {60} orbitCenterPosition = {[-40, 30, 0]} lightIntensivity = {1}></OrbitingPointLight> */}
                {/* <EffectComposer renderPriority = {1}>
                    <Bloom luminanceThreshold = {1} mipmapBlur />
                </EffectComposer> CAUSES ERROR WHY?*/}
            </group>}
        </>
        }

        {(siteMode === "store") && 
        <>
            <ambientLight intensity = {1}></ambientLight>
            {(explodingModelPath != "")
            &&
            <ExplodingModelLoader 
            modelName={
                // "Roomba.glb"
                explodingModelPath || "base_cube_DO_NOT_REMOVE.glb" 
            } 
            materialName={
                explodingMaterialPath || ""
            } 
            configFile={
                // "Roomba.json"
                explodingConfigFile || "base_cube_DO_NOT_REMOVE.json"
            } 
            animationIsPlaying={animationTriggerState}
            /*position={[175, 135, 50]}*/ 
            setCameraTargetTrigger={"trigger4"} 
            stopMainObjectRotationAnimation={trig} 
            mainObjectRotationAnimationIsPlayingTrigger={"trigger5"} />
            }
        </>
        }

{/* <TubeCurve
        curve={    new THREE.CatmullRomCurve3( [        
                new THREE.Vector3(188, 145, 58),
                new THREE.Vector3(12, 35, -73),
                new THREE.Vector3(13, 35, -15)])}
        tubularSegments={8}
        radius={0.2}
        radialSegments={8}
      /> */}
    </>
    );
});

SceneContainer.displayName = "SceneContainer";
