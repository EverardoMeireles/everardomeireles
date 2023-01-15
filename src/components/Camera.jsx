import create from 'zustand';
import { useFrame } from '@react-three/fiber';
import { path_points, path_points_lookat_dict } from "../PathPoints";
import { IndexMenu } from "./IndexMenu";
import { ProjectsMenu } from "./ProjectsMenu";
import { FadingTextModel } from "./FadingTextModel";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useRef, useEffect } from "react";
import { FadingSlideShowModel } from './FadingSlideShowModel';
import { OrbitingPointLight } from './OrbitingPointLights';

const useStore = create((set) => ({
    desired_path: "MainMenu",
    setPath: (desired) => set(() => ({desired_path: desired})),
    transitionEnded: false,
    setTransitionEnded: (ended) => set(() => ({transitionEnded: ended})),
    }))

export function Camera() {
    const desired_path = useStore((state) => state.desired_path);
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);

    const updateCallNow = useRef(false);
    const cam = useRef();
    const controls = useRef();
    const current_path = useRef("projects");
    const current_point = useRef(new THREE.Vector3( 15, 1, 0 ));
    const current_lookat = useRef(new THREE.Vector3(0, 3, 2));
    const concat_paths = current_path.current + "-" + desired_path;

    // control target is the last element of path_points_lookat_dict
    const constrolTargetX = path_points_lookat_dict[concat_paths][Object.keys(path_points_lookat_dict[concat_paths]).pop()].x
    const constrolTargetY = path_points_lookat_dict[concat_paths][Object.keys(path_points_lookat_dict[concat_paths]).pop()].y
    const constrolTargetZ = path_points_lookat_dict[concat_paths][Object.keys(path_points_lookat_dict[concat_paths]).pop()].z

    const keyboardControlsSpeed = 0.4

    // used in custom camera lookat
    const desired_lookat_dict = (time) => {
        let nextLookat;
        Object.keys(path_points_lookat_dict[concat_paths]).forEach((time_key) => time >= time_key ? nextLookat = path_points_lookat_dict[concat_paths][time_key] : console.log());
        return nextLookat;
    };

    const desired_point = path_points[concat_paths];

    let smooth;
    let sub_points;
    let tick = 0;

    function updateCall(state){
        if(updateCallNow.current){
            setTransitionEnded(true);
            updateCallNow.current = false;
            current_path.current = desired_path;
            controls.current.enabled = true;
            state.events.enabled = true;
        }
    }

    function smoothStep(x) { //Normal smoothstep
        let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
        if(x >= 1){
            Sn = 1;
        }
        return Sn;
    }

    useFrame((state) => (tick <= 1 ? (
        updateCallNow.current = true,
        state.events.enabled = false,
        controls.current.enabled = false,
        tick += 0.005,
        smooth = smoothStep(tick),

        // console.log(Object.keys(path_points_lookat_dict[desired_path])),
        sub_points = current_point.current = desired_point.getPointAt(smooth),
        
        current_lookat.current.lerp(desired_lookat_dict(smooth), 0.03),
        state.camera.lookAt(current_lookat.current),

        state.camera.position.x = sub_points.x,
        state.camera.position.y = sub_points.y,
        state.camera.position.z = sub_points.z)
        : (updateCall(state))
    ));

    useEffect(()=>{
        window.addEventListener("keydown", (event) => {
            if(event.code == "KeyP") {
                console.log([Math.floor(cam.current.position.x), Math.floor(cam.current.position.y), Math.floor(cam.current.position.z) ])
            }
        })
    })

    // orbitcontrols keyboard control is not working, that's a workaround
    useEffect(()=>{
        window.addEventListener("keydown", (event) => {
            switch(event.code) {
                case "KeyW":
                cam.current.position.x += -keyboardControlsSpeed
                controls.current.target.x += -keyboardControlsSpeed
                break;
                case "KeyA":
                    cam.current.position.z += keyboardControlsSpeed
                    controls.current.target.z += keyboardControlsSpeed
                break;

                case "KeyS":
                    cam.current.position.x += keyboardControlsSpeed
                    controls.current.target.x += keyboardControlsSpeed
                break;
                case "KeyD":
                    cam.current.position.z += -keyboardControlsSpeed
                    controls.current.target.z += -keyboardControlsSpeed
                break;
                case "KeyQ":
                    cam.current.position.y += keyboardControlsSpeed
                    controls.current.target.y += keyboardControlsSpeed
                    cam.current.position.z += keyboardControlsSpeed
                    controls.current.target.z += keyboardControlsSpeed
                break;
                case "KeyE":
                    cam.current.position.y += keyboardControlsSpeed
                    controls.current.target.y += keyboardControlsSpeed
                    cam.current.position.z += -keyboardControlsSpeed
                    controls.current.target.z += -keyboardControlsSpeed
                break;
                case "KeyC":
                    cam.current.position.y += -keyboardControlsSpeed
                    controls.current.target.y += -keyboardControlsSpeed
                    cam.current.position.z += -keyboardControlsSpeed
                    controls.current.target.z += -keyboardControlsSpeed
                break;
                case "KeyZ":
                    cam.current.position.y += -keyboardControlsSpeed
                    controls.current.target.y += -keyboardControlsSpeed
                    cam.current.position.z += keyboardControlsSpeed
                    controls.current.target.z += keyboardControlsSpeed
                break;
                case "KeyR":
                    cam.current.position.y += keyboardControlsSpeed
                    controls.current.target.y += keyboardControlsSpeed
                break;
                case "KeyF":
                    cam.current.position.y += -keyboardControlsSpeed
                    controls.current.target.y += -keyboardControlsSpeed
                break;
            }
        });
    })

    return(
        <>
            <OrbitingPointLight orbitCenterPosition={[0,3,3]} orbitDistance={10}/>
            <IndexMenu {...{useStore}}/>
            <ProjectsMenu {...{useStore}}/> 
            <PerspectiveCamera ref = {cam} makeDefault fov = {75} /*position={[0,0,0]}*/ />
            <OrbitControls ref = {controls} target = {[constrolTargetX-4, constrolTargetY, constrolTargetZ]}/>

            {/* <FadingTextModel {...{useStore}} textModelMenu = "MainMenu" initialPosition={[0,4,-5]} textToFade="Le lycee ort lyon est un lycee technologique, où j'ai fait mon bac+3 3csi spécialisation dev."/> 
            <FadingSlideShowModel {...{useStore}} textModelMenu = "MainMenu" initialPosition={[0,4,5]} imageTexture={'OrtLyon.JPG'}/>
            <FadingSlideShowModel {...{useStore}} textModelMenu = "MainMenu" initialPosition={[0,-3,-5]} PlaneSize={[5,5]} imageTexture={'OrtInterieur.JPG'}/> */}
        </>
    )
}