import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const PointLightAnimation = React.memo((props) => {
  const {
    position = [0, 0, 0], // position of the point light
    debugMode = false, // Mode to visualize the wireframe and light trajectory

    colors = [0xffffff], // Colors to alternate between (for "multiple" mode)
    colorFrameIntervals = [60], // Static frame intervals (in frames)
    
    enableRandomColorFrameIntervals = true, // If true, update the interval using randomColorFrameIntervalsMargin.
    randomColorFrameIntervalsMargin = [1, 9], // [min, max] margin (in frames) for random intervals.

    enableRandomColorOrder = true, //if true, shuffle the colors order on each cycle.

    randomIntensitiyMargin = [0.05, 0.1], // A two-element array [min, max] for random intensity.

  } = props;




  //////////////////////////////////////////////////////////
  ///////////// Variables, states and refs /////////////////
  //////////////////////////////////////////////////////////

  // Refs for the point light and the visible sphere
  const pointLightRef = useRef();
  const sphereRef = useRef();

  // New state: hold the current order of colors.
  const [orderedColors, setOrderedColors] = useState(colors);

  // State for the current color index (for "multiple" mode)
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  // Counter for frames to track when to switch colors
  const frameCountRef = useRef(0);

  // If enableRandomColorFrameIntervals is true, use state to hold the current interval.
  // Otherwise, we will use the static value from colorFrameIntervals.
  const getRandomInterval = () => {
    const [minInterval, maxInterval] = randomColorFrameIntervalsMargin;
    return Math.floor(minInterval + Math.random() * (maxInterval - minInterval));
  };

  const [currentInterval, setCurrentInterval] = useState(
    enableRandomColorFrameIntervals ? getRandomInterval() : colorFrameIntervals[0]
  );




  ///////////////////////////////////////
  //////// Animation handle ////////////
  ///////////////////////////////////////

  useFrame(() => {
    frameCountRef.current += 1;

    // Determine which interval to use.
    const interval = enableRandomColorFrameIntervals
      ? currentInterval
      : orderedColors.length > 1
      ? colorFrameIntervals[currentColorIndex % colorFrameIntervals.length]
      : colorFrameIntervals[0];

    if (frameCountRef.current >= interval) {
      frameCountRef.current = 0;
      // If enableRandomColorOrder is true, shuffle the orderedColors array.
      if (enableRandomColorOrder) {
        setOrderedColors([...orderedColors].sort(() => Math.random() - 0.5));
      }
      setCurrentColorIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % orderedColors.length;

        ///////////////////////////////////
        //////// Intensity update. ////////
        ///////////////////////////////////

        if (
          randomIntensitiyMargin &&
          Array.isArray(randomIntensitiyMargin) &&
          randomIntensitiyMargin.length === 2 &&
          pointLightRef.current
        ) {
          const [min, max] = randomIntensitiyMargin;
          pointLightRef.current.intensity = min + Math.random() * (max - min);
        }
        return newIndex;
      });
      // If random intervals are enabled, update currentInterval directly.
      if (enableRandomColorFrameIntervals) {
        setCurrentInterval(getRandomInterval());
      }
    }
  });

  return (
    <>
      {/* Point Light that flickers */}
      <pointLight
        position={position}
        ref={pointLightRef}
        color={orderedColors[currentColorIndex]}
        intensity={0.3} // Default intensity; updated on color change if randomIntensitiyMargin is provided.
      />

      {/* Debug mode: Visible sphere to represent the point light */}
      {debugMode && (
        <mesh position={position} ref={sphereRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={orderedColors[currentColorIndex]} />
        </mesh>
      )}
    </>
  );
});
