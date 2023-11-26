import { Suspense, useCallback, useState } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { oneOrZero } from "../Helper";

export function FadingTitle(props) {
    const {text = "Everardo Meireles"} = props;
    const {textModelMenu = "MainMenu"} = props; // This is the name of the path that will trigger the animation
    const {textColor = "#000000"} = props; 
    const {transitionDuration = 1000} = props;
    const {initialPosition = [0,0,0]} = props;
    const {rotation = Math.PI/3 + Math.PI/6} = props;
    const {visible = true} = props;
    const {scale = 10} = props;
    const {delay = 0} = props;
    const {font = process.env.PUBLIC_URL + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    const {transitionEnded, desired_path} = props.useStore();

    const [startFade, setStartFade] = useState(false);
//ds
    if(delay !== 0){
        setTimeout(() => {
            setStartFade(true);
        }, delay);
    }

    // If visible = true, then the text will fade out, otherwise it will fade in
    const springFade = useSpring({
        opacity: (transitionEnded && desired_path === textModelMenu && delay === 0) || startFade ? oneOrZero[Number(visible)] : oneOrZero[Number(!visible)],
        config: {
            duration:transitionDuration,
        }
    })

    // Rotate mesh
    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]); // eslint-disable-line react-hooks/exhaustive-deps

    return(
        <mesh
            position = {initialPosition}
            ref = {callbackRef}
        >
            <a.meshBasicMaterial opacity = {springFade.opacity} transparent visible={visible}/>
            <Suspense fallback = {null}>
                <Text font={font} scale={scale} anchorX="left" position = {[-0.6, 0.2, 0]}>
                    {text}
                    <a.meshBasicMaterial opacity = {springFade.opacity} transparent color={textColor}/>
                </Text>
            </Suspense>
        </mesh>
    );
}
