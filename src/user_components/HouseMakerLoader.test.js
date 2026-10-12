// ### Imports ###

/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/* eslint-disable testing-library/render-result-naming-convention */

import React, { StrictMode } from "react";
import { render } from "@testing-library/react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import {
    HouseMakerDirectionalLight,
    HouseMakerLoader,
    buildPlaneReflectionMatrix,
    createMirroredObject,
    findDoorBodyNode,
    findDoorComponentNodes,
    prepareHouseMakerModelScene,
    reconstructDoorBodies,
    reconstructHalfMeshes,
    removeHouseMakerRuntimeMirrors,
    validateDirectionalLights,
    validateDoorBodyReconstruction,
    validateDoorBodyReconstructions
} from "./HouseMakerLoader.jsx";

// ### Module mocks ###

// Keep pure helper tests independent from React Three rendering.
jest.mock("@react-three/fiber", () => ({
    useLoader: jest.fn()
}));

jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
    GLTFLoader: function GLTFLoader() {}
}));

jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => ({
    mergeGeometries: jest.fn()
}));

jest.mock("./HouseMakerTourPlayer.jsx", () => ({
    HouseMakerTourPlayer: () => null
}));

// ### Test fixtures ###

// Build valid exported side-duplication metadata.
function makeReconstruction(options = {}) {
    const mirrorPlane = options.mirrorPlane ?? {
        point: [0, 0, 0],
        normal: [0, 0, -1]
    };

    return {
        placementObjectId: options.placementObjectId ?? "placement-a",
        bodyObjectId: options.bodyObjectId ?? "body-a",
        sideDuplication: {
            keptSide: options.keptSide ?? "front",
            mirrorPlane: {
                point: [...mirrorPlane.point],
                normal: [...mirrorPlane.normal]
            },
            uvMode: options.uvMode ?? "reuse",
            applyAfter: options.applyAfter ?? "halfMesh",
            mirroredComponentObjectIds: options.componentIds
        }
    };
}

// Build shared PBR resources with indexed UV geometry.
function makeMeshAssets() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        -1, -1, 0,
        1, -1, 0,
        0, 1, 0
    ], 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
    ], 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
        0, 0,
        1, 0,
        0.5, 1
    ], 2));
    geometry.setIndex([0, 1, 2]);

    const texture = new THREE.Texture();
    texture.name = "door texture";
    const material = new THREE.MeshStandardMaterial({
        color: "#8b5a2b",
        map: texture,
        metalness: 0.2,
        roughness: 0.7,
        side: THREE.FrontSide
    });

    return { geometry, material, texture };
}

// Build one exported door body mesh.
function makeBody(options = {}) {
    const resources = options.resources ?? makeMeshAssets();
    const body = new THREE.Mesh(resources.geometry, resources.material);
    body.name = options.name ?? "Door body";
    body.userData.housemakerDoorBody = {
        placementObjectId: options.placementObjectId ?? "placement-a",
        bodyObjectId: options.bodyObjectId ?? "body-a"
    };

    if (options.halfPlane) {
        body.userData.halfMesh = {
            uvMode: "reuse",
            mirrorPlane: {
                point: [...options.halfPlane.point],
                normal: [...options.halfPlane.normal]
            }
        };
    }

    body.castShadow = true;
    body.receiveShadow = true;
    body.renderOrder = 7;
    body.visible = true;
    body.frustumCulled = false;

    return { body, ...resources };
}

// Build one exported component with a renderable subtree.
function makeComponent(options = {}) {
    const resources = options.resources ?? makeMeshAssets();
    const component = new THREE.Group();
    component.name = options.name ?? "Door component";
    component.userData.housemakerDoorComponent = {
        placementObjectId: options.placementObjectId ?? "placement-a",
        componentObjectId: options.componentObjectId ?? "knob-a",
        kind: options.kind ?? "door_knob"
    };

    const mesh = new THREE.Mesh(resources.geometry, resources.material);
    mesh.name = `${component.name} renderable`;
    mesh.position.set(0.15, 0.25, 0.35);
    mesh.rotation.set(0.2, -0.3, 0.1);
    mesh.scale.set(0.7, 1.4, 0.9);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.renderOrder = 11;
    mesh.visible = true;
    mesh.frustumCulled = false;
    component.add(mesh);

    return { component, mesh, ...resources };
}

// Find every top-level generated mirror below a root.
function getRuntimeMirrors(root) {
    const mirrors = [];

    root.traverse((node) => {
        if (node.userData?.housemakerRuntimeMirror) mirrors.push(node);
    });

    return mirrors;
}

// Find one generated mirror by its runtime type.
function getMirrorByType(root, mirrorType) {
    return getRuntimeMirrors(root).find((node) => (
        node.userData.housemakerRuntimeMirror.mirrorType === mirrorType
    ));
}

// Compare matrices without brittle exact floating-point equality.
function expectMatrixClose(actual, expected, precision = 9) {
    actual.elements.forEach((element, index) => {
        expect(element).toBeCloseTo(expected.elements[index], precision);
    });
}

// Build one valid exported directional-light record.
function makeDirectionalLight(options = {}) {
    return {
        id: options.id ?? "directional-light-1",
        name: options.name ?? "Directional light 1",
        position: options.position ?? [1, 3, -2],
        target: options.target ?? [4, 6, -5],
        color: options.color ?? "#ffffff",
        intensity: options.intensity ?? 1,
        castShadow: options.castShadow ?? false
    };
}

// Read JSX props retained on React DOM test hosts.
function getRenderedProps(element) {
    const propsKey = Object.keys(element).find((key) => (
        key.startsWith("__reactProps$")
    ));

    if (!propsKey) throw new Error("Rendered React props were not found.");
    return element[propsKey];
}

// Build the minimum loader fixtures around one manifest.
function makeLoaderFixtures(manifestOverrides = {}) {
    const sourceScene = new THREE.Scene();
    const manifest = {
        format: "housemaker-r3f-scene",
        version: 9,
        coordinateSystem: "gltf-y-up",
        asset: { glb: "house.glb" },
        instanceGroups: [],
        doorBodyReconstructions: [],
        ...manifestOverrides
    };
    const gltf = {
        scene: sourceScene,
        scenes: [sourceScene],
        parser: { associations: new Map() }
    };

    return { manifest, gltf, sourceScene };
}

// ### Metadata validation ###

