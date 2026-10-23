import React, { useLayoutEffect } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import * as THREE from "three";
import { FirstPersonController } from "./FirstPersonController.jsx";

// Capture controller work without a WebGL renderer.
let mockScene;
let mockGl;
let mockFrame;
let mockOctrees;
let mockController;
let mockAnimationFrames;

jest.mock("@react-three/fiber", () => ({
    useThree: () => ({ scene: mockScene, gl: mockGl }),
    useFrame: (callback) => { mockFrame = callback; },
}));

jest.mock("@react-three/drei", () => ({
    PerspectiveCamera: () => null,
}));

jest.mock("../SystemStore.js", () => ({
    __esModule: true,
    default: (selector) => selector({ cameraStateTracking: false }),
}));

jest.mock("../Helper.js", () => ({
    hasSignificantChange: jest.fn(),
    roundToDecimalPlace: (value) => value,
}));

jest.mock("three/examples/jsm/math/Capsule.js", () => {
    const { Vector3 } = jest.requireActual("three");
    return {
        Capsule: class {
            constructor() {
                this.start = new Vector3();
                this.end = new Vector3();
            }
            translate(offset) {
                this.start.add(offset);
                this.end.add(offset);
            }
        },
    };
});

jest.mock("three/examples/jsm/math/Octree.js", () => ({
    Octree: class {
        constructor() {
            this.triangles = [];
            this.build = jest.fn(() => this);
            this.capsuleIntersect = jest.fn(() => false);
            mockOctrees.push(this);
        }
        addTriangle(triangle) {
            this.triangles.push(triangle);
        }
    },
}));

// Attach real Three transforms to the controller's returned refs.
function ControllerHarness(props) {
    const element = FirstPersonController.type(props);
    useLayoutEffect(() => {
        function mountNode(node) {
            const object = node.type === "group"
                ? new THREE.Group()
                : new THREE.PerspectiveCamera();
            if (node.props.position) object.position.fromArray(node.props.position);
            if (node.ref) node.ref.current = object;
            // eslint-disable-next-line testing-library/no-node-access
            React.Children.forEach(node.props.children, (child) => {
                if (React.isValidElement(child)) object.add(mountNode(child));
            });
            return object;
        }
        mockController = mountNode(element);
        mockScene.add(mockController);
        return () => mockScene.remove(mockController);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

// Give each collider a recognizable world-space triangle.
function addCollider(parent, x, hideable = false, instanced = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        0, 0, 0, 1, 0, 0, 0, 1, 0,
    ], 3));
    const mesh = instanced
        ? new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 2)
        : new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.position.x = x;
    if (instanced) {
        mesh.setMatrixAt(0, new THREE.Matrix4());
        mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(2, 0, 0));
    }
    mesh.userData.housemakerHideable = hideable;
    parent.add(mesh);
    return mesh;
}

// Run only scheduled builds, never browser animation timing.
function flushCollisionBuilds() {
    const callbacks = [...mockAnimationFrames.values()];
    mockAnimationFrames.clear();
    act(() => callbacks.forEach((callback) => callback()));
}

// Dispatch touch pointers without jsdom PointerEvent support.
function dispatchPointer(
    type, pointerId, clientX, clientY,
    target = type === "pointerdown" || type === "lostpointercapture" ? mockGl.domElement : window,
    pointerType = "touch"
) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
        pointerId: { value: pointerId },
        pointerType: { value: pointerType },
        clientX: { value: clientX },
        clientY: { value: clientY },
        button: { value: 0 },
    });
    fireEvent(target, event);
    return event;
}

// Read the real camera's yaw and pitch.
function readLookAngles() {
    const camera = mockController.getObjectByProperty("isCamera", true);
    return new THREE.Euler().setFromQuaternion(
        camera.getWorldQuaternion(new THREE.Quaternion()), "YXZ"
    );
}

// Dispatch sensor samples without browser hardware.
function dispatchOrientation(alpha = 0, beta = 90, gamma = 0) {
    const event = new Event("deviceorientation");
    Object.defineProperties(event, {
        alpha: { value: alpha },
        beta: { value: beta },
        gamma: { value: gamma },
    });
    fireEvent(window, event);
}

