import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import config from "../config";

/**
 * Purpose: Creates static instanced meshes from exported Housemaker JSON data.
 * Relationships: Loads source meshes from the GLB referenced by the JSON file.
 * Example:
 * <JsonInstancing jsonFile="housemaker_export.json" />
 * @param {string} [jsonFile] - JSON filename inside the models folder.
 */
export function JsonInstancing(props) {
    const {jsonFile = "housemaker_export.json"} = props;

    // Load the export data and its referenced model.
    const sceneData = useLoader(
        THREE.FileLoader,
        config.models_path + jsonFile,
        (loader) => loader.setResponseType("json")
    );
    const gltf = useLoader(GLTFLoader, config.models_path + sceneData.asset.glb);

    // Match source roots across every exported GLTF scene.
    const sourceNodes = {};
    gltf.scenes.forEach((scene) => {
        scene.traverse((node) => {
            const sourceNodeIndex = gltf.parser.associations.get(node)?.nodes;
            if (sourceNodeIndex !== undefined && !sourceNodes[String(sourceNodeIndex)]) {
                sourceNodes[String(sourceNodeIndex)] = node;
            }

            if (node.name) {
                sourceNodes[node.name] = node;
            }

            const exportedSourceName = node.userData?.housemaker_instance_source_name;
            if (exportedSourceName && !sourceNodes[exportedSourceName]) {
                sourceNodes[exportedSourceName] = node;
            }
        });
    });

    // Reuse one matrix while assigning exported transforms.
    const instanceMatrix = new THREE.Matrix4();

    return (
        <group>
            {sceneData.instanceGroups.flatMap((instanceGroup, groupIndex) => {
                // Support version 2 and version 3 group names.
                const sourceNodeNames = instanceGroup.sourceNodeNames
                    ?? [instanceGroup.sourceNodeName];

                return sourceNodeNames.flatMap((sourceNodeName) => {
                    const sourceNode = sourceNodes[sourceNodeName];
                    if (!sourceNode) {
                        console.warn(`JsonInstancing source node not found: ${sourceNodeName}`);
                        return null;
                    }

                    // Collect every mesh part below the source node.
                    const sourceMeshes = [];
                    sourceNode.updateWorldMatrix(true, true);
                    sourceNode.traverse((node) => {
                        if (node.isMesh) {
                            sourceMeshes.push(node);
                        }
                    });

                    if (sourceMeshes.length === 0) {
                        console.warn(`JsonInstancing source node has no meshes: ${sourceNodeName}`);
                        return null;
                    }

                    return sourceMeshes.map((sourceMesh, sourceMeshIndex) => {
                        // Preserve each source part's local transform.
                        const sourceTransform = sourceNode.matrixWorld
                            .clone()
                            .invert()
                            .multiply(sourceMesh.matrixWorld);

                        return (
                            <instancedMesh
                                key={`${groupIndex}-${sourceNodeName}-${sourceMeshIndex}`}
                                args={[
                                    sourceMesh.geometry,
                                    sourceMesh.material,
                                    instanceGroup.instances.length
                                ]}
                                castShadow={sourceMesh.castShadow}
                                receiveShadow={sourceMesh.receiveShadow}
                                frustumCulled={false}
                                dispose={null}
                                ref={(instancedMesh) => {
                                    if (!instancedMesh) return;

                                    // Apply exported transforms and source-part offsets.
                                    instanceGroup.instances.forEach((instance, instanceIndex) => {
                                        instanceMatrix
                                            .fromArray(instance.worldMatrix)
                                            .multiply(sourceTransform);
                                        instancedMesh.setMatrixAt(instanceIndex, instanceMatrix);
                                    });
                                    instancedMesh.instanceMatrix.needsUpdate = true;
                                }}
                            />
                        );
                    });
                });
            })}
        </group>
    );
}
