import * as THREE from "three";

// ### Constants ###

// Keep supported easing names explicit for validation.
export const HOUSEMAKER_EASINGS = Object.freeze([
    "none",
    "linear",
    "smoothstep",
    "smootherstep",
    "ease_in_quad",
    "ease_out_quad",
    "ease_in_out_sine",
    "ease_in_out_quad",
    "ease_in_out_cubic"
]);

const EASING_NAMES = new Set(HOUSEMAKER_EASINGS);
const ACTION_TYPES = new Set([
    "text3d",
    "speedOverride",
    "waitForKeyPress",
    "idleCameraAnimation",
    "floatingTooltip"
]);
const ROTATION_ORDERS = new Set(["XYZ", "YZX", "ZXY", "XZY", "YXZ", "ZYX"]);
const MOUSE_BUTTONS = Object.freeze({
    "mouse:left": 0,
    "mouse:middle": 1,
    "mouse:right": 2
});
const KEY_TOKENS = new Set([
    "key:space",
    "key:enter",
    "key:escape",
    "key:tab",
    "key:up",
    "key:down",
    "key:left",
    "key:right"
]);
const KEY_MATCHERS = Object.freeze({
    "key:space": [" ", "space", "spacebar"],
    "key:enter": ["enter", "numpadenter"],
    "key:escape": ["escape", "esc"],
    "key:tab": ["tab"],
    "key:up": ["arrowup", "up"],
    "key:down": ["arrowdown", "down"],
    "key:left": ["arrowleft", "left"],
    "key:right": ["arrowright", "right"]
});
const QT_KEY_TOKENS = new Map([
    [0x01000000, "key:escape"],
    [0x01000001, "key:tab"],
    [0x01000003, "key:backspace"],
    [0x01000004, "key:enter"],
    [0x01000005, "key:enter"],
    [0x01000006, "key:insert"],
    [0x01000007, "key:delete"],
    [0x01000008, "key:pause"],
    [0x01000009, "key:printscreen"],
    [0x0100000b, "key:clear"],
    [0x01000010, "key:home"],
    [0x01000011, "key:end"],
    [0x01000012, "key:left"],
    [0x01000013, "key:up"],
    [0x01000014, "key:right"],
    [0x01000015, "key:down"],
    [0x01000016, "key:pageup"],
    [0x01000017, "key:pagedown"],
    [0x01000020, "key:shift"],
    [0x01000021, "key:control"],
    [0x01000022, "key:meta"],
    [0x01000023, "key:alt"],
    [0x01000024, "key:capslock"],
    [0x01000025, "key:numlock"],
    [0x01000026, "key:scrolllock"]
]);
for (let functionKey = 1; functionKey <= 35; functionKey += 1) {
    QT_KEY_TOKENS.set(0x0100002f + functionKey, `key:f${functionKey}`);
}
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_FORWARD = new THREE.Vector3(0, 0, -1);
const PROGRESS_EPSILON = 1e-9;
const MAX_INTEGRATION_STEP_SECONDS = 1 / 120;

// ### Validation helpers ###

// Identify plain schema objects.
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Validate finite numeric schema values.
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

// Validate exported three-component vectors.
function isVector3Array(value) {
    return Array.isArray(value)
        && value.length === 3
        && value.every(isFiniteNumber);
}

// Convert supported positions without allocating unnecessarily.
function readPositionComponent(position, axis, index) {
    if (Array.isArray(position)) return position[index];
    return position?.[axis];
}

// Emit warnings through the supplied development logger.
function warnWith(warn, message) {
    if (typeof warn === "function") warn(message);
}

// Validate wait tokens before playback begins.
function isSupportedWaitToken(input) {
    if (input === "any" || Object.hasOwn(MOUSE_BUTTONS, input) || KEY_TOKENS.has(input)) {
        return true;
    }

    if (typeof input !== "string") return false;

    if (input.startsWith("key:")) {
        const printableCharacter = input.slice(4);
        return Array.from(printableCharacter).length === 1
            && printableCharacter >= " "
            && printableCharacter !== "\u007f";
    }

    return /^key_code:\d+$/.test(input);
}

// ### Action validation ###

// Parse shared action identity fields.
function getActionIdentity(action, context, warn) {
    if (!isObject(action) || typeof action.id !== "string" || action.id.trim() === "") {
        warnWith(warn, `HouseMaker ${context} has an action without a valid id.`);
        return undefined;
    }

    return action.id;
}

