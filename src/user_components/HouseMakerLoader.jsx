// ### Imports ###

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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

        // Reflect before the export's baked global transform.
        let scaleRoot = sourceObject.parent;
        while (scaleRoot && scaleRoot.userData.housemakerGlobalScale !== true) {
            scaleRoot = scaleRoot.parent;
        }
        if (scaleRoot) {
            const scaleMatrix = scaleRoot.matrixWorld;
            const determinant = scaleMatrix.determinant();
            if (!scaleMatrix.elements.every(Number.isFinite)
                || !Number.isFinite(determinant) || determinant === 0) {
                warning(`[HALF] Model "${sourceObject.name}" has an invalid global scale transform.`);
                return;
            }
            reflectionMatrix.premultiply(scaleMatrix).multiply(scaleMatrix.clone().invert());
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

// ### Exported lighting ###

/**
 * Purpose: Mounts one exported directional light and its scene target.
 * Relationships: HouseMakerLoader places both objects under its transform root.
 * Example: <HouseMakerDirectionalLight light={directionalLight} />
 * @param {object} props.light - Validated exported light data.
 * @param {object} [props.sunlightOrbit] - Validated sun-ray orbit metadata.
 */
export function HouseMakerDirectionalLight(props) {
    const {light, sunlightOrbit, shadowBounds, shadowMapSize = 1024} = props;
    const directionalLightRef = useRef();
    const targetObject = useMemo(() => {
        const target = new THREE.Object3D();
        target.visible = false;
        return target;
    }, []);

    // Preserve animation phase across equivalent prop objects and rerenders.
    const [positionX, positionY, positionZ] = light.position;
    const [targetX, targetY, targetZ] = light.target;
    const [axisX, axisY, axisZ] = sunlightOrbit?.axis ?? [0, 0, 0];
    const [directionX, directionY, directionZ] = sunlightOrbit?.initialDirection ?? [0, 0, 0];
    const speed = sunlightOrbit?.enabled && sunlightOrbit.lightId === light.id
        ? sunlightOrbit.speedDegreesPerSecond : 0;
    const orbit = useMemo(() => {
        if (!speed) return null;
        return {
            lightId: light.id,
            phase: 0,
            radiansPerSecond: THREE.MathUtils.degToRad(speed),
            axis: new THREE.Vector3(axisX, axisY, axisZ).normalize(),
            direction: new THREE.Vector3(directionX, directionY, directionZ).normalize(),
            position: new THREE.Vector3(positionX, positionY, positionZ),
            distance: Math.hypot(targetX - positionX, targetY - positionY, targetZ - positionZ)
        };
    }, [light.id, speed, axisX, axisY, axisZ, directionX, directionY, directionZ,
        positionX, positionY, positionZ, targetX, targetY, targetZ]);

    // Apply the absolute target after both siblings mount.
    useLayoutEffect(() => {
        targetObject.position.fromArray(light.target);
        if (orbit) {
            targetObject.position.copy(orbit.direction).applyAxisAngle(orbit.axis, orbit.phase)
                .multiplyScalar(orbit.distance).add(orbit.position);
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

        // Fit generated sunlight to the exported house, not helpers.
        if (!shadowBounds || !directionalLight.shadow) return;
        if (directionalLight.shadow.map
            && (directionalLight.shadow.map.width !== shadowMapSize
                || directionalLight.shadow.map.height !== shadowMapSize)) {
            directionalLight.shadow.map.dispose();
            directionalLight.shadow.map = null;
        }
        directionalLight.updateWorldMatrix(true, false);
        directionalLight.shadow.updateMatrices(directionalLight);
        const shadowCamera = directionalLight.shadow.camera;
        const bounds = shadowBounds.clone();
        if (directionalLight.parent) bounds.applyMatrix4(directionalLight.parent.matrixWorld);
        bounds.applyMatrix4(shadowCamera.matrixWorldInverse);
        const padding = Math.max(0.5, shadowBounds.getSize(new THREE.Vector3()).length() * 0.025);
        shadowCamera.left = bounds.min.x - padding;
        shadowCamera.right = bounds.max.x + padding;
        shadowCamera.bottom = bounds.min.y - padding;
        shadowCamera.top = bounds.max.y + padding;
        shadowCamera.near = Math.max(0.01, -bounds.max.z - padding);
        shadowCamera.far = Math.max(shadowCamera.near + 1, -bounds.min.z + padding);
        shadowCamera.updateProjectionMatrix();
        directionalLight.shadow.updateMatrices(directionalLight);
    }, [light, orbit, shadowBounds, shadowMapSize, targetObject]);

    // Rotate exported ray direction; keep the authored light position fixed.
    useFrame((_, delta) => {
        if (!orbit || !Number.isFinite(delta) || delta <= 0) return;
        orbit.phase = (orbit.phase + orbit.radiansPerSecond * delta) % (Math.PI * 2);
        targetObject.position.copy(orbit.direction).applyAxisAngle(orbit.axis, orbit.phase)
            .multiplyScalar(orbit.distance).add(orbit.position);
        targetObject.updateMatrix();
        targetObject.updateWorldMatrix(true, false);
    });

    return (
        <>
            <directionalLight
                ref={directionalLightRef}
                name={light.name}
                position={light.position}
                color={light.color}
                intensity={light.intensity}
                castShadow={light.castShadow}
                shadow-mapSize={shadowBounds ? [shadowMapSize, shadowMapSize] : undefined}
                shadow-bias={shadowBounds ? -0.0001 : undefined}
                shadow-normalBias={shadowBounds ? 0.03 : undefined}
                userData={{houseMakerDirectionalLightId: light.id}}
            />
            <primitive object={targetObject} />
        </>
    );
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
 * @param {boolean} [showBakedPvs] - Show baked visibility cells for debugging.
 * @param {boolean} [anisotropicFilteringEnabled] - Sharpen model textures at grazing angles.
 * @param {string} [hideObjectsKey] - Keyboard shortcut for object visibility.
 * @param {boolean} [objectControlsEnabled] - Accept visibility controls after the tutorial.
 */
export function HouseMakerLoader(props) {
    const {jsonFile = "housemaker_export.json"} = props;
    const {position = [0, 0, 0]} = props;
    const {instancesEnabled = true} = props;
    const {toursEnabled = true} = props;
    const {navigationRef} = props;
    const {shadowsEnabled = false, fallbackSunEnabled = false, shadowMapSize = 1024} = props;
    const {showBakedPvs = false} = props;
    const {anisotropicFilteringEnabled = false} = props;
    const {hideObjectsKey = "a", objectControlsEnabled = true} = props;
    const renderer = useThree((state) => state.gl);
    const rootRef = useRef();
    const visibilityRef = useRef({ housemakerObjectsHidden: false });
    const instanceMeshesRef = useRef(new Map());
    const objectFadeRef = useRef({ progress: 1, cursor: 0, remaining: 0, records: [] });
    const pvsRef = useRef(null);
    const pvsHashRef = useRef({ bytes: null, promise: null });

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
                        material: sourceMesh.material,
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

        const modelBounds = new THREE.Box3().setFromObject(modelScene).expandByObject(mirroredModels);
        return { modelScene, mirroredModels, runtimeMirrors, instanceParts, modelBounds };
    }, [gltf, sceneData]);

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
            mesh.castShadow ||= materials.every((material) => !material.transparent || material.opacity >= 1);
            mesh.receiveShadow = true;
        }));
        return () => records.forEach(({ mesh, castShadow, receiveShadow }) => {
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
        });
    }, [instancesEnabled, renderData, shadowsEnabled]);

    // Prepare owned fade materials before the first rendered frame.
    useLayoutEffect(() => {
        const fade = objectFadeRef.current;
        const materials = new Map();
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
            const fadeMaterials = (Array.isArray(originalMaterial)
                ? originalMaterial
                : [originalMaterial]).map((material) => {
                if (!materials.has(material)) {
                    const copy = material.clone();
                    // Keep shader variants stable throughout visibility transitions.
                    copy.alphaHash = material.alphaHash || !material.transparent;
                    materials.set(material, {
                        material: copy,
                        opacity: material.opacity,
                        alphaTest: material.alphaTest
                    });
                }
                return materials.get(material);
            });

            // Fade shadow coverage alongside each object's visible material.
            const originalDepthMaterial = mesh.customDepthMaterial;
            const originalBeforeShadow = mesh.onBeforeShadow;
            let depthMaterial;
            let shadowOpacity;
            if (shadowsEnabled) {
                depthMaterial = originalDepthMaterial?.clone()
                    ?? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
                depthMaterial.map = fadeMaterials[0].material.map;
                depthMaterial.alphaMap = fadeMaterials[0].material.alphaMap;
                depthMaterial.alphaTest = fadeMaterials[0].material.alphaTest;
                depthMaterial.side = fadeMaterials[0].material.side;
                depthMaterial.alphaHash = fadeMaterials[0].material.alphaHash;
                depthMaterial.opacity = fadeMaterials[0].material.opacity;
                shadowOpacity = { value: depthMaterial.opacity };
                depthMaterial.onBeforeCompile = (shader, renderer) => {
                    originalDepthMaterial?.onBeforeCompile?.call(depthMaterial, shader, renderer);
                    shader.uniforms.houseMakerFadeOpacity = shadowOpacity;
                    shader.fragmentShader = "uniform float houseMakerFadeOpacity;\n" + shader.fragmentShader.replace(
                        "vec4 diffuseColor = vec4( 1.0 );",
                        "vec4 diffuseColor = vec4( 1.0, 1.0, 1.0, houseMakerFadeOpacity );"
                    );
                };
                mesh.customDepthMaterial = depthMaterial;
                mesh.onBeforeShadow = (...args) => {
                    originalBeforeShadow?.apply(mesh, args);
                    const group = args[6];
                    const entry = fadeMaterials[group?.materialIndex ?? 0] ?? fadeMaterials[0];
                    depthMaterial.opacity = entry.material.opacity;
                    shadowOpacity.value = depthMaterial.opacity;
                };
            }

            records.push({
                mesh,
                originalMaterial,
                originalDepthMaterial,
                originalBeforeShadow,
                depthMaterial,
                shadowOpacity,
                hideable: mesh.userData.housemakerHideable,
                fadeMaterials
            });
            mesh.userData.housemakerHideable = true;
            mesh.material = Array.isArray(originalMaterial)
                ? fadeMaterials.map((entry) => entry.material)
                : fadeMaterials[0].material;
        }));

        // Preserve authored visibility while collecting nested mesh children.
        records.forEach(({ mesh }) => { mesh.visible = fade.progress > 0; });
        materials.forEach((entry) => {
            const opacity = smoothStep(fade.progress);
            entry.material.opacity = entry.opacity * opacity;
            entry.material.alphaTest = entry.alphaTest * Math.max(opacity, Number.EPSILON);
        });
        records.forEach((record) => {
            if (!record.depthMaterial) return;
            record.depthMaterial.opacity = record.fadeMaterials[0].material.opacity;
            record.shadowOpacity.value = record.depthMaterial.opacity;
        });
        fade.records = records;
        fade.cursor = 0;
        fade.remaining = records.length;

        return () => {
            records.forEach(({ mesh, originalMaterial, originalDepthMaterial, originalBeforeShadow, depthMaterial, hideable }) => {
                mesh.material = originalMaterial;
                if (depthMaterial) {
                    mesh.customDepthMaterial = originalDepthMaterial;
                    mesh.onBeforeShadow = originalBeforeShadow;
                    depthMaterial.dispose();
                }
                mesh.visible = true;
                if (hideable === undefined) delete mesh.userData.housemakerHideable;
                else mesh.userData.housemakerHideable = hideable;
            });
            materials.forEach((entry) => entry.material.dispose());
            fade.records = [];
        };
    }, [renderData, instancesEnabled, shadowsEnabled]);

    // Sharpen shared model maps without touching environment textures.
    useLayoutEffect(() => {
        if (!anisotropicFilteringEnabled) return;
        const anisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
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
    }, [anisotropicFilteringEnabled, instancesEnabled, renderData, renderer]);

    // Verify baked visibility against already-cached GLB bytes.
    useEffect(() => {
        if (sceneData.visibility == null) return;

        let cancelled = false;
        const runtime = {
            controller: null,
            records: [],
            pending: new Map(),
            cameraPosition: new THREE.Vector3(),
            lastPosition: new THREE.Vector3(NaN, NaN, NaN),
            frame: -1,
            camera: null
        };
        pvsRef.current = runtime;

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
                const controller = visibilityModule.createPvsController({
                    scene: proxyScene,
                    visibility: sceneData.visibility,
                    expectedGlbSha256: glbSha256,
                    cullShadowCasters: true
                });
                if (!controller.valid) {
                    controller.dispose();
                    throw new Error(controller.reason || "Invalid baked visibility data; keeping frustum-only visibility.");
                }
                runtime.controller = controller;

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
            if (pvsRef.current === runtime) pvsRef.current = null;
        };
    }, [modelFile, renderData, sceneData.visibility]);

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
        root.add(lines);

        return () => {
            root.remove(lines);
            geometry.dispose();
            material.dispose();
        };
    }, [showBakedPvs, sceneData.visibility, renderData]);

    // Restore interrupted draws before shadows or other frame work.
    useFrame(() => {
        const runtime = pvsRef.current;
        if (!runtime) return;
        runtime.pending.forEach((record, geometry) => geometry.setDrawRange(record.start, record.count));
        runtime.pending.clear();
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
            record.fadeMaterials.forEach((entry) => {
                entry.material.opacity = entry.opacity * opacity;
                // Scale cutout thresholds without switching compiled shader variants.
                entry.material.alphaTest = entry.alphaTest * Math.max(opacity, Number.EPSILON);
            });
            if (record.depthMaterial) {
                record.depthMaterial.opacity = record.fadeMaterials[0].material.opacity;
                record.shadowOpacity.value = record.depthMaterial.opacity;
            }
            record.mesh.visible = fade.progress > 0;
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
                        shadowBounds={directionalLight.id === "housemaker-runtime-sun" && directionalLights.length === 0
                            ? runtimeLighting.bounds : undefined}
                        shadowMapSize={shadowMapSize}
                    />
                ))}

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
                        instanceMatrix={instancePart.instanceMatrices}
                        instanceMatrix-needsUpdate={true}
                        dispose={null}
                        userData={{ housemakerHideable: instancePart.hideable }}
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
