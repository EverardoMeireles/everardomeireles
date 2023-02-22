import { Suspense, useCallback } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text } from "@react-three/drei";

export function FadingText(props) {
    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget."} = props;
    const {textModelMenu = "MainMenu"} = props;
    const {textColor = "#000000"} = props;
    const {transitionDuration = 1000} = props;
    const {initialPosition = [0,0,0]} = props;
    const {PlaneSize = [7, 6.7]} = props;
    const {rotation = Math.PI/2} = props;
    const {visible = true} = props;
    const {scale = 1.5} = props;
    const {textPositionOffset = [0, -0.5, 0.2]} = props;

    const {transitionEnded, desired_path} = props.useStore();
    
    // Fade in and out animation
    const springFade = useSpring({
        opacity: (transitionEnded && desired_path == textModelMenu) ? 1 : 0,
        config: {
            duration:transitionDuration
        }
    })

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : console.log()
        )

    return(
        <mesh
            position = {initialPosition}
            ref = {callbackRef}
            scale={scale}
        >
            <planeGeometry args = {PlaneSize} />
            <a.meshBasicMaterial opacity = {springFade.opacity} transparent visible={visible}/>
            <Suspense fallback = {null}>
                <Text
                    scale={[3, 3, 3]}
                    anchorX="left"
                    position = {[-(PlaneSize[1]/2) + textPositionOffset[2], (PlaneSize[0]/2) + textPositionOffset[1],  0]}
                >
                {textToFade}
                <a.meshBasicMaterial opacity = {springFade.opacity} transparent color={textColor}/>
                </Text>
            </Suspense>
        </mesh>
    );
}
