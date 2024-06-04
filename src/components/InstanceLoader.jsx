// import React, { useRef, useEffect, useState } from 'react';
// import { useLoader } from '@react-three/fiber';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// import * as THREE from 'three';

// // Creates an animation where instances of objects follow a curve then disappear
// // Objects must be .glb and have their origin at the center of the object (in blender: Object/set origin/geometry to origin)
// export const InstanceLoader = React.memo((props) => {
//     const {
//         instancedObject = "Plant.glb",
//         NumberOfInstances = 5,
//         directionX = 1,
//         directionY = 0,
//         directionZ = 0,
//         distanceBetweenInstances = 5,
//         scale = 0.1,
//         rotationLimit = [Math.PI, Math.PI, Math.PI],
//         customDistance = [3,5,5,6,7],
//         customScale = [0.1,0.2,0.3,0.4,0.5],
//         customRotation = [[0.2,0.2,0.2],[2.1,1.2,2.1]]
//     } = props;//dssdsss

//     const meshRef = useRef();
//     const object3D = new THREE.Object3D();

//     // Load the object to be instanced
//     const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + instancedObject);

//     const [geometry, setGeometry] = useState(null);
//     const [material, setMaterial] = useState(null);

//     // Initialize the mesh
//     useEffect(() => {
//         if (gltf) {
//             const mesh = gltf.scene.children.find(child => child.isMesh);
//             if (mesh) {
//                 setGeometry(mesh.geometry);
//                 setMaterial(mesh.material);
//             }
//         }
//     }, [gltf]);

//     // Spawn instances
//     useEffect(() => {
//         if (!geometry || !material || !meshRef.current) return;

//         for (let i = 0; i < NumberOfInstances; i++) {
//             const positionX = i < customDistance.length ? i * customDistance[i] * directionX : i * directionX * distanceBetweenInstances;
//             const positionY = i < customDistance.length ? i * customDistance[i] * directionY : i * directionY * distanceBetweenInstances;
//             const positionZ = i < customDistance.length ? i * customDistance[i] * directionZ : i * directionZ * distanceBetweenInstances;

//             const rotation = i < customRotation.length
//                 ? new THREE.Euler(customRotation[i][0], customRotation[i][1], customRotation[i][2])
//                 : new THREE.Euler(
//                     (Math.random() * 2 - 1) * rotationLimit[0],
//                     (Math.random() * 2 - 1) * rotationLimit[1],
//                     (Math.random() * 2 - 1) * rotationLimit[2]
//                 );

//             const instanceScale = i < customScale.length
//                 ? new THREE.Vector3(customScale[i], customScale[i], customScale[i])
//                 : new THREE.Vector3(scale, scale, scale);

//             object3D.position.set(positionX, positionY, positionZ);
//             object3D.rotation.copy(rotation);
//             object3D.scale.copy(instanceScale);
//             object3D.updateMatrix();

//             meshRef.current.setMatrixAt(i, object3D.matrix);
//         }

//         meshRef.current.instanceMatrix.needsUpdate = true;
//     }, [geometry, material, NumberOfInstances, directionX, directionY, directionZ, distanceBetweenInstances, scale, rotationLimit, customDistance, customScale, customRotation]);

//     if (!geometry || !material) return null; // Ensure geometry and material are loaded

//     return (
//         <>
//             <instancedMesh ref={meshRef} args={[geometry, material, NumberOfInstances]} />
//         </>
//     );
// });




import React, { useRef, useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

// Creates an animation where instances of objects follow a curve then disappear
// Objects must be .glb and have their origin at the center of the object (in blender: Object/set origin/geometry to origin)
export const InstanceLoader = React.memo((props) => {
    const {
        instancedObject = "Cube.glb",
        NumberOfInstances = 5,
        directionX = 1,
        directionY = 0,
        directionZ = 0,
        distanceBetweenInstances = 5,
        scale = 0.3,
        rotationLimit = [Math.PI, Math.PI, Math.PI],
        customDistance = [],
        customScale = [],
        customRotation = [],
        customColors = [0x1613d1,0xcff55d] // Custom colors, object must not have a applied Material
    } = props;

    const meshRef = useRef();
    const object3D = new THREE.Object3D();

    // Load the object to be instanced
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + instancedObject);

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

    // Spawn instances
    useEffect(() => {
        if (!geometry || !material || !meshRef.current) return;

        const colorArray = new Float32Array(NumberOfInstances * 3); // RGB values for each instance

        for (let i = 0; i < NumberOfInstances; i++) {
            const positionX = i < customDistance.length ? customDistance[i] * directionX : i * directionX * distanceBetweenInstances;
            const positionY = i < customDistance.length ? customDistance[i] * directionY : i * directionY * distanceBetweenInstances;
            const positionZ = i < customDistance.length ? customDistance[i] * directionZ : i * directionZ * distanceBetweenInstances;

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
    }, [geometry, material, NumberOfInstances, directionX, directionY, directionZ, distanceBetweenInstances, scale, rotationLimit, customDistance, customScale, customRotation, customColors]);

    if (!geometry || !material) return null; // Ensure geometry and material are loaded

    return (
        <>
            <instancedMesh ref={meshRef} args={[geometry, material, NumberOfInstances]} />
        </>
    );
});