describe("HouseMaker door reconstruction validation", () => {
    test("accepts missing or empty reconstruction arrays", () => {
        const warning = jest.fn();

        expect(validateDoorBodyReconstructions(undefined, warning)).toEqual([]);
        expect(validateDoorBodyReconstructions([], warning)).toEqual([]);
        expect(warning).not.toHaveBeenCalled();
    });

    test("normalizes normals without mutating exported metadata", () => {
        const entry = makeReconstruction({
            mirrorPlane: {
                point: [1, 2, 3],
                normal: [0, 0, -8]
            },
            componentIds: ["knob-a", "knob-a", "handle-a"]
        });
        const originalEntry = JSON.parse(JSON.stringify(entry));
        const warning = jest.fn();

        const validated = validateDoorBodyReconstruction(entry, 4, warning);

        expect(validated.sideDuplication.mirrorPlane).toEqual({
            point: [1, 2, 3],
            normal: [0, 0, -1]
        });
        expect(validated.sideDuplication.mirroredComponentObjectIds)
            .toEqual(["knob-a", "handle-a"]);
        expect(entry).toEqual(originalEntry);
        expect(warning).not.toHaveBeenCalled();
    });

    test.each([
        ["non-object entry", () => null],
        ["placement ID", (entry) => ({ ...entry, placementObjectId: " " })],
        ["body ID", (entry) => ({ ...entry, bodyObjectId: undefined })],
        ["side metadata", (entry) => ({ ...entry, sideDuplication: null })],
        ["kept side", (entry) => ({
            ...entry,
            sideDuplication: { ...entry.sideDuplication, keptSide: "left" }
        })],
        ["application order", (entry) => ({
            ...entry,
            sideDuplication: { ...entry.sideDuplication, applyAfter: "beforeHalfMesh" }
        })],
        ["UV mode", (entry) => ({
            ...entry,
            sideDuplication: { ...entry.sideDuplication, uvMode: "flip" }
        })],
        ["mirror point", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirrorPlane: { point: [0, 0], normal: [0, 0, 1] }
            }
        })],
        ["non-finite point", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirrorPlane: { point: [0, Infinity, 0], normal: [0, 0, 1] }
            }
        })],
        ["zero normal", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirrorPlane: { point: [0, 0, 0], normal: [0, 0, 0] }
            }
        })],
        ["non-finite normal", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirrorPlane: { point: [0, 0, 0], normal: [NaN, 0, 1] }
            }
        })],
        ["component array", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirroredComponentObjectIds: "knob-a"
            }
        })],
        ["component ID", (entry) => ({
            ...entry,
            sideDuplication: {
                ...entry.sideDuplication,
                mirroredComponentObjectIds: ["knob-a", ""]
            }
        })]
    ])("rejects an invalid %s", (label, makeInvalidEntry) => {
        const warning = jest.fn();
        const invalidEntry = makeInvalidEntry(makeReconstruction());

        expect(validateDoorBodyReconstruction(invalidEntry, 2, warning))
            .toBeUndefined();
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("2"));
    });

    test("isolates malformed and duplicate entries", () => {
        const warning = jest.fn();
        const validA = makeReconstruction();
        const invalid = makeReconstruction({
            placementObjectId: "placement-invalid",
            mirrorPlane: { point: [0, 0, 0], normal: [0, 0, 0] }
        });
        const validB = makeReconstruction({
            placementObjectId: "placement-b",
            bodyObjectId: "body-b"
        });

        const validated = validateDoorBodyReconstructions([
            validA,
            invalid,
            validB,
            validA
        ], warning);

        expect(validated.map((entry) => entry.placementObjectId))
            .toEqual(["placement-a", "placement-b"]);
        expect(warning).toHaveBeenCalledTimes(2);
    });

    test("warns for a present non-array reconstruction value", () => {
        const warning = jest.fn();

        expect(validateDoorBodyReconstructions({}, warning)).toEqual([]);
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("array"));
    });
});

// ### Exact metadata matching ###

describe("HouseMaker door node matching", () => {
    test("matches bodies and components using placement and object IDs", () => {
        const scene = new THREE.Scene();
        const bodyA = makeBody().body;
        const bodyB = makeBody({ placementObjectId: "placement-b" }).body;
        const displayNameDecoy = new THREE.Group();
        displayNameDecoy.name = "body-a";
        const componentA = makeComponent().component;
        const componentB = makeComponent({ placementObjectId: "placement-b" }).component;
        const generatedDecoy = componentA.clone(true);
        generatedDecoy.userData.housemakerRuntimeMirror = {
            placementObjectId: "placement-a",
            sourceObjectId: "knob-a",
            mirrorType: "sideDuplication:component"
        };
        scene.add(
            bodyA,
            bodyB,
            displayNameDecoy,
            componentA,
            componentB,
            generatedDecoy
        );

        expect(findDoorBodyNode(scene, "placement-a", "body-a")).toBe(bodyA);
        expect(findDoorBodyNode(scene, "placement-b", "body-a")).toBe(bodyB);
        expect(findDoorBodyNode(scene, "placement-missing", "body-a"))
            .toBeUndefined();
        expect(findDoorComponentNodes(scene, "placement-a", "knob-a"))
            .toEqual([componentA]);
        expect(findDoorComponentNodes(scene, "placement-b", "knob-a"))
            .toEqual([componentB]);
    });
});

// ### Reflection math ###

