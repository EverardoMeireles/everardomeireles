import React, { Suspense, useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Text } from "@react-three/drei";
import config from '../config';

export const FadingText = React.memo((props) => {
    const useStore = props.useStore;

    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget."} = props;
    const {textColor = "#000000"} = props;
    const {initialPosition = [0, 0, 0]} = props;
    const {planeSize = [7, 6.7]} = props;
    const {rotation = Math.PI/2} = props;
    const {scale = 1.5} = props;
    const {textPositionOffset = [0, -0.5, 0.2]} = props;
    const {manualLineBreaks = false} = props; // true if your input text already contains line breaks('\n')
    const {maxCharsBeforeLineBreak = planeSize[0] * 7} = props; // if manualLineBreaks is false, how many characters before a line break on the previous word, default is the length of the plane times the normal length of a roboto font character
    const {font = config.resource_path + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;
    const {fadeDuration = 1000} = props;
    const {textIsVisible = false} = props;
    const {textIsVisibleByTransitionDestination = false} = props;
    const {textIsVisibleByTransitionDestinationWaitForTransitionEnd = false} = props;
    const {transitionDestinationToShowText = "MainMenu"} = props;

    const TextMaterialRef = useRef();
    const [fadeFactor, setFadeFactor] = useState(-1); //1 or -1
    const [playAnimation, setPlayAnimation] = useState(false); //true or false
    const [materialOpacity, setMaterialOpacity] = useState(0);

    const transitionEnded = useStore((state) => state.transitionEnded);
    const transitionDestination = useStore((state) => state.transitionDestination);
    const currentTransitionDestination = useRef("");

    const iScale= useMemo(() => [3, 3, 3], []);

    // Activate the animation
    useEffect(() => {
        if((textIsVisibleByTransitionDestination && transitionDestination == transitionDestinationToShowText 
            && (textIsVisibleByTransitionDestinationWaitForTransitionEnd && transitionEnded || !textIsVisibleByTransitionDestinationWaitForTransitionEnd)
            &&  currentTransitionDestination.current != transitionDestination) // ????????? Keep this condition ??????????
            || (!textIsVisibleByTransitionDestination && textIsVisible))
        {
            setPlayAnimation(true) //invert play animation state
        }
        
        if((textIsVisibleByTransitionDestination && transitionDestination != transitionDestinationToShowText)
            || (!textIsVisibleByTransitionDestination && !textIsVisible))
        {
            setPlayAnimation(true)
            setFadeFactor(-1)
        }
        
    },[transitionDestination, transitionEnded])

    // Fade in and out animation
    useFrame((state, delta)=> {
        if(playAnimation){
            currentTransitionDestination.current = transitionDestination;
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
                    scale={iScale}
                    anchorX="left"
                    position = {[-(planeSize[1]/2) + textPositionOffset[2], (planeSize[0]/2) + textPositionOffset[1],  0]}
                >
                
                {manualLineBreaks ? textToFade : injectLineBreaks(textToFade)}
                <meshBasicMaterial ref = {TextMaterialRef} visible = {materialOpacity > 0} opacity = {materialOpacity} transparent color = {textColor}/>
                </Text>
        </group>
    );
});

FadingText.displayName = "FadingText";