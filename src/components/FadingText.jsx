import { Suspense, useCallback, useRef, useState, useEffect } from "react";
import { useFrame } from '@react-three/fiber';
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text } from "@react-three/drei";
import config from '../config';

export function FadingText(props) {
    const useStore = props.useStore;

    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget."} = props;
    const {textModelMenu = "MainMenu"} = props;
    const {textColor = "#000000"} = props;
    const {initialPosition = [0, 0, 0]} = props;
    const {PlaneSize = [7, 6.7]} = props;
    const {rotation = Math.PI/2} = props;
    const {scale = 1.5} = props;
    const {textPositionOffset = [0, -0.5, 0.2]} = props;
    const {manualLineBreaks = false} = props; // true if your input text already contains line breaks('\n')
    const {maxCharsBeforeLineBreak = PlaneSize[0] * 7} = props; // if manualLineBreaks is false, how many characters before a line break on the previous word, default is the length of the plane times the normal length of a roboto font character
    const {font = config.resource_path + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;
    const {fadeDuration = 1000} = props;

    const TextMaterialRef = useRef();
    const [fadeFactor, setFadeFactor] = useState(-1); //1 or -1
    const [playAnimation, setPlayAnimation] = useState(false); //true or false
    const [materialOpacity, setMaterialOpacity] = useState(0);

    const transitionEnded = useStore((state) => state.transitionEnded);
    const desired_path = useStore((state) => state.desired_path);
    const current_path = useRef("");

    // Fade-in animation
    useEffect(() => {
        if(transitionEnded && desired_path == textModelMenu && current_path.current != desired_path){
            setPlayAnimation(true) //invert play animation state
        }
        
        if(desired_path != textModelMenu){
            setPlayAnimation(true)
            setFadeFactor(-1)
        }
        
    },[desired_path, transitionEnded])

    useFrame((state, delta)=> {
        if(playAnimation){
            current_path.current = desired_path;
            if ((materialOpacity <= 1 && fadeFactor == 1) || (materialOpacity >= 0 && fadeFactor == -1)) {
                setMaterialOpacity(TextMaterialRef.current.opacity + ((delta / (fadeDuration / 1000))*fadeFactor))
            }else{
                if(TextMaterialRef.current.opacity <= 1){
                    setFadeFactor(1)
                }
                else
                {
                    setFadeFactor(-1)
                }

                setPlayAnimation(false)
            }
        }
    })

    // automatically insert line breaks in the text 
    function injectLineBreaks(string){
        let arr = [...string];
        let accuIndex = 0
        let oneSign = 1
        let i = 0
        console.log("");
        while( i < arr.length){
            if(accuIndex === maxCharsBeforeLineBreak){
                oneSign = -1
            }

            if(oneSign > 0){
                accuIndex += 1
            }else{
                if(arr[i] === ' '){
                    arr[i] = '\n'
                    oneSign = 1
                    accuIndex = 0
                }
            }

            i += oneSign
        }

        return arr.join("");
    }

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]); // eslint-disable-line react-hooks/exhaustive-deps

    return(
        <group
            position = {initialPosition}
            ref = {callbackRef}
            scale={scale}
        >
                <Text
                    font={font}
                    scale={[3, 3, 3]}
                    anchorX="left"
                    position = {[-(PlaneSize[1]/2) + textPositionOffset[2], (PlaneSize[0]/2) + textPositionOffset[1],  0]}
                >
                
                {manualLineBreaks ? textToFade : injectLineBreaks(textToFade)}
                <meshBasicMaterial ref = {TextMaterialRef} visible = {materialOpacity > 0} opacity = {materialOpacity} transparent color = {textColor}/>
                </Text>
        </group>
    );
}
