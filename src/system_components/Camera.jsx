import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import React, { useRef, useEffect, useState } from "react";
import { smoothStep, roundToDecimalPlace, hasSignificantChange, isCurveDegenerate, setNamedTrigger } from "../Helper";
import SystemStore from "../SystemStore";

/**
 * Purpose: OrbitControls camera that moves along a prop-provided CatmullRom curve.
 * Relationships: Can still fall back to SystemStore's forced camera values for legacy HudMenu and ExplodingModelLoader flows.
 * Example:
 * <Camera transitionSpeed={0.5} position={[0, 0, 0]} cameraMovePathCurve={curve} cameraTarget={[0, 0, 0]} cameraPosition={[0, 5, 10]} triggerOutCameraTransitionStarted="cameraStarted" triggerOutCameraTransitionEnded="cameraEnded" />
 * @param {number} [transitionSpeed] - Speed value for transition speed.
 * @param {Array<any>} [position] - Position in the scene.
 * @param {*} [cameraMovePathCurve] - Curve that starts a camera transition when changed.
 * @param {Array<any> | THREE.Vector3} [cameraTarget] - Camera look-at and orbit target.
 * @param {Array<any> | THREE.Vector3} [cameraPosition] - Forced camera position.
 * @param {string} [triggerOutCameraTransitionStarted] - Trigger key set when this behavior starts.
 * @param {string} [triggerOutCameraTransitionEnded] - Trigger key set when this behavior finishes.
 */
