import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Suspense } from "react";
import * as THREE from "three";
import React from "react";

export const SimpleLoader = React.memo((props) => {
    const {modelName = "threeJsScene.glb"} = props;
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

    let mixer
    if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.play();
        });
    }

    // updates deltas for animations
    useFrame((state, delta) => {
        mixer?.update(delta);
    })

    return (
    <Suspense fallback={null}>
        <primitive object={gltf.scene} />
    </Suspense>
    )
})