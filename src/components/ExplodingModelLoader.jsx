import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import React from 'react';

export const ExplodingModelLoader = React.memo((props) => {
  const { position = [0, 0, 0], sceneName = 'threeJsScene.glb', enableRockingAnimation = true, enableExplodeAnimation = true, animationStartOnLoad = true } = props;
  const useStore = props.useStore; // Using useStore from props

  // Load Model
  const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + sceneName);

  const { camera, gl } = useThree();
  const setToolTipCirclePositions = useStore((state) => state.setToolTipCirclePositions);
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const cameraState = useStore((state) => state.cameraState);
  const animationIsPlaying = useStore((state) => state.animationIsPlaying);
  const setAnimationIsPlaying = useStore((state) => state.setAnimationIsPlaying);
  const animationDirection = useStore((state) => state.animationDirection);
  const setAnimationDirection = useStore((state) => state.setAnimationDirection);

  const [rock, setRock] = useState(false);
  const [explode, setExplode] = useState(false);
  const [initialPositions, setInitialPositions] = useState({});
  const [desiredPositions, setDesiredPositions] = useState({});
  const [childInitialPositions, setChildInitialPositions] = useState({});
  const [childDesiredPositions, setChildDesiredPositions] = useState({});
  const [animationTick, setAnimationTick] = useState(0);
  const [childAnimationTick, setChildAnimationTick] = useState(0);
  const [hasChildAnimation, setHasChildAnimation] = useState(false);

  const rockingTransitionDuration = 2000; // Duration in milliseconds for rocking animation
  const transitionDuration = 2500; // Duration in milliseconds for exploding animation
  const childTransitionDuration = 700; // Duration in milliseconds for child's exploding animation
  const rockingMaxAngle = Math.PI / 16; // Maximum angle for the rocking animation, the more you divide by pi, the calmer it gets

  const rockingAnimationPlayed = useRef(false);
  const explodeAnimationPlayed = useRef(false);
  const childAnimationPlayed = useRef(false);
  const previousAnimationDirection = useRef(null);

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(t) {
    return Math.pow(t, 3);
  }

  function getInitialPositions(model) {
    var currentPositions = {};

    model.scene.children.forEach((mesh) => {
      currentPositions[mesh.name] = mesh.position.clone(); // Use clone to create a copy
    });
    return currentPositions;
  }

  function getDesiredPositions(currentPositions) {
    var zIndexTable = {
      0: -1,
      1: 0,
      2: 1
    };
    var nameSubstring = '';
    var DirectionValue = '';
    var zIndexValue = 0;
    var incrementValue = 0;
    var incrementVector = new THREE.Vector3(0, 0, 0);
    var newPositions = {};

    Object.keys(currentPositions).forEach((name) => {
      nameSubstring = name.slice(-4); // take the 4 characters at the end of the model's name to extract the values
      zIndexValue = zIndexTable[parseInt(nameSubstring[0], 10)];
      DirectionValue = nameSubstring[1] + nameSubstring[2];
      incrementValue = parseInt(nameSubstring[3], 10);

      switch (DirectionValue) {
        case 'TL':
          incrementVector = new THREE.Vector3(-1, 1, zIndexValue);
          break;

        case 'TT':
          incrementVector = new THREE.Vector3(0, 1, zIndexValue);
          break;

        case 'TR':
          incrementVector = new THREE.Vector3(1, 1, zIndexValue);
          break;

        case 'LL':
          incrementVector = new THREE.Vector3(-1, 0, zIndexValue);
          break;

        case 'MM':
          incrementVector = new THREE.Vector3(0, 0, zIndexValue);
          break;

        case 'RR':
          incrementVector = new THREE.Vector3(1, 0, zIndexValue);
          break;

        case 'BL':
          incrementVector = new THREE.Vector3(-1, -1, zIndexValue);
          break;

        case 'BB':
          incrementVector = new THREE.Vector3(0, -1, zIndexValue);
          break;

        case 'BR':
          incrementVector = new THREE.Vector3(1, -1, zIndexValue);
          break;

        default:
          incrementVector = new THREE.Vector3(0, 0, 0);
      }

      // Clone the current position to avoid mutating the original object
      let newPosition = currentPositions[name].clone();

      newPositions[name] = newPosition.add(incrementVector.multiplyScalar(incrementValue * 4));
    });

    return newPositions;
  }
  
  function getChildrenInitialPositions(model) {
    var currentPositions = {};

    model.scene.children.forEach((mesh) => {
      mesh.children.forEach((child) => {
        currentPositions[child.name] = child.position.clone(); // Use clone to create a copy for children
      });
    });
    return currentPositions;
  }

  // Makes the tooltip circles follow the objects when camera position and rotation values change
  const updateToolTipCirclePositions = () => {
    const positions = {};
    tooltipCirclesData.forEach((data) => {
      const objectName = data.objectName;
      const object = gltf.scene.getObjectByName(objectName);
      if (object) {
        const vector = new THREE.Vector3();
        object.getWorldPosition(vector);
        vector.project(camera);

        // Convert the normalized device coordinates (NDC) to screen space percentages
        const x = (vector.x * 0.5 + 0.5) * 100; // Percentage of width
        const y = (vector.y * -0.5 + 0.5) * 100; // Percentage of height

        positions[objectName] = [x, y];
      }
    });
    setToolTipCirclePositions(positions);
  };

    // Makes the tooltip circles follow the objects when camera position and rotation values change
    useEffect(() => {
      updateToolTipCirclePositions();
    }, [cameraState]);

  // Automatically starts the animation when the animationStartOnLoad prop is set to true
  useEffect(() => {
    if(enableRockingAnimation && animationStartOnLoad){
      setRock(true)
    }

    if(enableExplodeAnimation && animationStartOnLoad){
      setExplode(true)
    }
    setAnimationIsPlaying(true)
  }, [animationStartOnLoad]);

  // When model loads, set the initial and desired positions of the animation
  useEffect(() => {
    if (gltf) {
      const initialPositions = getInitialPositions(gltf);
      const desiredPositions = getDesiredPositions(initialPositions);
      const childInitialPositions = getChildrenInitialPositions(gltf);
      setInitialPositions(initialPositions);
      setDesiredPositions(desiredPositions);
      setChildInitialPositions(childInitialPositions);
    }
  }, [gltf]);

  // Control the animations using the zustand state
  useEffect(() => {
    if (animationIsPlaying && (previousAnimationDirection.current !== animationDirection || previousAnimationDirection.current === null)) {
      setAnimationTick(0); // Reset animation tick when starting
      setChildAnimationTick(0); // Reset child animation tick when starting
      if (enableRockingAnimation && animationDirection === true) {
        setRock(true);
      } else if (enableExplodeAnimation) {
        setExplode(true);
      }
      previousAnimationDirection.current = animationDirection; // Set only when animation starts
    } else if (animationIsPlaying && previousAnimationDirection.current === animationDirection) {
      setAnimationIsPlaying(false); // Failsafe
    }
  }, [animationIsPlaying, enableRockingAnimation, enableExplodeAnimation, animationDirection, setAnimationIsPlaying]);

  // ANIMATION END EFFECT: Reset animation flags and invert animationDirection
  useEffect(() => {
    if (!animationIsPlaying && (rockingAnimationPlayed.current || explodeAnimationPlayed.current || childAnimationPlayed.current)) {
      
      // Swap initialPositions and desiredPositions based on whether or not we're reversing the animation
      if (animationDirection === false) {
        console.log(animationDirection);
        setInitialPositions(getInitialPositions(gltf));
        setDesiredPositions(getDesiredPositions(getInitialPositions(gltf)));
      } else {
        console.log(animationDirection);
        const tempInitialPositions = initialPositions;
        setInitialPositions(desiredPositions);
        setDesiredPositions(tempInitialPositions);
      } 

      // Reset values for next animation
      setAnimationDirection(animationDirection === true ? false : true); // Correctly update the animation direction
      setRock(false);
      setExplode(false);
      rockingAnimationPlayed.current = false;
      explodeAnimationPlayed.current = false;
      childAnimationPlayed.current = false;
      setAnimationTick(0);
      setChildAnimationTick(0);
    }
  }, [animationIsPlaying, animationDirection, setAnimationDirection]);

  // Animation
  useFrame((state, delta) => {
    console.log(animationIsPlaying)

    const adjustedDelta = delta;

    console.log()
    if (rock && enableRockingAnimation && animationTick <= 1 && !rockingAnimationPlayed.current) {
      setAnimationTick(prev => Math.min(prev + (adjustedDelta / (rockingTransitionDuration / 1000)), 1));
      const easedTick = easeInCubic(animationTick);

      gltf.scene.children.forEach((mesh) => {
        const randomX = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
        const randomY = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
        const randomZ = (Math.random() - 0.5) * rockingMaxAngle * easedTick;
        mesh.rotation.set(randomX, randomY, randomZ);
      });

      if (animationTick >= 1) {
        setRock(false);
        rockingAnimationPlayed.current = true;
        if (enableExplodeAnimation) {
          setExplode(true);
        }
        setAnimationTick(0); // Reset animation tick for the next animation

        // Reset rotations to initial values
        gltf.scene.children.forEach((mesh) => {
          mesh.rotation.set(0, 0, 0);
        });
      }
    } else if (explode && enableExplodeAnimation && animationTick <= 1 && !explodeAnimationPlayed.current) {
      setAnimationTick(prev => Math.min(prev + (adjustedDelta / (transitionDuration / 1000)), 1));
      const easedTick = animationDirection === true ? easeOutCubic(animationTick) : easeInCubic(animationTick);

      Object.keys(initialPositions).forEach((name) => {
        const initialPos = initialPositions[name];
        const desiredPos = desiredPositions[name];
        const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
        gltf.scene.getObjectByName(name).position.copy(currentPos);
      });

      if (animationTick >= 1) {
        setExplode(false);
        explodeAnimationPlayed.current = true;
        updateToolTipCirclePositions(); // Ensure we update the tooltip positions after the first explode animation

        // Check if there are objects with children
        if (!childAnimationPlayed.current && animationDirection === true) {
          const childInitialPositions = getChildrenInitialPositions(gltf);
          if (Object.keys(childInitialPositions).length > 0) {
            const childDesiredPositions = getDesiredPositions(childInitialPositions);
            setChildInitialPositions(childInitialPositions);
            setChildDesiredPositions(childDesiredPositions);
            setHasChildAnimation(true);
            setChildAnimationTick(0); // Reset child animation tick
          } else {
            setAnimationIsPlaying(false); // Set animationIsPlaying to false if no child animation
          }
        } else {
          setAnimationIsPlaying(false); // Set animationIsPlaying to false if child animation already played
        }
      }
    } else if (hasChildAnimation && childAnimationTick <= 1 && !childAnimationPlayed.current && animationDirection === true) {
      setChildAnimationTick(prev => Math.min(prev + (adjustedDelta / (childTransitionDuration / 1000)), 1));
      const easedTick = animationDirection === true ? easeOutCubic(childAnimationTick) : easeInCubic(childAnimationTick);

      Object.keys(childInitialPositions).forEach((name) => {
        const initialPos = childInitialPositions[name];
        const desiredPos = childDesiredPositions[name];
        const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
        gltf.scene.getObjectByName(name).position.copy(currentPos);
      });

      if (childAnimationTick >= 1) {
        setHasChildAnimation(false);
        childAnimationPlayed.current = true;
        updateToolTipCirclePositions(); // Ensure we update the tooltip positions after child animations end
        setAnimationIsPlaying(false); // Set animationIsPlaying to false after child animation

      }
    }

    // When reversing the animation, reset child positions
    if (animationIsPlaying && animationDirection === false && !childAnimationPlayed.current) {
      Object.keys(childInitialPositions).forEach((name) => {
        gltf.scene.getObjectByName(name).position.copy(childInitialPositions[name]);
      });
      childAnimationPlayed.current = true; // Mark child animation as played to prevent re-execution
    }
  });

  return (
    <Suspense fallback={null}>
      <primitive position={position} object={gltf.scene} />
    </Suspense>
  );
});
