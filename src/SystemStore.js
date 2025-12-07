import { create } from 'zustand';
import * as THREE from 'three';
import config from './config.js';

const SystemStore = create((set) => ({
  mainScene: undefined,
  setMainScene: (loaded) => set(() => ({ mainScene: loaded })),

  forceDisableRender: false, // will disable the app's render
  setForceDisableRender: (DisableRender) => set(() => ({ forceDisableRender: DisableRender })),

  raycasterEnabled: true,
  setRaycasterEnabled: (loaded) => set(() => ({ raycasterEnabled: loaded })),

  currentObjectClicked: "", // Raycaster.jsx: Object captured by mouse click while the component is on the scene.
  setCurrentObjectClicked: (object) => set(() => ({ currentObjectClicked: object })),

  preloadDone: false,
  setPreloadDone: (preloaded) => set(() => ({ preloadDone: preloaded })),

  // The named position that the transition is aiming to go
  transitionDestination: "MainMenu",
  setDesiredPath: (desired) => set(() => ({ transitionDestination: desired })),

  transitionEnded: false,
  setTransitionEnded: (ended) => set(() => ({ transitionEnded: ended })),

  currentGraphicalMode: config.default_graphical_setting,
  setGraphicalMode: (mode) => set(() => ({ currentGraphicalMode: mode })),

  enableDynamicGraphicalModeSetting: true,
  setEnableDynamicGraphicalModeSetting: (trueOrFalse) => set(() => ({ enableDynamicGraphicalModeSetting: trueOrFalse })),

  currentLanguage: "Portuguese",
  setLanguage: (language) => set(() => ({ currentLanguage: language })),

  currentCameraMovements: { zoom: true, pan: true, rotate: true },
  setcurrentCameraMovements: (cameraMovements) => set(() => ({ currentCameraMovements: cameraMovements })),

  currentCameraMode: "NormalMovement",
  setCurrentCameraMode: (cameraMode) => set(() => ({ currentCameraMode: cameraMode })),

  panDirectionalAxis: ['+z', '+y'],
  setPanDirectionalAxis: (axis) => set(() => ({ panDirectionalAxis: axis })),

  panDirectionalEdgethreshold: 150,
  setPanDirectionalEdgethreshold: (threshold) => set(() => ({ panDirectionalEdgethreshold: threshold })),

  cameraState: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  setCameraState: (position, rotation) => set(() => ({
    cameraState: { position, rotation }
  })),

  cameraStateTracking: false,
  setCameraStateTracking: (tracking) => set(() => ({ cameraStateTracking: tracking })),

  forcedCameraTarget: [0, 0, 0], // will force the camera's orbit controls pivot if not empty
  setForcedCameraTarget: (target) => set(() => ({ forcedCameraTarget: target })),

  forcedCameraMovePathCurve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)]), // custom camera curve path
  setForcedCameraMovePathCurve: (curve) => set(() => ({ forcedCameraMovePathCurve: curve })), // Will move the camera according to the provided THREE.CatmullRomCurve3

  forcedCameraPosition: undefined, // will force the camera's rotation pivot if not empty
  setForcedCameraPosition: (position) => set(() => ({ forcedCameraPosition: position })),

  alertProperties: {
    active: false,
    type: 'Success',
    displaySide: 'topRight',
    duration: 5,
    width: '300px',
    height: '50px',
    transitionDuration: 0.5,
    text: 'Lorem Ipsum Dolor!'
  },
  setAlertProperties: (newProperties) => set((state) => ({
    alertProperties: {
      ...state.alertProperties,
      ...newProperties
    }
  })),

  isCanvasHovered: false,
  setIsCanvasHovered: (hovered) => set(() => ({ isCanvasHovered: hovered })),

  showReturnButton: false,
  setShowReturnButton: (show) => set(() => ({ showReturnButton: show })),

  isReturnButtonPressed: false,
  setIsReturnButtonPressed: (pressed) => set(() => ({ isReturnButtonPressed: pressed })),

  returnButtonPosition: [50, 50],
  setReturnButtonPosition: (position) => set(() => ({ returnButtonPosition: position })),

  mouseClicked: false,
  toggleMouseClicked: () => set((state) => ({ mouseClicked: !state.mouseClicked })),

  isMouseDown: false,
  setIsMouseDown: () => set((state) => ({ isMouseDown: !state.isMouseDown })),

  isDragging: false,
  setIsDragging: (dragging) => set(() => ({ isDragging: dragging })),

  sceneModelName: "base_cube_DO_NOT_REMOVE.glb",
  sceneConfigFile: "base_cube_DO_NOT_REMOVE.json",
  sceneModelUrl: "",
  setSceneAssets: ({ modelName, configFile, modelUrl }) =>
    set(() => ({
      sceneModelName: modelName ?? "base_cube_DO_NOT_REMOVE.glb",
      sceneConfigFile: configFile ?? "base_cube_DO_NOT_REMOVE.json",
      sceneModelUrl: modelUrl ?? "",
    })),

  viewerBounds: typeof window === "undefined"
    ? { left: 0, top: 0, width: 0, height: 0 }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
  setViewerBounds: (viewerBounds) => set(() => ({ viewerBounds })),

  tutorialClosed: false,
  setTutorialClosed: (closed) => set(() => ({ tutorialClosed: closed })),

  triggers: { "trigger1": false, "trigger2": false, "trigger3": false, "trigger4": false, "trigger5": false },
  toggleTrigger: (key) => set((state) => ({
    triggers: {
      ...state.triggers,
      [key]: !state.triggers[key]
    }
  })),
  setTrigger: (key, value) => set((state) => ({
    triggers: {
      ...state.triggers,
      [key]: value
    }
  })),

  tooltipProperties: {
    active: false,
    visible: false,
    type: 'Success',
    displaySide: 'topRight',
    transitionDuration: 0.5,
    text: 'Lorem Ipsum Dolor!',
    image: ""
  },
  setTooltipProperties: (newProperties) => set((state) => ({
    tooltipProperties: {
      ...state.tooltipProperties,
      ...newProperties
    }
  })), // to be used like this: setTooltipProperties({active:false, visible:false});

  tooltipCirclesData: [],
  setTooltipCirclesData: (data) => set(() => ({ tooltipCirclesData: data })),
  addTooltipCirclesData: (newData) => set((state) => { // Add new data, in case of duplicate keys, the object will be overwritten
    const updatedData = [...state.tooltipCirclesData];
    newData.forEach(newItem => {
      const existingIndex = updatedData.findIndex(item => item.objectName === newItem.objectName);
      if (existingIndex !== -1) {
        updatedData[existingIndex] = newItem;
      } else {
        updatedData.push(newItem);
      }
    });
    return {
      tooltipCirclesData: updatedData
    };
  }),
  modifyTooltipCircleData: (objectName, newProperties) => set((state) => {
    const updatedData = state.tooltipCirclesData.map(item =>
      item.objectName === objectName ? { ...item, ...newProperties } : item
    );
    return {
      tooltipCirclesData: updatedData
    };
  }),

  isCircleOnLeftSelected: false,
  setIsCircleOnLeftSelected: (isLeft) => set(() => ({ isCircleOnLeftSelected: isLeft })),

  isCircleOnTopSelected: false,
  setIsCircleOnTopSelected: (isTop) => set(() => ({ isCircleOnTopSelected: isTop })),

  tooltipCurrentObjectNameSelected: undefined, // ToolTipCircle.jsx: Represents the name of the current hovered object when the component is present.
  setTooltipCurrentObjectNameSelected: (object) => set(() => ({ tooltipCurrentObjectNameSelected: object })),

  message: {
    type: undefined,
    payload: undefined,
  },
  setMessage: (type, payload) => set(() => ({
    message: { type, payload }
  })),

  productInformationFromMessage: {},
  setProductInformationFromMessage: (productInformation) => set(() => ({ productInformationFromMessage: productInformation })),

  explodeAnimationEnded: false,
  setExplodeAnimationEnded: (ended) => set(() => ({ explodeAnimationEnded: ended })),

  hudMenuEnabled: false,
  setHudMenuEnabled: (enabled) => set(() => ({ hudMenuEnabled: enabled })),

}));

export default SystemStore;