export const Camera = React.memo((props) => {
    const {transitionSpeed = 0.5} = props;

    // Example: [0, 0, 0]
    const {position = [0, 0, 0]} = props;

    // Example: new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 5)])
    const {cameraMovePathCurve = undefined} = props;

    // Example: [0, 0, 0]
    const {cameraTarget = undefined} = props;

    // Example: [0, 5, 10]
    const {cameraPosition = undefined} = props;

    // Example: "cameraStarted"
    const {triggerOutCameraTransitionStarted = ""} = props;

    // Example: "cameraEnded"
    const {triggerOutCameraTransitionEnded = ""} = props;

    const setIsCameraMoving = SystemStore((state) => state.setIsCameraMoving);
    const isCameraMoving = SystemStore((state) => state.isCameraMoving);
    const currentCameraMovements = SystemStore((state) => state.currentCameraMovements);
    const setcurrentCameraMovements = SystemStore((state) => state.setcurrentCameraMovements);
    const forceDisableZoom = SystemStore((state) => state.forceDisableZoom);
    const currentCameraMode = SystemStore((state) => state.currentCameraMode);
    const panDirectionalEdgethreshold = SystemStore((state) => state.panDirectionalEdgethreshold);
    const panDirectionalAxis = SystemStore((state) => state.panDirectionalAxis);
    const setTrigger = SystemStore((state) => state.setTrigger);
    const setCameraState = SystemStore((state) => state.setCameraState);
    const cameraStateTracking = SystemStore((state) => state.cameraStateTracking);
    const storeCameraTarget = SystemStore((state) => state.forcedCameraTarget);
    const storeCameraMovePathCurve = SystemStore((state) => state.forcedCameraMovePathCurve);
    const storeCameraPosition = SystemStore((state) => state.forcedCameraPosition);

    const activeCameraTarget = cameraTarget ?? storeCameraTarget;
    const activeCameraMovePathCurve = cameraMovePathCurve ?? storeCameraMovePathCurve;
    const activeCameraPosition = cameraPosition ?? storeCameraPosition;

    const cam = useRef(undefined);
    
    const controls = useRef();
    const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const targetRef = useRef(new THREE.Vector3(0, 0, 0));
    const transitionCurveRef = useRef();
    const transitionProgressRef = useRef(1);
    const transitionInProgressRef = useRef(false);
    const previousTransitionCurveKeyRef = useRef("");

    const isMouseNearEdge = useRef(false);
    
    const keyboardControlsSpeed = 0.4;

    const gravitationalPullPoint = activeCameraMovePathCurve?.points?.[activeCameraMovePathCurve.points.length - 1] ?? new THREE.Vector3(0,0,0) // the point to return to in panDirectional mode
    const pullStrength = 0.03; // How strongly the camera is pulled towards the point, between 0 and 1
    const pullInterval = 10; // How often the pull is applied in milliseconds

    // Initialize output triggers to false so parent listeners can detect future true edges.
    useEffect(() => {
        setNamedTrigger(setTrigger, triggerOutCameraTransitionStarted, false);
        setNamedTrigger(setTrigger, triggerOutCameraTransitionEnded, false);
    }, [setTrigger, triggerOutCameraTransitionStarted, triggerOutCameraTransitionEnded]);

    // Convert supported position inputs to Vector3.
    function toVector3(value) {
        if (value?.isVector3) {
            return value.clone();
        }

        if (Array.isArray(value) && value.length >= 3 && Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2]))
            {
                return new THREE.Vector3(value[0], value[1], value[2]);
            }

        return undefined;
    }

    // Check whether a curve can drive a transition.
    function hasUsableCurve(value) {
        if (!value || typeof value.getPointAt !== "function") {
            return false;
        }

        if (!Array.isArray(value.points) || value.points.length < 2) {
            return false;
        }

        return (
            value.points.every((point) => (point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)))
            &&
            !isCurveDegenerate(value)
        );
    }

    // Build a stable key for repeated curve values.
    function getCurveKey(value) {
        if (!Array.isArray(value?.points)) {
            return "";
        }

        return value.points.map((point) => `${point.x},${point.y},${point.z}`).join("|");
    }

    // Publish transition started and ended states.
    function setTransitionTriggers(started, ended) {
        setNamedTrigger(setTrigger, triggerOutCameraTransitionStarted, started);
        setNamedTrigger(setTrigger, triggerOutCameraTransitionEnded, ended);
    }

    // Complete the active curve transition.
    function finishTransition(state) {
        transitionInProgressRef.current = false;
        transitionProgressRef.current = 1;
        setIsCameraMoving(false);
        setTransitionTriggers(false, true);

        if (controls.current) {
            currentLookAtRef.current.copy(targetRef.current);
            controls.current.target.copy(targetRef.current);
            controls.current.enabled = true;
        }

        if (state?.camera) {
            state.camera.lookAt(targetRef.current);
        }

        if (state?.events) {
            state.events.enabled = true;
        }
    }

    // Start a new prop or store-driven curve transition.
    function startTransition(nextCurve) {
        transitionCurveRef.current = nextCurve;
        transitionProgressRef.current = 0;
        transitionInProgressRef.current = true;
        setIsCameraMoving(true);
        setTransitionTriggers(true, false);
    }

    // Change camera mode
    const [cameraMode, setCameraMode] = useState({LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT});
    useEffect(()=>{
        if(currentCameraMode === "NormalMovement" && !isCameraMoving){
            setcurrentCameraMovements({"zoom":true, "pan":true, "rotate":true});
            setCameraMode({ RIGHT: THREE.MOUSE.RIGHT, LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE });
        }
        else
        if(currentCameraMode === "panOnly" && !isCameraMoving){
            setcurrentCameraMovements({"zoom":false, "pan":true, "rotate":false});
            setCameraMode({ LEFT: THREE.MOUSE.RIGHT});
        }
        else
        if(currentCameraMode === "rotateOnly" && !isCameraMoving){
            setcurrentCameraMovements({"zoom":false, "pan":false, "rotate":true});
            setCameraMode({ LEFT: THREE.MOUSE.LEFT});
        }
        else
        if(currentCameraMode === "zoomOnly" && !isCameraMoving){
            setcurrentCameraMovements({"zoom":true, "pan":false, "rotate":false});
            setCameraMode({ MIDDLE: THREE.MOUSE.MIDDLE});
        }
        else
        if (currentCameraMode === "panDirectional" && !isCameraMoving) {
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
                if (!cam.current || !controls.current) return;
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
    }, [panDirectionalEdgethreshold, currentCameraMode, isCameraMoving]);

    useEffect(() => {
        const handleMouseMove = (event) => {
        const { innerWidth, innerHeight } = window;

        // Determine if the mouse is near the edge of the screen
        isMouseNearEdge.current =
            event.clientX < panDirectionalEdgethreshold || event.clientX > innerWidth - panDirectionalEdgethreshold 
            ||
            event.clientY < panDirectionalEdgethreshold || event.clientY > innerHeight - panDirectionalEdgethreshold;
        };

        // Add the event listener for mousemove
        window.addEventListener('mousemove', handleMouseMove);

        // Clean up the event listener when the component unmounts
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [panDirectionalEdgethreshold]);

    useEffect(() => {
        if (currentCameraMode === "panDirectional" && !isCameraMoving) {
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
    }, [currentCameraMode, isCameraMoving]);

    // Keep the latest camera target available.
    useEffect(() => {
        const nextTarget = toVector3(activeCameraTarget);

        if (!nextTarget) {
            return;
        }

        targetRef.current.copy(nextTarget);

        if (!transitionInProgressRef.current && controls.current) {
            currentLookAtRef.current.copy(controls.current.target);
            controls.current.target.copy(nextTarget);
        }
    }, [activeCameraTarget]);

    // Start transitions when the curve changes.
    useEffect(() => {
        if (!hasUsableCurve(activeCameraMovePathCurve)) {
            return;
        }

        const curveKey = getCurveKey(activeCameraMovePathCurve);
        if (curveKey === previousTransitionCurveKeyRef.current) {
            return;
        }

        previousTransitionCurveKeyRef.current = curveKey;
        startTransition(activeCameraMovePathCurve);
    }, [activeCameraMovePathCurve]);

    // Move along the active transition curve.
    useFrame((state, delta) => {
        if (!transitionInProgressRef.current) {
            return;
        }

        const activeCurve = transitionCurveRef.current;
        if (!hasUsableCurve(activeCurve)) {
            finishTransition(state);
            return;
        }

        state.events.enabled = false;

        if (!controls.current) {
            return;
        }

        controls.current.enabled = false;
        transitionProgressRef.current = Math.min(
            1,
            transitionProgressRef.current + transitionSpeed * delta
        );

        const smoothProgress = smoothStep(transitionProgressRef.current);
        let curvePoint;

        try {
            curvePoint = activeCurve.getPointAt(Math.min(Math.max(smoothProgress, 0), 0.99999));
        } catch {
            finishTransition(state);
            return;
        }

        if (curvePoint) {
            state.camera.position.copy(curvePoint);
        }

        // Ease orbit target toward destination.
        currentLookAtRef.current.lerp(targetRef.current, 0.03);
        state.camera.lookAt(currentLookAtRef.current);
        controls.current.target.copy(currentLookAtRef.current);

        if (transitionProgressRef.current >= 1) {
            finishTransition(state);
        }
    });

    // Camera-relative AZERTY keyboard movement.
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!cam.current || !controls.current) return;

            const key = event.key.toLowerCase();

            if (key === "p") {
                console.log([Math.floor(cam.current.position.x), Math.floor(cam.current.position.y), Math.floor(cam.current.position.z)]);
                return;
            }

            const forward = new THREE.Vector3();
            cam.current.getWorldDirection(forward);
            forward.y = 0;

            if (forward.lengthSq() === 0) {
                return;
            }

            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, cam.current.up).normalize();
            const movement = new THREE.Vector3();

            if (key === "z") {
                movement.copy(forward);
            } else if (key === "s") {
                movement.copy(forward).negate();
            } else if (key === "q") {
                movement.copy(right).negate();
            } else if (key === "d") {
                movement.copy(right);
            } else {
                return;
            }

            event.preventDefault();
            movement.multiplyScalar(keyboardControlsSpeed);
            cam.current.position.add(movement);
            controls.current.target.add(movement);
            controls.current.update();

            setCameraState(
                [cam.current.position.x, cam.current.position.y, cam.current.position.z],
                [cam.current.rotation.x, cam.current.rotation.y, cam.current.rotation.z]
            );
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setCameraState]);

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
        const nextPosition = toVector3(activeCameraPosition);

        if(!nextPosition || !cam.current){
            return;
        }

        cam.current.position.copy(nextPosition);
    }, [activeCameraPosition]);
    
    return(
        <>
            <PerspectiveCamera makeDefault near={0.01} ref = {cam} position = {position} fov = {75}>
            </PerspectiveCamera>
            <OrbitControls makeDefault mouseButtons={cameraMode} target={activeCameraTarget} enableZoom = {currentCameraMovements["zoom"] && !forceDisableZoom}  enablePan = {currentCameraMovements["pan"]} enableRotate = {currentCameraMovements["rotate"]} ref = {controls} />
        </>
    )
});

Camera.displayName = "Camera";
