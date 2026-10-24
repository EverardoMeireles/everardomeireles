// ### Imports ###

/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/* eslint-disable testing-library/render-result-naming-convention */
/* global globalThis */

import React, { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
    HouseMakerDirectionalLight,
    HouseMakerLoader,
    acquireHouseMakerMaterialPool,
    buildPlaneReflectionMatrix,
    createMirroredObject,
    findDoorBodyNode,
    findDoorComponentNodes,
    isHouseMakerHideableObject,
    prepareHouseMakerModelScene,
    reconstructDoorBodies,
    reconstructHalfMeshes,
    removeHouseMakerRuntimeMirrors,
    validateDirectionalLights,
    validateObjectLights,
    validateDoorBodyReconstruction,
    validateDoorBodyReconstructions
} from "./HouseMakerLoader.jsx";

// ### Module mocks ###

// Keep pure helper tests independent from React Three rendering.
jest.mock("@react-three/fiber", () => ({
    useLoader: jest.fn(),
    useFrame: jest.fn(),
    useThree: jest.fn(() => ({ capabilities: { getMaxAnisotropy: () => 1 } }))
}));

jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
    GLTFLoader: function GLTFLoader() {}
}));

jest.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({
    KTX2Loader: function KTX2Loader() {}
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

// Build one exported fixture light without applying placement transforms twice.
function makeObjectLight(options = {}) {
    return {
        id: "fixture-a:light-1",
        lightId: "light-1",
        objectId: "fixture-a",
        sourceObjectId: "fixture-a",
        nodeName: "Fixture source",
        name: "Fixture light",
        type: "point",
        position: [1.281239053280267, 3.8433507744201267, -5.132288804631186],
        direction: [0, -1, 0],
        target: [1.281239053280267, 2.8433507744201267, -5.132288804631186],
        localPosition: [-0.01514848685050002, 0.6283360495436336, 0.1886745342132257],
        localDirection: [0, -1, 0],
        color: "#ffe0b2",
        intensity: 1.11,
        rangeMeters: 8,
        coneAngleDegrees: 30,
        penumbra: 0.2,
        castShadow: true,
        ...options
    };
}

// Match GLTFLoader's separate meshes for shared-material bulb primitives.
function makeFixtureLightingExport() {
    const fixtures = makeLoaderFixtures({
        version: 10,
        directionalLights: [makeDirectionalLight({ intensity: 2.7 })],
        objectLights: [
            makeObjectLight(),
            makeObjectLight({ id: "instance-b:light-1", objectId: "instance-b", instanceId: "instance-b", position: [5.84, 3.84, -0.14] }),
            makeObjectLight({ id: "instance-c:light-1", objectId: "instance-c", instanceId: "instance-c", position: [5.85, 3.84, 2.41] })
        ],
        faceLighting: [{
            nodeName: "[HALF] Fixture part",
            meshIndex: 0,
            primitiveIndex: 1,
            lightPassthrough: true,
            emissiveLinearRgb: [1.11, 0.8273986725898301, 0.494173325913013],
            nightOnly: true,
            baseMaterialName: "Fixture atlas",
            baseMaterialIndex: 0
        }],
        instanceGroups: [{
            sourceNodeName: "Fixture source",
            instances: ["fixture-a", "instance-b", "instance-c"].map((id, index) => ({
                id,
                worldMatrix: new THREE.Matrix4().makeTranslation(index * 3, 3, -4).toArray()
            }))
        }]
    });
    const resources = makeMeshAssets();
    resources.material.name = "Fixture atlas";
    resources.material.userData.housemaker_material_id = "fixture-material";
    resources.material.emissiveMap = resources.texture;
    const source = new THREE.Group();
    source.name = "Fixture source";
    const part = new THREE.Group();
    part.name = "[HALF] Fixture part";
    part.userData.halfMesh = {
        uvMode: "reuse", mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
    };
    source.add(part);
    const housing = new THREE.Mesh(resources.geometry, resources.material);
    housing.name = "[HALF] Fixture part_1";
    const bulb = new THREE.Mesh(resources.geometry.clone(), resources.material);
    bulb.name = "[HALF] Fixture part_2";
    part.add(housing, bulb);
    const detachedScene = new THREE.Scene();
    detachedScene.add(source);
    fixtures.gltf.scenes.push(detachedScene);
    fixtures.gltf.parser.associations = new Map([
        [resources.material, { materials: 0 }],
        [part, { nodes: 1, meshes: 0 }],
        [housing, { meshes: 0, primitives: 0 }],
        [bulb, { meshes: 0, primitives: 1 }]
    ]);
    return { ...fixtures, ...resources, source, part, housing, bulb };
}

// Build exported sunlight animation metadata.
function makeSunlightOrbit(options = {}) {
    return {
        enabled: true,
        speedDegreesPerSecond: 45,
        axis: [0, 1, 0],
        lightId: "directional-light-1",
        initialDirection: [1, 0, 0],
        ...options
    };
}

// Build explicit one-shot commands independently of export autoplay metadata.
function makeDayNightSettings(options = {}) {
    return {
        dayNightDuration: 3,
        dayNightMaxElevation: 60,
        dayNightAzimuth: 0,
        dayNightSunStrength: 1,
        dayNightDayBrightness: 0.35,
        dayNightNightBrightness: 0.12,
        dayNightNightSkyBrightness: 0.15,
        dayNightProgress: 0,
        dayNightAction: null,
        dayNightCommand: 0,
        ...options
    };
}

// Capture environment samples without retaining mutable frame scratch colors.
function makeDayNightEnvironment(options = {}) {
    const samples = [];
    return {
        samples,
        current: {
            ready: true,
            error: null,
            prepare: jest.fn(),
            update: jest.fn((sample) => samples.push({ ...sample, tint: sample.tint.clone() })),
            reset: jest.fn(),
            ...options
        }
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

// Check all local house corners inside the fitted shadow camera.
function expectShadowBoundsCovered(light, bounds) {
    const camera = light.shadow.camera;
    const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    [bounds.min.x, bounds.max.x].forEach((x) => {
        [bounds.min.y, bounds.max.y].forEach((y) => {
            [bounds.min.z, bounds.max.z].forEach((z) => {
                const corner = new THREE.Vector3(x, y, z);
                if (light.parent) corner.applyMatrix4(light.parent.matrixWorld);
                corner.applyMatrix4(projection);
                expect(Math.abs(corner.x)).toBeLessThan(1);
                expect(Math.abs(corner.y)).toBeLessThan(1);
                expect(Math.abs(corner.z)).toBeLessThan(1);
            });
        });
    });
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

// ### Shared progressive material packs ###

describe("HouseMaker shared material pool", () => {
    let acquired;
    let renderer;
    let policy;
    let bytes;
    let descriptor;
    let cryptoDescriptor;
    let fetchDescriptor;
    let cachesDescriptor;
    let responseDescriptor;

    beforeEach(() => {
        jest.useFakeTimers();
        acquired = [];
        renderer = {};
        policy = {
            scheduler: { maxConcurrentDownloads: 4, maxConcurrentDecodes: 2 },
            cache: { desktopGpuBudgetMiB: 512, mobileGpuBudgetMiB: 128 },
            failurePolicy: { maxAttempts: 3, retryBackoffMilliseconds: [1000, 3000] }
        };
        bytes = Uint8Array.from([1, 2, 3, 4]).buffer;
        descriptor = {
            materialId: "material-test", variant: "full", materialIndex: 0,
            sha256: require("crypto").createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
            byteSize: bytes.byteLength
        };
        cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
        fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
        cachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
        responseDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Response");
        Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
            subtle: { digest: jest.fn(async (algorithm, value) => Uint8Array.from(
                require("crypto").createHash("sha256").update(Buffer.from(value)).digest()
            ).buffer) }
        } });
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: jest.fn(async () => ({
            ok: true, arrayBuffer: async () => bytes
        })) });
        Object.defineProperty(globalThis, "caches", { configurable: true, value: undefined });
        Object.defineProperty(globalThis, "Response", { configurable: true, value: class Response {
            constructor(value) { this.value = value; }
            async arrayBuffer() { return this.value; }
        } });
        ["setTranscoderPath", "setWorkerLimit", "detectSupport"].forEach((method) => {
            KTX2Loader.prototype[method] = jest.fn(function chain() { return this; });
        });
        KTX2Loader.prototype.init = jest.fn(async () => {});
        KTX2Loader.prototype.dispose = jest.fn();
        GLTFLoader.prototype.setKTX2Loader = jest.fn(function attachDecoder(decoder) {
            this.ktx2Loader = decoder;
            return this;
        });
        GLTFLoader.prototype.parseAsync = jest.fn(async () => makePack());
    });

    afterEach(async () => {
        acquired.forEach((pool) => pool.release());
        jest.runOnlyPendingTimers();
        await flushJobs();
        ["setTranscoderPath", "setWorkerLimit", "detectSupport", "init", "dispose"]
            .forEach((method) => { delete KTX2Loader.prototype[method]; });
        delete GLTFLoader.prototype.setKTX2Loader;
        delete GLTFLoader.prototype.parseAsync;
        [["crypto", cryptoDescriptor], ["fetch", fetchDescriptor], ["caches", cachesDescriptor], ["Response", responseDescriptor]]
            .forEach(([key, original]) => {
                if (original) Object.defineProperty(globalThis, key, original);
                else delete globalThis[key];
            });
        jest.useRealTimers();
    });

    // Build disposable carriers sharing material maps across rendering slots.
    function makePack(material = new THREE.MeshStandardMaterial()) {
        const texture = material.map ?? new THREE.Texture({ width: 4, height: 4 });
        material.map = texture;
        material.normalMap = texture;
        const geometry = new THREE.BoxGeometry();
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(geometry, material));
        return {
            scene, scenes: [scene], geometry, material, texture,
            parser: {
                getDependency: jest.fn(async () => material),
                associations: new Map([[material, { materials: 0 }]])
            }
        };
    }

    // Drain asynchronous download, hashing, and decoder promise stages.
    async function flushJobs() {
        for (let index = 0; index < 24; index += 1) await Promise.resolve();
    }

    // Track retained pools and queue one visible pack.
    function requestPack(key = "test", owner = {}) {
        const pool = acquireHouseMakerMaterialPool(renderer, policy, "/basis/");
        acquired.push(pool);
        const entry = pool.request(key, descriptor, `/materials/${key}.glb`, owner);
        entry.priority = 0;
        return { pool, entry, owner };
    }

    test("deduplicates owners and initializes KTX before parsing", async () => {
        const pack = makePack();
        const disposeGeometry = jest.spyOn(pack.geometry, "dispose");
        GLTFLoader.prototype.parseAsync.mockResolvedValue(pack);
        const { pool, entry, owner } = requestPack();
        const secondOwner = {};
        expect(pool.request("test", descriptor, "/materials/test.glb", secondOwner)).toBe(entry);
        expect(entry.owners).toEqual(new Set([owner, secondOwner]));
        pool.pump();
        await flushJobs();
        expect(entry.state).toBe("downloaded");
        expect(KTX2Loader.prototype.init).toHaveBeenCalledTimes(1);
        expect(KTX2Loader.prototype.detectSupport).toHaveBeenCalledWith(renderer);
        expect(KTX2Loader.prototype.setWorkerLimit).toHaveBeenCalledWith(2);
        expect(GLTFLoader.prototype.setKTX2Loader).toHaveBeenCalledTimes(1);
        pool.pump();
        await flushJobs();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(GLTFLoader.prototype.parseAsync).toHaveBeenCalledWith(bytes, "http://localhost/materials/");
        expect(entry.state).toBe("decoded");
        expect(entry.material).toBe(pack.material);
        expect(entry.material.userData.housemaker_material_id).toBe(descriptor.materialId);
        expect(entry.textures).toEqual([pack.texture]);
        expect(entry.gpuBytes).toBe(86);
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
    });

    test("respects priority and shared download/decode limits", async () => {
        const { pool, entry, owner } = requestPack();
        entry.priority = 9;
        const payloads = new Map([["/materials/test.glb", bytes]]);
        for (let index = 0; index < 5; index += 1) {
            const payload = Uint8Array.from([index + 10]).buffer;
            const url = `/materials/${index}.glb`;
            payloads.set(url, payload);
            const sha256 = require("crypto").createHash("sha256").update(Buffer.from(payload)).digest("hex");
            pool.request(`pack-${index}`, { ...descriptor, sha256, byteSize: payload.byteLength }, url, owner).priority = index;
        }
        globalThis.fetch.mockImplementation(async (url) => ({ ok: true, arrayBuffer: async () => payloads.get(url) }));
        const finishDecodes = [];
        GLTFLoader.prototype.parseAsync.mockImplementation(() => new Promise((resolve) => finishDecodes.push(resolve)));
        pool.pump();
        expect(pool.activeDownloads).toBe(4);
        await flushJobs();
        expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual([
            "/materials/0.glb", "/materials/1.glb", "/materials/2.glb", "/materials/3.glb"
        ]);
        pool.pump();
        await flushJobs();
        expect(pool.activeDecodes).toBe(2);
        expect(GLTFLoader.prototype.parseAsync).toHaveBeenCalledTimes(2);
        pool.pump();
        expect(pool.activeDecodes).toBe(2);
        finishDecodes.forEach((resolve) => resolve(makePack()));
        await flushJobs();
    });

    test.each([3, 5])("rejects hash mismatches after %s exported retry attempts", async (maxAttempts) => {
        policy.failurePolicy.maxAttempts = maxAttempts;
        const { pool, entry } = requestPack();
        globalThis.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Uint8Array.from([9, 9, 9, 9]).buffer });
        const delays = [0, ...Array.from({ length: maxAttempts - 1 }, (_, index) => index === 0 ? 1000 : 3000)];
        for (const delay of delays) {
            jest.advanceTimersByTime(delay);
            pool.pump();
            await flushJobs();
        }
        expect(entry.state).toBe("error");
        expect(entry.attempts).toBe(maxAttempts);
        expect(entry.error.message).toMatch(/SHA-256 mismatch/);
        expect(GLTFLoader.prototype.parseAsync).not.toHaveBeenCalled();
        pool.pump();
        expect(globalThis.fetch).toHaveBeenCalledTimes(maxAttempts);
    });

    test("shares concurrent SHA downloads without aborting another owner", async () => {
        const { pool, entry, owner } = requestPack();
        const otherOwner = {};
        const second = pool.request("same-content", descriptor, "/materials/alias.glb", otherOwner);
        second.priority = 1;
        let resolveFetch;
        globalThis.fetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
        pool.pump();
        await flushJobs();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        entry.owners.delete(owner);
        pool.disposeEntry(entry);
        expect(globalThis.fetch.mock.calls[0][1].signal.aborted).toBe(false);
        resolveFetch({ ok: true, arrayBuffer: async () => bytes });
        await flushJobs();
        expect(second.state).toBe("downloaded");
        expect(pool.bytesDownloaded).toBe(bytes.byteLength);
        const pack = makePack();
        pack.geometry.setAttribute("tangent", new THREE.Float32BufferAttribute(
            new Float32Array(pack.geometry.attributes.position.count * 4), 4
        ));
        GLTFLoader.prototype.parseAsync.mockResolvedValue(pack);
        pool.pump();
        await flushJobs();
        expect(second.state).toBe("decoded");
        expect(second.carrierHasTangents).toBe(true);
    });

    test.each(["detectSupport", "init"])("fails open when KTX %s fails", async (method) => {
        const error = new Error("KTX support unavailable");
        if (method === "detectSupport") KTX2Loader.prototype.detectSupport.mockImplementation(() => { throw error; });
        else KTX2Loader.prototype.init.mockRejectedValue(error);
        let result;
        expect(() => { result = requestPack(); }).not.toThrow();
        await flushJobs();
        result.pool.pump();
        await flushJobs();
        expect(result.pool.decoderError).toBe(error);
        expect(result.entry.state).toBe("error");
        expect(result.entry.error).toBe(error);
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(GLTFLoader.prototype.parseAsync).not.toHaveBeenCalled();
    });

    test("honors exported concurrency above defaults", async () => {
        policy.scheduler.maxConcurrentDownloads = 5;
        policy.scheduler.maxConcurrentDecodes = 3;
        const { pool, owner } = requestPack();
        for (let index = 0; index < 5; index += 1) {
            pool.request(`extra-${index}`, descriptor, `/materials/extra-${index}.glb`, owner).priority = index + 1;
        }
        pool.pump();
        expect(pool.activeDownloads).toBe(5);
        await flushJobs();
        const resolveDecodes = [];
        GLTFLoader.prototype.parseAsync.mockImplementation(() => new Promise((resolve) => resolveDecodes.push(resolve)));
        pool.pump();
        await flushJobs();
        expect(pool.activeDecodes).toBe(3);
        expect(GLTFLoader.prototype.parseAsync).toHaveBeenCalledTimes(3);
        resolveDecodes.forEach((resolve) => resolve(makePack()));
        await flushJobs();
    });

    test("discards corrupt persistent bytes and survives cache quota failures", async () => {
        const cache = {
            match: jest.fn(async () => ({ arrayBuffer: async () => Uint8Array.from([0]).buffer })),
            delete: jest.fn(async () => true),
            put: jest.fn(async () => { throw new Error("Quota exceeded"); })
        };
        const open = jest.fn(async () => cache);
        Object.defineProperty(globalThis, "caches", { configurable: true, value: { open } });
        policy.cache.persistent = "cache-storage-if-available";
        const { pool, entry, owner } = requestPack();
        pool.pump();
        await flushJobs();
        expect(entry.state).toBe("downloaded");
        expect(cache.delete).toHaveBeenCalledTimes(1);
        expect(cache.put).toHaveBeenCalledTimes(1);
        const next = pool.request("second", descriptor, "/materials/second.glb", owner);
        next.priority = 0;
        pool.pump();
        await flushJobs();
        expect(next.state).toBe("downloaded");
        expect(open).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(pool.cacheHits).toBe(1);
    });

    test("counts compressed mip bytes and keeps shared resources alive", async () => {
        const texture = new THREE.CompressedTexture([
            { width: 4, height: 4, data: new Uint8Array(16) },
            { width: 2, height: 2, data: new Uint8Array(8) }
        ], 4, 4);
        const sharedMaterial = new THREE.MeshStandardMaterial({ map: texture });
        GLTFLoader.prototype.parseAsync.mockImplementation(async () => makePack(sharedMaterial));
        const { pool, entry, owner } = requestPack();
        const second = pool.request("second", descriptor, "/materials/second.glb", owner);
        second.priority = 0;
        pool.pump();
        await flushJobs();
        pool.pump();
        await flushJobs();
        const disposeTexture = jest.spyOn(texture, "dispose");
        const disposeMaterial = jest.spyOn(sharedMaterial, "dispose");
        expect(entry.gpuBytes).toBe(24);
        expect(second.gpuBytes).toBe(24);
        expect(pool.disposeEntry(entry)).toBe(false);
        entry.owners.delete(owner);
        expect(pool.disposeEntry(entry)).toBe(true);
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        second.owners.delete(owner);
        expect(pool.disposeEntry(second)).toBe(true);
        expect(disposeTexture).toHaveBeenCalledTimes(1);
        expect(disposeMaterial).toHaveBeenCalledTimes(1);
    });

    test("defers final cleanup across Strict Mode retain/release", async () => {
        const { pool, owner } = requestPack();
        await flushJobs();
        pool.release(owner);
        const again = acquireHouseMakerMaterialPool(renderer, policy, "/basis/");
        acquired.push(again);
        expect(again).toBe(pool);
        jest.runOnlyPendingTimers();
        expect(KTX2Loader.prototype.dispose).not.toHaveBeenCalled();
        again.release();
        jest.runOnlyPendingTimers();
        await flushJobs();
        expect(KTX2Loader.prototype.dispose).toHaveBeenCalledTimes(1);
    });

    test("cancels pending downloads and disposes late decoded carriers", async () => {
        const { pool, entry, owner } = requestPack();
        let resolveParse;
        GLTFLoader.prototype.parseAsync.mockImplementation(() => new Promise((resolve) => { resolveParse = resolve; }));
        pool.pump();
        await flushJobs();
        pool.pump();
        await flushJobs();
        const pack = makePack();
        const disposeTexture = jest.spyOn(pack.texture, "dispose");
        const disposeGeometry = jest.spyOn(pack.geometry, "dispose");
        pool.release(owner);
        jest.runOnlyPendingTimers();
        await flushJobs();
        resolveParse(pack);
        await flushJobs();
        expect(pool.entries.size).toBe(0);
        expect(entry.material).toBeNull();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(disposeTexture).toHaveBeenCalledTimes(1);
        expect(KTX2Loader.prototype.dispose).toHaveBeenCalledTimes(1);
    });
});

// ### Model texture filtering ###

