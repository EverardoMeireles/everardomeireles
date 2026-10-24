// ### Imports ###

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import config from "../config.js";
import { HouseMakerTourPlayer } from "./HouseMakerTourPlayer.jsx";
import { smoothStep } from "../Helper.js";

// Identify objects while preserving surfaces and ambiguous atlas geometry.
export function isHouseMakerHideableObject(object, defaultHideable = false) {
    let node = object;
    while (node) {
        const data = node.userData ?? {};
        if (data.housemaker_surface_id || data.housemaker_atlas_type === "surface") return false;
        if (data.housemaker_atlas_type === "object") return true;

        const atlasSources = data.housemaker_atlas_source_ids;
        if (Array.isArray(atlasSources) && atlasSources.length > 0) {
            return atlasSources.every((id) => (
                typeof id === "string"
                && id.length > 0
                && !/^(surface[-:]|level:|stair:)/i.test(id)
            ));
        }

        if (data.housemaker_object_id
            || data.housemakerDoorBody || data.housemaker_door_body
            || data.housemakerDoorComponent || data.housemaker_door_component) {
            return true;
        }

        if (typeof data.housemakerHideable === "boolean") return data.housemakerHideable;
        node = node.parent;
    }

    return defaultHideable;
}

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

// Validate exported lights without blocking other runtime features.
export function validateDirectionalLights(entries, warning = console.warn) {
    if (!Array.isArray(entries)) {
        if (entries !== undefined) {
            warning("HouseMaker directionalLights must be an array; ignoring directional lights.");
        }
        return [];
    }

    const validLights = [];
    const seenIds = new Set();

    entries.forEach((entry, entryIndex) => {
        const warningPrefix = `HouseMaker directional light ${entryIndex}`;

        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            warning(`${warningPrefix} must be an object.`);
            return;
        }

        if (!isNonEmptyString(entry.id)) {
            warning(`${warningPrefix} has an invalid id.`);
            return;
        }

        if (seenIds.has(entry.id)) {
            warning(`${warningPrefix} duplicates id "${entry.id}"; keeping the first light.`);
            return;
        }

        if (!isFiniteVector3(entry.position)) {
            warning(`${warningPrefix} has an invalid position.`);
            return;
        }

        if (!isFiniteVector3(entry.target)) {
            warning(`${warningPrefix} has an invalid target.`);
            return;
        }

        if (entry.position.every((component, index) => component === entry.target[index])) {
            warning(`${warningPrefix} position and target must be different.`);
            return;
        }

        if (entry.name !== undefined && typeof entry.name !== "string") {
            warning(`${warningPrefix} has an invalid name.`);
            return;
        }

        const color = entry.color === undefined ? "#ffffff" : entry.color;
        if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
            warning(`${warningPrefix} has an invalid color.`);
            return;
        }

        const intensity = entry.intensity === undefined ? 1 : entry.intensity;
        if (!Number.isFinite(intensity) || intensity < 0) {
            warning(`${warningPrefix} has an invalid intensity.`);
            return;
        }

        const castShadow = entry.castShadow === undefined ? false : entry.castShadow;
        if (typeof castShadow !== "boolean") {
            warning(`${warningPrefix} has an invalid castShadow value.`);
            return;
        }

        seenIds.add(entry.id);
        validLights.push({
            id: entry.id,
            name: entry.name === undefined ? entry.id : entry.name,
            position: [...entry.position],
            target: [...entry.target],
            color,
            intensity,
            castShadow
        });
    });

    return validLights;
}

// Validate fixture lights independently; positions already use export coordinates.
export function validateObjectLights(entries, warning = console.warn) {
    if (!Array.isArray(entries)) {
        if (entries != null) warning("HouseMaker objectLights must be an array; ignoring fixture lights.");
        return [];
    }
    const ids = new Set();
    const lights = [];
    entries.forEach((entry, index) => {
        const prefix = `HouseMaker object light ${index}`;
        let reason;
        const type = entry?.type;
        const color = entry?.color ?? "#ffffff";
        const intensity = entry?.intensity ?? 1;
        const range = entry?.rangeMeters ?? 0;
        const castShadow = entry?.castShadow ?? false;
        const cone = entry?.coneAngleDegrees ?? 30;
        const penumbra = entry?.penumbra ?? 0.2;
        let target = entry?.target;
        if (type === "spot" && target === undefined && isFiniteVector3(entry?.position)) {
            const direction = normalizeFiniteVector3(entry.direction);
            if (direction) target = entry.position.map((value, axis) => value + direction[axis]);
        }
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) reason = "must be an object";
        else if (!isNonEmptyString(entry.id)) reason = "has an invalid id";
        else if (ids.has(entry.id)) reason = `duplicates id "${entry.id}"; keeping the first light`;
        else if (!["point", "spot"].includes(type)) reason = "type must be point or spot";
        else if (!isFiniteVector3(entry.position)) reason = "has an invalid position";
        else if (entry.name !== undefined && typeof entry.name !== "string") reason = "has an invalid name";
        else if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) reason = "has an invalid color";
        else if (!Number.isFinite(intensity) || intensity < 0) reason = "has an invalid intensity";
        else if (!Number.isFinite(range) || range < 0) reason = "has an invalid rangeMeters";
        else if (typeof castShadow !== "boolean") reason = "has an invalid castShadow";
        else if (entry.nightOnly !== undefined && typeof entry.nightOnly !== "boolean") reason = "has an invalid nightOnly";
        else if (["objectId", "instanceId", "sourceObjectId", "lightId"].some((key) => entry[key] !== undefined && !isNonEmptyString(entry[key]))) reason = "has an invalid owner or light identifier";
        else if (type === "spot" && (!isFiniteVector3(target)
            || target.every((value, axis) => value === entry.position[axis]))) reason = "has an invalid target or direction";
        else if (type === "spot" && (!Number.isFinite(cone) || cone <= 0 || cone > 90)) reason = "has an invalid coneAngleDegrees";
        else if (type === "spot" && (!Number.isFinite(penumbra) || penumbra < 0 || penumbra > 1)) reason = "has an invalid penumbra";
        if (reason) {
            warning(`${prefix} ${reason}.`);
            return;
        }
        ids.add(entry.id);
        lights.push({ ...entry, type, color, intensity, rangeMeters: range, castShadow,
            name: entry.name ?? entry.id, position: [...entry.position],
            target: type === "spot" ? [...target] : undefined,
            coneAngleDegrees: cone, penumbra, nightOnly: entry.nightOnly !== false });
    });
    return lights;
}

// Preserve linear emission independently from streamed PBR surface properties.
function applyHouseMakerFaceLighting(material, metadata, nightFactor) {
    if (!material?.emissive?.isColor || !metadata) return;
    const rgb = metadata.emissiveLinearRgb;
    const strength = Math.max(...rgb);
    material.emissive.setRGB(strength > 0 ? rgb[0] / strength : 0,
        strength > 0 ? rgb[1] / strength : 0, strength > 0 ? rgb[2] / strength : 0, THREE.LinearSRGBColorSpace);
    material.emissiveIntensity = strength * (metadata.nightOnly ? nightFactor : 1);
}

