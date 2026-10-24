/* eslint-disable testing-library/no-unnecessary-act -- Native R3F roots require act. */
/* eslint-disable testing-library/no-node-access -- Scene children are Three objects. */
/* global globalThis */

import React, { StrictMode } from "react";
import { fireEvent } from "@testing-library/react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { HouseMakerLoader } from "./HouseMakerLoader.jsx";

// Retain real hooks and rendering objects around mocked file decoding.
jest.mock("@react-three/fiber", () => ({
    ...jest.requireActual("@react-three/fiber"),
    useLoader: jest.fn()
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: function GLTFLoader() {} }));
jest.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({ KTX2Loader: function KTX2Loader() {} }));
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => ({ mergeGeometries: jest.fn() }));
jest.mock("./HouseMakerTourPlayer.jsx", () => ({ HouseMakerTourPlayer: () => null }));

const nativeFiber = jest.requireActual("@react-three/fiber");
let root;
let store;
let renderer;
let camera;
let fixture;
let elapsed;
let packs;
let packSequence;
let originalGlobals;
let consoleError;
let consoleWarn;
let clockSpy;

// Drain asynchronous download, verification, decode, and shader stages.
async function flushJobs() {
    for (let index = 0; index < 32; index += 1) await Promise.resolve();
}

// Build compact maps with real texture dimensions and stable IDs.
function makeMaterial(id, resolution = 64, physical = false) {
    const texture = new THREE.Texture({ width: resolution, height: resolution });
    texture.name = `${id}-${resolution}`;
    const material = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    material.name = `Display name unrelated to ${id}`;
    material.userData.housemaker_material_id = id;
    material.map = texture;
    return material;
}

// Register portable material-carrier responses with verified byte descriptors.
function makePack(id, variant, options = {}) {
    const bytes = Uint8Array.from([++packSequence, 2, 3, 4]).buffer;
    const material = options.material ?? makeMaterial(id, variant === "preview" ? 128 : 512);
    const geometry = new THREE.BoxGeometry();
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const file = `../materials/${id}.${variant}.glb`;
    const pack = {
        bytes, material, geometry, scene,
        parser: {
            getDependency: jest.fn(async () => material),
            associations: new Map([[material, { materials: 0 }]])
        },
        response: undefined,
        error: undefined,
        descriptor: {
            file,
            sha256: require("crypto").createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
            byteSize: bytes.byteLength,
            maxResolution: variant === "preview" ? 128 : 512,
            materialIndex: 0,
            compression: "ktx2-basis",
            container: "glb-material-cube",
            mapTypes: variant === "preview" ? ["base_color"] : ["base_color", "normal"]
        }
    };
    packs.set(`/materials/${id}.${variant}.glb`, pack);
    return pack;
}

