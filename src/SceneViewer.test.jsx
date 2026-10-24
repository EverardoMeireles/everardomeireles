/* eslint-disable testing-library/no-node-access */

import React from "react";
import { PCFShadowMap } from "three";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SceneViewer from "./SceneViewer";
import { SceneContainer } from "./SceneContainer";
import SystemStore from "./SystemStore";
import UserStore from "./UserStore";

// Keep browser fullscreen tests independent of WebGL and overlays.
jest.mock("@react-three/fiber", () => ({
    Canvas: ({ children, dpr, shadows }) => (
        <div data-testid="viewer-canvas" data-dpr={dpr} data-shadows={String(shadows.enabled)} data-shadow-type={shadows.type}>{children}</div>
    ),
    useFrame: jest.fn(),
}));
jest.mock("r3f-perf", () => ({ Perf: () => null }));
jest.mock("./SceneContainer", () => ({ SceneContainer: jest.fn(() => null) }));
jest.mock("./user_components/HudMenu", () => ({ HudMenu: () => null }));
jest.mock("./user_components/ProgressBar.jsx", () => ({ ProgressBar: () => null }));
jest.mock("./system_components/Alert", () => ({
    Alert: () => <div data-testid="viewer-alert" />,
}));
jest.mock("./system_components/ToolTip", () => ({
    ToolTip: () => <div data-testid="viewer-tooltip" />,
}));
jest.mock("./system_components/Circle", () => ({ Circle: () => null }));
jest.mock("./system_components/TwoDSplashScreen.jsx", () => ({ TwoDSplashScreen: () => null }));
jest.mock("react-router-dom", () => ({
    BrowserRouter: ({ children }) => <>{children}</>,
    Routes: ({ children }) => <>{children}</>,
    Route: ({ path, element }) => path === "*" ? element : null,
}));

let viewerRoot;
let fullscreenElement;
let webkitFullscreenElement;
let pointerLockElement;
const originalPointerLock = Object.getOwnPropertyDescriptor(document, "pointerLockElement");
const originalExitPointerLock = Object.getOwnPropertyDescriptor(document, "exitPointerLock");
const originalTouchPoints = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalKeyboard = Object.getOwnPropertyDescriptor(navigator, "keyboard");
const originalLanguage = Object.getOwnPropertyDescriptor(navigator, "language");
const originalViewport = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };

// Mount into the same fullscreen container used by index.
function renderViewer(element = <SceneViewer />) {
    return render(element, { container: viewerRoot });
}

// Reflect browser-owned state before emitting its native event.
function changeFullscreen(element, prefixed = false) {
    if (prefixed) webkitFullscreenElement = element;
    else fullscreenElement = element;
    fireEvent(document, new Event(prefixed ? "webkitfullscreenchange" : "fullscreenchange"));
}

beforeEach(() => {
    SceneContainer.mockReset().mockReturnValue(null);
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 1 });
    Object.defineProperty(navigator, "keyboard", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => ({ matches: false })),
    });
    fullscreenElement = null;
    webkitFullscreenElement = null;
    pointerLockElement = null;
    viewerRoot = document.createElement("div");
    viewerRoot.id = "viewer-root";
    document.body.appendChild(viewerRoot);
    Object.defineProperties(document, {
        fullscreenElement: { configurable: true, get: () => fullscreenElement },
        webkitFullscreenElement: { configurable: true, get: () => webkitFullscreenElement },
        fullscreenEnabled: { configurable: true, value: true },
        webkitFullscreenEnabled: { configurable: true, value: true },
        exitFullscreen: { configurable: true, value: jest.fn(() => Promise.resolve()) },
        webkitExitFullscreen: { configurable: true, value: undefined },
        pointerLockElement: { configurable: true, get: () => pointerLockElement },
        exitPointerLock: { configurable: true, value: jest.fn() },
    });
    Object.defineProperties(viewerRoot, {
        requestFullscreen: { configurable: true, value: jest.fn(() => Promise.resolve()) },
        webkitRequestFullscreen: { configurable: true, value: undefined },
    });
    global.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
    act(() => {
        SystemStore.setState({
            canvasEnabled: true,
            forceDisableRender: false,
            circlesData: [],
            circleProperties: { active: false },
            productInformationFromMessage: undefined,
            r3fPerfEnabled: false,
            realTimeGiEnabled: false,
            ssaoEnabled: true,
            bloomEnabled: false,
            shadowsEnabled: true,
            showBakedPvs: false,
            anisotropicFilteringEnabled: true,
            viewerDpr: 1,
            viewerDebugSettings: {
                giIntensity: 0.7, giResolutionScale: null,
                ssaoIntensity: 2, ssaoRadius: 0.05, ssaoBias: 0.014, ssaoSamples: 49, ssaoResolutionScale: 0.5,
                bloomIntensity: 0.5, bloomThreshold: 2, bloomSmoothing: 0.2, bloomRadius: 0.5, bloomResolutionScale: 0.5,
                shadowBias: null, shadowNormalBias: null, shadowMapSize: null, shadowSoftness: 2, shadowCoverage: 100,
                sunLightColor: null,
                sunOrbitPaused: true, sunOrbitAngle: null, sunOrbitAngleRevision: 0,
                dayNightDuration: 3, dayNightMaxElevation: 60, dayNightAzimuth: 0,
                dayNightSunStrength: 1, dayNightDayBrightness: 0.35,
                dayNightNightBrightness: 0.12, dayNightNightSkyBrightness: 0.15, dayNightProgress: 0,
                dayNightAction: null, dayNightCommand: 0,
                anisotropy: 8, pvsOpacity: 0.65,
            },
            tutorialClosed: true,
        });
        UserStore.setState({ siteMode: "resume" });
    });
});

