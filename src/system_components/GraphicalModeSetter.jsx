import { useFrame } from '@react-three/fiber';
import { getGPUTier } from 'detect-gpu';
import React,{ useEffect, useRef } from "react";
import { graphicsModes, CalculateAverageOfArray, increaseOrDecreaseGraphics } from "../Helper";
import SystemStore from "../SystemStore";

// set graphical by performing a gpu ier test, a fps check and a hardware acceleration check
export const GraphicalModeSetter = React.memo((props) => {
    const {enable = true} = props;

    const {fpsThresholdToIncreaseGraphics = 60} = props;// Acceptable fps
    const {fpsThresholdToDecreaseGraphics = 30} = props;// unacceptable fps
    const {deltaCountToIncreaseGraphicsCheck = 6} = props;// n seconds to check if graphics must be increased
    const {deltaCountToDecreaseGraphicsCheck = 3} = props; // n seconds to check if graphics must be decreased

    const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
    const setGraphicalMode = SystemStore((state) => state.setGraphicalMode);
    const enableDynamicGraphicalModeSetting = SystemStore((state) => state.enableDynamicGraphicalModeSetting);

    ////////////////////////////////////////////
    // Initial graphical mode setting section //
    ////////////////////////////////////////////

    useEffect(() => {(async () => {
        let HardwareAccelerationCheckPassed = true;
        const gpuTier = await getGPUTier({benchmarksURL:"benchmarks"});
        // hardware acceleration check, if the user has hardware acceleration disabled, don't set graphical mode
        if(gpuTier.type === "WEBGL_UNSUPPORTED" || gpuTier.tier === 0){
            HardwareAccelerationCheckPassed = false;
        }else{
            if(gpuTier.isMobile){
                if(!gpuTier.fps < 25){
                    HardwareAccelerationCheckPassed = false;
                }
            }
            // else{
            //     if(!gpuTier.gpu.includes("intel") && !gpuTier.gpu.includes("nvidia") && !gpuTier.gpu.includes("amd") && !gpuTier.gpu.includes("apple m1") && !gpuTier.gpu.includes("apple m2") && !gpuTier.gpu.includes("apple a14")){
            //         HardwareAccelerationCheckPassed = false;
            //     }
            // }
        }
        // Sets the graphical mode
        if(HardwareAccelerationCheckPassed){
            // console.log("GRAPHICS index: " + gpuTier.tier);
            setGraphicalMode(graphicsModes[gpuTier.tier]);
        }else{
            window.location.href = "HardwareAcceleration.html?fps=0";
        }
    })()},[])

    ////////////////////////////////////////////
    // Dynamic graphical mode setting section //
    ////////////////////////////////////////////

    const accuDeltasForHardwareAccelerationCheck = useRef(0)
    const accuFramesForHardwareAccelerationCheck = useRef(0)

    let accuDeltasForFPS = 0;
    let accuFramesForFPS = 0;

    // FPS counts are stored here
    let arrayFPSToDecrease = [];
    let arrayFPSToIncrease = [];

    // calculate framerate to check if the gpu tier check was enough to get acceptable framerate
    useFrame((state, delta) => {
        if(enable){
            if(enableDynamicGraphicalModeSetting){
                accuDeltasForFPS += delta;
                accuFramesForFPS += 1;
                // every second, write number of frames
                if(accuDeltasForFPS >= 1){
                    arrayFPSToDecrease.push(accuFramesForFPS);
                    arrayFPSToIncrease.push(accuFramesForFPS);

                    accuDeltasForFPS = 0;
                    accuFramesForFPS = 0;
                }

                // Increase graphics by one level
                if (deltaCountToIncreaseGraphicsCheck === arrayFPSToIncrease.length && currentGraphicalMode !== "high") {
                    if (CalculateAverageOfArray(arrayFPSToIncrease) >= fpsThresholdToIncreaseGraphics) {
                    increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, 1);
                    console.log("Graphics increased");
                    }
                    arrayFPSToIncrease = [];
                }
                
                // Decrease graphics, added bias
                if (deltaCountToDecreaseGraphicsCheck === arrayFPSToDecrease.length && currentGraphicalMode !== "potato") {
                    const avgFPS = CalculateAverageOfArray(arrayFPSToDecrease);
                    if (avgFPS <= fpsThresholdToDecreaseGraphics) {
                    let decreaseSteps = 1;
                    // If FPS is really low, decrease by an extra level.
                    if (avgFPS < fpsThresholdToDecreaseGraphics / 2) {
                        decreaseSteps = 2;
                    }
                    increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, -decreaseSteps);
                    console.log("Graphics decreased by", decreaseSteps, "step(s)");
                    }
                    arrayFPSToDecrease = [];
                }
            }

    //////////////////////////////////
    // Redirection fallback section //
    //////////////////////////////////

            // if after 5 seconds in potato mode, still less than 100 frames have passed(20 fps), the site is unusable,
            // ask the user to enable hardware acceleration by redirecting them to the hardware acceleration page
            if(currentGraphicalMode == "potato"){
                accuDeltasForHardwareAccelerationCheck.current += delta;
                accuFramesForHardwareAccelerationCheck.current += 1;

                if (delta > 1) {
                    accuDeltasForHardwareAccelerationCheck.current = 0
                    accuFramesForHardwareAccelerationCheck.current = 0
                    return
                }

                if(accuDeltasForHardwareAccelerationCheck.current >= 5){
                    if(accuFramesForHardwareAccelerationCheck.current <= 100){
                        window.location.href = "HardwareAcceleration.html?fps=" + CalculateAverageOfArray(arrayFPSToDecrease);
                    }
                    else{
                        accuDeltasForHardwareAccelerationCheck.current = 0
                        accuFramesForHardwareAccelerationCheck.current = 0
                    }
                }
            }
            else{
                accuDeltasForHardwareAccelerationCheck.current = 0
                accuFramesForHardwareAccelerationCheck.current = 0
            }
        }
    })
})

GraphicalModeSetter.displayName = "GraphicalModeSetter";
