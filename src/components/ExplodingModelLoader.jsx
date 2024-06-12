import { useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import React from "react";

export const ExplodingModelLoader = React.memo((props) => {
    const {position = [0, 0, 0]} = props;
    const {sceneName = "threeJsScene.glb"} = props; // the model/scene's name
    
    // Load Model
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + sceneName);

    const [explode, setExplode] = useState(true);
    const [initialPositions, setInitialPositions] = useState({});
    const [desiredPositions, setDesiredPositions] = useState({});
    const [childInitialPositions, setChildInitialPositions] = useState({});
    const [childDesiredPositions, setChildDesiredPositions] = useState({});
    const [animationTick, setAnimationTick] = useState(0);
    const [childAnimationTick, setChildAnimationTick] = useState(0);
    const [hasChildAnimation, setHasChildAnimation] = useState(false);
    
    const transitionDuration = 1500; // Duration in milliseconds

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
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

            newPositions[name] = newPosition.add(incrementVector.multiplyScalar(incrementValue*5));
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

    // move animation
    useFrame((state, delta) => {
        if (explode && animationTick <= 1) {
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
            }
        }
    });

    return (
        <Suspense fallback={null}>
            <primitive position={position} object={gltf.scene} />
        </Suspense>
    );
});