describe("HouseMaker plane reflection", () => {
    test("reflects around a normalized non-origin plane", () => {
        const reflection = buildPlaneReflectionMatrix({
            point: [2, 0, 0],
            normal: [10, 0, 0]
        });

        expect(new THREE.Vector3(3, 4, -5).applyMatrix4(reflection).toArray())
            .toEqual([1, 4, -5]);
        expect(new THREE.Vector3(2, -3, 7).applyMatrix4(reflection).toArray())
            .toEqual([2, -3, 7]);
        expect(buildPlaneReflectionMatrix({
            point: [0, 0, 0],
            normal: [0, 0, 0]
        })).toBeUndefined();
    });

    test("preserves exact world transforms under transformed parents", () => {
        const scene = new THREE.Scene();
        const sourceParent = new THREE.Group();
        const mirrorParent = new THREE.Group();
        const sourceObject = new THREE.Group();
        const resources = makeMeshAssets();
        const renderable = new THREE.Mesh(resources.geometry, resources.material);

        sourceParent.position.set(4, -2, 3);
        sourceParent.rotation.set(0.25, -0.6, 0.15);
        sourceParent.scale.set(1.5, 0.75, 2.25);
        mirrorParent.position.set(-3, 5, 2);
        mirrorParent.rotation.set(-0.2, 0.35, -0.1);
        mirrorParent.scale.set(0.8, 1.4, 1.1);
        sourceObject.position.set(1.2, 0.4, -2.3);
        sourceObject.rotation.set(-0.35, 0.45, 0.2);
        sourceObject.scale.set(0.6, 1.7, 1.25);
        renderable.position.set(0.2, 0.7, -0.1);
        renderable.rotation.set(0.1, 0.2, -0.3);
        renderable.scale.set(0.5, 1.25, 0.8);
        renderable.castShadow = true;
        renderable.receiveShadow = true;
        renderable.renderOrder = 6;
        renderable.frustumCulled = false;
        sourceObject.add(renderable);
        sourceParent.add(sourceObject);
        scene.add(sourceParent, mirrorParent);
        scene.updateMatrixWorld(true);

        const sourceWorld = sourceObject.matrixWorld.clone();
        const renderableWorld = renderable.matrixWorld.clone();
        const reflection = buildPlaneReflectionMatrix({
            point: [2, 0, 0],
            normal: [3, 0, 0]
        });
        const expectedWorld = reflection.clone().multiply(sourceWorld);
        const expectedRenderableWorld = reflection.clone().multiply(renderableWorld);
        const expectedLocal = mirrorParent.matrixWorld
            .clone()
            .invert()
            .multiply(expectedWorld);

        const mirroredObject = createMirroredObject(
            sourceObject,
            mirrorParent,
            reflection,
            {
                placementObjectId: "placement-a",
                sourceObjectId: "knob-a",
                mirrorType: "sideDuplication:component"
            }
        );
        scene.updateMatrixWorld(true);
        const mirroredRenderable = mirroredObject.children[0];

        expectMatrixClose(mirroredObject.matrix, expectedLocal);
        expectMatrixClose(mirroredObject.matrixWorld, expectedWorld);
        expectMatrixClose(mirroredRenderable.matrixWorld, expectedRenderableWorld);
        expect(mirroredObject.matrixAutoUpdate).toBe(false);
        expect(mirroredObject.matrixWorld.determinant()).toBeLessThan(0);
        expect(mirroredRenderable.geometry).toBe(resources.geometry);
        expect(mirroredRenderable.material).toBe(resources.material);
        expect(mirroredRenderable.material.side).toBe(THREE.FrontSide);
        expect(mirroredRenderable.castShadow).toBe(true);
        expect(mirroredRenderable.receiveShadow).toBe(true);
        expect(mirroredRenderable.renderOrder).toBe(6);
        expect(mirroredRenderable.frustumCulled).toBe(false);
    });
});

// ### Reconstruction variants ###

