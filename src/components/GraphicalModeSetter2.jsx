import { useFrame } from '@react-three/fiber';
import { getGPUTier } from 'detect-gpu';
import React,{ useEffect } from "react";
import { graphicsModes } from "../Helper";
import useSystemStore from "../SystemStore";

// set graphical by performing a gpu ier test, a fps check and a hardware acceleration check
export const GraphicalModeSetter2 = React.memo((props) => {
    // const {numberOfPasses = 1} = props;
    const {fpsToDecreaseGraphics = 45} = props;
    const {fpsToShutdownCanvas = 10} = props;
    const {redirectToFallbackPage = true} = props;
    const {fallbackMode = 'disableRender'} = props; // if site is unusable, exit. disableRender or fallbackPage
    const {fallBackPageName = "HardwareAcceleration.html"} = props;

    const currentGraphicalMode = useSystemStore((state) => state.currentGraphicalMode);
    const setGraphicalMode = useSystemStore((state) => state.setGraphicalMode);
    const setForceDisableRender = useSystemStore((state) => state.setForceDisableRender);
    // const setFinishedBenchmark = useSystemStore((state) => state.setFinishedBenchmark);    
    
    useEffect(() => {(async () => {
        let HardwareAccelerationCheckPassed = true;
        const gpuTier = await getGPUTier({benchmarksURL:"benchmarks"});

        // Webgl support check
        if(gpuTier.type === "WEBGL_UNSUPPORTED" || gpuTier.tier === 0){
            HardwareAccelerationCheckPassed = false;
        }
        
        // Fps benchmark test
        if(gpuTier.fps < 5){
            HardwareAccelerationCheckPassed = false;
        }

        // unknown gpu vendor check
        if(!gpuTier.gpu.includes("intel") && 
        !gpuTier.gpu.includes("nvidia") && 
        !gpuTier.gpu.includes("amd") && 
        !gpuTier.gpu.includes("apple m1") && 
        !gpuTier.gpu.includes("apple m2") && 
        !gpuTier.gpu.includes("apple a14")){
            HardwareAccelerationCheckPassed = false;
        }
    })()},[])

    let accuDeltasForFPS = 0;
    let accuFramesForFPS = 0;
    let accuDeltas = 0;
    // let skipHardwareAccelerationCheck = false;

    let FPSArray = []; //useRef?

    // calculate framerate to check if the gpu tier check was enough to get acceptable framerate
    useFrame((state, delta)=>{
        accuDeltasForFPS += delta;
        accuFramesForFPS += 1;
        accuDeltas += delta;

        if(accuDeltasForFPS >= 1){
            FPSArray.push(accuFramesForFPS);
            accuDeltasForFPS = 0;
            accuFramesForFPS = 0;
        }

        // console.log("deltas: " + accuDeltasForHardwareAccelerationCheck);
        // console.log("frames: " + accuFramesForHardwareAccelerationCheck);

        // if after 3 seconds, the site runs poorly, decrease graphical mode
        if(accuDeltas > 3){
            console.log("entered");
            // Every n frames, calculate the average fps
            const averageFps = FPSArray.reduce((a, b) => a + b, 0) / FPSArray.length;
            console.log(averageFps);

            // decrease the graphics by one tier
            if(averageFps < fpsToDecreaseGraphics){
                if(!["potato", "high"].includes(currentGraphicalMode)){
                    setGraphicalMode(graphicsModes[graphicsModes.indexOf(currentGraphicalMode) - 1]);
                    console.log("GRAPHICS: " + graphicsModes[graphicsModes.indexOf(currentGraphicalMode) - 1])
                }

                // if decreasing graphics is impossible, either redirect to fallback page or disable canvas
                if(currentGraphicalMode == "potato" && averageFps <= fpsToShutdownCanvas){
                    if(redirectToFallbackPage){
                        if(fallbackMode == "disableRender"){
                            setForceDisableRender(true);
                        }
                        else if(fallbackMode == "fallbackPage"){
                            window.location.href = fallBackPageName;
                        }
                        
                    }
                    else{
                        // use a zustand state and conditional rendering in the App.jsx to disable the canvas
                    }
                }
            }

            FPSArray = [];
            accuDeltas = 0;

            // if(pass === numberOfPasses + 1){
            //     setFinishedBenchmark(true);
            // }
        }
    })
})

GraphicalModeSetter2.displayName = "GraphicalModeSetter2";
