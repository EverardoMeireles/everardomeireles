import { useCallback } from "react";
import { Text} from "@react-three/drei";
import * as THREE from "three";
import config from '../config';

/**
 * Purpose: Renders the static portfolio title text in 3D.
 * Relationships: Standalone text component that uses drei Text and the configured font asset.
 * Example:
 * <Title initialPosition={[0, 0, 0]} rotation={Math.PI / 2} font="KFOmCnqEu92Fr1Mu4mxM.woff" />
 * @param {Array<any>} [initialPosition] - Position value for initial position.
 * @param {number} [rotation] - Rotation in radians.
 * @param {number} [font] - Font file path.
 */
export function Title(props) {
    // Example: [0, 0, 0]
    const {initialPosition = [0,0,0]} = props;

    // Example: Math.PI / 2
    const {rotation = Math.PI/2} = props;

    // Example: config.resource_path + "KFOmCnqEu92Fr1Mu4mxM.woff"
    const {font = config.resource_path + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : undefined
    ,[]);

    return(
    <mesh
    position = {initialPosition}
    ref = {callbackRef}
    >
        <Text
            font={font}
            scale={[10, 10, 10]}
            anchorX="left"
            position = {[-0.6, 0.2, 0]}
        >
            {"Everardo Meireles"}
            <meshStandardMaterial/>
        </Text>
        <Text
            font={font}
            scale={[10, 10, 10]}
            anchorX="left"
            position = {[-1.4, -0.8, 0]}
        >
            {"Développeur fullstack"}
            <meshStandardMaterial/>
        </Text>
    </mesh>
    );
}
