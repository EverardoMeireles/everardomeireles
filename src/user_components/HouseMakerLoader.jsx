// ### Imports ###

import { useEffect, useMemo, useRef, useState } from "react";
import { useLoader } from "@react-three/fiber";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import config from "../config.js";
import { HouseMakerTourPlayer } from "./HouseMakerTourPlayer.jsx";

// ### Door reconstruction helpers ###

// Check exported identifiers before exact matching.
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

// Check exported points and normals before matrix math.
function isFiniteVector3(value) {
    return Array.isArray(value)
        && value.length === 3
        && value.every(Number.isFinite);
}

// Normalize safely without overflowing squared vector lengths.
function normalizeFiniteVector3(value) {
    if (!isFiniteVector3(value)) return undefined;

    const length = Math.hypot(...value);
    if (!Number.isFinite(length) || length === 0) return undefined;

    const normalized = value.map((component) => component / length);
    return normalized.every(Number.isFinite) ? normalized : undefined;
}

// Visit authored nodes without entering generated mirror trees.
function traverseAuthoredNodes(node, visit) {
    if (!node || node.userData?.housemakerRuntimeMirror) return;

    visit(node);
    node.children.forEach((child) => traverseAuthoredNodes(child, visit));
}

// Collect each outermost tagged half-mesh source once.
function collectHalfMeshSources(node, sources) {
    if (!node || node.userData?.housemakerRuntimeMirror) return;

    if (node.userData?.halfMesh) {
        sources.push(node);
        return;
    }

    node.children.forEach((child) => collectHalfMeshSources(child, sources));
}

// Keep components out until explicitly requested for mirroring.
function removeDoorComponentDescendants(node) {
    [...node.children].forEach((child) => {
        if (child.userData?.housemakerDoorComponent) {
            node.remove(child);
            return;
        }

        removeDoorComponentDescendants(child);
    });
}

// Validate one exported door reconstruction entry.
export function validateDoorBodyReconstruction(entry, entryIndex = 0, warning = console.warn) {
    const warningPrefix = `HouseMaker door reconstruction ${entryIndex}`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        warning(`${warningPrefix} must be an object.`);
        return undefined;
    }

    if (!isNonEmptyString(entry.placementObjectId)) {
        warning(`${warningPrefix} has an invalid placementObjectId.`);
        return undefined;
    }

    if (!isNonEmptyString(entry.bodyObjectId)) {
        warning(`${warningPrefix} has an invalid bodyObjectId.`);
        return undefined;
    }

    const sideDuplication = entry.sideDuplication;
    if (!sideDuplication || typeof sideDuplication !== "object" || Array.isArray(sideDuplication)) {
        warning(`${warningPrefix} is missing sideDuplication metadata.`);
        return undefined;
    }

    if (sideDuplication.keptSide !== "front" && sideDuplication.keptSide !== "back") {
        warning(`${warningPrefix} has an invalid sideDuplication.keptSide.`);
        return undefined;
    }

    if (sideDuplication.applyAfter !== "halfMesh") {
        warning(`${warningPrefix} has an unsupported sideDuplication.applyAfter value.`);
        return undefined;
    }

    if (sideDuplication.uvMode !== "reuse") {
        warning(`${warningPrefix} has an unsupported sideDuplication.uvMode value.`);
        return undefined;
    }

    const mirrorPlane = sideDuplication.mirrorPlane;
    if (!mirrorPlane || !isFiniteVector3(mirrorPlane.point)) {
        warning(`${warningPrefix} has an invalid sideDuplication mirror point.`);
        return undefined;
    }

    if (!isFiniteVector3(mirrorPlane.normal)) {
        warning(`${warningPrefix} has an invalid sideDuplication mirror normal.`);
        return undefined;
    }

    const normalizedNormal = normalizeFiniteVector3(mirrorPlane.normal);
    if (!normalizedNormal) {
        warning(`${warningPrefix} has a zero-length or non-finite sideDuplication mirror normal.`);
        return undefined;
    }

    const componentIds = sideDuplication.mirroredComponentObjectIds;
    if (componentIds !== undefined && (
        !Array.isArray(componentIds)
        || componentIds.some((componentId) => !isNonEmptyString(componentId))
    )) {
        warning(`${warningPrefix} has invalid mirroredComponentObjectIds.`);
        return undefined;
    }

    return {
        placementObjectId: entry.placementObjectId,
        bodyObjectId: entry.bodyObjectId,
        sideDuplication: {
            keptSide: sideDuplication.keptSide,
            applyAfter: sideDuplication.applyAfter,
            uvMode: sideDuplication.uvMode,
            mirrorPlane: {
                point: [...mirrorPlane.point],
                normal: normalizedNormal
            },
            mirroredComponentObjectIds: [...new Set(componentIds ?? [])]
        }
    };
}

