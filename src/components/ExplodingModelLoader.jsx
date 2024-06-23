import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import React from "react";
import { Vector3 } from 'three';

export const ExplodingModelLoader = React.memo((props) => {
    const { position = [0, 0, 0], sceneName = "threeJsScene.glb", enableRockingAnimation = true, enableExplodeAnimation = true } = props;
    const useStore = props.useStore; // Using useStore from props
    
    // Load Model
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + sceneName);

    const { camera, gl } = useThree();
    const setToolTipCirclePositions = useStore((state) => state.setToolTipCirclePositions);
    const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);

    const [rock, setRock] = useState(true);
    const [explode, setExplode] = useState(false);
    const [explodeAnimationEnded, setExplodeAnimationEnded] = useState(false);
    const [initialPositions, setInitialPositions] = useState({});
    const [desiredPositions, setDesiredPositions] = useState({});
    const [childInitialPositions, setChildInitialPositions] = useState({});
    const [childDesiredPositions, setChildDesiredPositions] = useState({});
    const [animationTick, setAnimationTick] = useState(0);
    const [childAnimationTick, setChildAnimationTick] = useState(0);
    const [hasChildAnimation, setHasChildAnimation] = useState(false);

    const rockingTransitionDuration = 2000; // Duration in milliseconds for rocking animation
    const transitionDuration = 3000; // Duration in milliseconds for exploding animation
    const rockingMaxAngle = Math.PI / 8; // Maximum angle for rocking

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function easeInCubic(t) {
        return Math.pow(t, 3);
    }

    function getInitialPositions(model) {
        var currentPositions = {}

        model.scene.children.forEach((mesh) => {
            currentPositions[mesh.name] = mesh.position.clone(); // Use clone to create a copy
        });
        return currentPositions;
    }

    function getDesiredPositions(currentPositions) {
        var zIndexTable = {
            0: -1,
            1: 0,
            2: 1
        }
        var nameSubstring = ""
        var DirectionValue = "";
        var zIndexValue = 0;
        var incrementValue = 0;
        var incrementVector = new THREE.Vector3(0, 0, 0);
        var newPositions = {}

        Object.keys(currentPositions).forEach((name) => {
            nameSubstring = name.slice(-4); // take the 4 characters at the end of the model's name to extract the values
            zIndexValue = zIndexTable[parseInt(nameSubstring[0], 10)];
            DirectionValue = nameSubstring[1] + nameSubstring[2];
            incrementValue = parseInt(nameSubstring[3], 10);

            switch (DirectionValue) {
                case 'TL':
                    incrementVector = new THREE.Vector3(-1, 1, zIndexValue);
                    break;

                case 'TT':
                    incrementVector = new THREE.Vector3(0, 1, zIndexValue);
                    break;

                case 'TR':
                    incrementVector = new THREE.Vector3(1, 1, zIndexValue);
                    break;

                case 'LL':
                    incrementVector = new THREE.Vector3(-1, 0, zIndexValue);
                    break;

                case 'MM':
                    incrementVector = new THREE.Vector3(0, 0, zIndexValue);
                    break;

                case 'RR':
                    incrementVector = new THREE.Vector3(1, 0, zIndexValue);
                    break;

                case 'BL':
                    incrementVector = new THREE.Vector3(-1, -1, zIndexValue);
                    break;

                case 'BB':
                    incrementVector = new THREE.Vector3(0, -1, zIndexValue);
                    break;

                case 'BR':
                    incrementVector = new THREE.Vector3(1, -1, zIndexValue);
                    break;

                default:
                    incrementVector = new THREE.Vector3(0, 0, 0);
            }

            // Clone the current position to avoid mutating the original object
            let newPosition = currentPositions[name].clone();

            newPositions[name] = newPosition.add(incrementVector.multiplyScalar(incrementValue*4));
        });

        return newPositions;
    }

    function getChildrenInitialPositions(model) {
        var currentPositions = {}

        model.scene.children.forEach((mesh) => {
            mesh.children.forEach((child) => {
                currentPositions[child.name] = child.position.clone(); // Use clone to create a copy for children
            });
        });
        return currentPositions;
    }

    useEffect(() => {
        if (gltf) {
            const initialPositions = getInitialPositions(gltf);
            const desiredPositions = getDesiredPositions(initialPositions);
            setInitialPositions(initialPositions);
            setDesiredPositions(desiredPositions);
        }
    }, [gltf]);

    const updateToolTipCirclePositions = () => {
        const positions = {};
        tooltipCirclesData.forEach((data) => {
            const objectName = data.objectName;
            const object = gltf.scene.getObjectByName(objectName);
            if (object) {
                const vector = new THREE.Vector3();
                object.getWorldPosition(vector);
                vector.project(camera);

                // Convert the normalized device coordinates (NDC) to screen space percentages
                const x = (vector.x * 0.5 + 0.5) * 100; // Percentage of width
                const y = (vector.y * -0.5 + 0.5) * 100; // Percentage of height
console.log("sq")
                positions[objectName] = [x, y];
            }
        });
        setToolTipCirclePositions(positions);
    };

    useEffect(() => {
        const handleControlsChange = () => {
            if (explodeAnimationEnded) {
                updateToolTipCirclePositions();
            }
        };

        // Assuming you are using OrbitControls
        const controls = camera.controls;
        if (controls) {
            controls.addEventListener('change', handleControlsChange);
        }

        return () => {
            if (controls) {
                controls.removeEventListener('change', handleControlsChange);
            }
        };
    }, [camera, gltf, explodeAnimationEnded]);

    // move animation
    useFrame((state, delta) => {
        if (enableRockingAnimation && rock && animationTick <= 1) {
            setAnimationTick(prev => Math.min(prev + (delta / (rockingTransitionDuration / 1000)), 1));
            const easedTick = easeInCubic(animationTick);

            gltf.scene.children.forEach((mesh) => {
                const randomX = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
                const randomY = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
                const randomZ = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
                mesh.rotation.set(randomX, randomY, randomZ);
            });

            if (animationTick >= 1) {
                setRock(false);
                setExplode(enableExplodeAnimation);
                setAnimationTick(0); // Reset animation tick for the next animation

                // Reset rotations to initial values
                gltf.scene.children.forEach((mesh) => {
                    mesh.rotation.set(0, 0, 0);
                });
            }
        } else if (enableExplodeAnimation && explode && animationTick <= 1) {
            setAnimationTick(prev => Math.min(prev + (delta / (transitionDuration / 1000)), 1));
            const easedTick = easeOutCubic(animationTick);

            Object.keys(initialPositions).forEach((name) => {
                const initialPos = initialPositions[name];
                const desiredPos = desiredPositions[name];
                const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
                gltf.scene.getObjectByName(name).position.copy(currentPos);
            });

            if (animationTick >= 1) {
                setExplode(false);
                setExplodeAnimationEnded(true);
                updateToolTipCirclePositions(); // Ensure we update the tooltip positions after the first explode animation

                // Check if there are objects with children
                const childInitialPositions = getChildrenInitialPositions(gltf);
                if (Object.keys(childInitialPositions).length > 0) {
                    const childDesiredPositions = getDesiredPositions(childInitialPositions);
                    setChildInitialPositions(childInitialPositions);
                    setChildDesiredPositions(childDesiredPositions);
                    setHasChildAnimation(true);
                    setChildAnimationTick(0); // Reset child animation tick
                }
            }
        } else if (hasChildAnimation && childAnimationTick <= 1) {
            setChildAnimationTick(prev => Math.min(prev + (delta / (transitionDuration / 1000)), 1));
            const easedTick = easeOutCubic(childAnimationTick);

            Object.keys(childInitialPositions).forEach((name) => {
                const initialPos = childInitialPositions[name];
                const desiredPos = childDesiredPositions[name];
                const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
                gltf.scene.getObjectByName(name).position.copy(currentPos);
            });

            if (childAnimationTick >= 1) {
                setHasChildAnimation(false);
                updateToolTipCirclePositions(); // Ensure we update the tooltip positions after child animations end
            }
        }
    });

    return (
        <Suspense fallback={null}>
            <primitive position={position} object={gltf.scene} />
        </Suspense>
    );
});