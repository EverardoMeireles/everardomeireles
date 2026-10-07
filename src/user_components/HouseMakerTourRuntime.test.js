import * as THREE from "three";
import {
    HOUSEMAKER_EASINGS,
    advanceTourPlayback,
    applyTourEasing,
    createTourPlayback,
    createTourTriggerState,
    findTriggeredTour,
    getCameraTargetAtProgress,
    getIdleCameraPose,
    getTextQuaternion,
    getTourPose,
    getTourProgressRate,
    isInsideTourTrigger,
    matchesWaitInput,
    parseHouseMakerTours,
    resumeTourPlayback,
    startTourPlayback
} from "./HouseMakerTourRuntime.js";

// ### Test data ###

// Build valid steps with concise overrides.
function makeStep(id, progress, overrides = {}) {
    return {
        id,
        progress,
        cameraTarget: [progress * 10, 0, -1],
        actions: [],
        ...overrides
    };
}

// Build valid tours with concise overrides.
function makeTour(id = "tour-a", overrides = {}) {
    const defaultCurve = {
        type: "catmullRom",
        curveType: "catmullrom",
        closed: false,
        tension: 0.5,
        points: [
            [0, 0, 0],
            [1, 2, 0],
            [4, -1, 0],
            [10, 0, 0]
        ]
    };

    const { curve: curveOverrides, ...tourOverrides } = overrides;

    return {
        id,
        name: id,
        durationSeconds: 10,
        progressSpeed: 1,
        triggerPoint: [0, 0, 0],
        triggerArea: {
            center: [0, 0, 0],
            sizeMeters: [2, 2],
            horizontalAxes: "xz"
        },
        steps: [],
        ...tourOverrides,
        curve: {
            ...defaultCurve,
            ...curveOverrides
        }
    };
}

// Parse one valid prepared tour.
function parseOne(rawTour = makeTour(), warn = jest.fn()) {
    return parseHouseMakerTours({ tours: [rawTour] }, warn)[0];
}

// Build valid playback actions.
function makeAction(id, type, overrides = {}) {
    if (type === "speedOverride") {
        return { id, type, speed: 2, easing: "none", ...overrides };
    }
    if (type === "waitForKeyPress") {
        return { id, type, input: "key:space", easing: "none", ...overrides };
    }
    if (type === "idleCameraAnimation") {
        return {
            id,
            type,
            pivotPoint: [0, 0, -1],
            radiusMeters: 0.08,
            cycleDurationSeconds: 8,
            ...overrides
        };
    }
    if (type === "text3d") {
        return {
            id,
            type,
            text: "Tour text",
            position: [0, 0, 0],
            sizePoints: 12,
            color: "#ffffff",
            fadeDelayMs: 0,
            fadeDurationMs: 1000,
            rotationDegrees: [0, 0, 0],
            rotationOrder: "XYZ",
            ...overrides
        };
    }
    return {
        id,
        type,
        anchorPoint: [0, 0, 0],
        tooltipPosition: "opposite",
        htmlBody: "<p>Tooltip</p>",
        style: "",
        ...overrides
    };
}

// ### Manifest validation ###

describe("HouseMaker tour manifest validation", () => {
    test("preserves backward compatibility without tours", () => {
        const warn = jest.fn();

        expect(parseHouseMakerTours({}, warn)).toEqual([]);
        expect(parseHouseMakerTours({ tours: [] }, warn)).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
    });

    test("isolates invalid tours and unknown actions", () => {
        const warn = jest.fn();
        const invalidTour = makeTour("broken", {
            curve: { points: [[0, 0, 0]] }
        });
        const unknownActionTour = makeTour("tour-b", {
            steps: [makeStep("step-b", 0.5, {
                actions: [
                    { id: "unknown-a", type: "futureAction" },
                    { id: "unknown-b", type: "futureAction" },
                    makeAction("tooltip", "floatingTooltip")
                ]
            })]
        });

        const tours = parseHouseMakerTours({
            tours: [makeTour("tour-a"), invalidTour, unknownActionTour]
        }, warn);

        expect(tours.map((tour) => tour.id)).toEqual(["tour-a", "tour-b"]);
        expect(tours[1].steps[0].actions).toHaveLength(1);
        expect(warn.mock.calls.filter(([message]) => message.includes("futureAction"))).toHaveLength(1);
    });

    test("uses the legacy trigger point fallback", () => {
        const tour = parseOne(makeTour("legacy", {
            triggerArea: undefined,
            triggerPoint: [3, 8, -2]
        }));

        expect(tour.trigger).toEqual({
            centerX: 3,
            centerZ: -2,
            halfWidth: 0.75,
            halfDepth: 0.75
        });
    });

    test("preserves stable manifest order for tied steps", () => {
        const tour = parseOne(makeTour("ties", {
            steps: [
                makeStep("later-source", 0.5),
                makeStep("earlier-progress", 0.25),
                makeStep("last-source", 0.5)
            ]
        }));

        expect(tour.steps.map((step) => step.id)).toEqual([
            "earlier-progress",
            "later-source",
            "last-source"
        ]);
        expect(tour.stepGroups.slice(1).map((group) => group.steps[0].id)).toEqual([
            "later-source",
            "last-source"
        ]);
    });
});

