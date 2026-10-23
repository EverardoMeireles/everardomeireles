import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import config from "../config.js";
import { TutorialStyles } from "../Styles.jsx";
import { Tutorial } from "./Tutorial.jsx";

const originalViewport = { width: window.innerWidth, height: window.innerHeight };

// Resize through the same event used by responsive layouts.
function setViewport(width, height) {
    Object.defineProperties(window, {
        innerWidth: { configurable: true, value: width },
        innerHeight: { configurable: true, value: height }
    });
    fireEvent(window, new Event("resize"));
}

beforeEach(() => {
    jest.useFakeTimers();
    setViewport(1440, 900);
});

afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    setViewport(originalViewport.width, originalViewport.height);
});

test("introduces QWERTY desktop controls with three authored illustrations", () => {
    render(<Tutorial />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { level: 1, name: "Controls" }))
        .toHaveStyle({ fontSize: "37px", textAlign: "center" });
    expect(TutorialStyles.card.textAlign).toBe("center");
    expect(screen.getByRole("heading", { name: "Hide objects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Look around" })).toBeInTheDocument();
    expect(screen.getByText("You can hide objects with the 'Q' key")).toBeInTheDocument();
    expect(screen.getByText("Use WASD to move")).toBeInTheDocument();
    expect(screen.getByText("Use the mouse to look around")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByAltText("Hide objects with the keyboard")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-wasd-chair.gif`);
    expect(screen.getByAltText("Keyboard movement controls")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-wasd-move.gif`);
    expect(screen.getByAltText("Mouse look controls")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-look.gif`);
    expect(screen.getByAltText("Mouse look controls")).toHaveStyle({ maxHeight: "460px", width: "100%" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("uses AZERTY copy and matching chair and movement GIFs", () => {
    const { rerender } = render(<Tutorial />);
    rerender(<Tutorial azertyMode />);
    expect(screen.getByText("You can hide objects with the 'A' key")).toBeInTheDocument();
    expect(screen.getByText("Use ZQSD to move")).toBeInTheDocument();
    expect(screen.getByAltText("Keyboard movement controls")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-zqsd-move.gif`);
    expect(screen.getByAltText("Hide objects with the keyboard")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-zqsd-chair.gif`);
});

test.each([false, true])("waits for keyboard detection before mounting layout GIFs: AZERTY=%s", (azertyMode) => {
    const { rerender } = render(<Tutorial keyboardLayoutReady={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Controls" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading keyboard controls...");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByAltText("Mouse look controls")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-look.gif`);
    expect(screen.queryByAltText("Hide objects with the keyboard")).not.toBeInTheDocument();
    expect(screen.queryByAltText("Keyboard movement controls")).not.toBeInTheDocument();
    expect(screen.queryByText(/You can hide objects with/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Use (WASD|ZQSD) to move/)).not.toBeInTheDocument();
    rerender(<Tutorial keyboardLayoutReady={false} azertyMode={azertyMode} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    rerender(<Tutorial keyboardLayoutReady azertyMode={azertyMode} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    const layout = azertyMode ? "zqsd" : "wasd";
    expect(screen.getByAltText("Hide objects with the keyboard")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-${layout}-chair.gif`);
    expect(screen.getByAltText("Keyboard movement controls")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/desktop-${layout}-move.gif`);
    expect(screen.getByText(`You can hide objects with the '${azertyMode ? "A" : "Q"}' key`)).toBeInTheDocument();
    expect(screen.getByText(`Use ${azertyMode ? "ZQSD" : "WASD"} to move`)).toBeInTheDocument();
});

test.each(["keydown", "pointerdown", "click"])("desktop %s fades before closing and consumes gameplay input", (type) => {
    const onClose = jest.fn();
    const gameplayInput = jest.fn();
    render(<Tutorial onClose={onClose} />);
    window.addEventListener(type, gameplayInput);
    const event = new Event(type, { bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(gameplayInput).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "0", transition: "opacity 300ms ease" });
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(299));
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener(type, gameplayInput);
});

