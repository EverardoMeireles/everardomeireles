import React, { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useLoader } from '@react-three/fiber';
import {useSpring, a} from '@react-spring/three';
import * as THREE from "three";

export const OrbitingMenu = React.memo((props) => {
    const useStore = props.useStore;
    const {orbitCenterPosition = [15.5, 1.1, 0]} = props;
    const {planeSize = [5, 5]} = props;
    const {orbitDistance = 1.5} = props;
    const {visible = true} = props;
    const {fadeInDuration = 300} = props;

    const transitionEnded = useStore((state) => state.transitionEnded);
    const desired_path = useStore((state) => state.desired_path);

    const [hovered0, setHover0] = useState(false);
    const [hovered1, setHover1] = useState(false);
    // const [fadeInDone, setFadeInDone] = useState(false);

    const [rotation, setRotation] = useState(6.29); // optimize these two into one
    const [rotationIncrement, setRotationIncrement] = useState(0); // optimize these two into one
    const [orbitDirection, setOrbitDirection] = useState(1);

    const clicked = useRef(false);

    const orbitSpeed = 1;
    const rotationRadians = (2 * Math.PI) / 8;
    let leftOverRadians = rotationRadians - rotation;

    const springColor = useSpring({
        color0: hovered0 ? "white" : "blue",
        color1: hovered1 ? "white" : "blue"
    });

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

    const planeRefArray = useRef([planeRef0, planeRef1, planeRef2, planeRef3, planeRef4, planeRef5, planeRef6, planeRef7])

    useFrame((state, delta)=> {
        planeRefArray.current.forEach((planeRef) => {
            if (planeRef.current.material.opacity < 1) {
                planeRef.current.material.opacity = planeRef.current.material.opacity + (delta / (fadeInDuration / 1000))
                // console.log(planeRef.current.material.opacity)
            }
        })
    })

    useEffect(() => {
        planeReff0.current.rotateY(Math.PI / 2);
        planeReff1.current.rotateY(Math.PI / 4);
        // planeReff2.current.rotateY(Math.PI/2);
        planeReff3.current.rotateY(-Math.PI / 4);
        planeReff4.current.rotateY(-Math.PI / 2);
        planeReff5.current.rotateY(Math.PI/4);
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
    },[]) // eslint-disable-line react-hooks/exhaustive-deps

    const planetexture0 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/AfficheEDHC-Portuguese.png');
    const planetexture1 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/AfficheUNIRN-Portuguese.png');
    const planetexture2 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/AfficheDUT-Portuguese.png');
    const planetexture3 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/ortAfficheBTS-French.png');
    const planetexture4 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/ortAffiche3CSI-French.png');
    const planetexture5 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/AfficheMicrolins1-Portuguese.png');
    const planetexture6 = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL + '/textures/AfficheMicrolins2-Portuguese.png');
    // const texture = useLoader(THREE.TextureLoader, process.env.PUBLIC_URL +'./textures/')

    useFrame((state, delta) => {
        if(Math.abs(rotation) <= rotationRadians){
            setRotation(rotation + ((delta) * (orbitSpeed * orbitDirection)));
            setRotationIncrement(rotationIncrement + (delta * (orbitSpeed * orbitDirection)));
            leftOverRadians = rotationRadians - (rotation * orbitDirection);
            if(leftOverRadians < (delta * Math.abs((orbitSpeed * orbitDirection)))){
                setRotationIncrement(rotationIncrement + leftOverRadians);

                clicked.current = false;
            }else{
                leftOverRadians = 0;
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

    // THERE ARE PROBLEMS WITH KEYBOARD CONTROLS, THAT IF STATEMENT IS NOT WORKING
    useEffect(()=>{
        window.addEventListener("keydown", (event) => {
            if(!clicked.current && desired_path == "Education" && transitionEnded){
                clicked.current = true;
                setRotation(0);
                switch(event.code) {
                    case "ArrowLeft":
                        setOrbitDirection(-1);
    
                        // console.log("left")
                    break;
                    case "ArrowRight":
                        setOrbitDirection(1);
                        // setClicked(true)
                        // setRotation(0)
                            // console.log("right")
                    break;
                }
            }
        });
    });

    return (
        <mesh position = {[orbitCenterPosition[0] + orbitDistance, orbitCenterPosition[1], orbitCenterPosition[2]]}>
            <mesh 
            onPointerOver={() => setHover0(true)} 
            onPointerOut={() => setHover0(false)}
            onClick = {!clicked.current ? (e) => {
                e.stopPropagation();
                setOrbitDirection(-1)
                setRotation(0)
                clicked.current = true;
                } : undefined}
            rotation = {[Math.PI/2, 0, 0]}
            scale = {0.5}
            position = {[-12.5, -2.5, 0.5]}>
                <coneGeometry args = {[0.5, 1.25, 10, 1]}></coneGeometry>
                <a.meshBasicMaterial visible={visible} color = {springColor.color0} />
            </mesh>

            <mesh
            onPointerOver = {() => setHover1(true)} 
            onPointerOut = {() => setHover1(false)}
            onClick = {!clicked.current ? (e) => {
                e.stopPropagation();
                setOrbitDirection(1)
                setRotation(0)
                clicked.current = true;
                } : undefined}
            rotation = {[-Math.PI/2, 0, 0]}
            scale = {0.5}
            position = {[-12.5, -2.5, -0.5]}>
                <coneGeometry args = {[0.5, 1.25, 10, 1]}></coneGeometry>
                <a.meshBasicMaterial visible={visible} color={springColor.color1} />
            </mesh>

            <Suspense>
                <mesh ref = {planeRef0}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff0} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture0} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef1}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff1} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture1} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef2}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff2} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture2} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef3}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff3} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture3} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef4}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff4} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture4} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef5}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff5} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture5} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef6}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff6} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={visible} map = {planetexture6} attach = "material" side = {THREE.DoubleSide} />
                </mesh>

                <mesh ref = {planeRef7}>
                    <planeBufferGeometry args={planeSize} ref = {planeReff7} attach = "geometry"/>
                    <meshBasicMaterial opacity={0} transparent={true} visible={false} /*map = {planetexture6}*/ attach = "material" side = {THREE.DoubleSide} />
                </mesh>
            </Suspense>
        </mesh>
    )
})