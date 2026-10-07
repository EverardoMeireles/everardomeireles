// ### Imports ###

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
    advanceTourPlayback,
    createTourPlayback,
    createTourTriggerState,
    findTriggeredTour,
    getIdleCameraPose,
    getTourPose,
    matchesWaitInput,
    parseHouseMakerTours,
    resumeTourPlayback,
    startTourPlayback
} from "./HouseMakerTourRuntime.js";
import {
    TourTextActions,
    TourTooltipActions
} from "./HouseMakerTourActions.jsx";

// ### Constants ###

const EMPTY_ACTIONS = Object.freeze({
    progress: undefined,
    currentText: [],
    outgoingText: [],
    tooltips: []
});
const MANIFEST_WARNINGS = new WeakMap();

// Avoid repeating validation warnings during StrictMode remounts.
function warnForManifestOnce(manifest, message) {
    if (!manifest || typeof manifest !== "object") {
        console.warn(message);
        return;
    }

    let warnings = MANIFEST_WARNINGS.get(manifest);
    if (!warnings) {
        warnings = new Set();
        MANIFEST_WARNINGS.set(manifest, warnings);
    }
    if (warnings.has(message)) return;
    warnings.add(message);
    console.warn(message);
}

// ### Camera helpers ###

// Create reusable camera conversion values.
function createCameraScratch() {
    return {
        lookMatrix: new THREE.Matrix4(),
        parentQuaternion: new THREE.Quaternion(),
        worldQuaternion: new THREE.Quaternion(),
        localPosition: new THREE.Vector3()
    };
}

// Apply an exact world transform to a possibly nested camera.
export function applyCameraWorldTransform(camera, worldPosition, worldQuaternion, scratch) {
    if (!camera || !worldPosition?.isVector3 || !worldQuaternion?.isQuaternion) return false;

    const values = scratch ?? createCameraScratch();
    const parent = camera.parent;

    if (parent) {
        parent.updateWorldMatrix(true, false);
        values.localPosition.copy(worldPosition);
        parent.worldToLocal(values.localPosition);
        parent.getWorldQuaternion(values.parentQuaternion).invert();
        camera.position.copy(values.localPosition);
        camera.quaternion.copy(values.parentQuaternion).multiply(worldQuaternion);
    } else {
        camera.position.copy(worldPosition);
        camera.quaternion.copy(worldQuaternion);
    }

    camera.updateMatrixWorld(true);
    return true;
}

// Aim a possibly nested camera using world-space values.
export function applyCameraWorldPose(camera, worldPosition, worldTarget, worldUp, scratch) {
    if (
        !camera
        || !worldPosition?.isVector3
        || !worldTarget?.isVector3
        || !worldUp?.isVector3
    ) {
        return false;
    }

    const values = scratch ?? createCameraScratch();
    values.lookMatrix.lookAt(worldPosition, worldTarget, worldUp);
    values.worldQuaternion.setFromRotationMatrix(values.lookMatrix);
    return applyCameraWorldTransform(
        camera,
        worldPosition,
        values.worldQuaternion,
        values
    );
}

// Suspend generic controls and retain their exact state.
export function suspendFallbackNavigation(camera, controls) {
    if (!camera) return undefined;

    camera.updateWorldMatrix(true, false);
    const snapshot = {
        cameraPosition: camera.getWorldPosition(new THREE.Vector3()),
        cameraQuaternion: camera.getWorldQuaternion(new THREE.Quaternion()),
        cameraUp: camera.up.clone(),
        controls,
        controlsEnabled: controls?.enabled,
        controlsTarget: controls?.target?.clone?.()
    };

    if (controls && "enabled" in controls) controls.enabled = false;
    return snapshot;
}

