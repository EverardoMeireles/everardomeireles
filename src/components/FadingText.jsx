import { Suspense, useCallback, useRef, useState, useEffect } from "react";
import { useFrame } from '@react-three/fiber';
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text } from "@react-three/drei";

export function FadingText(props) {
    const useStore = props.useStore;

    const {textToFade = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget."} = props;
    const {textModelMenu = "MainMenu"} = props;
    const {textColor = "#000000"} = props;
    const {transitionDuration = 1000} = props;
    const {initialPosition = [0, 0, 0]} = props;
    const {PlaneSize = [7, 6.7]} = props;
    const {rotation = Math.PI/2} = props;
    const {visible = true} = props;
    const {scale = 1.5} = props;
    const {textPositionOffset = [0, -0.5, 0.2]} = props;
    // true if your input text already contains line breaks('\n')
    const {manualLineBreaks = false} = props;
    // if manualLineBreaks is false, how many characters before a line break on the previous word, default is the length of the plane times the normal length of a roboto font character
    const {maxCharsBeforeLineBreak = PlaneSize[0] * 7} = props;
    const {font = process.env.PUBLIC_URL + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    // const {transitionEnded, desired_path} = props.useStore();
    
    const TextMaterialRef = useRef();
    const [fadeFactor, setFadeFactor] = useState(-1); //1 or -1
    const [playAnimation, setPlayAnimation] = useState(false); //1 or -1
    const [materialOpacity, setMaterialOpacity] = useState(0);

    const transitionEnded = useStore((state) => state.transitionEnded);
    const desired_path = useStore((state) => state.desired_path);

    // Fade-in animation
    useEffect(() => {
        if(transitionEnded && desired_path == textModelMenu){
            
            // setFadeFactor(fadeFactor * -1) //invert fade factor state
            setPlayAnimation(true) //invert play animation state
        }
        
        if(desired_path != textModelMenu){
            setPlayAnimation(true)
            setFadeFactor(-1)
        }
    },[desired_path, transitionEnded])
    
    useFrame((state, delta)=> {
        if(playAnimation){
            if ((materialOpacity <= 1 && fadeFactor == 1) || (materialOpacity >= 0 && fadeFactor == -1)) {
                setMaterialOpacity(TextMaterialRef.current.opacity + ((delta / (transitionDuration / 1000))*fadeFactor))
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


    // // Fade in and out animation
    // const springFade = useSpring({
    //     opacity: (transitionEnded && desired_path === textModelMenu) ? 1 : 0,
    //     config: {
    //         duration:transitionDuration
    //     }
    // })

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]); // eslint-disable-line react-hooks/exhaustive-deps

    return(
        <mesh
            position = {initialPosition}
            ref = {callbackRef}
            scale={scale}
        >
            <planeGeometry args = {PlaneSize} />
            <meshBasicMaterial  opacity = {1} transparent visible={visible}/>
                <Text
                    font={font}
                    scale={[3, 3, 3]}
                    anchorX="left"
                    position = {[-(PlaneSize[1]/2) + textPositionOffset[2], (PlaneSize[0]/2) + textPositionOffset[1],  0]}
                >
                
                {manualLineBreaks ? textToFade : injectLineBreaks(textToFade)}
                <meshBasicMaterial ref={TextMaterialRef} visible={materialOpacity >= 0} opacity = {materialOpacity} transparent color={textColor}/>
                </Text>
        </mesh>
    );
}
