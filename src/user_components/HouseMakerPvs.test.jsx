/* eslint-disable testing-library/no-unnecessary-act -- Native R3F roots require act. */
/* eslint-disable testing-library/no-node-access, testing-library/render-result-naming-convention */

import React, { StrictMode } from "react";
import { fireEvent } from "@testing-library/react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { createPvsController } from "http://localhost/models/pvs-scene.pvs.mjs";
import { HouseMakerLoader } from "./HouseMakerLoader.jsx";

jest.mock("@react-three/fiber", () => ({
    useFrame: jest.fn(),
    useLoader: jest.fn(),
    useThree: jest.fn(() => ({ capabilities: { getMaxAnisotropy: () => 1 } }))
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: function GLTFLoader() {} }));
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => ({ mergeGeometries: jest.fn() }));
jest.mock("./HouseMakerTourPlayer.jsx", () => ({ HouseMakerTourPlayer: () => null }));
jest.mock("http://localhost/models/pvs-scene.pvs.mjs", () => ({
    createPvsController: jest.fn()
}), { virtual: true });

// Build two cells sharing geometry, shadows, and visibility boundaries.
function makeFixtures() {
    const bytes = Uint8Array.from([1, 2, 3, 4]).buffer;
    const digest = Uint8Array.from(require("crypto").createHash("sha256").update(Buffer.from(bytes)).digest());
    const glbSha256 = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
    const geometry = new THREE.BoxGeometry();
    geometry.setDrawRange(3, 12);
    const material = new THREE.MeshStandardMaterial();
    const sourceScene = new THREE.Scene();
    const first = new THREE.Mesh(geometry, material);
    first.name = "cluster-a";
    first.castShadow = true;
    first.receiveShadow = true;
    first.userData.housemaker_atlas_type = "object";
    const second = new THREE.Mesh(geometry, material);
    second.name = "cluster-b";
    second.castShadow = true;
    second.receiveShadow = true;
    second.userData.housemaker_atlas_type = "surface";
    const unlisted = new THREE.Mesh(geometry, material);
    unlisted.name = "unlisted";
    const authoredHidden = new THREE.Mesh(geometry, material);
    authoredHidden.name = "authored-hidden";
    authoredHidden.visible = false;
    sourceScene.add(first, second, unlisted, authoredHidden);
    const visibility = {
        version: 1,
        algorithmVersion: 1,
        coordinateSystem: "gltf-y-up",
        sourceSignature: "1".repeat(64),
        glbSha256,
        fallback: "frustum-only",
        unlistedNodes: "frustum-only",
        clusters: ["a", "b"].map((id) => ({
            id,
            nodeNames: [`cluster-${id}`],
            instanceIds: [],
            min: [-5, 0, -5],
            max: [5, 5, 5]
        })),
        cells: [
            { id: "left", min: [-5, 0, -5], max: [0, 5, 5], visibleClusterIds: ["a"] },
            { id: "right", min: [0, 0, -5], max: [5, 5, 5], visibleClusterIds: ["b"] }
        ]
    };
    const manifest = {
        format: "housemaker-r3f-scene",
        version: 10,
        coordinateSystem: "gltf-y-up",
        asset: { glb: "pvs-scene.glb", sha256: glbSha256 },
        visibility,
        instanceGroups: [],
        doorBodyReconstructions: []
    };
    return {
        bytes,
        digest,
        manifest,
        sourceScene,
        geometry,
        material,
        gltf: { scene: sourceScene, scenes: [sourceScene], parser: { associations: new Map() } }
    };
}

