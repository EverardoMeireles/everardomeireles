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
    const {text = "Sample text"} = props;
    const {size = 30} = props;
    const {image = config.resource_path + "/textures/4x3.png"} = props;
    const {pathToShow = "MainMenu"} = props;
    const {rotatingObjectCoordinates = []} = props;
    const {rotatingObjectAxisOfRotation = []} = props;
    const {playPulseAnimation = false} = props;
    const {position = [30, 40]} = props;

    const setIsCircleOnLeftSelected = useStore((state) => state.setIsCircleOnLeftSelected);
    const setIsCircleOnTopSelected = useStore((state) => state.setIsCircleOnTopSelected);
    const setTooltipProperties = useStore((state) => state.setTooltipProperties);
    const desired_path = useStore((state) => state.desired_path);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const explodeAnimationEnded = useStore((state) => state.explodeAnimationEnded);
    const setCameraStateTracking = useStore((state) => state.setCameraStateTracking);
    const setTooltipCurrentObjectNameSelected = useStore((state) => state.setTooltipCurrentObjectNameSelected);
    const tooltipCurrentObjectSelected = useStore((state) => state.tooltipCurrentObjectSelected);
    const setRotatingObjectViewportArray = useStore((state) => state.setRotatingObjectViewportArray);
    const setRotatingObjectForcedAxisOfRotation = useStore((state) => state.setRotatingObjectForcedAxisOfRotation);
    const setMessage = useStore((state) => state.setMessage);
    
    const [isVisible, setIsVisible] = useState(false);
    const [updateViewportArray, setUpdateViewportArray] = useState(false);
    const [updateRotatingObjectAxis, setUpdateRotatingObjectAxis] = useState(false);

    const isCircleOnLeft = position[0] < 50; // Since it's a percentage
    const isCircleOnTop = position[1] < 50; // Since it's a percentage
    
    useEffect(() => {
        if(desired_path == pathToShow && transitionEnded){
            setCameraStateTracking(true)
            setIsVisible(true);
        }else{
            setCameraStateTracking(false)
            setIsVisible(false);
        }
    }, [desired_path, transitionEnded]);

    // sets the positions that the rotating object will take on the screen
    useEffect(() => {
        if(updateViewportArray){
            if(rotatingObjectCoordinates[0] != undefined){
                setRotatingObjectViewportArray(0, rotatingObjectCoordinates[0])
            }
    
            if(rotatingObjectCoordinates[1] != undefined){
                setRotatingObjectViewportArray(1, rotatingObjectCoordinates[1])
            }
    
            if(rotatingObjectCoordinates[2] != undefined){
                setRotatingObjectViewportArray(2, rotatingObjectCoordinates[2])
            }
    
            if(rotatingObjectCoordinates[3] != undefined){
                setRotatingObjectViewportArray(3, rotatingObjectCoordinates[3])
            }
        }
    }, [updateViewportArray]);

    // sets the axis that the rotating object will take on the screen
    useEffect(() => {
        if(updateRotatingObjectAxis){
            if(rotatingObjectAxisOfRotation != undefined){
                setRotatingObjectForcedAxisOfRotation(rotatingObjectAxisOfRotation)
            }
            else{
                setRotatingObjectForcedAxisOfRotation([])
            }
        }
    }, [updateRotatingObjectAxis]);

    const circleStyle = {
        position: 'fixed',
        left: `${position[0]}vw`,
        top: `${position[1]}vh`,
        width: `${size}px`,
        height: `${size}px`,
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
        setMessage('3D_TOOLTIP_HOVER', {text:text, image:image}) // Communication with external applications
        setUpdateViewportArray(true)
        setUpdateRotatingObjectAxis(true)
        setTooltipProperties({
            active:true,
            text: text,
            image: image,
            visible: true
          });
        setIsCircleOnLeftSelected(isCircleOnLeft)
        setIsCircleOnTopSelected(isCircleOnTop)
        setTooltipCurrentObjectNameSelected(objectName)
    };

    const handleMouseLeave = () => {
        setUpdateViewportArray(false)
        setUpdateRotatingObjectAxis(false)
        setTooltipProperties({
            active:false,
            visible: false
          });
        setTooltipCurrentObjectNameSelected(undefined)
    };

    return <div style={circleStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />;
};