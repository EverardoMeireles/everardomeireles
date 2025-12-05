import { useFrame, useThree } from '@react-three/fiber';
import { path_points_simple_lookat_dict, path_points_lookat_dict, path_points_speed, CreateNavigationCurve, firstPoint} from "../PathPoints.jsx";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera, calcPosFromAngles } from "@react-three/drei";
import React, { useRef, useEffect, useState } from "react";
import { HtmlDreiMenu } from "./HtmlDreiMenu"; // eslint-disable-line no-unused-vars
import { smoothStep, roundToDecimalPlace, hasSignificantChange, createArchCurve, isCurveDegenerate } from "../Helper";
import useSystemStore from "../SystemStore";

// revisit custom camera lookat mode and simpleLookatMode
export const Camera = React.memo((props) => {
    const {transitionSpeed = 0.5} = props;
    const {position = [0, 0, 0]} = props;

    const setTransitionEnded = useSystemStore((state) => state.setTransitionEnded);
    const transitionEnded = useSystemStore((state) => state.transitionEnded);
    const currentCameraMovements = useSystemStore((state) => state.currentCameraMovements);
    const setcurrentCameraMovements = useSystemStore((state) => state.setcurrentCameraMovements);
    const currentCameraMode = useSystemStore((state) => state.currentCameraMode);
    const panDirectionalEdgethreshold = useSystemStore((state) => state.panDirectionalEdgethreshold);
    const panDirectionalAxis = useSystemStore((state) => state.panDirectionalAxis);
    const setTrigger = useSystemStore((state) => state.setTrigger);
    const setCameraState = useSystemStore((state) => state.setCameraState);
    const cameraStateTracking = useSystemStore((state) => state.cameraStateTracking);
    const forcedCameraTarget = useSystemStore((state) => state.forcedCameraTarget);
    const forcedCameraMovePathCurve = useSystemStore((state) => state.forcedCameraMovePathCurve);
    const forcedCameraPosition = useSystemStore((state) => state.forcedCameraPosition);
    const triggers = useSystemStore((state) => state.triggers);

    const didMount = useRef(false);

    const updateCallNow = useRef(false);
    const cam = useRef(undefined);
    const { camera, events } = useThree();
    
    const controls = useRef();
    // const current_path = useRef("StartingPoint");
    const current_lookat = useRef(new THREE.Vector3(0,0,0))

    const isMouseNearEdge = useRef(false);
    
    const keyboardControlsSpeed = 0.4;

    const gravitationalPullPoint = forcedCameraMovePathCurve?.points[forcedCameraMovePathCurve.points.length - 1] ?? new THREE.Vector3(0,0,0) // the point to return to in panDirectional mode
    const pullStrength = 0.03; // How strongly the camera is pulled towards the point, between 0 and 1
    const pullInterval = 10; // How often the pull is applied in milliseconds

    const nullCurve = new THREE.CatmullRomCurve3([        
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)])

    const curve = useRef(nullCurve);

    let smoothStepTick;
    let sub_points;
    let tick = useRef(1)

    // Change camera mode
    const [cameraMode, setCameraMode] = useState({LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT});
    useEffect(()=>{
        if(currentCameraMode === "NormalMovement" && transitionEnded){
            setcurrentCameraMovements({"zoom":true, "pan":true, "rotate":true});
            setCameraMode({ RIGHT: THREE.MOUSE.RIGHT, LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE });
        }
        else
        if(currentCameraMode === "panOnly" && transitionEnded){
            setcurrentCameraMovements({"zoom":false, "pan":true, "rotate":false});
            setCameraMode({ LEFT: THREE.MOUSE.RIGHT});
        }
        else
        if(currentCameraMode === "rotateOnly" && transitionEnded){
            setcurrentCameraMovements({"zoom":false, "pan":false, "rotate":true});
            setCameraMode({ LEFT: THREE.MOUSE.LEFT});
        }
        else
        if(currentCameraMode === "zoomOnly" && transitionEnded){
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
    }, [panDirectionalEdgethreshold, currentCameraMode, transitionEnded]);

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
    }, [currentCameraMode, transitionEnded]);

    // Set the transition speed if a if a tick, speed value pair is provided
    // function setCustomSpeed(currentTick, path_speeds){
    //     var tickKey = Number(currentTick.toPrecision(13));
    //     var currentKey = Object.keys(path_speeds).find(key => key >= tickKey);
    //     // if currentKey on last element of path_speeds, default to last element
    //     if(currentKey === undefined){
    //         currentKey = Object.keys(path_speeds).pop();
    //     }

    //     return path_speeds[currentKey];
    // }

    // if the target is forced
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }

        if(forcedCameraTarget != [])
        {
            controls.current.target.x = forcedCameraTarget[0]
            controls.current.target.y = forcedCameraTarget[1]
            controls.current.target.z = forcedCameraTarget[2]
        }

    }, [forcedCameraTarget]);

    // if the camera path is forced, reset the animation tick
    // useEffect(() => {
    //     if (!didMount.current) {
    //         didMount.current = true;
    //         return;
    //     }
    // }, [forcedCameraTarget]);

    // if the camera path is forced, reset the animation tick
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }

        // Only starts a transition on valid curves
        if(!isCurveDegenerate(forcedCameraMovePathCurve)){
            curve.current = forcedCameraMovePathCurve;
            tick.current = 0;
        }
    }, [forcedCameraMovePathCurve]);

    // Moves the camera every frame when the desired path changes
    useFrame((state, delta) => (tick.current < 1 ? (
        updateCallNow.current = true,
        state.events.enabled = false,
        controls.current.enabled = false,
        
        tick.current += transitionSpeed * delta,

        // Smooth out the movement
        smoothStepTick = smoothStep(tick.current),

        // Determines the next point for the camera to look at
        current_lookat.current.lerp(new THREE.Vector3(forcedCameraTarget[0], forcedCameraTarget[1], forcedCameraTarget[2]), 0.03),

        state.camera.lookAt(current_lookat.current),
        // Updates the orbitcontrol's target
        controls.current.target.x = current_lookat.current.x,
        controls.current.target.y = current_lookat.current.y,
        controls.current.target.z = current_lookat.current.z,

        // Get the current point along the curve
        sub_points = curve.current.getPointAt(smoothStepTick), 
        // Updates the camera's position
        state.camera.position.x = sub_points.x,
        state.camera.position.y = sub_points.y,
        state.camera.position.z = sub_points.z
    ) : (updateCall(state))
    ));

    // Sets values after the camera movement is done 
    function updateCall(state){
        if(updateCallNow.current){
            // If fps is too low, the camera's target might not end up where it should after transition, force it.
            if(controls.current.target.toArray() != forcedCameraTarget){
                controls.current.target = new THREE.Vector3(forcedCameraTarget[0], forcedCameraTarget[1], forcedCameraTarget[2]);
                state.camera.lookAt(forcedCameraTarget)
            }
            setTransitionEnded(true);
            updateCallNow.current = false;
            controls.current.enabled = true;
            state.events.enabled = true;
        }
    }