test.each(["keydown", "pointerdown", "click"])("desktop %s starts navigation inside the gesture before fading", (type) => {
    const onClose = jest.fn();
    const onDesktopStart = jest.fn(() => {
        expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
        expect(jest.getTimerCount()).toBe(0);
        return true;
    });
    render(<Tutorial onDesktopStart={onDesktopStart} onClose={onClose} />);
    fireEvent(window, new Event(type, { bubbles: true, cancelable: true }));
    expect(onDesktopStart).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "0" });
    act(() => jest.advanceTimersByTime(299));
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("a controller that is not ready leaves the tutorial open for another gesture", () => {
    const onDesktopStart = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const onClose = jest.fn();
    render(<Tutorial onDesktopStart={onDesktopStart} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDesktopStart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDesktopStart).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "0" });
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test.each([
    { key: "Escape" }, { key: "Shift" }, { key: "Control" }, { key: "Alt" },
    { key: "Meta" }, { key: "AltGraph" }, { key: "ContextMenu" },
    { key: "F1" }, { key: "F5" }, { key: "F11" },
    { key: "r", ctrlKey: true }, { key: "r", metaKey: true }, { key: "ArrowLeft", altKey: true }
])("browser key $key never starts navigation or dismisses the tutorial", (keyboard) => {
    const onDesktopStart = jest.fn();
    const onClose = jest.fn();
    render(<Tutorial onDesktopStart={onDesktopStart} onClose={onClose} />);
    const event = new KeyboardEvent("keydown", { ...keyboard, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
    expect(onDesktopStart).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
});

test("wheel input remains scrollable without starting navigation", () => {
    const onDesktopStart = jest.fn();
    const onClose = jest.fn();
    render(<Tutorial onDesktopStart={onDesktopStart} onClose={onClose} />);
    const event = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("dialog"), event);
    expect(event.defaultPrevented).toBe(false);
    expect(onDesktopStart).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
});

test.each([1, 2])("mouse button %s cannot start navigation", (button) => {
    const onDesktopStart = jest.fn();
    render(<Tutorial onDesktopStart={onDesktopStart} />);
    fireEvent(window, new MouseEvent("pointerdown", { button, bubbles: true, cancelable: true }));
    fireEvent.click(window, { button });
    expect(onDesktopStart).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    expect(jest.getTimerCount()).toBe(0);
});

test("mouse movement never dismisses the desktop tutorial", () => {
    const onClose = jest.fn();
    const onDesktopStart = jest.fn();
    render(<Tutorial onClose={onClose} onDesktopStart={onDesktopStart} />);
    fireEvent(window, new MouseEvent("pointermove", { clientX: 20, clientY: 30, cancelable: true }));
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    fireEvent(window, new MouseEvent("pointermove", { clientX: 20, clientY: 30, cancelable: true }));
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    fireEvent(window, new MouseEvent("pointermove", { clientX: 21, clientY: 30, cancelable: true }));
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseMove(screen.getByRole("dialog"), { movementX: 100, movementY: 50 });
    act(() => jest.advanceTimersByTime(1000));
    expect(onClose).not.toHaveBeenCalled();
    expect(onDesktopStart).not.toHaveBeenCalled();
    expect(screen.getByText("Press any key or click to begin.")).toBeInTheDocument();
});

test("repeated desktop input cannot schedule duplicate close callbacks", () => {
    const onClose = jest.fn();
    const onDesktopStart = jest.fn(() => true);
    render(<Tutorial onClose={onClose} onDesktopStart={onDesktopStart} />);
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.pointerDown(window);
    fireEvent.click(window);
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(window, escape);
    expect(escape.defaultPrevented).toBe(false);
    act(() => jest.advanceTimersByTime(1000));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDesktopStart).toHaveBeenCalledTimes(1);
});

test("portrait mobile presents navigation choices without an object-hiding section", () => {
    setViewport(360, 640);
    const onSelectControl = jest.fn();
    render(<Tutorial isTouchDevice keyboardLayoutReady={false} onSelectControl={onSelectControl} />);
    expect(screen.getByRole("heading", { level: 1, name: "Choose your controls." }))
        .toHaveStyle({ fontSize: "25px", textAlign: "center" });
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Real movement control." })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Phone joystick control." })).toBeEnabled();
    expect(screen.getByText("Move your phone to look around")).toBeInTheDocument();
    expect(screen.getByText("Use your left thumb to move and your right thumb to look around.")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByAltText("Move your phone to look around")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-gyro-portrait-look.gif`);
    expect(screen.queryByAltText("Use the screen joystick to move")).not.toBeInTheDocument();
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-dual-portrait-controls.gif`);
    expect(screen.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Use the chair icon to hide objects")).not.toBeInTheDocument();
    expect(screen.getByAltText("Move your phone to look around")).toHaveStyle({ maxHeight: "220px" });
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toHaveStyle({ maxHeight: "440px" });
    fireEvent.click(screen.getByRole("heading", { level: 1, name: "Choose your controls." }));
    act(() => jest.advanceTimersByTime(300));
    expect(onSelectControl).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
});