// Validate entries independently so one cannot block loading.
export function validateDoorBodyReconstructions(entries, warning = console.warn) {
    if (entries === undefined) return [];

    if (!Array.isArray(entries)) {
        warning("HouseMaker doorBodyReconstructions must be an array.");
        return [];
    }

    const validEntries = [];
    const seenDoors = new Set();

    entries.forEach((entry, entryIndex) => {
        const validEntry = validateDoorBodyReconstruction(entry, entryIndex, warning);
        if (!validEntry) return;

        const doorKey = `${validEntry.placementObjectId}\u0000${validEntry.bodyObjectId}`;
        if (seenDoors.has(doorKey)) {
            warning(`HouseMaker door reconstruction ${entryIndex} duplicates ${validEntry.placementObjectId}/${validEntry.bodyObjectId}.`);
            return;
        }

        seenDoors.add(doorKey);
        validEntries.push(validEntry);
    });

    return validEntries;
}

// Build the exact world-space plane reflection matrix.
export function buildPlaneReflectionMatrix(mirrorPlane) {
    if (!mirrorPlane
        || !isFiniteVector3(mirrorPlane.point)
        || !isFiniteVector3(mirrorPlane.normal)) {
        return undefined;
    }

    const normalizedNormal = normalizeFiniteVector3(mirrorPlane.normal);
    if (!normalizedNormal) return undefined;

    const point = new THREE.Vector3(...mirrorPlane.point);
    const normal = new THREE.Vector3(...normalizedNormal);
    const planeDistance = normal.dot(point);
    if (!Number.isFinite(planeDistance)) return undefined;

    return new THREE.Matrix4().set(
        1 - 2 * normal.x * normal.x, -2 * normal.x * normal.y, -2 * normal.x * normal.z, 2 * planeDistance * normal.x,
        -2 * normal.y * normal.x, 1 - 2 * normal.y * normal.y, -2 * normal.y * normal.z, 2 * planeDistance * normal.y,
        -2 * normal.z * normal.x, -2 * normal.z * normal.y, 1 - 2 * normal.z * normal.z, 2 * planeDistance * normal.z,
        0, 0, 0, 1
    );
}

// Read and validate regular half-mesh reflection metadata.
function getHalfMeshReflectionMatrix(sourceObject, context, warning = console.warn) {
    const halfMesh = sourceObject.userData?.halfMesh;

    if (halfMesh?.uvMode !== undefined && halfMesh.uvMode !== "reuse") {
        warning(`[HALF] ${context} "${sourceObject.name}" has an unsupported UV mode.`);
        return undefined;
    }

    const reflectionMatrix = buildPlaneReflectionMatrix(halfMesh?.mirrorPlane);
    if (!reflectionMatrix) {
        warning(`[HALF] ${context} "${sourceObject.name}" has invalid mirror plane metadata.`);
        return undefined;
    }

    return reflectionMatrix;
}

// Locate one body using both stable exported identifiers.
export function findDoorBodyNode(root, placementObjectId, bodyObjectId) {
    let matchingNode;

    traverseAuthoredNodes(root, (node) => {
        if (matchingNode) return;

        const doorBody = node.userData?.housemakerDoorBody;
        if (doorBody?.placementObjectId === placementObjectId
            && doorBody?.bodyObjectId === bodyObjectId) {
            matchingNode = node;
        }
    });

    return matchingNode;
}

// Locate components using placement and component identifiers.
export function findDoorComponentNodes(root, placementObjectId, componentObjectId) {
    const matchingNodes = [];

    traverseAuthoredNodes(root, (node) => {
        const doorComponent = node.userData?.housemakerDoorComponent;
        if (doorComponent?.placementObjectId === placementObjectId
            && doorComponent?.componentObjectId === componentObjectId) {
            matchingNodes.push(node);
        }
    });

    return matchingNodes;
}

