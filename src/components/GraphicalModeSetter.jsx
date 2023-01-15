import { useFrame } from '@react-three/fiber';
import { useState } from "react";

// set graphical mode based on fps
// if the n passes occours without a change in graphical mode, the component is dismounted
export function GraphicalModeSetter(props){
    const {numberOfPasses = 2} = props;

    const [render, setRender] = useState(true);

    function SetGraphicalMode({ setRender }){
        const currentGraphicalMode = props.useStore((state) => state.currentGraphicalMode);
        const setGraphicalMode = props.useStore((state) => state.setGraphicalMode);
        const framesForGraphicModeComparison = 150
        var pass = 0
        var accuFramesForGraphicModeComparison = 0;
        var accuDeltasForFPS = 0
        var accuFramesForFPS = 0
        var arrayFPS = []
        useFrame((state,delta)=>{
            console.log("mode: " + currentGraphicalMode)

            accuFramesForGraphicModeComparison += 1
            accuDeltasForFPS += delta
            accuFramesForFPS += 1
            if(accuDeltasForFPS >= 1){
                arrayFPS.push(accuFramesForFPS)
                accuDeltasForFPS = 0
                accuFramesForFPS = 0
            }
            // console.log(arrayFPS)
            // Every n frames, check to see if is better to increase or decrease graphics to maintain
            // acceptable fps
            if(accuFramesForGraphicModeComparison >= framesForGraphicModeComparison){
                const averageFps = arrayFPS.reduce((a, b) => a + b, 0) / arrayFPS.length
                
                console.log(averageFps)
                let newGraphicalModeChangeIndex = 0
                switch(true) {
                    case averageFps >= 60:
                        newGraphicalModeChangeIndex = 1
                    break;

                    case averageFps >= 50:
                        newGraphicalModeChangeIndex = 0
                    break;
                    case averageFps >= 30:
                        newGraphicalModeChangeIndex = -1
                    break;
                    case averageFps >= 10:
                        newGraphicalModeChangeIndex = -2
                    break;
                    case averageFps >= 2:
                        newGraphicalModeChangeIndex = -3
                    break;
                    default:
                    }
                console.log("old mode: " + currentGraphicalMode)
                // skips the first pass, the framerate always dips a little bit when the scene loads
                if(pass != 0){
                    setGraphicalMode(newGraphicalModeChangeIndex)
                }
                
                accuFramesForGraphicModeComparison = 0
                newGraphicalModeChangeIndex = 0
                arrayFPS = []
                pass += 1
                console.log("pass:" + pass)
                if(pass == numberOfPasses + 1){
                    setRender(false)
                    console.log("time to go!!!")
                }
            }
        // console.log(arrayFrames)
        })
    }
    return(
        <>
            {render && <SetGraphicalMode setRender={setRender} />}
        </>
    )
}