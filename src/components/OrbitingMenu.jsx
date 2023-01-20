import React, { useEffect, useRef, useState } from "react";
import { useFrame } from '@react-three/fiber';
import {useSpring, a} from '@react-spring/three';
import * as THREE from "three";

export const OrbitingMenu = React.memo((props) => {
    const {orbitCenterPosition = [15.5, 1.1, 0]} = props;
    const {orbitDistance = 1.5} = props;

    const orbitRef = useRef();
    const orbitSpeed = 1;

    const planeRef0 = useRef();
    const planeRef1 = useRef();
    const planeRef2 = useRef();
    const planeRef3 = useRef();
    const planeRef4 = useRef();
    const planeRef5 = useRef();
    const planeRef6 = useRef();
    const planeRef7 = useRef();

    const planeReff0 = useRef();
    const planeReff1 = useRef();
    const planeReff2 = useRef();
    const planeReff3 = useRef();
    const planeReff4 = useRef();
    const planeReff5 = useRef();
    const planeReff6 = useRef();
    const planeReff7 = useRef();

    useEffect(() => {
        planeReff0.current.rotateY(Math.PI / 2);
        planeReff1.current.rotateY(Math.PI / 4);
        // planeReff2.current.rotateY(Math.PI/2);
        planeReff3.current.rotateY(-Math.PI / 4);
        planeReff4.current.rotateY(Math.PI / 2);
        planeReff5.current.rotateY(Math.PI / 4);
        // planeReff6.current.rotateY(Math.PI/3);
        planeReff7.current.rotateY(-Math.PI / 4);

        planeRef0.current.geometry.translate(-orbitDistance / 1.1, 0, 0);
        planeRef1.current.geometry.translate(-orbitDistance / 1.55, 0, -orbitDistance / 1.55);
        planeRef2.current.geometry.translate(0, 0, -orbitDistance / 1.1);
        planeRef3.current.geometry.translate(orbitDistance / 1.55, 0, -orbitDistance / 1.55);
        planeRef4.current.geometry.translate(orbitDistance / 1.1, 0, 0);
        planeRef5.current.geometry.translate(orbitDistance / 1.55, 0, orbitDistance / 1.55);
        planeRef6.current.geometry.translate(0, 0, orbitDistance / 1.1);
        planeRef7.current.geometry.translate(-orbitDistance / 1.55, 0, orbitDistance / 1.55);
        
        planeRef0.current.position.x = -orbitDistance;
        planeRef1.current.position.x = -orbitDistance;
        planeRef2.current.position.x = -orbitDistance;
        planeRef3.current.position.x = -orbitDistance;
        planeRef4.current.position.x = -orbitDistance;
        planeRef5.current.position.x = -orbitDistance;
        planeRef6.current.position.x = -orbitDistance;
        planeRef7.current.position.x = -orbitDistance;
    },[])

    const [clicked, setClicked] = useState(false);
    const [rotation, setRotation] = useState(6.29);// optimize these two into one
    const [rotationIncrement, setRotationIncrement] = useState(0);// optimize these two into one
    const [orbitDirection, setOrbitDirection] = useState(1);

    const axis = [1 * orbitDistance, 0, 0]; // try to remove the 1
    const rotationRadians = (2 * Math.PI) / 8;
    let leftOverRadians = rotationRadians - rotation;

    useFrame((state, delta) => {
        console.log(clicked)
            if(Math.abs(rotation) <= rotationRadians){
                setRotation(rotation + ((delta) * (orbitSpeed * orbitDirection)));
                setRotationIncrement(rotationIncrement + (delta * (orbitSpeed * orbitDirection)));
                leftOverRadians = rotationRadians -(rotation * orbitDirection);
                if(leftOverRadians < (delta * Math.abs((orbitSpeed * orbitDirection)))){
                    console.log("DDDDDDDDDDDDDDDDD")
                    setRotationIncrement(rotationIncrement + leftOverRadians);

                    setClicked(false);
                }else{
                    leftOverRadians=0
                }
                planeRef0.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef1.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef2.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef3.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef4.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef5.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef6.current.rotation.y = rotationIncrement + leftOverRadians;
                planeRef7.current.rotation.y = rotationIncrement + leftOverRadians;
            }
    });

    return (
    <>
        <mesh position = {[orbitCenterPosition[0] + orbitDistance, orbitCenterPosition[1], orbitCenterPosition[2]]}>
            <mesh
            onClick = {!clicked ? (e) => {
                e.stopPropagation();
                setOrbitDirection(-1)
                setRotation(0)
                setClicked(true)
                } : console.log()}

            position = {[- 4, -1, 1]}>
                <boxGeometry></boxGeometry>
            </mesh>

            <mesh
            onClick = {!clicked ? (e) => {
                e.stopPropagation();
                setOrbitDirection(1)
                setRotation(0)
                setClicked(true)
                } : console.log()}

            position = {[- 4, -1, -1]}>
                <boxGeometry></boxGeometry>
            </mesh>

            <mesh scale = {1} ref = {planeRef0}>
                <planeGeometry ref = {planeReff0} />
                <meshStandardMaterial color={"blue"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef1}>
                <planeGeometry ref = {planeReff1}/>
                <meshStandardMaterial color = {"white"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef2}>
                <planeGeometry ref = {planeReff2}/>
                <meshStandardMaterial color = {"red"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef3}>
                <planeGeometry ref = {planeReff3}/>
                <meshStandardMaterial color = {"green"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef4}>
                <planeGeometry ref = {planeReff4}/>
                <meshStandardMaterial color = {"yellow"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef5}>
                <planeGeometry ref = {planeReff5}/>
                <meshStandardMaterial color = {"black"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef6}>
                <planeGeometry ref = {planeReff6}/>
                <meshStandardMaterial color = {"pink"} side = {THREE.DoubleSide} />
            </mesh>

            <mesh scale = {1} ref = {planeRef7}>
                <planeGeometry ref = {planeReff7}/>
                <meshStandardMaterial color = {"cyan"} side = {THREE.DoubleSide} />
            </mesh>
        </mesh>
    </>
    )
})