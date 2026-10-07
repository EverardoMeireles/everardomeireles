// ### Imports ###

import React, { StrictMode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
    HouseMakerTourPlayer,
    applyCameraWorldPose,
    completeTourActions,
    completeFallbackNavigation,
    restoreFallbackNavigation,
    suspendFallbackNavigation,
    transitionTourActions
} from "./HouseMakerTourPlayer.jsx";

jest.mock("@react-three/fiber", () => ({
    useFrame: jest.fn(),
    useThree: jest.fn()
}));

jest.mock("@react-three/drei", () => {
    const React = require("react");
    const Passthrough = (props) => React.createElement(React.Fragment, null, props.children);

    return {
        Center: Passthrough,
        Html: Passthrough,
        Text3D: Passthrough
    };
});

// ### Test helpers ###

let frameCallbacks;
let r3fState;

beforeEach(() => {
    frameCallbacks = [];
    r3fState = undefined;
    useFrame.mockImplementation((callback) => frameCallbacks.push(callback));
    useThree.mockImplementation((selector) => selector(r3fState));
});

// Compare vectors without depending on custom Jest matchers.
function expectVectorClose(actual, expected, precision = 6) {
    expect(actual.x).toBeCloseTo(expected.x, precision);
    expect(actual.y).toBeCloseTo(expected.y, precision);
    expect(actual.z).toBeCloseTo(expected.z, precision);
}

// Build a nested camera like the first-person rig.
function createNestedCamera() {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();
    parent.position.set(4, 2, -3);
    parent.rotation.set(0.2, -0.5, 0.1);
    camera.position.set(0, 1.5, 0);
    scene.add(parent);
    parent.add(camera);
    scene.updateMatrixWorld(true);
    return { scene, parent, camera };
}

// Build a small valid tour with an optional progress-zero wait.
function createManifest(waitInput) {
    const actions = waitInput ? [{
        id: "wait",
        type: "waitForKeyPress",
        input: waitInput,
        easing: "none"
    }] : [];

    return {
        tours: [{
            id: "tour",
            name: "Tour",
            durationSeconds: 1,
            progressSpeed: 1,
            triggerArea: {
                center: [0, 0, 0],
                sizeMeters: [2, 2],
                horizontalAxes: "xz"
            },
            curve: {
                type: "catmullRom",
                curveType: "catmullrom",
                closed: false,
                tension: 0.5,
                points: [[0, 1, 0], [0, 1, -2]]
            },
            steps: [{
                id: "start",
                progress: 0,
                cameraTarget: [0, 1, -3],
                actions
            }]
        }]
    };
}

// Render the player with real Three objects and mocked R3F hooks.
function renderTourPlayer(options = {}) {
    const { scene, camera } = createNestedCamera();
    const root = new THREE.Group();
    scene.add(root);
    options.configureRoot?.(root, camera);
    scene.updateMatrixWorld(true);
    const controls = {
        enabled: true,
        target: new THREE.Vector3(),
        update: jest.fn()
    };
    const navigation = Object.prototype.hasOwnProperty.call(options, "navigation")
        ? options.navigation
        : {
            getPlayerPosition: (output) => output.set(0, 0, 0),
            suspend: jest.fn(() => ({ wasSuspended: false })),
            restore: jest.fn(() => true),
            complete: jest.fn(() => true)
        };
    const componentProps = {
        manifest: options.manifest ?? createManifest(),
        manifestUrl: "/models/housemaker_export.json",
        navigationRef: { current: navigation },
        rootRef: { current: root },
        enabled: options.enabled ?? true
    };
    r3fState = { camera, controls };

    const element = options.strict
        ? <StrictMode><HouseMakerTourPlayer {...componentProps} /></StrictMode>
        : <HouseMakerTourPlayer {...componentProps} />;
    const view = render(element);

    return {
        ...view,
        camera,
        componentProps,
        controls,
        navigation,
        runFrame(delta) {
            act(() => frameCallbacks.at(-1)({}, delta));
        }
    };
}

