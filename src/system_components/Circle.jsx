import React, { useEffect, useRef } from 'react';
import '../PulsatingAnimation.css'; // Adjust the path as necessary
import SystemStore from "../SystemStore";

/**
 * Purpose: Renders a screen-space circle over a projected object.
 * Relationships: Created by SceneViewer from SystemStore circlesData and reports hover state through currentCircleNameSelected.
 * Example:
 * <Circle circleName = "Lamp" circleIsVisible = {true} circleSize = {30} playPulseAnimation = {false} position = {[50, 50]} />
 * @param {string} [circleName] - Circle name.
 * @param {boolean} [circleIsVisible] - Whether to show the circles or not.
 * @param {number} [circleSize] - Size of the circle.
 * @param {boolean} [playPulseAnimation] - Whether to pulse animation.
 * @param {Array<any>} [position] - Position in the scene.
 * @param {boolean} [housemakerTourCircle] - Enables tour interaction behavior.
 * @param {string} [ariaLabel] - Accessible tour circle label.
 */
export const Circle = (props) => {
    const {circleName = ""} = props;
    const {circleIsVisible = false} = props;
    const {circleSize = 30} = props;
    const {playPulseAnimation = false} = props;
    const {position = [0, 0]} = props;
    const {housemakerTourCircle = false} = props;
    const {ariaLabel = undefined} = props;

    const setCircleProperties = SystemStore((state) => state.setCircleProperties);
    const setCurrentCircleNameSelected = SystemStore((state) => state.setCurrentCircleNameSelected);
    const circleProperties = SystemStore((state) => state.circleProperties);
    const currentCircleNameSelected = SystemStore((state) => state.currentCircleNameSelected);
    const viewerBounds = SystemStore((state) => state.viewerBounds);
    const circleElementRef = useRef();
    const interactionState = useRef({ hovered: false, focused: false });

    // Describe the current tour circle interaction state.
    const circleIsPinned = circleProperties.pinnedCircleName === circleName;
    const circleIsSelected = circleProperties.active && currentCircleNameSelected === circleName;
    const accessibleLabel = ariaLabel || (circleName
        ? `Show ${circleName} tooltip`
        : "Show tour tooltip");

    // Converts the circle's percentage position into real screen pixels.
    const computedPositionLeft = viewerBounds.left + (viewerBounds.width * (position[0] / 100));
    const computedPositionTop = viewerBounds.top + (viewerBounds.height * (position[1] / 100));

    const circleStyle = {
        position: 'fixed',
        left: `${computedPositionLeft}px`,
        top: `${computedPositionTop}px`,
        width: `${circleSize}px`,
        height: `${circleSize}px`,
        transform: housemakerTourCircle ? 'translate(-50%, -50%)' : undefined,
        borderRadius: '50%',
        cursor: 'pointer',
        zIndex: 900,
        opacity: circleIsVisible ? 1 : 0,
        transition: 'opacity 1s ease-in',
        background: 'radial-gradient(circle, rgba(255,255,255,1) 20%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 60%)',
        animation: playPulseAnimation ?'pulsate 2s infinite ease-in-out' : "",
        boxShadow: '0 0 10px 10px rgba(255, 255, 255, 0.5), 0 0 15px 15px rgba(255, 255, 255, 0.3), 0 0 20px 20px rgba(255, 255, 255, 0.1)',
        pointerEvents: circleIsVisible ? 'auto' : 'none',
    };

    // Select this circle and reveal its tooltip.
    const showCircle = () => {
        if (!circleIsVisible) return;
        setCurrentCircleNameSelected(circleName);
        setCircleProperties({ active: true });
    };

    // Restore a pinned tooltip or clear this tour circle.
    const hideCircle = () => {
        if (interactionState.current.hovered || interactionState.current.focused) return;

        const currentState = SystemStore.getState();
        const pinnedCircleName = currentState.circleProperties.pinnedCircleName;

        if (pinnedCircleName && (pinnedCircleName !== circleName || circleIsVisible)) {
            setCurrentCircleNameSelected(pinnedCircleName);
            setCircleProperties({ active: true });
            return;
        }

        if (currentState.currentCircleNameSelected !== circleName) return;
        setCircleProperties({
            active: false,
            ...(pinnedCircleName === circleName ? { pinnedCircleName: undefined } : {})
        });
        setCurrentCircleNameSelected(undefined);
    };

    // Release selection when a focused circle becomes hidden.
    useEffect(() => {
        if (circleIsVisible) return;

        interactionState.current.hovered = false;
        interactionState.current.focused = false;
        circleElementRef.current?.blur();

        SystemStore.setState((state) => {
            const selectedHere = state.currentCircleNameSelected === circleName;
            const pinnedHere = state.circleProperties.pinnedCircleName === circleName;
            if (!selectedHere && !pinnedHere) return state;

            const fallbackPinnedName = selectedHere && !pinnedHere
                ? state.circleProperties.pinnedCircleName
                : undefined;

            return {
                ...(selectedHere ? {
                    currentCircleNameSelected: fallbackPinnedName
                } : {}),
                circleProperties: {
                    ...state.circleProperties,
                    ...(selectedHere ? { active: Boolean(fallbackPinnedName) } : {}),
                    ...(pinnedHere ? { pinnedCircleName: undefined } : {})
                }
            };
        });
    }, [circleIsVisible, circleName]);

    // Preserve the original hover behavior for legacy circles.
    const handleMouseEnter = () => {
        interactionState.current.hovered = true;
        showCircle();
    };

    // Restore a pinned tour after any circle loses hover.
    const handleMouseLeave = () => {
        interactionState.current.hovered = false;
        hideCircle();
    };

    // Reveal tour tooltips for keyboard users.
    const handleFocus = () => {
        interactionState.current.focused = true;
        showCircle();
    };

    // Hide an unpinned tour tooltip after focus leaves.
    const handleBlur = () => {
        interactionState.current.focused = false;
        hideCircle();
    };

    // Toggle persistent visibility for click and touch users.
    const togglePinnedTooltip = () => {
        if (!circleIsVisible) return;

        const currentState = SystemStore.getState();
        const isPinned = currentState.circleProperties.pinnedCircleName === circleName;
        const remainsActive = interactionState.current.hovered || interactionState.current.focused;

        if (isPinned) {
            setCircleProperties({
                active: remainsActive,
                pinnedCircleName: undefined
            });
            setCurrentCircleNameSelected(remainsActive ? circleName : undefined);
            return;
        }

        setCurrentCircleNameSelected(circleName);
        setCircleProperties({
            active: true,
            pinnedCircleName: circleName
        });
    };

    // Give role-button circles native-style keyboard activation.
    const handleKeyDown = (event) => {
        if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        togglePinnedTooltip();
    };
    
    return (
        <div
            ref={circleElementRef}
            style={circleStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={housemakerTourCircle ? handleFocus : undefined}
            onBlur={housemakerTourCircle ? handleBlur : undefined}
            onClick={housemakerTourCircle ? togglePinnedTooltip : undefined}
            onKeyDown={housemakerTourCircle ? handleKeyDown : undefined}
            data-housemaker-tour-interaction={housemakerTourCircle ? "true" : undefined}
            role={housemakerTourCircle ? "button" : undefined}
            tabIndex={housemakerTourCircle && circleIsVisible ? 0 : undefined}
            aria-label={housemakerTourCircle ? accessibleLabel : undefined}
            aria-expanded={housemakerTourCircle ? circleIsSelected : undefined}
            aria-pressed={housemakerTourCircle ? circleIsPinned : undefined}
            aria-hidden={housemakerTourCircle ? !circleIsVisible : undefined}
        />
    );
};
