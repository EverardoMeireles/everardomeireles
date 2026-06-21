import React, { useCallback, useEffect, useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createArchCurve, isCurveUsable, setNamedTrigger, smoothStep } from "../Helper.js";
import SystemStore from "../SystemStore.js";

/**
 * Purpose: Default scroll and drag camera that moves along a curve and can focus on temporary destinations.
 * Relationships: Mounted by SceneContainer and publishes progress to SystemStore triggers for ProgressBar.
 * Example:
 * <CurveScrollNavigationCamera curve={new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10)])} initialPositionPoint={0} navigationCurveIncrement={0.001} loop={false} triggerOutProgress="curveScrollNavigationProgress" blockScroll={false} blockTouchNavigation={false} cameraLookatPoint={[0, 0, 0]} cameraFocusDestination={[1, 1, 1]} cameraFocusSpeed={1.8} cameraFocusCurveDirection="up" />
 * @param {*} [curve] - Curve used by the camera.
 * @param {number | Array<any> | THREE.Vector3} [initialPositionPoint] - Initial curve point.
 * @param {number} [navigationCurveIncrement] - Progress change per input unit.
 * @param {boolean} [loop] - Loops progress past either curve end.
 * @param {string} [triggerOutProgress] - SystemStore trigger key that receives progress.
 * @param {boolean} [blockScroll] - Blocks wheel navigation.
 * @param {boolean} [blockTouchNavigation] - Blocks drag and swipe navigation.
 * @param {Array<any> | THREE.Vector3} [cameraLookatPoint] - Camera look-at point.
 * @param {Array<any> | THREE.Vector3} [cameraFocusDestination] - Focus destination.
 * @param {number} [cameraFocusSpeed] - Focus movement speed.
 * @param {string | Array<any> | THREE.Vector3} [cameraFocusCurveDirection] - Focus curve direction.
 */
