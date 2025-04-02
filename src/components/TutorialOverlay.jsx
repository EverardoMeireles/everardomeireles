import React, { useState, useEffect } from 'react';
import config from '../config';

export const TutorialOverlay = (props) => {
    const useStore = props.useStore;
    const {enable = true} = props;
    const {showOnlyOnce = true} = props;
    const {topImagePaths = ["textures/tutorial_rotate_video.png", "textures/tutorial_zoom_video.png"]} = props;
    const {bottomImagePaths = ["textures/tutorial_rotate.png", "textures/tutorial_zoom.png"]} = props;
    const {imageSize = [260, 216]} = props;
    const {textH1 = "Use left click to rotate, shift + left click to pan and the mouseWheel to zoom"} = props;
    const {textH2 = "Click to go to the page"} = props;
    const {fontColor = "white"} = props;
    
    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    
    const setTutorialClosed = useStore((state) => state.setTutorialClosed);

    useEffect(() => {
        const tutorialShown = localStorage.getItem('tutorialShown');
        // console.log(tutorialShown)
        if ((enable && showOnlyOnce && tutorialShown !== "true") || (enable && !showOnlyOnce)) {
            setShouldRender(true);
            const timer = setTimeout(() => {
            // if(!showOnlyOnce || tutorialShown !== 'true'){
                setVisible(true);
                // local cache
                localStorage.setItem('tutorialShown', 'true');
            // }
        }, 10);

        // Cleanup function to clear the timeout if the component unmounts
        return () => clearTimeout(timer);
        }
    }, [enable]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = () => {
        setVisible(false);
        setTimeout(() => {
        setShouldRender(false);
        setTutorialClosed(true);
        }, 1000); // This duration should match the CSS transition duration
    };

    const topImages = [];
    const bottomImages = [];

    if (visible) {
        topImagePaths.forEach((path, index) => {
            topImages.push(
                <img
                    src={config.resource_path + "/" + path}
                    key={`topImage-${index}`}
                    alt={`Top Tutorial ${index}`}
                    style={{ width: imageSize[0], height: imageSize[1] }}
                />
            );
        });

        bottomImagePaths.forEach((path, index) => {
            bottomImages.push(
                <img
                    src={config.resource_path + "/" + path}
                    key={`bottomImage-${index}`}
                    alt={`Bottom Tutorial ${index}`}
                    style={{ width: imageSize[0], height: imageSize[1] }}
                />
            );
        });
    }
    
    if (!shouldRender) return null;

    const overlayStyle = {
        position: 'fixed', // Centering in the viewport
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center', // Center vertically
        justifyContent: 'center', // Center horizontally
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
    };

    const contentStyle = {
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: `opacity 1s ease ${visible ? '1s' : '0s'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', // Center horizontally
        gap: '20px', // Adds space between the top and bottom image groups
    };

    const imageRowStyle = {
        display: 'flex',
        flexDirection: 'row',
        gap: '10px', // Adds space between the images in each row
    };

    return (
        shouldRender && (
            <div style={overlayStyle} onClick={handleClick}>
                <div style={contentStyle}>
                    <h1 style={{ color: fontColor }}>{textH1}</h1>
                    <div style={imageRowStyle}>
                        {topImages}
                    </div>
                    <div style={imageRowStyle}>
                        {bottomImages}
                    </div>
                    <h1 style={{ color: fontColor }}>{textH2}</h1>
                </div>
            </div>
        )
    );
};