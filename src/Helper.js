import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import config from "./config.js";

// replace it by store's value later
export const graphicsModes = {
    0:"potato",
    1:"normal",
    2:"high"
}

export var oneOrZero = {
    1: 0,
    0: 1
}

export function CalculateAverageOfArray(arrayFPS){
    return arrayFPS.reduce((a, b) => a + b, 0) / arrayFPS.length;
}

// get a dictionary's key by its value
export function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

export function roundToDecimalPlace (num, decimals){
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
};

export function hasSignificantChange (prev, current, threshold = 0.1) {
    return Math.abs(current - prev) > threshold;
};

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
    return Math.pow(t, 3);
}

// A function to smooth out the camera movement
export function smoothStep(x) {
    let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
    if(x >= 1){
        Sn = 1;
    }
    return Sn;
}

// Checks if all curve points collapse together.
export function isCurveDegenerate(curve) {
  if (!curve) return true;
  if (!Array.isArray(curve.points) || curve.points.length === 0) return true;

  const first = curve.points[0];
  if (!first || typeof first.equals !== "function") return true;

  return curve.points.every((p) => p && typeof p.equals === "function" && p.equals(first));
}

// Checks whether a curve can be safely sampled.
export function isCurveUsable(curve) {
  if (!curve || typeof curve.getPointAt !== "function") return false;
  if (!Array.isArray(curve.points)) return true;
  if (curve.points.length < 2) return false;

  return (
    curve.points.every((point) => (point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))) 
    &&
    !isCurveDegenerate(curve)
  );
}

export function createTimer() {
  const start = performance.now();
  return () => performance.now() - start;
}

// Create a curved path between two positions.
export function createArchCurve(
    startPosition,
    targetPosition,
    archWidth = 1,
    curveDirection = "up",
    targetOffsetDistance = 0,
    frontDirection = [1, 0, 0]
  ) {
    // Resolve arrays, vectors, cameras, and objects.
    const resolvePosition = (value, name) => {
      const position = new THREE.Vector3();

      if (value && typeof value.getWorldPosition === "function") {
        value.getWorldPosition(position);
        return position;
      }

      if (value?.isVector3) {
        return value.clone();
      }

      if (Array.isArray(value) && value.length >= 3) {
        return new THREE.Vector3(value[0], value[1], value[2]);
      }

      throw new Error(`createArchCurve requires a valid ${name}.`);
    };
    
    // Resolve the arch and offset directions.
    const resolveDirection = (value) => {
      if (value?.isVector3) {
        return value.clone().normalize();
      }

      if (Array.isArray(value) && value.length >= 3) {
        return new THREE.Vector3(value[0], value[1], value[2]).normalize();
      }

      switch (value) {
        case "up":
          return new THREE.Vector3(0, 1, 0);
        case "down":
          return new THREE.Vector3(0, -1, 0);
        case "left":
          return new THREE.Vector3(-1, 0, 0);
        case "right":
          return new THREE.Vector3(1, 0, 0);
        case "forward":
          return new THREE.Vector3(0, 0, -1);
        case "backward":
          return new THREE.Vector3(0, 0, 1);
        default:
          console.warn("Invalid curve direction, using default 'up'");
          return new THREE.Vector3(0, 1, 0);
      }
    };

    const safeArchWidth = Number.isFinite(archWidth) ? archWidth : 1;
    const safeOffsetDistance = Number.isFinite(targetOffsetDistance) ? targetOffsetDistance : 0;
    const startPos = resolvePosition(startPosition, "startPosition");
    const targetPos = resolvePosition(targetPosition, "targetPosition");
    const offset = resolveDirection(frontDirection).multiplyScalar(safeOffsetDistance);
    const endPos = targetPos.clone().add(offset);
    const archOffset = resolveDirection(curveDirection).multiplyScalar(safeArchWidth);

    const p1 = startPos.clone().lerp(endPos, 0.25).add(archOffset);
    const p2 = startPos.clone().lerp(endPos, 0.75).add(archOffset);

    return new THREE.CatmullRomCurve3([startPos, p1, p2, endPos]);
  }

