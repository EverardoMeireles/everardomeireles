import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * @param {Array<any>} [position] - Position in the scene.
 * @param {Array<any>} [scale] - Scale value.
 * @param {*} scene - Scene object used by this component.
 * @param {string} [linkedObjectName] - Linked object name.
 * @param {*} children - Children rendered inside this component.
 */
export const ObjectLink = React.memo((props) => {
  const {position = [0, 0, 0]} = props;
  const {scale = [1, 1, 1]} = props;
  const {scene} = props;
  const {linkedObjectName = "Lamp"} = props;
  const {children} = props;

  const containerRef = useRef();
  const childRef = useRef();

  useFrame(() => {
    if (containerRef.current && scene?.nodes?.[linkedObjectName]) {
      const object = scene.nodes[linkedObjectName];
      object.updateMatrixWorld();

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();

      object.getWorldPosition(worldPos);
      object.getWorldQuaternion(worldQuat);

      containerRef.current.position.copy(worldPos);
      containerRef.current.quaternion.copy(worldQuat);
    }
  });

  return (
    <group ref={containerRef}>
      <group ref={childRef} position={position} scale={scale}>
        {children}
      </group>
    </group>
  );
});

ObjectLink.displayName = "ObjectLink";
