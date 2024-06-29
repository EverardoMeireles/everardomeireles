import { useFrame } from '@react-three/fiber';
import { path_points, path_points_simple_lookat_dict, path_points_lookat_dict, path_points_speed, getCurve, firstPoint } from "../PathPoints";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera, calcPosFromAngles } from "@react-three/drei";
import React, { useRef, useEffect, useState } from "react";
import { HtmlDreiMenu } from "./HtmlDreiMenu"; // eslint-disable-line no-unused-vars
import { smoothStep } from "../Helper";

// revisit custom camera lookat mode and simpleLookatMode
export const Camera = React.memo((props) => {
    const useStore = props.useStore;
    const desired_path = useStore((state) => state.desired_path);
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);
    const currentCameraMovements = useStore((state) => state.currentCameraMovements);
    const setcurrentCameraMovements = useStore((state) => state.setcurrentCameraMovements);
    const currentCameraMode = useStore((state) => state.currentCameraMode);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const panDirectionalEdgethreshold = useStore((state) => state.panDirectionalEdgethreshold);
    const panDirectionalAxis = useStore((state) => state.panDirectionalAxis);
    const setTrigger = useStore((state) => state.setTrigger);
    const setCameraState = useStore((state) => state.setCameraState);
    const cameraStateTracking = useStore((state) => state.cameraStateTracking);
    const forcedCameraTarget = useStore((state) => state.forcedCameraTarget);

    const updateCallNow = useRef(false);
    const cam = useRef();
    const controls = useRef();
    const current_path = useRef("StartingPoint");
    const current_point = useRef(new THREE.Vector3( 15, 1, 0 ));
    const current_lookat = useRef(new THREE.Vector3(0, 3, 2));
    const isMouseNearEdge = useRef(false);

    const curve = getCurve(current_path.current, desired_path);
    const keyboardControlsSpeed = 0.4;
    const currentPoint = getCurve(current_path.current, current_path.current).points[0];
    const gravitationalPullPoint = currentPoint == null ? firstPoint : currentPoint;/*getCurve(current_path.current, current_path.current) == null ? firstPoint : getCurve(current_path.current, current_path.current);*/ // the point to return to in panDirectional mode
    const pullStrength = 0.03; // How strongly the camera is pulled towards the point, between 0 and 1
    const pullInterval = 10; // How often the pull is applied in milliseconds

    let pathPointsLookat;
    let smooth;
    let sub_points;
    let tick = current_path.current !== desired_path ? 0:1
    let deltaArray = new Array();
    let deltaAverage = 0;
    let baseTransitioSpeed = 0.005;
    let transitionIncrement;
    let concat_paths;    

    // Change camera mode
    const [cameraMode, setCameraMode] = useState(null);
    useEffect(()=>{
        // console.log(currentCameraMode)
        if(currentCameraMode === "NormalMovement"){
            setcurrentCameraMovements({"zoom":true, "pan":true, "rotate":true});
            setCameraMode({ RIGHT: THREE.MOUSE.RIGHT, LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE });
        }
        else
        if(currentCameraMode === "panOnly"){
            setcurrentCameraMovements({"zoom":false, "pan":true, "rotate":false});
            setCameraMode({ LEFT: THREE.MOUSE.RIGHT});
        }
        else
        if(currentCameraMode === "rotateOnly"){
            setcurrentCameraMovements({"zoom":false, "pan":false, "rotate":true});
            setCameraMode({ LEFT: THREE.MOUSE.LEFT});
        }
        else
        if(currentCameraMode === "zoomOnly"){
            setcurrentCameraMovements({"zoom":true, "pan":false, "rotate":false});
            setCameraMode({ MIDDLE: THREE.MOUSE.MIDDLE});
        }
        else
        if (currentCameraMode === "panDirectional" && transitionEnded) {
            setcurrentCameraMovements({"zoom":false, "pan":true, "rotate":false});
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
                            console.error("Invalid axis input! Expected either 'x', 'y' or 'z'");

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
                            console.error("Invalid axis input! Expected either 'x', 'y' or 'z'");
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
    const constrolTargetX = forcedCameraTarget[0] == undefined ? pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].x : forcedCameraTarget[0];
    const constrolTargetY = forcedCameraTarget[1] == undefined ? pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].y : forcedCameraTarget[1];
    const constrolTargetZ = forcedCameraTarget[2] == undefined ? pathPointsLookat[concat_paths][Object.keys(pathPointsLookat[concat_paths]).pop()].z : forcedCameraTarget[2];

    // used in custom camera lookat
    const desired_lookat_dict = (time) => { // eslint-disable-line no-unused-vars
        let nextLookat;
        Object.keys(pathPointsLookat[concat_paths]).forEach((time_key) => time >= time_key ? nextLookat = pathPointsLookat[concat_paths][time_key] : undefined);
        return nextLookat;
    };

    // Sets values after the camera movement is done 
    function updateCall(state){
        if(updateCallNow.current){
            //setTrigger(true);
            setTransitionEnded(true);
            updateCallNow.current = false;
            current_path.current = desired_path;
            controls.current.enabled = true;
            state.events.enabled = true;

        }
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

    function calculateDeltaAverage(delta){
        deltaArray.push(delta)
        const sum = deltaArray.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        return sum / deltaArray.length;
    }

    // Moves the camera every frame when the desired path changes
    useFrame((state, delta) => (tick <= 1 ? (
        deltaAverage = deltaArray[10] == undefined ? calculateDeltaAverage(delta) : deltaAverage,
        updateCallNow.current = true,
        state.events.enabled = false,
        controls.current.enabled = false,
        transitionIncrement = (path_points_speed[current_path.current + "-" + desired_path] !== undefined ? setCustomSpeed(tick, path_points_speed[current_path.current + "-" + desired_path]) : 0.35) * deltaAverage, // Determines the speed of the transition
        tick +=  transitionIncrement,
        smooth = smoothStep(tick), // Smooth the movement

        sub_points = current_point.current = curve.getPointAt(smooth), // Get the current point along the curve
        
        current_lookat.current.lerp(setCustomSpeed(smooth, pathPointsLookat[concat_paths]), 0.03), // Get the point for the camera to look at
        state.camera.lookAt(current_lookat.current), // Look at the point

        // Updates the camera's position
        state.camera.position.x = sub_points.x,
        state.camera.position.y = sub_points.y,
        state.camera.position.z = sub_points.z
    ) : (updateCall(state))
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
            setCameraState(
                [cam.current.position.x, cam.current.position.y, cam.current.position.z],
                [cam.current.rotation.x, cam.current.rotation.y, cam.current.rotation.z]
            );
        });
    });

    useEffect(() => {
        if (!cameraStateTracking) return;

        let animationFrameId;
        let previousPosition = new THREE.Vector3();
        let previousRotation = new THREE.Euler();

        const handleFrame = () => {
            const currentPosition = cam.current.position;
            const currentRotation = cam.current.rotation;

            if (!currentPosition.equals(previousPosition) || !currentRotation.equals(previousRotation)) {
                setCameraState(
                    [currentPosition.x, currentPosition.y, currentPosition.z],
                    [currentRotation.x, currentRotation.y, currentRotation.z]
                );
                previousPosition.copy(currentPosition);
                previousRotation.copy(currentRotation);
            }

            animationFrameId = requestAnimationFrame(handleFrame);
        };

        handleFrame(); // Initial call

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [setCameraState, cameraStateTracking]);

    return(
        <>
            <PerspectiveCamera ref = {cam} makeDefault fov = {75}>
            {/* <HtmlDreiMenu {...{useStore}}></HtmlDreiMenu> */}
            </PerspectiveCamera>
            <OrbitControls mouseButtons={cameraMode} enableZoom = {currentCameraMovements["zoom"]}  enablePan = {currentCameraMovements["pan"]} enableRotate = {currentCameraMovements["rotate"]} ref = {controls} target = {/*currentCameraMode === "panDirectional"?null:*/[constrolTargetX, constrolTargetY, constrolTargetZ]} />
        </>
    )
});