// ### Camera world pose ###

test("applies a tour pose to a nested camera in world space", () => {
    const { scene, camera } = createNestedCamera();
    const position = new THREE.Vector3(8, 3, 2);
    const target = new THREE.Vector3(2, 1, -5);

    expect(applyCameraWorldPose(
        camera,
        position,
        target,
        new THREE.Vector3(0, 1, 0)
    )).toBe(true);
    scene.updateMatrixWorld(true);

    const actualPosition = camera.getWorldPosition(new THREE.Vector3());
    const actualDirection = camera.getWorldDirection(new THREE.Vector3());
    const expectedDirection = target.clone().sub(position).normalize();
    expectVectorClose(actualPosition, position);
    expectVectorClose(actualDirection, expectedDirection);
});

// ### Control restoration ###

test("cancellation restores the exact camera and controls snapshot", () => {
    const { scene, camera } = createNestedCamera();
    const originalPosition = camera.getWorldPosition(new THREE.Vector3());
    const originalQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
    const controls = {
        enabled: true,
        target: new THREE.Vector3(1, 2, 3),
        update: jest.fn()
    };
    const snapshot = suspendFallbackNavigation(camera, controls);

    expect(controls.enabled).toBe(false);
    applyCameraWorldPose(
        camera,
        new THREE.Vector3(20, 10, -8),
        new THREE.Vector3(),
        new THREE.Vector3(0, 1, 0)
    );
    controls.target.set(9, 9, 9);
    restoreFallbackNavigation(camera, snapshot);
    scene.updateMatrixWorld(true);

    expectVectorClose(camera.getWorldPosition(new THREE.Vector3()), originalPosition);
    expect(Math.abs(camera.getWorldQuaternion(new THREE.Quaternion()).dot(originalQuaternion)))
        .toBeCloseTo(1, 6);
    expectVectorClose(controls.target, new THREE.Vector3(1, 2, 3));
    expect(controls.enabled).toBe(true);
    expect(controls.update).toHaveBeenCalledTimes(1);
});

test("normal completion keeps the final pose and restores control availability", () => {
    const { scene, camera } = createNestedCamera();
    const controls = {
        enabled: false,
        target: new THREE.Vector3(),
        update: jest.fn()
    };
    const snapshot = suspendFallbackNavigation(camera, controls);
    const finalPosition = new THREE.Vector3(-3, 5, 7);
    const finalTarget = new THREE.Vector3(4, 2, -1);

    completeFallbackNavigation(
        camera,
        finalPosition,
        finalTarget,
        new THREE.Vector3(0, 1, 0),
        snapshot
    );
    scene.updateMatrixWorld(true);

    expectVectorClose(camera.getWorldPosition(new THREE.Vector3()), finalPosition);
    expectVectorClose(
        camera.getWorldDirection(new THREE.Vector3()),
        finalTarget.clone().sub(finalPosition).normalize()
    );
    expectVectorClose(controls.target, finalTarget);
    expect(controls.enabled).toBe(false);
});

// ### Action lifecycle ###

