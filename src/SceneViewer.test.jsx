/* eslint-disable testing-library/no-node-access */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SceneViewer from "./SceneViewer";
import { SceneContainer } from "./SceneContainer";
import SystemStore from "./SystemStore";
import UserStore from "./UserStore";

// Keep browser fullscreen tests independent of WebGL and overlays.
jest.mock("@react-three/fiber", () => ({
    Canvas: ({ children, dpr }) => <div data-testid="viewer-canvas" data-dpr={dpr}>{children}</div>,
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
            realTimeGiEnabled: true,
            showBakedPvs: false,
            anisotropicFilteringEnabled: false,
            viewerDpr: 1,
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

test("GI comparison toggles without replacing the canvas or disabling it", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const button = screen.getByRole("button", { name: "Real-time GI: On" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(SystemStore.getState().realTimeGiEnabled).toBe(false);
    expect(screen.getByRole("button", { name: "Real-time GI: Off" }))
        .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    expect(SystemStore.getState().canvasEnabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Real-time GI: Off" }));
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

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
    expect(screen.getByRole("button", { name: "Real-time GI: On" })).toBeEnabled();
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
        .toBe(screen.getByRole("button", { name: "Real-time GI: On" }).previousElementSibling);
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

test("PVS debug button follows GI and toggles without changing lighting or canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const giButton = screen.getByRole("button", { name: "Real-time GI: On" });
    const debugButton = screen.getByRole("button", { name: "Show baked pvs" });
    expect(giButton.nextElementSibling).toBe(debugButton);
    expect(debugButton).toHaveAttribute("aria-pressed", "false");
    expect(debugButton.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(debugButton);
    expect(SystemStore.getState().showBakedPvs).toBe(true);
    expect(screen.getByRole("button", { name: "Hide baked pvs" })).toHaveAttribute("aria-pressed", "true");
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Hide baked pvs" }));
    expect(SystemStore.getState().showBakedPvs).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("anisotropic filtering toggles without changing lighting, DPR, or canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    const button = screen.getByRole("button", { name: "Anisotropic filtering: Off" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(true);
    expect(screen.getByRole("button", { name: "Anisotropic filtering: On" })).toHaveAttribute("aria-pressed", "true");
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(SystemStore.getState().viewerDpr).toBe(1);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Anisotropic filtering: On" }));
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(false);
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
});

test("DPR cycles through quality levels without replacing the canvas", () => {
    renderViewer();
    const canvas = screen.getByTestId("viewer-canvas");
    expect(canvas).toHaveAttribute("data-dpr", "1");
    for (const [current, next] of [[1, 1.25], [1.25, 1.5], [1.5, 2], [2, 1]]) {
        const button = screen.getByRole("button", { name: `DPR: ${current}` });
        expect(button.closest('[data-viewer-control="true"]')).toBeInTheDocument();
        fireEvent.click(button);
        expect(SystemStore.getState().viewerDpr).toBe(next);
        expect(screen.getByRole("button", { name: `DPR: ${next}` })).toBeEnabled();
        expect(screen.getByTestId("viewer-canvas")).toBe(canvas);
        expect(canvas).toHaveAttribute("data-dpr", String(next));
    }
    expect(SystemStore.getState().realTimeGiEnabled).toBe(true);
    expect(SystemStore.getState().anisotropicFilteringEnabled).toBe(false);
    expect(SystemStore.getState().canvasEnabled).toBe(true);
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
    expect(screen.getByRole("button", { name: "Real-time GI: On" }).parentElement)
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
