import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Suspense, useEffect } from "react";
import * as THREE from "three";
import React from "react";

export const SimpleLoader = React.memo((props) => {
    const {modelName = "threeJsScene.glb"} = props;
    const {autoPlay = false} = props;
    const {position = [0, 0, 0]} = props;
    const {animationTrigger = false} = props;
    const {triggeredAnimation = "idle"} = props;
    const {useAo = true} = props;
    const {ambientOcclusionIntensivity = 1} = props;

    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + modelName);
    
    if(useAo) {
        for( let node in gltf.nodes) {
            if('material' in gltf.nodes[node]) {
                gltf.nodes[node].material.aoMapIntensity = ambientOcclusionIntensivity;
            }
        }
    }

    let mixer;
    mixer = new THREE.AnimationMixer(gltf.scene);

    const animations =  [];
    gltf.animations.forEach(clip => {
        animations.push(clip)
    });

    if (autoPlay && gltf.animations.length) {
        gltf.animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.play();
        });
    }

    // plays a specific animation if the trigger is set to true
    useEffect(() => {
        if(animationTrigger){
            gltf.animations.forEach(clip => {
                if(clip.name == triggeredAnimation){
                    const action = mixer.clipAction(clip);
                    action.play();
            }
            });
        }
      }, [animationTrigger]);

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