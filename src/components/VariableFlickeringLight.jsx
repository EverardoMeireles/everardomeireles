import { useFrame } from '@react-three/fiber';
import React, { useRef } from "react";
import { getRandomInt } from "../Helper";

export function VariableFlickeringLight(props) {
  const {flickerFrameInterval = 3} = props;
  const {flickerLightIntensivityRangeTuple = (0.1, 0.2)} = props;
  // const {isMainMenu = false} = props;

  const lightRef = useRef();
  let frameCounter = 0;
  useFrame((state, delta) => {
    frameCounter++;

    if(frameCounter % flickerFrameInterval === 0){
      let random= getRandomInt(0.1, 0.2);
      console.log(random);
      lightRef.current.intensity =  0.1 + random;
    }
    
  });

  return <pointLight color={"#e25822"} ref={lightRef} />;
}