// increase or decrease the graphics settings
export function increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, higherOrLower) {
    const totalModes = Object.keys(graphicsModes).length;
    const currentKey = parseInt(getKeyByValue(graphicsModes, currentGraphicalMode));
    let newGraphicalModeKey = currentKey + higherOrLower;
    
    // Clamp the value between 0 and totalModes - 1
    newGraphicalModeKey = Math.max(0, Math.min(newGraphicalModeKey, totalModes - 1));
    
    const newGraphicalMode = graphicsModes[newGraphicalModeKey];
    
    // Optionally, only update if the mode changes
    if (newGraphicalMode !== currentGraphicalMode) {
      setGraphicalMode(newGraphicalMode);
      console.log(newGraphicalMode);
    }
  }

export function getRandomInt(min, max) {
    return Math.random() * (max - min + 1) + min;
}

export function removeFileExtensionString(inputString) {
    // Find the last dot in the string
    const lastDotIndex = inputString.lastIndexOf('.');

    // If a dot is found and it's not the first character
    if (lastDotIndex > 0) {
        // Return the string without the extension
        return inputString.slice(0, lastDotIndex);
    } else {
        // If no dot is found, return the original string
        return inputString;
    }
}

export async function applyMaterialsToScene(gltf, materialNames = {}) {
    if (!gltf?.scene) return;
    if (!materialNames || typeof materialNames !== "object") return;

    const entries = Object.entries(materialNames).filter(
        ([slotName, materialFile]) => Boolean(slotName) && Boolean(materialFile)
    );
    if (entries.length === 0) return;

    const loader = new GLTFLoader();
    const materialsBySlot = {};

    await Promise.all(
        entries.map(async ([slotName, materialFile]) => {
            try {
                const materialGltf = await loader.loadAsync(
                    `${config.materials_path}${materialFile}`
                );
                let material = null;

                if (Array.isArray(materialGltf?.materials) && materialGltf.materials.length > 0) {
                    material = materialGltf.materials[0];
                }

                if (!material) {
                    materialGltf?.scene?.traverse((child) => {
                        if (!material && child.isMesh && child.material) {
                            material = child.material;
                        }
                    });
                }

                if (material) {
                    materialsBySlot[slotName] = material;
                } else {
                    console.warn(`No material found in ${materialFile}`);
                }
            } catch (error) {
                console.error(`Material not found: ${materialFile}`, error);
            }
        })
    );

    if (Object.keys(materialsBySlot).length === 0) return;

    gltf.scene.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const applyMaterial = (material) => {
            if (!material?.name) return material;
            const replacement = materialsBySlot[material.name];
            if (!replacement) return material;
            replacement.needsUpdate = true;
            return replacement;
        };

        if (Array.isArray(child.material)) {
            child.material = child.material.map(applyMaterial);
        } else {
            child.material = applyMaterial(child.material);
        }
    });
}

export const hasTriggerName = (value) => value !== undefined && value !== null && value !== "";

export const setNamedTrigger = (setTrigger, triggerName, value) => {
    if (hasTriggerName(triggerName)) {
        setTrigger(triggerName, value);
    }
};

export const isNamedTriggerActive = (triggers, triggerName) =>
    hasTriggerName(triggerName) && Boolean(triggers?.[triggerName]);

// Function to parse the JSON and get a specific object, if specified
export async function parseJson(filePath, objectToGet = null) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.log('File does not exist.');
            return null;
        }
        const jsonData = await response.json();
        if (objectToGet) {
            if (jsonData[objectToGet]) {
                // console.log("json found!")
                return jsonData[objectToGet];
            } else {
                console.log(`${objectToGet} not found in the JSON.`);
                return null;
            }
        } else {
            return jsonData;
        }
    } catch (error) {
        console.log('Error fetching JSON:', error);
        return null;
    }
}

export const pollForFilesInTHREECache = (filesArray) => {
    try {
    // Check that every file in the array is present in the THREE.Cache.
    const allLoaded = filesArray.every((file) => {
        const cached = THREE.Cache.get(file);
        return cached;
    });
    if (allLoaded) {
        // console.log("All files are fully loaded.");
        return true;
    }
    return false;
    } catch (error) {
    console.error("Error polling materials:", error);
    return false;
    }
};