// Build exported room policies around visible fallback geometry.
function makeFixture(options = {}) {
    const fallback = makeMaterial("material-a");
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.setAttribute("uv1", geometry.attributes.uv.clone());
    const sourceScene = new THREE.Scene();
    const authored = new THREE.Mesh(geometry, fallback);
    authored.name = "Authored object";
    authored.position.set(0, 1, -4);
    authored.userData.housemaker_object_id = "object-a";
    if (options.mirror) authored.userData.halfMesh = {
        uvMode: "reuse", mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
    };
    sourceScene.add(authored);
    const preview = makePack("material-a", "preview");
    const full = makePack("material-a", "full");
    const sourceInstances = new THREE.Scene();
    const source = new THREE.Mesh(geometry, fallback);
    source.name = "Detached instance source";
    sourceInstances.add(source);
    const materialRecord = {
        materialId: "material-a", materialName: fallback.name, materialIndex: 0,
        roomIds: ["room-a"], shared: false, bootstrap: true,
        variants: {
            embedded: { inMainGlb: true, maxSize: 64, qualityTier: "fallback", compression: "jpeg-or-png" },
            preview: preview.descriptor, full: full.descriptor
        }
    };
    const manifest = {
        format: "housemaker-r3f-scene", version: 10, coordinateSystem: "gltf-y-up",
        asset: { glb: "streaming-house.glb" },
        instanceGroups: options.instances ? [{
            sourceNodeName: source.name,
            instances: [{ id: "instance-a", worldMatrix: new THREE.Matrix4().makeTranslation(2, 1, -4).toArray() }]
        }] : [],
        doorBodyReconstructions: [],
        roomAssets: {
            version: 1, coordinateSystem: "gltf-y-up",
            materials: [materialRecord], portals: [],
            rooms: [{
                id: "room-a", levelIndex: 0, fallback: false,
                bounds: { min: [-5, 0, -8], max: [5, 4, 2] },
                floorOutline: [[-5, 0, -8], [5, 0, -8], [5, 0, 2], [-5, 0, 2]],
                floorHoles: [], materialIds: ["material-a"], surfaceNodeNames: [authored.name]
            }]
        },
        materialStreaming: {
            format: "housemaker-material-streaming", version: 1, enabled: true,
            materialTable: "roomAssets.materials",
            initialCamera: { position: [0, 1.7, 0], floorPosition: [0, 0, 0], lookDirection: [0, 0, -1], fovDegrees: 70 },
            textureCompression: { externalPacks: "ktx2-basis", requiredLoader: "KTX2Loader", decoder: { workerLimit: 2 } },
            bootstrap: { roomIds: ["room-a"], adjacentRoomIds: [], materialIds: ["material-a"], keepEmbeddedFallbacks: true },
            scheduler: {
                maxConcurrentDownloads: 2, maxConcurrentDecodes: 2,
                maxGpuUploadsPerFrame: 1, gpuWorkBudgetMilliseconds: 2,
                warmShadersBeforeSwap: true, swapWhen: "shader-ready", cancelQueuedObsoleteRequests: true
            },
            priorityOrder: [
                { rank: 0, variant: "preview", scope: "visible-not-yet-preview-quality" },
                { rank: 1, variant: "full", scope: "visible-in-current-room" },
                { rank: 2, variant: "full", scope: "visible-outside-current-room" },
                { rank: 3, variant: "full", scope: "remaining-current-room-nonshared" },
                { rank: 4, variant: "preview", scope: "adjacent-rooms-heading-first" },
                { rank: 5, variant: "full", scope: "adjacent-rooms-heading-first", onlyWithinBudget: true },
                { rank: 6, variant: "preview", scope: "other-rooms", idleOnly: true }
            ],
            cache: { desktopGpuBudgetMiB: 64, mobileGpuBudgetMiB: 32, retainPreviousRoomMilliseconds: 10000, keepEmbeddedFallbacks: true },
            failurePolicy: { maxAttempts: 1, retryBackoffMilliseconds: [0], onFullFailure: "retain-preview", onPreviewFailure: "retain-embedded" }
        }
    };
    return {
        manifest, fallback, geometry, authored, source, preview, full,
        gltf: {
            scene: sourceScene, scenes: [sourceScene, sourceInstances],
            parser: { associations: new Map([[fallback, { materials: 0 }]]) }
        }
    };
}

// Add another room outside the initial camera's frustum.
function addSecondRoom() {
    const fallback = makeMaterial("material-b");
    const mesh = new THREE.Mesh(fixture.geometry, fallback);
    mesh.position.set(25, 1, -4);
    fixture.gltf.scene.add(mesh);
    const preview = makePack("material-b", "preview");
    const full = makePack("material-b", "full");
    fixture.manifest.roomAssets.materials.push({
        materialId: "material-b", roomIds: ["room-b"], shared: false,
        variants: { embedded: { inMainGlb: true, maxSize: 64 }, preview: preview.descriptor, full: full.descriptor }
    });
    fixture.manifest.roomAssets.rooms.push({
        id: "room-b", levelIndex: 0, fallback: false,
        bounds: { min: [20, 0, -8], max: [30, 4, 2] },
        floorOutline: [[20, 0, -8], [30, 0, -8], [30, 0, 2], [20, 0, 2]], floorHoles: [], materialIds: ["material-b"]
    });
    return { mesh, fallback, preview, full };
}

// Mount real runtime clones without replacing their rendering hooks.
async function mountLoader(props = {}, strict = false) {
    await nativeFiber.act(async () => {
        const element = <HouseMakerLoader toursEnabled={false} shadowsEnabled {...props} />;
        store = root.render(strict ? <StrictMode>{element}</StrictMode> : element);
        await flushJobs();
    });
}

// Advance native frame subscriptions and resolve asynchronous pack stages.
async function stepFrames(count = 1, delta = 1 / 60) {
    await nativeFiber.act(async () => {
        for (let index = 0; index < count; index += 1) {
            elapsed += delta;
            store.getState().scene.updateMatrixWorld(true);
            camera.updateMatrixWorld(true);
            nativeFiber.advance(elapsed, false, store.getState());
            await flushJobs();
        }
    });
}

// Inspect all runtime copies without depending on JSX host internals.
function runtimeMeshes() {
    const meshes = [];
    store.getState().scene.traverse((node) => { if (node.isMesh) meshes.push(node); });
    return meshes;
}

