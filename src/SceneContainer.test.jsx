/* eslint-disable testing-library/no-node-access, testing-library/render-result-naming-convention */

import React from "react";
import { act, render } from "@testing-library/react";
import * as THREE from "three";
import { BlendFunction, BloomEffect, DepthDownsamplingPass, EffectAttribute, EffectPass, FXAAEffect, NormalPass, RenderPass, SSAOEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { SceneContainer } from "./SceneContainer";
import config from "./config.js";

let mockCamera;
let mockDpr;
let mockRenderer;
let mockScene;
let mockSize;
let mockFrameCallback;
let mockFramePriority;
const mockComposers = [];
const mockInvalidate = jest.fn();
let mockTree;
let mockLayoutKey;
let mockState;
let mockManifest;
const mockUseLoader = jest.fn();
const mockPollForFiles = jest.fn();
const mockNightLoad = jest.fn();
const mockPmremGenerators = [];

jest.mock("three/examples/jsm/loaders/RGBELoader.js", () => ({
    RGBELoader: class {
        loadAsync(...args) { return mockNightLoad(...args); }
    },
}));
jest.mock("three", () => {
    const actual = jest.requireActual("three");
    return {
        ...actual,
        PMREMGenerator: class {
            constructor(renderer) {
                this.renderer = renderer;
                this.fromEquirectangular = jest.fn(() => {
                    const target = new actual.WebGLRenderTarget(768, 1024, { type: actual.HalfFloatType });
                    target.texture.mapping = actual.CubeUVReflectionMapping;
                    return target;
                });
                this.dispose = jest.fn();
                mockPmremGenerators.push(this);
            }
        },
    };
});

// Inspect the real effect without mounting a WebGL canvas.
jest.mock("@react-three/fiber", () => ({
    useThree: (selector) => selector({
        camera: mockCamera, viewport: { dpr: mockDpr },
        gl: mockRenderer, scene: mockScene, size: mockSize, invalidate: mockInvalidate,
    }),
    useLoader: (...args) => mockUseLoader(...args),
    useFrame: (callback, priority) => {
        mockFrameCallback = callback;
        mockFramePriority = priority;
    },
}));
jest.mock("@react-three/drei", () => ({ Environment: "environment" }));
jest.mock("@react-three-dom/core", () => ({ ThreeDom: "threeDom" }));
// Keep native passes real; replace only WebGL composer setup.
jest.mock("postprocessing", () => {
    const actual = jest.requireActual("postprocessing");
    const three = jest.requireActual("three");
    return {
        ...actual,
        EffectComposer: class {
            constructor(renderer, options) {
                this.renderer = renderer;
                this.options = options;
                this.passes = [];
                this.inputBuffer = new three.WebGLRenderTarget(1, 1);
                this.outputBuffer = this.inputBuffer.clone();
                this.depthTexture = new three.DepthTexture(1, 1);
                this.setSize = jest.fn(() => {
                    const size = renderer.getDrawingBufferSize(new three.Vector2());
                    this.inputBuffer.setSize(size.width, size.height);
                    this.outputBuffer.setSize(size.width, size.height);
                    this.passes.forEach((pass) => pass.setSize(size.width, size.height));
                });
                this.addPass = jest.fn((pass) => {
                    this.passes.forEach((entry) => { entry.renderToScreen = false; });
                    pass.renderToScreen = true;
                    this.passes.push(pass);
                    const size = renderer.getDrawingBufferSize(new three.Vector2());
                    pass.setSize(size.width, size.height);
                    pass.setDepthTexture(this.depthTexture);
                });
                this.render = jest.fn((delta) => {
                    this.passes.filter((pass) => pass.enabled).forEach((pass) => {
                        pass.render(renderer, this.inputBuffer, this.outputBuffer, delta, false);
                    });
                });
                this.dispose = jest.fn(() => {
                    this.passes.forEach((pass) => pass.dispose());
                    this.passes = [];
                    this.inputBuffer.dispose();
                    this.outputBuffer.dispose();
                    this.depthTexture.dispose();
                });
                mockComposers.push(this);
            }
        },
    };
});
jest.mock("./SystemStore.js", () => ({
    __esModule: true, default: (selector) => selector(mockState),
}));
jest.mock("./UserStore.js", () => ({
    __esModule: true,
    default: (selector) => selector({ siteMode: "resume", animationTriggerState: false }),
}));
jest.mock("./Styles.jsx", () => ({
    useResponsive: () => ({ key: mockLayoutKey, layout: {} }),
}));
jest.mock("./Helper.js", () => ({ pollForFilesInTHREECache: (...args) => mockPollForFiles(...args) }));
jest.mock("./system_components/OrbitingPointLights.jsx", () => ({ OrbitingPointLight: "orbitingLight" }));
jest.mock("./system_components/OrbitingMenu.jsx", () => ({ OrbitingMenu: "orbitingMenu" }));
jest.mock("./system_components/FadingText.jsx", () => ({ FadingText: "fadingText" }));
jest.mock("./system_components/FadingTitle.jsx", () => ({ FadingTitle: "fadingTitle" }));
jest.mock("./system_components/InstanceLoader.jsx", () => ({ InstanceLoader: "instanceLoader" }));
jest.mock("./system_components/PreloadAssets.jsx", () => ({ PreloadAssets: "preloadAssets" }));
jest.mock("./system_components/ExplodingModelLoader.jsx", () => ({ ExplodingModelLoader: "explodingModel" }));
jest.mock("./system_components/PointLightAnimation.jsx", () => ({ PointLightAnimation: "lightAnimation" }));
jest.mock("./system_components/ObjectLink.jsx", () => ({ ObjectLink: "objectLink" }));
jest.mock("./system_components/ParticleEmitter.jsx", () => ({ ParticleEmitter: "particles" }));
jest.mock("./system_components/DynamicMaterialLoader.jsx", () => ({ DynamicMaterialLoader: "dynamicMaterial" }));
jest.mock("./system_components/CurveScrollNavigationCamera.jsx", () => ({ CurveScrollNavigationCamera: "curveCamera" }));
jest.mock("./system_components/Camera.jsx", () => ({ Camera: "camera" }));
jest.mock("./system_components/Raycaster.jsx", () => ({ Raycaster: "raycaster" }));
jest.mock("./system_components/FirstPersonController.jsx", () => ({ FirstPersonController: "firstPerson" }));
jest.mock("./user_components/HouseMakerLoader.jsx", () => ({ HouseMakerLoader: "houseMaker" }));

// Keep component effects real while capturing declarative scene children.
function SceneHarness(props) {
    mockTree = SceneContainer.type(props);
    return null;
}

// Find scene elements without relying on DOM renderer extensions.
function findElements(type, element = mockTree) {
    if (!React.isValidElement(element)) return [];
    return [
        ...(element.type === type ? [element] : []),
        ...React.Children.toArray(element.props.children).flatMap((child) => findElements(type, child)),
    ];
}

// Inspect fixed native pass slots without synthetic scene elements.
function currentPipeline() {
    const composer = mockComposers[mockComposers.length - 1];
    const effectPasses = composer.passes.filter((pass) => pass instanceof EffectPass);
    return {
        composer,
        ssaoPass: effectPasses[0],
        giPass: effectPasses[1],
        bloomPass: effectPasses[2],
        tonePass: effectPasses[3],
        fxaaPass: effectPasses[4],
        ssao: effectPasses[0]?.effects[0],
        gi: effectPasses[1]?.effects[0],
        bloom: effectPasses[2]?.effects[0],
    };
}

// Record GPU operations using real Three resources and matrices.
function makeRenderer() {
    return {
        getRenderTarget: jest.fn(() => null),
        getActiveCubeFace: () => 0,
        getActiveMipmapLevel: () => 0,
        setRenderTarget: jest.fn(),
        render: jest.fn(),
    };
}

beforeEach(() => {
    mockCamera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 1000);
    mockDpr = 1;
    mockSize = { width: 800, height: 600 };
    mockFrameCallback = null;
    mockFramePriority = null;
    mockComposers.length = 0;
    mockRenderer = {
        shadowMap: { enabled: true, needsUpdate: false },
        autoClear: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        getDrawingBufferSize: (target) => target.set(mockSize.width * mockDpr, mockSize.height * mockDpr),
        getSize: (target) => target.set(mockSize.width, mockSize.height),
        getPixelRatio: () => mockDpr,
        setSize: jest.fn(),
        setRenderTarget: jest.fn(),
        render: jest.fn(),
        getRenderTarget: jest.fn(() => null),
        getActiveCubeFace: () => 0,
        getActiveMipmapLevel: () => 0,
        getViewport: (target) => target.set(0, 0, mockSize.width, mockSize.height),
        getScissor: (target) => target.set(0, 0, mockSize.width, mockSize.height),
        getScissorTest: () => false,
        setViewport: jest.fn(),
        setScissor: jest.fn(),
        setScissorTest: jest.fn(),
        xr: { enabled: false },
    };
    mockScene = new THREE.Scene();
    mockInvalidate.mockReset();
    mockLayoutKey = "Widescreen";
    mockManifest = {};
    mockUseLoader.mockReset();
    mockUseLoader.mockImplementation(() => mockManifest);
    mockPollForFiles.mockReset().mockReturnValue(false);
    mockNightLoad.mockReset();
    mockPmremGenerators.length = 0;
    mockState = {
        currentLanguage: "Portuguese",
        currentGraphicalMode: "normal",
        currentObjectClicked: "",
        realTimeGiEnabled: true,
        ssaoEnabled: true,
        bloomEnabled: false,
        shadowsEnabled: true,
        showBakedPvs: false,
        anisotropicFilteringEnabled: false,
        setForcedCameraTarget: jest.fn(),
        setForcedCameraMovePathCurve: jest.fn(),
    };
});

