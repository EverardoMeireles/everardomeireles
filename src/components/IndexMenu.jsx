import { BaseCube } from "./BaseCube";
import { Text3D } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useSpring, a } from '@react-spring/three';

export function IndexMenu(props) {
    const [hovered, setHover] = useState(false);
    const {setPath, setTransitionEnded} = props.useStore();
    const text3DD = useRef();

    const springColor = useSpring({
        color: hovered ? "rgb(120,120,120)" : "rgb(255,255,255)"
    })

    useEffect(() => {
        text3DD.current.rotateOnAxis(new THREE.Vector3(0, 1, 0) , Math.PI/2);
    }, [])
    return(
    <>
        <a.mesh
        onClick = {() => (setPath("projects"), setTransitionEnded(false))} position = {[0,0,2]}
        onPointerOver = {() => setHover(true)}
        onPointerOut = {() => setHover(false)}
        >
            <boxGeometry args = {[1, 1, 5]} />
            <a.meshStandardMaterial color = {springColor.color} />

            <Text3D
            position = {[0.5, -0.25, 1.5]}//Use a more standardised approach
            ref = {text3DD}
            font = {process.env.PUBLIC_URL + "roboto.json"}
            size = {0.575}
            height = {0.065}
            curveSegments = {12}
            >
                Projects
                <meshStandardMaterial color = {[1, 0.15, 0.1]} emissive = {[1, 0.1, 0]} />
            </Text3D>
        </a.mesh>
        
        <BaseCube position = {[0,1,0]} movementVector = {[0.1, 0, 0]} />
        <BaseCube position = {[0,2,0]} />
        <BaseCube position = {[0,3,0]} />
        <BaseCube position = {[0,4,0]} />
        <BaseCube position = {[0,5,0]} />
        <BaseCube position = {[0,6,0]} />
        <BaseCube position = {[0,1,1]} />
        <BaseCube position = {[0,2,1]} />
        <BaseCube position = {[0,3,1]} />
        <BaseCube position = {[0,4,1]} />
        <BaseCube position = {[0,5,1]} />
        <BaseCube position = {[0,6,1]} />
        <BaseCube position = {[0,1,2]} />
        <BaseCube position = {[0,2,2]} />
        <BaseCube position = {[0,3,2]} />
        <BaseCube position = {[0,4,2]} />
        <BaseCube position = {[0,5,2]} />
        <BaseCube position = {[0,6,2]} />
        <BaseCube position = {[0,1,3]} />
        <BaseCube position = {[0,2,3]} />
        <BaseCube position = {[0,3,3]} />
        <BaseCube position = {[0,4,3]} />
        <BaseCube position = {[0,5,3]} />
        <BaseCube position = {[0,6,3]} />
        <BaseCube position = {[0,1,4]} />
        <BaseCube position = {[0,2,4]} />
        <BaseCube position = {[0,3,4]} />
        <BaseCube position = {[0,4,4]} />
        <BaseCube position = {[0,5,4]} />
        <BaseCube position = {[0,6,4]} />
    </>
    );
}