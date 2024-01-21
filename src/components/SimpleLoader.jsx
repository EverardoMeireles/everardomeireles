import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Suspense, useEffect } from "react";
import * as THREE from "three";
import React from "react";

export const SimpleLoader = React.memo((props) => {
    const {position = [0, 0, 0]} = props;
    const {sceneName = "threeJsScene.glb"} = props; // the model/scene's name
    const {animationToPlay = "idle"} = props; // the name of the animation to be played
    const {autoPlay = false} = props; // Automatically plays the animation when component loads
    const {animationTrigger = false} = props; // the trigger state to make the animation play
    const {useAo = true} = props; // use ambient occlusion if the loaded scene supports it
    const {ambientOcclusionIntensity = 1} = props; // intensity of the ambient occlusion(1 is more than enough)

    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + sceneName);

    // stops execution if the animation's name string is not inside an array
    if(!Array.isArray(animationToPlay)){
        throw new Error("the animation's name must be inside an array");
    }

    // initiate ambient occlusion if useAo is set to true
    if(useAo) {
        for( let node in gltf.nodes) {
            if('material' in gltf.nodes[node]) {
                gltf.nodes[node].material.aoMapIntensity = ambientOcclusionIntensity;
            }
        }
    }

    // useFrame(() => {
    //     console.log(animationTrigger)
    
    // });
    
    //DEBUG
    console.log(gltf)
    
    // initialize the animation mixer
    let mixer;
    mixer = new THREE.AnimationMixer(gltf.scene);

    // plays the animation automatically if autoPlay is set to true
    if (autoPlay && gltf.animations.length) {
        gltf.animations.forEach(clip => {
            if(animationToPlay.includes(clip.name)){
                const action = mixer.clipAction(clip);
                action.play();
            }
        });
    }

    // plays a specific animation if the trigger is set to true
    useEffect(() => {
        if(animationTrigger){
            gltf.animations.forEach(clip => {
                if(animationToPlay.includes(clip.name)){
                    const action = mixer.clipAction(clip);
                    action.play();
            }
            });
        }
    }, [animationTrigger, animationToPlay]);

    // updates deltas for animations
    useFrame((state, delta) => {
        mixer?.update(delta);
    })

    return (
    <Suspense fallback={null}>
        <primitive position={position} object={gltf.scene} />
    </Suspense>
    )
})