beforeEach(() => {
    elapsed = 0;
    packs = new Map();
    packSequence = 0;
    originalGlobals = new Map(["crypto", "fetch", "caches"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    clockSpy = jest.spyOn(performance, "now").mockImplementation(() => elapsed * 1000);
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
        subtle: { digest: jest.fn(async (algorithm, bytes) => Uint8Array.from(
            require("crypto").createHash("sha256").update(Buffer.from(bytes)).digest()
        ).buffer) }
    } });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: jest.fn(async (url) => {
        const pack = packs.get(new URL(String(url), document.baseURI).pathname);
        if (!pack) throw new Error(`Unexpected material request: ${url}`);
        if (pack.error) throw pack.error;
        if (pack.response) return pack.response;
        return { ok: true, status: 200, arrayBuffer: async () => pack.bytes };
    }) });
    Object.defineProperty(globalThis, "caches", { configurable: true, value: undefined });
    ["setTranscoderPath", "setWorkerLimit", "detectSupport"].forEach((method) => {
        KTX2Loader.prototype[method] = jest.fn(function chain() { return this; });
    });
    KTX2Loader.prototype.init = jest.fn(async () => {});
    KTX2Loader.prototype.dispose = jest.fn();
    GLTFLoader.prototype.setKTX2Loader = jest.fn(function chain() { return this; });
    GLTFLoader.prototype.parseAsync = jest.fn(async (bytes) => {
        const pack = Array.from(packs.values()).find((entry) => Buffer.from(entry.bytes).equals(Buffer.from(bytes)));
        if (!pack) throw new Error("Unknown decoded material bytes");
        return { scene: pack.scene, scenes: [pack.scene], parser: pack.parser };
    });
    fixture = makeFixture();
    useLoader.mockReset().mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixture.manifest : fixture.gltf);
    nativeFiber.extend(THREE);
    const canvas = document.createElement("canvas");
    camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.01, 100);
    camera.position.set(0, 1.7, 0);
    renderer = {
        render: jest.fn(() => { renderer.info.render.frame += 1; }),
        setPixelRatio: jest.fn(), setSize: jest.fn(),
        initTexture: jest.fn(), compileAsync: jest.fn(async () => {}),
        domElement: canvas, shadowMap: {},
        capabilities: { getMaxAnisotropy: () => 8 },
        info: { render: { frame: 0 }, memory: {}, programs: [] }
    };
    root = nativeFiber.createRoot(canvas);
    root.configure({ gl: renderer, camera, frameloop: "never", size: { width: 800, height: 600, top: 0, left: 0 } });
});

afterEach(async () => {
    await nativeFiber.act(async () => root.unmount());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushJobs();
    ["setTranscoderPath", "setWorkerLimit", "detectSupport", "init", "dispose"].forEach((method) => { delete KTX2Loader.prototype[method]; });
    delete GLTFLoader.prototype.setKTX2Loader;
    delete GLTFLoader.prototype.parseAsync;
    originalGlobals.forEach((descriptor, key) => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    });
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    clockSpy.mockRestore();
});

test("embedded materials render before external upgrades begin", async () => {
    await mountLoader();
    expect(runtimeMeshes()).toHaveLength(1);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await stepFrames(2);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    expect(renderer.initTexture).not.toHaveBeenCalled();
    await stepFrames(12);
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
    expect(renderer.initTexture).toHaveBeenCalled();
    expect(renderer.compileAsync).toHaveBeenCalled();
    expect(renderer.compileAsync.mock.calls.every(([warmScene, warmCamera, targetScene]) => warmScene !== targetScene
        && targetScene === store.getState().scene && warmCamera === camera)).toBe(true);
});

test("stable material IDs update authored meshes, mirrors, arrays, and instances", async () => {
    fixture = makeFixture({ mirror: true, instances: true });
    const second = makeMaterial("material-b");
    const secondPreview = makePack("material-b", "preview");
    const secondFull = makePack("material-b", "full");
    fixture.authored.material = [fixture.fallback, second];
    fixture.geometry.clearGroups();
    fixture.geometry.addGroup(0, 18, 0);
    fixture.geometry.addGroup(18, 18, 1);
    fixture.manifest.roomAssets.materials.push({
        materialId: "material-b", materialIndex: 1, roomIds: ["room-a"], shared: false,
        variants: { embedded: { inMainGlb: true, maxSize: 64 }, preview: secondPreview.descriptor, full: secondFull.descriptor }
    });
    fixture.manifest.roomAssets.rooms[0].materialIds.push("material-b");
    await mountLoader();
    const meshes = runtimeMeshes();
    expect(meshes.some((mesh) => mesh.isInstancedMesh)).toBe(true);
    expect(meshes.some((mesh) => mesh.userData.housemakerRuntimeMirror)).toBe(true);
    const positions = meshes.map((mesh) => mesh.matrixWorld.clone());
    await stepFrames(24);
    runtimeMeshes().forEach((mesh, index) => {
        expect(mesh).toBe(meshes[index]);
        expect(mesh.matrixWorld.equals(positions[index])).toBe(true);
        expect(mesh.geometry).toBe(fixture.geometry);
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
            expect(material.map).toBe(material.userData.housemaker_material_id === "material-a"
                ? fixture.full.material.map : secondFull.material.map);
        });
    });
    expect(fixture.authored.material).toEqual([fixture.fallback, second]);
    expect(fixture.source.material).toBe(fixture.fallback);
});

