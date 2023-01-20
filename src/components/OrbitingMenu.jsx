import React, { useEffect, useRef } from "react";
import { useFrame } from '@react-three/fiber'
import {useSpring, a} from '@react-spring/three';
import * as THREE from "three";

export const OrbitingMenu = React.memo((props) => {
    const {orbitCenterPosition = [0, 0, 0]} = props;
    const {orbitAxis = 'x'} = props;
    const {orbitDistance = 1} = props;
    const {orbitDirection = 1} = props;
    const {orbitSpeed = 0.02} = props;
    const {lightIntensivity = 2} = props;
    const {bloomIntensivity = 10} = props;
    const {lightColor = 'white'} = props;

    const orbitRef = useRef();
    // const springColor = useSpring({
    //     color: hovered ? "rgb(" + rgbHover[0] + "," + rgbHover[1] + "," + rgbHover[2] + ")" : "rgb(" + randcolor + "," + randcolor + "," + randcolor + ")"
    // });

    // const axis = [1 * orbitDistance, 0, 0]; // try to remove the 1

    const planeRef0= useRef()
    const planeRef1= useRef()
    const planeRef2= useRef()
    const planeRef3= useRef()

    const planeReff0 = useRef()
    const planeReff1 = useRef()
    const planeReff2= useRef()
    const planeReff3 = useRef()
    useEffect(() => {

        // console.log(planeReff)
        planeReff0.current.rotateY(Math.PI/2)
        // planeReff1.current.rotateY(Math.PI/2)
        planeReff2.current.rotateY(Math.PI/2)
        // planeReff3.current.rotateY(Math.PI/2)

        planeRef0.current.geometry.translate(-orbitDistance, 0, 0);
        planeRef1.current.geometry.translate(0, 0, -orbitDistance);
        planeRef2.current.geometry.translate(orbitDistance, 0, 0);
        planeRef3.current.geometry.translate(0, 0, orbitDistance);
        
        planeRef0.current.position.x = -orbitDistance;
        planeRef1.current.position.x = -orbitDistance;
        planeRef2.current.position.x = -orbitDistance;
        planeRef3.current.position.x = -orbitDistance;
    },[])

    // useFrame(() => {
    //     planeRef0.current.rotation.y += orbitSpeed * orbitDirection;
    //     planeRef1.current.rotation.y += orbitSpeed * orbitDirection;
    //     planeRef2.current.rotation.y += orbitSpeed * orbitDirection;
    //     planeRef3.current.rotation.y += orbitSpeed * orbitDirection;
    // });

    return (
<>
        {/* <mesh position={orbitCenterPosition}>
        <sphereGeometry></sphereGeometry>
        <meshStandardMaterial></meshStandardMaterial>
    </mesh> */}

        <mesh position={[orbitCenterPosition[0] + orbitDistance, orbitCenterPosition[1], orbitCenterPosition[2]]}>
            <mesh scale={3}  ref={planeRef0}>
                <planeGeometry ref={planeReff0} />
                <meshStandardMaterial color={"blue"} side= {THREE.DoubleSide} />
            </mesh>

            <mesh scale={3} ref={planeRef1}>
                <planeGeometry ref={planeReff1}/>
                <meshStandardMaterial color={"white"} side= {THREE.DoubleSide} />
            </mesh>

            <mesh scale={3} ref={planeRef2}>
                <planeGeometry ref={planeReff2}/>
                <meshStandardMaterial color={"red"} side= {THREE.DoubleSide} />
            </mesh>

            <mesh scale={3} ref={planeRef3}>
                <planeGeometry ref={planeReff3}/>
                <meshStandardMaterial color={"green"} side= {THREE.DoubleSide} />
            </mesh>
        </mesh>
        </>
    )
})