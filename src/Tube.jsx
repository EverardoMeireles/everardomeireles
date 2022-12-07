import {CustomSinCurve} from "./CustomSinCurve";
import * as THREE from "three";
import {useState} from "react";
export function Tube() {
    const [active, setActive] = useState(false)

    // const path = new CustomSinCurve( 6 );
    const path = new THREE.CatmullRomCurve3( [
        new THREE.Vector3( 0, 0, 0 ),
        new THREE.Vector3( 5, -5, 5 ),
        new THREE.Vector3( 10, 0, 10 )
    ] );

    return(
    <mesh>
        onClick={() => setActive(!active)}
        <tubeGeometry args={[path, 70, 2, 50, false]} />
        <meshStandardMaterial attach="material" color={0x00ff00}/>;
    </mesh>
    );
}