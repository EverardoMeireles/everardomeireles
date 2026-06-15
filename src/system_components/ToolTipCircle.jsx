import React from 'react';
import '../PulsatingAnimation.css'; // Adjust the path as necessary
import config from '../config';
import SystemStore from "../SystemStore";

/**
 * Purpose: Renders a screen-space focus/tooltip circle over a projected object.
 * Relationships: Created by SceneViewer from SystemStore tooltipCirclesData and drives ToolTip or parent-page messages.
 * Example:
 * <ToolTipCircle circleName="Lamp" circleIsVisible={true} textShowMode="Canvas" text="Sample text" image="textures/4x3.png" circleSize={30} playPulseAnimation={false} position={[50, 50]} />
 * @param {string} [circleName] - Circle name.
 * @param {boolean} [circleIsVisible] - Whether to show the circles or not.
 * @param {string} [textShowMode] - Canvas or Page.
 * @param {string} [text] - Text content to display.
 * @param {number} [image] - Image file name or path.
 * @param {number} [circleSize] - Size of the circle.
 * @param {boolean} [playPulseAnimation] - Whether to pulse animation.
 * @param {Array<any>} [position] - Position in the scene.
 */
export const ToolTipCircle = (props) => {
    const {circleName = ""} = props;
    const {circleIsVisible = false} = props;
    const {textShowMode = "Canvas"} = props;
    const {text = "Sample text"} = props;
    const {image = config.resource_path + "/textures/4x3.png"} = props;
    const {circleSize = 30} = props;
    const {playPulseAnimation = false} = props;
    const {position = [0, 0]} = props;

    const setTooltipProperties = SystemStore((state) => state.setTooltipProperties);
    const setCurrentCircleNameSelected = SystemStore((state) => state.setCurrentCircleNameSelected);
    const setMessage = SystemStore((state) => state.setMessage);

    const viewerBounds = SystemStore((state) => state.viewerBounds);

    // Converts the tooltip circle's percentage position into real screen pixels.
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
        if(textShowMode == "Canvas"){
            setTooltipProperties({
                active:true,
                text: text,
                image: image
            });
        }
        else
        if(textShowMode == "Page"){
            setMessage('3D_TOOLTIP_HOVER', {text:text, image:image}) // Communication with external applications (Set the product description to the text).
        }
    };

    const handleMouseLeave = () => {
        if(textShowMode == "Canvas"){
            setTooltipProperties({
                active: false
            });
        }else
        if(textShowMode == "Page"){
            setMessage('3D_TOOLTIP_HOVER_LEAVE', '') // Communication with external applications (Restores previous content of the product description).
        }

        setCurrentCircleNameSelected(undefined);
    };
    
    return <div style={circleStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />;
};