/* eslint-disable testing-library/no-unnecessary-act -- Native R3F roots require act. */
describe("HouseMaker anisotropic filtering", () => {
    const nativeFiber = jest.requireActual("@react-three/fiber");
    let root;
    let fixtures;
    let assets;
    let renderer;
    let store;

    beforeEach(() => {
        fixtures = makeLoaderFixtures();
        assets = makeMeshAssets();
        fixtures.sourceScene.add(new THREE.Mesh(assets.geometry, assets.material));
        renderer = {
            render: jest.fn(),
            setPixelRatio: jest.fn(),
            setSize: jest.fn(),
            domElement: document.createElement("canvas"),
            shadowMap: {},
            capabilities: { getMaxAnisotropy: jest.fn(() => 16) }
        };
        useThree.mockReturnValue(renderer);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        useFrame.mockClear();
        jest.spyOn(console, "error").mockImplementation(() => {});
        nativeFiber.extend(THREE);
        root = nativeFiber.createRoot(renderer.domElement);
        root.configure({ gl: renderer, frameloop: "never", size: { width: 800, height: 600, top: 0, left: 0 } });
    });

    afterEach(async () => {
        await nativeFiber.act(async () => root.unmount());
        useThree.mockImplementation(() => ({ capabilities: { getMaxAnisotropy: () => 1 } }));
        useLoader.mockReset();
        jest.restoreAllMocks();
    });

    // Mount real meshes without requiring a WebGL context.
    async function mountLoader(props = {}, strict = false) {
        await nativeFiber.act(async () => {
            const loader = <HouseMakerLoader toursEnabled={false} {...props} />;
            store = root.render(strict ? <StrictMode>{loader}</StrictMode> : loader);
        });
        return store.getState().scene.children[0];
    }

    test("preserves original filtering until enabled", async () => {
        assets.texture.anisotropy = 2;
        await mountLoader();
        expect(assets.texture.anisotropy).toBe(2);
        expect(assets.texture.version).toBe(0);
        expect(renderer.capabilities.getMaxAnisotropy).not.toHaveBeenCalled();
    });

    test.each([[0, 1], [4, 4], [16, 8]])("clamps hardware maximum %s to %s", async (maximum, expected) => {
        renderer.capabilities.getMaxAnisotropy.mockReturnValue(maximum);
        await mountLoader({ anisotropicFilteringEnabled: true });
        expect(assets.texture.anisotropy).toBe(expected);
        expect(assets.texture.version).toBe(expected === 1 ? 0 : 1);
        await mountLoader({ anisotropicFilteringEnabled: false });
        expect(assets.texture.anisotropy).toBe(1);
        expect(assets.texture.version).toBe(expected === 1 ? 0 : 2);
    });

    test("tunes filtering without replacing model resources", async () => {
        const sceneRoot = await mountLoader({ anisotropicFilteringEnabled: true, anisotropy: 3 });
        const model = sceneRoot.children.find((object) => object.isScene);
        expect(assets.texture.anisotropy).toBe(3);
        renderer.capabilities.getMaxAnisotropy.mockReturnValue(4);
        await mountLoader({ anisotropicFilteringEnabled: true, anisotropy: 16 });
        expect(assets.texture.anisotropy).toBe(4);
        expect(sceneRoot.children.find((object) => object.isScene)).toBe(model);
        await mountLoader({ anisotropicFilteringEnabled: false, anisotropy: 16 });
        expect(assets.texture.anisotropy).toBe(1);
    });

    test("updates shared maps once and excludes environment targets", async () => {
        const originalAnisotropy = 2;
        assets.texture.anisotropy = originalAnisotropy;
        assets.material.normalMap = assets.texture;
        assets.material.roughnessMap = assets.texture;
        const cube = new THREE.CubeTexture();
        const environment = new THREE.Texture();
        const equirectangular = new THREE.Texture();
        equirectangular.mapping = THREE.EquirectangularReflectionMapping;
        const target = new THREE.WebGLRenderTarget(8, 8);
        assets.material.envMap = environment;
        assets.material.emissiveMap = target.texture;
        assets.material.metalnessMap = cube;
        assets.material.lightMap = equirectangular;
        const excludedTextures = [cube, environment, equirectangular, target.texture];
        const originalVersions = excludedTextures.map((texture) => texture.version);
        fixtures.sourceScene.add(new THREE.Mesh(assets.geometry, [assets.material, assets.material]));
        const disposeTexture = jest.spyOn(assets.texture, "dispose");
        const disposeMaterial = jest.spyOn(assets.material, "dispose");
        const disposeGeometry = jest.spyOn(assets.geometry, "dispose");
        await mountLoader({ anisotropicFilteringEnabled: true });
        expect(assets.texture.anisotropy).toBe(8);
        expect(assets.texture.version).toBe(1);
        excludedTextures.forEach((texture, index) => {
            expect(texture.anisotropy).toBe(1);
            expect(texture.version).toBe(originalVersions[index]);
        });
        await nativeFiber.act(async () => root.unmount());
        expect(assets.texture.anisotropy).toBe(originalAnisotropy);
        expect(assets.texture.version).toBe(2);
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeGeometry).not.toHaveBeenCalled();
        target.dispose();
    });

    test("covers half mirrors and separate instance-source textures", async () => {
        fixtures.sourceScene.children[0].userData.halfMesh = {
            uvMode: "reuse", mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        };
        const instanceAssets = makeMeshAssets();
        const source = new THREE.Mesh(instanceAssets.geometry, instanceAssets.material);
        source.name = "Textured source";
        const sourceScene = new THREE.Scene();
        sourceScene.add(source);
        fixtures.gltf.scenes.push(sourceScene);
        fixtures.manifest.instanceGroups = [{
            sourceNodeName: source.name,
            instances: [{ worldMatrix: new THREE.Matrix4().makeTranslation(3, 0, 2).toArray() }]
        }];
        const sceneRoot = await mountLoader({ anisotropicFilteringEnabled: true });
        const mirrors = sceneRoot.getObjectByName("HouseMaker mirrored models");
        const instance = sceneRoot.children.find((node) => node.isInstancedMesh);
        expect(mirrors.children[0].material.map).toBe(assets.texture);
        expect(instance.material.map).toBe(instanceAssets.texture);
        expect(assets.texture.anisotropy).toBe(8);
        expect(instanceAssets.texture.anisotropy).toBe(8);
        expect(assets.texture.version).toBe(1);
        expect(instanceAssets.texture.version).toBe(1);
        await mountLoader({ anisotropicFilteringEnabled: true, instancesEnabled: false });
        expect(assets.texture.anisotropy).toBe(8);
        expect(instanceAssets.texture.anisotropy).toBe(1);
    });

    test("survives Strict Mode, rerenders, GLB reloads, and unmount", async () => {
        await mountLoader({ anisotropicFilteringEnabled: true }, true);
        const initialVersion = assets.texture.version;
        expect(assets.texture.anisotropy).toBe(8);
        await mountLoader({ anisotropicFilteringEnabled: true, position: [2, 0, 0] }, true);
        expect(assets.texture.version).toBe(initialVersion);
        const originalTexture = assets.texture;
        const originalGeometry = assets.geometry;
        const disposeTexture = jest.spyOn(originalTexture, "dispose");
        fixtures = makeLoaderFixtures({ asset: { glb: "replacement.glb" } });
        assets = makeMeshAssets();
        fixtures.sourceScene.add(new THREE.Mesh(assets.geometry, assets.material));
        await mountLoader({ anisotropicFilteringEnabled: true, jsonFile: "replacement.json" }, true);
        expect(originalTexture.anisotropy).toBe(1);
        expect(assets.texture.anisotropy).toBe(8);
        expect(fixtures.sourceScene.children[0].geometry).not.toBe(originalGeometry);
        await nativeFiber.act(async () => root.unmount());
        expect(assets.texture.anisotropy).toBe(1);
        expect(disposeTexture).not.toHaveBeenCalled();
    });
});

// ### Object visibility classification ###

describe("HouseMaker non-surface classification", () => {
    test.each([
        ["furniture", { housemaker_object_id: "chair-a" }, true],
        ["explicit object atlas", { housemaker_atlas_type: "object" }, true],
        ["explicit surface atlas", { housemaker_atlas_type: "surface" }, false],
        ["explicit object atlas with older source labels", {
            housemaker_atlas_type: "object",
            housemaker_atlas_source_ids: ["surface-wall-texture:old-label"]
        }, true],
        ["explicit surface atlas with older object IDs", {
            housemaker_atlas_type: "surface",
            housemaker_object_id: "old-object-label",
            housemaker_atlas_source_ids: ["old-object-label"]
        }, false],
        ["unknown atlas type with legacy IDs", {
            housemaker_atlas_type: "unknown",
            housemaker_atlas_source_ids: ["chair-a"]
        }, true],
        ["door body", {
            housemakerDoorBody: { placementObjectId: "placement-a", bodyObjectId: "body-a" }
        }, true],
        ["door component", {
            housemakerDoorComponent: {
                placementObjectId: "placement-a",
                componentObjectId: "knob-a"
            }
        }, true],
        ["surface", { housemaker_surface_id: "level:2/wall:1:2" }, false],
        ["surface with an object ID", {
            housemaker_surface_id: "level:2/wall:1:2",
            housemaker_object_id: "wall-object"
        }, false],
        ["furniture atlas", {
            housemaker_atlas_source_ids: ["chair-a", "table-a"]
        }, true],
        ["surface atlas", {
            housemaker_atlas_source_ids: ["surface-wall-texture:wall-a"]
        }, false],
        ["mixed atlas", {
            housemaker_atlas_source_ids: ["chair-a", "surface-wall-texture:wall-a"]
        }, false],
        ["unclassified mesh", {}, false]
    ])("classifies %s without display-name assumptions", (label, userData, expected) => {
        const mesh = new THREE.Mesh();
        mesh.name = "[HALF] arbitrary display name";
        mesh.userData = userData;

        expect(isHouseMakerHideableObject(mesh)).toBe(expected);
    });

    test("inherits tagged parents while preserving explicitly tagged surfaces", () => {
        const furniture = new THREE.Group();
        furniture.userData.housemaker_object_id = "cabinet-a";
        const child = new THREE.Mesh();
        const taggedSurface = new THREE.Mesh();
        taggedSurface.userData.housemaker_surface_id = "level:0/floor";
        furniture.add(child, taggedSurface);

        expect(isHouseMakerHideableObject(child)).toBe(true);
        expect(isHouseMakerHideableObject(taggedSurface)).toBe(false);
    });

    test("inherits explicit atlas categories from exported parent nodes", () => {
        const parent = new THREE.Group();
        const mesh = new THREE.Mesh();
        parent.add(mesh);
        parent.userData.housemaker_atlas_type = "object";
        expect(isHouseMakerHideableObject(mesh)).toBe(true);

        parent.userData.housemaker_atlas_type = "surface";
        expect(isHouseMakerHideableObject(mesh, true)).toBe(false);
    });
});

// ### Native instance transforms ###