beforeEach(() => {
    mockScene = new THREE.Scene();
    mockGl = { domElement: document.createElement("canvas") };
    mockGl.domElement.getBoundingClientRect = jest.fn(() => ({
        left: 100, top: 50, width: 400, height: 800,
    }));
    mockGl.domElement.requestPointerLock = jest.fn();
    mockGl.domElement.setPointerCapture = jest.fn();
    mockGl.domElement.releasePointerCapture = jest.fn();
    mockGl.domElement.hasPointerCapture = jest.fn(() => true);
    mockOctrees = [];
    mockAnimationFrames = new Map();
    let nextFrame = 0;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        nextFrame += 1;
        mockAnimationFrames.set(nextFrame, callback);
        return nextFrame;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        mockAnimationFrames.delete(id);
    });
});

afterEach(() => jest.restoreAllMocks());

test("hiding objects skips capsule and ground checks without rebuilding", () => {
    const root = new THREE.Group();
    root.userData.housemakerObjectsHidden = false;
    mockScene.add(root);
    const surface = addCollider(root, 0);
    const furniture = addCollider(root, 10, true);
    const raycast = jest.spyOn(THREE.Raycaster.prototype, "intersectObjects")
        .mockReturnValue([]);
    render(<ControllerHarness position={[0, 3, 0]} />);
    flushCollisionBuilds();

    const surfaceOctree = mockOctrees.find((octree) => octree.triangles[0].a.x === 0);
    const furnitureOctree = mockOctrees.find((octree) => octree.triangles[0].a.x === 10);
    act(() => mockFrame({}, 0.016));
    expect(surfaceOctree.capsuleIntersect).toHaveBeenCalledTimes(1);
    expect(furnitureOctree.capsuleIntersect).toHaveBeenCalledTimes(1);

    root.userData.housemakerObjectsHidden = true;
    raycast.mockClear();
    act(() => mockFrame({}, 0.016));
    expect(surfaceOctree.capsuleIntersect).toHaveBeenCalledTimes(2);
    expect(furnitureOctree.capsuleIntersect).toHaveBeenCalledTimes(1);
    expect(raycast).toHaveBeenCalledWith([surface], false);
    expect(raycast).not.toHaveBeenCalledWith([furniture], false);

    root.userData.housemakerObjectsHidden = false;
    act(() => mockFrame({}, 0.016));
    expect(furnitureOctree.capsuleIntersect).toHaveBeenCalledTimes(2);
    expect(mockOctrees).toHaveLength(2);
    expect(surfaceOctree.build).toHaveBeenCalledTimes(1);
    expect(furnitureOctree.build).toHaveBeenCalledTimes(1);
    expect(mockAnimationFrames.size).toBe(0);
});

test("independent loaders and hidden instances retain separate colliders", () => {
    const rootA = new THREE.Group();
    rootA.userData.housemakerObjectsHidden = true;
    const rootB = new THREE.Group();
    rootB.userData.housemakerObjectsHidden = false;
    mockScene.add(rootA, rootB);
    const furnitureA = addCollider(rootA, 10, true, true);
    furnitureA.visible = false;
    addCollider(rootB, 20, true);
    addCollider(rootA, 30);
    render(<ControllerHarness position={[0, 3, 0]} />);
    flushCollisionBuilds();

    const treeA = mockOctrees.find((octree) => octree.triangles[0].a.x === 10);
    const treeB = mockOctrees.find((octree) => octree.triangles[0].a.x === 20);
    const surfaceTree = mockOctrees.find((octree) => octree.triangles[0].a.x === 30);
    expect(treeA.triangles.map((triangle) => triangle.a.x)).toEqual([10, 12]);
    act(() => mockFrame({}, 0.016));
    expect(treeA.capsuleIntersect).not.toHaveBeenCalled();
    expect(treeB.capsuleIntersect).toHaveBeenCalledTimes(1);
    expect(surfaceTree.capsuleIntersect).toHaveBeenCalledTimes(1);

    rootA.userData.housemakerObjectsHidden = false;
    furnitureA.visible = true;
    act(() => mockFrame({}, 0.016));
    expect(treeA.capsuleIntersect).toHaveBeenCalledTimes(1);
    expect(mockOctrees).toHaveLength(3);
});