// ### Curves and camera targets ###

describe("HouseMaker curve and camera math", () => {
    test("matches Catmull-Rom endpoints and representative midpoint", () => {
        const tour = parseOne();
        const start = getTourPose(tour, 0);
        const middle = getTourPose(tour, 0.5);
        const end = getTourPose(tour, 1);

        expect(start.position.toArray()).toEqual([0, 0, 0]);
        expect(middle.position.x).toBeCloseTo(2.1875, 8);
        expect(middle.position.y).toBeCloseTo(0.5625, 8);
        expect(middle.position.z).toBeCloseTo(0, 8);
        expect(end.position.toArray()).toEqual([10, 0, 0]);
    });

    test("uses getPoint instead of arc-length getPointAt", () => {
        const tour = parseOne();
        const getPointAt = jest.spyOn(tour.curve, "getPointAt").mockImplementation(() => {
            throw new Error("getPointAt must not run");
        });

        const pose = getTourPose(tour, 0.5);

        expect(pose.position.toArray()).toEqual([2.1875, 0.5625, 0]);
        expect(getPointAt).not.toHaveBeenCalled();
    });

    test("interpolates and clamps camera targets", () => {
        const tour = parseOne(makeTour("targets", {
            steps: [
                makeStep("first", 0.25, { cameraTarget: [0, 0, 0] }),
                makeStep("last", 0.75, { cameraTarget: [10, 0, 0] })
            ]
        }));

        expect(getCameraTargetAtProgress(tour, 0.1).toArray()).toEqual([0, 0, 0]);
        expect(getCameraTargetAtProgress(tour, 0.5).toArray()).toEqual([5, 0, 0]);
        expect(getCameraTargetAtProgress(tour, 0.9).toArray()).toEqual([10, 0, 0]);
    });

    test("uses the final stable target at duplicate progress", () => {
        const tour = parseOne(makeTour("duplicate-targets", {
            steps: [
                makeStep("first", 0.5, { cameraTarget: [1, 0, 0] }),
                makeStep("second", 0.5, { cameraTarget: [2, 0, 0] }),
                makeStep("last", 1, { cameraTarget: [4, 0, 0] })
            ]
        }));

        expect(getCameraTargetAtProgress(tour, 0.5).toArray()).toEqual([2, 0, 0]);
        expect(getCameraTargetAtProgress(tour, 0.75).toArray()).toEqual([3, 0, 0]);
    });

    test("uses the curve tangent when no steps exist", () => {
        const tour = parseOne();
        const pose = getTourPose(tour, 0.5);
        const expectedDirection = tour.curve.getTangent(0.5).normalize();

        expect(pose.direction.distanceTo(expectedDirection)).toBeLessThan(1e-8);
        expect(pose.target.distanceTo(pose.position.clone().add(expectedDirection))).toBeLessThan(1e-8);
    });

    test("uses the curve tangent when a target equals camera position", () => {
        const tour = parseOne(makeTour("coincident-target", {
            curve: { points: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] },
            steps: [makeStep("start", 0, { cameraTarget: [0, 0, 0] })]
        }));
        const pose = getTourPose(tour, 0);

        expect(pose.direction.toArray()).toEqual([1, 0, 0]);
        expect(pose.target.toArray()).toEqual([1, 0, 0]);
    });
});

// ### Trigger transitions ###