describe("HouseMaker door reconstruction variants", () => {
    test("leaves ordinary and named HALF doors unchanged", () => {
        const scene = new THREE.Scene();
        const ordinaryBody = makeBody().body;
        const nameOnlyBody = makeBody({
            placementObjectId: "placement-name-only",
            bodyObjectId: "body-name-only",
            name: "[HALF] Door body"
        }).body;
        scene.add(ordinaryBody, nameOnlyBody);
        const warning = jest.fn();

        const prepared = prepareHouseMakerModelScene(scene, undefined, warning);

        expect(prepared.runtimeMirrors).toEqual([]);
        expect(prepared.mirroredModels.children).toHaveLength(0);
        expect(prepared.modelScene.children).toHaveLength(2);
        expect(warning).not.toHaveBeenCalled();
    });

    test("reconstructs a body using only regular half-mesh metadata", () => {
        const scene = new THREE.Scene();
        const body = makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body;
        body.position.set(0.75, 1, -0.4);
        scene.add(body);

        const prepared = prepareHouseMakerModelScene(scene, []);
        const clonedBody = findDoorBodyNode(
            prepared.modelScene,
            "placement-a",
            "body-a"
        );
        const halfMirror = getMirrorByType(prepared.mirroredModels, "halfMesh");
        const reflection = buildPlaneReflectionMatrix(body.userData.halfMesh.mirrorPlane);
        clonedBody.updateWorldMatrix(true, true);
        prepared.mirroredModels.updateWorldMatrix(true, true);

        expect(prepared.runtimeMirrors).toHaveLength(1);
        expect(halfMirror).toBeDefined();
        expectMatrixClose(
            halfMirror.matrixWorld,
            reflection.clone().multiply(clonedBody.matrixWorld)
        );
        expect(halfMirror.geometry).toBe(clonedBody.geometry);
        expect(halfMirror.material).toBe(clonedBody.material);
    });

    test("reconstructs a body using only side duplication", () => {
        const scene = new THREE.Scene();
        const resources = makeMeshAssets();
        const body = makeBody({ resources }).body;
        body.position.set(0.5, 1.25, 0.75);
        body.rotation.set(0.1, -0.35, 0.2);
        body.scale.set(1.2, 0.8, 1.6);
        scene.add(body);
        const originalPositions = [...resources.geometry.getAttribute("position").array];
        const originalUvs = resources.geometry.getAttribute("uv");
        const reconstruction = makeReconstruction({
            mirrorPlane: { point: [0, 0, 0.25], normal: [0, 0, -4] }
        });

        const prepared = prepareHouseMakerModelScene(scene, [reconstruction]);
        const clonedBody = findDoorBodyNode(
            prepared.modelScene,
            "placement-a",
            "body-a"
        );
        const sideMirror = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:authored"
        );

        expect(prepared.runtimeMirrors).toHaveLength(1);
        expect(sideMirror.geometry).toBe(clonedBody.geometry);
        expect(sideMirror.material).toBe(clonedBody.material);
        expect(sideMirror.material).toBe(resources.material);
        expect(sideMirror.material.map).toBe(resources.texture);
        expect(sideMirror.geometry.getAttribute("uv")).toBe(originalUvs);
        expect([...resources.geometry.getAttribute("position").array])
            .toEqual(originalPositions);
        expect(sideMirror.castShadow).toBe(body.castShadow);
        expect(sideMirror.receiveShadow).toBe(body.receiveShadow);
        expect(sideMirror.visible).toBe(body.visible);
        expect(sideMirror.renderOrder).toBe(body.renderOrder);
        expect(sideMirror.frustumCulled).toBe(body.frustumCulled);
        expect(sideMirror.material.side).toBe(THREE.FrontSide);
        expect(sideMirror.userData.housemakerRuntimeDoorMirror).toMatchObject({
            placementObjectId: "placement-a",
            sourceObjectId: "body-a",
            mirrorType: "sideDuplication:authored"
        });
    });

    test("applies side duplication after both symmetric body halves", () => {
        const scene = new THREE.Scene();
        const halfPlane = { point: [0, 0, 0], normal: [1, 0, 0] };
        const sidePlane = { point: [0, 0, 2], normal: [0, 0, 1] };
        const body = makeBody({ halfPlane }).body;
        body.position.set(0.8, 1.1, 2.4);
        body.rotation.set(0.1, 0.3, -0.2);
        body.scale.set(0.7, 1.4, 1.2);
        scene.add(body);

        const prepared = prepareHouseMakerModelScene(scene, [
            makeReconstruction({ mirrorPlane: sidePlane })
        ]);
        const clonedBody = findDoorBodyNode(
            prepared.modelScene,
            "placement-a",
            "body-a"
        );
        const halfMirror = getMirrorByType(prepared.mirroredModels, "halfMesh");
        const authoredSide = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:authored"
        );
        const halfSide = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:halfMesh"
        );
        const halfReflection = buildPlaneReflectionMatrix(halfPlane);
        const sideReflection = buildPlaneReflectionMatrix(sidePlane);
        clonedBody.updateWorldMatrix(true, true);
        prepared.mirroredModels.updateWorldMatrix(true, true);
        const expectedHalf = halfReflection.clone().multiply(clonedBody.matrixWorld);

        expect(prepared.runtimeMirrors).toHaveLength(3);
        expect(prepared.mirroredModels.children).toHaveLength(3);
        expectMatrixClose(halfMirror.matrixWorld, expectedHalf);
        expectMatrixClose(
            authoredSide.matrixWorld,
            sideReflection.clone().multiply(clonedBody.matrixWorld)
        );
        expectMatrixClose(
            halfSide.matrixWorld,
            sideReflection.clone().multiply(expectedHalf)
        );
        expect([
            clonedBody,
            halfMirror,
            authoredSide,
            halfSide
        ]).toHaveLength(4);
    });

    test("reconstructs grouped bodies without implicitly copying nested components", () => {
        const scene = new THREE.Scene();
        const bodyAssets = makeMeshAssets();
        const bodyGroup = new THREE.Group();
        const bodyMesh = new THREE.Mesh(bodyAssets.geometry, bodyAssets.material);
        const componentContainer = new THREE.Group();
        const listedComponent = makeComponent({
            componentObjectId: "listed-knob",
            name: "Listed knob"
        }).component;
        const unlistedComponent = makeComponent({
            componentObjectId: "unlisted-handle",
            name: "Unlisted handle"
        }).component;

        bodyGroup.name = "Grouped door body";
        bodyGroup.userData.housemakerDoorBody = {
            placementObjectId: "placement-a",
            bodyObjectId: "body-a"
        };
        bodyGroup.userData.halfMesh = {
            uvMode: "reuse",
            mirrorPlane: {
                point: [0, 0, 0],
                normal: [1, 0, 0]
            }
        };
        bodyGroup.position.set(0.8, 1.2, 0.35);
        bodyGroup.rotation.set(0.1, -0.25, 0.05);
        bodyGroup.scale.set(1.1, 0.9, 1.3);
        bodyMesh.name = "Grouped door slab";
        componentContainer.name = "Nested component container";
        componentContainer.add(listedComponent, unlistedComponent);
        bodyGroup.add(bodyMesh, componentContainer);
        scene.add(bodyGroup);

        const prepared = prepareHouseMakerModelScene(scene, [
            makeReconstruction({ componentIds: ["listed-knob"] })
        ]);
        const clonedBody = findDoorBodyNode(
            prepared.modelScene,
            "placement-a",
            "body-a"
        );
        const halfMirror = getMirrorByType(prepared.mirroredModels, "halfMesh");
        const authoredSide = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:authored"
        );
        const halfSide = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:halfMesh"
        );
        const componentMirror = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:component"
        );
        const bodyAppearances = [
            clonedBody,
            halfMirror,
            authoredSide,
            halfSide
        ];

        expect(prepared.runtimeMirrors).toHaveLength(4);
        bodyAppearances.forEach((appearance) => {
            expect(appearance.getObjectByName("Grouped door slab")).toBeDefined();
            expect(appearance.getObjectByName("Grouped door slab").geometry)
                .toBe(bodyAssets.geometry);
        });
        [halfMirror, authoredSide, halfSide].forEach((bodyMirror) => {
            expect(bodyMirror.getObjectByName("Listed knob")).toBeUndefined();
            expect(bodyMirror.getObjectByName("Unlisted handle")).toBeUndefined();
        });
        expect(componentMirror).toBeDefined();
        expect(componentMirror.userData.housemakerRuntimeDoorMirror).toMatchObject({
            placementObjectId: "placement-a",
            sourceObjectId: "listed-knob",
            mirrorType: "sideDuplication:component"
        });
        expect(getRuntimeMirrors(prepared.mirroredModels).some((mirror) => (
            mirror.userData.housemakerRuntimeMirror.sourceObjectId === "unlisted-handle"
        ))).toBe(false);
    });

    test("mirrors only listed components from the matching placement", () => {
        const scene = new THREE.Scene();
        const bodyA = makeBody().body;
        const bodyB = makeBody({ placementObjectId: "placement-b" }).body;
        bodyA.position.x = 1;
        bodyB.position.x = 20;
        const knobA = makeComponent().component;
        const knobB = makeComponent({ placementObjectId: "placement-b" }).component;
        const hingeA = makeComponent({
            componentObjectId: "hinge-a",
            kind: "hinge"
        }).component;
        knobA.position.set(1, 1, 0.5);
        knobA.rotation.set(0.2, 0.4, -0.1);
        knobB.position.set(20, 1, 0.5);
        hingeA.position.set(0, 1, 0.5);
        scene.add(bodyA, bodyB, knobA, knobB, hingeA);
        scene.updateMatrixWorld(true);

        const prepared = prepareHouseMakerModelScene(scene, [
            makeReconstruction({ componentIds: ["knob-a"] })
        ]);
        const componentMirror = getMirrorByType(
            prepared.mirroredModels,
            "sideDuplication:component"
        );
        const clonedKnobA = findDoorComponentNodes(
            prepared.modelScene,
            "placement-a",
            "knob-a"
        )[0];
        const reflection = buildPlaneReflectionMatrix(
            makeReconstruction().sideDuplication.mirrorPlane
        );
        clonedKnobA.updateWorldMatrix(true, true);
        prepared.mirroredModels.updateWorldMatrix(true, true);

        expect(getRuntimeMirrors(prepared.mirroredModels)).toHaveLength(2);
        expect(componentMirror).toBeDefined();
        expect(componentMirror.children).toHaveLength(1);
        expectMatrixClose(
            componentMirror.matrixWorld,
            reflection.clone().multiply(clonedKnobA.matrixWorld)
        );
        expectMatrixClose(
            componentMirror.children[0].matrixWorld,
            reflection.clone().multiply(clonedKnobA.children[0].matrixWorld)
        );
        expect(componentMirror.children[0].geometry)
            .toBe(clonedKnobA.children[0].geometry);
        expect(componentMirror.children[0].material)
            .toBe(clonedKnobA.children[0].material);
        expect(getRuntimeMirrors(prepared.mirroredModels).every((mirror) => (
            mirror.userData.housemakerRuntimeMirror.placementObjectId === "placement-a"
        ))).toBe(true);
        expect(getRuntimeMirrors(prepared.mirroredModels).some((mirror) => (
            mirror.userData.housemakerRuntimeMirror.sourceObjectId === "hinge-a"
        ))).toBe(false);
    });

    test("does not add copies for exported double-sided doors", () => {
        const scene = new THREE.Scene();
        const frontBody = makeBody({
            bodyObjectId: "body-front",
            name: "Front body slot"
        }).body;
        const backBody = makeBody({
            bodyObjectId: "body-back",
            name: "Back body slot"
        }).body;
        const frontKnob = makeComponent({
            componentObjectId: "knob-front",
            name: "Front knob slot"
        }).component;
        const backKnob = makeComponent({
            componentObjectId: "knob-back",
            name: "Back knob slot"
        }).component;
        scene.add(frontBody, backBody, frontKnob, backKnob);

        const prepared = prepareHouseMakerModelScene(scene, []);

        expect(prepared.runtimeMirrors).toEqual([]);
        expect(prepared.modelScene.children).toHaveLength(4);
        expect(prepared.mirroredModels.children).toHaveLength(0);
    });

    test("keeps shared IDs isolated between two placements", () => {
        const scene = new THREE.Scene();
        const bodyA = makeBody().body;
        const bodyB = makeBody({ placementObjectId: "placement-b" }).body;
        const knobA = makeComponent().component;
        const knobB = makeComponent({ placementObjectId: "placement-b" }).component;
        scene.add(bodyA, bodyB, knobA, knobB);

        const prepared = prepareHouseMakerModelScene(scene, [
            makeReconstruction({ componentIds: ["knob-a"] })
        ]);
        const runtimeMetadata = getRuntimeMirrors(prepared.mirroredModels)
            .map((mirror) => mirror.userData.housemakerRuntimeMirror);

        expect(runtimeMetadata).toHaveLength(2);
        expect(runtimeMetadata.every((metadata) => (
            metadata.placementObjectId === "placement-a"
        ))).toBe(true);
        expect(runtimeMetadata.map((metadata) => metadata.sourceObjectId).sort())
            .toEqual(["body-a", "knob-a"]);
    });

    test("skips malformed entries without blocking valid doors", () => {
        const scene = new THREE.Scene();
        scene.add(
            makeBody().body,
            makeBody({
                placementObjectId: "placement-b",
                bodyObjectId: "body-b"
            }).body
        );
        const malformed = makeReconstruction({
            mirrorPlane: { point: [0, 0, 0], normal: [0, 0, 0] }
        });
        const valid = makeReconstruction({
            placementObjectId: "placement-b",
            bodyObjectId: "body-b"
        });
        const warning = jest.fn();

        const prepared = prepareHouseMakerModelScene(
            scene,
            [malformed, valid],
            warning
        );

        expect(prepared.modelScene.children).toHaveLength(2);
        expect(prepared.runtimeMirrors).toHaveLength(1);
        expect(prepared.runtimeMirrors[0].userData.housemakerRuntimeDoorMirror)
            .toMatchObject({
                placementObjectId: "placement-b",
                sourceObjectId: "body-b"
            });
        expect(warning).toHaveBeenCalledTimes(1);
    });
});

