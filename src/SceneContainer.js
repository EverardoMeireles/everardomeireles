import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense, useRef, useEffect } from "react";
import { useFrame } from '@react-three/fiber';
import { path_points, path_points_lookat } from "./PathPoints";
import { IndexMenu } from "./IndexMenu";
import { ProjectsMenu } from "./ProjectsMenu";
import { FadingTextModel } from "./FadingTextModel";
import create from 'zustand';
import * as THREE from "three";

const useStore = create((set) => ({
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({desired_path: desired})),
    transitionEnded: false,
    setTransitionEnded: (ended) => set(() => ({transitionEnded: ended})),
    }))

export function SceneContainer() {
    const CoordinateFindDebug = () => {
    var pivotCube = useRef();

    return(
        <>  
            <mesh
                position = {[0, 0, -3]}
                ref = {pivotCube}
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[0, 8, 8]}
                onClick = {() => {
                    pivotCube.current.position.x -= 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[4, 8, 8]}
                onClick = {() => {
                    pivotCube.current.position.x += 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 12, 8]}
                onClick = {() => {
                    pivotCube.current.position.y += 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 4, 8]}
                onClick = {() => {
                    pivotCube.current.position.y -= 1;
                    console.log(pivotCube.current.position);
                }}            
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 4]}
                onClick = {() => {
                    pivotCube.current.position.z -= 1;
                    console.log(pivotCube.current.position);
                }}              
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 12]}
                onClick = {() => {
                    pivotCube.current.position.z += 1;
                    console.log(pivotCube.current.position);
                }}           
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>
        </>
    )
}


    function smoothStep(x) { //Normal smoothstep
        let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
        if(x >= 1){
            Sn = 1;
        }
        return Sn;
    }

    const Camera = () => {
        const desired_path = useStore((state) => state.desired_path);
        const setTransitionEnded = useStore((state) => state.setTransitionEnded);

        var sub_points;
        var current_path = useRef("projects");
        var current_point = useRef(new THREE.Vector3( 15, 1, 0 ));
        var concat_paths = current_path.current + "-" + desired_path;
        var desired_point = path_points[concat_paths];
        var current_lookat = useRef(path_points_lookat["index"]);
        var desired_lookat = path_points_lookat[desired_path];
        var smooth;
        var cam = useRef();
        var controls = useRef();
        var tick = 0;
        var updateCallNow = useRef(false);

        useEffect(() => {
            cam.current.rotation.x = 0;
            cam.current.rotation.y = 0;
            cam.current.rotation.z = 0;
        }, [])

        function updateCall(state){
            if(updateCallNow.current){
                setTransitionEnded(true);
                updateCallNow.current = false;
                current_path.current = desired_path;
                controls.current.enabled = true;
                state.events.enabled = true;
            }
        }

        useFrame((state) => (tick <= 1 ? (
            updateCallNow.current = true,
            state.events.enabled = false,
            controls.current.enabled = false,
            current_lookat.current.lerp(desired_lookat, 0.03),
            state.camera.lookAt(current_lookat.current),
            
            tick += 0.005,
            smooth = smoothStep(tick),
            sub_points = desired_point.getPointAt(smooth),
            current_point.current = sub_points,

            state.camera.position.x = sub_points.x,
            state.camera.position.y = sub_points.y,
            state.camera.position.z = sub_points.z)
            : (updateCall(state))
        ));
        
        return(
            <>
                <PerspectiveCamera ref = {cam} makeDefault fov = {75} /*position={[0,0,0]}*/ />
                <OrbitControls ref = {controls} target = {[desired_lookat.x-4, desired_lookat.y, desired_lookat.z]}/>
                <IndexMenu {...{useStore}}/>
                <ProjectsMenu {...{useStore}}/>
                <FadingTextModel {...{useStore}} textModelMenu = "MainMenu" />
            </>
        )
    }

    return(
        <>
            <ambientLight/>
            <CoordinateFindDebug></CoordinateFindDebug>
            <Camera/>
            <Suspense fallback = {null}>
                <Environment background = {"only"} files = {process.env.PUBLIC_URL + "/textures/bg.hdr"} />
                <Environment background = {false} files = {process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
            </Suspense>
        </>
    );
}