afterEach(() => {
    cleanup();
    if (originalTouchPoints) Object.defineProperty(navigator, "maxTouchPoints", originalTouchPoints);
    else delete navigator.maxTouchPoints;
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else delete window.matchMedia;
    if (originalKeyboard) Object.defineProperty(navigator, "keyboard", originalKeyboard);
    else delete navigator.keyboard;
    if (originalLanguage) Object.defineProperty(navigator, "language", originalLanguage);
    else delete navigator.language;
    if (originalPointerLock) Object.defineProperty(document, "pointerLockElement", originalPointerLock);
    else delete document.pointerLockElement;
    if (originalExitPointerLock) Object.defineProperty(document, "exitPointerLock", originalExitPointerLock);
    else delete document.exitPointerLock;
    Object.assign(window, originalViewport);
    [
        "fullscreenElement", "webkitFullscreenElement", "fullscreenEnabled",
        "webkitFullscreenEnabled", "exitFullscreen", "webkitExitFullscreen",
    ].forEach((property) => { delete document[property]; });
    viewerRoot.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("fullscreen requests require a click and include the viewer overlays", async () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    expect(viewerRoot).toContainElement(canvas);
    expect(viewerRoot).toContainElement(screen.getByTestId("viewer-alert"));
    expect(viewerRoot).toContainElement(screen.getByTestId("viewer-tooltip"));
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
    fireEvent(window, new Event("orientationchange"));
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
    expect(viewerRoot.requestFullscreen.mock.instances[0]).toBe(viewerRoot);
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();
    changeFullscreen(viewerRoot);
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Enter fullscreen" })).not.toBeInTheDocument();
    expect(screen.getByText("×")).toBeInTheDocument();
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    changeFullscreen(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByText("×")).not.toBeInTheDocument();
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("native fullscreen changes and Escape keep the button synchronized", () => {
    renderViewer();
    changeFullscreen(viewerRoot);
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled();
    changeFullscreen(null);
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
    expect(document.exitFullscreen).not.toHaveBeenCalled();
});

test.each(["unsupported", "denied"])("%s fullscreen leaves the viewer available", (reason) => {
    if (reason === "unsupported") {
        Object.defineProperty(viewerRoot, "requestFullscreen", { value: undefined });
    } else {
        Object.defineProperty(document, "fullscreenEnabled", { value: false });
    }
    renderViewer();
    expect(screen.getByRole("button", { name: "Fullscreen unavailable" })).toBeDisabled();
    expect(screen.getByTestId("viewer-canvas")).toBeInTheDocument();
});

test.each([false, true])("fullscreen failures remain recoverable when exiting=%s", async (exiting) => {
    const request = exiting ? document.exitFullscreen : viewerRoot.requestFullscreen;
    request.mockRejectedValueOnce(new Error("Fullscreen permission denied"));
    renderViewer();
    if (exiting) changeFullscreen(viewerRoot);
    const action = exiting ? "Exit fullscreen" : "Enter fullscreen";
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByRole("status")).toHaveTextContent(
        `Could not ${exiting ? "exit" : "enter"} fullscreen. Please try again.`
    );
    expect(screen.getByRole("button", { name: action })).toBeEnabled();
    expect(screen.getByTestId("viewer-canvas")).toBeInTheDocument();
});

test("a synchronous fullscreen exception does not interrupt rendering", async () => {
    viewerRoot.requestFullscreen.mockImplementationOnce(() => {
        throw new Error("Fullscreen is not allowed");
    });
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
        "Could not enter fullscreen. Please try again."
    );
    expect(screen.getByTestId("viewer-canvas")).toBeInTheDocument();
});

test("pending requests disable repeated taps until the browser responds", async () => {
    let resolveRequest;
    viewerRoot.requestFullscreen.mockReturnValueOnce(new Promise((resolve) => {
        resolveRequest = resolve;
    }));
    renderViewer();
    const button = screen.getByRole("button", { name: "Enter fullscreen" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledTimes(1);
    await act(async () => resolveRequest());
    expect(button).toBeEnabled();
});

test("prefixed Safari fullscreen uses the viewer target and native changes", async () => {
    Object.defineProperties(viewerRoot, {
        requestFullscreen: { value: undefined },
        webkitRequestFullscreen: { value: jest.fn() },
    });
    Object.defineProperties(document, {
        exitFullscreen: { value: undefined },
        webkitExitFullscreen: { value: jest.fn() },
    });
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(viewerRoot.webkitRequestFullscreen).toHaveBeenCalledTimes(1);
    expect(viewerRoot.webkitRequestFullscreen.mock.instances[0]).toBe(viewerRoot);
    changeFullscreen(viewerRoot, true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(document.webkitExitFullscreen).toHaveBeenCalledTimes(1);
    changeFullscreen(null, true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled());
});

test("Strict Mode cleans fullscreen listeners without duplicating requests", async () => {
    const addListener = jest.spyOn(document, "addEventListener");
    const removeListener = jest.spyOn(document, "removeEventListener");
    const view = renderViewer(<React.StrictMode><SceneViewer /></React.StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled());
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledTimes(1);
    view.unmount();

    for (const eventName of ["fullscreenchange", "webkitfullscreenchange"]) {
        const added = addListener.mock.calls.filter(([name]) => name === eventName);
        const removed = removeListener.mock.calls.filter(([name]) => name === eventName);
        expect(added.length).toBeGreaterThan(0);
        expect(removed).toHaveLength(added.length);
        added.forEach(([name, listener]) => {
            expect(removed.some(([removedName, removedListener]) => (
                removedName === name && removedListener === listener
            ))).toBe(true);
        });
    }
});

test("fresh viewer defaults and SSAO reset preserve the chosen lighting settings", () => {
    const defaults = SystemStore.getInitialState();
    const ssaoDefaults = { ssaoIntensity: 2, ssaoRadius: 0.05, ssaoBias: 0.014, ssaoSamples: 49, ssaoResolutionScale: 0.5 };
    expect(defaults).toMatchObject({ realTimeGiEnabled: false, ssaoEnabled: true, anisotropicFilteringEnabled: true,
        viewerDebugSettings: { ...ssaoDefaults, anisotropy: 8, sunOrbitPaused: true } });
    SystemStore.setState({ realTimeGiEnabled: defaults.realTimeGiEnabled, ssaoEnabled: defaults.ssaoEnabled,
        anisotropicFilteringEnabled: defaults.anisotropicFilteringEnabled, viewerDebugSettings: { ...defaults.viewerDebugSettings } });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    expect(screen.getByRole("button", { name: "Real-time GI: Off" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Anisotropic filtering: On" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "SSAO: On" }));
    expect(screen.getByRole("checkbox", { name: "Enable SSAO" })).toBeChecked();
    for (const [label, initial, changed] of [["SSAO strength", 2, 1], ["SSAO radius", 0.05, 0.2],
        ["SSAO bias", 0.014, 0.02], ["SSAO samples", 49, 17], ["SSAO resolution", 0.5, 0.25]]) {
        const slider = screen.getByRole("slider", { name: new RegExp(label) });
        expect(slider).toHaveValue(String(initial));
        fireEvent.change(slider, { target: { value: changed } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject(ssaoDefaults);
    expect(SystemStore.getState()).toMatchObject({ realTimeGiEnabled: false, ssaoEnabled: true, anisotropicFilteringEnabled: true });
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("GI opens settings before toggling without replacing the canvas", () => {
    SystemStore.setState({ realTimeGiEnabled: true, ssaoEnabled: false });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const button = screen.getByRole("button", { name: "Real-time GI: On" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Real-time GI" }));
    expect(SystemStore.getState().realTimeGiEnabled).toBe(false);
    expect(SystemStore.getState().ssaoEnabled).toBe(false);
    expect(screen.getByRole("button", { name: "Real-time GI: Off" }))
        .toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(SystemStore.getState().canvasEnabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Real-time GI" }));
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(SystemStore.getState().ssaoEnabled).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test.each([false, true])("SSAO toggles independently when GI is %s without interrupting navigation", (giEnabled) => {
    SystemStore.setState({ realTimeGiEnabled: giEnabled });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const sceneProps = SceneContainer.mock.calls.at(-1)[0];
    const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
    sceneProps.navigationRef.current = navigation;
    const button = screen.getByRole("button", { name: "SSAO: On" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);

    for (const next of [false, true]) {
        fireEvent.click(screen.getByRole("checkbox", { name: "Enable SSAO" }));
        expect(SystemStore.getState().ssaoEnabled).toBe(next);
        expect(screen.getByRole("button", { name: `SSAO: ${next ? "On" : "Off"}` }))
            .toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("checkbox", { name: "Enable SSAO" })).toHaveProperty("checked", next);
        expect(SystemStore.getState().realTimeGiEnabled).toBe(giEnabled);
        expect(SystemStore.getState().canvasEnabled).toBe(true);
        expect(SystemStore.getState().forceDisableRender).toBe(false);
        expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
        expect(SceneContainer.mock.calls.at(-1)[0].navigationRef).toBe(sceneProps.navigationRef);
        expect(SceneContainer.mock.calls.at(-1)[0].navigationRef.current).toBe(navigation);
        expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    }
    expect(navigation.enableGyroscope).not.toHaveBeenCalled();
    expect(navigation.recenterGyroscope).not.toHaveBeenCalled();
});

test.each([[false, false], [false, true], [true, false], [true, true]])(
    "bloom toggles independently when GI is %s and SSAO is %s",
    (giEnabled, ssaoEnabled) => {
        expect(SystemStore.getInitialState()).toMatchObject({
            bloomEnabled: false,
            viewerDebugSettings: { bloomIntensity: 0.5, bloomThreshold: 2, bloomSmoothing: 0.2,
                bloomRadius: 0.5, bloomResolutionScale: 0.5 },
        });
        SystemStore.setState({ realTimeGiEnabled: giEnabled, ssaoEnabled });
        renderViewer();
        const canvas = screen.getByTestId("viewer-canvas");
        const sceneProps = SceneContainer.mock.calls.at(-1)[0];
        const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
        sceneProps.navigationRef.current = navigation;
        const initialSettings = SystemStore.getState().viewerDebugSettings;
        const button = screen.getByRole("button", { name: "Bloom: Off" });
        expect(button).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(button);
        expect(SystemStore.getState().bloomEnabled).toBe(false);
        expect(button).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("region", { name: "Bloom" })).toHaveTextContent("before tone mapping");

        for (const next of [true, false]) {
            fireEvent.click(screen.getByRole("checkbox", { name: "Enable Bloom" }));
            expect(SystemStore.getState()).toMatchObject({
                bloomEnabled: next, realTimeGiEnabled: giEnabled, ssaoEnabled,
                shadowsEnabled: true, canvasEnabled: true, forceDisableRender: false,
            });
            expect(SystemStore.getState().viewerDebugSettings).toBe(initialSettings);
            expect(screen.getByRole("button", { name: `Bloom: ${next ? "On" : "Off"}` }))
                .toHaveAttribute("aria-expanded", "true");
            expect(screen.getByRole("checkbox", { name: "Enable Bloom" })).toHaveProperty("checked", next);
            expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
            expect(SceneContainer.mock.calls.at(-1)[0].navigationRef).toBe(sceneProps.navigationRef);
            expect(SceneContainer.mock.calls.at(-1)[0].navigationRef.current).toBe(navigation);
            expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
        }
        expect(navigation.enableGyroscope).not.toHaveBeenCalled();
        expect(navigation.recenterGyroscope).not.toHaveBeenCalled();
    }
);

test.each([[false, false], [false, true], [true, false], [true, true]])(
    "shadows toggle independently when GI is %s and SSAO is %s without interrupting navigation",
    (giEnabled, ssaoEnabled) => {
        SystemStore.setState({ realTimeGiEnabled: giEnabled, ssaoEnabled });
        renderViewer();
        const canvas = screen.getByTestId("viewer-canvas");
        const sceneProps = SceneContainer.mock.calls.at(-1)[0];
        const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
        sceneProps.navigationRef.current = navigation;
        const button = screen.getByRole("button", { name: "Shadows: On" });
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
        expect(canvas).toHaveAttribute("data-shadows", "true");
        expect(canvas).toHaveAttribute("data-shadow-type", String(PCFShadowMap));
        fireEvent.click(button);

        for (const next of [false, true]) {
            fireEvent.click(screen.getByRole("checkbox", { name: "Enable Shadows" }));
            expect(SystemStore.getState().shadowsEnabled).toBe(next);
            expect(screen.getByRole("button", { name: `Shadows: ${next ? "On" : "Off"}` }))
                .toHaveAttribute("aria-expanded", "true");
            expect(screen.getByRole("checkbox", { name: "Enable Shadows" })).toHaveProperty("checked", next);
            expect(canvas).toHaveAttribute("data-shadows", String(next));
            expect(canvas).toHaveAttribute("data-shadow-type", String(PCFShadowMap));
            expect(SystemStore.getState().realTimeGiEnabled).toBe(giEnabled);
            expect(SystemStore.getState().ssaoEnabled).toBe(ssaoEnabled);
            expect(SystemStore.getState().canvasEnabled).toBe(true);
            expect(SystemStore.getState().forceDisableRender).toBe(false);
            expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
            expect(SceneContainer.mock.calls.at(-1)[0].navigationRef).toBe(sceneProps.navigationRef);
            expect(SceneContainer.mock.calls.at(-1)[0].navigationRef.current).toBe(navigation);
            expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
        }
        expect(navigation.enableGyroscope).not.toHaveBeenCalled();
        expect(navigation.recenterGyroscope).not.toHaveBeenCalled();
    }
);

test("desktop rendering hides fullscreen entry and motion controls", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
    const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
    SceneContainer.mockImplementation(({ navigationRef }) => {
        navigationRef.current = navigation;
        return null;
    });
    renderViewer();
    expect(screen.queryByRole("button", { name: "Enable gyroscope" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recenter view" })).not.toBeInTheDocument();
    expect(navigation.enableGyroscope).not.toHaveBeenCalled();
    expect(navigation.recenterGyroscope).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Enter fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Real-time GI: Off" })).toBeEnabled();
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
    const hint = screen.getByText("Hide objects");
    const icon = screen.getByRole("img", { name: "Object visibility keyboard shortcut" });
    expect(icon).toHaveAttribute("src", expect.stringContaining("/textures/key_a.png"));
    expect(icon).toHaveStyle({ width: "57.6px", height: "57.6px" });
    expect(viewerRoot).toContainElement(icon);
    expect(icon.closest('[data-testid="viewer-canvas"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute("title", "Hide objects (Q)");
    expect(screen.queryByText("Q")).not.toBeInTheDocument();
    expect(hint.closest("button")).toBeEnabled();
    expect(screen.getByRole("group", { name: "Viewer controls" }))
        .toBe(screen.getByRole("button", { name: "Real-time GI: Off" }).previousElementSibling);
});

test("coarse-pointer devices retain fullscreen entry without touch-point reporting", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    window.matchMedia.mockReturnValue({ matches: true });
    renderViewer();
    expect(window.matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
    expect(screen.queryByText("Hide objects")).not.toBeInTheDocument();
});

test("touch devices never show the desktop keyboard hint", () => {
    renderViewer();
    expect(screen.queryByText("Hide objects")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Chair" })).toBeInTheDocument();
    expect(screen.queryByText("Q")).not.toBeInTheDocument();
});

test("desktop keyboard hint disappears when the canvas is disabled", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    renderViewer();
    expect(screen.getByText("Hide objects")).toBeInTheDocument();
    act(() => SystemStore.setState({ canvasEnabled: false }));
    expect(screen.queryByText("Hide objects")).not.toBeInTheDocument();
});

test("landscape resizing keeps touch fullscreen available without replacing the canvas", () => {
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    Object.assign(window, { innerWidth: 844, innerHeight: 390 });
    fireEvent(window, new Event("orientationchange"));
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
});

test("desktop native fullscreen and Escape never add an X control", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    renderViewer();
    changeFullscreen(viewerRoot);
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByText("×")).not.toBeInTheDocument();
    changeFullscreen(null);
    expect(screen.queryByRole("button", { name: "Enter fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(document.exitFullscreen).not.toHaveBeenCalled();
});

test("PVS debug button follows shadows and toggles without changing lighting or canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const giButton = screen.getByRole("button", { name: "Real-time GI: Off" });
    const ssaoButton = screen.getByRole("button", { name: "SSAO: On" });
    const shadowsButton = screen.getByRole("button", { name: "Shadows: On" });
    const debugButton = screen.getByRole("button", { name: "Show baked pvs" });
    expect(giButton.nextElementSibling).toBe(ssaoButton);
    expect(ssaoButton.nextElementSibling).toBe(shadowsButton);
    expect(shadowsButton.nextElementSibling).toBe(debugButton);
    expect(debugButton).toHaveAttribute("aria-expanded", "false");
    expect(debugButton.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(debugButton);
    expect(SystemStore.getState().showBakedPvs).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Baked PVS" }));
    expect(SystemStore.getState().showBakedPvs).toBe(true);
    expect(screen.getByRole("button", { name: "Hide baked pvs" })).toHaveAttribute("aria-expanded", "true");
    expect(SystemStore.getState().realTimeGiEnabled).toBe(false);
    expect(SystemStore.getState().ssaoEnabled).toBe(true);
    expect(SystemStore.getState().shadowsEnabled).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Baked PVS" }));
    expect(SystemStore.getState().showBakedPvs).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("anisotropic filtering toggles without changing lighting, DPR, or canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const button = screen.getByRole("button", { name: "Anisotropic filtering: On" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Anisotropic filtering" }));
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(false);
    expect(screen.getByRole("button", { name: "Anisotropic filtering: Off" })).toHaveAttribute("aria-expanded", "true");
    expect(SystemStore.getState().realTimeGiEnabled).toBe(false);
    expect(SystemStore.getState().viewerDpr).toBe(1);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable Anisotropic filtering" }));
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("DPR slider changes quality without replacing the canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    expect(canvas).toHaveAttribute("data-dpr", "1");
    const button = screen.getByRole("button", { name: "DPR: 1" });
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(SystemStore.getState().viewerDpr).toBe(1);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    for (const next of [0.5, 1.25, 1.5, 2, 1]) {
        fireEvent.change(screen.getByRole("slider", { name: /Pixel ratio/ }), { target: { value: next } });
        expect(SystemStore.getState().viewerDpr).toBe(next);
        expect(screen.getByRole("button", { name: `DPR: ${next}` })).toBeEnabled();
        expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
        expect(canvas).toHaveAttribute("data-dpr", String(next));
    }
    expect(SystemStore.getState().realTimeGiEnabled).toBe(false);
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(true);
    expect(SystemStore.getState().canvasEnabled).toBe(true);
});

test("sun light color opens a picker, preserves edits, and resets only its color", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = { ...SystemStore.getState().viewerDebugSettings };
    const button = screen.getByRole("button", { name: "Sun light color" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Sun light color/, { selector: "input" })).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: "Sun light color" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const picker = screen.getByLabelText(/Sun light color/, { selector: "input" });
    expect(picker).toHaveAttribute("type", "color");
    expect(picker).toHaveValue("#ffffff");
    expect(screen.getByText("Auto")).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "#ff8844" } });
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, sunLightColor: "#ff8844" });
    expect(picker).toHaveValue("#ff8844");
    expect(screen.getByText("#ff8844")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close debug settings" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByLabelText(/Sun light color/, { selector: "input" })).toHaveValue("#ff8844");
    expect(screen.getByText(/Reset restores the exported sun color/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual(initialSettings);
    expect(screen.getByLabelText(/Sun light color/, { selector: "input" })).toHaveValue("#ffffff");
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(SystemStore.getState()).toMatchObject({
        realTimeGiEnabled: false, ssaoEnabled: true, shadowsEnabled: true,
        anisotropicFilteringEnabled: true, viewerDpr: 1, canvasEnabled: true,
    });
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("sun orbit pauses at a chosen angle and resets independently", () => {
    expect(SystemStore.getInitialState().viewerDebugSettings).toMatchObject({ sunOrbitPaused: true, sunOrbitAngle: null, sunOrbitAngleRevision: 0 });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = { ...SystemStore.getState().viewerDebugSettings };
    fireEvent.click(screen.getByRole("button", { name: "Sun orbit" }));
    const panel = screen.getByRole("region", { name: "Sun orbit" });
    const animate = screen.getByRole("checkbox", { name: "Animate sun orbit" });
    const slider = screen.getByRole("slider", { name: /Sun orbit angle/ });
    expect(animate).not.toBeChecked();
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "360");
    expect(slider).toHaveAttribute("step", "1");
    expect(slider).toHaveAttribute("aria-valuetext", "0°");
    expect(panel).toHaveTextContent("Play uses the exported orbit speed");
    expect(panel).toHaveTextContent("not whether it passes through walls");
    fireEvent.click(animate);
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, sunOrbitPaused: false });
    fireEvent.click(animate);
    expect(SystemStore.getState().viewerDebugSettings).toEqual(initialSettings);
    for (const [index, angle] of [180, 360, 0, 73].entries()) {
        fireEvent.change(slider, { target: { value: angle } });
        expect(animate).not.toBeChecked();
        expect(slider).toHaveAttribute("aria-valuetext", `${angle}°`);
        expect(SystemStore.getState().viewerDebugSettings).toEqual({
            ...initialSettings, sunOrbitAngle: angle, sunOrbitPaused: true, sunOrbitAngleRevision: index + 1,
        });
    }
    fireEvent.click(animate);
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, sunOrbitAngle: 73, sunOrbitPaused: false, sunOrbitAngleRevision: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(animate).not.toBeChecked();
    expect(slider).toHaveAttribute("aria-valuetext", "0°");
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, sunOrbitAngleRevision: 5 });
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
});

test("repeated sun angle commands and resets remain distinct after animation", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    fireEvent.click(screen.getByRole("button", { name: "Sun orbit" }));
    const slider = screen.getByRole("slider", { name: /Sun orbit angle/ });
    const onSunOrbitAngleChange = SceneContainer.mock.calls.at(-1)[0].onSunOrbitAngleChange;
    fireEvent.change(slider, { target: { value: 90 } });
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({
        sunOrbitAngle: 90, sunOrbitPaused: true, sunOrbitAngleRevision: 1,
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Animate sun orbit" }));
    act(() => onSunOrbitAngleChange(135));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({
        sunOrbitAngle: 90, sunOrbitPaused: false, sunOrbitAngleRevision: 1,
    });
    fireEvent.change(slider, { target: { value: 90 } });
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({
        sunOrbitAngle: 90, sunOrbitPaused: true, sunOrbitAngleRevision: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({
        sunOrbitAngle: null, sunOrbitPaused: true, sunOrbitAngleRevision: 3,
    });
    act(() => onSunOrbitAngleChange(120));
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({
        sunOrbitAngle: null, sunOrbitPaused: true, sunOrbitAngleRevision: 4,
    });
    expect(slider).toHaveAttribute("aria-valuetext", "0°");
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("live sun angles update the readout without writing animation into settings", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = SystemStore.getState().viewerDebugSettings;
    const onSunOrbitAngleChange = SceneContainer.mock.calls.at(-1)[0].onSunOrbitAngleChange;
    fireEvent.click(screen.getByRole("button", { name: "Sun orbit" }));
    const slider = screen.getByRole("slider", { name: /Sun orbit angle/ });
    act(() => onSunOrbitAngleChange(42.567));
    expect(slider).toHaveValue("42.567");
    expect(slider).toHaveAttribute("aria-valuetext", "42.6°");
    expect(SystemStore.getState().viewerDebugSettings).toBe(initialSettings);
    expect(SceneContainer.mock.calls.at(-1)[0].onSunOrbitAngleChange).toBe(onSunOrbitAngleChange);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("sun ray guides are enabled only while the sun orbit panel is visible", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const button = screen.getByRole("button", { name: "Sun orbit" });
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Shadows: On" }));
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("slider", { name: /Sun orbit angle/ }), { key: "Escape" });
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Close debug settings" }));
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    fireEvent.click(button);
    act(() => SystemStore.setState({ tutorialClosed: false }));
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(false);
    expect(screen.queryByRole("region", { name: "Sun orbit" })).not.toBeInTheDocument();
    act(() => SystemStore.setState({ tutorialClosed: true }));
    expect(SceneContainer.mock.calls.at(-1)[0].showSunRays).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("sun orbit controls isolate gameplay keys and pointer gestures", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Sun orbit" }));
    const keyboard = jest.fn();
    const pointer = jest.fn();
    window.addEventListener("keydown", keyboard);
    window.addEventListener("pointerdown", pointer);
    const slider = screen.getByRole("slider", { name: /Sun orbit angle/ });
    fireEvent.keyDown(slider, { key: "a", code: "KeyA" });
    fireEvent.pointerDown(slider, { pointerId: 1 });
    expect(keyboard).not.toHaveBeenCalled();
    expect(pointer).not.toHaveBeenCalled();
    expect(SystemStore.getState().isMouseDown).toBe(false);
    fireEvent.keyDown(slider, { key: "Escape" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("pointerdown", pointer);
});

test("day night starts static and prepares environments only when opened", () => {
    expect(SystemStore.getInitialState()).toMatchObject({
        anisotropicFilteringEnabled: true,
        viewerDebugSettings: { anisotropy: 8, sunOrbitPaused: true, dayNightDuration: 3, dayNightAction: null, dayNightCommand: 0 },
    });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = SystemStore.getState().viewerDebugSettings;
    expect(SceneContainer.mock.calls.at(-1)[0].showDayNightSettings).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({ showDayNightSettings: true, showSunRays: true });
    expect(screen.getByRole("region", { name: "Day / night" })).toHaveTextContent("morning → noon → afternoon → sunset → dusk → evening → night");
    expect(screen.getByRole("status", { name: "Day night status" })).toHaveTextContent("Preparing night environment");
    expect(screen.getByRole("button", { name: "Play day to night" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play night to day" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: /Time of day/ })).toBeDisabled();
    expect(SystemStore.getState().viewerDebugSettings).toBe(initialSettings);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("day night commands play, pause, resume and reset without remounting", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = SystemStore.getState().viewerDebugSettings;
    const onDayNightStatusChange = SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange;
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    act(() => onDayNightStatusChange({ ready: true, active: false, playing: false, progress: 0, stage: "Exported lighting", error: null }));
    expect(screen.getByRole("button", { name: "Play day to night" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Play day to night" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "play", dayNightCommand: 1 });
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: true, progress: 25, stage: "Noon", error: null }));
    expect(screen.getByRole("status", { name: "Day night status" })).toHaveTextContent("Noon · 25%");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "pause", dayNightCommand: 2 });
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 25, stage: "Noon", error: null }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "resume", dayNightCommand: 3 });
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 100, stage: "Night", error: null }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset daylight" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "reset", dayNightCommand: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Reset daylight" }));
    expect(SystemStore.getState().viewerDebugSettings.dayNightCommand).toBe(5);
    expect(SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange).toBe(onDayNightStatusChange);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("day night direction changes continue from the current time", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = SystemStore.getState().viewerDebugSettings;
    const onDayNightStatusChange = SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange;
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    act(() => onDayNightStatusChange({ ready: true, active: false, playing: false, progress: 0, playbackDirection: 1, stage: "Exported lighting", error: null }));
    expect(screen.getByRole("button", { name: "Play night to day" })).toBeDisabled();
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: true, progress: 65, playbackDirection: 1, stage: "Sunset", error: null }));
    fireEvent.click(screen.getByRole("button", { name: "Play night to day" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "reverse", dayNightCommand: 1 });
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: true, progress: 60, playbackDirection: -1, stage: "Afternoon", error: null }));
    expect(screen.getByRole("slider", { name: /Time of day/ })).toHaveValue("60");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({ dayNightAction: "pause", dayNightCommand: 2 });
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 60, playbackDirection: -1, stage: "Afternoon", error: null }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({ dayNightAction: "resume", dayNightCommand: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Play day to night" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "play", dayNightCommand: 4 });
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("day night endpoint buttons respect the playback direction", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    const onDayNightStatusChange = SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange;
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 100, playbackDirection: 1, stage: "Night", error: null }));
    expect(screen.getByRole("button", { name: "Play day to night" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play night to day" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 100, playbackDirection: -1, stage: "Night", error: null }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 0, playbackDirection: -1, stage: "Morning", error: null }));
    expect(screen.getByRole("button", { name: "Play day to night" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Play night to day" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: false, progress: 0, playbackDirection: 1, stage: "Morning", error: null }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
});

test("day night progress scrubs immediately and receives live progress locally", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    const onDayNightStatusChange = SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange;
    act(() => onDayNightStatusChange({ ready: true, active: false, playing: false, progress: 0, stage: "Exported lighting", error: null }));
    const slider = screen.getByRole("slider", { name: /Time of day/ });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    fireEvent.change(slider, { target: { value: 75 } });
    expect(slider).toHaveValue("75");
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({ dayNightAction: "preview", dayNightProgress: 75, dayNightCommand: 1 });
    const settings = SystemStore.getState().viewerDebugSettings;
    act(() => onDayNightStatusChange({ ready: true, active: true, playing: true, progress: 85.5, stage: "Evening", error: null }));
    expect(slider).toHaveValue("85.5");
    expect(slider).toHaveAttribute("aria-valuetext", "86%");
    expect(SystemStore.getState().viewerDebugSettings).toBe(settings);
});

test.each([
    ["Transition duration", "dayNightDuration", 3, 12, 2, 30],
    ["Maximum sun elevation", "dayNightMaxElevation", 60, 75, 10, 85],
    ["Sun path azimuth", "dayNightAzimuth", 0, -45, -180, 180],
    ["Sun strength", "dayNightSunStrength", 1, 1.5, 0, 3],
    ["Day environment brightness", "dayNightDayBrightness", 0.35, 0.7, 0, 2],
    ["Night environment brightness", "dayNightNightBrightness", 0.12, 0.2, 0, 1],
    ["Night sky brightness", "dayNightNightSkyBrightness", 0.15, 0.3, 0, 1],
])("day night %s configures without launching and resets independently", (label, key, initial, next, min, max) => {
    renderViewer();
    const initialSettings = SystemStore.getState().viewerDebugSettings;
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    const slider = screen.getByRole("slider", { name: new RegExp(label) });
    expect(slider).toHaveValue(String(initial));
    expect(slider).toHaveAttribute("min", String(min));
    expect(slider).toHaveAttribute("max", String(max));
    fireEvent.change(slider, { target: { value: next } });
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, [key]: next });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, dayNightAction: "reset", dayNightCommand: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings.dayNightCommand).toBe(2);
});

test("day night failure preserves fallback controls and closing disables guides", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    const onDayNightStatusChange = SceneContainer.mock.calls.at(-1)[0].onDayNightStatusChange;
    act(() => onDayNightStatusChange({ ready: false, active: false, playing: false, progress: 0, stage: "Exported lighting", error: "HDR download failed" }));
    expect(screen.getByRole("status", { name: "Day night status" })).toHaveTextContent("Night environment unavailable: HDR download failed");
    expect(screen.getByRole("button", { name: "Play day to night" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset daylight" })).toBeEnabled();
    const keyboard = jest.fn();
    const pointer = jest.fn();
    window.addEventListener("keydown", keyboard);
    window.addEventListener("pointerdown", pointer);
    const slider = screen.getByRole("slider", { name: /Transition duration/ });
    fireEvent.keyDown(slider, { key: "a", code: "KeyA" });
    fireEvent.pointerDown(slider, { pointerId: 1 });
    expect(keyboard).not.toHaveBeenCalled();
    expect(pointer).not.toHaveBeenCalled();
    fireEvent.keyDown(slider, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Day / night" })).not.toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({ showSunRays: false, showDayNightSettings: false });
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("pointerdown", pointer);
});

test("day night panel waits for tutorial dismissal without issuing animation commands", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Day / night" }));
    act(() => SystemStore.setState({ tutorialClosed: false }));
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({ showSunRays: false, showDayNightSettings: false });
    expect(screen.queryByRole("region", { name: "Day / night" })).not.toBeInTheDocument();
    expect(SystemStore.getState().viewerDebugSettings).toMatchObject({ dayNightAction: null, dayNightCommand: 0, sunOrbitPaused: true });
});

test("sun light color isolates gameplay keys and pointer gestures", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Sun light color" }));
    const keyboard = jest.fn();
    const pointer = jest.fn();
    window.addEventListener("keydown", keyboard);
    window.addEventListener("keyup", keyboard);
    window.addEventListener("pointerdown", pointer);
    const picker = screen.getByLabelText(/Sun light color/, { selector: "input" });
    fireEvent.keyDown(picker, { key: "a", code: "KeyA" });
    fireEvent.keyUp(picker, { key: "a", code: "KeyA" });
    fireEvent.pointerDown(picker, { pointerId: 1 });
    expect(keyboard).not.toHaveBeenCalled();
    expect(pointer).not.toHaveBeenCalled();
    expect(SystemStore.getState().isMouseDown).toBe(false);
    fireEvent.keyDown(picker, { key: "Escape" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("keyup", keyboard);
    window.removeEventListener("pointerdown", pointer);
});

test("only the selected debug menu opens and closing preserves values", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const gi = screen.getByRole("button", { name: "Real-time GI: Off" });
    const ssao = screen.getByRole("button", { name: "SSAO: On" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(gi);
    expect(screen.getByRole("region", { name: "Real-time GI" })).toHaveAttribute("id", gi.getAttribute("aria-controls"));
    fireEvent.change(screen.getByRole("slider", { name: /GI strength/ }), { target: { value: 1.2 } });
    fireEvent.click(ssao);
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "SSAO" })).toBeInTheDocument();
    expect(gi).toHaveAttribute("aria-expanded", "false");
    expect(ssao).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(ssao);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(gi);
    expect(screen.getByRole("slider", { name: /GI strength/ })).toHaveValue("1.2");
    fireEvent.click(screen.getByRole("button", { name: "Close debug settings" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(gi);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(SystemStore.getState().viewerDebugSettings.giIntensity).toBe(1.2);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
});

test.each([
    ["Real-time GI: Off", "GI strength", "giIntensity", "1.25", 1.25, 0.7],
    ["Real-time GI: Off", "GI resolution", "giResolutionScale", "0.5", 0.5, null],
    ["SSAO: On", "SSAO strength", "ssaoIntensity", "1.2", 1.2, 2],
    ["SSAO: On", "SSAO radius", "ssaoRadius", "0.3", 0.3, 0.05],
    ["SSAO: On", "SSAO bias", "ssaoBias", "0.013", 0.013, 0.014],
    ["SSAO: On", "SSAO samples", "ssaoSamples", "31", 31, 49],
    ["SSAO: On", "SSAO resolution", "ssaoResolutionScale", "0.75", 0.75, 0.5],
    ["Bloom: Off", "Bloom strength", "bloomIntensity", "1.5", 1.5, 0.5],
    ["Bloom: Off", "Bloom threshold", "bloomThreshold", "1.25", 1.25, 2],
    ["Bloom: Off", "Bloom smoothing", "bloomSmoothing", "0.4", 0.4, 0.2],
    ["Bloom: Off", "Bloom radius", "bloomRadius", "0.8", 0.8, 0.5],
    ["Bloom: Off", "Bloom resolution", "bloomResolutionScale", "0.75", 0.75, 0.5],
    ["Shadows: On", "Shadow depth bias", "shadowBias", "-0.0005", -0.0005, null],
    ["Shadows: On", "Shadow normal bias", "shadowNormalBias", "0.025", 0.025, null],
    ["Shadows: On", "Shadow map resolution", "shadowMapSize", "3", 4096, null],
    ["Shadows: On", "Shadow softness", "shadowSoftness", "4.5", 4.5, 2],
    ["Shadows: On", "Sun shadow coverage", "shadowCoverage", "60", 60, 100],
    ["Show baked pvs", "PVS debug opacity", "pvsOpacity", "0.3", 0.3, 0.65],
    ["Anisotropic filtering: On", "Anisotropic samples", "anisotropy", "12", 12, 8],
])("%s updates %s live and resets only that panel", (button, label, key, input, expected, reset) => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = { ...SystemStore.getState().viewerDebugSettings };
    fireEvent.click(screen.getByRole("button", { name: button }));
    const slider = screen.getByRole("slider", { name: new RegExp(label) });
    expect(slider).toHaveAttribute("aria-valuetext", reset == null ? "Auto" : expect.stringContaining(String(reset)));
    fireEvent.change(slider, { target: { value: input } });
    expect(SystemStore.getState().viewerDebugSettings[key]).toBe(expected);
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining(String(expected)));
    expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, [key]: expected });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual(initialSettings);
    expect(slider).toHaveAttribute("aria-valuetext", reset == null ? "Auto" : expect.stringContaining(String(reset)));
    expect(SystemStore.getState().canvasEnabled).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("shadow softness supports hard edges and wider penumbrae", () => {
    expect(SystemStore.getInitialState().viewerDebugSettings.shadowSoftness).toBe(2);
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    fireEvent.click(screen.getByRole("button", { name: "Shadows: On" }));
    const slider = screen.getByRole("slider", { name: /Shadow softness/ });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "8");
    expect(slider).toHaveAttribute("step", "0.1");
    expect(slider).toHaveAttribute("aria-valuetext", "2°");
    for (const softness of [0, 8]) {
        fireEvent.change(slider, { target: { value: softness } });
        expect(SystemStore.getState().viewerDebugSettings.shadowSoftness).toBe(softness);
        expect(SystemStore.getState().shadowsEnabled).toBe(true);
        expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
        expect(canvas).toHaveAttribute("data-shadow-type", String(PCFShadowMap));
    }
});

test("sun shadow coverage adjusts live without recreating the canvas", () => {
    expect(SystemStore.getInitialState().viewerDebugSettings.shadowCoverage).toBe(100);
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const initialSettings = { ...SystemStore.getState().viewerDebugSettings };
    fireEvent.click(screen.getByRole("button", { name: "Shadows: On" }));
    const panel = screen.getByRole("region", { name: "Shadows" });
    const slider = screen.getByRole("slider", { name: /Sun shadow coverage/ });
    expect(slider).toHaveAttribute("min", "10");
    expect(slider).toHaveAttribute("max", "200");
    expect(slider).toHaveAttribute("step", "5");
    expect(slider).toHaveAttribute("aria-valuetext", "100%");
    expect(panel).toHaveTextContent("Smaller coverage narrows the shadow camera's width and height");
    for (const coverage of [10, 200]) {
        fireEvent.change(slider, { target: { value: coverage } });
        expect(SystemStore.getState().viewerDebugSettings).toEqual({ ...initialSettings, shadowCoverage: coverage });
        expect(slider).toHaveAttribute("aria-valuetext", `${coverage}%`);
        expect(SystemStore.getState().shadowsEnabled).toBe(true);
        expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
        expect(canvas).toHaveAttribute("data-shadow-type", String(PCFShadowMap));
    }
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDebugSettings).toEqual(initialSettings);
    expect(slider).toHaveAttribute("aria-valuetext", "100%");
});

test("DPR reset restores the original pixel ratio", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "DPR: 1" }));
    fireEvent.change(screen.getByRole("slider", { name: /Pixel ratio/ }), { target: { value: 2 } });
    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(SystemStore.getState().viewerDpr).toBe(1);
    expect(screen.getByRole("slider", { name: /Pixel ratio/ })).toHaveValue("1");
});

test("debug sliders isolate gameplay keys and pointer gestures", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "SSAO: On" }));
    const keyboard = jest.fn();
    const pointer = jest.fn();
    window.addEventListener("keydown", keyboard);
    window.addEventListener("keyup", keyboard);
    window.addEventListener("pointerdown", pointer);
    const slider = screen.getByRole("slider", { name: /SSAO radius/ });
    slider.focus();
    fireEvent.keyDown(slider, { key: "w", code: "KeyW" });
    fireEvent.keyUp(slider, { key: "w", code: "KeyW" });
    fireEvent.keyDown(slider, { key: "a", code: "KeyA" });
    fireEvent.pointerDown(slider, { pointerId: 1 });
    const arrow = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    fireEvent(slider, arrow);
    expect(arrow.defaultPrevented).toBe(false);
    expect(keyboard).not.toHaveBeenCalled();
    expect(pointer).not.toHaveBeenCalled();
    expect(SystemStore.getState().isMouseDown).toBe(false);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    fireEvent.keyDown(slider, { key: "Escape" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("keyup", keyboard);
    window.removeEventListener("pointerdown", pointer);
});

test("motion permission is requested directly from its dedicated button", () => {
    const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
    renderViewer();
    const sceneProps = SceneContainer.mock.calls[SceneContainer.mock.calls.length - 1][0];
    sceneProps.navigationRef.current = navigation;
    act(() => sceneProps.onGyroscopeStatusChange("permission_required"));
    const button = screen.getByRole("button", { name: "Enable gyroscope" });
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    expect(navigation.enableGyroscope).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(navigation.enableGyroscope).toHaveBeenCalledTimes(1);
    expect(navigation.recenterGyroscope).not.toHaveBeenCalled();
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
});

test("waiting and active motion states preserve the navigation reference", () => {
    renderViewer();
    const sceneProps = SceneContainer.mock.calls[SceneContainer.mock.calls.length - 1][0];
    const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
    sceneProps.navigationRef.current = navigation;
    act(() => sceneProps.onGyroscopeStatusChange("waiting"));
    expect(screen.getByRole("button", { name: "Waiting for motion…" })).toBeDisabled();
    act(() => sceneProps.onGyroscopeStatusChange("active"));
    fireEvent.click(screen.getByRole("button", { name: "Recenter view" }));
    expect(navigation.recenterGyroscope).toHaveBeenCalledTimes(1);
    expect(navigation.enableGyroscope).not.toHaveBeenCalled();
    expect(SceneContainer.mock.calls[SceneContainer.mock.calls.length - 1][0].navigationRef)
        .toBe(sceneProps.navigationRef);
    act(() => sceneProps.onGyroscopeStatusChange("inactive"));
    expect(screen.queryByRole("button", { name: "Recenter view" })).not.toBeInTheDocument();
});

test.each(["denied", "unavailable"])("%s motion explains the touch fallback", (status) => {
    renderViewer();
    const sceneProps = SceneContainer.mock.calls[SceneContainer.mock.calls.length - 1][0];
    act(() => sceneProps.onGyroscopeStatusChange(status));
    expect(screen.getByRole("status")).toHaveTextContent(
        "Use the left side to move and the right side to look."
    );
    expect(Boolean(screen.queryByRole("button", { name: "Enable gyroscope" }))).toBe(status === "denied");
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
});

test("page entry blocks scene controls until desktop dismissal finishes", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const requestPointerLock = jest.fn(() => true);
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = { requestPointerLock };
    const canvas = screen.getByTestId("viewer-canvas");
    expect(screen.getByRole("dialog", { name: "Controls" })).toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({
        inputBlocked: true, azertyMode: false, hideObjectsKey: "q",
    });
    expect(screen.queryByRole("group", { name: "Viewer controls" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Real-time GI: Off" }).parentElement)
        .toHaveAttribute("inert");
    const sceneKeydown = jest.fn();
    window.addEventListener("keydown", sceneKeydown);
    fireEvent.keyDown(window, { key: "q", code: "KeyQ" });
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    expect(sceneKeydown).not.toHaveBeenCalled();
    expect(SystemStore.getState().tutorialClosed).toBe(false);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(SystemStore.getState().tutorialClosed).toBe(true);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    expect(screen.getByRole("button", { name: "Hide objects" })).toBeEnabled();
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
    window.removeEventListener("keydown", sceneKeydown);
});

test.each([false, true])("keyboard layout maps align the tutorial, HUD, and controller: azerty=%s", async (azerty) => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    const keyboard = {
        getLayoutMap: jest.fn(async () => new Map([
            ["KeyW", azerty ? "z" : "w"], ["KeyA", azerty ? "q" : "a"],
        ])),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    };
    Object.defineProperty(navigator, "keyboard", { value: keyboard });
    // Start with the opposite language fallback to verify layout priority.
    Object.defineProperty(navigator, "language", { value: azerty ? "en-US" : "fr-FR" });
    SystemStore.setState({ tutorialClosed: false });
    const view = renderViewer();
    const movement = azerty ? "ZQSD" : "WASD";
    expect(await screen.findByText(`Use ${movement} to move`)).toBeInTheDocument();
    expect(screen.getByText(`You can hide objects with the '${azerty ? "A" : "Q"}' key`))
        .toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({
        azertyMode: azerty, hideObjectsKey: azerty ? "a" : "q",
    });
    expect(screen.getByRole("img", { name: "Keyboard movement controls" }))
        .toHaveAttribute("src", expect.stringContaining(`desktop-${azerty ? "zqsd" : "wasd"}-move.gif`));
    expect(screen.getByRole("img", { name: "Hide objects with the keyboard" }))
        .toHaveAttribute("src", expect.stringContaining(`desktop-${azerty ? "zqsd" : "wasd"}-chair.gif`));
    act(() => SystemStore.setState({ tutorialClosed: true }));
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute(
        "title", `Hide objects (${azerty ? "A" : "Q"})`
    );
    expect(screen.queryByText(azerty ? "A" : "Q")).not.toBeInTheDocument();
    view.unmount();
    expect(keyboard.removeEventListener).toHaveBeenCalledWith(
        "layoutchange", keyboard.addEventListener.mock.calls[0][1]
    );
});

test.each([false, true])("only the detected keyboard GIFs receive sources after pending detection: azerty=%s", async (azerty) => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    Object.defineProperty(navigator, "language", { value: azerty ? "en-US" : "fr-FR" });
    let resolveLayout;
    Object.defineProperty(navigator, "keyboard", { value: {
        getLayoutMap: jest.fn(() => new Promise((resolve) => { resolveLayout = resolve; })),
    } });
    const setAttribute = jest.spyOn(Element.prototype, "setAttribute");
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    expect(screen.getByRole("dialog", { name: "Controls" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Keyboard movement controls" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Hide objects with the keyboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mouse look controls" })).toBeInTheDocument();
    await act(async () => resolveLayout(new Map([
        ["KeyW", azerty ? "z" : "w"], ["KeyA", azerty ? "q" : "a"],
    ])));
    const selectedLayout = azerty ? "zqsd" : "wasd";
    expect(screen.getByRole("img", { name: "Keyboard movement controls" }))
        .toHaveAttribute("src", expect.stringContaining(`desktop-${selectedLayout}-move.gif`));
    expect(screen.getByRole("img", { name: "Hide objects with the keyboard" }))
        .toHaveAttribute("src", expect.stringContaining(`desktop-${selectedLayout}-chair.gif`));
    const otherLayout = azerty ? "wasd" : "zqsd";
    expect(setAttribute.mock.calls.some(([attribute, value]) => (
        attribute === "src" && String(value).includes(`desktop-${otherLayout}-`)
    ))).toBe(false);
});

test.each(["unavailable", "rejected", "unrecognized"])("%s keyboard detection uses the language fallback without blocking", async (reason) => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    Object.defineProperty(navigator, "language", { value: "fr-FR" });
    if (reason !== "unavailable") {
        Object.defineProperty(navigator, "keyboard", { value: {
            getLayoutMap: reason === "rejected"
                ? jest.fn(async () => { throw new Error("Keyboard permission denied"); })
                : jest.fn(async () => new Map()),
        } });
    }
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    expect(await screen.findByRole("img", { name: "Keyboard movement controls" }))
        .toHaveAttribute("src", expect.stringContaining("desktop-zqsd-move.gif"));
    expect(screen.getByRole("img", { name: "Hide objects with the keyboard" }))
        .toHaveAttribute("src", expect.stringContaining("desktop-zqsd-chair.gif"));
});

test("late keyboard detection cannot override a physical key learned during dismissal", async () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    let resolveLayout;
    Object.defineProperty(navigator, "keyboard", { value: {
        getLayoutMap: jest.fn(() => new Promise((resolve) => { resolveLayout = resolve; })),
    } });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = { requestPointerLock: jest.fn(() => true) };
    fireEvent.keyDown(window, { key: "q", code: "KeyA" });
    expect(SceneContainer.mock.calls.at(-1)[0].azertyMode).toBe(true);
    await act(async () => resolveLayout(new Map([["KeyW", "w"], ["KeyA", "a"]])));
    expect(SceneContainer.mock.calls.at(-1)[0].azertyMode).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute("title", "Hide objects (A)");
    expect(screen.queryByText("A")).not.toBeInTheDocument();
});

test("changing keyboard layouts withholds keyboard GIFs until the latest map resolves", async () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    let resolveLayout;
    const keyboard = {
        getLayoutMap: jest.fn()
            .mockResolvedValueOnce(new Map([["KeyW", "w"], ["KeyA", "a"]]))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveLayout = resolve; })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    };
    Object.defineProperty(navigator, "keyboard", { value: keyboard });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    expect(await screen.findByRole("img", { name: "Keyboard movement controls" }))
        .toHaveAttribute("src", expect.stringContaining("desktop-wasd-move.gif"));
    act(() => { keyboard.addEventListener.mock.calls[0][1](); });
    expect(screen.queryByRole("img", { name: "Keyboard movement controls" })).not.toBeInTheDocument();
    await act(async () => resolveLayout(new Map([["KeyW", "z"], ["KeyA", "q"]])));
    expect(screen.getByRole("img", { name: "Keyboard movement controls" }))
        .toHaveAttribute("src", expect.stringContaining("desktop-zqsd-move.gif"));
    expect(screen.getByRole("img", { name: "Hide objects with the keyboard" }))
        .toHaveAttribute("src", expect.stringContaining("desktop-zqsd-chair.gif"));
});

test("pending keyboard detection is safe after unmount in Strict Mode", async () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    const pendingLayouts = [];
    Object.defineProperty(navigator, "keyboard", { value: {
        getLayoutMap: jest.fn(() => new Promise((resolve) => { pendingLayouts.push(resolve); })),
    } });
    const setAttribute = jest.spyOn(Element.prototype, "setAttribute");
    SystemStore.setState({ tutorialClosed: false });
    const view = renderViewer(<React.StrictMode><SceneViewer /></React.StrictMode>);
    expect(screen.queryByRole("img", { name: "Keyboard movement controls" })).not.toBeInTheDocument();
    view.unmount();
    await act(async () => pendingLayouts.forEach((resolve) => (
        resolve(new Map([["KeyW", "z"], ["KeyA", "q"]]))
    )));
    expect(setAttribute.mock.calls.some(([attribute, value]) => (
        attribute === "src" && /desktop-(wasd|zqsd)-(move|chair)\.gif/.test(String(value))
    ))).toBe(false);
});

test("the first physical key can correct the keyboard fallback without moving", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = { requestPointerLock: jest.fn(() => true) };
    fireEvent.keyDown(window, { key: "q", code: "KeyA" });
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({
        azertyMode: true, hideObjectsKey: "a", inputBlocked: true,
    });
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute("title", "Hide objects (A)");
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
});

