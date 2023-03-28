import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useCallback, Suspense } from "react";
import * as THREE from "three";
import React, { useEffect, useRef, useState } from "react";
import { BufferAttribute, Color } from "three";
// import url from ;

export const VideoLoader = React.memo((props) => {
    const {videoList = ["JavaScript", "Python"]} = props;
    const {videoId = "video0"} = props;
    const {dynamicHoverVideo = false} = props;
    const {position = [0, 0, 0]} = props;
    const {rotation = [0, 0, 0]} = props;
    const {planeDimensions = [0, 0]} = props;
    const {alternateVideo = false} = props;
    const {delay = 5000} = props;

    const currentSkillHovered = props.useStore((state) => state.currentSkillHovered);
    
    const [video, setVideo] = useState(() => {
        const vid = document.createElement("video");
        vid.id = videoId;
        vid.src =  /*process.env.PUBLIC_URL + videoName;*/process.env.PUBLIC_URL + currentSkillHovered + ".mp4"
        vid.crossOrigin = "Anonymous";
        vid.loop = true;
        vid.muted = true;
        vid.play();
        return vid;
    });

if(alternateVideo){
    setTimeout(()=>{
        setVideo(() => {
        const vid = document.createElement("video");
        vid.id = videoId;
        vid.src =  /*process.env.PUBLIC_URL + videoName;*/process.env.PUBLIC_URL + videoList[Math.floor(Math.random() * videoList.length)] + ".mp4"
        vid.crossOrigin = "Anonymous";
        vid.loop = true;
        vid.muted = true;
        vid.play();
        return vid;})
    }, delay);
}
    const obj = useRef();

// useFrame(() => {
//     console.log(currentSkillHovered)
// });

    // useEffect(() => {
    //     if(dynamicHoverVideo == false){
    //     try {
    //         setVideo(() => {
    //             const vid = document.createElement("video");
    //             vid.id = videoId;
    //             vid.src =  /*process.env.PUBLIC_URL + videoName;*/process.env.PUBLIC_URL + currentSkillHovered + ".mp4"
    //             vid.crossOrigin = "Anonymous";
    //             vid.loop = true;
    //             vid.muted = true;
    //             vid.play();
    //             return vid;
    //         })
            
    //         console.log(video)
            
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }
    // },[currentSkillHovered])

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