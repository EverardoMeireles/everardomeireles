import { useFrame } from '@react-three/fiber';
import { getGPUTier } from 'detect-gpu';

// set graphical by performing a gpu ier test, a fps check and a hardware acceleration check
export function GraphicalModeSetter(props){
    const {numberOfPasses = 1} = props;
    const {fpsToDecreaseGraphics = 45} = props;

    const graphicalModes = props.useStore((state) => state.graphicalModes);
    const currentGraphicalMode = props.useStore((state) => state.currentGraphicalMode);
    const setGraphicalMode = props.useStore((state) => state.setGraphicalMode);
    const setFinishedBenchmark = props.useStore((state) => state.setFinishedBenchmark);    

    const HardwareAccelerationCheckPassed = true;
    (async () => {
        const gpuTier = await getGPUTier({benchmarksURL:"benchmarks"});
        // hardware acceleration check, if the user has hardware acceleration disabled, don't set graphical mode
        if(gpuTier.type=="WEBGL_UNSUPPORTED" || gpuTier.tier == 0){
            HardwareAccelerationCheckPassed = false;
        }else{
            if(gpuTier.isMobile){
                if(!gpuTier.fps < 25){
                    HardwareAccelerationCheckPassed = false;
                }
            }else{
                if(!gpuTier.gpu.includes("intel") && !gpuTier.gpu.includes("nvidia") && !gpuTier.gpu.includes("amd") && !gpuTier.gpu.includes("apple m1") && !gpuTier.gpu.includes("apple m2") && !gpuTier.gpu.includes("apple a14")){
                    HardwareAccelerationCheckPassed = false;
                }
            }
        }

        if(HardwareAccelerationCheckPassed){
            let newGraphicalMode;

            // because of limitations in the detect-gpu package, the graphical modes are limited to 4 for now.
            switch(gpuTier.tier) {
                // case 0:
                //     newGraphicalMode = "potato";
                // break;
    
                case 1:
                    newGraphicalMode = "potatoPremium";
                break;
    
                case 2:
                    newGraphicalMode = "normal";
                break;
    
                case 3:
                    newGraphicalMode = "high";
                break;
            }
                console.log("GRAPHICS: " + newGraphicalMode)
                setGraphicalMode(newGraphicalMode);
        }
    })()

    const framesForGraphicModeComparison = 120;
    let pass = 0;
    let accuFramesForGraphicModeComparison = 0;
    let accuDeltasForFPS = 0;
    let accuFramesForFPS = 0;
    let accuDeltasForHardwareAccelerationCheck = 0;
    let accuFramesForHardwareAccelerationCheck = 0;
    let skipHardwareAccelerationCheck = false;

    let arrayFPS = [];

    // calculate framerate to check if the gpu tier check was enough to get acceptable framerate
    useFrame((state, delta)=>{
        accuFramesForGraphicModeComparison += 1;
        accuDeltasForFPS += delta;
        accuFramesForFPS += 1;
        accuDeltasForHardwareAccelerationCheck += delta;
        accuFramesForHardwareAccelerationCheck += 1;
        // console.log(accuDeltasForFPS)
        if(accuDeltasForFPS >= 1){
            arrayFPS.push(accuFramesForFPS);
            accuDeltasForFPS = 0;
            accuFramesForFPS = 0;
        }
        console.log("deltas: " + accuDeltasForHardwareAccelerationCheck)
        console.log("frames: " + accuFramesForHardwareAccelerationCheck)
        // if after 5 seconds, still less than 60 frames have passed, the site is unusable, ask the user to enable hardware acceleration 
        // by redirecting them to the hardware acceleration page
        if(!skipHardwareAccelerationCheck && accuDeltasForHardwareAccelerationCheck > 5){
            console.log("entered")
            if(accuFramesForHardwareAccelerationCheck < 60){
                console.log("redirected")
                window.location.href = "HardwareAcceleration.html";
            }
            else{
                console.log("skipped")
                skipHardwareAccelerationCheck = true;
            }
        }

        // Every n frames, calculate the average fps
        if(accuFramesForGraphicModeComparison >= framesForGraphicModeComparison){
            const averageFps = arrayFPS.reduce((a, b) => a + b, 0) / arrayFPS.length;
            console.log(averageFps);
            // skip the first pass, it always shows fewer fps than the system is really capable of

            if(pass != 0){
                // decrease the graphics by one tier
                if(averageFps < fpsToDecreaseGraphics){
                    if(!["potato", "high"].includes(currentGraphicalMode)){
                        setGraphicalMode(graphicalModes[graphicalModes.indexOf(currentGraphicalMode) - 1]);
                        console.log("GRAPHICS: " + graphicalModes[graphicalModes.indexOf(currentGraphicalMode) - 1])
                        pass = -1;
                    }
                }
            }

            arrayFPS = [];
            pass += 1;
            accuFramesForGraphicModeComparison = 0;
            if(pass == numberOfPasses + 1){
                setFinishedBenchmark(true);
            }
        }
    })
}