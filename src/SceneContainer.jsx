import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense, useState, useRef, useEffect } from "react";
import { Test_scene } from "./Test_scene";
// import { Tube } from "./Tube";
import {useSpring, a} from '@react-spring/three'
import * as THREE from "three";
import { useThree } from '@react-three/fiber'


export function SceneContainer() {

    const path = new THREE.CatmullRomCurve3( [
        new THREE.Vector3( 0, 0, 0 ),
        new THREE.Vector3( 5, -5, 5 ),
        new THREE.Vector3( 10, 0, 10 )
    ] );

    const [active, setActive] = useState(false)

    var p0 = path.getPointAt(0);
    var p1 = path.getPointAt(1);
    const props = useSpring({
        scale : active ? [25, 25, 25] : [1, 1, 1],
        position: active ? [p1.x,p1.y,p1.z] : [p0.x,p0.y,p0.z]
    
})
    const Tube = () => {
        return(
            <a.mesh
                onClick={() => setActive(!active)}
                // position={props.position}
            >
                <tubeGeometry args={[path, 70, 2, 50, false]} />
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </a.mesh>
        )
    }

    const Box = () => {
        return(
            <a.mesh
                onClick={() => setActive(!active)}
                position={props.position}
            >
                <boxGeometry />
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </a.mesh>
        )
    }

    const Camera1 = () => {
        // const camera = useThree((state) => state.camera)
        var camPos = new THREE.Vector3(12, 10.85, 30);       // Holds current camera position
        var targetPos = new THREE.Vector3(10, 10, -10);// Target position
        var origin = new THREE.Vector3(98, 99, 87);       // Optional origin
        const cam = useRef()
        useEffect(() => {
            console.log(cam);
          }, [])
        function animate(){
            // // Interpolate camPos toward targetPos
            // camPos.lerp(targetPos, 0.05);

            // // // Apply new camPos to your camera
            // state.camera.position.copy(camPos);
        
            // (Optional) have camera look at the origin after it's been moved
            // state.camera.lookAt(origin);
        
            // render();
            camPos.x = 888;
            // cam.current.position = 12
            


        }
        animate();
        return(
            <PerspectiveCamera ref={cam} makeDefault fov={50} position={camPos} />

            

        )
    }

    return(
        <Suspense fallback={null}>
            <ambientLight/>
            <Environment background={"only"} files={process.env.PUBLIC_URL + "/textures/bg.hdr"} />
            <Environment background={false} files={process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
            <Box


            ></Box>
            {/* <PerspectiveCamera makeDefault fov={50} position={props.position} /> */}
            {/* <PerspectiveCamera makeDefault fov={50} position={[12, 10.85, 30]} /> */}
            <Camera1></Camera1>
            <OrbitControls target={[1, 5, 0]} maxPolarAngle={Math.PI * 0.5}/>
            <Test_scene/>
            <Tube
            // scale = {props.scale}
            ></Tube>
            {/* <Tube
                onClick={() => setActive(!active)}
            >

            </Tube> */}
        </Suspense>
    );
}