test("keeps preceding text fading through completion and appends tied steps", () => {
    const emptyActions = {
        progress: undefined,
        currentText: [],
        outgoingText: [],
        tooltips: []
    };
    const firstAction = { id: "same", fadeDurationMs: 1000 };
    const tiedAction = { id: "same", fadeDurationMs: 2000 };
    const makeGroup = (stepId, progress, textActions = [], tooltipActions = []) => ({
        progress,
        steps: [{ id: stepId }],
        textActions,
        tooltipActions
    });

    let actions = transitionTourActions(
        emptyActions,
        makeGroup("first", 0.3, [firstAction])
    );
    actions = transitionTourActions(
        actions,
        makeGroup("tied", 0.3, [tiedAction])
    );
    expect(actions.currentText).toHaveLength(2);
    expect(new Set(actions.currentText.map((record) => record.key)).size).toBe(2);

    actions = transitionTourActions(actions, makeGroup("final", 1));
    expect(actions.currentText).toEqual([]);
    expect(actions.outgoingText).toHaveLength(2);

    const completed = completeTourActions(actions);
    expect(completed.outgoingText).toHaveLength(2);
    expect(completed.tooltips).toEqual([]);

    const firstTooltipState = transitionTourActions(
        emptyActions,
        makeGroup("tooltip-a", 0.2, [], [{ id: "same" }])
    );
    const secondTooltipState = transitionTourActions(
        firstTooltipState,
        makeGroup("tooltip-b", 0.4, [], [{ id: "same" }])
    );
    expect(secondTooltipState.tooltips[0].renderKey)
        .not.toBe(firstTooltipState.tooltips[0].renderKey);
});

// ### Runtime integration ###

test("suspends once on entry and restores once when tours are disabled", () => {
    const view = renderTourPlayer();

    view.runFrame(0.016);
    expect(view.navigation.suspend).toHaveBeenCalledTimes(1);

    view.rerender(
        <HouseMakerTourPlayer {...view.componentProps} enabled={false} />
    );
    expect(view.navigation.restore).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(view.navigation.restore).toHaveBeenCalledTimes(1);
});

test("uses the camera snapshot when the navigation bridge cannot restore", () => {
    const navigation = {
        getPlayerPosition: (output) => output.set(0, 0, 0),
        suspend: jest.fn(() => ({})),
        restore: jest.fn(() => false),
        complete: jest.fn(() => false)
    };
    const view = renderTourPlayer({ navigation });
    const originalPosition = view.camera.getWorldPosition(new THREE.Vector3());

    view.runFrame(0.016);
    expect(view.camera.getWorldPosition(new THREE.Vector3()).distanceTo(originalPosition))
        .toBeGreaterThan(1);

    view.rerender(
        <HouseMakerTourPlayer {...view.componentProps} enabled={false} />
    );
    expectVectorClose(
        view.camera.getWorldPosition(new THREE.Vector3()),
        originalPosition
    );
});

test("manifest replacement cancels and restores active navigation", () => {
    const view = renderTourPlayer();
    view.runFrame(0.016);

    view.rerender(
        <HouseMakerTourPlayer
            {...view.componentProps}
            manifest={createManifest()}
        />
    );

    expect(view.navigation.restore).toHaveBeenCalledTimes(1);
    expect(view.controls.enabled).toBe(true);
});

test("uses player position and the full loader root transform", () => {
    const navigation = {
        getPlayerPosition: jest.fn((output) => output.set(50, 0, 30)),
        suspend: jest.fn(() => ({})),
        restore: jest.fn(() => true),
        complete: jest.fn(() => true)
    };
    let transformedRoot;
    const view = renderTourPlayer({
        navigation,
        configureRoot(root) {
            transformedRoot = root;
            root.position.set(50, 0, 30);
            root.rotation.y = 0.7;
            root.scale.set(2, 3, 2);
        }
    });
    const expectedCameraPosition = transformedRoot.localToWorld(
        new THREE.Vector3(0, 1, 0)
    );

    view.runFrame(0.016);

    expect(navigation.getPlayerPosition).toHaveBeenCalled();
    expect(navigation.suspend).toHaveBeenCalledTimes(1);
    expectVectorClose(
        view.camera.getWorldPosition(new THREE.Vector3()),
        expectedCameraPosition
    );
});

test("falls back to the R3F camera when no player bridge exists", () => {
    let transformedRoot;
    const view = renderTourPlayer({
        navigation: undefined,
        configureRoot(root, camera) {
            transformedRoot = root;
            const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
            root.position.set(cameraPosition.x, 0, cameraPosition.z);
        }
    });
    const expectedCameraPosition = transformedRoot.localToWorld(
        new THREE.Vector3(0, 1, 0)
    );

    view.runFrame(0.016);

    expectVectorClose(
        view.camera.getWorldPosition(new THREE.Vector3()),
        expectedCameraPosition
    );
    expect(view.controls.enabled).toBe(false);
});