test("sun shadow shader hooks survive fallback, preview, and full streaming", async () => {
    fixture = makeFixture({ mirror: true, instances: true });
    const sourceCompile = jest.fn(function compileAuthored(shader) {
        shader.fragmentShader = `#define AUTHORED_MATERIAL\n${shader.fragmentShader}`;
    });
    const sourceCacheKey = () => "authored-material";
    fixture.fallback.onBeforeCompile = sourceCompile;
    fixture.fallback.customProgramCacheKey = sourceCacheKey;
    const physical = makeMaterial("material-a", 512, true);
    physical.roughness = 0.35;
    physical.clearcoat = 0.6;
    fixture.full = makePack("material-a", "full", { material: physical });
    fixture.manifest.roomAssets.materials[0].variants.full = fixture.full.descriptor;
    let finishFullDownload;
    fixture.full.response = new Promise((resolve) => { finishFullDownload = resolve; });
    const sourceMaterials = [fixture.fallback, fixture.preview.material, physical];
    const sourceState = sourceMaterials.map((material) => ({
        material, map: material.map, compile: material.onBeforeCompile,
        cacheKey: material.customProgramCacheKey,
        disposeMaterial: jest.spyOn(material, "dispose"),
        disposeTexture: jest.spyOn(material.map, "dispose")
    }));
    const disposeGeometry = jest.spyOn(fixture.geometry, "dispose");
    await mountLoader({ shadowSoftness: 2 });
    const meshes = runtimeMeshes();
    expect(meshes).toHaveLength(3);
    expect(meshes.some((mesh) => mesh.isInstancedMesh)).toBe(true);
    expect(meshes.some((mesh) => mesh.userData.housemakerRuntimeMirror)).toBe(true);

    // Check the same rendered objects at every quality tier.
    const checkStage = (sourceMaterial) => {
        expect(runtimeMeshes()).toEqual(meshes);
        meshes.forEach((mesh) => {
            expect(mesh.material).not.toBe(sourceMaterial);
            expect(mesh.material.type).toBe(sourceMaterial.type);
            expect(mesh.material.map).toBe(sourceMaterial.map);
            expect(mesh.geometry).toBe(fixture.geometry);
            expect(mesh.castShadow).toBe(true);
            expect(mesh.receiveShadow).toBe(true);
            const shader = { fragmentShader: "#include <shadowmap_pars_fragment>" };
            mesh.material.onBeforeCompile(shader, renderer);
            expect(shader.fragmentShader).toContain("#define AUTHORED_MATERIAL");
            expect(shader.fragmentShader).toContain("float houseMakerSunShadow(");
            expect(shader.fragmentShader).not.toContain("#include <shadowmap_pars_fragment>");
            expect(mesh.material.customProgramCacheKey()).toBe("authored-material:housemaker-sun-pcss-v2");
        });
    };
    checkStage(fixture.fallback);
    await stepFrames(16);
    checkStage(fixture.preview.material);
    await nativeFiber.act(async () => {
        finishFullDownload({ ok: true, arrayBuffer: async () => fixture.full.bytes });
        await flushJobs();
    });
    await stepFrames(16);
    checkStage(physical);
    expect(meshes.every((mesh) => mesh.material.clearcoat === 0.6 && mesh.material.roughness === 0.35)).toBe(true);
    expect(sourceCompile).toHaveBeenCalledTimes(9);

    // Runtime cleanup never mutates or disposes shared source resources.
    await nativeFiber.act(async () => root.render(null));
    expect(runtimeMeshes()).toHaveLength(0);
    sourceState.forEach(({ material, map, compile, cacheKey, disposeMaterial, disposeTexture }) => {
        expect(material.map).toBe(map);
        expect(material.onBeforeCompile).toBe(compile);
        expect(material.customProgramCacheKey).toBe(cacheKey);
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    });
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(fixture.authored.material).toBe(fixture.fallback);
    expect(fixture.source.material).toBe(fixture.fallback);
});

