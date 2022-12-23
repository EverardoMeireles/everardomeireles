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
import { path_points, path_points_lookat } from "./PathPoints";
import { Decimal } from "decimal.js";

THREE.Vector3.prototype.round = function( digits ) {

    var e = Math.pow( 10, digits || 0 );

    this.x = Math.round( this.x * e ) / e;
    this.y = Math.round( this.y * e ) / e;
    this.z = Math.round( this.z * e ) / e;
        
    return this;

}


export function SceneContainer() {
   const CoordinateFindDebug = () => {
    var useMoveCube = useRef();

    useEffect(() => {
        console.log(useMoveCube);

      }, [])

    return(
        <>  
            <mesh
                // args = {[1, 1, 1]}
                position = {[0, 0, 0]}
                onClick={() => console.log("d")}
                ref={useMoveCube}               
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                // args = {[1, 1, 1]}
                position = {[0, 8, 8]}
                onClick={() =>{
                    useMoveCube.current.position.x -= 1
                    console.log(useMoveCube.current.position)

                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>
            <mesh
                 
                // args = {[1, 1, 1]}
                position = {[4, 8, 8]}
                onClick={() => {
                    useMoveCube.current.position.x += 1
                    console.log(useMoveCube.current.position)
                }}                
                // useMoveCube.current.position.x += 1
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                 
                 // args = {[1, 1, 1]}
                 position = {[2, 12, 8]}
                 onClick={() =>{
                    useMoveCube.current.position.y += 1
                    console.log(useMoveCube.current.position)
                }}                
                 // useMoveCube.current.position.x += 1
                 >
                 <boxGeometry/>
                 <meshStandardMaterial attach="material" color={0x00ff00}/>
             </mesh>

             <mesh
                 
                 // args = {[1, 1, 1]}
                 position = {[2, 4, 8]}
                 onClick={() =>{
                    useMoveCube.current.position.y -= 1
                    console.log(useMoveCube.current.position)

                }}            
                 // useMoveCube.current.position.x += 1
                 >
                 <boxGeometry/>
                 <meshStandardMaterial attach="material" color={0x00ff00}/>
             </mesh>

             <mesh
                 
                 // args = {[1, 1, 1]}
                 position = {[2, 8, 4]}
                 onClick={() =>{
                    useMoveCube.current.position.z -= 1
                    console.log(useMoveCube.current.position)
                }}              
                 // useMoveCube.current.position.x += 1
                 >
                 <boxGeometry/>
                 <meshStandardMaterial attach="material" color={0x00ff00}/>
             </mesh>

             <mesh
                 
                 // args = {[1, 1, 1]}
                 position = {[2, 8, 12]}
                 onClick={() =>{
                    useMoveCube.current.position.z += 1
                    console.log(useMoveCube.current.position)
                    
                }}           
                 // useMoveCube.current.position.x += 1
                 >
                 <boxGeometry/>
                 <meshStandardMaterial attach="material" color={0x00ff00}/>
             </mesh>
        </>
    )
   }


    const path = new THREE.CatmullRomCurve3( [                
            new THREE.Vector3( 15, 10, -30 ),
            new THREE.Vector3( 15, 10, -15 ),
            new THREE.Vector3( 15, 10, 0 ),
    ] );

    const [desiredPoint, setDesiredPoint] = useState("index-reverse")

    var p0 = path.getPointAt(0);
    var p1 = path.getPointAt(1);
//     const props = useSpring({
//         scale : active ? [25, 25, 25] : [1, 1, 1],
//         position: active ? [p1.x,p1.y,p1.z] : [p0.x,p0.y,p0.z]
    
// })
    const Tube = () => {
        const aaa = useRef()
        useEffect(() => {
            // console.log(aaa);
            aaa.current.wireframe = true;
            aaa.current.visible = true;
            aaa.current.position = new THREE.Vector3(12, 10.85, 30);
          }, [])

        // aaa.current.wireframe = "true;
        
        return(
            <mesh

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
            onClick={() => desiredPoint === "index" ? setDesiredPoint("index-reverse") : setDesiredPoint("index")}                
            position = {[12, 0, 0]}
            >
                <boxGeometry />
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </a.mesh>
        )
    }

    function smoothStep(x) { //Normal smoothstep
        let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
        // console.log(x);
        if(x >= 1){
            Sn = 1;
        }
        return Sn
      }

    function decimal_point_stop(vCurrent, Vdesired){
        if(vCurrent.x != Vdesired.x && vCurrent.y != Vdesired.y && vCurrent.z != Vdesired.z){
            return true
        }
    }

    const Camera1 = () => {
        var posInit = path.getPointAt(0);
        var tick = 0;
        var sub_points;
        var current_point = useRef(path_points["index"].getPointAt(0));
        var desired_point = path_points[desiredPoint]
        var current_lookat = useRef(path_points_lookat["index"]);
        var desired_lookat = path_points_lookat[desiredPoint];
        // var vector_look_at = path_points["projects"];
        var smooth;
        var lol = 0;
          
        // useframe
        // somewhere in the code => usestate desired point
        // if current point = desired point jump to else
        //

        useFrame((state) => (tick <= 1 /*decimal_point_stop(current_point.current, desired_point)*/?(
            // console.log(current_lookat),
            current_lookat.current.lerp(desired_lookat, 0.01),
            // current_point.current.lerp(desired_point, 0.01),

            state.camera.lookAt(current_lookat.current),
            tick += 0.005,

            // smooth = smoothStep(tick) <= 1 ? smoothStep(tick) : 1,
            smooth = smoothStep(tick),
            // state.camera.lookAt(path_points[desiredPoint].getPointAt(smooth)),

            sub_points = desired_point.getPointAt(smooth),
            current_point.current = sub_points,
            // (tick) => (sub_points != tick) ? console.log("d") : console.log("s"),
            state.camera.position.x = sub_points.x,
            state.camera.position.y = sub_points.y,
            state.camera.position.z = sub_points.z)
            : lol = 1/*current_path = path_points[desiredPoint]*/ /*state.camera.lookAt(vector)*/
        ));

        // useFrame(() => {
        //     if (time >= 2) {
        //      pause();
        //      reset();
        //     }
        //    })

        // useFrame(()=>(console.log(path.getPointAt(tt))))
        // useFrame( () => (
        //     console.log(current_point),
        //     console.log(path_points[desiredPoint])
        //     ));
        
        return(
            <>
            {/* TO AVOID SUDDEN CAMERA SNAP, TRY LATER TO MAKE THE ORBIT CONTROL'S TARGET THE SAME AS 
            PATHPOINTS'S path_points_lookat's VALUE */}
                <PerspectiveCamera makeDefault fov={75} position={posInit} />
                <OrbitControls />
            </>
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
            {/* <Test_scene/> */}
            <Tube
            // scale = {props.scale}
            ></Tube>
            <CoordinateFindDebug></CoordinateFindDebug>
            {/* <Tube
                onClick={() => setActive(!active)}
            >
            
            </Tube> */}
        </Suspense>
    );
}