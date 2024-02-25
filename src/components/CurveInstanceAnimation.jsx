import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

// Creates a animation where instances of objects follow a curve then dissapear
// Objects must be .glb and have their origin at the center of the object (in blender: Object/set origin/geometry to origin)
export const CurveInstanceAnimation = React.memo((props) => {
    const { instanceInterval = 500, instanceSpeed = 0.005, instancedObject, position } = props;
    const curve = props.curve || new THREE.CatmullRomCurve3([
        new THREE.Vector3(-500, 40, 20),
        new THREE.Vector3(47, 20, -20),
        new THREE.Vector3(47, 40, -40),
    ]);

    const meshRef = useRef();
    const [instancesData, setInstancesData] = useState([]);
    const object3D = new THREE.Object3D();

    // Load the GLTF model
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + instancedObject);
    const gltf2 = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/Box.glb');
    const [geometry, setGeometry] = useState(null);
    const [material, setMaterial] = useState(null);

    useEffect(() => {
        if (gltf) {
        const mesh = gltf.scene.children.find(child => child.isMesh);
        if (mesh) {
            setGeometry(mesh.geometry);
            setMaterial(mesh.material);
        }
        }
    }, [gltf]);

    const makeInstance = () => {
        const initialRotation = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        setInstancesData(prev => [...prev, { point: 0, rotation: initialRotation }]);
    };

    const destroyInstance = (index) => {
        setInstancesData(prev => prev.filter((_, i) => i !== index));
    };

    const updateInstances = () => {
        
        if (!meshRef.current){
            return;
        } // Check if meshRef.current is available

        instancesData.forEach((data, index) => {
        const { point, rotation } = data;
        if (point >= 1) {
            destroyInstance(index);
        } else {
            const position = curve.getPointAt(point);
            object3D.position.copy(position);
            rotation.x += 0.01;
            rotation.y += 0.01;
            rotation.z += 0.01;
            object3D.rotation.copy(rotation);
            object3D.updateMatrix();
            meshRef.current.setMatrixAt(index, object3D.matrix);
        }
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    };

    useFrame(() => {
        if (!meshRef.current){
            return;
        }; // Safeguard to ensure meshRef is available

        const newData = instancesData.map(data => ({
        ...data,
        point: data.point + instanceSpeed,
        })).filter(data => data.point <= 1);
        setInstancesData(newData);
        updateInstances();
    });

    useEffect(() => {
        const spawnInstance = () => {
            makeInstance(); // Call the function to make an instance
            console.log("MakeInstance")
            // Schedule the next instance spawn
            setTimeout(spawnInstance, instanceInterval);
        };
    
        // Start the first instance spawn
        const timeoutId = setTimeout(spawnInstance, instanceInterval);
    
        // Cleanup function to clear the timeout when the component unmounts or the instanceInterval changes
        return () => clearTimeout(timeoutId);
    }, [instanceInterval]); // Dependencies array ensures this effect runs again if instanceInterval changes

    if (!geometry || !material) return null; // Ensure geometry and material are loaded
    return (
        <instancedMesh position={position} ref={meshRef} args={[geometry, material, instancesData.length]}>
        </instancedMesh>
    );
});