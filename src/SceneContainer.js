import React, { Suspense, useState, useEffect, useRef, useMemo  } from "react";
import { SimpleLoader } from "./system_components/SimpleLoader.jsx";
import { OrbitingPointLight } from './system_components/OrbitingPointLights.jsx';
import { OrbitingMenu } from "./system_components/OrbitingMenu.jsx";
import { FadingText } from "./system_components/FadingText.jsx";
import { useLoader, useFrame } from "@react-three/fiber";
import { FadingTitle } from "./system_components/FadingTitle.jsx";
import { InstanceLoader } from "./system_components/InstanceLoader.jsx";
import { PreloadAssets } from "./system_components/PreloadAssets.jsx";
import { ExplodingModelLoader } from "./system_components/ExplodingModelLoader.jsx";
import { PointLightAnimation } from "./system_components/PointLightAnimation.jsx";
import { ObjectLink } from "./system_components/ObjectLink.jsx";
import { ParticleEmitter } from "./system_components/ParticleEmitter.jsx";
import { DynamicMaterialLoader } from "./system_components/DynamicMaterialLoader.jsx";
import { CurveScrollNavigationCamera } from "./system_components/CurveScrollNavigationCamera.jsx";
import { AnimationMixer } from 'three';
import { customInstanceRotation, customInstanceColor } from "./PathPoints.jsx";
import { TranslationTable } from "./TranslationTable.jsx";
import { useResponsive } from "./Styles.jsx";
import { FpsBenchmarkProbe } from "./system_components/FpsBenchmarkProbe.jsx";
import { pollForFilesInTHREECache } from "./Helper.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Camera } from "./system_components/Camera.jsx";
import { Raycaster } from "./system_components/Raycaster.jsx";

import * as THREE from 'three';

import config from './config.js';
import SystemStore from "./SystemStore.js";
import UserStore from "./UserStore.js";

/**
 * Purpose: Builds the active React Three Fiber scene for resume and store modes.
 * Relationships: Mounted by SceneViewer; orchestrates CurveScrollNavigationCamera, loaders, lights, HUD-driven transitions, and SystemStore/UserStore state.
 * Example:
 * <SceneContainer />
 */
