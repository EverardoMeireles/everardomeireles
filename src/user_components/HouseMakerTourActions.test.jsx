// ### Imports ###

/* eslint-disable testing-library/no-container, testing-library/no-node-access */

import React, { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as THREE from "three";
import SystemStore from "../SystemStore";
import {
    TourTooltipActions,
    createTourCircleRecord,
    getTextFadeOpacity,
    getTourTooltipHtml,
    getTourTooltipStyle,
    projectTourCircle,
    reconcileTourCircles,
    sanitizeTooltipDeclarations,
    sanitizeTooltipHtml
} from "./HouseMakerTourActions.jsx";

// ### Renderer mocks ###

const mockFrameCallbacks = new Set();
const mockUseFrame = jest.fn();
let mockThreeState;

jest.mock("@react-three/fiber", () => {
    const ReactModule = require("react");

    function useFrame(callback) {
        mockUseFrame(callback);

        ReactModule.useEffect(() => {
            mockFrameCallbacks.add(callback);
            return () => mockFrameCallbacks.delete(callback);
        }, [callback]);
    }

    return {
        useFrame,
        useThree: (selector) => selector(mockThreeState)
    };
});

jest.mock("@react-three/drei", () => {
    const ReactModule = require("react");
    const Passthrough = ({ children }) => ReactModule.createElement(
        ReactModule.Fragment,
        null,
        children
    );

    return {
        Center: Passthrough,
        Text3D: Passthrough
    };
});

// ### Test helpers ###

const MANIFEST_URL = "https://example.test/models/housemaker_export.json";

// Build one valid tooltip action.
function createTooltipAction(id = "tooltip-1", overrides = {}) {
    return {
        id,
        renderKey: `${id}-render`,
        type: "floatingTooltip",
        anchorPoint: new THREE.Vector3(0, 0, -5),
        tooltipPosition: "opposite",
        htmlBody: "<p>Tooltip</p>",
        style: "color: white; background: rgba(0, 0, 0, 0.8);",
        ...overrides
    };
}

// Build a camera looking down negative Z.
function createCamera() {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return camera;
}

// Build one complete owned circle record.
function createOwnedCircle(ownerId, suffix, overrides = {}) {
    return {
        circleName: `housemaker-tour-circle:${ownerId}:${suffix}`,
        circleSize: 30,
        playPulseAnimation: true,
        position: [10, 20],
        circleIsVisible: true,
        html: "<p>Tooltip</p>",
        style: { color: "white" },
        tooltipPosition: "opposite",
        ariaLabel: "Show tour tooltip",
        housemakerTourCircle: true,
        housemakerTourCircleOwner: ownerId,
        ...overrides
    };
}

// Run every currently mounted frame subscription.
function runFrame() {
    act(() => {
        [...mockFrameCallbacks].forEach((callback) => callback({}));
    });
}

// Reset shared store and renderer state between cases.
beforeEach(() => {
    mockFrameCallbacks.clear();
    mockUseFrame.mockClear();
    mockThreeState = { camera: createCamera() };
    SystemStore.setState({
        circlesData: [],
        circleProperties: { active: false },
        currentCircleNameSelected: undefined
    });
});

afterEach(() => {
    cleanup();
    mockFrameCallbacks.clear();
    SystemStore.setState({
        circlesData: [],
        circleProperties: { active: false },
        currentCircleNameSelected: undefined
    });
});

// ### Tooltip content tests ###

describe("tour tooltip content", () => {
    test("keeps safe HTML and resolves relative URLs", () => {
        const fragment = sanitizeTooltipHtml(
            "<p class='copy' onclick='bad()'>Hello <strong>world</strong></p>"
                + "<img src='images/photo.png' alt='Photo' onerror='bad()'>"
                + "<a href='guide.html' target='_blank'>Guide</a>"
                + "<script>window.bad = true</script>",
            MANIFEST_URL
        );
        const container = document.createElement("div");
        container.appendChild(fragment);

        expect(container.querySelector("p")).toHaveClass("copy");
        expect(container.querySelector("p")).not.toHaveAttribute("onclick");
        expect(container.querySelector("strong")).toHaveTextContent("world");
        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            "https://example.test/models/images/photo.png"
        );
        expect(container.querySelector("img")).not.toHaveAttribute("onerror");
        expect(container.querySelector("a")).toHaveAttribute(
            "href",
            "https://example.test/models/guide.html"
        );
        expect(container.querySelector("a")).toHaveAttribute(
            "rel",
            "noopener noreferrer"
        );
        expect(container.querySelector("script")).toBeNull();
        expect(container).not.toHaveTextContent("window.bad");
    });

    test("serializes sanitized HTML for ToolTip.jsx", () => {
        const html = getTourTooltipHtml(
            "<img src='images/photo.png' onerror='bad()'><iframe src='bad.html'></iframe>",
            MANIFEST_URL
        );
        const container = document.createElement("div");
        container.innerHTML = html;

        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            "https://example.test/models/images/photo.png"
        );
        expect(container.querySelector("img")).not.toHaveAttribute("onerror");
        expect(container.querySelector("iframe")).toBeNull();
    });

    test("converts safe CSS declarations into React style properties", () => {
        const declarations = sanitizeTooltipDeclarations(
            "box-sizing: border-box; max-width: 360px; color: white;"
                + " background-image: url(https://bad.test/pixel.png); position: fixed;"
        );
        const style = getTourTooltipStyle(
            "box-sizing: border-box; max-width: 360px; color: white;"
                + " background-image: url(https://bad.test/pixel.png); position: fixed;"
        );

        expect(declarations).not.toContain("url(");
        expect(declarations).not.toContain("position");
        expect(style).toEqual(expect.objectContaining({
            boxSizing: "border-box",
            maxWidth: "360px",
            color: "white"
        }));
        expect(style.backgroundImage).toBeUndefined();
        expect(style.position).toBeUndefined();
    });
});