describe("HouseMaker tour triggers", () => {
    test("includes horizontal boundaries without a vertical threshold", () => {
        const tour = parseOne();

        expect(isInsideTourTrigger(tour, [1, 1000, 1])).toBe(true);
        expect(isInsideTourTrigger(tour, [-1, -1000, -1])).toBe(true);
        expect(isInsideTourTrigger(tour, [1.001, 0, 0])).toBe(false);
    });

    test("activates on entry and rearms only after exit", () => {
        const tours = [parseOne()];
        const triggerState = createTourTriggerState(tours);

        expect(findTriggeredTour(tours, triggerState, [2, 0, 0])).toBeUndefined();
        expect(findTriggeredTour(tours, triggerState, [0, 0, 0])).toBe(tours[0]);
        expect(findTriggeredTour(tours, triggerState, [0.5, 0, 0])).toBeUndefined();
        expect(findTriggeredTour(tours, triggerState, [2, 0, 0])).toBeUndefined();
        expect(findTriggeredTour(tours, triggerState, [0, 0, 0])).toBe(tours[0]);
    });

    test("chooses manifest order for overlapping entries", () => {
        const tours = parseHouseMakerTours({
            tours: [makeTour("first"), makeTour("second")]
        }, jest.fn());
        const triggerState = createTourTriggerState(tours);

        expect(findTriggeredTour(tours, triggerState, [0, 0, 0])).toBe(tours[0]);
        expect(triggerState.insideByTourId.get("first")).toBe(true);
        expect(triggerState.insideByTourId.get("second")).toBe(true);
        expect(findTriggeredTour(tours, triggerState, [0, 0, 0])).toBeUndefined();
    });

    test("updates entry state while another tour is active", () => {
        const tours = parseHouseMakerTours({
            tours: [makeTour("first"), makeTour("second")]
        }, jest.fn());
        const triggerState = createTourTriggerState(tours);

        expect(findTriggeredTour(tours, triggerState, [0, 0, 0], "playing-tour")).toBeUndefined();
        expect(findTriggeredTour(tours, triggerState, [0, 0, 0])).toBeUndefined();
    });
});

// ### Easing and speed ###

describe("HouseMaker easing and speed profiles", () => {
    test.each([
        ["none", 1],
        ["linear", 0.25],
        ["smoothstep", 0.15625],
        ["smootherstep", 0.103515625],
        ["ease_in_quad", 0.0625],
        ["ease_out_quad", 0.4375],
        ["ease_in_out_sine", 0.1464466094],
        ["ease_in_out_quad", 0.125],
        ["ease_in_out_cubic", 0.0625]
    ])("evaluates %s easing", (easing, expected) => {
        expect(HOUSEMAKER_EASINGS).toContain(easing);
        expect(applyTourEasing(easing, 0.25)).toBeCloseTo(expected, 8);
    });

    test("uses progressSpeed divided by duration", () => {
        const tour = parseOne(makeTour("base-speed", {
            durationSeconds: 8,
            progressSpeed: 2
        }));

        expect(tour.baseRate).toBe(0.25);
        expect(getTourProgressRate(tour, 0.5)).toBe(0.25);
    });

    test("resets an override at the next ordinary step", () => {
        const tour = parseOne(makeTour("speed-reset", {
            steps: [
                makeStep("override", 0, {
                    actions: [makeAction("speed", "speedOverride", { speed: 2 })]
                }),
                makeStep("reset", 0.5)
            ]
        }));

        expect(getTourProgressRate(tour, 0)).toBeCloseTo(0.2, 8);
        expect(getTourProgressRate(tour, 0.49)).toBeCloseTo(0.2, 8);
        expect(getTourProgressRate(tour, 0.5)).toBeCloseTo(0.1, 8);
    });

    test("lets wait easing override speed easing at one step", () => {
        const tour = parseOne(makeTour("wait-easing", {
            steps: [makeStep("start", 0, {
                actions: [
                    makeAction("speed", "speedOverride", { easing: "ease_out_quad" }),
                    makeAction("wait", "waitForKeyPress", { easing: "smoothstep" })
                ]
            })]
        }));

        expect(tour.rateIntervals[0].targetMultiplier).toBe(2);
        expect(tour.rateIntervals[0].easing).toBe("smoothstep");
    });

    test("integrates a changing rate instead of easing wall-time progress", () => {
        const tour = parseOne(makeTour("integrated", {
            steps: [makeStep("start", 0, {
                actions: [makeAction("speed", "speedOverride", {
                    speed: 2,
                    easing: "linear"
                })]
            })]
        }));
        const started = startTourPlayback(tour, createTourPlayback(tour));
        const advanced = advanceTourPlayback(tour, started, 5);

        expect(advanced.progress).toBeCloseTo(Math.exp(0.5) - 1, 5);
    });
});