/* eslint-disable testing-library/no-unnecessary-act -- Native R3F roots require act. */
describe("HouseMaker native instance placement", () => {
    const nativeFiber = jest.requireActual("@react-three/fiber");
    let root;
    let store;
    let consoleError;

    beforeEach(() => {
        useFrame.mockClear();
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        nativeFiber.extend(THREE);
        const canvas = document.createElement("canvas");
        root = nativeFiber.createRoot(canvas);
        root.configure({
            gl: {
                render: jest.fn(),
                setPixelRatio: jest.fn(),
                setSize: jest.fn(),
                domElement: canvas,
                shadowMap: {},
            },
            frameloop: "never",
            size: { width: 800, height: 600, top: 0, left: 0 },
        });
    });

    afterEach(async () => {
        await nativeFiber.act(async () => root.unmount());
        useLoader.mockReset();
        consoleError.mockRestore();
    });

    test("preserves placements, fades, and shadows across native rerenders", async () => {
        const matrices = [
            new THREE.Matrix4().compose(new THREE.Vector3(1, 3, -5), new THREE.Quaternion(), new THREE.Vector3(2.3, 2, 2.4)),
            new THREE.Matrix4().compose(new THREE.Vector3(6, 3, 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(2.3, 2, 2.4)),
        ];
        const fixtures = makeLoaderFixtures({ instanceGroups: [{
            sourceNodeName: "Chair source",
            instances: matrices.map((matrix, index) => ({ id: `chair-${index}`, worldMatrix: matrix.toArray() })),
        }] });
        const source = new THREE.Group();
        source.name = "Chair source";
        const sourceMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
        sourceMesh.position.set(0.1, 0.2, 0.3);
        source.add(sourceMesh);
        const sourceScene = new THREE.Scene();
        sourceScene.add(source);
        fixtures.gltf.scenes.push(sourceScene);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        });
        const mesh = store.getState().scene.children[0].children.find((object) => object.isInstancedMesh);
        const fadeMaterial = mesh.material;
        const instanceBuffer = mesh.instanceMatrix;
        const sourceTransform = new THREE.Matrix4().makeTranslation(0.1, 0.2, 0.3);
        const actualMatrix = new THREE.Matrix4();
        matrices.forEach((matrix, index) => {
            mesh.getMatrixAt(index, actualMatrix);
            expectMatrixClose(actualMatrix, matrix.clone().multiply(sourceTransform), 6);
        });
        fireEvent.keyDown(window, { key: "a" });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.2);
        expect(mesh.material.opacity).toBeLessThan(1);

        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled position={[2, 0, 0]} /></StrictMode>);
        });
        expect(store.getState().scene.children[0].children.find((object) => object.isInstancedMesh)).toBe(mesh);
        expect(mesh.material).toBe(fadeMaterial);
        expect(mesh.instanceMatrix).toBe(instanceBuffer);
        expect(mesh.instanceMatrix.usage).toBe(THREE.StaticDrawUsage);
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        matrices.forEach((matrix, index) => {
            mesh.getMatrixAt(index, actualMatrix);
            expectMatrixClose(actualMatrix, matrix.clone().multiply(sourceTransform), 6);
        });

        const updatedMatrices = matrices.map((matrix) => matrix.clone().setPosition(12, 4, -8));
        updatedMatrices.push(new THREE.Matrix4().makeTranslation(18, 5, -2));
        fixtures.manifest = {
            ...fixtures.manifest,
            instanceGroups: [{
                sourceNodeName: source.name,
                instances: updatedMatrices.map((matrix, index) => ({ id: `chair-${index}`, worldMatrix: matrix.toArray() })),
            }],
        };
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        });
        const updatedMesh = store.getState().scene.children[0].children.find((object) => object.isInstancedMesh);
        expect(updatedMesh.count).toBe(3);
        updatedMatrices.forEach((matrix, index) => {
            updatedMesh.getMatrixAt(index, actualMatrix);
            expectMatrixClose(actualMatrix, matrix.clone().multiply(sourceTransform), 6);
        });
        expect(updatedMesh.instanceMatrix).not.toBe(instanceBuffer);
        const uploadedVersion = updatedMesh.instanceMatrix.version;
        fixtures.manifest = {
            ...fixtures.manifest,
            instanceGroups: [{
                sourceNodeName: source.name,
                instances: updatedMatrices.map((matrix, index) => ({
                    id: `chair-${index}`,
                    worldMatrix: matrix.clone().setPosition(3, 2, -1).toArray(),
                })),
            }],
        };
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        });
        expect(store.getState().scene.children[0].children.find((object) => object.isInstancedMesh)).toBe(updatedMesh);
        expect(updatedMesh.instanceMatrix.version).toBeGreaterThan(uploadedVersion);
        updatedMatrices.forEach((matrix, index) => {
            updatedMesh.getMatrixAt(index, actualMatrix);
            expectMatrixClose(actualMatrix, matrix.clone().setPosition(3, 2, -1).multiply(sourceTransform), 6);
        });
        expect(sourceMesh.material.opacity).toBe(1);
        expect(sourceMesh.castShadow).toBe(false);
        expect(sourceMesh.receiveShadow).toBe(false);
    });

    test("uses the exported sun and mounted target without fallback lighting", async () => {
        const light = makeDirectionalLight({
            name: "Sun light 1",
            position: [-7.6720720588939795, 5.53789022261146, -8.092185522353622],
            target: [-7.6720720588939795, 3.5314082578971626, -8.092185522353622],
            intensity: 1,
            castShadow: false,
        });
        const fixtures = makeLoaderFixtures({ version: 10, directionalLights: [light] });
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const lights = sceneRoot.children.filter((object) => object.isDirectionalLight);
        expect(lights).toHaveLength(1);
        expect(lights[0].name).toBe(light.name);
        expect(lights[0].position.toArray()).toEqual(light.position);
        expect(lights[0].target.position.toArray()).toEqual(light.target);
        expect(lights[0].target.parent).toBe(sceneRoot);
        expect(lights[0].intensity).toBe(1);
        expect(lights[0].castShadow).toBe(false);
        expect(lights[0].userData.houseMakerDirectionalLightId).toBe(light.id);
        expectShadowBoundsCovered(lights[0], new THREE.Box3().setFromObject(fixtures.sourceScene));
    });

    test.each([false, true])("tunes shadows and restores defaults for fallback %s", async (fallback) => {
        const light = makeDirectionalLight({ castShadow: true });
        const fixtures = makeLoaderFixtures({ directionalLights: fallback ? [] : [light] });
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled shadowMapSize={1024} />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        const position = sun.position.toArray();
        const targetPosition = target.position.toArray();
        const intensity = sun.intensity;
        const shadowCamera = sun.shadow.camera;
        const bounds = new THREE.Box3().setFromObject(fixtures.sourceScene);
        expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
        expect(sun.shadow.bias).toBe(-0.0001);
        expect(sun.shadow.normalBias).toBe(0.03);
        expect(sun.shadow.radius).toBeLessThan(-1);
        sun.shadow.map = new THREE.WebGLRenderTarget(1024, 1024);
        sun.shadow.mapPass = new THREE.WebGLRenderTarget(512, 512);
        const disposeMap = jest.spyOn(sun.shadow.map, "dispose");
        const disposePass = jest.spyOn(sun.shadow.mapPass, "dispose");
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled
                shadowMapSizeOverride={2048} shadowBias={-0.002} shadowNormalBias={0.08} />);
        });
        expect(sceneRoot.children.find((object) => object.isDirectionalLight)).toBe(sun);
        expect(sun.target).toBe(target);
        expect(sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
        expect(sun.shadow.bias).toBe(-0.002);
        expect(sun.shadow.normalBias).toBe(0.08);
        expect(sun.shadow.needsUpdate).toBe(true);
        expect(sun.shadow.camera).toBe(shadowCamera);
        expectShadowBoundsCovered(sun, bounds);
        expect(disposeMap).toHaveBeenCalledTimes(1);
        expect(disposePass).toHaveBeenCalledTimes(1);
        expect(sun.shadow.map).toBeNull();
        expect(sun.shadow.mapPass).toBeNull();
        sun.shadow.map = new THREE.WebGLRenderTarget(2048, 2048);
        const disposeOverride = jest.spyOn(sun.shadow.map, "dispose");
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled shadowMapSize={1024} />);
        });
        expect(disposeOverride).toHaveBeenCalledTimes(1);
        expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
        expect(sun.shadow.bias).toBe(-0.0001);
        expect(sun.shadow.normalBias).toBe(0.03);
        expect(sun.castShadow).toBe(true);
        expect(sun.position.toArray()).toEqual(position);
        expect(target.position.toArray()).toEqual(targetPosition);
        expect(sun.intensity).toBe(intensity);
    });

    test("orbits only the selected ID using exported axes and distance", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const otherLight = makeDirectionalLight({ id: "another-light", name: light.name });
        const fixtures = makeLoaderFixtures({
            directionalLights: [light, otherLight],
            sunlightOrbit: makeSunlightOrbit({ axis: [0, 4, 0], initialDirection: [2, 0, 0] })
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false} position={[12, 4, -9]} /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [sun, other] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        const target = sun.target;
        expect(target.position.toArray()).toEqual(light.target);
        useFrame.mock.calls.forEach(([frame]) => frame({}, 2));
        expect(sun.position.toArray()).toEqual(light.position);
        expect(target.position.x).toBeCloseTo(1);
        expect(target.position.y).toBeCloseTo(3);
        expect(target.position.z).toBeCloseTo(-5);
        expect(target.position.distanceTo(sun.position)).toBeCloseTo(3);
        target.matrix.elements.slice(12, 15).forEach((value, index) => {
            expect(value).toBeCloseTo([1, 3, -5][index]);
        });
        expect(other.target.position.toArray()).toEqual(otherLight.target);
        sceneRoot.updateWorldMatrix(true, true);
        target.getWorldPosition(new THREE.Vector3()).toArray().forEach((value, index) => {
            expect(value).toBeCloseTo([13, 7, -14][index]);
        });
        expect(target.parent).toBe(sceneRoot);
        expect(target.parent).not.toBe(sun);
    });

    test("keeps all house corners covered through a complete transformed sun orbit", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2], castShadow: true });
        const bounds = new THREE.Box3(new THREE.Vector3(-12, 0, -13), new THREE.Vector3(13, 12, 14));
        const sunlightOrbit = makeSunlightOrbit({ axis: [0, 0, 1] });
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><group position={[18, -3, 11]} rotation={[0.2, -0.4, 0.1]} scale={[2, 0.7, 1.5]}>
                <HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                    shadowBounds={bounds} shadowMapSize={2048} />
            </group></StrictMode>);
        });
        const parent = store.getState().scene.children[0];
        const sun = parent.children.find((object) => object.isDirectionalLight);
        const camera = sun.shadow.camera;
        const target = sun.target;
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        expectShadowBoundsCovered(sun, bounds);
        expect(camera.near).toBeLessThan(0);
        const traverse = jest.spyOn(parent, "traverse");
        for (let step = 0; step < 72; step += 1) {
            frame({}, 1 / 9);
            expectShadowBoundsCovered(sun, bounds);
            expect(sun.position.toArray()).toEqual(light.position);
            expect(sun.shadow.camera).toBe(camera);
            expect(sun.target).toBe(target);
        }
        expect(traverse).not.toHaveBeenCalled();
        expect(target.position.distanceTo(new THREE.Vector3(...light.target))).toBeCloseTo(0, 8);
        await nativeFiber.act(async () => {
            root.render(<StrictMode><group position={[-12, 8, -5]} rotation={[-0.1, 1.3, -0.4]} scale={[0.5, 3, 1.1]}>
                <HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                    shadowBounds={bounds} shadowMapSize={2048} />
            </group></StrictMode>);
        });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0);
        expectShadowBoundsCovered(sun, bounds);
        expect(parent.children.filter((object) => object.isDirectionalLight)).toEqual([sun]);
        await nativeFiber.act(async () => root.render(null));
        expect(sun.parent).toBeNull();
        expect(target.parent).toBeNull();
    });

    test("refits a static sun only when its loader transform changes", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 6, -5], castShadow: true });
        const bounds = new THREE.Box3(new THREE.Vector3(-20, -1, -8), new THREE.Vector3(18, 9, 17));
        await nativeFiber.act(async () => {
            store = root.render(<group><HouseMakerDirectionalLight light={light} shadowBounds={bounds} /></group>);
        });
        const parent = store.getState().scene.children[0];
        const sun = parent.children.find((object) => object.isDirectionalLight);
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const updateProjection = jest.spyOn(sun.shadow.camera, "updateProjectionMatrix");
        frame({}, 1 / 60);
        frame({}, 1 / 60);
        expect(updateProjection).not.toHaveBeenCalled();
        parent.position.set(35, -5, 12);
        parent.rotation.set(0.4, -0.3, 0.2);
        parent.scale.set(1.4, 0.8, 2.1);
        frame({}, 1 / 60);
        expect(updateProjection).toHaveBeenCalledTimes(1);
        expectShadowBoundsCovered(sun, bounds);
        expect(sun.position.toArray()).toEqual(light.position);
        expect(sun.target.position.toArray()).toEqual(light.target);
    });

    test.each([0, 2, 8, -1, 10, NaN])("tunes angular sun softness %s without changing authored light or phase", async (softness) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2], castShadow: true });
        const snapshot = JSON.stringify(light);
        const bounds = new THREE.Box3(new THREE.Vector3(-12, 0, -13), new THREE.Vector3(13, 12, 14));
        const sunlightOrbit = makeSunlightOrbit();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                shadowBounds={bounds} shadowMapSize={1024} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const camera = sun.shadow.camera;
        const target = sun.target;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const targetBefore = target.position.clone();
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                shadowBounds={bounds} shadowSoftness={softness} shadowMapSize={2048} /></StrictMode>);
        });
        const degrees = Number.isFinite(softness) ? Math.max(0, Math.min(8, softness)) : 2;
        const expectedAngle = Math.tan(THREE.MathUtils.degToRad(degrees / 2));
        expect(sun.shadow.radius).toBeCloseTo(-(1 + expectedAngle * (camera.far - camera.near) / (camera.right - camera.left)), 12);
        expect((-sun.shadow.radius - 1) * (camera.right - camera.left) / (camera.far - camera.near)).toBeCloseTo(expectedAngle, 12);
        expect(camera.right - camera.left).toBeCloseTo(camera.top - camera.bottom, 12);
        expect(sun.shadow.camera).toBe(camera);
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(targetBefore)).toBeCloseTo(0);
        expect(sun.position.toArray()).toEqual(light.position);
        expectShadowBoundsCovered(sun, bounds);
        expect(JSON.stringify(light)).toBe(snapshot);
    });

    test.each([30, 100])("keeps %s%% coverage fixed while changing softness before and after orbit", async (coverage) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2], castShadow: true });
        const fixtures = makeLoaderFixtures({
            directionalLights: [light],
            sunlightOrbit: makeSunlightOrbit(),
            instanceGroups: [{ sourceNodeName: "Chair source", instances: [{
                id: "chair-a", worldMatrix: new THREE.Matrix4().makeTranslation(12, 0, -8).toArray()
            }] }]
        });
        const resources = makeMeshAssets();
        const body = makeBody({ resources, halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] } }).body;
        const house = new THREE.Mesh(new THREE.BoxGeometry(25, 12, 27), resources.material);
        house.userData.housemaker_surface_id = "level:0/wall";
        fixtures.sourceScene.add(house, body);
        const source = new THREE.Mesh(resources.geometry, resources.material);
        source.name = "Chair source";
        const prototypes = new THREE.Scene();
        prototypes.add(source);
        fixtures.gltf.scenes.push(prototypes);
        const manifestBefore = JSON.stringify(fixtures.manifest);
        const environment = new THREE.Scene();
        environment.environment = resources.texture;
        environment.background = resources.texture;
        environment.environmentRotation.set(0.1, 0.2, 0.3);
        environment.backgroundRotation.set(-0.2, 0.4, -0.1);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled
                environmentScene={environment} shadowCoverage={coverage} shadowMapSize={1024} /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const camera = sun.shadow.camera;
        const target = sun.target;
        const objects = [];
        sceneRoot.traverse((object) => objects.push(object));
        const meshes = objects.filter((object) => object.isMesh).map((mesh) => ({
            mesh, geometry: mesh.geometry, material: mesh.material,
            castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, visible: mesh.visible
        }));
        const map = new THREE.WebGLRenderTarget(1024, 1024);
        const mapPass = new THREE.WebGLRenderTarget(512, 512);
        sun.shadow.map = map;
        sun.shadow.mapPass = mapPass;
        const dispose = [map, mapPass, resources.texture, resources.material, resources.geometry, house.geometry,
            ...new Set(meshes.map(({material}) => material))].map((resource) => jest.spyOn(resource, "dispose"));
        const mountedRoot = root;

        for (const elapsed of [0, 1.3]) {
            useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, elapsed);
            const planes = [camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far];
            const projection = camera.projectionMatrix.toArray();
            const inverseProjection = camera.projectionMatrixInverse.toArray();
            const worldInverse = camera.matrixWorldInverse.toArray();
            const shadowMatrix = sun.shadow.matrix.toArray();
            const targetBefore = target.position.toArray();
            const environmentBefore = environment.environmentRotation.toArray();
            const backgroundBefore = environment.backgroundRotation.toArray();

            for (const softness of [0, 2, 4, 8, -1, 10, NaN, Infinity, 2]) {
                await nativeFiber.act(async () => {
                    mountedRoot.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled
                        environmentScene={environment} shadowCoverage={coverage} shadowMapSize={1024}
                        shadowSoftness={softness} /></StrictMode>);
                });
                const degrees = Number.isFinite(softness) ? Math.max(0, Math.min(8, softness)) : 2;
                expect(sun.shadow.radius).toBeCloseTo(-(1 + Math.tan(THREE.MathUtils.degToRad(degrees / 2))
                    * (camera.far - camera.near) / (camera.right - camera.left)), 12);
                expect([camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far]).toEqual(planes);
                expect(camera.projectionMatrix.toArray()).toEqual(projection);
                expect(camera.projectionMatrixInverse.toArray()).toEqual(inverseProjection);
                expect(camera.matrixWorldInverse.toArray()).toEqual(worldInverse);
                expect(sun.shadow.matrix.toArray()).toEqual(shadowMatrix);
                expect(sun.shadow.camera).toBe(camera);
                expect(sun.shadow.map).toBe(map);
                expect(sun.shadow.mapPass).toBe(mapPass);
                expect(sun.target).toBe(target);
                expect(target.position.toArray()).toEqual(targetBefore);
                expect(environment.environmentRotation.toArray()).toEqual(environmentBefore);
                expect(environment.backgroundRotation.toArray()).toEqual(backgroundBefore);
                const currentObjects = [];
                sceneRoot.traverse((object) => currentObjects.push(object));
                expect(currentObjects).toEqual(objects);
                meshes.forEach(({mesh, geometry, material, castShadow, receiveShadow, visible}) => {
                    expect(mesh.geometry).toBe(geometry);
                    expect(mesh.material).toBe(material);
                    expect(mesh.castShadow).toBe(castShadow);
                    expect(mesh.receiveShadow).toBe(receiveShadow);
                    expect(mesh.visible).toBe(visible);
                });
            }
        }
        dispose.forEach((spy) => expect(spy).not.toHaveBeenCalled());
        expect(sun.position.toArray()).toEqual(light.position);
        expect(environment.environment).toBe(resources.texture);
        expect(environment.background).toBe(resources.texture);
        expect(JSON.stringify(fixtures.manifest)).toBe(manifestBefore);
    });

    test.each([10, 50, 100, 150, 200, 0, 250, NaN, Infinity])("scales sun shadow coverage %s without resetting orbit or resources", async (coverage) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2], castShadow: true });
        const snapshot = JSON.stringify(light);
        const bounds = new THREE.Box3(new THREE.Vector3(-12, 0, -13), new THREE.Vector3(13, 12, 14));
        const sunlightOrbit = makeSunlightOrbit();
        const environment = new THREE.Scene();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                shadowBounds={bounds} shadowMapSize={1024} environmentScene={environment} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const camera = sun.shadow.camera;
        const target = sun.target;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const width = camera.right - camera.left;
        const height = camera.top - camera.bottom;
        const {near, far} = camera;
        const targetBefore = target.position.clone();
        const environmentBefore = environment.environmentRotation.clone();
        const map = new THREE.WebGLRenderTarget(1024, 1024);
        sun.shadow.map = map;
        const dispose = jest.spyOn(map, "dispose");
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                shadowBounds={bounds} shadowMapSize={1024} environmentScene={environment} shadowCoverage={coverage} /></StrictMode>);
        });
        const scale = Number.isFinite(coverage) ? Math.max(10, Math.min(200, coverage)) / 100 : 1;
        expect(camera.right - camera.left).toBeCloseTo(width * scale, 10);
        expect(camera.top - camera.bottom).toBeCloseTo(height * scale, 10);
        expect(camera.near).toBe(near);
        expect(camera.far).toBe(far);
        expect((-sun.shadow.radius - 1) * (camera.right - camera.left) / (far - near))
            .toBeCloseTo(Math.tan(THREE.MathUtils.degToRad(1)), 12);
        expect(sun.shadow.camera).toBe(camera);
        expect(sun.shadow.map).toBe(map);
        expect(dispose).not.toHaveBeenCalled();
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(targetBefore)).toBeCloseTo(0);
        expect(environment.environmentRotation.toArray()).toEqual(environmentBefore.toArray());
        expect(sun.position.toArray()).toEqual(light.position);
        expect(JSON.stringify(light)).toBe(snapshot);
        if (scale >= 1) expectShadowBoundsCovered(sun, bounds);

        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                shadowBounds={bounds} shadowMapSize={1024} environmentScene={environment} /></StrictMode>);
        });
        expect(camera.right - camera.left).toBeCloseTo(width, 10);
        expect(target.position.distanceTo(targetBefore)).toBeCloseTo(0);
        expect(sun.shadow.map).toBe(map);
        expectShadowBoundsCovered(sun, bounds);
    });

    test.each([false, true])("passes shadow coverage only to the primary sun with fallback %s", async (fallback) => {
        const fixtures = makeLoaderFixtures({ directionalLights: fallback ? [] : [
            makeDirectionalLight({ castShadow: true }),
            makeDirectionalLight({ id: "secondary-light", castShadow: true })
        ] });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(25, 12, 27), new THREE.MeshStandardMaterial());
        mesh.name = "House surfaces";
        mesh.userData.housemaker_surface_id = "level:0/floor";
        fixtures.sourceScene.add(mesh);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} shadowsEnabled fallbackSunEnabled />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [sun, otherLight] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        const camera = sun.shadow.camera;
        const width = camera.right - camera.left;
        const material = sceneRoot.getObjectByName(mesh.name).material;
        const geometry = sceneRoot.getObjectByName(mesh.name).geometry;
        const otherProjection = otherLight?.shadow.camera.projectionMatrix.clone();
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader toursEnabled={false} shadowsEnabled fallbackSunEnabled shadowCoverage={50} />);
        });
        expect(camera.right - camera.left).toBeCloseTo(width / 2, 10);
        expect(sceneRoot.children.find((object) => object.isDirectionalLight)).toBe(sun);
        expect(sceneRoot.getObjectByName(mesh.name).material).toBe(material);
        expect(sceneRoot.getObjectByName(mesh.name).geometry).toBe(geometry);
        expect(otherLight?.shadow.camera.projectionMatrix.elements).toEqual(otherProjection?.elements);
        expect(otherLight?.shadow.radius).toBe(fallback ? undefined : 1);
    });

    test("includes distant instance placements and ordinary mirrors in exported sun coverage", async () => {
        const fixtures = makeLoaderFixtures({
            directionalLights: [makeDirectionalLight({ castShadow: true })],
            instanceGroups: [{
                sourceNodeName: "Chair source",
                instances: [
                    { id: "chair-a", worldMatrix: new THREE.Matrix4().makeTranslation(-90, 0, 45).toArray() },
                    { id: "chair-b", worldMatrix: new THREE.Matrix4().makeTranslation(80, 10, -60).toArray() }
                ]
            }]
        });
        const body = makeBody({ halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] } }).body;
        body.position.set(120, 2, 10);
        fixtures.sourceScene.add(body);
        const source = new THREE.Group();
        source.name = "Chair source";
        source.add(new THREE.Mesh(new THREE.BoxGeometry(4, 6, 8), new THREE.MeshStandardMaterial()));
        const prototypeScene = new THREE.Scene();
        prototypeScene.add(source);
        fixtures.gltf.scenes.push(prototypeScene);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} shadowsEnabled />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const bounds = new THREE.Box3().setFromObject(sceneRoot);
        expect(bounds.min.x).toBeLessThanOrEqual(-120);
        expect(bounds.max.x).toBeGreaterThanOrEqual(120);
        expect(bounds.min.z).toBe(-64);
        expect(bounds.max.z).toBe(49);
        expectShadowBoundsCovered(sun, bounds);
        expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    });

    test("keeps the owned sun shader on shared ordinary and instanced fade materials", async () => {
        const resources = makeMeshAssets();
        const body = makeBody({ resources, halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] } }).body;
        const fixtures = makeLoaderFixtures({
            instanceGroups: [{ sourceNodeName: "Chair source", instances: [{
                id: "chair-a", worldMatrix: new THREE.Matrix4().makeTranslation(12, 0, -8).toArray()
            }] }]
        });
        fixtures.sourceScene.add(body);
        const source = new THREE.Mesh(resources.geometry, resources.material);
        source.name = "Chair source";
        const prototypeScene = new THREE.Scene();
        prototypeScene.add(source);
        fixtures.gltf.scenes.push(prototypeScene);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} shadowsEnabled />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const model = sceneRoot.children.find((object) => object.isScene);
        const mirrors = sceneRoot.children.find((object) => object.name === "HouseMaker mirrored models");
        const instance = sceneRoot.children.find((object) => object.isInstancedMesh);
        const materials = [model.children[0].material, mirrors.children[0].material, instance.material];
        materials.forEach((material) => {
            const shader = { uniforms: {}, fragmentShader: "#include <shadowmap_pars_fragment>" };
            material.onBeforeCompile(shader, {});
            expect(shader.fragmentShader).toContain("houseMakerSunShadow");
            expect(material.customProgramCacheKey()).toContain(":housemaker-sun-pcss-v2");
            expect(material.map).toBe(resources.texture);
        });
        expect(new Set(materials).size).toBe(1);
        expect(source.material).toBe(resources.material);
        expect(instance.geometry).toBe(resources.geometry);
        expect(resources.material.onBeforeCompile.toString()).not.toContain("houseMakerSunShadow");
    });

    test("changes only the selected sun color without restarting its orbit", async () => {
        const otherLight = makeDirectionalLight({ id: "fill-light", color: "#123456" });
        const light = makeDirectionalLight({ color: "#ffcc99", intensity: 2.5, castShadow: true });
        const fixtures = makeLoaderFixtures({
            directionalLights: [otherLight, light],
            sunlightOrbit: makeSunlightOrbit(),
        });
        const manifestSnapshot = JSON.stringify(fixtures.manifest);
        const environmentScene = new THREE.Scene();
        const texture = new THREE.Texture();
        environmentScene.environment = texture;
        environmentScene.background = texture;
        const disposeTexture = jest.spyOn(texture, "dispose");
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                environmentScene={environmentScene} sunLightColor="#aAbBcC" /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [other, sun] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        const target = sun.target;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const targetBefore = target.position.clone();
        const environmentBefore = environmentScene.environmentRotation.clone();
        const backgroundBefore = environmentScene.backgroundRotation.clone();
        expect(sun.color.getHexString()).toBe("aabbcc");
        expect(other.color.getHexString()).toBe("123456");

        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                environmentScene={environmentScene} sunLightColor="#00ff00" /></StrictMode>);
        });
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toEqual([other, sun]);
        expect(sun.color.getHexString()).toBe("00ff00");
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(targetBefore)).toBeCloseTo(0);
        expect(environmentScene.environmentRotation.equals(environmentBefore)).toBe(true);
        expect(environmentScene.backgroundRotation.equals(backgroundBefore)).toBe(true);
        expect(sun.intensity).toBe(light.intensity);
        expect(sun.castShadow).toBe(light.castShadow);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(environmentScene.environmentRotation.y).toBeCloseTo(Math.PI / 2);

        const mountedRoot = root;
        for (const resetColor of [undefined, null, "#fff", "invalid", 123]) {
            await nativeFiber.act(async () => {
                mountedRoot.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                    environmentScene={environmentScene} sunLightColor="#00ff00" /></StrictMode>);
            });
            await nativeFiber.act(async () => {
                mountedRoot.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                    environmentScene={environmentScene} sunLightColor={resetColor} /></StrictMode>);
            });
            expect(sun.color.getHexString()).toBe("ffcc99");
            expect(other.color.getHexString()).toBe("123456");
            expect(sun.target).toBe(target);
            expect(environmentScene.environmentRotation.y).toBeCloseTo(Math.PI / 2);
        }
        expect(environmentScene.environment).toBe(texture);
        expect(environmentScene.background).toBe(texture);
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(JSON.stringify(fixtures.manifest)).toBe(manifestSnapshot);
    });

    test("selects a static exported sun before falling back to the first light", async () => {
        const firstLight = makeDirectionalLight({ id: "fill-light", color: "#123456" });
        const sunLight = makeDirectionalLight({ color: "#ffcc99" });
        const fixtures = makeLoaderFixtures({
            directionalLights: [firstLight, sunLight],
            sunlightOrbit: makeSunlightOrbit({ enabled: false }),
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} sunLightColor="#abcdef" />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [first, sun] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        expect(first.color.getHexString()).toBe("123456");
        expect(sun.color.getHexString()).toBe("abcdef");
        fixtures.manifest = { ...fixtures.manifest, sunlightOrbit: undefined };
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader toursEnabled={false} sunLightColor="#abcdef" />);
        });
        expect(first.color.getHexString()).toBe("abcdef");
        expect(sun.color.getHexString()).toBe("ffcc99");
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toEqual([first, sun]);
    });

    test("changes and resets the generated fallback sun color", async () => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled sunLightColor="#112233" />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        expect(sun.color.getHexString()).toBe("112233");
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled sunLightColor={null} />);
        });
        expect(sun.color.getHexString()).toBe("fff4e5");
        expect(sun.target).toBe(target);
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toEqual([sun]);
    });

    test.each([30, 60])("advances sunlight by elapsed time at %i Hz", async (frameRate) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} sunlightOrbit={makeSunlightOrbit()} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < frameRate * 2; index += 1) frame({}, 1 / frameRate);
        expect(sun.target.position.x).toBeCloseTo(1, 9);
        expect(sun.target.position.y).toBeCloseTo(3, 9);
        expect(sun.target.position.z).toBeCloseTo(-5, 9);
    });

    test("uses the explicit initial direction instead of deriving it", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const fixtures = makeLoaderFixtures({
            directionalLights: [light],
            sunlightOrbit: makeSunlightOrbit({ axis: [0, 0, 4], initialDirection: [0, -3, 0] })
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} />);
        });
        const sun = store.getState().scene.children[0].children.find((object) => object.isDirectionalLight);
        expect(sun.target.position.toArray()).toEqual([1, 0, -2]);
        useFrame.mock.calls.forEach(([frame]) => frame({}, 2));
        expect(sun.target.position.x).toBeCloseTo(4);
        expect(sun.target.position.y).toBeCloseTo(3);
        expect(sun.target.position.z).toBeCloseTo(-2);
    });

    test("preserves orbit phase across equivalent rerenders and resets changed metadata", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const halfwayTarget = target.position.clone();
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight
                light={{ ...light, position: [...light.position], target: [...light.target] }}
                sunlightOrbit={{ ...sunlightOrbit, axis: [...sunlightOrbit.axis], initialDirection: [...sunlightOrbit.initialDirection] }}
                shadowMapSize={2048}
            /></StrictMode>);
        });
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(halfwayTarget)).toBeCloseTo(0);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(target.position.z).toBeCloseTo(-5);
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                sunlightOrbit={makeSunlightOrbit({ speedDegreesPerSecond: 90 })} /></StrictMode>);
        });
        expect(target.position.toArray()).toEqual(light.target);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(target.position.z).toBeCloseTo(-5);
    });

    test.each([0, 90, 360, 450, -90])("applies manual sun angle %s without changing authored transforms", async (angle) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        const snapshot = JSON.stringify({ light, sunlightOrbit });
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                sunlightOrbit={sunlightOrbit} sunOrbitPaused sunOrbitAngle={angle} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const expected = new THREE.Vector3(3, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(angle))
            .add(new THREE.Vector3(...light.position));
        expect(sun.target.position.distanceTo(expected)).toBeCloseTo(0, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 5);
        expect(sun.target.position.distanceTo(expected)).toBeCloseTo(0, 9);
        expect(sun.position.toArray()).toEqual(light.position);
        expect(JSON.stringify({ light, sunlightOrbit })).toBe(snapshot);
    });

    test("pauses at the current phase and resumes without resetting manual angles", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                sunlightOrbit={sunlightOrbit} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const phase45 = target.position.clone();
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitPaused /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 20);
        expect(target.position.distanceTo(phase45)).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitPaused sunOrbitAngle={90} /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const phase135 = target.position.clone();
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight
            light={{ ...light }} sunlightOrbit={{ ...sunlightOrbit }} sunOrbitAngle={90}
            shadowSoftness={6} showSunRays /></StrictMode>));
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(phase135)).toBeCloseTo(0, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(target.position.distanceTo(new THREE.Vector3(-2, 3, -2))).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitPaused /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(...light.target))).toBeCloseTo(0, 9);
    });

    test("reapplies repeated manual commands without resetting ordinary pauses", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} sunOrbitAngleRevision={1}
                sunOrbitPaused /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} sunOrbitAngleRevision={1} /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        const phase135 = target.position.clone();
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} sunOrbitAngleRevision={1}
            sunOrbitPaused /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 20);
        expect(target.position.distanceTo(phase135)).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} sunOrbitAngleRevision={1} /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.1);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngle={90} sunOrbitAngleRevision={2}
            sunOrbitPaused /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngleRevision={3} /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(...light.target))).toBeCloseTo(0, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(target.position.distanceTo(new THREE.Vector3(...light.target))).toBeGreaterThan(1);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} sunOrbitAngleRevision={4} /></StrictMode>));
        expect(target.position.distanceTo(new THREE.Vector3(...light.target))).toBeCloseTo(0, 9);
    });

    test.each([NaN, Infinity, -Infinity, "90"])("ignores invalid manual angle %s", async (angle) => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                sunlightOrbit={makeSunlightOrbit()} sunOrbitPaused sunOrbitAngle={angle} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.target.position.toArray().every(Number.isFinite)).toBe(true);
    });

    test("controls a static legacy sun without inventing automatic rotation", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const environment = new THREE.Scene();
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} environmentScene={environment}
                sunOrbitAngle={90} showSunRays />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        expect(sun.target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
        expect(environment.environmentRotation.y).toBeCloseTo(Math.PI / 2);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 120);
        expect(sun.target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
    });

    test("keeps manual and paused sun angles synchronized with HDRI offsets", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        const environment = new THREE.Scene();
        environment.environmentRotation.y = -0.2;
        environment.backgroundRotation.y = -0.3;
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                sunlightOrbit={sunlightOrbit} environmentScene={environment}
                sunOrbitAngle={90} sunOrbitPaused /></StrictMode>);
        });
        expect(environment.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 2);
        expect(environment.backgroundRotation.y).toBeCloseTo(-0.3 + Math.PI / 2);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 120);
        expect(environment.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 2);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} environmentScene={environment}
            sunOrbitAngle={90} /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.1);
        expect(environment.environmentRotation.y).toBeCloseTo(-0.2 + THREE.MathUtils.degToRad(94.5));
        await nativeFiber.act(async () => root.render(null));
        expect(environment.environmentRotation.y).toBe(-0.2);
        expect(environment.backgroundRotation.y).toBe(-0.3);
    });

    test("reports live angles only for the open panel at bounded frequency", async () => {
        const light = makeDirectionalLight();
        const sunlightOrbit = makeSunlightOrbit();
        const onSunOrbitAngleChange = jest.fn();
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} onSunOrbitAngleChange={onSunOrbitAngleChange} />));
        let frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onSunOrbitAngleChange).not.toHaveBeenCalled();
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} onSunOrbitAngleChange={onSunOrbitAngleChange} showSunRays />));
        onSunOrbitAngleChange.mockClear();
        frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onSunOrbitAngleChange.mock.calls.length).toBeGreaterThan(2);
        expect(onSunOrbitAngleChange.mock.calls.length).toBeLessThanOrEqual(5);
        const angles = onSunOrbitAngleChange.mock.calls.map(([angle]) => angle);
        expect(angles.every((angle) => Number.isFinite(angle) && angle >= 0 && angle < 360)).toBe(true);
        expect(angles[angles.length - 1]).toBeGreaterThanOrEqual(80);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            sunlightOrbit={sunlightOrbit} onSunOrbitAngleChange={onSunOrbitAngleChange} />));
        onSunOrbitAngleChange.mockClear();
        frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onSunOrbitAngleChange).not.toHaveBeenCalled();
    });

    test("mounts one parallel ray guide outside light targets and collisions", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const sunlightOrbit = makeSunlightOrbit();
        const bounds = new THREE.Box3(new THREE.Vector3(-12, 0, -13), new THREE.Vector3(13, 12, 14));
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><group position={[10, -3, 8]} rotation={[0.2, -0.3, 0.1]} scale={[2, 0.8, 1.4]}>
                <HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                    sunOrbitAngle={90} sunOrbitPaused showSunRays shadowBounds={bounds} />
            </group></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        sceneRoot.updateWorldMatrix(true, true);
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const guides = sceneRoot.children.filter((object) => object.userData.housemakerSunRays);
        expect(guides).toHaveLength(1);
        const guide = guides[0];
        expect(guide.isLineSegments).toBe(true);
        expect(guide.name).toBe("HouseMaker sun ray guides");
        expect(guide.parent).toBe(sun.parent);
        expect(guide.parent).not.toBe(sun);
        expect(guide.castShadow).toBe(false);
        expect(guide.receiveShadow).toBe(false);
        expect(guide.material.depthTest).toBe(false);
        expect(guide.material.depthWrite).toBe(false);
        expect(guide.geometry.getAttribute("position").count).toBe(150);
        expectShadowBoundsCovered(sun, bounds);
        const intersections = [];
        guide.raycast(new THREE.Raycaster(), intersections);
        expect(intersections).toEqual([]);
        const positions = guide.geometry.getAttribute("position");
        const direction = sun.target.getWorldPosition(new THREE.Vector3())
            .sub(sun.getWorldPosition(new THREE.Vector3())).normalize();
        for (let index = 0; index < positions.count; index += 6) {
            const start = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(guide.matrixWorld);
            const end = new THREE.Vector3().fromBufferAttribute(positions, index + 1).applyMatrix4(guide.matrixWorld);
            expect(end.sub(start).normalize().dot(direction)).toBeCloseTo(1, 6);
        }
        const geometry = guide.geometry;
        const material = guide.material;
        guide.onBeforeRender(null, { overrideMaterial: { isMeshNormalMaterial: true } });
        expect(geometry.drawRange.start).toBeGreaterThan(positions.count);
        expect(geometry.drawRange.count).toBe(0);
        guide.onAfterRender();
        expect(geometry.drawRange).toEqual({ start: 0, count: Infinity });
        guide.onBeforeRender(null, { overrideMaterial: { isMeshDepthMaterial: true } });
        expect(geometry.drawRange.start).toBeGreaterThan(positions.count);
        expect(geometry.drawRange.count).toBe(0);
        guide.onBeforeRender(null, { overrideMaterial: null });
        expect(geometry.drawRange).toEqual({ start: 0, count: Infinity });
        expect(guide.geometry).toBe(geometry);
        expect(geometry.getAttribute("position")).toBe(positions);
        expect(guide.material).toBe(material);
        const disposeGeometry = jest.spyOn(geometry, "dispose");
        const disposeMaterial = jest.spyOn(material, "dispose");
        await nativeFiber.act(async () => root.render(<StrictMode><group position={[10, -3, 8]} rotation={[0.2, -0.3, 0.1]} scale={[2, 0.8, 1.4]}>
            <HouseMakerDirectionalLight light={light} sunlightOrbit={sunlightOrbit}
                sunOrbitAngle={180} sunOrbitPaused showSunRays shadowBounds={bounds} shadowSoftness={6} />
        </group></StrictMode>));
        expect(sceneRoot.children.filter((object) => object.userData.housemakerSunRays)).toEqual([guide]);
        expect(guide.geometry).toBe(geometry);
        expect(guide.material).toBe(material);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        sceneRoot.updateWorldMatrix(true, true);
        const rotatedStart = new THREE.Vector3().fromBufferAttribute(positions, 0).applyMatrix4(guide.matrixWorld);
        const rotatedEnd = new THREE.Vector3().fromBufferAttribute(positions, 1).applyMatrix4(guide.matrixWorld);
        const rotatedDirection = sun.target.getWorldPosition(new THREE.Vector3())
            .sub(sun.getWorldPosition(new THREE.Vector3())).normalize();
        expect(rotatedEnd.sub(rotatedStart).normalize().dot(rotatedDirection)).toBeCloseTo(1, 6);
        expectShadowBoundsCovered(sun, bounds);
        await nativeFiber.act(async () => root.render(null));
        expect(guide.parent).toBeNull();
        expect(sun.target.parent).toBeNull();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(disposeMaterial).toHaveBeenCalledTimes(1);
    });

    test("limits angle controls and guide ownership to the selected exported sun", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const other = makeDirectionalLight({ id: "another-light", position: [-3, 5, 2], target: [0, 0, 0] });
        const fixtures = makeLoaderFixtures({ directionalLights: [other, light], sunlightOrbit: makeSunlightOrbit() });
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        const geometry = fixtures.sourceScene.children[0].geometry;
        const material = fixtures.sourceScene.children[0].material;
        const disposeSourceGeometry = jest.spyOn(geometry, "dispose");
        const disposeSourceMaterial = jest.spyOn(material, "dispose");
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                sunOrbitPaused sunOrbitAngle={90} showSunRays /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [unchanged, sun] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        expect(unchanged.target.position.toArray()).toEqual(other.target);
        expect(sun.target.position.distanceTo(new THREE.Vector3(1, 3, -5))).toBeCloseTo(0, 9);
        expect(sceneRoot.children.filter((object) => object.userData.housemakerSunRays)).toHaveLength(1);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
            sunOrbitPaused sunOrbitAngle={90} /></StrictMode>));
        expect(sceneRoot.children.filter((object) => object.userData.housemakerSunRays)).toHaveLength(0);
        expect(unchanged.target.position.toArray()).toEqual(other.target);
        await nativeFiber.act(async () => root.render(null));
        expect(disposeSourceGeometry).not.toHaveBeenCalled();
        expect(disposeSourceMaterial).not.toHaveBeenCalled();
    });

    test("replaces guide ownership on manifest reload without stale scene objects", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const fixtures = makeLoaderFixtures({ directionalLights: [light], sunlightOrbit: makeSunlightOrbit() });
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                sunOrbitPaused sunOrbitAngle={90} showSunRays /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const oldSun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const oldGuide = sceneRoot.children.find((object) => object.userData.housemakerSunRays);
        const disposeGeometry = jest.spyOn(oldGuide.geometry, "dispose");
        const disposeMaterial = jest.spyOn(oldGuide.material, "dispose");
        fixtures.manifest = {
            ...fixtures.manifest,
            directionalLights: [makeDirectionalLight({ id: "replacement-sun" })],
            sunlightOrbit: makeSunlightOrbit({ lightId: "replacement-sun" })
        };
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
            sunOrbitPaused sunOrbitAngle={90} showSunRays jsonFile="replacement.json" /></StrictMode>));
        expect(oldSun.parent).toBeNull();
        expect(oldSun.target.parent).toBeNull();
        expect(oldGuide.parent).toBeNull();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(disposeMaterial).toHaveBeenCalledTimes(1);
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toHaveLength(1);
        expect(sceneRoot.children.filter((object) => object.userData.housemakerSunRays)).toHaveLength(1);
        const replacement = sceneRoot.children.find((object) => object.userData.housemakerSunRays);
        expect(replacement).not.toBe(oldGuide);
        await nativeFiber.act(async () => root.render(null));
        expect(replacement.parent).toBeNull();
    });

    test("toggles orbit and reloads without leaving stale lights or targets", async () => {
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const fixtures = makeLoaderFixtures({ directionalLights: [light], sunlightOrbit: makeSunlightOrbit() });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} />);
        });
        const sceneRoot = store.getState().scene.children[0];
        const sun = sceneRoot.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        useFrame.mock.calls.forEach(([frame]) => frame({}, 1));
        fixtures.manifest = { ...fixtures.manifest, sunlightOrbit: { ...fixtures.manifest.sunlightOrbit, enabled: false } };
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} />));
        expect(sun.target).toBe(target);
        expect(target.position.toArray()).toEqual(light.target);
        useFrame.mock.calls.slice(-3).forEach(([frame]) => frame({}, 1));
        expect(target.position.toArray()).toEqual(light.target);
        fixtures.manifest = {
            ...fixtures.manifest,
            directionalLights: [makeDirectionalLight({ id: "replacement-sun" })],
            sunlightOrbit: null
        };
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} jsonFile="replacement.json" />));
        expect(sun.parent).toBeNull();
        expect(target.parent).toBeNull();
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toHaveLength(1);
        const replacement = sceneRoot.children.find((object) => object.isDirectionalLight);
        const replacementTarget = replacement.target;
        await nativeFiber.act(async () => root.render(null));
        expect(replacement.parent).toBeNull();
        expect(replacementTarget.parent).toBeNull();
    });

    test("keeps HDRI lighting and background phase-locked to the exported sun", async () => {
        const environmentScene = new THREE.Scene();
        const texture = new THREE.Texture();
        environmentScene.environment = texture;
        environmentScene.background = texture;
        environmentScene.environmentIntensity = 0.35;
        environmentScene.backgroundIntensity = 0.8;
        const disposeTexture = jest.spyOn(texture, "dispose");
        const light = makeDirectionalLight({ position: [1, 3, -2], target: [4, 3, -2] });
        const otherLight = makeDirectionalLight({ id: "another-light" });
        const fixtures = makeLoaderFixtures({
            directionalLights: [light, otherLight],
            sunlightOrbit: makeSunlightOrbit(),
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} />);
        });
        useFrame.mock.calls.slice(-3).forEach(([frame]) => frame({}, 2));
        const [sun, other] = store.getState().scene.children[0].children.filter((object) => object.isDirectionalLight);
        expect(sun.target.position.z).toBeCloseTo(-5);
        expect(other.target.position.toArray()).toEqual(otherLight.target);
        expect(environmentScene.environmentRotation.y).toBeCloseTo(Math.PI / 2);
        expect(environmentScene.backgroundRotation.y).toBeCloseTo(Math.PI / 2);
        expect(environmentScene.environment).toBe(texture);
        expect(environmentScene.background).toBe(texture);
        expect(environmentScene.environmentIntensity).toBe(0.35);
        expect(environmentScene.backgroundIntensity).toBe(0.8);
        expect(disposeTexture).not.toHaveBeenCalled();
    });

    test.each([{ axis: [0, 0, 1] }, { axis: [1, 2, -3] }])("rotates HDRI around exported axis $axis with distinct initial offsets", async ({ axis: exportedAxis }) => {
        const environmentScene = new THREE.Scene();
        environmentScene.environmentRotation.set(0.2, -0.3, 0.4, "YXZ");
        environmentScene.backgroundRotation.set(-0.1, 0.6, -0.2, "ZYX");
        const environmentBaseline = environmentScene.environmentRotation.clone();
        const backgroundBaseline = environmentScene.backgroundRotation.clone();
        const axis = new THREE.Vector3(...exportedAxis).normalize();
        const phase = Math.PI / 2;
        await nativeFiber.act(async () => {
            root.render(<HouseMakerDirectionalLight
                light={makeDirectionalLight()}
                sunlightOrbit={makeSunlightOrbit({ axis: axis.toArray() })}
                environmentScene={environmentScene}
            />);
        });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 2);

        // Match Three's negated-Euler environment sampling convention.
        [
            [environmentScene.environmentRotation, environmentBaseline],
            [environmentScene.backgroundRotation, backgroundBaseline],
        ].forEach(([actual, baseline]) => {
            const expectedSampling = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                -baseline.x, -baseline.y, -baseline.z, baseline.order
            )).multiply(new THREE.Matrix4().makeRotationAxis(axis, -phase));
            const actualSampling = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                -actual.x, -actual.y, -actual.z, actual.order
            ));
            expectMatrixClose(actualSampling, expectedSampling);
        });
    });

    test("preserves HDRI phase through Strict Mode rerenders and restores offsets", async () => {
        const environmentScene = new THREE.Scene();
        environmentScene.environmentRotation.y = -0.2;
        environmentScene.backgroundRotation.y = -0.3;
        const light = makeDirectionalLight();
        const sunlightOrbit = makeSunlightOrbit();
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight
                light={light} sunlightOrbit={sunlightOrbit} environmentScene={environmentScene}
            /></StrictMode>);
        });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight
                light={{ ...light, target: [...light.target] }}
                sunlightOrbit={{ ...sunlightOrbit, axis: [...sunlightOrbit.axis] }}
                environmentScene={environmentScene} shadowMapSize={2048}
            /></StrictMode>);
        });
        expect(environmentScene.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 4);
        expect(environmentScene.backgroundRotation.y).toBeCloseTo(-0.3 + Math.PI / 4);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(environmentScene.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 2);
        expect(environmentScene.backgroundRotation.y).toBeCloseTo(-0.3 + Math.PI / 2);
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight
                light={light} sunlightOrbit={{ ...sunlightOrbit, enabled: false }} environmentScene={environmentScene}
            /></StrictMode>);
        });
        expect(environmentScene.environmentRotation.y).toBe(-0.2);
        expect(environmentScene.backgroundRotation.y).toBe(-0.3);
        await nativeFiber.act(async () => {
            root.render(<StrictMode><HouseMakerDirectionalLight
                light={light} sunlightOrbit={sunlightOrbit} environmentScene={environmentScene}
            /></StrictMode>);
        });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(environmentScene.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 4);
        expect(environmentScene.backgroundRotation.y).toBeCloseTo(-0.3 + Math.PI / 4);
        await nativeFiber.act(async () => root.render(null));
        expect(environmentScene.environmentRotation.y).toBe(-0.2);
        expect(environmentScene.backgroundRotation.y).toBe(-0.3);
    });

    test("keeps new static exports unchanged until an explicit day-night command", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const fixtures = makeLoaderFixtures({ version: 10, directionalLights: [light] });
        const manifestSnapshot = JSON.stringify(fixtures.manifest);
        const environment = new THREE.Scene();
        const dayNightEnvironment = makeDayNightEnvironment();
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                environmentScene={environment} dayNightSettings={makeDayNightSettings()}
                dayNightEnvironment={dayNightEnvironment} /></StrictMode>);
        });
        const sun = store.getState().scene.children[0].children.find((object) => object.isDirectionalLight);
        useFrame.mock.calls.forEach(([frame]) => frame({}, 120));
        expect(sun.position.toArray()).toEqual(light.position);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(2.7);
        expect(sun.color.getHexString()).toBe("ffffff");
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
        expect(dayNightEnvironment.current.prepare).not.toHaveBeenCalled();
        expect(environment.environmentRotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
        expect(environment.backgroundRotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
        expect(JSON.stringify(fixtures.manifest)).toBe(manifestSnapshot);
    });

    test("runs a single day-night transition without exported orbit metadata", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const snapshot = JSON.stringify(light);
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1, dayNightDuration: 8 });
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const initialDirection = target.position.clone().sub(sun.position).normalize();
        const initialColor = sun.color.clone();
        for (let index = 0; index < 3; index += 1) frame({}, 1);
        const noonDirection = target.position.clone().sub(sun.position).normalize();
        expect(noonDirection.y).toBeLessThan(initialDirection.y);
        expect(sun.color.equals(initialColor)).toBe(false);
        expect(sun.intensity).toBeGreaterThan(0);
        for (let index = 0; index < 5; index += 1) frame({}, 1);
        expect(target.position.y).toBeGreaterThan(sun.position.y);
        expect(sun.intensity).toBe(0);
        expect(dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1].blend).toBe(1);
        const nightPosition = target.position.clone();
        const nightColor = sun.color.clone();
        frame({}, 60);
        expect(target.position.distanceTo(nightPosition)).toBeCloseTo(0, 9);
        expect(sun.color.equals(nightColor)).toBe(true);
        expect(sun.position.toArray()).toEqual(light.position);
        expect(target.position.distanceTo(sun.position)).toBeCloseTo(new THREE.Vector3(...light.target)
            .distanceTo(new THREE.Vector3(...light.position)), 9);
        expect(JSON.stringify(light)).toBe(snapshot);
    });

    test("defaults to a three-second transition when duration is omitted", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1,
                    dayNightDuration: undefined })} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        frame({}, 1.5);
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            progress: 50, playing: true, playbackDirection: 1
        }));
        frame({}, 1.5);
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            progress: 100, playing: false, stage: "Night"
        }));
        expect(sun.intensity).toBe(0);
    });

    test.each([30, 60])("stops both playback directions exactly after three seconds at %s Hz", async (frequency) => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        for (let index = 0; index < 3 * frequency; index += 1) {
            useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1 / frequency);
        }
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            progress: 100, playing: false, stage: "Night"
        }));
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={{ ...settings, dayNightAction: "reverse", dayNightCommand: 2 }}
            dayNightEnvironment={dayNightEnvironment} />));
        for (let index = 0; index < 3 * frequency; index += 1) {
            useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1 / frequency);
        }
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            progress: 0, playing: false, stage: "Morning", playbackDirection: -1
        }));
    });

    test("reverses through the exact same sun and HDRI path without replacing resources", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7,
            castShadow: true });
        const environment = new THREE.Scene();
        environment.environmentRotation.set(0.1, -0.2, 0.3);
        environment.backgroundRotation.set(-0.1, 0.2, -0.3);
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        const snapshot = JSON.stringify(light);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light} environmentScene={environment}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>);
        });
        const scene = store.getState().scene;
        const sun = scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        const children = [...scene.children];
        dayNightEnvironment.current.reset.mockClear();
        const samples = [];
        for (let index = 0; index <= 4; index += 1) {
            if (index > 0) useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.75);
            samples.push({
                target: target.position.clone(), color: sun.color.clone(), intensity: sun.intensity,
                environment: dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1],
                environmentRotation: environment.environmentRotation.clone(),
                backgroundRotation: environment.backgroundRotation.clone()
            });
        }
        expect(sun.userData.housemakerDayNight.progress).toBe(100);
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            environmentScene={environment} dayNightEnvironment={dayNightEnvironment}
            dayNightSettings={{ ...settings, dayNightAction: "reverse", dayNightCommand: 2 }} /></StrictMode>));
        expect(target.position.distanceTo(samples[4].target)).toBeCloseTo(0, 9);
        for (let index = 3; index >= 0; index -= 1) {
            useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.75);
            const expected = samples[index];
            const actual = dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1];
            expect(target.position.distanceTo(expected.target)).toBeCloseTo(0, 9);
            expect(sun.color.equals(expected.color)).toBe(true);
            expect(sun.intensity).toBeCloseTo(expected.intensity, 9);
            expect(actual.blend).toBeCloseTo(expected.environment.blend, 9);
            expect(actual.tint.equals(expected.environment.tint)).toBe(true);
            expect(actual.environmentIntensity).toBeCloseTo(expected.environment.environmentIntensity, 9);
            expect(actual.backgroundIntensity).toBeCloseTo(expected.environment.backgroundIntensity, 9);
            expect(environment.environmentRotation.toArray()).toEqual(expected.environmentRotation.toArray());
            expect(environment.backgroundRotation.toArray()).toEqual(expected.backgroundRotation.toArray());
        }
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            active: true, playing: false, playbackDirection: -1, progress: 0, stage: "Morning"
        }));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(target.position.distanceTo(samples[0].target)).toBeCloseTo(0, 9);
        expect(sun.castShadow).toBe(true);
        expect(sun.target).toBe(target);
        expect(scene.children).toEqual(children);
        expect(dayNightEnvironment.current.reset).not.toHaveBeenCalled();
        expect(JSON.stringify(light)).toBe(snapshot);
    });

    test("changes playback direction without jumping or replaying rerendered commands", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        let settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1.2);
        const forwardTarget = sun.target.position.clone();
        settings = { ...settings, dayNightAction: "reverse", dayNightCommand: 2 };
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        expect(sun.target.position.distanceTo(forwardTarget)).toBeCloseTo(0, 9);
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(40, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.3);
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(30, 9);
        const reverseTarget = sun.target.position.clone();
        settings = { ...settings, dayNightAction: "play", dayNightCommand: 3 };
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        expect(sun.target.position.distanceTo(reverseTarget)).toBeCloseTo(0, 9);
        expect(sun.userData.housemakerDayNight.playbackDirection).toBe(1);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.3);
        expect(sun.target.position.distanceTo(forwardTarget)).toBeCloseTo(0, 9);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={{ ...light }}
            dayNightSettings={{ ...settings }} dayNightEnvironment={dayNightEnvironment} shadowSoftness={6} />));
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(40, 9);
        expect(sun.target.position.distanceTo(forwardTarget)).toBeCloseTo(0, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.3);
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(50, 9);
    });

    test("pauses and resumes reverse playback before holding the morning endpoint", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        let settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        const onDayNightStatusChange = jest.fn();
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} dayNightPanelOpen
                onDayNightStatusChange={onDayNightStatusChange}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        settings = { ...settings, dayNightAction: "reverse", dayNightCommand: 2 };
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light} dayNightPanelOpen
            onDayNightStatusChange={onDayNightStatusChange}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.6);
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(80, 9);
        const target = sun.target.position.clone();
        settings = { ...settings, dayNightAction: "pause", dayNightCommand: 3 };
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light} dayNightPanelOpen
            onDayNightStatusChange={onDayNightStatusChange}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.distanceTo(target)).toBeCloseTo(0, 9);
        settings = { ...settings, dayNightAction: "resume", dayNightCommand: 4 };
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light} dayNightPanelOpen
            onDayNightStatusChange={onDayNightStatusChange}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        expect(onDayNightStatusChange.mock.calls[onDayNightStatusChange.mock.calls.length - 1][0])
            .toEqual(expect.objectContaining({ playing: true, playbackDirection: -1 }));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.6);
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(60, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            active: true, playing: false, progress: 0, playbackDirection: -1, stage: "Morning"
        }));
        expect(sun.intensity).toBeGreaterThan(0);
        const morningTarget = sun.target.position.clone();
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.distanceTo(morningTarget)).toBeCloseTo(0, 9);
    });

    test("ignores reverse commands before a transition has started", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment({ ready: false });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "reverse", dayNightCommand: 1 })}
                dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(light.intensity);
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({ active: false, playing: false, progress: 0 }));
        expect(dayNightEnvironment.current.prepare).not.toHaveBeenCalled();
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
    });

    test.each([false, true])("preserves queued reverse playback while waiting for the environment, failure=%s", async (fails) => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment({ ready: false });
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 75 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const scene = store.getState().scene;
        const sun = scene.children.find((object) => object.isDirectionalLight);
        const children = [...scene.children];
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={{ ...settings, dayNightAction: "reverse", dayNightCommand: 2 }}
            dayNightEnvironment={dayNightEnvironment} />));
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        frame({}, 60);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(light.intensity);
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
        expect(dayNightEnvironment.current.prepare).toHaveBeenCalledTimes(1);
        if (fails) dayNightEnvironment.current.error = new Error("Night HDRI unavailable");
        else dayNightEnvironment.current.ready = true;
        frame({}, 0.3);
        const expectedStatus = fails
            ? { active: false, playing: false, error: "Night HDRI unavailable" }
            : { active: true, playing: true, playbackDirection: -1 };
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining(expectedStatus));
        expect(sun.userData.housemakerDayNight.progress).toBeCloseTo(fails ? 0 : 65, 9);
        expect(sun.target.position.equals(new THREE.Vector3(...light.target))).toBe(fails);
        expect(sun.intensity === light.intensity).toBe(fails);
        expect(dayNightEnvironment.current.update.mock.calls.length > 0).toBe(!fails);
        expect(scene.children).toEqual(children);
        expect(dayNightEnvironment.current.prepare).toHaveBeenCalledTimes(1);
    });

    test("previews elevation, sun color, and environment without pitching the horizon", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const environment = new THREE.Scene();
        environment.environmentRotation.y = -0.2;
        environment.backgroundRotation.y = 0.3;
        const dayNightEnvironment = makeDayNightEnvironment();
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} environmentScene={environment}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1,
                    dayNightProgress: 30, dayNightMaxElevation: 70 })}
                dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const direction = sun.target.position.clone().sub(sun.position).normalize();
        expect(direction.y).toBeLessThan(-0.7);
        const sample = dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1];
        expect(sample.tint.isColor).toBe(true);
        expect(sample.blend).toBeGreaterThanOrEqual(0);
        expect(sample.blend).toBeLessThanOrEqual(1);
        expect(Number.isFinite(sample.environmentIntensity)).toBe(true);
        expect(Number.isFinite(sample.backgroundIntensity)).toBe(true);
        expect(environment.environmentRotation.x).toBeCloseTo(0, 9);
        expect(environment.environmentRotation.z).toBeCloseTo(0, 9);
        expect(environment.backgroundRotation.x).toBeCloseTo(0, 9);
        expect(environment.backgroundRotation.z).toBeCloseTo(0, 9);
        const target = sun.target.position.clone();
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.distanceTo(target)).toBeCloseTo(0, 9);
    });

    test("waits for the night environment before changing the exported daylight", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment({ ready: false });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 })}
                dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 12; index += 1) frame({}, 1);
        expect(dayNightEnvironment.current.prepare).toHaveBeenCalledTimes(1);
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(light.intensity);
        dayNightEnvironment.current.ready = true;
        frame({}, 0.1);
        expect(dayNightEnvironment.current.update).toHaveBeenCalled();
        expect(sun.target.position.distanceTo(new THREE.Vector3(...light.target))).toBeGreaterThan(0.1);
    });

    test("waits for a late-mounted environment and prepares it only once", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = { current: null };
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 })}
                dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        frame({}, 1);
        expect(sun.target.position.toArray()).toEqual(light.target);
        const mountedEnvironment = makeDayNightEnvironment({ ready: false });
        dayNightEnvironment.current = mountedEnvironment.current;
        for (let index = 0; index < 10; index += 1) frame({}, 0.1);
        expect(mountedEnvironment.current.prepare).toHaveBeenCalledTimes(1);
        expect(mountedEnvironment.current.update).not.toHaveBeenCalled();
        expect(sun.target.position.toArray()).toEqual(light.target);
        mountedEnvironment.current.ready = true;
        frame({}, 0.1);
        expect(mountedEnvironment.current.prepare).toHaveBeenCalledTimes(1);
        expect(mountedEnvironment.current.update).toHaveBeenCalled();
        expect(sun.target.position.distanceTo(new THREE.Vector3(...light.target))).toBeGreaterThan(0.1);
    });

    test("cancels a pending transition before its environment finishes loading", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment({ ready: false });
        const settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        expect(dayNightEnvironment.current.prepare).toHaveBeenCalledTimes(1);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={{ ...settings, dayNightAction: "reset", dayNightCommand: 2 }}
            dayNightEnvironment={dayNightEnvironment} />));
        dayNightEnvironment.current.ready = true;
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 8);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(light.intensity);
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
        expect(sun.userData.housemakerDayNight).toEqual(expect.objectContaining({
            active: false, playing: false, progress: 0, ready: true
        }));
    });

    test("retains portable daylight when the night environment fails", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment({ ready: false, error: new Error("Night HDRI unavailable") });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 })}
                dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.position.toArray()).toEqual(light.position);
        expect(sun.intensity).toBe(light.intensity);
        expect(sun.color.getHexString()).toBe("ffffff");
        expect(dayNightEnvironment.current.update).not.toHaveBeenCalled();
    });

    test("pauses, resumes, and resets without replaying an existing command", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        let settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 2);
        const movingTarget = sun.target.position.clone();
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={{ ...light }}
            dayNightSettings={{ ...settings }} dayNightEnvironment={dayNightEnvironment} shadowSoftness={6} /></StrictMode>));
        expect(sun.target.position.distanceTo(movingTarget)).toBeCloseTo(0, 9);
        settings = { ...settings, dayNightAction: "pause", dayNightCommand: 2 };
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 20);
        expect(sun.target.position.distanceTo(movingTarget)).toBeCloseTo(0, 9);
        settings = { ...settings, dayNightAction: "resume", dayNightCommand: 3 };
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 1);
        expect(sun.target.position.distanceTo(movingTarget)).toBeGreaterThan(0.1);
        settings = { ...settings, dayNightAction: "reset", dayNightCommand: 4 };
        await nativeFiber.act(async () => root.render(<StrictMode><HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>));
        expect(sun.target.position.toArray()).toEqual(light.target);
        expect(sun.intensity).toBe(light.intensity);
        expect(sun.color.getHexString()).toBe("ffffff");
        expect(dayNightEnvironment.current.reset).toHaveBeenCalled();
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.toArray()).toEqual(light.target);
    });

    test("updates preview settings live without restarting or allocating scene resources", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 30 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const scene = store.getState().scene;
        const sun = scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        const direction = target.position.clone().sub(sun.position).normalize();
        const intensity = sun.intensity;
        const children = [...scene.children];
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={{ ...settings, dayNightMaxElevation: 30, dayNightSunStrength: 0.5,
                dayNightDayBrightness: 0.7 }} dayNightEnvironment={dayNightEnvironment} />));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.1);
        const lowerDirection = target.position.clone().sub(sun.position).normalize();
        expect(lowerDirection.y).toBeGreaterThan(direction.y);
        expect(sun.intensity).toBeCloseTo(intensity * 0.5, 9);
        expect(sun.target).toBe(target);
        expect(scene.children).toEqual(children);
        expect(dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1].environmentIntensity)
            .toBeGreaterThan(0.35);
    });

    test("adjusts night sky brightness independently from ambient lighting", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const scene = store.getState().scene;
        const sun = scene.children.find((object) => object.isDirectionalLight);
        const target = sun.target;
        const children = [...scene.children];
        const nightPosition = target.position.clone();
        expect(dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1])
            .toEqual(expect.objectContaining({ blend: 1, environmentIntensity: 0.12, backgroundIntensity: 0.15 }));
        expect(sun.intensity).toBe(0);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={{ ...settings, dayNightNightSkyBrightness: 0.4 }}
            dayNightEnvironment={dayNightEnvironment} />));
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.1);
        expect(dayNightEnvironment.samples[dayNightEnvironment.samples.length - 1])
            .toEqual(expect.objectContaining({ blend: 1, environmentIntensity: 0.12, backgroundIntensity: 0.4 }));
        expect(sun.intensity).toBe(0);
        expect(sun.target).toBe(target);
        expect(target.position.distanceTo(nightPosition)).toBeCloseTo(0, 9);
        expect(scene.children).toEqual(children);
    });

    test("reports day-night progress only to the open panel at bounded frequency", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "play", dayNightCommand: 1 });
        const onDayNightStatusChange = jest.fn();
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment}
            onDayNightStatusChange={onDayNightStatusChange} />));
        let frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onDayNightStatusChange).not.toHaveBeenCalled();
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment}
            onDayNightStatusChange={onDayNightStatusChange} dayNightPanelOpen />));
        onDayNightStatusChange.mockClear();
        frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onDayNightStatusChange.mock.calls.length).toBeGreaterThan(2);
        expect(onDayNightStatusChange.mock.calls.length).toBeLessThanOrEqual(5);
        onDayNightStatusChange.mock.calls.forEach(([status]) => {
            expect(status.ready).toBe(true);
            expect(status.active).toBe(true);
            expect(status.playing).toBe(true);
            expect(status.progress).toBeGreaterThan(0);
            expect(status.progress).toBeLessThan(100);
            expect(typeof status.stage).toBe("string");
        });
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment}
            onDayNightStatusChange={onDayNightStatusChange} />));
        onDayNightStatusChange.mockClear();
        frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        for (let index = 0; index < 60; index += 1) frame({}, 1 / 60);
        expect(onDayNightStatusChange).not.toHaveBeenCalled();
    });

    test("lets manual sun-angle commands cancel the transition and restore daylight", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const environment = new THREE.Scene();
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} environmentScene={environment}
                sunOrbitAngle={0} dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        expect(sun.intensity).toBe(0);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            environmentScene={environment} sunOrbitAngle={90} sunOrbitAngleRevision={1}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        const expected = new THREE.Vector3(...light.target).sub(new THREE.Vector3(...light.position))
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).add(new THREE.Vector3(...light.position));
        expect(sun.target.position.distanceTo(expected)).toBeCloseTo(0, 9);
        expect(sun.intensity).toBe(light.intensity);
        expect(sun.color.getHexString()).toBe("ffffff");
        expect(dayNightEnvironment.current.reset).toHaveBeenCalled();
        expect(environment.environmentRotation.y).toBeCloseTo(Math.PI / 2, 9);
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 60);
        expect(sun.target.position.distanceTo(expected)).toBeCloseTo(0, 9);
    });

    test("restores original HDRI offsets when the first manual angle follows night", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const environment = new THREE.Scene();
        environment.environmentRotation.y = -0.2;
        environment.backgroundRotation.y = 0.3;
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await nativeFiber.act(async () => {
            store = root.render(<HouseMakerDirectionalLight light={light} environmentScene={environment}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />);
        });
        const sun = store.getState().scene.children.find((object) => object.isDirectionalLight);
        expect(sun.intensity).toBe(0);
        expect(environment.environmentRotation.y).not.toBe(-0.2);
        await nativeFiber.act(async () => root.render(<HouseMakerDirectionalLight light={light}
            environmentScene={environment} sunOrbitAngle={90} sunOrbitAngleRevision={1}
            dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} />));
        expect(sun.intensity).toBe(light.intensity);
        expect(dayNightEnvironment.current.reset).toHaveBeenCalled();
        expect(environment.environmentRotation.y).toBeCloseTo(-0.2 + Math.PI / 2, 9);
        expectMatrixClose(new THREE.Matrix4().makeRotationFromEuler(environment.backgroundRotation),
            new THREE.Matrix4().makeRotationY(0.3 + Math.PI / 2));
        const expected = new THREE.Vector3(...light.target).sub(new THREE.Vector3(...light.position))
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).add(new THREE.Vector3(...light.position));
        expect(sun.target.position.distanceTo(expected)).toBeCloseTo(0, 9);
    });

    test("changes only the selected sun and preserves GLB resources during the transition", async () => {
        const light = makeDirectionalLight({ position: [0, 12, 0], target: [3, 0, -2], intensity: 2.7 });
        const other = makeDirectionalLight({ id: "fill-light", position: [3, 4, 5], target: [0, 0, 0], color: "#aaccee" });
        const fixtures = makeLoaderFixtures({ version: 10, directionalLights: [light, other] });
        const assets = makeMeshAssets();
        const mesh = new THREE.Mesh(assets.geometry, assets.material);
        fixtures.sourceScene.add(mesh);
        const disposeGeometry = jest.spyOn(assets.geometry, "dispose");
        const disposeMaterial = jest.spyOn(assets.material, "dispose");
        const disposeTexture = jest.spyOn(assets.texture, "dispose");
        const dayNightEnvironment = makeDayNightEnvironment();
        const settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false}
                dayNightSettings={settings} dayNightEnvironment={dayNightEnvironment} /></StrictMode>);
        });
        const sceneRoot = store.getState().scene.children[0];
        const [sun, fill] = sceneRoot.children.filter((object) => object.isDirectionalLight);
        expect(sun.intensity).toBe(0);
        expect(sun.target.position.y).toBeGreaterThan(sun.position.y);
        expect(fill.position.toArray()).toEqual(other.position);
        expect(fill.target.position.toArray()).toEqual(other.target);
        expect(fill.intensity).toBe(other.intensity);
        expect(fill.color.getHexString()).toBe("aaccee");
        expect(sceneRoot.children.filter((object) => object.isDirectionalLight)).toHaveLength(2);
        dayNightEnvironment.current.reset.mockClear();
        await nativeFiber.act(async () => root.render(null));
        expect(dayNightEnvironment.current.reset).toHaveBeenCalledTimes(1);
        expect(sun.parent).toBeNull();
        expect(sun.target.parent).toBeNull();
        expect(fill.parent).toBeNull();
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(mesh.material).toBe(assets.material);
        expect(mesh.geometry).toBe(assets.geometry);
    });

    test("restores HDRI offsets when scene ownership changes or the manifest reloads", async () => {
        const environmentScene = new THREE.Scene();
        environmentScene.environmentRotation.set(0.2, 0.3, 0.4);
        environmentScene.backgroundRotation.set(-0.4, -0.3, -0.2);
        const environmentBaseline = environmentScene.environmentRotation.clone();
        const backgroundBaseline = environmentScene.backgroundRotation.clone();
        const fixtures = makeLoaderFixtures({
            directionalLights: [makeDirectionalLight()],
            sunlightOrbit: makeSunlightOrbit(),
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} />));
        useFrame.mock.calls.slice(-2).forEach(([frame]) => frame({}, 1));
        expect(environmentScene.environmentRotation.equals(environmentBaseline)).toBe(false);
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} />));
        expect(environmentScene.environmentRotation.equals(environmentBaseline)).toBe(true);
        expect(environmentScene.backgroundRotation.equals(backgroundBaseline)).toBe(true);
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} />));
        useFrame.mock.calls.slice(-2).forEach(([frame]) => frame({}, 1));
        fixtures.manifest = { ...fixtures.manifest, sunlightOrbit: null };
        await nativeFiber.act(async () => root.render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} jsonFile="replacement.json" />));
        expect(environmentScene.environmentRotation.equals(environmentBaseline)).toBe(true);
        expect(environmentScene.backgroundRotation.equals(backgroundBaseline)).toBe(true);
    });
});
/* eslint-enable testing-library/no-unnecessary-act */