// ### Projection tests ###

describe("projectTourCircle", () => {
    test("projects through the complete transformed loader root", () => {
        const camera = createCamera();
        const root = new THREE.Group();
        root.position.set(1.25, -0.4, -5);
        root.rotation.set(0.15, 0.35, -0.2);
        root.scale.set(1.5, 0.75, 2);
        root.updateMatrixWorld(true);
        const anchorPoint = new THREE.Vector3(0.3, 0.2, -0.4);
        const expectedProjection = anchorPoint.clone()
            .applyMatrix4(root.matrixWorld)
            .project(camera);

        const projection = projectTourCircle(anchorPoint, root, camera);

        expect(projection.position[0]).toBeCloseTo(
            (expectedProjection.x * 0.5 + 0.5) * 100
        );
        expect(projection.position[1]).toBeCloseTo(
            (-expectedProjection.y * 0.5 + 0.5) * 100
        );
        expect(projection.circleIsVisible).toBe(true);
    });

    test("hides anchors behind the camera or outside clip space", () => {
        const camera = createCamera();
        const root = new THREE.Group();
        root.updateMatrixWorld(true);

        expect(projectTourCircle([0, 0, 2], root, camera).circleIsVisible).toBe(false);
        expect(projectTourCircle([100, 0, -5], root, camera).circleIsVisible).toBe(false);
    });
});

// ### Store reconciliation tests ###

