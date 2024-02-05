import React, { useState, useEffect } from 'react';
import '../PulsatingAnimation.css'; // Adjust the path as necessary

// A component that displays a message on screen for a time.
// How to use:
// To activate the tooltip, set the zustand state: tooltipProperties with setTooltipProperties()
// At the minimum, use setTooltipProperties({active:true});
// You can set any of the tooltip's properties like this for example:
// setTooltipProperties({active:false, text:"This image is very interesting!"});
export const ToolTipCircle = (props) => {  
    const useStore = props.useStore;
    const {text = "Sample text"} = props;
    const {size = 30} = props;
    const {image = process.env.PUBLIC_URL + "textures/4x3.png"} = props;
    const {pathToShow = "MainMenu"} = props;

    const {position = [30, 40]} = props;

    const setTooltipVisible = useStore((state) => state.setTooltipVisible);
    const setTooltipText = useStore((state) => state.setTooltipText);
    const setTooltipImage = useStore((state) => state.setTooltipImage);
    const setIsCircleOnLeft = useStore((state) => state.setIsCircleOnLeft);
    const setTooltipProperties = useStore((state) => state.setTooltipProperties);
    const desired_path = useStore((state) => state.desired_path);
    const transitionEnded = useStore((state) => state.transitionEnded);

    const [isVisible, setIsVisible] = useState(false);

    const isCircleOnLeft = position[0] < 50; // Since it's a percentage

    useEffect(() => {
        if(desired_path == pathToShow && transitionEnded){
            console.log('test')

            setIsVisible(true);
        }else{
            setIsVisible(false);
        }
    }, [desired_path, transitionEnded]);

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
        animation: 'pulsate 2s infinite ease-in-out',
        boxShadow: '0 0 10px 10px rgba(255, 255, 255, 0.5), 0 0 15px 15px rgba(255, 255, 255, 0.3), 0 0 20px 20px rgba(255, 255, 255, 0.1)',
    };

    const handleMouseEnter = () => {
        setTooltipText(text);
        setTooltipImage(image);
        setTooltipVisible(true);
        setIsCircleOnLeft(isCircleOnLeft)
        setTooltipProperties({active:true, text:text})
    };

    const handleMouseLeave = () => {
        setTooltipVisible(false);
        setTooltipProperties({active:false})
    };

    return <div style={circleStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />;
};