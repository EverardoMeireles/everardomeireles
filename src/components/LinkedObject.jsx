import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// This component mirrors the Lamp node's position and rotation (as a quaternion)
// from the provided glTF into a cube. An optional pivotOffset is applied to the cube's geometry,
export const LinkedObject = React.memo((props) => {
  const {position = [0, 0, 0]} = props; // The position of the object
  const {scale = [1, 1, 1]} = props; // The position of the object
  const {gltf = undefined} = props; // The scene in which the object you want to link to is located

  const cubeRef = useRef();

  useFrame(() => {
    if (cubeRef.current && gltf?.nodes?.Lamp) {
      // Get the Lamp node from the glTF
      const lamp = gltf.nodes.Lamp;

      // Ensure the lamp's world matrix is up-to-date.
      lamp.updateMatrixWorld();

      // Create temporary objects to hold world values.
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();

      // Retrieve the lamp's world position and quaternion.
      lamp.getWorldPosition(worldPos);
      lamp.getWorldQuaternion(worldQuat);

      // Copy the values into the cube.
      cubeRef.current.position.copy(worldPos);
      cubeRef.current.quaternion.copy(worldQuat);
    }
  });

  return (
    // The outer mesh is updated with the lamp's transform.
    <mesh ref={cubeRef}>
      {/*
        The inner mesh offsets the cube's geometry by the negative of pivotOffset.
        Adjust pivotOffset (in metres) as needed to align the cube's pivot with the lamp's.
      */}
      <mesh position={position}>
        <boxGeometry args={scale} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </mesh>
  );
})