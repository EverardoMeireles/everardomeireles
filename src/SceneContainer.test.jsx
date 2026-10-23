/* eslint-disable testing-library/no-node-access, testing-library/render-result-naming-convention */

import React from "react";
import { render } from "@testing-library/react";
import * as THREE from "three";
import { EffectAttribute, ToneMappingMode } from "postprocessing";
import { SceneContainer } from "./SceneContainer";
import config from "./config.js";

let mockCamera;
let mockDpr;
let mockTree;
let mockLayoutKey;
let mockState;
let mockManifest;
const mockUseLoader = jest.fn();

// Inspect the real effect without mounting a WebGL canvas.
jest.mock("@react-three/fiber", () => ({
    useThree: (selector) => selector({ camera: mockCamera, viewport: { dpr: mockDpr } }),
    useLoader: (...args) => mockUseLoader(...args),
}));
jest.mock("@react-three/drei", () => ({ Environment: "environment" }));
jest.mock("@react-three-dom/core", () => ({ ThreeDom: "threeDom" }));
jest.mock("@react-three/postprocessing", () => ({
    EffectComposer: "effectComposer", SSAO: "ssao", ToneMapping: "toneMapping", FXAA: "fxaa",
}));
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
jest.mock("./Helper.js", () => ({ pollForFilesInTHREECache: () => false }));
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
    mockLayoutKey = "Widescreen";
    mockManifest = {};
    mockUseLoader.mockReset();
    mockUseLoader.mockImplementation(() => mockManifest);
    mockState = {
        currentLanguage: "Portuguese",
        currentGraphicalMode: "normal",
        currentObjectClicked: "",
        realTimeGiEnabled: true,
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
    const effects = React.Children.toArray(findElements("effectComposer")[0].props.children);
    expect(effects.map((element) => element.type)).toEqual(["ssao", "primitive", "toneMapping", "fxaa"]);
    expect(effects[2].props.mode).toBe(ToneMappingMode.AGX);
    expect(effects[1].props).not.toHaveProperty("dispose");
    expect(effects[1].props.object.getAttributes())
        .toBe(EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION);
    expect(findElements("firstPerson")[0].props.touchNavigationMode).toBe("gyroscope");
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
    const effect = findElements("primitive")[0].props.object;
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
    expect(findElements("primitive")[0].props.object).toBe(effect);
    expect(findElements("ssao")).toHaveLength(1);
});

test("PVS debug state reaches the loader independently of lighting", () => {
    const view = render(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.showBakedPvs).toBe(false);
    mockState.showBakedPvs = true;
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.showBakedPvs).toBe(true);
    expect(findElements("ssao")).toHaveLength(1);
    expect(findElements("primitive")).toHaveLength(1);
});

test("anisotropic filtering reaches the loader without recreating GI", () => {
    const view = render(<SceneHarness />);
    const effect = findElements("primitive")[0].props.object;
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(false);
    mockState.anisotropicFilteringEnabled = true;
    view.rerender(<SceneHarness />);
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(true);
    expect(findElements("primitive")[0].props.object).toBe(effect);
    expect(findElements("ssao")).toHaveLength(1);
});

test("DPR changes resize post-processing without rebuilding GI or loaders", () => {
    const view = render(<SceneHarness />);
    const composer = { setSize: jest.fn() };
    findElements("effectComposer")[0].ref.current = composer;
    const effect = findElements("primitive")[0].props.object;
    mockDpr = 1.5;
    view.rerender(<SceneHarness />);
    expect(composer.setSize).toHaveBeenCalledTimes(1);
    expect(composer.setSize).toHaveBeenCalledWith();
    expect(findElements("primitive")[0].props.object).toBe(effect);
    expect(findElements("houseMaker")[0].props.anisotropicFilteringEnabled).toBe(false);
    view.rerender(<SceneHarness />);
    expect(composer.setSize).toHaveBeenCalledTimes(1);
});

test("disabling GI preserves SSAO and releases owned resources only", () => {
    const view = render(<SceneHarness />);
    const effect = findElements("primitive")[0].props.object;
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
    expect(findElements("primitive")).toHaveLength(0);
    expect(findElements("ssao")).toHaveLength(1);
    expect(findElements("toneMapping")).toHaveLength(1);
    expect(targetDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(denoiseDispose).toHaveBeenCalledTimes(1);
    expect(denoiseMaterialDispose).toHaveBeenCalledTimes(1);
    expect(depthDispose).not.toHaveBeenCalled();
    expect(sourceDispose).not.toHaveBeenCalled();

    mockState.realTimeGiEnabled = true;
    view.rerender(<SceneHarness />);
    expect(findElements("primitive")[0].props.object).toBe(effect);
    effect.update(renderer, { width: 800, height: 600, texture: source });
    expect(renderer.setRenderTarget.mock.calls[4][0]).not.toBe(traceTarget);
    expect(renderer.setRenderTarget.mock.calls[5][0]).not.toBe(denoiseTarget);
});

test.each(["Mobile", "Tablet", "Widescreen"])("%s GI uses higher-resolution buffers and denser sampling", (layout) => {
    mockLayoutKey = layout;
    render(<SceneHarness />);
    const effect = findElements("primitive")[0].props.object;
    const renderer = makeRenderer();
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
    const effect = findElements("primitive")[0].props.object;
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
    const effect = findElements("primitive")[0].props.object;
    const renderer = makeRenderer();
    effect.setDepthTexture(new THREE.Texture());
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    const target = renderer.setRenderTarget.mock.calls[0][0];
    view.rerender(<React.StrictMode><SceneHarness /></React.StrictMode>);
    expect(findElements("primitive")[0].props.object).toBe(effect);
    effect.update(renderer, { width: 800, height: 600, texture: new THREE.Texture() });
    expect(renderer.setRenderTarget.mock.calls[4][0]).toBe(target);
    const dispose = jest.spyOn(target, "dispose");
    view.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("GI filters two scales without history or feedback textures", () => {
    render(<SceneHarness />);
    const effect = findElements("primitive")[0].props.object;
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

test("potato mode keeps mobile GI budgets on desktop", () => {
    mockState.currentGraphicalMode = "potato";
    render(<SceneHarness />);
    const effect = findElements("primitive")[0].props.object;
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
