import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * @param {*} [curve] - Curve path used by the animated light.
 * @param {string} [startingSide] - Starting side of the curve's animation.
 * @param {boolean} [debugMode] - Mode to visualize the wireframe and current light trajectory.
 * @param {number} [animationSpeed] - Set animation's speed manually.
 * @param {number} [animationDurationFrames] - Set animation's duration manually.
 * @param {boolean} [synchronizeAnimationFrames] - Whether to sync light with external animation.
 * @param {number} [currentAnimationTime] - Current animation playtime in seconds (if synchronizeAnimationFrames = true).
 * @param {number} [totalAnimationDuration] - Total duration of the GLTF animation in seconds (if synchronizeAnimationFrames = true).
 * @param {Array<any>} [colors] - Colors to alternate between.
 * @param {Array<any>} [colorFrameIntervals] - Frame intervals for each color (in frames).
 * @param {boolean} [enableRandomColorFrameIntervals] - If true, generate random intervals for color switching.
 * @param {Array<any>} [randomColorFrameIntervalsMargin] - [min, max] margin (in frames) for random intervals.
 * @param {Array<any>} [randomIntensitiyMargin] - A two-element array [min, max] for random intensity.
 * @param {boolean} [enableRandomColorOrder] - If true, shuffle the colors order on each cycle.
 */