test.each([
    ["Real movement control.", "gyroscope"],
    ["Phone joystick control.", "dual_joystick"],
])("mobile selection activates %s and requests fullscreen before fading", async (title, mode) => {
    jest.useFakeTimers();
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const selection = screen.getByRole("button", { name: title });
    expect(selection).toBeDisabled();
    const cue = screen.getByTestId("tutorial-control-cue");
    const finger = screen.getByAltText("");
    expect(finger).toHaveAttribute("src", expect.stringContaining("textures/pointed_finger.png"));
    expect(selection).toHaveClass("tutorial-control-choice");
    expect(screen.getByRole("status")).toHaveTextContent("Loading controls...");
    const navigation = { enableGyroscope: jest.fn(), recenterGyroscope: jest.fn() };
    const sceneProps = SceneContainer.mock.calls.at(-1)[0];
    sceneProps.navigationRef.current = navigation;
    act(() => sceneProps.onGyroscopeStatusChange("permission_required"));
    expect(selection).toBeEnabled();
    expect(screen.getByTestId("tutorial-control-cue")).toBe(cue);
    expect(screen.getByAltText("")).toBe(finger);
    fireEvent.click(selection);
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({
        touchNavigationMode: mode, inputBlocked: true,
    });
    expect(navigation.enableGyroscope).toHaveBeenCalledTimes(mode === "gyroscope" ? 1 : 0);
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(viewerRoot.requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
    expect(selection).toBeDisabled();
    expect(selection).not.toHaveClass("tutorial-control-choice");
    expect(screen.queryByTestId("tutorial-control-cue")).not.toBeInTheDocument();
    changeFullscreen(viewerRoot);
    await act(async () => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Hide objects" })).toBeEnabled();
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("mobile orientation keeps only the two navigation tutorial cards", () => {
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const tutorial = within(screen.getByRole("dialog"));
    expect(tutorial.getAllByRole("button")).toHaveLength(2);
    expect(tutorial.getAllByRole("img")).toHaveLength(2);
    expect(tutorial.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(tutorial.queryByRole("img", { name: "Use the chair icon to hide objects" })).not.toBeInTheDocument();
    fireEvent.click(tutorial.getByRole("heading", { name: "Choose your controls." }));
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    Object.assign(window, { innerWidth: 844, innerHeight: 390 });
    fireEvent(window, new Event("orientationchange"));
    expect(tutorial.getAllByRole("button")).toHaveLength(2);
    expect(tutorial.getAllByRole("img")).toHaveLength(2);
    expect(tutorial.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(tutorial.queryByRole("img", { name: "Use the chair icon to hide objects" })).not.toBeInTheDocument();
    expect(tutorial.getByRole("img", { name: "Move your phone to look around" }))
        .toHaveAttribute("src", expect.stringContaining("mobile-gyro-landscape-look.gif"));
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();

    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
    fireEvent(window, new Event("orientationchange"));
    expect(tutorial.getAllByRole("button")).toHaveLength(2);
    expect(tutorial.getAllByRole("img")).toHaveLength(2);
    expect(tutorial.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(tutorial.queryByRole("img", { name: "Use the chair icon to hide objects" })).not.toBeInTheDocument();
    expect(tutorial.getByRole("img", { name: "Move your phone to look around" }))
        .toHaveAttribute("src", expect.stringContaining("mobile-gyro-portrait-look.gif"));
    fireEvent.click(tutorial.getByRole("heading", { name: "Choose your controls." }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
});

test("selection in existing fullscreen does not exit it", async () => {
    jest.useFakeTimers();
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const sceneProps = SceneContainer.mock.calls.at(-1)[0];
    sceneProps.navigationRef.current = { enableGyroscope: jest.fn() };
    act(() => sceneProps.onGyroscopeStatusChange("unavailable"));
    changeFullscreen(viewerRoot);
    fireEvent.click(screen.getByRole("button", { name: "Phone joystick control." }));
    act(() => jest.advanceTimersByTime(300));
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
    expect(document.exitFullscreen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled());
});

test("fullscreen rejection does not trap mobile users in the tutorial", async () => {
    jest.useFakeTimers();
    viewerRoot.requestFullscreen.mockRejectedValueOnce(new Error("Browser denied fullscreen"));
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const sceneProps = SceneContainer.mock.calls.at(-1)[0];
    sceneProps.navigationRef.current = { enableGyroscope: jest.fn() };
    act(() => sceneProps.onGyroscopeStatusChange("unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Phone joystick control." }));
    await act(async () => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Could not enter fullscreen. Please try again.")).toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0]).toMatchObject({
        inputBlocked: false, touchNavigationMode: "dual_joystick",
    });
});

test("HUD chair actions and loader notifications keep visibility in sync", () => {
    const toggle = jest.fn();
    window.addEventListener("housemaker-toggle-objects", toggle);
    renderViewer();
    const chair = screen.getByRole("button", { name: "Hide objects" });
    expect(chair).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chair);
    expect(toggle).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new CustomEvent("housemaker-objects-visibility-change", {
        detail: { hidden: true },
    })));
    expect(screen.getByRole("button", { name: "Show objects" })).toHaveAttribute("aria-pressed", "true");
    window.removeEventListener("housemaker-toggle-objects", toggle);
});

test.each(["click", "key"])("desktop %s captures the pointer before fading without leaking input", (input) => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const navigation = { requestPointerLock: jest.fn(() => true) };
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = navigation;
    if (input === "click") fireEvent.click(screen.getByRole("dialog"));
    else fireEvent.keyDown(window, { key: "w", code: "KeyW" });
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(SystemStore.getState().tutorialClosed).toBe(false);
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(true);
    fireEvent.keyDown(window, { key: "w", code: "KeyW" });
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
    pointerLockElement = canvas;
    fireEvent(document, new Event("pointerlockchange"));
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
    pointerLockElement = null;
    fireEvent(document, new Event("pointerlockchange"));
    act(() => jest.advanceTimersByTime(1000));
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("desktop dismissal waits for the controller bridge instead of losing activation", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    fireEvent.click(screen.getByRole("dialog"));
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(SystemStore.getState().tutorialClosed).toBe(false);
    const navigation = { requestPointerLock: jest.fn(() => true) };
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = navigation;
    fireEvent.click(screen.getByRole("dialog"));
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Escape during the desktop fade releases the mouse without locking again", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const navigation = { requestPointerLock: jest.fn(() => true) };
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = navigation;
    fireEvent.click(screen.getByRole("dialog"));
    pointerLockElement = screen.getByTestId("viewer-canvas");
    fireEvent(document, new Event("pointerlockchange"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
    pointerLockElement = null;
    fireEvent(document, new Event("pointerlockchange"));
    act(() => jest.advanceTimersByTime(1000));
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test.each(["unavailable", "native error"])("%s pointer lock leaves desktop controls recoverable", (reason) => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    SystemStore.setState({ tutorialClosed: false });
    renderViewer();
    const navigation = { requestPointerLock: jest.fn(() => reason !== "unavailable") };
    SceneContainer.mock.calls.at(-1)[0].navigationRef.current = navigation;
    fireEvent.click(screen.getByRole("dialog"));
    if (reason === "native error") fireEvent(document, new Event("pointerlockerror"));
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status"))
        .toHaveTextContent("Mouse control could not start. Click the scene to try again.");
    expect(SceneContainer.mock.calls.at(-1)[0].inputBlocked).toBe(false);
    pointerLockElement = screen.getByTestId("viewer-canvas");
    fireEvent(document, new Event("pointerlockchange"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(navigation.requestPointerLock).toHaveBeenCalledTimes(1);
});

test("desktop Exit hint releases only this viewer's pointer lock", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    renderViewer();
    const exit = screen.getByRole("button", { name: "Exit" });
    expect(exit).toHaveTextContent("Exit");
    expect(screen.getByRole("img", { name: "Escape key" }))
        .toHaveAttribute("src", expect.stringContaining("/textures/key_esc.png"));
    fireEvent.click(exit);
    expect(document.exitPointerLock).not.toHaveBeenCalled();
    pointerLockElement = document.body;
    fireEvent.click(exit);
    expect(document.exitPointerLock).not.toHaveBeenCalled();
    pointerLockElement = screen.getByTestId("viewer-canvas");
    fireEvent.click(exit);
    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
    expect(document.exitFullscreen).not.toHaveBeenCalled();
});

test("Strict Mode cleans desktop pointer-lock status listeners", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    const added = jest.spyOn(document, "addEventListener");
    const removed = jest.spyOn(document, "removeEventListener");
    const view = renderViewer(<React.StrictMode><SceneViewer /></React.StrictMode>);
    view.unmount();
    for (const type of ["pointerlockchange", "pointerlockerror"]) {
        const listeners = added.mock.calls.filter(([name]) => name === type);
        expect(listeners.length).toBeGreaterThan(0);
        expect(removed.mock.calls.filter(([name]) => name === type)).toHaveLength(listeners.length);
    }
});