// Parse real 3D text actions.
function parseTextAction(action, context, warn) {
    const actionId = getActionIdentity(action, context, warn);
    const sizePoints = action.sizePoints ?? 12;
    const fadeDelayMs = action.fadeDelayMs ?? 0;
    const fadeDurationMs = action.fadeDurationMs ?? 2000;
    const rotationDegrees = action.rotationDegrees ?? [0, 0, 0];
    const rotationOrder = action.rotationOrder ?? "XYZ";

    if (
        !actionId
        || typeof action.text !== "string"
        || !isVector3Array(action.position)
        || !isFiniteNumber(sizePoints)
        || sizePoints <= 0
        || typeof action.color !== "string"
        || !isFiniteNumber(fadeDelayMs)
        || fadeDelayMs < 0
        || !isFiniteNumber(fadeDurationMs)
        || fadeDurationMs < 0
        || !isVector3Array(rotationDegrees)
        || !ROTATION_ORDERS.has(rotationOrder)
    ) {
        warnWith(warn, `HouseMaker ${context} has an invalid text3d action.`);
        return undefined;
    }

    return {
        id: actionId,
        type: action.type,
        text: action.text,
        position: new THREE.Vector3(...action.position),
        sizePoints,
        sizeMeters: sizePoints * 0.025,
        color: action.color,
        fadeDelayMs,
        fadeDurationMs,
        rotationDegrees: [...rotationDegrees],
        rotationOrder,
        quaternion: new THREE.Quaternion()
    };
}

// Parse interval speed actions.
function parseSpeedAction(action, context, warn) {
    const actionId = getActionIdentity(action, context, warn);
    const easing = action.easing ?? "none";

    if (
        !actionId
        || !isFiniteNumber(action.speed)
        || action.speed <= 0
        || !EASING_NAMES.has(easing)
    ) {
        warnWith(warn, `HouseMaker ${context} has an invalid speedOverride action.`);
        return undefined;
    }

    return {
        id: actionId,
        type: action.type,
        speed: action.speed,
        easing
    };
}

// Parse input wait actions.
function parseWaitAction(action, context, warn) {
    const actionId = getActionIdentity(action, context, warn);
    const easing = action.easing ?? "none";

    if (!actionId || !isSupportedWaitToken(action.input) || !EASING_NAMES.has(easing)) {
        warnWith(warn, `HouseMaker ${context} has an invalid waitForKeyPress action.`);
        return undefined;
    }

    return {
        id: actionId,
        type: action.type,
        input: action.input,
        easing
    };
}

// Parse wait-only idle camera actions.
function parseIdleAction(action, context, warn) {
    const actionId = getActionIdentity(action, context, warn);

    if (
        !actionId
        || !isVector3Array(action.pivotPoint)
        || !isFiniteNumber(action.radiusMeters)
        || action.radiusMeters < 0
        || !isFiniteNumber(action.cycleDurationSeconds)
        || action.cycleDurationSeconds <= 0
    ) {
        warnWith(warn, `HouseMaker ${context} has an invalid idleCameraAnimation action.`);
        return undefined;
    }

    return {
        id: actionId,
        type: action.type,
        pivotPoint: new THREE.Vector3(...action.pivotPoint),
        radiusMeters: action.radiusMeters,
        cycleDurationSeconds: action.cycleDurationSeconds
    };
}

// Parse floating tooltip actions.
function parseTooltipAction(action, context, warn) {
    const actionId = getActionIdentity(action, context, warn);

    if (
        !actionId
        || !isVector3Array(action.anchorPoint)
        || !["left", "right", "opposite"].includes(action.tooltipPosition)
        || typeof action.htmlBody !== "string"
        || typeof action.style !== "string"
    ) {
        warnWith(warn, `HouseMaker ${context} has an invalid floatingTooltip action.`);
        return undefined;
    }

    return {
        id: actionId,
        type: action.type,
        anchorPoint: new THREE.Vector3(...action.anchorPoint),
        tooltipPosition: action.tooltipPosition,
        htmlBody: action.htmlBody,
        style: action.style
    };
}

// Parse one known action without affecting its tour.
function parseAction(action, context, warn, unknownActionTypes) {
    const actionType = action?.type;

    if (!ACTION_TYPES.has(actionType)) {
        const warningKey = String(actionType);
        if (!unknownActionTypes.has(warningKey)) {
            unknownActionTypes.add(warningKey);
            warnWith(warn, `HouseMaker ${context} uses unknown action type "${warningKey}"; skipping it.`);
        }
        return undefined;
    }

    if (actionType === "text3d") return parseTextAction(action, context, warn);
    if (actionType === "speedOverride") return parseSpeedAction(action, context, warn);
    if (actionType === "waitForKeyPress") return parseWaitAction(action, context, warn);
    if (actionType === "idleCameraAnimation") return parseIdleAction(action, context, warn);
    return parseTooltipAction(action, context, warn);
}

// ### Schema validation ###