test("lighting enables sun shadows and applies GI before tone mapping and FXAA", () => {
    render(<SceneHarness />);
    const loader = findElements("houseMaker")[0].props;
    expect(loader.shadowsEnabled).toBe(true);
    expect(loader.fallbackSunEnabled).toBe(true);
    expect(loader.shadowMapSize).toBe(2048);
    expect(loader.environmentScene).toBe(mockScene);
    expect(findElements("environment")[0].props.background).toBe(true);
    expect(findElements("environment")[0].props.environmentIntensity).toBe(0.35);
    const { composer, ssaoPass, giPass, bloomPass, tonePass, fxaaPass, ssao, gi, bloom } = currentPipeline();
    expect(composer.passes.map((pass) => pass.constructor)).toEqual([
        RenderPass, NormalPass, DepthDownsamplingPass, EffectPass, EffectPass, EffectPass, EffectPass, EffectPass,
    ]);
    expect(ssao).toBeInstanceOf(SSAOEffect);
    expect(ssaoPass.effects).toEqual([ssao]);
    expect(giPass.effects).toEqual([gi]);
    expect(bloom).toBeInstanceOf(BloomEffect);
    expect(bloomPass.effects).toEqual([bloom]);
    expect(bloomPass.enabled).toBe(false);
    expect(tonePass.effects[0]).toBeInstanceOf(ToneMappingEffect);
    expect(tonePass.effects[0].mode).toBe(ToneMappingMode.AGX);
    expect(fxaaPass.effects[0]).toBeInstanceOf(FXAAEffect);
    expect(fxaaPass.renderToScreen).toBe(true);
    expect(composer.passes.slice(0, -1).every((pass) => !pass.renderToScreen)).toBe(true);
    expect(gi.getAttributes())
        .toBe(EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION);
    expect(findElements("firstPerson")[0].props.touchNavigationMode).toBe("gyroscope");
});

test("shadow toggles refresh shared mesh shaders without changing authored flags", () => {
    const material = new THREE.MeshStandardMaterial();
    const glass = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.5 });
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, [material, glass]);
    const instances = new THREE.InstancedMesh(geometry, material, 1);
    const light = new THREE.DirectionalLight();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    light.castShadow = true;
    mockScene.add(mesh, instances, light);
    const view = render(<SceneHarness />);
    const gi = currentPipeline().gi;
    const controller = findElements("firstPerson")[0].props;
    const initialVersion = material.version;
    const initialGlassVersion = glass.version;
    const initialInvalidations = mockInvalidate.mock.calls.length;

    for (const enabled of [false, true]) {
        mockRenderer.shadowMap.needsUpdate = false;
        mockState.shadowsEnabled = enabled;
        view.rerender(<SceneHarness />);
        expect(mockRenderer.shadowMap.enabled).toBe(enabled);
        expect(mockRenderer.shadowMap.needsUpdate).toBe(true);
        expect(material.version).toBe(initialVersion + (enabled ? 2 : 1));
        expect(glass.version).toBe(initialGlassVersion + (enabled ? 2 : 1));
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(instances.castShadow).toBe(false);
        expect(instances.receiveShadow).toBe(false);
        expect(light.castShadow).toBe(true);
        expect(currentPipeline().gi).toBe(gi);
        expect(currentPipeline().ssaoPass.enabled).toBe(true);
        expect(findElements("firstPerson")[0].props.navigationRef).toBe(controller.navigationRef);
        expect(findElements("houseMaker")[0].props.shadowsEnabled).toBe(true);
    }
    expect(mockInvalidate).toHaveBeenCalledTimes(initialInvalidations + 2);
    view.rerender(<SceneHarness />);
    expect(mockInvalidate).toHaveBeenCalledTimes(initialInvalidations + 2);
    geometry.dispose();
    material.dispose();
    glass.dispose();
});

test("GI strength changes its uniform without rebuilding buffers or navigation", () => {
    const view = render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    const controller = findElements("firstPerson")[0].props;
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    expect(effect.uniforms.get("giStrength").value).toBe(0.7);
    mockState.viewerDebugSettings = { giIntensity: 1.25 };
    view.rerender(<SceneHarness />);
    expect(currentPipeline().gi).toBe(effect);
    expect(effect.uniforms.get("giStrength").value).toBe(1.25);
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    expect(renderer.setRenderTarget.mock.calls[4][0]).toBe(target);
    expect(findElements("firstPerson")[0].props.navigationRef).toBe(controller.navigationRef);
});

