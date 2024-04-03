import { useCallback, useState } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Float, Text } from "@react-three/drei";
import { TranslationTable } from "../TranslationTable";

export function FloatingTextSkills(props) {
    const useStore = props.useStore;
    
    const {initialPosition = [0,0,0]} = props;
    const {hitBoxSize = [2, 1]} = props;
    const {rotation = Math.PI/2} = props;
    const {font = process.env.PUBLIC_URL + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;
    const {textPosition = [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8], [1, 2, 8]]} = props;

    const setSkillHovered = props.useStore((state) => state.setSkillHovered); 
    const currentLanguage = useStore((state) => state.currentLanguage);

    const textContents = [
    TranslationTable[currentLanguage]["Floating_text_Python"], TranslationTable[currentLanguage]["Floating_text_C#"], TranslationTable[currentLanguage]["Floating_text_javaScript"],
    TranslationTable[currentLanguage]["Floating_text_React"], TranslationTable[currentLanguage]["Floating_text_Threejs"], TranslationTable[currentLanguage]["Floating_text_blender"],
    TranslationTable[currentLanguage]["Floating_text_SQL"], TranslationTable[currentLanguage]["Floating_text_HTML_CSS"], TranslationTable[currentLanguage]["Floating_text_English"], 
    TranslationTable[currentLanguage]["Floating_text_Portuguese"],TranslationTable[currentLanguage]["Floating_text_French"]
    ]
     // allemand(compris uniquement), API REST, async, arduino, flask 
    const textColorCat = ["red", "red", "red", "blue", "blue", "green", "yellow", "yellow", "black", "black", "black"]

    const [hovered0, setHover0] = useState(false);
    const [hovered1, setHover1] = useState(false);
    const [hovered2, setHover2] = useState(false);
    const [hovered3, setHover3] = useState(false);
    const [hovered4, setHover4] = useState(false);
    const [hovered5, setHover5] = useState(false);
    const [hovered6, setHover6] = useState(false);
    const [hovered7, setHover7] = useState(false);
    const [hovered8, setHover8] = useState(false);
    const [hovered9, setHover9] = useState(false);
    const [hovered10, setHover10] = useState(false);
    
    const springScale = useSpring({
        scale0: hovered0 ? 1.5 : 1,
        scale1: hovered1 ? 1.5 : 1,
        scale2: hovered2 ? 1.5 : 1,
        scale3: hovered3 ? 1.5 : 1,
        scale4: hovered4 ? 1.5 : 1,
        scale5: hovered5 ? 1.5 : 1,
        scale6: hovered6 ? 1.5 : 1,
        scale7: hovered7 ? 1.5 : 1,
        scale8: hovered8 ? 1.5 : 1,
        scale9: hovered9 ? 1.5 : 1,
        scale10: hovered10 ? 1.5 : 1,
    });

    const springColor = useSpring({
        color0: hovered0 ? "white" : textColorCat[0],
        color1: hovered1 ? "white" : textColorCat[1],
        color2: hovered2 ? "white" : textColorCat[2],
        color3: hovered3 ? "white" : textColorCat[3],
        color4: hovered4 ? "white" : textColorCat[4],
        color5: hovered5 ? "white" : textColorCat[5],
        color6: hovered6 ? "white" : textColorCat[6],
        color7: hovered7 ? "white" : textColorCat[7],
        color8: hovered8 ? "white" : textColorCat[8],
        color9: hovered9 ? "white" : textColorCat[9],
        color10: hovered10 ? "white" : textColorCat[10],
    });

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
        ,[]); // eslint-disable-line react-hooks/exhaustive-deps

    return(
    <mesh position = {initialPosition} ref = {callbackRef}>
        <Float>
            <a.mesh position = {textPosition[0]} scale = {springScale.scale0} onPointerOver={() => {setHover0(true); setSkillHovered(textContents[0]);}} onPointerOut={() => setHover0(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[0]}
                    <a.meshStandardMaterial color={springColor.color0}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[1]} scale = {springScale.scale1} onPointerOver={() => {setHover1(true); setSkillHovered(textContents[1]);}} onPointerOut={() => setHover1(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[1]}
                    <a.meshStandardMaterial color={springColor.color1}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[2]} scale = {springScale.scale2} onPointerOver={() => {setHover2(true); setSkillHovered(textContents[2]);}} onPointerOut={() => setHover2(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[2]}
                    <a.meshStandardMaterial color={springColor.color2}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[3]} scale = {springScale.scale3} onPointerOver={() => {setHover3(true); setSkillHovered(textContents[3]);}} onPointerOut={() => setHover3(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[3]}
                    <a.meshStandardMaterial color={springColor.color3}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[4]} scale = {springScale.scale4} onPointerOver={() => {setHover4(true); setSkillHovered(textContents[4]);}} onPointerOut={() => setHover4(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[4]}
                    <a.meshStandardMaterial color={springColor.color4}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[5]} scale = {springScale.scale5} onPointerOver={() => {setHover5(true); setSkillHovered(textContents[5]);}} onPointerOut={() => setHover5(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[5]}
                    <a.meshStandardMaterial color={springColor.color5}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[6]} scale = {springScale.scale6} onPointerOver={() => {setHover6(true); setSkillHovered(textContents[6]);}} onPointerOut={() => setHover6(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[6]}
                    <a.meshStandardMaterial color={springColor.color6}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[7]} scale = {springScale.scale7} onPointerOver={() => {setHover7(true); setSkillHovered(textContents[7]);}} onPointerOut={() => setHover7(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[7]}
                    <a.meshStandardMaterial color={springColor.color7}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[8]} scale = {springScale.scale8} onPointerOver={() => {setHover8(true); setSkillHovered(textContents[8]);}} onPointerOut={() => setHover8(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[8]}
                    <a.meshStandardMaterial color={springColor.color8}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[9]} scale = {springScale.scale9} onPointerOver={() => {setHover9(true); setSkillHovered(textContents[9]);}} onPointerOut={() => setHover9(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[9]}
                    <a.meshStandardMaterial color={springColor.color9}/>
                </Text>
            </a.mesh>
        </Float>
        <Float>
            <a.mesh position = {textPosition[10]} scale = {springScale.scale10} onPointerOver={() => {setHover10(true); setSkillHovered(textContents[10]);}} onPointerOut={() => setHover10(false)}>
                <planeGeometry args={hitBoxSize} />
                <meshBasicMaterial visible={false} />
                <Text
                    font={font}
                    scale={[8, 8, 8]}
                    anchorX="left"
                    position = {[0.6, 0, 4.8]}
                >
                    {textContents[10]}
                    <a.meshStandardMaterial color={springColor.color10}/>
                </Text>
            </a.mesh>
        </Float>
    </mesh>
    );
}