export const SceneContainer = React.memo((props) => {
    const transitionDestination = SystemStore((state) => state.transitionDestination);
    const isCameraMoving = SystemStore((state) => state.isCameraMoving);
    const currentLanguage = SystemStore((state) => state.currentLanguage);
    const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
    const currentObjectClicked = SystemStore((state) => state.currentObjectClicked);
    const mouseClicked = SystemStore((state) => state.mouseClicked);
    const setForcedCameraTarget = SystemStore((state) => state.setForcedCameraTarget);
    const setForcedCameraMovePathCurve = SystemStore((state) => state.setForcedCameraMovePathCurve);
    const setMainScene = SystemStore((state) => state.setMainScene);
    const mainScene = SystemStore((state) => state.mainScene);
    const currentObjectHovered = SystemStore((state) => state.currentObjectHovered);
    const viewerModelName = SystemStore((state) => state.viewerModelName);
    const viewerConfigFile = SystemStore((state) => state.viewerConfigFile);
    const viewerMaterialName = SystemStore((state) => state.viewerMaterialName);

    const animationTriggerState = UserStore((state) => state.animationTriggerState);
    const siteMode = UserStore((state) => state.siteMode);

    const sceneName = useMemo(
        () => siteMode === "resume" ? "planet.glb" : "base_cube_DO_NOT_REMOVE.glb",
        [siteMode]
    );
    const scene = useLoader(GLTFLoader, `${config.resource_path}/models/${sceneName}`);

    useEffect(() => {
        setMainScene(scene);
    }, [scene, setMainScene]);

    let mixer;

    const animTimeRef = useRef(0);

    const [forceLowresMaterial, setForceLowresMaterial] = useState(false);
    const [forceMidresMaterial, setForceMidresMaterial] = useState(false);
    const [forceHighResMaterial, setForceHighResMaterial] = useState(false);

    const [enableMaterialSwap, setEnableMaterialSwap] = useState(false);

    const filesToLoadBeforeEnablingMaterialSwap = ["/materials/low_512.glb", "/materials/high_4096_NOPBR.glb", "/materials/high_4096_PBR.glb"]; 

    const { layout, key: sceneLayoutKey } = useResponsive("scene");
    const initialCameraPosition = {
        Mobile: [0, 10, 0],
        Tablet: [0, 100, 0],
        Widescreen: [0, 500, 0],
    }[sceneLayoutKey] ?? [0, 0, 0];

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

    ///////////////////////////
    // E-comerce integration //
    ///////////////////////////

    const explodingModelPath = viewerModelName || "base_cube_DO_NOT_REMOVE.glb";
    const explodingConfigFile = viewerConfigFile || "base_cube_DO_NOT_REMOVE.json";
    const explodingMaterialPath = viewerMaterialName || "";

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

    // Configure trigger ranges within animation playback.
    const animationTriggerTimes = useMemo(() => ({
        "CharacterAction": {
            time: 0.50,
            trigger: "trigger2"
        }
    }), []);

    // Configure model animations and their play triggers.
    const animationPlayTrigger = useMemo(() => [
        {
            animation_name: "LampAction.001",
            loop_mode: "Loop",
            play_direction: 1,
            autoplay: true,
            play_trigger: "trigger1"
        },
        {
            animation_name: "RopeAction",
            loop_mode: "Loop",
            play_direction: 1,
            autoplay: true,
            play_trigger: "trigger1"
        },
        {
            animation_name: "CharacterAction",
            loop_mode: "noLoop",
            play_direction: 1,
            autoplay: true
        }
    ], []);

    // Objects that scale as one group.
    const objectScaleUpGroup = useMemo(() => ["LeftDoor","RightDoor", "MainBody"], []);

    // Trigger scaling for the selected group.
    const objectScaleUpTriggers = useMemo(() => {
        if (objectScaleUpGroup.includes(currentObjectHovered)) {
            return objectScaleUpGroup;
        }

        return [];
    }, [currentObjectHovered, objectScaleUpGroup]);

    const objectLinkPosition1 = useMemo(() => [48, 89, -49], []);
    const objectLinkScale = useMemo(() => [1, 1, 1], []);

    // Match the loaded scene position.
    const curveScrollNavigationCenter = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    // Define circular scroll camera path.
    const curveScrollNavigationCurve = useMemo(() => {
        const radius = 90;
        const cameraHeight = 35;
        const pointCount = 16;
        const curvePoints = [];

        for (let index = 0; index < pointCount; index += 1) {
            const angle = (index / pointCount) * Math.PI * 2;
            curvePoints.push(new THREE.Vector3(
                curveScrollNavigationCenter.x + Math.cos(angle) * radius,
                curveScrollNavigationCenter.y + cameraHeight,
                curveScrollNavigationCenter.z + Math.sin(angle) * radius
            ));
        }

        return new THREE.CatmullRomCurve3(curvePoints, true);
    }, [curveScrollNavigationCenter]);

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
                position={[0, 0, 0]}
                scene={mainScene}
                objectsRevealTriggers={objectsRevealTriggers}
                animationPlayTrigger={animationPlayTrigger}
                animationTriggerTimes={animationTriggerTimes}
                objectScaleUpTriggers={objectScaleUpTriggers}
                scaleAmount={1.3}
            />
        );
    }, [
        mainScene,
        objectsRevealTriggers,
        animationPlayTrigger,
        animationTriggerTimes,
        objectScaleUpTriggers
    ]);

    const isOrbitingMenuVisible = useRef(false)

    useEffect(() => {
        if(transitionDestination === "Education" && !isCameraMoving){
            isOrbitingMenuVisible.current = true;
        }else{
            isOrbitingMenuVisible.current = false;
        }
    }, [transitionDestination, isCameraMoving]);

    if (!mainScene) {
        return null;
    }

    return(
    <>
        {(siteMode === "resume") && 
        <>
            <CurveScrollNavigationCamera
                curve={curveScrollNavigationCurve}
                initialPositionPoint={0}
                navigationCurveIncrement={0.0004}
                loop={true}
                triggerOutProgress="curveScrollNavigationProgress"
                cameraLookatPoint={[0, 0, 0]}
                cameraFocusSpeed={0.5}
                idleCameraAnimationEnable={true}
                idleCameraAnimationDelay={3000}
                idleCameraAnimationSphericalAreaDiameter={8}
                idleCameraAnimationSpeed={0.04}
            // cameraFocusDestination={[0,0,0]}
            />
            <Raycaster frameInterval={1} />
            {/* /////////////////////
                //System system_components//
                ///////////////////// */}

            <PreloadAssets delay={4000} texturesToLoad={texturesToLoad} scenesToLoad={scenesToLoad}></PreloadAssets>
            <FpsBenchmarkProbe benchmarkScene={"benchmark_scene.glb"}></FpsBenchmarkProbe>

            {/* /////////////////////
                //Content system_components//
                ///////////////////// */}
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
            </>

            {(currentGraphicalMode === "potato")
            && 
            <ambientLight intensity = {0.5}></ambientLight>
            }

            {(currentGraphicalMode !== "potato")
            && 
            <ambientLight intensity = {0.1}></ambientLight>
            }

            <DynamicMaterialLoader lowResFile="low_512.glb" midResFile="high_4096_NOPBR.glb" highResFile="high_4096_PBR.glb"
            forceLowResTrigger={forceLowresMaterial} forceMidResTrigger={forceMidresMaterial} forceHighResTrigger={forceHighResMaterial}>
                {stableSimpleLoader}
            </DynamicMaterialLoader>
            {(currentGraphicalMode !== "potato")
            &&
            <>
                <ObjectLink position={objectLinkPosition1} scale={objectLinkScale} scene={mainScene} linkedObjectName = {"Lamp"} >
                    {stableOrbitingPointLightParticleEmitterAndPointLightAnimation}
                </ObjectLink>
                
                <InstanceLoader instancedObject={"Book.glb"} initialPosition = {initialPosition} directionX = {0} directionY = {0} 
                    directionZ = {-1} customRotation = {customInstanceRotation} customColors = {customInstanceColor} NumberOfInstances={35} 
                    distanceBetweenInstances={3} />
            </>
            }
        </>
        }

        {(siteMode === "store") && 
        <>
            <Camera idleCameraAnimationDelay={3000}
                idleCameraAnimationSphericalAreaDiameter={8}
                idleCameraAnimationSpeed={0.04} idleCameraAnimationEnable={true} transitionSpeed={0.5} cameraTarget={[13, 26, -21]} cameraMovePathCurve={undefined}  triggerOutCameraTransitionStarted="cameraStarted" triggerOutCameraTransitionEnded="cameraEnded" />
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
            returnCameraPosition={initialCameraPosition}
            setCameraTargetTrigger={"trigger4"} 
            stopMainObjectRotationAnimation={false}
            mainObjectRotationAnimationIsPlayingTrigger={"trigger5"} />
            }
        </>
        }
    </>
    );
});

SceneContainer.displayName = "SceneContainer";
