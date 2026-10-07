// ### Imports ###

import { useEffect, useMemo, useRef, useState } from "react";
import { useLoader } from "@react-three/fiber";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import config from "../config.js";
import { HouseMakerTourPlayer } from "./HouseMakerTourPlayer.jsx";

// ### Component ###

/**
 * Purpose: Loads a HouseMaker export with mirrored models, instances, and SSAO.
 * Relationships: Replaces SimpleLoader and JsonInstancing for HouseMaker exports in SceneContainer.
 * Example:
 * <HouseMakerLoader jsonFile="housemaker_export.json" position={[0, 0, 0]} instancesEnabled={true} />
 * @param {string} [jsonFile] - HouseMaker JSON filename inside the models folder.
 * @param {Array<number>} [position] - Position shared by models and instances.
 * @param {boolean} [instancesEnabled] - Whether exported instances are rendered.
 * @param {boolean} [toursEnabled] - Whether exported runtime tours can activate.
 * @param {React.MutableRefObject<any>} [navigationRef] - Existing player navigation bridge.
 */
export function HouseMakerLoader(props) {
    const {jsonFile = "housemaker_export.json"} = props;
    const {position = [0, 0, 0]} = props;
    const {instancesEnabled = true} = props;
    const {toursEnabled = true} = props;
    const {navigationRef} = props;
    const rootRef = useRef();

    // Load export metadata before its referenced model.
    const manifestUrl = config.models_path + jsonFile;
    const sceneData = useLoader(
        THREE.FileLoader,
        manifestUrl,
        (loader) => loader.setResponseType("json")
    );
    const modelFile = sceneData.asset?.glb ?? "housemaker_export.glb";
    const gltf = useLoader(GLTFLoader, config.models_path + modelFile);

    const [ssaoEnabled, setSsaoEnabled] = useState(true);

    // Toggle the loader-owned SSAO effect.
    useEffect(() => {
        const handleSsaoToggle = (event) => {
            if (event.repeat || event.key?.toLowerCase() !== "a") return;
            setSsaoEnabled((enabled) => !enabled);
        };

        window.addEventListener("keydown", handleSsaoToggle);

        return () => window.removeEventListener("keydown", handleSsaoToggle);
    }, []);

    // Build mirrored models and reusable instance geometry.
    const renderData = useMemo(() => {
        const mirroredModels = new THREE.Group();
        const instanceParts = [];
        const sourceNodes = {};
        mirroredModels.name = "HouseMaker mirrored models";

        // Build a reflection from exported mirror metadata.
        const createReflectionMatrix = (mesh, context) => {
            const mirrorPlane = mesh.userData?.halfMesh?.mirrorPlane;
            const planePoint = mirrorPlane?.point;
            const planeNormal = mirrorPlane?.normal;
            const hasValidPlane = Array.isArray(planePoint)
                && planePoint.length === 3
                && planePoint.every(Number.isFinite)
                && Array.isArray(planeNormal)
                && planeNormal.length === 3
                && planeNormal.every(Number.isFinite);

            if (!hasValidPlane) {
                console.warn(`[HALF] ${context} "${mesh.name}" is missing mirror plane metadata.`);
                return undefined;
            }

            const point = new THREE.Vector3(...planePoint);
            const normal = new THREE.Vector3(...planeNormal);

            if (normal.lengthSq() === 0) {
                console.warn(`[HALF] ${context} "${mesh.name}" has an invalid mirror plane normal.`);
                return undefined;
            }

            normal.normalize();
            const planeDistance = normal.dot(point);

            return new THREE.Matrix4().set(
                1 - 2 * normal.x * normal.x, -2 * normal.x * normal.y, -2 * normal.x * normal.z, 2 * planeDistance * normal.x,
                -2 * normal.y * normal.x, 1 - 2 * normal.y * normal.y, -2 * normal.y * normal.z, 2 * planeDistance * normal.y,
                -2 * normal.z * normal.x, -2 * normal.z * normal.y, 1 - 2 * normal.z * normal.z, 2 * planeDistance * normal.z,
                0, 0, 0, 1
            );
        };

        // Mirror regular meshes from the rendered GLTF scene.
        gltf.scene.updateWorldMatrix(true, true);
        gltf.scene.traverse((node) => {
            if (!node.isMesh || !node.userData?.halfMesh) return;

            const reflectionMatrix = createReflectionMatrix(node, "model");
            if (!reflectionMatrix) return;

            const mirroredMesh = new THREE.Mesh(node.geometry, node.material);
            mirroredMesh.name = `[MIRRORED] ${node.name}`;
            mirroredMesh.castShadow = node.castShadow;
            mirroredMesh.receiveShadow = node.receiveShadow;
            mirroredMesh.renderOrder = node.renderOrder;
            mirroredMesh.visible = node.visible;
            mirroredMesh.frustumCulled = node.frustumCulled;
            mirroredMesh.matrixAutoUpdate = false;
            mirroredMesh.matrix.multiplyMatrices(reflectionMatrix, node.matrixWorld);
            mirroredMesh.matrixWorldNeedsUpdate = true;
            mirroredModels.add(mirroredMesh);
        });

        // Index instance sources across every exported scene.
        gltf.scenes.forEach((scene) => {
            scene.traverse((node) => {
                const sourceNodeIndex = gltf.parser?.associations?.get(node)?.nodes;
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

        const instanceGroups = Array.isArray(sceneData.instanceGroups)
            ? sceneData.instanceGroups
            : [];

        instanceGroups.forEach((instanceGroup, groupIndex) => {
            // Support version 2 and version 3 source names.
            const sourceNodeNames = Array.isArray(instanceGroup.sourceNodeNames)
                ? instanceGroup.sourceNodeNames
                : [instanceGroup.sourceNodeName];
            const exportedInstances = Array.isArray(instanceGroup.instances)
                ? instanceGroup.instances
                : [];
            const instances = exportedInstances.filter((instance) => (
                Array.isArray(instance.worldMatrix)
                && instance.worldMatrix.length === 16
                && instance.worldMatrix.every(Number.isFinite)
            ));

            if (instances.length !== exportedInstances.length) {
                console.warn(`HouseMaker instance group ${groupIndex} contains invalid world matrices.`);
            }

            sourceNodeNames.filter(Boolean).forEach((sourceNodeName) => {
                const sourceNode = sourceNodes[sourceNodeName];
                if (!sourceNode) {
                    console.warn(`HouseMaker instance source not found: ${sourceNodeName}`);
                    return;
                }

                // Collect every renderable part below the source.
                const sourceMeshes = [];
                sourceNode.updateWorldMatrix(true, true);
                sourceNode.traverse((node) => {
                    if (node.isMesh) sourceMeshes.push(node);
                });

                if (sourceMeshes.length === 0) {
                    console.warn(`HouseMaker instance source has no meshes: ${sourceNodeName}`);
                    return;
                }

                sourceMeshes.forEach((sourceMesh, sourceMeshIndex) => {
                    const sourceTransform = sourceNode.matrixWorld
                        .clone()
                        .invert()
                        .multiply(sourceMesh.matrixWorld);
                    let geometry = sourceMesh.geometry;
                    let ownsGeometry = false;

                    if (instanceGroup.halfMesh) {
                        const reflectionMatrix = createReflectionMatrix(sourceMesh, "instance source");

                        if (reflectionMatrix) {
                            // Convert the source reflection into mesh-local space.
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

                            // Restore triangle winding after reflection.
                            const mirroredIndex = mirroredGeometry.index;
                            for (let index = 0; index + 2 < mirroredIndex.count; index += 3) {
                                const secondIndex = mirroredIndex.getX(index + 1);
                                mirroredIndex.setX(index + 1, mirroredIndex.getX(index + 2));
                                mirroredIndex.setX(index + 2, secondIndex);
                            }
                            mirroredIndex.needsUpdate = true;

                            // Preserve tangent handedness for normal maps.
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
                                console.warn(`[HALF] Could not merge instance source "${sourceMesh.name}".`);
                            }
                        }
                    }

                    instanceParts.push({
                        key: `${groupIndex}-${sourceNodeName}-${sourceMeshIndex}`,
                        name: `HouseMaker instances ${sourceNodeName} part ${sourceMeshIndex + 1}`,
                        geometry,
                        material: sourceMesh.material,
                        instances,
                        sourceTransform,
                        castShadow: sourceMesh.castShadow,
                        receiveShadow: sourceMesh.receiveShadow,
                        ownsGeometry
                    });
                });
            });
        });

        return { mirroredModels, instanceParts };
    }, [gltf, sceneData]);

    // Dispose only merged geometry owned by this loader.
    useEffect(() => () => {
        renderData.instanceParts.forEach((instancePart) => {
            if (instancePart.ownsGeometry) instancePart.geometry.dispose();
        });
    }, [renderData]);

    return (
        <>
            {/* Keep all exported transforms under one parent. */}
            <group ref={rootRef} position={position}>
                <primitive object={gltf.scene} dispose={null} />
                <primitive object={renderData.mirroredModels} dispose={null} />

                {instancesEnabled && renderData.instanceParts.map((instancePart) => (
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

                            // Apply exported transforms and source offsets.
                            const instanceMatrix = new THREE.Matrix4();
                            instancePart.instances.forEach((instance, instanceIndex) => {
                                instanceMatrix
                                    .fromArray(instance.worldMatrix)
                                    .multiply(instancePart.sourceTransform);
                                instancedMesh.setMatrixAt(instanceIndex, instanceMatrix);
                            });
                            instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
                            instancedMesh.instanceMatrix.needsUpdate = true;
                        }}
                    />
                ))}

                {/* Play runtime tours in the same exported coordinate space. */}
                <HouseMakerTourPlayer
                    manifest={sceneData}
                    manifestUrl={manifestUrl}
                    navigationRef={navigationRef}
                    rootRef={rootRef}
                    enabled={toursEnabled}
                />
            </group>

            {/* Apply ambient contact shadows to the active scene. */}
            {ssaoEnabled &&
                <EffectComposer enableNormalPass multisampling={0} resolutionScale={0.5}>
                    <SSAO
                        samples={17}
                        rings={7}
                        radius={0.15}
                        intensity={1.25}
                        luminanceInfluence={0.7}
                        bias={0.025}
                    />
                </EffectComposer>
            }
        </>
    );
}
