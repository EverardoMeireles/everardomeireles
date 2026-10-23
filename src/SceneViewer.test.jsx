/* eslint-disable testing-library/no-node-access */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SceneViewer from "./SceneViewer";
import { SceneContainer } from "./SceneContainer";
import SystemStore from "./SystemStore";
import UserStore from "./UserStore";

// Keep browser fullscreen tests independent of WebGL and overlays.
jest.mock("@react-three/fiber", () => ({
    Canvas: ({ children }) => <div data-testid="viewer-canvas">{children}</div>,
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
jest.mock("./system_components/TutorialOverlay", () => ({ TutorialOverlay: () => null }));
jest.mock("./system_components/TwoDSplashScreen.jsx", () => ({ TwoDSplashScreen: () => null }));
jest.mock("react-router-dom", () => ({
    BrowserRouter: ({ children }) => <>{children}</>,
    Routes: ({ children }) => <>{children}</>,
    Route: ({ path, element }) => path === "*" ? element : null,
}));

let viewerRoot;
let fullscreenElement;
let webkitFullscreenElement;
const originalTouchPoints = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
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
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => ({ matches: false })),
    });
    fullscreenElement = null;
    webkitFullscreenElement = null;
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
    Object.assign(window, originalViewport);
    [
        "fullscreenElement", "webkitFullscreenElement", "fullscreenEnabled",
        "webkitFullscreenEnabled", "exitFullscreen", "webkitExitFullscreen",
    ].forEach((property) => { delete document[property]; });
    viewerRoot.remove();
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
    expect(screen.getByTestId("viewer-canvas")).toBe(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    changeFullscreen(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled());
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
    expect(screen.queryByRole("button", { name: /fullscreen/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Real-time GI: On" })).toBeEnabled();
    expect(viewerRoot.requestFullscreen).not.toHaveBeenCalled();
});

test("coarse-pointer devices retain fullscreen entry without touch-point reporting", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    window.matchMedia.mockReturnValue({ matches: true });
    renderViewer();
    expect(window.matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
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

test("desktop viewers can still exit externally entered fullscreen", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    renderViewer();
    changeFullscreen(viewerRoot);
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeEnabled();
    changeFullscreen(null);
    expect(screen.queryByRole("button", { name: /fullscreen/i })).not.toBeInTheDocument();
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
