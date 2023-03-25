import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useCallback, Suspense } from "react";
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { BufferAttribute, Color } from "three";

export const SimpleLoader = React.memo((props) => {
    const {modelName = "threeJsScene.glb"} = props;

    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + modelName)

    let mixer
    if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach(clip => {
            const action = mixer.clipAction(clip)
            action.play();
        });
    }

    useFrame((state, delta) => {
        mixer?.update(delta)
    })

    return (
    <Suspense fallback={null}>
        <primitive object={gltf.scene} />
    </Suspense>
    )
})