// ### Exported fixture lights and emissive faces ###

/* eslint-disable testing-library/no-unnecessary-act */
describe("HouseMaker fixture lighting", () => {
    const nativeFiber = jest.requireActual("@react-three/fiber");
    let root;
    let store;
    let fixtures;
    let settings;
    let environment;
    let elapsed;
    let consoleError;
    let consoleWarning;

    beforeEach(() => {
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarning = jest.spyOn(console, "warn").mockImplementation(() => {});
        fixtures = makeFixtureLightingExport();
        settings = makeDayNightSettings();
        environment = makeDayNightEnvironment();
        elapsed = 0;
        useFrame.mockImplementation(nativeFiber.useFrame);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        nativeFiber.extend(THREE);
        const canvas = document.createElement("canvas");
        root = nativeFiber.createRoot(canvas);
        root.configure({
            gl: { render: jest.fn(), setPixelRatio: jest.fn(), setSize: jest.fn(), domElement: canvas, shadowMap: {} },
            frameloop: "never", size: { width: 800, height: 600, top: 0, left: 0 }
        });
    });

    afterEach(async () => {
        await nativeFiber.act(async () => root.unmount());
        useFrame.mockReset();
        useLoader.mockReset();
        consoleError.mockRestore();
        consoleWarning.mockRestore();
    });

    // Mount actual frame subscriptions, avoiding stale mocked callbacks.
    async function mount(props = {}) {
        useFrame.mockClear();
        await nativeFiber.act(async () => {
            store = root.render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled
                dayNightSettings={settings} dayNightEnvironment={environment} {...props} /></StrictMode>);
        });
        step(0);
    }

    // Advance all current subscriptions without needing an actual GPU.
    function step(delta) {
        elapsed += delta;
        nativeFiber.advance(elapsed, false, store.getState());
    }

    // Read native light objects rather than React host props.
    function fixtureLights() {
        const lights = [];
        store.getState().scene.traverse((node) => {
            if (node.isPointLight || node.isSpotLight) lights.push(node);
        });
        return lights;
    }

    // Read all visible and mirrored geometry carriers consistently.
    function fixtureMeshes() {
        const meshes = [];
        store.getState().scene.traverse((node) => { if (node.isMesh) meshes.push(node); });
        return meshes;
    }

    test.each([undefined, [], {}])("keeps exports without valid fixture arrays working", async (records) => {
        fixtures.manifest.objectLights = records;
        fixtures.manifest.faceLighting = undefined;
        await mount();
        expect(fixtureLights()).toHaveLength(0);
        expect(fixtureMeshes()).toHaveLength(2);
        expect(fixtures.material.emissiveIntensity).toBe(1);
        expect(fixtures.bulb.material).toBe(fixtures.material);
    });

    test("mounts exactly one point light per exported placement", async () => {
        const snapshot = JSON.stringify(fixtures.manifest);
        await mount({ position: [3, 1, -2] });
        const lights = fixtureLights();
        expect(lights).toHaveLength(3);
        lights.forEach((light, index) => {
            const exported = fixtures.manifest.objectLights[index];
            expect(light.isPointLight).toBe(true);
            expect(light.position.toArray()).toEqual(exported.position);
            expect(light.getWorldPosition(new THREE.Vector3()).toArray())
                .toEqual(exported.position.map((coordinate, axis) => coordinate + [3, 1, -2][axis]));
            expect(light.name).toBe(exported.name);
            expect(light.distance).toBe(8);
            expect(light.color.getHexString()).toBe("ffe0b2");
            expect(light.castShadow).toBe(true);
            expect(light.intensity).toBe(0);
            expect(light.userData.houseMakerObjectLightId).toBe(exported.id);
        });
        const mounted = [...lights];
        await mount({ position: [3, 1, -2], shadowSoftness: 5 });
        expect(fixtureLights()).toEqual(mounted);
        expect(JSON.stringify(fixtures.manifest)).toBe(snapshot);
    });

    test.each([
        [0, 0], [61, 0], [62, 0], [81, 0.5], [100, 1]
    ])("scales exported fixture intensity at %s percent progress", async (progress, factor) => {
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: progress });
        await mount();
        fixtureLights().forEach((light, index) => {
            expect(light.intensity).toBeCloseTo(fixtures.manifest.objectLights[index].intensity * factor, 9);
            expect(light.castShadow).toBe(true);
        });
    });

    test("reverses, pauses, resumes, scrubs, and resets the same light objects", async () => {
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        const lights = fixtureLights();
        expect(lights[0].intensity).toBe(1.11);
        settings = { ...settings, dayNightAction: "reverse", dayNightCommand: 2 };
        await mount();
        step(0.57);
        expect(lights[0].intensity).toBeCloseTo(1.11 * 0.5, 9);
        settings = { ...settings, dayNightAction: "pause", dayNightCommand: 3 };
        await mount();
        const paused = lights[0].intensity;
        step(3);
        expect(lights[0].intensity).toBe(paused);
        settings = { ...settings, dayNightAction: "resume", dayNightCommand: 4 };
        await mount();
        step(0.57);
        expect(lights[0].intensity).toBeCloseTo(0, 9);
        settings = { ...settings, dayNightAction: "preview", dayNightCommand: 5, dayNightProgress: 100 };
        await mount();
        expect(lights[0].intensity).toBe(1.11);
        settings = { ...settings, dayNightAction: "reset", dayNightCommand: 6 };
        await mount();
        expect(lights[0].intensity).toBe(0);
        expect(fixtureLights()).toEqual(lights);
    });

    test("mounts absolute spot targets as siblings with native cone values", async () => {
        fixtures.manifest.objectLights = [makeObjectLight({
            type: "spot", position: [8, 4, -3], target: [-2, 1, 5],
            coneAngleDegrees: 42, penumbra: 0.45, rangeMeters: 12, intensity: 4
        })];
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount({ position: [2, -1, 3] });
        const [light] = fixtureLights();
        expect(light.isSpotLight).toBe(true);
        expect(light.position.toArray()).toEqual([8, 4, -3]);
        expect(light.target.position.toArray()).toEqual([-2, 1, 5]);
        expect(light.target.parent).toBe(light.parent);
        expect(light.target.parent).not.toBe(light);
        expect(light.target.matrixWorld.elements.slice(12, 15)).toEqual([0, 0, 8]);
        expect(light.angle).toBeCloseTo(THREE.MathUtils.degToRad(42), 9);
        expect(light.penumbra).toBe(0.45);
        expect(light.distance).toBe(12);
        expect(light.intensity).toBe(4);
        expect(light.castShadow).toBe(true);
        const target = light.target;
        await nativeFiber.act(async () => root.render(null));
        expect(light.parent).toBeNull();
        expect(target.parent).toBeNull();
    });

    test("isolates emissive bulb primitives while preserving their PBR resources", async () => {
        const materialSnapshot = fixtures.material.clone();
        const originalUv = Array.from(fixtures.geometry.attributes.uv.array);
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        const parts = fixtureMeshes();
        expect(parts).toHaveLength(2);
        const [housing, bulb] = parts;
        expect(bulb.material).not.toBe(housing.material);
        expect(bulb.material).not.toBe(fixtures.material);
        expect(bulb.material.isMeshStandardMaterial).toBe(true);
        expect(bulb.material.emissive.r * bulb.material.emissiveIntensity).toBeCloseTo(1.11, 9);
        expect(bulb.material.emissive.g * bulb.material.emissiveIntensity).toBeCloseTo(0.8273986725898301, 9);
        expect(bulb.material.emissive.b * bulb.material.emissiveIntensity).toBeCloseTo(0.494173325913013, 9);
        expect(housing.material.emissive.equals(materialSnapshot.emissive)).toBe(true);
        expect(housing.material.emissiveIntensity).toBe(materialSnapshot.emissiveIntensity);
        [housing, bulb].forEach((mesh, index) => {
            expect(mesh.material.map).toBe(fixtures.texture);
            expect(mesh.material.emissiveMap).toBe(fixtures.texture);
            expect(mesh.material.roughness).toBe(fixtures.material.roughness);
            expect(mesh.material.metalness).toBe(fixtures.material.metalness);
            expect(mesh.geometry).toBe(index === 0 ? fixtures.housing.geometry : fixtures.bulb.geometry);
            expect(mesh.material.side).toBe(THREE.FrontSide);
        });
        expect(housing.castShadow).toBe(true);
        expect(bulb.castShadow).toBe(false);
        expect(Array.from(fixtures.geometry.attributes.uv.array)).toEqual(originalUv);
        expect(fixtures.material.emissive.equals(materialSnapshot.emissive)).toBe(true);
        expect(fixtures.bulb.material).toBe(fixtures.material);
        expect(fixtures.bulb.userData.housemakerFaceLighting).toBeUndefined();
        expect(fixtures.bulb.geometry.userData.housemakerFaceLighting).toBeUndefined();
        expect(fixtures.material.userData.housemakerFaceLighting).toBeUndefined();
        settings = { ...settings, dayNightProgress: 81, dayNightCommand: 2 };
        await mount();
        expect(bulb.material.emissive.r * bulb.material.emissiveIntensity).toBeCloseTo(1.11 * 0.5, 9);
        settings = { ...settings, dayNightAction: "reset", dayNightCommand: 3 };
        await mount();
        expect(bulb.material.emissive.r * bulb.material.emissiveIntensity).toBe(0);
    });

    test("does not let failed night preparation turn fixture lights on", async () => {
        environment = makeDayNightEnvironment({ ready: false, error: new Error("Night HDRI unavailable") });
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        step(10);
        expect(fixtureLights().every((light) => light.intensity === 0)).toBe(true);
        expect(fixtures.material.emissive.getHex()).toBe(0);
    });

    test("restores daytime fixture lighting when manual sun controls cancel night", async () => {
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount({ sunOrbitAngle: 0 });
        const lights = fixtureLights();
        expect(lights[0].intensity).toBe(1.11);
        await mount({ sunOrbitAngle: 90, sunOrbitAngleRevision: 1 });
        expect(fixtureLights()).toEqual(lights);
        expect(lights.every((light) => light.intensity === 0)).toBe(true);
        expect(fixtureMeshes().every((mesh) => mesh.material.emissive.r * mesh.material.emissiveIntensity === 0)).toBe(true);
    });

    test("keeps lit fixtures visible while ordinary objects stay hidden", async () => {
        const chair = new THREE.Mesh(fixtures.geometry, fixtures.material);
        chair.name = "Ordinary chair sharing the fixture atlas";
        chair.userData.housemaker_object_id = "chair-a";
        fixtures.sourceScene.add(chair);
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        const runtimeChair = fixtureMeshes().find((mesh) => mesh.name === chair.name);
        const fixturesOnly = fixtureMeshes().filter((mesh) => mesh.isInstancedMesh);
        const lights = fixtureLights();
        fireEvent.keyDown(window, { key: "a" });
        step(0.5);
        expect(runtimeChair.visible).toBe(false);
        expect(runtimeChair.material.opacity).toBe(0);
        expect(runtimeChair.customDistanceMaterial.opacity).toBe(0);
        fixturesOnly.forEach((mesh) => {
            expect(mesh.visible).toBe(true);
            expect(mesh.material.opacity).toBe(1);
            expect(mesh.customDistanceMaterial.opacity).toBe(1);
        });
        expect(lights.every((light) => light.intensity === 1.11)).toBe(true);
        settings = { ...settings, dayNightAction: "reverse", dayNightCommand: 2 };
        await mount();
        step(0.57);
        fixturesOnly.forEach((mesh) => {
            expect(mesh.visible).toBe(true);
            expect(mesh.material.opacity).toBeCloseTo(0.5, 9);
            expect(mesh.customDistanceMaterial.opacity).toBeCloseTo(0.5, 9);
        });
        expect(runtimeChair.visible).toBe(false);
        expect(runtimeChair.material.opacity).toBe(0);
        settings = { ...settings, dayNightAction: "reset", dayNightCommand: 3 };
        await mount();
        step(0);
        fixturesOnly.forEach((mesh) => {
            expect(mesh.visible).toBe(false);
            expect(mesh.material.opacity).toBe(0);
        });
        expect(lights.every((light) => light.intensity === 0)).toBe(true);
        fireEvent.keyDown(window, { key: "a" });
        step(0.5);
        expect(runtimeChair.visible).toBe(true);
        expect(runtimeChair.material.opacity).toBe(1);
        expect(fixturesOnly.every((mesh) => mesh.visible && mesh.material.opacity === 1)).toBe(true);
        expect(fixtures.material.opacity).toBe(1);
    });

    test.each([false, true])("separates lit placements within shared halfMesh=%s prototypes", async (halfMesh) => {
        const { mergeGeometries } = jest.requireMock("three/examples/jsm/utils/BufferGeometryUtils.js");
        mergeGeometries.mockImplementation(([geometry]) => geometry.clone());
        fixtures.manifest.instanceGroups[0].halfMesh = halfMesh;
        fixtures.manifest.objectLights[2].intensity = -1;
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        try {
            await mount();
            const meshes = fixtureMeshes();
            const lit = meshes.filter((mesh) => mesh.userData.housemakerKeepWhenLit === true);
            const unlit = meshes.filter((mesh) => mesh.userData.housemakerKeepWhenLit !== true);
            expect(meshes).toHaveLength(4);
            expect(lit).toHaveLength(2);
            expect(unlit).toHaveLength(2);
            expect(fixtureLights()).toHaveLength(2);
            lit.forEach((mesh) => {
                expect(mesh.count).toBe(2);
                const matrix = new THREE.Matrix4();
                mesh.getMatrixAt(0, matrix);
                expect(matrix.elements[12]).toBe(0);
                mesh.getMatrixAt(1, matrix);
                expect(matrix.elements[12]).toBe(3);
            });
            unlit.forEach((mesh) => {
                expect(mesh.count).toBe(1);
                const matrix = new THREE.Matrix4();
                mesh.getMatrixAt(0, matrix);
                expect(matrix.elements[12]).toBe(6);
                expect(lit.some((other) => other.geometry === mesh.geometry)).toBe(true);
            });
            fireEvent.keyDown(window, { key: "a" });
            step(0.5);
            lit.forEach((mesh) => {
                expect(mesh.visible).toBe(true);
                expect(mesh.material.opacity).toBe(1);
            });
            unlit.forEach((mesh) => {
                expect(mesh.visible).toBe(false);
                expect(mesh.material.opacity).toBe(0);
            });
            meshes.forEach((mesh) => {
                expect(mesh.castShadow).toBe(!mesh.material.userData.housemakerFaceLighting?.lightPassthrough);
            });
            expect(fixtures.material.opacity).toBe(1);
        } finally {
            mergeGeometries.mockReset();
        }
    });

    test("mirrors emissive geometry without duplicating exported fixture lights", async () => {
        fixtures.manifest.instanceGroups = [];
        fixtures.manifest.objectLights = [makeObjectLight()];
        fixtures.sourceScene.add(fixtures.source);
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        expect(fixtureLights()).toHaveLength(1);
        const meshes = fixtureMeshes();
        expect(meshes).toHaveLength(4);
        const bulbs = meshes.filter((mesh) => mesh.material.emissive.r * mesh.material.emissiveIntensity > 0);
        expect(bulbs).toHaveLength(2);
        expect(bulbs[0].material).toBe(bulbs[1].material);
        bulbs.forEach((mesh) => {
            expect(mesh.castShadow).toBe(false);
            expect(mesh.material.emissive.r * mesh.material.emissiveIntensity).toBeCloseTo(1.11, 9);
        });
        expect(fixtures.source.children).toEqual([fixtures.part]);
    });

    test("keeps fixture lights singular when mirrored instances share a prototype", async () => {
        const { mergeGeometries } = jest.requireMock("three/examples/jsm/utils/BufferGeometryUtils.js");
        mergeGeometries.mockImplementation(([geometry]) => geometry.clone());
        fixtures.manifest.instanceGroups[0].halfMesh = true;
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        try {
            await mount();
            expect(fixtureLights()).toHaveLength(3);
            const [housing, bulb] = fixtureMeshes();
            expect(housing.isInstancedMesh).toBe(true);
            expect(bulb.isInstancedMesh).toBe(true);
            expect(housing.count).toBe(3);
            expect(bulb.count).toBe(3);
            expect(bulb.material.emissive.r * bulb.material.emissiveIntensity).toBeCloseTo(1.11, 9);
            expect(bulb.castShadow).toBe(false);
            expect(housing.material.emissive.getHex()).toBe(0);
            expect(mergeGeometries).toHaveBeenCalled();
        } finally {
            mergeGeometries.mockReset();
        }
    });

    test("skips malformed face records without discarding valid emitter metadata", async () => {
        const valid = fixtures.manifest.faceLighting[0];
        fixtures.manifest.faceLighting = [
            null,
            { ...valid, emissiveLinearRgb: [NaN, 0, 0] },
            { ...valid, primitiveIndex: -1 },
            valid
        ];
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        expect(fixtureLights()).toHaveLength(3);
        expect(fixtureMeshes()[1].material.emissive.r * fixtureMeshes()[1].material.emissiveIntensity)
            .toBeCloseTo(1.11, 9);
        expect(fixtureMeshes()[0].material.emissive.getHex()).toBe(0);
        expect(consoleWarning).toHaveBeenCalled();
    });

    test.each([true, false])("reads primitive extras with manifest precedence=%s", async (manifestPresent) => {
        const metadata = fixtures.manifest.faceLighting[0];
        fixtures.gltf.parser.json = {
            meshes: [{ primitives: [{}, { extras: {
                housemakerFaceLighting: { ...metadata, emissiveLinearRgb: [2.22, 1, 0.5] }
            } }] }]
        };
        fixtures.manifest.faceLighting = manifestPresent ? [metadata] : undefined;
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        const [housing, bulb] = fixtureMeshes();
        expect(housing.material.emissive.getHex()).toBe(0);
        expect(bulb.material.emissive.r * bulb.material.emissiveIntensity).toBeCloseTo(manifestPresent ? 1.11 : 2.22, 9);
        expect(bulb.castShadow).toBe(false);
    });

    test("removes stale fixture lights on reload without disposing source resources", async () => {
        const disposeGeometry = jest.spyOn(fixtures.geometry, "dispose");
        const disposeMaterial = jest.spyOn(fixtures.material, "dispose");
        const disposeTexture = jest.spyOn(fixtures.texture, "dispose");
        await mount();
        const initial = fixtureLights();
        fixtures.manifest = { ...fixtures.manifest, objectLights: [makeObjectLight({ id: "replacement" })] };
        await mount({ jsonFile: "replacement.json" });
        expect(fixtureLights()).toHaveLength(1);
        expect(fixtureLights()[0].userData.houseMakerObjectLightId).toBe("replacement");
        initial.forEach((light) => expect(light.parent).toBeNull());
        await nativeFiber.act(async () => root.render(null));
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    });

    test("reconciles instanced fixture lights with the existing instances toggle", async () => {
        settings = makeDayNightSettings({ dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 });
        await mount();
        expect(fixtureLights()).toHaveLength(3);
        await mount({ instancesEnabled: false });
        expect(fixtureLights()).toHaveLength(0);
        expect(fixtureMeshes()).toHaveLength(0);
        await mount();
        expect(fixtureLights()).toHaveLength(3);
        expect(fixtureLights().every((light) => light.intensity === 1.11)).toBe(true);
        expect(fixtureMeshes()).toHaveLength(2);
    });
});
/* eslint-enable testing-library/no-unnecessary-act */