test("surface and object capsule responses compose sequentially", () => {
    const root = new THREE.Group();
    root.userData.housemakerObjectsHidden = false;
    mockScene.add(root);
    addCollider(root, 0);
    addCollider(root, 10, true);
    render(<ControllerHarness position={[0, 3, 0]} />);
    flushCollisionBuilds();
    mockOctrees[0].capsuleIntersect.mockReturnValue({
        normal: new THREE.Vector3(1, 0, 0), depth: 1,
    });
    mockOctrees[1].capsuleIntersect.mockImplementation((capsule) => {
        expect(capsule.start.x).toBe(1);
        return { normal: new THREE.Vector3(0, 0, 1), depth: 2 };
    });

    act(() => mockFrame({}, 0.016));
    expect(mockController.position.x).toBe(1);
    expect(mockController.position.z).toBe(2);
});

test("A is reserved while Q and ArrowLeft still strafe", () => {
    render(<ControllerHarness collisionsEnabled={false} azertyMode={false} />);
    fireEvent.keyDown(window, { key: "a" });
    act(() => mockFrame({}, 0.016));
    expect(mockController.position.x).toBe(0);
    fireEvent.keyDown(window, { key: "q" });
    act(() => mockFrame({}, 0.016));
    expect(mockController.position.x).toBeLessThan(0);
    fireEvent.keyUp(window, { key: "q" });
    const previousX = mockController.position.x;
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    act(() => mockFrame({}, 0.016));
    expect(mockController.position.x).toBeLessThan(previousX);
});

test.each([[400, 800], [800, 400]])(
    "touch joysticks support simultaneous movement and looking at %s x %s",
    (width, height) => {
        mockGl.domElement.getBoundingClientRect.mockReturnValue({ left: 100, top: 50, width, height });
        render(<ControllerHarness collisionsEnabled={false} slowDownWhileFalling={false} />);
        const movementX = 100 + width * 0.25;
        const lookX = 100 + width * 0.75;
        const anchorY = 50 + height * 0.5;
        const radius = Math.min(width, height) * 0.15;

        dispatchPointer("pointerdown", 1, movementX, anchorY);
        dispatchPointer("pointerdown", 2, lookX, anchorY);
        dispatchPointer("pointermove", 1, movementX, anchorY - radius);
        dispatchPointer("pointermove", 2, lookX + radius, anchorY);
        act(() => mockFrame({}, 0.02));

        expect(mockController.position.z).toBeLessThan(0);
        expect(mockController.position.x).toBeGreaterThan(0);
        expect(readLookAngles().y).toBeLessThan(0);
        expect(mockGl.domElement.setPointerCapture).toHaveBeenCalledWith(1);
        expect(mockGl.domElement.setPointerCapture).toHaveBeenCalledWith(2);
        expect(mockGl.domElement.requestPointerLock).not.toHaveBeenCalled();

        dispatchPointer("pointerup", 1, movementX, anchorY - radius);
        const stoppedPosition = mockController.position.clone();
        const previousYaw = readLookAngles().y;
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.x).toBe(stoppedPosition.x);
        expect(mockController.position.z).toBe(stoppedPosition.z);
        expect(readLookAngles().y).toBeLessThan(previousYaw);

        dispatchPointer("pointerup", 2, lookX + radius, anchorY);
        const stoppedYaw = readLookAngles().y;
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(stoppedYaw);
        expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(2);
    }
);

test("movement has a deadzone, analog speed, and bounded diagonal speed", () => {
    render(<ControllerHarness collisionsEnabled={false} slowDownWhileFalling={false} />);
    dispatchPointer("pointerdown", 1, 200, 500);
    dispatchPointer("pointermove", 1, 203, 497);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.x).toBe(0);
    expect(mockController.position.z).toBe(0);

    dispatchPointer("pointermove", 1, 200, 470);
    act(() => mockFrame({}, 0.02));
    const partialDistance = -mockController.position.z;
    expect(partialDistance).toBeGreaterThan(0);
    expect(partialDistance).toBeLessThan(1.5 * 0.02);

    const previousPosition = mockController.position.clone();
    dispatchPointer("pointermove", 1, 400, 300);
    act(() => mockFrame({}, 0.02));
    const horizontalDistance = Math.hypot(
        mockController.position.x - previousPosition.x,
        mockController.position.z - previousPosition.z
    );
    expect(horizontalDistance).toBeCloseTo(1.5 * 0.02);
    expect(mockController.position.x).toBeGreaterThan(0);
    expect(mockController.position.z).toBeLessThan(previousPosition.z);
});

