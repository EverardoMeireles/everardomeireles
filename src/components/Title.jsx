import { useCallback } from "react";
import { Text} from "@react-three/drei";
import * as THREE from "three";

export function Title(props) {
    // default prop values:
    const {initialPosition = [0,0,0]} = props;
    const {rotation = Math.PI/2} = props;
    const {font = process.env.PUBLIC_URL + "KFOmCnqEu92Fr1Mu4mxM.woff"} = props;

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : console.log("skip render")
    ,[]); // eslint-disable-line react-hooks/exhaustive-deps

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
