import { Suspense, useCallback, useState, useRef } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { oneOrZero } from "../Helper";
import { useFrame } from "@react-three/fiber";

export function FadingTitle(props) {
    const {text = "Everardo Meireles"} = props;
    const {textColor = "#000000"} = props; 
    const {fadeDuration = 1000} = props;
    const {initialPosition = [0,0,0]} = props;
    const {rotation = Math.PI/3 + Math.PI/6} = props;
    const {scale = 10} = props;
    const {delay = 0} = props;
    const {font = process.env.PUBLIC_URL + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    const {transitionEnded, desired_path} = props.useStore();

    const [startFade, setStartFade] = useState(false);
    const [materialOpacity, setMaterialOpacity] = useState(0);

    const TextMaterialRef = useRef(); 
    const timerRef = useRef(null);

    // start
    if (delay !== 0) {
        timerRef.current = setTimeout(() => {
            setStartFade(true);
            clearTimeout(timerRef.current);
        }, delay);
    }

    // Fade in/out animation
    useFrame((state, delta)=> {
        if(startFade){
            if (materialOpacity <= 1) {
                setMaterialOpacity(TextMaterialRef.current.opacity + (delta / (fadeDuration / 1000)))
            }
            else{
                setStartFade(false)
            }
        }
    })

    // Rotate mesh
    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]); // eslint-disable-line react-hooks/exhaustive-deps

    return(
        <group
            position = {initialPosition}
            ref = {callbackRef}
        >
            <Text font={font} scale={scale} anchorX="left" position = {[-0.6, 0.2, 0]}>
                {text}
                <meshBasicMaterial ref = {TextMaterialRef} visible = {materialOpacity > 0 ? true : false} opacity = {materialOpacity} transparent color = {textColor}/>
            </Text>
        </group>
    );
}
