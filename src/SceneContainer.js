import React, { useState, useEffect, useLayoutEffect, useRef, useMemo  } from "react";
import { OrbitingPointLight } from './system_components/OrbitingPointLights.jsx';
import { OrbitingMenu } from "./system_components/OrbitingMenu.jsx";
import { FadingText } from "./system_components/FadingText.jsx";
import { FadingTitle } from "./system_components/FadingTitle.jsx";
import { InstanceLoader } from "./system_components/InstanceLoader.jsx";
import { PreloadAssets } from "./system_components/PreloadAssets.jsx";
import { ExplodingModelLoader } from "./system_components/ExplodingModelLoader.jsx";
import { PointLightAnimation } from "./system_components/PointLightAnimation.jsx";
import { ObjectLink } from "./system_components/ObjectLink.jsx";
import { ParticleEmitter } from "./system_components/ParticleEmitter.jsx";
import { DynamicMaterialLoader } from "./system_components/DynamicMaterialLoader.jsx";
import { CurveScrollNavigationCamera } from "./system_components/CurveScrollNavigationCamera.jsx";
import { customInstanceRotation, customInstanceColor } from "./PathPoints.jsx";
import { TranslationTable } from "./TranslationTable.jsx";
import { useResponsive } from "./Styles.jsx";
import { pollForFilesInTHREECache } from "./Helper.js";
import { Camera } from "./system_components/Camera.jsx";
import { Raycaster } from "./system_components/Raycaster.jsx";
import { FirstPersonController } from "./system_components/FirstPersonController.jsx";
import { Environment } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
    BlendFunction, BloomEffect, DepthDownsamplingPass, Effect, EffectAttribute, EffectComposer,
    EffectPass, FXAAEffect, NormalPass, RenderPass, SSAOEffect,
    ToneMappingEffect, ToneMappingMode
} from "postprocessing";
import { ThreeDom } from "@react-three-dom/core";
import { HouseMakerLoader } from "./user_components/HouseMakerLoader.jsx";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

import * as THREE from 'three';

import config from './config.js';
import SystemStore from "./SystemStore.js";
import UserStore from "./UserStore.js";

/**
 * Purpose: Builds the active React Three Fiber scene for resume and store modes.
 * Relationships: Mounted by SceneViewer; orchestrates CurveScrollNavigationCamera, loaders, lights, HUD-driven transitions, and SystemStore/UserStore state.
 * Example:
 * <SceneContainer />
 */