test("streamed bulb materials retain current night emission and face passthrough", async () => {
    fixture = makeFixture({ mirror: true, instances: true });
    const housing = new THREE.Mesh(fixture.geometry.clone(), fixture.fallback);
    housing.name = "Unrelated fixture housing";
    housing.position.set(1, 1, -4);
    fixture.gltf.scene.add(housing);
    fixture.gltf.parser.associations.set(fixture.authored, { meshes: 0, primitives: 0 });
    fixture.gltf.parser.associations.set(fixture.source, { meshes: 1, primitives: 0 });
    fixture.gltf.parser.associations.set(housing, { meshes: 2, primitives: 0 });
    fixture.manifest.faceLighting = [fixture.authored, fixture.source].map((mesh, index) => ({
        nodeName: mesh.name, meshIndex: index, primitiveIndex: 0,
        lightPassthrough: true, emissiveLinearRgb: [1.11, 0.8273986725898301, 0.494173325913013],
        nightOnly: true, baseMaterialName: fixture.fallback.name, baseMaterialIndex: 0
    }));
    fixture.manifest.directionalLights = [{
        id: "sun", position: [0, 12, 0], target: [3, 0, -2], color: "#ffffff", intensity: 2.7, castShadow: true
    }];
    fixture.manifest.objectLights = [{
        id: "fixture-light", type: "point", position: [0, 1.5, -4],
        color: "#ffe0b2", intensity: 1.11, rangeMeters: 8, castShadow: true
    }];
    let finishFullDownload;
    fixture.full.response = new Promise((resolve) => { finishFullDownload = resolve; });
    const environment = { current: { ready: true, error: null, prepare: jest.fn(), update: jest.fn(), reset: jest.fn() } };
    let settings = { dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 81 };
    await mountLoader({ dayNightSettings: settings, dayNightEnvironment: environment }, true);
    const meshes = runtimeMeshes();
    const bulbs = meshes.filter((mesh) => mesh.geometry === fixture.geometry);
    const normal = meshes.find((mesh) => mesh.name === housing.name);
    expect(bulbs).toHaveLength(3);
    expect(bulbs.some((mesh) => mesh.isInstancedMesh)).toBe(true);
    expect(bulbs.some((mesh) => mesh.userData.housemakerRuntimeMirror)).toBe(true);

    // Quality upgrades retain emission without changing neighboring material slots.
    const checkStage = (sourceMaterial, factor) => {
        expect(runtimeMeshes()).toEqual(meshes);
        bulbs.forEach((mesh) => {
            expect(mesh.material.map).toBe(sourceMaterial.map);
            expect(mesh.material.emissive.r * mesh.material.emissiveIntensity).toBeCloseTo(1.11 * factor, 9);
            expect(mesh.material.emissive.g * mesh.material.emissiveIntensity).toBeCloseTo(0.8273986725898301 * factor, 9);
            expect(mesh.material.emissive.b * mesh.material.emissiveIntensity).toBeCloseTo(0.494173325913013 * factor, 9);
            expect(mesh.castShadow).toBe(false);
            expect(mesh.material.side).toBe(THREE.FrontSide);
            expect(mesh.geometry).toBe(fixture.geometry);
        });
        expect(normal.material.map).toBe(sourceMaterial.map);
        expect(normal.material.emissive.getHex()).toBe(0);
        expect(normal.castShadow).toBe(true);
    };
    checkStage(fixture.fallback, 0.5);
    await stepFrames(16);
    checkStage(fixture.preview.material, 0.5);
    settings = { ...settings, dayNightCommand: 2, dayNightProgress: 100 };
    await mountLoader({ dayNightSettings: settings, dayNightEnvironment: environment }, true);
    checkStage(fixture.preview.material, 1);
    await nativeFiber.act(async () => {
        finishFullDownload({ ok: true, arrayBuffer: async () => fixture.full.bytes });
        await flushJobs();
    });
    await stepFrames(16);
    checkStage(fixture.full.material, 1);
    settings = { ...settings, dayNightAction: "reset", dayNightCommand: 3 };
    await mountLoader({ dayNightSettings: settings, dayNightEnvironment: environment }, true);
    checkStage(fixture.full.material, 0);
    expect(fixture.fallback.emissive.getHex()).toBe(0);
    expect(fixture.preview.material.emissive.getHex()).toBe(0);
    expect(fixture.full.material.emissive.getHex()).toBe(0);
});

