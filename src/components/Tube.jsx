import * as THREE from "three";
import { useRef, useEffect } from "react";

export function Tube() {
    const path = new THREE.CatmullRomCurve3( [                
        new THREE.Vector3( 15, 10, -30 ),
        new THREE.Vector3( 15, 10, -15 ),
        new THREE.Vector3( 15, 10, 0 ),
]);

    const meshMaterial = useRef()
    useEffect(() => {
        meshMaterial.current.wireframe = true;
        meshMaterial.current.visible = true;
        meshMaterial.current.position = new THREE.Vector3(12, 10.85, 30);
    }, []);

    return(
        <mesh>
            <tubeGeometry args = {[path, 40, 1, 70, false]} />
            <meshStandardMaterial wireframe = "true" ref = {meshMaterial}  attach = "material"/>
        </mesh>
    )
}