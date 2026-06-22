import React, { Suspense, useCallback } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from "three";
import { useSpring, a } from '@react-spring/three';
import config from '../config';
import SystemStore from "../SystemStore";

/**
 * Purpose: Shows a textured plane that fades in for a selected transition destination.
 * Relationships: Reads transitionDestination and camera movement state from SystemStore.
 * Example:
 * <FadingSlideShowModel textModelMenu="MainMenu" transitionDuration={1000} initialPosition={[0, 0, 0]} PlaneSize={[10, 10]} imageTexture="placeHolderImage.png" />
 * @param {string} [textModelMenu] - Mode value for text model menu.
 * @param {number} [transitionDuration] - Transition duration in milliseconds.
 * @param {Array<any>} [initialPosition] - Position value for initial position.
 * @param {Array<any>} [PlaneSize] - Plane size.
 * @param {string} [imageTexture] - Image texture.
 */
export function FadingSlideShowModel(props) {
    const {textModelMenu = "MainMenu"} = props;
    const {transitionDuration = 1000} = props;

    // Example: [0, 0, 0]
    const {initialPosition = [0,0,0]} = props;

    // Example: [10, 10]
    const {PlaneSize = [10, 10]} = props;

    // Example: "placeHolderImage.png"
    const {imageTexture = 'placeHolderImage.png'} = props;

    const {isCameraMoving, transitionDestination} = SystemStore();

    const springFade = useSpring({
        opacity: (!isCameraMoving && transitionDestination === textModelMenu) ? 1 : 0,
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