test("a late preview cannot replace an already ready full material", async () => {
    let resolvePreview;
    fixture.preview.response = new Promise((resolve) => { resolvePreview = resolve; });
    await mountLoader();
    await stepFrames(16);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
    const fullMaterial = runtimeMeshes()[0].material;
    await nativeFiber.act(async () => {
        resolvePreview({ ok: true, arrayBuffer: async () => fixture.preview.bytes });
        await flushJobs();
    });
    await stepFrames(12);
    expect(runtimeMeshes()[0].material).toBe(fullMaterial);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
});

test("individual failed packs leave the embedded scene visible", async () => {
    fixture.preview.error = new Error("preview unavailable");
    fixture.full.error = new Error("full unavailable");
    await mountLoader();
    await stepFrames(16);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    expect(runtimeMeshes()[0].visible).toBe(true);
    expect(fixture.fallback.opacity).toBe(1);
});

test("failed full quality retains the successfully loaded preview", async () => {
    fixture.full.error = new Error("full unavailable");
    await mountLoader();
    await stepFrames(16);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.preview.material.map);
    expect(runtimeMeshes()[0].visible).toBe(true);
    expect(store.getState().scene.children[0].userData.housemakerMaterialStreaming.materials["material-a"].tier).toBe("preview");
});

test("textures upload within the frame limit before shader-ready replacements bind", async () => {
    fixture.full.material.normalMap = new THREE.Texture({ width: 512, height: 512 });
    let resolveShaders;
    const shadersReady = new Promise((resolve) => { resolveShaders = resolve; });
    renderer.compileAsync.mockImplementation(() => shadersReady);
    await mountLoader();
    for (let index = 0; index < 12; index += 1) {
        const previousUploads = renderer.initTexture.mock.calls.length;
        await stepFrames();
        expect(renderer.initTexture.mock.calls.length - previousUploads).toBeLessThanOrEqual(1);
    }
    expect(renderer.initTexture).toHaveBeenCalledWith(fixture.full.material.normalMap);
    expect(renderer.compileAsync).toHaveBeenCalled();
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    await nativeFiber.act(async () => {
        resolveShaders();
        await flushJobs();
    });
    await stepFrames(2);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
});

test("a shader preparation failure retains the embedded fallback", async () => {
    renderer.compileAsync.mockRejectedValue(new Error("shader preparation failed"));
    await mountLoader();
    await stepFrames(16);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    expect(runtimeMeshes()[0].visible).toBe(true);
    expect(store.getState().scene.children[0].userData.housemakerMaterialStreaming.errors).toBeGreaterThan(0);
});

test("a synchronous texture upload failure retains the embedded fallback", async () => {
    renderer.initTexture.mockImplementation(() => { throw new Error("GPU upload failed"); });
    await mountLoader();
    await stepFrames(16);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.fallback.map);
    expect(runtimeMeshes()[0].visible).toBe(true);
    expect(store.getState().scene.children[0].userData.housemakerMaterialStreaming.errors).toBeGreaterThan(0);
});

test("material upgrades preserve object fades, shadows, geometry, and UV channels", async () => {
    fixture.manifest.objectLights = [{
        id: "point-shadow", type: "point", position: [2, 3, -4],
        color: "#ffffff", intensity: 2, rangeMeters: 8, castShadow: true
    }];
    await mountLoader();
    const mesh = runtimeMeshes()[0];
    const geometry = mesh.geometry;
    const uv = geometry.attributes.uv;
    const uv1 = geometry.attributes.uv1;
    const distanceMaterial = mesh.customDistanceMaterial;
    const shader = {fragmentShader: THREE.ShaderLib.distanceRGBA.fragmentShader, uniforms: {}};
    distanceMaterial.onBeforeCompile(shader);
    expect(distanceMaterial.isMeshDistanceMaterial).toBe(true);
    expect(distanceMaterial.alphaHash).toBe(true);
    expect(shader.fragmentShader).toContain("vec4( 1.0, 1.0, 1.0, houseMakerFadeOpacity )");
    fireEvent.keyDown(window, { key: "a" });
    await stepFrames(2, 0.1);
    const opacity = mesh.material.opacity;
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    expect(distanceMaterial.opacity).toBeCloseTo(opacity);
    expect(shader.uniforms.houseMakerFadeOpacity.value).toBeCloseTo(opacity);
    await stepFrames(16, 0);
    expect(mesh.material.map).toBe(fixture.full.material.map);
    expect(mesh.material.opacity).toBeCloseTo(opacity);
    expect(mesh.customDepthMaterial.map).toBe(mesh.material.map);
    expect(mesh.customDepthMaterial.opacity).toBeCloseTo(opacity);
    expect(mesh.customDistanceMaterial).toBe(distanceMaterial);
    expect(distanceMaterial.map).toBe(mesh.material.map);
    expect(distanceMaterial.opacity).toBeCloseTo(opacity);
    expect(shader.uniforms.houseMakerFadeOpacity.value).toBeCloseTo(opacity);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.geometry.attributes.uv).toBe(uv);
    expect(mesh.geometry.attributes.uv1).toBe(uv1);
    expect(fixture.fallback.opacity).toBe(1);
});

