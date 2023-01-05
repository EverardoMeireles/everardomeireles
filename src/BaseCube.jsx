import * as THREE from "three";
import {useState} from "react";
import {useSpring, a} from '@react-spring/three';

export function BaseCube({position}) {
    var rand = Math.floor(Math.random() * (500 - 150) + 500);
    var randcolor = Math.floor(Math.random() * (255 - 180) + 180);
        const props = useSpring({
            loop: {reverse:true},
            from: {position:position},
            to: {position:[position[0]+0.1,position[1],position[2]]},
            // immediate:true
            config: {
                duration: rand
            }
        })

    // const [active, setActive] = useState(false)

    // const path = new CustomSinCurve( 6 );

    return(
    <a.mesh
    position = {props.position}
    // rotation={animProps}
    // scale = {animProps}
    >
        <boxGeometry />
        <a.meshStandardMaterial attach="material" color={/*props.color*//*"#"+randcolor*/"rgb("+randcolor+","+ randcolor+","+ randcolor+")"}/>;    
    </a.mesh>
    );
}
