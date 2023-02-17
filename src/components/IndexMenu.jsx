import { BaseCube } from "./BaseCube";
import { Text3D, Text } from "@react-three/drei";
import { useCallback, Suspense, useState } from "react";
import * as THREE from "three";
import { useSpring, a } from '@react-spring/three';

export function IndexMenu(props) {
    const {rotation = 2 * Math.PI} = props;
    const {position = [0, 0, 0]} = props;
    const {scale = 1} = props;
    const {textColor = "#000000"} = props;
    const {isMainMenu = false} = props;
    
    const {setPath, setTransitionEnded} = props.useStore();
    
    const setGraphicalMode = props.useStore((state) => state.setGraphicalMode);
    const currentGraphicalMode = props.useStore((state) => state.currentGraphicalMode);
    const graphicalModes = props.useStore((state) => state.graphicalModes);
    const finishedBenchmark = props.useStore((state) => state.finishedBenchmark);

    const [hovered0, setHover0] = useState(false);
    const [hovered1, setHover1] = useState(false);

    const springColor = useSpring({
        color0: hovered0 ? "white" : "blue",
        color1: hovered1 ? "white" : "blue"
    });

    // make sure user can't press it during initial graphical setting
    function IncreaseDecreaseGraphics(direction){
        if(!((["potato"].includes(currentGraphicalMode) && direction == -1) || (["high"].includes(currentGraphicalMode) && direction == 1))){
            setGraphicalMode(graphicalModes[graphicalModes.indexOf(currentGraphicalMode) + direction]);
            console.log("GRAPHICS: " + graphicalModes[graphicalModes.indexOf(currentGraphicalMode) + direction])
            
        }
    }

    const textCallbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0) , (Math.PI/2))):console.log()
        )

    const wholeCallbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0) , (rotation))):console.log()
        )

    return(
        <mesh 
        position={position}
        scale={scale}
        ref={wholeCallbackRef}>
            {(!isMainMenu)
            &&<mesh
            onClick = {(e) => {
                e.stopPropagation();
                setPath("MainMenu");
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
                >
                    <Suspense fallback = {null}>
                        {/* <Text3D
                        position = {[0.5, -0.25, 2.5]}//Use a more standardised approach
                        ref = {textCallbackRef}
                        font = {process.env.PUBLIC_URL + "/roboto.json"}
                        size = {0.575}
                        height = {0.065}
                        curveSegments = {12}
                        >
                            Menu Principal
                            <meshStandardMaterial color = {"red"} />
                        </Text3D> */}

                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            // color="black" // default
                            anchorX="left" // default
                            // anchorY="top" // default
                            position = {[0.6, 0, 3.1]}
                        >
                            {"Menu Principal"}
                            <a.meshBasicMaterial color = {"red"}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>}
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setPath("Education");
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
                >
                    <Suspense fallback = {null}>
                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            // color="black" // default
                            anchorX="left" // default
                            // anchorY="top" // default
                            position = {[0.6, 0, 2]}
                        >
                            {"Formation"}
                            <a.meshBasicMaterial color = {textColor}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setPath("Skills");
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
                >
                    <Suspense fallback = {null}>
                        {/* <Text3D
                        position = {[0.5, -0.25, 2.5]}//Use a more standardised approach
                        ref = {textCallbackRef}
                        font = {process.env.PUBLIC_URL + "/roboto.json"}
                        size = {0.575}
                        height = {0.065}
                        curveSegments = {12}
                        >
                            Compétences
                            <meshStandardMaterial color = {textColor} />
                        </Text3D> */}
                        <Text
                            ref = {textCallbackRef}
                            scale={[9, 9, 9]}
                            // color="black" // default
                            anchorX="left" // default
                            // anchorY="top" // default
                            position = {[0.6, 0, 2.75]}
                        >
                            {"Compétences"}
                            <a.meshBasicMaterial color = {textColor}/>
                        </Text>
                    </Suspense>
                </BaseCube>
            </mesh>
            <mesh
            onClick = {(e) => {
                e.stopPropagation();
                setPath("ProfessionalExpProjects0");
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
                >
                    <Suspense fallback = {null}>
                        {/* <Text3D
                        position = {[0.5, -0.25, 4.7]}//Use a more standardised approach
                        ref = {textCallbackRef}
                        font = {process.env.PUBLIC_URL + "/roboto.json"}
                        size = {0.575}
                        height = {0.065}
                        curveSegments = {12}
                        >
                            Expérience professionnelle
                            <meshStandardMaterial color = {textColor}  />
                        </Text3D> */}
                        <Text
                            ref = {textCallbackRef}
                            scale={[8, 8, 8]}
                            // color="black" // default
                            anchorX="left" // default
                            // anchorY="top" // default
                            position = {[0.6, 0, 4.8]}
                        >
                            {"Expérience professionnelle"}
                            <a.meshBasicMaterial color = {textColor}/>
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
                IncreaseDecreaseGraphics(1)
                }}
                rotation = {[Math.PI*2, 0, 0]}
                scale = {0.5}
                position={[0, .5, 0]}
                >
                    <coneGeometry args = {[0.5, 1.25, 10, 1]}></coneGeometry>
                    <a.meshBasicMaterial color = {springColor.color0} />
                    
                </mesh>

                <mesh
                onPointerOver={() => setHover1(true)} 
                onPointerOut={() => setHover1(false)}
                onClick = { (e) => {
                e.stopPropagation();
                IncreaseDecreaseGraphics(-1)
                }}
                rotation = {[Math.PI, 0, 0]}
                scale = {0.5}
                position={[0, -.5, 0]}
                >
                    <coneGeometry args = {[0.5, 1.25, 10, 1]}></coneGeometry>
                    <a.meshBasicMaterial color = {springColor.color1} />
                    
                </mesh>
            </mesh>}
    </mesh>
    );
}