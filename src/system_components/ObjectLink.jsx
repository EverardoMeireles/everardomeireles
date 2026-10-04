import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Purpose: Attaches child content to a named object's world position and rotation.
 * Relationships: Used by SceneContainer to bind effects and lights to named R3F scene objects.
 * Example:
 * <ObjectLink position={[0, 0, 0]} scale={[1, 1, 1]} linkedObjectName="Lamp"><pointLight /></ObjectLink>
 * @param {Array<any>} [position] - Position in the scene.
 * @param {Array<any>} [scale] - Scale value.
 * @param {string} [linkedObjectName] - Linked object name.
 * @param {*} children - Children rendered inside this component.
 */
export const ObjectLink = React.memo((props) => {
  const {position = [0, 0, 0]} = props;

  const {scale = [1, 1, 1]} = props;

  const {linkedObjectName = "Lamp"} = props;
  const {children} = props;

  const scene = useThree((state) => state.scene);
  const containerRef = useRef();
  const worldPosition = useRef(new THREE.Vector3());
  const worldQuaternion = useRef(new THREE.Quaternion());

  useFrame(() => {
    const object = scene.getObjectByName(linkedObjectName);
    if (containerRef.current && object) {
      object.updateMatrixWorld();

      object.getWorldPosition(worldPosition.current);
      object.getWorldQuaternion(worldQuaternion.current);

      containerRef.current.position.copy(worldPosition.current);
      containerRef.current.quaternion.copy(worldQuaternion.current);
    }
  });

  return (
    <group ref={containerRef}>
      <group position={position} scale={scale}>
        {children}
      </group>
    </group>
  );
});

ObjectLink.displayName = "ObjectLink";
