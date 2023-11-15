import { useFrame } from '@react-three/fiber';
import { path_points, path_points_simple_lookat_dict, path_points_lookat_dict, path_points_speed } from "../PathPoints";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import React, { useRef, useEffect, useState } from "react";
import { HtmlDreiMenu } from "./HtmlDreiMenu"; // eslint-disable-line no-unused-vars

// revisit custom camera lookat mode and simpleLookatMode
export const Camera = React.memo((props) => {
    const useStore = props.useStore;
    const desired_path = useStore((state) => state.desired_path);
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);
    const currentCameraMovements = useStore((state) => state.currentCameraMovements);
    const currentCameraMode = useStore((state) => state.currentCameraMode);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const panDirectionalEdgethreshold = useStore((state) => state.panDirectionalEdgethreshold);
    const panDirectionalAxis = useStore((state) => state.panDirectionalAxis);

    const updateCallNow = useRef(false);
    const cam = useRef();
    const controls = useRef();
    const current_path = useRef("StartingPoint");
    const current_point = useRef(new THREE.Vector3( 15, 1, 0 ));
    const current_lookat = useRef(new THREE.Vector3(0, 3, 2));
    const isMouseNearEdge = useRef(false);

    const simpleLookatMode = true; // eslint-disable-line no-unused-vars
    const desired_point = path_points[current_path.current + "-" + desired_path];
    const keyboardControlsSpeed = 0.4;
    const gravitationalPullPoint = path_points[current_path.current + "-" + current_path.current] == null ? path_points["MainMenu-MainMenu"].points[0] : path_points[current_path.current + "-" + current_path.current].points[0]; // the point to return to
    const pullStrength = 0.03; // How strongly the camera is pulled towards the point, between 0 and 1
    const pullInterval = 10; // How often the pull is applied in milliseconds
    
    let pathPointsLookat;
    let smooth;
    let sub_points;
    let tick = current_path.current !== desired_path ? 0:1

    let concat_paths;    

    // Change camera mode
    const [cameraMode, setCameraMode] = useState(null);
    useEffect(()=>{
        if(currentCameraMode === "NormalMovement"){
            setCameraMode({ RIGHT: THREE.MOUSE.RIGHT, LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE })
        }
        else
        if(currentCameraMode === "panOnly"){
            setCameraMode({ LEFT: THREE.MOUSE.RIGHT})
        }
        else
        if(currentCameraMode === "rotateOnly"){
            setCameraMode({ LEFT: THREE.MOUSE.LEFT})
        }
        else
        if(currentCameraMode === "zoomOnly"){
            setCameraMode({ MIDDLE: THREE.MOUSE.MIDDLE})
        }
        else
        if (currentCameraMode === "panDirectional" && transitionEnded) {
            // these variables and the if else statements determine whether to increment or decrement the two axies by the camera event's output by multiplying it by 1 or -1
            let horizontalPanSign;
            let verticalPanSign;

            if (panDirectionalAxis[0].charAt(0) === '+') {
                horizontalPanSign = 1;
            } 
            else {
                horizontalPanSign = -1;
            }

            if (panDirectionalAxis[1].charAt(0) === '-') {
                verticalPanSign = 1;
            } 
            else {
                verticalPanSign = -1;
            }

            const handleMouseMove = (event) => {
                const { innerWidth, innerHeight } = window; // Get the viewport dimensions

                // Check if the mouse is near the left or right edge of the screen
                if (event.clientX < panDirectionalEdgethreshold || event.clientX > innerWidth - panDirectionalEdgethreshold) {
                    const deltaX = event.movementX;

                    // Apply the delta movement to pan the camera horizontally
                    switch(panDirectionalAxis[0].charAt(1)){
                        case 'x':
                            cam.current.position.x += (deltaX * 0.01) * horizontalPanSign;
                            controls.current.target.x += (deltaX * 0.01)* horizontalPanSign;
                            break;
                        case 'y':
                            cam.current.position.y += (deltaX * 0.01)* horizontalPanSign;
                            controls.current.target.y += (deltaX * 0.01)* horizontalPanSign;
                            break;
                        case 'z':
                            cam.current.position.z -= (deltaX * 0.01)* horizontalPanSign;
                            controls.current.target.z -= (deltaX * 0.01)* horizontalPanSign;
                            break;
                        default:
                            console.log("Invalid axis input! Expected either 'x', 'y' or 'z'")

                    }
                    
                }

                // Check if the mouse is near the top or bottom edge of the screen
                if (event.clientY < panDirectionalEdgethreshold || event.clientY > innerHeight - panDirectionalEdgethreshold) {
                    const deltaY = event.movementY;

                    // Apply the delta movement to pan the camera vertically
                    switch(panDirectionalAxis[1].charAt(1)){
                        case 'x':
                            cam.current.position.x += (deltaY * 0.01)* verticalPanSign;
                            controls.current.target.x += (deltaY * 0.01)* verticalPanSign;
                            break;
                        case 'y':
                            cam.current.position.y += (deltaY * 0.01)* verticalPanSign;
                            controls.current.target.y += (deltaY * 0.01)* verticalPanSign;
                            break;
                        case 'z':
                            cam.current.position.z += (deltaY * 0.01)* verticalPanSign;
                            controls.current.target.z += (deltaY * 0.01)* verticalPanSign;
                            break;
                        default:
                            console.log("Invalid axis input! Expected either 'x', 'y' or 'z'")
                    }
                }
            };

            // Add the event listener for mousemove
            window.addEventListener('mousemove', handleMouseMove);
        
            // Clean up the event listener when the component unmounts or when the camera mode changes
            return () => window.removeEventListener('mousemove', handleMouseMove);
        }
    }, [panDirectionalEdgethreshold, currentCameraMode, transitionEnded]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handleMouseMove = (event) => {
        const { innerWidth, innerHeight } = window;

        // Determine if the mouse is near the edge of the screen
        isMouseNearEdge.current =
            event.clientX < panDirectionalEdgethreshold || event.clientX > innerWidth - panDirectionalEdgethreshold ||
            event.clientY < panDirectionalEdgethreshold || event.clientY > innerHeight - panDirectionalEdgethreshold;
        };

        // Add the event listener for mousemove
        window.addEventListener('mousemove', handleMouseMove);

        // Clean up the event listener when the component unmounts
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [panDirectionalEdgethreshold]);

    useEffect(() => {
        if (currentCameraMode === "panDirectional" && transitionEnded) {
            const intervalId = setInterval(() => {
                if (!isMouseNearEdge.current && cam.current) {
                    const direction = gravitationalPullPoint.clone().sub(cam.current.position).normalize();
                    const distance = cam.current.position.distanceTo(gravitationalPullPoint);

                    // Apply a scaled vector towards the gravitational point
                    cam.current.position.addScaledVector(direction, Math.min(pullStrength * distance, distance));

                    if (controls.current) {
                        controls.current.target.addScaledVector(direction, Math.min(pullStrength * distance, distance));
                    }
                }
            }, pullInterval);

            // Clean up the interval when the component unmounts
            return () => clearInterval(intervalId);
        }
    }, [currentCameraMode, transitionEnded]); // eslint-disable-line react-hooks/exhaustive-deps

    // if no custom lookat path, look directly into the destination until transition ends
    if(path_points_lookat_dict[current_path.current + "-" + desired_path] !== undefined){
        pathPointsLookat = path_points_lookat_dict;
        concat_paths = current_path.current + "-" + desired_path;
    }else{
        pathPointsLookat = path_points_simple_lookat_dict;
        concat_paths = desired_path;
    }

    // control target is the last element of path_points_lookat_dict
    const constrolTargetX = pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].x;
    const constrolTargetY = pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].y;
    const constrolTargetZ = pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].z;

    // used in custom camera lookat
    const desired_lookat_dict = (time) => { // eslint-disable-line no-unused-vars
        let nextLookat;
        Object.keys(pathPointsLookat[concat_paths]).forEach((time_key) => time >= time_key ? nextLookat = pathPointsLookat[concat_paths][time_key] : console.log());
        return nextLookat;
    };

    // Sets values after the camera movement is done 
    function updateCall(state){
        if(updateCallNow.current){
            setTransitionEnded(true);
            updateCallNow.current = false;
            current_path.current = desired_path;
            controls.current.enabled = true;
            state.events.enabled = true;

        }
    }

    // A function to smooth out the camera movement
    function smoothStep(x) {
        let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
        if(x >= 1){
            Sn = 1;
        }
        return Sn;
    }

    // Set the transition speed if specified in PathPoints.jsx
    function setCustomSpeed(currentTick, path_speeds){
        var tickKey = Number(currentTick.toPrecision(13));
        var currentKey = Object.keys(path_speeds).find(key => key >= tickKey);
        // if currentKey on last element of path_speeds, default to last element
        if(currentKey === undefined){
            currentKey = Object.keys(path_speeds).pop();
        }

        return path_speeds[currentKey];
    }

    // Moves the camera every frame when the desired path changes
    useFrame((state) => (tick <= 1 ? (
        updateCallNow.current = true,
        state.events.enabled = false,
        controls.current.enabled = false,
        tick += path_points_speed[current_path.current + "-" + desired_path] !== undefined ? setCustomSpeed(tick, path_points_speed[current_path.current + "-" + desired_path]) : 0.005,
        smooth = smoothStep(tick),

        sub_points = current_point.current = desired_point.getPointAt(smooth),
        
        current_lookat.current.lerp(setCustomSpeed(smooth, pathPointsLookat[concat_paths]), 0.03),
        state.camera.lookAt(current_lookat.current),

        state.camera.position.x = sub_points.x,
        state.camera.position.y = sub_points.y,
        state.camera.position.z = sub_points.z)
        : (updateCall(state))
    ));

    // orbitcontrols keyboard control is not working, that's a workaround
    useEffect(()=>{
        window.addEventListener("keydown", (event) => {
            // eslint-disable-next-line default-case
            switch(event.code) {
                case "KeyP":
                console.log([Math.floor(cam.current.position.x), Math.floor(cam.current.position.y), Math.floor(cam.current.position.z)]);
                break;
                case "KeyW":
                cam.current.position.x += -keyboardControlsSpeed;
                controls.current.target.x += -keyboardControlsSpeed;
                break;
                case "KeyA":
                    cam.current.position.z += keyboardControlsSpeed;
                    controls.current.target.z += keyboardControlsSpeed;
                break;
                case "KeyS":
                    cam.current.position.x += keyboardControlsSpeed;
                    controls.current.target.x += keyboardControlsSpeed;
                break;
                case "KeyD":
                    cam.current.position.z += -keyboardControlsSpeed;
                    controls.current.target.z += -keyboardControlsSpeed;
                break;
                case "KeyQ":
                    cam.current.position.y += keyboardControlsSpeed;
                    controls.current.target.y += keyboardControlsSpeed;
                    cam.current.position.z += keyboardControlsSpeed;
                    controls.current.target.z += keyboardControlsSpeed;
                break;
                case "KeyE":
                    cam.current.position.y += keyboardControlsSpeed;
                    controls.current.target.y += keyboardControlsSpeed;
                    cam.current.position.z += -keyboardControlsSpeed;
                    controls.current.target.z += -keyboardControlsSpeed;
                break;
                case "KeyC":
                    cam.current.position.y += -keyboardControlsSpeed;
                    controls.current.target.y += -keyboardControlsSpeed;
                    cam.current.position.z += -keyboardControlsSpeed;
                    controls.current.target.z += -keyboardControlsSpeed;
                break;
                case "KeyZ":
                    cam.current.position.y += -keyboardControlsSpeed;
                    controls.current.target.y += -keyboardControlsSpeed;
                    cam.current.position.z += keyboardControlsSpeed;
                    controls.current.target.z += keyboardControlsSpeed;
                break;
                case "KeyR":
                    cam.current.position.y += keyboardControlsSpeed;
                    controls.current.target.y += keyboardControlsSpeed;
                break;
                case "KeyF":
                    cam.current.position.y += -keyboardControlsSpeed;
                    controls.current.target.y += -keyboardControlsSpeed;
                break;
            }
        });
    });

    return(
        <>
            <PerspectiveCamera ref = {cam} makeDefault fov = {75}>
            {/* <HtmlDreiMenu {...{useStore}}></HtmlDreiMenu> */}
            </PerspectiveCamera>
            <OrbitControls mouseButtons={cameraMode} enableZoom = {currentCameraMovements["zoom"]}  enablePan = {currentCameraMovements["pan"]} enableRotate = {currentCameraMovements["rotate"]} ref = {controls} target = {/*currentCameraMode === "panDirectional"?null:*/[constrolTargetX, constrolTargetY, constrolTargetZ]} />
        </>
    )
})