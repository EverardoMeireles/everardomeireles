import * as THREE from "three";
// import { Tube } from "./Tube";
import { useSpring, a} from 'react-spring'
import { PerspectiveCamera } from "@react-three/drei";

export function Camera() {




    
    var p0 = Tube.path.getPointAt(0);
    var p1 = Tube.path.getPointAt(1);
    const props = useSpring({
        position : Tube.active ? p1 : p0
    
})
    return(
        <PerspectiveCamera makeDefault fov={50} position={props.position}/*position={[12, 10.85, 30]}*/ />
    );
}