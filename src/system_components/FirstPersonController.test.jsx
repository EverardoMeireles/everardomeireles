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

beforeEach(() => {
    mockScene = new THREE.Scene();
    mockGl = { domElement: document.createElement("canvas") };
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
