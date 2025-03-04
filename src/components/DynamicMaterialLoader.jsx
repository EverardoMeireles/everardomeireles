// import React, { useState, useEffect, useRef } from "react";
// import { useLoader } from "@react-three/fiber";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// // This component progressively applies materials to its child scene
// export const DynamicMaterialLoader = React.memo(({ lowResFile, midResFile = undefined, highResFile, children }) => { 
//   const sceneRef = useRef(); // Reference for the child scene
//   const [material, setMaterial] = useState(null); 
//   const [currentStage, setCurrentStage] = useState("low"); // Tracks the material stage: "low" -> "mid" -> "high"

//   // Load low-res material
//   const lowResMaterial = useLoader(GLTFLoader, process.env.PUBLIC_URL + `/materials/${lowResFile}`);

//   // Load mid-res material (if provided)
//   useEffect(() => {
//     if (midResFile) {
//       let isMounted = true;

//       new GLTFLoader().load(process.env.PUBLIC_URL + `/materials/${midResFile}`, (gltf) => {
//         if (isMounted) {
//           setMaterial(gltf.scene.children[0].material);
//           setCurrentStage("mid");
//         }
//       });

//       return () => { isMounted = false; };
//     }
//   }, [midResFile]);

//   // Load high-res material in the background
//   useEffect(() => {
//     let isMounted = true;

//     new GLTFLoader().load(process.env.PUBLIC_URL + `/materials/${highResFile}`, (gltf) => {
//       if (isMounted) {
//         setMaterial(gltf.scene.children[0].material);
//         setCurrentStage("high");
//       }
//     });

//     return () => { isMounted = false; };
//   }, [highResFile]);

//   // Apply the material once it's loaded
//   useEffect(() => {
//     if (sceneRef.current && lowResMaterial) {
//       sceneRef.current.traverse((child) => {
//         if (child.isMesh) {
//           if (currentStage === "low") {
//             child.material = lowResMaterial.scene.children[0].material;
//           } else {
//             child.material = material;
//           }
//         }
//       });
//     }
//   }, [sceneRef, lowResMaterial, material, currentStage]);

//   return React.cloneElement(children, { ref: sceneRef });
// });



import React, { useState, useEffect, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// Global material cache to prevent unnecessary loading
const materialCache = new Map();

// This component progressively applies materials to its child scene
export const DynamicMaterialLoader = React.memo(({ 
  lowResFile, 
  midResFile = undefined, 
  highResFile, 
  forceLowResTrigger = false, 
  forceMidResTrigger = false, 
  forceHighResTrigger = false, 
  children 
}) => { 
  const sceneRef = useRef(); // Reference for the child scene
  const [currentMaterial, setCurrentMaterial] = useState(null); // Stores the active material
  const [currentStage, setCurrentStage] = useState("low"); // Tracks material stage: "low" -> "mid" -> "high"
  const [loadedMaterials, setLoadedMaterials] = useState({ low: null, mid: null, high: null });

  // Function to load a material if it's not in the cache
  const loadMaterial = (file, stage) => {
    return new Promise((resolve, reject) => {
      if (materialCache.has(file)) {
        resolve(materialCache.get(file)); // Return from cache
      } else {
        new GLTFLoader().load(
          process.env.PUBLIC_URL + `/materials/${file}`,
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
        setCurrentStage("low");
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
          setCurrentStage("mid");
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
          setCurrentStage("high");
        }
      });
    }
  }, [highResFile, forceLowResTrigger, forceMidResTrigger]);

  // Force material based on trigger props (only change material if it’s different)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child.isMesh) {
          let newMaterial = currentMaterial;

          if (forceLowResTrigger) {
            newMaterial = loadedMaterials.low;
            setCurrentStage("low");
          } else if (forceMidResTrigger && loadedMaterials.mid) {
            newMaterial = loadedMaterials.mid;
            setCurrentStage("mid");
          } else if (forceHighResTrigger && loadedMaterials.high) {
            newMaterial = loadedMaterials.high;
            setCurrentStage("high");
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
