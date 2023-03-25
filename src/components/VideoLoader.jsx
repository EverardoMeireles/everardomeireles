import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useCallback, Suspense } from "react";
import * as THREE from "three";
import React, { useEffect, useRef, useState } from "react";
import { BufferAttribute, Color } from "three";
// import url from ;

export const VideoLoader = React.memo((props) => {
    const {videoName = "background.mp4"} = props;
    const {position = [0, 0, 0]} = props;
    const {rotation = [0, 0, 0]} = props;
    const {planeDimensions = [0, 0]} = props;

    const [video] = useState(() => {
        const vid = document.createElement("video");
        vid.src =  process.env.PUBLIC_URL + videoName;
        vid.crossOrigin = "Anonymous";
        vid.loop = true;
        vid.muted = true;
        vid.play();
        return vid;
    });

    const obj = useRef();

    useEffect(() => {
        console.log(obj)
    })

    return (
    <mesh ref={obj} rotation={rotation} position={position}>
        <planeGeometry args={planeDimensions} />
        <meshBasicMaterial side={THREE.DoubleSide}>
            <videoTexture attach="map" args={[video]} />
            {/* <videoTexture attach="emissiveMap" args={[video]} /> */}
        </meshBasicMaterial>
    </mesh>
    )
})