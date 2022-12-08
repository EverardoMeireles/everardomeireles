import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense, useState, useRef, useEffect } from "react";
import { Test_scene } from "./Test_scene";
// import { Tube } from "./Tube";
import {useSpring, a} from '@react-spring/three'
import * as THREE from "three";
import { useFrame, useThree, useStore } from '@react-three/fiber'
import { Vector3 } from "three";
import { useTimer } from 'use-timer';
import { smoothstep } from "three/src/math/MathUtils";



export function SceneContainer() {

    // const path = new THREE.CatmullRomCurve3( [
    //     new THREE.Vector3( 0, 0, 0 ),
    //     new THREE.Vector3( 500, 200, 400 ),
    //     new THREE.Vector3( 150, 50, 100 ),
    //     new THREE.Vector3( 250, 25, 45 ),
    //     new THREE.Vector3( 58, 2, 36 )
    // ] );

    const path = new THREE.CatmullRomCurve3( [
        // new THREE.Vector3( 50, 0, 0 ),
        // new THREE.Vector3( 0, 0, 0 ),
        // new THREE.Vector3( 0, 0, 50 ),

        new THREE.Vector3( 15, 0, 0 ),
        new THREE.Vector3( 15, 10, -15 ),
        new THREE.Vector3( 15, 10, -30 ),



        // new THREE.Vector3( 10, 24, 14 ),
        // new THREE.Vector3( 30, 36, 16 ),
        // new THREE.Vector3( 40, 60, 30 ),

        // new THREE.Vector3( 10, 24, 14 ),
        // new THREE.Vector3( 25, 42, 22 ),
        // new THREE.Vector3( 40, 60, 30 ),

        
    ] );

    const [active, setActive] = useState(false)

    var p0 = path.getPointAt(0);
    var p1 = path.getPointAt(1);
    const props = useSpring({
        scale : active ? [25, 25, 25] : [1, 1, 1],
        position: active ? [p1.x,p1.y,p1.z] : [p0.x,p0.y,p0.z]
    
})
    const Tube = () => {
        const aaa = useRef()
        useEffect(() => {
            console.log(aaa);
            aaa.current.wireframe = true;
            aaa.current.visible = true;
            aaa.current.position = new THREE.Vector3(12, 10.85, 30);
          }, [])

        // aaa.current.wireframe = "true;
        
        return(
            <mesh
                onClick={() => setActive(!active)}
                // position={props.position}
            >
                <tubeGeometry args={[path, 40, 1, 70, false]} />
                <meshStandardMaterial wireframe="true" ref={aaa}  attach="material"/>
                
            </mesh>
        )
    }

    const Box = () => {
        return(
            <a.mesh
                onClick={() => setActive(!active)}
                position={props.position}
            >
                <boxGeometry />
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </a.mesh>
        )
    }

    function smoothStep(x) { //Normal smoothstep
        return -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
      }

    const Camera1 = () => {
        var current_path = "index";
        const cam = useRef();
        const { time, start, pause, reset, status } = useTimer();
        const [clicked, setCount] = useState("dsq");

        useEffect(() => {
            console.log(cam);
            cam.current.zoom = 1
            
          }, [])
          
        // useFrame( () => (camPos.x += 0.3));

        // useFrame( () => (cam.current.position.x += 0.1, cam.current.position.y += 0.1));
        var posInit = path.getPointAt(0);
        var tick = 0;
        var sub_points;
        var vector = new THREE.Vector3( 0, 0, -1 );
        var vector_look_at = new THREE.Vector3( -24, 65, -43 );
        var smooth;
        // make sure to use a timer to tick the animation
        // implement buttonclick
        // add support for multiple paths
        useFrame((state) => (tick <= 1 ?(
            console.log("IS RUNNING"),
            vector.lerp(vector_look_at, 0.01),
            state.camera.lookAt(vector),
            tick += 0.005,
            //  tick+=0.005 : tick = 1,
            smooth = smoothStep(tick) <= 1 ? smoothStep(tick) : 1,
            sub_points = path.getPointAt(smooth),
            // (tick) => (sub_points != tick) ? console.log("d") : console.log("s"),
            state.camera.position.x = sub_points.x,
            state.camera.position.y = sub_points.y,
            state.camera.position.z = sub_points.z)
            : state.camera.lookAt(vector)
        ));

        // useFrame(() => {
        //     if (time >= 2) {
        //      pause();
        //      reset();
        //     }
        //    })

        // useFrame(()=>(console.log(path.getPointAt(tt))))
        // useFrame( () => (
        //     console.log(smooth)
        //     // console.log(tick)
        //     ));
        
        return(
            <PerspectiveCamera ref={cam} makeDefault fov={75} position={posInit} />
        )
    }

    return(
        <Suspense fallback={null}>
            <ambientLight/>
            <Environment background={"only"} files={process.env.PUBLIC_URL + "/textures/bg.hdr"} />
            <Environment background={false} files={process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
            <Box


            ></Box>
            {/* <PerspectiveCamera makeDefault fov={50} position={props.position} /> */}
            {/* <PerspectiveCamera makeDefault fov={50} position={[12, 10.85, 30]} /> */}
            <Camera1></Camera1>
            <OrbitControls target={[1, 5, 0]} maxPolarAngle={Math.PI * 0.5}/>
            <Test_scene/>
            <Tube
            // scale = {props.scale}
            ></Tube>
            {/* <Tube
                onClick={() => setActive(!active)}
            >

            </Tube> */}
        </Suspense>
    );
}