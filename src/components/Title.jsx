import { useCallback } from "react";
import { Text3D, Center, Text} from "@react-three/drei";
import * as THREE from "three";

export function Title(props) {
    // default prop values:
    const {initialPosition = [0,0,0]} = props;
    const {fontFileName = "/roboto.json"} = props;
    const {textSize = 0.600} = props;
    const {rotation = Math.PI/2} = props;

    const callbackRef = useCallback(
        ref => ref != null ? (ref.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), (rotation))) : console.log("skip render")
        )

    return(
    <mesh
    // onPointerOver={() => setHover(true)}
    // onPointerOut={() => setHover(false)}
    position = {initialPosition}
    ref = {callbackRef}
    >
        <Text
            // ref = {textCallbackRef}
            scale={[10, 10, 10]}
            // color="black" // default
            anchorX="left" // default
            // anchorY="top" // default
            position = {[-0.6, 0.2, 0]}
        >
            {"Everardo Meireles"}
            <meshStandardMaterial/>
        </Text>
        <Text
            // ref = {textCallbackRef}
            scale={[10, 10, 10]}
            // color="black" // default
            anchorX="left" // default
            // anchorY="top" // default
            position = {[-1.4, -0.8, 0]}
        >
            {"Développeur fullstack"}
            <meshStandardMaterial/>
        </Text>
    </mesh>
    );
}