export const CurveScrollNavigationCamera = React.memo((props) => {
    // Example: new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10)])
    const { curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -10)
    ]) } = props;

    // Example: 0 or [0, 0, 0]
    const { initialPositionPoint = 0 } = props;
    const { navigationCurveIncrement = 0.001 } = props;
    const { loop = false } = props;

    // Example: "curveScrollNavigationProgress"
    const { triggerOutProgress = "curveScrollNavigationProgress" } = props;
    const { blockScroll = false } = props;
    const { blockTouchNavigation = false } = props;

    // Example: [0, 0, 0]
    const { cameraLookatPoint = undefined } = props;

    // Example: [0, 10, 0]
    const { cameraFocusDestination = undefined } = props;
    const { cameraFocusSpeed = 1.8 } = props;

    // Example: "up"
    const { cameraFocusCurveDirection = "up" } = props;

    const { gl } = useThree();
    const setTrigger = SystemStore((state) => state.setTrigger);

    //////////////////////////////////////////////////////////
    ///////////////// Mutable camera state ///////////////////
    //////////////////////////////////////////////////////////

    const cameraRef = useRef();
    const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const navigationProgressRef = useRef(0);
    const navigationTargetProgressRef = useRef(0);
    const cameraModeRef = useRef("main");
    const focusCurveRef = useRef();
    const focusProgressRef = useRef(0);
    const returnCurveRef = useRef();
    const returnProgressRef = useRef(0);
    const previousFocusDestinationKeyRef = useRef("");
    const activePointerIdRef = useRef(undefined);
    const previousPointerYRef = useRef(0);
    const navigationLerpSpeed = 7;

    // Keep focus speed valid.
    const safeCameraFocusSpeed = Number.isFinite(cameraFocusSpeed)
        ? Math.max(cameraFocusSpeed, 0)
        : 1.8;

    //////////////////////////////////////////////////////////
    ////////////////// Local value helpers ///////////////////
    //////////////////////////////////////////////////////////

    // Keep progress values bounded.
    const clampProgress = useCallback((value) => {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(value, 1));
    }, []);

    // Wrap progress around the curve ends.
    const wrapProgress = useCallback((value) => {
        if (!Number.isFinite(value)) {
            return 0;
        }
        if (value >= 0 && value <= 1) {
            return value;
        }
        return ((value % 1) + 1) % 1;
    }, []);

    // Convert progress for curve/store usage.
    const normalizeProgress = useCallback((value) => (
        loop ? wrapProgress(value) : clampProgress(value)
    ), [clampProgress, loop, wrapProgress]);

    // Convert arrays and vectors.
    const toVector3 = useCallback((value) => {
        if (!value) {
            return undefined;
        }

        if (value.isVector3) {
            return value.clone();
        }

        if (Array.isArray(value) && value.length >= 3) {
            return new THREE.Vector3(value[0], value[1], value[2]);
        }

        return undefined;
    }, []);

    // Resolve initial curve progress.
    const resolveInitialProgress = useCallback((value) => {
        if (typeof value === "number") {
            if (value > 1 && Array.isArray(curve?.points) && curve.points.length > 1) {
                return clampProgress(value / (curve.points.length - 1));
            }

            return clampProgress(value);
        }

        const position = toVector3(value);
        if (!position || !Array.isArray(curve?.points) || curve.points.length === 0) {
            return 0;
        }

        let closestPointIndex = 0;
        let closestPointDistance = Infinity;
        curve.points.forEach((point, index) => {
            const distance = position.distanceTo(point);
            if (distance < closestPointDistance) {
                closestPointDistance = distance;
                closestPointIndex = index;
            }
        });

        return curve.points.length === 1
            ? 0
            : clampProgress(closestPointIndex / (curve.points.length - 1));
    }, [clampProgress, curve, toVector3]);

    // Create the temporary focus curve.
    const createFocusCurve = useCallback((startPosition, endPosition) => {
        const curveDistance = startPosition.distanceTo(endPosition);
        const archWidth = curveDistance * 0.25;

        return createArchCurve(
            startPosition,
            endPosition,
            archWidth,
            cameraFocusCurveDirection
        );
    }, [cameraFocusCurveDirection]);

    // Read the current main curve point.
    const getMainCurvePoint = useCallback((progress = navigationProgressRef.current) => {
        if (!isCurveUsable(curve)) {
            return undefined;
        }

        return curve.getPointAt(normalizeProgress(progress));
    }, [curve, normalizeProgress]);

    // Set the requested curve progress.
    const setNavigationTargetProgress = useCallback((value) => {
        if (!Number.isFinite(value)) {
            navigationTargetProgressRef.current = 0;
            return;
        }

        const progress = loop ? value : clampProgress(value);
        navigationTargetProgressRef.current = progress;
    }, [clampProgress, loop]);

    // Publish progress to the selected trigger.
    const setProgressTrigger = useCallback((progress) => {
        setNamedTrigger(setTrigger, triggerOutProgress, progress);
    }, [setTrigger, triggerOutProgress]);

    // Set current and target progress instantly.
    const snapNavigationProgress = useCallback((value) => {
        const progress = normalizeProgress(value);
        navigationProgressRef.current = progress;
        navigationTargetProgressRef.current = progress;
        setProgressTrigger(progress);
    }, [normalizeProgress, setProgressTrigger]);

    // Start return from focus.
    const returnToMainCurve = useCallback(() => {
        if (!cameraRef.current) {
            return;
        }

        const mainCurvePoint = getMainCurvePoint();
        if (!mainCurvePoint) {
            return;
        }

        returnCurveRef.current = createFocusCurve(cameraRef.current.position.clone(), mainCurvePoint);
        returnProgressRef.current = 0;
        cameraModeRef.current = "returning";
    }, [createFocusCurve, getMainCurvePoint]);

    // Apply scroll or drag input.
    const applyNavigationInput = useCallback((inputAmount) => {
        if (!Number.isFinite(inputAmount) || inputAmount === 0) {
            return;
        }

        if (cameraModeRef.current === "focus") {
            returnToMainCurve();
            return;
        }

        if (cameraModeRef.current === "returning") {
            return;
        }

        setNavigationTargetProgress(navigationTargetProgressRef.current + inputAmount * navigationCurveIncrement);
    }, [navigationCurveIncrement, returnToMainCurve, setNavigationTargetProgress]);

    //////////////////////////////////////////////////////////
    ////////////////// Camera initialization /////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const initialProgress = resolveInitialProgress(initialPositionPoint);
        const startingPoint = isCurveUsable(curve)
            ? curve.getPointAt(initialProgress)
            : new THREE.Vector3(0, 0, 0);

        snapNavigationProgress(initialProgress);

        if (cameraRef.current) {
            cameraRef.current.position.copy(startingPoint);
        }
    }, [
        curve,
        initialPositionPoint,
        resolveInitialProgress,
        snapNavigationProgress
    ]);

    //////////////////////////////////////////////////////////
    ////////////////////// Focus changes /////////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const focusDestination = toVector3(cameraFocusDestination);

        if (!focusDestination) {
            if (cameraModeRef.current === "focus") {
                returnToMainCurve();
            }
            previousFocusDestinationKeyRef.current = "";
            return;
        }

        const focusDestinationKey = focusDestination.toArray().join(",");
        if (focusDestinationKey === previousFocusDestinationKeyRef.current) {
            return;
        }

        // Start focus from the current camera position.
        const startPosition = cameraRef.current?.position?.clone() ?? getMainCurvePoint();
        if (!startPosition) {
            return;
        }

        // Pause main navigation while focus animates.
        navigationTargetProgressRef.current = navigationProgressRef.current;
        focusCurveRef.current = createFocusCurve(startPosition, focusDestination);
        focusProgressRef.current = 0;
        cameraModeRef.current = "focus";
        previousFocusDestinationKeyRef.current = focusDestinationKey;
    }, [
        cameraFocusDestination,
        cameraFocusCurveDirection,
        createFocusCurve,
        getMainCurvePoint,
        returnToMainCurve,
        toVector3
    ]);

    //////////////////////////////////////////////////////////
    ////////////////////// Wheel input ///////////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) {
            return undefined;
        }

        const handleWheel = (event) => {
            if (blockScroll) {
                return;
            }

            event.preventDefault();
            applyNavigationInput(event.deltaY);
        };

        domElement.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            domElement.removeEventListener("wheel", handleWheel);
        };
    }, [applyNavigationInput, gl, blockScroll]);

    //////////////////////////////////////////////////////////
    ////////////////// Pointer drag input ////////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (blockTouchNavigation) {
                return;
            }

            activePointerIdRef.current = event.pointerId;
            previousPointerYRef.current = event.clientY;
            domElement.setPointerCapture?.(event.pointerId);
        };

        const handlePointerMove = (event) => {
            if (
                blockTouchNavigation ||
                activePointerIdRef.current !== event.pointerId
            ) {
                return;
            }

            const inputAmount = previousPointerYRef.current - event.clientY;
            previousPointerYRef.current = event.clientY;

            if (Math.abs(inputAmount) < 1) {
                return;
            }

            event.preventDefault();
            applyNavigationInput(inputAmount);
        };

        const handlePointerEnd = (event) => {
            if (activePointerIdRef.current === event.pointerId) {
                activePointerIdRef.current = undefined;
                domElement.releasePointerCapture?.(event.pointerId);
            }
        };

        domElement.addEventListener("pointerdown", handlePointerDown);
        domElement.addEventListener("pointermove", handlePointerMove);
        domElement.addEventListener("pointerup", handlePointerEnd);
        domElement.addEventListener("pointercancel", handlePointerEnd);

        return () => {
            domElement.removeEventListener("pointerdown", handlePointerDown);
            domElement.removeEventListener("pointermove", handlePointerMove);
            domElement.removeEventListener("pointerup", handlePointerEnd);
            domElement.removeEventListener("pointercancel", handlePointerEnd);
        };
    }, [applyNavigationInput, gl, blockTouchNavigation]);

    //////////////////////////////////////////////////////////
    ////////////////////// Frame updates /////////////////////
    //////////////////////////////////////////////////////////

    useFrame((state, delta) => {
        if (!cameraRef.current) {
            return;
        }

        const frameDelta = Math.min(delta, 0.05);
        const camera = cameraRef.current;

        if (cameraModeRef.current === "focus" && focusCurveRef.current) {
            // Move forward along the focus curve.
            focusProgressRef.current = clampProgress(focusProgressRef.current + frameDelta * safeCameraFocusSpeed);
            camera.position.copy(focusCurveRef.current.getPointAt(smoothStep(focusProgressRef.current)));
        } else if (cameraModeRef.current === "returning" && returnCurveRef.current) {
            // Ease back toward the main curve.
            returnProgressRef.current = clampProgress(returnProgressRef.current + frameDelta * 1.8);
            camera.position.copy(returnCurveRef.current.getPointAt(smoothStep(returnProgressRef.current)));

            if (returnProgressRef.current >= 1) {
                cameraModeRef.current = "main";
            }
        } else {
            // Follow the main scroll curve.
            const progressDifference = navigationTargetProgressRef.current - navigationProgressRef.current;
            const progressLerpAmount = Math.min(1, frameDelta * navigationLerpSpeed);

            // Smoothly move toward input target.
            navigationProgressRef.current = THREE.MathUtils.lerp(
                navigationProgressRef.current,
                navigationTargetProgressRef.current,
                progressLerpAmount
            );

            if (Math.abs(progressDifference) < 0.00001) {
                navigationProgressRef.current = navigationTargetProgressRef.current;
            }

            const mainCurvePoint = getMainCurvePoint();
            if (mainCurvePoint) {
                camera.position.copy(mainCurvePoint);
                setProgressTrigger(normalizeProgress(navigationProgressRef.current));
            }
        }

        // Choose the active look-at point.
        const focusDestination = toVector3(cameraFocusDestination);
        const lookAtTarget = toVector3(cameraLookatPoint)
            ?? (cameraModeRef.current === "focus" ? focusDestination : undefined)
            ?? new THREE.Vector3(0, 0, 0);

        // Smoothly rotate toward the look-at target.
        currentLookAtRef.current.lerp(lookAtTarget, Math.min(1, frameDelta * 8));
        camera.lookAt(currentLookAtRef.current);

        // Mirror local camera onto React Three Fiber.
        state.camera.position.copy(camera.position);
        state.camera.rotation.copy(camera.rotation);
    });

    //////////////////////////////////////////////////////////
    ////////////////////////// Render ////////////////////////
    //////////////////////////////////////////////////////////

    return (
        <>
            <PerspectiveCamera
                ref={cameraRef}
                makeDefault
                near={0.01}
                fov={75}
            />
        </>
    );
});

CurveScrollNavigationCamera.displayName = "CurveScrollNavigationCamera";