// Keep lit fixtures visible while ordinary objects fade away.
function applyHouseMakerObjectFade(record, opacity, nightFactor) {
    const amount = record.keepWhenLit ? Math.max(opacity, nightFactor) : opacity;
    record.fadeMaterials.forEach((entry) => {
        entry.material.opacity = entry.opacity * amount;
        entry.material.alphaTest = entry.alphaTest * Math.max(amount, Number.EPSILON);
    });
    if (record.depthMaterial) {
        record.depthMaterial.opacity = record.fadeMaterials[0].material.opacity;
        if (record.distanceMaterial) record.distanceMaterial.opacity = record.depthMaterial.opacity;
        record.shadowOpacity.value = record.depthMaterial.opacity;
    }
    record.mesh.visible = amount > 0;
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
function getHalfMeshReflectionMatrix(
    sourceObject,
    context,
    warning = console.warn,
    halfMesh = sourceObject.userData?.halfMesh
) {
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
        let scaleRoot;
        let scaleExclusionRoot;
        let scaleExclusionInner;
        let child = sourceObject;
        let ancestor = sourceObject.parent;
        while (ancestor) {
            if (!scaleExclusionRoot
                && ancestor.userData.housemakerObjectScaleExclusion?.halfMesh) {
                scaleExclusionRoot = ancestor;
                scaleExclusionInner = child;
            }
            if (ancestor.userData.housemakerGlobalScale === true) {
                scaleRoot = ancestor;
                break;
            }
            child = ancestor;
            ancestor = ancestor.parent;
        }

        // Reflect original metadata through the complete export compensation.
        const originalHalfMesh = scaleExclusionRoot?.userData.housemakerObjectScaleExclusion.halfMesh;
        const reflectionMatrix = getHalfMeshReflectionMatrix(sourceObject, "model", warning, originalHalfMesh);
        if (!reflectionMatrix) return;
        if (scaleRoot || scaleExclusionRoot) {
            const reflectionFrame = scaleRoot?.matrixWorld.clone() ?? new THREE.Matrix4();
            if (scaleExclusionRoot) {
                const parentWorld = scaleExclusionRoot.parent?.matrixWorld ?? new THREE.Matrix4();
                reflectionFrame.premultiply(scaleExclusionInner.matrixWorld.clone()
                    .multiply(parentWorld.clone().invert()));
            }
            const determinant = reflectionFrame.determinant();
            if (!reflectionFrame.elements.every(Number.isFinite)
                || !Number.isFinite(determinant) || determinant === 0) {
                warning(`[HALF] Model "${sourceObject.name}" has an invalid global scale or compensation transform.`);
                return;
            }
            reflectionMatrix.premultiply(reflectionFrame).multiply(reflectionFrame.clone().invert());
        }

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
export function prepareHouseMakerModelScene(sourceScene, entries, warning = console.warn, faceLightingByMesh) {
    const modelScene = sourceScene.clone(true);
    // Bind exact primitive metadata before runtime mirrors copy userData.
    if (faceLightingByMesh?.size) {
        const sourceNodes = [];
        sourceScene.traverse((node) => sourceNodes.push(node));
        let index = 0;
        modelScene.traverse((node) => {
            const metadata = faceLightingByMesh.get(sourceNodes[index++]);
            if (metadata) node.userData.housemakerFaceLighting = metadata;
        });
    }
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

// ### Exported lighting ###

/** Mount one fixture light without duplicating instanced or mirrored placements. */
export function HouseMakerObjectLight({light, lighting}) {
    const lightRef = useRef();
    const target = useMemo(() => {
        if (light.type !== "spot") return null;
        const object = new THREE.Object3D();
        object.visible = false;
        return object;
    }, [light.type]);

    // Register authored intensities, never multiply previous frame values.
    useLayoutEffect(() => {
        const object = lightRef.current;
        if (!object) return undefined;
        if (target) {
            target.position.fromArray(light.target);
            target.updateWorldMatrix(true, false);
            object.target = target;
        }
        const record = { object, intensity: light.intensity, nightOnly: light.nightOnly };
        lighting.lights.add(record);
        lighting.setFactor(lighting.factor);
        return () => lighting.lights.delete(record);
    }, [light, lighting, target]);

    const userData = {
        houseMakerObjectLightId: light.id, housemaker_object_id: light.objectId,
        housemaker_instance_id: light.instanceId, housemakerBaseIntensity: light.intensity
    };
    const intensity = light.intensity * (light.nightOnly ? lighting.factor : 1);

    return <>
        {light.type === "spot" ? <spotLight ref={lightRef} name={light.name}
            position={light.position} color={light.color} intensity={intensity}
            distance={light.rangeMeters} angle={THREE.MathUtils.degToRad(light.coneAngleDegrees)}
            penumbra={light.penumbra} castShadow={light.castShadow} userData={userData} />
            : <pointLight ref={lightRef} name={light.name} position={light.position}
                color={light.color} intensity={intensity} distance={light.rangeMeters}
                castShadow={light.castShadow} userData={userData} />}
        {target && <primitive object={target} />}
    </>;
}

/**
 * Purpose: Mounts one exported directional light and its scene target.
 * Relationships: HouseMakerLoader places both objects under its transform root.
 * Example: <HouseMakerDirectionalLight light={directionalLight} />
 * @param {object} props.light - Validated exported light data.
 * @param {object} [props.sunlightOrbit] - Validated sun-ray orbit metadata.
 * @param {THREE.Scene} [props.environmentScene] - HDRI scene following this sun.
 * @param {string} [props.sunLightColor] - Optional sun color override.
 * @param {number} [props.shadowSoftness] - Apparent sun diameter, in degrees.
 * @param {number} [props.shadowCoverage] - Percentage of automatic shadow coverage.
 * @param {boolean} [props.sunOrbitPaused] - Hold the current sun angle.
 * @param {number} [props.sunOrbitAngle] - Degrees relative to the exported direction.
 * @param {number} [props.sunOrbitAngleRevision] - Repeat manual-angle commands explicitly.
 * @param {boolean} [props.showSunRays] - Show incoming sunlight direction guides.
 * @param {function} [props.onSunOrbitAngleChange] - Report the displayed orbit angle.
 * @param {object} [props.dayNightSettings] - One-shot transition settings and commands.
 * @param {object} [props.dayNightEnvironment] - Owned lazy HDRI blending runtime ref.
 */
export function HouseMakerDirectionalLight(props) {
    const {light, sunlightOrbit, shadowBounds, shadowMapSize = 1024} = props;
    const {shadowBias, shadowNormalBias, shadowMapSizeOverride} = props;
    const {shadowSoftness = 2, shadowCoverage = 100} = props;
    const softness = Number.isFinite(shadowSoftness) ? THREE.MathUtils.clamp(shadowSoftness, 0, 8) : 2;
    const coverage = Number.isFinite(shadowCoverage) ? THREE.MathUtils.clamp(shadowCoverage, 10, 200) / 100 : 1;
    const {environmentScene} = props;
    const {sunLightColor} = props;
    const {sunOrbitPaused = false, sunOrbitAngle, showSunRays = false, onSunOrbitAngleChange} = props;
    const {sunOrbitAngleRevision = 0} = props;
    const {dayNightSettings, dayNightEnvironment, dayNightPanelOpen = false, onDayNightStatusChange} = props;
    const {fixtureLighting} = props;
    const lightColor = typeof sunLightColor === "string" && /^#[0-9a-f]{6}$/i.test(sunLightColor)
        ? sunLightColor : light.color;
    const overrideSize = [512, 1024, 2048, 4096].includes(shadowMapSizeOverride) ? shadowMapSizeOverride : undefined;
    const mapSize = overrideSize ?? (shadowBounds ? shadowMapSize : 512);
    const bias = Number.isFinite(shadowBias) ? shadowBias : shadowBounds ? -0.0001 : 0;
    const normalBias = Number.isFinite(shadowNormalBias) ? shadowNormalBias : shadowBounds ? 0.03 : 0;
    const directionalLightRef = useRef();
    const environmentOrbitRef = useRef(null);
    const angleReportRef = useRef({ elapsed: 0, angle: null });
    const dayNightManualRef = useRef({angle: sunOrbitAngle, revision: sunOrbitAngleRevision});
    const targetObject = useMemo(() => {
        const target = new THREE.Object3D();
        target.visible = false;
        return target;
    }, []);

    // Preserve animation phase across equivalent prop objects and rerenders.
    const [positionX, positionY, positionZ] = light.position;
    const [targetX, targetY, targetZ] = light.target;
    const [axisX, axisY, axisZ] = sunlightOrbit?.axis ?? [0, 1, 0];
    const [directionX, directionY, directionZ] = sunlightOrbit?.initialDirection
        ?? [targetX - positionX, targetY - positionY, targetZ - positionZ];
    const speed = sunlightOrbit?.enabled && sunlightOrbit.lightId === light.id
        ? sunlightOrbit.speedDegreesPerSecond : 0;
    const hasOrbit = Boolean(speed) || Number.isFinite(sunOrbitAngle);
    const orbit = useMemo(() => {
        if (!hasOrbit) return null;
        return {
            lightId: light.id,
            phase: 0,
            radiansPerSecond: THREE.MathUtils.degToRad(speed),
            axis: new THREE.Vector3(axisX, axisY, axisZ).normalize(),
            direction: new THREE.Vector3(directionX, directionY, directionZ).normalize(),
            position: new THREE.Vector3(positionX, positionY, positionZ),
            distance: Math.hypot(targetX - positionX, targetY - positionY, targetZ - positionZ)
        };
    }, [light.id, speed, hasOrbit, axisX, axisY, axisZ, directionX, directionY, directionZ,
        positionX, positionY, positionZ, targetX, targetY, targetZ]);

    // Keep one transition clock independent of React and export animation.
    const dayNight = useMemo(() => ({
        lightId: light.id,
        command: 0, active: false, playing: false, pending: null, progress: 0,
        playbackDirection: 1,
        preparingRuntime: null,
        elapsed: Infinity, statusKey: null, panelOpen: false,
        reportedProgress: null, reportedStage: null,
        stage: "Exported lighting", rotations: null,
        position: new THREE.Vector3(positionX, positionY, positionZ),
        distance: Math.hypot(targetX - positionX, targetY - positionY, targetZ - positionZ),
        baseAzimuth: Math.atan2(positionX - targetX, positionZ - targetZ),
        direction: new THREE.Vector3(), tint: new THREE.Color(),
        keyframes: [
            [0, "Morning", 8, "#ffd0a0", 0.45, 0, "#ffe8cf", 0.8, 0.8],
            [0.22, "Noon", 90, "#fff8ed", 1, 0, "#ffffff", 1, 1],
            [0.45, "Afternoon", 135, "#ffe2ab", 0.85, 0, "#fff0d9", 0.9, 0.9],
            [0.62, "Sunset", 178, "#ff813a", 0.35, 0.15, "#ffc0a2", 0.55, 0.6],
            [0.72, "Dusk", 186, "#f55165", 0, 0.7, "#bdabdf", 0.5, 0.4],
            [0.84, "Evening", 200, "#b6bde3", 0, 1, "#d4ddff", 0.8, 0.7],
            [1, "Night", 230, "#b6caff", 0, 1, "#e4ebff", 1, 1]
        ].map(([time, name, angle, color, strength, blend, tint, brightness, background]) => ({
            time, name, angle, color: new THREE.Color(color), strength, blend,
            tint: new THREE.Color(tint), brightness, background
        })),
        restore(directionalLight, runtime, manualOrbit, color) {
            if (this.active || this.pending) runtime?.reset();
            this.rotations?.forEach(({rotation, original}) => rotation.copy(original));
            this.rotations = null;
            this.active = false;
            this.playing = false;
            this.pending = null;
            this.preparingRuntime = null;
            this.progress = 0;
            this.playbackDirection = 1;
            this.stage = "Exported lighting";
            this.elapsed = Infinity;
            fixtureLighting?.setFactor(0);
            if (!directionalLight?.isDirectionalLight) return;
            directionalLight.color.set(color);
            directionalLight.intensity = light.intensity;
            targetObject.position.set(targetX, targetY, targetZ);
            if (manualOrbit) targetObject.position.copy(manualOrbit.direction)
                .applyAxisAngle(manualOrbit.axis, manualOrbit.phase)
                .multiplyScalar(manualOrbit.distance).add(manualOrbit.position);
            targetObject.updateMatrix();
            targetObject.updateWorldMatrix(true, false);
        },
        apply(directionalLight, settings, runtime) {
            if (!directionalLight || !runtime?.ready) return;
            if (!this.rotations && environmentScene) this.rotations = [
                environmentScene.environmentRotation, environmentScene.backgroundRotation
            ].map((rotation) => ({rotation, original: rotation.clone()}));
            this.active = true;
            let index = 0;
            while (index < this.keyframes.length - 2 && this.progress >= this.keyframes[index + 1].time) index += 1;
            const start = this.keyframes[index];
            const end = this.keyframes[index + 1];
            const mix = smoothStep(THREE.MathUtils.clamp((this.progress - start.time) / (end.time - start.time), 0, 1));
            const arc = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(start.angle, end.angle, mix));
            const elevation = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightMaxElevation) ? settings.dayNightMaxElevation : 60, 10, 85));
            const azimuth = this.baseAzimuth + THREE.MathUtils.degToRad(THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightAzimuth) ? settings.dayNightAzimuth : 0, -180, 180));
            const strength = THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightSunStrength) ? settings.dayNightSunStrength : 1, 0, 3);
            const dayBrightness = THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightDayBrightness) ? settings.dayNightDayBrightness : 0.35, 0, 2);
            const nightBrightness = THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightNightBrightness) ? settings.dayNightNightBrightness : 0.12, 0, 1);
            const nightSkyBrightness = THREE.MathUtils.clamp(
                Number.isFinite(settings?.dayNightNightSkyBrightness) ? settings.dayNightNightSkyBrightness : 0.15, 0, 1);

            // Follow a tilted great-circle arc; never tilt the HDRI horizon.
            this.direction.set(
                Math.cos(azimuth) * Math.cos(arc) + Math.sin(azimuth) * Math.cos(elevation) * Math.sin(arc),
                Math.sin(elevation) * Math.sin(arc),
                -Math.sin(azimuth) * Math.cos(arc) + Math.cos(azimuth) * Math.cos(elevation) * Math.sin(arc)
            );
            const horizonFade = THREE.MathUtils.clamp(this.direction.y / 0.08, 0, 1);
            directionalLight.intensity = light.intensity * strength
                * THREE.MathUtils.lerp(start.strength, end.strength, mix) * horizonFade;
            directionalLight.color.copy(start.color).lerp(end.color, mix);
            targetObject.position.copy(this.direction).multiplyScalar(-this.distance).add(this.position);
            targetObject.updateMatrix();
            targetObject.updateWorldMatrix(true, false);
            const yaw = Math.atan2(this.direction.x, this.direction.z) - this.baseAzimuth;
            this.rotations?.forEach(({rotation, original}) => rotation.set(
                original.x, original.y + yaw, original.z, original.order));

            const blend = THREE.MathUtils.lerp(start.blend, end.blend, mix);
            this.tint.copy(start.tint).lerp(end.tint, mix);
            runtime.update({
                blend, tint: this.tint,
                environmentIntensity: THREE.MathUtils.lerp(dayBrightness, nightBrightness, blend)
                    * THREE.MathUtils.lerp(start.brightness, end.brightness, mix),
                backgroundIntensity: THREE.MathUtils.lerp(1, nightSkyBrightness, blend)
                    * THREE.MathUtils.lerp(start.background, end.background, mix)
            });
            fixtureLighting?.setFactor(smoothStep(THREE.MathUtils.clamp((this.progress - 0.62) / 0.38, 0, 1)));
            this.stage = this.progress === 1 ? "Night" : start.name;
        },
        report(directionalLight, runtime, open, callback, delta) {
            const status = {
                ready: Boolean(runtime?.ready), active: this.active, playing: this.playing,
                progress: this.progress * 100, stage: this.stage,
                playbackDirection: this.playbackDirection,
                error: runtime?.error ? String(runtime.error.message ?? runtime.error) : null
            };
            if (directionalLight) directionalLight.userData.housemakerDayNight = status;
            this.elapsed += Number.isFinite(delta) && delta > 0 ? delta : 0;
            const key = `${status.ready}:${status.active}:${status.playing}:${status.playbackDirection}:${status.error}`;
            if (open && typeof callback === "function"
                && (!this.panelOpen || key !== this.statusKey || (this.elapsed >= 0.2
                    && (status.progress !== this.reportedProgress || status.stage !== this.reportedStage)))) {
                this.elapsed = 0;
                this.statusKey = key;
                this.reportedProgress = status.progress;
                this.reportedStage = status.stage;
                callback(status);
            }
            this.panelOpen = open;
        }
    }), [light.id, light.intensity, positionX, positionY, positionZ, targetX, targetY, targetZ,
        environmentScene, targetObject, fixtureLighting]);
    dayNight.authoredColor = lightColor;

    // Restore daylight on reload; never dispose shared GLB resources.
    useLayoutEffect(() => () => {
        if (dayNight.active || dayNight.pending) {
            dayNight.restore(directionalLightRef.current, dayNightEnvironment?.current, null, dayNight.authoredColor);
        }
        dayNight.command = 0;
    }, [dayNight, dayNightEnvironment]);

    // Set manual angles without restarting playback on unrelated rerenders.
    useLayoutEffect(() => {
        if (orbit) orbit.phase = Number.isFinite(sunOrbitAngle)
            ? THREE.MathUtils.degToRad(THREE.MathUtils.euclideanModulo(sunOrbitAngle, 360)) : 0;
    }, [orbit, sunOrbitAngle, sunOrbitAngleRevision]);

    // Draw parallel directional rays using one owned line geometry.
    const sunRays = useMemo(() => {
        if (!showSunRays || !shadowBounds || shadowBounds.isEmpty()) return null;
        const size = shadowBounds.getSize(new THREE.Vector3());
        const span = Math.max(4, size.length());
        const spacing = Math.max(size.x, size.y, size.z, 4) / 4;
        const head = Math.min(0.6, span * 0.015);
        const positions = [];
        for (let row = -2; row <= 2; row += 1) {
            for (let column = -2; column <= 2; column += 1) {
                const x = column * spacing;
                const y = row * spacing;
                positions.push(x, y, -span / 2, x, y, span / 2,
                    x, y, 0, x - head, y, -head * 2,
                    x, y, 0, x + head, y, -head * 2);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({
            color: "#ffdd55", transparent: true, opacity: 0.8,
            depthTest: false, depthWrite: false, toneMapped: false
        });
        const object = new THREE.LineSegments(geometry, material);
        object.name = "HouseMaker sun ray guides";
        object.userData.housemakerSunRays = true;
        object.position.copy(shadowBounds.getCenter(new THREE.Vector3()));
        object.frustumCulled = false;
        object.renderOrder = 1001;
        object.raycast = () => {};
        // Exclude guides from auxiliary normal and depth passes.
        object.onBeforeRender = (renderer, scene) => {
            geometry.setDrawRange(scene.overrideMaterial ? positions.length / 3 + 1 : 0,
                scene.overrideMaterial ? 0 : Infinity);
        };
        object.onAfterRender = () => geometry.setDrawRange(0, Infinity);
        return {
            object, geometry, material,
            forward: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(),
            update(directionalLight) {
                this.direction.copy(directionalLight.target.position).sub(directionalLight.position).normalize();
                object.quaternion.setFromUnitVectors(this.forward, this.direction);
            }
        };
    }, [showSunRays, shadowBounds]);

    // Dispose only guide resources; R3F removes their scene object.
    useEffect(() => () => {
        sunRays?.geometry.dispose();
        sunRays?.material.dispose();
    }, [sunRays]);

    // Refresh the live readout whenever its panel opens.
    useLayoutEffect(() => {
        angleReportRef.current = { elapsed: 0, angle: null };
    }, [showSunRays]);

    // Reuse eight bounds corners across layout and orbit updates.
    const shadowFit = useMemo(() => {
        if (!shadowBounds || shadowBounds.isEmpty()) return null;
        const corners = [];
        [shadowBounds.min.x, shadowBounds.max.x].forEach((x) => {
            [shadowBounds.min.y, shadowBounds.max.y].forEach((y) => {
                [shadowBounds.min.z, shadowBounds.max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z)));
            });
        });
        const bounds = new THREE.Box3();
        const point = new THREE.Vector3();
        const size = new THREE.Vector3();
        const lightMatrix = new THREE.Matrix4();
        const targetMatrix = new THREE.Matrix4();
        return {
            lightMatrix,
            targetMatrix,
            update(directionalLight) {
                if (!directionalLight.shadow) return;
                directionalLight.updateWorldMatrix(true, false);
                directionalLight.target.updateWorldMatrix(true, false);
                const shadow = directionalLight.shadow;
                shadow.updateMatrices(directionalLight);
                const camera = shadow.camera;
                bounds.makeEmpty();
                corners.forEach((corner) => {
                    point.copy(corner);
                    if (directionalLight.parent) point.applyMatrix4(directionalLight.parent.matrixWorld);
                    bounds.expandByPoint(point.applyMatrix4(camera.matrixWorldInverse));
                });
                const sunAngle = Math.tan(THREE.MathUtils.degToRad(softness / 2));
                // Keep coverage fixed across the supported 0–8° softness range.
                const padding = Math.max(0.5, bounds.getSize(size).length() * 0.025,
                    Math.tan(THREE.MathUtils.degToRad(8 / 2)) * size.z * 1.5);
                // Concentrate shadow detail without clipping the fitted depth range.
                const extent = (Math.max(size.x, size.y) + padding * 2) * coverage;
                const texelX = extent / shadow.mapSize.x;
                const texelY = extent / shadow.mapSize.y;
                const centerX = Math.round((bounds.min.x + bounds.max.x) / (2 * texelX)) * texelX;
                const centerY = Math.round((bounds.min.y + bounds.max.y) / (2 * texelY)) * texelY;
                camera.left = centerX - extent / 2 - texelX;
                camera.right = centerX + extent / 2 + texelX;
                camera.bottom = centerY - extent / 2 - texelY;
                camera.top = centerY + extent / 2 + texelY;
                // Signed orthographic depth includes geometry behind authored light positions.
                camera.near = -bounds.max.z - padding;
                camera.far = Math.max(camera.near + 1, -bounds.min.z + padding);
                // Negative radius selects owned materials' directional PCSS shading.
                shadow.radius = -(1 + sunAngle * (camera.far - camera.near) / (camera.right - camera.left));
                camera.updateProjectionMatrix();
                shadow.updateMatrices(directionalLight);
                shadow.needsUpdate = true;
                lightMatrix.copy(directionalLight.matrixWorld);
                targetMatrix.copy(directionalLight.target.matrixWorld);
            }
        };
    }, [shadowBounds, softness, coverage]);

    // Preserve HDRI offsets while this sun owns their animation.
    useLayoutEffect(() => {
        if (!environmentScene || !orbit) return undefined;
        const rotations = [environmentScene.environmentRotation, environmentScene.backgroundRotation].map((rotation) => {
            const original = dayNight.rotations?.find((entry) => entry.rotation === rotation)?.original.clone() ?? rotation.clone();
            return {
                rotation, original,
                sampling: new THREE.Quaternion().setFromEuler(new THREE.Euler(
                    -original.x, -original.y, -original.z, original.order
                ))
            };
        });
        environmentOrbitRef.current = {
            rotations,
            axis: new THREE.Vector3(),
            parentRotation: new THREE.Quaternion(),
            phaseRotation: new THREE.Quaternion(),
            sampling: new THREE.Quaternion(),
            euler: new THREE.Euler(),
            update(directionalLight, phase) {
                this.axis.copy(orbit.axis);
                const parent = directionalLight?.parent;
                if (parent) this.axis.applyQuaternion(parent.getWorldQuaternion(this.parentRotation));
                this.phaseRotation.setFromAxisAngle(this.axis, -phase);
                rotations.forEach(({rotation, original, sampling}) => {
                    this.sampling.copy(sampling).multiply(this.phaseRotation);
                    this.euler.setFromQuaternion(this.sampling, original.order);
                    rotation.set(-this.euler.x, -this.euler.y, -this.euler.z, original.order);
                });
            }
        };
        return () => {
            rotations.forEach(({rotation, original}) => rotation.copy(original));
            environmentOrbitRef.current = null;
        };
    }, [environmentScene, orbit, dayNight]);

    // Resize shadow targets and retain authored lighting transforms.
    useLayoutEffect(() => {
        const shadow = directionalLightRef.current?.shadow;
        if (!shadow) return;
        if (shadow.map && (shadow.map.width !== mapSize || shadow.map.height !== mapSize)) {
            shadow.map.dispose();
            shadow.map = null;
            shadow.mapPass?.dispose();
            shadow.mapPass = null;
        }
        shadow.mapSize.set(mapSize, mapSize);
        shadow.bias = bias;
        shadow.normalBias = normalBias;
        shadow.needsUpdate = true;
    }, [mapSize, bias, normalBias]);

    // Apply the absolute target after both siblings mount.
    useLayoutEffect(() => {
        if (!dayNight.active) {
            targetObject.position.fromArray(light.target);
            if (orbit) {
                targetObject.position.copy(orbit.direction).applyAxisAngle(orbit.axis, orbit.phase)
                    .multiplyScalar(orbit.distance).add(orbit.position);
            }
        }
        targetObject.updateMatrix();
        targetObject.updateWorldMatrix(true, false);

        const directionalLight = directionalLightRef.current;
        if (!directionalLight) return;

        directionalLight.target = targetObject;
        directionalLight.userData = {
            ...(directionalLight.userData ?? {}),
            houseMakerDirectionalLightId: light.id
        };
        directionalLight.updateMatrix?.();

        shadowFit?.update(directionalLight);
        if (!dayNight.active) environmentOrbitRef.current?.update(directionalLight, orbit?.phase ?? 0);
        sunRays?.update(directionalLight);
    }, [light, orbit, shadowFit, mapSize, targetObject, sunOrbitAngle, sunOrbitAngleRevision, sunRays, dayNight]);

    // Consume explicit commands once; ordinary rerenders never restart playback.
    useLayoutEffect(() => {
        const directionalLight = directionalLightRef.current;
        const runtime = dayNightEnvironment?.current;
        if (dayNightManualRef.current.angle !== sunOrbitAngle || dayNightManualRef.current.revision !== sunOrbitAngleRevision) {
            dayNightManualRef.current = {angle: sunOrbitAngle, revision: sunOrbitAngleRevision};
            if (dayNight.active || dayNight.pending) {
                dayNight.restore(directionalLight, runtime, orbit, lightColor);
                environmentOrbitRef.current?.update(directionalLight, orbit?.phase ?? 0);
            }
        }
        const command = dayNightSettings?.dayNightCommand ?? 0;
        if (command !== dayNight.command) {
            dayNight.command = command;
            const action = dayNightSettings?.dayNightAction;
            dayNight.elapsed = Infinity;
            if (action === "reset") {
                dayNight.restore(directionalLight, runtime, orbit, lightColor);
                environmentOrbitRef.current?.update(directionalLight, orbit?.phase ?? 0);
            } else if (action === "pause") {
                dayNight.playing = false;
                if (dayNight.pending) dayNight.pending = "preview";
            } else if (["play", "preview", "resume", "reverse"].includes(action)
                && (action !== "reverse" || ((dayNight.active || dayNight.pending) && dayNight.progress > 0))) {
                // Reverse the existing clock without jumping between lighting states.
                if (action === "play") {
                    if ((!dayNight.active && !dayNight.pending) || dayNight.progress >= 1) dayNight.progress = 0;
                    dayNight.playbackDirection = 1;
                }
                if (action === "reverse") dayNight.playbackDirection = -1;
                if (action === "preview") dayNight.progress = THREE.MathUtils.clamp(
                    Number.isFinite(dayNightSettings?.dayNightProgress) ? dayNightSettings.dayNightProgress / 100 : 0, 0, 1);
                dayNight.playing = action !== "preview"
                    && (dayNight.playbackDirection === 1 ? dayNight.progress < 1 : dayNight.progress > 0);
                dayNight.pending = runtime?.ready ? null : action;
                if (runtime && !runtime.ready && !runtime.error && dayNight.preparingRuntime !== runtime) {
                    dayNight.preparingRuntime = runtime;
                    runtime.prepare();
                }
                if (runtime?.error) dayNight.playing = false;
                if (runtime?.ready) dayNight.apply(directionalLight, dayNightSettings, runtime);
            }
        }
        if (dayNight.active) dayNight.apply(directionalLight, dayNightSettings, runtime);
        if (dayNightSettings) dayNight.report(directionalLight, runtime, dayNightPanelOpen, onDayNightStatusChange, 0);
        shadowFit?.update(directionalLight);
        if (directionalLight) sunRays?.update(directionalLight);
    });

    // Rotate exported ray direction; keep the authored light position fixed.
    useFrame((_, delta) => {
        const directionalLight = directionalLightRef.current;
        const runtime = dayNightEnvironment?.current;
        if (dayNight.pending && runtime && !runtime.ready && !runtime.error && dayNight.preparingRuntime !== runtime) {
            dayNight.preparingRuntime = runtime;
            runtime.prepare();
        }
        if (dayNight.pending && runtime?.error) {
            dayNight.restore(directionalLight, runtime, orbit, lightColor);
            environmentOrbitRef.current?.update(directionalLight, orbit?.phase ?? 0);
        } else if (dayNight.pending && runtime?.ready) {
            dayNight.pending = null;
            dayNight.apply(directionalLight, dayNightSettings, runtime);
        }
        if (dayNight.active) {
            if (dayNight.playing && Number.isFinite(delta) && delta > 0) {
                const duration = THREE.MathUtils.clamp(
                    Number.isFinite(dayNightSettings?.dayNightDuration) ? dayNightSettings.dayNightDuration : 3, 2, 30);
                dayNight.progress = THREE.MathUtils.clamp(
                    dayNight.progress + dayNight.playbackDirection * delta / duration, 0, 1);
                // Snap floating-point endpoints so playback finishes deterministically.
                if (dayNight.progress < 1e-8) dayNight.progress = 0;
                if (dayNight.progress > 1 - 1e-8) dayNight.progress = 1;
                if (dayNight.progress === 0 || dayNight.progress === 1) dayNight.playing = false;
            }
            dayNight.apply(directionalLight, dayNightSettings, runtime);
        } else if (orbit && !dayNight.pending && !sunOrbitPaused && Number.isFinite(delta) && delta > 0) {
            orbit.phase = (orbit.phase + orbit.radiansPerSecond * delta) % (Math.PI * 2);
            targetObject.position.copy(orbit.direction).applyAxisAngle(orbit.axis, orbit.phase)
                .multiplyScalar(orbit.distance).add(orbit.position);
            targetObject.updateMatrix();
            targetObject.updateWorldMatrix(true, false);
        }

        // Follow orbit and loader transforms without traversing scene geometry.
        if (shadowFit && directionalLight?.shadow) {
            directionalLight.updateWorldMatrix(true, false);
            targetObject.updateWorldMatrix(true, false);
            if (!shadowFit.lightMatrix.equals(directionalLight.matrixWorld)
                || !shadowFit.targetMatrix.equals(targetObject.matrixWorld)) shadowFit.update(directionalLight);
        }

        // Rotate HDRI sampling oppositely to physical sun motion.
        if (orbit && !dayNight.active) environmentOrbitRef.current?.update(directionalLight, orbit.phase);

        // Keep debug rays aligned with the actual light target.
        if (directionalLight) sunRays?.update(directionalLight);
        if (dayNightSettings) dayNight.report(directionalLight, runtime, dayNightPanelOpen, onDayNightStatusChange, delta);

        // Update panel readouts without broadcasting every rendered frame.
        if (showSunRays && typeof onSunOrbitAngleChange === "function") {
            const report = angleReportRef.current;
            report.elapsed += Number.isFinite(delta) && delta > 0 ? delta : 0;
            const angle = THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(orbit?.phase ?? 0), 360);
            if (report.angle === null || (angle !== report.angle && (sunOrbitPaused || report.elapsed >= 0.2))) {
                report.elapsed = 0;
                report.angle = angle;
                onSunOrbitAngleChange(angle);
            }
        }
    });

    return (
        <>
            <directionalLight
                ref={directionalLightRef}
                name={light.name}
                position={light.position}
                color={lightColor}
                intensity={light.intensity}
                castShadow={light.castShadow}
                shadow-mapSize={shadowBounds || overrideSize ? [mapSize, mapSize] : undefined}
                shadow-bias={shadowBounds || Number.isFinite(shadowBias) ? bias : undefined}
                shadow-normalBias={shadowBounds || Number.isFinite(shadowNormalBias) ? normalBias : undefined}
                userData={{houseMakerDirectionalLightId: light.id}}
            />
            <primitive object={targetObject} />
            {sunRays && <primitive object={sunRays.object} dispose={null} />}
        </>
    );
}

