// ### Imports ###

/* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/prefer-screen-queries */

import React, { StrictMode, createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    TourTooltipInteraction,
    getTextFadeOpacity,
    getTooltipPlacement,
    sanitizeTooltipDeclarations,
    sanitizeTooltipHtml,
    sanitizeTooltipStylesheet,
    tooltipEventMatchesWaitInput
} from "./HouseMakerTourActions.jsx";

// ### Renderer mocks ###

// Keep component imports independent from a WebGL canvas.
const mockUseFrame = jest.fn();

jest.mock("@react-three/fiber", () => ({
    useFrame: (callback) => mockUseFrame(callback),
    useThree: (selector) => selector({
        camera: {},
        size: { width: 800, height: 600 }
    })
}));

jest.mock("@react-three/drei", () => {
    const ReactModule = require("react");

    return {
        Center: ({ children }) => ReactModule.createElement("div", null, children),
        Html: ({ children }) => ReactModule.createElement("div", null, children),
        Text3D: ({ children }) => ReactModule.createElement(
            "div",
            null,
            ReactModule.Children.toArray(children).filter((child) => (
                typeof child === "string" || typeof child === "number"
            ))
        )
    };
});

// ### Sanitization tests ###

describe("sanitizeTooltipHtml", () => {
    test("keeps safe markup and resolves relative images", () => {
        const fragment = sanitizeTooltipHtml(
            "<p class='copy' onclick='bad()' style='position:fixed'>Hello <strong>world</strong></p>"
                + "<img src='images/photo.png' alt='Photo' onerror='bad()'>",
            "https://example.test/models/housemaker_export.json"
        );
        const container = document.createElement("div");
        container.appendChild(fragment);

        expect(container.querySelector("p")).toHaveClass("copy");
        expect(container.querySelector("p")).not.toHaveAttribute("onclick");
        expect(container.querySelector("p")).not.toHaveAttribute("style");
        expect(container.querySelector("strong")).toHaveTextContent("world");
        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            "https://example.test/models/images/photo.png"
        );
        expect(container.querySelector("img")).not.toHaveAttribute("onerror");
    });

    test("drops executable elements and unsafe protocols", () => {
        const fragment = sanitizeTooltipHtml(
            "<script>window.bad = true</script>"
                + "<iframe src='https://example.test'></iframe>"
                + "<img src='javascript:alert(1)' alt='Unsafe'>"
                + "<a href='javascript:alert(1)'>Unsafe link</a>"
                + "<a href='guide.html' target='_blank'>Guide</a>",
            "https://example.test/models/housemaker_export.json"
        );
        const container = document.createElement("div");
        container.appendChild(fragment);

        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("iframe")).toBeNull();
        expect(container).not.toHaveTextContent("window.bad");
        expect(container.querySelector("img")).not.toHaveAttribute("src");
        expect(container.querySelectorAll("a")[0]).not.toHaveAttribute("href");
        expect(container.querySelectorAll("a")[1]).toHaveAttribute(
            "href",
            "https://example.test/models/guide.html"
        );
        expect(container.querySelectorAll("a")[1]).toHaveAttribute(
            "rel",
            "noopener noreferrer"
        );
    });
});

describe("tooltip CSS sanitization", () => {
    test("keeps safe declarations and removes resource loads", () => {
        const result = sanitizeTooltipDeclarations(
            "background: black; color: white; background-image: url(https://bad.test/pixel.png);"
        );

        expect(result).toContain("background: black");
        expect(result).toContain("color: white");
        expect(result).not.toContain("url(");
    });

    test("accepts scoped rules and rejects dangerous stylesheets", () => {
        expect(sanitizeTooltipStylesheet("p { color: red; }")).toBe("p { color: red; }");
        expect(sanitizeTooltipStylesheet("@import 'https://bad.test/style.css'; p { color: red; }")).toBe("");
        expect(sanitizeTooltipStylesheet("p { background: url(https://bad.test/a.png); }")).toBe("");
        expect(sanitizeTooltipStylesheet(":host { width: 200vw !important; }")).toBe("");
        expect(sanitizeTooltipStylesheet(":h\\6fst { overflow: visible; }")).toBe("");
    });
});