//useFrame((state,delta)=>{
    // console.log(controls)
    // console.log(cameraMode)
//})

// Function to compare arrays of Vector3
function compareCurves(curve1, curve2) {
    if (curve1.points.length !== curve2.points.length) {
        return false;
    }
    
    for (let i = 0; i < curve1.points.length; i++) {
        if (!curve1.points[i].equals(curve2.points[i])) {
            return false;
        }
    }
    return true;
}

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
            setCameraState(//error while holding any key after a full renrender(by modifying this comment for example)
                [cam.current.position.x, cam.current.position.y, cam.current.position.z],
                [cam.current.rotation.x, cam.current.rotation.y, cam.current.rotation.z]
            );
        });
    });

    // Update camera state
    useEffect(() => {
        if (!cameraStateTracking) return;

        let animationFrameId;
        let previousPosition = new THREE.Vector3();
        let previousRotation = new THREE.Euler();

        const handleFrame = () => {
            if (!cam.current) {
                animationFrameId = requestAnimationFrame(handleFrame);
                return;
            }

            const currentPosition = cam.current.position;
            const currentRotation = cam.current.rotation;
            const positionChanged =
                hasSignificantChange(previousPosition.x, currentPosition.x) ||
                hasSignificantChange(previousPosition.y, currentPosition.y) ||
                hasSignificantChange(previousPosition.z, currentPosition.z);

            const rotationChanged =
                hasSignificantChange(previousRotation.x, currentRotation.x) ||
                hasSignificantChange(previousRotation.y, currentRotation.y) ||
                hasSignificantChange(previousRotation.z, currentRotation.z);

            if (positionChanged || rotationChanged) {
                setCameraState(
                    [
                        roundToDecimalPlace(currentPosition.x, 1),
                        roundToDecimalPlace(currentPosition.y, 1),
                        roundToDecimalPlace(currentPosition.z, 1),
                    ],
                    [
                        roundToDecimalPlace(currentRotation.x, 1),
                        roundToDecimalPlace(currentRotation.y, 1),
                        roundToDecimalPlace(currentRotation.z, 1),
                    ]
                );

                previousPosition.copy(currentPosition);
                previousRotation.copy(currentRotation);
            }

            animationFrameId = requestAnimationFrame(handleFrame);
        };

        handleFrame();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [setCameraState, cameraStateTracking]);

    ////////////////////////////////////////////////////////////
    /// Force camera position if zustand state changes value ///
    ////////////////////////////////////////////////////////////

    useEffect(() => {
        if(forcedCameraPosition){
            cam.current.position.x = forcedCameraPosition[0];
            cam.current.position.y = forcedCameraPosition[1];
            cam.current.position.z = forcedCameraPosition[2];
        }
    }, [forcedCameraPosition]);
    
    return(
        <>
            <PerspectiveCamera makeDefault ref = {cam} position = {position} fov = {75}>
            </PerspectiveCamera>
            <OrbitControls makeDefault mouseButtons={cameraMode} target={forcedCameraTarget} enableZoom = {currentCameraMovements["zoom"]}  enablePan = {currentCameraMovements["pan"]} enableRotate = {currentCameraMovements["rotate"]} ref = {controls} />
        </>
    )
});

Camera.displayName = "Camera";