// ### Playback boundaries and waits ###

describe("HouseMaker playback boundaries", () => {
    test("processes every crossed group and tied step in order", () => {
        const tour = parseOne(makeTour("crossings", {
            steps: [
                makeStep("one", 0.1),
                makeStep("two-a", 0.2),
                makeStep("two-b", 0.2),
                makeStep("three", 0.3)
            ]
        }));
        const started = startTourPlayback(tour);
        const advanced = advanceTourPlayback(tour, started, 4);

        expect(advanced.progress).toBeCloseTo(0.4, 8);
        expect(advanced.crossedGroups.map((group) => (
            group.steps.map((step) => step.id)
        ))).toEqual([["one"], ["two-a"], ["two-b"], ["three"]]);
    });

    test("holds exactly on a wait at progress zero", () => {
        const tour = parseOne(makeTour("zero-wait", {
            steps: [makeStep("wait-step", 0, {
                actions: [makeAction("wait", "waitForKeyPress")]
            })]
        }));

        const started = startTourPlayback(tour);

        expect(started.status).toBe("waiting");
        expect(started.waiting).toBe(true);
        expect(started.completed).toBe(false);
        expect(started.progress).toBe(0);
        expect(started.activeWait.id).toBe("wait");
    });

    test("a tied earlier wait holds before later tied steps", () => {
        const tour = parseOne(makeTour("tied-wait", {
            steps: [
                makeStep("wait-first", 0.2, {
                    cameraTarget: [1, 0, 0],
                    actions: [makeAction("wait", "waitForKeyPress")]
                }),
                makeStep("after-wait", 0.2, { cameraTarget: [2, 0, 0] })
            ]
        }));
        const waiting = advanceTourPlayback(tour, startTourPlayback(tour), 3);

        expect(waiting.waiting).toBe(true);
        expect(waiting.crossedGroups.map((group) => group.steps[0].id))
            .toEqual(["wait-first"]);
        expect(getTourPose(
            tour,
            waiting.progress,
            {},
            waiting.activeGroupIndex
        ).target.toArray()).toEqual([1, 0, 0]);

        const resumed = advanceTourPlayback(
            tour,
            resumeTourPlayback(waiting),
            0.1
        );
        expect(resumed.crossedGroups.map((group) => group.steps[0].id))
            .toEqual(["after-wait"]);
        expect(resumed.progress).toBeGreaterThan(0.2);
    });

    test("drains tied steps when a frame lands exactly on their boundary", () => {
        const tour = parseOne(makeTour("exact-ties", {
            steps: [makeStep("first", 0.2), makeStep("second", 0.2)]
        }));
        const advanced = advanceTourPlayback(tour, startTourPlayback(tour), 2);

        expect(advanced.progress).toBeCloseTo(0.2, 8);
        expect(advanced.crossedGroups.map((group) => group.steps[0].id))
            .toEqual(["first", "second"]);
    });

    test("excludes all held time after resuming", () => {
        const tour = parseOne(makeTour("held-time", {
            steps: [makeStep("wait-step", 0, {
                actions: [makeAction("wait", "waitForKeyPress")]
            })]
        }));
        const started = startTourPlayback(tour);
        const held = advanceTourPlayback(tour, started, 10);
        const resumed = resumeTourPlayback(held);
        const advanced = advanceTourPlayback(tour, resumed, 1);

        expect(held.progress).toBe(0);
        expect(advanced.progress).toBeCloseTo(0.1, 8);
    });

    test("discards remaining frame time when crossing a wait", () => {
        const tour = parseOne(makeTour("cross-wait", {
            steps: [makeStep("wait-step", 0.2, {
                actions: [makeAction("wait", "waitForKeyPress")]
            })]
        }));
        const waiting = advanceTourPlayback(tour, startTourPlayback(tour), 5);

        expect(waiting.progress).toBeCloseTo(0.2, 8);
        expect(waiting.waiting).toBe(true);

        const resumed = resumeTourPlayback(waiting);
        const advanced = advanceTourPlayback(tour, resumed, 1);
        expect(advanced.progress).toBeCloseTo(0.3, 8);
    });

    test("marks normal endpoint completion clearly", () => {
        const tour = parseOne(makeTour("complete"));
        const completed = advanceTourPlayback(tour, startTourPlayback(tour), 20);

        expect(completed.status).toBe("completed");
        expect(completed.completed).toBe(true);
        expect(completed.waiting).toBe(false);
        expect(completed.progress).toBe(1);
    });

    test("processes a final step before completing", () => {
        const tour = parseOne(makeTour("final-step", {
            steps: [makeStep("last", 1)]
        }));
        const completed = advanceTourPlayback(tour, startTourPlayback(tour), 10);

        expect(completed.crossedGroups[0].steps[0].id).toBe("last");
        expect(completed.completed).toBe(true);
        expect(completed.progress).toBe(1);
    });

    test("processes every tied endpoint step before completion", () => {
        const tour = parseOne(makeTour("tied-final", {
            steps: [makeStep("first", 1), makeStep("second", 1)]
        }));
        const completed = advanceTourPlayback(tour, startTourPlayback(tour), 10);

        expect(completed.crossedGroups.map((group) => group.steps[0].id))
            .toEqual(["first", "second"]);
        expect(completed.completed).toBe(true);
    });

    test("resumes through remaining tied endpoint steps", () => {
        const tour = parseOne(makeTour("tied-final-wait", {
            steps: [
                makeStep("wait", 1, {
                    actions: [makeAction("wait", "waitForKeyPress")]
                }),
                makeStep("after", 1)
            ]
        }));
        const waiting = advanceTourPlayback(tour, startTourPlayback(tour), 10);
        const resumed = resumeTourPlayback(waiting);

        expect(resumed.completed).toBe(false);
        const completed = advanceTourPlayback(tour, resumed, 0.01);
        expect(completed.crossedGroups.map((group) => group.steps[0].id))
            .toEqual(["after"]);
        expect(completed.completed).toBe(true);
    });
});