export const SceneContainer = React.memo((props) => {
    // ### Store state ###

    const transitionDestination = SystemStore((state) => state.transitionDestination);
    const isCameraMoving = SystemStore((state) => state.isCameraMoving);
    const currentLanguage = SystemStore((state) => state.currentLanguage);
    const currentGraphicalMode = SystemStore((state) => state.currentGraphicalMode);
    const currentObjectClicked = SystemStore((state) => state.currentObjectClicked);
    const mouseClicked = SystemStore((state) => state.mouseClicked);
    const setForcedCameraTarget = SystemStore((state) => state.setForcedCameraTarget);
    const setForcedCameraMovePathCurve = SystemStore((state) => state.setForcedCameraMovePathCurve);
    const viewerModelName = SystemStore((state) => state.viewerModelName);
    const viewerConfigFile = SystemStore((state) => state.viewerConfigFile);
    const viewerMaterialName = SystemStore((state) => state.viewerMaterialName);
    const realTimeGiEnabled = SystemStore((state) => state.realTimeGiEnabled);
    const ssaoEnabled = SystemStore((state) => state.ssaoEnabled);
    const bloomEnabled = SystemStore((state) => state.bloomEnabled) ?? false;
    const shadowsEnabled = SystemStore((state) => state.shadowsEnabled);
    const showBakedPvs = SystemStore((state) => state.showBakedPvs);
    const anisotropicFilteringEnabled = SystemStore((state) => state.anisotropicFilteringEnabled);
    const debugSettings = SystemStore((state) => state.viewerDebugSettings);
    const giResolutionScale = debugSettings?.giResolutionScale;
    const giIntensity = debugSettings?.giIntensity ?? 0.7;
    const ssaoIntensity = debugSettings?.ssaoIntensity ?? 2;
    const ssaoRadius = debugSettings?.ssaoRadius ?? 0.05;
    const ssaoBias = debugSettings?.ssaoBias ?? 0.014;
    const ssaoSamples = debugSettings?.ssaoSamples ?? 49;
    const ssaoResolutionScale = debugSettings?.ssaoResolutionScale ?? 0.5;
    const bloomIntensity = debugSettings?.bloomIntensity ?? 0.5;
    const bloomThreshold = debugSettings?.bloomThreshold ?? 2;
    const bloomSmoothing = debugSettings?.bloomSmoothing ?? 0.2;
    const bloomRadius = debugSettings?.bloomRadius ?? 0.5;
    const bloomResolutionScale = debugSettings?.bloomResolutionScale ?? 0.5;

    const animationTriggerState = UserStore((state) => state.animationTriggerState);
    const siteMode = UserStore((state) => state.siteMode);

    // ### Local state ###

    const [forceLowresMaterial, setForceLowresMaterial] = useState(false);
    const [forceMidresMaterial, setForceMidresMaterial] = useState(false);
    const [forceHighResMaterial, setForceHighResMaterial] = useState(false);

    const [enableMaterialSwap, setEnableMaterialSwap] = useState(false);

    // ### Tour navigation ###

    const localNavigationRef = useRef(null);
    const houseMakerNavigationRef = props.navigationRef || localNavigationRef;

    // Share the loader's cached manifest; heights already use meters.
    const houseMakerSceneData = useLoader(
        THREE.FileLoader,
        config.models_path + "housemaker_export.json",
        (loader) => loader.setResponseType("json")
    );
    const exportedEyeHeight = houseMakerSceneData.firstPersonCamera?.eyeHeightMeters;
    const eyeHeight = Number.isFinite(exportedEyeHeight) && exportedEyeHeight > 0
        ? exportedEyeHeight
        : 1.5;

    // Keep streamed materials independent of the legacy material swap.
    const materialStreamingEnabled = houseMakerSceneData.materialStreaming?.enabled === true
        && Array.isArray(houseMakerSceneData.roomAssets?.materials);

    // Prefer the streamed bootstrap pose without converting exported coordinates.
    const exportedCameras = [
        houseMakerSceneData.materialStreaming?.enabled === true
            ? houseMakerSceneData.materialStreaming.initialCamera
            : undefined,
        houseMakerSceneData.firstPersonCamera
    ];
    const isFiniteVector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
    // Convert exported eye positions into controller floor positions.
    let firstPersonPosition = [2.83, 0.1, 3];
    for (const entry of exportedCameras) {
        if (isFiniteVector(entry?.floorPosition)) {
            firstPersonPosition = entry.floorPosition;
            break;
        }
        if (isFiniteVector(entry?.position) && Number.isFinite(entry.position[1] - eyeHeight)) {
            firstPersonPosition = [entry.position[0], entry.position[1] - eyeHeight, entry.position[2]];
            break;
        }
    }
    const lookDirection = exportedCameras.find((entry) => isFiniteVector(entry?.lookDirection)
        && Math.hypot(...entry.lookDirection) > 0)?.lookDirection;
    const firstPersonRotation = lookDirection
        ? [Math.atan2(lookDirection[1], Math.hypot(lookDirection[0], lookDirection[2])), Math.atan2(-lookDirection[0], -lookDirection[2]), 0]
        : [0, 0, 0];
    const exportedFov = exportedCameras.map((entry) => entry?.fovDegrees)
        .find((value) => Number.isFinite(value) && value > 0 && value < 180);

    const { layout, key: sceneLayoutKey } = useResponsive("scene");
    const initialCameraPosition = {
        Mobile: [0, 10, 0],
        Tablet: [0, 100, 0],
        Widescreen: [0, 500, 0],
    }[sceneLayoutKey] ?? [0, 0, 0];

    // Share rendered depth, preserving instancing and object fades.
    const camera = useThree((state) => state.camera);
    const renderDpr = useThree((state) => state.viewport.dpr);
    const size = useThree((state) => state.size);
    const renderer = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const invalidate = useThree((state) => state.invalidate);
    const postProcessingRef = useRef(null);
    const postProcessingPassesRef = useRef(null);
    const dayNightEnvironmentRef = useRef(null);

    // Blend prefiltered radiance without reprocessing environments every frame.
    useEffect(() => {
        let disposed = false;
        let pending = null;
        let original = null;
        let nightTexture = null;
        let generator = null;
        let geometry = null;
        let material = null;
        let quadScene = null;
        let dayAtlas = null;
        let nightAtlas = null;
        let blendTarget = null;
        let lastBlend = -1;
        const targets = new Set();
        const tint = new THREE.Color();
        const previousTint = new THREE.Color(-1, -1, -1);
        const viewport = new THREE.Vector4();
        const scissor = new THREE.Vector4();
        const flatCamera = new THREE.Camera();

        // Restore renderer state after preparation and atlas updates.
        const renderOffscreen = (operation) => {
            const target = renderer.getRenderTarget();
            const cubeFace = renderer.getActiveCubeFace();
            const mipLevel = renderer.getActiveMipmapLevel();
            const xrEnabled = renderer.xr.enabled;
            const autoClear = renderer.autoClear;
            const toneMapping = renderer.toneMapping;
            const scissorTest = renderer.getScissorTest();
            renderer.getViewport(viewport);
            renderer.getScissor(scissor);
            renderer.xr.enabled = false;
            renderer.autoClear = true;
            renderer.toneMapping = THREE.NoToneMapping;
            renderer.setScissorTest(false);
            try {
                return operation();
            } finally {
                renderer.setRenderTarget(target, cubeFace, mipLevel);
                renderer.setViewport(viewport);
                renderer.setScissor(scissor);
                renderer.setScissorTest(scissorTest);
                renderer.xr.enabled = xrEnabled;
                renderer.autoClear = autoClear;
                renderer.toneMapping = toneMapping;
            }
        };

        // Release only this viewer's generated environment resources.
        const release = () => {
            targets.forEach((target) => target.dispose());
            targets.clear();
            generator?.dispose();
            generator = null;
            nightTexture?.dispose();
            nightTexture = null;
            geometry?.dispose();
            material?.dispose();
            geometry = null;
            material = null;
            quadScene = null;
            dayAtlas = null;
            nightAtlas = null;
            blendTarget = null;
        };

        const runtime = {
            ready: false,
            loading: false,
            error: null,
            prepare() {
                if (disposed) return Promise.resolve(false);
                if (runtime.ready) return Promise.resolve(true);
                if (pending) return pending;
                const dayTexture = scene.environment;
                if (!dayTexture?.isTexture || !dayTexture.image?.width) {
                    runtime.error = "Daytime environment is not ready yet.";
                    return Promise.resolve(false);
                }
                runtime.loading = true;
                runtime.error = null;
                pending = new RGBELoader().loadAsync(`${config.resource_path}/textures/rogland_clear_night_4k.hdr`)
                    .then((texture) => {
                        if (disposed) {
                            texture.dispose();
                            return false;
                        }
                        nightTexture = texture;
                        original = {
                            environment: scene.environment,
                            background: scene.background,
                            environmentIntensity: scene.environmentIntensity,
                            backgroundIntensity: scene.backgroundIntensity,
                            environmentRotation: scene.environmentRotation.clone(),
                            backgroundRotation: scene.backgroundRotation.clone(),
                        };
                        geometry = new THREE.BufferGeometry();
                        geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
                        material = new THREE.ShaderMaterial({
                            name: "HouseMaker day/night radiance blend",
                            depthTest: false,
                            depthWrite: false,
                            blending: THREE.NoBlending,
                            toneMapped: false,
                            uniforms: {
                                dayTexture: new THREE.Uniform(dayTexture),
                                nightTexture: new THREE.Uniform(dayTexture),
                                blend: new THREE.Uniform(0),
                                tint: new THREE.Uniform(new THREE.Color()),
                            },
                            vertexShader: `
                                varying vec2 vUv;
                                void main() {
                                    vUv = position.xy * 0.5 + 0.5;
                                    gl_Position = vec4(position.xy, 0.0, 1.0);
                                }
                            `,
                            fragmentShader: `
                                uniform sampler2D dayTexture;
                                uniform sampler2D nightTexture;
                                uniform float blend;
                                uniform vec3 tint;
                                varying vec2 vUv;
                                void main() {
                                    vec3 day = texture2D(dayTexture, vUv).rgb;
                                    vec3 night = texture2D(nightTexture, vUv).rgb;
                                    gl_FragColor = vec4(mix(day, night, blend) * tint, 1.0);
                                }
                            `,
                        });
                        quadScene = new THREE.Scene();
                        quadScene.add(new THREE.Mesh(geometry, material));
                        generator = new THREE.PMREMGenerator(renderer);
                        renderOffscreen(() => {
                            // Equal dimensions keep both prefiltered atlases compatible.
                            const resampled = new THREE.WebGLRenderTarget(1024, 512, {
                                type: THREE.HalfFloatType,
                                depthBuffer: false,
                                generateMipmaps: false,
                                colorSpace: THREE.LinearSRGBColorSpace,
                            });
                            resampled.texture.mapping = THREE.EquirectangularReflectionMapping;
                            targets.add(resampled);
                            for (const source of [dayTexture, nightTexture]) {
                                material.uniforms.dayTexture.value = source;
                                material.uniforms.nightTexture.value = source;
                                renderer.setRenderTarget(resampled);
                                renderer.render(quadScene, flatCamera);
                                const atlas = generator.fromEquirectangular(resampled.texture);
                                targets.add(atlas);
                                if (source === dayTexture) dayAtlas = atlas;
                                else nightAtlas = atlas;
                            }
                            resampled.dispose();
                            targets.delete(resampled);
                            blendTarget = dayAtlas.clone();
                            blendTarget.texture.name = "HouseMaker day/night environment";
                            blendTarget.texture.mapping = THREE.CubeUVReflectionMapping;
                            targets.add(blendTarget);
                        });
                        material.uniforms.dayTexture.value = dayAtlas.texture;
                        material.uniforms.nightTexture.value = nightAtlas.texture;
                        generator.dispose();
                        generator = null;
                        nightTexture.dispose();
                        nightTexture = null;
                        runtime.ready = true;
                        invalidate();
                        return true;
                    })
                    .catch((error) => {
                        release();
                        runtime.error = `Night environment could not load: ${error.message || error}`;
                        return false;
                    })
                    .finally(() => {
                        runtime.loading = false;
                        pending = null;
                    });
                return pending;
            },
            update({ blend = 0, tint: color = "#ffffff", environmentIntensity = 0.35, backgroundIntensity = 1 } = {}) {
                if (!runtime.ready || disposed) return false;
                const amount = THREE.MathUtils.clamp(Number.isFinite(blend) ? blend : 0, 0, 1);
                tint.set(color);
                if (amount !== lastBlend || !tint.equals(previousTint)) {
                    material.uniforms.blend.value = amount;
                    material.uniforms.tint.value.copy(tint);
                    renderOffscreen(() => {
                        renderer.setRenderTarget(blendTarget);
                        renderer.render(quadScene, flatCamera);
                    });
                    lastBlend = amount;
                    previousTint.copy(tint);
                }
                scene.environment = blendTarget.texture;
                scene.background = blendTarget.texture;
                scene.environmentIntensity = environmentIntensity;
                scene.backgroundIntensity = backgroundIntensity;
                return true;
            },
            reset() {
                if (!original) return;
                scene.environment = original.environment;
                scene.background = original.background;
                scene.environmentIntensity = original.environmentIntensity;
                scene.backgroundIntensity = original.backgroundIntensity;
                scene.environmentRotation.copy(original.environmentRotation);
                scene.backgroundRotation.copy(original.backgroundRotation);
                invalidate();
            },
        };
        dayNightEnvironmentRef.current = runtime;
        return () => {
            disposed = true;
            runtime.reset();
            runtime.ready = false;
            release();
            if (dayNightEnvironmentRef.current === runtime) dayNightEnvironmentRef.current = null;
        };
    }, [renderer, scene, invalidate]);

    // Prepare the optional night asset without blocking house startup.
    useEffect(() => {
        if (props.showDayNightSettings) dayNightEnvironmentRef.current?.prepare();
    }, [props.showDayNightSettings, renderer, scene, invalidate]);

    // Refresh cached shaders when renderer shadows change.
    useLayoutEffect(() => {
        renderer.shadowMap.enabled = shadowsEnabled;
        renderer.shadowMap.needsUpdate = true;
        const materials = new Set();
        scene.traverse((object) => {
            if (!object.isMesh) return;
            const entries = Array.isArray(object.material) ? object.material : [object.material];
            entries.forEach((material) => { if (material) materials.add(material); });
        });
        materials.forEach((material) => { material.needsUpdate = true; });
        invalidate();
    }, [renderer, scene, invalidate, shadowsEnabled]);

    // Apply exported FOV without changing the controller's camera implementation.
    useLayoutEffect(() => {
        if (!camera.isPerspectiveCamera || exportedFov === undefined) return undefined;
        const previousFov = camera.fov;
        camera.fov = exportedFov;
        camera.updateProjectionMatrix();
        return () => {
            camera.fov = previousFov;
            camera.updateProjectionMatrix();
        };
    }, [camera, exportedFov]);

    const realTimeGiEffect = useMemo(() => {
        const lowQuality = sceneLayoutKey === "Mobile" || sceneLayoutKey === "Tablet" || currentGraphicalMode === "potato";
        const resolutionScale = giResolutionScale ?? (lowQuality ? 0.75 : 1);
        const rayCount = lowQuality ? 8 : 16;
        const stepCount = lowQuality ? 8 : 12;
        const projection = new THREE.Uniform(new THREE.Matrix4());
        const inverseProjection = new THREE.Uniform(new THREE.Matrix4());
        const depthBuffer = new THREE.Uniform(null);
        const giSize = new THREE.Uniform(new THREE.Vector2(1, 1));
        let traceTarget = null;
        let traceMaterial = null;
        let fullscreenGeometry = null;
        let fullscreenScene = null;
        let denoiseTarget = null;
        let denoiseMaterial = null;
        let denoiseScene = null;
        let depthPacking = THREE.BasicDepthPacking;

        // Explicit level-zero sampling avoids derivatives inside divergent loops.
        const effect = new Effect("HouseMakerScreenSpaceGI", `
            uniform sampler2D giBuffer;
            uniform vec2 giSize;
            uniform mat4 giInverseProjection;
            uniform float giStrength;

            float giViewDepth(vec2 uv, float depth) {
                vec4 position = giInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
                return -position.z / position.w;
            }

            void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
                outputColor = inputColor;
                if (depth >= 0.999999 || depth <= 0.0) return;
                float viewDepth = giViewDepth(uv, depth);
                vec2 coordinate = uv * giSize - 0.5;
                vec2 fraction = fract(coordinate);
                vec2 base = floor(coordinate);
                vec3 indirect = vec3(0.0);
                float totalWeight = 0.0;
                for (int y = 0; y < 2; y++) {
                    for (int x = 0; x < 2; x++) {
                        vec2 offset = vec2(float(x), float(y));
                        vec2 sampleUv = (base + offset + 0.5) / giSize;
                        vec4 sampleLight = textureLod(giBuffer, sampleUv, 0.0);
                        vec2 interpolation = mix(vec2(1.0) - fraction, fraction, offset);
                        float weight = interpolation.x * interpolation.y;
                        weight *= exp(-abs(viewDepth - sampleLight.a) / max(0.035, viewDepth * 0.0075));
                        weight *= step(0.0001, sampleLight.a);
                        indirect += sampleLight.rgb * weight;
                        totalWeight += weight;
                    }
                }
                if (totalWeight > 0.0001) {
                    float brightest = max(max(inputColor.r, inputColor.g), inputColor.b);
                    vec3 receiverTint = clamp(inputColor.rgb / max(brightest, 0.02), vec3(0.06), vec3(0.9));
                    outputColor.rgb += (indirect / totalWeight) * receiverTint * giStrength;
                }
            }
        `, {
            attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map([
                ["giBuffer", new THREE.Uniform(null)],
                ["giSize", giSize],
                ["giInverseProjection", inverseProjection],
                ["giStrength", new THREE.Uniform(0.7)],
            ]),
        });

        // Trace one diffuse bounce from visible, lit surfaces.
        effect.update = (renderer, inputBuffer) => {
            if (!depthBuffer.value) return;
            if (!traceTarget) {
                traceTarget = new THREE.WebGLRenderTarget(1, 1, {
                    type: THREE.HalfFloatType,
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter,
                    depthBuffer: false,
                    stencilBuffer: false,
                });
                traceTarget.texture.name = "HouseMaker GI trace";
                denoiseTarget = traceTarget.clone();
                denoiseTarget.texture.name = "HouseMaker GI denoised";
                traceMaterial = new THREE.ShaderMaterial({
                    depthTest: false,
                    depthWrite: false,
                    blending: THREE.NoBlending,
                    toneMapped: false,
                    defines: { GI_RAYS: rayCount, GI_STEPS: stepCount, DEPTH_PACKING: depthPacking },
                    uniforms: {
                        sceneColor: new THREE.Uniform(null),
                        sceneDepth: depthBuffer,
                        projection,
                        inverseProjection,
                        sourceTexelSize: new THREE.Uniform(new THREE.Vector2()),
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        void main() {
                            vUv = position.xy * 0.5 + 0.5;
                            gl_Position = vec4(position.xy, 0.0, 1.0);
                        }
                    `,
                    fragmentShader: `
                        #include <packing>
                        uniform sampler2D sceneColor;
                        uniform sampler2D sceneDepth;
                        uniform mat4 projection;
                        uniform mat4 inverseProjection;
                        uniform vec2 sourceTexelSize;
                        varying vec2 vUv;

                        float readGiDepth(vec2 uv) {
                            #if DEPTH_PACKING == 3201
                                return unpackRGBAToDepth(textureLod(sceneDepth, uv, 0.0));
                            #else
                                return textureLod(sceneDepth, uv, 0.0).r;
                            #endif
                        }

                        vec3 viewPosition(vec2 uv, float depth) {
                            vec4 position = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
                            return position.xyz / position.w;
                        }

                        vec3 surfaceNormal(vec2 uv, vec3 center) {
                            vec2 dx = vec2(sourceTexelSize.x, 0.0);
                            vec2 dy = vec2(0.0, sourceTexelSize.y);
                            vec3 left = viewPosition(uv - dx, readGiDepth(uv - dx));
                            vec3 right = viewPosition(uv + dx, readGiDepth(uv + dx));
                            vec3 down = viewPosition(uv - dy, readGiDepth(uv - dy));
                            vec3 up = viewPosition(uv + dy, readGiDepth(uv + dy));
                            vec3 horizontal = abs(left.z - center.z) < abs(right.z - center.z) ? center - left : right - center;
                            vec3 vertical = abs(down.z - center.z) < abs(up.z - center.z) ? center - down : up - center;
                            vec3 normal = cross(horizontal, vertical);
                            float magnitude = dot(normal, normal);
                            return magnitude > 0.0000000001 ? normal * inversesqrt(magnitude) : vec3(0.0, 0.0, 1.0);
                        }

                        void main() {
                            float depth = readGiDepth(vUv);
                            if (depth >= 0.999999 || depth <= 0.0) {
                                gl_FragColor = vec4(0.0);
                                return;
                            }
                            vec3 origin = viewPosition(vUv, depth);
                            vec3 normal = surfaceNormal(vUv, origin);
                            vec3 helperAxis = abs(normal.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
                            vec3 tangent = normalize(cross(helperAxis, normal));
                            vec3 bitangent = cross(normal, tangent);
                            float rotation = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
                            vec3 indirect = vec3(0.0);
                            for (int ray = 0; ray < GI_RAYS; ray++) {
                                float distribution = (float(ray) + 0.5) / float(GI_RAYS);
                                float angle = rotation + float(ray) * 2.3999632;
                                vec3 direction = tangent * (cos(angle) * sqrt(distribution))
                                    + bitangent * (sin(angle) * sqrt(distribution))
                                    + normal * sqrt(1.0 - distribution);
                                float previousDistance = 0.0;
                                for (int stepIndex = 0; stepIndex < GI_STEPS; stepIndex++) {
                                    float progress = (float(stepIndex) + 1.0) / float(GI_STEPS);
                                    float distance = 2.5 * progress * progress;
                                    vec3 rayPosition = origin + normal * 0.035 + direction * distance;
                                    vec4 projected = projection * vec4(rayPosition, 1.0);
                                    if (projected.w <= 0.0) break;
                                    float projectedDepth = projected.z / projected.w;
                                    if (projectedDepth <= -1.0 || projectedDepth >= 1.0) break;
                                    vec2 sampleUv = projected.xy / projected.w * 0.5 + 0.5;
                                    if (any(lessThan(sampleUv, sourceTexelSize)) || any(greaterThan(sampleUv, vec2(1.0) - sourceTexelSize))) break;
                                    float sampleDepth = readGiDepth(sampleUv);
                                    if (sampleDepth >= 0.999999 || sampleDepth <= 0.0) {
                                        previousDistance = distance;
                                        continue;
                                    }
                                    vec3 hitPosition = viewPosition(sampleUv, sampleDepth);
                                    float depthDifference = hitPosition.z - rayPosition.z;
                                    if (depthDifference <= 0.0) {
                                        previousDistance = distance;
                                        continue;
                                    }
                                    float lowerDistance = previousDistance;
                                    float upperDistance = distance;
                                    for (int refinement = 0; refinement < 4; refinement++) {
                                        float middleDistance = (lowerDistance + upperDistance) * 0.5;
                                        vec3 middlePosition = origin + normal * 0.035 + direction * middleDistance;
                                        vec4 middleProjected = projection * vec4(middlePosition, 1.0);
                                        if (middleProjected.w <= 0.0) break;
                                        vec2 middleUv = middleProjected.xy / middleProjected.w * 0.5 + 0.5;
                                        if (any(lessThan(middleUv, sourceTexelSize)) || any(greaterThan(middleUv, vec2(1.0) - sourceTexelSize))) break;
                                        float middleDepth = readGiDepth(middleUv);
                                        vec3 middleHit = viewPosition(middleUv, middleDepth);
                                        float middleDifference = middleHit.z - middlePosition.z;
                                        if (middleDepth < 0.999999 && middleDepth > 0.0 && middleDifference > 0.0) {
                                            upperDistance = middleDistance;
                                            sampleUv = middleUv;
                                            hitPosition = middleHit;
                                            depthDifference = middleDifference;
                                        } else {
                                            lowerDistance = middleDistance;
                                        }
                                    }
                                    if (depthDifference < 0.18 && length(hitPosition - origin) > 0.07) {
                                        vec3 hitNormal = surfaceNormal(sampleUv, hitPosition);
                                        float emitterFacing = max(dot(hitNormal, -direction), 0.0);
                                        float edgeDistance = min(min(sampleUv.x, sampleUv.y), min(1.0 - sampleUv.x, 1.0 - sampleUv.y));
                                        float edgeFade = smoothstep(0.0, 0.08, edgeDistance);
                                        vec3 radiance = clamp(textureLod(sceneColor, sampleUv, 0.0).rgb, vec3(0.0), vec3(4.0));
                                        indirect += radiance * emitterFacing * edgeFade * (1.0 - upperDistance / 2.5);
                                    }
                                    break;
                                }
                            }
                            gl_FragColor = vec4(indirect / float(GI_RAYS), -origin.z);
                        }
                    `,
                });
                fullscreenGeometry = new THREE.BufferGeometry();
                fullscreenGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
                fullscreenScene = new THREE.Scene();
                const fullscreenMesh = new THREE.Mesh(fullscreenGeometry, traceMaterial);
                fullscreenMesh.frustumCulled = false;
                fullscreenScene.add(fullscreenMesh);

                // Smooth sparse ray samples without accumulating stale frames.
                denoiseMaterial = new THREE.ShaderMaterial({
                    depthTest: false,
                    depthWrite: false,
                    blending: THREE.NoBlending,
                    toneMapped: false,
                    uniforms: {
                        giTrace: new THREE.Uniform(traceTarget.texture),
                        giSize,
                        sampleStep: new THREE.Uniform(1),
                    },
                    vertexShader: traceMaterial.vertexShader,
                    fragmentShader: `
                        uniform sampler2D giTrace;
                        uniform vec2 giSize;
                        uniform float sampleStep;
                        varying vec2 vUv;

                        void main() {
                            vec4 center = textureLod(giTrace, vUv, 0.0);
                            if (center.a <= 0.0) {
                                gl_FragColor = vec4(0.0);
                                return;
                            }
                            vec3 indirect = vec3(0.0);
                            float totalWeight = 0.0;
                            for (int y = -1; y <= 1; y++) {
                                for (int x = -1; x <= 1; x++) {
                                    vec2 offset = vec2(float(x), float(y));
                                    vec4 neighbor = textureLod(giTrace, vUv + offset * sampleStep / giSize, 0.0);
                                    float spatialWeight = exp(-dot(offset, offset) * 0.5);
                                    float depthWeight = exp(-abs(center.a - neighbor.a) / max(0.045, center.a * 0.0075));
                                    float weight = spatialWeight * depthWeight * step(0.0001, neighbor.a);
                                    indirect += neighbor.rgb * weight;
                                    totalWeight += weight;
                                }
                            }
                            gl_FragColor = vec4(indirect / max(totalWeight, 0.0001), center.a);
                        }
                    `,
                });
                denoiseScene = new THREE.Scene();
                const denoiseMesh = new THREE.Mesh(fullscreenGeometry, denoiseMaterial);
                denoiseMesh.frustumCulled = false;
                denoiseScene.add(denoiseMesh);
                effect.uniforms.get("giBuffer").value = traceTarget.texture;
            }

            const width = Math.max(1, Math.ceil(inputBuffer.width * resolutionScale));
            const height = Math.max(1, Math.ceil(inputBuffer.height * resolutionScale));
            if (traceTarget.width !== width || traceTarget.height !== height) traceTarget.setSize(width, height);
            if (denoiseTarget.width !== width || denoiseTarget.height !== height) denoiseTarget.setSize(width, height);
            giSize.value.set(width, height);
            projection.value.copy(camera.projectionMatrix);
            inverseProjection.value.copy(camera.projectionMatrixInverse);
            traceMaterial.uniforms.sourceTexelSize.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
            traceMaterial.uniforms.sceneColor.value = inputBuffer.texture;

            // Restore composer targets even when the trace fails.
            const previousTarget = renderer.getRenderTarget();
            const previousCubeFace = renderer.getActiveCubeFace();
            const previousMipmapLevel = renderer.getActiveMipmapLevel();
            try {
                renderer.setRenderTarget(traceTarget);
                renderer.render(fullscreenScene, camera);
                denoiseMaterial.uniforms.giTrace.value = traceTarget.texture;
                denoiseMaterial.uniforms.sampleStep.value = 1;
                renderer.setRenderTarget(denoiseTarget);
                renderer.render(denoiseScene, camera);
                // Filter wider neighborhoods without accumulating stale frames.
                denoiseMaterial.uniforms.giTrace.value = denoiseTarget.texture;
                denoiseMaterial.uniforms.sampleStep.value = 2;
                renderer.setRenderTarget(traceTarget);
                renderer.render(denoiseScene, camera);
            } finally {
                renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
            }
        };

        // Composer supplies its existing depth texture; never fetch geometry.
        effect.setDepthTexture = (texture, packing = THREE.BasicDepthPacking) => {
            depthBuffer.value = texture;
            if (depthPacking !== packing && traceMaterial) {
                traceMaterial.defines.DEPTH_PACKING = packing;
                traceMaterial.needsUpdate = true;
            }
            depthPacking = packing;
        };

        // Resize existing buffers without reallocating on ordinary rerenders.
        effect.setSize = (width, height) => {
            const traceWidth = Math.max(1, Math.ceil(width * resolutionScale));
            const traceHeight = Math.max(1, Math.ceil(height * resolutionScale));
            traceTarget?.setSize(traceWidth, traceHeight);
            denoiseTarget?.setSize(traceWidth, traceHeight);
            giSize.value.set(traceWidth, traceHeight);
        };

        // Release owned resources; lazy creation supports Strict Mode replays.
        effect.dispose = () => {
            traceTarget?.dispose();
            traceMaterial?.dispose();
            denoiseTarget?.dispose();
            denoiseMaterial?.dispose();
            fullscreenGeometry?.dispose();
            traceTarget = null;
            traceMaterial = null;
            fullscreenGeometry = null;
            fullscreenScene = null;
            denoiseTarget = null;
            denoiseMaterial = null;
            denoiseScene = null;
            effect.uniforms.get("giBuffer").value = null;
        };
        return effect;
    }, [camera, sceneLayoutKey, currentGraphicalMode, giResolutionScale]);

    // Build explicit passes; toggle history cannot reorder them.
    useLayoutEffect(() => {
        const previousToneMapping = renderer.toneMapping;
        const previousAutoClear = renderer.autoClear;
        renderer.toneMapping = THREE.NoToneMapping;
        const composer = new EffectComposer(renderer, {
            multisampling: 0,
            frameBufferType: THREE.HalfFloatType,
        });
        const normal = new NormalPass(scene, camera);
        const downsampling = new DepthDownsamplingPass({ normalBuffer: normal.texture, resolutionScale: 0.5 });
        const ssao = new SSAOEffect(camera, null, {
            normalDepthBuffer: downsampling.texture,
            blendFunction: BlendFunction.MULTIPLY,
            distanceThreshold: 1,
            distanceFalloff: 0,
            rangeThreshold: 0.5,
            rangeFalloff: 0.1,
            luminanceInfluence: 0.7,
            rings: 7,
            samples: 49,
            radius: 0.05,
            intensity: 2,
            bias: 0.014,
            resolutionScale: 0.5,
        });
        const ssaoPass = new EffectPass(camera, ssao);
        const giPass = new EffectPass(camera, realTimeGiEffect);
        const bloom = new BloomEffect({
            blendFunction: BlendFunction.ADD,
            intensity: 0.5,
            luminanceThreshold: 2,
            luminanceSmoothing: 0.2,
            mipmapBlur: true,
            radius: 0.5,
        });
        const bloomPass = new EffectPass(camera, bloom);
        const toneMappingPass = new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
        const fxaaPass = new EffectPass(camera, new FXAAEffect());
        [new RenderPass(scene, camera), normal, downsampling, ssaoPass, giPass, bloomPass, toneMappingPass, fxaaPass]
            .forEach((pass) => composer.addPass(pass));
        renderer.autoClear = previousAutoClear;
        postProcessingRef.current = composer;
        postProcessingPassesRef.current = { normal, downsampling, ssao, ssaoPass, giPass, bloom, bloomPass };

        return () => {
            giPass.setEffects([]);
            composer.dispose();
            renderer.toneMapping = previousToneMapping;
            renderer.autoClear = previousAutoClear;
            if (postProcessingRef.current === composer) {
                postProcessingRef.current = null;
                postProcessingPassesRef.current = null;
            }
        };
    }, [renderer, scene, camera, realTimeGiEffect]);

    // Resize existing targets for viewport and pixel-density changes.
    useLayoutEffect(() => {
        postProcessingRef.current?.setSize(size.width, size.height);
    }, [size.width, size.height, renderDpr, renderer, scene, camera, realTimeGiEffect]);

    // Update fixed passes without recreating effects or changing order.
    useLayoutEffect(() => {
        const passes = postProcessingPassesRef.current;
        if (!passes) return;
        passes.normal.enabled = ssaoEnabled;
        passes.downsampling.enabled = ssaoEnabled;
        passes.ssaoPass.enabled = ssaoEnabled;
        passes.giPass.enabled = realTimeGiEnabled;
        passes.bloomPass.enabled = bloomEnabled;
        passes.ssao.intensity = ssaoIntensity;
        passes.ssao.ssaoMaterial.radius = ssaoRadius;
        passes.ssao.ssaoMaterial.bias = ssaoBias;
        passes.ssao.ssaoMaterial.samples = ssaoSamples;
        passes.ssao.resolution.scale = ssaoResolutionScale;
        passes.downsampling.resolution.scale = ssaoResolutionScale;
        passes.bloom.intensity = bloomIntensity;
        passes.bloom.luminanceMaterial.threshold = bloomThreshold;
        passes.bloom.luminanceMaterial.smoothing = bloomSmoothing;
        passes.bloom.mipmapBlurPass.radius = bloomRadius;
        realTimeGiEffect.uniforms.get("giStrength").value = giIntensity;
        if (!realTimeGiEnabled) realTimeGiEffect.dispose();
        invalidate();
    }, [renderer, scene, camera, realTimeGiEffect, realTimeGiEnabled, giIntensity,
        ssaoEnabled, ssaoIntensity, ssaoRadius, ssaoBias, ssaoSamples, ssaoResolutionScale,
        bloomEnabled, bloomIntensity, bloomThreshold, bloomSmoothing, bloomRadius, invalidate]);

    // Mipmap bloom requires explicit luminance and blur target sizing.
    useLayoutEffect(() => {
        const bloom = postProcessingPassesRef.current?.bloom;
        if (!bloom) return;
        const drawingSize = renderer.getDrawingBufferSize(new THREE.Vector2());
        bloom.resolution.scale = bloomResolutionScale;
        bloom.luminancePass.resolution.scale = bloomResolutionScale;
        bloom.mipmapBlurPass.setSize(
            Math.max(1, Math.round(drawingSize.width * bloomResolutionScale)),
            Math.max(1, Math.round(drawingSize.height * bloomResolutionScale))
        );
        invalidate();
    }, [renderer, scene, camera, realTimeGiEffect, size.width, size.height, renderDpr,
        bloomResolutionScale, invalidate]);

    // Release GI buffers independently of the composer's owned effects.
    useEffect(() => () => realTimeGiEffect.dispose(), [realTimeGiEffect]);

    // Render enabled passes in their fixed order every frame.
    useFrame((_, delta) => {
        const composer = postProcessingRef.current;
        if (!composer) return;
        const previousAutoClear = renderer.autoClear;
        renderer.autoClear = true;
        try {
            composer.render(delta);
        } finally {
            renderer.autoClear = previousAutoClear;
        }
    }, 1);

    // ### Asset effects ###

    // Skip legacy material polling for room-streamed exports.
    useEffect(() => {
        if (materialStreamingEnabled) return undefined;
        const filesToLoadBeforeEnablingMaterialSwap = ["/materials/low_512.glb", "/materials/high_4096_NOPBR.glb", "/materials/high_4096_PBR.glb"];
        let cancelled = false;
        const intervalId = setInterval(() => {
        if (!cancelled) {
            const success = pollForFilesInTHREECache(filesToLoadBeforeEnablingMaterialSwap);
            if (success) {
                setEnableMaterialSwap(true);
                clearInterval(intervalId);
            }
        }
        }, 1000); // Check every 1000 milliseconds

        return () => {
        cancelled = true;
        clearInterval(intervalId);
        };
    }, [materialStreamingEnabled]);

    // Force swap the scene's materials if graphical mode changes
    useEffect(() => {
        if(!materialStreamingEnabled && enableMaterialSwap){
            setForceLowresMaterial(false);
            setForceMidresMaterial(false);
            setForceHighResMaterial(false);
            switch (currentGraphicalMode) {
                case "potato":
                    setForceLowresMaterial(true)
                    break;
                case "normal":
                    setForceMidresMaterial(true)
                    break;
                case "high":
                    setForceHighResMaterial(true)
                    break;
            }
        }
        
    },[currentGraphicalMode, enableMaterialSwap, materialStreamingEnabled])

    // ### Interaction effects ###

    // Place transition code
    useEffect(() => {
        switch (transitionDestination) {
            case 'MainMenu':
                
                break;
          }
       
    }, [transitionDestination]);

    // Place conditions for when the mouse is clicked here:
    useEffect(() => {
        // Clicked 3D objects:
        switch(currentObjectClicked) 
        {
            case "MainBody":
                console.log("Main body clicked!")
            break;
        }
        // Clicked 3D objects END
    }, [mouseClicked]);
    
    // ### Debug helpers ###

    //3D info
    // useEffect(() => {
    //     const intervalId = setInterval(() => {
    //         console.clear()
    //         console.log("calls: " + gl.info.render.calls)
    //         console.log("triangles: " + gl.info.render.triangles)
    //         console.log("geometries: " + gl.info.memory.geometries)
    //         console.log("textures: " + gl.info.memory.textures)
    //         // console.log("---------------------")
    //         }, 500); // Check every 1000 milliseconds
        
    //         return () => {
    //             clearInterval(intervalId);
    //         };
    // },[])

    // ### E-commerce integration ###

    const explodingModelPath = viewerModelName || "base_cube_DO_NOT_REMOVE.glb";
    const explodingConfigFile = viewerConfigFile || "base_cube_DO_NOT_REMOVE.json";
    const explodingMaterialPath = viewerMaterialName || "";

    // ### Initial camera transition ###
    
    // Temporary useEffect to initialize the position and camera target of both scenes
    useEffect(() => {
        if(siteMode == "resume"){
            const tempCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(278, 206, -6),
                new THREE.Vector3(260, 190, 18),
                new THREE.Vector3(199, 150, 46)])

                setForcedCameraTarget([45, 21, -50])
                setForcedCameraMovePathCurve(tempCurve);
        }else{
            // setForcedCameraTarget([166, 137, 49])
            setForcedCameraTarget([0, 0, 0])

        }
    }, []);

    // ### Stable scene values ###

    const texturesToLoad = useMemo(() => [
        "AfficheDUT-French.jpg",
        "AfficheDUT-Portuguese.jpg",
        "AfficheEDHC-French.jpg",
        "AfficheEDHC-Portuguese.jpg",
        "AfficheMicrolins1-French.jpg",
        "AfficheMicrolins1-Portuguese.jpg",
        "AfficheMicrolins2-French.jpg",
        "AfficheMicrolins2-Portuguese.jpg",
        "AfficheUNIRN-French.jpg",
        "AfficheUNIRN-Portuguese.jpg",
        "AfficheOrtBTS-French.jpg",
        "AfficheOrtBTS-Portuguese.jpg",
        "AfficheOrt3CSI-French.jpg",
        "AfficheOrt3CSI-Portuguese.jpg"
    ], []);

    const scenesToLoad = useMemo(() => [], []);

    const orbitCenterPosition = useMemo(() => [-17, 97, 27], []);

    const TranslationTable0 = useMemo(() => TranslationTable[currentLanguage]["prospere_itb_presentation"], []);
    const TranslationTable1 = useMemo(() => TranslationTable[currentLanguage]["drim_presentation"], []);
    const TranslationTable2 = useMemo(() => TranslationTable[currentLanguage]["everial_presentation"], []);
    const TranslationTable3 = useMemo(() => TranslationTable[currentLanguage]["bresil_ecobuggy_presentation"], []);
    const TranslationTable4 = useMemo(() => TranslationTable[currentLanguage]["efn1_presentation"], []);
    const TranslationTable5 = useMemo(() => TranslationTable[currentLanguage]["efn2_presentation"], []);

    const initialPosition = useMemo(() => [-2, 75, 32], []);

    const objectLinkPosition1 = useMemo(() => [48, 89, -49], []);
    const objectLinkScale = useMemo(() => [1, 1, 1], []);

    // Match the loaded scene position.
    const curveScrollNavigationCenter = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    // Define circular scroll camera path.
    const curveScrollNavigationCurve = useMemo(() => {
        const radius = 90;
        const cameraHeight = 35;
        const pointCount = 16;
        const curvePoints = [];

        for (let index = 0; index < pointCount; index += 1) {
            const angle = (index / pointCount) * Math.PI * 2;
            curvePoints.push(new THREE.Vector3(
                curveScrollNavigationCenter.x + Math.cos(angle) * radius,
                curveScrollNavigationCenter.y + cameraHeight,
                curveScrollNavigationCenter.z + Math.sin(angle) * radius
            ));
        }

        return new THREE.CatmullRomCurve3(curvePoints, true);
    }, [curveScrollNavigationCenter]);

    const stableOrbitingPointLightParticleEmitterAndPointLightAnimation = useMemo(() => [
        <ParticleEmitter key="particles" imageNames={["fire.png", "fire2.png"]} count={15} speed={10} initialSize={10}
            maxSizeOverLifespan={15} fadeInOut={true} faceCamera={false} faceCameraFrameCheck={80}
            faceCameraAxisLock={[1, 1, 1]} instanceMaxRandomDelay={10} lifespan={0.3}
            spread={3} position={[0, -1, 0]} rotation={[0, 1, 0]} direction={[0, 1, 0]} />,

        <PointLightAnimation key="pointlight" position={[0, 0, 0]} colors={[0x773502, 0xff8c00, 0xffd700]}
            colorFrameIntervals={[7, 5, 6]} randomIntensitiyMargin={[0.05, 0.1]}
            enableRandomColorFrameIntervals={true} />,
        <OrbitingPointLight key="OrbitingPointLight" lightColor = {0xb8774f} orbitDirection = {[0, 1, 0]} orbitSpeed = {0.007} orbitAxis = {"x"} 
            orbitDistance = {50} orbitCenterPosition = {[0,20,0]} lightIntensivity = {1} />
    ], []);

    const isOrbitingMenuVisible = useRef(false)

    useEffect(() => {
        if(transitionDestination === "Education" && !isCameraMoving){
            isOrbitingMenuVisible.current = true;
        }else{
            isOrbitingMenuVisible.current = false;
        }
    }, [transitionDestination, isCameraMoving]);

    // ### Render ###

    return(
    <>
        {/* Mirror the scene for React Three DOM DevTools. */}
        <ThreeDom />

            {/* <ObjectLink position={objectLinkPosition1} scale={objectLinkScale} linkedObjectName = {"Lamp"} >
                {stableOrbitingPointLightParticleEmitterAndPointLightAnimation}
            </ObjectLink> */}
            
            <InstanceLoader instancedObject={"Book.glb"} initialPosition = {initialPosition} directionX = {0} directionY = {0} 
                directionZ = {-1} customRotation = {customInstanceRotation} customColors = {customInstanceColor} NumberOfInstances={35} 
                distanceBetweenInstances={3} />

            <FirstPersonController
                position={firstPersonPosition}
                rotation={firstPersonRotation}
                eyeHeight={eyeHeight}
                navigationRef={houseMakerNavigationRef}
                azertyMode={props.azertyMode ?? "auto"}
                touchNavigationMode={props.touchNavigationMode ?? "gyroscope"}
                inputBlocked={props.inputBlocked ?? false}
                onGyroscopeStatusChange={props.onGyroscopeStatusChange}
            />
            {/* <ambientLight intensity = {1.0}></ambientLight> */}
            <Environment files={`${config.resource_path}/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr`} environmentIntensity={0.35} background={true} />
            
            <HouseMakerLoader
                jsonFile="housemaker_export.json"
                position={[0, 0, 0]}
                environmentScene={scene}
                shadowsEnabled
                fallbackSunEnabled
                shadowMapSize={sceneLayoutKey === "Widescreen" ? 2048 : 1024}
                shadowBias={debugSettings?.shadowBias ?? undefined}
                shadowNormalBias={debugSettings?.shadowNormalBias ?? undefined}
                shadowMapSizeOverride={debugSettings?.shadowMapSize ?? undefined}
                shadowSoftness={debugSettings?.shadowSoftness ?? 2}
                shadowCoverage={debugSettings?.shadowCoverage ?? 100}
                sunLightColor={debugSettings?.sunLightColor ?? undefined}
                sunOrbitPaused={debugSettings?.sunOrbitPaused ?? true}
                sunOrbitAngle={debugSettings?.sunOrbitAngle ?? undefined}
                sunOrbitAngleRevision={debugSettings?.sunOrbitAngleRevision ?? 0}
                showSunRays={props.showSunRays ?? false}
                onSunOrbitAngleChange={props.onSunOrbitAngleChange}
                dayNightSettings={debugSettings}
                dayNightEnvironment={dayNightEnvironmentRef}
                dayNightPanelOpen={props.showDayNightSettings ?? false}
                onDayNightStatusChange={props.onDayNightStatusChange}
                instancesEnabled={siteMode === "resume"}
                showBakedPvs={showBakedPvs}
                pvsDebugOpacity={debugSettings?.pvsOpacity ?? 0.65}
                anisotropicFilteringEnabled={anisotropicFilteringEnabled}
                anisotropy={debugSettings?.anisotropy ?? 8}
                materialStreamingOffscreen
                hideObjectsKey={props.hideObjectsKey ?? "a"}
                objectControlsEnabled={!props.inputBlocked}
                navigationRef={houseMakerNavigationRef}
                toursEnabled={siteMode === "resume"}
            />












            {/* <CurveScrollNavigationCamera
                curve={curveScrollNavigationCurve}
                initialPositionPoint={0}
                navigationCurveIncrement={0.0004}
                loop={true}
                triggerOutProgress="curveScrollNavigationProgress"
                cameraLookatPoint={[0, 0, 0]}
                cameraFocusSpeed={0.5}
                idleCameraAnimationEnable={true}
                idleCameraAnimationDelay={3000}
                idleCameraAnimationSphericalAreaDiameter={8}
                idleCameraAnimationSpeed={0.04}
            // cameraFocusDestination={[0,0,0]}
            /> */}

            {(currentGraphicalMode === "potato")
            && 
            <ambientLight intensity = {0.5}></ambientLight>
            }

            {(currentGraphicalMode === "premium")
            && 
            <ambientLight intensity = {0.1}></ambientLight>
            }

            {(currentGraphicalMode === "high")
            &&
            <>
            <ambientLight intensity = {0.1}></ambientLight>
            </>
            }

        {(siteMode === "store") && 
        <>
            <Camera idleCameraAnimationDelay={3000}
                idleCameraAnimationSphericalAreaDiameter={8}
                idleCameraAnimationSpeed={0.04} idleCameraAnimationEnable={true} transitionSpeed={0.5} cameraTarget={[13, 26, -21]} cameraMovePathCurve={undefined}  triggerOutCameraTransitionStarted="cameraStarted" triggerOutCameraTransitionEnded="cameraEnded" />
            <ambientLight intensity = {1}></ambientLight>
            {(explodingModelPath != "")
            &&
            <ExplodingModelLoader
            modelName={
                // "Roomba.glb"
                explodingModelPath || "base_cube_DO_NOT_REMOVE.glb" 
            } 
            materialName={
                explodingMaterialPath || ""
            } 
            configFile={
                // "Roomba.json"
                explodingConfigFile || "base_cube_DO_NOT_REMOVE.json"
            } 
            animationIsPlaying={animationTriggerState}
            returnCameraPosition={initialCameraPosition}
            setCameraTargetTrigger={"trigger4"} 
            stopMainObjectRotationAnimation={false}
            mainObjectRotationAnimationIsPlayingTrigger={"trigger5"} />
            }
        </>
        }
    </>
    );
});

SceneContainer.displayName = "SceneContainer";
