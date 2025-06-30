import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import React from 'react';
import { parseJson, removeFileExtensionString, easeInCubic, easeOutCubic, createArchCurve } from "../Helper";
import config from '../config';

export const ExplodingModelLoader = React.memo((props) => {
  const useStore = props.useStore; // Using useStore from props

  const {animationIsPlaying = false} = props;

  const {position = [0, 0, 0]} = props;
  const {modelName = 'example_model.glb'} = props;
  const {configFile = 'example_model.json'} = props;
  const {materialName = ""} = props; // feature: Swap material
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
  const {showCirclesAfterExplodingAnimation = true} = props; // If true, all tooltip circles appear automatically after the explode animation finishes. If false, visibility is set right after the scene loads.

  const {focusedObjectCloneEnable = true} = props; // Rotating object's scale
  const {focusedObjectCloneScale = 1} = props; // Rotating object's scale
  const {focusedObjectCloneAxisOfRotation = [0, 1, 0]} = props; // Rotating object's axis of rotation
  const {focusedObjectCloneSpeedOfRotation = 1.2} = props; // Rotating object's speed of rotation
  const {focusedObjectCloneForcePositionOffset = {"left" : -0.5, "right" : 0.5, "top" : 0.25, "bottom" : -0.25}} = props; // Adjust the position of the rotating object on screen, values between -1 and 1 (left to right, top to bottom)

  const {enableMainObjectRotationAnimation = true} = props; // R
  const {mainObjectRotationAnimationRotationSpeed = 0.5} = props; // R
  const {mainObjectRotationAnimationWhenToStop = "onScreenMouseHover"} = props; // R
  const {mainObjectRotationAnimationResetInitialRotation = true} = props; // R
  const {mainObjectRotationAnimationResetInitialRotationAnimationSpeed = 8} = props; // R
  const {mainObjectRotationAnimationRestartAnimationAfterStop = true} = props; // R
  const {stopMainObjectRotationAnimation = undefined} = props; // A trigger that will be able to stop the animation from outside the component
  const {mainObjectRotationAnimationIsPlayingTrigger = undefined} = props; // The trigger that will be set to true when the animation stops

  const {tubeCurveDebugMode = false} = props; // Show the transition curve when circles are hovered
  
// ------------------------------------------------------------------------------------ //
  // Should these values not be specified in the model's config files, these default values will be applied
  const focusedObjectFrontDefault = [1, 0, 0];
  const focusedObjectFocusPointDefault = [0, 0, 0];
  const focusedObjectFocusEndPointDistanceDefault = 8;
  const focusedObjectCameraTargetPointDefault = [0, 0, 0];
  const focusedObjectArchWidthDefault = 5;
  const focusedObjectArchCurveDirectionDefault = [1, 0, 0];

  const isFocusableDefault = true;
  const focusTargetDefault = "";
  const focusGroupDefault = "";
  const showCirclesAfterFocusAnimationDefault = true;
  const waitForFocusBeforeExplodeAnimationDefault = true;

  const gltf = useLoader(GLTFLoader, config.models_path + modelName);

  const { camera, gl } = useThree();


  const isCanvasHovered = useStore((state) => state.isCanvasHovered);
  const cameraState = useStore((state) => state.cameraState);
  const setForcedCameraTarget = useStore((state) => state.setForcedCameraTarget);
  const transitionEnded = useStore((state) => state.transitionEnded);
  const setTransitionEnded = useStore((state) => state.setTransitionEnded);
  const triggers = useStore((state) => state.triggers);
  const setTrigger = useStore((state) => state.setTrigger);
  const isCircleOnLeftSelected = useStore((state) => state.isCircleOnLeftSelected);
  const isCircleOnTopSelected = useStore((state) => state.isCircleOnTopSelected);
  const tooltipCurrentObjectNameSelected = useStore((state) => state.tooltipCurrentObjectNameSelected);
  const tooltipCirclesData = useStore((state) => state.tooltipCirclesData);
  const addTooltipCirclesData = useStore((state) => state.addTooltipCirclesData);
  const modifyTooltipCircleData = useStore((state) => state.modifyTooltipCircleData);
  const setTooltipCirclesData = useStore((state) => state.setTooltipCirclesData);
  const setForcedCameraMovePathCurve = useStore((state) => state.setForcedCameraMovePathCurve);
  const setCameraStateTracking = useStore((state) => state.setCameraStateTracking);
  const isDragging = useStore((state) => state.isDragging);
  const isMouseDown = useStore((state) => state.isMouseDown);
  const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
  const isReturnButtonPressed = useStore((state) => state.isReturnButtonPressed);
  const setShowReturnButton = useStore((state) => state.setShowReturnButton);
  const setForcedCameraPosition = useStore((state) => state.setForcedCameraPosition);

  const [initialPositions, setInitialPositions] = useState({});
  const [desiredPositions, setDesiredPositions] = useState({});
  const [childInitialPositions, setChildInitialPositions] = useState({});
  const [childDesiredPositions, setChildDesiredPositions] = useState({});

  const [shouldRenderClone, setShouldRenderClone] = useState(false);

  const [animationTick, setAnimationTick] = useState(0);

  const [explodingObjectPosition, setExplodingObjectPosition] = useState([0, 0, 0]);
  const [explodingObjectAnimationStartOnLoad, setExplodingObjectAnimationStartOnLoad] = useState(false);
  const [explodingObjectEnableRockingAnimation, setExplodingObjectEnableRockingAnimation] = useState(true);
  const [explodingObjectEnableExplodeAnimation, setExplodingObjectEnableExplodeAnimation] = useState(true);
  // const [sceneOrigin, setSceneOrigin] = useState([gltf.scene.position.toArray()]); // Sets the imported model's origin point, a custom origin for the object if specified in the props
  const [sceneOrigin, setSceneOrigin] = useState(gltf.scene.position.toArray());


  const [intersectionPoint, setIntersectionPoint] = useState(null); // Might be usefull for projecting more stuff in front of the camera in the future, ???use useRef???

  const [forcedCameraPositionArray, setForcedCameraPositionArray] = useState(undefined);

  const rockingAnimationMaxAngle = useRef(undefined); // How drastic will the 'shaking' of the animation be
  const showCirclesAfterExplodingAnimationRef = useRef(undefined); // If true, all tooltip circles appear automatically after the explode animation finishes. If false, visibility is set right after the scene loads.
  const foCloneScale = useRef(undefined);
  const foCloneAxisOfRotation = useRef(undefined);
  const foCloneSpeedOfRotation = useRef(undefined);
  const foCloneForcePositionOffset = useRef(undefined);
  const foCloneEnable = useRef(true); // Enables the rotating object's animation
  const foFocusPoint = useRef([0, 0, 0]); // The point that the camera will transition to if the object is focused on(if circle is clicked)
  const foFocusEndPointDistance = useRef(0); // The distance from the focus point, that the camera will transition to
  const foFront = useRef([1, 0, 0]); // The 'front' of the object for the object focusing feature
  const foCameraTargetPoint = useRef([0, 0, 0]);
  const foArchWidth = useRef(1); // How wide must the transition's curve be when the object is focused
  const foArchcurveDirection = useRef([1, 0, 0]); // How wide must the transition's curve be when the object is focused

  const isFocusable = useRef(undefined); // Whether the object can be focused by clicking its circle. Set to false to disable focus transitions for this object.
  const focusTarget = useRef(undefined); // Identifier used to group focusable objects. Used to show/hide related tooltip circles when one object is focused.
  const focusGroup = useRef(undefined); // Defines the group this object belongs to. If another object has a matching focusTarget, this object will be visible when that one is selected.
  const showCirclesAfterFocusAnimation = useRef(undefined); // if true, only shows the circles after the camera transition is finished
  const waitForFocusBeforeExplodeAnimation = useRef(undefined); // if true, only shows the circles after the camera transition is finished

  const rockingAnimationPlayed = useRef(false);
  const explodeAnimationPlayed = useRef(false);
  const previousAnimationDirection = useRef(null);

  const tooltipCirclesDatajsonParsed = useRef(false);

  const objectsThatHaveExploded = useRef([]);

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

  // function getDesiredPositions(currentPositions) {
  //   let zIndexTable = {
  //     0: -1,
  //     1: 0,
  //     2: 1
  //   };

  //   let nameSubstring = '';
  //   let DirectionValue = '';
  //   let zIndexValue = 0;
  //   let incrementValue = 0;
  //   let incrementVector = new THREE.Vector3(0, 0, 0);
  //   let newPositions = {};

  //   Object.keys(currentPositions).forEach((name) => {
  //     nameSubstring = name.slice(-4); // take the 4 characters at the end of the model's name to extract the values
  //     zIndexValue = zIndexTable[parseInt(nameSubstring[0], 10)];
  //     DirectionValue = nameSubstring[1] + nameSubstring[2];
  //     incrementValue = parseInt(nameSubstring[3], 10);

  //     switch (DirectionValue) {
  //       case 'TL':
  //         incrementVector = new THREE.Vector3(-1, 1, zIndexValue);
  //         break;

  //       case 'TT':
  //         incrementVector = new THREE.Vector3(0, 1, zIndexValue);
  //         break;

  //       case 'TR':
  //         incrementVector = new THREE.Vector3(1, 1, zIndexValue);
  //         break;

  //       case 'LL':
  //         incrementVector = new THREE.Vector3(-1, 0, zIndexValue);
  //         break;

  //       case 'MM':
  //         incrementVector = new THREE.Vector3(0, 0, zIndexValue);
  //         break;

  //       case 'RR':
  //         incrementVector = new THREE.Vector3(1, 0, zIndexValue);
  //         break;

  //       case 'BL':
  //         incrementVector = new THREE.Vector3(-1, -1, zIndexValue);
  //         break;

  //       case 'BB':
  //         incrementVector = new THREE.Vector3(0, -1, zIndexValue);
  //         break;

  //       case 'BR':
  //         incrementVector = new THREE.Vector3(1, -1, zIndexValue);
  //         break;

  //       default:
  //         incrementVector = new THREE.Vector3(0, 0, 0);
  //     }

  //     // Clone the current position to avoid mutating the original object
  //     let newPosition = currentPositions[name].clone();

  //     newPositions[name] = newPosition.add(incrementVector.multiplyScalar(incrementValue * 4));
  //   });

  //   return newPositions;
  // }

  function getDesiredPositions(currentPositions, directionForward = true) {
  const zIndexTable = {
    0: -1,
    1: 0,
    2: 1,
  };

  const newPositions = {};

  Object.keys(currentPositions).forEach((name) => {
    // parse name suffix: [z][D][D][n], e.g. "1TR3"
    const nameSubstring = name.slice(-4);
    const zIndexValue = zIndexTable[parseInt(nameSubstring[0], 10)];
    const DirectionValue = nameSubstring[1] + nameSubstring[2];
    const incrementValue = parseInt(nameSubstring[3], 10);

    let incrementVector;
    switch (DirectionValue) {
      case 'TL': incrementVector = new THREE.Vector3(-1,  1, zIndexValue); break;
      case 'TT': incrementVector = new THREE.Vector3( 0,  1, zIndexValue); break;
      case 'TR': incrementVector = new THREE.Vector3( 1,  1, zIndexValue); break;
      case 'LL': incrementVector = new THREE.Vector3(-1,  0, zIndexValue); break;
      case 'MM': incrementVector = new THREE.Vector3( 0,  0, zIndexValue); break;
      case 'RR': incrementVector = new THREE.Vector3( 1,  0, zIndexValue); break;
      case 'BL': incrementVector = new THREE.Vector3(-1, -1, zIndexValue); break;
      case 'BB': incrementVector = new THREE.Vector3( 0, -1, zIndexValue); break;
      case 'BR': incrementVector = new THREE.Vector3( 1, -1, zIndexValue); break;
      default:   incrementVector = new THREE.Vector3( 0,  0, 0);         break;
    }

    // clone so we don’t mutate the original
    const newPosition = currentPositions[name].clone();

    // if directionForward is false, invert the movement
    const scalar = incrementValue * 4 * (directionForward ? 1 : -1);
    newPositions[name] = newPosition.add(incrementVector.multiplyScalar(scalar));
  });

  return newPositions;
}

  // Change the camera's target on trigger
  useEffect(() => {
    if(triggers[setCameraTargetTrigger]){
      setForcedCameraTarget(sceneOrigin)
      setTrigger(setCameraTargetTrigger, false)
    }
  }, [transitionEnded]);

  // Force change the camera's target on component mount
  useEffect(() => {
    if (setCameraTargetOnMount) {
      setForcedCameraTarget(sceneOrigin);
      setTrigger(setCameraTargetTrigger, false); // necessary?
    }
  }, []);

  /////////////////////////////////////////////////////////////
  /// Sets properties by with props or by json config files ///
  /////////////////////////////////////////////////////////////

  // Use the tooltipCurrentObjectNameSelected in a local context
  const currentSelectedObjectName = useRef(undefined);
  useEffect(() => {
    currentSelectedObjectName.current = tooltipCurrentObjectNameSelected
  }, [tooltipCurrentObjectNameSelected])

  //Parses a 3D model's corresponding to a json file to create info circles on the screen
  useEffect(() => {
    if(modelName){
      parseJson(config.models_path + configFile, "ObjectProperties")
      .then((ObjectProperties) => {
        setTooltipCirclesData([])
        addTooltipCirclesData(ObjectProperties);
        tooltipCirclesDatajsonParsed.current = true;
      })
    }
  }, [modelName]);

  const focusedObjectWorldPosition = useRef(new THREE.Vector3())
  // Set the tooltip circle's properties
  useEffect(() => {
    const tCircleData = tooltipCirclesData.find(item => item.objectName === currentSelectedObjectName.current);
    focusedObjectWorldPosition.current = currentSelectedObjectName.current == undefined ? focusedObjectWorldPosition.current : gltf.scene.getObjectByName(currentSelectedObjectName.current)?.getWorldPosition(new THREE.Vector3());
    
    foFront.current = tCircleData?.focusedObjectFront ?? focusedObjectFrontDefault;
    foFocusPoint.current =  tCircleData?.focusedObjectFocusPoint ?? focusedObjectWorldPosition.current ?? focusedObjectFocusPointDefault;
    foFocusEndPointDistance.current = tCircleData?.focusedObjectFocusEndPointDistance ?? focusedObjectFocusEndPointDistanceDefault;

    foCameraTargetPoint.current =  tCircleData?.focusedObjectCameraTargetPoint ?? focusedObjectWorldPosition.current.toArray() ?? focusedObjectCameraTargetPointDefault;
    foArchWidth.current = tCircleData?.focusedObjectArchWidth ?? focusedObjectArchWidthDefault;
    foArchcurveDirection.current = tCircleData?.focusedObjectArchCurveDirection ?? focusedObjectArchCurveDirectionDefault;

    isFocusable.current = tCircleData?.isFocusable ?? isFocusableDefault;
    focusTarget.current = tCircleData?.focusTarget ?? focusTargetDefault;
    focusGroup.current = tCircleData?.focusGroup ?? focusGroupDefault;
    
    showCirclesAfterFocusAnimation.current = tCircleData?.showCirclesAfterFocusAnimation ?? showCirclesAfterFocusAnimationDefault;
    
    waitForFocusBeforeExplodeAnimation.current = tCircleData?.waitForFocusBeforeExplodeAnimation ?? waitForFocusBeforeExplodeAnimationDefault;
    
    foCloneEnable.current = tCircleData?.focusedObjectCloneEnable ?? focusedObjectCloneEnable;
    setShouldRenderClone(true);
    foCloneScale.current = tCircleData?.focusedObjectCloneScale ?? focusedObjectCloneScale;
    foCloneAxisOfRotation.current = tCircleData?.focusedObjectCloneAxisOfRotation ?? focusedObjectCloneAxisOfRotation;
    foCloneSpeedOfRotation.current = tCircleData?.focusedObjectCloneSpeedOfRotation ?? focusedObjectCloneSpeedOfRotation;
    foCloneForcePositionOffset.current = tCircleData?.focusedObjectCloneForcePositionOffset ?? focusedObjectCloneForcePositionOffset;
  }, [currentSelectedObjectName.current]);

  // Set the model's properties by parsing a json or defaults to prop value
  useEffect(() => {
    parseJson(config.models_path + configFile, 'ModelProperties')
      .then(modelProperties => {
        setExplodingObjectPosition(modelProperties?.position ?? position)
        setExplodingObjectAnimationStartOnLoad(modelProperties?.animationStartOnLoad ?? animationStartOnLoad)
        setExplodingObjectEnableRockingAnimation(modelProperties?.enableRockingAnimation ?? enableRockingAnimation)
        setExplodingObjectEnableExplodeAnimation(modelProperties?.enableExplodeAnimation ?? enableExplodeAnimation)
        setSceneOrigin(modelProperties?.customOrigin ?? (customOrigin.length != 0 ? customOrigin : gltf.scene.position.toArray()));
        setRockingTransitionDuration(modelProperties?.rockingTransitionDuration ?? rockingDuration);
        setExplodingTransitionDuration(modelProperties?.explodingTransitionDuration ?? explodingDuration);
        setChildTransitionDuration(modelProperties?.childTransitionDuration ?? childDuration);
        console.log(modelProperties?.forcedCameraPosition)
        setForcedCameraPositionArray(modelProperties?.forcedCameraPosition)
        showCirclesAfterExplodingAnimationRef.current = modelProperties?.showCirclesAfterExplodingAnimation ?? showCirclesAfterExplodingAnimation;
        rockingAnimationMaxAngle.current = modelProperties?.rockingMaxAngleDegrees * (Math.PI / 180) ?? rockingMaxAngle; // conversion to radians
        enableRotationAnimation.current = modelProperties?.enableRotationAnimation ?? enableMainObjectRotationAnimation;
        rotationAnimationSpeed.current = modelProperties?.rotationAnimationSpeed ?? mainObjectRotationAnimationRotationSpeed;
        rotationAnimationWhenToStop.current = modelProperties?.rotationAnimationWhenToStop ?? mainObjectRotationAnimationWhenToStop;
        resetInitialRotation.current = modelProperties?.resetInitialRotation ?? mainObjectRotationAnimationResetInitialRotation;
        resetInitialRotationAnimationSpeed.current = modelProperties?.resetInitialRotationAnimationSpeed ?? mainObjectRotationAnimationResetInitialRotationAnimationSpeed;
        restartAnimationAfterStop.current = modelProperties?.restartAnimationAfterStop ?? mainObjectRotationAnimationRestartAnimationAfterStop;
      })
      .catch(error => {
        console.error('Error parsing JSON:', error);
      });
  }, [modelName]);

  /////////////////////////////////////
  /// Main model rotation animation ///
  /////////////////////////////////////

  const enableRotationAnimation = useRef(undefined);
  const rotationAnimationSpeed = useRef(undefined);
  const rotationAnimationWhenToStop = useRef(undefined); // "onScreenMouseHover", "onMouseDown", "never"
  const resetInitialRotation = useRef(undefined);
  const resetInitialRotationAnimationSpeed = useRef(undefined);
  const restartAnimationAfterStop = useRef(undefined);

  const startRotationAnimation = useRef(false);
  const initialRotation = useRef(new THREE.Euler());
  const restoringRotation = useRef(false);

  const modelRef = useRef();

  useEffect(() => {
    if (modelRef.current) {
      initialRotation.current.copy(modelRef.current.rotation);
    }
  }, [gltf]);

  useFrame((state, delta) => {
    if(enableRotationAnimation.current){
      const model = modelRef.current;

      if (!model) return;

      // Stops animation if mouse is down
      if(rotationAnimationWhenToStop.current == "onMouseDown" && isMouseDown){
        startRotationAnimation.current = false;
      }

      if(rotationAnimationWhenToStop.current == "onScreenMouseHover" && isCanvasHovered){
        startRotationAnimation.current = false;
      }

      console.log(tooltipCurrentObjectNameSelected)
      // Stops animation if a circle is hovered
      if(tooltipCurrentObjectNameSelected){
        startRotationAnimation.current = false;
      }
      
      // Stops the animation externaly
      if(stopMainObjectRotationAnimation){
        startRotationAnimation.current = false;
      }

      // Animate
      if (startRotationAnimation.current) {
        model.rotation.y += rotationAnimationSpeed.current * delta;

        if(!triggers[mainObjectRotationAnimationIsPlayingTrigger]){
          // Set a trigger for parent control
          setTrigger(mainObjectRotationAnimationIsPlayingTrigger, true)
        }

        updateToolTipCirclePositions();
      }

      if (resetInitialRotation.current && !startRotationAnimation.current) {
        restoringRotation.current = true;
      }

      if (!startRotationAnimation.current && restoringRotation.current) {
        const currentY = THREE.MathUtils.euclideanModulo(model.rotation.y, Math.PI * 2);
        const targetY = THREE.MathUtils.euclideanModulo(initialRotation.current.y, Math.PI * 2);
        
        model.rotation.y = THREE.MathUtils.lerp(
          currentY,
          targetY,
          resetInitialRotationAnimationSpeed.current * delta
        );

        const diff = Math.abs(model.rotation.y - initialRotation.current.y);
        if (diff < 0.001) {
          model.rotation.copy(initialRotation.current);
          restoringRotation.current = false;
        }

        updateToolTipCirclePositions();
      }

      if (restartAnimationAfterStop.current && !startRotationAnimation.current
        &&
        ((resetInitialRotation && restoringRotation.current == false) || (!resetInitialRotation))) {
          startRotationAnimation.current = true;
      }
    }
  });

  // Set a trigger for parent control
  useEffect(() => {
    if(mainObjectRotationAnimationIsPlayingTrigger != undefined && !startRotationAnimation.current){
      setTrigger(mainObjectRotationAnimationIsPlayingTrigger, false)
    }
  }, [startRotationAnimation.current]);

  /////////////////////////////////////////
  /// Focused object rotation animation ///
  /////////////////////////////////////////

  const objectToRotate = useRef();
  const planeRef = useRef(new THREE.Object3D());
  const distanceRef = useRef(5); // how far in front of the camera you want the plane

  // Drive position & rotation whenever the camera moves:
  useEffect(() => {
    if (!planeRef.current) return;

    // compute once when cameraState changes
    const dir = new THREE.Vector3();

    // Get the forward direction of the camera
    camera.getWorldDirection(dir);

    // Position the plane at camera.position + dir * distance
    planeRef.current.position
      .copy(camera.position)
      .add(dir.multiplyScalar(distanceRef.current));

    // Align the plane’s orientation with the camera
    planeRef.current.quaternion.copy(camera.quaternion);

  }, [cameraState, camera]);

  // Trigger animation start
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    if (!currentSelectedObjectName.current || foCloneEnable.current != true) {
      foCloneEnable.current = false;
      setShouldRenderClone(false);
    } else {
      const originalObject = gltf.scene.getObjectByName(currentSelectedObjectName.current);
      if (!originalObject) {
        console.warn(`Object '${currentSelectedObjectName.current}' not found in gltf scene.`);
        return;
      }

      const clonedObject = originalObject.clone(true); // Clone the object deeply
      objectToRotate.current = clonedObject;

      var ndcX = 0
      var ndcY = 0

      if (isCircleOnLeftSelected) {
        // Place the object on the left side of the viewport
        ndcX = foCloneForcePositionOffset.current["left"]
      } else {
        // Place the object on the right side of the viewport
        ndcX = foCloneForcePositionOffset.current["right"]
      }
  
      if (isCircleOnTopSelected) {
        // Place the object on the top side of the viewport
        ndcY = foCloneForcePositionOffset.current["bottom"]
      } else {
        // Place the object on the bottom side of the viewport
        ndcY = foCloneForcePositionOffset.current["top"]
      }

      ndcX > 1 ? ndcX = 1 : ndcX = ndcX
      ndcX < -1 ? ndcX = -1 : ndcX = ndcX
      ndcY > 1 ? ndcY = 1 : ndcY = ndcY
      ndcY < -1 ? ndcY = -1 : ndcY = ndcY

      const ndc = new THREE.Vector3(ndcX, ndcY, -1)
      raycaster.setFromCamera(ndc, camera);
      // DEBUG: UNCOMENT THIS if you want to see the casted ray
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
        setIntersectionPoint(point); // Might be usefull for projecting more stuff in front of the camera in the future
      }

    }
  }, [currentSelectedObjectName.current, isCircleOnLeftSelected, isCircleOnTopSelected, gltf.scene]);

    // Focused object rotation animation
  useFrame((state, delta) => {
    if(foCloneEnable.current){
      if (objectToRotate.current){
        // Apply the speed to the axis provided either by the prop or a json file
        objectToRotate.current.rotation.x += (foCloneAxisOfRotation.current[0] * foCloneSpeedOfRotation.current) * delta;
        objectToRotate.current.rotation.y += (foCloneAxisOfRotation.current[1] * foCloneSpeedOfRotation.current) * delta;
        objectToRotate.current.rotation.z += (foCloneAxisOfRotation.current[2] * foCloneSpeedOfRotation.current) * delta;
      }
    }
  });

  /////////////////////////////////////////////////////
  /// Main model's rocking and exploding animations ///
  /////////////////////////////////////////////////////

  const [animationDirectionForward, setAnimationDirectionForward] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false); // Set isPlaying manually back to true to reverse the animation
  const [rock, setRock] = useState(false);
  const [explode, setExplode] = useState(false);
  const [rockingTransitionDuration, setRockingTransitionDuration] = useState(rockingDuration);
  const [explodingTransitionDuration, setExplodingTransitionDuration] = useState(explodingDuration);
  const [childTransitionDuration, setChildTransitionDuration] = useState(childDuration);

  // Automatically starts the animation when the animationStartOnLoad prop is set to true
  useEffect(() => {
    if(explodingObjectEnableRockingAnimation && explodingObjectAnimationStartOnLoad){
      setRock(true)
      setIsPlaying(true)
    }

    if(explodingObjectEnableExplodeAnimation && explodingObjectAnimationStartOnLoad){
      setExplode(true)
      setIsPlaying(true)
    }
  }, [explodingObjectAnimationStartOnLoad]);

  // When model loads, set the initial and desired positions of the the objects for the exploding animation
  useEffect(() => {
    if (gltf) {
      const initialPositions = getInitialPositions(gltf);
      const desiredPositions = getDesiredPositions(initialPositions);
      setInitialPositions(initialPositions);
      setDesiredPositions(desiredPositions);
    }
  }, [gltf]);

  // Control the animations using the isPlaying state(set either by the animationIsPlaying or the animationStartOnLoad props)
  useEffect(() => {
    if (isPlaying && (previousAnimationDirection.current !== animationDirectionForward || previousAnimationDirection.current === null)) {
      if (explodingObjectEnableRockingAnimation && animationDirectionForward === true) {
        setRock(true);
      } else if (explodingObjectEnableExplodeAnimation) {
        setExplode(true);
      }
      previousAnimationDirection.current = animationDirectionForward; // Set only when animation starts
    } else if (isPlaying && previousAnimationDirection.current === animationDirectionForward) {
      setIsPlaying(false); // Failsafe
    }
  }, [isPlaying, explodingObjectEnableRockingAnimation, explodingObjectEnableExplodeAnimation, animationDirectionForward]);

  // ANIMATION END EFFECT: Reset animation flags and invert animationDirectionForward
  useEffect(() => {
      if (!isPlaying && (rockingAnimationPlayed.current || explodeAnimationPlayed.current)) {
        if (animationDirectionForward === false) {
          setInitialPositions(getInitialPositions(gltf));
          setDesiredPositions(getDesiredPositions(getInitialPositions(gltf)));
        } else {
          const tempInitialPositions = initialPositions;
          setInitialPositions(desiredPositions);
          setDesiredPositions(tempInitialPositions);
        } 

        setAnimationDirectionForward(animationDirectionForward === true ? false : true);
        setRock(false);
        setExplode(false);
        rockingAnimationPlayed.current = false;
        explodeAnimationPlayed.current = false;
        setAnimationTick(0);
      }
  }, [isPlaying, animationDirectionForward, setAnimationDirectionForward]);

  // Starts the animation when the animationIsPlaying prop is set to true
  useEffect(() => {
    if(animationIsPlaying){
      setIsPlaying(true)
    }
    else{
      setIsPlaying(false)
    }

  }, [animationIsPlaying]);

  // Animation
 useFrame((state, delta) => {
    if(isPlaying){
      const adjustedDelta = delta;

      if (rock && explodingObjectEnableRockingAnimation && animationTick <= 1 && !rockingAnimationPlayed.current) {
        setAnimationTick(prev => Math.min(prev + (adjustedDelta / (rockingTransitionDuration / 1000)), 1));
        const easedTick = easeInCubic(animationTick);
        gltf.scene.children.forEach((mesh) => {
          const randomX = (Math.random() - 0.5) * rockingAnimationMaxAngle.current * easedTick;
          const randomY = (Math.random() - 0.5) * rockingAnimationMaxAngle.current * easedTick;
          const randomZ = (Math.random() - 0.5) * rockingAnimationMaxAngle.current * easedTick;
          mesh.rotation.set(randomX, randomY, randomZ);
        });

        if (animationTick >= 1) {
          setRock(false);
          rockingAnimationPlayed.current = true;
          if (explodingObjectEnableExplodeAnimation) {
            setExplode(true);
          }
          setAnimationTick(0);

          gltf.scene.children.forEach((mesh) => {
            mesh.rotation.set(0, 0, 0);
          });
        }
      } else if (explode && explodingObjectEnableExplodeAnimation && animationTick <= 1 && !explodeAnimationPlayed.current) {
        setAnimationTick(prev => Math.min(prev + (adjustedDelta / (explodingTransitionDuration / 1000)), 1));
        const easedTick = animationDirectionForward === true ? easeOutCubic(animationTick) : easeInCubic(animationTick);

        Object.keys(initialPositions).forEach((name) => {
          const initialPos = initialPositions[name];
          const desiredPos = desiredPositions[name];
          const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
          gltf.scene.getObjectByName(name).position.copy(currentPos);
        });

        if (animationTick >= 1) {
          // Adds the exploded objects to the exploded objects array
          Object.keys(desiredPositions).forEach((name) => {
            if (!objectsThatHaveExploded.current.includes(name)) {
              objectsThatHaveExploded.current.push(name);
            }
          });
          setExplode(false);
          explodeAnimationPlayed.current = true;
          setIsPlaying(false);
        }
      }

      updateToolTipCirclePositions();
    }
  });

  /////////////////////////////////
  /// Child exploding animation ///
  /////////////////////////////////

  const [childAnimationTick, setChildAnimationTick] = useState(0);
  const [childAnimationEnable, setChildAnimationEnable] = useState(false);
  const childAnimationIsPlaying = useRef(false);

  // Animation, rewind included
  useFrame((state, delta) => {
    if (childAnimationEnable && childAnimationTick <= 1) {
      childAnimationIsPlaying.current = true;
      updateToolTipCirclePositions();
      setChildAnimationTick(prev => Math.min(prev + (delta / (childTransitionDuration / 1000)), 1));

      Object.keys(childInitialPositions).forEach((name) => {
        const initialPos = childInitialPositions[name];
        const desiredPos = childDesiredPositions[name];
        const easedTick = easeOutCubic(childAnimationTick);
        const currentPos = new THREE.Vector3().lerpVectors(initialPos, desiredPos, easedTick);
        gltf.scene.getObjectByName(name).position.copy(currentPos);
      });

      if (childAnimationTick >= 1) {
        childAnimationIsPlaying.current = false;

        // If the exploded objects dont exist in the exploded objects array, Add them, if they do, remove them.
        Object.keys(childDesiredPositions).forEach((name) => {
          if (objectsThatHaveExploded.current.includes(name)) {
            objectsThatHaveExploded.current = objectsThatHaveExploded.current.filter(el => el !== name);  
          }else{
            objectsThatHaveExploded.current.push(name);
          }
        });

        setChildAnimationEnable(false);
      }
    }
  });

  const childAnimationUpdateFlag = useRef(false);
  const childAnimationCurrentSelectedObjectNameUpdateFlag = useRef("");
  const previousChildAnimationCurrentSelectedObjectNameUpdateFlag = useRef("");

  // Child animation mouse event
  useEffect(() => {
    const handleObjectChildAnimationMouseClick = (event) => {
      if(!childAnimationIsPlaying.current && currentSelectedObjectName.current && isFocusable.current){
        childAnimationUpdateFlag.current = true;
        childAnimationCurrentSelectedObjectNameUpdateFlag.current = currentSelectedObjectName.current;
      }
    };

    window.addEventListener('click', handleObjectChildAnimationMouseClick);
  }, [])

  // Use recorded values to reverse the exploding animation of an object if a different object is clicked
  useEffect(() => {
    const selectedObject = tooltipCirclesData.find(item => item.objectName === previousChildAnimationCurrentSelectedObjectNameUpdateFlag.current);
    const childInitialPositions = getChildrenInitialPositions(gltf, [selectedObject?.objectName]);
    const childNames = Object.keys(childInitialPositions);
    const allHaveExploded = childNames.every(name => objectsThatHaveExploded.current.includes(name));
    if(childAnimationUpdateFlag.current && selectedObject){
      if(allHaveExploded && (childAnimationCurrentSelectedObjectNameUpdateFlag.current != previousChildAnimationCurrentSelectedObjectNameUpdateFlag.current)){
        const animationForwards = !allHaveExploded;

        const childDesiredPositions = getDesiredPositions(childInitialPositions, animationForwards);
        setChildInitialPositions(childInitialPositions);
        setChildDesiredPositions(childDesiredPositions);
        setChildAnimationEnable(true);
        setChildAnimationTick(0);
      }
    }
  }, [childAnimationUpdateFlag.current]);

  // Use recorded values to determine whether child objects should animate when a circle is clicked
  useEffect(() => {
    const selectedObject = tooltipCirclesData.find(item => item.objectName === childAnimationCurrentSelectedObjectNameUpdateFlag.current);
    const childInitialPositions = getChildrenInitialPositions(gltf, [selectedObject?.objectName]);
    const childNames = Object.keys(childInitialPositions);
    const allHaveExploded = childNames.every(name => objectsThatHaveExploded.current.includes(name));
    if(childAnimationUpdateFlag.current && selectedObject && transitionEnded){
      if (selectedObject.waitForFocusBeforeExplodeAnimation && gltf.scene.getObjectByName(selectedObject.objectName).children.length > 0) {

        const animationForwards = !allHaveExploded;

        const childDesiredPositions = getDesiredPositions(childInitialPositions, animationForwards);
        setChildInitialPositions(childInitialPositions);
        setChildDesiredPositions(childDesiredPositions);
        setChildAnimationEnable(true);
        setChildAnimationTick(0);
        childAnimationUpdateFlag.current = false;
        previousChildAnimationCurrentSelectedObjectNameUpdateFlag.current = childAnimationCurrentSelectedObjectNameUpdateFlag.current;
        childAnimationCurrentSelectedObjectNameUpdateFlag.current = "";
      }
    }
  }, [childAnimationUpdateFlag.current, transitionEnded]);

  // Right off the bat, explode all objects with children whose waitForFocusBeforeExplodeAnimation flag equal false
  useEffect(() => {
    const eligibleItems = tooltipCirclesData.filter((item) => Object.prototype.hasOwnProperty.call(item, 'waitForFocusBeforeExplodeAnimation') && item.waitForFocusBeforeExplodeAnimation !== true);
    if(explodeAnimationPlayed.current && animationDirectionForward && tooltipCirclesData.length != 0 && eligibleItems.length != 0){
      const parentArray = eligibleItems.map(item => item.objectName);
      const childInitialPositions = getChildrenInitialPositions(gltf, parentArray);
      const childDesiredPositions = getDesiredPositions(childInitialPositions);

      setChildInitialPositions(childInitialPositions);
      setChildDesiredPositions(childDesiredPositions);
      setChildAnimationEnable(true);
      setChildAnimationTick(0);
    }
  }, [explodeAnimationPlayed.current]);

  function getChildrenInitialPositions(model, parentArray = []) {
    const currentPositions = {};
    model.scene.children.forEach((mesh) => {
      // Only include meshes whose name matches an entry in the parentArray
      if (!parentArray.includes(mesh.name)) return;

      mesh.children.forEach((child) => {
        currentPositions[child.name] = child.position.clone();
      });
    });

    return currentPositions;
  }

  //////////////////////////////
  /// Reverse all animations ///
  //////////////////////////////

  const reverseAllExplosionAnimations = useRef(false);
  // Reverse all exploding animations
  useEffect(() => {
    if(reverseAllExplosionAnimations.current){
      // Reset child animations
      // Return parents that have children inside objectThatHaveExploded.current
      const parentArray = objectsThatHaveExploded.current.filter(name => {
        const obj = gltf.scene.getObjectByName(name);
        return (obj && obj.children.some(child => objectsThatHaveExploded.current.includes(child.name)));
      });

      const childInitialPositions = getChildrenInitialPositions(gltf, parentArray);
      const childDesiredPositions = getDesiredPositions(childInitialPositions, false);

      setChildInitialPositions(childInitialPositions);
      setChildDesiredPositions(childDesiredPositions);
      setChildAnimationEnable(true);
      setChildAnimationTick(0);

      // Reset main animation
      setIsPlaying(true);
      reverseAllExplosionAnimations.current = false;
    }
  }, [reverseAllExplosionAnimations.current]);

  /////////////////////////////
  /// Circles configuration ///
  /////////////////////////////

  // Perform a one-time visibility update of the circles right after component mount should the showCirclesAfterExplodingAnimationRef flag be false
  const oneTimeTooltipCirclesDataUpdate = useRef();
  useEffect(() => {
    if(!showCirclesAfterExplodingAnimationRef.current){
      oneTimeTooltipCirclesDataUpdate.current = true;
      updateToolTipCirclePositions();
      updateToolTipCircleVisibility();

    }
  }, [tooltipCirclesDatajsonParsed.current]);

  // Shows the circles after the exploding animation has played should the showCirclesAfterExplodingAnimationRef flag be true
  useEffect(() => {
    if(showCirclesAfterExplodingAnimationRef.current && explodeAnimationPlayed.current){
      updateToolTipCircleVisibility()
    }
  }, [showCirclesAfterExplodingAnimationRef.current, explodeAnimationPlayed.current]);

  const visibilityUpdateFlag = useRef(false);
  const currentSelectedObjectNameUpdateFlag = useRef("");
  // Visibility mouse event
  useEffect(() => {
    const handleFlagVisibilityMouseClick = (event) => {
      if(!childAnimationIsPlaying.current && currentSelectedObjectName.current && isFocusable.current){
        visibilityUpdateFlag.current = true;
        currentSelectedObjectNameUpdateFlag.current = currentSelectedObjectName.current;
      }
    };

    window.addEventListener('click', handleFlagVisibilityMouseClick);
  }, [])

  // Use recorded values to determine the circle's visibility and whether chil objects should animate when a circle is clicked
  useEffect(() => {
    const selectedObject = tooltipCirclesData.find(item => item.objectName === currentSelectedObjectNameUpdateFlag.current);
    if(visibilityUpdateFlag.current && selectedObject){
      if ((selectedObject.showCirclesAfterFocusAnimation && transitionEnded) || (!selectedObject.showCirclesAfterFocusAnimation)) {
        currentSelectedObjectNameUpdateFlag.current = "";
        updateToolTipCircleVisibility(selectedObject);
        visibilityUpdateFlag.current = false;
      }
    }
  }, [visibilityUpdateFlag.current, transitionEnded]);

  // See if user dragged the mouse around...
  const hasDraggedMouse = useRef(false);
  useEffect(() => {
    if (isDragging) {
      hasDraggedMouse.current = true;
    }
  }, [isDragging]);

  // ...If so, ignore, if they clicked the screen, update visibility values
  useEffect(() => {
    if (!isMouseDown) {
      if (!hasDraggedMouse.current) {
        updateToolTipCircleVisibility();
      }

      hasDraggedMouse.current = false; // always reset on mouse up
    }
  }, [isMouseDown]);

  // Make visible the tooltips that have a focus group to be shown, or don't have any
  function updateToolTipCircleVisibility(selectedObject = "") {
    tooltipCirclesData.forEach(item => {
      let shouldBeVisible = false;
      if (selectedObject && selectedObject.focusTarget != "") {
        // Case: focusTarget is a non-empty string
        shouldBeVisible = item.focusGroup === selectedObject.focusTarget;
      } else {
        // Case: focusTarget is "", null, or undefined
        shouldBeVisible =
          item.focusGroup === "" ||
          item.focusGroup === null ||
          item.focusGroup === undefined;
      }

      modifyTooltipCircleData(item.objectName, {
        circleIsVisible: shouldBeVisible
      });
    });
  }

  const circlePositionUpdatePixelInterval = useRef(0.3);
  useEffect(() => {
    console.log(currentGraphicalMode)
    switch(currentGraphicalMode) {
      case "potato":
        circlePositionUpdatePixelInterval.current = 1;
      break;
      case "potatoPremium":
        circlePositionUpdatePixelInterval.current = 0.5;

      break;
      case "normal":
        circlePositionUpdatePixelInterval.current = 0.3;

      break;
      case "high":
        circlePositionUpdatePixelInterval.current = 0.1;

      break;
      default:
        circlePositionUpdatePixelInterval.current = 0.3;
    }
  }, [currentGraphicalMode]);

  // Makes the tooltip circles follow the objects and update the invisible plane when camera position and rotation values change
  function updateToolTipCirclePositions() {
    tooltipCirclesData.forEach(data => {
      const obj = gltf.scene.getObjectByName(data.objectName);
      if (!obj) return;

      const vec = new THREE.Vector3();
      obj.getWorldPosition(vec);
      vec.project(camera);

      const x = (vec.x * 0.5 + 0.5) * 100;
      const y = (vec.y * -0.5 + 0.5) * 100;
      
      // only update if difference in new and old position is greater than a certain pixel interval
      const [oldX, oldY] = data.position || [null, null];
      if (oldX === null || Math.hypot(oldX - x, oldY - y) > circlePositionUpdatePixelInterval.current) {
        modifyTooltipCircleData(data.objectName, { position: [x, y] });
      }
    });
  }

  // Activate camera state tracking on mount so the circles can accompany the camera's state changes(also used in updating the planeRef's position)
  useEffect(() => {
    setCameraStateTracking(true)
  }, []);

  // Makes the tooltip circles follow the objects and update the invisible plane when camera position and rotation values change
  useEffect(() => {
    updateToolTipCirclePositions();
  }, [cameraState]);

  //////////////////////////////////
  /// Focusing on object feature ///
  //////////////////////////////////

  const archCurve = useRef(new THREE.CatmullRomCurve3( [        
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)]));

  const frameCount = useRef(0);  // frame counter

  // Update the arch's transition curve
  useFrame((state, delta) => {
    // Increment the frame count
    if(currentSelectedObjectName.current){
      frameCount.current += 1;
      // Only update archCurve.current every 5 frames
      if (frameCount.current >= 5) {
        archCurve.current = createArchCurve(foFront.current, foFocusPoint.current, foFocusEndPointDistance.current, camera, foArchWidth.current, foArchcurveDirection.current);
        frameCount.current = 0;  // Reset the frame count after updating
      }
    }
  });

  // Triggers the focusing animation by clicking on circles
  useEffect(() => {
    const handleMouseClick = (event) => {
      if(!childAnimationIsPlaying.current && currentSelectedObjectName.current && isFocusable.current){
        setTransitionEnded(false)
        setForcedCameraMovePathCurve(archCurve.current) // Starts the camera transition
        setForcedCameraTarget(foCameraTargetPoint.current) // Makes the camera follow the object
        setShowReturnButton(true);
      }
    };

    window.addEventListener('click', handleMouseClick);
  }, [])

  // debug tube geometry for visualizing the transition curve
  function TubeCurve({
    curve,
    tubularSegments = 64,
    radius = 0.1,
    radialSegments = 8,
    closed = false,
  }) {
    return (
      <mesh>
        <tubeGeometry
          args={[curve, tubularSegments, radius, radialSegments, closed]}
        />
        <meshBasicMaterial wireframe={false} />
      </mesh>
    )
  }

  ///////////////////////////////
  /// Material change feature ///
  ///////////////////////////////

  const newMaterialGltf = useLoader(GLTFLoader, config.materials_path + ( (!materialName || materialName == "") ? "example_material.glb" : materialName));
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

  /////////////////////////////
  /// Force camera position ///
  /////////////////////////////

  useEffect(() => {
    if (forcedCameraPositionArray) {
      console.log("forced")
      setForcedCameraPosition(forcedCameraPositionArray);

    }
  }, [forcedCameraPositionArray, tooltipCirclesDatajsonParsed.current]);

  //////////////////////////////
  /// Return button handling ///
  //////////////////////////////

  // Return to initial position
  useEffect(() => {
    if (isReturnButtonPressed) {
      setShowReturnButton(false);
      setTransitionEnded(false);
      console.log(forcedCameraPositionArray)
      setForcedCameraMovePathCurve(createArchCurve([1, 0, 0], forcedCameraPositionArray ?? config.default_Camera_starting_position, 0, camera,));
      updateToolTipCircleVisibility()
      setForcedCameraTarget(sceneOrigin);

      if(!explodingObjectAnimationStartOnLoad){
        reverseAllExplosionAnimations.current = true;
      }else{
        childAnimationUpdateFlag.current = true;
        childAnimationCurrentSelectedObjectNameUpdateFlag.current = currentSelectedObjectName.current;
      }

    }
  }, [isReturnButtonPressed]);

  /////////////////
  /// Rendering ///
  /////////////////

  return (
    <Suspense fallback={null}>
      <primitive ref={modelRef} position={explodingObjectPosition} object={gltf.scene} origin={sceneOrigin}/>
      <mesh>
        {/* Render the cloned object directly */}
        {(objectToRotate.current && shouldRenderClone/*COMMENT && objectRotationAnimation to make the rotating object stay visible on unhover*/) && (
          <primitive scale = {foCloneScale.current} object={objectToRotate.current} position={objectToRotate.current.position} />
        )}
      </mesh>

      {/* Create a plane in front of the camera for the raycaster to collide with */}
      <mesh ref={planeRef} /*position={sceneOrigin} */>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color={0xffffff} side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>

      {(tubeCurveDebugMode) && 
      <TubeCurve
        curve={archCurve.current}
        tubularSegments={8}
        radius={0.2}
        radialSegments={8}
      />
      }
    </Suspense>
  );
});

ExplodingModelLoader.displayName = "ExplodingModelLoader";