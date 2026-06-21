import { Suspense, useCallback } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text3D } from "@react-three/drei";
import config from '../config';
import SystemStore from "../SystemStore";

/**
 * Purpose: Renders Text3D rows that fade with transition state.
 * Relationships: Older 3D text variant that reads SystemStore transition state.
 * Example:
 * <FadingText3D textToFade="Hello" textModelMenu="MainMenu" textColor="#000000" transitionDuration={1000} initialPosition={[0, 0, 0]} planeSize={[7, 6.7]} fontFileName="/roboto.json" lettersPerUnit={8} rotation={Math.PI / 2} visible={true} scale={1.5} textPositionOffset={[0, -0.5, 0.2]} />
 * @param {string} [textToFade] - Text to fade.
 * @param {string} [textModelMenu] - Mode value for text model menu.
 * @param {string} [textColor] - Color value for text color.
 * @param {number} [transitionDuration] - Transition duration in milliseconds.
 * @param {Array<any>} [initialPosition] - Position value for initial position.
 * @param {Array<any>} [planeSize] - Plane size.
 * @param {string} [fontFileName] - put the json font file in the public folder.
 * @param {number} [lettersPerUnit] - how many letters should fit inside a spacial unit(a [1,1,1] cube).
 * @param {number} [rotation] - Rotation in radians.
 * @param {boolean} [visible] - Whether this element is visible.
 * @param {number} [scale] - Scale value.
 * @param {Array<any>} [textPositionOffset] - Position value for text position offset.
 */
export function FadingText3D(props) {
    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget."} = props;

    // Example: "MainMenu"
    const {textModelMenu = "MainMenu"} = props;
    const {textColor = "#000000"} = props;
    const {transitionDuration = 1000} = props;

    // Example: [0, 0, 0]
    const {initialPosition = [0,0,0]} = props;

    // Example: [7, 6.7]
    const {planeSize = [7, 6.7]} = props;

    // Example: "/roboto.json"
    const {fontFileName = "/roboto.json"} = props;
    const {lettersPerUnit = 8} = props;
    // Example: Math.PI / 2
    const {rotation = Math.PI/2} = props;
    const {visible = true} = props;
    const {scale = 1.5} = props;
    // Example: [0, -0.5, 0.2]
    const {textPositionOffset = [0, -0.5, 0.2]} = props;

    const {transitionEnded, transitionDestination} = SystemStore();

    // Fade in and out animation
    const springFade = useSpring({
        opacity: (transitionEnded && transitionDestination === textModelMenu) ? 1 : 0,
        config: {
            duration:transitionDuration
        }
    })

    const TextRows = (text) => {
        const unitsPerRow = Math.floor(planeSize[1]); //number of spacial units (a [1,1,1] cube) that a fit with the z axis of the plane 
        const replace = '.{1,'+(Math.floor(lettersPerUnit) * unitsPerRow)+'}';
        const reg = (new RegExp(replace,"g"));
        const textChunksArray = text.match(reg);
        const rows = [];
        for (let i = 0; i < textChunksArray.length; i++) {
            rows.push(
                <Text3D
                    key = {i}
                    position = {[-(planeSize[1]/2) + textPositionOffset[2], (planeSize[0]/2) + textPositionOffset[1] - i,  0]}
                    font = {config.resource_path + fontFileName}
                    size = {0.200}
                    height = {0.065}
                    curveSegments = {2}
                >
                    {textChunksArray[i]}
                    <a.meshBasicMaterial opacity = {springFade.opacity} transparent color={textColor}/>
                </Text3D>
                );
        }
        rows.push(textToFade)
        return {rows};
    }

    const text3DArray = TextRows(textToFade);
    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]);

    return(
        <mesh
            position = {initialPosition}
            ref = {callbackRef}
            scale={scale}
        >
            <planeGeometry args = {planeSize} />
            <a.meshBasicMaterial opacity = {springFade.opacity} transparent visible={visible}/>
            <Suspense fallback = {null}>
                {text3DArray.rows}
            </Suspense>
        </mesh>
    );
}
