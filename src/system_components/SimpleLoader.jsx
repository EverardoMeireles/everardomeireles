import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useState, useRef, forwardRef } from "react";
import * as THREE from "three";
import React from "react";
import SystemStore from "../SystemStore";
import { applyMaterialsToScene } from "../Helper.js";

/**
 * Purpose: Renders a loaded GLTF scene with animation, object scale, material, UV, and hide/reveal behavior.
 * Relationships: Used by SceneContainer, often wrapped by DynamicMaterialLoader, and writes animation triggers through SystemStore.
 * Example:
 * <SimpleLoader position={[0, 0, 0]} scene={scene} animationPlayTrigger={[{animation_name: "idleAnimation", loop_mode: "noLoop", play_direction: 1, autoplay: true, play_trigger: "trigger5"}]} objectScaleUpTriggers={[]} scaleAmount={1.3} animationTriggerTimes={{idleAnimation: {time: 0.5, trigger: "trigger2"}}} objectsHideRevealTriggers={{Cube0001: "trigger1"}} objectHideRevealScaleUpSpeed={0.05} useAo={true} ambientOcclusionIntensity={1} materialNames={{}} uvOffSet={[0, 0]} uvOffsetAmount={0.05} customObjectsUvs={{}} />
 * @param {Array<any>} [position] - Position of the model in the scene.
 * @param {*} [scene] - Loaded scene object used by this component.
 * @param {Array<any>} [animationPlayTrigger] - Animation play records.
 * @param {Array<any>} [objectScaleUpTriggers] - Object names currently scaling up.
 * @param {number} [scaleAmount] - Scale multiplier for triggered objects.
 * @param {Object} [animationTriggerTimes] - Trigger timing and name mapped by animation clip.
 * @param {*} [objectsHideRevealTriggers] - Trigger map for hide/reveal object behavior.
 * @param {number} [objectHideRevealScaleUpSpeed] - Speed used by the hide/reveal scale animation.
 * @param {boolean} [useAo] - Enables ambient occlusion intensity updates.
 * @param {number} [ambientOcclusionIntensity] - Ambient occlusion intensity applied to materials.
 * @param {Object} [materialNames] - Map of material slot names to material `.glb` filenames.
 * @param {Array<any>} [uvOffSet] - UV offset direction for mapped textures.
 * @param {number} [uvOffsetAmount] - UV offset multiplier.
 * @param {*} [customObjectsUvs] - Custom UV index map by object name.
 */
