import { Suspense, useCallback } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text3D } from "@react-three/drei";
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useState } from "react";

export function FadingTextModel(props) {
    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien in condimentum consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien.Integer facilisis semper libero, id aliquam justo suscipit Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien in condimentum consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien.Integer facilisis semper libero, id aliquam justo suscipit."} = props;
    const {textModelMenu = "MainMenu"} = props;
    const {textColor = "#000000"} = props;
    const {transitionDuration = 1000} = props;
    const {initialPosition = [0,0,0]} = props;
    const {PlaneSize = [7, 6.7]} = props;
    const {fontFileName = "/roboto.json"} = props; // put the json font file in the public folder
    const {lettersPerUnit = 8} = props; // how many letters should fit inside a spacial unit(a [1,1,1] cube)
    const {rotation = Math.PI/2} = props;
    const {visible = true} = props;

    const {transitionEnded, desired_path} = props.useStore();

    const springFade = useSpring({
        opacity: (transitionEnded && desired_path == textModelMenu) ? 1 : 0,
        config: {
            duration:transitionDuration
        }
    })

// useFrame(()=>console.log(springFadePanel.opacity.animation.values[0].lastPosition))

    const TextRows = (text) => {
        const textPositionOffset = [0,-0.5,0.2];
        const unitsPerRow = Math.floor(PlaneSize[1]); //number of spacial units (a [1,1,1] cube) that a fit with the z axis of the plane 
        const replace = '.{1,'+(Math.floor(lettersPerUnit) * unitsPerRow)+'}';
        const reg = (new RegExp(replace,"g"));
        const textChunksArray = text.match(reg);
        const rows = [];

        for (let i = 0; i < textChunksArray.length; i++) {
            rows.push(
                <Text3D
                    key = {i}
                    position = {[-(PlaneSize[1]/2) + textPositionOffset[2], (PlaneSize[0]/2) + textPositionOffset[1] - i,  0]}
                    font = {process.env.PUBLIC_URL + fontFileName}
                    size = {0.200}
                    height = {0.065}
                    curveSegments = {2}
                >
                    {textChunksArray[i]}
                    <a.meshBasicMaterial opacity = {springFade.opacity} transparent color={textColor}/>
                </Text3D>
                );
        }

        return {rows};
    }

    const text3DArray = TextRows(textToFade);
    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : console.log()
        )

    return(
        <mesh
            position = {initialPosition}
            ref = {callbackRef}
        >
            <planeGeometry args = {PlaneSize} />
            <a.meshBasicMaterial opacity = {springFade.opacity} transparent visible={visible}/>
            <Suspense fallback = {null}>
                {text3DArray.rows}
            </Suspense>
        </mesh>
    );
}