// ### Fading object visibility ###

describe("HouseMaker fading object visibility", () => {
    let consoleError;
    let consoleWarning;

    beforeEach(() => {
        useFrame.mockClear();
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarning = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        useLoader.mockReset();
        consoleError.mockRestore();
        consoleWarning.mockRestore();
    });

    test("fades furniture and mirrors while preserving shared architectural materials", () => {
        const fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        const furniture = new THREE.Mesh(resources.geometry, resources.material);
        furniture.name = "Furniture";
        furniture.userData = {
            housemaker_object_id: "chair-a",
            halfMesh: {
                mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] },
                uvMode: "reuse"
            }
        };
        const floor = new THREE.Mesh(resources.geometry, resources.material);
        floor.name = "Floor";
        floor.userData.housemaker_surface_id = "level:0/floor";
        const mixedAtlas = new THREE.Mesh(resources.geometry, resources.material);
        mixedAtlas.name = "Mixed atlas";
        mixedAtlas.userData.housemaker_atlas_source_ids = [
            "table-a", "surface-wall-texture:wall-a"
        ];
        fixtures.sourceScene.add(furniture, floor, mixedAtlas);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));

        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const objects = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object);
        const model = objects.find((object) => object.isScene);
        const mirrors = objects.find((object) => object.name === "HouseMaker mirrored models");
        const loadedFurniture = model.getObjectByName("Furniture");
        const mirroredFurniture = mirrors.children[0];
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const frameState = { camera: new THREE.PerspectiveCamera() };
        const rootData = getRenderedProps(view.container.querySelector("group")).userData;

        expect(loadedFurniture.material).not.toBe(resources.material);
        expect(loadedFurniture.material.map).toBe(resources.texture);
        expect(mirroredFurniture.material.map).toBe(resources.texture);
        expect(model.getObjectByName("Floor").material.map).toBe(resources.texture);
        expect(model.getObjectByName("Floor").material.opacity).toBe(1);
        expect(model.getObjectByName("Mixed atlas").material).toBe(model.getObjectByName("Floor").material);
        expect(rootData.housemakerObjectsHidden).toBe(false);

        fireEvent.keyDown(window, { key: "a" });
        expect(rootData.housemakerObjectsHidden).toBe(true);
        frame(frameState, 0.2);

        expect(loadedFurniture.material.opacity).toBeGreaterThan(0);
        expect(loadedFurniture.material.opacity).toBeLessThan(1);
        expect(loadedFurniture.visible).toBe(true);
        expect(mirroredFurniture.material.opacity).toBe(loadedFurniture.material.opacity);
        expect(resources.material.opacity).toBe(1);

        frame(frameState, 1);

        expect(loadedFurniture.visible).toBe(false);
        expect(mirroredFurniture.visible).toBe(false);
        expect(model.getObjectByName("Floor").visible).toBe(true);
        expect(model.getObjectByName("Mixed atlas").visible).toBe(true);
        expect(model.getObjectByName("Floor").material.opacity).toBe(1);
        expect(model.getObjectByName("Mixed atlas").material.opacity).toBe(1);
        expect(furniture.visible).toBe(true);
        expect(furniture.material).toBe(resources.material);
        view.unmount();
    });

    test("reverses a partial fade without snapping or replacing geometry", () => {
        const fixtures = makeLoaderFixtures();
        const furniture = makeBody().body;
        fixtures.sourceScene.add(furniture);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const loadedFurniture = model.children[0];
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const frameState = { camera: new THREE.PerspectiveCamera() };

        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 0.2);
        const partialOpacity = loadedFurniture.material.opacity;
        expect(partialOpacity).toBeGreaterThan(0);
        expect(partialOpacity).toBeLessThan(1);

        fireEvent.keyDown(window, { key: "A" });
        expect(loadedFurniture.material.opacity).toBe(partialOpacity);
        frame(frameState, 0.1);

        expect(loadedFurniture.material.opacity).toBeGreaterThan(partialOpacity);
        frame(frameState, 1);

        expect(loadedFurniture.material.opacity).toBe(1);
        expect(loadedFurniture.visible).toBe(true);
        expect(loadedFurniture.geometry).toBe(furniture.geometry);
        view.unmount();
    });

    test("ignores held keys, modified shortcuts, and editable targets", () => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<>
            <HouseMakerLoader toursEnabled={false} />
            <input aria-label="Text input" />
            <textarea aria-label="Text area" />
            <div contentEditable suppressContentEditableWarning aria-label="Editable text" />
        </>);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const loadedFurniture = model.children[0];
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const frameState = { camera: new THREE.PerspectiveCamera() };

        fireEvent.keyDown(window, { key: "a", repeat: true });
        fireEvent.keyDown(window, { key: "a", ctrlKey: true });
        fireEvent.keyDown(window, { key: "a", metaKey: true });
        fireEvent.keyDown(window, { key: "a", altKey: true });
        fireEvent.keyDown(window, { key: "t" });
        fireEvent.keyDown(screen.getByLabelText("Text input"), { key: "a" });
        fireEvent.keyDown(screen.getByLabelText("Text area"), { key: "a" });
        fireEvent.keyDown(screen.getByLabelText("Editable text"), { key: "a" });
        frame(frameState, 1);

        expect(loadedFurniture.visible).toBe(true);
        expect(loadedFurniture.material.opacity).toBe(1);

        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 1);

        expect(loadedFurniture.visible).toBe(false);
        view.unmount();
    });

    test.each(["a", "q"])("uses the configured %s shortcut without remounting", (hideObjectsKey) => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<HouseMakerLoader toursEnabled={false} hideObjectsKey={hideObjectsKey} />);
        const rootData = getRenderedProps(view.container.querySelector("group")).userData;
        const loadCount = useLoader.mock.calls.length;

        fireEvent.keyDown(window, { key: hideObjectsKey === "a" ? "q" : "a" });
        expect(rootData.housemakerObjectsHidden).toBe(false);
        fireEvent.keyDown(window, { key: hideObjectsKey.toUpperCase() });
        expect(rootData.housemakerObjectsHidden).toBe(true);
        expect(useLoader).toHaveBeenCalledTimes(loadCount);

        view.rerender(<HouseMakerLoader toursEnabled={false} hideObjectsKey="t" />);
        fireEvent.keyDown(window, { key: hideObjectsKey });
        expect(rootData.housemakerObjectsHidden).toBe(true);
        fireEvent.keyDown(window, { key: "t" });
        expect(rootData.housemakerObjectsHidden).toBe(false);
        view.unmount();
    });

    test("HUD actions share fading, collision flags, and keyboard notifications", () => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const visibilityChange = jest.fn();
        window.addEventListener("housemaker-objects-visibility-change", visibilityChange);
        const view = render(<HouseMakerLoader toursEnabled={false} hideObjectsKey="q" />);
        const rootData = getRenderedProps(view.container.querySelector("group")).userData;
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const loadedFurniture = model.children[0];
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];

        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(rootData.housemakerObjectsHidden).toBe(true);
        expect(loadedFurniture.visible).toBe(true);
        expect(visibilityChange).toHaveBeenCalledTimes(1);
        expect(visibilityChange.mock.calls[0][0].detail).toEqual({ hidden: true });
        frame({}, 0.2);
        expect(loadedFurniture.material.opacity).toBeGreaterThan(0);
        expect(loadedFurniture.material.opacity).toBeLessThan(1);
        frame({}, 1);
        expect(loadedFurniture.visible).toBe(false);

        fireEvent.keyDown(window, { key: "q" });
        expect(rootData.housemakerObjectsHidden).toBe(false);
        expect(visibilityChange).toHaveBeenCalledTimes(2);
        expect(visibilityChange.mock.calls[1][0].detail).toEqual({ hidden: false });
        frame({}, 1);
        expect(loadedFurniture.visible).toBe(true);
        expect(loadedFurniture.material.opacity).toBe(1);
        view.unmount();
        window.removeEventListener("housemaker-objects-visibility-change", visibilityChange);
    });

    test("ignores both visibility controls until the tutorial has closed", () => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<HouseMakerLoader toursEnabled={false} objectControlsEnabled={false} />);
        const rootData = getRenderedProps(view.container.querySelector("group")).userData;

        fireEvent.keyDown(window, { key: "a" });
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(rootData.housemakerObjectsHidden).toBe(false);

        view.rerender(<HouseMakerLoader toursEnabled={false} objectControlsEnabled />);
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(rootData.housemakerObjectsHidden).toBe(true);
        view.rerender(<HouseMakerLoader toursEnabled={false} objectControlsEnabled={false} />);
        fireEvent.keyDown(window, { key: "a" });
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(rootData.housemakerObjectsHidden).toBe(true);
        view.unmount();
    });

    test("Strict Mode actions toggle each loader once and unsubscribe", () => {
        const fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<StrictMode>
            <HouseMakerLoader toursEnabled={false} />
            <HouseMakerLoader toursEnabled={false} />
        </StrictMode>);
        const roots = [...view.container.querySelectorAll("group")]
            .map((element) => getRenderedProps(element).userData)
            .filter((data) => typeof data?.housemakerObjectsHidden === "boolean");

        expect(roots).toHaveLength(2);
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(roots.every((root) => root.housemakerObjectsHidden)).toBe(true);
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(roots.every((root) => !root.housemakerObjectsHidden)).toBe(true);
        view.unmount();
        fireEvent(window, new CustomEvent("housemaker-toggle-objects"));
        expect(roots.every((root) => !root.housemakerObjectsHidden)).toBe(true);
    });

    test("Strict Mode disposes owned fade materials without disposing shared assets", () => {
        const fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        const furniture = makeBody({ resources }).body;
        fixtures.sourceScene.add(furniture);
        const disposeGeometry = jest.spyOn(resources.geometry, "dispose");
        const disposeMaterial = jest.spyOn(resources.material, "dispose");
        const disposeTexture = jest.spyOn(resources.texture, "dispose");
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<StrictMode>
            <HouseMakerLoader toursEnabled={false} />
        </StrictMode>);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const ownedMaterial = model.children[0].material;
        const disposeOwnedMaterial = jest.spyOn(ownedMaterial, "dispose");
        const rootData = getRenderedProps(view.container.querySelector("group")).userData;

        expect(ownedMaterial).not.toBe(resources.material);
        expect(ownedMaterial.map).toBe(resources.texture);
        view.unmount();

        expect(disposeOwnedMaterial).toHaveBeenCalledTimes(1);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(furniture.material).toBe(resources.material);
        expect(resources.material.alphaHash).toBe(false);

        fireEvent.keyDown(window, { key: "a" });
        expect(rootData.housemakerObjectsHidden).toBe(false);
    });

    test("prepares nested meshes on a hidden reload without revealing authored-hidden children", () => {
        let fixtures = makeLoaderFixtures();
        fixtures.sourceScene.add(makeBody().body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const frameState = { camera: new THREE.PerspectiveCamera() };
        let frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 1);

        fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        const parent = new THREE.Mesh(resources.geometry, resources.material);
        parent.name = "Furniture parent";
        parent.userData.housemaker_object_id = "cabinet-a";
        const child = new THREE.Mesh(resources.geometry, resources.material);
        child.name = "Furniture child";
        const authoredHiddenChild = new THREE.Mesh(resources.geometry, resources.material);
        authoredHiddenChild.name = "Authored hidden child";
        authoredHiddenChild.visible = false;
        parent.add(child, authoredHiddenChild);
        fixtures.sourceScene.add(parent);

        view.rerender(<HouseMakerLoader toursEnabled={false} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const loadedParent = model.getObjectByName("Furniture parent");
        const loadedChild = model.getObjectByName("Furniture child");
        const loadedHiddenChild = model.getObjectByName("Authored hidden child");
        frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];

        expect(loadedParent.visible).toBe(false);
        expect(loadedChild.visible).toBe(false);
        expect(loadedChild.material).not.toBe(resources.material);
        expect(loadedChild.material.opacity).toBe(0);
        expect(loadedHiddenChild.material.map).toBe(resources.texture);
        expect(loadedHiddenChild.material.opacity).toBe(1);
        expect(loadedHiddenChild.material.alphaHash).toBe(false);

        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 0.2);

        expect(loadedParent.visible).toBe(true);
        expect(loadedChild.visible).toBe(true);
        expect(loadedChild.material.opacity).toBeGreaterThan(0);
        expect(loadedChild.material.opacity).toBeLessThan(1);
        expect(loadedHiddenChild.visible).toBe(false);
        expect(resources.material.opacity).toBe(1);

        frame(frameState, 1);
        expect(loadedChild.material.opacity).toBe(1);
        expect(loadedHiddenChild.visible).toBe(false);
        view.unmount();
    });

    test("preserves cutout boundaries through fades without changing shader variants", () => {
        const fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        resources.material.alphaTest = 0.5;
        resources.material.opacity = 0.8;
        fixtures.sourceScene.add(makeBody({ resources }).body);
        useLoader.mockImplementation((Loader, url) => (
            String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf
        ));
        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object)
            .find((object) => object.isScene);
        const fadedMaterial = model.children[0].material;
        const materialVersion = fadedMaterial.version;
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        const frameState = { camera: new THREE.PerspectiveCamera() };

        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 0.2);

        expect(fadedMaterial.opacity).toBeGreaterThan(0);
        expect(fadedMaterial.opacity).toBeLessThan(0.8);
        expect(fadedMaterial.alphaTest / fadedMaterial.opacity).toBeCloseTo(0.5 / 0.8);
        expect(fadedMaterial.version).toBe(materialVersion);

        frame(frameState, 1);
        expect(fadedMaterial.opacity).toBe(0);
        expect(fadedMaterial.alphaTest).toBeGreaterThan(0);
        expect(fadedMaterial.version).toBe(materialVersion);

        fireEvent.keyDown(window, { key: "a" });
        frame(frameState, 0.2);
        expect(fadedMaterial.alphaTest / fadedMaterial.opacity).toBeCloseTo(0.5 / 0.8);
        frame(frameState, 1);

        expect(fadedMaterial.opacity).toBe(0.8);
        expect(fadedMaterial.alphaTest).toBe(0.5);
        expect(fadedMaterial.version).toBe(materialVersion);
        expect(resources.material.opacity).toBe(0.8);
        expect(resources.material.alphaTest).toBe(0.5);
        view.unmount();
    });
});

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

