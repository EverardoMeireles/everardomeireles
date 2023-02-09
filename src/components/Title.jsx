import { useCallback } from "react";
import { Text3D, Center} from "@react-three/drei";
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
        <Text3D
            font = {process.env.PUBLIC_URL + fontFileName}
            size = {textSize}
            height = {0.065}
            curveSegments = {2}
        >
            {`Everardo Meireles`}
            <meshStandardMaterial />
        </Text3D>
        <Text3D
            font = {process.env.PUBLIC_URL + fontFileName}
            size = {textSize}
            height = {0.065}
            curveSegments = {2}
            position={[-0.6, -1, 0]}
        >
            {`Développeur fullstack`}
            <meshStandardMaterial />
        </Text3D>
    </mesh>
    );
}