// Parse one tour step and isolate malformed actions.
function parseStep(step, stepIndex, tourId, warn, unknownActionTypes) {
    const context = `tour "${tourId}" step ${stepIndex}`;

    if (
        !isObject(step)
        || typeof step.id !== "string"
        || step.id.trim() === ""
        || !isFiniteNumber(step.progress)
        || step.progress < 0
        || step.progress > 1
        || !isVector3Array(step.cameraTarget)
    ) {
        warnWith(warn, `HouseMaker ${context} is invalid; skipping it.`);
        return undefined;
    }

    const rawActions = Array.isArray(step.actions) ? step.actions : [];
    const actionIds = new Set();
    const actions = [];

    rawActions.forEach((rawAction, actionIndex) => {
        const action = parseAction(
            rawAction,
            `${context} action ${actionIndex}`,
            warn,
            unknownActionTypes
        );

        if (!action) return;
        if (actionIds.has(action.id)) {
            warnWith(warn, `HouseMaker ${context} repeats action id "${action.id}"; skipping it.`);
            return;
        }

        actionIds.add(action.id);
        actions.push(action);
    });

    const actionsOfType = (type) => actions.filter((action) => action.type === type);
    const speedActions = actionsOfType("speedOverride");
    const waitActions = actionsOfType("waitForKeyPress");
    const idleActions = actionsOfType("idleCameraAnimation");

    if (speedActions.length > 1 || waitActions.length > 1 || idleActions.length > 1) {
        warnWith(warn, `HouseMaker ${context} has repeated playback actions; the last one wins.`);
    }

    return {
        id: step.id,
        manifestIndex: stepIndex,
        progress: step.progress,
        cameraTarget: new THREE.Vector3(...step.cameraTarget),
        actions,
        textActions: actionsOfType("text3d"),
        tooltipActions: actionsOfType("floatingTooltip"),
        speedAction: speedActions.at(-1),
        waitAction: waitActions.at(-1),
        idleAction: idleActions.at(-1)
    };
}

// Prepare one ordered playback event for every authored step.
function createStepGroups(steps) {
    return steps.map((step) => ({
        progress: step.progress,
        steps: [step],
        textActions: [...step.textActions],
        tooltipActions: [...step.tooltipActions],
        waitAction: step.waitAction,
        idleAction: step.waitAction ? step.idleAction : undefined
    }));
}

// Precompute interval speed transitions.
function createRateIntervals(stepGroups) {
    if (stepGroups.length === 0) {
        return [{
            startProgress: 0,
            endProgress: 1,
            startMultiplier: 1,
            targetMultiplier: 1,
            easing: "none"
        }];
    }

    const intervals = [];
    let previousTerminalMultiplier = 1;

    if (stepGroups[0].progress > 0) {
        intervals.push({
            startProgress: 0,
            endProgress: stepGroups[0].progress,
            startMultiplier: 1,
            targetMultiplier: 1,
            easing: "none"
        });
    }

    stepGroups.forEach((group, groupIndex) => {
        const finalStep = group.steps.at(-1);
        const targetMultiplier = finalStep.speedAction?.speed ?? 1;
        const easing = finalStep.waitAction?.easing
            ?? finalStep.speedAction?.easing
            ?? "none";

        intervals.push({
            startProgress: group.progress,
            endProgress: stepGroups[groupIndex + 1]?.progress ?? 1,
            startMultiplier: previousTerminalMultiplier,
            targetMultiplier,
            easing
        });
        previousTerminalMultiplier = targetMultiplier;
    });

    return intervals;
}

// Precompute text orientation at authored camera poses.
function prepareTextOrientations(tour) {
    const cameraPosition = new THREE.Vector3();

    tour.steps.forEach((step) => {
        tour.curve.getPoint(step.progress, cameraPosition);
        step.textActions.forEach((action) => {
            getTextQuaternion(
                action.position,
                cameraPosition,
                step.cameraTarget,
                action.rotationDegrees,
                action.rotationOrder,
                action.quaternion
            );
        });
    });
}