// Restore generic controls after cancellation.
export function restoreFallbackNavigation(camera, snapshot, restoreCamera = true) {
    if (!snapshot) return;

    if (restoreCamera) {
        applyCameraWorldTransform(
            camera,
            snapshot.cameraPosition,
            snapshot.cameraQuaternion
        );
        if (snapshot.cameraUp) camera.up.copy(snapshot.cameraUp);
    }

    if (snapshot.controlsTarget && snapshot.controls?.target?.copy) {
        snapshot.controls.target.copy(snapshot.controlsTarget);
    }
    snapshot.controls?.update?.();
    if (snapshot.controls && "enabled" in snapshot.controls) {
        snapshot.controls.enabled = snapshot.controlsEnabled;
    }
}

// Synchronize generic controls with a completed tour pose.
export function completeFallbackNavigation(
    camera,
    worldPosition,
    worldTarget,
    worldUp,
    snapshot,
    applyCamera = true
) {
    if (!snapshot) return;

    if (applyCamera) {
        applyCameraWorldPose(camera, worldPosition, worldTarget, worldUp);
        camera.up.copy(worldUp);
    }
    if (snapshot.controls?.target?.copy) snapshot.controls.target.copy(worldTarget);
    snapshot.controls?.update?.();
    if (snapshot.controls && "enabled" in snapshot.controls) {
        snapshot.controls.enabled = snapshot.controlsEnabled;
    }
}

// ### Action helpers ###

// Transition visible actions at one crossed authored step.
export function transitionTourActions(previous, group) {
    const currentText = group.textActions.map((action, actionIndex) => ({
        action,
        key: `${group.progress}-${group.steps[0].id}-${actionIndex}-${action.id}`,
        position: action.position,
        quaternion: action.quaternion,
        phase: "current"
    }));
    const currentTooltips = group.tooltipActions.map((action, actionIndex) => ({
        ...action,
        renderKey: `${group.progress}-${group.steps[0].id}-${actionIndex}-${action.id}`
    }));

    // Same-progress steps append only after earlier waits resume.
    if (previous.progress === group.progress) {
        return {
            ...previous,
            currentText: [...previous.currentText, ...currentText],
            tooltips: [...previous.tooltips, ...currentTooltips]
        };
    }

    return {
        progress: group.progress,
        currentText,
        outgoingText: previous.currentText.map((record) => ({
            ...record,
            phase: "outgoing"
        })),
        tooltips: currentTooltips
    };
}

// Fade remaining text while removing completed-tour hotspots.
export function completeTourActions(currentActions) {
    return {
        ...EMPTY_ACTIONS,
        outgoingText: [
            ...currentActions.outgoingText,
            ...currentActions.currentText.map((record) => ({
                ...record,
                phase: "outgoing"
            }))
        ]
    };
}

// Publish a crossed action boundary without frame-rate state updates.
function publishActionGroup(setActions, group) {
    setActions((previous) => transitionTourActions(previous, group));
}

// Identify interactions owned by a tour tooltip.
function isTourInteraction(event) {
    return event.composedPath?.().some((node) => (
        node?.dataset?.housemakerTourInteraction === "true"
        || node?.dataset?.housemakerTooltipInteraction === "true"
    )) === true;
}

// Allow only explicitly configured tooltip-originated inputs.
function isExplicitInteractionInput(input, event) {
    if (input === "any") return false;
    if (event.type === "pointerdown") return input.startsWith("mouse:");
    if (event.type === "keydown") return input.startsWith("key:") || input.startsWith("key_code:");
    return false;
}

// ### Component ###

/**
 * Purpose: Plays validated HouseMaker tours inside the loader's transform root.
 * Relationships: HouseMakerLoader supplies its existing manifest, root, and navigation bridge.
 * Example:
 * <HouseMakerTourPlayer manifest={sceneData} rootRef={rootRef} navigationRef={navigationRef} />
 */
