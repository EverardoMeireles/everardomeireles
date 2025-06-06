import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const ObjectLink = React.memo(({ position = [0, 0, 0], scale = [1, 1, 1], scene, linkedObjectName = "Lamp", children }) => {
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
