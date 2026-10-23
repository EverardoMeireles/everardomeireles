import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { hasSignificantChange, roundToDecimalPlace } from "../Helper.js";
import SystemStore from "../SystemStore.js";

/**
 * Purpose: First-person camera rig with mouse, touch, gyroscope, and collisions.
 * Relationships: Alternative camera for SceneContainer that builds collisions from the R3F scene and publishes cameraState through SystemStore.
 * Example:
 * <FirstPersonController position={[0, 0, 0]} rotation={[0, 0, 0]} eyeHeight={4} isMainCamera={true} azertyMode="auto" collisionsEnabled={true} maxStepHeight={5.65} minStepHeight={0.1} climbHeightOffset={0} slowDownWhileFalling={true} slowDownWhileFallingSpeedMultiplier={0.5} />
 * @param {Array<any>} [position] - Controller initial position.
 * @param {Array<any>} [rotation] - Controller initial rotation.
 * @param {number} [eyeHeight] - Camera height above the controller base.
 * @param {boolean} [isMainCamera] - Whether this perspective camera becomes the default camera.
 * @param {boolean | "auto"} [azertyMode] - Uses ZQSD when true, WQSD when false, or detects the layout automatically; A toggles object visibility.
 * @param {boolean} [collisionsEnabled] - Enables capsule collision checks against scene meshes.
 * @param {number} [maxStepHeight] - Maximum climbable stair height.
 * @param {number} [minStepHeight] - Minimum height that can trigger a stair climb.
 * @param {number} [climbHeightOffset] - Extra height added to the final climb target.
 * @param {boolean} [slowDownWhileFalling] - Enables slower horizontal movement while descending.
 * @param {number} [slowDownWhileFallingSpeedMultiplier] - Horizontal speed multiplier while descending.
 * @param {React.MutableRefObject} [navigationRef] - HouseMaker tour navigation API ref.
 * @param {boolean} [enabled] - Whether first-person input and movement are enabled.
 * @param {"dual_joystick" | "gyroscope"} [touchNavigationMode] - Mobile look controls; gyroscope uses full-screen movement when available.
 * @param {function} [onGyroscopeStatusChange] - Reports motion availability and permission changes.
 */
