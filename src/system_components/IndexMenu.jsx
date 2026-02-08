import { BaseCube } from "./BaseCube";
import { Text } from "@react-three/drei";
import { useCallback, Suspense, useState } from "react";
import * as THREE from "three";
import { useSpring, a } from '@react-spring/three';
import { increaseOrDecreaseGraphics } from "../Helper";
import config from '../config';
import SystemStore from "../SystemStore";

export function IndexMenu(props) {
    const {rotation = 2 * Math.PI} = props;
    const {position = [0, 0, 0]} = props;
    const {scale = 1} = props;
    const {textColor = "#000000"} = props;
    const {isMainMenu = false} = props;
    const {visible = true} = props;
    const {font = config.resource_path + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    const {setDesiredPath, setTransitionEnded} = SystemStore();
    
    const setGraphicalMode = SystemStore((state) => state.setGraphicalMode);
    const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
    const graphicalModes = SystemStore((state) => state.graphicalModes);
    const finishedBenchmark = SystemStore((state) => state.finishedBenchmark);

    const [hovered0, setHover0] = useState(false);
    const [hovered1, setHover1] = useState(false);

    const springColor = useSpring({
        color0: hovered0 ? "white" : "blue",
        color1: hovered1 ? "white" : "blue"
    });

    const textCallbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0) , (Math.PI/2))):console.log()
        ,[]);

    const wholeCallbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0) , (rotation))):console.log()
        ,[]);

    return(
        <mesh
        position={position}
        scale={scale}
        ref={wholeCallbackRef}>
            {(!isMainMenu)
            &&<mesh
            onClick = {(e) => {
                e.stopPropagation();
                setDesiredPath("MainMenu");
                setTransitionEnded(false);
            }}
            position = {[0,3,2]}
            >
                <BaseCube
                position={[0,0,0]}
                width={1}
                height={1}
                depth={10}
                hasMovementAnimation={false}
                hasScaleAnimation={false}
                hasChangeColorOnHover={false}
                visible={visible}
                >
                    <Suspense fallback = {null}>
                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            anchorX="left"
                            position = {[0.6, 0, 3.1]}
                            font={font}
                        >
                            {"Menu Principal"}
                            <a.meshBasicMaterial visible={visible} color = {"red"}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>}
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setDesiredPath("Education");
                setTransitionEnded(false);
            }}
            position = {[0,2,2]}
            >
                <BaseCube
                position={[0,0,0]}
                width={1}
                height={1}
                depth={10}
                hasMovementAnimation={false}
                hasScaleAnimation={false}
                hasChangeColorOnHover={false}
                visible={visible}
                >
                    <Suspense fallback = {null}>
                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            anchorX="left"
                            position = {[0.6, 0, 2]}
                            font={font}
                        >
                            {"Formation"}
                            <a.meshBasicMaterial visible={visible} color = {textColor}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setDesiredPath("Skills");
                setTransitionEnded(false);
            }}
            position = {[0,1,2]}
            >
                <BaseCube
                position={[0,0,0]} 
                width={1}
                height={1}
                depth={10}
                hasMovementAnimation={false}
                hasScaleAnimation={false}
                hasChangeColorOnHover={false}
                visible={visible}
                >
                    <Suspense fallback = {null}>
                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            anchorX="left"
                            position = {[0.6, 0, 2.75]}
                            font={font}
                        >
                            {"Compétences"}
                            <a.meshBasicMaterial visible={visible} color = {textColor}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setDesiredPath("ProfessionalExpProjects0");
                setTransitionEnded(false);
            }}
            position = {[0,0,2]}
            >
                <BaseCube
                position={[0,0,0]} 
                width={1} 
                height={1} 
                depth={10}
                hasMovementAnimation={false}
                hasScaleAnimation={false}
                hasChangeColorOnHover={false}
                visible={visible}
                >
                    <Suspense fallback = {null}>
                        <Text
                            ref = {textCallbackRef}
                            scale={[8, 8, 8]}
                            anchorX="left"
                            position = {[0.6, 0, 4.8]}
                            font={font}
                        >
                            {"Expérience professionnelle"}
                            <a.meshBasicMaterial visible={visible} color = {textColor}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>
            
            {(finishedBenchmark)
            &&
            <mesh position={[0, 1, -3.5]}>
                <mesh
                onPointerOver={() => setHover0(true)} 
                onPointerOut={() => setHover0(false)}
                onClick = { (e) => {
                e.stopPropagation();
                increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, 1)
                }}
                rotation = {[Math.PI*2, 0, 0]}
                scale = {0.5}
                position={[0, .5, 0]}
                >
                    <coneGeometry args = {[0.5, 1.25, 3, 1]}></coneGeometry>
                    <a.meshBasicMaterial visible={visible} color = {springColor.color0} />
                    
                </mesh>

                <mesh
                onPointerOver={() => setHover1(true)} 
                onPointerOut={() => setHover1(false)}
                onClick = { (e) => {
                e.stopPropagation();
                increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, -1)
                }}
                rotation = {[Math.PI, 0, 0]}
                scale = {0.5}
                position={[0, -.5, 0]}
                >
                    <coneGeometry args = {[0.5, 1.25, 3, 1]}></coneGeometry>
                    <a.meshBasicMaterial visible={visible} color = {springColor.color1} />
                    
                </mesh>
            </mesh>}
    </mesh>
    );
}
