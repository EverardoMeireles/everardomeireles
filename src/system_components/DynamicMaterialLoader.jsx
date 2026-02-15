import React, { useState, useEffect, useRef, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { hasTriggerName, isNamedTriggerActive } from "../Helper";
import SystemStore from "../SystemStore";
import config from '../config';

// Global material cache to prevent unnecessary loading
const materialCache = new Map();

// This component progressively applies materials to its child scene
/**
 * @param {boolean} [lowResFile] - Low res file.
 * @param {boolean} [midResFile] - Mid res file.
 * @param {boolean} [highResFile] - High res file.
 * @param {boolean} [forceLowResTrigger] - Force low res trigger.
 * @param {boolean} [forceMidResTrigger] - Force mid res trigger.
 * @param {boolean} [forceHighResTrigger] - Force high res trigger.
 * @param {*} children - Children rendered inside this component.
 */
export const DynamicMaterialLoader = React.memo((props) => { 
  const {lowResFile = false} = props;
  const {midResFile = false} = props;
  const {highResFile = false} = props;
  const {forceLowResTrigger = false} = props;
  const {forceMidResTrigger = false} = props;
  const {forceHighResTrigger = false} = props;
  const {children} = props;

  const sceneRef = useRef(); // Reference for the child scene
  const triggers = SystemStore((state) => state.triggers);

  const [currentMaterial, setCurrentMaterial] = useState(null); // Stores the active material
  const [loadedMaterials, setLoadedMaterials] = useState({ low: null, mid: null, high: null });

  const resolveTriggerInput = (triggerOrBoolean) => {
    if (hasTriggerName(triggerOrBoolean)) {
      return isNamedTriggerActive(triggers, triggerOrBoolean);
    }
    return Boolean(triggerOrBoolean);
  };

  const forceLowResActive = resolveTriggerInput(forceLowResTrigger);
  const forceMidResActive = resolveTriggerInput(forceMidResTrigger);
  const forceHighResActive = resolveTriggerInput(forceHighResTrigger);

  ///////////////////////////////////
  // Material loading and applying //
  ///////////////////////////////////

  // Function to load a material if it's not in the cache
  const loadMaterial = (file, stage) => {
    return new Promise((resolve, reject) => {
      if (materialCache.has(file)) {
        resolve(materialCache.get(file)); // Return from cache
      } else {
        new GLTFLoader().load(
          config.resource_path + `/materials/${file}`,
          (gltf) => {
            const material = gltf.scene.children[0].material;
            materialCache.set(file, material); // Store in cache
            resolve(material);
          },
          undefined,
          reject
        );
      }
    });
  };

  // Load low-res material on mount
  useEffect(() => {
    loadMaterial(lowResFile, "low").then((material) => {
      setLoadedMaterials((prev) => ({ ...prev, low: material }));
      if (!forceMidResActive && !forceHighResActive) {
        setCurrentMaterial(material);
      }
    });
  }, [lowResFile, forceMidResActive, forceHighResActive]);

  // Load mid-res material if available and not forced to low/high
  useEffect(() => {
    if (midResFile && !forceLowResActive && !forceHighResActive) {
      loadMaterial(midResFile, "mid").then((material) => {
        setLoadedMaterials((prev) => ({ ...prev, mid: material }));
        if (!forceMidResActive) {
          setCurrentMaterial(material);
        }
      });
    }
  }, [midResFile, forceLowResActive, forceHighResActive, forceMidResActive]);

  // Load high-res material in the background
  useEffect(() => {
    if (!forceLowResActive && !forceMidResActive) {
      loadMaterial(highResFile, "high").then((material) => {
        setLoadedMaterials((prev) => ({ ...prev, high: material }));
        if (!forceHighResActive) {
          setCurrentMaterial(material);
        }
      });
    }
  }, [highResFile, forceLowResActive, forceMidResActive, forceHighResActive]);

  //////////////////////
  // Material forcing //
  //////////////////////

  // Force material based on trigger props (only change material if it’s different)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child.isMesh) {
          let newMaterial = currentMaterial;
          if (forceLowResActive) {
            newMaterial = loadedMaterials.low;
          } else if (forceMidResActive && loadedMaterials.mid) {
            newMaterial = loadedMaterials.mid;
          } else if (forceHighResActive && loadedMaterials.high) {
            newMaterial = loadedMaterials.high;
          }
          // Only apply if the material is different
          if (newMaterial && child.material !== newMaterial) {
            child.material = newMaterial;
          }
        }
      });
    }
  }, [sceneRef, currentMaterial, forceLowResActive, forceMidResActive, forceHighResActive, loadedMaterials]);

  const memoizedChild = useMemo(() => {
  return React.cloneElement(children, { ref: sceneRef });
}, [children]);

  return memoizedChild;
});


DynamicMaterialLoader.displayName = "DynamicMaterialLoader";
