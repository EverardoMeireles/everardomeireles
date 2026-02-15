import * as THREE from "three";
import React, { useEffect, useState } from "react";
import config from '../config';

/**
 * @param {Array<any>} [position] - position on the scene.
 * @param {Array<any>} [rotation] - rotation on the scene.
 * @param {Array<any>} [planeDimensions] - width and height of the video "screen".
 * @param {string} [defaultVideo] - [video name, ""] name of the default video without the extension, or empty string for no default video.
 * @param {boolean} [loop] - [true, false] - loops video.
 * @param {boolean} [muted] - [true, false] - loops video.
 * @param {number} [delay] - delay in ms before triggered video is removed from memory, this prevents memory leaks.
 * @param {boolean} [triggerMode] - [true, false] - wether the video being played is triggered.
 * @param {string} [triggerType] - [valueString, triggerTrue] - valueString will play a video when the value of "trigger" prop is the same as the video name, triggerTrue will play the video the "trigger" prop is...
 * @param {*} trigger - trigger to play video, either a string equal to the video name or a boolean state.
 */
export function VideoLoader (props) {
    const {position = [0, 0, 0]} = props;
    const {rotation = [0, 0, 0]} = props;
    const {planeDimensions = [0, 0]} = props;
    const {defaultVideo = "Javascript"} = props;
    const {loop = true} = props;
    const {muted = true} = props;
    const {delay = 10000} = props;
    const {triggerMode = true} = props;
    const {triggerType = "valueString"} = props;
    const {trigger} = props;
    
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
