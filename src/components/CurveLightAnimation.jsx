// import React, { useRef, useMemo, useState } from "react";
// import { useFrame } from "@react-three/fiber";
// import * as THREE from "three";

// // Creates an animation where a point light goes back and forth between two ends of a curve
// export const CurveLightAnimation = React.memo((props) => {
//   const {
//     curve = new THREE.CatmullRomCurve3([
//       new THREE.Vector3(54, 120, -20),
//       new THREE.Vector3(48, 82, -49),
//       new THREE.Vector3(54, 120, -77),
//     ]),
//   } = props;

//   const {
//     animationSpeed = 0, // Default speed is 0
//     animationDurationFrames = 0, // Default duration in frames is 0
//     currentAnimationTime = 0, // Current animation playtime in seconds
//     synchronizeAnimationFrames = false, // Whether to sync light with animation
//     totalAnimationDuration = 0, // Total duration of the GLTF animation in seconds
//     startingSide = "right", // Default starting side is "right"
//   } = props;

//   const { wireFrameVisible = false } = props; // Show the wireframe tube
//   const { lightColor = 0xffffff} = props; // Point light color
//   const { lightSphereSize = 1 } = props; // Size of the visible sphere representing the light

//   // Refs for the point light and the visible sphere
//   const pointLightRef = useRef();
//   const sphereRef = useRef();

//   // Validate props
//   if (synchronizeAnimationFrames && (animationSpeed !== 0 || animationDurationFrames !== 0)) {
//     throw new Error(
//       "When 'synchronizeAnimationFrames' is true, 'animationSpeed' and 'animationDurationFrames' must both be set to 0."
//     );
//   }

//   if (startingSide !== "left" && startingSide !== "right") {
//     throw new Error(
//       "The 'startingSide' prop must be either 'left' or 'right'."
//     );
//   }

//   if (synchronizeAnimationFrames && totalAnimationDuration <= 0) {
//     throw new Error(
//       "When 'synchronizeAnimationFrames' is true, 'totalAnimationDuration' must be greater than 0."
//     );
//   }

//   // State to keep track of the light's progress (`t`) along the curve and its direction
//   const [t, setT] = useState(startingSide === "left" ? 0 : 1); // Start at the left or right side
//   const [direction, setDirection] = useState(startingSide === "left" ? 1 : -1); // Start moving forward or backward

//   // Tube component for visualizing the curve (optional for debugging)
//   const Tube = ({ curve }) => {
//     const tubeGeometry = useMemo(() => {
//       const tube = new THREE.TubeGeometry(curve, 20, 2, 8);
//       return tube;
//     }, [curve]);

//     return (
//       <mesh
//         geometry={tubeGeometry}
//         material={new THREE.MeshBasicMaterial({
//           wireframe: wireFrameVisible,
//           color: 0xffffff,
//           visible: wireFrameVisible
//         })}
//       />
//     );
//   };

//   // Handle animation
//   useFrame(() => {
//     let newT = t; // Progress along the curve

//     if (synchronizeAnimationFrames) {
//       // Use externally controlled currentAnimationTime to calculate `t`
//       if (totalAnimationDuration > 0) {
//         // Normalize time to range [0, 2]
//         const normalizedTime = (currentAnimationTime / totalAnimationDuration) * 2;

//         // Determine forward/backward progress
//         const normalizedProgress = normalizedTime % 2; // Value in range [0, 2]
//         if (normalizedProgress <= 1) {
//           // Forward motion (0 to 1)
//           newT = startingSide === "left" ? normalizedProgress : 1 - normalizedProgress;
//         } else {
//           // Backward motion (1 to 0)
//           const backwardProgress = 2 - normalizedProgress;
//           newT = startingSide === "left" ? backwardProgress : 1 - backwardProgress;
//         }

//         // Clamp `t` between 0 and 1
//         newT = Math.max(0, Math.min(newT, 1));
//       }
//     } else {
//       // Internal animation logic (fallback if synchronizeAnimationFrames is false)
//       const step = animationDurationFrames !== 0
//         ? (1 / animationDurationFrames) * direction // Step size per frame
//         : animationSpeed * direction; // Step size per second if animationSpeed is provided

//       // Update `t` with the calculated step
//       newT += step;

//       // Reverse direction when reaching the ends of the curve
//       if (newT >= 1) {
//         newT = 1;
//         setDirection(-1); // Reverse direction
//       } else if (newT <= 0) {
//         newT = 0;
//         setDirection(1); // Reverse direction
//       }
//     }

//     // Update state for `t`
//     setT(newT);

//     // Get the point along the curve based on `t`
//     const position = curve.getPointAt(newT);

//     // Update the point light's position
//     if (pointLightRef.current) {
//       pointLightRef.current.position.copy(position);
//     }

//     // Update the visible sphere's position
//     if (sphereRef.current) {
//       sphereRef.current.position.copy(position);
//     }
//   });

//   return (
//     <>
//       {/* Debugging wireframe */}
//       <Tube curve={curve} />

//       {/* Point Light that moves */}
//       <pointLight ref={pointLightRef} color={lightColor} intensity={0.3} />

//       {/* Visible sphere to represent the point light */}
//       <mesh ref={sphereRef}>
//         <sphereGeometry args={[lightSphereSize, 16, 16]} />
//         <meshBasicMaterial color={lightColor} />
//       </mesh>
//     </>
//   );
// });


