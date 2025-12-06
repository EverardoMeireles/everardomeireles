import * as THREE from 'three';

// replace it by store's value later
export const graphicsModes = {
    0:"potato",
    1:"potatoPremium",
    2:"normal",
    3:"high"
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

// Checks if a curve is valid(all its points are not the same, its an array, every entry valid and not undefined)
export function isCurveDegenerate(curve) {
  if (!curve) return true;
  if (!Array.isArray(curve.points) || curve.points.length === 0) return true;

  const first = curve.points[0];
  if (!first || typeof first.equals !== "function") return true;

  return curve.points.every((p) => p && typeof p.equals === "function" && p.equals(first));
}

export function createTimer() {
  const start = performance.now();
  return () => performance.now() - start;
}

// Create a THREE.CatmullRomCurve3 curve from the camera to a target position
export function createArchCurve(
    frontDirection = [1, 0, 0], // the direction of the "front" of the object
    targetPosition, // The end position of the curve
    distanceOrCamera = 1, // backward compatibility: can be the camera if distance is omitted
    cameraOrArchWidth,
    archWidthOrCurveDirection,
    maybeCurveDirection
  ) {
    let distance = 1;
    let camera;
    let archWidth = 1;
    let curveDirection = "up";

    if (typeof distanceOrCamera === "number" || distanceOrCamera === undefined) {
      distance = typeof distanceOrCamera === "number" ? distanceOrCamera : 1;
      camera = cameraOrArchWidth;
      archWidth = archWidthOrCurveDirection ?? 1;
      curveDirection = maybeCurveDirection ?? "up";
    } else {
      camera = distanceOrCamera;
      archWidth = cameraOrArchWidth ?? 1;
      curveDirection = archWidthOrCurveDirection ?? "up";
    }

    if (!camera || typeof camera.getWorldPosition !== "function") {
      throw new Error("createArchCurve requires a THREE.Camera instance.");
    }
    // 1. frontDirection → normalized Vector3 * distance
    const dirVec = frontDirection.isVector3 ? frontDirection.clone() : new THREE.Vector3(...frontDirection);
    const offset = dirVec.normalize().multiplyScalar(distance);
  
    // 2. get object world position and compute end point
    const worldPos = Array.isArray(targetPosition)
      ? new THREE.Vector3(...targetPosition)
      : targetPosition ?? new THREE.Vector3(0, 0, 0);
  
    const endPos = worldPos.clone().add(offset);
  
    // 3. get camera world position (start)
    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
  
    // 4. Determine curve frontDirection based on curveDirection type
    let directionVec = new THREE.Vector3(0, 0, 0); // Default vector
  
    if (typeof curveDirection === "string") {
      // Handle string-based curveDirection
      switch (curveDirection) {
        case "up":
          directionVec.set(0, 1, 0); // Curve upwards
          break;
        case "down":
          directionVec.set(0, -1, 0); // Curve downwards
          break;
        case "left":
          directionVec.set(-1, 0, 0); // Curve left
          break;
        case "right":
          directionVec.set(1, 0, 0); // Curve right
          break;
        default:
          console.warn("Invalid curve frontDirection, using default 'up'");
          directionVec.set(0, 1, 0); // Default curve upwards
      }
    } else if (Array.isArray(curveDirection) || curveDirection instanceof THREE.Vector3) {
      // Handle array-based or Vector3-based curveDirection
      directionVec = new THREE.Vector3(...curveDirection); // Convert array to Vector3
    }
  
    // 5. Adjust midpoints based on the frontDirection vector
    const p1 = startPos.clone().lerp(endPos, 0.25);
    p1.add(directionVec.clone().multiplyScalar(archWidth)); // Use directionVec for curvature
  
    const p2 = startPos.clone().lerp(endPos, 0.75);
    p2.add(directionVec.clone().multiplyScalar(archWidth)); // Similarly adjust second midpoint
  
    // 6. Return the Catmull-Rom curve
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