export const SimpleLoader = React.memo(forwardRef((props, ref) => {
    // Example: [0, 0, 0]
    const {position = [0, 0, 0]} = props;

    // Example: loaded GLTF returned by useLoader(GLTFLoader, modelPath)
    const {scene = undefined} = props;

    // Example: [{ animation_name: "idle", loop_mode: "Loop", play_direction: 1, autoplay: true, play_trigger: "trigger1" }]
    const {animationPlayTrigger = []} = props;

    // Example: ["LeftDoor", "RightDoor", "MainBody"]
    const {objectScaleUpTriggers = []} = props;
    const {scaleAmount = 1.3} = props;

    // Example: { CharacterAction: { time: 0.5, trigger: "trigger2" } }
    const {animationTriggerTimes = {}} = props;

    // Example: { Cube0001: "trigger1" }
    const {objectsHideRevealTriggers = {"Cube0001":"trigger1"}} = props;
    const {objectHideRevealScaleUpSpeed = 0.05} = props;

    const {useAo = true} = props;
    const {ambientOcclusionIntensity = 1} = props;

    // Example: { Wood: "oak_material.glb", Metal: "brushed_steel.glb" }
    const { materialNames = {} } = props;

    // Example: [1, 0]
    const {uvOffSet = [0, 0]} = props;
    const {uvOffsetAmount = 0.05} = props;

    // Example: { Cube0001: 1 }
    const { customObjectsUvs = {} } = props;

    //////////////////////////////////////////////////////////
    ///////////// Variables, states and refs /////////////////
    //////////////////////////////////////////////////////////

    // variables for the toggle trigger in the middle of animation feature( Useless??? )
    let fpsTriggerAnimationIsPlaying = false;
    let currentAnimationFrame = 0;

    // Variable hide or reveal mesh on trigger feature
    let objectHideRevealDirections = {}; // store the factor of the scale up or down effects, 1 or -1. EX:{"BookShelf" : -1, "Table" : 1}

    // Load Model
    const toggleTrigger = SystemStore((state) => state.toggleTrigger);
    const setTrigger = SystemStore((state) => state.setTrigger);
    const triggers = SystemStore((state) => state.triggers);

    // initialize the animation mixer
    const mixer = useRef(new THREE.AnimationMixer(scene.scene));

    // ref and state of the HideReveal feature
    const fadeInObjectsKeysRef = useRef([]);
    const [fade, setFadeIn] = useState(false);

    // Refs for the object scale-up feature.
    const scaledObjectsRef = useRef({});
    const animationTriggerValuesRef = useRef({});

    const materialSwapId = useRef(0);

    //////////////////////////////////////////////////////////
    /////// Feature : Set children object's custom UVs ///////
    //////////////////////////////////////////////////////////

    // Set a particular uv as the active one
    // Known issue: uv of index '0' doesn't cause a visual update
    useEffect(() => {
        if (Object.keys(customObjectsUvs).length !== 0) {
          scene.scene.traverse((child) => {
            if (child.isMesh && customObjectsUvs.hasOwnProperty(child.name)) {
              const uvIndex = customObjectsUvs[child.name];
              const uvAttributeName = uvIndex === 0 ? 'uv' : `uv${uvIndex}`; // Determine the correct UV attribute name
              console.log(uvAttributeName)

              if (child.geometry.attributes[uvAttributeName]) {
                child.geometry.attributes.uv.needsUpdate = true;
                console.log(child.geometry.attributes)
              } else {
                console.warn(`UV map ${uvAttributeName} not found on object ${child.name}`);
              }
            }
          });
        }
      }, [scene, customObjectsUvs]);


    //////////////////////////////////////////////////////////
    ///////////////// Feature : Offset UVs ///////////////////
    //////////////////////////////////////////////////////////

    // Offset the childs's uvs by a certain increment, useful for modifying appearance without swapping materials
    useEffect(() => {
        // check if both of the offset's values are not 0
        if(uvOffSet[0] + uvOffSet[1] != 0){
            // Traverse the entire scene to apply the UV updates
            scene.scene.traverse((child) => {
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => {
                    if (material.map) {
                        material.map.offset.x = uvOffsetAmount * uvOffSet[0];
                        material.map.offset.y = uvOffsetAmount * uvOffSet[1];
                        material.map.needsUpdate = true; // Ensure the change is applied
                    }
                    });
                }
            });
        }
      }, [scene, uvOffsetAmount, uvOffSet]);


    //////////////////////////////////////////////////////////
    //////// Feature : Manualy load materials ////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const hasMaterials =
            materialNames &&
            typeof materialNames === "object" &&
            Object.keys(materialNames).length > 0;
        if (!hasMaterials) return;

        let isActive = true;
        const swapId = ++materialSwapId.current;

        (async () => {
            await applyMaterialsToScene(scene, materialNames);
            if (!isActive || swapId !== materialSwapId.current) return;
        })();

        return () => {
            isActive = false;
        };
    }, [scene, materialNames]);

    
    //////////////////////////////////////////////////////////
    ////////// Feature : play animation(s) on trigger/////////
    //////////////////////////////////////////////////////////

    // Stops execution if animation play records are not inside an array.
    if(!Array.isArray(animationPlayTrigger)){
        throw new Error("animationPlayTrigger must be an array");
    }

    // Checks loop mode before the animation plays.
    function setupLoopMode(action, recordLoopMode){
        if(recordLoopMode == "Loop"){
            action.setLoop(THREE.LoopRepeat);
            action.clampWhenFinished = false;
            return;
        }

        action.setLoop(THREE.LoopOnce);
        if(recordLoopMode != "noLoopAndReset") action.clampWhenFinished = true;
    }

    // Checks play direction before the animation plays.
    function setupReverseMode(action, recordLoopMode, recordPlayDirection){
        action.timeScale = recordPlayDirection;
        if(recordLoopMode != "Loop" && recordPlayDirection == -1){
            action.time = action.getClip().duration;
        }
    }

    // Play one configured animation record.
    function playAnimation(animationPlayRecord){
        const animationName = animationPlayRecord?.animation_name;
        if (!animationName) return;

        const recordLoopMode = animationPlayRecord.loop_mode ?? "noLoop";
        const recordPlayDirection = animationPlayRecord.play_direction ?? 1;

        scene.animations.forEach(clip => {
            if(clip.name == animationName){
                const action = mixer.current.clipAction(clip);
                setupLoopMode(action, recordLoopMode)
                setupReverseMode(action, recordLoopMode, recordPlayDirection)
                action.play();
            }
        });
    }

    // Start configured autoplay animations when the scene loads.
    useEffect(() => {
        if (!scene.animations.length) return;

        animationPlayTrigger.forEach((animationPlayRecord) => {
            if (animationPlayRecord?.autoplay) {
                playAnimation(animationPlayRecord);
            }
        });
    }, [scene, animationPlayTrigger]);

    // Reset tracked trigger values when the scene changes.
    useEffect(() => {
        animationTriggerValuesRef.current = {};
    }, [scene]);

    // Play configured animations when their named trigger turns on.
    useEffect(() => {
        animationPlayTrigger.forEach((animationPlayRecord) => {
            const triggerName = animationPlayRecord?.play_trigger;
            if (!triggerName) return;

            const animationName = animationPlayRecord?.animation_name ?? "";
            const triggerKey = `${animationName}:${triggerName}`;
            const triggerValue = Boolean(triggers[triggerName]);
            const previousTriggerValue = animationTriggerValuesRef.current[triggerKey];

            if (triggerValue && !previousTriggerValue) {
                playAnimation(animationPlayRecord);
            }

            animationTriggerValuesRef.current[triggerKey] = triggerValue;
        });
    }, [scene, triggers, animationPlayTrigger]);

    // Forget removed animation trigger records.
    useEffect(() => {
        const activeTriggerKeys = animationPlayTrigger
            .filter((animationPlayRecord) => animationPlayRecord?.play_trigger)
            .map((animationPlayRecord) => {
                const animationName = animationPlayRecord?.animation_name ?? "";
                return `${animationName}:${animationPlayRecord.play_trigger}`;
            });

        Object.keys(animationTriggerValuesRef.current).forEach((triggerKey) => {
            if (!activeTriggerKeys.includes(triggerKey)) {
                delete animationTriggerValuesRef.current[triggerKey];
            }
        });
    }, [animationPlayTrigger]);

    //////////////////////////////////////////////////////////
    //////////// Feature : Object scale-up ///////////////////
    //////////////////////////////////////////////////////////

    // Move one scale axis toward its target.
    function moveScaleAxis(currentScale, targetScale) {
        const scaleStep = 0.1;
        const scaleDifference = targetScale - currentScale;

        if (Math.abs(scaleDifference) <= scaleStep) {
            return targetScale;
        }

        return currentScale + Math.sign(scaleDifference) * scaleStep;
    }

    // Track triggered objects and remember their original scales.
    useEffect(() => {
        if (!Array.isArray(objectScaleUpTriggers) || objectScaleUpTriggers.length === 0) return;

        scene.scene.traverse((child) => {
            if (!child?.scale || !objectScaleUpTriggers.includes(child.name)) return;

            if (!scaledObjectsRef.current[child.name]) {
                scaledObjectsRef.current[child.name] = {
                    object: child,
                    originalScale: child.scale.clone()
                };
            } else {
                scaledObjectsRef.current[child.name].object = child;
            }
        });
    }, [scene.scene, objectScaleUpTriggers]);

    // Animate triggered objects up and removed objects back down.
    useFrame(() => {
        const activeScaleTriggers = Array.isArray(objectScaleUpTriggers) ? objectScaleUpTriggers : [];
        const objectNames = Object.keys(scaledObjectsRef.current);
        if (objectNames.length === 0) return;

        objectNames.forEach((objectName) => {
            const scaleData = scaledObjectsRef.current[objectName];
            const object = scaleData.object;
            const originalScale = scaleData.originalScale;
            if (!object?.scale || !originalScale) {
                delete scaledObjectsRef.current[objectName];
                return;
            }

            const shouldScaleUp = activeScaleTriggers.includes(objectName);
            const targetScaleMultiplier = shouldScaleUp ? scaleAmount : 1;
            const targetScale = {
                x: originalScale.x * targetScaleMultiplier,
                y: originalScale.y * targetScaleMultiplier,
                z: originalScale.z * targetScaleMultiplier
            };

            object.scale.set(
                moveScaleAxis(object.scale.x, targetScale.x),
                moveScaleAxis(object.scale.y, targetScale.y),
                moveScaleAxis(object.scale.z, targetScale.z)
            );

            if (!shouldScaleUp && object.scale.equals(originalScale)) {
                delete scaledObjectsRef.current[objectName];
            }
        });
    });

    //////////////////////////////////////////////////////////
    // Feature: sets triggers during configured animation ranges
    //////////////////////////////////////////////////////////

    // Update animations and their timed triggers.
    useFrame((state, delta) => {
        if (!scene.animations.length) return;

        mixer.current?.update(delta);
        updateAnimationTimeTriggers();
    })

    // Set each trigger from its animation progress.
    function updateAnimationTimeTriggers(){
        Object.entries(animationTriggerTimes).forEach(([animationName, triggerSettings]) => {
            const clip = THREE.AnimationClip.findByName(scene.animations, animationName);
            const action = clip ? mixer.current.existingAction(clip) : null;
            const triggerName = triggerSettings?.trigger;
            const triggerTime = triggerSettings?.time;
            if (!action || !clip.duration || !triggerName || typeof triggerTime !== "number") return;

            const normalizedClipTime = THREE.MathUtils.clamp(action.time / clip.duration, 0, 1);
            const playsInReverse = action.getEffectiveTimeScale() < 0;
            const playbackProgress = playsInReverse ? 1 - normalizedClipTime : normalizedClipTime;
            const shouldTrigger = action.isRunning()
                && playbackProgress >= triggerTime
                && playbackProgress < 0.98;
            const currentTriggerValue = SystemStore.getState().triggers[triggerName];

            if (currentTriggerValue !== shouldTrigger) {
                setTrigger(triggerName, shouldTrigger);
            }
        });
    }
    
    //////////////////////////////////////////////////////////
    //////// Feature : hide or reveal mesh on trigger ////////
    //////////////////////////////////////////////////////////

    // Hide marked objects at the start
    useEffect(() => {
        Object.entries(objectsHideRevealTriggers).forEach(([key, value]) => {
            scene.scene.traverse((child) => {
                if (child.isMesh && child.name === key) {
                    // console.log(child.name)
                child.scale.set(0, 0, 0);
                }
            });
        });
    }, [scene]);

      // set scale factors of marked objects
    useEffect(() => {
        // console.log(scene)
        Object.entries(objectsHideRevealTriggers).forEach(([key, value]) => {
            scene.scene.traverse((child) => {
                if (child.isMesh && child.name === key) {
                    if(child.scale["x"] <= 0){
                        objectHideRevealDirections[key] = 1;
                    }
                    else{
                        objectHideRevealDirections[key] = -1;
                    }
                    
                }
            });
        });
    }, [scene, objectHideRevealDirections]);

    // trigger the fade in scale animation(trigger is set to true)
    useEffect(() => {
        fadeInObjectsKeysRef.current = Object.entries(objectsHideRevealTriggers)
        .filter(([key, value]) => triggers[value] === true)
        .map(([key]) => key);

        if(fadeInObjectsKeysRef.current.length > 0){
            setFadeIn(true);
        }

    }, [objectsHideRevealTriggers, fadeInObjectsKeysRef.current, fade, objectHideRevealDirections]);

    // Reveal and hide animation
    useFrame(() => {
        if (fade) {
            fadeInObjectsKeysRef.current.forEach((key)=>{
                scene.scene.traverse((child) => {
                    // Don't fade in or out if already done and not set to be reversible
                    if (child.isMesh && child.name === key) {
                        if((child.scale["x"] >= 1 && objectHideRevealDirections[key] == 1) || (child.scale["x"] <= 0 && objectHideRevealDirections[key] == -1)){
                            return
                        }
                        
                        child.scale.set(child.scale["x"] + objectHideRevealScaleUpSpeed * objectHideRevealDirections[key], child.scale["y"] + objectHideRevealScaleUpSpeed * objectHideRevealDirections[key], child.scale["z"] + objectHideRevealScaleUpSpeed * objectHideRevealDirections[key]);
                        if(child.scale["x"] >= 1 || child.scale["x"] <= 0){
                            toggleTrigger(objectsHideRevealTriggers[key])
                            fadeInObjectsKeysRef.current.splice(fadeInObjectsKeysRef.current.indexOf(key), 1);
                            objectsHideRevealTriggers[key] = false
                        }

                        if(fadeInObjectsKeysRef.current.length == 0){
                            setFadeIn(false);
                            return
                        }
                    }
                });
            })
        }
    });

    // Useless????
    useFrame(() => {
        if(fpsTriggerAnimationIsPlaying){
            currentAnimationFrame += 1;
        }
    });

    //////////////////////////////////////////////////////////
    ////////////// Feature : Ambient occlusion ///////////////
    //////////////////////////////////////////////////////////

    // initiate ambient occlusion if useAo is set to true
    if(useAo) {
        for( let node in scene.nodes) {
            if('material' in scene.nodes[node]) {
                scene.nodes[node].material.aoMapIntensity = ambientOcclusionIntensity;
            }
        }
    }

    return (
    <Suspense fallback={null}>
        <primitive ref={ref} position={position} object={scene.scene} />
    </Suspense>
    )
}));

SimpleLoader.displayName = "SimpleLoader";
