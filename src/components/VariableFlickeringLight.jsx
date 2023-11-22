import { useFrame } from '@react-three/fiber';
import React, { useRef } from "react";
import { getRandomInt } from "../Helper";

export function VariableFlickeringLight(props) {
  const {FlickerFrameInterval = 3} = props;
  const {FlickerLightIntensivityRangeTuple = (0.1, 0.2)} = props;
  // const {isMainMenu = false} = props;

  const lightRef = useRef();
  let FrameCounter = 0;
  useFrame((state, delta) => {
    FrameCounter++

    if(FrameCounter % FlickerFrameInterval === 0){
      let randdd= getRandomInt(0.1, 0.2)
      console.log(randdd)
      lightRef.current.intensity =  0.1 + randdd
    }
    
  });

  return <pointLight color={"#e25822"} ref={lightRef} />;
}

