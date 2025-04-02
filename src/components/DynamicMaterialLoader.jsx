import React, { useState, useEffect, useRef } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import config from '../config';

// Global material cache to prevent unnecessary loading
const materialCache = new Map();

// This component progressively applies materials to its child scene
export const DynamicMaterialLoader = React.memo((props) => { 
  const {lowResFile = false} = props;
  const {midResFile = false} = props;
  const {highResFile = false} = props;
  const {forceLowResTrigger = false} = props;
  const {forceMidResTrigger = false} = props;
  const {forceHighResTrigger = false} = props;
  const {children} = props;

  const sceneRef = useRef(); // Reference for the child scene

  const [currentMaterial, setCurrentMaterial] = useState(null); // Stores the active material
  const [loadedMaterials, setLoadedMaterials] = useState({ low: null, mid: null, high: null });

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
      if (!forceMidResTrigger && !forceHighResTrigger) {
        setCurrentMaterial(material);
      }
    });
  }, [lowResFile, forceMidResTrigger, forceHighResTrigger]);

  // Load mid-res material if available and not forced to low/high
  useEffect(() => {
    if (midResFile && !forceLowResTrigger && !forceHighResTrigger) {
      loadMaterial(midResFile, "mid").then((material) => {
        setLoadedMaterials((prev) => ({ ...prev, mid: material }));
        if (!forceMidResTrigger) {
          setCurrentMaterial(material);
        }
      });
    }
  }, [midResFile, forceLowResTrigger, forceHighResTrigger]);

  // Load high-res material in the background
  useEffect(() => {
    if (!forceLowResTrigger && !forceMidResTrigger) {
      loadMaterial(highResFile, "high").then((material) => {
        setLoadedMaterials((prev) => ({ ...prev, high: material }));
        if (!forceHighResTrigger) {
          setCurrentMaterial(material);
        }
      });
    }
  }, [highResFile, forceLowResTrigger, forceMidResTrigger]);

  //////////////////////
  // Material forcing //
  //////////////////////

  // Force material based on trigger props (only change material if it’s different)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child.isMesh) {
          let newMaterial = currentMaterial;
          if (forceLowResTrigger) {
            newMaterial = loadedMaterials.low;
          } else if (forceMidResTrigger && loadedMaterials.mid) {
            newMaterial = loadedMaterials.mid;
          } else if (forceHighResTrigger && loadedMaterials.high) {
            newMaterial = loadedMaterials.high;
          }
          // Only apply if the material is different
          if (newMaterial && child.material !== newMaterial) {
            child.material = newMaterial;
          }
        }
      });
    }
  }, [sceneRef, currentMaterial, forceLowResTrigger, forceMidResTrigger, forceHighResTrigger, loadedMaterials]);

  return React.cloneElement(children, { ref: sceneRef });
});