// Parse one defensively isolated tour.
function parseTour(rawTour, manifestIndex, warn, unknownActionTypes) {
    const context = `tour at index ${manifestIndex}`;

    if (
        !isObject(rawTour)
        || typeof rawTour.id !== "string"
        || rawTour.id.trim() === ""
        || !isFiniteNumber(rawTour.durationSeconds)
        || rawTour.durationSeconds <= 0
        || !isFiniteNumber(rawTour.progressSpeed)
        || rawTour.progressSpeed <= 0
    ) {
        warnWith(warn, `HouseMaker ${context} is invalid; skipping it.`);
        return undefined;
    }

    let triggerCenter;
    let triggerSize;

    if (rawTour.triggerArea !== undefined) {
        const triggerArea = rawTour.triggerArea;
        if (
            !isObject(triggerArea)
            || !isVector3Array(triggerArea.center)
            || !Array.isArray(triggerArea.sizeMeters)
            || triggerArea.sizeMeters.length !== 2
            || !triggerArea.sizeMeters.every((size) => isFiniteNumber(size) && size > 0)
            || triggerArea.horizontalAxes !== "xz"
        ) {
            warnWith(warn, `HouseMaker tour "${rawTour.id}" has an invalid trigger area; skipping it.`);
            return undefined;
        }
        triggerCenter = triggerArea.center;
        triggerSize = triggerArea.sizeMeters;
    } else if (isVector3Array(rawTour.triggerPoint)) {
        triggerCenter = rawTour.triggerPoint;
        triggerSize = [1.5, 1.5];
    } else {
        warnWith(warn, `HouseMaker tour "${rawTour.id}" has no valid trigger; skipping it.`);
        return undefined;
    }

    const rawCurve = rawTour.curve;
    const tension = rawCurve?.tension ?? 0.5;
    const validCurveType = rawCurve?.type?.toLowerCase() === "catmullrom"
        && rawCurve?.curveType?.toLowerCase() === "catmullrom";
    const validCurvePoints = Array.isArray(rawCurve?.points)
        && rawCurve.points.length >= 2
        && rawCurve.points.every(isVector3Array);

    if (
        !isObject(rawCurve)
        || !validCurveType
        || rawCurve.closed === true
        || !validCurvePoints
        || !isFiniteNumber(tension)
    ) {
        warnWith(warn, `HouseMaker tour "${rawTour.id}" has an invalid curve; skipping it.`);
        return undefined;
    }

    const stepIds = new Set();
    if (rawTour.steps !== undefined && !Array.isArray(rawTour.steps)) {
        warnWith(warn, `HouseMaker tour "${rawTour.id}" steps must be an array; ignoring them.`);
    }
    const rawSteps = Array.isArray(rawTour.steps) ? rawTour.steps : [];
    const steps = rawSteps
        .map((step, stepIndex) => parseStep(
            step,
            stepIndex,
            rawTour.id,
            warn,
            unknownActionTypes
        ))
        .filter((step) => {
            if (!step) return false;
            if (stepIds.has(step.id)) {
                warnWith(warn, `HouseMaker tour "${rawTour.id}" repeats step id "${step.id}"; skipping it.`);
                return false;
            }
            stepIds.add(step.id);
            return true;
        })
        .sort((left, right) => (
            left.progress - right.progress
            || left.manifestIndex - right.manifestIndex
        ));

    const curvePoints = rawCurve.points.map((point) => new THREE.Vector3(...point));
    const stepGroups = createStepGroups(steps);
    const tour = {
        id: rawTour.id,
        name: typeof rawTour.name === "string" ? rawTour.name : rawTour.id,
        manifestIndex,
        durationSeconds: rawTour.durationSeconds,
        progressSpeed: rawTour.progressSpeed,
        baseRate: rawTour.progressSpeed / rawTour.durationSeconds,
        trigger: {
            centerX: triggerCenter[0],
            centerZ: triggerCenter[2],
            halfWidth: triggerSize[0] / 2,
            halfDepth: triggerSize[1] / 2
        },
        curve: new THREE.CatmullRomCurve3(
            curvePoints,
            false,
            "catmullrom",
            tension
        ),
        steps,
        stepGroups,
        rateIntervals: createRateIntervals(stepGroups)
    };

    prepareTextOrientations(tour);
    return tour;
}

/**
 * Validates and precomputes HouseMaker tours without affecting model loading.
 * @param {object} manifest HouseMaker companion manifest.
 * @param {Function} warn Development warning callback.
 * @returns {Array<object>} Prepared tours in manifest order.
 */
export function parseHouseMakerTours(manifest, warn) {
    if (manifest?.tours === undefined || manifest?.tours === null) return [];
    if (!Array.isArray(manifest.tours)) {
        warnWith(warn, "HouseMaker manifest tours must be an array; ignoring tours.");
        return [];
    }

    const tourIds = new Set();
    const unknownActionTypes = new Set();
    const tours = [];

    manifest.tours.forEach((rawTour, manifestIndex) => {
        try {
            const tour = parseTour(rawTour, manifestIndex, warn, unknownActionTypes);
            if (!tour) return;
            if (tourIds.has(tour.id)) {
                warnWith(warn, `HouseMaker repeats tour id "${tour.id}"; skipping it.`);
                return;
            }
            tourIds.add(tour.id);
            tours.push(tour);
        } catch (error) {
            warnWith(
                warn,
                `HouseMaker tour at index ${manifestIndex} could not be parsed; skipping it. ${error.message}`
            );
        }
    });

    return tours;
}

// ### Trigger helpers ###

/** Creates mutable per-tour trigger state for a ref. */
export function createTourTriggerState(tours) {
    return {
        insideByTourId: new Map(tours.map((tour) => [tour.id, false]))
    };
}