// ### Input tokens ###

describe("HouseMaker wait input matching", () => {
    test.each([
        ["key:space", { type: "keydown", key: " ", code: "Space" }],
        ["key:enter", { type: "keydown", key: "Enter" }],
        ["key:escape", { type: "keydown", key: "Escape" }],
        ["key:tab", { type: "keydown", key: "Tab" }],
        ["key:up", { type: "keydown", key: "ArrowUp" }],
        ["key:down", { type: "keydown", key: "ArrowDown" }],
        ["key:left", { type: "keydown", key: "ArrowLeft" }],
        ["key:right", { type: "keydown", key: "ArrowRight" }],
        ["key:a", { type: "keydown", key: "A", code: "KeyA" }],
        ["mouse:left", { type: "pointerdown", pointerType: "mouse", button: 0 }],
        ["mouse:middle", { type: "pointerdown", pointerType: "mouse", button: 1 }],
        ["mouse:right", { type: "pointerdown", pointerType: "mouse", button: 2 }]
    ])("matches %s", (input, event) => {
        expect(matchesWaitInput(input, event)).toBe(true);
    });

    test("matches known Qt codes before numeric fallback", () => {
        expect(matchesWaitInput("key_code:16777216", {
            type: "keydown",
            key: "Escape",
            keyCode: 0
        })).toBe(true);
        expect(matchesWaitInput("key_code:16777235", {
            type: "keydown",
            key: "ArrowUp",
            keyCode: 0
        })).toBe(true);
        expect(matchesWaitInput("key_code:16777219", {
            type: "keydown",
            key: "Backspace",
            keyCode: 8
        })).toBe(true);
        expect(matchesWaitInput("key_code:16777268", {
            type: "keydown",
            key: "F5",
            keyCode: 116
        })).toBe(true);
        expect(matchesWaitInput("key_code:65", {
            type: "keydown",
            key: "a",
            keyCode: 65
        })).toBe(true);
    });

    test("ignores held keys and unrelated pointer input", () => {
        expect(matchesWaitInput("any", {
            type: "keydown",
            key: "a",
            repeat: true
        })).toBe(false);
        expect(matchesWaitInput("mouse:left", {
            type: "pointerdown",
            pointerType: "touch",
            button: 0
        })).toBe(false);
        expect(matchesWaitInput("mouse:right", {
            type: "pointerdown",
            pointerType: "mouse",
            button: 0
        })).toBe(false);
    });
});

