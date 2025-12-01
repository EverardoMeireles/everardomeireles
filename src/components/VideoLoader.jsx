import * as THREE from "three";
import React, { useEffect, useState } from "react";
import config from '../config';

export function VideoLoader (props) {
    const {position = [0, 0, 0]} = props; // position on the scene
    const {rotation = [0, 0, 0]} = props; // rotation on the scene
    const {planeDimensions = [0, 0]} = props; // width and height of the video "screen"
    const {defaultVideo = "Javascript"} = props; //[video name, ""] name of the default video without the extension, or empty string for no default video
    const {loop = true} = props; // [true, false] - loops video
    const {muted = true} = props; // [true, false] - loops video
    const {delay = 10000} = props; // delay in ms before triggered video is removed from memory, this prevents memory leaks
    const {triggerMode = true} = props; // [true, false] - wether the video being played is triggered
    const {triggerType = "valueString"} = props; // [valueString, triggerTrue] - valueString will play a video when the value of "trigger" prop is the same as the video name, triggerTrue will play the video the "trigger" prop is a true boolean state
    const {trigger} = props; // trigger to play video, either a string equal to the video name or a boolean state
    
    // initialize video state
    const [video, setVideo] = useState(() => {
        const vid = document.createElement("video");
        if(triggerType !== "triggerTrue" && defaultVideo !== "")
            vid.src =  config.resource_path + defaultVideo + ".mp4";
        vid.crossOrigin = "Anonymous";
        vid.loop = loop;
        vid.muted = muted;
        vid.play();
        return vid;
    });

    // for trigger mode, play video when trigger value changes or goes from false to true depending on triggerType
    useEffect(() => {
        console.log(trigger);
        if(triggerMode === true && trigger !== undefined){
            setVideo(() => {
                const vid = document.createElement("video");
                if(triggerType === "triggerTrue" && trigger === true){
                    vid.src = config.resource_path + defaultVideo + ".mp4";
                }else if(triggerType === "valueString")
                    vid.src = config.resource_path + trigger + ".mp4";

                vid.crossOrigin = "Anonymous";
                vid.loop = loop;
                vid.muted = muted;
                vid.play();
                
                // remove video after delay to prevent memory leak (because of how canvas works, the last frame will
                // always remain unless the pixels are overwritten in the canvas, maybe do this in the future)
                setTimeout(()=>{
                    vid.pause();
                    vid.src="";
                    vid.load();
                }, delay);
                return vid;
            });
    }
    },[trigger]);

    return ( 
    <mesh rotation={rotation} position={position}>
        <planeGeometry args={planeDimensions} />
        <meshBasicMaterial side={THREE.DoubleSide}>
            <videoTexture attach="map" args={[video]} />
        </meshBasicMaterial>
    </mesh>
    )
}