/** Tests a local player position against an XZ trigger. */
export function isInsideTourTrigger(tour, playerPosition) {
    const playerX = readPositionComponent(playerPosition, "x", 0);
    const playerZ = readPositionComponent(playerPosition, "z", 2);

    if (!isFiniteNumber(playerX) || !isFiniteNumber(playerZ)) return false;

    return playerX >= tour.trigger.centerX - tour.trigger.halfWidth
        && playerX <= tour.trigger.centerX + tour.trigger.halfWidth
        && playerZ >= tour.trigger.centerZ - tour.trigger.halfDepth
        && playerZ <= tour.trigger.centerZ + tour.trigger.halfDepth;
}

/** Updates re-arm state and returns the first entered tour. */
export function findTriggeredTour(tours, triggerState, playerPosition, activeTourId) {
    let triggeredTour;

    tours.forEach((tour) => {
        const wasInside = triggerState.insideByTourId.get(tour.id) === true;
        const isInside = isInsideTourTrigger(tour, playerPosition);

        if (!activeTourId && !triggeredTour && isInside && !wasInside) {
            triggeredTour = tour;
        }

        triggerState.insideByTourId.set(tour.id, isInside);
    });

    return triggeredTour;
}

// ### Easing and rate helpers ###

/** Evaluates a supported HouseMaker easing curve. */
export function applyTourEasing(easing, value) {
    const progress = THREE.MathUtils.clamp(value, 0, 1);

    if (easing === "none") return 1;
    if (easing === "linear") return progress;
    if (easing === "smoothstep") return progress * progress * (3 - 2 * progress);
    if (easing === "smootherstep") {
        return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    }
    if (easing === "ease_in_quad") return progress * progress;
    if (easing === "ease_out_quad") return 1 - ((1 - progress) * (1 - progress));
    if (easing === "ease_in_out_sine") return -(Math.cos(Math.PI * progress) - 1) / 2;
    if (easing === "ease_in_out_quad") {
        return progress < 0.5
            ? 2 * progress * progress
            : 1 - (Math.pow(-2 * progress + 2, 2) / 2);
    }
    if (easing === "ease_in_out_cubic") {
        return progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - (Math.pow(-2 * progress + 2, 3) / 2);
    }

    return 1;
}

// Find the precomputed interval containing progress.
function getRateInterval(tour, progress) {
    const intervals = tour.rateIntervals;

    for (let index = intervals.length - 1; index >= 0; index -= 1) {
        if (progress + PROGRESS_EPSILON >= intervals[index].startProgress) {
            return intervals[index];
        }
    }

    return intervals[0];
}

/** Returns the current normalized progress-per-second rate. */
export function getTourProgressRate(tour, progress) {
    const interval = getRateInterval(tour, progress);
    const intervalLength = interval.endProgress - interval.startProgress;

    if (intervalLength <= PROGRESS_EPSILON || interval.easing === "none") {
        return tour.baseRate * interval.targetMultiplier;
    }

    const intervalProgress = (progress - interval.startProgress) / intervalLength;
    const easedProgress = applyTourEasing(interval.easing, intervalProgress);
    const multiplier = THREE.MathUtils.lerp(
        interval.startMultiplier,
        interval.targetMultiplier,
        easedProgress
    );

    return tour.baseRate * multiplier;
}

// Integrate a varying progress rate with Runge-Kutta.
function integrateProgress(tour, progress, deltaSeconds, boundary) {
    const finalIntervalSample = Math.max(progress, boundary - PROGRESS_EPSILON);
    const rateAt = (sampleProgress) => getTourProgressRate(
        tour,
        Math.min(sampleProgress, finalIntervalSample)
    );
    const firstRate = rateAt(progress);
    const secondRate = rateAt(progress + firstRate * deltaSeconds / 2);
    const thirdRate = rateAt(progress + secondRate * deltaSeconds / 2);
    const fourthRate = rateAt(progress + thirdRate * deltaSeconds);
    const nextProgress = progress + (
        deltaSeconds
        * (firstRate + 2 * secondRate + 2 * thirdRate + fourthRate)
        / 6
    );

    return Math.min(nextProgress, boundary);
}

// Find the slice time that reaches a boundary.
function findBoundaryTime(tour, progress, sliceSeconds, boundary) {
    let lowerTime = 0;
    let upperTime = sliceSeconds;

    for (let iteration = 0; iteration < 24; iteration += 1) {
        const middleTime = (lowerTime + upperTime) / 2;
        const middleProgress = integrateProgress(tour, progress, middleTime, boundary);

        if (middleProgress >= boundary - PROGRESS_EPSILON) {
            upperTime = middleTime;
        } else {
            lowerTime = middleTime;
        }
    }

    return upperTime;
}

// ### Playback helpers ###