// ### Idempotency and cleanup ###

describe("HouseMaker reconstruction ownership", () => {
    test("prepares independent scenes without mutating cached GLTF data", () => {
        const sourceScene = new THREE.Scene();
        const resources = makeMeshAssets();
        const body = makeBody({
            resources,
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body;
        const knob = makeComponent({ resources }).component;
        sourceScene.add(body, knob);
        const sourceChildCount = sourceScene.children.length;
        const entries = [makeReconstruction({ componentIds: ["knob-a"] })];

        const first = prepareHouseMakerModelScene(sourceScene, entries);
        const second = prepareHouseMakerModelScene(sourceScene, entries);

        expect(first.modelScene).not.toBe(sourceScene);
        expect(second.modelScene).not.toBe(sourceScene);
        expect(second.modelScene).not.toBe(first.modelScene);
        expect(first.mirroredModels).not.toBe(second.mirroredModels);
        expect(first.runtimeMirrors).toHaveLength(4);
        expect(second.runtimeMirrors).toHaveLength(4);
        expect(sourceScene.children).toHaveLength(sourceChildCount);
        expect(getRuntimeMirrors(sourceScene)).toEqual([]);
        expect(first.runtimeMirrors[0]).not.toBe(second.runtimeMirrors[0]);
        expect(first.runtimeMirrors[0].geometry).toBe(resources.geometry);
        expect(second.runtimeMirrors[0].geometry).toBe(resources.geometry);
        expect(first.runtimeMirrors[0].material).toBe(resources.material);
        expect(second.runtimeMirrors[0].material).toBe(resources.material);
    });

    test("repeated side reconstruction replaces rather than duplicates", () => {
        const scene = new THREE.Scene();
        const body = makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body;
        scene.add(body);
        const mirrorGroup = new THREE.Group();
        const halfResult = reconstructHalfMeshes(scene, mirrorGroup);
        const entries = [makeReconstruction()];

        const firstSideMirrors = reconstructDoorBodies(
            scene,
            mirrorGroup,
            entries,
            halfResult.mirrorBySource
        );
        const secondSideMirrors = reconstructDoorBodies(
            scene,
            mirrorGroup,
            entries,
            halfResult.mirrorBySource
        );

        expect(firstSideMirrors).toHaveLength(2);
        expect(secondSideMirrors).toHaveLength(2);
        expect(firstSideMirrors.every((mirror) => mirror.parent === null)).toBe(true);
        expect(getRuntimeMirrors(mirrorGroup)).toHaveLength(3);
        expect(getRuntimeMirrors(mirrorGroup).filter((mirror) => (
            mirror.userData.housemakerRuntimeMirror.mirrorType === "halfMesh"
        ))).toHaveLength(1);
    });

    test("repeating the full reconstruction sequence replaces every generation", () => {
        const scene = new THREE.Scene();
        const body = makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body;
        const knob = makeComponent().component;
        scene.add(body, knob);
        const mirrorGroup = new THREE.Group();
        const entries = [makeReconstruction({ componentIds: ["knob-a"] })];

        const firstHalfResult = reconstructHalfMeshes(scene, mirrorGroup);
        const firstDoorMirrors = reconstructDoorBodies(
            scene,
            mirrorGroup,
            entries,
            firstHalfResult.mirrorBySource
        );
        const firstGeneration = [
            ...firstHalfResult.mirrors,
            ...firstDoorMirrors
        ];
        const firstTypes = firstGeneration.map((mirror) => (
            mirror.userData.housemakerRuntimeMirror.mirrorType
        )).sort();

        const secondHalfResult = reconstructHalfMeshes(scene, mirrorGroup);
        const secondDoorMirrors = reconstructDoorBodies(
            scene,
            mirrorGroup,
            entries,
            secondHalfResult.mirrorBySource
        );
        const secondGeneration = [
            ...secondHalfResult.mirrors,
            ...secondDoorMirrors
        ];
        const secondTypes = secondGeneration.map((mirror) => (
            mirror.userData.housemakerRuntimeMirror.mirrorType
        )).sort();

        expect(firstGeneration).toHaveLength(4);
        expect(secondGeneration).toHaveLength(4);
        expect(secondTypes).toEqual(firstTypes);
        expect(firstGeneration.every((mirror) => mirror.parent === null)).toBe(true);
        expect(secondGeneration.every((mirror) => mirror.parent === mirrorGroup))
            .toBe(true);
        expect(mirrorGroup.children).toHaveLength(4);
        expect(new Set(mirrorGroup.children).size).toBe(4);
        expect(mirrorGroup.children.some((mirror) => (
            firstGeneration.includes(mirror)
        ))).toBe(false);
        expect(getRuntimeMirrors(scene)).toEqual([]);
    });

    test("Strict Mode cleanup and restoration cannot add duplicates", () => {
        const sourceScene = new THREE.Scene();
        sourceScene.add(makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body);
        const prepared = prepareHouseMakerModelScene(
            sourceScene,
            [makeReconstruction()]
        );

        prepared.runtimeMirrors.forEach((mirror) => mirror.parent?.remove(mirror));
        prepared.runtimeMirrors.forEach((mirror) => {
            if (!mirror.parent) prepared.mirroredModels.add(mirror);
        });
        prepared.runtimeMirrors.forEach((mirror) => {
            if (!mirror.parent) prepared.mirroredModels.add(mirror);
        });

        expect(prepared.mirroredModels.children).toHaveLength(3);
        expect(new Set(prepared.mirroredModels.children)).toHaveProperty("size", 3);
    });

    test("React Strict Mode rerenders keep each prepared mirror group stable", () => {
        const sourceScene = new THREE.Scene();
        sourceScene.add(makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body);
        const manifest = {
            asset: { glb: "doors.glb" },
            instanceGroups: [],
            doorBodyReconstructions: [makeReconstruction()]
        };
        const gltf = {
            scene: sourceScene,
            scenes: [sourceScene],
            parser: { associations: new Map() }
        };
        const capturedMirrorGroups = [];
        const originalAdd = THREE.Object3D.prototype.add;
        const addSpy = jest.spyOn(THREE.Object3D.prototype, "add")
            .mockImplementation(function addAndCapture(...objects) {
                const result = originalAdd.apply(this, objects);

                if (this.name === "HouseMaker mirrored models"
                    && !capturedMirrorGroups.includes(this)) {
                    capturedMirrorGroups.push(this);
                }

                return result;
            });
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? manifest : gltf
        ));
        let view;

        try {
            view = render(
                <StrictMode>
                    <HouseMakerLoader
                        jsonFile="doors.json"
                        toursEnabled={false}
                    />
                </StrictMode>
            );
            const mountGroups = [...capturedMirrorGroups];

            expect(mountGroups.length).toBeGreaterThan(0);
            expect(mountGroups.every((group) => group.children.length === 3))
                .toBe(true);
            expect(getRuntimeMirrors(sourceScene)).toEqual([]);
            expect(sourceScene.children).toHaveLength(1);

            view.rerender(
                <StrictMode>
                    <HouseMakerLoader
                        jsonFile="doors.json"
                        toursEnabled={false}
                    />
                </StrictMode>
            );

            expect(capturedMirrorGroups).toEqual(mountGroups);
            expect(capturedMirrorGroups.every((group) => (
                group.children.length === 3
                && new Set(group.children).size === 3
            ))).toBe(true);
            expect(getRuntimeMirrors(sourceScene)).toEqual([]);
            expect(sourceScene.children).toHaveLength(1);
        } finally {
            view?.unmount();
            useLoader.mockReset();
            addSpy.mockRestore();
            consoleError.mockRestore();
        }
    });

    test("cleanup removes only generated mirrors and never disposes resources", () => {
        const scene = new THREE.Scene();
        const resources = makeMeshAssets();
        const source = makeBody({ resources }).body;
        const authoredLookalike = new THREE.Mesh(resources.geometry, resources.material);
        authoredLookalike.name = "[MIRRORED] authored object";
        scene.add(source, authoredLookalike);
        scene.updateMatrixWorld(true);
        const reflection = buildPlaneReflectionMatrix({
            point: [0, 0, 0],
            normal: [1, 0, 0]
        });
        const generated = createMirroredObject(
            source,
            scene,
            reflection,
            {
                placementObjectId: "placement-a",
                sourceObjectId: "body-a",
                mirrorType: "sideDuplication:authored"
            },
            false
        );
        const disposeGeometry = jest.spyOn(resources.geometry, "dispose");
        const disposeMaterial = jest.spyOn(resources.material, "dispose");

        const removed = removeHouseMakerRuntimeMirrors(scene);

        expect(removed).toEqual([generated]);
        expect(generated.parent).toBeNull();
        expect(source.parent).toBe(scene);
        expect(authoredLookalike.parent).toBe(scene);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
    });
});

