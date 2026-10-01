import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

    // Build reusable render parts from every exported source.
    const instanceParts = useMemo(() => {
        const sourceNodes = {};
        const parts = [];

        // Match source roots across every exported GLTF scene.
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

        sceneData.instanceGroups.forEach((instanceGroup, groupIndex) => {
            // Support version 2 and version 3 group names.
            const sourceNodeNames = instanceGroup.sourceNodeNames
                ?? [instanceGroup.sourceNodeName];

            sourceNodeNames.forEach((sourceNodeName) => {
                const sourceNode = sourceNodes[sourceNodeName];
                if (!sourceNode) {
                    console.warn(`JsonInstancing source node not found: ${sourceNodeName}`);
                    return;
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
                    return;
                }

                sourceMeshes.forEach((sourceMesh, sourceMeshIndex) => {
                    // Preserve each source part's local transform.
                    const sourceTransform = sourceNode.matrixWorld
                        .clone()
                        .invert()
                        .multiply(sourceMesh.matrixWorld);
                    let geometry = sourceMesh.geometry;
                    let ownsGeometry = false;

                    if (instanceGroup.halfMesh) {
                        const mirrorPlane = sourceMesh.userData?.halfMesh?.mirrorPlane;
                        const planePoint = mirrorPlane?.point;
                        const planeNormal = mirrorPlane?.normal;
                        const hasValidPlane = Array.isArray(planePoint)
                            && planePoint.length === 3
                            && Array.isArray(planeNormal)
                            && planeNormal.length === 3;

                        if (!hasValidPlane) {
                            console.warn(`JsonInstancing half mesh is missing mirror metadata: ${sourceMesh.name}`);
                        } else {
                            const point = new THREE.Vector3(...planePoint);
                            const normal = new THREE.Vector3(...planeNormal);

                            if (normal.lengthSq() === 0) {
                                console.warn(`JsonInstancing half mesh has an invalid mirror normal: ${sourceMesh.name}`);
                            } else {
                                normal.normalize();

                                // Build the source-space reflection matrix.
                                const planeDistance = normal.dot(point);
                                const reflectionMatrix = new THREE.Matrix4().set(
                                    1 - 2 * normal.x * normal.x, -2 * normal.x * normal.y, -2 * normal.x * normal.z, 2 * planeDistance * normal.x,
                                    -2 * normal.y * normal.x, 1 - 2 * normal.y * normal.y, -2 * normal.y * normal.z, 2 * planeDistance * normal.y,
                                    -2 * normal.z * normal.x, -2 * normal.z * normal.y, 1 - 2 * normal.z * normal.z, 2 * planeDistance * normal.z,
                                    0, 0, 0, 1
                                );

                                // Convert the reflection into mesh-local space.
                                const localReflectionMatrix = sourceTransform
                                    .clone()
                                    .invert()
                                    .multiply(reflectionMatrix)
                                    .multiply(sourceTransform);
                                const baseGeometry = sourceMesh.geometry.clone();

                                if (!baseGeometry.index) {
                                    const positionCount = baseGeometry.getAttribute("position").count;
                                    baseGeometry.setIndex(
                                        Array.from({ length: positionCount }, (_, index) => index)
                                    );
                                }

                                const mirroredGeometry = baseGeometry.clone();
                                mirroredGeometry.applyMatrix4(localReflectionMatrix);

                                // Restore front-facing triangle winding after reflection.
                                const mirroredIndex = mirroredGeometry.index;
                                for (let index = 0; index + 2 < mirroredIndex.count; index += 3) {
                                    const secondIndex = mirroredIndex.getX(index + 1);
                                    mirroredIndex.setX(index + 1, mirroredIndex.getX(index + 2));
                                    mirroredIndex.setX(index + 2, secondIndex);
                                }
                                mirroredIndex.needsUpdate = true;

                                // Preserve tangent-space handedness for normal maps.
                                const tangent = mirroredGeometry.getAttribute("tangent");
                                if (tangent) {
                                    for (let index = 0; index < tangent.count; index += 1) {
                                        tangent.setW(index, -tangent.getW(index));
                                    }
                                    tangent.needsUpdate = true;
                                }

                                const mergedGeometry = mergeGeometries([
                                    baseGeometry,
                                    mirroredGeometry
                                ]);
                                baseGeometry.dispose();
                                mirroredGeometry.dispose();

                                if (mergedGeometry) {
                                    mergedGeometry.name = `${sourceMesh.name} full geometry`;
                                    mergedGeometry.computeBoundingBox();
                                    mergedGeometry.computeBoundingSphere();
                                    geometry = mergedGeometry;
                                    ownsGeometry = true;
                                } else {
                                    console.warn(`JsonInstancing could not merge half mesh: ${sourceMesh.name}`);
                                }
                            }
                        }
                    }

                    parts.push({
                        key: `${groupIndex}-${sourceNodeName}-${sourceMeshIndex}`,
                        name: `JsonInstancing ${sourceNodeName} part ${sourceMeshIndex + 1}`,
                        geometry,
                        material: sourceMesh.material,
                        instances: instanceGroup.instances,
                        sourceTransform,
                        castShadow: sourceMesh.castShadow,
                        receiveShadow: sourceMesh.receiveShadow,
                        ownsGeometry
                    });
                });
            });
        });

        return parts;
    }, [gltf, sceneData]);

    // Dispose only geometries created by this component.
    useEffect(() => () => {
        instanceParts.forEach((instancePart) => {
            if (instancePart.ownsGeometry) {
                instancePart.geometry.dispose();
            }
        });
    }, [instanceParts]);

    // Reuse one matrix while assigning exported transforms.
    const instanceMatrix = new THREE.Matrix4();

    return (
        <group>
            {instanceParts.map((instancePart) => (
                <instancedMesh
                    key={instancePart.key}
                    name={instancePart.name}
                    args={[
                        instancePart.geometry,
                        instancePart.material,
                        instancePart.instances.length
                    ]}
                    castShadow={instancePart.castShadow}
                    receiveShadow={instancePart.receiveShadow}
                    frustumCulled={false}
                    dispose={null}
                    ref={(instancedMesh) => {
                        if (!instancedMesh) return;

                        // Apply exported transforms and source-part offsets.
                        instancePart.instances.forEach((instance, instanceIndex) => {
                            instanceMatrix
                                .fromArray(instance.worldMatrix)
                                .multiply(instancePart.sourceTransform);
                            instancedMesh.setMatrixAt(instanceIndex, instanceMatrix);
                        });
                        instancedMesh.instanceMatrix.needsUpdate = true;
                    }}
                />
            ))}
        </group>
    );
}
