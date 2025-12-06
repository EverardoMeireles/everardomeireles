import { Environment } from "@react-three/drei";
import React, { Suspense, useState, useEffect, useRef, useMemo  } from "react";
import { Camera } from "./components/Camera.jsx";
import { SimpleLoader } from "./components/SimpleLoader.jsx";
import { OrbitingPointLight } from './components/OrbitingPointLights.jsx';
import { GraphicalModeSetter } from './components/GraphicalModeSetter.jsx';
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { OrbitingMenu } from "./components/OrbitingMenu.jsx";
import { FloatingTextSkills } from "./components/FloatingTextSkills.jsx";
import { FadingText } from "./components/FadingText.jsx";
import { useFrame, useThree, useLoader } from "@react-three/fiber"; // eslint-disable-line no-unused-vars
import { VideoLoader } from "./components/VideoLoader.jsx";
import { GraphicalModeSetter2 } from "./components/GraphicalModeSetter2.jsx";
import { FadingTitle } from "./components/FadingTitle.jsx";
import { Raycaster } from "./components/Raycaster.jsx";
import { CurveInstanceAnimation } from "./components/CurveInstanceAnimation.jsx";
import { InstanceLoader } from "./components/InstanceLoader.jsx";
import { PreloadAssets } from "./components/PreloadAssets.jsx";
import { ExplodingModelLoader } from "./components/ExplodingModelLoader.jsx";
import { CurveLightAnimation } from "./components/CurveLightAnimation.jsx";
import { PointLightAnimation } from "./components/PointLightAnimation.jsx";
import { ObjectLink } from "./components/ObjectLink.jsx";
import { ParticleEmitter } from "./components/ParticleEmitter.jsx";
import { DynamicMaterialLoader } from "./components/DynamicMaterialLoader.jsx";
import { AnimationMixer } from 'three';
import { customInstanceRotation, customInstanceColor } from "./PathPoints.jsx";
import { TranslationTable } from "./TranslationTable.jsx";
import { ResponsiveTable } from "./Styles.jsx";
import { pollForFilesInTHREECache, removeFileExtensionString, createTimer } from "./Helper.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HudMenu } from "./components/HudMenu.jsx";

import * as THREE from 'three';

import config from './config.js';
import useSystemStore from "./SystemStore.js";
import useUserStore from "./UserStore.js";

export const SceneHudMenu = ({ responsive }) => {
    const siteMode = useUserStore((state) => state.siteMode);
    if (siteMode !== "resume") return null;
    return <HudMenu responsive={responsive} />;
};