// Reflect a complete object while sharing rendering resources.
export function createMirroredObject(
    sourceObject,
    parent,
    reflectionMatrix,
    runtimeMetadata,
    recursive = true
) {
    if (!sourceObject?.isObject3D || !parent?.isObject3D || !reflectionMatrix?.isMatrix4) {
        return undefined;
    }

    sourceObject.updateWorldMatrix(true, true);
    parent.updateWorldMatrix(true, false);

    const parentDeterminant = parent.matrixWorld.determinant();
    if (!Number.isFinite(parentDeterminant) || parentDeterminant === 0) return undefined;

    const mirroredWorldMatrix = reflectionMatrix.clone().multiply(sourceObject.matrixWorld);
    const mirroredLocalMatrix = parent.matrixWorld
        .clone()
        .invert()
        .multiply(mirroredWorldMatrix);
    const mirroredObject = sourceObject.clone(recursive);

    mirroredObject.name = `[MIRRORED] ${sourceObject.name}`;
    mirroredObject.matrixAutoUpdate = false;
    // Keep reflection determinant for Three's front-face correction.
    mirroredObject.matrix.copy(mirroredLocalMatrix);
    mirroredObject.matrixWorldNeedsUpdate = true;
    mirroredObject.userData = {
        ...mirroredObject.userData,
        housemakerRuntimeMirror: runtimeMetadata
    };
    delete mirroredObject.userData.housemakerRuntimeDoorMirror;

    if (runtimeMetadata?.placementObjectId) {
        mirroredObject.userData.housemakerRuntimeDoorMirror = {
            placementObjectId: runtimeMetadata.placementObjectId,
            sourceObjectId: runtimeMetadata.sourceObjectId,
            mirrorType: runtimeMetadata.mirrorType,
            sourceNodeUuid: runtimeMetadata.sourceNodeUuid
        };
    }

    parent.add(mirroredObject);
    mirroredObject.updateWorldMatrix(false, true);

    return mirroredObject;
}

// Remove generated mirrors without disposing shared resources.
export function removeHouseMakerRuntimeMirrors(root) {
    const runtimeMirrors = [];

    root?.traverse((node) => {
        if (node !== root && node.userData?.housemakerRuntimeMirror) {
            runtimeMirrors.push(node);
        }
    });

    runtimeMirrors.forEach((runtimeMirror) => runtimeMirror.parent?.remove(runtimeMirror));
    return runtimeMirrors;
}

// Create the loader's regular half-mesh copies first.
export function reconstructHalfMeshes(scene, mirrorGroup, warning = console.warn) {
    const sourceObjects = [];
    const mirrorBySource = new Map();
    const mirrors = [];
    const oldHalfMirrors = [];

    mirrorGroup.traverse((node) => {
        if (node.userData?.housemakerRuntimeMirror?.mirrorType === "halfMesh") {
            oldHalfMirrors.push(node);
        }
    });
    oldHalfMirrors.forEach((mirror) => mirror.parent?.remove(mirror));

    scene.updateWorldMatrix(true, true);
    collectHalfMeshSources(scene, sourceObjects);

    sourceObjects.forEach((sourceObject) => {
        const reflectionMatrix = getHalfMeshReflectionMatrix(sourceObject, "model", warning);
        if (!reflectionMatrix) return;

        const doorBody = sourceObject.userData?.housemakerDoorBody;
        const runtimeMetadata = {
            sourceObjectId: doorBody?.bodyObjectId ?? sourceObject.uuid,
            placementObjectId: doorBody?.placementObjectId,
            mirrorType: "halfMesh",
            sourceNodeUuid: sourceObject.uuid
        };
        const mirroredObject = createMirroredObject(
            sourceObject,
            mirrorGroup,
            reflectionMatrix,
            runtimeMetadata,
            Boolean(doorBody) || !sourceObject.isMesh
        );

        if (!mirroredObject) {
            warning(`[HALF] Could not mirror model "${sourceObject.name}".`);
            return;
        }

        if (doorBody) removeDoorComponentDescendants(mirroredObject);
        mirrors.push(mirroredObject);
        mirrorBySource.set(sourceObject, mirroredObject);
    });

    return { mirrors, mirrorBySource };
}

