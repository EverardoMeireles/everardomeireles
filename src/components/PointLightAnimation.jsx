import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const PointLightAnimation = React.memo((props) => {
  const {
    position = [0, 0, 0],
    debugMode = false,

    colors = [0xffffff],
    colorFrameIntervals = [60],
    enableRandomColorFrameIntervals = true,
    randomColorFrameIntervalsMargin = [1, 9],
    enableRandomColorOrder = true,
    randomIntensitiyMargin = [0.05, 0.1],
  } = props;

  const pointLightRef = useRef();
  const sphereRef = useRef();

  const orderedColorsRef = useRef([...colors]);
  const currentColorIndexRef = useRef(0);
  const frameCountRef = useRef(0);

  const getRandomInterval = () => {
    const [min, max] = randomColorFrameIntervalsMargin;
    return Math.floor(min + Math.random() * (max - min));
  };

  const currentIntervalRef = useRef(
    enableRandomColorFrameIntervals ? getRandomInterval() : colorFrameIntervals[0]
  );

  useFrame(() => {
    frameCountRef.current += 1;

    const colorIndex = currentColorIndexRef.current;
    const interval = enableRandomColorFrameIntervals
      ? currentIntervalRef.current
      : orderedColorsRef.current.length > 1
      ? colorFrameIntervals[colorIndex % colorFrameIntervals.length]
      : colorFrameIntervals[0];

    if (frameCountRef.current >= interval) {
      frameCountRef.current = 0;

      if (enableRandomColorOrder) {
        orderedColorsRef.current = [...orderedColorsRef.current].sort(() => Math.random() - 0.5);
      }

      const newIndex = (colorIndex + 1) % orderedColorsRef.current.length;
      currentColorIndexRef.current = newIndex;

      if (
        randomIntensitiyMargin &&
        Array.isArray(randomIntensitiyMargin) &&
        randomIntensitiyMargin.length === 2 &&
        pointLightRef.current
      ) {
        const [min, max] = randomIntensitiyMargin;
        pointLightRef.current.intensity = min + Math.random() * (max - min);
      }

      if (enableRandomColorFrameIntervals) {
        currentIntervalRef.current = getRandomInterval();
      }

      // Manually update color without triggering re-render
      const nextColor = orderedColorsRef.current[newIndex];
      if (pointLightRef.current) pointLightRef.current.color = new THREE.Color(nextColor);
      if (sphereRef.current) sphereRef.current.material.color = new THREE.Color(nextColor);
    }
  });

  return (
    <>
      <pointLight
        ref={pointLightRef}
        position={position}
        color={orderedColorsRef.current[currentColorIndexRef.current]}
        intensity={0.3}
      />
      {debugMode && (
        <mesh ref={sphereRef} position={position}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={orderedColorsRef.current[currentColorIndexRef.current]} />
        </mesh>
      )}
    </>
  );
});

PointLightAnimation.displayName = "PointLightAnimation";
