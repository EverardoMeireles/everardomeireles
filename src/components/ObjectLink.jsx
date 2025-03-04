import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// This component links meshes and primitives passed as their children an object in a given scene,
// mirroring its position and rotation transforms
export const ObjectLink = React.memo((props) => {
  const {position = [0, 0, 0]} = props; // The position of the object
  const {scale = [1, 1, 1]} = props; // The position of the object
  const {scene = undefined} = props; // The scene in which the object you want to link to is located
  const {linkedObjectName = "Lamp"} = props; // The scene in which the object you want to link to is located

  const cubeRef = useRef();

  useFrame(() => {
    if (cubeRef.current && scene?.nodes?.[linkedObjectName]) {
      // Get the object node from the scene using the linkedObjectName prop.
      const object = scene.nodes[linkedObjectName];

      // Ensure the object's world matrix is up-to-date.
      object.updateMatrixWorld();

      // Create temporary objects to hold world values.
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();

      // Retrieve the object's world position and quaternion.
      object.getWorldPosition(worldPos);
      object.getWorldQuaternion(worldQuat);

      // Copy the values into the container.
      cubeRef.current.position.copy(worldPos);
      cubeRef.current.quaternion.copy(worldQuat);
    }
  });

  return (
    <mesh ref={cubeRef}>
      <mesh position={position} scale={scale}>
        {props.children}
      </mesh>
    </mesh>
  );
});
