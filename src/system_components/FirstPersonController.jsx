import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { hasSignificantChange, roundToDecimalPlace } from "../Helper.js";
import SystemStore from "../SystemStore.js";

/**
 * @param {Array<any>} [position] - Controller initial position.
 * @param {Array<any>} [rotation] - Controller initial rotation.
 * @param {number} [eyeHeight] - Camera height above the controller base.
 * @param {boolean} [isMainCamera] - Whether this perspective camera becomes the default camera.
 * @param {boolean} [azertyMode] - Switches movement keys from WASD to ZQSD while keeping arrow keys active.
 * @param {boolean} [collisionsEnabled] - Enables capsule collision checks against scene meshes.
 * @param {number} [maxStepHeight] - Maximum climbable stair height.
 * @param {number} [minStepHeight] - Minimum height that can trigger a stair climb.
 * @param {number} [climbHeightOffset] - Extra height added to the final climb target.
 */
export const FirstPersonController = React.memo((props) => {
    const { position = [0, 0, 0] } = props;
    const { rotation = [0, 0, 0] } = props;
    const { eyeHeight = 4 } = props;
    const { isMainCamera = true } = props;
    const { azertyMode = false } = props;
    const { collisionsEnabled = true } = props;
    const { maxStepHeight = 5.65 } = props;
    const { minStepHeight = 0.1 } = props;
    const { climbHeightOffset = 0 } = props;

    const mainScene = SystemStore((state) => state.mainScene);
    const setCameraState = SystemStore((state) => state.setCameraState);
    const cameraStateTracking = SystemStore((state) => state.cameraStateTracking);

    const { scene, gl } = useThree();

    //////////////////////////////////////////////////////////
    ///////////// Variables, states and refs /////////////////
    //////////////////////////////////////////////////////////

    const controllerRef = useRef();
    const yawGroupRef = useRef();
    const pitchGroupRef = useRef();
    const cameraRef = useRef();
    const keysRef = useRef({ forward: false, backward: false, left: false, right: false });
    const collisionOctreeRef = useRef();
    const collisionMeshesRef = useRef([]);
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

    const capsuleRadius = 0.35;
    const capsuleHeight = Math.max(eyeHeight + 0.35, (capsuleRadius * 2) + 0.4);
    const moveSpeed = 8;
    const gravityStrength = 30;
    const terminalVelocity = 60;
    const lookSensitivity = 0.002;
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

    //////////////////////////////////////////////////////////
    ///////////////// Local helper functions /////////////////
    //////////////////////////////////////////////////////////

    function syncCapsuleToController() {
        // Track controller capsule around the player body.
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

    function syncControllerToCapsule() {
        // Copy capsule position back to the controller group.
        if (!controllerRef.current) {
            return;
        }

        controllerRef.current.position.set(
            capsuleRef.current.start.x,
            capsuleRef.current.start.y - capsuleRadius,
            capsuleRef.current.start.z
        );
    }

    function getFirstHit(intersections) {
        // Ignore empty or hidden intersections.
        if (!Array.isArray(intersections) || intersections.length === 0) {
            return null;
        }

        return intersections.find((intersection) => intersection?.object?.visible) ?? null;
    }

    function detectStepTarget(currentMoveDirection, probeDistance) {
        // Probe a climbable step in front of movement.
        if (
            !collisionsEnabled ||
            !controllerRef.current ||
            collisionMeshesRef.current.length === 0 ||
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

        const lowerHit = getFirstHit(forwardRaycaster.intersectObjects(collisionMeshesRef.current, true));
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

            const forwardHit = getFirstHit(forwardRaycaster.intersectObjects(collisionMeshesRef.current, true));
            if (!forwardHit) {
                continue;
            }

            stepProbeHeightRef.current = probeHeight;

            downwardOrigin.copy(forwardHit.point);
            downwardOrigin.addScaledVector(currentMoveDirection, capsuleRadius + 0.08);
            downwardOrigin.y = controllerRef.current.position.y + maxStepHeight + 0.3;

            downwardRaycaster.set(downwardOrigin, downAxis);
            downwardRaycaster.far = maxStepHeight + 0.6;

            const downwardHit = getFirstHit(
                downwardRaycaster.intersectObjects(collisionMeshesRef.current, true)
            );

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

    function snapDownToGround(currentMoveDirection, delta) {
        // Smoothly settle onto nearby ground.
        if (
            !collisionsEnabled ||
            !controllerRef.current ||
            collisionMeshesRef.current.length === 0
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

        const downwardHit = getFirstHit(
            downwardRaycaster.intersectObjects(collisionMeshesRef.current, true)
        );

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

    //////////////////////////////////////////////////////////
    ////////////// Controller initialization /////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        if (!controllerRef.current || !cameraRef.current || !yawGroupRef.current || !pitchGroupRef.current) {
            return;
        }

        // Reset controller pose and movement state.
        yawRef.current = rotation[1] ?? 0;
        pitchRef.current = THREE.MathUtils.clamp(rotation[0] ?? 0, -maxPitch, maxPitch);
        climbTargetRef.current = null;
        stepProbeHeightRef.current = maxStepHeight;
        velocityRef.current.set(0, 0, 0);
        onFloorRef.current = false;

        controllerRef.current.position.set(
            position[0] ?? 0,
            position[1] ?? 0,
            position[2] ?? 0
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
    }, [position, rotation, eyeHeight, maxPitch, maxStepHeight, capsuleHeight]);

    //////////////////////////////////////////////
    ////////////////// Collision /////////////////
    //////////////////////////////////////////////

    useEffect(() => {
        if (!collisionsEnabled) {
            collisionOctreeRef.current = undefined;
            collisionMeshesRef.current = [];
            return;
        }

        let cancelled = false;
        let frameId = 0;

        const buildCollisionWorld = () => {
            if (cancelled) {
                return;
            }

            // Build a triangle octree from visible scene meshes.
            const meshes = [];
            const octree = new Octree();
            scene.updateMatrixWorld(true);

            scene.traverse((object) => {
                if (!object.isMesh || !object.visible || !object.geometry) {
                    return;
                }

                let parent = object.parent;
                while (parent) {
                    if (parent === controllerRef.current) {
                        return;
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

                for (let index = 0; index <= positionAttribute.count - 3; index += 3) {
                    const a = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index)
                        .applyMatrix4(object.matrixWorld);
                    const b = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index + 1)
                        .applyMatrix4(object.matrixWorld);
                    const c = new THREE.Vector3()
                        .fromBufferAttribute(positionAttribute, index + 2)
                        .applyMatrix4(object.matrixWorld);

                    octree.addTriangle(new THREE.Triangle(a, b, c));
                }

                if (tempGeometry) {
                    tempGeometry.dispose();
                }

                meshes.push(object);
            });

            collisionMeshesRef.current = meshes;
            collisionOctreeRef.current = octree.triangles.length > 0 ? octree.build() : undefined;
        };

        frameId = requestAnimationFrame(buildCollisionWorld);

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
        };
    }, [scene, mainScene, collisionsEnabled]);

    //////////////////////////////////////////////////////////
    ///////////////////// Pointer lock ///////////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) {
            return;
        }

        const handlePointerDown = () => {
            if (document.pointerLockElement !== domElement) {
                domElement.requestPointerLock?.();
            }
        };

        const handleMouseMove = (event) => {
            // Lock pointer on click and update view angles.
            if (
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

        domElement.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("mousemove", handleMouseMove);

        return () => {
            domElement.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("mousemove", handleMouseMove);

            if (document.pointerLockElement === domElement) {
                document.exitPointerLock?.();
            }
        };
    }, [gl, maxPitch]);

    //////////////////////////////////////////////////////////
    ////////////////// Keyboard input ////////////////////////
    //////////////////////////////////////////////////////////

    useEffect(() => {
        const forwardCodes = azertyMode ? ["ArrowUp", "KeyZ"] : ["ArrowUp", "KeyW"];
        const backwardCodes = ["ArrowDown", "KeyS"];
        const leftCodes = azertyMode ? ["ArrowLeft", "KeyQ"] : ["ArrowLeft", "KeyA"];
        const rightCodes = ["ArrowRight", "KeyD"];

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

        const updateKeyState = (code, pressed) => {
            if (forwardCodes.includes(code)) {
                keysRef.current.forward = pressed;
                return true;
            }

            if (backwardCodes.includes(code)) {
                keysRef.current.backward = pressed;
                return true;
            }

            if (leftCodes.includes(code)) {
                keysRef.current.left = pressed;
                return true;
            }

            if (rightCodes.includes(code)) {
                keysRef.current.right = pressed;
                return true;
            }

            return false;
        };

        const handleKeyDown = (event) => {
            // Map keyboard events to movement flags.
            if (isEditableTarget()) {
                return;
            }

            if (event.code === "KeyP") {
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

            if (updateKeyState(event.code, true)) {
                event.preventDefault();
            }
        };

        const handleKeyUp = (event) => {
            if (updateKeyState(event.code, false)) {
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [azertyMode]);

    //////////////////////////////////////////////////////////
    ////////////////////// Main update ///////////////////////
    //////////////////////////////////////////////////////////

    useFrame((_, delta) => {
        if (!controllerRef.current || !cameraRef.current) {
            return;
        }

        const frameDelta = Math.min(delta, 0.05);

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

        // Resolve input into a normalized movement vector.
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
        if (moveDirection.lengthSq() > 0) {
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

        velocityRef.current.x = moveDirection.x * moveSpeed;
        velocityRef.current.z = moveDirection.z * moveSpeed;

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
        if (collisionsEnabled && collisionOctreeRef.current) {
            // Push the capsule out of scene collisions.
            const collision = collisionOctreeRef.current.capsuleIntersect(capsuleRef.current);

            if (collision) {
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

    //////////////////////////////////////////////////////////
    ///////////////////////// Render /////////////////////////
    //////////////////////////////////////////////////////////

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