test("each finger keeps its side and additional fingers cannot steal ownership", () => {
    render(<ControllerHarness collisionsEnabled={false} slowDownWhileFalling={false} />);
    dispatchPointer("pointerdown", 1, 220, 500);
    dispatchPointer("pointerdown", 3, 240, 500);
    dispatchPointer("pointermove", 3, 240, 350);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.z).toBe(0);

    dispatchPointer("pointermove", 1, 400, 500);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.x).toBeGreaterThan(0);
    expect(readLookAngles().y).toBe(0);

    dispatchPointer("pointerdown", 2, 420, 500);
    dispatchPointer("pointermove", 2, 180, 500);
    act(() => mockFrame({}, 0.02));
    expect(readLookAngles().y).toBeGreaterThan(0);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalledWith(3);
});

test.each([30, 60])("held look deflection is frame-rate independent at %s FPS", (framesPerSecond) => {
    render(<ControllerHarness collisionsEnabled={false} />);
    dispatchPointer("pointerdown", 1, 420, 500);
    dispatchPointer("pointermove", 1, 480, 500);
    act(() => {
        for (let index = 0; index < framesPerSecond; index += 1) {
            mockFrame({}, 1 / framesPerSecond);
        }
    });
    expect(readLookAngles().y).toBeCloseTo(-1.8);

    dispatchPointer("pointermove", 1, 420, 440);
    act(() => mockFrame({}, 0.02));
    expect(readLookAngles().x).toBeGreaterThan(0);
});

test.each(["pointercancel", "lostpointercapture"])("%s stops only its matching joystick", (eventType) => {
    render(<ControllerHarness collisionsEnabled={false} slowDownWhileFalling={false} />);
    dispatchPointer("pointerdown", 1, 200, 500);
    dispatchPointer("pointerdown", 2, 420, 500);
    dispatchPointer("pointermove", 1, 200, 440);
    dispatchPointer("pointermove", 2, 480, 500);
    dispatchPointer(eventType, 1, 200, 440);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.x).toBe(0);
    expect(mockController.position.z).toBe(0);
    expect(readLookAngles().y).toBeLessThan(0);
});

test.each(["blur", "resize", "orientationchange", "visibilitychange"])(
    "%s clears held touch controls",
    (eventType) => {
        render(<ControllerHarness collisionsEnabled={false} />);
        dispatchPointer("pointerdown", 1, 200, 500);
        dispatchPointer("pointerdown", 2, 420, 500);
        dispatchPointer("pointermove", 1, 200, 440);
        dispatchPointer("pointermove", 2, 480, 500);
        if (eventType === "visibilitychange") {
            jest.spyOn(document, "hidden", "get").mockReturnValue(true);
            jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        }
        fireEvent(eventType === "visibilitychange" ? document : window, new Event(eventType));
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.x).toBe(0);
        expect(mockController.position.z).toBe(0);
        expect(readLookAngles().y).toBe(0);
        expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(2);
    }
);

test("tours release touches and do not resume stale joystick input", () => {
    const navigationRef = React.createRef();
    render(<ControllerHarness navigationRef={navigationRef} collisionsEnabled={false} />);
    dispatchPointer("pointerdown", 1, 200, 500);
    dispatchPointer("pointermove", 1, 200, 440);
    let snapshot;
    act(() => { snapshot = navigationRef.current.suspend(); });
    dispatchPointer("pointerdown", 2, 420, 500);
    dispatchPointer("pointermove", 2, 480, 500);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.z).toBe(0);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalledWith(2);

    act(() => navigationRef.current.restore(snapshot));
    dispatchPointer("pointermove", 1, 200, 440);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.z).toBe(0);
    expect(readLookAngles().y).toBe(0);

    dispatchPointer("pointerdown", 3, 420, 500);
    dispatchPointer("pointermove", 3, 480, 500);
    act(() => navigationRef.current.complete([0, 1.7, 0], [0, 1.7, -1], snapshot));
    act(() => mockFrame({}, 0.02));
    expect(readLookAngles().y).toBe(0);
    expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(3);
});