// Share material downloads, decodes, and resources per renderer.
const houseMakerMaterialPools = new WeakMap();

// Keep streaming work independent from bootstrap loading and Suspense.
export function acquireHouseMakerMaterialPool(renderer, policy, basisPath) {
    const existing = houseMakerMaterialPools.get(renderer);
    if (existing) {
        existing.retain();
        return existing;
    }

    const manager = new THREE.LoadingManager();
    const positiveInteger = (value, fallback) => Number.isFinite(value) && value > 0
        ? Math.max(1, Math.floor(value)) : fallback;
    let decoder;
    let loader;
    let decoderError;
    let decoderStarted = false;
    try {
        decoder = new KTX2Loader(manager);
        decoder.setTranscoderPath(basisPath)
            .setWorkerLimit(positiveInteger(policy.textureCompression?.decoder?.workerLimit, 2))
            .detectSupport(renderer);
        loader = new GLTFLoader(manager).setKTX2Loader(decoder);
    } catch (error) {
        decoderError = error;
    }
    const entries = new Map();
    const byteCache = new Map();
    const inFlightBytes = new Map();
    const materialReferences = new Map();
    const textureReferences = new Map();
    const byteBudget = Math.max(1, Math.min(
        positiveInteger(policy.cache?.desktopGpuBudgetMiB, 512),
        positiveInteger(policy.cache?.mobileGpuBudgetMiB, 128)
    )) * 1024 * 1024;
    const maxDownloads = positiveInteger(policy.scheduler?.maxConcurrentDownloads, 4);
    const maxDecodes = positiveInteger(policy.scheduler?.maxConcurrentDecodes, 2);
    const maxAttempts = positiveInteger(policy.failurePolicy?.maxAttempts, 3);
    let owners = 0;
    let releaseTimer;
    let closed = false;
    let persistentAvailable = policy.cache?.persistent === "cache-storage-if-available" && typeof caches !== "undefined";
    const decoderReady = Promise.resolve().then(() => {
        if (decoderError) return;
        const ready = decoder.init();
        decoderStarted = true;
        return ready;
    }).catch((error) => {
        decoderError = error;
    });

    // Trust cached bytes only after checking their exported hash.
    const verifyBytes = async (bytes, descriptor) => {
        if (!/^[a-f\d]{64}$/i.test(descriptor.sha256 ?? "") || !window.crypto?.subtle) {
            throw new Error("Material SHA-256 verification is unavailable.");
        }
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        const actual = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
        if (actual !== descriptor.sha256.toLowerCase()) throw new Error("Material SHA-256 mismatch.");
        if (Number.isFinite(descriptor.byteSize) && bytes.byteLength !== descriptor.byteSize) {
            throw new Error("Material byte size does not match the manifest.");
        }
    };

    // Bound retained compressed bytes independently from decoded GPU assets.
    const rememberBytes = (sha256, bytes) => {
        byteCache.delete(sha256);
        if (bytes.byteLength <= byteBudget) byteCache.set(sha256, bytes);
        let total = Array.from(byteCache.values()).reduce((sum, value) => sum + value.byteLength, 0);
        for (const [key, value] of byteCache) {
            if (total <= byteBudget) break;
            byteCache.delete(key);
            total -= value.byteLength;
        }
    };

    // Retry individual packs while retaining their embedded fallback materials.
    const failEntry = (entry, error) => {
        if (closed || entry.removed) return;
        entry.bytes = null;
        entry.error = error;
        if (entry.attempts >= maxAttempts || decoderError) {
            entry.state = "error";
            return;
        }
        const backoff = policy.failurePolicy?.retryBackoffMilliseconds ?? [1000, 3000];
        entry.readyAt = Date.now() + (backoff[Math.min(entry.attempts - 1, backoff.length - 1)] ?? 1000);
        entry.state = "queued";
    };

    const pool = {
        entries,
        activeDownloads: 0,
        activeDecodes: 0,
        bytesDownloaded: 0,
        cacheHits: 0,
        get decoderError() { return decoderError; },
        retain() {
            clearTimeout(releaseTimer);
            owners += 1;
        },
        release(owner) {
            if (owner !== undefined) entries.forEach((entry) => entry.owners.delete(owner));
            owners = Math.max(0, owners - 1);
            if (owners || closed) return;
            releaseTimer = setTimeout(() => {
                if (owners || closed) return;
                closed = true;
                entries.forEach((entry) => {
                    entry.owners.clear();
                    pool.disposeEntry(entry);
                });
                byteCache.clear();
                houseMakerMaterialPools.delete(renderer);
                decoderReady.then(() => { if (decoderStarted) decoder.dispose(); });
            }, 0);
        },
        request(key, descriptor, url, owner) {
            let entry = entries.get(key);
            if (!entry) {
                entry = {
                    key, descriptor, url, state: "queued", priority: Infinity,
                    material: null, textures: [], gpuBytes: 0, error: null, carrierHasTangents: false,
                    attempts: 0, lastUsed: Date.now(), owners: new Set(),
                    readyAt: 0, bytes: null, removed: false, controller: null
                };
                entries.set(key, entry);
            }
            if (owner !== undefined) entry.owners.add(owner);
            entry.lastUsed = Date.now();
            return entry;
        },
        disposeEntry(entry) {
            if (entry.owners.size) return false;
            entry.removed = true;
            entry.controller?.abort();
            entry.bytes = null;
            if (entries.get(entry.key) === entry) entries.delete(entry.key);
            if (entry.material) {
                const references = (materialReferences.get(entry.material) ?? 1) - 1;
                if (references > 0) materialReferences.set(entry.material, references);
                else {
                    materialReferences.delete(entry.material);
                    entry.material.dispose();
                }
                entry.textures.forEach((texture) => {
                    const references = (textureReferences.get(texture) ?? 1) - 1;
                    if (references > 0) textureReferences.set(texture, references);
                    else {
                        textureReferences.delete(texture);
                        texture.dispose();
                    }
                });
                entry.material = null;
                entry.textures = [];
                entry.gpuBytes = 0;
            }
            return true;
        },
        pump() {
            if (closed) return;
            const pending = Array.from(entries.values())
                .filter((entry) => entry.owners.size && Number.isFinite(entry.priority))
                .sort((first, second) => first.priority - second.priority);
            let retainedBytes = Array.from(entries.values()).reduce((sum, entry) => sum
                + (entry.bytes?.byteLength ?? (entry.state === "downloading" ? entry.descriptor.byteSize ?? 1024 * 1024 : 0)), 0);
            pending.forEach((entry) => {
                if (decoderError && ["queued", "downloaded"].includes(entry.state)) {
                    entry.error = decoderError;
                    entry.state = "error";
                    entry.bytes = null;
                    return;
                }
                if (entry.state === "downloaded" && pool.activeDecodes < maxDecodes) {
                    pool.activeDecodes += 1;
                    entry.state = "decoding";
                    const bytes = entry.bytes;
                    Promise.resolve().then(async () => {
                        await decoderReady;
                        if (decoderError) throw decoderError;
                        if (closed || entry.removed) return;
                        const gltf = await loader.parseAsync(bytes, new URL(".", new URL(entry.url, document.baseURI)).href);
                        const index = entry.descriptor.materialIndex ?? 0;
                        let material = await gltf.parser?.getDependency?.("material", index);
                        const geometries = new Set();
                        const carrierMaterials = new Set();
                        (gltf.scenes ?? [gltf.scene]).forEach((scene) => scene?.traverse((node) => {
                            if (node.geometry) geometries.add(node.geometry);
                            (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((candidate) => {
                                carrierMaterials.add(candidate);
                                if (gltf.parser?.associations?.get(candidate)?.materials === index
                                    || candidate === material || (!material && index === 0)) {
                                    material = candidate;
                                    entry.carrierHasTangents = Boolean(node.geometry?.attributes?.tangent);
                                }
                            });
                        }));
                        geometries.forEach((geometry) => geometry.dispose());
                        if (!material?.isMaterial) throw new Error("Material pack has no matching material.");
                        carrierMaterials.forEach((candidate) => { if (candidate !== material) candidate.dispose(); });
                        entry.material = material;
                        material.userData.housemaker_material_id = entry.descriptor.materialId;
                        entry.textures = Array.from(new Set(Object.values(material).filter((value) => value?.isTexture)));
                        materialReferences.set(material, (materialReferences.get(material) ?? 0) + 1);
                        entry.textures.forEach((texture) => {
                            textureReferences.set(texture, (textureReferences.get(texture) ?? 0) + 1);
                            const images = Array.isArray(texture.image) ? texture.image : [texture.image];
                            const mipBytes = texture.mipmaps?.reduce((sum, mip) => sum + (mip.data?.byteLength ?? 0), 0) ?? 0;
                            const imageBytes = images.reduce((sum, image) => sum + (image?.data?.byteLength
                                ?? (image?.width ?? 0) * (image?.height ?? 0) * 4), 0);
                            entry.gpuBytes += texture.isCompressedTexture && mipBytes
                                ? mipBytes : Math.ceil(imageBytes * (texture.generateMipmaps ? 4 / 3 : 1));
                        });
                        entry.bytes = null;
                        if (closed || entry.removed) {
                            entry.owners.clear();
                            pool.disposeEntry(entry);
                        } else {
                            entry.state = "decoded";
                            entry.error = null;
                        }
                    }).catch((error) => failEntry(entry, error)).finally(() => {
                        pool.activeDecodes -= 1;
                    });
                }
                if (entry.state !== "queued" || entry.readyAt > Date.now() || pool.activeDownloads >= maxDownloads) return;
                if (retainedBytes >= byteBudget && pool.activeDownloads > 0) return;
                const reservedBytes = Number.isFinite(entry.descriptor.byteSize) ? entry.descriptor.byteSize : 1024 * 1024;
                if (retainedBytes > 0 && retainedBytes + reservedBytes > byteBudget) return;
                retainedBytes += reservedBytes;
                pool.activeDownloads += 1;
                entry.state = "downloading";
                entry.attempts += 1;
                entry.controller = new AbortController();
                Promise.resolve().then(async () => {
                    const sha256 = entry.descriptor.sha256;
                    if (closed || entry.removed) return;
                    let transfer = inFlightBytes.get(sha256);
                    if (!transfer) {
                        transfer = { controller: entry.controller, consumers: new Set() };
                        inFlightBytes.set(sha256, transfer);
                        transfer.promise = Promise.resolve().then(async () => {
                            const cacheUrl = new URL(`__housemaker_materials__/${sha256}.glb`, document.baseURI).href;
                            let persistentCache;
                            let bytes = byteCache.get(sha256);
                            if (persistentAvailable) {
                                try {
                                    persistentCache = await caches.open("housemaker-materials-v1");
                                    if (!bytes) bytes = await (await persistentCache.match(cacheUrl))?.arrayBuffer();
                                } catch {
                                    persistentAvailable = false;
                                }
                            }
                            if (bytes) {
                                try {
                                    await verifyBytes(bytes, { sha256 });
                                    pool.cacheHits += 1;
                                } catch {
                                    bytes = null;
                                    byteCache.delete(sha256);
                                    await persistentCache?.delete(cacheUrl).catch(() => {});
                                }
                            }
                            if (!bytes) {
                                if (closed) return;
                                const response = await fetch(entry.url, { signal: transfer.controller.signal });
                                if (!response.ok) throw new Error(`Material download failed (${response.status}).`);
                                bytes = await response.arrayBuffer();
                                pool.bytesDownloaded += bytes.byteLength;
                                await verifyBytes(bytes, { sha256 });
                                if (persistentCache && persistentAvailable) {
                                    try {
                                        await persistentCache.put(cacheUrl, new Response(bytes));
                                    } catch {
                                        persistentAvailable = false;
                                    }
                                }
                            }
                            if (!closed) rememberBytes(sha256, bytes);
                            return bytes;
                        });
                        transfer.promise.finally(() => {
                            if (inFlightBytes.get(sha256) === transfer) inFlightBytes.delete(sha256);
                        }).catch(() => {});
                    }
                    transfer.consumers.add(entry);
                    entry.controller = { abort() {
                        transfer.consumers.delete(entry);
                        if (!transfer.consumers.size) transfer.controller.abort();
                    } };
                    const bytes = await transfer.promise;
                    if (closed || entry.removed) return;
                    await verifyBytes(bytes, entry.descriptor);
                    entry.bytes = bytes;
                    entry.state = "downloaded";
                }).catch((error) => failEntry(entry, error)).finally(() => {
                    entry.controller = null;
                    pool.activeDownloads -= 1;
                });
            });
        }
    };
    houseMakerMaterialPools.set(renderer, pool);
    pool.retain();
    return pool;
}

// ### Component ###

/**
 * Purpose: Loads a HouseMaker export with mirrored models and instances.
 * Relationships: Replaces SimpleLoader and JsonInstancing for HouseMaker exports in SceneContainer.
 * Example:
 * <HouseMakerLoader jsonFile="housemaker_export.json" position={[0, 0, 0]} instancesEnabled={true} />
 * @param {string} [jsonFile] - HouseMaker JSON filename inside the models folder.
 * @param {Array<number>} [position] - Position shared by models and instances.
 * @param {boolean} [instancesEnabled] - Whether exported instances are rendered.
 * @param {boolean} [toursEnabled] - Whether exported runtime tours can activate.
 * @param {React.MutableRefObject<any>} [navigationRef] - Existing player navigation bridge.
 * @param {boolean} [shadowsEnabled] - Enable shadows on runtime PBR meshes.
 * @param {boolean} [fallbackSunEnabled] - Add sunlight when exported lights are absent.
 * @param {number} [shadowMapSize] - Generated sunlight shadow-map resolution.
 * @param {number} [shadowMapSizeOverride] - Optional resolution override for every sunlight.
 * @param {number} [shadowBias] - Optional shadow depth bias override.
 * @param {number} [shadowNormalBias] - Optional shadow normal bias override.
 * @param {number} [shadowSoftness] - Apparent sun diameter, in degrees.
 * @param {number} [shadowCoverage] - Percentage of automatic sun shadow coverage.
 * @param {boolean} [showBakedPvs] - Show baked visibility cells for debugging.
 * @param {number} [pvsDebugOpacity] - Baked visibility debug-line opacity.
 * @param {boolean} [anisotropicFilteringEnabled] - Sharpen model textures at grazing angles.
 * @param {number} [anisotropy] - Requested filtering level, clamped to hardware support.
 * @param {string} [hideObjectsKey] - Keyboard shortcut for object visibility.
 * @param {boolean} [objectControlsEnabled] - Accept visibility controls after the tutorial.
 * @param {boolean} [materialStreamingOffscreen] - Warm shaders for an offscreen composer.
 * @param {THREE.Scene} [environmentScene] - HDRI scene following the exported sun.
 * @param {string} [sunLightColor] - Optional primary sun color override.
 * @param {boolean} [sunOrbitPaused] - Hold the current sun angle.
 * @param {number} [sunOrbitAngle] - Degrees relative to the exported direction.
 * @param {number} [sunOrbitAngleRevision] - Repeat manual-angle commands explicitly.
 * @param {boolean} [showSunRays] - Show incoming sunlight direction guides.
 * @param {function} [onSunOrbitAngleChange] - Report the displayed orbit angle.
 */
export function HouseMakerLoader(props) {
    const {jsonFile = "housemaker_export.json"} = props;
    const {position = [0, 0, 0]} = props;
    const {instancesEnabled = true} = props;
    const {toursEnabled = true} = props;
    const {navigationRef} = props;
    const {shadowsEnabled = false, fallbackSunEnabled = false, shadowMapSize = 1024} = props;
    const {shadowBias, shadowNormalBias, shadowMapSizeOverride} = props;
    const {shadowSoftness = 2, shadowCoverage = 100} = props;
    const {showBakedPvs = false, pvsDebugOpacity = 0.65} = props;
    const {anisotropicFilteringEnabled = false, anisotropy = 8} = props;
    const {hideObjectsKey = "a", objectControlsEnabled = true} = props;
    const {materialStreamingOffscreen = false} = props;
    const {environmentScene} = props;
    const {sunLightColor} = props;
    const {sunOrbitPaused = false, sunOrbitAngle, showSunRays = false, onSunOrbitAngleChange} = props;
    const {sunOrbitAngleRevision = 0} = props;
    const {dayNightSettings, dayNightEnvironment, dayNightPanelOpen = false, onDayNightStatusChange} = props;
    const renderer = useThree((state) => state.gl);
    const rootRef = useRef();
    const visibilityRef = useRef({ housemakerObjectsHidden: false });
    const instanceMeshesRef = useRef(new Map());
    const objectFadeRef = useRef({ progress: 1, cursor: 0, remaining: 0, records: [] });
    const pvsRef = useRef(null);
    const pvsDebugRef = useRef(null);
    const pvsHashRef = useRef({ bytes: null, promise: null });
    const materialStreamingRef = useRef(null);
    const shadowDefaultsRef = useRef(new Map());
    // Share one nighttime factor across lights and live materials.
    const fixtureLighting = useMemo(() => ({
        factor: 0, lights: new Set(), materials: [],
        setFactor(value) {
            const previous = this.factor;
            this.factor = value < 1e-8 ? 0 : value > 1 - 1e-8 ? 1 : THREE.MathUtils.clamp(value, 0, 1);
            visibilityRef.current.housemakerNightFactor = this.factor;
            this.lights.forEach(({object, intensity, nightOnly}) => {
                object.intensity = intensity * (nightOnly ? this.factor : 1);
            });
            this.materials.forEach(({mesh, index, metadata}) => {
                const material = Array.isArray(mesh.material) ? mesh.material[index] : mesh.material;
                applyHouseMakerFaceLighting(material, metadata, this.factor);
            });
            if (this.factor !== previous) objectFadeRef.current.records.forEach((record) => {
                if (record.keepWhenLit) applyHouseMakerObjectFade(record, smoothStep(objectFadeRef.current.progress), this.factor);
            });
        }
    }), []);
    const anisotropicFilteringRef = useRef(anisotropicFilteringEnabled);
    anisotropicFilteringRef.current = anisotropicFilteringEnabled;
    const anisotropyRef = useRef(anisotropy);
    anisotropyRef.current = Number.isFinite(anisotropy) ? anisotropy : 8;

    // Load export metadata before its referenced model.
    const manifestUrl = config.models_path + jsonFile;
    const sceneData = useLoader(
        THREE.FileLoader,
        manifestUrl,
        (loader) => loader.setResponseType("json")
    );
    const modelFile = sceneData.asset?.glb ?? "housemaker_export.glb";
    const gltf = useLoader(GLTFLoader, config.models_path + modelFile);

    // Validate optional runtime lights from the loaded manifest.
    const directionalLights = useMemo(() => validateDirectionalLights(
        sceneData.directionalLights,
        process.env.NODE_ENV === "production"
            ? () => {}
            : (message) => console.warn(message)
    ), [sceneData.directionalLights]);
    const objectLights = useMemo(() => validateObjectLights(sceneData.objectLights,
        process.env.NODE_ENV === "production" ? () => {} : (message) => console.warn(message)), [sceneData.objectLights]);

    // Target the selected sun without tinting unrelated directional lights.
    const sunLightId = directionalLights.find((light) => light.id === sceneData.sunlightOrbit?.lightId)?.id
        ?? directionalLights[0]?.id ?? "housemaker-runtime-sun";

    // Invalid orbit metadata leaves otherwise valid lights static.
    const sunlightOrbit = useMemo(() => {
        const orbit = sceneData.sunlightOrbit;
        if (orbit == null || orbit.enabled === false) return undefined;

        const axis = normalizeFiniteVector3(orbit.axis);
        const initialDirection = normalizeFiniteVector3(orbit.initialDirection);
        const light = directionalLights.find((entry) => entry.id === orbit.lightId);
        let invalidReason;
        if (typeof orbit !== "object" || Array.isArray(orbit) || orbit.enabled !== true) {
            invalidReason = "enabled must be a boolean";
        } else if (!isNonEmptyString(orbit.lightId) || !light) {
            invalidReason = "lightId must match an exported directional light";
        } else if (!Number.isFinite(orbit.speedDegreesPerSecond)
            || orbit.speedDegreesPerSecond < 0 || orbit.speedDegreesPerSecond > 360) {
            invalidReason = "speedDegreesPerSecond must be between 0 and 360";
        } else if (!axis || !initialDirection) {
            invalidReason = "axis and initialDirection must be finite, nonzero three-number vectors";
        } else if (!Number.isFinite(Math.hypot(
            ...light.target.map((value, index) => value - light.position[index])
        ))) {
            invalidReason = "light endpoints must have a finite distance";
        }

        if (invalidReason) {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`HouseMaker sunlightOrbit ignored: ${invalidReason}; keeping static lighting.`);
            }
            return undefined;
        }
        return { ...orbit, axis, initialDirection };
    }, [sceneData.sunlightOrbit, directionalLights]);

    // Build mirrored models and reusable instance geometry.
    const renderData = useMemo(() => {
        const lightOwners = new Set(objectLights.flatMap((light) => [light.objectId, light.instanceId]).filter(Boolean));
        // Resolve primitive metadata before cloning cached scene objects.
        const faceLighting = new Map();
        const warn = (message) => { if (process.env.NODE_ENV !== "production") console.warn(message); };
        const declarations = Array.isArray(sceneData.faceLighting) ? sceneData.faceLighting : [];
        const validFaces = new Map();
        const readFace = (entry) => {
            if (!entry || typeof entry !== "object" || !isFiniteVector3(entry.emissiveLinearRgb)
                || entry.emissiveLinearRgb.some((value) => value < 0)
                || (entry.nightOnly !== undefined && typeof entry.nightOnly !== "boolean")
                || (entry.lightPassthrough !== undefined && typeof entry.lightPassthrough !== "boolean")) return null;
            return {...entry, emissiveLinearRgb: [...entry.emissiveLinearRgb], nightOnly: entry.nightOnly === true};
        };
        declarations.forEach((entry, index) => {
            const metadata = readFace(entry);
            if (!metadata || !Number.isInteger(entry.meshIndex) || entry.meshIndex < 0
                || !Number.isInteger(entry.primitiveIndex) || entry.primitiveIndex < 0) {
                warn(`HouseMaker faceLighting ${index} is invalid; skipping this primitive.`);
                return;
            }
            const key = `${entry.meshIndex}:${entry.primitiveIndex}`;
            if (validFaces.has(key)) warn(`HouseMaker faceLighting ${index} duplicates primitive ${key}; keeping the first.`);
            else validFaces.set(key, metadata);
        });
        (gltf.scenes ?? [gltf.scene]).forEach((scene) => scene.traverse((mesh) => {
            if (!mesh.isMesh) return;
            const association = gltf.parser?.associations?.get(mesh);
            const declared = validFaces.get(`${association?.meshes}:${association?.primitives}`);
            const primitive = gltf.parser?.json?.meshes?.[association?.meshes]?.primitives?.[association?.primitives];
            const embedded = primitive ? primitive.extras?.housemakerFaceLighting
                : mesh.geometry.userData?.housemakerFaceLighting ?? mesh.userData?.housemakerFaceLighting;
            const metadata = declared ?? readFace(embedded);
            if (embedded && !metadata) warn(`HouseMaker invalid embedded face lighting on "${mesh.name}"; keeping its material.`);
            if (metadata) faceLighting.set(mesh, metadata);
        }));
        const preparedModel = prepareHouseMakerModelScene(
            gltf.scene,
            sceneData.doorBodyReconstructions,
            warn,
            faceLighting
        );
        const { modelScene, mirroredModels, runtimeMirrors } = preparedModel;
        const faceMaterials = new Map();
        // Isolate emissive primitives without changing geometry or shared materials.
        const prepareFaceMaterial = (material, metadata) => {
            if (!metadata || !material?.emissive?.isColor) return material;
            let variants = faceMaterials.get(material);
            if (!variants) { variants = new Map(); faceMaterials.set(material, variants); }
            const key = `${metadata.emissiveLinearRgb.join(",")}:${metadata.nightOnly}:${metadata.lightPassthrough === true}`;
            if (variants.has(key)) return variants.get(key);
            const copy = material.clone();
            copy.onBeforeCompile = material.onBeforeCompile;
            copy.customProgramCacheKey = material.customProgramCacheKey;
            copy.userData.housemakerFaceLighting = metadata;
            applyHouseMakerFaceLighting(copy, metadata, fixtureLighting.factor);
            variants.set(key, copy);
            return copy;
        };
        [modelScene, mirroredModels].forEach((root) => root.traverse((mesh) => {
            if (!mesh.isMesh) return;
            let owner = mesh;
            while (owner) {
                if (lightOwners.has(owner.userData.housemaker_object_id)) {
                    mesh.userData.housemakerKeepWhenLit = true;
                    break;
                }
                owner = owner.parent;
            }
            const metadata = mesh.userData.housemakerFaceLighting;
            if (!metadata) return;
            mesh.userData.housemakerFaceLighting = metadata;
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map((material) => prepareFaceMaterial(material, metadata))
                : prepareFaceMaterial(mesh.material, metadata);
        }));
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
                    const metadata = faceLighting.get(sourceMesh);
                    const sourceTransform = sourceNode.matrixWorld
                        .clone()
                        .invert()
                        .multiply(sourceMesh.matrixWorld);
                    let geometry = sourceMesh.geometry;
                    let ownsGeometry = false;

                    if (instanceGroup.halfMesh) {
                        let halfSource = sourceMesh;
                        while (!halfSource.userData.halfMesh && halfSource !== sourceNode && halfSource.parent) halfSource = halfSource.parent;
                        const reflectionMatrix = getHalfMeshReflectionMatrix(
                            halfSource,
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

                    // Bind placements directly, including after R3F mesh reconstruction.
                    const instanceMatrices = new THREE.InstancedBufferAttribute(
                        new Float32Array(instances.length * 16),
                        16
                    ).setUsage(THREE.StaticDrawUsage);
                    const instanceMatrix = new THREE.Matrix4();
                    instances.forEach((instance, instanceIndex) => {
                        instanceMatrix.fromArray(instance.worldMatrix).multiply(sourceTransform);
                        instanceMatrix.toArray(instanceMatrices.array, instanceIndex * 16);
                    });

                    instanceParts.push({
                        key: `${groupIndex}-${sourceNodeName}-${sourceMeshIndex}`,
                        name: `HouseMaker instances ${sourceNodeName} part ${sourceMeshIndex + 1}`,
                        geometry,
                        material: Array.isArray(sourceMesh.material)
                            ? sourceMesh.material.map((material) => prepareFaceMaterial(material, metadata))
                            : prepareFaceMaterial(sourceMesh.material, metadata),
                        faceLighting: metadata,
                        keepWhenLit: instances.length > 0 && instances.every((instance) => lightOwners.has(instance.id)),
                        instances,
                        instanceMatrices,
                        sourceTransform,
                        castShadow: sourceMesh.castShadow,
                        receiveShadow: sourceMesh.receiveShadow,
                        hideable: isHouseMakerHideableObject(sourceMesh, true),
                        ownsGeometry
                    });
                });
            });
        });

        // Separate mixed placements only when their nighttime visibility differs.
        instanceParts.filter((part) => part.instances.some((instance) => lightOwners.has(instance.id))
            && !part.keepWhenLit).forEach((part) => {
            const batches = [true, false].map((keepWhenLit) => {
                const indices = part.instances.map((instance, index) => ({instance, index}))
                    .filter(({instance}) => lightOwners.has(instance.id) === keepWhenLit);
                const matrices = new Float32Array(indices.length * 16);
                indices.forEach(({index}, slot) => matrices.set(part.instanceMatrices.array.subarray(index * 16, index * 16 + 16), slot * 16));
                return {...part, key: `${part.key}:${keepWhenLit ? "lit" : "unlit"}`,
                    instances: indices.map(({instance}) => instance), keepWhenLit,
                    ownsGeometry: part.ownsGeometry && keepWhenLit,
                    instanceMatrices: new THREE.InstancedBufferAttribute(matrices, 16).setUsage(THREE.StaticDrawUsage)};
            });
            instanceParts.splice(instanceParts.indexOf(part), 1, ...batches);
        });

        // Use deterministic samples without screen-space noise or derivatives.
        const shadowDisk = Array.from({ length: 24 }, (_, index) => {
            const angle = index * Math.PI * (3 - Math.sqrt(5));
            const radius = Math.sqrt((index + 0.5) / 24);
            return `vec2(${(Math.cos(angle) * radius).toFixed(8)}, ${(Math.sin(angle) * radius).toFixed(8)})`;
        }).join(",\n");
        const sunShadowFunctions = `
            const vec2 houseMakerShadowDisk[24] = vec2[24](${shadowDisk});

            float houseMakerSunShadow(sampler2D shadowMap, vec2 mapSize, vec3 coord, float angularScale) {
                vec2 border = 0.5 / mapSize;
                float visibility = 1.0;
                if (angularScale <= 0.0) {
                    visibility = step(coord.z, unpackRGBAToDepth(textureLod(shadowMap, coord.xy, 0.0)));
                } else {
                    float blockerDepth = 0.0;
                    float blockers = 0.0;
                    float searchRadius = min(0.25, max(border.x, coord.z * angularScale));
                    for (int i = 0; i < 16; i++) {
                        vec2 uv = clamp(coord.xy + houseMakerShadowDisk[i] * searchRadius, border, 1.0 - border);
                        float depth = unpackRGBAToDepth(textureLod(shadowMap, uv, 0.0));
                        if (depth < coord.z) {
                            blockerDepth += depth;
                            blockers += 1.0;
                        }
                    }
                    if (blockers > 0.0) {
                        // Orthographic depth differences remain valid with signed near planes.
                        float radius = min(0.25, max(0.0, coord.z - blockerDepth / blockers) * angularScale);
                        float shadow = 0.0;
                        for (int i = 0; i < 24; i++) {
                            vec2 uv = clamp(coord.xy + houseMakerShadowDisk[i] * radius, border, 1.0 - border);
                            shadow += step(coord.z, unpackRGBAToDepth(textureLod(shadowMap, uv, 0.0)));
                        }
                        visibility = shadow / 24.0;
                    }
                }
                return visibility;
            }
        `;
        const sunShadowChunk = THREE.ShaderChunk.shadowmap_pars_fragment
            .replace("float getShadow(", `${sunShadowFunctions}\nfloat getShadow(`)
            .replace("#if defined( SHADOWMAP_TYPE_PCF )", `#if defined( SHADOWMAP_TYPE_PCF )
                if (shadowRadius < 0.0) {
                    shadow = houseMakerSunShadow(shadowMap, shadowMapSize, shadowCoord.xyz, -shadowRadius - 1.0);
                } else {
            `)
            .replace("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )", "}\n#elif defined( SHADOWMAP_TYPE_PCF_SOFT )");

        // Share owned shader variants across meshes, mirrors, and instances.
        const shadowMaterials = new Map();
        const prepareShadowMaterial = (material) => {
            if (!material?.isMeshStandardMaterial) return material;
            if (shadowMaterials.has(material)) return shadowMaterials.get(material);
            const copy = material.clone();
            copy.onBeforeCompile = function(shader, renderer) {
                material.onBeforeCompile.call(this, shader, renderer);
                shader.fragmentShader = shader.fragmentShader.replace(
                    "#include <shadowmap_pars_fragment>", sunShadowChunk
                );
            };
            copy.customProgramCacheKey = function() {
                return `${material.customProgramCacheKey.call(this)}:housemaker-sun-pcss-v2`;
            };
            shadowMaterials.set(material, copy);
            return copy;
        };
        [modelScene, mirroredModels].forEach((root) => root.traverse((mesh) => {
            if (!mesh.isMesh) return;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(prepareShadowMaterial) : prepareShadowMaterial(mesh.material);
        }));
        instanceParts.forEach((part) => {
            part.material = Array.isArray(part.material)
                ? part.material.map(prepareShadowMaterial) : prepareShadowMaterial(part.material);
        });

        const modelBounds = new THREE.Box3().setFromObject(modelScene).expandByObject(mirroredModels);
        return { modelScene, mirroredModels, runtimeMirrors, instanceParts, modelBounds, shadowMaterials, faceMaterials };
    }, [gltf, sceneData, fixtureLighting, objectLights]);

    // Add a sun only when the export supplies no lighting.
    const runtimeLighting = useMemo(() => {
        const bounds = renderData.modelBounds.clone();
        if (instancesEnabled) {
            renderData.instanceParts.forEach((part) => {
                const geometryBounds = part.geometry.boundingBox?.clone()
                    ?? new THREE.Box3().setFromBufferAttribute(part.geometry.getAttribute("position"));
                part.instances.forEach((instance) => {
                    const matrix = new THREE.Matrix4().fromArray(instance.worldMatrix).multiply(part.sourceTransform);
                    bounds.union(geometryBounds.clone().applyMatrix4(matrix));
                });
            });
        }
        if (!fallbackSunEnabled || directionalLights.length > 0 || bounds.isEmpty()) {
            return { lights: directionalLights, bounds };
        }

        const target = bounds.getCenter(new THREE.Vector3());
        const distance = Math.max(10, bounds.getSize(new THREE.Vector3()).length() * 1.5);
        const position = new THREE.Vector3(0.553, 0.743, 0.377).normalize()
            .multiplyScalar(distance).add(target);
        return {
            bounds,
            lights: [{
                id: "housemaker-runtime-sun",
                name: "HouseMaker sunlight",
                position: position.toArray(),
                target: target.toArray(),
                color: "#fff4e5",
                intensity: 3,
                castShadow: shadowsEnabled
            }]
        };
    }, [directionalLights, fallbackSunEnabled, instancesEnabled, renderData, shadowsEnabled]);

    // Change only owned runtime mesh flags, never cached exports.
    useLayoutEffect(() => {
        if (!shadowsEnabled) return;
        const records = [];
        const roots = [renderData.modelScene, renderData.mirroredModels, ...instanceMeshesRef.current.values()];
        roots.forEach((root) => root.traverse((mesh) => {
            if (!mesh.isMesh) return;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            if (!materials.some((material) => material?.isMeshStandardMaterial)) return;
            records.push({ mesh, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow });
            shadowDefaultsRef.current.set(mesh, mesh.castShadow);
            mesh.castShadow = mesh.userData.housemakerFaceLighting?.lightPassthrough === true ? false
                : mesh.castShadow || materials.every((material) => !material.transparent || material.opacity >= 1);
            mesh.receiveShadow = true;
        }));
        const defaults = shadowDefaultsRef.current;
        return () => records.forEach(({ mesh, castShadow, receiveShadow }) => {
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            defaults.delete(mesh);
        });
    }, [instancesEnabled, renderData, shadowsEnabled]);

    // Prepare owned fade materials before the first rendered frame.
    useLayoutEffect(() => {
        const fade = objectFadeRef.current;
        const materials = new Map();
        const retainedMaterials = new Map();
        const records = [];
        const visited = new Set();
        const roots = [
            renderData.modelScene,
            ...renderData.runtimeMirrors,
            ...instanceMeshesRef.current.values()
        ];

        roots.forEach((root) => root.traverse((mesh) => {
            if (!mesh.isMesh || visited.has(mesh)) return;
            visited.add(mesh);
            let ancestor = mesh;
            while (ancestor) {
                if (!ancestor.visible) return;
                ancestor = ancestor.parent;
            }

            const atlasSources = mesh.userData.housemaker_atlas_source_ids;
            if (process.env.NODE_ENV !== "production"
                && !["object", "surface"].includes(mesh.userData.housemaker_atlas_type)
                && Array.isArray(atlasSources)
                && atlasSources.some((id) => typeof id === "string" && id.startsWith("surface-"))
                && atlasSources.some((id) => typeof id === "string" && !id.startsWith("surface-"))) {
                console.warn("HouseMaker: keeping a mixed surface/object atlas visible; export separate meshes to hide its objects.");
            }
            if (!isHouseMakerHideableObject(mesh)) return;

            const originalMaterial = mesh.material;
            const keepWhenLit = mesh.userData.housemakerKeepWhenLit === true;
            const materialVariants = keepWhenLit ? retainedMaterials : materials;
            const fadeMaterials = (Array.isArray(originalMaterial)
                ? originalMaterial
                : [originalMaterial]).map((material) => {
                if (!materialVariants.has(material)) {
                    const copy = material.clone();
                    copy.onBeforeCompile = material.onBeforeCompile;
                    copy.customProgramCacheKey = material.customProgramCacheKey;
                    // Keep shader variants stable throughout visibility transitions.
                    copy.alphaHash = material.alphaHash || !material.transparent;
                    materialVariants.set(material, {
                        material: copy,
                        sourceMaterial: material,
                        keepWhenLit,
                        opacity: material.opacity,
                        alphaTest: material.alphaTest
                    });
                }
                return materialVariants.get(material);
            });

            // Fade shadow coverage alongside each object's visible material.
            const originalDepthMaterial = mesh.customDepthMaterial;
            const originalDistanceMaterial = mesh.customDistanceMaterial;
            const originalBeforeShadow = mesh.onBeforeShadow;
            let depthMaterial;
            let distanceMaterial;
            let shadowOpacity;
            if (shadowsEnabled) {
                depthMaterial = originalDepthMaterial?.clone()
                    ?? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
                if (objectLights.some((light) => light.type === "point" && light.castShadow)) {
                    distanceMaterial = originalDistanceMaterial?.clone() ?? new THREE.MeshDistanceMaterial();
                    mesh.customDistanceMaterial = distanceMaterial;
                }
                shadowOpacity = { value: fadeMaterials[0].material.opacity };
                [[depthMaterial, originalDepthMaterial], [distanceMaterial, originalDistanceMaterial]]
                    .forEach(([material, original]) => {
                        if (!material) return;
                        ["map", "alphaMap", "alphaTest", "side", "alphaHash", "opacity"]
                            .forEach((key) => { material[key] = fadeMaterials[0].material[key]; });
                        material.onBeforeCompile = (shader, renderer) => {
                            original?.onBeforeCompile?.call(material, shader, renderer);
                            shader.uniforms.houseMakerFadeOpacity = shadowOpacity;
                            shader.fragmentShader = "uniform float houseMakerFadeOpacity;\n" + shader.fragmentShader.replace(
                                "vec4 diffuseColor = vec4( 1.0 );",
                                "vec4 diffuseColor = vec4( 1.0, 1.0, 1.0, houseMakerFadeOpacity );"
                            );
                        };
                    });
                mesh.customDepthMaterial = depthMaterial;
                mesh.onBeforeShadow = (...args) => {
                    originalBeforeShadow?.apply(mesh, args);
                    const group = args[6];
                    const entry = fadeMaterials[group?.materialIndex ?? 0] ?? fadeMaterials[0];
                    depthMaterial.opacity = entry.material.opacity;
                    if (distanceMaterial) distanceMaterial.opacity = entry.material.opacity;
                    shadowOpacity.value = depthMaterial.opacity;
                };
            }

            records.push({
                mesh,
                originalMaterial,
                originalDepthMaterial,
                originalDistanceMaterial,
                originalBeforeShadow,
                depthMaterial,
                distanceMaterial,
                shadowOpacity,
                hideable: mesh.userData.housemakerHideable,
                keepWhenLit,
                fadeMaterials
            });
            mesh.userData.housemakerHideable = true;
            mesh.material = Array.isArray(originalMaterial)
                ? fadeMaterials.map((entry) => entry.material)
                : fadeMaterials[0].material;
        }));

        // Preserve authored visibility while collecting nested mesh children.
        records.forEach((record) => applyHouseMakerObjectFade(record, smoothStep(fade.progress), fixtureLighting.factor));
        fade.records = records;
        fade.cursor = 0;
        fade.remaining = records.length;

        return () => {
            records.forEach(({ mesh, originalMaterial, originalDepthMaterial, originalDistanceMaterial,
                originalBeforeShadow, depthMaterial, distanceMaterial, hideable }) => {
                mesh.material = originalMaterial;
                if (depthMaterial) {
                    mesh.customDepthMaterial = originalDepthMaterial;
                    mesh.onBeforeShadow = originalBeforeShadow;
                    depthMaterial.dispose();
                }
                if (distanceMaterial) {
                    mesh.customDistanceMaterial = originalDistanceMaterial;
                    distanceMaterial.dispose();
                }
                mesh.visible = true;
                if (hideable === undefined) delete mesh.userData.housemakerHideable;
                else mesh.userData.housemakerHideable = hideable;
            });
            materials.forEach((entry) => entry.material.dispose());
            retainedMaterials.forEach((entry) => entry.material.dispose());
            fade.records = [];
        };
    }, [renderData, instancesEnabled, shadowsEnabled, fixtureLighting, objectLights]);

    // Track live slots so streamed replacements inherit current emission.
    useLayoutEffect(() => {
        const visited = new Set();
        const bindings = [];
        [renderData.modelScene, renderData.mirroredModels, ...renderData.runtimeMirrors, ...instanceMeshesRef.current.values()]
            .forEach((root) => root.traverse((mesh) => {
                if (!mesh.isMesh || visited.has(mesh)) return;
                visited.add(mesh);
                (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material, index) => {
                    const metadata = material?.userData?.housemakerFaceLighting;
                    if (metadata) bindings.push({mesh, index, metadata});
                });
            }));
        fixtureLighting.materials = bindings;
        fixtureLighting.setFactor(fixtureLighting.factor);
        return () => { fixtureLighting.materials = []; };
    }, [renderData, instancesEnabled, shadowsEnabled, fixtureLighting]);

    // Sharpen shared model maps without touching environment textures.
    useLayoutEffect(() => {
        if (!anisotropicFilteringEnabled) return;
        const anisotropy = Math.max(1, Math.min(anisotropyRef.current, renderer.capabilities.getMaxAnisotropy()));
        const materials = new Set();
        const textures = new Map();
        [renderData.modelScene, renderData.mirroredModels].forEach((root) => root.traverse((mesh) => {
            if (!mesh.isMesh) return;
            (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                .forEach((material) => materials.add(material));
        }));
        if (instancesEnabled) {
            renderData.instanceParts.forEach((part) => {
                (Array.isArray(part.material) ? part.material : [part.material])
                    .forEach((material) => materials.add(material));
            });
        }
        materials.forEach((material) => Object.entries(material ?? {}).forEach(([slot, texture]) => {
            if (slot === "envMap" || !texture?.isTexture || texture.isCubeTexture || texture.isRenderTargetTexture
                || texture.mapping !== THREE.UVMapping || textures.has(texture)
                || texture.anisotropy === anisotropy) return;
            textures.set(texture, texture.anisotropy);
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
        }));
        return () => textures.forEach((originalAnisotropy, texture) => {
            if (texture.anisotropy === originalAnisotropy) return;
            texture.anisotropy = originalAnisotropy;
            texture.needsUpdate = true;
        });
    }, [anisotropicFilteringEnabled, anisotropy, instancesEnabled, renderData, renderer]);

    // Apply quality toggles to textures that arrived after bootstrap.
    useLayoutEffect(() => {
        const pool = materialStreamingRef.current?.pool;
        if (!pool) return;
        const anisotropy = anisotropicFilteringEnabled ? Math.max(1, Math.min(anisotropyRef.current, renderer.capabilities.getMaxAnisotropy())) : 1;
        pool.entries.forEach((entry) => entry.textures.forEach((texture) => {
            if (texture.anisotropy === anisotropy) return;
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
        }));
    }, [anisotropicFilteringEnabled, anisotropy, renderer]);

    // Stream materials independently from geometry and navigation readiness.
    useEffect(() => {
        const policy = sceneData.materialStreaming;
        if (policy?.enabled !== true || !Array.isArray(sceneData.roomAssets?.materials)) return;
        if (policy.version !== 1 || policy.format !== "housemaker-material-streaming") {
            if (process.env.NODE_ENV !== "production") console.warn("HouseMaker: unsupported material streaming metadata; retaining embedded materials.");
            return;
        }

        const owner = {};
        const fadeState = objectFadeRef.current;
        const visibilityState = visibilityRef.current;
        const pool = acquireHouseMakerMaterialPool(renderer, policy, config.basis_path);
        const records = new Map();
        const jobs = [];
        const ownedMaterials = new Set();
        const fadeEntries = new Map();
        objectFadeRef.current.records.forEach((record) => record.fadeMaterials.forEach((entry) => {
            fadeEntries.set(entry.material, entry);
        }));
        const telemetry = { materials: Object.create(null), firstTexturedFrameMs: null, bytesDownloaded: 0, gpuResidentBytes: 0, errors: 0, uploadFrameStalls: 0 };
        visibilityState.housemakerMaterialStreaming = telemetry;
        const runtime = { pool, owner, records, jobs, telemetry, frames: 0, cancelled: false, nextPriorityAt: 0, room: null, lastRoomAt: 0, retainedRooms: new Map(), lastMotionAt: 0 };
        materialStreamingRef.current = runtime;
        const startedAt = performance.now();
        const roots = [renderData.modelScene, renderData.mirroredModels, ...renderData.runtimeMirrors, ...instanceMeshesRef.current.values()];
        const visited = new Set();
        const bindings = [];

        // Read and replace slots without changing material-array structure.
        const readSlot = (binding) => Array.isArray(binding.mesh.material) ? binding.mesh.material[binding.index] : binding.mesh.material;
        const writeSlot = (binding, material) => {
            if (Array.isArray(binding.mesh.material)) {
                const materials = binding.mesh.material.slice();
                materials[binding.index] = material;
                binding.mesh.material = materials;
            } else binding.mesh.material = material;
        };
        // Retain preparations until outstanding shader compilation settles.
        const releasePreparation = (job) => {
            const prepared = job.prepared;
            if (!prepared) return;
            job.prepared = null;
            prepared.cancelled = true;
            prepared.release = () => prepared.replacements.forEach((material) => {
                if (bindings.some((binding) => binding.current === material)) return;
                if (ownedMaterials.delete(material)) material.dispose();
            });
            if (prepared.settled) prepared.release();
        };
        const releaseEntry = (entry) => {
            entry.owners.delete(owner);
            entry.priorities?.delete(owner);
            entry.priority = Math.min(...Array.from(entry.priorities?.entries() ?? [])
                .filter(([reference]) => entry.owners.has(reference)).map(([, priority]) => priority));
        };
        roots.forEach((root) => root.traverse?.((mesh) => {
            if (!mesh.isMesh || visited.has(mesh)) return;
            visited.add(mesh);
            (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material, index) => {
                if (!material) return;
                const fadeEntry = fadeEntries.get(material);
                const source = fadeEntry?.sourceMaterial ?? material;
                bindings.push({ mesh, index, fallback: material, source, fadeEntry, current: material });
            });
        }));
        sceneData.roomAssets.materials.forEach((descriptor) => {
            if (!isNonEmptyString(descriptor?.materialId) || records.has(descriptor.materialId)) {
                if (process.env.NODE_ENV !== "production") console.warn("HouseMaker: skipping an invalid or duplicate streaming material ID.");
                return;
            }
            const record = { descriptor, bindings: [], uses: [], active: null, quality: 0, jobs: [], visible: false, protected: false, lastUsed: 0 };
            records.set(descriptor.materialId, record);
            telemetry.materials[descriptor.materialId] = { tier: "embedded", state: "embedded", visible: false };
            ["preview", "full"].forEach((variant) => {
                const data = descriptor.variants?.[variant] ?? (variant === "full" ? descriptor : null);
                if (!isNonEmptyString(data?.file)) return;
                try {
                    const url = new URL(data.file, new URL(manifestUrl, document.baseURI)).href;
                    const job = { record, variant, quality: variant === "full" ? 2 : 1, descriptor: { ...data, materialId: descriptor.materialId, variant }, url, key: `${descriptor.materialId}:${variant}:${data.sha256 ?? url}`, desired: false, entry: null, prepared: null };
                    jobs.push(job);
                    record.jobs.push(job);
                } catch (error) {
                    if (process.env.NODE_ENV !== "production") console.warn("HouseMaker: invalid material-pack URL; retaining embedded material.", error);
                }
            });
        });

        // Bind IDs first; index fallback requires verified main bytes.
        const bindMaterials = (verifiedHash = false) => {
            bindings.forEach((binding) => {
                if (binding.record) return;
                const id = binding.source.userData?.housemaker_material_id;
                const index = gltf.parser?.associations?.get(binding.source)?.materials;
                const record = records.get(id) ?? (verifiedHash && !id && Number.isInteger(index) && index >= 0
                    ? Array.from(records.values()).find((entry) => (entry.descriptor.binding?.materialIndex ?? entry.descriptor.materialIndex) === index)
                    : null);
                if (!record) return;
                binding.record = record;
                record.bindings.push(binding);
                if (!record.uses.some((use) => use.mesh === binding.mesh)) record.uses.push({ mesh: binding.mesh, boxes: null, matrix: null });
                const preview = record.descriptor.variants?.preview;
                const image = binding.source.map?.image;
                record.embeddedPreview = (record.embeddedPreview ?? true) && Boolean(image)
                    && Math.max(image.width ?? 0, image.height ?? 0) >= (preview?.maxResolution ?? sceneData.roomAssets.previewMaxSize ?? Infinity);
            });
            runtime.nextPriorityAt = 0;
        };
        bindMaterials();
        const mainBytes = THREE.Cache.get(config.models_path + modelFile);
        if (mainBytes instanceof ArrayBuffer && window.crypto?.subtle && sceneData.asset?.sha256) {
            window.crypto.subtle.digest("SHA-256", mainBytes).then((hash) => {
                const digest = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
                if (!runtime.cancelled && digest === sceneData.asset.sha256) bindMaterials(true);
            }).catch(() => {});
        }

        // Preserve fade state, depth maps, and physical-material subclasses.
        const applyMaterial = (record, pack, replacements) => {
            const opacity = smoothStep(objectFadeRef.current.progress);
            const previousPack = record.active;
            const previousMaterials = new Set(record.bindings.map((binding) => binding.current));
            record.bindings.forEach((binding) => {
                const material = replacements?.get(binding.fadeEntry ?? binding.fallback) ?? binding.fallback;
                if (binding.fadeEntry) {
                    const source = pack?.material ?? binding.source;
                    binding.fadeEntry.material = material;
                    binding.fadeEntry.opacity = source.opacity;
                    binding.fadeEntry.alphaTest = source.alphaTest;
                    const amount = binding.fadeEntry.keepWhenLit ? Math.max(opacity, fixtureLighting.factor) : opacity;
                    material.opacity = source.opacity * amount;
                    material.alphaTest = source.alphaTest * Math.max(amount, Number.EPSILON);
                }
                writeSlot(binding, material);
                binding.current = material;
                applyHouseMakerFaceLighting(material, binding.fallback.userData.housemakerFaceLighting, fixtureLighting.factor);
                if (shadowsEnabled) {
                    const materials = Array.isArray(binding.mesh.material) ? binding.mesh.material : [binding.mesh.material];
                    binding.mesh.castShadow = binding.mesh.userData.housemakerFaceLighting?.lightPassthrough === true ? false
                        : shadowDefaultsRef.current.get(binding.mesh) === true
                            || materials.every((entry) => !entry.transparent || entry.opacity >= 1);
                }
            });
            objectFadeRef.current.records.forEach((fadeRecord) => {
                if (!fadeRecord.depthMaterial || !record.uses.some((use) => use.mesh === fadeRecord.mesh)) return;
                const material = fadeRecord.fadeMaterials[0].material;
                [fadeRecord.depthMaterial, fadeRecord.distanceMaterial].forEach((shadowMaterial) => {
                    if (!shadowMaterial) return;
                    ["map", "alphaMap", "side", "alphaHash", "opacity", "alphaTest"].forEach((key) => { shadowMaterial[key] = material[key]; });
                    shadowMaterial.needsUpdate = true;
                });
                fadeRecord.shadowOpacity.value = material.opacity;
            });
            record.active = pack;
            record.quality = pack ? (pack.descriptor.variant === "full" ? 2 : 1) : 0;
            telemetry.materials[record.descriptor.materialId].tier = pack?.descriptor.variant ?? "embedded";
            telemetry.materials[record.descriptor.materialId].state = "ready";
            pack?.owners.add(owner);
            if (previousPack && previousPack !== pack) {
                releaseEntry(previousPack);
                record.jobs.filter((job) => job.entry === previousPack).forEach(releasePreparation);
            }
            previousMaterials.forEach((material) => {
                if (bindings.some((binding) => binding.current === material)) return;
                if (ownedMaterials.delete(material)) material.dispose();
            });
        };

        // Test floor polygons, including holes, without hiding geometry.
        const floorContains = (room, point, margin = 0) => {
            if (room.fallback || !isFiniteVector3(room.bounds?.min) || !isFiniteVector3(room.bounds?.max)
                || point.y < room.bounds.min[1] - margin || point.y > room.bounds.max[1] + margin) return false;
            const inside = (outline) => {
                if (!Array.isArray(outline) || outline.length < 3 || !outline.every(isFiniteVector3)) return false;
                let result = false;
                for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
                    const a = outline[index], b = outline[previous];
                    if ((a[2] > point.z) !== (b[2] > point.z)
                        && point.x < (b[0] - a[0]) * (point.z - a[2]) / (b[2] - a[2]) + a[0]) result = !result;
                    if (margin > 0) {
                        const dx = b[0] - a[0], dz = b[2] - a[2];
                        const t = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
                        if (Math.hypot(point.x - a[0] - t * dx, point.z - a[2] - t * dz) <= margin) return true;
                    }
                }
                return result;
            };
            return inside(room.floorOutline) && !(Array.isArray(room.floorHoles) ? room.floorHoles : []).some(inside);
        };
        const rooms = (Array.isArray(sceneData.roomAssets.rooms) ? sceneData.roomAssets.rooms : []).filter((room) => isNonEmptyString(room?.id) && isFiniteVector3(room.bounds?.min) && isFiniteVector3(room.bounds?.max));
        const roomCenters = new Map(rooms.map((room) => [room.id, new THREE.Vector3().fromArray(room.bounds.min).add(new THREE.Vector3().fromArray(room.bounds.max)).multiplyScalar(0.5)]));
        const defaultOrder = [
            { rank: 0, variant: "preview", scope: "visible-not-yet-preview-quality" },
            { rank: 1, variant: "full", scope: "visible-in-current-room" },
            { rank: 2, variant: "full", scope: "visible-outside-current-room" },
            { rank: 3, variant: "full", scope: "remaining-current-room-nonshared" },
            { rank: 4, variant: "preview", scope: "adjacent-rooms-heading-first" },
            { rank: 5, variant: "full", scope: "adjacent-rooms-heading-first", onlyWithinBudget: true },
            { rank: 6, variant: "preview", scope: "other-rooms", idleOnly: true }
        ];
        const order = (Array.isArray(policy.priorityOrder) ? policy.priorityOrder : defaultOrder).filter(Boolean);
        const cameraPosition = new THREE.Vector3(), exportedPosition = new THREE.Vector3(), direction = new THREE.Vector3();
        const previousPosition = new THREE.Vector3(Infinity, 0, 0), previousDirection = new THREE.Vector3();
        const inverseRoot = new THREE.Matrix4(), viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum();
        const instanceMatrix = new THREE.Matrix4();
        const warmTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
        const budgetMiB = navigator.maxTouchPoints > 0 ? policy.cache?.mobileGpuBudgetMiB : policy.cache?.desktopGpuBudgetMiB;
        const budget = (Number.isFinite(budgetMiB) && budgetMiB > 0 ? budgetMiB : (navigator.maxTouchPoints > 0 ? 128 : 512)) * 1024 * 1024;
        const embeddedTextures = new Set(bindings.flatMap((binding) => Object.values(binding.source).filter((value) => value?.isTexture)));
        const embeddedBytes = Array.from(embeddedTextures).reduce((sum, texture) => sum + (texture.image?.width ?? 0) * (texture.image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1), 0);
        const gpuBytes = () => embeddedBytes + Array.from(pool.entries.values()).reduce((sum, entry) => sum + (entry.uploadIndex > 0 || entry.state === "uploaded" ? entry.gpuBytes : 0), 0);
        const trimBudget = (incomingBytes = 0) => {
            const evictable = Array.from(pool.entries.values()).filter((entry) => !entry.owners.size)
                .sort((a, b) => (a.descriptor.variant === "full" ? 0 : 1) - (b.descriptor.variant === "full" ? 0 : 1) || a.lastUsed - b.lastUsed);
            evictable.forEach((entry) => { if (gpuBytes() + incomingBytes > budget) pool.disposeEntry(entry); });
            Array.from(records.values()).filter((record) => record.active && !record.protected)
                .sort((a, b) => (a.quality === 2 ? 0 : 1) - (b.quality === 2 ? 0 : 1) || a.lastUsed - b.lastUsed).forEach((record) => {
                    if (gpuBytes() + incomingBytes <= budget) return;
                    const previous = record.active;
                    applyMaterial(record, null);
                    pool.disposeEntry(previous);
                });
            return gpuBytes() + incomingBytes <= budget;
        };

        // Schedule from current camera evidence, not exported room bounds alone.
        runtime.update = (state, delta) => {
            if (runtime.cancelled || !state.camera) return;
            const now = performance.now();
            if (++runtime.frames < 2) return;
            telemetry.firstTexturedFrameMs ??= now - startedAt;
            state.camera.updateWorldMatrix(true, false);
            state.camera.getWorldPosition(cameraPosition);
            state.camera.getWorldDirection(direction);
            if (!cameraPosition.equals(previousPosition) || !direction.equals(previousDirection)) runtime.lastMotionAt = now;
            const root = rootRef.current;
            root?.updateWorldMatrix?.(true, false);
            inverseRoot.copy(root?.matrixWorld ?? new THREE.Matrix4()).invert();
            exportedPosition.copy(cameraPosition).applyMatrix4(inverseRoot);
            if (now >= runtime.nextPriorityAt) {
                runtime.nextPriorityAt = now + 100;
                const candidate = rooms.find((room) => floorContains(room, exportedPosition));
                if (runtime.room && floorContains(runtime.room, exportedPosition)) runtime.lastRoomAt = now;
                const retainCurrent = runtime.room && (floorContains(runtime.room, exportedPosition, policy.roomSelection?.exitHysteresisMeters ?? 0.5)
                    || now - runtime.lastRoomAt < (policy.roomSelection?.exitHysteresisMilliseconds ?? 1500));
                if (!retainCurrent && candidate?.id !== runtime.room?.id) {
                    if (runtime.room) runtime.retainedRooms.set(runtime.room.id, now);
                    runtime.room = candidate ?? null;
                    runtime.lastRoomAt = now;
                }
                telemetry.currentRoomId = runtime.room?.id ?? null;
                const nearby = new Set();
                (Array.isArray(sceneData.roomAssets.portals) ? sceneData.roomAssets.portals : []).forEach((portal) => {
                    const ids = Array.isArray(portal?.roomIds) ? portal.roomIds : [];
                    if (ids.includes(runtime.room?.id)) ids.forEach((id) => nearby.add(id));
                });
                if (Array.isArray(policy.bootstrap?.roomIds) && policy.bootstrap.roomIds.includes(runtime.room?.id)) {
                    (Array.isArray(policy.bootstrap.adjacentRoomIds) ? policy.bootstrap.adjacentRoomIds : []).forEach((id) => nearby.add(id));
                }
                roomCenters.forEach((center, id) => {
                    if (center.distanceTo(exportedPosition) <= (policy.bootstrap?.radiusMeters ?? 8)) nearby.add(id);
                });
                runtime.retainedRooms.forEach((leftAt, id) => {
                    if (now - leftAt < (policy.cache?.retainPreviousRoomMilliseconds ?? 10000)) nearby.add(id);
                    else runtime.retainedRooms.delete(id);
                });
                viewProjection.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
                frustum.setFromProjectionMatrix(viewProjection);
                records.forEach((record) => {
                    record.visible = false;
                    record.distance = Infinity;
                    record.uses.forEach((use) => {
                        let ancestor = use.mesh;
                        while (ancestor && ancestor.visible) ancestor = ancestor.parent;
                        if (ancestor) return;
                        use.mesh.updateWorldMatrix(true, false);
                        if (!use.matrix || !use.matrix.equals(use.mesh.matrixWorld)) {
                            use.matrix = use.mesh.matrixWorld.clone();
                            use.mesh.geometry.computeBoundingBox();
                            const box = use.mesh.geometry.boundingBox;
                            use.boxes = [];
                            if (box) for (let index = 0; index < (use.mesh.isInstancedMesh ? use.mesh.count : 1); index += 1) {
                                if (use.mesh.isInstancedMesh) use.mesh.getMatrixAt(index, instanceMatrix);
                                else instanceMatrix.identity();
                                use.boxes.push(box.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(use.mesh.matrixWorld, instanceMatrix)));
                            }
                        }
                        use.boxes?.forEach((box) => {
                            record.visible ||= frustum.intersectsBox(box);
                            record.distance = Math.min(record.distance, box.distanceToPoint(cameraPosition));
                        });
                    });
                    const roomIds = Array.isArray(record.descriptor.roomIds) ? record.descriptor.roomIds : [];
                    record.inCurrent = roomIds.includes(runtime.room?.id);
                    record.adjacent = roomIds.some((id) => nearby.has(id));
                    record.protected = record.visible || record.inCurrent || record.adjacent;
                    if (record.protected) record.lastUsed = now;
                    telemetry.materials[record.descriptor.materialId].visible = record.visible;
                    let heading = -1;
                    roomIds.forEach((id) => {
                        const center = roomCenters.get(id);
                        if (center) heading = Math.max(heading, center.clone().sub(exportedPosition).normalize().dot(direction));
                    });
                    record.jobs.forEach((job) => {
                        let priority = Infinity;
                        if (record.bindings.length && record.quality < job.quality && !(job.variant === "preview" && record.embeddedPreview)) {
                            order.forEach((step) => {
                                if (step.variant !== job.variant || !Number.isFinite(step.rank)) return;
                                let matches = false;
                                if (step.scope === "visible-not-yet-preview-quality") matches = record.visible;
                                if (step.scope === "visible-in-current-room") matches = record.visible && record.inCurrent;
                                if (step.scope === "visible-outside-current-room") matches = record.visible && !record.inCurrent;
                                if (step.scope === "remaining-current-room-nonshared") matches = record.inCurrent && !record.descriptor.shared;
                                if (step.scope === "adjacent-rooms-heading-first") matches = record.adjacent;
                                if (step.scope === "other-rooms") matches = !record.inCurrent && !record.adjacent;
                                if (step.idleOnly && (now - runtime.lastMotionAt < 500 || delta > 1 / 30)) matches = false;
                                if (step.onlyWithinBudget && gpuBytes() >= budget) matches = false;
                                if (matches) priority = Math.min(priority, step.rank * 1000000 + (1 - heading) * 10000 + Math.min(record.distance, 1000));
                            });
                        }
                        job.desired = Number.isFinite(priority);
                        if (job.desired) {
                            const entry = pool.request(job.key, job.descriptor, job.url, owner);
                            if (job.entry !== entry) { releasePreparation(job); job.failed = false; job.reported = false; }
                            job.entry = entry;
                            entry.priorities ??= new Map();
                            entry.priorities.set(owner, priority);
                            entry.priority = Math.min(...Array.from(entry.priorities.entries())
                                .filter(([reference]) => entry.owners.has(reference)).map(([, value]) => value));
                        } else if (job.entry && record.active !== job.entry) {
                            releaseEntry(job.entry);
                            releasePreparation(job);
                        }
                        job.priority = priority;
                    });
                });
                previousPosition.copy(cameraPosition);
                previousDirection.copy(direction);
            }

            // Evict unreferenced variants before sacrificing any visible full material.
            trimBudget();
            pool.pump();
            const frameKey = state.clock?.elapsedTime ?? renderer.info?.render?.frame ?? runtime.frames;
            if (pool.uploadFrame?.key !== frameKey || pool.uploadFrame.visited.has(runtime)) {
                pool.uploadFrame = { key: frameKey, startedAt: performance.now(), uploads: 0, visited: new Set() };
            }
            pool.uploadFrame.visited.add(runtime);
            const workStarted = pool.uploadFrame.startedAt;
            const maxUploads = Math.max(1, policy.scheduler?.maxGpuUploadsPerFrame ?? 1);
            const workBudget = Math.max(0, policy.scheduler?.gpuWorkBudgetMilliseconds ?? 2);
            jobs.sort((a, b) => a.priority - b.priority).forEach((job) => {
                const entry = job.entry;
                if (!job.desired || job.failed || !entry || job.record.quality >= job.quality || performance.now() - workStarted > workBudget) return;
                if (entry.state === "error") {
                    if (!job.reported) {
                        job.reported = true;
                        telemetry.errors += 1;
                        if (process.env.NODE_ENV !== "production") console.warn(`HouseMaker: ${job.variant} material ${job.record.descriptor.materialId} failed; keeping its current material.`, entry.error);
                    }
                    return;
                }
                if (entry.state !== "decoded" && entry.state !== "uploaded") return;
                if (!entry.uploadIndex && !trimBudget(entry.gpuBytes)) return;
                try {
                entry.uploadIndex ??= 0;
                while (entry.uploadIndex < entry.textures.length && pool.uploadFrame.uploads < maxUploads && performance.now() - workStarted <= workBudget) {
                    const texture = entry.textures[entry.uploadIndex];
                    texture.anisotropy = anisotropicFilteringRef.current ? Math.max(1, Math.min(anisotropyRef.current, renderer.capabilities.getMaxAnisotropy())) : 1;
                    renderer.initTexture(texture);
                    entry.uploadIndex += 1;
                    pool.uploadFrame.uploads += 1;
                }
                if (entry.uploadIndex < entry.textures.length) return;
                entry.state = "uploaded";
                if (!job.prepared) {
                    const replacements = new Map();
                    job.record.bindings.forEach((binding) => {
                        const key = binding.fadeEntry ?? binding.fallback;
                        if (replacements.has(key)) return;
                        const material = entry.material.clone();
                        material.userData = { ...material.userData, housemaker_material_id: job.record.descriptor.materialId, housemakerMaterialTier: job.variant };
                        const lighting = binding.fallback.userData.housemakerFaceLighting;
                        if (lighting) material.userData.housemakerFaceLighting = lighting;
                        applyHouseMakerFaceLighting(material, lighting, fixtureLighting.factor);
                        material.vertexColors = binding.source.vertexColors;
                        material.flatShading = binding.source.flatShading;
                        if (typeof entry.carrierHasTangents === "boolean" && entry.carrierHasTangents !== Boolean(binding.mesh.geometry.attributes.tangent)) {
                            if (material.normalScale) material.normalScale.y *= -1;
                            if (material.clearcoatNormalScale) material.clearcoatNormalScale.y *= -1;
                        }
                        material.onBeforeCompile = binding.fallback.onBeforeCompile;
                        material.customProgramCacheKey = binding.fallback.customProgramCacheKey;
                        if (binding.fadeEntry) {
                            material.alphaHash ||= !material.transparent;
                            const opacity = smoothStep(objectFadeRef.current.progress);
                            const amount = binding.fadeEntry.keepWhenLit ? Math.max(opacity, fixtureLighting.factor) : opacity;
                            material.opacity *= amount;
                            material.alphaTest *= Math.max(amount, Number.EPSILON);
                        }
                        replacements.set(key, material);
                        ownedMaterials.add(material);
                    });
                    const warmScene = new THREE.Scene();
                    const warmed = new Set();
                    job.record.bindings.forEach((binding) => {
                        const material = replacements.get(binding.fadeEntry ?? binding.fallback);
                        const signature = `${material.uuid}:${binding.mesh.isInstancedMesh}:${Object.keys(binding.mesh.geometry.attributes).sort().join(",")}:${Object.keys(binding.mesh.geometry.morphAttributes).join(",")}`;
                        if (warmed.has(signature)) return;
                        warmed.add(signature);
                        const mesh = binding.mesh.isInstancedMesh
                            ? new THREE.InstancedMesh(binding.mesh.geometry, material, 1)
                            : new THREE.Mesh(binding.mesh.geometry, material);
                        if (binding.mesh.isSkinnedMesh) { mesh.isSkinnedMesh = true; mesh.skeleton = binding.mesh.skeleton; mesh.bindMatrix = binding.mesh.bindMatrix; mesh.bindMatrixInverse = binding.mesh.bindMatrixInverse; }
                        warmScene.add(mesh);
                    });
                    const prepared = { replacements, ready: false, settled: false, cancelled: false };
                    job.prepared = prepared;
                    let preparation;
                    if (policy.scheduler?.warmShadersBeforeSwap !== false) {
                        const previousTarget = renderer.getRenderTarget?.();
                        const previousFace = renderer.getActiveCubeFace?.() ?? 0;
                        const previousMip = renderer.getActiveMipmapLevel?.() ?? 0;
                        try {
                            if (materialStreamingOffscreen) renderer.setRenderTarget?.(warmTarget);
                            preparation = renderer.compileAsync(warmScene, state.camera, state.scene);
                        } catch (error) {
                            preparation = Promise.reject(error);
                        } finally {
                            if (materialStreamingOffscreen && renderer.setRenderTarget) renderer.setRenderTarget(previousTarget ?? null, previousFace, previousMip);
                        }
                    }
                    prepared.promise = Promise.resolve(preparation).then(() => {
                        if (!runtime.cancelled && !prepared.cancelled) prepared.ready = true;
                    }).catch((error) => {
                        job.failed = true;
                        job.reported = true;
                        telemetry.errors += 1;
                        if (process.env.NODE_ENV !== "production") console.warn("HouseMaker: material shader preparation failed; retaining its fallback.", error);
                    }).finally(() => { prepared.settled = true; prepared.release?.(); });
                    return;
                }
                if (job.prepared.ready) {
                    applyMaterial(job.record, entry, job.prepared.replacements);
                    runtime.nextPriorityAt = 0;
                }
                } catch (error) {
                    job.failed = true;
                    telemetry.errors += 1;
                    releasePreparation(job);
                    if (process.env.NODE_ENV !== "production") console.warn("HouseMaker: material GPU preparation failed; retaining its fallback.", error);
                }
            });
            const anisotropy = anisotropicFilteringRef.current ? Math.max(1, Math.min(anisotropyRef.current, renderer.capabilities.getMaxAnisotropy())) : 1;
            if (runtime.anisotropy !== anisotropy) {
                pool.entries.forEach((entry) => entry.textures.forEach((texture) => {
                    if (texture.anisotropy === anisotropy) return;
                    texture.anisotropy = anisotropy;
                    texture.needsUpdate = true;
                }));
                runtime.anisotropy = anisotropy;
            }
            if (performance.now() - workStarted > workBudget) telemetry.uploadFrameStalls += 1;
            telemetry.bytesDownloaded = pool.bytesDownloaded;
            telemetry.gpuResidentBytes = gpuBytes();
            telemetry.activeDownloads = pool.activeDownloads;
            telemetry.activeDecodes = pool.activeDecodes;
        };

        return () => {
            runtime.cancelled = true;
            if (materialStreamingRef.current === runtime) materialStreamingRef.current = null;
            const preparations = jobs.map((job) => job.prepared?.promise).filter(Boolean);
            const compilingMaterials = new Set(jobs.filter((job) => job.prepared && !job.prepared.settled)
                .flatMap((job) => Array.from(job.prepared.replacements.values())));
            const liveFadeEntries = new Set(fadeState.records.flatMap((record) => record.fadeMaterials));
            const disposedByFadeCleanup = new Set(bindings.filter((binding) => binding.fadeEntry && !liveFadeEntries.has(binding.fadeEntry))
                .map((binding) => binding.fadeEntry.material));
            jobs.forEach(releasePreparation);
            bindings.forEach((binding) => {
                if (readSlot(binding) === binding.current && binding.current !== binding.fallback) writeSlot(binding, binding.fallback);
                if (liveFadeEntries.has(binding.fadeEntry) && binding.fadeEntry.material === binding.current) binding.fadeEntry.material = binding.fallback;
            });
            ownedMaterials.forEach((material) => {
                if (!compilingMaterials.has(material)) {
                    if (!disposedByFadeCleanup.has(material)) material.dispose();
                    ownedMaterials.delete(material);
                }
            });
            const activeFade = new Set(fadeState.records.flatMap((record) => record.fadeMaterials.map((entry) => entry.material)));
            const retiredFallbacks = new Set(bindings.filter((binding) => binding.fadeEntry).map((binding) => binding.fallback));
            retiredFallbacks.forEach((material) => {
                if (!activeFade.has(material) && !disposedByFadeCleanup.has(material)) material.dispose();
            });
            jobs.forEach((job) => { if (job.entry) releaseEntry(job.entry); });
            Promise.allSettled(preparations).then(() => { warmTarget.dispose(); pool.release(owner); });
            if (visibilityState.housemakerMaterialStreaming === telemetry) delete visibilityState.housemakerMaterialStreaming;
        };
    }, [sceneData, gltf, renderData, renderer, manifestUrl, modelFile, instancesEnabled, shadowsEnabled, materialStreamingOffscreen, fixtureLighting]);

    // Let the embedded scene render before scheduling external packs.
    useFrame((state, delta) => {
        materialStreamingRef.current?.update(state, delta);
        pvsRef.current?.update?.(state.camera);
    });

    // Verify baked visibility against already-cached GLB bytes.
    useEffect(() => {
        if (sceneData.visibility == null) return;

        let cancelled = false;
        const runtime = {
            controller: null,
            records: [],
            pending: new Map(),
            instanceRecords: [],
            instancesById: new Map(),
            pendingInstances: new Set(),
            cameraPosition: new THREE.Vector3(),
            lastPosition: new THREE.Vector3(NaN, NaN, NaN),
            frame: -1,
            camera: null
        };
        pvsRef.current = runtime;

        // Release only owned buffers, never shared prototype geometry.
        const removeInstanceCulling = () => {
            runtime.instanceRecords.forEach((record) => {
                record.restore();
                const {mesh, geometry, sourceGeometry} = record;
                if (mesh.onBeforeRender === record.before) mesh.onBeforeRender = record.originalBefore;
                if (mesh.onAfterRender === record.after) mesh.onAfterRender = record.originalAfter;
                if (mesh.geometry === geometry) mesh.geometry = sourceGeometry;
                geometry.index = null;
                geometry.attributes = { housemakerPvsInstanceMatrix: record.matrices };
                geometry.morphAttributes = {};
                geometry.dispose();
            });
            runtime.instanceRecords = [];
            runtime.instancesById.clear();
        };

        const initializeVisibility = async () => {
            try {
                const modelUrl = config.models_path + modelFile;
                const bytes = THREE.Cache.get(modelUrl);
                if (!(bytes instanceof ArrayBuffer) || !window.crypto?.subtle) {
                    throw new Error("Cached GLB bytes or Web Crypto unavailable; keeping frustum-only visibility.");
                }

                const hash = pvsHashRef.current;
                if (hash.bytes !== bytes) {
                    hash.bytes = bytes;
                    hash.promise = window.crypto.subtle.digest("SHA-256", bytes).then((digest) => (
                        Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
                    ));
                }

                const moduleUrl = new URL(modelUrl, document.baseURI);
                if (!/\.glb$/i.test(moduleUrl.pathname)) {
                    throw new Error("Cannot resolve the baked visibility module; keeping frustum-only visibility.");
                }
                moduleUrl.pathname = moduleUrl.pathname.replace(/\.glb$/i, ".pvs.mjs");
                const [glbSha256, visibilityModule] = await Promise.all([
                    hash.promise,
                    import(/* webpackIgnore: true */ moduleUrl.href)
                ]);
                if (cancelled) return;
                if (typeof visibilityModule.createPvsController !== "function") {
                    throw new Error("Baked visibility module has no createPvsController export.");
                }

                // Cull detached proxies, retaining real visibility and shadows.
                const proxyScene = renderData.modelScene.clone(true);
                proxyScene.traverse((node) => { node.visible = true; });
                const instanceVisibility = new Map();
                const controller = visibilityModule.createPvsController({
                    scene: proxyScene,
                    visibility: sceneData.visibility,
                    expectedGlbSha256: glbSha256,
                    cullShadowCasters: true,
                    setInstanceVisible(id, visible) {
                        instanceVisibility.set(id, visible);
                        runtime.instancesById.get(id)?.forEach(({record, index}) => {
                            record.visible[index] = visible ? 1 : 0;
                            record.dirty = true;
                        });
                    }
                });
                if (!controller.valid) {
                    controller.dispose();
                    throw new Error(controller.reason || "Invalid baked visibility data; keeping frustum-only visibility.");
                }
                runtime.controller = controller;

                // Share prototype vertices while owning camera-only instance buffers.
                const listedInstanceIds = new Set(sceneData.visibility.clusters.flatMap((cluster) => cluster.instanceIds ?? []));
                if (instancesEnabled) renderData.instanceParts.forEach((part) => {
                    const mesh = instanceMeshesRef.current.get(part.key);
                    if (!mesh || !part.instances.some((instance) => listedInstanceIds.has(instance.id))) return;
                    const sourceGeometry = mesh.geometry;
                    const geometry = new THREE.BufferGeometry();
                    geometry.name = sourceGeometry.name;
                    geometry.index = sourceGeometry.index;
                    geometry.attributes = { ...sourceGeometry.attributes };
                    geometry.morphAttributes = { ...sourceGeometry.morphAttributes };
                    geometry.morphTargetsRelative = sourceGeometry.morphTargetsRelative;
                    geometry.groups = sourceGeometry.groups.map((group) => ({ ...group }));
                    geometry.drawRange = { ...sourceGeometry.drawRange };
                    geometry.boundingBox = sourceGeometry.boundingBox;
                    geometry.boundingSphere = sourceGeometry.boundingSphere;
                    geometry.userData = { ...sourceGeometry.userData };
                    const matrices = new THREE.InstancedBufferAttribute(
                        new Float32Array(mesh.instanceMatrix.array.length), 16
                    ).setUsage(THREE.DynamicDrawUsage);
                    geometry.setAttribute("housemakerPvsInstanceMatrix", matrices);
                    const record = {
                        mesh, sourceGeometry, geometry, matrices,
                        visible: new Uint8Array(part.instances.length).fill(1),
                        sourceMatrix: mesh.instanceMatrix, sourceCount: mesh.count,
                        sourceVersion: -1, count: mesh.count, dirty: true,
                        originalBefore: mesh.onBeforeRender, originalAfter: mesh.onAfterRender
                    };
                    part.instances.forEach((instance, index) => {
                        if (typeof instance.id !== "string") return;
                        record.visible[index] = instanceVisibility.get(instance.id) === false ? 0 : 1;
                        const bindings = runtime.instancesById.get(instance.id) ?? [];
                        bindings.push({record, index});
                        runtime.instancesById.set(instance.id, bindings);
                    });
                    record.restore = () => {
                        if (!runtime.pendingInstances.delete(record)) return;
                        mesh.instanceMatrix = record.sourceMatrix;
                        mesh.count = record.sourceCount;
                    };
                    record.before = function(renderer, scene, camera, geometry, material, group) {
                        record.originalBefore.call(this, renderer, scene, camera, geometry, material, group);
                        if (this.instanceColor || this.morphTexture || this.instanceMatrix !== record.sourceMatrix
                            || this.count !== record.sourceCount || record.count === this.count) return;
                        runtime.pendingInstances.add(record);
                        this.instanceMatrix = record.matrices;
                        this.count = record.count;
                    };
                    record.after = function(renderer, scene, camera, geometry, material, group) {
                        record.restore();
                        record.originalAfter.call(this, renderer, scene, camera, geometry, material, group);
                    };
                    mesh.geometry = geometry;
                    mesh.onBeforeRender = record.before;
                    mesh.onAfterRender = record.after;
                    runtime.instanceRecords.push(record);
                });

                // Upload compact matrices before Three projects camera draw lists.
                runtime.update = (camera) => {
                    const root = rootRef.current;
                    if (!root || !camera) return;
                    camera.getWorldPosition(runtime.cameraPosition);
                    root.worldToLocal(runtime.cameraPosition);
                    if (!runtime.lastPosition.equals(runtime.cameraPosition) || runtime.enabled !== controller.enabled) {
                        controller.update(runtime.cameraPosition);
                        runtime.lastPosition.copy(runtime.cameraPosition);
                        runtime.enabled = controller.enabled;
                    }
                    runtime.instanceRecords.forEach((record) => {
                        const {mesh, matrices} = record;
                        if (!record.dirty && record.sourceMatrix === mesh.instanceMatrix
                            && record.sourceVersion === mesh.instanceMatrix.version && record.sourceCount === mesh.count) return;
                        record.sourceMatrix = mesh.instanceMatrix;
                        record.sourceVersion = mesh.instanceMatrix.version;
                        record.sourceCount = mesh.count;
                        record.count = 0;
                        for (let index = 0; index < mesh.count; index += 1) {
                            if (record.visible[index] === 0) continue;
                            matrices.array.set(mesh.instanceMatrix.array.subarray(index * 16, index * 16 + 16), record.count * 16);
                            record.count += 1;
                        }
                        matrices.needsUpdate = true;
                        record.dirty = false;
                    });
                };

                const listedNames = new Set(sceneData.visibility.clusters.flatMap((cluster) => cluster.nodeNames));
                const proxies = new Map();
                proxyScene.traverse((node) => {
                    if (!listedNames.has(node.name)) return;
                    const matches = proxies.get(node.name) ?? [];
                    matches.push(node);
                    proxies.set(node.name, matches);
                });

                renderData.modelScene.traverse((mesh) => {
                    const matches = proxies.get(mesh.name);
                    if (!mesh.isMesh || mesh.isInstancedMesh || matches?.length !== 1) return;
                    const record = {
                        mesh,
                        proxy: matches[0],
                        originalBefore: mesh.onBeforeRender,
                        originalAfter: mesh.onAfterRender,
                        start: 0,
                        count: 0
                    };

                    // Preserve shadows and visibility while skipping camera draws.
                    record.before = function(renderer, scene, camera, geometry, material, group) {
                        record.originalBefore.call(this, renderer, scene, camera, geometry, material, group);
                        const root = rootRef.current;
                        const frame = renderer.info.render.frame;
                        if (root && (runtime.frame !== frame || runtime.camera !== camera)) {
                            runtime.frame = frame;
                            runtime.camera = camera;
                            camera.getWorldPosition(runtime.cameraPosition);
                            root.worldToLocal(runtime.cameraPosition);
                            if (!runtime.lastPosition.equals(runtime.cameraPosition)) {
                                controller.update(runtime.cameraPosition);
                                runtime.lastPosition.copy(runtime.cameraPosition);
                            }
                        }
                        if (record.proxy.visible || !geometry) return;
                        record.start = geometry.drawRange.start;
                        record.count = geometry.drawRange.count;
                        runtime.pending.set(geometry, record);
                        // Past-buffer ranges skip submissions, including Three r168.
                        const vertexCount = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
                        geometry.setDrawRange(vertexCount + 1, 0);
                    };
                    record.after = function(renderer, scene, camera, geometry, material, group) {
                        const pending = runtime.pending.get(geometry);
                        if (pending) {
                            geometry.setDrawRange(pending.start, pending.count);
                            runtime.pending.delete(geometry);
                        }
                        record.originalAfter.call(this, renderer, scene, camera, geometry, material, group);
                    };
                    mesh.onBeforeRender = record.before;
                    mesh.onAfterRender = record.after;
                    runtime.records.push(record);
                });
            } catch (error) {
                runtime.controller?.dispose();
                removeInstanceCulling();
                runtime.update = null;
                if (!cancelled && process.env.NODE_ENV !== "production") {
                    console.warn("HouseMaker baked visibility disabled:", error.message);
                }
            }
        };
        initializeVisibility();

        return () => {
            cancelled = true;
            runtime.pending.forEach((record, geometry) => geometry.setDrawRange(record.start, record.count));
            runtime.pending.clear();
            runtime.records.forEach((record) => {
                if (record.mesh.onBeforeRender === record.before) record.mesh.onBeforeRender = record.originalBefore;
                if (record.mesh.onAfterRender === record.after) record.mesh.onAfterRender = record.originalAfter;
            });
            runtime.controller?.dispose();
            removeInstanceCulling();
            if (pvsRef.current === runtime) pvsRef.current = null;
        };
    }, [modelFile, renderData, sceneData.visibility, instancesEnabled]);

    // Draw debug cells without changing visibility or collisions.
    useEffect(() => {
        const root = rootRef.current;
        if (!showBakedPvs || !root || !Array.isArray(sceneData.visibility?.cells)) return;

        const cells = sceneData.visibility.cells.filter((cell) => (
            [cell?.min, cell?.max].every((bounds) => (
                Array.isArray(bounds) && bounds.length === 3 && bounds.every(Number.isFinite)
            )) && cell.min.every((value, axis) => value <= cell.max[axis])
        ));
        if (cells.length === 0) return;

        const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        const positions = new Float32Array(cells.length * 72);
        const colors = new Float32Array(positions.length);
        const inactiveColor = new THREE.Color("#38bdf8");
        const activeColor = new THREE.Color("#4ade80");
        const activeCells = cells.map(() => false);
        cells.forEach((cell, cellIndex) => {
            edges.flat().forEach((corner, vertex) => {
                const offset = cellIndex * 72 + vertex * 3;
                positions[offset] = (corner & 1 ? cell.max : cell.min)[0];
                positions[offset + 1] = (corner & 2 ? cell.max : cell.min)[1];
                positions[offset + 2] = (corner & 4 ? cell.max : cell.min)[2];
                inactiveColor.toArray(colors, offset);
            });
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const colorAttribute = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("color", colorAttribute);
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.65,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const lines = new THREE.LineSegments(geometry, material);
        lines.name = "HouseMaker baked PVS";
        lines.userData.housemakerPvsDebug = true;
        lines.renderOrder = 1000;
        lines.frustumCulled = false;
        lines.raycast = () => {};
        const cameraPosition = new THREE.Vector3();
        const lastPosition = new THREE.Vector3(NaN, NaN, NaN);

        // Read final camera pose, including navigation and tours.
        lines.onBeforeRender = (renderer, scene, camera) => {
            const runtime = pvsRef.current;
            if (runtime?.frame === renderer.info.render.frame && runtime.camera === camera) {
                cameraPosition.copy(runtime.cameraPosition);
            } else {
                camera.getWorldPosition(cameraPosition);
                root.worldToLocal(cameraPosition);
            }
            if (lastPosition.equals(cameraPosition)) return;
            lastPosition.copy(cameraPosition);
            let changed = false;
            cells.forEach((cell, cellIndex) => {
                const active = cameraPosition.x >= cell.min[0] && cameraPosition.x <= cell.max[0]
                    && cameraPosition.y >= cell.min[1] && cameraPosition.y <= cell.max[1]
                    && cameraPosition.z >= cell.min[2] && cameraPosition.z <= cell.max[2];
                if (activeCells[cellIndex] === active) return;
                activeCells[cellIndex] = active;
                const color = active ? activeColor : inactiveColor;
                for (let vertex = 0; vertex < 24; vertex += 1) {
                    color.toArray(colors, cellIndex * 72 + vertex * 3);
                }
                changed = true;
            });
            if (changed) colorAttribute.needsUpdate = true;
        };
        pvsDebugRef.current = lines;
        root.add(lines);

        return () => {
            if (pvsDebugRef.current === lines) pvsDebugRef.current = null;
            root.remove(lines);
            geometry.dispose();
            material.dispose();
        };
    }, [showBakedPvs, sceneData.visibility, renderData]);

    // Adjust debug opacity without rebuilding cells or culling state.
    useEffect(() => {
        const material = pvsDebugRef.current?.material;
        if (material) material.opacity = Number.isFinite(pvsDebugOpacity) ? THREE.MathUtils.clamp(pvsDebugOpacity, 0, 1) : 0.65;
    }, [pvsDebugOpacity, showBakedPvs, sceneData.visibility, renderData]);

    // Restore interrupted draws before shadows or other frame work.
    useFrame(() => {
        const runtime = pvsRef.current;
        if (!runtime) return;
        runtime.pending.forEach((record, geometry) => geometry.setDrawRange(record.start, record.count));
        runtime.pending.clear();
        runtime.pendingInstances.forEach((record) => record.restore());
    }, -1000);

    // Share keyboard and HUD visibility controls after the tutorial.
    useEffect(() => {
        if (!objectControlsEnabled) return;

        const toggleObjects = () => {
            const visibility = visibilityRef.current;
            visibility.housemakerObjectsHidden = !visibility.housemakerObjectsHidden;
            objectFadeRef.current.remaining = objectFadeRef.current.records.length;
            window.dispatchEvent(new CustomEvent("housemaker-objects-visibility-change", {
                detail: { hidden: visibility.housemakerObjectsHidden }
            }));
        };

        const handleVisibilityToggle = (event) => {
            if (event.key?.toLowerCase() !== hideObjectsKey.toLowerCase() || event.repeat
                || event.ctrlKey || event.metaKey || event.altKey) return;
            const target = event.target;
            if (target?.isContentEditable
                || target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;

            event.preventDefault();
            toggleObjects();
        };

        window.addEventListener("keydown", handleVisibilityToggle);
        window.addEventListener("housemaker-toggle-objects", toggleObjects);
        return () => {
            window.removeEventListener("keydown", handleVisibilityToggle);
            window.removeEventListener("housemaker-toggle-objects", toggleObjects);
        };
    }, [hideObjectsKey, objectControlsEnabled]);

    // Spread fading work across frames without React rerenders.
    useFrame((_, delta) => {
        const fade = objectFadeRef.current;
        const target = visibilityRef.current.housemakerObjectsHidden ? 0 : 1;
        if (fade.progress !== target) {
            fade.progress = target === 0
                ? Math.max(0, fade.progress - delta / 0.45)
                : Math.min(1, fade.progress + delta / 0.45);
            fade.remaining = fade.records.length;
        }
        if (!fade.remaining) return;

        const opacity = smoothStep(fade.progress);
        const startedAt = performance.now();
        do {
            const record = fade.records[fade.cursor];
            applyHouseMakerObjectFade(record, opacity, fixtureLighting.factor);
            fade.cursor = (fade.cursor + 1) % fade.records.length;
            fade.remaining -= 1;
        } while (fade.remaining > 0 && performance.now() - startedAt < 1);
    });

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
            renderData.shadowMaterials.forEach((material) => material.dispose());
            renderData.faceMaterials.forEach((variants) => variants.forEach((material) => material.dispose()));
        };
    }, [renderData]);

    return (
        <>
            {/* Keep all exported transforms under one parent. */}
            <group ref={rootRef} position={position} userData={visibilityRef.current}>
                {runtimeLighting.lights.map((directionalLight) => (
                    <HouseMakerDirectionalLight
                        key={directionalLight.id}
                        light={directionalLight}
                        sunlightOrbit={sunlightOrbit?.lightId === directionalLight.id ? sunlightOrbit : undefined}
                        environmentScene={environmentScene}
                        sunLightColor={directionalLight.id === sunLightId ? sunLightColor : undefined}
                        sunOrbitPaused={directionalLight.id === sunLightId ? sunOrbitPaused : false}
                        sunOrbitAngle={directionalLight.id === sunLightId ? sunOrbitAngle : undefined}
                        sunOrbitAngleRevision={directionalLight.id === sunLightId ? sunOrbitAngleRevision : 0}
                        showSunRays={directionalLight.id === sunLightId && showSunRays}
                        onSunOrbitAngleChange={directionalLight.id === sunLightId ? onSunOrbitAngleChange : undefined}
                        dayNightSettings={directionalLight.id === sunLightId ? dayNightSettings : undefined}
                        fixtureLighting={directionalLight.id === sunLightId ? fixtureLighting : undefined}
                        dayNightEnvironment={directionalLight.id === sunLightId ? dayNightEnvironment : undefined}
                        dayNightPanelOpen={directionalLight.id === sunLightId && dayNightPanelOpen}
                        onDayNightStatusChange={directionalLight.id === sunLightId ? onDayNightStatusChange : undefined}
                        shadowBounds={directionalLight.id === sunLightId && !runtimeLighting.bounds.isEmpty()
                            ? runtimeLighting.bounds : undefined}
                        shadowMapSize={shadowMapSize}
                        shadowBias={shadowBias}
                        shadowNormalBias={shadowNormalBias}
                        shadowSoftness={shadowSoftness}
                        shadowCoverage={shadowCoverage}
                        shadowMapSizeOverride={shadowMapSizeOverride}
                    />
                ))}

                {objectLights.filter((light) => instancesEnabled || !renderData.instanceParts.some((part) =>
                    part.instances.some((instance) => instance.id === (light.instanceId ?? light.objectId))))
                    .map((light) => <HouseMakerObjectLight key={light.id} light={light} lighting={fixtureLighting} />)}

                <primitive object={renderData.modelScene} dispose={null} />
                <primitive object={renderData.mirroredModels} dispose={null} />

                {instancesEnabled && renderData.instanceParts.map((instancePart) => (
                    <instancedMesh
                        key={instancePart.key}
                        name={instancePart.name}
                        args={[
                            instancePart.geometry,
                            null,
                            instancePart.instances.length
                        ]}
                        material={instancePart.material}
                        castShadow={instancePart.castShadow}
                        receiveShadow={instancePart.receiveShadow}
                        frustumCulled={false}
                        instanceMatrix={instancePart.instanceMatrices}
                        instanceMatrix-needsUpdate={true}
                        dispose={null}
                        userData={{ housemakerHideable: instancePart.hideable, housemakerFaceLighting: instancePart.faceLighting,
                            housemakerKeepWhenLit: instancePart.keepWhenLit }}
                        ref={(instancedMesh) => {
                            if (!instancedMesh) {
                                instanceMeshesRef.current.delete(instancePart.key);
                                return;
                            }
                            instanceMeshesRef.current.set(instancePart.key, instancedMesh);
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

        </>
    );
}