// ### Placement tests ###

describe("getTooltipPlacement", () => {
    test("places explicit left and right tooltips", () => {
        const sharedOptions = {
            anchorX: 400,
            anchorY: 300,
            tooltipWidth: 320,
            tooltipHeight: 120,
            viewportWidth: 800,
            viewportHeight: 600,
            margin: 16
        };

        expect(getTooltipPlacement({
            ...sharedOptions,
            tooltipPosition: "left"
        })).toMatchObject({ left: 16, top: 240, side: "left" });
        expect(getTooltipPlacement({
            ...sharedOptions,
            tooltipPosition: "right"
        })).toMatchObject({ left: 464, top: 240, side: "right" });
    });

    test("places opposite tooltips away from the hotspot half", () => {
        const sharedOptions = {
            anchorY: 300,
            tooltipWidth: 320,
            tooltipHeight: 120,
            viewportWidth: 800,
            viewportHeight: 600,
            tooltipPosition: "opposite",
            margin: 16
        };

        expect(getTooltipPlacement({ ...sharedOptions, anchorX: 100 }).side).toBe("right");
        expect(getTooltipPlacement({ ...sharedOptions, anchorX: 700 }).side).toBe("left");
    });

    test("clamps vertical placement and oversized content", () => {
        const placement = getTooltipPlacement({
            anchorX: 100,
            anchorY: -200,
            tooltipWidth: 1000,
            tooltipHeight: 1000,
            viewportWidth: 300,
            viewportHeight: 200,
            tooltipPosition: "right",
            margin: 16
        });

        expect(placement).toMatchObject({
            left: 16,
            top: 16,
            maxWidth: 268,
            maxHeight: 168
        });
    });
});

// ### Text fade tests ###

describe("getTextFadeOpacity", () => {
    test("honors fade delay and interpolates opacity", () => {
        const fade = {
            startedAtSeconds: 10,
            delayMs: 500,
            durationMs: 2000,
            fromOpacity: 0,
            toOpacity: 1
        };

        expect(getTextFadeOpacity({ ...fade, elapsedSeconds: 10.4 })).toBe(0);
        expect(getTextFadeOpacity({ ...fade, elapsedSeconds: 11.5 })).toBeCloseTo(0.5);
        expect(getTextFadeOpacity({ ...fade, elapsedSeconds: 13 })).toBe(1);
    });

    test("supports outgoing fades and zero durations", () => {
        expect(getTextFadeOpacity({
            elapsedSeconds: 2,
            startedAtSeconds: 1,
            durationMs: 2000,
            fromOpacity: 1,
            toOpacity: 0
        })).toBeCloseTo(0.5);
        expect(getTextFadeOpacity({
            elapsedSeconds: 1,
            startedAtSeconds: 1,
            durationMs: 0,
            fromOpacity: 0,
            toOpacity: 1
        })).toBe(1);
    });
});

// ### Input tests ###

describe("tooltipEventMatchesWaitInput", () => {
    test("matches explicit mouse and keyboard tokens", () => {
        expect(tooltipEventMatchesWaitInput({ type: "pointerdown", button: 0 }, "mouse:left")).toBe(true);
        expect(tooltipEventMatchesWaitInput({
            type: "pointerdown",
            pointerType: "touch",
            button: 0
        }, "mouse:left")).toBe(false);
        expect(tooltipEventMatchesWaitInput({ type: "pointerdown", button: 2 }, "mouse:left")).toBe(false);
        expect(tooltipEventMatchesWaitInput({ type: "click", button: 0 }, "mouse:left")).toBe(false);
        expect(tooltipEventMatchesWaitInput({ type: "keydown", key: "Enter" }, "key:enter")).toBe(true);
        expect(tooltipEventMatchesWaitInput({ type: "keydown", key: "A" }, "key:a")).toBe(true);
        expect(tooltipEventMatchesWaitInput({ type: "keydown", keyCode: 32 }, "key_code:32")).toBe(true);
    });

    test("blocks any and repeated keyboard events", () => {
        expect(tooltipEventMatchesWaitInput({ type: "pointerdown", button: 0 }, "any")).toBe(false);
        expect(tooltipEventMatchesWaitInput({ type: "keydown", key: "Enter", repeat: true }, "key:enter")).toBe(false);
    });
});

