import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import React from 'react';
import { parseJson, removeFileExtensionString, easeInCubic, easeOutCubic } from "../Helper";
import config from '../config';

export const ExplodingModelLoader = React.memo((props) => {
  const useStore = props.useStore; // Using useStore from props

  const {animationIsPlaying = false} = props;

  const {position = [0, 0, 0]} = props;
  const {modelName = 'explodingModel.glb'} = props;
  const {customOrigin = []} = props; // If for any reason the imported scene's position transform is not (0, 0, 0), specify it here
  const {animationStartOnLoad = false} = props;
  const {enableRockingAnimation = true} = props;
  const {enableExplodeAnimation = true} = props;
  const {setCameraTargetOnMount = true} = props;
  const {setCameraTargetTrigger = "trigger4"} = props;

  const {rockingMaxAngle = Math.PI / 16} = props;  
  const {rockingDuration = 2000} = props;
  const {explodingDuration = 2500} = props;
  const {childDuration = 700} = props;

  const {rotatingObjectAxisOfRotation = [0, 1, 0]} = props; // Rotating object's axis of rotation
  const {rotatingObjectSpeedOfRotation = 1.2} = props; // Rotating object's speed of rotation
  const {rotatingObjectScale = 3} = props; // Rotating object's scale
  const {rotatingObjectForcePositionOffset = {"left" : 0, "right" : 0, "top" : 0, "bottom" : 0}} = props; // Adjust the position of the rotating object on screen, values between -1 and 1 (left to right, top to bottom)

  // feature: Swap material
  const {materialName = ""} = props;

  const gltf = useLoader(GLTFLoader, config.resource_path + '/models/' + modelName);
  const newMaterialGltf = useLoader(GLTFLoader, config.resource_path + '/materials/' + ( (!materialName || materialName == "") ? "NoMaterial.glb" : materialName));
  const { camera, gl } = useThree();
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const cameraState = useStore((state) => state.cameraState);
  const animationDirection = useStore((state) => state.animationDirection);
  const setAnimationDirection = useStore((state) => state.setAnimationDirection);
  const setForcedCameraTarget = useStore((state) => state.setForcedCameraTarget);
  const transitionEnded = useStore((state) => state.transitionEnded);
  const triggers = useStore((state) => state.triggers);
  const setTrigger = useStore((state) => state.setTrigger);
  // const setExplodingModelName = useStore((state) => state.setExplodingModelName);
  const setTooltipCurrentObjectSelected = useStore((state) => state.setTooltipCurrentObjectSelected);
  const rotatingObjectViewportArray = useStore((state) => state.rotatingObjectViewportArray);
  const rotatingObjectForcedAxisOfRotation = useStore((state) => state.rotatingObjectForcedAxisOfRotation);
  const isCircleOnLeftSelected = useStore((state) => state.isCircleOnLeftSelected);
  const isHoveredCircleOnTop = useStore((state) => state.isHoveredCircleOnTop);
  const tooltipCurrentObjectNameSelected = useStore((state) => state.tooltipCurrentObjectNameSelected);
  // const explodingModelName = useStore((state) => state.explodingModelName);
  const addTooltipCirclesData = useStore((state) => state.addTooltipCirclesData);
  const modifyTooltipCircleData = useStore((state) => state.modifyTooltipCircleData);
  
  const [explodingModelName, setExplodingModelName] = useState(undefined);

  const [isPlaying, setIsPlaying] = useState(false);
  const [rock, setRock] = useState(false);
  const [explode, setExplode] = useState(false);

  const [initialPositions, setInitialPositions] = useState({});
  const [desiredPositions, setDesiredPositions] = useState({});
  const [childInitialPositions, setChildInitialPositions] = useState({});
  const [childDesiredPositions, setChildDesiredPositions] = useState({});

  const [animationTick, setAnimationTick] = useState(0);
  const [childAnimationTick, setChildAnimationTick] = useState(0);
  const [hasChildAnimation, setHasChildAnimation] = useState(false);

  const [rockingAnimationMaxAngle, setAnimationRockingMaxAngle] = useState(rockingMaxAngle);
  const [rockingTransitionDuration, setRockingTransitionDuration] = useState(rockingDuration);
  const [explodingTransitionDuration, setExplodingTransitionDuration] = useState(explodingDuration);
  const [childTransitionDuration, setChildTransitionDuration] = useState(childDuration);
  const [sceneOrigin, setSceneOrigin] = useState([gltf.scene.position.toArray()]);
  const [intersectionPoint, setIntersectionPoint] = useState(null);
  const [objectRotationAnimation, setObjectRotationAnimation] = useState(false);

    // Sets the imported model's origin point, a custom origin for the object if specified in the props
  const rockingAnimationPlayed = useRef(false);
  const explodeAnimationPlayed = useRef(false);
  const childAnimationPlayed = useRef(false);
  const previousAnimationDirection = useRef(null);
  const objectToRotate = useRef();
  const planeRef = useRef(new THREE.Object3D()); // Ref for the plane geometry

  var currentGlobalState = useThree();
  const cameraViewportSize = new THREE.Vector2(); // create once and reuse it
  currentGlobalState.gl.getSize(cameraViewportSize)

  function getInitialPositions(model) {
    var currentPositions = {};
    model.scene.children.forEach((mesh) => {
      currentPositions[mesh.name] = mesh.position.clone(); // Use clone to create a copy
    });

    return currentPositions;
  }

  function getDesiredPositions(currentPositions) {
    let zIndexTable = {
      0: -1,
      1: 0,
      2: 1
    };

    let nameSubstring = '';
    let DirectionValue = '';
    let zIndexValue = 0;
    let incrementValue = 0;
    let incrementVector = new THREE.Vector3(0, 0, 0);
    let newPositions = {};

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
    let currentPositions = {};

    model.scene.children.forEach((mesh) => {
      mesh.children.forEach((child) => {
        currentPositions[child.name] = child.position.clone(); // Use clone to create a copy for children
      });
    });
    return currentPositions;
  }
  const tooltipProperties = useStore((state) => state.tooltipProperties);

  // Makes the tooltip circles follow the objects when camera position and rotation values change
  const updateToolTipCirclePositions = () => {
    let positions = [];
    if(tooltipCirclesData){
      tooltipCirclesData.forEach((data) => {
        const objectName = data.objectName; 
        const object = gltf.scene.getObjectByName(objectName); // pass object as a parameter

        if (object) {
          const vector = new THREE.Vector3();
          object.getWorldPosition(vector);
          vector.project(camera);

          // Convert the normalized device coordinates (NDC) to screen space percentages
          const x = (vector.x * 0.5 + 0.5) * 100; // Percentage of width
          const y = (vector.y * -0.5 + 0.5) * 100; // Percentage of height

          modifyTooltipCircleData(objectName, {
            position: [x, y]
          });
        }
      });
    }
  };

  // Makes the tooltip circles follow the objects and updatethe invisible plane when camera position and rotation values change
  useEffect(() => {
    updateToolTipCirclePositions();
    planeRef.current.rotation.setFromVector3(currentGlobalState.camera.rotation)
    // console.log(cameraState.position)

  }, [cameraState]);

  //Parses a 3D model's corresponding json file to create info circles on the screen
  useEffect(() => {
    if(explodingModelName){
      parseJson(config.models_path + explodingModelName + ".json", "TooltipProperties")
      .then((data) => {
        console.log(config.models_path + explodingModelName + ".json", "TooltipProperties")
        addTooltipCirclesData(data);
      })
    }
  }, [explodingModelName]);

  // Set the model's properties by parsing a json or defaults to prop value
  useEffect(() => {
    parseJson(config.models_path + removeFileExtensionString(modelName) + ".json", 'ModelProperties')
      .then(modelProperties => {
          setRockingTransitionDuration(modelProperties?.rockingTransitionDuration ?? rockingDuration);
          setExplodingTransitionDuration(modelProperties?.explodingTransitionDuration ?? explodingDuration);
          setChildTransitionDuration(modelProperties?.childTransitionDuration ?? childDuration);
          setAnimationRockingMaxAngle(modelProperties?.rockingAnimationMaxAngle ?? rockingMaxAngle);
          setSceneOrigin(modelProperties?.customOrigin ?? (customOrigin.length != 0 ? customOrigin : gltf.scene.position.toArray()));
      })
      .catch(error => {
        console.error('Error parsing JSON:', error);
      });
  }, [modelName]);

  // Force change the camera's target on component mount
  useEffect(() => {
    if (setCameraTargetOnMount) {
      setForcedCameraTarget(sceneOrigin);
      setTrigger(setCameraTargetTrigger, false);
    }
  }, []);

  // Change the camera's target on trigger
  useEffect(() => {
    if(triggers[setCameraTargetTrigger]){
      setForcedCameraTarget(sceneOrigin)
      setTrigger(setCameraTargetTrigger, false)
    }
  }, [transitionEnded]);

  // Starts the animation when the animationIsPlaying prop is set to true
  useEffect(() => {
    if(animationIsPlaying){
      setIsPlaying(true)
    }
    else{
      setIsPlaying(false)
    }

  }, [animationIsPlaying]);

  // Automatically starts the animation when the animationStartOnLoad prop is set to true
  useEffect(() => {
    if(enableRockingAnimation && animationStartOnLoad){
      setRock(true)
      setIsPlaying(true)
    }

    if(enableExplodeAnimation && animationStartOnLoad){
      setExplode(true)
      setIsPlaying(true)
    }
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
      setExplodingModelName(removeFileExtensionString(modelName))
    }
  }, [gltf]);

  // Control the animations using the isPlaying state(set either by the animationIsPlaying or the animationStartOnLoad props)
  useEffect(() => {
    if (isPlaying && (previousAnimationDirection.current !== animationDirection || previousAnimationDirection.current === null)) {
      setAnimationTick(0); // Reset animation tick when starting
      setChildAnimationTick(0); // Reset child animation tick when starting
      if (enableRockingAnimation && animationDirection === true) {
        setRock(true);
      } else if (enableExplodeAnimation) {
        setExplode(true);
      }
      previousAnimationDirection.current = animationDirection; // Set only when animation starts
    } else if (isPlaying && previousAnimationDirection.current === animationDirection) {
      setIsPlaying(false); // Failsafe
    }
  }, [isPlaying, enableRockingAnimation, enableExplodeAnimation, animationDirection]);

  // Trigger animation start
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    if (!tooltipCurrentObjectNameSelected) {
      setObjectRotationAnimation(false);
    } else {
      const originalObject = gltf.scene.getObjectByName(tooltipCurrentObjectNameSelected);
      if (!originalObject) {
        console.warn(`Object '${tooltipCurrentObjectNameSelected}' not found in gltf scene.`);
        return;
      }

      const clonedObject = originalObject.clone(true); // Clone the object deeply
      objectToRotate.current = clonedObject;

      var ndcX = 0
      var ndcY = 0

      if (isCircleOnLeftSelected) {
        // Place the object on the left side of the viewport
        ndcX = rotatingObjectForcePositionOffset["left"] != 0 ? rotatingObjectForcePositionOffset["left"] :rotatingObjectViewportArray[0]
      } else {
        // Place the object on the right side of the viewport
        ndcX = rotatingObjectForcePositionOffset["right"] != 0 ? rotatingObjectForcePositionOffset["right"] : rotatingObjectViewportArray[1]
      }
  
      if (isHoveredCircleOnTop) {
        // Place the object on the top side of the viewport
        ndcY = rotatingObjectForcePositionOffset["bottom"] != 0 ? rotatingObjectForcePositionOffset["bottom"] : rotatingObjectViewportArray[3]
      } else {
        // Place the object on the bottom side of the viewport
        ndcY = rotatingObjectForcePositionOffset["top"] != 0 ? rotatingObjectForcePositionOffset["top"] : rotatingObjectViewportArray[2]
      }

      ndcX > 1 ? ndcX = 1 : ndcX = ndcX
      ndcX < -1 ? ndcX = -1 : ndcX = ndcX
      ndcY > 1 ? ndcY = 1 : ndcY = ndcY
      ndcY < -1 ? ndcY = -1 : ndcY = ndcY

      const ndc = new THREE.Vector3(ndcX, ndcY, -1)
      raycaster.setFromCamera(ndc, camera);
      // UNCOMENT THIS if you want to see the casted ray
      // currentGlobalState.scene.add(new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 300, 0xff0000) );
      const intersects = raycaster.intersectObject(planeRef.current, true);
      const midpoint = new THREE.Vector3();

      if(intersects.length != 0){
        // Calculate the 'midpoint' between the source of the ray and the collision point
        midpoint.addVectors(raycaster.ray.origin, intersects[0].point).multiplyScalar(0.5);
        
        // Sets the rotating object's position
        objectToRotate.current.position.x = midpoint.x;
        objectToRotate.current.position.y = midpoint.y;
        objectToRotate.current.position.z = midpoint.z;
        
      }

      if (intersects.length > 0) {
        const point = intersects[0].point;
        setIntersectionPoint(point);
      }

      setObjectRotationAnimation(true);
    }
  }, [tooltipCurrentObjectNameSelected, isCircleOnLeftSelected, isHoveredCircleOnTop, gltf.scene]);




  // ANIMATION END EFFECT: Reset animation flags and invert animationDirection
  useEffect(() => {
    if (!isPlaying && (rockingAnimationPlayed.current || explodeAnimationPlayed.current || childAnimationPlayed.current)) {
      
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
  }, [isPlaying, animationDirection, setAnimationDirection]);

  // Animation
  useFrame((state, delta) => {
    if(isPlaying){
      const adjustedDelta = delta;

      if (rock && enableRockingAnimation && animationTick <= 1 && !rockingAnimationPlayed.current) {
        setAnimationTick(prev => Math.min(prev + (adjustedDelta / (rockingTransitionDuration / 1000)), 1));
        const easedTick = easeInCubic(animationTick);
  
        gltf.scene.children.forEach((mesh) => {
          const randomX = (Math.random() - 0.5) * rockingAnimationMaxAngle * easedTick;
          const randomY = (Math.random() - 0.5) * rockingAnimationMaxAngle * easedTick;
          const randomZ = (Math.random() - 0.5) * rockingAnimationMaxAngle * easedTick;
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
        setAnimationTick(prev => Math.min(prev + (adjustedDelta / (explodingTransitionDuration / 1000)), 1));
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
              setIsPlaying(false); // Set isPlaying to false if no child animation
            }
          } else {
            setIsPlaying(false); // Set isPlaying to false if child animation already played
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
          setIsPlaying(false); // Set isPlaying to false after child animation
        }
      }
  
      // When reversing the animation, reset child positions
      if (animationDirection === false && !childAnimationPlayed.current) {
        Object.keys(childInitialPositions).forEach((name) => {
          gltf.scene.getObjectByName(name).position.copy(childInitialPositions[name]);
        });
        childAnimationPlayed.current = true; // Mark child animation as played to prevent re-execution
      }
    }
  });

  // Object rotation animation
  useFrame((state, delta) => {
    if(objectRotationAnimation){
      if (objectToRotate.current){
        // Apply the speed to the axis provided either by the prop or a json file
        objectToRotate.current.rotation.x += ((rotatingObjectForcedAxisOfRotation != [] ? rotatingObjectForcedAxisOfRotation[0] : rotatingObjectAxisOfRotation[0]) * rotatingObjectSpeedOfRotation) * delta;
        objectToRotate.current.rotation.y += ((rotatingObjectForcedAxisOfRotation != [] ? rotatingObjectForcedAxisOfRotation[1] : rotatingObjectAxisOfRotation[1]) * rotatingObjectSpeedOfRotation) * delta;
        objectToRotate.current.rotation.z += ((rotatingObjectForcedAxisOfRotation != [] ? rotatingObjectForcedAxisOfRotation[2] : rotatingObjectAxisOfRotation[2]) * rotatingObjectSpeedOfRotation) * delta;
      }
    }
  });

  // Material change feature
  useEffect(() => {
    if (materialName != "" && materialName && newMaterialGltf && gltf) {
      const newMaterial = newMaterialGltf.scene.children.find(child => child.isMesh)?.material;

      if (newMaterial) {
        // Traverse the main scene to apply the new material to each mesh
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.material = newMaterial;
            child.material.needsUpdate = true;
          }
        });
      }
    }
  }, [materialName, newMaterialGltf, gltf]);

  return (
    <Suspense fallback={null}>
      <primitive position={position} object={gltf.scene} />
      <mesh>
        {/* Render the cloned object directly */}
        {(objectToRotate.current && objectRotationAnimation /*COMMENT && objectRotationAnimation to make the rotating object stay visible on unhover*/) && (
          <primitive scale = {rotatingObjectScale} object={objectToRotate.current} position={objectToRotate.current.position} />
        )}
      </mesh>

      {/* Create a plane in front of the camera for the raycaster to collide with */}
      <mesh ref={planeRef} position={sceneOrigin} >
        <planeGeometry  /*scale={new THREE.Vector3(15,15,15)} */args={[150,150]} />
        <meshBasicMaterial color={0xffffff} side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>
    </Suspense>
  );
});