// ### Idle camera ###

describe("HouseMaker idle camera pose", () => {
    test("derives offsets from the unchanged base pose", () => {
        const base = new THREE.Vector3(0, 0, 0);
        const pivot = new THREE.Vector3(0, 0, -1);
        const output = {};

        const quarterCycle = getIdleCameraPose(base, pivot, 0.08, 8, 2, output);
        expect(quarterCycle.position.x).toBeCloseTo(0.08, 8);
        expect(quarterCycle.position.y).toBeCloseTo(0, 8);
        expect(quarterCycle.position.z).toBeCloseTo(0, 8);

        const eighthCycle = getIdleCameraPose(base, pivot, 0.08, 8, 1, output);
        expect(eighthCycle.position.x).toBeCloseTo(Math.SQRT1_2 * 0.08, 8);
        expect(eighthCycle.position.y).toBeCloseTo(0.028, 8);
        expect(base.toArray()).toEqual([0, 0, 0]);

        const fullCycle = getIdleCameraPose(base, pivot, 0.08, 8, 8, output);
        expect(fullCycle.position.distanceTo(base)).toBeLessThan(1e-8);
    });

    test("associates idle motion only with a same-step wait", () => {
        const idle = makeAction("idle", "idleCameraAnimation");
        const withWait = parseOne(makeTour("idle-wait", {
            steps: [makeStep("step", 0, {
                actions: [makeAction("wait", "waitForKeyPress"), idle]
            })]
        }));
        const withoutWait = parseOne(makeTour("idle-no-wait", {
            steps: [makeStep("step", 0, { actions: [idle] })]
        }));

        expect(startTourPlayback(withWait).activeIdle.id).toBe("idle");
        expect(withoutWait.stepGroups[0].idleAction).toBeUndefined();
        expect(resumeTourPlayback(startTourPlayback(withWait)).activeIdle).toBeUndefined();
    });
});

// ### Text orientation and fades ###

describe("HouseMaker text math", () => {
    test("faces the authored camera before applying XYZ rotation", () => {
        const textPosition = new THREE.Vector3(0, 0, 0);
        const cameraPosition = new THREE.Vector3(0, 0, 5);
        const cameraTarget = new THREE.Vector3(0, 0, 0);
        const front = new THREE.Vector3(0, 0, 1);

        const baseQuaternion = getTextQuaternion(
            textPosition,
            cameraPosition,
            cameraTarget,
            [0, 0, 0],
            "XYZ"
        );
        expect(front.clone().applyQuaternion(baseQuaternion).distanceTo(
            new THREE.Vector3(0, 0, 1)
        )).toBeLessThan(1e-8);

        const rotatedQuaternion = getTextQuaternion(
            textPosition,
            cameraPosition,
            cameraTarget,
            [0, 90, 0],
            "XYZ"
        );
        expect(front.clone().applyQuaternion(rotatedQuaternion).distanceTo(
            new THREE.Vector3(1, 0, 0)
        )).toBeLessThan(1e-8);
    });

    test("precomputes text size and authored orientation", () => {
        const tour = parseOne(makeTour("prepared-text", {
            steps: [makeStep("text-step", 0, {
                cameraTarget: [0, 0, -1],
                actions: [makeAction("text", "text3d", { sizePoints: 20 })]
            })]
        }));
        const action = tour.steps[0].textActions[0];

        expect(action.sizeMeters).toBe(0.5);
        expect(action.quaternion).toBeInstanceOf(THREE.Quaternion);
        expect(action.quaternion.length()).toBeCloseTo(1, 8);
    });

});

// ### Multiple tours ###

describe("HouseMaker multiple-tour state", () => {
    test("keeps playback mutable state isolated by tour", () => {
        const tours = parseHouseMakerTours({
            tours: [makeTour("first"), makeTour("second")]
        }, jest.fn());
        const firstPlayback = advanceTourPlayback(
            tours[0],
            startTourPlayback(tours[0]),
            1
        );
        const secondPlayback = startTourPlayback(tours[1]);

        expect(firstPlayback.tourId).toBe("first");
        expect(firstPlayback.progress).toBeCloseTo(0.1, 8);
        expect(secondPlayback.tourId).toBe("second");
        expect(secondPlayback.progress).toBe(0);
    });
});