describe("HouseMaker baked visibility", () => {
    const nativeFiber = jest.requireActual("@react-three/fiber");
    let root;
    let store;
    let fixtures;
    let cryptoDescriptor;
    let cacheEnabled;
    let digestMock;
    let renderer;
    let camera;

    beforeEach(() => {
        fixtures = makeFixtures();
        useFrame.mockClear();
        createPvsController.mockClear();
        createPvsController.mockImplementation((options) => (
            jest.requireActual("../../public/models/housemaker_export.pvs.mjs").createPvsController(options)
        ));
        useLoader.mockImplementation((Loader, url) => String(url).endsWith(".json") ? fixtures.manifest : fixtures.gltf);
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "warn").mockImplementation(() => {});
        cryptoDescriptor = Object.getOwnPropertyDescriptor(window, "crypto");
        digestMock = jest.fn(() => Promise.resolve(fixtures.digest.buffer));
        Object.defineProperty(window, "crypto", { configurable: true, value: { subtle: { digest: digestMock } } });
        cacheEnabled = THREE.Cache.enabled;
        THREE.Cache.enabled = true;
        THREE.Cache.add("/models/pvs-scene.glb", fixtures.bytes);
        nativeFiber.extend(THREE);
        const canvas = document.createElement("canvas");
        root = nativeFiber.createRoot(canvas);
        renderer = {
            render: jest.fn(),
            setPixelRatio: jest.fn(),
            setSize: jest.fn(),
            domElement: canvas,
            shadowMap: {},
            info: { render: { frame: 0 } }
        };
        root.configure({
            gl: renderer,
            frameloop: "never",
            size: { width: 800, height: 600, top: 0, left: 0 }
        });
        camera = new THREE.PerspectiveCamera();
        camera.position.set(-2, 2, 0);
    });

    afterEach(async () => {
        await nativeFiber.act(async () => root.unmount());
        if (cryptoDescriptor) Object.defineProperty(window, "crypto", cryptoDescriptor);
        else delete window.crypto;
        THREE.Cache.remove("/models/pvs-scene.glb");
        THREE.Cache.enabled = cacheEnabled;
        useLoader.mockReset();
        jest.restoreAllMocks();
    });

    // Mount native Three objects and finish asynchronous validation.
    async function mountLoader(props = {}, strict = false) {
        await nativeFiber.act(async () => {
            const loader = <HouseMakerLoader toursEnabled={false} {...props} />;
            store = root.render(strict ? <StrictMode>{loader}</StrictMode> : loader);
        });
        return store.getState().scene.children[0];
    }

    // Execute actual callbacks around an observable camera draw.
    function cameraDraw(mesh) {
        renderer.info.render.frame += 1;
        mesh.onBeforeRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        const count = mesh.geometry.drawRange.count;
        mesh.onAfterRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        return count;
    }

    test("verifies loaded bytes without another GLB fetch", async () => {
        const sceneRoot = await mountLoader();
        expect(digestMock).toHaveBeenCalledWith("SHA-256", fixtures.bytes);
        expect(digestMock).toHaveBeenCalledTimes(1);
        expect(useLoader).toHaveBeenCalledTimes(2);
        expect(createPvsController).toHaveBeenCalledTimes(1);
        expect(console.warn).not.toHaveBeenCalled();
        const options = createPvsController.mock.calls[0][0];
        expect(options.expectedGlbSha256).toBe(fixtures.manifest.asset.sha256);
        expect(options.scene).not.toBe(sceneRoot.children[0]);
        expect(options.scene.parent).toBeNull();
        expect(options.scene.getObjectByName("cluster-b").geometry).toBe(fixtures.geometry);
        expect(options.cullShadowCasters).toBe(true);
    });

    test("culls camera draws while preserving shadows and collision visibility", async () => {
        const sceneRoot = await mountLoader();
        const first = sceneRoot.getObjectByName("cluster-a");
        const second = sceneRoot.getObjectByName("cluster-b");
        const shadowBefore = second.onBeforeShadow;
        const shadowAfter = second.onAfterShadow;
        expect(cameraDraw(first)).toBe(12);
        expect(cameraDraw(second)).toBe(0);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        expect(first.visible).toBe(true);
        expect(second.visible).toBe(true);
        expect(second.castShadow).toBe(true);
        expect(second.receiveShadow).toBe(true);
        expect(second.onBeforeShadow).toBe(shadowBefore);
        expect(second.onAfterShadow).toBe(shadowAfter);
        expect(cameraDraw(sceneRoot.getObjectByName("unlisted"))).toBe(12);
        expect(sceneRoot.getObjectByName("authored-hidden").visible).toBe(false);
        expect(fixtures.sourceScene.getObjectByName("cluster-b").onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
        expect(fixtures.sourceScene.getObjectByName("authored-hidden").visible).toBe(false);
    });

    test("uses current camera pose after navigation and unions cell boundaries", async () => {
        const sceneRoot = await mountLoader();
        const first = sceneRoot.getObjectByName("cluster-a");
        const second = sceneRoot.getObjectByName("cluster-b");
        expect(cameraDraw(second)).toBe(0);
        camera.position.x = 2;
        expect(cameraDraw(first)).toBe(0);
        expect(cameraDraw(second)).toBe(12);
        camera.position.x = 0;
        expect(cameraDraw(first)).toBe(12);
        expect(cameraDraw(second)).toBe(12);
        camera.position.set(100, 2, 0);
        expect(cameraDraw(first)).toBe(12);
        expect(cameraDraw(second)).toBe(12);
    });

    test("converts camera through loader-level transforms only", async () => {
        const sceneRoot = await mountLoader({ position: [10, 3, -4] });
        sceneRoot.rotation.set(0, Math.PI / 3, 0);
        sceneRoot.scale.set(2, 3, 4);
        camera.position.copy(sceneRoot.localToWorld(new THREE.Vector3(-2, 2, 0)));
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-a"))).toBe(12);
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-b"))).toBe(0);
    });

    test("keeps manual and A-toggle visibility independent of proxy baseline", async () => {
        const sceneRoot = await mountLoader();
        const first = sceneRoot.getObjectByName("cluster-a");
        expect(cameraDraw(first)).toBe(12);
        first.visible = false;
        camera.position.x = 2;
        cameraDraw(first);
        expect(first.visible).toBe(false);
        first.visible = true;
        fireEvent.keyDown(window, { key: "a" });
        const fade = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        fade({}, 1);
        expect(first.visible).toBe(false);
        camera.position.x = -2;
        cameraDraw(first);
        expect(first.visible).toBe(false);
        fireEvent.keyDown(window, { key: "a" });
        fade({}, 1);
        expect(first.visible).toBe(true);
        expect(cameraDraw(first)).toBe(12);
    });

    test("restores interrupted shared draw ranges before subsequent frame work", async () => {
        const sceneRoot = await mountLoader();
        const second = sceneRoot.getObjectByName("cluster-b");
        renderer.info.render.frame += 1;
        second.onBeforeRender(renderer, store.getState().scene, camera, second.geometry, second.material, null);
        expect(fixtures.geometry.drawRange.count).toBe(0);
        expect(fixtures.geometry.drawRange.start).toBeGreaterThan(fixtures.geometry.index.count);
        const restoreFrame = useFrame.mock.calls.find(([, priority]) => priority === -1000)[0];
        restoreFrame();
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        expect(second.visible).toBe(true);
    });

    test("chains authored callbacks and restores them on cleanup", async () => {
        let resolveDigest;
        digestMock.mockImplementation(() => new Promise((resolve) => { resolveDigest = resolve; }));
        const sceneRoot = await mountLoader();
        const second = sceneRoot.getObjectByName("cluster-b");
        const before = jest.fn();
        const after = jest.fn(() => expect(second.geometry.drawRange.count).toBe(12));
        second.onBeforeRender = before;
        second.onAfterRender = after;
        const geometryDispose = jest.spyOn(fixtures.geometry, "dispose");
        const materialDispose = jest.spyOn(fixtures.material, "dispose");
        await nativeFiber.act(async () => resolveDigest(fixtures.digest.buffer));
        expect(cameraDraw(second)).toBe(0);
        expect(before).toHaveBeenCalledTimes(1);
        expect(after).toHaveBeenCalledTimes(1);
        renderer.info.render.frame += 1;
        second.onBeforeRender(renderer, store.getState().scene, camera, second.geometry, second.material, null);
        await nativeFiber.act(async () => root.render(null));
        expect(second.onBeforeRender).toBe(before);
        expect(second.onAfterRender).toBe(after);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(materialDispose).not.toHaveBeenCalled();
    });

    test.each(["indexed", "non-indexed"])("skips %s multi-material submissions and restores shared ranges", async (kind) => {
        const source = fixtures.sourceScene.getObjectByName("cluster-b");
        if (kind === "non-indexed") source.geometry = fixtures.geometry.toNonIndexed();
        source.geometry.clearGroups();
        source.geometry.addGroup(3, 6, 0);
        source.geometry.addGroup(9, 6, 1);
        source.material = [fixtures.material, fixtures.material];
        const sceneRoot = await mountLoader();
        const second = sceneRoot.getObjectByName("cluster-b");
        const geometry = second.geometry;
        const vertexCount = geometry.index?.count ?? geometry.attributes.position.count;
        const originalRange = { ...geometry.drawRange };
        for (const group of geometry.groups) {
            renderer.info.render.frame += 1;
            second.onBeforeRender(renderer, store.getState().scene, camera, geometry, second.material[group.materialIndex], group);
            const { start, count } = geometry.drawRange;
            const drawCount = Math.min(start + count, vertexCount) - Math.max(start, 0);
            expect(start).toBeGreaterThanOrEqual(0);
            expect(count).toBe(0);
            expect(drawCount).toBeLessThan(0);
            second.onAfterRender(renderer, store.getState().scene, camera, geometry, second.material[group.materialIndex], group);
            expect(geometry.drawRange).toEqual(originalRange);
        }
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-a"))).toBe(12);
    });

    test("keeps loaders independent while sharing geometry and unmounting one", async () => {
        await nativeFiber.act(async () => {
            store = root.render(<>
                <HouseMakerLoader key="first" toursEnabled={false} />
                <HouseMakerLoader key="second" toursEnabled={false} position={[20, 0, 0]} />
            </>);
        });
        const [firstRoot, secondRoot] = store.getState().scene.children;
        const first = firstRoot.getObjectByName("cluster-b");
        const second = secondRoot.getObjectByName("cluster-b");
        expect(first.geometry).toBe(second.geometry);
        expect(cameraDraw(first)).toBe(0);
        expect(cameraDraw(second)).toBe(12);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        camera.position.x = 18;
        expect(cameraDraw(first)).toBe(12);
        expect(cameraDraw(second)).toBe(0);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        await nativeFiber.act(async () => {
            root.render(<>
                <HouseMakerLoader key="second" toursEnabled={false} position={[20, 0, 0]} />
            </>);
        });
        expect(store.getState().scene.children).toEqual([secondRoot]);
        expect(first.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
        expect(cameraDraw(second)).toBe(0);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
    });

    test("does not install stale callbacks after an asynchronous unmount", async () => {
        let resolveDigest;
        digestMock.mockImplementation(() => new Promise((resolve) => { resolveDigest = resolve; }));
        const sceneRoot = await mountLoader();
        const second = sceneRoot.getObjectByName("cluster-b");
        const before = second.onBeforeRender;
        await nativeFiber.act(async () => root.render(null));
        await nativeFiber.act(async () => resolveDigest(fixtures.digest.buffer));
        expect(second.onBeforeRender).toBe(before);
        expect(createPvsController).not.toHaveBeenCalled();
    });

    test("survives Strict Mode and manifest updates without callback stacking", async () => {
        let sceneRoot = await mountLoader({}, true);
        let second = sceneRoot.getObjectByName("cluster-b");
        expect(cameraDraw(second)).toBe(0);
        expect(digestMock).toHaveBeenCalledTimes(1);
        const originalBefore = THREE.Object3D.prototype.onBeforeRender;
        const oldSecond = second;
        fixtures.manifest = {
            ...fixtures.manifest,
            visibility: {
                ...fixtures.manifest.visibility,
                cells: fixtures.manifest.visibility.cells.map((cell) => ({ ...cell, visibleClusterIds: ["a", "b"] }))
            }
        };
        sceneRoot = await mountLoader({}, true);
        second = sceneRoot.getObjectByName("cluster-b");
        expect(oldSecond.onBeforeRender).toBe(originalBefore);
        expect(cameraDraw(second)).toBe(12);
        expect(digestMock).toHaveBeenCalledTimes(1);
        expect(fixtures.sourceScene.children).toHaveLength(4);
    });

    test("keeps debug cells off by default and non-interactive when enabled", async () => {
        let sceneRoot = await mountLoader();
        expect(sceneRoot.getObjectByName("HouseMaker baked PVS")).toBeUndefined();
        sceneRoot = await mountLoader({ showBakedPvs: true });
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        expect(lines.isLineSegments).toBe(true);
        expect(lines.parent).toBe(sceneRoot);
        expect(lines.geometry.attributes.position.count).toBe(48);
        expect(Array.from(lines.geometry.attributes.position.array.slice(0, 6))).toEqual([-5, 0, -5, 0, 0, -5]);
        expect(lines.material.vertexColors).toBe(true);
        expect(lines.material.depthTest).toBe(false);
        expect(lines.material.depthWrite).toBe(false);
        expect(lines.castShadow).toBe(false);
        expect(lines.receiveShadow).toBe(false);
        const intersections = [];
        lines.raycast(new THREE.Raycaster(), intersections);
        expect(intersections).toEqual([]);
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-b"))).toBe(0);
        expect(fixtures.sourceScene.children).toHaveLength(4);
    });

    test("highlights current debug cells and unions shared boundaries", async () => {
        const sceneRoot = await mountLoader({ showBakedPvs: true });
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        const colors = lines.geometry.attributes.color;
        const active = new THREE.Color("#4ade80");
        const inactive = new THREE.Color("#38bdf8");
        cameraDraw(lines);
        expect(colors.getX(0)).toBeCloseTo(active.r);
        expect(colors.getY(0)).toBeCloseTo(active.g);
        expect(colors.getX(24)).toBeCloseTo(inactive.r);
        const version = colors.version;
        cameraDraw(lines);
        expect(colors.version).toBe(version);
        camera.position.x = 2;
        cameraDraw(lines);
        expect(colors.getX(0)).toBeCloseTo(inactive.r);
        expect(colors.getX(24)).toBeCloseTo(active.r);
        camera.position.x = 0;
        cameraDraw(lines);
        expect(colors.getX(0)).toBeCloseTo(active.r);
        expect(colors.getX(24)).toBeCloseTo(active.r);
        camera.position.x = 100;
        cameraDraw(lines);
        expect(colors.getX(0)).toBeCloseTo(inactive.r);
        expect(colors.getX(24)).toBeCloseTo(inactive.r);
    });

    test("shares exported coordinates under transformed debug roots", async () => {
        const sceneRoot = await mountLoader({ showBakedPvs: true, position: [10, 3, -4] });
        sceneRoot.rotation.set(0, Math.PI / 3, 0);
        sceneRoot.scale.set(2, 3, 4);
        camera.position.copy(sceneRoot.localToWorld(new THREE.Vector3(-2, 2, 0)));
        const first = sceneRoot.getObjectByName("cluster-a");
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        renderer.info.render.frame += 1;
        first.onBeforeRender(renderer, store.getState().scene, camera, first.geometry, first.material, null);
        first.onAfterRender(renderer, store.getState().scene, camera, first.geometry, first.material, null);
        lines.onBeforeRender(renderer, store.getState().scene, camera);
        expect(lines.geometry.attributes.color.getX(0)).toBeCloseTo(new THREE.Color("#4ade80").r);
        expect(lines.geometry.attributes.color.getX(24)).toBeCloseTo(new THREE.Color("#38bdf8").r);
        expect(lines.position.toArray()).toEqual([0, 0, 0]);
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-b"))).toBe(0);
    });

    test("shows valid debug cells even when GLB verification fails", async () => {
        fixtures.manifest.visibility.glbSha256 = "0".repeat(64);
        fixtures.manifest.visibility.cells.push(
            null,
            { min: [0, 0, Infinity], max: [1, 1, 1] },
            { min: [5, 0, 0], max: [1, 1, 1] },
            { min: [0, 0], max: [1, 1, 1] }
        );
        const sceneRoot = await mountLoader({ showBakedPvs: true });
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        expect(lines.geometry.attributes.position.count).toBe(48);
        cameraDraw(lines);
        expect(lines.geometry.attributes.color.getX(0)).toBeCloseTo(new THREE.Color("#4ade80").r);
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-b"))).toBe(12);
    });

    test("removes and disposes only debug resources on toggle and unmount", async () => {
        let sceneRoot = await mountLoader({ showBakedPvs: true }, true);
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        const geometryDispose = jest.spyOn(lines.geometry, "dispose");
        const materialDispose = jest.spyOn(lines.material, "dispose");
        const sourceGeometryDispose = jest.spyOn(fixtures.geometry, "dispose");
        const sourceMaterialDispose = jest.spyOn(fixtures.material, "dispose");
        sceneRoot = await mountLoader({ showBakedPvs: true }, true);
        expect(sceneRoot.children.filter((child) => child.userData.housemakerPvsDebug)).toEqual([lines]);
        expect(geometryDispose).not.toHaveBeenCalled();
        sceneRoot = await mountLoader({ showBakedPvs: false }, true);
        expect(sceneRoot.getObjectByName("HouseMaker baked PVS")).toBeUndefined();
        expect(lines.parent).toBeNull();
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        sceneRoot = await mountLoader({ showBakedPvs: true }, true);
        const replacement = sceneRoot.getObjectByName("HouseMaker baked PVS");
        expect(replacement).not.toBe(lines);
        const replacementDispose = jest.spyOn(replacement.geometry, "dispose");
        await nativeFiber.act(async () => root.render(null));
        expect(replacement.parent).toBeNull();
        expect(replacementDispose).toHaveBeenCalledTimes(1);
        expect(sourceGeometryDispose).not.toHaveBeenCalled();
        expect(sourceMaterialDispose).not.toHaveBeenCalled();
    });

    test.each([undefined, [], [null, { min: [0], max: [1] }]])("ignores absent or malformed debug cells: %j", async (cells) => {
        fixtures.manifest.visibility.cells = cells;
        const sceneRoot = await mountLoader({ showBakedPvs: true });
        expect(sceneRoot.getObjectByName("HouseMaker baked PVS")).toBeUndefined();
    });

    test.each([
        ["missing visibility", () => { delete fixtures.manifest.visibility; }],
        ["malformed visibility", () => { fixtures.manifest.visibility.cells = []; }],
        ["mismatched loaded GLB", () => { fixtures.manifest.visibility.glbSha256 = "0".repeat(64); }],
        ["uncached GLB", () => { THREE.Cache.remove("/models/pvs-scene.glb"); }],
        ["unavailable Web Crypto", () => { Object.defineProperty(window.crypto, "subtle", { configurable: true, value: undefined }); }],
        ["malformed module", () => { createPvsController.mockImplementationOnce(() => ({ valid: false, reason: "invalid", dispose: jest.fn() })); }]
    ])("fails open for %s", async (label, invalidate) => {
        invalidate();
        const sceneRoot = await mountLoader();
        const second = sceneRoot.getObjectByName("cluster-b");
        expect(cameraDraw(second)).toBe(12);
        expect(second.visible).toBe(true);
        expect(fixtures.geometry.drawRange).toEqual({ start: 3, count: 12 });
        const expectedWarnings = label === "missing visibility" ? 0 : 1;
        expect(console.warn).toHaveBeenCalledTimes(expectedWarnings);
    });
});
