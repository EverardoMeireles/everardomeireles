import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import config from '../config';

// Creates a animation where instances of objects follow a curve then dissapear
// Objects must be .glb and have their origin at the center of the object (in blender: Object/set origin/geometry to origin)
export const CurveInstanceAnimation = React.memo((props) => {
    const {instanceInterval = 500} = props; // time in milliseconds between instancing objects
    const {instanceSpeed = 0.001} = props; // the speed of the animation
    const {instancedObject = "placeholder.glb"} = props; // the name of the model, placed inside public/models
    const {curveNumber = 1 } = props; // number of curves(maximum 9), they will be instanciated around the initial curve
    const {offSetAxis1 = "z"} = props; // the first axis that the curve is facing
    const {offSetAxis2 = "y"} = props; // the second axis that the curve is facing
    const {curveOffsetValueX = 10 } = props; // Value which the instances will be offset in the x axis
    const {curveOffsetValueY = 10 } = props; // Value which the instances will be offset in the y axis
    const {curveOffsetValueZ = 10 } = props; // Value which the instances will be offset in the z axis
    const {tubeWireframe = false } = props; // show the wireframe tube for debugging purposes
    const {wireframeColor = 0xffffff} = props; // Set the color of the wireframe for debugging purposes i.e: "red" or 0xff0000
    const {includeReverse = true} = props; // Show instances animating in reverse half of the time
    const {curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
    ])} = props; // the initial curve that the instances will travel along

    const meshRef = useRef();
    const [instancesData, setInstancesData] = useState([]);
    const object3D = new THREE.Object3D();

    // Load the GLTF model
    const gltf = useLoader(GLTFLoader, config.resource_path + 'models/' + instancedObject);

    const [geometry, setGeometry] = useState(null);
    const [material, setMaterial] = useState(null);
    const offsetCurves = useRef([]);

    const Tube = ({ curve }) => {
    const meshRef = useRef();
    const tubeGeometry = useMemo(() => {
        const tube = new THREE.TubeGeometry(curve, 20, 2, 8, false);
        return tube;
    }, [curve]);
    
    return <mesh ref={meshRef} geometry={tubeGeometry} material={new THREE.MeshBasicMaterial({ wireframe: true, color: wireframeColor})} />;
    };
    
    // Positions of the curves
    const curveOffsets = [
        [0, 0], // Center
        [1, 0], // Right
        [-1, 0], // Left
        [0, 1], // Top
        [0, -1], // Bottom
        [1, 1], // Top-Left
        [-1, 1], // Top-Right
        [-1, -1], // Bottom-Right
        [1, -1], // Bottom-Left
    ];
    
      // Create all the curves
    useEffect(() => {
        offsetCurves.current = curveOffsets.map(offset => {
        const newPoints = curve.points.map(point => {
            const newPoint = point.clone();
            // Set the points that the curves will be offset according to the direction of the curve on certain axies using props
            switch(offSetAxis1){
            case "x":
                newPoint.x += offset[0] * curveOffsetValueX;

            break;
            case "y":
                newPoint.y += offset[0] * curveOffsetValueY;

            break;
            case "z":
                newPoint.z += offset[0] * curveOffsetValueZ;
            break;
            }

            switch(offSetAxis2){
            case "x":
                newPoint.x += offset[1] * curveOffsetValueX;

            break;
            case "y":
                newPoint.y += offset[1] * curveOffsetValueY;

            break;
            case "z":
                newPoint.z += offset[1] * curveOffsetValueZ;
            break;
            }

            return newPoint;
        });
        return new THREE.CatmullRomCurve3(newPoints);
        });
        
        // Remove excess curves
        for(let i = 0; i < 9 - curveNumber; i++){
        offsetCurves.current.pop();
        }
    }, []);

    // initialize the mesh
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
        const isDirectionReversed = Math.random() < 0.5;
        setInstancesData(prev => [...prev, { reverse: includeReverse ? isDirectionReversed : false, point: isDirectionReversed ? 1 : 0, rotation: initialRotation, curveIndex: Math.round(Math.random() * offsetCurves.current.length - 1)}]);
    };

    const destroyInstance = (index) => {
        setInstancesData(prev => prev.filter((_, i) => i !== index));
    };

    const updateInstances = () => {
        if (!meshRef.current){
            return;
        } // Check if meshRef.current is available

        instancesData.forEach((data, index) => {
        const {reverse, point, rotation, curveIndex } = data;
        if ((reverse && point <= 0) || (!reverse && point >= 1)) {
            destroyInstance(index);
        } else {
        let position;
        if(offsetCurves.current.length == 0 || curveIndex == -1){
            position = offsetCurves.current[0].getPointAt(point)
        }else{
            position = offsetCurves.current[curveIndex].getPointAt(point);
        }

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
        point: data.point + (data.reverse ? -instanceSpeed : instanceSpeed), //increment or decrement the position depending on the instance's reverse property
        })).filter(data => (data.point <= 1 || data.point <= 0)); //Additional filtering step for redundancy, not actually necessary
        console.log(newData)
        setInstancesData(newData);
        updateInstances();
    });

    // Setting up the timer in to spawn new instances
    useEffect(() => {
        const spawnInstance = () => {
            makeInstance(); // Call the function to make an instance
            setTimeout(spawnInstance, instanceInterval);
        };
    
        // Start the first instance spawn
        const timeoutId = setTimeout(spawnInstance, instanceInterval);
    
        // Cleanup function to clear the timeout when the component unmounts or the instanceInterval changes
        return () => clearTimeout(timeoutId);
    }, [instanceInterval]); // Dependencies array ensures this effect runs again if instanceInterval changes

    if (!geometry || !material) return null; // Ensure geometry and material are loaded

    return (
    <>
        {tubeWireframe && offsetCurves.current.map((curve, index) => (
        <Tube key={index} curve={curve} />
        ))}

        <instancedMesh ref={meshRef} args={[geometry, material, instancesData.length]}>
        </instancedMesh>
    </>
    );
});

CurveInstanceAnimation.displayName = "CurveInstanceAnimation";