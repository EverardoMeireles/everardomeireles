import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense, useState, useRef, useEffect } from "react";
import { Test_scene } from "./Test_scene";
import {useSpring, a} from '@react-spring/three'
import * as THREE from "three";
import { useFrame } from '@react-three/fiber'
import { path_points, path_points_lookat } from "./PathPoints";
import { IndexMenu } from "./IndexMenu"
import { ProjectsMenu } from "./ProjectsMenu"
import create from 'zustand'

const useStore = create((set) => ({
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({ desired_path: desired })),
    }))

export function SceneContainer() {
    
    const props = useSpring({
        // scale : active ? [25, 25, 25] : [1, 1, 1],
        // position: active ? [p1.x,p1.y,p1.z] : [p0.x,p0.y,p0.z]
    })

    const CoordinateFindDebug = () => {
    var pivotCube = useRef();

    useEffect(() => {
        console.log(pivotCube);

    }, [])

    return(
        <>  
            <mesh
                position = {[0, 0, -3]}
                ref={pivotCube}
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[0, 8, 8]}
                onClick={() =>{
                    pivotCube.current.position.x -= 1
                    console.log(pivotCube.current.position)

                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[4, 8, 8]}
                onClick={() => {
                    pivotCube.current.position.x += 1
                    console.log(pivotCube.current.position)
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 12, 8]}
                onClick={() =>{
                    pivotCube.current.position.y += 1
                    console.log(pivotCube.current.position)
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 4, 8]}
                onClick={() =>{
                    pivotCube.current.position.y -= 1
                    console.log(pivotCube.current.position)

                }}            
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 4]}
                onClick={() =>{
                    pivotCube.current.position.z -= 1
                    console.log(pivotCube.current.position)
                }}              
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 12]}
                onClick={() =>{
                    pivotCube.current.position.z += 1
                    console.log(pivotCube.current.position)
                    
                }}           
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
                </mesh>
        </>
    )
}

    const Tube = () => {
        const path = new THREE.CatmullRomCurve3( [                
            new THREE.Vector3( 15, 10, -30 ),
            new THREE.Vector3( 15, 10, -15 ),
            new THREE.Vector3( 15, 10, 0 ),
    ] );

        const meshMaterial = useRef()
        useEffect(() => {
            // console.log(meshMaterial);
            meshMaterial.current.wireframe = true;
            meshMaterial.current.visible = true;
            meshMaterial.current.position = new THREE.Vector3(12, 10.85, 30);
        }, [])

        return(
            <mesh>
                <tubeGeometry args={[path, 40, 1, 70, false]} />
                <meshStandardMaterial wireframe="true" ref={meshMaterial}  attach="material"/>
            </mesh>
        )
    }

    const Box = () => {
        return(
            <a.mesh
            position = {[12, 0, 0]}
            >
                <boxGeometry />
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </a.mesh>
        )
    }

    function smoothStep(x) { //Normal smoothstep
        let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
        if(x >= 1){
            Sn = 1;
        }
        return Sn
    }

    const Camera = () => {
        const { desired_path } = useStore()
        var sub_points;
        var current_path = useRef("projects")
        var current_point = useRef(new THREE.Vector3( 15, 1, 0 ));
        var concat_paths = current_path.current + "-" + desired_path
        var desired_point = path_points[concat_paths]
        var current_lookat = useRef(path_points_lookat["index"]);
        var desired_lookat = path_points_lookat[desired_path];
        var smooth;
        var cam = useRef();
        var tick = 0;

        useEffect(() => {
            cam.current.rotation.x = 0;
            cam.current.rotation.y = 0;
            cam.current.rotation.z = 0;
            console.log(cam);
        }, [])

        // somewhere in the code => usestate desired point
        // if current point = desired point jump to else
        useFrame((state) => (tick <= 1 /*decimal_point_stop(current_point.current, desired_point)*/?(
            state.events.enabled = false ,
            tick += 0.005,
            smooth = smoothStep(tick),

            current_lookat.current.lerp(desired_lookat, 0.03),
            state.camera.lookAt(current_lookat.current),

            sub_points = desired_point.getPointAt(smooth),
            current_point.current = sub_points,

            state.camera.position.x = sub_points.x,
            state.camera.position.y = sub_points.y,
            state.camera.position.z = sub_points.z,
            console.log(current_lookat.current))
            : (current_path.current = desired_path, state.events.enabled = true, console.log(current_path.current))
        ));

        // useFrame( () => (
        //     console.log(path_points_lookat),
        //     console.log(current_lookat.current)
        //     ));
        
        return(
            <>
                <PerspectiveCamera ref={cam} makeDefault fov={75} /*position={[0,0,0]}*/ />
                <OrbitControls target={desired_lookat}/>
                <IndexMenu {...{useStore}}/>
                <ProjectsMenu {...{useStore}}/>
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
            <Tube/>
            <Camera/>
            {/* <Test_scene/> */}
            <CoordinateFindDebug></CoordinateFindDebug>
        </Suspense>
    );
}