describe("tour circle records", () => {
    test("creates a pulsing legacy circle with sanitized tooltip data", () => {
        const circle = createTourCircleRecord(
            createTooltipAction("record", {
                htmlBody: "<img src='images/photo.png' onerror='bad()'>",
                style: "box-sizing: border-box; max-width: 360px;"
            }),
            "housemaker-tour-circle:owner:record",
            "owner",
            MANIFEST_URL
        );

        expect(circle).toMatchObject({
            circleSize: 30,
            playPulseAnimation: true,
            circleIsVisible: false,
            position: [0, 0],
            textShowMode: "Canvas",
            housemakerTourCircle: true,
            housemakerTourCircleOwner: "owner"
        });
        expect(circle.html).toContain(
            "https://example.test/models/images/photo.png"
        );
        expect(circle.html).not.toContain("onerror");
        expect(circle.style).toEqual(expect.objectContaining({
            boxSizing: "border-box",
            maxWidth: "360px"
        }));
    });

    test("adds, updates, and removes only one owner's circles", () => {
        const legacyCircle = { circleName: "legacy-circle", circleIsVisible: true };
        const otherOwnerCircle = createOwnedCircle("owner-b", "shared");
        const firstCircle = createOwnedCircle("owner-a", "first");
        SystemStore.setState({ circlesData: [legacyCircle, otherOwnerCircle] });

        reconcileTourCircles("owner-a", [firstCircle]);
        expect(SystemStore.getState().circlesData).toEqual([
            legacyCircle,
            otherOwnerCircle,
            firstCircle
        ]);

        const updatedCircle = {
            ...firstCircle,
            position: [35, 45],
            circleIsVisible: false
        };
        reconcileTourCircles("owner-a", [updatedCircle]);
        expect(SystemStore.getState().circlesData).toEqual([
            legacyCircle,
            otherOwnerCircle,
            updatedCircle
        ]);

        reconcileTourCircles("owner-a", []);
        expect(SystemStore.getState().circlesData).toEqual([
            legacyCircle,
            otherOwnerCircle
        ]);
    });

    test("avoids duplicate writes and clears only stale owned selection", () => {
        const ownerId = "owner-a";
        const circle = createOwnedCircle(ownerId, "selected");
        reconcileTourCircles(ownerId, [circle]);
        const listener = jest.fn();
        const unsubscribe = SystemStore.subscribe(listener);

        reconcileTourCircles(ownerId, [circle]);
        expect(listener).not.toHaveBeenCalled();

        SystemStore.setState({
            currentCircleNameSelected: circle.circleName,
            circleProperties: { active: true }
        });
        listener.mockClear();
        reconcileTourCircles(ownerId, [{
            ...circle,
            circleIsVisible: false
        }]);

        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: undefined,
            circleProperties: { active: false }
        });

        SystemStore.setState({
            currentCircleNameSelected: "legacy-circle",
            circleProperties: { active: true }
        });
        reconcileTourCircles(ownerId, []);
        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: "legacy-circle",
            circleProperties: { active: true }
        });
        unsubscribe();
    });

    test("clears hidden owned pins without disturbing another owner", () => {
        const firstOwnerCircle = createOwnedCircle("owner-a", "hovered");
        const secondOwnerCircle = createOwnedCircle("owner-b", "pinned");
        SystemStore.setState({
            circlesData: [firstOwnerCircle, secondOwnerCircle],
            currentCircleNameSelected: firstOwnerCircle.circleName,
            circleProperties: {
                active: true,
                pinnedCircleName: secondOwnerCircle.circleName
            }
        });

        reconcileTourCircles("owner-a", [{
            ...firstOwnerCircle,
            circleIsVisible: false
        }]);
        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: secondOwnerCircle.circleName,
            circleProperties: {
                active: true,
                pinnedCircleName: secondOwnerCircle.circleName
            }
        });

        SystemStore.setState({
            currentCircleNameSelected: firstOwnerCircle.circleName,
            circleProperties: {
                active: true,
                pinnedCircleName: firstOwnerCircle.circleName
            }
        });
        reconcileTourCircles("owner-a", []);
        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: undefined,
            circleProperties: {
                active: false,
                pinnedCircleName: undefined
            }
        });
    });
});

// ### Publisher lifecycle tests ###