import React, { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Creates an animation where a point light goes back and forth between two ends of a curve
export const CurveLightAnimation = React.memo((props) => {
  const {
    curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(54, 120, -20),
      new THREE.Vector3(48, 82, -49),
      new THREE.Vector3(54, 120, -77),
    ]),
  } = props;

  const {
    animationSpeed = 0, // Default speed is 0
    animationDurationFrames = 0, // Default duration in frames is 0
    currentAnimationTime = 0, // Current animation playtime in seconds
    synchronizeAnimationFrames = false, // Whether to sync light with animation
    totalAnimationDuration = 0, // Total duration of the GLTF animation in seconds
    startingSide = "right", // Default starting side is "right"
    colorMode = "single", // "single" or "multiple"
    colors = [0xffffff], // Colors to alternate between (for "multiple" mode)
    colorFrameIntervals = [60], // Frame intervals for each color (in frames)
  } = props;

  const { wireFrameVisible = false } = props; // Show the wireframe tube
  const { lightColor = 0xffffff } = props; // Default light color (used in "single" mode)
  const { lightSphereSize = 1 } = props; // Size of the visible sphere representing the light

  // Refs for the point light and the visible sphere
  const pointLightRef = useRef();
  const sphereRef = useRef();

  // State for the current color index (for "multiple" mode)
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  // Counter for frames to track when to switch colors
  const frameCountRef = useRef(0);

  // Validate props
  if (synchronizeAnimationFrames && (animationSpeed !== 0 || animationDurationFrames !== 0)) {
    throw new Error(
      "When 'synchronizeAnimationFrames' is true, 'animationSpeed' and 'animationDurationFrames' must both be set to 0."
    );
  }

  if (startingSide !== "left" && startingSide !== "right") {
    throw new Error(
      "The 'startingSide' prop must be either 'left' or 'right'."
    );
  }

  if (synchronizeAnimationFrames && totalAnimationDuration <= 0) {
    throw new Error(
      "When 'synchronizeAnimationFrames' is true, 'totalAnimationDuration' must be greater than 0."
    );
  }

  if (colorMode === "multiple" && colors.length !== colorFrameIntervals.length) {
    throw new Error(
      "The 'colors' and 'colorFrameIntervals' arrays must have the same length."
    );
  }

  // State to keep track of the light's progress (`t`) along the curve and its direction
  const [t, setT] = useState(startingSide === "left" ? 0 : 1); // Start at the left or right side
  const [direction, setDirection] = useState(startingSide === "left" ? 1 : -1); // Start moving forward or backward

  // Tube component for visualizing the curve (optional for debugging)
  const Tube = ({ curve }) => {
    const tubeGeometry = useMemo(() => {
      const tube = new THREE.TubeGeometry(curve, 20, 2, 8);
      return tube;
    }, [curve]);

    return (
      <mesh
        geometry={tubeGeometry}
        material={{
          wireframe: wireFrameVisible,
          visible: wireFrameVisible,
          color: 0xffffff,
        }}
      />
    );
  };

  // Handle animation
  useFrame(() => {
    let newT = t; // Progress along the curve

    if (synchronizeAnimationFrames) {
      // Use externally controlled currentAnimationTime to calculate `t`
      if (totalAnimationDuration > 0) {
        // Normalize time to range [0, 2]
        const normalizedTime = (currentAnimationTime / totalAnimationDuration) * 2;

        // Determine forward/backward progress
        const normalizedProgress = normalizedTime % 2; // Value in range [0, 2]
        if (normalizedProgress <= 1) {
          // Forward motion (0 to 1)
          newT = startingSide === "left" ? normalizedProgress : 1 - normalizedProgress;
        } else {
          // Backward motion (1 to 0)
          const backwardProgress = 2 - normalizedProgress;
          newT = startingSide === "left" ? backwardProgress : 1 - backwardProgress;
        }

        // Clamp `t` between 0 and 1
        newT = Math.max(0, Math.min(newT, 1));
      }
    } else {
      // Internal animation logic (fallback if synchronizeAnimationFrames is false)
      const step = animationDurationFrames !== 0
        ? (1 / animationDurationFrames) * direction // Step size per frame
        : animationSpeed * direction; // Step size per second if animationSpeed is provided

      // Update `t` with the calculated step
      newT += step;

      // Reverse direction when reaching the ends of the curve
      if (newT >= 1) {
        newT = 1;
        setDirection(-1); // Reverse direction
      } else if (newT <= 0) {
        newT = 0;
        setDirection(1); // Reverse direction
      }
    }

    // Update state for `t`
    setT(newT);

    // Get the point along the curve based on `t`
    const position = curve.getPointAt(newT);

    // Update the point light's position
    if (pointLightRef.current) {
      pointLightRef.current.position.copy(position);
    }

    // Update the visible sphere's position
    if (sphereRef.current) {
      sphereRef.current.position.copy(position);
    }

    // Color alternating logic (only in "multiple" mode)
    if (colorMode === "multiple") {
      frameCountRef.current += 1; // Increment frame counter

      if (
        frameCountRef.current >=
        colorFrameIntervals[currentColorIndex % colorFrameIntervals.length]
      ) {
        // Reset frame counter and switch to the next color
        frameCountRef.current = 0;
        setCurrentColorIndex((prevIndex) => (prevIndex + 1) % colors.length);
      }
    }
  });

  return (
    <>
      {/* Debugging wireframe */}
      <Tube curve={curve} />

      {/* Point Light that moves */}
      <pointLight
        ref={pointLightRef}
        color={colorMode === "single" ? lightColor : colors[currentColorIndex]} // Alternate colors if "multiple"
        intensity={0.3}
      />

      {/* Visible sphere to represent the point light */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[lightSphereSize, 16, 16]} />
        <meshBasicMaterial
          color={colorMode === "single" ? lightColor : colors[currentColorIndex]} // Match the light color
        />
      </mesh>
    </>
  );
});
