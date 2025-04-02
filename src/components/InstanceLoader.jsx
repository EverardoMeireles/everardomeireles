import React, { useRef, useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import config from '../config';

//////////////////
/// TODO:BEGIN ///
//////////////////

// Apply a material to the loaded glb(Can be a material of the main scene)
    // For a smoother experience, and to avoid future issues, assign a timer to apply the material
//////////////////
/// TODO:END ///
//////////////////

// Creates an animation where instances of objects follow a curve then disappear
// Objects must be .glb and have their origin at the center of the object (in blender: Object/set origin/geometry to origin)
export const InstanceLoader = React.memo((props) => {
    const {
        instancedObject = "Book.glb",
        initialPosition = [0, 0, 0],
        NumberOfInstances = 5,
        directionX = 1,
        directionY = 0,
        directionZ = 0,
        distanceBetweenInstances = 5,
        scale = 1,
        rotationLimit = [Math.PI, Math.PI, Math.PI],
        customDistance = [],
        customScale = [],
        customRotation = [],
        customColors = [0x1613d1, 0xcff55d], // Custom colors, object must not have an applied Material
        customPosition = [] // Custom positions, value is ignored if equal to initialPosition's value
    } = props;

    const meshRef = useRef();
    const object3D = new THREE.Object3D();

    // Load the object to be instanced
    const gltf = useLoader(GLTFLoader, config.resource_path + '/models/' + instancedObject);

    const [geometry, setGeometry] = useState(null);
    const [material, setMaterial] = useState(null);

    // Initialize the mesh
    useEffect(() => {
        if (gltf) {
            const mesh = gltf.scene.children.find(child => child.isMesh);
            if (mesh) {
                setGeometry(mesh.geometry);

                // Clone the material and enable vertex colors
                const newMaterial = mesh.material.clone();
                newMaterial.vertexColors = true;
                setMaterial(newMaterial);
            }
        }
    }, [gltf]);

    // Check if positions are equal
    const positionsEqual = (pos1, pos2) => pos1.every((val, index) => val === pos2[index]);

    // Spawn instances
    useEffect(() => {
        if (!geometry || !material || !meshRef.current) return;

        const colorArray = new Float32Array(NumberOfInstances * 3); // RGB values for each instance

        for (let i = 0; i < NumberOfInstances; i++) {
            const useCustomPosition = i < customPosition.length && !positionsEqual(customPosition[i], initialPosition);

            const positionX = useCustomPosition ? customPosition[i][0] : initialPosition[0] + (i < customDistance.length ? customDistance[i] * directionX : i * directionX * distanceBetweenInstances);
            const positionY = useCustomPosition ? customPosition[i][1] : initialPosition[1] + (i < customDistance.length ? customDistance[i] * directionY : i * directionY * distanceBetweenInstances);
            const positionZ = useCustomPosition ? customPosition[i][2] : initialPosition[2] + (i < customDistance.length ? customDistance[i] * directionZ : i * directionZ * distanceBetweenInstances);

            const rotation = i < customRotation.length
                ? new THREE.Euler(customRotation[i][0], customRotation[i][1], customRotation[i][2])
                : new THREE.Euler(
                    (Math.random() * 2 - 1) * rotationLimit[0],
                    (Math.random() * 2 - 1) * rotationLimit[1],
                    (Math.random() * 2 - 1) * rotationLimit[2]
                );

            const instanceScale = i < customScale.length
                ? new THREE.Vector3(customScale[i], customScale[i], customScale[i])
                : new THREE.Vector3(scale, scale, scale);

            object3D.position.set(positionX, positionY, positionZ);
            object3D.rotation.copy(rotation);
            object3D.scale.copy(instanceScale);
            object3D.updateMatrix();

            meshRef.current.setMatrixAt(i, object3D.matrix);

            // Set custom color
            const color = i < customColors.length ? new THREE.Color(customColors[i]) : new THREE.Color(0xffffff); // Default to white if no custom color
            color.toArray(colorArray, i * 3);
        }

        meshRef.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorArray, 3));

        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [geometry, material, NumberOfInstances, directionX, directionY, directionZ, distanceBetweenInstances, scale, rotationLimit, customDistance, customScale, customRotation, customColors, customPosition, initialPosition]);

    if (!geometry || !material) return null; // Ensure geometry and material are loaded

    return (
        <>
            <instancedMesh ref={meshRef} args={[geometry, material, NumberOfInstances]} />
        </>
    );
});
