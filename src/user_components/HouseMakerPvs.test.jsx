/* eslint-disable testing-library/no-unnecessary-act -- Native R3F roots require act. */
/* eslint-disable testing-library/no-node-access, testing-library/render-result-naming-convention */

import React, { StrictMode } from "react";
import { fireEvent } from "@testing-library/react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createPvsController } from "http://localhost/models/pvs-scene.pvs.mjs";
import { HouseMakerLoader } from "./HouseMakerLoader.jsx";

jest.mock("@react-three/fiber", () => ({
    useFrame: jest.fn(),
    useLoader: jest.fn(),
    useThree: jest.fn(() => ({ capabilities: { getMaxAnisotropy: () => 1 } }))
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: function GLTFLoader() {} }));
jest.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({ KTX2Loader: function KTX2Loader() {} }));
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
        mergeGeometries.mockReset();
        mergeGeometries.mockImplementation((geometries) => {
            const merged = new THREE.BufferGeometry();
            for (const name of Object.keys(geometries[0].attributes)) {
                const attribute = geometries[0].getAttribute(name);
                merged.setAttribute(name, new THREE.Float32BufferAttribute(
                    geometries.flatMap((geometry) => Array.from(geometry.getAttribute(name).array)),
                    attribute.itemSize
                ));
            }
            const indices = [];
            let vertexOffset = 0;
            for (const geometry of geometries) {
                const offset = vertexOffset;
                indices.push(...Array.from(geometry.index.array, (index) => index + offset));
                vertexOffset += geometry.attributes.position.count;
            }
            merged.setIndex(indices);
            return merged;
        });
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
        prepareCameraDraw();
        mesh.onBeforeRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        const count = mesh.geometry.drawRange.count;
        mesh.onAfterRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        return count;
    }

    // Prepare visibility before Three uploads instance buffer attributes.
    function prepareCameraDraw() {
        const callbacks = [...useFrame.mock.calls].sort((first, second) => (first[1] ?? 0) - (second[1] ?? 0));
        callbacks.forEach(([callback]) => callback({ camera }, 0));
    }

    // Share one prototype across listed and unlisted logical instances.
    function addInstanceFixtures({ halfMesh = false, multipleParts = false } = {}) {
        const prototype = new THREE.Group();
        prototype.name = "chair-prototype";
        for (let index = 0; index < (multipleParts ? 2 : 1); index += 1) {
            const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
            const part = new THREE.Mesh(geometry, fixtures.material);
            part.name = `chair-part-${index}`;
            part.position.y = index * 0.25;
            part.castShadow = true;
            part.receiveShadow = true;
            part.userData.housemaker_atlas_type = "object";
            if (halfMesh) {
                part.userData.halfMesh = {
                    uvMode: "reuse",
                    mirrorPlane: { point: [0, 0, 0], normal: [1, 0, 0] }
                };
            }
            prototype.add(part);
        }
        const prototypeScene = new THREE.Scene();
        prototypeScene.add(prototype);
        fixtures.gltf.scenes.push(prototypeScene);
        fixtures.manifest.instanceGroups = [{
            sourceNodeName: prototype.name,
            halfMesh,
            instances: [
                { id: "chair-a", worldMatrix: new THREE.Matrix4().makeTranslation(-2, 0, 0).toArray() },
                { id: "chair-b", worldMatrix: new THREE.Matrix4().makeTranslation(2, 0, 0).toArray() },
                { id: "chair-unlisted", worldMatrix: new THREE.Matrix4().makeTranslation(8, 0, 0).toArray() }
            ]
        }];
        fixtures.manifest.visibility.clusters[0].instanceIds = ["chair-a"];
        fixtures.manifest.visibility.clusters[1].instanceIds = ["chair-b"];
        return prototype;
    }

    // Observe submitted instances, then restore their collision/shadow state.
    function instanceDraw(mesh) {
        renderer.info.render.frame += 1;
        prepareCameraDraw();
        mesh.onBeforeRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        const count = mesh.count;
        const matrices = Array.from({ length: count }, (_, index) => {
            const matrix = new THREE.Matrix4();
            mesh.getMatrixAt(index, matrix);
            return matrix.toArray();
        });
        mesh.onAfterRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        return { count, matrices };
    }

    test.each([false, true])("culls logical instances independently with halfMesh=%s", async (halfMesh) => {
        addInstanceFixtures({ halfMesh, multipleParts: true });
        const sceneRoot = await mountLoader();
        const meshes = sceneRoot.children.filter((node) => node.isInstancedMesh);
        expect(meshes).toHaveLength(2);
        expect(createPvsController.mock.calls[0][0].setInstanceVisible).toEqual(expect.any(Function));
        for (const mesh of meshes) {
            const sourceAttribute = mesh.instanceMatrix;
            const sourceMatrices = Array.from(sourceAttribute.array);
            const version = sourceAttribute.version;
            const material = mesh.material;
            const uv = mesh.geometry.attributes.uv.array.slice();
            expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
            expect(mesh.instanceMatrix).toBe(sourceAttribute);
            expect(Array.from(mesh.instanceMatrix.array)).toEqual(sourceMatrices);
            expect(mesh.instanceMatrix.version).toBe(version);
            expect(mesh.count).toBe(3);
            expect(mesh.visible).toBe(true);
            expect(mesh.castShadow).toBe(true);
            expect(mesh.receiveShadow).toBe(true);
            expect(mesh.material).toBe(material);
            expect(mesh.geometry.attributes.uv.array).toEqual(uv);
            mesh.geometry.computeBoundingBox();
            expect(mesh.geometry.attributes.position.count).toBe(halfMesh ? 48 : 24);
            expect(mesh.geometry.boundingBox.min.x).toBeCloseTo(halfMesh ? -1 : 0);
            expect(mesh.geometry.boundingBox.max.x).toBeCloseTo(1);
        }
        camera.position.x = 2;
        for (const mesh of meshes) {
            expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]);
        }
        camera.position.x = 0;
        for (const mesh of meshes) expect(instanceDraw(mesh).count).toBe(3);
        camera.position.x = 100;
        for (const mesh of meshes) expect(instanceDraw(mesh).count).toBe(3);
        expect(mergeGeometries).toHaveBeenCalledTimes(halfMesh ? 2 : 0);
    });

    test.each([false, true])("preserves logical IDs in mixed nighttime halfMesh=%s batches", async (halfMesh) => {
        const prototype = addInstanceFixtures({ halfMesh, multipleParts: true });
        const sourceDisposers = prototype.children.map((mesh) => jest.spyOn(mesh.geometry, "dispose"));
        fixtures.manifest.objectLights = [{
            id: "chair-a:light", objectId: "chair-a", type: "point", position: [-2, 1, 0],
            color: "#ffffff", intensity: 2, rangeMeters: 8, castShadow: true
        }];
        fixtures.manifest.directionalLights = [{
            id: "sun", position: [0, 12, 0], target: [2, 0, 0],
            color: "#ffffff", intensity: 2.7, castShadow: true
        }];
        const environment = { current: { ready: true, prepare: jest.fn(), update: jest.fn(), reset: jest.fn() } };
        const sceneRoot = await mountLoader({
            shadowsEnabled: true, dayNightEnvironment: environment,
            dayNightSettings: { dayNightAction: "preview", dayNightCommand: 1, dayNightProgress: 100 }
        });
        const meshes = sceneRoot.children.filter((node) => node.isInstancedMesh);
        const lit = meshes.filter((mesh) => mesh.userData.housemakerKeepWhenLit);
        const unlit = meshes.filter((mesh) => !mesh.userData.housemakerKeepWhenLit);
        const mergedDisposers = mergeGeometries.mock.results.map(({value}) => jest.spyOn(value, "dispose"));
        expect(meshes).toHaveLength(4);
        expect(lit).toHaveLength(2);
        expect(unlit).toHaveLength(2);
        expect(sceneRoot.userData.housemakerNightFactor).toBe(1);
        lit.forEach((mesh) => {
            expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2]);
            expect(mesh.count).toBe(1);
        });
        unlit.forEach((mesh) => {
            expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([8]);
            expect(mesh.count).toBe(2);
        });
        camera.position.x = 2;
        lit.forEach((mesh) => expect(instanceDraw(mesh).count).toBe(0));
        unlit.forEach((mesh) => expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]));
        const controller = createPvsController.mock.results[0].value;
        controller.setEnabled(false);
        lit.forEach((mesh) => expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2]));
        unlit.forEach((mesh) => expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]));
        meshes.forEach((mesh) => {
            expect(mesh.geometry.attributes.position.count).toBe(halfMesh ? 48 : 24);
            expect(mesh.castShadow).toBe(true);
            expect(mesh.receiveShadow).toBe(true);
        });
        await nativeFiber.act(async () => root.render(null));
        expect(mergedDisposers).toHaveLength(halfMesh ? 2 : 0);
        mergedDisposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
        sourceDisposers.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    });

    test("instance culling preserves manual visibility and object hiding", async () => {
        addInstanceFixtures();
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const matrixAttribute = mesh.instanceMatrix;
        const matrices = Array.from(matrixAttribute.array);
        expect(instanceDraw(mesh).count).toBe(2);
        mesh.visible = false;
        camera.position.x = 2;
        instanceDraw(mesh);
        expect(mesh.visible).toBe(false);
        mesh.visible = true;
        fireEvent.keyDown(window, { key: "a" });
        const fade = useFrame.mock.calls[useFrame.mock.calls.length - 1][0];
        fade({}, 1);
        expect(mesh.visible).toBe(false);
        camera.position.x = -2;
        instanceDraw(mesh);
        expect(mesh.visible).toBe(false);
        fireEvent.keyDown(window, { key: "a" });
        fade({}, 1);
        expect(mesh.visible).toBe(true);
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
        expect(mesh.instanceMatrix).toBe(matrixAttribute);
        expect(Array.from(matrixAttribute.array)).toEqual(matrices);
        expect(mesh.count).toBe(3);
    });

    test("skips a fully hidden batch without removing shadow or collision instances", async () => {
        addInstanceFixtures();
        fixtures.manifest.instanceGroups[0].instances.pop();
        fixtures.manifest.visibility.cells.push({
            id: "empty-room",
            min: [10, 0, -5],
            max: [15, 5, 5],
            visibleClusterIds: []
        });
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const matrixAttribute = mesh.instanceMatrix;
        const matrices = Array.from(matrixAttribute.array);
        camera.position.x = 12;
        expect(instanceDraw(mesh).count).toBe(0);
        expect(mesh.visible).toBe(true);
        expect(mesh.castShadow).toBe(true);
        expect(mesh.count).toBe(2);
        expect(mesh.instanceMatrix).toBe(matrixAttribute);
        expect(Array.from(matrixAttribute.array)).toEqual(matrices);
        camera.position.x = -2;
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2]);
    });

    test("restores instance buffers when a draw is interrupted", async () => {
        addInstanceFixtures({ halfMesh: true });
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const matrixAttribute = mesh.instanceMatrix;
        const matrices = Array.from(matrixAttribute.array);
        const beforeShadow = mesh.onBeforeShadow;
        const afterShadow = mesh.onAfterShadow;
        renderer.info.render.frame += 1;
        prepareCameraDraw();
        mesh.onBeforeRender(renderer, store.getState().scene, camera, mesh.geometry, mesh.material, null);
        expect(mesh.count).toBe(2);
        const restoreFrame = useFrame.mock.calls.find(([, priority]) => priority === -1000)[0];
        restoreFrame();
        expect(mesh.count).toBe(3);
        expect(mesh.instanceMatrix).toBe(matrixAttribute);
        expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);
        expect(mesh.onBeforeShadow).toBe(beforeShadow);
        expect(mesh.onAfterShadow).toBe(afterShadow);
    });

    test("disabled and disposed PVS restores every logical instance", async () => {
        addInstanceFixtures();
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const controller = createPvsController.mock.results[0].value;
        expect(instanceDraw(mesh).count).toBe(2);
        controller.setEnabled(false);
        expect(instanceDraw(mesh).count).toBe(3);
        controller.setEnabled(true);
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
        camera.position.x = 2;
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]);
        controller.dispose();
        expect(instanceDraw(mesh).count).toBe(3);
        expect(mesh.count).toBe(3);
    });

    test("preserves explicit instance visibility when PVS is disabled and disposed", async () => {
        addInstanceFixtures();
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const controller = createPvsController.mock.results[0].value;
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
        controller.setInstanceVisible("chair-a", false);
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([8]);
        camera.position.x = 2;
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]);
        camera.position.x = -2;
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([8]);
        controller.setEnabled(false);
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]);
        controller.dispose();
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([2, 8]);
        expect(mesh.visible).toBe(true);
        expect(mesh.count).toBe(3);
    });

    test("releases only the owned instance wrapper during cleanup", async () => {
        const prototype = addInstanceFixtures();
        const sourceGeometry = prototype.children[0].geometry;
        const sourceGeometryDispose = jest.spyOn(sourceGeometry, "dispose");
        const sourceMaterialDispose = jest.spyOn(fixtures.material, "dispose");
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        const wrapper = mesh.geometry;
        const wrapperDispose = jest.spyOn(wrapper, "dispose");
        const matrixAttribute = mesh.instanceMatrix;
        expect(wrapper).not.toBe(sourceGeometry);
        expect(wrapper.attributes.position).toBe(sourceGeometry.attributes.position);
        expect(wrapper.attributes.uv).toBe(sourceGeometry.attributes.uv);
        expect(wrapper.index).toBe(sourceGeometry.index);
        expect(instanceDraw(mesh).count).toBe(2);
        await nativeFiber.act(async () => root.render(null));
        expect(mesh.geometry).toBe(sourceGeometry);
        expect(mesh.instanceMatrix).toBe(matrixAttribute);
        expect(mesh.count).toBe(3);
        expect(wrapperDispose).toHaveBeenCalledTimes(1);
        expect(sourceGeometryDispose).not.toHaveBeenCalled();
        expect(sourceMaterialDispose).not.toHaveBeenCalled();
    });

    test("instance callbacks survive rerenders and detach on unmount", async () => {
        addInstanceFixtures({ halfMesh: true, multipleParts: true });
        const sceneRoot = await mountLoader({}, true);
        const meshes = sceneRoot.children.filter((node) => node.isInstancedMesh);
        const callbacks = meshes.map((mesh) => mesh.onBeforeRender);
        for (const mesh of meshes) expect(instanceDraw(mesh).count).toBe(2);
        await mountLoader({}, true);
        expect(createPvsController).toHaveBeenCalledTimes(1);
        meshes.forEach((mesh, index) => expect(mesh.onBeforeRender).toBe(callbacks[index]));
        const attribute = meshes[0].instanceMatrix;
        renderer.info.render.frame += 1;
        meshes[0].onBeforeRender(renderer, store.getState().scene, camera, meshes[0].geometry, meshes[0].material, null);
        expect(meshes[0].count).toBe(2);
        await nativeFiber.act(async () => root.render(null));
        expect(meshes[0].instanceMatrix).toBe(attribute);
        for (const mesh of meshes) {
            expect(mesh.count).toBe(3);
            expect(mesh.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
            expect(mesh.onAfterRender).toBe(THREE.Object3D.prototype.onAfterRender);
        }
    });

    test("keeps instance visibility independent across loaders sharing prototypes", async () => {
        addInstanceFixtures();
        await nativeFiber.act(async () => {
            store = root.render(<>
                <HouseMakerLoader key="first" toursEnabled={false} />
                <HouseMakerLoader key="second" toursEnabled={false} position={[20, 0, 0]} />
            </>);
        });
        const [firstRoot, secondRoot] = store.getState().scene.children;
        const first = firstRoot.children.find((node) => node.isInstancedMesh);
        const second = secondRoot.children.find((node) => node.isInstancedMesh);
        expect(first.geometry.attributes.position).toBe(second.geometry.attributes.position);
        expect(first.geometry.index).toBe(second.geometry.index);
        expect(first.instanceMatrix).not.toBe(second.instanceMatrix);
        expect(instanceDraw(first).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
        expect(instanceDraw(second).count).toBe(3);
        camera.position.x = 18;
        expect(instanceDraw(first).count).toBe(3);
        expect(instanceDraw(second).matrices.map((matrix) => matrix[12])).toEqual([-2, 8]);
        await nativeFiber.act(async () => {
            root.render(<HouseMakerLoader key="second" toursEnabled={false} position={[20, 0, 0]} />);
        });
        expect(first.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
        expect(instanceDraw(second).count).toBe(2);
        expect(second.count).toBe(3);
    });

    test.each(["missing", "invalid", "mismatched"])("keeps instances visible with %s PVS", async (kind) => {
        addInstanceFixtures({ halfMesh: true });
        if (kind === "missing") delete fixtures.manifest.visibility;
        if (kind === "invalid") fixtures.manifest.visibility.clusters[1].instanceIds = ["chair-a"];
        if (kind === "mismatched") fixtures.manifest.visibility.glbSha256 = "0".repeat(64);
        const sceneRoot = await mountLoader();
        const mesh = sceneRoot.children.find((node) => node.isInstancedMesh);
        expect(instanceDraw(mesh).matrices.map((matrix) => matrix[12])).toEqual([-2, 2, 8]);
        expect(mesh.visible).toBe(true);
        expect(mesh.count).toBe(3);
        expect(mesh.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
    });

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

    test("tunes debug opacity without rebuilding geometry or culling", async () => {
        const sceneRoot = await mountLoader({ showBakedPvs: true });
        const lines = sceneRoot.getObjectByName("HouseMaker baked PVS");
        const geometry = lines.geometry;
        const material = lines.material;
        const disposeGeometry = jest.spyOn(geometry, "dispose");
        const controllerCount = createPvsController.mock.calls.length;
        expect(material.opacity).toBe(0.65);
        await mountLoader({ showBakedPvs: true, pvsDebugOpacity: 0.2 });
        expect(sceneRoot.getObjectByName("HouseMaker baked PVS")).toBe(lines);
        expect(lines.material).toBe(material);
        expect(lines.geometry).toBe(geometry);
        expect(material.opacity).toBe(0.2);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(createPvsController).toHaveBeenCalledTimes(controllerCount);
        expect(cameraDraw(sceneRoot.getObjectByName("cluster-b"))).toBe(0);
        await mountLoader({ showBakedPvs: true, pvsDebugOpacity: 3 });
        expect(material.opacity).toBe(1);
        await mountLoader({ showBakedPvs: true });
        expect(material.opacity).toBe(0.65);
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