export const FirstPersonController = React.memo((props) => {
    // ### Props ###

    const { position = [0, 0, 0] } = props;

    const { rotation = [0, 0, 0] } = props;
    const { eyeHeight = 1.7 } = props;
    const { isMainCamera = true } = props;
    // Usage: true, false, or "auto"
    const { azertyMode = "auto" } = props;
    const { collisionsEnabled = true } = props;
    const { maxStepHeight = 5.65 } = props;
    const { minStepHeight = 0.1 } = props;
    const { climbHeightOffset = 0 } = props;
    const { slowDownWhileFalling = true } = props;
    const { slowDownWhileFallingSpeedMultiplier = 0.5 } = props;
    const { navigationRef = undefined } = props;
    const { enabled = true } = props;
    const { touchNavigationMode = "dual_joystick" } = props;
    const { onGyroscopeStatusChange } = props;

    // Track pose values instead of unstable array identities.
    const initialPositionX = position[0] ?? 0;
    const initialPositionY = position[1] ?? 0;
    const initialPositionZ = position[2] ?? 0;
    const initialPitch = rotation[0] ?? 0;
    const initialYaw = rotation[1] ?? 0;

    // ### Store and scene access ###

    const setCameraState = SystemStore((state) => state.setCameraState);
    const cameraStateTracking = SystemStore((state) => state.cameraStateTracking);

    const { scene, gl } = useThree();

    // ### State and reusable objects ###

    const controllerRef = useRef();
    const yawGroupRef = useRef();
    const pitchGroupRef = useRef();
    const cameraRef = useRef();
    const keysRef = useRef({ forward: false, backward: false, left: false, right: false });
    const touchControlsRef = useRef({
        move: { pointerId: null, originX: 0, originY: 0, radius: 1, x: 0, y: 0 },
        look: { pointerId: null, originX: 0, originY: 0, radius: 1, x: 0, y: 0 }
    });
    const gyroscopeRef = useRef({
        active: false, status: "inactive", lastYaw: null, lastPitch: null,
        requestPermission: null,
    });
    const gyroscopeStatusCallbackRef = useRef(onGyroscopeStatusChange);
    gyroscopeStatusCallbackRef.current = onGyroscopeStatusChange;
    const collisionGroupsRef = useRef([]);
    const capsuleRef = useRef(new Capsule());
    const velocityRef = useRef(new THREE.Vector3());
    const yawRef = useRef(rotation[1] ?? 0);
    const pitchRef = useRef(rotation[0] ?? 0);
    const onFloorRef = useRef(false);
    const climbTargetRef = useRef(null);
    const stepProbeHeightRef = useRef(maxStepHeight);
    const previousCameraPositionRef = useRef(new THREE.Vector3());
    const previousCameraRotationRef = useRef(new THREE.Euler());
    const cameraStateInitializedRef = useRef(false);
    const suspendedRef = useRef(false);

    const capsuleRadius = 0.35;
    const capsuleHeight = Math.max(eyeHeight + 0.35, (capsuleRadius * 2) + 0.4);
    const moveSpeed = 1.5;
    const gravityStrength = 30;
    const terminalVelocity = 60;
    const lookSensitivity = 0.002;
    const touchLookSpeed = 1.8;
    const maxPitch = Math.PI / 2 - 0.05;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const downAxis = new THREE.Vector3(0, -1, 0);
    const forwardDirection = new THREE.Vector3();
    const rightDirection = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const cameraWorldQuaternion = new THREE.Quaternion();
    const cameraWorldEuler = new THREE.Euler();
    const probeOrigin = new THREE.Vector3();
    const downwardOrigin = new THREE.Vector3();
    const forwardRaycaster = new THREE.Raycaster();
    const downwardRaycaster = new THREE.Raycaster();

    // ### Controller helpers ###

    // Track controller capsule around the player body.
    function syncCapsuleToController() {
        if (!controllerRef.current) {
            return;
        }

        capsuleRef.current.start.set(
            controllerRef.current.position.x,
            controllerRef.current.position.y + capsuleRadius,
            controllerRef.current.position.z
        );
        capsuleRef.current.end.set(
            controllerRef.current.position.x,
            controllerRef.current.position.y + capsuleHeight - capsuleRadius,
            controllerRef.current.position.z
        );
        capsuleRef.current.radius = capsuleRadius;
    }

    // Copy capsule position back to the controller group.
    function syncControllerToCapsule() {
        if (!controllerRef.current) {
            return;
        }

        controllerRef.current.position.set(
            capsuleRef.current.start.x,
            capsuleRef.current.start.y - capsuleRadius,
            capsuleRef.current.start.z
        );
    }

    // Skip hidden object groups before expensive step raycasts.
    function getCollisionHit(raycaster) {
        let nearestHit = null;

        for (const group of collisionGroupsRef.current) {
            if (group.root?.userData.housemakerObjectsHidden === true) {
                continue;
            }

            const hit = raycaster.intersectObjects(group.meshes, false)
                .find((intersection) => intersection.object.visible);
            if (hit && (!nearestHit || hit.distance < nearestHit.distance)) {
                nearestHit = hit;
            }
        }

        return nearestHit;
    }

    // Probe a climbable step in front of movement.
    function detectStepTarget(currentMoveDirection, probeDistance) {
        if (
            !collisionsEnabled ||
            !controllerRef.current ||
            collisionGroupsRef.current.length === 0 ||
            currentMoveDirection.lengthSq() === 0 ||
            maxStepHeight <= 0 ||
            minStepHeight > maxStepHeight
        ) {
            stepProbeHeightRef.current = maxStepHeight;
            return null;
        }

        probeOrigin.copy(controllerRef.current.position);
        probeOrigin.y += Math.max(minStepHeight, 0.05);
        forwardRaycaster.set(probeOrigin, currentMoveDirection);
        forwardRaycaster.far = probeDistance;

        const lowerHit = getCollisionHit(forwardRaycaster);
        if (!lowerHit) {
            stepProbeHeightRef.current = maxStepHeight;
            return null;
        }

        const probeStepSize = Math.max((maxStepHeight - minStepHeight) / 8, 0.03);

        for (let probeHeight = maxStepHeight; probeHeight >= minStepHeight; probeHeight -= probeStepSize) {
            probeOrigin.copy(controllerRef.current.position);
            probeOrigin.y += probeHeight;
            forwardRaycaster.set(probeOrigin, currentMoveDirection);
            forwardRaycaster.far = probeDistance;

            const forwardHit = getCollisionHit(forwardRaycaster);
            if (!forwardHit) {
                continue;
            }

            stepProbeHeightRef.current = probeHeight;

            downwardOrigin.copy(forwardHit.point);
            downwardOrigin.addScaledVector(currentMoveDirection, capsuleRadius + 0.08);
            downwardOrigin.y = controllerRef.current.position.y + maxStepHeight + 0.3;

            downwardRaycaster.set(downwardOrigin, downAxis);
            downwardRaycaster.far = maxStepHeight + 0.6;

            const downwardHit = getCollisionHit(downwardRaycaster);

            if (!downwardHit) {
                break;
            }

            const stepHeight = downwardHit.point.y - controllerRef.current.position.y;
            if (stepHeight >= minStepHeight && stepHeight <= maxStepHeight) {
                return downwardHit.point.y + climbHeightOffset;
            }

            break;
        }

        stepProbeHeightRef.current = maxStepHeight;
        return null;
    }

    // Smoothly settle onto nearby ground.
    function snapDownToGround(currentMoveDirection, delta) {
        if (
            !collisionsEnabled ||
            !controllerRef.current ||
            collisionGroupsRef.current.length === 0
        ) {
            return;
        }

        downwardOrigin.copy(controllerRef.current.position);
        downwardOrigin.y += maxStepHeight + 0.3;

        if (currentMoveDirection.lengthSq() > 0) {
            downwardOrigin.addScaledVector(currentMoveDirection, capsuleRadius + 0.2);
        }

        downwardRaycaster.set(downwardOrigin, downAxis);
        downwardRaycaster.far = maxStepHeight + 0.6;

        const downwardHit = getCollisionHit(downwardRaycaster);

        if (!downwardHit) {
            return;
        }

        const heightGap = controllerRef.current.position.y - downwardHit.point.y;
        if (
            heightGap > 0.02 &&
            heightGap <= maxStepHeight &&
            velocityRef.current.y <= 0
        ) {
            controllerRef.current.position.y = THREE.MathUtils.lerp(
                controllerRef.current.position.y,
                downwardHit.point.y,
                Math.min(1, delta * 12)
            );
            syncCapsuleToController();
            onFloorRef.current = true;
        }
    }

    // ### Tour navigation API ###

    // Convert supported tour positions to vectors.
    function readTourVector(value) {
        if (value?.isVector3 && value.toArray().every(Number.isFinite)) {
            return value.clone();
        }

        if (
            Array.isArray(value) &&
            value.length >= 3 &&
            value.slice(0, 3).every(Number.isFinite)
        ) {
            return new THREE.Vector3(value[0], value[1], value[2]);
        }

        return undefined;
    }

    // Release one joystick or clear both interrupted gestures.
    function resetTouchControls(pointerId) {
        const { move, look } = touchControlsRef.current;
        for (const joystick of [move, look]) {
            if (pointerId !== undefined && joystick.pointerId !== pointerId) continue;
            const capturedId = joystick.pointerId;
            joystick.pointerId = null;
            joystick.x = 0;
            joystick.y = 0;
            if (capturedId !== null && gl.domElement.hasPointerCapture?.(capturedId)) {
                gl.domElement.releasePointerCapture(capturedId);
            }
        }
    }

    // Reanchor motion controls without changing the current camera pose.
    function resetGyroscopeCalibration() {
        gyroscopeRef.current.lastYaw = null;
        gyroscopeRef.current.lastPitch = null;
    }

    // Clear movement that could leak into tour playback.
    function clearNavigationMotion() {
        resetTouchControls();
        resetGyroscopeCalibration();
        keysRef.current = { forward: false, backward: false, left: false, right: false };
        velocityRef.current.set(0, 0, 0);
        climbTargetRef.current = null;
        stepProbeHeightRef.current = maxStepHeight;
    }

    // Read the exact player body position.
    function getPlayerPosition(output = new THREE.Vector3()) {
        if (!controllerRef.current || !output?.isVector3) {
            return undefined;
        }

        controllerRef.current.updateWorldMatrix(true, false);
        return controllerRef.current.getWorldPosition(output);
    }

    // Save the rig and pause first-person control.
    function suspendNavigation() {
        const controller = controllerRef.current;
        const camera = cameraRef.current;
        const pointerWasLocked = (
            typeof document !== "undefined" &&
            document.pointerLockElement === gl.domElement
        );
        const snapshot = {
            wasSuspended: suspendedRef.current,
            controllerPosition: controller?.position.clone(),
            controllerQuaternion: controller?.quaternion.clone(),
            controllerScale: controller?.scale.clone(),
            cameraPosition: camera?.position.clone(),
            cameraQuaternion: camera?.quaternion.clone(),
            cameraUp: camera?.up.clone(),
            yaw: yawRef.current,
            pitch: pitchRef.current,
            velocity: velocityRef.current.clone(),
            climbTarget: climbTargetRef.current,
            stepProbeHeight: stepProbeHeightRef.current,
            onFloor: onFloorRef.current,
        };

        suspendedRef.current = true;
        clearNavigationMotion();

        if (pointerWasLocked) {
            // A later click is required before browsers allow re-locking.
            document.exitPointerLock?.();
        }

        return snapshot;
    }

    // Restore the exact pre-tour first-person rig.
    function restoreNavigation(snapshot) {
        resetTouchControls();
        resetGyroscopeCalibration();
        const controller = controllerRef.current;
        const camera = cameraRef.current;

        if (!snapshot || !controller || !camera || !yawGroupRef.current || !pitchGroupRef.current) {
            suspendedRef.current = snapshot?.wasSuspended ?? false;
            return false;
        }

        if (snapshot.controllerPosition) controller.position.copy(snapshot.controllerPosition);
        if (snapshot.controllerQuaternion) controller.quaternion.copy(snapshot.controllerQuaternion);
        if (snapshot.controllerScale) controller.scale.copy(snapshot.controllerScale);
        if (snapshot.cameraPosition) camera.position.copy(snapshot.cameraPosition);
        if (snapshot.cameraQuaternion) camera.quaternion.copy(snapshot.cameraQuaternion);
        if (snapshot.cameraUp) camera.up.copy(snapshot.cameraUp);

        yawRef.current = Number.isFinite(snapshot.yaw) ? snapshot.yaw : yawRef.current;
        pitchRef.current = Number.isFinite(snapshot.pitch) ? snapshot.pitch : pitchRef.current;
        yawGroupRef.current.rotation.set(0, yawRef.current, 0);
        pitchGroupRef.current.position.set(0, eyeHeight, 0);
        pitchGroupRef.current.rotation.set(pitchRef.current, 0, 0);

        velocityRef.current.copy(snapshot.velocity ?? new THREE.Vector3());
        climbTargetRef.current = Number.isFinite(snapshot.climbTarget)
            ? snapshot.climbTarget
            : null;
        stepProbeHeightRef.current = Number.isFinite(snapshot.stepProbeHeight)
            ? snapshot.stepProbeHeight
            : maxStepHeight;
        onFloorRef.current = Boolean(snapshot.onFloor);
        keysRef.current = { forward: false, backward: false, left: false, right: false };

        syncCapsuleToController();
        controller.updateWorldMatrix(true, true);
        suspendedRef.current = snapshot.wasSuspended ?? false;
        return true;
    }

    // Adopt the completed tour pose without a camera jump.
    function completeNavigation(worldPosition, worldTarget, snapshot) {
        const finalPosition = readTourVector(worldPosition);
        const finalTarget = readTourVector(worldTarget);
        const controller = controllerRef.current;
        const camera = cameraRef.current;

        if (
            !finalPosition ||
            !finalTarget ||
            !controller ||
            !camera ||
            !yawGroupRef.current ||
            !pitchGroupRef.current
        ) {
            restoreNavigation(snapshot);
            return false;
        }

        // Place the controller below the final eye position.
        const controllerWorldPosition = finalPosition.clone().addScaledVector(upAxis, -eyeHeight);
        if (controller.parent) {
            controller.parent.updateWorldMatrix(true, false);
            controller.position.copy(controller.parent.worldToLocal(controllerWorldPosition));
        } else {
            controller.position.copy(controllerWorldPosition);
        }
        controller.quaternion.identity();

        // Convert the final look direction into rig angles.
        const lookDirection = finalTarget.clone().sub(finalPosition);
        if (lookDirection.lengthSq() > 0) {
            lookDirection.normalize();

            if (controller.parent) {
                const parentQuaternion = controller.parent.getWorldQuaternion(new THREE.Quaternion());
                lookDirection.applyQuaternion(parentQuaternion.invert()).normalize();
            }

            yawRef.current = Math.atan2(-lookDirection.x, -lookDirection.z);
            pitchRef.current = Math.asin(THREE.MathUtils.clamp(lookDirection.y, -1, 1));
            pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -maxPitch, maxPitch);
        }

        yawGroupRef.current.position.set(0, 0, 0);
        yawGroupRef.current.rotation.set(0, yawRef.current, 0);
        pitchGroupRef.current.position.set(0, eyeHeight, 0);
        pitchGroupRef.current.rotation.set(pitchRef.current, 0, 0);
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.up.copy(upAxis);

        clearNavigationMotion();
        onFloorRef.current = false;
        syncCapsuleToController();
        controller.updateWorldMatrix(true, true);
        cameraStateInitializedRef.current = false;
        suspendedRef.current = snapshot?.wasSuspended ?? false;
        return true;
    }

    // Expose tour control without per-frame React state.
    React.useImperativeHandle(navigationRef, () => ({
        getPlayerPosition,
        suspend: suspendNavigation,
        restore: restoreNavigation,
        complete: completeNavigation,
        isSuspended: () => suspendedRef.current,
        enableGyroscope: () => gyroscopeRef.current.requestPermission?.(),
        recenterGyroscope: () => {
            resetGyroscopeCalibration();
            pitchRef.current = 0;
        },
    }));

    // ### Controller initialization ###

    useEffect(() => {
        if (!controllerRef.current || !cameraRef.current || !yawGroupRef.current || !pitchGroupRef.current) {
            return;
        }

        // Reset controller pose and movement state.
        resetGyroscopeCalibration();
        yawRef.current = initialYaw;
        pitchRef.current = THREE.MathUtils.clamp(initialPitch, -maxPitch, maxPitch);
        climbTargetRef.current = null;
        stepProbeHeightRef.current = maxStepHeight;
        velocityRef.current.set(0, 0, 0);
        onFloorRef.current = false;

        controllerRef.current.position.set(
            initialPositionX,
            initialPositionY,
            initialPositionZ
        );
        controllerRef.current.rotation.set(0, 0, 0);
        cameraRef.current.up.set(0, 1, 0);

        // Align nested camera groups with controller rotation.
        yawGroupRef.current.rotation.set(0, yawRef.current, 0);
        pitchGroupRef.current.position.set(0, eyeHeight, 0);
        pitchGroupRef.current.rotation.set(pitchRef.current, 0, 0);

        capsuleRef.current.start.set(
            controllerRef.current.position.x,
            controllerRef.current.position.y + capsuleRadius,
            controllerRef.current.position.z
        );
        capsuleRef.current.end.set(
            controllerRef.current.position.x,
            controllerRef.current.position.y + capsuleHeight - capsuleRadius,
            controllerRef.current.position.z
        );
        capsuleRef.current.radius = capsuleRadius;
    }, [
        initialPositionX,
        initialPositionY,
        initialPositionZ,
        initialPitch,
        initialYaw,
        eyeHeight,
        maxPitch,
        maxStepHeight,
        capsuleHeight
    ]);

    // ### Collision world ###

    useEffect(() => {
        if (!collisionsEnabled) {
            collisionGroupsRef.current = [];
            return;
        }

        let cancelled = false;
        let frameId = 0;

        // Build a triangle octree from visible scene meshes.
        const buildCollisionWorld = () => {
            if (cancelled) {
                return;
            }
            const groups = new Map();
            // Reuse matrices while expanding instanced collision geometry.
            const instanceMatrix = new THREE.Matrix4();
            const instanceWorldMatrix = new THREE.Matrix4();

            // Add one geometry copy using its world transform.
            const addGeometryTriangles = (positionAttribute, worldMatrix, octree) => {
                for (let index = 0; index <= positionAttribute.count - 3; index += 3) {
                    const a = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index)
                        .applyMatrix4(worldMatrix);
                    const b = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index + 1)
                        .applyMatrix4(worldMatrix);
                    const c = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index + 2)
                        .applyMatrix4(worldMatrix);

                    octree.addTriangle(new THREE.Triangle(a, b, c));
                }
            };

            scene.updateMatrixWorld(true);

            scene.traverse((object) => {
                if (!object.isMesh || !object.geometry) {
                    return;
                }
                if (!object.visible && object.userData.housemakerHideable !== true) {
                    return;
                }

                let visibilityRoot = null;
                let parent = object.parent;
                while (parent) {
                    if (parent === controllerRef.current) {
                        return;
                    }
                    if (
                        object.userData.housemakerHideable === true &&
                        visibilityRoot === null &&
                        typeof parent.userData.housemakerObjectsHidden === "boolean"
                    ) {
                        visibilityRoot = parent;
                    }
                    parent = parent.parent;
                }

                let geometry = object.geometry;
                let tempGeometry = null;

                if (geometry.index) {
                    tempGeometry = geometry.toNonIndexed();
                    geometry = tempGeometry;
                }

                const positionAttribute = geometry.getAttribute?.("position");
                if (!positionAttribute || positionAttribute.count < 3) {
                    if (tempGeometry) {
                        tempGeometry.dispose();
                    }
                    return;
                }

                // Partition once; toggling only skips the associated group.
                if (!groups.has(visibilityRoot)) {
                    groups.set(visibilityRoot, {
                        root: visibilityRoot,
                        meshes: [],
                        octree: new Octree(),
                        hidden: visibilityRoot?.userData.housemakerObjectsHidden === true,
                    });
                }
                const group = groups.get(visibilityRoot);

                if (object.isInstancedMesh) {
                    // Expand each instance only inside the collision octree.
                    for (let instanceIndex = 0; instanceIndex < object.count; instanceIndex += 1) {
                        object.getMatrixAt(instanceIndex, instanceMatrix);
                        instanceWorldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
                        addGeometryTriangles(positionAttribute, instanceWorldMatrix, group.octree);
                    }
                } else {
                    addGeometryTriangles(positionAttribute, object.matrixWorld, group.octree);
                }

                if (tempGeometry) {
                    tempGeometry.dispose();
                }

                group.meshes.push(object);
            });

            collisionGroupsRef.current = [...groups.values()];
            for (const group of collisionGroupsRef.current) {
                group.octree = group.octree.triangles.length > 0 ? group.octree.build() : undefined;
            }
        };

        // Rebuild when root scene content changes.
        const scheduleCollisionBuild = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(buildCollisionWorld);
        };

        scene.addEventListener("childadded", scheduleCollisionBuild);
        scene.addEventListener("childremoved", scheduleCollisionBuild);
        scheduleCollisionBuild();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
            scene.removeEventListener("childadded", scheduleCollisionBuild);
            scene.removeEventListener("childremoved", scheduleCollisionBuild);
            collisionGroupsRef.current = [];
        };
    }, [scene, collisionsEnabled]);

    // ### Gyroscope look and motion permission ###

    useEffect(() => {
        const gyroscope = gyroscopeRef.current;
        let cancelled = false;
        let listening = false;
        let permissionPending = false;
        let sensorTimeout;

        // Publish capability changes, never individual sensor samples.
        const publishStatus = (status) => {
            if (gyroscope.status === status) return;
            gyroscope.status = status;
            gyroscopeStatusCallbackRef.current?.(status);
        };

        const touchDevice = navigator.maxTouchPoints > 0
            || window.matchMedia?.("(pointer: coarse)")?.matches === true;
        if (!enabled || touchNavigationMode !== "gyroscope" || !touchDevice) {
            publishStatus("inactive");
            return;
        }
        if (window.isSecureContext === false || !window.DeviceOrientationEvent) {
            publishStatus("unavailable");
            return;
        }

        const sensorEuler = new THREE.Euler();
        const sensorQuaternion = new THREE.Quaternion();
        const cameraCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        const screenCorrection = new THREE.Quaternion();
        const screenAxis = new THREE.Vector3(0, 0, 1);
        const sensorForward = new THREE.Vector3();

        // Convert device orientation into upright, calibrated camera angles.
        const handleDeviceOrientation = (event) => {
            if (cancelled || suspendedRef.current || document.hidden) return;
            if (![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;

            const screenAngle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
            if (!Number.isFinite(screenAngle)) return;
            sensorEuler.set(
                THREE.MathUtils.degToRad(event.beta),
                THREE.MathUtils.degToRad(event.alpha),
                -THREE.MathUtils.degToRad(event.gamma),
                "YXZ"
            );
            sensorQuaternion.setFromEuler(sensorEuler).multiply(cameraCorrection);
            screenCorrection.setFromAxisAngle(screenAxis, -THREE.MathUtils.degToRad(screenAngle));
            sensorQuaternion.multiply(screenCorrection);
            sensorForward.set(0, 0, -1).applyQuaternion(sensorQuaternion);

            // Reanchor unstable headings near the vertical pitch limits.
            const sensorYaw = Math.abs(sensorForward.y) < Math.sin(maxPitch)
                ? Math.atan2(-sensorForward.x, -sensorForward.z) : null;
            const sensorPitch = Math.asin(THREE.MathUtils.clamp(sensorForward.y, -1, 1));
            if (gyroscope.lastPitch !== null) {
                if (sensorYaw !== null && gyroscope.lastYaw !== null) {
                    const yawDifference = sensorYaw - gyroscope.lastYaw;
                    const yawDelta = Math.atan2(Math.sin(yawDifference), Math.cos(yawDifference));
                    // Pole crossings can reverse heading between sensor samples.
                    if (
                        Math.abs(yawDelta) <= Math.PI / 2
                        || Math.abs(sensorPitch) + Math.abs(gyroscope.lastPitch) <= Math.PI / 2
                    ) {
                        yawRef.current += yawDelta;
                    }
                }
                pitchRef.current = THREE.MathUtils.clamp(
                    pitchRef.current + sensorPitch - gyroscope.lastPitch, -maxPitch, maxPitch
                );
            }
            gyroscope.lastYaw = sensorYaw;
            gyroscope.lastPitch = sensorPitch;

            if (!gyroscope.active) {
                // Release old split-screen gestures before full-screen movement.
                resetTouchControls();
                gyroscope.active = true;
                clearTimeout(sensorTimeout);
                publishStatus("active");
            }
        };

        // Start once after permission, or automatically where permitted.
        const startListening = () => {
            if (cancelled || listening) return;
            listening = true;
            resetGyroscopeCalibration();
            window.addEventListener("deviceorientation", handleDeviceOrientation);
            publishStatus("waiting");
            sensorTimeout = setTimeout(() => {
                if (!gyroscope.active && !cancelled) publishStatus("unavailable");
            }, 4000);
        };

        // Permission requests must run directly from a button click.
        gyroscope.requestPermission = async () => {
            if (cancelled || permissionPending || listening) return;
            permissionPending = true;
            try {
                const permission = await window.DeviceOrientationEvent.requestPermission();
                if (cancelled) return;
                if (permission === "granted") startListening();
                else publishStatus("denied");
            } catch {
                if (!cancelled) publishStatus("denied");
            } finally {
                permissionPending = false;
            }
        };

        if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
            publishStatus("permission_required");
        } else {
            startListening();
        }

        return () => {
            cancelled = true;
            clearTimeout(sensorTimeout);
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
            gyroscope.active = false;
            gyroscope.requestPermission = null;
            resetGyroscopeCalibration();
            publishStatus("inactive");
        };
        // Pose helpers read refs; permission belongs to this configuration.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, touchNavigationMode, maxPitch]);

    // ### Mouse and invisible touch joysticks ###

    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) {
            return;
        }
        if (!enabled) {
            clearNavigationMotion();
            return;
        }

        const previousTouchAction = domElement.style.touchAction;
        domElement.style.touchAction = "none";

        // Gyroscope look frees either canvas half for movement.
        const handlePointerDown = (event) => {
            if (!enabled || suspendedRef.current) {
                return;
            }

            if (event.pointerType === "touch") {
                const bounds = domElement.getBoundingClientRect();
                if (bounds.width <= 0 || bounds.height <= 0) return;
                const fullScreenMovement = touchNavigationMode === "gyroscope" && gyroscopeRef.current.active;
                const side = fullScreenMovement || event.clientX - bounds.left < bounds.width / 2
                    ? "move" : "look";
                const joystick = touchControlsRef.current[side];
                if (joystick.pointerId !== null) return;

                event.preventDefault();
                joystick.pointerId = event.pointerId;
                joystick.originX = event.clientX;
                joystick.originY = event.clientY;
                joystick.radius = Math.min(bounds.width, bounds.height) * 0.15;
                joystick.x = 0;
                joystick.y = 0;
                domElement.setPointerCapture?.(event.pointerId);
                return;
            }

            if (event.button !== 0) return;
            if (document.pointerLockElement !== domElement) {
                domElement.requestPointerLock?.();
            }
        };

        // Clamp analog deflection outside a small radial deadzone.
        const handleTouchMove = (event) => {
            if (suspendedRef.current) return;
            const { move, look } = touchControlsRef.current;
            const joystick = move.pointerId === event.pointerId ? move
                : look.pointerId === event.pointerId ? look : undefined;
            if (!joystick) return;

            event.preventDefault();
            const x = (event.clientX - joystick.originX) / joystick.radius;
            const y = (event.clientY - joystick.originY) / joystick.radius;
            const distance = Math.hypot(x, y);
            const strength = distance <= 0.12 ? 0
                : (Math.min(distance, 1) - 0.12) / (0.88 * distance);
            joystick.x = x * strength;
            joystick.y = y * strength;
        };

        // Release only the finger that ended its gesture.
        const handleTouchEnd = (event) => {
            resetTouchControls(event.pointerId);
        };

        // Stop gestures when focus or viewport geometry changes.
        const handleInputReset = () => clearNavigationMotion();
        const handleVisibilityChange = () => {
            if (document.hidden) handleInputReset();
        };

        // Lock pointer on click and update view angles.
        const handleMouseMove = (event) => {
            if (
                !enabled ||
                suspendedRef.current ||
                document.pointerLockElement !== domElement ||
                !controllerRef.current ||
                !cameraRef.current
            ) {
                return;
            }

            yawRef.current -= event.movementX * lookSensitivity;
            pitchRef.current = THREE.MathUtils.clamp(
                pitchRef.current - (event.movementY * lookSensitivity),
                -maxPitch,
                maxPitch
            );
        };

        domElement.addEventListener("pointerdown", handlePointerDown, { passive: false });
        domElement.addEventListener("lostpointercapture", handleTouchEnd);
        window.addEventListener("pointermove", handleTouchMove, { passive: false });
        window.addEventListener("pointerup", handleTouchEnd);
        window.addEventListener("pointercancel", handleTouchEnd);
        window.addEventListener("blur", handleInputReset);
        window.addEventListener("resize", handleInputReset);
        window.addEventListener("orientationchange", handleInputReset);
        window.screen?.orientation?.addEventListener("change", handleInputReset);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("mousemove", handleMouseMove);

        return () => {
            domElement.removeEventListener("pointerdown", handlePointerDown);
            domElement.removeEventListener("lostpointercapture", handleTouchEnd);
            window.removeEventListener("pointermove", handleTouchMove);
            window.removeEventListener("pointerup", handleTouchEnd);
            window.removeEventListener("pointercancel", handleTouchEnd);
            window.removeEventListener("blur", handleInputReset);
            window.removeEventListener("resize", handleInputReset);
            window.removeEventListener("orientationchange", handleInputReset);
            window.screen?.orientation?.removeEventListener("change", handleInputReset);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("mousemove", handleMouseMove);
            clearNavigationMotion();
            domElement.style.touchAction = previousTouchAction;

            if (document.pointerLockElement === domElement) {
                document.exitPointerLock?.();
            }
        };
        // Helpers read refs; bind listeners to controller configuration.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, gl, maxPitch, maxStepHeight, touchNavigationMode]);

    // ### Keyboard input ###

    useEffect(() => {
        let resolvedAzertyMode = azertyMode === "auto" ? true : azertyMode === true;

        const isEditableTarget = () => {
            const activeElement = document.activeElement;
            if (!activeElement) {
                return false;
            }

            const tagName = activeElement.tagName;
            return (
                activeElement.isContentEditable ||
                tagName === "INPUT" ||
                tagName === "TEXTAREA" ||
                tagName === "SELECT"
            );
        };

        const normalizeKey = (key) => {
            if (typeof key !== "string") {
                return "";
            }

            return key.length === 1 ? key.toUpperCase() : key;
        };

        const getMovementKeys = () => ({
            forward: resolvedAzertyMode ? ["ArrowUp", "Z"] : ["ArrowUp", "W"],
            backward: ["ArrowDown", "S"],
            left: ["ArrowLeft", "Q"],
            right: ["ArrowRight", "D"],
        });

        const resolveAutoAzertyMode = async () => {
            if (azertyMode !== "auto") {
                resolvedAzertyMode = azertyMode === true;
                return;
            }

            try {
                const layoutMap = await navigator.keyboard?.getLayoutMap?.();
                if (!layoutMap) {
                    return;
                }

                const keyW = normalizeKey(layoutMap.get("KeyW"));
                const keyA = normalizeKey(layoutMap.get("KeyA"));
                const keyZ = normalizeKey(layoutMap.get("KeyZ"));
                const keyQ = normalizeKey(layoutMap.get("KeyQ"));

                resolvedAzertyMode = (
                    (keyW === "Z" && keyA === "Q") ||
                    (keyZ === "W" && keyQ === "A")
                );
            } catch (error) {
                resolvedAzertyMode = true;
            }
        };

        const updateKeyState = (key, pressed) => {
            const normalizedKey = normalizeKey(key);
            const movementKeys = getMovementKeys();

            if (movementKeys.forward.includes(normalizedKey)) {
                keysRef.current.forward = pressed;
                return true;
            }

            if (movementKeys.backward.includes(normalizedKey)) {
                keysRef.current.backward = pressed;
                return true;
            }

            if (movementKeys.left.includes(normalizedKey)) {
                keysRef.current.left = pressed;
                return true;
            }

            if (movementKeys.right.includes(normalizedKey)) {
                keysRef.current.right = pressed;
                return true;
            }

            return false;
        };

        // Map keyboard events to movement flags.
        const handleKeyDown = (event) => {
            if (!enabled || suspendedRef.current) {
                return;
            }

            if (isEditableTarget()) {
                return;
            }

            if (normalizeKey(event.key) === "P") {
                if (!event.repeat && cameraRef.current) {
                    const worldPosition = new THREE.Vector3();
                    cameraRef.current.getWorldPosition(worldPosition);
                    console.log([
                        roundToDecimalPlace(worldPosition.x, 2),
                        roundToDecimalPlace(worldPosition.y, 2),
                        roundToDecimalPlace(worldPosition.z, 2),
                    ]);
                }
                event.preventDefault();
                return;
            }

            if (updateKeyState(event.key, true)) {
                event.preventDefault();
            }
        };

        const handleKeyUp = (event) => {
            if (!enabled || suspendedRef.current) {
                updateKeyState(event.key, false);
                return;
            }

            if (updateKeyState(event.key, false)) {
                event.preventDefault();
            }
        };

        resolveAutoAzertyMode();

        if (azertyMode === "auto") {
            navigator.keyboard?.addEventListener?.("layoutchange", resolveAutoAzertyMode);
        }

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            if (azertyMode === "auto") {
                navigator.keyboard?.removeEventListener?.("layoutchange", resolveAutoAzertyMode);
            }

            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [azertyMode, enabled]);

    // ### Frame update ###

    useFrame((_, delta) => {
        if (
            !enabled ||
            suspendedRef.current ||
            !controllerRef.current ||
            !cameraRef.current
        ) {
            return;
        }

        const frameDelta = Math.min(delta, 0.05);
        const touch = touchControlsRef.current;
        yawRef.current -= touch.look.x * touchLookSpeed * frameDelta;
        pitchRef.current = THREE.MathUtils.clamp(
            pitchRef.current - touch.look.y * touchLookSpeed * frameDelta,
            -maxPitch,
            maxPitch
        );

        // Cancel climbing when its supporting objects become hidden.
        for (const group of collisionGroupsRef.current) {
            const hidden = group.root?.userData.housemakerObjectsHidden === true;
            if (hidden && !group.hidden) {
                climbTargetRef.current = null;
            }
            group.hidden = hidden;
        }

        // Update camera rig from latest look angles.
        yawGroupRef.current.rotation.y = yawRef.current;
        pitchGroupRef.current.position.set(0, eyeHeight, 0);
        pitchGroupRef.current.rotation.x = pitchRef.current;
        cameraRef.current.up.copy(upAxis);

        // Build world-space movement directions from yaw.
        forwardDirection.set(0, 0, -1).applyQuaternion(yawGroupRef.current.quaternion);
        forwardDirection.y = 0;
        forwardDirection.normalize();

        rightDirection.set(1, 0, 0).applyQuaternion(yawGroupRef.current.quaternion);
        rightDirection.y = 0;
        rightDirection.normalize();

        // Preserve analog speed while normalizing collision probe directions.
        moveDirection.set(0, 0, 0);
        if (keysRef.current.forward) {
            moveDirection.add(forwardDirection);
        }
        if (keysRef.current.backward) {
            moveDirection.sub(forwardDirection);
        }
        if (keysRef.current.left) {
            moveDirection.sub(rightDirection);
        }
        if (keysRef.current.right) {
            moveDirection.add(rightDirection);
        }
        moveDirection.addScaledVector(rightDirection, touch.move.x);
        moveDirection.addScaledVector(forwardDirection, -touch.move.y);
        const movementStrength = Math.min(moveDirection.length(), 1);
        if (movementStrength > 0) {
            moveDirection.normalize();
        }

        if (
            collisionsEnabled &&
            onFloorRef.current &&
            climbTargetRef.current === null &&
            moveDirection.lengthSq() > 0
        ) {
            // Detect stair climbs before moving forward.
            const probeDistance = capsuleRadius + Math.max(0.35, moveSpeed * frameDelta * 2);
            const stepTarget = detectStepTarget(moveDirection, probeDistance);
            if (stepTarget !== null) {
                climbTargetRef.current = stepTarget;
            }
        }

        // Reduce air speed while falling.
        const currentMoveSpeed = (
            slowDownWhileFalling &&
            !onFloorRef.current &&
            climbTargetRef.current === null &&
            velocityRef.current.y < 0
        )
            ? moveSpeed * Math.max(slowDownWhileFallingSpeedMultiplier, 0)
            : moveSpeed;

        velocityRef.current.x = moveDirection.x * currentMoveSpeed * movementStrength;
        velocityRef.current.z = moveDirection.z * currentMoveSpeed * movementStrength;

        // Apply horizontal movement and vertical climbing/gravity.
        if (climbTargetRef.current !== null) {
            velocityRef.current.y = 0;
            controllerRef.current.position.y = THREE.MathUtils.lerp(
                controllerRef.current.position.y,
                climbTargetRef.current,
                Math.min(1, frameDelta * 14)
            );

            if (Math.abs(climbTargetRef.current - controllerRef.current.position.y) <= 0.02) {
                controllerRef.current.position.y = climbTargetRef.current;
                climbTargetRef.current = null;
                stepProbeHeightRef.current = maxStepHeight;
            }
        } else {
            velocityRef.current.y = Math.max(
                velocityRef.current.y - (gravityStrength * frameDelta),
                -terminalVelocity
            );
            controllerRef.current.position.y += velocityRef.current.y * frameDelta;
        }

        controllerRef.current.position.x += velocityRef.current.x * frameDelta;
        controllerRef.current.position.z += velocityRef.current.z * frameDelta;

        // Sync the collision capsule with the controller.
        syncCapsuleToController();

        onFloorRef.current = false;
        if (collisionsEnabled) {
            // Push the capsule out of scene collisions.
            for (const group of collisionGroupsRef.current) {
                if (group.hidden || !group.octree) {
                    continue;
                }

                const collision = group.octree.capsuleIntersect(capsuleRef.current);
                if (!collision) {
                    continue;
                }

                const collisionOffset = collision.normal.clone().multiplyScalar(collision.depth);
                capsuleRef.current.translate(collisionOffset);
                syncControllerToCapsule();

                if (collision.normal.y > 0.25) {
                    onFloorRef.current = true;
                    if (velocityRef.current.y < 0) {
                        velocityRef.current.y = 0;
                    }
                } else if (collision.normal.y < -0.25 && velocityRef.current.y > 0) {
                    velocityRef.current.y = 0;
                }
            }
        }

        if (
            collisionsEnabled &&
            climbTargetRef.current === null &&
            velocityRef.current.y <= 0
        ) {
            // Snap down small drops to stay grounded.
            snapDownToGround(moveDirection, frameDelta);
        }

        if (cameraStateTracking) {
            // Publish camera state only when it changes.
            cameraRef.current.getWorldPosition(cameraWorldPosition);
            cameraRef.current.getWorldQuaternion(cameraWorldQuaternion);
            cameraWorldEuler.setFromQuaternion(cameraWorldQuaternion, "XYZ");

            const positionChanged =
                !cameraStateInitializedRef.current ||
                hasSignificantChange(previousCameraPositionRef.current.x, cameraWorldPosition.x) ||
                hasSignificantChange(previousCameraPositionRef.current.y, cameraWorldPosition.y) ||
                hasSignificantChange(previousCameraPositionRef.current.z, cameraWorldPosition.z);

            const rotationChanged =
                !cameraStateInitializedRef.current ||
                hasSignificantChange(previousCameraRotationRef.current.x, cameraWorldEuler.x) ||
                hasSignificantChange(previousCameraRotationRef.current.y, cameraWorldEuler.y) ||
                hasSignificantChange(previousCameraRotationRef.current.z, cameraWorldEuler.z);

            if (positionChanged || rotationChanged) {
                setCameraState(
                    [
                        roundToDecimalPlace(cameraWorldPosition.x, 1),
                        roundToDecimalPlace(cameraWorldPosition.y, 1),
                        roundToDecimalPlace(cameraWorldPosition.z, 1),
                    ],
                    [
                        roundToDecimalPlace(cameraWorldEuler.x, 1),
                        roundToDecimalPlace(cameraWorldEuler.y, 1),
                        roundToDecimalPlace(cameraWorldEuler.z, 1),
                    ]
                );

                previousCameraPositionRef.current.copy(cameraWorldPosition);
                previousCameraRotationRef.current.copy(cameraWorldEuler);
                cameraStateInitializedRef.current = true;
            }
        }
    });

    // ### Render ###

    return (
        <group ref={controllerRef}>
            <group ref={yawGroupRef}>
                <group ref={pitchGroupRef} position={[0, eyeHeight, 0]}>
                    <PerspectiveCamera
                        ref={cameraRef}
                        makeDefault={isMainCamera}
                        near={0.01}
                        fov={75}
                    />
                </group>
            </group>
        </group>
    );
});

FirstPersonController.displayName = "FirstPersonController";
