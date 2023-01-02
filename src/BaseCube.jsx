import * as THREE from "three";
import {useState} from "react";

export function BaseCube({position}) {
    
    // const [active, setActive] = useState(false)

    // const path = new CustomSinCurve( 6 );

    return(
    <mesh
    position = {position}>
        <boxGeometry />
        <meshStandardMaterial attach="material" color={0xffffff}/>;    
    </mesh>
    );
}