test("GI resolution overrides automatic quality without reloading the house", () => {
    const view = render(<SceneHarness />);
    const originalEffect = currentPipeline().gi;
    const originalComposer = currentPipeline().composer;
    const dispose = jest.spyOn(originalEffect, "dispose");
    const loader = findElements("houseMaker")[0].props;
    mockState.viewerDebugSettings = { giResolutionScale: 0.5 };
    view.rerender(<SceneHarness />);
    const effect = currentPipeline().gi;
    expect(effect).not.toBe(originalEffect);
    expect(currentPipeline().composer).not.toBe(originalComposer);
    expect(originalComposer.dispose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    const renderer = makeRenderer();
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    expect([target.width, target.height]).toEqual([400, 300]);
    expect(findElements("houseMaker")[0].props.jsonFile).toBe(loader.jsonFile);
    mockState.viewerDebugSettings = { giResolutionScale: null };
    view.rerender(<SceneHarness />);
    const resetEffect = currentPipeline().gi;
    resetEffect.setDepthTexture(new THREE.Texture());
    resetEffect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const resetTarget = renderer.setRenderTarget.mock.calls[4][0];
    expect([resetTarget.width, resetTarget.height]).toEqual([800, 600]);
});

test("native SSAO defaults apply with GI disabled", () => {
    mockState.realTimeGiEnabled = false;
    render(<SceneHarness />);
    const { composer, ssaoPass, giPass, ssao } = currentPipeline();
    const downsampling = composer.passes.find((pass) => pass instanceof DepthDownsamplingPass);
    expect(ssaoPass.enabled).toBe(true);
    expect(giPass.enabled).toBe(false);
    expect(ssao.intensity).toBe(2);
    expect(ssao.ssaoMaterial.radius).toBeCloseTo(0.05);
    expect(ssao.ssaoMaterial.bias).toBe(0.014);
    expect(ssao.ssaoMaterial.samples).toBe(49);
    expect(ssao.resolution.scale).toBe(0.5);
    expect(downsampling.resolution.scale).toBe(0.5);
});

test("SSAO sliders update native effects without rebuilding pass slots", () => {
    const view = render(<SceneHarness />);
    const { composer, gi, ssao: effect } = currentPipeline();
    const downsampling = composer.passes.find((pass) => pass instanceof DepthDownsamplingPass);
    const passes = [...composer.passes];
    mockState.viewerDebugSettings = {
        ssaoIntensity: 1.2, ssaoRadius: 0.3, ssaoBias: 0.04,
        ssaoSamples: 33, ssaoResolutionScale: 1,
    };
    view.rerender(<SceneHarness />);
    expect(effect.intensity).toBe(1.2);
    expect(effect.ssaoMaterial.radius).toBeCloseTo(0.3);
    expect(effect.ssaoMaterial.bias).toBe(0.04);
    expect(effect.ssaoMaterial.samples).toBe(33);
    expect(effect.resolution.scale).toBe(1);
    expect(downsampling.resolution.scale).toBe(1);
    expect(currentPipeline().composer).toBe(composer);
    expect(composer.passes).toEqual(passes);
    expect(currentPipeline().gi).toBe(gi);
});

test("bloom defaults stay disabled with additive HDR mipmap blur", () => {
    render(<SceneHarness />);
    const { bloom, bloomPass } = currentPipeline();
    expect(bloomPass.enabled).toBe(false);
    expect(bloom.blendMode.blendFunction).toBe(BlendFunction.ADD);
    expect(bloom.intensity).toBe(0.5);
    expect(bloom.luminanceMaterial.threshold).toBe(2);
    expect(bloom.luminanceMaterial.smoothing).toBe(0.2);
    expect(bloom.mipmapBlurPass.enabled).toBe(true);
    expect(bloom.mipmapBlurPass.radius).toBe(0.5);
    expect(bloom.luminancePass.resolution.scale).toBe(0.5);
    expect(bloom.luminancePass.renderTarget.width).toBe(400);
    expect(bloom.luminancePass.renderTarget.height).toBe(300);
    expect(bloom.mipmapBlurPass.resolution.toArray()).toEqual([400, 300]);
});

test("bloom sliders and toggles retain the composer, materials and navigation", () => {
    const material = new THREE.MeshStandardMaterial({ emissive: "#ffaa66", emissiveIntensity: 8 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mockScene.add(mesh);
    const view = render(<SceneHarness />);
    const { composer, bloom, gi, ssao } = currentPipeline();
    const passes = [...composer.passes];
    const navigationRef = findElements("firstPerson")[0].props.navigationRef;
    const materialVersion = material.version;
    mockState.viewerDebugSettings = {
        bloomIntensity: 1.8, bloomThreshold: 0.6,
        bloomSmoothing: 0.35, bloomRadius: 0.85,
    };
    view.rerender(<SceneHarness />);
    expect(bloom.intensity).toBe(1.8);
    expect(bloom.luminanceMaterial.threshold).toBe(0.6);
    expect(bloom.luminanceMaterial.smoothing).toBe(0.35);
    expect(bloom.mipmapBlurPass.radius).toBe(0.85);
    for (const enabled of [true, false, true]) {
        mockState.bloomEnabled = enabled;
        view.rerender(<SceneHarness />);
        expect(currentPipeline()).toMatchObject({ composer, bloom, gi, ssao });
        expect(composer.passes).toEqual(passes);
        expect(currentPipeline().bloomPass.enabled).toBe(enabled);
        expect(findElements("firstPerson")[0].props.navigationRef).toBe(navigationRef);
    }
    expect(mesh.material).toBe(material);
    expect(material.version).toBe(materialVersion);
    expect(material.emissiveIntensity).toBe(8);
    expect(mockComposers).toHaveLength(1);
    view.unmount();
    mesh.geometry.dispose();
    material.dispose();
});

test("bloom resolution changes resize all work targets without rebuilding passes", () => {
    const view = render(<SceneHarness />);
    const { composer, bloom } = currentPipeline();
    const passes = [...composer.passes];
    for (const scale of [0.25, 1, 0.5]) {
        mockState.viewerDebugSettings = { bloomResolutionScale: scale };
        view.rerender(<SceneHarness />);
        expect(currentPipeline()).toMatchObject({ composer, bloom });
        expect(composer.passes).toEqual(passes);
        expect([bloom.luminancePass.renderTarget.width, bloom.luminancePass.renderTarget.height])
            .toEqual([800 * scale, 600 * scale]);
        expect(bloom.mipmapBlurPass.resolution.toArray()).toEqual([800 * scale, 600 * scale]);
        const firstMip = bloom.mipmapBlurPass.downsamplingMipmaps[0];
        expect([firstMip.width, firstMip.height]).toEqual([400 * scale, 300 * scale]);
    }
});

test("bloom resolution follows viewport and DPR changes", () => {
    mockState.viewerDebugSettings = { bloomResolutionScale: 0.5 };
    const view = render(<SceneHarness />);
    const { composer, bloom } = currentPipeline();
    mockSize = { width: 1000, height: 500 };
    view.rerender(<SceneHarness />);
    expect([bloom.luminancePass.renderTarget.width, bloom.luminancePass.renderTarget.height])
        .toEqual([500, 250]);
    expect(bloom.mipmapBlurPass.resolution.toArray()).toEqual([500, 250]);
    mockDpr = 2;
    view.rerender(<SceneHarness />);
    expect([bloom.luminancePass.renderTarget.width, bloom.luminancePass.renderTarget.height])
        .toEqual([1000, 500]);
    expect(bloom.mipmapBlurPass.resolution.toArray()).toEqual([1000, 500]);
    expect(currentPipeline()).toMatchObject({ composer, bloom });
});

test("bloom executes only when enabled and always before tone mapping", () => {
    const view = render(<SceneHarness />);
    const { composer, bloom, gi, ssao, tonePass, fxaaPass } = currentPipeline();
    const updates = [];
    composer.passes.slice(0, 3).forEach((pass, index) => {
        jest.spyOn(pass, "render").mockImplementation(() => updates.push(["scene", "normals", "depth"][index]));
    });
    jest.spyOn(ssao, "update").mockImplementation(() => updates.push("SSAO"));
    jest.spyOn(gi, "update").mockImplementation(() => updates.push("GI"));
    jest.spyOn(bloom, "update").mockImplementation(() => updates.push("bloom"));
    jest.spyOn(tonePass.effects[0], "update").mockImplementation(() => updates.push("tone"));
    jest.spyOn(fxaaPass.effects[0], "update").mockImplementation(() => updates.push("FXAA"));
    for (const [giEnabled, ssaoEnabled, bloomEnabled] of [
        [false, false, false], [true, false, true], [true, true, true],
        [false, true, false], [false, false, true], [true, true, false],
    ]) {
        Object.assign(mockState, { realTimeGiEnabled: giEnabled, ssaoEnabled, bloomEnabled });
        view.rerender(<SceneHarness />);
        updates.length = 0;
        mockFrameCallback({}, 1 / 60);
        expect(updates).toEqual([
            "scene", ...(ssaoEnabled ? ["normals", "depth", "SSAO"] : []),
            ...(giEnabled ? ["GI"] : []), ...(bloomEnabled ? ["bloom"] : []), "tone", "FXAA",
        ]);
        expect(currentPipeline()).toMatchObject({ composer, bloom, gi, ssao });
    }
    expect(mockComposers).toHaveLength(1);
});

test("bloom retains its targets while disabled and releases owned resources", () => {
    mockState.bloomEnabled = true;
    const view = render(<SceneHarness />);
    const { bloom } = currentPipeline();
    const bloomDispose = jest.spyOn(bloom, "dispose");
    const luminanceDispose = jest.spyOn(bloom.luminancePass.renderTarget, "dispose");
    const mipmapDispose = jest.spyOn(bloom.mipmapBlurPass, "dispose");
    const firstMipDispose = jest.spyOn(bloom.mipmapBlurPass.downsamplingMipmaps[0], "dispose");
    mockState.bloomEnabled = false;
    view.rerender(<SceneHarness />);
    expect(bloomDispose).not.toHaveBeenCalled();
    expect(luminanceDispose).not.toHaveBeenCalled();
    expect(mipmapDispose).not.toHaveBeenCalled();
    view.unmount();
    expect(bloomDispose).toHaveBeenCalledTimes(1);
    expect(luminanceDispose).toHaveBeenCalledTimes(1);
    expect(mipmapDispose).toHaveBeenCalledTimes(1);
    expect(firstMipDispose).toHaveBeenCalledTimes(1);
});

test("Strict Mode rebuilds only retired bloom effects", () => {
    mockState.bloomEnabled = true;
    const view = render(<React.StrictMode><SceneHarness /></React.StrictMode>);
    const { composer, bloom } = currentPipeline();
    const dispose = jest.spyOn(bloom, "dispose");
    expect(mockComposers).toHaveLength(2);
    expect(mockComposers[0].dispose).toHaveBeenCalledTimes(1);
    expect(mockComposers[0].passes).toEqual([]);
    mockState.viewerDebugSettings = { bloomRadius: 0.9 };
    view.rerender(<React.StrictMode><SceneHarness /></React.StrictMode>);
    expect(currentPipeline()).toMatchObject({ composer, bloom });
    expect(bloom.mipmapBlurPass.radius).toBe(0.9);
    expect(dispose).not.toHaveBeenCalled();
    view.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("slider rerenders retain native passes and release effects once on unmount", () => {
    const view = render(<SceneHarness />);
    const { composer, gi, ssao } = currentPipeline();
    const passes = [...composer.passes];
    const giDispose = jest.spyOn(gi, "dispose");
    const ssaoDispose = jest.spyOn(ssao, "dispose");
    const passDisposes = passes.map((pass) => jest.spyOn(pass, "dispose"));
    mockState.viewerDebugSettings = { giIntensity: 0.8 };
    view.rerender(<SceneHarness />);
    mockState.viewerDebugSettings = { giIntensity: 0.9 };
    view.rerender(<SceneHarness />);
    expect(currentPipeline().composer).toBe(composer);
    expect(composer.passes).toEqual(passes);
    passDisposes.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    expect(giDispose).not.toHaveBeenCalled();
    expect(ssaoDispose).not.toHaveBeenCalled();
    view.unmount();
    expect(composer.dispose).toHaveBeenCalledTimes(1);
    passDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    expect(giDispose).toHaveBeenCalledTimes(1);
    expect(ssaoDispose).toHaveBeenCalledTimes(1);
});

test("disabled SSAO retains its target and releases it with its composer", () => {
    const view = render(<SceneHarness />);
    const { composer, ssao: effect } = currentPipeline();
    const dispose = jest.spyOn(effect.renderTarget, "dispose");
    mockState.ssaoEnabled = false;
    view.rerender(<SceneHarness />);
    expect(currentPipeline().composer).toBe(composer);
    expect(currentPipeline().ssao).toBe(effect);
    expect(dispose).not.toHaveBeenCalled();
    view.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("camera changes replace native passes without wrapper dispose overrides", () => {
    const view = render(<SceneHarness />);
    const { composer, ssao: effect, gi } = currentPipeline();
    const dispose = jest.spyOn(effect.renderTarget, "dispose");
    const giDispose = jest.spyOn(gi, "dispose");
    expect(typeof effect.dispose).toBe("function");
    mockCamera = new THREE.PerspectiveCamera();
    expect(() => view.rerender(<SceneHarness />)).not.toThrow();
    expect(currentPipeline().composer).not.toBe(composer);
    expect(currentPipeline().ssao).not.toBe(effect);
    expect(typeof currentPipeline().ssao.dispose).toBe("function");
    expect(composer.dispose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(giDispose).toHaveBeenCalledTimes(1);
});

test.each(["renderer", "scene"])("%s changes replace the composer without retiring shared GI", (changed) => {
    const view = render(<SceneHarness />);
    const { composer, gi, ssao } = currentPipeline();
    const giDispose = jest.spyOn(gi, "dispose");
    const ssaoDispose = jest.spyOn(ssao, "dispose");
    if (changed === "renderer") {
        mockRenderer = { ...mockRenderer, shadowMap: { enabled: true, needsUpdate: false } };
    } else {
        mockScene = new THREE.Scene();
    }
    view.rerender(<SceneHarness />);
    expect(currentPipeline().composer).not.toBe(composer);
    expect(currentPipeline().composer.renderer).toBe(mockRenderer);
    expect(currentPipeline().composer.passes[0].scene).toBe(mockScene);
    expect(currentPipeline().gi).toBe(gi);
    expect(composer.dispose).toHaveBeenCalledTimes(1);
    expect(ssaoDispose).toHaveBeenCalledTimes(1);
    expect(giDispose).not.toHaveBeenCalled();
    view.unmount();
    expect(giDispose).toHaveBeenCalledTimes(1);
});

test("disabled native effects accept slider changes before being enabled", () => {
    mockState.ssaoEnabled = false;
    mockState.realTimeGiEnabled = false;
    const view = render(<SceneHarness />);
    const { composer, ssao, gi } = currentPipeline();
    mockState.viewerDebugSettings = { ssaoIntensity: 1.2, giIntensity: 0.9 };
    expect(() => view.rerender(<SceneHarness />)).not.toThrow();
    expect(ssao.intensity).toBe(1.2);
    expect(gi.uniforms.get("giStrength").value).toBe(0.9);
    mockState.ssaoEnabled = true;
    mockState.realTimeGiEnabled = true;
    expect(() => view.rerender(<SceneHarness />)).not.toThrow();
    expect(currentPipeline().composer).toBe(composer);
    expect(currentPipeline().ssaoPass.enabled).toBe(true);
    expect(currentPipeline().giPass.enabled).toBe(true);
    expect(() => view.unmount()).not.toThrow();
});

test("debug settings reach loader controls without changing authored defaults", () => {
    const view = render(<SceneHarness />);
    const original = findElements("houseMaker")[0].props;
    expect(original.shadowBias).toBeUndefined();
    expect(original.shadowNormalBias).toBeUndefined();
    expect(original.shadowMapSizeOverride).toBeUndefined();
    expect(original.shadowSoftness).toBe(2);
    expect(original.shadowCoverage).toBe(100);
    expect(original.sunLightColor).toBeUndefined();
    expect(original.sunOrbitPaused).toBe(true);
    expect(original.sunOrbitAngle).toBeUndefined();
    expect(original.sunOrbitAngleRevision).toBe(0);
    expect(original.showSunRays).toBe(false);
    expect(original.onSunOrbitAngleChange).toBeUndefined();
    expect(original.anisotropy).toBe(8);
    expect(original.pvsDebugOpacity).toBe(0.65);
    mockState.viewerDebugSettings = {
        shadowBias: -0.0002, shadowNormalBias: 0.02,
        shadowMapSize: 2048, shadowSoftness: 4.5, shadowCoverage: 60, anisotropy: 4, pvsOpacity: 0.4, sunLightColor: "#ffbb77",
        sunOrbitPaused: true, sunOrbitAngle: 73, sunOrbitAngleRevision: 4,
    };
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props).toMatchObject({
        shadowBias: -0.0002, shadowNormalBias: 0.02,
        shadowMapSizeOverride: 2048, shadowSoftness: 4.5, shadowCoverage: 60, anisotropy: 4, pvsDebugOpacity: 0.4, sunLightColor: "#ffbb77",
        jsonFile: original.jsonFile, navigationRef: original.navigationRef,
        sunOrbitPaused: true, sunOrbitAngle: 73, sunOrbitAngleRevision: 4,
    });
    expect(mockState.shadowsEnabled).toBe(true);
    expect(mockState.ssaoEnabled).toBe(true);
    expect(mockState.realTimeGiEnabled).toBe(true);
    expect(currentPipeline().composer).toBe(mockComposers[0]);
    mockState.viewerDebugSettings = { sunLightColor: null };
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.sunLightColor).toBeUndefined();
    expect(findElements("houseMaker")[0].props.shadowSoftness).toBe(2);
    expect(findElements("houseMaker")[0].props.shadowCoverage).toBe(100);
    expect(findElements("houseMaker")[0].props.sunOrbitPaused).toBe(true);
    expect(findElements("houseMaker")[0].props.sunOrbitAngle).toBeUndefined();
    expect(findElements("houseMaker")[0].props.sunOrbitAngleRevision).toBe(0);
    expect(currentPipeline().composer).toBe(mockComposers[0]);
});

test("sun ray panel and live angle callback reach the loader without rebuilding effects", () => {
    const onSunOrbitAngleChange = jest.fn();
    const view = render(<SceneHarness showSunRays onSunOrbitAngleChange={onSunOrbitAngleChange} />);
    const { composer, gi, ssao } = currentPipeline();
    const navigationRef = findElements("houseMaker")[0].props.navigationRef;
    expect(findElements("houseMaker")[0].props).toMatchObject({ showSunRays: true, onSunOrbitAngleChange });
    mockState.viewerDebugSettings = { sunOrbitPaused: true, sunOrbitAngle: 120 };
    view.rerender(<SceneHarness showSunRays={false} onSunOrbitAngleChange={onSunOrbitAngleChange} />);
    expect(findElements("houseMaker")[0].props).toMatchObject({
        showSunRays: false, onSunOrbitAngleChange, sunOrbitPaused: true, sunOrbitAngle: 120, navigationRef,
    });
    expect(currentPipeline()).toMatchObject({ composer, gi, ssao });
    expect(findElements("firstPerson")[0].props.navigationRef).toBe(navigationRef);
});

test("night environment loads lazily without blocking navigation or effects", async () => {
    const day = new THREE.Texture({ width: 1024, height: 512 });
    const night = new THREE.Texture({ width: 4096, height: 2048 });
    mockScene.environment = day;
    mockScene.background = day;
    let resolveNight;
    mockNightLoad.mockImplementation(() => new Promise((resolve) => { resolveNight = resolve; }));
    const onDayNightStatusChange = jest.fn();
    const view = render(<SceneHarness onDayNightStatusChange={onDayNightStatusChange} />);
    const loader = findElements("houseMaker")[0].props;
    const { composer, gi, ssao } = currentPipeline();
    expect(mockNightLoad).not.toHaveBeenCalled();
    expect(loader.dayNightPanelOpen).toBe(false);
    expect(loader.dayNightEnvironment.current.ready).toBe(false);
    expect(loader.onDayNightStatusChange).toBe(onDayNightStatusChange);
    view.rerender(<SceneHarness showDayNightSettings onDayNightStatusChange={onDayNightStatusChange} />);
    const runtime = loader.dayNightEnvironment.current;
    expect(runtime.loading).toBe(true);
    expect(mockNightLoad).toHaveBeenCalledWith(`${config.resource_path}/textures/rogland_clear_night_4k.hdr`);
    const pending = runtime.prepare();
    expect(mockNightLoad).toHaveBeenCalledTimes(1);
    expect(mockScene.environment).toBe(day);
    expect(mockScene.background).toBe(day);
    expect(findElements("firstPerson")[0].props.navigationRef).toBe(loader.navigationRef);
    await act(async () => { resolveNight(night); await pending; });
    expect(runtime.ready).toBe(true);
    expect(runtime.loading).toBe(false);
    expect(mockScene.environment).toBe(day);
    expect(currentPipeline()).toMatchObject({ composer, gi, ssao });
    expect(mockPmremGenerators).toHaveLength(1);
    const generator = mockPmremGenerators[0];
    expect(generator.fromEquirectangular).toHaveBeenCalledTimes(2);
    generator.fromEquirectangular.mock.calls.forEach(([texture]) => {
        expect(texture.image).toMatchObject({ width: 1024, height: 512 });
        expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
    });
    expect(generator.dispose).toHaveBeenCalledTimes(1);
    await runtime.prepare();
    view.rerender(<SceneHarness />);
    view.rerender(<SceneHarness showDayNightSettings />);
    expect(mockNightLoad).toHaveBeenCalledTimes(1);
});

test("day/night blends real radiance for reflections and background together", async () => {
    const day = new THREE.Texture({ width: 1024, height: 512 });
    const night = new THREE.Texture({ width: 4096, height: 2048 });
    mockScene.environment = day;
    mockScene.background = day;
    mockScene.environmentIntensity = 0.35;
    mockScene.backgroundIntensity = 1;
    mockScene.environmentRotation.set(0, 0.3, 0);
    mockScene.backgroundRotation.set(0, 0.3, 0);
    const dayDispose = jest.spyOn(day, "dispose");
    const nightDispose = jest.spyOn(night, "dispose");
    mockNightLoad.mockResolvedValue(night);
    const view = render(<SceneHarness showDayNightSettings />);
    const runtime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    await act(async () => { await runtime.prepare(); });
    const generator = mockPmremGenerators[0];
    const atlasDisposes = generator.fromEquirectangular.mock.results.map(({ value }) => jest.spyOn(value, "dispose"));
    const renderCount = mockRenderer.render.mock.calls.length;
    expect(runtime.update({ blend: 0.65, tint: "#ffccaa", environmentIntensity: 0.22, backgroundIntensity: 0.4 })).toBe(true);
    expect(mockRenderer.render).toHaveBeenCalledTimes(renderCount + 1);
    const blended = mockScene.environment;
    const blendTarget = mockRenderer.setRenderTarget.mock.calls.map(([target]) => target).find((target) => target?.texture === blended);
    const blendDispose = jest.spyOn(blendTarget, "dispose");
    expect(blended).toBe(mockScene.background);
    expect(blended).not.toBe(day);
    expect(blended.mapping).toBe(THREE.CubeUVReflectionMapping);
    expect(blended.image).toMatchObject({ width: 768, height: 1024 });
    expect(mockScene.environmentIntensity).toBe(0.22);
    expect(mockScene.backgroundIntensity).toBe(0.4);
    const quad = mockRenderer.render.mock.calls.at(-1)[0].children[0];
    const materialDispose = jest.spyOn(quad.material, "dispose");
    const geometryDispose = jest.spyOn(quad.geometry, "dispose");
    expect(quad.material.uniforms.blend.value).toBe(0.65);
    expect(quad.material.uniforms.tint.value).toEqual(new THREE.Color("#ffccaa"));
    expect(quad.material.uniforms.dayTexture.value).toBe(generator.fromEquirectangular.mock.results[0].value.texture);
    expect(quad.material.uniforms.nightTexture.value).toBe(generator.fromEquirectangular.mock.results[1].value.texture);
    runtime.update({ blend: 0.65, tint: "#ffccaa", environmentIntensity: 0.3, backgroundIntensity: 0.5 });
    expect(mockRenderer.render).toHaveBeenCalledTimes(renderCount + 1);
    expect(mockScene.environmentIntensity).toBe(0.3);
    expect(mockScene.backgroundIntensity).toBe(0.5);
    runtime.update({ blend: 1, tint: "#ffffff", environmentIntensity: 0.12, backgroundIntensity: 0.3 });
    expect(mockRenderer.render).toHaveBeenCalledTimes(renderCount + 2);
    expect(generator.fromEquirectangular).toHaveBeenCalledTimes(2);
    mockScene.environmentRotation.set(0, 1.2, 0);
    mockScene.backgroundRotation.set(0, 1.2, 0);
    runtime.reset();
    expect(mockScene.environment).toBe(day);
    expect(mockScene.background).toBe(day);
    expect(mockScene.environmentIntensity).toBe(0.35);
    expect(mockScene.backgroundIntensity).toBe(1);
    expect(mockScene.environmentRotation.y).toBe(0.3);
    expect(mockScene.backgroundRotation.y).toBe(0.3);
    expect(runtime.ready).toBe(true);
    runtime.update({ blend: 1 });
    view.unmount();
    expect(dayDispose).not.toHaveBeenCalled();
    expect(nightDispose).toHaveBeenCalledTimes(1);
    atlasDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    expect(blendDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(mockScene.environment).toBe(day);
    expect(runtime.ready).toBe(false);
});

test("environment preparation and blending preserve renderer state", async () => {
    const day = new THREE.Texture({ width: 1024, height: 512 });
    const night = new THREE.Texture({ width: 4096, height: 2048 });
    const existingTarget = new THREE.WebGLRenderTarget(12, 16);
    mockScene.environment = day;
    mockNightLoad.mockResolvedValue(night);
    mockRenderer.getRenderTarget.mockReturnValue(existingTarget);
    mockRenderer.getActiveCubeFace = () => 2;
    mockRenderer.getActiveMipmapLevel = () => 3;
    mockRenderer.getViewport = (target) => target.set(2, 3, 17, 19);
    mockRenderer.getScissor = (target) => target.set(5, 7, 11, 13);
    mockRenderer.getScissorTest = () => true;
    mockRenderer.xr.enabled = true;
    mockRenderer.autoClear = false;
    const view = render(<SceneHarness showDayNightSettings />);
    const runtime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    const toneMapping = mockRenderer.toneMapping;
    await act(async () => { await runtime.prepare(); });
    for (const value of [0, 0.5, 1]) {
        runtime.update({ blend: value });
        expect(mockRenderer.setRenderTarget).toHaveBeenLastCalledWith(existingTarget, 2, 3);
        expect(mockRenderer.setViewport).toHaveBeenLastCalledWith(new THREE.Vector4(2, 3, 17, 19));
        expect(mockRenderer.setScissor).toHaveBeenLastCalledWith(new THREE.Vector4(5, 7, 11, 13));
        expect(mockRenderer.setScissorTest).toHaveBeenLastCalledWith(true);
        expect(mockRenderer.xr.enabled).toBe(true);
        expect(mockRenderer.autoClear).toBe(false);
        expect(mockRenderer.toneMapping).toBe(toneMapping);
    }
    view.unmount();
    existingTarget.dispose();
});

test("failed night requests retain the daylight fallback and allow retry", async () => {
    const day = new THREE.Texture({ width: 1024, height: 512 });
    mockScene.environment = day;
    mockScene.background = day;
    mockNightLoad.mockRejectedValueOnce(new Error("HTTP 404"));
    const view = render(<SceneHarness showDayNightSettings />);
    const runtime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    await act(async () => { await runtime.prepare(); });
    expect(runtime.error).toContain("HTTP 404");
    expect(runtime.ready).toBe(false);
    expect(runtime.loading).toBe(false);
    expect(runtime.update({ blend: 1 })).toBe(false);
    expect(mockScene.environment).toBe(day);
    expect(mockScene.background).toBe(day);
    mockNightLoad.mockResolvedValue(new THREE.Texture({ width: 4096, height: 2048 }));
    await act(async () => { await runtime.prepare(); });
    expect(runtime.ready).toBe(true);
    expect(runtime.error).toBeNull();
    view.unmount();
});

test("GPU preparation failures restore state and release incomplete resources", async () => {
    const day = new THREE.Texture({ width: 1024, height: 512 });
    const night = new THREE.Texture({ width: 4096, height: 2048 });
    mockScene.environment = day;
    mockScene.background = day;
    const nightDispose = jest.spyOn(night, "dispose");
    const dayDispose = jest.spyOn(day, "dispose");
    mockNightLoad.mockResolvedValue(night);
    mockRenderer.render.mockImplementationOnce(() => { throw new Error("GPU preparation failed"); });
    const view = render(<SceneHarness showDayNightSettings />);
    const runtime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    const toneMapping = mockRenderer.toneMapping;
    await act(async () => { await runtime.prepare(); });
    expect(runtime.ready).toBe(false);
    expect(runtime.loading).toBe(false);
    expect(runtime.error).toContain("GPU preparation failed");
    expect(mockScene.environment).toBe(day);
    expect(mockScene.background).toBe(day);
    expect(mockRenderer.setRenderTarget).toHaveBeenLastCalledWith(null, 0, 0);
    expect(mockRenderer.toneMapping).toBe(toneMapping);
    expect(mockRenderer.autoClear).toBe(true);
    expect(mockRenderer.xr.enabled).toBe(false);
    expect(mockPmremGenerators[0].dispose).toHaveBeenCalledTimes(1);
    expect(nightDispose).toHaveBeenCalledTimes(1);
    expect(dayDispose).not.toHaveBeenCalled();
    view.unmount();
});

test("scene replacement prepares a fresh environment without stale targets", async () => {
    const oldDay = new THREE.Texture({ width: 1024, height: 512 });
    mockScene.environment = oldDay;
    mockScene.background = oldDay;
    mockNightLoad.mockImplementation(() => Promise.resolve(new THREE.Texture({ width: 4096, height: 2048 })));
    const view = render(<SceneHarness showDayNightSettings />);
    const oldScene = mockScene;
    const oldRuntime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    await act(async () => { await oldRuntime.prepare(); });
    oldRuntime.update({ blend: 1 });
    const day = new THREE.Texture({ width: 1024, height: 512 });
    mockScene = new THREE.Scene();
    mockScene.environment = day;
    mockScene.background = day;
    view.rerender(<SceneHarness showDayNightSettings />);
    const runtime = findElements("houseMaker")[0].props.dayNightEnvironment.current;
    expect(runtime).not.toBe(oldRuntime);
    expect(oldRuntime.ready).toBe(false);
    expect(oldScene.environment).toBe(oldDay);
    expect(oldScene.background).toBe(oldDay);
    expect(mockNightLoad).toHaveBeenCalledTimes(2);
    await act(async () => { await runtime.prepare(); });
    runtime.update({ blend: 0.5 });
    expect(mockScene.environment).not.toBe(day);
    expect(oldScene.environment).toBe(oldDay);
    view.unmount();
    expect(mockScene.environment).toBe(day);
});

test("late night downloads are disposed after unmount and Strict Mode replay", async () => {
    mockScene.environment = new THREE.Texture({ width: 1024, height: 512 });
    const resolutions = [];
    mockNightLoad.mockImplementation(() => new Promise((resolve) => resolutions.push(resolve)));
    const view = render(<React.StrictMode><SceneHarness showDayNightSettings /></React.StrictMode>);
    const runtimeRef = findElements("houseMaker")[0].props.dayNightEnvironment;
    expect(resolutions).toHaveLength(2);
    view.unmount();
    expect(runtimeRef.current).toBeNull();
    const textures = resolutions.map(() => new THREE.Texture({ width: 4096, height: 2048 }));
    const disposes = textures.map((texture) => jest.spyOn(texture, "dispose"));
    await act(async () => {
        resolutions.forEach((resolve, index) => resolve(textures[index]));
        await Promise.resolve();
    });
    disposes.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    expect(mockPmremGenerators).toHaveLength(0);
});

test("tutorial control defaults preserve independent loader behavior", () => {
    render(<SceneHarness />);
    const controller = findElements("firstPerson")[0].props;
    const loader = findElements("houseMaker")[0].props;
    expect(controller.azertyMode).toBe("auto");
    expect(controller.touchNavigationMode).toBe("gyroscope");
    expect(controller.inputBlocked).toBe(false);
    expect(loader.hideObjectsKey).toBe("a");
    expect(loader.objectControlsEnabled).toBe(true);
    expect(controller.navigationRef).toBe(loader.navigationRef);
});

test("tutorial selections reach controls and loaders without rebuilding scene features", () => {
    const onGyroscopeStatusChange = jest.fn();
    const view = render(<SceneHarness
        azertyMode={false} hideObjectsKey="q" inputBlocked
        onGyroscopeStatusChange={onGyroscopeStatusChange}
    />);
    const controller = findElements("firstPerson")[0].props;
    const loader = findElements("houseMaker")[0].props;
    const effect = currentPipeline().gi;
    expect(controller.azertyMode).toBe(false);
    expect(controller.touchNavigationMode).toBe("gyroscope");
    expect(controller.inputBlocked).toBe(true);
    expect(controller.onGyroscopeStatusChange).toBe(onGyroscopeStatusChange);
    expect(loader.hideObjectsKey).toBe("q");
    expect(loader.objectControlsEnabled).toBe(false);

    view.rerender(<SceneHarness
        azertyMode hideObjectsKey="a" touchNavigationMode="dual_joystick" inputBlocked
        onGyroscopeStatusChange={onGyroscopeStatusChange}
    />);
    expect(findElements("firstPerson")[0].props.azertyMode).toBe(true);
    expect(findElements("firstPerson")[0].props.touchNavigationMode).toBe("dual_joystick");
    expect(findElements("firstPerson")[0].props.inputBlocked).toBe(true);
    expect(findElements("houseMaker")[0].props.hideObjectsKey).toBe("a");
    expect(findElements("houseMaker")[0].props.objectControlsEnabled).toBe(false);

    view.rerender(<SceneHarness
        azertyMode hideObjectsKey="a" touchNavigationMode="dual_joystick"
        onGyroscopeStatusChange={onGyroscopeStatusChange}
    />);
    expect(findElements("firstPerson")[0].props.inputBlocked).toBe(false);
    expect(findElements("houseMaker")[0].props.objectControlsEnabled).toBe(true);
    expect(findElements("firstPerson")[0].props.position).toEqual(controller.position);
    expect(findElements("firstPerson")[0].props.navigationRef).toBe(controller.navigationRef);
    expect(findElements("houseMaker")[0].props.navigationRef).toBe(loader.navigationRef);
    expect(findElements("houseMaker")[0].props.jsonFile).toBe(loader.jsonFile);
    expect(currentPipeline().gi).toBe(effect);
    expect(currentPipeline().ssaoPass.enabled).toBe(true);
});

test("PVS debug state reaches the loader independently of lighting", () => {
    const view = render(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.showBakedPvs).toBe(false);
    mockState.showBakedPvs = true;
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.showBakedPvs).toBe(true);
    expect(currentPipeline().ssaoPass.enabled).toBe(true);
    expect(currentPipeline().giPass.enabled).toBe(true);
});

test("anisotropic filtering reaches the loader without recreating GI", () => {
    const view = render(<SceneHarness />);
    const effect = currentPipeline().gi;
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(false);
    mockState.anisotropicFilteringEnabled = true;
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(true);
    expect(currentPipeline().gi).toBe(effect);
    expect(currentPipeline().ssaoPass.enabled).toBe(true);
});

test("DPR changes resize post-processing without rebuilding GI or loaders", () => {
    const view = render(<SceneHarness />);
    const { composer, gi: effect } = currentPipeline();
    const previousCalls = composer.setSize.mock.calls.length;
    mockDpr = 1.5;
    view.rerender(<SceneHarness />);
    expect(composer.setSize).toHaveBeenCalledTimes(previousCalls + 1);
    expect(composer.inputBuffer.width).toBe(1200);
    expect(composer.inputBuffer.height).toBe(900);
    expect(currentPipeline().gi).toBe(effect);
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(false);
    view.rerender(<SceneHarness />);
    expect(composer.setSize).toHaveBeenCalledTimes(previousCalls + 1);
    mockSize = { width: 600, height: 800 };
    view.rerender(<SceneHarness />);
    expect(composer.setSize).toHaveBeenCalledTimes(previousCalls + 2);
    expect(composer.inputBuffer.width).toBe(900);
    expect(composer.inputBuffer.height).toBe(1200);
    expect(currentPipeline().composer).toBe(composer);
});

test.each([true, false])("SSAO toggles independently while GI is %s", (giEnabled) => {
    mockState.realTimeGiEnabled = giEnabled;
    const view = render(<SceneHarness />);
    const { gi: effect, ssao, ssaoPass, giPass, tonePass, fxaaPass } = currentPipeline();
    const controller = findElements("firstPerson")[0].props;
    const loader = findElements("houseMaker")[0].props;

    mockState.ssaoEnabled = false;
    view.rerender(<SceneHarness />);
    expect(ssaoPass.enabled).toBe(false);
    expect(giPass.enabled).toBe(giEnabled);
    expect(currentPipeline().gi).toBe(effect);
    expect(tonePass.enabled).toBe(true);
    expect(fxaaPass.enabled).toBe(true);
    expect(findElements("firstPerson")[0].props.navigationRef).toBe(controller.navigationRef);
    expect(findElements("houseMaker")[0].props.jsonFile).toBe(loader.jsonFile);
    expect(findElements("houseMaker")[0].props.shadowsEnabled).toBe(true);

    mockState.ssaoEnabled = true;
    view.rerender(<SceneHarness />);
    expect(currentPipeline().ssaoPass).toBe(ssaoPass);
    expect(currentPipeline().ssao).toBe(ssao);
    expect(ssaoPass.enabled).toBe(true);
    expect(currentPipeline().gi).toBe(effect);
});

test.each(["GI first", "SSAO first"])("%s toggles preserve actual pass order and skip disabled work", (order) => {
    mockState.realTimeGiEnabled = false;
    mockState.ssaoEnabled = false;
    mockRenderer.autoClear = false;
    const view = render(<SceneHarness />);
    const { composer, gi, ssao } = currentPipeline();
    const passes = [...composer.passes];
    const updates = [];
    const names = ["scene", "normals", "depth"];
    passes.slice(0, 3).forEach((pass, index) => {
        jest.spyOn(pass, "render").mockImplementation(() => updates.push(names[index]));
    });
    jest.spyOn(ssao, "update").mockImplementation(() => updates.push("SSAO"));
    jest.spyOn(gi, "update").mockImplementation(() => updates.push("GI"));
    jest.spyOn(currentPipeline().tonePass.effects[0], "update").mockImplementation(() => updates.push("tone"));
    jest.spyOn(currentPipeline().fxaaPass.effects[0], "update").mockImplementation(() => updates.push("FXAA"));
    mockRenderer.render.mockImplementation(() => expect(mockRenderer.autoClear).toBe(true));
    const first = order === "GI first" ? [true, false] : [false, true];
    const history = [[false, false], first, [true, true], [false, true], [true, true], [true, false], [true, true]];

    for (const [giEnabled, ssaoEnabled] of history) {
        mockState.realTimeGiEnabled = giEnabled;
        mockState.ssaoEnabled = ssaoEnabled;
        view.rerender(<SceneHarness />);
        expect(currentPipeline().composer).toBe(composer);
        expect(composer.passes).toEqual(passes);
        expect(currentPipeline().gi).toBe(gi);
        expect(currentPipeline().ssao).toBe(ssao);
        expect(passes.slice(1, 4).every((pass) => pass.enabled === ssaoEnabled)).toBe(true);
        expect(currentPipeline().giPass.enabled).toBe(giEnabled);
        updates.length = 0;
        mockFrameCallback({}, 1 / 60);
        expect(updates).toEqual([
            "scene", ...(ssaoEnabled ? ["normals", "depth", "SSAO"] : []),
            ...(giEnabled ? ["GI"] : []), "tone", "FXAA",
        ]);
        expect(mockRenderer.autoClear).toBe(false);
    }
    expect(mockFramePriority).toBe(1);
    expect(mockComposers).toHaveLength(1);
});

test("composer rendering restores renderer state even after a pass fails", () => {
    mockRenderer.autoClear = false;
    const previousToneMapping = mockRenderer.toneMapping;
    const view = render(<SceneHarness />);
    const { composer } = currentPipeline();
    expect(mockRenderer.toneMapping).toBe(THREE.NoToneMapping);
    composer.render.mockImplementationOnce(() => {
        expect(mockRenderer.autoClear).toBe(true);
        throw new Error("Pass interrupted");
    });
    expect(() => mockFrameCallback({}, 1 / 60)).toThrow("Pass interrupted");
    expect(mockRenderer.autoClear).toBe(false);
    view.unmount();
    expect(mockRenderer.autoClear).toBe(false);
    expect(mockRenderer.toneMapping).toBe(previousToneMapping);
});

test("Strict Mode retires the old native composer without duplicating active passes", () => {
    const view = render(<React.StrictMode><SceneHarness /></React.StrictMode>);
    const { composer, gi } = currentPipeline();
    const retired = mockComposers.slice(0, -1);
    expect(retired).toHaveLength(1);
    retired.forEach((entry) => {
        expect(entry.dispose).toHaveBeenCalledTimes(1);
        expect(entry.passes).toEqual([]);
    });
    expect(composer.passes).toHaveLength(8);
    const passes = [...composer.passes];
    view.rerender(<React.StrictMode><SceneHarness /></React.StrictMode>);
    expect(currentPipeline().composer).toBe(composer);
    expect(composer.passes).toEqual(passes);
    expect(currentPipeline().gi).toBe(gi);
    expect(composer.dispose).not.toHaveBeenCalled();
    view.unmount();
    expect(composer.dispose).toHaveBeenCalledTimes(1);
    expect(composer.passes).toEqual([]);
    expect(() => mockFrameCallback({}, 1 / 60)).not.toThrow();
    expect(composer.render).not.toHaveBeenCalled();
});

test("disabling GI preserves SSAO and releases owned resources only", () => {
    const view = render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const depth = new THREE.Texture();
    const source = new THREE.Texture();
    const depthDispose = jest.spyOn(depth, "dispose");
    const sourceDispose = jest.spyOn(source, "dispose");
    const renderer = makeRenderer();
    effect.setDepthTexture(depth);
    effect.update(renderer, { width: 800, height: 600, texture: source });
    const traceTarget = renderer.setRenderTarget.mock.calls[0][0];
    const traceScene = renderer.render.mock.calls[0][0];
    const targetDispose = jest.spyOn(traceTarget, "dispose");
    const materialDispose = jest.spyOn(traceScene.children[0].material, "dispose");
    const geometryDispose = jest.spyOn(traceScene.children[0].geometry, "dispose");
    const denoiseTarget = renderer.setRenderTarget.mock.calls[1][0];
    const denoiseDispose = jest.spyOn(denoiseTarget, "dispose");
    const denoiseMaterialDispose = jest.spyOn(renderer.render.mock.calls[1][0].children[0].material, "dispose");
    expect(effect.uniforms.get("giBuffer").value).toBe(traceTarget.texture);

    mockState.realTimeGiEnabled = false;
    view.rerender(<SceneHarness />);
    expect(currentPipeline().giPass.enabled).toBe(false);
    expect(currentPipeline().ssaoPass.enabled).toBe(true);
    expect(currentPipeline().tonePass.enabled).toBe(true);
    expect(targetDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(denoiseDispose).toHaveBeenCalledTimes(1);
    expect(denoiseMaterialDispose).toHaveBeenCalledTimes(1);
    expect(depthDispose).not.toHaveBeenCalled();
    expect(sourceDispose).not.toHaveBeenCalled();

    mockState.realTimeGiEnabled = true;
    view.rerender(<SceneHarness />);
    expect(currentPipeline().gi).toBe(effect);
    effect.update(renderer, { width: 800, height: 600, texture: source });
    expect(renderer.setRenderTarget.mock.calls[4][0]).not.toBe(traceTarget);
    expect(renderer.setRenderTarget.mock.calls[5][0]).not.toBe(denoiseTarget);
});

test.each(["Mobile", "Tablet", "Widescreen"])("%s GI uses higher-resolution buffers and denser sampling", (layout) => {
    mockLayoutKey = layout;
    render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    effect.setDepthTexture(null);
    effect.update(renderer, { width: 801, height: 601, texture: new THREE.Texture() });
    expect(renderer.render).not.toHaveBeenCalled();
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 801, height: 601, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    const denoiseTarget = renderer.setRenderTarget.mock.calls[1][0];
    const material = renderer.render.mock.calls[0][0].children[0].material;
    const expectedSize = layout === "Widescreen" ? [801, 601] : [601, 451];
    expect([target.width, target.height]).toEqual(expectedSize);
    expect([denoiseTarget.width, denoiseTarget.height]).toEqual(expectedSize);
    expect(target.texture.name).toBe("HouseMaker GI trace");
    expect(denoiseTarget.texture.name).toBe("HouseMaker GI denoised");
    expect(material.defines.GI_RAYS).toBe(layout === "Widescreen" ? 16 : 8);
    expect(material.defines.GI_STEPS).toBe(layout === "Widescreen" ? 12 : 8);
    expect(findElements("houseMaker")[0].props.shadowMapSize).toBe(layout === "Widescreen" ? 2048 : 1024);
    effect.setSize(1200, 600);
    const expectedResizedSize = layout === "Widescreen" ? [1200, 600] : [900, 450];
    expect([target.width, target.height]).toEqual(expectedResizedSize);
    expect([denoiseTarget.width, denoiseTarget.height]).toEqual(expectedResizedSize);
});

test.each(["trace", "denoise", "wider denoise"])("GI follows projection changes and restores targets after %s failures", (stage) => {
    render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    effect.setDepthTexture(new THREE.Texture(), THREE.RGBADepthPacking);
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const material = renderer.render.mock.calls[0][0].children[0].material;
    expect(material.defines.DEPTH_PACKING).toBe(THREE.RGBADepthPacking);
    expect(material.uniforms.projection.value.equals(mockCamera.projectionMatrix)).toBe(true);
    mockCamera.aspect = 0.5;
    mockCamera.updateProjectionMatrix();
    if (stage !== "trace") renderer.render.mockImplementationOnce(() => {});
    if (stage === "wider denoise") renderer.render.mockImplementationOnce(() => {});
    renderer.render.mockImplementationOnce(() => { throw new Error("Renderer interrupted"); });
    expect(() => effect.update(renderer, { width: 300, height: 600, texture: new THREE.Texture() }))
        .toThrow("Renderer interrupted");
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null, 0, 0);
    expect(material.uniforms.inverseProjection.value.equals(mockCamera.projectionMatrixInverse)).toBe(true);
});

test("Strict Mode and ordinary rerenders reuse a valid GI effect", () => {
    const view = render(<React.StrictMode><SceneHarness /></React.StrictMode>);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    view.rerender(<React.StrictMode><SceneHarness /></React.StrictMode>);
    expect(currentPipeline().gi).toBe(effect);
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    expect(renderer.setRenderTarget.mock.calls[4][0]).toBe(target);
    const dispose = jest.spyOn(target, "dispose");
    view.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("GI filters two scales without history or feedback textures", () => {
    render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    const denoiseSteps = [];
    renderer.render.mockImplementation((scene) => {
        const uniforms = scene.children[0].material.uniforms;
        if (!uniforms.sampleStep) return;
        denoiseSteps.push({ step: uniforms.sampleStep.value, source: uniforms.giTrace.value });
    });
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const traceTarget = renderer.setRenderTarget.mock.calls[0][0];
    const denoiseTarget = renderer.setRenderTarget.mock.calls[1][0];
    expect(denoiseSteps).toEqual([
        { step: 1, source: traceTarget.texture },
        { step: 2, source: denoiseTarget.texture },
    ]);
    expect(renderer.setRenderTarget.mock.calls[2][0]).toBe(traceTarget);
    expect(effect.uniforms.get("giBuffer").value).toBe(traceTarget.texture);
    expect(renderer.render).toHaveBeenCalledTimes(3);
});

test.each([
    ["Widescreen", "normal", THREE.BasicDepthPacking],
    ["Mobile", "normal", THREE.RGBADepthPacking],
    ["Widescreen", "potato", THREE.BasicDepthPacking],
])("GI samples mip-zero buffers without loop derivatives: %s/%s/%s", (layout, quality, packing) => {
    mockLayoutKey = layout;
    mockState.currentGraphicalMode = quality;
    render(<SceneHarness />);
    const { composer, gi } = currentPipeline();
    const renderer = makeRenderer();
    gi.setDepthTexture(new THREE.Texture(), packing);
    gi.update(renderer, { width: 800, height: 600, texture: composer.inputBuffer.texture });
    const trace = renderer.render.mock.calls[0][0].children[0].material;
    const denoise = renderer.render.mock.calls[1][0].children[0].material;
    expect(trace.defines.DEPTH_PACKING).toBe(packing);
    expect(trace.fragmentShader).toContain("unpackRGBAToDepth(textureLod(sceneDepth, uv, 0.0))");
    expect(trace.fragmentShader).toContain("textureLod(sceneDepth, uv, 0.0).r");
    expect(trace.fragmentShader).toContain("textureLod(sceneColor, sampleUv, 0.0).rgb");
    expect(denoise.fragmentShader).toContain("textureLod(giTrace, vUv, 0.0)");
    expect(denoise.fragmentShader).toContain("textureLod(giTrace, vUv + offset * sampleStep / giSize, 0.0)");
    expect(gi.getFragmentShader()).toContain("textureLod(giBuffer, sampleUv, 0.0)");
    [trace.fragmentShader, denoise.fragmentShader, gi.getFragmentShader()].forEach((shader) => {
        expect(shader).not.toMatch(/\btexture(?:2D)?\s*\(/);
    });
    expect(composer.inputBuffer.texture.generateMipmaps).toBe(false);
    renderer.setRenderTarget.mock.calls.slice(0, 3).forEach(([target]) => {
        expect(target.texture.generateMipmaps).toBe(false);
        expect(target.texture.minFilter).toBe(THREE.NearestFilter);
    });
    expect(renderer.render).toHaveBeenCalledTimes(3);
});

test("potato mode keeps mobile GI budgets on desktop", () => {
    mockState.currentGraphicalMode = "potato";
    render(<SceneHarness />);
    const effect = currentPipeline().gi;
    const renderer = makeRenderer();
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    const material = renderer.render.mock.calls[0][0].children[0].material;
    expect([target.width, target.height]).toEqual([600, 450]);
    expect(material.defines.GI_RAYS).toBe(8);
    expect(material.defines.GI_STEPS).toBe(8);
});

test("exported eye height is passed directly from the cached companion manifest", () => {
    mockManifest = { firstPersonCamera: { eyeHeightMeters: 1.7 } };
    const view = render(<SceneHarness />);
    expect(findElements("firstPerson")[0].props.eyeHeight).toBe(1.7);
    const [loaderType, manifestUrl, configureLoader] = mockUseLoader.mock.calls[0];
    expect(loaderType).toBe(THREE.FileLoader);
    expect(manifestUrl).toBe(config.models_path + "housemaker_export.json");
    const loader = { setResponseType: jest.fn() };
    configureLoader(loader);
    expect(loader.setResponseType).toHaveBeenCalledWith("json");
    mockManifest = { firstPersonCamera: { eyeHeightMeters: 1.92 }, globalScale: { scale: [2, 2, 2] } };
    view.rerender(<SceneHarness />);
    expect(findElements("firstPerson")[0].props.eyeHeight).toBe(1.92);
    expect(mockUseLoader.mock.calls[1][1]).toBe(manifestUrl);
});

test.each([undefined, null, {}, { eyeHeightMeters: 0 }, { eyeHeightMeters: -1 },
    { eyeHeightMeters: NaN }, { eyeHeightMeters: Infinity }, { eyeHeightMeters: "1.7" }])(
    "missing or malformed camera metadata retains the original height: %p",
    (firstPersonCamera) => {
        mockManifest = { firstPersonCamera };
        render(<SceneHarness />);
        expect(findElements("firstPerson")[0].props.eyeHeight).toBe(1.5);
    }
);

test("the streamed bootstrap camera uses exported floor coordinates and heading", () => {
    const floorPosition = [-1.4234626491289517, 0.6019445894142892, -4.331219684529118];
    mockManifest = {
        firstPersonCamera: { eyeHeightMeters: 1.7, floorPosition: [9, 8, 7], fovDegrees: 80 },
        globalScale: { scale: [2.3, 2.0064819647142973, 2.4], appliedToRuntimeData: true },
        materialStreaming: {
            enabled: true,
            initialCamera: { floorPosition, position: [floorPosition[0], floorPosition[1] + 1.7, floorPosition[2]], lookDirection: [1, 0, 0], fovDegrees: 70 }
        },
        roomAssets: { materials: [] }
    };
    const previousFov = mockCamera.fov;
    const view = render(<SceneHarness />);
    const controller = findElements("firstPerson")[0].props;
    expect(controller.position).toBe(floorPosition);
    expect(controller.eyeHeight).toBe(1.7);
    expect(controller.rotation[0]).toBeCloseTo(0);
    expect(controller.rotation[1]).toBeCloseTo(-Math.PI / 2);
    expect(controller.rotation[2]).toBe(0);
    expect(mockCamera.fov).toBe(70);
    expect(floorPosition).toEqual([-1.4234626491289517, 0.6019445894142892, -4.331219684529118]);
    view.unmount();
    expect(mockCamera.fov).toBe(previousFov);
});

test("firstPersonCamera supplies the pose when streaming metadata is absent", () => {
    mockManifest = { firstPersonCamera: { eyeHeightMeters: 1.9, floorPosition: [4, 2, -9], lookDirection: [0, 3, -3], fovDegrees: 65 } };
    render(<SceneHarness />);
    const controller = findElements("firstPerson")[0].props;
    expect(controller.position).toEqual([4, 2, -9]);
    expect(controller.eyeHeight).toBe(1.9);
    expect(controller.rotation[0]).toBeCloseTo(Math.PI / 4);
    expect(controller.rotation[1]).toBeCloseTo(0);
    expect(mockCamera.fov).toBe(65);
});

test("a streamed eye position takes precedence over the legacy floor position", () => {
    const position = [-7, 5.7, 9];
    mockManifest = {
        firstPersonCamera: { eyeHeightMeters: 1.7, floorPosition: [20, 10, 20] },
        materialStreaming: { enabled: true, initialCamera: { position } },
        globalScale: { scale: [2, 3, 4], appliedToRuntimeData: true }
    };
    render(<SceneHarness />);
    expect(findElements("firstPerson")[0].props.position).toEqual([-7, 4, 9]);
    expect(findElements("firstPerson")[0].props.eyeHeight).toBe(1.7);
    expect(position).toEqual([-7, 5.7, 9]);
});

test("firstPersonCamera eye positions are converted using the exported eye height", () => {
    mockManifest = { firstPersonCamera: { eyeHeightMeters: 1.75, position: [4, 5.75, -9] } };
    render(<SceneHarness />);
    expect(findElements("firstPerson")[0].props.position).toEqual([4, 4, -9]);
    expect(findElements("firstPerson")[0].props.eyeHeight).toBe(1.75);
});

test.each([[1, 2], [1, NaN, 3], [1, Infinity, 3], [1, "2", 3]])(
    "invalid exported eye positions preserve the original spawn: %p",
    (...position) => {
        mockManifest = { firstPersonCamera: { position } };
        render(<SceneHarness />);
        expect(findElements("firstPerson")[0].props.position).toEqual([2.83, 0.1, 3]);
    }
);

test("malformed bootstrap pose fields independently fall back to firstPersonCamera", () => {
    mockManifest = {
        firstPersonCamera: { floorPosition: [2, 4, 6], lookDirection: [-3, 0, 0], fovDegrees: 72 },
        materialStreaming: { enabled: true, initialCamera: { floorPosition: [1, NaN, 3], position: [1, Infinity, 3], lookDirection: [0, 0, 0], fovDegrees: 180 } }
    };
    render(<SceneHarness />);
    const controller = findElements("firstPerson")[0].props;
    expect(controller.position).toEqual([2, 4, 6]);
    expect(controller.rotation[0]).toBeCloseTo(0);
    expect(controller.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(mockCamera.fov).toBe(72);
});

test("disabled material streaming does not override the first-person pose", () => {
    mockManifest = {
        firstPersonCamera: { floorPosition: [1, 2, 3], lookDirection: [0, 0, -1], fovDegrees: 68 },
        materialStreaming: { enabled: false, initialCamera: { floorPosition: [7, 8, 9], lookDirection: [1, 0, 0], fovDegrees: 90 } }
    };
    render(<SceneHarness />);
    expect(findElements("firstPerson")[0].props.position).toEqual([1, 2, 3]);
    expect(findElements("firstPerson")[0].props.rotation[1]).toBeCloseTo(0);
    expect(mockCamera.fov).toBe(68);
});

test.each([undefined, null, {}, [1, 2], [1, 2, 3, 4], [1, NaN, 3], [1, Infinity, 3], [1, "2", 3]])(
    "invalid exported floor position preserves the original spawn: %p",
    (floorPosition) => {
        mockManifest = { firstPersonCamera: { floorPosition } };
        render(<SceneHarness />);
        expect(findElements("firstPerson")[0].props.position).toEqual([2.83, 0.1, 3]);
    }
);

test.each([undefined, null, {}, [1, 2], [1, 2, 3, 4], [0, 0, 0], [1, NaN, 3], [Infinity, 0, 0], [1, "2", 3]])(
    "invalid exported look direction preserves the original orientation: %p",
    (lookDirection) => {
        mockManifest = { firstPersonCamera: { lookDirection } };
        render(<SceneHarness />);
        expect(findElements("firstPerson")[0].props.rotation).toEqual([0, 0, 0]);
    }
);

test.each([[0, 0, -4], [4, 0, 0], [-4, 0, 0], [0, 0, 4], [3, 3, -3], [-2, -1, 5]])(
    "controller yaw and pitch reproduce exported look direction %p",
    (...lookDirection) => {
        mockManifest = { firstPersonCamera: { lookDirection } };
        render(<SceneHarness />);
        const rotation = findElements("firstPerson")[0].props.rotation;
        const actual = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(...rotation, "YXZ"));
        const expected = new THREE.Vector3(...lookDirection).normalize();
        expect(actual.distanceTo(expected)).toBeLessThan(0.00000001);
    }
);

test.each([undefined, null, 0, -10, 180, 200, NaN, Infinity, "70"])(
    "invalid exported FOV preserves the existing camera projection: %p",
    (fovDegrees) => {
        mockManifest = { firstPersonCamera: { fovDegrees } };
        const updateProjection = jest.spyOn(mockCamera, "updateProjectionMatrix");
        const previousFov = mockCamera.fov;
        render(<SceneHarness />);
        expect(mockCamera.fov).toBe(previousFov);
        expect(updateProjection).not.toHaveBeenCalled();
    }
);

test("exported FOV follows the active perspective camera and restores owned changes", () => {
    mockManifest = { firstPersonCamera: { fovDegrees: 70 } };
    const previousCamera = mockCamera;
    const originalFov = previousCamera.fov;
    const view = render(<SceneHarness />);
    expect(previousCamera.fov).toBe(70);
    mockCamera = new THREE.PerspectiveCamera(52, 1.5, 0.1, 1000);
    view.rerender(<SceneHarness />);
    expect(previousCamera.fov).toBe(originalFov);
    expect(mockCamera.fov).toBe(70);
    view.unmount();
    expect(mockCamera.fov).toBe(52);
});

test("exported FOV leaves orthographic cameras unchanged", () => {
    mockManifest = { firstPersonCamera: { fovDegrees: 70 } };
    mockCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    const updateProjection = jest.spyOn(mockCamera, "updateProjectionMatrix");
    render(<SceneHarness />);
    expect(updateProjection).not.toHaveBeenCalled();
    expect(mockCamera.fov).toBeUndefined();
});

test("room streaming disables legacy polling and keeps legacy preloaders unmounted", () => {
    jest.useFakeTimers();
    mockManifest = { materialStreaming: { enabled: true }, roomAssets: { materials: [] } };
    const view = render(<SceneHarness />);
    expect(findElements("preloadAssets")).toHaveLength(0);
    expect(findElements("dynamicMaterial")).toHaveLength(0);
    act(() => jest.advanceTimersByTime(3000));
    expect(mockPollForFiles).not.toHaveBeenCalled();
    mockManifest = {};
    view.rerender(<SceneHarness />);
    act(() => jest.advanceTimersByTime(1000));
    expect(mockPollForFiles).toHaveBeenCalledTimes(1);
    expect(mockPollForFiles).toHaveBeenCalledWith(["/materials/low_512.glb", "/materials/high_4096_NOPBR.glb", "/materials/high_4096_PBR.glb"]);
    mockManifest = { materialStreaming: { enabled: true }, roomAssets: { materials: [{ materialId: "room-material" }] } };
    view.rerender(<SceneHarness />);
    mockState.currentGraphicalMode = "high";
    view.rerender(<SceneHarness />);
    act(() => jest.advanceTimersByTime(3000));
    expect(mockPollForFiles).toHaveBeenCalledTimes(1);
    view.unmount();
    jest.useRealTimers();
});

test.each([
    {},
    { materialStreaming: { enabled: false }, roomAssets: { materials: [] } },
    { materialStreaming: { enabled: true } },
    { materialStreaming: { enabled: true }, roomAssets: { materials: {} } }
])("older or incomplete material metadata retains legacy polling: %p", (manifest) => {
    jest.useFakeTimers();
    mockManifest = manifest;
    const view = render(<SceneHarness />);
    act(() => jest.advanceTimersByTime(1000));
    expect(mockPollForFiles).toHaveBeenCalledTimes(1);
    view.unmount();
    jest.useRealTimers();
});

test("Basis transcoder URLs respect the deployed public path", () => {
    expect(config.basis_path).toBe(`${process.env.PUBLIC_URL}/basis/`);
});
