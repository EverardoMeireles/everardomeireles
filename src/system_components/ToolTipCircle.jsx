import React, { useState, useEffect } from 'react';
import '../PulsatingAnimation.css'; // Adjust the path as necessary
import config from '../config';
import SystemStore from "../SystemStore";

// A component that displays a message on screen for a time.
// How to use:
// To activate the tooltip, set the zustand state: tooltipProperties with setTooltipProperties()
// At the minimum, use setTooltipProperties({active:true});
// You can set any of the tooltip's properties like this for example:
// setTooltipProperties({active:false, text:"This image is very interesting!"});
/**
 * @param {string} [objectName] - Object name.
 * @param {boolean} [circleIsVisible] - Whether to show the circles or not.
 * @param {string} [textShowMode] - Canvas or Page.
 * @param {string} [text] - Text content to display.
 * @param {number} [image] - Image file name or path.
 * @param {number} [circleSize] - Size of the circle.
 * @param {boolean} [playPulseAnimation] - Whether to pulse animation.
 * @param {Array<any>} [position] - Position in the scene.
 */
export const ToolTipCircle = (props) => {
    const {objectName = ""} = props;
    const {circleIsVisible = false} = props;
    const {textShowMode = "Canvas"} = props;
    const {text = "Sample text"} = props;
    const {image = config.resource_path + "/textures/4x3.png"} = props;
    const {circleSize = 30} = props;
    const {playPulseAnimation = false} = props;
    const {position = [0, 0]} = props;


    const setIsCircleOnLeftSelected = SystemStore((state) => state.setIsCircleOnLeftSelected);
    const setIsCircleOnTopSelected = SystemStore((state) => state.setIsCircleOnTopSelected);
    const setTooltipProperties = SystemStore((state) => state.setTooltipProperties);
    const tooltipCirclesData = SystemStore((state) => state.tooltipCirclesData);
    const setTooltipCurrentObjectNameSelected = SystemStore((state) => state.setTooltipCurrentObjectNameSelected);
    const setMessage = SystemStore((state) => state.setMessage);

    const [isVisible, setIsVisible] = useState(false);

    const isCircleOnLeft = position[0] < 50; // Since it's a percentage
    const isCircleOnTop = position[1] < 50; // Since it's a percentage

    useEffect(() => {
        if(circleIsVisible){
            setIsVisible(true);
        }else{
            setIsVisible(false);
        }
    }, [tooltipCirclesData]);

    const viewerBounds = SystemStore((state) => state.viewerBounds);

    const computedLeft = viewerBounds.left + (viewerBounds.width * (position[0] / 100));
    const computedTop = viewerBounds.top + (viewerBounds.height * (position[1] / 100));

    const circleStyle = {
        position: 'fixed',
        left: `${computedLeft}px`,
        top: `${computedTop}px`,
        width: `${circleSize}px`,
        height: `${circleSize}px`,
        borderRadius: '50%',
        cursor: 'pointer',
        zIndex: 900,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 1s ease-in',
        background: 'radial-gradient(circle, rgba(255,255,255,1) 20%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 60%)',
        animation: playPulseAnimation ?'pulsate 2s infinite ease-in-out' : "",
        boxShadow: '0 0 10px 10px rgba(255, 255, 255, 0.5), 0 0 15px 15px rgba(255, 255, 255, 0.3), 0 0 20px 20px rgba(255, 255, 255, 0.1)',
        pointerEvents: isVisible ? 'auto' : 'none',
    };

    const handleMouseEnter = () => {
        if(textShowMode == "Canvas"){
            setTooltipProperties({
                active:true,
                text: text,
                image: image,
                visible: true
            });

            setIsCircleOnLeftSelected(isCircleOnLeft)
            setIsCircleOnTopSelected(isCircleOnTop)
            setTooltipCurrentObjectNameSelected(objectName)
            //console.log(objectName)
        }
        else
        if(textShowMode == "Page"){
            setMessage('3D_TOOLTIP_HOVER', {text:text, image:image}) // Communication with external applications (Set the product description to the text).
        }
    };

    const handleMouseLeave = () => {
        if(textShowMode == "Canvas"){
            setTooltipProperties({
                active: false,
                visible: false
            });
        }else
        if(textShowMode == "Page"){
            setMessage('3D_TOOLTIP_HOVER_LEAVE', '') // Communication with external applications (Restores previous content of the product description).
        }

        setTooltipCurrentObjectNameSelected(undefined);
    };
    
    return <div style={circleStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />;
};
