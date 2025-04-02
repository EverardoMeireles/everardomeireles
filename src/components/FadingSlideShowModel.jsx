import React, { Suspense, useCallback } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from "three";
import { useSpring, a } from '@react-spring/three';
import config from '../config';

export function FadingSlideShowModel(props) {
    const {textModelMenu = "MainMenu"} = props;
    const {transitionDuration = 1000} = props;
    const {initialPosition = [0,0,0]} = props;
    const {PlaneSize = [10, 10]} = props;
    const {imageTexture = 'placeHolderImage.png'} = props;

    const {transitionEnded, desired_path} = props.useStore();

    const springFade = useSpring({
        opacity: (transitionEnded && desired_path === textModelMenu) ? 1 : 0,
        config: {
            duration:transitionDuration
        }
    })

    const texture = useLoader(THREE.TextureLoader, config.resource_path +'/textures/'+imageTexture)
    const callbackRef = useCallback(
        ref => ref !== null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0) , (Math.PI/2))):console.log("skip render")
        )

    return (
    <Suspense>
        <mesh
            position = {initialPosition}
            ref={callbackRef}
            >
            <planeBufferGeometry attach="geometry" args={PlaneSize} />
            <a.meshBasicMaterial attach="material" transparent opacity={springFade.opacity} map={texture} side={THREE.DoubleSide} />
        </mesh>
    </Suspense>
    )
}