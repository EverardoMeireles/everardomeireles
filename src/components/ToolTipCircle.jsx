import React, { useState, useEffect } from 'react';
import '../PulsatingAnimation.css'; // Adjust the path as necessary
import config from '../config';

// A component that displays a message on screen for a time.
// How to use:
// To activate the tooltip, set the zustand state: tooltipProperties with setTooltipProperties()
// At the minimum, use setTooltipProperties({active:true});
// You can set any of the tooltip's properties like this for example:
// setTooltipProperties({active:false, text:"This image is very interesting!"});
export const ToolTipCircle = (props) => {
    const useStore = props.useStore;
    const {objectName = ""} = props;
    const {circlesAreVisible = false} = props; // Whether to show the circles or not
    const {circlesAreVisibleByTransitionDestination = false} = props; // Should the visibility of the circle be toggled automatically by the camera transition?
    const {circlesAreVisibleByTransitionDestinationWaitForTransitionEnd = false} = props; // if circlesAreVisibleByTransitionDestination is true, should it happen after the transition ends?
    const {transitionDestinationToShowCircles = "MainMenu"} = props;
    const {textShowMode = "Canvas"} = props; //Canvas or Page
    const {text = "Sample text"} = props;
    const {image = config.resource_path + "/textures/4x3.png"} = props;
    const {circleSize = 30} = props; // Size of the circle
    const {playPulseAnimation = false} = props;
    const {position = [0, 0]} = props;


    const setIsCircleOnLeftSelected = useStore((state) => state.setIsCircleOnLeftSelected);
    const setIsCircleOnTopSelected = useStore((state) => state.setIsCircleOnTopSelected);
    const setTooltipProperties = useStore((state) => state.setTooltipProperties);
    const transitionDestination = useStore((state) => state.transitionDestination);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const setCameraStateTracking = useStore((state) => state.setCameraStateTracking);
    const setTooltipCurrentObjectNameSelected = useStore((state) => state.setTooltipCurrentObjectNameSelected);
    const setMessage = useStore((state) => state.setMessage);
    
    const [isVisible, setIsVisible] = useState(false);

    const isCircleOnLeft = position[0] < 50; // Since it's a percentage
    const isCircleOnTop = position[1] < 50; // Since it's a percentage
    
    useEffect(() => {
        if(    (circlesAreVisibleByTransitionDestination && transitionDestination == transitionDestinationToShowCircles 
            && (circlesAreVisibleByTransitionDestinationWaitForTransitionEnd && transitionEnded || !circlesAreVisibleByTransitionDestinationWaitForTransitionEnd))
            || circlesAreVisible){
            setCameraStateTracking(true)
            setIsVisible(true);
        }else{
            setCameraStateTracking(false)
            setIsVisible(false);
        }
    }, [transitionDestination, transitionEnded]);

    const circleStyle = {
        position: 'fixed',
        left: `${position[0]}vw`,
        top: `${position[1]}vh`,
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