/** Creates isolated playback state for one tour. */
export function createTourPlayback(tour) {
    return {
        tourId: tour.id,
        status: "idle",
        progress: 0,
        waiting: false,
        completed: false,
        activeWait: undefined,
        activeIdle: undefined,
        activeGroupIndex: -1,
        nextGroupIndex: 0,
        groupCount: tour.stepGroups.length,
        crossedGroups: []
    };
}

// Activate a distinct-progress step group.
function activateStepGroup(tour, playback, groupIndex) {
    const group = tour.stepGroups[groupIndex];

    playback.progress = group.progress;
    playback.activeGroupIndex = groupIndex;
    playback.nextGroupIndex = groupIndex + 1;
    playback.crossedGroups.push(group);

    if (group.waitAction) {
        playback.status = "waiting";
        playback.waiting = true;
        playback.activeWait = group.waitAction;
        playback.activeIdle = group.idleAction;
    } else if (
        group.progress >= 1 - PROGRESS_EPSILON
        && playback.nextGroupIndex >= playback.groupCount
    ) {
        completePlayback(playback);
    }
}

// Complete playback at the normalized endpoint.
function completePlayback(playback) {
    playback.progress = 1;
    playback.status = "completed";
    playback.waiting = false;
    playback.completed = true;
    playback.activeWait = undefined;
    playback.activeIdle = undefined;
}

/** Starts playback and processes actions at progress zero. */
export function startTourPlayback(tour, playback = createTourPlayback(tour)) {
    const startedPlayback = {
        ...playback,
        status: "playing",
        progress: 0,
        waiting: false,
        completed: false,
        activeWait: undefined,
        activeIdle: undefined,
        activeGroupIndex: -1,
        nextGroupIndex: 0,
        crossedGroups: []
    };

    while (
        startedPlayback.nextGroupIndex < tour.stepGroups.length
        && tour.stepGroups[startedPlayback.nextGroupIndex].progress <= PROGRESS_EPSILON
        && !startedPlayback.waiting
    ) {
        activateStepGroup(tour, startedPlayback, startedPlayback.nextGroupIndex);
    }

    return startedPlayback;
}

/** Resumes a held tour without including held wall time. */
export function resumeTourPlayback(playback) {
    if (!playback.waiting) return { ...playback, crossedGroups: [] };

    if (
        playback.progress >= 1 - PROGRESS_EPSILON
        && playback.nextGroupIndex >= playback.groupCount
    ) {
        const completedPlayback = { ...playback, crossedGroups: [] };
        completePlayback(completedPlayback);
        return completedPlayback;
    }

    return {
        ...playback,
        status: "playing",
        waiting: false,
        activeWait: undefined,
        activeIdle: undefined,
        crossedGroups: []
    };
}

/** Advances playback, returning every crossed group in order. */
export function advanceTourPlayback(tour, playback, deltaSeconds) {
    const advancedPlayback = { ...playback, crossedGroups: [] };

    if (
        advancedPlayback.status !== "playing"
        || !isFiniteNumber(deltaSeconds)
        || deltaSeconds <= 0
    ) {
        return advancedPlayback;
    }

    let remainingSeconds = deltaSeconds;

    while (!advancedPlayback.waiting && !advancedPlayback.completed) {
        const nextGroup = tour.stepGroups[advancedPlayback.nextGroupIndex];
        const boundary = nextGroup?.progress ?? 1;
        const boundaryIsReady = nextGroup
            && boundary <= advancedPlayback.progress + PROGRESS_EPSILON;

        if (remainingSeconds <= PROGRESS_EPSILON && !boundaryIsReady) break;

        if (boundary <= advancedPlayback.progress + PROGRESS_EPSILON) {
            if (nextGroup) {
                activateStepGroup(tour, advancedPlayback, advancedPlayback.nextGroupIndex);
                continue;
            }
            completePlayback(advancedPlayback);
            break;
        }

        const interval = getRateInterval(tour, advancedPlayback.progress);
        const constantRate = interval.easing === "none"
            || Math.abs(interval.startMultiplier - interval.targetMultiplier) <= PROGRESS_EPSILON;

        if (constantRate) {
            const rate = getTourProgressRate(tour, advancedPlayback.progress);
            const secondsToBoundary = (boundary - advancedPlayback.progress) / rate;

            if (remainingSeconds + PROGRESS_EPSILON >= secondsToBoundary) {
                advancedPlayback.progress = boundary;
                remainingSeconds = Math.max(0, remainingSeconds - secondsToBoundary);
            } else {
                advancedPlayback.progress += rate * remainingSeconds;
                remainingSeconds = 0;
            }
        } else {
            const sliceSeconds = Math.min(remainingSeconds, MAX_INTEGRATION_STEP_SECONDS);
            const integratedProgress = integrateProgress(
                tour,
                advancedPlayback.progress,
                sliceSeconds,
                boundary
            );

            if (integratedProgress >= boundary - PROGRESS_EPSILON) {
                const usedSeconds = findBoundaryTime(
                    tour,
                    advancedPlayback.progress,
                    sliceSeconds,
                    boundary
                );
                advancedPlayback.progress = boundary;
                remainingSeconds = Math.max(0, remainingSeconds - usedSeconds);
            } else {
                advancedPlayback.progress = integratedProgress;
                remainingSeconds -= sliceSeconds;
            }
        }

        if (advancedPlayback.progress >= boundary - PROGRESS_EPSILON) {
            advancedPlayback.progress = boundary;
            if (nextGroup) {
                activateStepGroup(tour, advancedPlayback, advancedPlayback.nextGroupIndex);
            } else {
                completePlayback(advancedPlayback);
            }
        }
    }

    return advancedPlayback;
}