// ### Directional-light validation ###

describe("HouseMaker directional-light validation", () => {
    test.each([
        { label: "missing", records: undefined },
        { label: "empty", records: [] }
    ])("treats $label directional-light metadata as empty", ({ records }) => {
        const warning = jest.fn();

        expect(validateDirectionalLights(records, warning)).toEqual([]);
        expect(warning).not.toHaveBeenCalled();
    });

    test("treats non-array directional-light metadata as empty", () => {
        expect(validateDirectionalLights({ id: "not-an-array" }, jest.fn()))
            .toEqual([]);
    });

    test("fills omitted presentation defaults without changing coordinates", () => {
        const warning = jest.fn();
        const records = validateDirectionalLights([{
            id: "minimal-light",
            position: [1, 3, -2],
            target: [4, 6, -5]
        }], warning);

        expect(records).toEqual([{
            id: "minimal-light",
            name: "minimal-light",
            position: [1, 3, -2],
            target: [4, 6, -5],
            color: "#ffffff",
            intensity: 1,
            castShadow: false
        }]);
        expect(warning).not.toHaveBeenCalled();
    });

    test("preserves multiple complete directional-light records", () => {
        const warning = jest.fn();
        const records = [
            makeDirectionalLight({
                id: "sun-a",
                name: "Warm sun",
                position: [-4.25, 8, 2.5],
                target: [3, 0.5, -7],
                color: "#F0a040",
                intensity: 2.75,
                castShadow: true
            }),
            makeDirectionalLight({
                id: "sun-b",
                name: "Fill",
                position: [10, 11, 12],
                target: [-1, -2, -3],
                color: "#123456",
                intensity: 0,
                castShadow: false
            })
        ];

        expect(validateDirectionalLights(records, warning)).toEqual(records);
        expect(warning).not.toHaveBeenCalled();
    });

    test("skips malformed records without blocking valid lights", () => {
        const warning = jest.fn();
        const validA = makeDirectionalLight({ id: "valid-a" });
        const validB = makeDirectionalLight({
            id: "valid-b",
            position: [-2, 5, 8],
            target: [0, 1, 0]
        });
        const invalidRecords = [
            null,
            { ...makeDirectionalLight(), id: " " },
            { ...makeDirectionalLight(), id: "short-position", position: [1, 2] },
            { ...makeDirectionalLight(), id: "nonfinite-position", position: [1, NaN, 3] },
            { ...makeDirectionalLight(), id: "short-target", target: [1, 2] },
            { ...makeDirectionalLight(), id: "nonfinite-target", target: [1, Infinity, 3] },
            {
                ...makeDirectionalLight(),
                id: "same-points",
                position: [2, 4, 6],
                target: [2, 4, 6]
            },
            { ...makeDirectionalLight(), id: "short-color", color: "#fff" },
            { ...makeDirectionalLight(), id: "invalid-color", color: "#gg0000" },
            { ...makeDirectionalLight(), id: "negative-intensity", intensity: -0.01 },
            { ...makeDirectionalLight(), id: "nonfinite-intensity", intensity: Infinity },
            { ...makeDirectionalLight(), id: "string-intensity", intensity: "1" },
            { ...makeDirectionalLight(), id: "invalid-shadow", castShadow: "true" }
        ];

        const validated = validateDirectionalLights([
            validA,
            ...invalidRecords,
            validB
        ], warning);

        expect(validated.map((record) => record.id)).toEqual(["valid-a", "valid-b"]);
        expect(warning).toHaveBeenCalledTimes(invalidRecords.length);
    });

    test("keeps the first record for each duplicate ID", () => {
        const warning = jest.fn();
        const first = makeDirectionalLight({
            id: "shared-light",
            position: [1, 2, 3],
            target: [4, 5, 6]
        });
        const duplicate = makeDirectionalLight({
            id: "shared-light",
            position: [11, 12, 13],
            target: [14, 15, 16]
        });
        const independent = makeDirectionalLight({ id: "independent-light" });

        const validated = validateDirectionalLights([
            first,
            duplicate,
            independent
        ], warning);

        expect(validated).toEqual([first, independent]);
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("shared-light"));
    });
});