describe("HouseMaker ordinary half-object scale compensation", () => {
    test.each([
        [false, 0], [false, 1], [false, 2],
        [true, 0], [true, 1], [true, 2]
    ])("preserves rotated off-origin halves: includeObjects=%s, axis=%s", (includeObjects, axis) => {
        const scene = new THREE.Scene();
        const globalRoot = new THREE.Group();
        globalRoot.userData.housemakerGlobalScale = true;
        globalRoot.scale.set(2.3, 2.0064819647142973, 2.4);
        const authoredParent = new THREE.Group();
        authoredParent.position.set(0.6, -1.1, 2.2);
        authoredParent.rotation.set(0.21, -0.47, 0.63);
        authoredParent.updateMatrix();
        const { material } = makeMeshAssets();
        const geometry = new THREE.BoxGeometry(1.3, 0.7, 1.8);
        geometry.translate(2.1, -0.4, 1.2);
        const source = new THREE.Mesh(geometry, material);
        source.name = "Off-origin cabinet half";
        source.position.set(4.2, 2.7, 1.3);
        source.rotation.set(0.23, -0.12, 0.54);
        source.scale.set(0.84, 0.56, 0.98);
        source.castShadow = true;
        source.receiveShadow = true;
        source.userData.housemaker_object_id = "cabinet";
        source.updateMatrix();

        const originalWorld = authoredParent.matrix.clone().multiply(source.matrix);
        const anchor = new THREE.Vector3().setFromMatrixPosition(originalWorld);
        const localPoint = new THREE.Vector3(0.35, -0.7, 0.8);
        const localNormal = new THREE.Vector3().setComponent(axis, 1);
        const originalPlane = {
            point: localPoint.clone().applyMatrix4(originalWorld).toArray(),
            normal: localNormal.clone().applyNormalMatrix(
                new THREE.Matrix3().getNormalMatrix(originalWorld)
            ).toArray()
        };
        const compensation = new THREE.Matrix4();
        if (!includeObjects) {
            compensation.makeScale(1 / globalRoot.scale.x, 1 / globalRoot.scale.y, 1 / globalRoot.scale.z);
            compensation.setPosition(anchor.clone().sub(anchor.clone().divide(globalRoot.scale)));
        }

        // Match the export's two decomposable compensation parents.
        const scaleCompensation = new THREE.Group();
        const scaleRotation = new THREE.Group();
        scaleCompensation.userData.housemakerObjectScaleExclusion = {
            objectId: "cabinet",
            halfMesh: { uvMode: "reuse", mirrorPlane: originalPlane }
        };
        authoredParent.matrix.clone().invert().multiply(compensation)
            .decompose(scaleCompensation.position, scaleCompensation.quaternion, scaleCompensation.scale);
        authoredParent.matrix.decompose(scaleRotation.position, scaleRotation.quaternion, scaleRotation.scale);
        source.userData.halfMesh = {
            uvMode: "reuse",
            mirrorPlane: {
                point: new THREE.Vector3().fromArray(originalPlane.point).applyMatrix4(compensation).toArray(),
                normal: new THREE.Vector3().fromArray(originalPlane.normal).applyNormalMatrix(
                    new THREE.Matrix3().getNormalMatrix(compensation)
                ).toArray()
            }
        };
        scaleRotation.add(source);
        scaleCompensation.add(scaleRotation);
        authoredParent.add(scaleCompensation);
        globalRoot.add(authoredParent);
        scene.add(globalRoot);
        const originalPositions = Array.from(geometry.attributes.position.array);
        const originalUvs = Array.from(geometry.attributes.uv.array);
        const originalMetadata = JSON.stringify(source.userData.halfMesh);
        const originalMarker = JSON.stringify(scaleCompensation.userData.housemakerObjectScaleExclusion);
        const prepared = prepareHouseMakerModelScene(scene, []);
        const loadedSource = prepared.modelScene.getObjectByName(source.name);
        const mirror = getMirrorByType(prepared.mirroredModels, "halfMesh");
        const localReflection = buildPlaneReflectionMatrix({ point: localPoint.toArray(), normal: localNormal.toArray() });
        const physicalShift = anchor.clone().multiply(globalRoot.scale.clone().subScalar(1));
        loadedSource.updateWorldMatrix(true, true);

        // Compare physical vertices without reusing the reconstruction formula.
        for (let index = 0; index < geometry.attributes.position.count; index += 1) {
            const vertex = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index);
            const expectedSource = vertex.clone().applyMatrix4(originalWorld);
            const expectedMirror = vertex.clone().applyMatrix4(localReflection).applyMatrix4(originalWorld);
            if (includeObjects) {
                expectedSource.multiply(globalRoot.scale);
                expectedMirror.multiply(globalRoot.scale);
            } else {
                expectedSource.add(physicalShift);
                expectedMirror.add(physicalShift);
            }
            expect(vertex.clone().applyMatrix4(loadedSource.matrixWorld).distanceTo(expectedSource)).toBeLessThan(1e-10);
            expect(vertex.clone().applyMatrix4(mirror.matrixWorld).distanceTo(expectedMirror)).toBeLessThan(1e-10);
        }

        [localPoint, localPoint.clone().setComponent((axis + 1) % 3, 2.1)].forEach((seamPoint) => {
            expect(seamPoint.clone().applyMatrix4(loadedSource.matrixWorld).distanceTo(
                seamPoint.clone().applyMatrix4(mirror.matrixWorld)
            )).toBeLessThan(1e-10);
        });
        expect(mirror.geometry).toBe(geometry);
        expect(mirror.material).toBe(material);
        expect(mirror.castShadow).toBe(true);
        expect(mirror.receiveShadow).toBe(true);
        expect(mirror.matrixAutoUpdate).toBe(false);
        expect(Array.from(geometry.attributes.position.array)).toEqual(originalPositions);
        expect(Array.from(geometry.attributes.uv.array)).toEqual(originalUvs);
        expect(JSON.stringify(source.userData.halfMesh)).toBe(originalMetadata);
        expect(JSON.stringify(scaleCompensation.userData.housemakerObjectScaleExclusion)).toBe(originalMarker);
        expect(getRuntimeMirrors(scene)).toEqual([]);

        const firstMatrix = mirror.matrixWorld.clone();
        reconstructHalfMeshes(prepared.modelScene, prepared.mirroredModels);
        expect(prepared.mirroredModels.children).toHaveLength(1);
        expectMatrixClose(prepared.mirroredModels.children[0].matrixWorld, firstMatrix);
    });
});