test("runs only one tour and activates another after a new entry", () => {
    const manifest = createManifest();
    const secondTour = JSON.parse(JSON.stringify(manifest.tours[0]));
    secondTour.id = "tour-two";
    secondTour.triggerArea.center = [10, 0, 0];
    secondTour.curve.points = [[10, 1, 0], [10, 1, -2]];
    secondTour.steps[0].id = "second-start";
    secondTour.steps[0].cameraTarget = [10, 1, -3];
    manifest.tours.push(secondTour);

    const playerPosition = new THREE.Vector3(0, 0, 0);
    const navigation = {
        getPlayerPosition: jest.fn((output) => output.copy(playerPosition)),
        suspend: jest.fn(() => ({})),
        restore: jest.fn(() => true),
        complete: jest.fn(() => true)
    };
    const view = renderTourPlayer({ manifest, navigation });

    view.runFrame(0.016);
    view.runFrame(2);
    expect(navigation.suspend).toHaveBeenCalledTimes(1);
    expect(navigation.complete).toHaveBeenCalledTimes(1);

    playerPosition.set(5, 0, 0);
    view.runFrame(0.016);
    playerPosition.set(10, 0, 0);
    view.runFrame(0.016);

    expect(navigation.suspend).toHaveBeenCalledTimes(2);
    expect(navigation.complete).toHaveBeenCalledTimes(1);
});

test("idle wait motion returns immediately to the authored pose", () => {
    const manifest = createManifest("key:space");
    manifest.tours[0].steps[0].actions.push({
        id: "idle",
        type: "idleCameraAnimation",
        pivotPoint: [0, 1, -3],
        radiusMeters: 0.1,
        cycleDurationSeconds: 4
    });
    const view = renderTourPlayer({ manifest });

    view.runFrame(0.016);
    view.runFrame(1);
    expect(view.camera.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(0.1, 6);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expectVectorClose(
        view.camera.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(0, 1, 0)
    );
});

test("tooltip interaction does not satisfy any, but explicit mouse waits can", () => {
    const marker = document.createElement("button");
    marker.dataset.housemakerTooltipInteraction = "true";
    document.body.appendChild(marker);

    let view = renderTourPlayer({ manifest: createManifest("any") });
    view.runFrame(0.016);
    fireEvent(marker, new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    view.runFrame(2);
    expect(view.navigation.complete).not.toHaveBeenCalled();

    fireEvent(
        document.body,
        new MouseEvent("pointerdown", { bubbles: true, button: 0 })
    );
    view.runFrame(2);
    expect(view.navigation.complete).toHaveBeenCalledTimes(1);
    view.unmount();

    view = renderTourPlayer({
        manifest: createManifest("mouse:left")
    });
    view.runFrame(0.016);
    fireEvent(marker, new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    view.runFrame(2);
    expect(view.navigation.complete).toHaveBeenCalledTimes(1);

    marker.remove();
});

test("balances wait listeners through StrictMode and unmount", () => {
    const addListener = jest.spyOn(window, "addEventListener");
    const removeListener = jest.spyOn(window, "removeEventListener");
    const view = renderTourPlayer({
        manifest: createManifest("key:space"),
        strict: true
    });

    view.runFrame(0.016);
    const waitListenerAdds = addListener.mock.calls.filter(([type, , capture]) => (
        ["keydown", "pointerdown"].includes(type) && capture === true
    ));
    expect(waitListenerAdds).toHaveLength(2);

    view.unmount();
    waitListenerAdds.forEach(([type, listener, capture]) => {
        expect(removeListener).toHaveBeenCalledWith(type, listener, capture);
    });

    addListener.mockRestore();
    removeListener.mockRestore();
});