// ### Directional-light rendering ###

describe("HouseMaker directional-light rendering", () => {
    let consoleError;
    let consoleWarning;

    beforeEach(() => {
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarning = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        useLoader.mockReset();
        consoleError.mockRestore();
        consoleWarning.mockRestore();
    });

    test("applies exact exported properties and assigns a mounted target", () => {
        const light = makeDirectionalLight({
            id: "exact-light",
            name: "Exact exported light",
            position: [1.25, 3.5, -2.75],
            target: [4.5, 6.25, -5.125],
            color: "#12AbEF",
            intensity: 3.25,
            castShadow: true
        });
        const view = render(<HouseMakerDirectionalLight light={light} />);
        const renderedLight = view.container.querySelector("directionallight");
        const lightProps = getRenderedProps(renderedLight);
        const target = renderedLight.target;
        const targetPrimitive = [...view.container.querySelectorAll("primitive")]
            .find((element) => getRenderedProps(element).object === target);

        expect(lightProps.position).toEqual([1.25, 3.5, -2.75]);
        expect(lightProps.name).toBe("Exact exported light");
        expect(lightProps.color).toBe("#12AbEF");
        expect(lightProps.intensity).toBe(3.25);
        expect(lightProps.castShadow).toBe(true);
        expect(lightProps.userData).toEqual({
            houseMakerDirectionalLightId: "exact-light"
        });
        expect(target).toBeInstanceOf(THREE.Object3D);
        expect(target.position.toArray()).toEqual([4.5, 6.25, -5.125]);
        expect(target.matrix.elements.slice(12, 15)).toEqual([4.5, 6.25, -5.125]);
        expect(targetPrimitive).toBeDefined();
        expect(targetPrimitive.parentElement).toBe(renderedLight.parentElement);
        expect(renderedLight.contains(targetPrimitive)).toBe(false);

        view.rerender(<HouseMakerDirectionalLight light={{
            ...light,
            position: [-7, 8, 9],
            target: [10, -11, 12],
            intensity: 0.5,
            castShadow: false
        }} />);
        const updatedLight = view.container.querySelector("directionallight");
        const updatedProps = getRenderedProps(updatedLight);

        expect(updatedLight).toBe(renderedLight);
        expect(updatedLight.target).toBe(target);
        expect(updatedProps.position).toEqual([-7, 8, 9]);
        expect(updatedProps.intensity).toBe(0.5);
        expect(updatedProps.castShadow).toBe(false);
        expect(target.position.toArray()).toEqual([10, -11, 12]);
        expect(target.matrix.elements.slice(12, 15)).toEqual([10, -11, 12]);
    });

    test("renders validator defaults as native light props", () => {
        const [light] = validateDirectionalLights([{
            id: "default-light",
            position: [0, 2, 0],
            target: [0, 0, 0]
        }]);
        const view = render(<HouseMakerDirectionalLight light={light} />);
        const renderedLight = view.container.querySelector("directionallight");
        const lightProps = getRenderedProps(renderedLight);

        expect(lightProps.name).toBe("default-light");
        expect(lightProps.color).toBe("#ffffff");
        expect(lightProps.intensity).toBe(1);
        expect(lightProps.castShadow).toBe(false);
    });

    test.each([
        ["missing", undefined],
        ["empty", []],
        ["non-array", { id: "not-an-array" }]
    ])("renders no lights for %s manifest metadata", (label, directionalLights) => {
        const { manifest, gltf } = makeLoaderFixtures({ directionalLights });
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? manifest : gltf
        ));

        const view = render(
            <HouseMakerLoader jsonFile={`${label}.json`} toursEnabled={false} />
        );

        expect(view.container.querySelectorAll("directionallight")).toHaveLength(0);
        expect(view.container.querySelectorAll("primitive")).toHaveLength(2);
    });

    test.each([8, 9])("keeps manifest version %i compatible", (version) => {
        const directionalLights = version === 9
            ? [makeDirectionalLight({ id: "version-nine-light" })]
            : undefined;
        const { manifest, gltf } = makeLoaderFixtures({
            version,
            directionalLights
        });
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? manifest : gltf
        ));

        const view = render(
            <HouseMakerLoader jsonFile={`version-${version}.json`} toursEnabled={false} />
        );

        expect(view.container.querySelectorAll("directionallight"))
            .toHaveLength(version === 9 ? 1 : 0);
    });

    test("renders every valid light while skipping malformed and duplicate records", () => {
        const lightA = makeDirectionalLight({ id: "light-a", name: "Light A" });
        const lightB = makeDirectionalLight({
            id: "light-b",
            name: "Light B",
            position: [-8, 7, 6],
            target: [5, -4, 3],
            castShadow: true
        });
        const duplicateA = makeDirectionalLight({
            id: "light-a",
            name: "Duplicate A",
            position: [20, 20, 20],
            target: [0, 0, 0]
        });
        const malformed = {
            ...makeDirectionalLight({ id: "bad-light" }),
            target: [0, NaN, 0]
        };
        const { manifest, gltf } = makeLoaderFixtures({
            directionalLights: [lightA, malformed, duplicateA, lightB]
        });
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? manifest : gltf
        ));

        const view = render(
            <HouseMakerLoader jsonFile="multiple-lights.json" toursEnabled={false} />
        );
        const renderedLights = [...view.container.querySelectorAll("directionallight")];
        const renderedNames = renderedLights.map((element) => (
            getRenderedProps(element).name
        ));
        const mountedObjects = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object);

        expect(renderedNames).toEqual(["Light A", "Light B"]);
        expect(renderedLights.every((element) => (
            mountedObjects.includes(element.target)
        ))).toBe(true);
        expect(consoleWarning).toHaveBeenCalledTimes(2);
    });

    test("reconciles manifest and GLB updates without stale or duplicate objects", () => {
        const lightA = makeDirectionalLight({ id: "light-a", name: "Light A" });
        const lightB = makeDirectionalLight({ id: "light-b", name: "Light B" });
        const lightC = makeDirectionalLight({ id: "light-c", name: "Light C" });
        let fixtures = makeLoaderFixtures({ directionalLights: [lightA, lightB] });
        let currentManifest = fixtures.manifest;
        let currentGltf = fixtures.gltf;
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? currentManifest : currentGltf
        ));
        const view = render(
            <HouseMakerLoader jsonFile="lights.json" toursEnabled={false} />
        );
        const firstLights = [...view.container.querySelectorAll("directionallight")];
        const firstLightB = firstLights.find((element) => (
            getRenderedProps(element).name === "Light B"
        ));
        const staleTargetA = firstLights.find((element) => (
            getRenderedProps(element).name === "Light A"
        )).target;
        const stableTargetB = firstLightB.target;

        expect(firstLights).toHaveLength(2);
        expect(useLoader.mock.calls.filter(([Loader]) => (
            Loader === THREE.FileLoader
        ))).toHaveLength(1);

        fixtures = makeLoaderFixtures({ directionalLights: [lightB, lightC] });
        currentManifest = fixtures.manifest;
        currentGltf = fixtures.gltf;
        view.rerender(
            <HouseMakerLoader jsonFile="lights.json" toursEnabled={false} />
        );

        let updatedLights = [...view.container.querySelectorAll("directionallight")];
        let updatedObjects = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object);
        const updatedLightB = updatedLights.find((element) => (
            getRenderedProps(element).name === "Light B"
        ));

        expect(updatedLights.map((element) => getRenderedProps(element).name))
            .toEqual(["Light B", "Light C"]);
        expect(updatedLightB).toBe(firstLightB);
        expect(updatedLightB.target).toBe(stableTargetB);
        expect(updatedObjects).not.toContain(staleTargetA);

        currentGltf = makeLoaderFixtures().gltf;
        view.rerender(
            <HouseMakerLoader jsonFile="reloaded-lights.json" toursEnabled={false} />
        );
        updatedLights = [...view.container.querySelectorAll("directionallight")];
        updatedObjects = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object);

        expect(updatedLights).toHaveLength(2);
        expect(new Set(updatedLights)).toHaveProperty("size", 2);
        expect(updatedObjects.filter((object) => object === stableTargetB)).toHaveLength(1);

        view.unmount();

        expect(view.container.querySelectorAll("directionallight")).toHaveLength(0);
        expect(view.container.querySelectorAll("primitive")).toHaveLength(0);
    });

    test("keeps existing door reconstruction active beside lights", () => {
        const fixtures = makeLoaderFixtures({
            directionalLights: [makeDirectionalLight()],
            doorBodyReconstructions: [makeReconstruction()]
        });
        fixtures.sourceScene.add(makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));

        const view = render(
            <HouseMakerLoader jsonFile="doors-and-lights.json" toursEnabled={false} />
        );
        const mountedObjects = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object);
        const mirrorGroup = mountedObjects.find((object) => (
            object?.name === "HouseMaker mirrored models"
        ));

        expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
        expect(mirrorGroup.children).toHaveLength(3);
        expect(fixtures.sourceScene.children).toHaveLength(1);
        expect(getRuntimeMirrors(fixtures.sourceScene)).toEqual([]);
    });
});