export const SceneContainer = React.memo((props) => {
    const transitionDestination = useSystemStore((state) => state.transitionDestination);
    const transitionEnded = useSystemStore((state) => state.transitionEnded);
    const currentLanguage = useSystemStore((state) => state.currentLanguage);
    const currentGraphicalMode = useSystemStore((state) => state.currentGraphicalMode);
    const triggers = useSystemStore((state) => state.triggers);
    const currentObjectClicked = useSystemStore((state) => state.currentObjectClicked);
    const mouseClicked = useSystemStore((state) => state.mouseClicked);
    const preloadDone = useSystemStore((state) => state.preloadDone);
    const raycasterEnabled = useSystemStore((state) => state.raycasterEnabled);
    const setForcedCameraTarget = useSystemStore((state) => state.setForcedCameraTarget);
    const setForcedCameraMovePathCurve = useSystemStore((state) => state.setForcedCameraMovePathCurve);
    const setTrigger = useSystemStore((state) => state.setTrigger);
    const setMainScene = useSystemStore((state) => state.setMainScene);
    const mainScene = useSystemStore((state) => state.mainScene);
    const productInformationFromMessage = useSystemStore((state) => state.productInformationFromMessage);

    const currentSkillHovered = useUserStore((state) => state.currentSkillHovered);
    const animationTriggerState = useUserStore((state) => state.animationTriggerState);
    const setAnimationTriggerState = useUserStore((state) => state.setAnimationTriggerState);
    const siteMode = useUserStore((state) => state.siteMode);

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

    ////////////////////////////////////////////////////
    ///////////////// Responsive values ////////////////
    ////////////////////////////////////////////////////

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

    const [modelsConfiguration, setModelsConfiguration] = useState({});
    const [modelRecords, setModelRecords] = useState({});

    // Store the contents of modelRecords.json in a state
    useEffect(() => {
      async function loadRecords() {
        try {
          // Load the modelRecords.json file
          const recordsResponse = await fetch(`${config.models_path}/modelRecords.json`);
          if (!recordsResponse.ok) {
            throw new Error("Failed to load modelRecords.json");
          }

          const records = await recordsResponse.json();
          // Convert array to object (keys as indices)
          const objectRecords = records.reduce((acc, record, index) => {
            acc[index] = record;
            return acc;
          }, {});
          
          setModelRecords(objectRecords);
        } catch (err) {
          console.error(err);
        }
      }
  
      loadRecords();
    }, []);
  
    // Fetch the appropriate configuration file
    useEffect(() => {
        async function loadSelectedModelConfig() {
            if (!productInformationFromMessage?.id || Object.keys(modelRecords).length === 0) return;

            // Find matching record in modelRecords
            const matchingRecord = Object.values(modelRecords).find(
            (record) => record.id === productInformationFromMessage.id
            );

            if (!matchingRecord) {
            console.warn('No matching record found');
            return;
            }

            const modelBaseName = matchingRecord.model.replace(".glb", "");
            const jsonFilename = `${modelBaseName}.json`;

            try {
                const modelResponse = await fetch(`${config.models_path}/${jsonFilename}`);
                if (!modelResponse.ok) throw new Error(`Failed to load ${jsonFilename}`);
                const modelJson = await modelResponse.json();

                // Save just this one configuration
                setModelsConfiguration({
                    [modelBaseName]: {
                    ...matchingRecord,
                    data: modelJson,
                    },
                });

            } catch (err) {
                console.error(err);
            }
        }

        loadSelectedModelConfig();
}, [productInformationFromMessage, modelRecords]);

    const [explodingMaterialPath, setExplodingMaterialPath] = useState("");
    const [explodingModelPath, setExplodingModelPath] = useState("base_cube_DO_NOT_REMOVE.glb"); ;
    const [explodingConfigFile, setExplodingConfigFile] = useState("base_cube_DO_NOT_REMOVE.json");;

    // Match the received id from the message to the configuration files(now all in the state ModelsConfiguration) to set product models and materials
    useEffect(() => {
        if (productInformationFromMessage && modelsConfiguration && modelRecords && productInformationFromMessage.id) {
            // Find the configuration entry in modelsConfiguration that matches productInformationFromMessage's id.
            const matchingModelConfiguration = Object.values(modelsConfiguration).find((record) => record.id === productInformationFromMessage.id);
            // Remove the "attributes_" prefix and only add the key if its value is not an empty string.
            if (matchingModelConfiguration) {
                // Set initial model and material
                setExplodingModelPath(matchingModelConfiguration.model);
                setExplodingConfigFile(removeFileExtensionString(matchingModelConfiguration.model) + ".json");
                if(config.materials_path + matchingModelConfiguration.default_material != ""){
                    setExplodingMaterialPath(matchingModelConfiguration.default_material);
                }

                const attrs = productInformationFromMessage.attributes;
                const normalized = {};
                for (const key in attrs) {
                    if (key.startsWith("attribute_")) {
                        if (attrs[key] !== "") {
                        normalized[key.slice("attribute_".length)] = attrs[key];
                        }
                    }
                }

                // Match attributes
                const productAttrs = normalized
                const variations = matchingModelConfiguration.data.ExternalProperties.variations;
                let matchedVariation = null;
                for (const variation of variations) {
                    let allMatch = true;
                    for (const key in variation.attributes) {
                        if (!(key in productAttrs) || variation.attributes[key] !== productAttrs[key]) {
                            allMatch = false;
                            break;
                        }
                    }

                    if (allMatch) {
                        matchedVariation = variation;
                        break;
                    }
                }
                
                if (matchedVariation) {
                    const type = matchedVariation.type.toLowerCase();
                    if (type === "model") {
                        setExplodingModelPath(matchedVariation.file);
                    } else if (type === "material") {
                        setExplodingMaterialPath(matchedVariation.file);
                    }
                }
            }
        }
    }, [modelRecords, modelsConfiguration, productInformationFromMessage]);

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
        {(siteMode === "resume") && 
        <>
            {/* /////////////////////
                //System components//
                ///////////////////// */}

            <PreloadAssets delay={4000} texturesToLoad={texturesToLoad} scenesToLoad={scenesToLoad}></PreloadAssets>
            {/* <Raycaster enabled={raycasterEnabled} mouse={mouse} frameInterval={10} /> */}
            {(config.check_graphics)
            && 
            <GraphicalModeSetter enableGraphicalModeSwapping = {false} fpsToDecreaseGraphics = {55} />
            }

            {/* /////////////////////
                //Content components//
                ///////////////////// */}



            {/* <Environment files = {config.resource_path + "/textures/dikhololo_night_1k.hdr"} background /> */}
            {/* <Environment files = {config.resource_path + "/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"} background={"only"} /> */}
            {(transitionDestination === "Education") 
            && (
            <OrbitingMenu transitionDestinationToRestrictKeyboardControl = {"Education"} visible={isOrbitingMenuVisible.current} orbitDistance={7.5} orbitCenterPosition={orbitCenterPosition} />
                        )}
            <FadingTitle initialPosition = {fadingTitlePosition0} scale = {fadingTitleScale0} 
                text = {TranslationTable[currentLanguage]["Fading_Title_1"]} textColor = {"#FFFFFF"} delay = {2000} transitionDuration = {1500} />
            <FadingTitle initialPosition = {fadingTitlePosition1} scale = {fadingTitleScale1} 
                text = {TranslationTable[currentLanguage]["Fading_Title_2"]} textColor = {"#FFFFFF"} delay = {2600} transitionDuration = {1500} />
            <>
                <FadingText textToFade = {TranslationTable0} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects0" lettersPerUnit = {5}  scale = {fadingTextScale0} initialPosition = {fadingTextPosition0} rotation = {2 * Math.PI}   textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable1} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects1"                       scale = {fadingTextScale1} initialPosition = {fadingTextPosition1} rotation = {Math.PI/2}     textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable2} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects2"                       scale = {fadingTextScale2} initialPosition = {fadingTextPosition2} rotation = {Math.PI}       textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable3} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects3" lettersPerUnit = {10} scale = {fadingTextScale3} initialPosition = {fadingTextPosition3} rotation = {3*(Math.PI/2)} textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable4} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects4" lettersPerUnit = {9}  scale = {fadingTextScale4} initialPosition = {fadingTextPosition4} rotation = {2 * Math.PI}   textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                <FadingText textToFade = {TranslationTable5} textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText = "ProfessionalExpProjects5" lettersPerUnit = {7}  scale = {fadingTextScale5} initialPosition = {fadingTextPosition5} rotation = {Math.PI/2}     textColor = {"#FFFFFF"} manualLineBreaks = {true} />
                {/* <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects6" initialPosition={[-4, 28, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects7" initialPosition={[-11, 28, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects8" initialPosition={[4, 49, -82.2]} rotation={2 * Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects9" initialPosition={[11, 49, -97]} rotation={Math.PI/2} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects10" initialPosition={[-4, 49, -105]} rotation={Math.PI} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} />
                <FadingText textIsVisibleByTransitionDestination = {true} textIsVisibleByTransitionDestinationWaitForTransitionEnd = {true} transitionDestinationToShowText="ProfessionalExpProjects11" initialPosition={[-11, 49, -90]} rotation={3*(Math.PI/2)} visible={false} textColor={"#FFFFFF"} manualLineBreaks={true} /> */}
            </>
            
            {/* {(transitionDestination=="Skills" && transitionEnded) &&
            <FloatingTextSkills initialPosition = {[-9, 30, -15]} textPosition = {FloatingTextSkillsPosition} /> 
            } */}

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
                "Roomba.glb"
                // explodingModelPath
            } 
            materialName={
                ""
                // explodingMaterialPath
            } 
            configFile={
                "Roomba.json"
                // explodingConfigFile
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