// ### Camera helpers ###

/** Interpolates authored camera targets without allocating vectors. */
export function getCameraTargetAtProgress(
    tour,
    progress,
    output = new THREE.Vector3(),
    activeGroupIndex
) {
    const groups = tour.stepGroups;
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);

    if (groups.length === 0) return undefined;
    const activeGroup = groups[activeGroupIndex];
    if (
        activeGroup
        && Math.abs(activeGroup.progress - clampedProgress) <= PROGRESS_EPSILON
    ) {
        return output.copy(activeGroup.steps.at(-1).cameraTarget);
    }
    if (clampedProgress < groups[0].progress) {
        return output.copy(groups[0].steps.at(-1).cameraTarget);
    }

    let leftGroupIndex = groups.length - 1;
    for (let index = 0; index < groups.length - 1; index += 1) {
        if (clampedProgress < groups[index + 1].progress) {
            leftGroupIndex = index;
            break;
        }
    }

    const leftGroup = groups[leftGroupIndex];
    const rightGroup = groups[leftGroupIndex + 1];
    const leftTarget = leftGroup.steps.at(-1).cameraTarget;

    if (!rightGroup) return output.copy(leftTarget);

    const rightTarget = rightGroup.steps.at(-1).cameraTarget;
    const span = rightGroup.progress - leftGroup.progress;
    const interpolation = span <= PROGRESS_EPSILON
        ? 1
        : (clampedProgress - leftGroup.progress) / span;

    return output.copy(leftTarget).lerp(rightTarget, THREE.MathUtils.clamp(interpolation, 0, 1));
}

/** Evaluates curve position and target using getPoint semantics. */
export function getTourPose(tour, progress, output = {}, activeGroupIndex) {
    output.position ??= new THREE.Vector3();
    output.target ??= new THREE.Vector3();
    output.direction ??= new THREE.Vector3();

    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    tour.curve.getPoint(clampedProgress, output.position);

    const cameraTarget = getCameraTargetAtProgress(
        tour,
        clampedProgress,
        output.target,
        activeGroupIndex
    );
    if (!cameraTarget) {
        tour.curve.getTangent(clampedProgress, output.direction);
        if (output.direction.lengthSq() <= PROGRESS_EPSILON) {
            output.direction.copy(FALLBACK_FORWARD);
        } else {
            output.direction.normalize();
        }
        output.target.copy(output.position).add(output.direction);
        return output;
    }

    output.direction.subVectors(output.target, output.position);
    if (output.direction.lengthSq() <= PROGRESS_EPSILON) {
        tour.curve.getTangent(clampedProgress, output.direction);
        if (output.direction.lengthSq() <= PROGRESS_EPSILON) {
            output.direction.copy(FALLBACK_FORWARD);
        } else {
            output.direction.normalize();
        }
        output.target.copy(output.position).add(output.direction);
        return output;
    }

    output.direction.normalize();

    return output;
}

// ### Input helpers ###

// Normalize keyboard keys and codes for matching.
function getKeyboardValues(event) {
    return [event.key, event.code]
        .filter((value) => typeof value === "string")
        .map((value) => value.toLowerCase());
}