// Reconstruct one validated door in the required order.
export function reconstructDoorBody(
    scene,
    mirrorGroup,
    reconstruction,
    halfMirrorBySource,
    warning = console.warn
) {
    const createdMirrors = [];
    const bodyNode = findDoorBodyNode(
        scene,
        reconstruction.placementObjectId,
        reconstruction.bodyObjectId
    );

    if (!bodyNode) {
        warning(`HouseMaker door body not found: ${reconstruction.placementObjectId}/${reconstruction.bodyObjectId}.`);
        return createdMirrors;
    }

    const reflectionMatrix = buildPlaneReflectionMatrix(
        reconstruction.sideDuplication.mirrorPlane
    );
    const bodySources = [{ object: bodyNode, mirrorType: "sideDuplication:authored" }];
    const halfMirror = halfMirrorBySource?.get(bodyNode);

    if (reconstruction.sideDuplication.applyAfter === "halfMesh" && halfMirror) {
        bodySources.push({
            object: halfMirror,
            mirrorType: "sideDuplication:halfMesh"
        });
    }

    bodySources.forEach((bodySource) => {
        const mirroredBody = createMirroredObject(
            bodySource.object,
            mirrorGroup,
            reflectionMatrix,
            {
                placementObjectId: reconstruction.placementObjectId,
                sourceObjectId: reconstruction.bodyObjectId,
                mirrorType: bodySource.mirrorType,
                sourceNodeUuid: bodySource.object.uuid
            },
            true
        );

        if (mirroredBody) {
            removeDoorComponentDescendants(mirroredBody);
            createdMirrors.push(mirroredBody);
        } else {
            warning(`Could not mirror HouseMaker door body: ${reconstruction.placementObjectId}/${reconstruction.bodyObjectId}.`);
        }
    });

    reconstruction.sideDuplication.mirroredComponentObjectIds.forEach((componentObjectId) => {
        const componentNodes = findDoorComponentNodes(
            scene,
            reconstruction.placementObjectId,
            componentObjectId
        );

        if (componentNodes.length === 0) {
            warning(`HouseMaker door component not found: ${reconstruction.placementObjectId}/${componentObjectId}.`);
            return;
        }

        componentNodes.forEach((componentNode) => {
            const mirroredComponent = createMirroredObject(
                componentNode,
                mirrorGroup,
                reflectionMatrix,
                {
                    placementObjectId: reconstruction.placementObjectId,
                    sourceObjectId: componentObjectId,
                    mirrorType: "sideDuplication:component",
                    sourceNodeUuid: componentNode.uuid
                },
                true
            );

            if (mirroredComponent) {
                createdMirrors.push(mirroredComponent);
            } else {
                warning(`Could not mirror HouseMaker door component: ${reconstruction.placementObjectId}/${componentObjectId}.`);
            }
        });
    });

    return createdMirrors;
}

// Rebuild side mirrors deterministically from validated metadata.
export function reconstructDoorBodies(
    scene,
    mirrorGroup,
    entries,
    halfMirrorBySource,
    warning = console.warn
) {
    const oldSideMirrors = [];

    mirrorGroup.traverse((node) => {
        const mirrorType = node.userData?.housemakerRuntimeDoorMirror?.mirrorType;
        if (mirrorType?.startsWith("sideDuplication:")) oldSideMirrors.push(node);
    });
    oldSideMirrors.forEach((mirror) => mirror.parent?.remove(mirror));

    const validEntries = validateDoorBodyReconstructions(entries, warning);
    return validEntries.flatMap((entry) => reconstructDoorBody(
        scene,
        mirrorGroup,
        entry,
        halfMirrorBySource,
        warning
    ));
}

// Clone cached content and prepare all model mirrors.
export function prepareHouseMakerModelScene(sourceScene, entries, warning = console.warn) {
    const modelScene = sourceScene.clone(true);
    const mirroredModels = new THREE.Group();
    mirroredModels.name = "HouseMaker mirrored models";

    removeHouseMakerRuntimeMirrors(modelScene);
    const halfMeshResult = reconstructHalfMeshes(modelScene, mirroredModels, warning);
    const doorMirrors = reconstructDoorBodies(
        modelScene,
        mirroredModels,
        entries,
        halfMeshResult.mirrorBySource,
        warning
    );

    return {
        modelScene,
        mirroredModels,
        runtimeMirrors: [...halfMeshResult.mirrors, ...doorMirrors]
    };
}

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
        const preparedModel = prepareHouseMakerModelScene(
            gltf.scene,
            sceneData.doorBodyReconstructions
        );
        const { modelScene, mirroredModels, runtimeMirrors } = preparedModel;
        const instanceParts = [];
        const sourceNodes = {};

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
                        const reflectionMatrix = getHalfMeshReflectionMatrix(
                            sourceMesh,
                            "instance source"
                        );

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

        return { modelScene, mirroredModels, runtimeMirrors, instanceParts };
    }, [gltf, sceneData]);

    // Restore Strict Mode mirrors and clean owned resources.
    useEffect(() => {
        renderData.runtimeMirrors.forEach((runtimeMirror) => {
            if (!runtimeMirror.parent) renderData.mirroredModels.add(runtimeMirror);
        });

        return () => {
            renderData.runtimeMirrors.forEach((runtimeMirror) => {
                runtimeMirror.parent?.remove(runtimeMirror);
            });
            renderData.instanceParts.forEach((instancePart) => {
                if (instancePart.ownsGeometry) instancePart.geometry.dispose();
            });
        };
    }, [renderData]);

    return (
        <>
            {/* Keep all exported transforms under one parent. */}
            <group ref={rootRef} position={position}>
                <primitive object={renderData.modelScene} dispose={null} />
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