test.each([
    [360, 640, 2],
    [844, 390, 2]
])("mobile %s×%s shows a decorative, noninteractive selection cue", (width, height, imageCount) => {
    setViewport(width, height);
    const onSelectControl = jest.fn();
    const onClose = jest.fn();
    render(<Tutorial isTouchDevice onSelectControl={onSelectControl} onClose={onClose} />);
    expect(screen.getByTestId("tutorial-control-cue")).toHaveStyle({ pointerEvents: "none", overflow: "hidden" });
    const finger = screen.getByAltText("");
    expect(finger).toHaveAttribute("src", `${config.resource_path}/textures/pointed_finger.png`);
    expect(finger).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByAltText("")).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(imageCount);
    expect(screen.getByRole("button", { name: "Real movement control." })).toHaveClass("tutorial-control-choice");
    expect(screen.getByRole("button", { name: "Phone joystick control." })).toHaveClass("tutorial-control-choice");
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(12000));
    expect(onSelectControl).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});

test("desktop never mounts the mobile finger asset", () => {
    render(<Tutorial />);
    expect(screen.queryByTestId("tutorial-control-cue")).not.toBeInTheDocument();
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
});

test("the mobile cue starts before controls and survives readiness changes without restarting", () => {
    const onSelectControl = jest.fn();
    const { rerender } = render(<Tutorial isTouchDevice controlsReady={false} onSelectControl={onSelectControl} />);
    const cue = screen.getByTestId("tutorial-control-cue");
    const finger = screen.getByAltText("");
    const gyroGif = screen.getByAltText("Move your phone to look around");
    const joystickGif = screen.getByAltText("Move with the left thumb and look with the right thumb");
    const gyroChoice = screen.getByRole("button", { name: "Real movement control." });
    const joystickChoice = screen.getByRole("button", { name: "Phone joystick control." });
    expect(TutorialStyles.mobileGrid).toMatchObject({ "--tutorial-cue-duration": "8s", "--tutorial-cue-delay": "-1s" });
    expect(TutorialStyles.controlCueTrack).toMatchObject({ left: "37.5%", top: "6px", width: "25%", animationDelay: "var(--tutorial-cue-delay)" });
    expect(finger).toHaveStyle({ opacity: "0.5", animationDelay: "var(--tutorial-cue-delay)" });
    expect(finger).toHaveAttribute("src", `${config.resource_path}/textures/pointed_finger.png`);
    expect(gyroChoice).toBeDisabled();
    expect(joystickChoice).toBeDisabled();
    expect(gyroChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-gyro");
    expect(joystickChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-joystick");
    expect(screen.getByRole("status")).toHaveTextContent("Loading controls...");
    fireEvent.click(gyroChoice);
    expect(onSelectControl).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
    rerender(<Tutorial isTouchDevice controlsReady onSelectControl={onSelectControl} />);
    expect(screen.getByTestId("tutorial-control-cue")).toBe(cue);
    expect(screen.getByAltText("")).toBe(finger);
    expect(screen.getByAltText("Move your phone to look around")).toBe(gyroGif);
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toBe(joystickGif);
    expect(screen.getByRole("button", { name: "Real movement control." })).toBe(gyroChoice);
    expect(screen.getByRole("button", { name: "Phone joystick control." })).toBe(joystickChoice);
    expect(gyroChoice).toBeEnabled();
    expect(joystickChoice).toBeEnabled();
    expect(gyroChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-gyro");
    expect(joystickChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-joystick");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<Tutorial isTouchDevice controlsReady={false} onSelectControl={onSelectControl} />);
    expect(screen.getByTestId("tutorial-control-cue")).toBe(cue);
    expect(screen.getByAltText("")).toBe(finger);
    expect(screen.getByAltText("Move your phone to look around")).toBe(gyroGif);
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toBe(joystickGif);
    expect(gyroChoice).toBeDisabled();
    expect(joystickChoice).toBeDisabled();
    expect(gyroChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-gyro");
    expect(joystickChoice).toHaveClass("tutorial-control-choice", "tutorial-control-choice-joystick");
    expect(screen.getByRole("status")).toHaveTextContent("Loading controls...");
    expect(onSelectControl).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});

test("mobile illustrations follow live portrait and landscape changes", () => {
    setViewport(360, 640);
    render(<Tutorial isTouchDevice />);
    act(() => setViewport(844, 390));
    expect(screen.getByAltText("Move your phone to look around")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-gyro-landscape-look.gif`);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByAltText("Use the screen joystick to move")).not.toBeInTheDocument();
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-dual-landscape-controls.gif`);
    expect(screen.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Use the chair icon to hide objects")).not.toBeInTheDocument();
    expect(screen.getByAltText("Move your phone to look around")).toHaveStyle({ maxHeight: "190px", width: "100%" });
    expect(screen.getByAltText("Move with the left thumb and look with the right thumb")).toHaveStyle({ maxHeight: "190px" });
    act(() => setViewport(390, 844));
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Use the chair icon to hide objects")).not.toBeInTheDocument();
    expect(screen.getByAltText("Move your phone to look around")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-gyro-portrait-look.gif`);
});

test.each([
    [360, 640, "25px"],
    [844, 390, "24px"]
])("mobile %s×%s starts with navigation choices only", (width, height, fontSize) => {
    setViewport(width, height);
    render(<Tutorial isTouchDevice />);
    expect(screen.getByRole("heading", { level: 1, name: "Choose your controls." }))
        .toHaveStyle({ fontSize, textAlign: "center" });
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Real movement control." })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Phone joystick control." })).toBeEnabled();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Hide objects" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Use the chair icon to hide objects")).not.toBeInTheDocument();
});

test("orientation events update illustrations even before a resize event", () => {
    setViewport(360, 640);
    render(<Tutorial isTouchDevice />);
    Object.defineProperties(window, {
        innerWidth: { configurable: true, value: 844 },
        innerHeight: { configurable: true, value: 390 }
    });
    fireEvent(window, new Event("orientationchange"));
    expect(screen.getByAltText("Move your phone to look around")).toHaveAttribute("src", `${config.resource_path}/textures/Tutorial/mobile-gyro-landscape-look.gif`);
});

test.each([
    ["Real movement control.", "gyroscope"],
    ["Phone joystick control.", "dual_joystick"]
])("selecting %s activates controls synchronously before the fade ends", (name, mode) => {
    const onSelectControl = jest.fn();
    const onDesktopStart = jest.fn();
    const onClose = jest.fn();
    render(<Tutorial isTouchDevice onSelectControl={onSelectControl} onDesktopStart={onDesktopStart} onClose={onClose} />);
    expect(screen.getByTestId("tutorial-control-cue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(onSelectControl).toHaveBeenCalledTimes(1);
    expect(onSelectControl).toHaveBeenCalledWith(mode);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "0" });
    expect(screen.getAllByRole("button").every((button) => button.disabled)).toBe(true);
    expect(screen.queryByTestId("tutorial-control-cue")).not.toBeInTheDocument();
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Real movement control." })).not.toHaveClass("tutorial-control-choice");
    expect(screen.getByRole("button", { name: "Phone joystick control." })).not.toHaveClass("tutorial-control-choice");
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDesktopStart).not.toHaveBeenCalled();
    expect(onSelectControl.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
});

test("mobile input outside a control choice does not dismiss the tutorial", () => {
    const onClose = jest.fn();
    render(<Tutorial isTouchDevice onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.wheel(window);
    act(() => jest.advanceTimersByTime(1000));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveStyle({ opacity: "1" });
});

test("control choices remain disabled until the controller is ready", () => {
    const onSelectControl = jest.fn();
    const { rerender } = render(<Tutorial isTouchDevice controlsReady={false} onSelectControl={onSelectControl} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading controls...");
    expect(screen.getAllByRole("button").every((button) => button.disabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Real movement control." }));
    expect(onSelectControl).not.toHaveBeenCalled();
    rerender(<Tutorial isTouchDevice controlsReady onSelectControl={onSelectControl} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Real movement control." }));
    expect(onSelectControl).toHaveBeenCalledWith("gyroscope");
});

test("rerenders use the latest close callback without restarting the fade", () => {
    const firstClose = jest.fn();
    const latestClose = jest.fn();
    const { rerender } = render(<Tutorial onClose={firstClose} />);
    fireEvent.keyDown(window, { key: "Enter" });
    act(() => jest.advanceTimersByTime(200));
    rerender(<Tutorial onClose={latestClose} />);
    act(() => jest.advanceTimersByTime(100));
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledTimes(1);
});

test("desktop start callback updates do not restart or retry a pending fade", () => {
    const firstStart = jest.fn(() => false);
    const readyStart = jest.fn(() => true);
    const laterStart = jest.fn(() => true);
    const onClose = jest.fn();
    const { rerender } = render(<Tutorial onDesktopStart={firstStart} onClose={onClose} />);
    rerender(<Tutorial onDesktopStart={readyStart} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(firstStart).not.toHaveBeenCalled();
    expect(readyStart).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(200));
    rerender(<Tutorial onDesktopStart={laterStart} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "w" });
    act(() => jest.advanceTimersByTime(100));
    expect(laterStart).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("Strict Mode and unmount clean listeners and pending fades", () => {
    const onClose = jest.fn();
    const { unmount } = render(<React.StrictMode><Tutorial onClose={onClose} /></React.StrictMode>);
    fireEvent.keyDown(window, { key: "Enter" });
    unmount();
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
    const gameplayInput = jest.fn();
    window.addEventListener("keydown", gameplayInput);
    const event = new KeyboardEvent("keydown", { key: "w", cancelable: true });
    fireEvent(window, event);
    expect(gameplayInput).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    window.removeEventListener("keydown", gameplayInput);
});

test("unmount also cancels the mobile selection fade", () => {
    const onClose = jest.fn();
    const { unmount } = render(<Tutorial isTouchDevice onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Phone joystick control." }));
    unmount();
    act(() => jest.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
});