/** Matches one browser input event against an exported wait token. */
export function matchesWaitInput(input, event) {
    if (!event || event.repeat) return false;

    const eventType = String(event.type ?? "").toLowerCase();
    const keyboardValues = getKeyboardValues(event);
    const isKeyboardEvent = eventType === "keydown" || keyboardValues.length > 0;
    const isPointerEvent = ["pointerdown", "mousedown"].includes(eventType);

    if (input === "any") return isKeyboardEvent || isPointerEvent;

    if (Object.hasOwn(MOUSE_BUTTONS, input)) {
        if (!isPointerEvent) return false;
        if (eventType === "pointerdown" && event.pointerType && event.pointerType !== "mouse") {
            return false;
        }
        return event.button === MOUSE_BUTTONS[input];
    }

    if (!isKeyboardEvent) return false;

    if (KEY_TOKENS.has(input)) {
        return KEY_MATCHERS[input].some((value) => keyboardValues.includes(value));
    }

    if (typeof input === "string" && input.startsWith("key:")) {
        const printableCharacter = input.slice(4).toLowerCase();
        return keyboardValues.includes(printableCharacter);
    }

    const keyCodeMatch = /^key_code:(\d+)$/.exec(input);
    if (!keyCodeMatch) return false;

    const numericKeyCode = Number(keyCodeMatch[1]);
    const mappedToken = QT_KEY_TOKENS.get(numericKeyCode);
    if (mappedToken) return matchesWaitInput(mappedToken, event);

    return Number(event.keyCode ?? event.which) === numericKeyCode;
}

// ### Idle camera helpers ###

/** Derives a non-accumulating idle camera pose. */
export function getIdleCameraPose(
    basePosition,
    pivotPoint,
    radiusMeters,
    cycleDurationSeconds,
    elapsedSeconds,
    output = {}
) {
    output.position ??= new THREE.Vector3();
    output.target ??= new THREE.Vector3();
    output.forward ??= new THREE.Vector3();
    output.right ??= new THREE.Vector3();
    output.up ??= new THREE.Vector3();

    output.position.copy(basePosition);
    output.target.copy(pivotPoint);
    output.forward.subVectors(pivotPoint, basePosition);

    if (output.forward.lengthSq() <= PROGRESS_EPSILON) {
        output.forward.copy(FALLBACK_FORWARD);
    } else {
        output.forward.normalize();
    }

    output.right.crossVectors(output.forward, WORLD_UP);
    if (output.right.lengthSq() <= PROGRESS_EPSILON) {
        output.right.crossVectors(output.forward, FALLBACK_FORWARD);
    }
    if (output.right.lengthSq() <= PROGRESS_EPSILON) {
        output.right.set(1, 0, 0);
    } else {
        output.right.normalize();
    }
    output.up.crossVectors(output.right, output.forward).normalize();

    if (
        !isFiniteNumber(radiusMeters)
        || !isFiniteNumber(cycleDurationSeconds)
        || cycleDurationSeconds <= 0
        || !isFiniteNumber(elapsedSeconds)
    ) {
        return output;
    }

    const phase = (elapsedSeconds / cycleDurationSeconds) * Math.PI * 2;
    const horizontalOffset = radiusMeters * Math.sin(phase);
    const verticalOffset = 0.35 * radiusMeters * Math.sin(phase * 2);

    output.position.addScaledVector(output.right, horizontalOffset);
    output.position.addScaledVector(output.up, verticalOffset);
    return output;
}

// ### Text helpers ###

/** Orients text toward the authored camera, then applies rotation. */
export function getTextQuaternion(
    textPosition,
    cameraPosition,
    cameraTarget,
    rotationDegrees = [0, 0, 0],
    rotationOrder = "XYZ",
    output = new THREE.Quaternion()
) {
    const cameraForward = new THREE.Vector3().subVectors(cameraTarget, cameraPosition);
    if (cameraForward.lengthSq() <= PROGRESS_EPSILON) {
        cameraForward.copy(FALLBACK_FORWARD);
    } else {
        cameraForward.normalize();
    }

    const cameraRight = new THREE.Vector3().crossVectors(cameraForward, WORLD_UP);
    if (cameraRight.lengthSq() <= PROGRESS_EPSILON) {
        cameraRight.crossVectors(cameraForward, FALLBACK_FORWARD);
    }
    if (cameraRight.lengthSq() <= PROGRESS_EPSILON) {
        cameraRight.set(1, 0, 0);
    } else {
        cameraRight.normalize();
    }
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraForward).normalize();

    const textForward = new THREE.Vector3().subVectors(cameraPosition, textPosition);
    if (textForward.lengthSq() <= PROGRESS_EPSILON) {
        textForward.copy(cameraForward).negate();
    } else {
        textForward.normalize();
    }

    const textRight = new THREE.Vector3().crossVectors(cameraUp, textForward);
    if (textRight.lengthSq() <= PROGRESS_EPSILON) {
        textRight.copy(cameraRight);
    } else {
        textRight.normalize();
    }
    const textUp = new THREE.Vector3().crossVectors(textForward, textRight).normalize();
    const baseMatrix = new THREE.Matrix4().makeBasis(textRight, textUp, textForward);
    const staticRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(rotationDegrees[0]),
        THREE.MathUtils.degToRad(rotationDegrees[1]),
        THREE.MathUtils.degToRad(rotationDegrees[2]),
        rotationOrder
    ));

    return output.setFromRotationMatrix(baseMatrix).multiply(staticRotation).normalize();
}