test("Strict Mode reloads retain shared fallback resources and remove runtime ownership", async () => {
    const disposeFallback = jest.spyOn(fixture.fallback, "dispose");
    const disposeTexture = jest.spyOn(fixture.fallback.map, "dispose");
    const disposeGeometry = jest.spyOn(fixture.geometry, "dispose");
    await mountLoader({}, true);
    await stepFrames(16);
    const originalMesh = runtimeMeshes()[0];
    expect(originalMesh.material.map).toBe(fixture.full.material.map);
    await mountLoader({ jsonFile: "replacement.json" }, true);
    await stepFrames(16);
    expect(runtimeMeshes()).toHaveLength(1);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
    await nativeFiber.act(async () => root.render(null));
    expect(store.getState().scene.children).toHaveLength(0);
    expect(disposeFallback).not.toHaveBeenCalled();
    expect(disposeTexture).not.toHaveBeenCalled();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(fixture.authored.material).toBe(fixture.fallback);
});

test("camera movement reprioritizes visible packs without hiding unloaded rooms", async () => {
    fixture.manifest.materialStreaming.scheduler.maxConcurrentDownloads = 1;
    fixture.manifest.materialStreaming.roomSelection = { exitHysteresisMeters: 0, exitHysteresisMilliseconds: 0 };
    let resolveFirstDownload;
    fixture.preview.response = new Promise((resolve) => { resolveFirstDownload = resolve; });
    addSecondRoom();
    await mountLoader();
    await stepFrames(3);
    expect(globalThis.fetch.mock.calls[0][0]).toContain("material-a.preview.glb");
    camera.position.set(25, 1.7, 0);
    await stepFrames(8);
    await nativeFiber.act(async () => {
        resolveFirstDownload({ ok: true, arrayBuffer: async () => fixture.preview.bytes });
        await flushJobs();
    });
    await stepFrames(2);
    expect(globalThis.fetch.mock.calls[1][0]).toContain("material-b.preview.glb");
    const telemetry = store.getState().scene.children[0].userData.housemakerMaterialStreaming;
    expect(telemetry.currentRoomId).toBe("room-b");
    expect(telemetry.materials["material-b"].visible).toBe(true);
    expect(runtimeMeshes().every((entry) => entry.visible)).toBe(true);
});

test("physical glass upgrades preserve their material class and current fade", async () => {
    const glass = makeMaterial("material-a", 512, true);
    glass.transparent = true;
    glass.opacity = 0.4;
    glass.transmission = 0.8;
    fixture.full = makePack("material-a", "full", { material: glass });
    fixture.manifest.roomAssets.materials[0].variants.full = fixture.full.descriptor;
    await mountLoader();
    const mesh = runtimeMeshes()[0];
    expect(mesh.castShadow).toBe(true);
    fireEvent.keyDown(window, { key: "a" });
    await stepFrames(2, 0.1);
    const fadeOpacity = mesh.material.opacity;
    await stepFrames(16, 0);
    expect(mesh.material.isMeshPhysicalMaterial).toBe(true);
    expect(mesh.material.transmission).toBe(0.8);
    expect(mesh.material.opacity).toBeCloseTo(0.4 * fadeOpacity);
    expect(mesh.customDepthMaterial.opacity).toBeCloseTo(mesh.material.opacity);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
    expect(glass.opacity).toBe(0.4);
    expect(fixture.fallback.opacity).toBe(1);
});

test("multiple loader owners share downloads without disposing another owner's textures", async () => {
    const disposeTexture = jest.spyOn(fixture.full.material.map, "dispose");
    await nativeFiber.act(async () => {
        store = root.render(<>
            <HouseMakerLoader key="a" toursEnabled={false} shadowsEnabled />
            <HouseMakerLoader key="b" toursEnabled={false} shadowsEnabled position={[1, 0, 0]} />
        </>);
    });
    await stepFrames(16);
    expect(runtimeMeshes()).toHaveLength(2);
    expect(runtimeMeshes().every((mesh) => mesh.material.map === fixture.full.material.map)).toBe(true);
    expect(globalThis.fetch.mock.calls.filter(([url]) => url.includes("material-a.full.glb"))).toHaveLength(1);
    await nativeFiber.act(async () => root.render(<HouseMakerLoader key="a" toursEnabled={false} shadowsEnabled />));
    await stepFrames(4);
    expect(runtimeMeshes()).toHaveLength(1);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.full.material.map);
    expect(disposeTexture).not.toHaveBeenCalled();
});