export function HouseMakerTourPlayer(props) {
    const { manifest, manifestUrl, navigationRef, rootRef } = props;
    const { enabled = true } = props;
    const camera = useThree((state) => state.camera);
    const controls = useThree((state) => state.controls);

    // Validate once for each loaded companion manifest.
    const tours = useMemo(() => parseHouseMakerTours(
        manifest,
        process.env.NODE_ENV === "production"
            ? () => {}
            : (message) => warnForManifestOnce(manifest, message)
    ), [manifest]);

    // Keep playback and frame values outside React state.
    const activeTourRef = useRef();
    const triggerStateRef = useRef(createTourTriggerState(tours));
    const scratchRef = useRef({
        playerWorld: new THREE.Vector3(),
        playerLocal: new THREE.Vector3(),
        localPose: {
            position: new THREE.Vector3(),
            target: new THREE.Vector3(),
            direction: new THREE.Vector3()
        },
        idlePose: {
            position: new THREE.Vector3(),
            target: new THREE.Vector3(),
            forward: new THREE.Vector3(),
            right: new THREE.Vector3(),
            up: new THREE.Vector3()
        },
        worldPosition: new THREE.Vector3(),
        worldTarget: new THREE.Vector3(),
        worldUp: new THREE.Vector3(),
        camera: createCameraScratch()
    });
    const [actions, setActions] = useState(EMPTY_ACTIONS);
    const [waitInput, setWaitInput] = useState();

    // Remove outgoing text after its material reaches zero.
    function handleTextFadeComplete(recordKey, phase) {
        if (phase !== "outgoing") return;

        setActions((currentActions) => ({
            ...currentActions,
            outgoingText: currentActions.outgoingText.filter((record) => (
                record.key !== recordKey
            ))
        }));
    }

    // Convert the current tour pose through the loader root.
    function applyActiveTourPose(activeTour) {
        const root = rootRef.current;
        if (!activeTour || !root) return false;

        const scratch = scratchRef.current;
        getTourPose(
            activeTour.tour,
            activeTour.playback.progress,
            scratch.localPose,
            activeTour.playback.activeGroupIndex
        );

        let localPosition = scratch.localPose.position;
        let localTarget = scratch.localPose.target;
        if (activeTour.playback.waiting && activeTour.playback.activeIdle) {
            const idle = activeTour.playback.activeIdle;
            getIdleCameraPose(
                scratch.localPose.position,
                idle.pivotPoint,
                idle.radiusMeters,
                idle.cycleDurationSeconds,
                activeTour.waitElapsed,
                scratch.idlePose
            );
            localPosition = scratch.idlePose.position;
            localTarget = scratch.idlePose.target;
        }

        root.updateWorldMatrix(true, false);
        scratch.worldPosition.copy(localPosition);
        scratch.worldTarget.copy(localTarget);
        root.localToWorld(scratch.worldPosition);
        root.localToWorld(scratch.worldTarget);
        scratch.worldUp.set(0, 1, 0).transformDirection(root.matrixWorld);

        applyCameraWorldPose(
            camera,
            scratch.worldPosition,
            scratch.worldTarget,
            scratch.worldUp,
            scratch.camera
        );
        return true;
    }

    // Restore navigation and discard the active runtime state.
    function cancelActiveTour() {
        const activeTour = activeTourRef.current;
        if (!activeTour) return;

        const bridgeRestored = activeTour.navigation?.restore?.(
            activeTour.navigationSnapshot
        ) === true;
        restoreFallbackNavigation(
            camera,
            activeTour.fallbackSnapshot,
            !bridgeRestored
        );
        activeTourRef.current = undefined;
    }

    // Adopt the last pose and restore prior control availability.
    function completeActiveTour(activeTour) {
        const scratch = scratchRef.current;
        const bridgeCompleted = activeTour.navigation?.complete?.(
            scratch.worldPosition,
            scratch.worldTarget,
            activeTour.navigationSnapshot
        ) === true;
        completeFallbackNavigation(
            camera,
            scratch.worldPosition,
            scratch.worldTarget,
            scratch.worldUp,
            activeTour.fallbackSnapshot,
            !bridgeCompleted
        );
        activeTourRef.current = undefined;
        setActions(completeTourActions);
        setWaitInput(undefined);
    }

    // Replace per-manifest trigger state and cancel stale playback.
    useEffect(() => {
        triggerStateRef.current = createTourTriggerState(tours);
        setActions(EMPTY_ACTIONS);
        setWaitInput(undefined);

        return () => cancelActiveTour();
        // The loaded manifest identity intentionally owns this lifecycle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tours]);

    // Cancelling runtime mode restores the saved pre-tour pose.
    useEffect(() => {
        if (enabled) return;
        cancelActiveTour();
        setActions(EMPTY_ACTIONS);
        setWaitInput(undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Listen only while an authored wait is active.
    useEffect(() => {
        if (!waitInput) return undefined;

        const handleWaitInput = (event) => {
            const activeTour = activeTourRef.current;
            if (!activeTour?.playback.waiting) return;
            if (
                isTourInteraction(event)
                && !isExplicitInteractionInput(waitInput, event)
            ) {
                return;
            }
            if (!matchesWaitInput(waitInput, event)) return;

            activeTour.playback = resumeTourPlayback(activeTour.playback);
            activeTour.waitElapsed = 0;
            setWaitInput(undefined);
            applyActiveTourPose(activeTour);
        };

        window.addEventListener("keydown", handleWaitInput, true);
        window.addEventListener("pointerdown", handleWaitInput, true);

        return () => {
            window.removeEventListener("keydown", handleWaitInput, true);
            window.removeEventListener("pointerdown", handleWaitInput, true);
        };
        // Recreate listeners only for a different authored wait token.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waitInput]);

    // Drive triggers and the active camera without per-frame React updates.
    useFrame((_, delta) => {
        if (!enabled || tours.length === 0 || !rootRef.current) return;

        const scratch = scratchRef.current;
        const navigation = navigationRef?.current;
        const playerPosition = navigation?.getPlayerPosition?.(scratch.playerWorld)
            ?? camera.getWorldPosition(scratch.playerWorld);

        rootRef.current.updateWorldMatrix(true, false);
        scratch.playerLocal.copy(playerPosition);
        rootRef.current.worldToLocal(scratch.playerLocal);

        const currentActive = activeTourRef.current;
        const triggeredTour = findTriggeredTour(
            tours,
            triggerStateRef.current,
            scratch.playerLocal,
            currentActive?.tour.id
        );

        if (!currentActive && triggeredTour) {
            const activeTour = {
                tour: triggeredTour,
                playback: startTourPlayback(
                    triggeredTour,
                    createTourPlayback(triggeredTour)
                ),
                navigation,
                navigationSnapshot: navigation?.suspend?.(),
                fallbackSnapshot: suspendFallbackNavigation(camera, controls),
                waitElapsed: 0
            };
            activeTourRef.current = activeTour;
            setActions(EMPTY_ACTIONS);
            activeTour.playback.crossedGroups.forEach((group) => {
                publishActionGroup(setActions, group);
            });
            setWaitInput(activeTour.playback.activeWait?.input);
            applyActiveTourPose(activeTour);
            return;
        }

        const activeTour = activeTourRef.current;
        if (!activeTour) return;

        if (activeTour.playback.waiting) {
            activeTour.waitElapsed += Math.max(0, delta);
        } else {
            activeTour.playback = advanceTourPlayback(
                activeTour.tour,
                activeTour.playback,
                Math.max(0, delta)
            );
            activeTour.playback.crossedGroups.forEach((group) => {
                publishActionGroup(setActions, group);
            });
            if (activeTour.playback.waiting) {
                activeTour.waitElapsed = 0;
                setWaitInput(activeTour.playback.activeWait?.input);
            }
        }

        applyActiveTourPose(activeTour);
        if (activeTour.playback.completed) completeActiveTour(activeTour);
    });

    // ### Render ###

    return (
        <>
            <TourTextActions
                records={[...actions.outgoingText, ...actions.currentText]}
                onFadeComplete={handleTextFadeComplete}
            />
            <TourTooltipActions
                actions={actions.tooltips}
                manifestUrl={manifestUrl}
                activeWaitInput={waitInput}
                camera={camera}
            />
        </>
    );
}