export const CurveLightAnimation = React.memo((props) => {
  const {curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-1, -1, -1),
  ])} = props;
  const {startingSide = "right"} = props;
  const {debugMode = true} = props;

  const {animationSpeed = 0} = props;
  const {animationDurationFrames = 0} = props;

  const {synchronizeAnimationFrames = false} = props;
  const {currentAnimationTime = 0} = props;
  const {totalAnimationDuration = 0} = props;

  const {colors = [0xffffff]} = props;
  const {colorFrameIntervals = [60]} = props;

  const {enableRandomColorFrameIntervals = true} = props;
  const {randomColorFrameIntervalsMargin = [100, 101]} = props;

  const {randomIntensitiyMargin = [0.05, 0.1]} = props;

  const {enableRandomColorOrder = true} = props;

  //////////////////////////////////////////////////////////
  ///////////// Variables, states and refs /////////////////
  //////////////////////////////////////////////////////////




  // Refs for the point light and the visible sphere.
  const pointLightRef = useRef();
  const sphereRef = useRef();

  // New state: hold the current order of colors.
  const [orderedColors, setOrderedColors] = useState(colors);

  // State for the current color index.
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  // Counter for frames to track when to switch colors.
  const frameCountRef = useRef(0);

  // State to keep track of the light's progress (t) along the curve and its direction.
  const [t, setT] = useState(startingSide === "left" ? 0 : 1);
  const [direction, setDirection] = useState(startingSide === "left" ? 1 : -1);

  // Helper function to generate a random interval based on the provided margin.
  const getRandomInterval = () => {
    const [minInterval, maxInterval] = randomColorFrameIntervalsMargin;
    return Math.floor(minInterval + Math.random() * (maxInterval - minInterval));
  };

  // State for the current interval. If random intervals are enabled, initialize with a random value;
  // otherwise, use the first static value from colorFrameIntervals.
  const [currentInterval, setCurrentInterval] = useState(
    enableRandomColorFrameIntervals ? getRandomInterval() : colorFrameIntervals[0]
  );

  // Tube component for visualizing the curve (optional for debugging).
  /**
   * @param {*} curve - Curve.
   */
  const Tube = (props) => {
    const {curve} = props;

    const tubeGeometry = useMemo(() => {
      return new THREE.TubeGeometry(curve, 16, 2, 5);
    }, [curve]);

    return debugMode ? (
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial wireframe={true} color={0xffffff} />
      </mesh>
    ) : null;
  };

  //////////////////////////////////////////////////////////
  ///////////////// Rules, constraints /////////////////////
  //////////////////////////////////////////////////////////




  if (synchronizeAnimationFrames && (animationSpeed !== 0 || animationDurationFrames !== 0)) {
    throw new Error(
      "When 'synchronizeAnimationFrames' is true, 'animationSpeed' and 'animationDurationFrames' must both be set to 0."
    );
  }

  if (startingSide !== "left" && startingSide !== "right") {
    throw new Error("The 'startingSide' prop must be either 'left' or 'right'.");
  }

  if (synchronizeAnimationFrames && totalAnimationDuration <= 0) {
    throw new Error("When 'synchronizeAnimationFrames' is true, 'totalAnimationDuration' must be greater than 0.");
  }

  if (!enableRandomColorFrameIntervals && colors.length !== colorFrameIntervals.length) {
    throw new Error("The 'colors' and 'colorFrameIntervals' arrays must have the same length.");
  }

  //////////////////////////////////////////////////////////
  //////////////////// Animation handle ////////////////////
  //////////////////////////////////////////////////////////




  useFrame(() => {
    // 't' is a number between 0 and 1 representing the normalized position of the light along the curve.
    let newT = t;

    //////////////////////////////////////////////////////////
    ////////// External animation synchronization logic ////////////// 
    //////////////////////////////////////////////////////////




    if (synchronizeAnimationFrames) {
      // External animation synchronization logic.
      if (totalAnimationDuration > 0) {
        const normalizedTime = (currentAnimationTime / totalAnimationDuration) * 2;
        const normalizedProgress = normalizedTime % 2;
        if (normalizedProgress <= 1) {
          newT = startingSide === "left" ? normalizedProgress : 1 - normalizedProgress;
        } else {
          const backwardProgress = 2 - (normalizedTime % 2);
          newT = startingSide === "left" ? backwardProgress : 1 - backwardProgress;
        }
        newT = Math.max(0, Math.min(newT, 1));
      }
    } else {
      ////////////////////////////////////////////////////////////////////////////////////////////////////
      ////////// Internal animation logic (fallback if synchronizeAnimationFrames is false) //////////////
      ////////////////////////////////////////////////////////////////////////////////////////////////////




      // Internal animation logic.
      const step =
        animationDurationFrames !== 0 ? (1 / animationDurationFrames) * direction : animationSpeed * direction;
      newT += step;

      // Reverse direction when reaching the ends of the curve.
      if (newT >= 1) {
        newT = 1;
        setDirection(-1);
      } else if (newT <= 0) {
        newT = 0;
        setDirection(1);
      }
    }

    //////////////////////////////////////////////////////////
    ///////////// State and position update //////////////////
    //////////////////////////////////////////////////////////




    // Update state for t.
    setT(newT);

    // Get the point along the curve based on t.
    const positionOnCurve = curve.getPointAt(newT);

    // Update the point light's position.
    if (pointLightRef.current) {
      pointLightRef.current.position.copy(positionOnCurve);
    }

    // Update the visible sphere's position.
    if (sphereRef.current) {
      sphereRef.current.position.copy(positionOnCurve);
    }

    //////////////////////////////////////////////////////////
    ////////////// Color alternating logic ///////////////////
    //////////////////////////////////////////////////////////




    frameCountRef.current += 1;
    // Use the current interval if random intervals are enabled, else use the static one.
    const interval = enableRandomColorFrameIntervals
      ? currentInterval
      : colorFrameIntervals[currentColorIndex % colorFrameIntervals.length];

    if (frameCountRef.current >= interval) {
      frameCountRef.current = 0;
      // If enableRandomColorOrder is true, shuffle the orderedColors array.
      if (enableRandomColorOrder) {
        setOrderedColors([...orderedColors].sort(() => Math.random() - 0.5));
      }
      
      setCurrentColorIndex((prevIndex) => {
        console.log(prevIndex)
        const newIndex = (prevIndex + 1) % orderedColors.length;
        // Update light intensity when the color changes if randomIntensitiyMargin is provided.
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
      {/* Point Light that moves along the curve */}
      <pointLight
        ref={pointLightRef}
        color={orderedColors[currentColorIndex]}
        intensity={0.3} // Default intensity; updated on color change if randomIntensitiyMargin is provided.
      />

      {/* Debug mode: Visible wireframe curve */}
      <Tube curve={curve} />

      {/* Debug mode: Visible sphere to represent the point light */}
      {debugMode && (
        <mesh ref={sphereRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={orderedColors[currentColorIndex]} />
        </mesh>
      )}
    </>
  );
});

CurveLightAnimation.displayName = "CurveLightAnimation";