test("anisotropic filtering applies to arriving packs and subsequent toggles", async () => {
    await mountLoader({ anisotropicFilteringEnabled: true, anisotropy: 3 });
    await stepFrames(16);
    const mesh = runtimeMeshes()[0];
    expect(mesh.material.map).toBe(fixture.full.material.map);
    expect(mesh.material.map.anisotropy).toBe(3);
    const material = mesh.material;
    const downloadCount = globalThis.fetch.mock.calls.length;
    const decodeCount = GLTFLoader.prototype.parseAsync.mock.calls.length;
    await mountLoader({ anisotropicFilteringEnabled: true, anisotropy: 16 });
    expect(mesh.material).toBe(material);
    expect(mesh.material.map.anisotropy).toBe(8);
    await stepFrames(4);
    expect(globalThis.fetch).toHaveBeenCalledTimes(downloadCount);
    expect(GLTFLoader.prototype.parseAsync).toHaveBeenCalledTimes(decodeCount);
    await mountLoader({ anisotropicFilteringEnabled: false });
    expect(runtimeMeshes()[0]).toBe(mesh);
    expect(mesh.material.map.anisotropy).toBe(1);
    await stepFrames(4);
    expect(mesh.material.map.anisotropy).toBe(1);
    expect(mesh.material.map).toBe(fixture.full.material.map);
});

test("a preview swap cannot dispose another pack's pending shader material", async () => {
    const compiling = new Map();
    renderer.compileAsync.mockImplementation((scene) => {
        const material = scene.children[0].material;
        return new Promise((resolve) => compiling.set(material.userData.housemakerMaterialTier, {
            material, resolve, dispose: jest.spyOn(material, "dispose")
        }));
    });
    const disposeFallback = jest.spyOn(fixture.fallback, "dispose");
    await mountLoader();
    await stepFrames(12);
    expect(compiling.has("preview")).toBe(true);
    expect(compiling.has("full")).toBe(true);
    await nativeFiber.act(async () => {
        compiling.get("preview").resolve();
        await flushJobs();
    });
    await stepFrames(2);
    expect(runtimeMeshes()[0].material.map).toBe(fixture.preview.material.map);
    expect(compiling.get("full").dispose).not.toHaveBeenCalled();
    await nativeFiber.act(async () => root.render(null));
    expect(compiling.get("full").dispose).not.toHaveBeenCalled();
    await nativeFiber.act(async () => {
        compiling.get("full").resolve();
        await flushJobs();
    });
    expect(runtimeMeshes()).toHaveLength(0);
    expect(compiling.get("full").dispose).toHaveBeenCalledTimes(1);
    expect(disposeFallback).not.toHaveBeenCalled();
    expect(fixture.authored.material).toBe(fixture.fallback);
});

test("projected GPU budgets evict unprotected full quality and allow revisits", async () => {
    const second = addSecondRoom();
    fixture.manifest.materialStreaming.roomSelection = { exitHysteresisMeters: 0, exitHysteresisMilliseconds: 0 };
    fixture.manifest.materialStreaming.cache = {
        desktopGpuBudgetMiB: 2, mobileGpuBudgetMiB: 2, retainPreviousRoomMilliseconds: 0, keepEmbeddedFallbacks: true
    };
    await mountLoader();
    await stepFrames(24);
    const [firstMesh, secondMesh] = runtimeMeshes();
    expect(firstMesh.material.map).toBe(fixture.full.material.map);
    expect(secondMesh.material.map).not.toBe(second.full.material.map);
    camera.position.set(25, 1.7, 0);
    await stepFrames(32);
    expect(secondMesh.material.map).toBe(second.full.material.map);
    expect(firstMesh.material.map).not.toBe(fixture.full.material.map);
    const telemetry = store.getState().scene.children[0].userData.housemakerMaterialStreaming;
    expect(telemetry.gpuResidentBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    camera.position.set(0, 1.7, 0);
    await stepFrames(32);
    expect(firstMesh.material.map).toBe(fixture.full.material.map);
    expect(telemetry.gpuResidentBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(renderer.compileAsync.mock.calls.filter(([scene]) => scene.children[0].material.userData.housemaker_material_id === "material-a"
        && scene.children[0].material.userData.housemakerMaterialTier === "full").length).toBeGreaterThanOrEqual(2);
    expect(runtimeMeshes().every((mesh) => mesh.visible)).toBe(true);
});
