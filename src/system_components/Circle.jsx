import React from 'react';
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
 */
export const Circle = (props) => {
    const {circleName = ""} = props;
    const {circleIsVisible = false} = props;
    const {circleSize = 30} = props;
    const {playPulseAnimation = false} = props;

    // Example: [50, 50]
    const {position = [0, 0]} = props;

    const setCircleProperties = SystemStore((state) => state.setCircleProperties);
    const setCurrentCircleNameSelected = SystemStore((state) => state.setCurrentCircleNameSelected);

    const viewerBounds = SystemStore((state) => state.viewerBounds);

    // Converts the circle's percentage position into real screen pixels.
    const computedPositionLeft = viewerBounds.left + (viewerBounds.width * (position[0] / 100));
    const computedPositionTop = viewerBounds.top + (viewerBounds.height * (position[1] / 100));

    const circleStyle = {
        position: 'fixed',
        left: `${computedPositionLeft}px`,
        top: `${computedPositionTop}px`,
        width: `${circleSize}px`,
        height: `${circleSize}px`,
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

    const handleMouseEnter = () => {
        setCurrentCircleNameSelected(circleName);
        setCircleProperties({ active: true });
    };

    const handleMouseLeave = () => {
        setCircleProperties({ active: false });
        setCurrentCircleNameSelected(undefined);
    };
    
    return <div style={circleStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />;
};