test("disabled controls and unmount release captures and restore canvas styles", () => {
    mockGl.domElement.style.touchAction = "pan-y";
    const view = render(<ControllerHarness collisionsEnabled={false} />);
    expect(mockGl.domElement.style.touchAction).toBe("none");
    dispatchPointer("pointerdown", 1, 200, 500);
    dispatchPointer("pointermove", 1, 200, 440);
    view.rerender(<ControllerHarness collisionsEnabled={false} enabled={false} />);
    expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
    dispatchPointer("pointerdown", 2, 200, 500);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalledWith(2);

    view.rerender(<ControllerHarness collisionsEnabled={false} />);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.z).toBe(0);
    dispatchPointer("pointerdown", 3, 200, 500);
    view.unmount();
    expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(3);
    expect(mockGl.domElement.style.touchAction).toBe("pan-y");
    dispatchPointer("pointerdown", 4, 200, 500);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalledWith(4);
});

test("UI touches stay independent while mouse still requests pointer lock", () => {
    render(<ControllerHarness collisionsEnabled={false} />);
    const button = document.createElement("button");
    dispatchPointer("pointerdown", 1, 200, 500, button);
    dispatchPointer("pointermove", 1, 200, 440, button);
    act(() => mockFrame({}, 0.02));
    expect(mockController.position.z).toBe(0);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalled();
    expect(mockGl.domElement.requestPointerLock).not.toHaveBeenCalled();

    dispatchPointer("pointerdown", 2, 200, 500, mockGl.domElement, "mouse");
    expect(mockGl.domElement.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalled();
});

test("Strict Mode does not duplicate touch input listeners", () => {
    render(
        <React.StrictMode>
            <ControllerHarness collisionsEnabled={false} />
        </React.StrictMode>
    );
    dispatchPointer("pointerdown", 1, 420, 500);
    dispatchPointer("pointermove", 1, 480, 500);
    act(() => mockFrame({}, 0.02));
    expect(readLookAngles().y).toBeCloseTo(-1.8 * 0.02);
    expect(mockGl.domElement.setPointerCapture).toHaveBeenCalledTimes(1);
});

describe("gyroscope navigation", () => {
    let originalDeviceOrientation;
    let originalTouchPoints;
    let originalSecureContext;
    let originalScreenOrientation;

    beforeEach(() => {
        originalDeviceOrientation = Object.getOwnPropertyDescriptor(window, "DeviceOrientationEvent");
        originalTouchPoints = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
        originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
        originalScreenOrientation = Object.getOwnPropertyDescriptor(window.screen, "orientation");
        Object.defineProperty(window, "DeviceOrientationEvent", {
            configurable: true, value: class DeviceOrientationEvent {},
        });
        Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
        Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
        const orientation = new EventTarget();
        orientation.angle = 0;
        Object.defineProperty(window.screen, "orientation", { configurable: true, value: orientation });
    });

    afterEach(() => {
        for (const [object, key, descriptor] of [
            [window, "DeviceOrientationEvent", originalDeviceOrientation],
            [navigator, "maxTouchPoints", originalTouchPoints],
            [window, "isSecureContext", originalSecureContext],
            [window.screen, "orientation", originalScreenOrientation],
        ]) {
            if (descriptor) Object.defineProperty(object, key, descriptor);
            else delete object[key];
        }
    });

    test("first sensor sample preserves pose before physical yaw and pitch changes", () => {
        const statusChanged = jest.fn();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            onGyroscopeStatusChange={statusChanged}
            rotation={[0.2, 0.4, 0]}
            collisionsEnabled={false}
        />);
        dispatchOrientation();
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(0.4);
        expect(readLookAngles().x).toBeCloseTo(0.2);
        expect(statusChanged).toHaveBeenLastCalledWith("active");

        dispatchOrientation(90, 120, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(0.4 + Math.PI / 2);
        expect(readLookAngles().x).toBeCloseTo(0.2 + Math.PI / 6);
        expect(readLookAngles().z).toBeCloseTo(0);
    });

    test.each([[90, 90, -90, -120], [270, 270, 90, 120]])(
        "landscape %s degrees keeps upright yaw and physical pitch",
        (angle, alpha, gamma, pitchedGamma) => {
            window.screen.orientation.angle = angle;
            render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
            dispatchOrientation(alpha, 0, gamma);
            act(() => mockFrame({}, 0.02));
            expect(readLookAngles().x).toBeCloseTo(0);
            expect(readLookAngles().y).toBeCloseTo(0);

            dispatchOrientation(alpha, 0, pitchedGamma);
            act(() => mockFrame({}, 0.02));
            expect(readLookAngles().x).toBeCloseTo(Math.PI / 6);
            expect(readLookAngles().y).toBeCloseTo(0);
            expect(readLookAngles().z).toBeCloseTo(0);
        }
    );

    test("heading wraps across north and pitch stays within controller limits", () => {
        render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchOrientation(170);
        dispatchOrientation(190);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(20 * Math.PI / 180);

        dispatchOrientation(190, 179, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().x).toBeCloseTo(Math.PI / 2 - 0.05);
    });

    test("crossing vertical keeps heading stable before normal turning resumes", () => {
        render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchOrientation();
        act(() => {
            for (const beta of [175, 179, 181, 185, 170]) {
                dispatchOrientation(0, beta, 0);
                mockFrame({}, 0.02);
                expect(readLookAngles().y).toBeCloseTo(0);
                expect(Math.abs(readLookAngles().x)).toBeLessThanOrEqual(Math.PI / 2 - 0.05 + 1e-10);
            }
        });

        dispatchOrientation(30, 170, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
    });

    test("active gyroscope makes either screen side one owned movement joystick", () => {
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            collisionsEnabled={false}
            slowDownWhileFalling={false}
        />);
        dispatchOrientation();
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointerdown", 2, 200, 500);
        dispatchPointer("pointermove", 2, 200, 440);
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.z).toBe(0);
        expect(mockGl.domElement.setPointerCapture).not.toHaveBeenCalledWith(2);

        dispatchPointer("pointermove", 1, 420, 440);
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.z).toBeCloseTo(-1.5 * 0.02);
        expect(readLookAngles().y).toBeCloseTo(0);
        expect(readLookAngles().x).toBeCloseTo(0);
        dispatchPointer("pointerup", 1, 420, 440);
        const stoppedZ = mockController.position.z;
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.z).toBe(stoppedZ);

        dispatchPointer("pointerdown", 3, 200, 500);
        dispatchPointer("pointermove", 3, 260, 500);
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.x).toBeCloseTo(1.5 * 0.02);
        expect(mockGl.domElement.requestPointerLock).not.toHaveBeenCalled();
    });

    test("first valid sample releases old look touches before switching navigation", () => {
        render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointermove", 1, 480, 500);
        act(() => mockFrame({}, 0.02));
        const previousYaw = readLookAngles().y;
        expect(previousYaw).toBeLessThan(0);

        dispatchOrientation();
        expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
        dispatchPointer("pointermove", 1, 480, 440);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(previousYaw);
        expect(mockController.position.x).toBe(0);
        expect(mockController.position.z).toBe(0);
    });

    test("invalid sensor samples neither activate nor change look", () => {
        const statusChanged = jest.fn();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        dispatchOrientation(null, 90, 0);
        dispatchOrientation(0, NaN, 0);
        dispatchOrientation(0, 90, Infinity);
        expect(statusChanged).not.toHaveBeenCalledWith("active");
        dispatchOrientation();
        dispatchOrientation(30);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
        dispatchOrientation(undefined, null, NaN);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
    });

    test("permission is requested only explicitly and switches after valid data", async () => {
        const requestPermission = jest.fn().mockResolvedValue("granted");
        window.DeviceOrientationEvent.requestPermission = requestPermission;
        const navigationRef = React.createRef();
        const statusChanged = jest.fn();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        expect(statusChanged).toHaveBeenLastCalledWith("permission_required");
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointerup", 1, 420, 500);
        dispatchOrientation();
        expect(requestPermission).not.toHaveBeenCalled();
        expect(statusChanged).not.toHaveBeenCalledWith("active");

        await act(async () => navigationRef.current.enableGyroscope());
        expect(requestPermission).toHaveBeenCalledTimes(1);
        dispatchOrientation();
        expect(statusChanged).toHaveBeenLastCalledWith("active");
    });

    test.each(["denied", "error"])("%s permission keeps dual joystick fallback", async (result) => {
        const requestPermission = result === "error"
            ? jest.fn().mockRejectedValue(new Error("Permission blocked"))
            : jest.fn().mockResolvedValue("denied");
        window.DeviceOrientationEvent.requestPermission = requestPermission;
        const navigationRef = React.createRef();
        const statusChanged = jest.fn();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        await act(async () => navigationRef.current.enableGyroscope());
        expect(statusChanged).toHaveBeenLastCalledWith("denied");
        dispatchOrientation();
        dispatchOrientation(90);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(0);
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointermove", 1, 480, 500);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeLessThan(0);
        expect(mockController.position.x).toBe(0);
        expect(mockController.position.z).toBe(0);
    });

    test.each(["missing API", "insecure context"])("%s reports unavailable with touch fallback", (reason) => {
        if (reason === "missing API") {
            Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: undefined });
        } else {
            Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
        }
        const statusChanged = jest.fn();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        expect(statusChanged).toHaveBeenLastCalledWith("unavailable");
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointermove", 1, 480, 500);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeLessThan(0);
    });

    test("desktop remains keyboard and mouse controlled despite sensor APIs", () => {
        Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            collisionsEnabled={false}
            slowDownWhileFalling={false}
        />);
        dispatchOrientation();
        dispatchOrientation(90);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(0);
        dispatchPointer("pointerdown", 1, 200, 500, mockGl.domElement, "mouse");
        expect(mockGl.domElement.requestPointerLock).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: "ArrowUp" });
        act(() => mockFrame({}, 0.02));
        expect(mockController.position.z).toBeLessThan(0);
    });

    test("blur, visibility and rotation reanchor without resuming stale gestures", () => {
        render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchOrientation();
        dispatchOrientation(30);
        act(() => mockFrame({}, 0.02));
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointermove", 1, 420, 440);
        fireEvent(window, new Event("blur"));
        dispatchOrientation(90);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
        expect(mockController.position.z).toBe(0);
        dispatchOrientation(100);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(40 * Math.PI / 180);

        const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true);
        fireEvent(document, new Event("visibilitychange"));
        dispatchOrientation(150);
        hidden.mockReturnValue(false);
        fireEvent(document, new Event("visibilitychange"));
        dispatchOrientation(160);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(40 * Math.PI / 180);

        window.screen.orientation.angle = 90;
        fireEvent(window.screen.orientation, new Event("change"));
        dispatchOrientation(90, 0, -90);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(40 * Math.PI / 180);
        expect(readLookAngles().x).toBeCloseTo(0);
    });

    test("recenter and completed tours anchor the next sample to current pose", () => {
        const navigationRef = React.createRef();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            collisionsEnabled={false}
        />);
        dispatchOrientation();
        dispatchOrientation(30);
        act(() => mockFrame({}, 0.02));
        act(() => navigationRef.current.recenterGyroscope());
        dispatchOrientation(80);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);

        let snapshot;
        act(() => { snapshot = navigationRef.current.suspend(); });
        dispatchOrientation(160);
        act(() => navigationRef.current.restore(snapshot));
        dispatchOrientation(170);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);

        act(() => { snapshot = navigationRef.current.suspend(); });
        act(() => navigationRef.current.complete([0, 1.7, 0], [1, 1.7, 0], snapshot));
        dispatchOrientation(200);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(-Math.PI / 2);
        dispatchOrientation(210);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(-Math.PI / 2 + Math.PI / 18);
    });

    test("explicit recenter levels pitch while preserving heading and physical control", () => {
        const navigationRef = React.createRef();
        render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            collisionsEnabled={false}
        />);
        dispatchOrientation();
        dispatchOrientation(30, 120, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().x).toBeCloseTo(Math.PI / 6);
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);

        act(() => navigationRef.current.recenterGyroscope());
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().x).toBeCloseTo(0);
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
        dispatchOrientation(80, 130, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().x).toBeCloseTo(0);
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);

        dispatchOrientation(90, 140, 0);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().x).toBeCloseTo(Math.PI / 18);
        expect(readLookAngles().y).toBeCloseTo(40 * Math.PI / 180);
    });

    test("disable and mode changes remove sensors and reanchor when enabled", () => {
        const view = render(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchOrientation();
        dispatchOrientation(30);
        act(() => mockFrame({}, 0.02));
        view.rerender(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} enabled={false} />);
        dispatchOrientation(90);
        view.rerender(<ControllerHarness touchNavigationMode="gyroscope" collisionsEnabled={false} />);
        dispatchOrientation(160);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);

        view.rerender(<ControllerHarness touchNavigationMode="dual_joystick" collisionsEnabled={false} />);
        dispatchOrientation(220);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
        dispatchPointer("pointerdown", 1, 420, 500);
        dispatchPointer("pointermove", 1, 480, 500);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeLessThan(Math.PI / 6);
    });

    test("permission resolving after unmount cannot attach listeners or activate", async () => {
        let resolvePermission;
        window.DeviceOrientationEvent.requestPermission = jest.fn(() => new Promise((resolve) => {
            resolvePermission = resolve;
        }));
        const navigationRef = React.createRef();
        const statusChanged = jest.fn();
        const view = render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        let request;
        act(() => { request = navigationRef.current.enableGyroscope(); });
        view.unmount();
        statusChanged.mockClear();
        await act(async () => {
            resolvePermission("granted");
            await request;
        });
        dispatchOrientation();
        expect(statusChanged).not.toHaveBeenCalled();
    });

    test("permission resolving after disabling cannot activate motion", async () => {
        let resolvePermission;
        window.DeviceOrientationEvent.requestPermission = jest.fn(() => new Promise((resolve) => {
            resolvePermission = resolve;
        }));
        const navigationRef = React.createRef();
        const statusChanged = jest.fn();
        const view = render(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        />);
        let request;
        act(() => { request = navigationRef.current.enableGyroscope(); });
        view.rerender(<ControllerHarness
            touchNavigationMode="gyroscope"
            navigationRef={navigationRef}
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
            enabled={false}
        />);
        statusChanged.mockClear();
        await act(async () => {
            resolvePermission("granted");
            await request;
        });
        dispatchOrientation();
        expect(statusChanged).not.toHaveBeenCalled();
    });

    test("sensor timeout keeps touch fallback and can recover on late data", () => {
        jest.useFakeTimers();
        try {
            const statusChanged = jest.fn();
            const view = render(<ControllerHarness
                touchNavigationMode="gyroscope"
                onGyroscopeStatusChange={statusChanged}
                collisionsEnabled={false}
            />);
            expect(statusChanged).toHaveBeenLastCalledWith("waiting");
            act(() => jest.advanceTimersByTime(4000));
            expect(statusChanged).toHaveBeenLastCalledWith("unavailable");
            dispatchPointer("pointerdown", 1, 420, 500);
            dispatchPointer("pointermove", 1, 480, 500);
            act(() => mockFrame({}, 0.02));
            const previousYaw = readLookAngles().y;
            expect(previousYaw).toBeLessThan(0);
            dispatchOrientation();
            act(() => mockFrame({}, 0.02));
            expect(statusChanged).toHaveBeenLastCalledWith("active");
            expect(readLookAngles().y).toBeCloseTo(previousYaw);
            expect(mockGl.domElement.releasePointerCapture).toHaveBeenCalledWith(1);
            view.unmount();
        } finally {
            jest.useRealTimers();
        }
    });

    test("Strict Mode and rerenders keep only one active sensor subscription", () => {
        const statusChanged = jest.fn();
        const addListener = jest.spyOn(window, "addEventListener");
        const removeListener = jest.spyOn(window, "removeEventListener");
        const view = render(<React.StrictMode><ControllerHarness
            touchNavigationMode="gyroscope"
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        /></React.StrictMode>);
        dispatchOrientation();
        dispatchOrientation(30);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 6);
        view.rerender(<React.StrictMode><ControllerHarness
            touchNavigationMode="gyroscope"
            onGyroscopeStatusChange={statusChanged}
            collisionsEnabled={false}
        /></React.StrictMode>);
        dispatchOrientation(60);
        act(() => mockFrame({}, 0.02));
        expect(readLookAngles().y).toBeCloseTo(Math.PI / 3);
        view.unmount();
        const attached = addListener.mock.calls.filter(([eventName]) => eventName === "deviceorientation");
        const detached = removeListener.mock.calls.filter(([eventName]) => eventName === "deviceorientation");
        expect(attached.length).toBeGreaterThan(0);
        expect(detached.map(([, handler]) => handler)).toEqual(attached.map(([, handler]) => handler));
    });
});