describe("TourTooltipActions", () => {
    test("is idempotent through StrictMode, frames, and rerenders", () => {
        const legacyCircle = { circleName: "legacy-circle", circleIsVisible: true };
        SystemStore.setState({ circlesData: [legacyCircle] });
        const root = new THREE.Group();
        root.position.set(0.5, 0, 0);
        root.updateMatrixWorld(true);
        const rootRef = { current: root };
        const action = createTooltipAction();
        const actions = [action];
        const view = render(
            <StrictMode>
                <TourTooltipActions
                    actions={actions}
                    manifestUrl={MANIFEST_URL}
                    rootRef={rootRef}
                />
            </StrictMode>
        );

        let tourCircles = SystemStore.getState().circlesData.filter((circle) => (
            circle.housemakerTourCircle
        ));
        expect(tourCircles).toHaveLength(1);
        expect(tourCircles[0]).toMatchObject({
            playPulseAnimation: true,
            circleIsVisible: false,
            html: "<p>Tooltip</p>"
        });
        expect(view.container).toBeEmptyDOMElement();
        expect(view.container.querySelector("mesh, sphereGeometry")).toBeNull();
        expect(mockFrameCallbacks.size).toBe(1);

        runFrame();
        runFrame();
        tourCircles = SystemStore.getState().circlesData.filter((circle) => (
            circle.housemakerTourCircle
        ));
        expect(tourCircles).toHaveLength(1);
        expect(tourCircles[0].circleIsVisible).toBe(true);
        expect(tourCircles[0].position[0]).toBeGreaterThan(50);
        SystemStore.setState({
            currentCircleNameSelected: tourCircles[0].circleName,
            circleProperties: {
                active: true,
                pinnedCircleName: tourCircles[0].circleName
            }
        });

        view.rerender(
            <StrictMode>
                <TourTooltipActions
                    actions={[action]}
                    manifestUrl={MANIFEST_URL}
                    rootRef={rootRef}
                />
            </StrictMode>
        );
        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: tourCircles[0].circleName,
            circleProperties: {
                active: true,
                pinnedCircleName: tourCircles[0].circleName
            }
        });
        runFrame();
        expect(SystemStore.getState().circlesData.filter((circle) => (
            circle.housemakerTourCircle
        ))).toHaveLength(1);
        expect(SystemStore.getState().circlesData).toContain(legacyCircle);

        view.unmount();
        expect(SystemStore.getState().circlesData).toEqual([legacyCircle]);
        expect(SystemStore.getState()).toMatchObject({
            currentCircleNameSelected: undefined,
            circleProperties: {
                active: false,
                pinnedCircleName: undefined
            }
        });
        expect(mockFrameCallbacks.size).toBe(0);
    });

    test("keeps identical action IDs isolated between publishers", () => {
        const rootRef = { current: new THREE.Group() };
        rootRef.current.updateMatrixWorld(true);
        const action = createTooltipAction("shared-action");
        const { unmount: unmountFirst } = render(
            <StrictMode>
                <TourTooltipActions
                    actions={[action]}
                    manifestUrl={MANIFEST_URL}
                    rootRef={rootRef}
                />
            </StrictMode>
        );
        const { unmount: unmountSecond } = render(
            <StrictMode>
                <TourTooltipActions
                    actions={[action]}
                    manifestUrl={MANIFEST_URL}
                    rootRef={rootRef}
                />
            </StrictMode>
        );

        let tourCircles = SystemStore.getState().circlesData.filter((circle) => (
            circle.housemakerTourCircle
        ));
        expect(tourCircles).toHaveLength(2);
        expect(new Set(tourCircles.map((circle) => (
            circle.housemakerTourCircleOwner
        ))).size).toBe(2);
        expect(new Set(tourCircles.map((circle) => circle.circleName)).size).toBe(2);

        unmountFirst();
        tourCircles = SystemStore.getState().circlesData.filter((circle) => (
            circle.housemakerTourCircle
        ));
        expect(tourCircles).toHaveLength(1);

        unmountSecond();
        expect(SystemStore.getState().circlesData).toHaveLength(0);
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
