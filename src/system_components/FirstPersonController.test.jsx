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
