import { useFrame } from '@react-three/fiber';
import { getGPUTier } from 'detect-gpu';

// set graphical mode based on fps
export function GraphicalModeSetter(props){
    const {numberOfPasses = 1} = props;
    const {fpsToDecreaseGraphics = 45} = props;

    const graphicalModes = props.useStore((state) => state.graphicalModes);
    const currentGraphicalMode = props.useStore((state) => state.currentGraphicalMode);
    const setGraphicalMode = props.useStore((state) => state.setGraphicalMode);
    const setFinishedBenchmark = props.useStore((state) => state.setFinishedBenchmark);    
    
    (async () => {
        const gpuTier = await getGPUTier();
        let newGraphicalMode;

        // because of limitations in the detect-gpu package, the graphical modes are limited to 4 for now.
        switch(gpuTier.tier) {
            case 3:
                newGraphicalMode = "high";
            break;

            case 2:
                newGraphicalMode = "normal";
            break;

            case 1:
                newGraphicalMode = "potatoPremium";
            break;

            case 0:
                newGraphicalMode = "potato";
            break;
        }
    
            setGraphicalMode(newGraphicalMode);
    })()

    const framesForGraphicModeComparison = 120;
    let pass = 0;
    let accuFramesForGraphicModeComparison = 0;
    let accuDeltasForFPS = 0;
    let accuFramesForFPS = 0;
    let arrayFPS = [];

    // calculate framerate to check if the gpu tier check was enough to get acceptable framerate
    useFrame((state, delta)=>{
        accuFramesForGraphicModeComparison += 1;
        accuDeltasForFPS += delta;
        accuFramesForFPS += 1;
        if(accuDeltasForFPS >= 1){
            arrayFPS.push(accuFramesForFPS);
            accuDeltasForFPS = 0;
            accuFramesForFPS = 0;
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
                        setFinishedBenchmark(true);
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