import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Suspense, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import React from "react";
import { TextureLoader } from 'three';

export const SimpleLoader = React.memo((props) => {
    const useStore = props.useStore;
    const {position = [0, 0, 0]} = props;
    const {sceneName = "threeJsScene.glb"} = props; // the model/scene's name
    
    // feature: play animation(s) on trigger
    const {animationToPlay = "idle"} = props; // the name of the animation to be played
    const {loopMode = "noLoop"} = props; // Looping mode: "Loop", "noLoop" and "noLoopAndReset(return to first frame when animation finished, doesn't work with playDirection = -1)"
    const {playDirection = 1} = props; // 1 for normal playback, -1 to play the animation backwards
    const {autoPlay = true} = props; // Automatically plays the animation when component loads
    const {animationTrigger = false} = props; // the trigger state to make the animation play
    
    // feature : hover
    const {hover = true} = props; // wether the scene or objects within the scene should be highlighted on mouse hover
    const {hoverAffectedObjects = []} = props; // Objects that are affected by the hover effect and the color that they will "glow"
    const {hoverLinkedObjects = [[]]} = props; // Objects that are affected by the hover effect and the color that they will "glow"
    const {hoveredObject = undefined} = props; // prop passed by the raycaster, its value its the current hovered object
    
    // Feature : toggles trigger in the middle of animation
    const {animationTimesToTrigger = {}} = props; // Times where the triggers are set to activate, to be used with animationTriggerNames. EX:{"CharacterAction": 0.50}
    const {animationTriggerNames = {}} = props; // Triggers to be activated by the times, to be used with animationTimesToTrigger. EX:{"CharacterAction": "trigger1"}
    
    // Feature : hide or reveal mesh on trigger(Assumes scale transform has been applied)
    const {objectsHideRevealTriggers = {"Cube0001":"trigger1"}} = props; // Triggers to reveal hidden objects. Ex: {"Wardrobe001":"trigger3"}
    const {objectHideRevealScaleUpSpeed = 0.05} = props; // speed of the scale transition animation

    // feature : Ambient occlusion
    const {useAo = true} = props; // use ambient occlusion if the loaded scene supports it
    const {ambientOcclusionIntensity = 1} = props; // intensity of the ambient occlusion



    //////////////////////////////////////////////////////////
    ///////////// Variables, states and refs /////////////////
    //////////////////////////////////////////////////////////

    // variables for the animation trigger feature
    let normalizedClipTime; 
    let animationCurrentTime;
    let animationDuration;

    // variables for the toggle trigger in the middle of animation feature( Useless??? )
    let fpsTriggerAnimationIsPlaying = false;
    let currentAnimationFrame = 0;

    // Variable hide or reveal mesh on trigger feature
    let objectHideRevealDirections = {}; // store the factor of the scale up or down effects, 1 or -1. EX:{"BookShelf" : -1, "Table" : 1}

    // Load Model
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + sceneName);

    const toggleTrigger = useStore((state) => state.toggleTrigger);
    const triggers = useStore((state) => state.triggers);

    const setInitialSceneLoaded = useStore((state) => state.setInitialSceneLoaded);

    // initialize the animation mixer
    const mixer = useRef(new THREE.AnimationMixer(gltf.scene));

    // ref and state of the HideReveal feature
    const fadeInObjectsKeysRef = useRef([]);
    const [fade, setFadeIn] = useState(false);

    // states for the hover feature
    const [triggerScaleAnimation, setTriggerScaleAnimation] = useState(false);
    const [animationFadeOut, setAnimationFadeOut] = useState(false);

    const [childObject, setChildObject] = useState(false);
    const [currentLinkedObjects, setCurrentLinkedObjects] = useState([]);


    
    //////////////////////////////////////////////////////////
    // Feature : play animation(s) on trigger
    //////////////////////////////////////////////////////////

    // stops execution if the animation's name string is not inside an array
    if(!Array.isArray(animationToPlay)){
        throw new Error("the animation's name must be inside an array");
    }

    // Checks loopMode before the animation plays
    function setupLoopMode(action){
        if(loopMode != "Loop"){
            action.setLoop(THREE.LoopOnce);
            if(loopMode != "noLoopAndReset") action.clampWhenFinished = true;
        }
    }

    // Checks play direction before the animation plays
    function setupReverseMode(action){
        action.timeScale = playDirection;
        if(loopMode != "Loop" && playDirection == -1){
            action.time = action.getClip().duration;
        }
    }

    // start to play the animation when scene loads if the prop autoPlay is true
    useEffect(() => {
        if (autoPlay && gltf.animations.length) {
            playAnimation();
        }
    }, [autoPlay]);

    // trigger the animation(trigger is set to true)
    useEffect(() => {
        if(animationTrigger){
            playAnimation()
        }
    }, [animationTrigger, animationToPlay]);

    // plays the animation
    function playAnimation(){
        gltf.animations.forEach(clip => {
            if(animationToPlay.includes(clip.name)){
                const action = mixer.current.clipAction(clip);
                setupLoopMode(action)
                setupReverseMode(action)
                action.play();
            }
        });
    }

    //////////////////////////////////////////////////////////
    // Feature : Hover
    //////////////////////////////////////////////////////////

    // Modify this to only reset appropriate objects???
    // Resets the scale of all objects back to 0
    function resetObjectsScale(){
        gltf.scene.traverse((child) => {
                child.scale.x = 1
                child.scale.y = 1
                child.scale.z = 1
        })
    }

    function getLinkedObjects(object){
        var returnedObjects = [];

        hoverLinkedObjects.forEach(function(objectGroupNames) {
            if(objectGroupNames.includes(object.name)){
                gltf.scene.traverse((child) => {
                    if(objectGroupNames.includes(child.name)){
                        returnedObjects.push(child)
                    }
                })
            }
            });

            // simplify this?
            if(returnedObjects.length > 1){
                return returnedObjects
            }else{
                return [object]
            }
    }

    // trigger the scale animation based on hover state(assumes that base object scales are [x:1, y:1, z:1])
    useEffect(() => {
        if(hover && hoveredObject != undefined && hoverAffectedObjects.includes(hoveredObject) ){
            gltf.scene.traverse((child) => {
                if(child.name == hoveredObject){
                    resetObjectsScale();
                    setCurrentLinkedObjects(getLinkedObjects(child))
                    setChildObject(child);
                    setTriggerScaleAnimation(true)
                    return;
                }
            })
        }else{
            setAnimationFadeOut(true)
            setTriggerScaleAnimation(false);
        }
    }, [gltf.scene, hoveredObject]);

    // Animation where the object scales up and down
    useFrame(() => {
        if (triggerScaleAnimation) {
            if(childObject != undefined && childObject.scale != undefined && childObject.scale.x < 1.3 && childObject.scale.y < 1.3 && childObject.scale.z < 1.3){
                currentLinkedObjects.forEach((object)=>{
                    object.scale.x += 0.1
                    object.scale.y += 0.1
                    object.scale.z += 0.1
                })
            }
        }else{
            if(animationFadeOut){
                if(childObject != undefined && childObject.scale != undefined && childObject.scale.x > 1 && childObject.scale.y > 1 && childObject.scale.z > 1){
                    currentLinkedObjects.forEach((object)=>{
                        object.scale.x -= 0.1
                        object.scale.y -= 0.1
                        object.scale.z -= 0.1
                    })
                }
                else{
                    setAnimationFadeOut(false)
                }
            }
        }
    });

    //////////////////////////////////////////////////////////
    // Feature : toggles trigger in the middle of animation
    //////////////////////////////////////////////////////////

    // updates deltas for animations
    useFrame((state, delta) => {
        mixer.current?.update(delta);
        AnimationTimeTriggerCheck(mixer);
    })

    // Checks whether to toggle trigger on a set
    function AnimationTimeTriggerCheck(mixer){
        if(Object.keys(animationTriggerNames).length != 0){
            mixer.current._actions.forEach(action => {
                if(Object.keys(animationTriggerNames).includes(action._clip.name)){
                    animationCurrentTime = action.time;
                    animationDuration = action._clip.duration;
                    normalizedClipTime = (animationCurrentTime) / (animationDuration);
                    if(normalizedClipTime >= 0.98){
                        toggleTrigger(animationTriggerNames[action._clip.name])
                    }
                    
                    if(normalizedClipTime >= animationTimesToTrigger[action._clip.name] && !triggers[animationTriggerNames[action._clip.name]]){
                        toggleTrigger(animationTriggerNames[action._clip.name])
                    }
                }
            });
        }
    }
    
    //////////////////////////////////////////////////////////
    // Feature : hide or reveal mesh on trigger
    //////////////////////////////////////////////////////////

    // Hide marked objects at the start
    useEffect(() => {
        // console.log(gltf)
        Object.entries(objectsHideRevealTriggers).forEach(([key, value]) => {
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.name === key) {
                    // console.log(child.name)
                child.scale.set(0, 0, 0);
                }
            });
        });
    }, [gltf]);

      // set scale factors of marked objects
    useEffect(() => {
        // console.log(gltf)
        Object.entries(objectsHideRevealTriggers).forEach(([key, value]) => {
            gltf.scene.traverse((child) => {
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
    }, [gltf, objectHideRevealDirections]);

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
                gltf.scene.traverse((child) => {
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
    // Feature : Ambient occlusion
    //////////////////////////////////////////////////////////

    // initiate ambient occlusion if useAo is set to true
    if(useAo) {
        for( let node in gltf.nodes) {
            if('material' in gltf.nodes[node]) {
                gltf.nodes[node].material.aoMapIntensity = ambientOcclusionIntensity;
            }
        }
    }

    useEffect(() => {
        // console.log("set initial scene loaded")
        setInitialSceneLoaded(true);
    }, [gltf, setInitialSceneLoaded]);

    return (
    <Suspense fallback={null}>
        <primitive position={position} object={gltf.scene} />
    </Suspense>
    )
})