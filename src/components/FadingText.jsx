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
    // true if your input text already contains line breaks('\n')
    const {manualLineBreaks = false} = props;
    // if manualLineBreaks is false, how many characters before a line break on the previous word, default is the length of the plane times the normal length of a roboto font character
    const {maxCharsBeforeLineBreak = PlaneSize[0] * 7} = props;
    const {font = process.env.PUBLIC_URL + "Roboto-Regular.ttf"} = props;

    const {transitionEnded, desired_path} = props.useStore();
    
    // automatically insert line breaks in the text 
    function injectLineBreaks(string){
        let arr = [...string];
        let accuIndex = 0
        let oneSign = 1
        let i = 0
        console.log("");
        while( i < arr.length){
            if(accuIndex == maxCharsBeforeLineBreak){
                oneSign = -1
            }

            if(oneSign > 0){
                accuIndex += 1
            }else{
                if(arr[i] == ' '){
                    arr[i] = '\n'
                    oneSign = 1
                    accuIndex = 0
                }
            }

            i += oneSign
        }

        return arr.join("");
    }

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
                font={font}
                    scale={[3, 3, 3]}
                    anchorX="left"
                    position = {[-(PlaneSize[1]/2) + textPositionOffset[2], (PlaneSize[0]/2) + textPositionOffset[1],  0]}
                >
                
                {manualLineBreaks ? textToFade : injectLineBreaks(textToFade)}
                <a.meshBasicMaterial opacity = {springFade.opacity} transparent color={textColor}/>
                </Text>
            </Suspense>
        </mesh>
    );
}
