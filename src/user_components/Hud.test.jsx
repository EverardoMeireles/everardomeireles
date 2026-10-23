import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hud } from "./Hud.jsx";
import config from "../config.js";

test("shows a clean desktop label and keeps the shortcut tooltip", () => {
    const toggleObjects = jest.fn();
    render(<Hud hideObjectsKey="q" onToggleObjects={toggleObjects} />);

    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Hide objects" }))
        .toHaveTextContent(/^Hide objects$/);
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveAttribute("title", "Hide objects (Q)");
    expect(screen.queryByText("Q")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Object visibility keyboard shortcut" })).toHaveAttribute(
        "src", `${config.resource_path}/textures/key_a.png`
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide objects" }));
    expect(toggleObjects).toHaveBeenCalledTimes(1);
});

test("stacks desktop Exit above the object shortcut", () => {
    const exitControls = jest.fn();
    const toggleObjects = jest.fn();
    render(<Hud onExitControls={exitControls} onToggleObjects={toggleObjects} />);

    expect(screen.getByRole("group", { name: "Viewer controls" })).toHaveStyle({ flexDirection: "column" });
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Exit");
    expect(screen.getAllByRole("button")[1]).toHaveAccessibleName("Hide objects");
    const escapeIcon = screen.getByRole("img", { name: "Escape key" });
    expect(escapeIcon).toHaveAttribute("src", `${config.resource_path}/textures/key_esc.png`);
    expect(escapeIcon).toHaveStyle({ width: "57.6px", height: "57.6px" });
    expect(escapeIcon).toHaveAttribute("draggable", "false");
    expect(screen.getByText("Exit")).toHaveStyle({ flex: "1", textAlign: "center" });

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(exitControls).toHaveBeenCalledTimes(1);
    expect(toggleObjects).not.toHaveBeenCalled();
});

test("uses a readable Esc fallback when its artwork is missing", () => {
    const exitControls = jest.fn();
    render(<Hud onExitControls={exitControls} />);

    fireEvent.error(screen.getByRole("img", { name: "Escape key" }));
    expect(screen.queryByRole("img", { name: "Escape key" })).not.toBeInTheDocument();
    expect(screen.getByText("Esc")).toHaveStyle({ width: "57.6px", height: "57.6px" });
    expect(screen.getByRole("img", { name: "Object visibility keyboard shortcut" })).toHaveAttribute(
        "src", `${config.resource_path}/textures/key_a.png`
    );
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(exitControls).toHaveBeenCalledTimes(1);
});

test("reflects objects hidden by any input", () => {
    render(<Hud objectsHidden />);

    expect(screen.getByRole("button", { name: "Show objects" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show objects" })).toHaveTextContent(/^Show objects$/);
    expect(screen.getByRole("button", { name: "Show objects" })).toHaveAttribute("title", "Show objects (A)");
    expect(screen.queryByText("A")).not.toBeInTheDocument();
});

test("keeps the desktop key artwork without mislabeling the current shortcut", () => {
    render(<Hud hideObjectsKey="q" />);

    const icon = screen.getByRole("img", { name: "Object visibility keyboard shortcut" });
    expect(icon).toHaveStyle({ width: "57.6px", height: "57.6px" });
    expect(icon).toHaveAttribute("draggable", "false");
    expect(screen.queryByText("Q")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "A key" })).not.toBeInTheDocument();
});

test("shows the mobile SVG chair without desktop labels", () => {
    render(<Hud isTouchDevice />);

    expect(screen.getByRole("img", { name: "Chair" })).toHaveAttribute(
        "src", `${config.resource_path}/textures/chair-icon.svg`
    );
    expect(screen.getByRole("img", { name: "Chair" })).toHaveStyle({ width: "33.6px", height: "33.6px" });
    expect(screen.getByRole("button", { name: "Hide objects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide objects" })).toHaveStyle({
        background: "#f8fafc", color: "#24342f"
    });
    expect(screen.queryByText("Hide objects")).not.toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Escape key" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Viewer controls" })).toHaveStyle({ flexDirection: "row" });
});

test("keeps HUD controls marked for tour and navigation exclusion", () => {
    render(<Hud />);
    expect(screen.getByRole("group", { name: "Viewer controls" }))
        .toHaveAttribute("data-viewer-control", "true");
});

test("shows a fullscreen exit X before the mobile chair", () => {
    const exitFullscreen = jest.fn();
    render(<Hud isTouchDevice isFullscreen onExitFullscreen={exitFullscreen} />);

    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Exit fullscreen");
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toHaveStyle({ fontSize: "36px" });
    expect(screen.getAllByRole("button")[1]).toHaveAccessibleName("Hide objects");
    expect(screen.queryByRole("img", { name: "Escape key" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Chair" })).toHaveAttribute(
        "src", `${config.resource_path}/textures/chair-icon.svg`
    );
});

test("disables mobile fullscreen exit while the browser is transitioning", () => {
    const exitFullscreen = jest.fn();
    const { rerender } = render(
        <Hud isTouchDevice isFullscreen fullscreenPending onExitFullscreen={exitFullscreen} />
    );

    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exitFullscreen).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Hide objects" })).toBeEnabled();

    rerender(<Hud isTouchDevice isFullscreen onExitFullscreen={exitFullscreen} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
});

test("never shows a desktop X even in native fullscreen", () => {
    render(<Hud isFullscreen />);

    expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Object visibility keyboard shortcut" })).toHaveAttribute(
        "src", `${config.resource_path}/textures/key_a.png`
    );
});