describe("HouseMaker door reconstruction variants", () => {
    test("keeps the half-mesh seam aligned under exported global scaling", () => {
        const scene = new THREE.Scene();
        const globalRoot = new THREE.Group();
        globalRoot.userData.housemakerGlobalScale = true;
        globalRoot.scale.set(1.8, 2.0064819647142973, 1.9);
        const point = [-0.08104019064566431, 1.2994961023330696, -4.80722678053926];
        const { body, geometry, material } = makeBody({
            halfPlane: { point, normal: [1, 0, 0] }
        });
        body.position.fromArray(point);
        globalRoot.add(body);
        scene.add(globalRoot);

        const prepared = prepareHouseMakerModelScene(scene, []);
        const source = findDoorBodyNode(prepared.modelScene, "placement-a", "body-a");
        const mirror = getMirrorByType(prepared.mirroredModels, "halfMesh");
        source.updateWorldMatrix(true, true);
        mirror.updateWorldMatrix(true, true);
        const sourceSeam = new THREE.Vector3().applyMatrix4(source.matrixWorld);
        const mirrorSeam = new THREE.Vector3().applyMatrix4(mirror.matrixWorld);

        expect(sourceSeam.x).toBeCloseTo(point[0] * 1.8, 10);
        expect(sourceSeam.distanceTo(mirrorSeam)).toBeCloseTo(0, 10);
        expect(source.geometry).toBe(geometry);
        expect(mirror.geometry).toBe(geometry);
        expect(mirror.material).toBe(material);
        expect(source.userData.halfMesh.mirrorPlane.point).toEqual(point);
        expect(getRuntimeMirrors(scene)).toEqual([]);
    });

    test("preserves oblique reflections under nonuniform global transforms", () => {
        const scene = new THREE.Scene();
        const globalRoot = new THREE.Group();
        globalRoot.userData.housemakerGlobalScale = true;
        globalRoot.position.set(3, -2, 4);
        globalRoot.rotation.set(0.2, -0.3, 0.15);
        globalRoot.scale.set(1.8, 2.1, 0.7);
        const plane = { point: [0.5, 0.8, -1.2], normal: [1, 1, -0.5] };
        const body = makeBody({ halfPlane: plane }).body;
        body.position.set(0.8, 1.5, -0.3);
        body.rotation.set(-0.15, 0.35, -0.1);
        body.scale.set(0.7, 1.2, 0.9);
        globalRoot.add(body);
        scene.add(globalRoot);
        scene.updateMatrixWorld(true);
        const expectedWorld = globalRoot.matrixWorld.clone()
            .multiply(buildPlaneReflectionMatrix(plane))
            .multiply(body.matrix);

        const prepared = prepareHouseMakerModelScene(scene, []);
        const mirror = getMirrorByType(prepared.mirroredModels, "halfMesh");

        expectMatrixClose(mirror.matrixWorld, expectedWorld);
        expect(mirror.matrixAutoUpdate).toBe(false);
    });

    test("uses scaled JSON side planes without scaling them again", () => {
        const scene = new THREE.Scene();
        const globalRoot = new THREE.Group();
        globalRoot.userData.housemakerGlobalScale = true;
        globalRoot.scale.set(1.8, 2, 1.9);
        const halfPlane = { point: [0.4, 0, 0], normal: [1, 0, 0] };
        const sidePlane = { point: [0, 0, 3.8], normal: [0, 0, 1] };
        const body = makeBody({ halfPlane }).body;
        body.position.set(0.7, 1, 2.4);
        globalRoot.add(body);
        scene.add(globalRoot);
        scene.updateMatrixWorld(true);
        const expectedHalf = globalRoot.matrixWorld.clone()
            .multiply(buildPlaneReflectionMatrix(halfPlane))
            .multiply(body.matrix);
        const sideReflection = buildPlaneReflectionMatrix(sidePlane);

        const prepared = prepareHouseMakerModelScene(scene, [
            makeReconstruction({ mirrorPlane: sidePlane })
        ]);
        const source = findDoorBodyNode(prepared.modelScene, "placement-a", "body-a");
        source.updateWorldMatrix(true, true);

        expectMatrixClose(
            getMirrorByType(prepared.mirroredModels, "halfMesh").matrixWorld,
            expectedHalf
        );
        expectMatrixClose(
            getMirrorByType(prepared.mirroredModels, "sideDuplication:authored").matrixWorld,
            sideReflection.clone().multiply(source.matrixWorld)
        );
        expectMatrixClose(
            getMirrorByType(prepared.mirroredModels, "sideDuplication:halfMesh").matrixWorld,
            sideReflection.clone().multiply(expectedHalf)
        );
    });

    test("skips invalid global scaling without invalidating the authored model", () => {
        const scene = new THREE.Scene();
        const globalRoot = new THREE.Group();
        globalRoot.userData.housemakerGlobalScale = true;
        globalRoot.scale.set(0, 2, 1);
        globalRoot.add(makeBody({
            halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
        }).body);
        scene.add(globalRoot);
        const warning = jest.fn();

        const prepared = prepareHouseMakerModelScene(scene, [], warning);

        expect(prepared.runtimeMirrors).toEqual([]);
        expect(prepared.modelScene.children[0].children).toHaveLength(1);
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("invalid global scale"));
    });

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

describe("HouseMaker fixture-light validation", () => {
    test.each([undefined, null, [], { id: "not-an-array" }])("accepts missing fixture arrays", (records) => {
        const warning = jest.fn();
        expect(validateObjectLights(records, warning)).toEqual([]);
        expect(warning).toHaveBeenCalledTimes(records && !Array.isArray(records) ? 1 : 0);
    });

    test("retains native point and spot values without coordinate conversion", () => {
        const warning = jest.fn();
        const records = [makeObjectLight(), makeObjectLight({
            id: "spot-b", type: "spot", position: [5, 4, 3], target: [-2, 0, 8],
            intensity: 2.75, rangeMeters: 13, coneAngleDegrees: 60, penumbra: 0.6, castShadow: false
        })];
        const snapshot = JSON.stringify(records);
        const validated = validateObjectLights(records, warning);
        expect(validated).toHaveLength(2);
        validated.forEach((record, index) => {
            const { target, ...properties } = records[index];
            expect(record).toEqual(expect.objectContaining(properties));
            expect(record.target).toEqual(record.type === "spot" ? target : undefined);
        });
        expect(JSON.stringify(records)).toBe(snapshot);
        expect(warning).not.toHaveBeenCalled();
    });

    test("derives omitted spot targets only from exported world directions", () => {
        const [light] = validateObjectLights([makeObjectLight({
            type: "spot", position: [5, 3, -2], target: undefined,
            direction: [0, -4, 0], localDirection: [1, 0, 0], localPosition: [40, 50, 60]
        })], jest.fn());
        expect(light.target).toEqual([5, 2, -2]);
        expect(light.position).toEqual([5, 3, -2]);
    });

    test("skips malformed records individually and keeps the first duplicate", () => {
        const warning = jest.fn();
        const first = makeObjectLight({ id: "first" });
        const last = makeObjectLight({ id: "last", type: "spot" });
        const invalid = [
            null,
            makeObjectLight({ id: " " }),
            makeObjectLight({ id: "wrong-type", type: "area" }),
            makeObjectLight({ id: "short-position", position: [1, 2] }),
            makeObjectLight({ id: "bad-position", position: [1, NaN, 3] }),
            makeObjectLight({ id: "bad-color", color: "#fff" }),
            makeObjectLight({ id: "bad-intensity", intensity: -1 }),
            makeObjectLight({ id: "infinite-intensity", intensity: Infinity }),
            makeObjectLight({ id: "bad-range", rangeMeters: -1 }),
            makeObjectLight({ id: "bad-shadow", castShadow: "true" }),
            makeObjectLight({ id: "bad-target", type: "spot", target: [0, Infinity, 0] }),
            makeObjectLight({ id: "coincident", type: "spot", position: [1, 2, 3], target: [1, 2, 3] }),
            makeObjectLight({ id: "bad-cone", type: "spot", coneAngleDegrees: 180 }),
            makeObjectLight({ id: "bad-penumbra", type: "spot", penumbra: 1.1 })
        ];
        const validated = validateObjectLights([
            first, ...invalid, { ...first, intensity: 100 }, last
        ], warning);
        expect(validated.map((record) => record.id)).toEqual(["first", "last"]);
        expect(validated[0].intensity).toBe(first.intensity);
        expect(warning).toHaveBeenCalledTimes(invalid.length + 1);
    });
});

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
        useFrame.mockClear();
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
        ["null", null],
        ["disabled", { enabled: false }],
        ["zero speed", makeSunlightOrbit({ speedDegreesPerSecond: 0, initialDirection: [0, 0, 1] })]
    ])("keeps %s sunlight animation static without warning", (label, sunlightOrbit) => {
        const environmentScene = new THREE.Scene();
        environmentScene.environmentRotation.y = 0.2;
        environmentScene.backgroundRotation.y = -0.3;
        const light = makeDirectionalLight();
        const fixtures = makeLoaderFixtures({ directionalLights: [light], sunlightOrbit });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} />);
        const target = view.container.querySelector("directionallight").target;
        useFrame.mock.calls.forEach(([frame]) => frame({}, 10));
        expect(target.position.toArray()).toEqual(light.target);
        expect(environmentScene.environmentRotation.y).toBe(0.2);
        expect(environmentScene.backgroundRotation.y).toBe(-0.3);
        expect(consoleWarning).not.toHaveBeenCalled();
    });

    test.each([
        ["non-object", "enabled"],
        ["invalid enabled", makeSunlightOrbit({ enabled: "true" })],
        ["missing speed", makeSunlightOrbit({ speedDegreesPerSecond: undefined })],
        ["string speed", makeSunlightOrbit({ speedDegreesPerSecond: "0.5" })],
        ["negative speed", makeSunlightOrbit({ speedDegreesPerSecond: -1 })],
        ["excessive speed", makeSunlightOrbit({ speedDegreesPerSecond: 361 })],
        ["nonfinite speed", makeSunlightOrbit({ speedDegreesPerSecond: Infinity })],
        ["short axis", makeSunlightOrbit({ axis: [0, 1] })],
        ["zero axis", makeSunlightOrbit({ axis: [0, 0, 0] })],
        ["nonfinite axis", makeSunlightOrbit({ axis: [0, NaN, 1] })],
        ["short direction", makeSunlightOrbit({ initialDirection: [1, 0] })],
        ["zero direction", makeSunlightOrbit({ initialDirection: [0, 0, 0] })],
        ["nonfinite direction", makeSunlightOrbit({ initialDirection: [Infinity, 0, 0] })],
        ["empty ID", makeSunlightOrbit({ lightId: " " })],
        ["unknown ID", makeSunlightOrbit({ lightId: "missing-sun" })],
        ["display-name match", makeSunlightOrbit({ lightId: "Sun light 1" })]
    ])("ignores %s sunlight metadata without removing the light", (label, sunlightOrbit) => {
        const environmentScene = new THREE.Scene();
        environmentScene.environmentRotation.y = 0.2;
        environmentScene.backgroundRotation.y = -0.3;
        const light = makeDirectionalLight({ name: "Sun light 1" });
        const fixtures = makeLoaderFixtures({ directionalLights: [light], sunlightOrbit });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} environmentScene={environmentScene} />);
        const renderedLight = view.container.querySelector("directionallight");
        useFrame.mock.calls.forEach(([frame]) => frame({}, 10));
        expect(renderedLight.target.position.toArray()).toEqual(light.target);
        expect(environmentScene.environmentRotation.y).toBe(0.2);
        expect(environmentScene.backgroundRotation.y).toBe(-0.3);
        expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
        expect(consoleWarning).toHaveBeenCalledWith(expect.stringContaining("sunlightOrbit"));
    });

    test("does not warn about malformed sunlight metadata in production", () => {
        const environment = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            const fixtures = makeLoaderFixtures({ directionalLights: [makeDirectionalLight()], sunlightOrbit: makeSunlightOrbit({ axis: [0, 0, 0] }) });
            useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
            const view = render(<HouseMakerLoader toursEnabled={false} />);
            expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
            expect(consoleWarning).not.toHaveBeenCalled();
        } finally {
            process.env.NODE_ENV = environment;
        }
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

// ### Optional runtime sunlight and shadows ###

describe("HouseMaker runtime sunlight and shadows", () => {
    let consoleError;

    beforeEach(() => {
        useFrame.mockClear();
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        useLoader.mockReset();
        consoleError.mockRestore();
        jest.restoreAllMocks();
    });

    test("keeps sunlight and mesh shadows opt-in", () => {
        const fixtures = makeLoaderFixtures();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshStandardMaterial());
        fixtures.sourceScene.add(mesh);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);

        expect(view.container.querySelectorAll("directionallight")).toHaveLength(0);
        expect(model.children[0].castShadow).toBe(false);
        expect(model.children[0].receiveShadow).toBe(false);
        expect(model.children[0].customDepthMaterial).toBeUndefined();
    });

    test("patches owned PBR variants without changing arrays, glass, or cached shaders", () => {
        const fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        const originalChunk = THREE.ShaderChunk.shadowmap_pars_fragment;
        const originalCompile = jest.fn((shader) => { shader.uniforms.authoredHook = { value: 1 }; });
        resources.material.onBeforeCompile = originalCompile;
        resources.material.customProgramCacheKey = () => "authored-program";
        const glass = new THREE.MeshPhysicalMaterial({
            map: resources.texture, transparent: true, opacity: 0.3, transmission: 0.8,
            roughness: 0.15, metalness: 0.2, thickness: 0.4, depthWrite: false
        });
        const unlit = new THREE.MeshBasicMaterial({ color: "#12ab34", map: resources.texture });
        const authoredArray = [resources.material, glass, unlit];
        const mesh = new THREE.Mesh(resources.geometry, authoredArray);
        const shared = new THREE.Mesh(resources.geometry, resources.material);
        fixtures.sourceScene.add(mesh, shared);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const [owned, ownedGlass, unchangedUnlit] = model.children[0].material;
        const shader = { uniforms: {}, fragmentShader: "#include <shadowmap_pars_fragment>" };
        owned.onBeforeCompile(shader, {});
        const functions = shader.fragmentShader.split("const vec2 houseMakerShadowDisk")[1].split("float getShadow(")[0];
        expect(owned).not.toBe(resources.material);
        expect(model.children[1].material).toBe(owned);
        expect(owned.map).toBe(resources.texture);
        expect(owned.side).toBe(resources.material.side);
        expect(originalCompile).toHaveBeenCalledTimes(1);
        expect(originalCompile.mock.instances[0]).toBe(owned);
        expect(shader.uniforms.authoredHook.value).toBe(1);
        expect(shader.fragmentShader).toContain("if (shadowRadius < 0.0)");
        expect(shader.fragmentShader).toContain("-shadowRadius - 1.0");
        expect(functions).toContain("textureLod(shadowMap");
        expect(functions).toContain("angularScale <= 0.0");
        expect(functions).not.toMatch(/texture2D\s*\(/);
        expect(functions).toContain("float visibility = 1.0;");
        expect(functions.match(/\breturn\b/g)).toHaveLength(1);
        expect(functions).toContain("return visibility;");
        expect(shader.fragmentShader).toMatch(/if \(shadowRadius < 0\.0\) \{\s*shadow = houseMakerSunShadow\([^;]+;\s*\} else \{/);
        const originalPcf = originalChunk.split("#if defined( SHADOWMAP_TYPE_PCF )")[1]
            .split("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )")[0].trim();
        expect(shader.fragmentShader).toContain(originalPcf);
        expect(owned.customProgramCacheKey()).toBe("authored-program:housemaker-sun-pcss-v2");
        expect(ownedGlass).not.toBe(glass);
        expect(ownedGlass).toMatchObject({
            transparent: true, opacity: 0.3, transmission: 0.8, roughness: 0.15,
            metalness: 0.2, thickness: 0.4, depthWrite: false, side: THREE.FrontSide
        });
        expect(ownedGlass.map).toBe(resources.texture);
        expect(unchangedUnlit).toBe(unlit);
        expect(mesh.material).toBe(authoredArray);
        expect(authoredArray).toEqual([resources.material, glass, unlit]);
        expect(resources.material.onBeforeCompile).toBe(originalCompile);
        expect(resources.material.customProgramCacheKey()).toBe("authored-program");
        expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(originalChunk);
    });

    test("retains the sun shader through object fading without recompilation keys changing", () => {
        const fixtures = makeLoaderFixtures();
        const body = makeBody({ halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] } }).body;
        fixtures.sourceScene.add(body);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} shadowsEnabled />);
        const objects = [...view.container.querySelectorAll("primitive")].map((element) => getRenderedProps(element).object);
        const model = objects.find((object) => object.isScene);
        const mirrors = objects.find((object) => object.name === "HouseMaker mirrored models");
        const material = model.children[0].material;
        const shader = { uniforms: {}, fragmentShader: "#include <shadowmap_pars_fragment>" };
        const key = material.customProgramCacheKey();
        material.onBeforeCompile(shader, {});
        expect(material).toBe(mirrors.children[0].material);
        expect(shader.fragmentShader).toContain("houseMakerSunShadow");
        expect(material.alphaHash).toBe(true);
        fireEvent.keyDown(window, { key: "a" });
        useFrame.mock.calls[useFrame.mock.calls.length - 1][0]({}, 0.2);
        expect(material.opacity).toBeGreaterThan(0);
        expect(material.opacity).toBeLessThan(1);
        expect(material.customProgramCacheKey()).toBe(key);
        expect(material.map).toBe(body.material.map);
        expect(body.material.opacity).toBe(1);
        expect(body.material.alphaHash).toBe(false);
    });

    test("Strict Mode disposes owned sun and fade variants without disposing shared resources", () => {
        const fixtures = makeLoaderFixtures();
        const resources = makeMeshAssets();
        const floor = new THREE.Mesh(resources.geometry, resources.material);
        floor.name = "Floor";
        const body = makeBody({ resources }).body;
        fixtures.sourceScene.add(floor, body);
        const disposeSource = jest.spyOn(resources.material, "dispose");
        const disposeGeometry = jest.spyOn(resources.geometry, "dispose");
        const disposeTexture = jest.spyOn(resources.texture, "dispose");
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const ownedSun = model.getObjectByName("Floor").material;
        const ownedFade = model.getObjectByName(body.name).material;
        const disposeSun = jest.spyOn(ownedSun, "dispose");
        const disposeFade = jest.spyOn(ownedFade, "dispose");
        expect(ownedSun).not.toBe(resources.material);
        expect(ownedFade).not.toBe(ownedSun);
        expect(ownedSun.map).toBe(resources.texture);
        expect(ownedFade.onBeforeCompile).toBe(ownedSun.onBeforeCompile);
        view.rerender(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled shadowSoftness={6} /></StrictMode>);
        expect(model.getObjectByName("Floor").material).toBe(ownedSun);
        expect(model.getObjectByName(body.name).material).toBe(ownedFade);
        expect(disposeSun).not.toHaveBeenCalled();
        expect(disposeFade).not.toHaveBeenCalled();
        view.unmount();
        expect(disposeSun).toHaveBeenCalledTimes(1);
        expect(disposeFade).toHaveBeenCalledTimes(1);
        expect(disposeSource).not.toHaveBeenCalled();
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
        expect(floor.material).toBe(resources.material);
        expect(body.material).toBe(resources.material);
    });

    test("adds one stable HDRI-aligned sun aimed at actual house bounds", () => {
        const fixtures = makeLoaderFixtures();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 8), new THREE.MeshStandardMaterial());
        mesh.position.set(10, 3, -5);
        fixtures.sourceScene.add(mesh);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<StrictMode><HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled shadowMapSize={2048} /></StrictMode>);
        const renderedLight = view.container.querySelector("directionallight");
        const light = getRenderedProps(renderedLight);
        const target = renderedLight.target;

        expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
        expect(light.userData.houseMakerDirectionalLightId).toBe("housemaker-runtime-sun");
        expect(light.target).toBeUndefined();
        expect(target.position.toArray()).toEqual([10, 3, -5]);
        expect(light.intensity).toBe(3);
        expect(light.color).toBe("#fff4e5");
        expect(light.castShadow).toBe(true);
        expect(light["shadow-mapSize"]).toEqual([2048, 2048]);
        expect(light["shadow-normalBias"]).toBe(0.03);
        const direction = new THREE.Vector3().fromArray(light.position).sub(target.position).normalize();
        expect(direction.distanceTo(new THREE.Vector3(0.553, 0.743, 0.377).normalize())).toBeLessThan(1e-10);

        view.rerender(<StrictMode><HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled shadowMapSize={2048} /></StrictMode>);
        expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
        expect(view.container.querySelector("directionallight")).toBe(renderedLight);
        expect(renderedLight.target).toBe(target);
        expect(mesh.castShadow).toBe(false);
        expect(mesh.receiveShadow).toBe(false);
        view.unmount();
        expect(view.container.querySelectorAll("primitive")).toHaveLength(0);
    });

    test("preserves exported lights exactly instead of adding a sun", () => {
        const light = makeDirectionalLight({ intensity: 0.25, castShadow: false });
        const fixtures = makeLoaderFixtures({ directionalLights: [light] });
        fixtures.sourceScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} fallbackSunEnabled shadowsEnabled />);
        const lights = [...view.container.querySelectorAll("directionallight")];
        expect(lights).toHaveLength(1);
        expect(getRenderedProps(lights[0])).toMatchObject({
            name: light.name, position: light.position, color: light.color,
            intensity: light.intensity, castShadow: light.castShadow,
            userData: { houseMakerDirectionalLightId: light.id }
        });
        expect(lights[0].target.position.toArray()).toEqual(light.target);
        expect(getRenderedProps(lights[0])["shadow-mapSize"]).toEqual([1024, 1024]);
    });

    test("fits the generated sun's camera around every house corner", () => {
        const light = makeDirectionalLight({ position: [20, 30, 25], target: [1, 1, 1], castShadow: true });
        const nativeLight = new THREE.DirectionalLight();
        nativeLight.position.fromArray(light.position);
        nativeLight.updateMatrixWorld();
        const createElement = document.createElement.bind(document);
        jest.spyOn(document, "createElement").mockImplementation((tagName, options) => {
            const element = createElement(tagName, options);
            if (tagName === "directionalLight") {
                element.shadow = nativeLight.shadow;
                element.matrixWorld = nativeLight.matrixWorld;
                element.updateWorldMatrix = jest.fn();
            }
            return element;
        });
        const bounds = new THREE.Box3(new THREE.Vector3(-12, 0, -13), new THREE.Vector3(13, 12, 14));
        const view = render(<HouseMakerDirectionalLight light={light} shadowBounds={bounds} />);
        const camera = nativeLight.shadow.camera;
        const clipBounds = bounds.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        expect(clipBounds.min.x).toBeGreaterThan(-1);
        expect(clipBounds.min.y).toBeGreaterThan(-1);
        expect(clipBounds.min.z).toBeGreaterThan(-1);
        expect(clipBounds.max.x).toBeLessThan(1);
        expect(clipBounds.max.y).toBeLessThan(1);
        expect(clipBounds.max.z).toBeLessThan(1);
        expect(camera.right - camera.left).toBeGreaterThan(25);
        nativeLight.shadow.map = new THREE.WebGLRenderTarget(1024, 1024);
        const disposeMap = jest.spyOn(nativeLight.shadow.map, "dispose");
        view.rerender(<HouseMakerDirectionalLight light={light} shadowBounds={bounds} shadowMapSize={2048} />);
        expect(disposeMap).toHaveBeenCalledTimes(1);
        expect(nativeLight.shadow.map).toBeNull();
    });

    test("changes only runtime PBR meshes and restores flags when disabled", () => {
        const fixtures = makeLoaderFixtures();
        const body = makeBody({ halfPlane: { point: [0, 0, 0], normal: [1, 0, 0] } }).body;
        body.castShadow = false;
        body.receiveShadow = false;
        const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.3 }));
        glass.name = "Glass";
        const decoration = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
        decoration.name = "Unlit decoration";
        fixtures.sourceScene.add(body, glass, decoration);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} shadowsEnabled />);
        const objects = [...view.container.querySelectorAll("primitive")].map((element) => getRenderedProps(element).object);
        const model = objects.find((object) => object.isScene);
        const mirrors = objects.find((object) => object.name === "HouseMaker mirrored models");
        const loadedBody = model.getObjectByName(body.name);

        expect(loadedBody.castShadow).toBe(true);
        expect(loadedBody.receiveShadow).toBe(true);
        expect(mirrors.children[0].castShadow).toBe(true);
        expect(mirrors.children[0].receiveShadow).toBe(true);
        expect(model.getObjectByName("Glass").castShadow).toBe(false);
        expect(model.getObjectByName("Glass").receiveShadow).toBe(true);
        expect(model.getObjectByName("Unlit decoration").castShadow).toBe(false);
        expect(model.getObjectByName("Unlit decoration").receiveShadow).toBe(false);
        expect(body.castShadow).toBe(false);
        expect(body.receiveShadow).toBe(false);

        view.rerender(<HouseMakerLoader toursEnabled={false} shadowsEnabled={false} />);
        expect(loadedBody.castShadow).toBe(false);
        expect(loadedBody.receiveShadow).toBe(false);
        expect(mirrors.children[0].castShadow).toBe(false);
        expect(mirrors.children[0].receiveShadow).toBe(false);
        expect(loadedBody.customDepthMaterial).toBeUndefined();
    });

    test("fades owned shadow materials without changing shared source assets", () => {
        const fixtures = makeLoaderFixtures();
        const body = makeBody().body;
        body.material.alphaTest = 0.4;
        fixtures.sourceScene.add(body);
        const disposeGeometry = jest.spyOn(body.geometry, "dispose");
        const disposeMaterial = jest.spyOn(body.material, "dispose");
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} shadowsEnabled />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const loadedBody = model.getObjectByName(body.name);
        const depthMaterial = loadedBody.customDepthMaterial;
        const disposeDepth = jest.spyOn(depthMaterial, "dispose");
        const shader = { uniforms: {}, fragmentShader: "vec4 diffuseColor = vec4( 1.0 );" };
        depthMaterial.onBeforeCompile(shader);
        expect(depthMaterial.isMeshDepthMaterial).toBe(true);
        expect(depthMaterial.alphaHash).toBe(true);
        expect(depthMaterial.depthPacking).toBe(THREE.RGBADepthPacking);
        expect(depthMaterial.map).toBe(body.material.map);
        expect(depthMaterial.alphaTest).toBe(0.4);
        expect(depthMaterial.side).toBe(body.material.side);
        expect(shader.fragmentShader).toContain("houseMakerFadeOpacity");
        const frame = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        fireEvent.keyDown(window, { key: "a" });
        frame({}, 0.2);
        expect(depthMaterial.opacity).toBe(loadedBody.material.opacity);
        expect(depthMaterial.opacity).toBeGreaterThan(0);
        expect(depthMaterial.opacity).toBeLessThan(1);
        expect(shader.uniforms.houseMakerFadeOpacity.value).toBe(depthMaterial.opacity);
        expect(body.material.opacity).toBe(1);
        expect(body.customDepthMaterial).toBeUndefined();
        frame({}, 1);
        expect(loadedBody.visible).toBe(false);
        expect(depthMaterial.opacity).toBe(0);
        view.unmount();
        expect(disposeDepth).toHaveBeenCalledTimes(1);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(loadedBody.customDepthMaterial).toBeUndefined();
    });

    test("includes half mirrors and instances in sunlight bounds and shadow flags", () => {
        const instanceMatrix = new THREE.Matrix4().makeTranslation(20, 0, 0);
        const fixtures = makeLoaderFixtures({ instanceGroups: [{
            sourceNodeName: "Chair source",
            instances: [{ worldMatrix: instanceMatrix.toArray() }]
        }] });
        const half = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
        half.position.x = 1;
        half.userData.halfMesh = { uvMode: "reuse", mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] } };
        fixtures.sourceScene.add(half);
        const source = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial());
        source.name = "Chair source";
        const sourceScene = new THREE.Scene();
        sourceScene.add(source);
        fixtures.gltf.scenes.push(sourceScene);
        const createElement = document.createElement.bind(document);
        jest.spyOn(document, "createElement").mockImplementation((tagName, options) => {
            const element = createElement(tagName, options);
            if (tagName === "instancedMesh") {
                const nativeMesh = new THREE.InstancedMesh(source.geometry, source.material, 1);
                Object.assign(element, {
                    isMesh: true, visible: true, geometry: source.geometry, material: source.material,
                    userData: { housemakerHideable: true }, castShadow: false, receiveShadow: false,
                    instanceMatrix: nativeMesh.instanceMatrix,
                    setMatrixAt: nativeMesh.setMatrixAt.bind(nativeMesh),
                    traverse: (visitor) => visitor(element)
                });
            }
            return element;
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} shadowsEnabled fallbackSunEnabled />);
        const light = view.container.querySelector("directionallight");
        const instance = view.container.querySelector("instancedmesh");
        expect(light.target.position.toArray()).toEqual([10, 0, 0]);
        expect(instance.castShadow).toBe(true);
        expect(instance.receiveShadow).toBe(true);
        expect(instance.customDepthMaterial.isMeshDepthMaterial).toBe(true);
        expect(source.castShadow).toBe(false);
        expect(source.receiveShadow).toBe(false);
        expect(source.customDepthMaterial).toBeUndefined();

        view.rerender(<HouseMakerLoader toursEnabled={false} shadowsEnabled fallbackSunEnabled instancesEnabled={false} />);
        expect(view.container.querySelector("instancedmesh")).toBeNull();
        expect(light.target.position.toArray()).toEqual([0, 0, 0]);
        expect(instance.castShadow).toBe(false);
        expect(instance.receiveShadow).toBe(false);
        expect(instance.customDepthMaterial).toBeUndefined();
    });

    test("Strict Mode restores authored depth materials and disposes only owned copies", () => {
        const fixtures = makeLoaderFixtures();
        const body = makeBody().body;
        fixtures.sourceScene.add(body);
        const authoredDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        const beforeShadow = jest.fn();
        const disposeAuthored = jest.spyOn(authoredDepth, "dispose");
        const disposeTexture = jest.spyOn(body.material.map, "dispose");
        const ownedDepths = [];
        const cloneDepth = authoredDepth.clone.bind(authoredDepth);
        jest.spyOn(authoredDepth, "clone").mockImplementation(() => {
            const copy = cloneDepth();
            const dispose = jest.fn();
            copy.addEventListener("dispose", dispose);
            ownedDepths.push({ copy, dispose });
            return copy;
        });
        const cloneScene = fixtures.sourceScene.clone.bind(fixtures.sourceScene);
        jest.spyOn(fixtures.sourceScene, "clone").mockImplementation(() => {
            const copy = cloneScene(true);
            copy.children[0].customDepthMaterial = authoredDepth;
            copy.children[0].onBeforeShadow = beforeShadow;
            return copy;
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const loadedBody = model.getObjectByName(body.name);
        expect(ownedDepths).toHaveLength(2);
        expect(ownedDepths[0].dispose).toHaveBeenCalledTimes(1);
        expect(loadedBody.customDepthMaterial).toBe(ownedDepths[1].copy);
        loadedBody.material.opacity = 0.25;
        loadedBody.onBeforeShadow(null, loadedBody, null, null, loadedBody.geometry, loadedBody.customDepthMaterial, null);
        expect(beforeShadow).toHaveBeenCalledTimes(1);
        expect(loadedBody.customDepthMaterial.opacity).toBe(0.25);
        view.rerender(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        expect(ownedDepths).toHaveLength(2);
        view.unmount();
        expect(ownedDepths.every(({ dispose }) => dispose.mock.calls.length === 1)).toBe(true);
        expect(loadedBody.customDepthMaterial).toBe(authoredDepth);
        expect(loadedBody.onBeforeShadow).toBe(beforeShadow);
        expect(disposeAuthored).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    });

    test.each([
        { type: "point", castShadow: true, shadowsEnabled: true, ownsDistance: true },
        { type: "point", castShadow: false, shadowsEnabled: true, ownsDistance: false },
        { type: "spot", castShadow: true, shadowsEnabled: true, ownsDistance: false },
        { type: "point", castShadow: true, shadowsEnabled: false, ownsDistance: false }
    ])("limits distance shadow variants to casting points: $type/$castShadow/$shadowsEnabled", ({
        type, castShadow, shadowsEnabled, ownsDistance
    }) => {
        const fixtures = makeLoaderFixtures({ objectLights: [makeObjectLight({ type, castShadow })] });
        const body = makeBody().body;
        fixtures.sourceScene.add(body);
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<HouseMakerLoader toursEnabled={false} shadowsEnabled={shadowsEnabled} />);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const loaded = model.getObjectByName(body.name);
        expect(Boolean(loaded.customDistanceMaterial?.isMeshDistanceMaterial)).toBe(ownsDistance);
        expect(body.customDistanceMaterial).toBeUndefined();
        view.unmount();
        expect(loaded.customDistanceMaterial).toBeUndefined();
    });

    test("restores authored point-shadow materials and shares fade uniforms", () => {
        const fixtures = makeLoaderFixtures({ objectLights: [makeObjectLight()] });
        const body = makeBody().body;
        const secondMaterial = body.material.clone();
        secondMaterial.opacity = 0.6;
        body.material = [body.material, secondMaterial];
        fixtures.sourceScene.add(body);
        const authoredDistance = new THREE.MeshDistanceMaterial();
        const beforeShadow = jest.fn();
        const sourceCompile = jest.fn((shader) => {
            shader.fragmentShader = `#define AUTHORED_DISTANCE\n${shader.fragmentShader}`;
        });
        authoredDistance.onBeforeCompile = sourceCompile;
        const disposeAuthored = jest.spyOn(authoredDistance, "dispose");
        const disposeTexture = jest.spyOn(body.material[0].map, "dispose");
        const ownedDistances = [];
        const cloneDistance = authoredDistance.clone.bind(authoredDistance);
        jest.spyOn(authoredDistance, "clone").mockImplementation(() => {
            const copy = cloneDistance();
            const dispose = jest.fn();
            copy.addEventListener("dispose", dispose);
            ownedDistances.push({copy, dispose});
            return copy;
        });
        const cloneScene = fixtures.sourceScene.clone.bind(fixtures.sourceScene);
        jest.spyOn(fixtures.sourceScene, "clone").mockImplementation(() => {
            const copy = cloneScene(true);
            copy.children[0].customDistanceMaterial = authoredDistance;
            copy.children[0].onBeforeShadow = beforeShadow;
            return copy;
        });
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        const view = render(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        const model = [...view.container.querySelectorAll("primitive")]
            .map((element) => getRenderedProps(element).object).find((object) => object.isScene);
        const loaded = model.getObjectByName(body.name);
        expect(ownedDistances).toHaveLength(2);
        expect(ownedDistances[0].dispose).toHaveBeenCalledTimes(1);
        expect(loaded.customDistanceMaterial).toBe(ownedDistances[1].copy);
        expect(loaded.customDistanceMaterial.map).toBe(body.material[0].map);
        expect(loaded.customDistanceMaterial.alphaHash).toBe(true);
        const distanceShader = {fragmentShader: THREE.ShaderLib.distanceRGBA.fragmentShader, uniforms: {}};
        const depthShader = {fragmentShader: THREE.ShaderLib.depth.fragmentShader, uniforms: {}};
        loaded.customDistanceMaterial.onBeforeCompile(distanceShader);
        loaded.customDepthMaterial.onBeforeCompile(depthShader);
        expect(sourceCompile).toHaveBeenCalledTimes(1);
        expect(distanceShader.fragmentShader).toContain("#define AUTHORED_DISTANCE");
        expect(distanceShader.fragmentShader).toContain("uniform float houseMakerFadeOpacity;");
        expect(distanceShader.fragmentShader).toContain("vec4( 1.0, 1.0, 1.0, houseMakerFadeOpacity )");
        expect(distanceShader.fragmentShader).toContain("#include <alphahash_fragment>");
        expect(distanceShader.uniforms.houseMakerFadeOpacity).toBe(depthShader.uniforms.houseMakerFadeOpacity);
        loaded.material[1].opacity = 0.25;
        loaded.onBeforeShadow(null, loaded, null, null, loaded.geometry, loaded.customDistanceMaterial, {materialIndex: 1});
        expect(beforeShadow).toHaveBeenCalledTimes(1);
        expect(loaded.customDistanceMaterial.opacity).toBe(0.25);
        expect(loaded.customDepthMaterial.opacity).toBe(0.25);
        expect(distanceShader.uniforms.houseMakerFadeOpacity.value).toBe(0.25);
        view.rerender(<StrictMode><HouseMakerLoader toursEnabled={false} shadowsEnabled /></StrictMode>);
        expect(ownedDistances).toHaveLength(2);
        view.unmount();
        expect(ownedDistances.every(({dispose}) => dispose.mock.calls.length === 1)).toBe(true);
        expect(loaded.customDistanceMaterial).toBe(authoredDistance);
        expect(loaded.onBeforeShadow).toBe(beforeShadow);
        expect(disposeAuthored).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    });
});