// ### Tooltip UI tests ###

describe("TourTooltipInteraction", () => {
    const action = {
        id: "tooltip-1",
        htmlBody: "<p class='message'>Tooltip</p><img src='images/photo.png' alt='Photo'>",
        style: ".message { color: rgb(255, 0, 0); }"
    };

    test("supports hover, focus, and click fallback", () => {
        const { container, getByRole } = render(
            <TourTooltipInteraction
                action={action}
                manifestUrl="https://example.test/models/housemaker_export.json"
            />
        );
        const button = getByRole("button", { name: "Show tour tooltip" });
        const tooltip = container.querySelector("[role='tooltip']");

        expect(tooltip).toHaveAttribute("aria-hidden", "true");
        fireEvent.pointerEnter(button);
        expect(tooltip).toHaveAttribute("aria-hidden", "false");
        fireEvent.pointerLeave(button);
        expect(tooltip).toHaveAttribute("aria-hidden", "true");
        fireEvent.focus(button);
        expect(tooltip).toHaveAttribute("aria-hidden", "false");
        fireEvent.blur(button);
        expect(tooltip).toHaveAttribute("aria-hidden", "true");
        fireEvent.click(button, { button: 0, detail: 1 });
        expect(tooltip).toHaveAttribute("aria-hidden", "false");
    });

    test("isolates sanitized content in a reusable shadow root", () => {
        const tooltipHostRef = createRef();
        const { unmount } = render(
            <StrictMode>
                <TourTooltipInteraction
                    action={action}
                    manifestUrl="https://example.test/models/housemaker_export.json"
                    tooltipHostRef={tooltipHostRef}
                />
            </StrictMode>
        );
        const shadowRoot = tooltipHostRef.current.shadowRoot;

        expect(shadowRoot).not.toBeNull();
        expect(shadowRoot.querySelectorAll("style")).toHaveLength(1);
        expect(shadowRoot.querySelector(".message")).toHaveTextContent("Tooltip");
        expect(shadowRoot.querySelector("img")).toHaveAttribute(
            "src",
            "https://example.test/models/images/photo.png"
        );
        expect(document.head.querySelector(".message")).toBeNull();

        unmount();
        expect(shadowRoot.childNodes).toHaveLength(0);
    });

    test("stops ordinary clicks but permits matching wait input", () => {
        const parentClick = jest.fn();
        const parentKeyDown = jest.fn();
        const { getByRole, rerender } = render(
            <div onClick={parentClick} onKeyDown={parentKeyDown}>
                <TourTooltipInteraction
                    action={action}
                    manifestUrl="https://example.test/models/housemaker_export.json"
                />
            </div>
        );
        const button = getByRole("button", { name: "Show tour tooltip" });

        fireEvent.click(button, { button: 0, detail: 1 });
        expect(parentClick).not.toHaveBeenCalled();
        expect(parentKeyDown).not.toHaveBeenCalled();

        rerender(
            <div onClick={parentClick} onKeyDown={parentKeyDown}>
                <TourTooltipInteraction
                    action={action}
                    manifestUrl="https://example.test/models/housemaker_export.json"
                    activeWaitInput="key:enter"
                />
            </div>
        );
        fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
        fireEvent.click(button, { button: 0, detail: 1 });
        expect(parentKeyDown).toHaveBeenCalledTimes(1);
        expect(parentClick).not.toHaveBeenCalled();
    });
});
