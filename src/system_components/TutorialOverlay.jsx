import React, { useState, useEffect } from 'react';
import config from '../config';
import useSystemStore from "../SystemStore";

export const TutorialOverlay = (props) => {
    const {enable = true} = props;
    const {showOnlyOnce = true} = props;
    const {topImagePaths = ["/textures/tutorial_rotate_video.png", "/textures/tutorial_zoom_video.png"]} = props;
    const {bottomImagePaths = ["/textures/tutorial_rotate.png", "/textures/tutorial_zoom.png"]} = props;
    const {imageSize = [260, 216]} = props;
    const {textH1 = "Use left click to rotate, shift + left click to pan and the mouseWheel to zoom"} = props;
    const {textH2 = "Click to go to the page"} = props;
    const {fontColor = "white"} = props;
    
    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const viewerBounds = useSystemStore((state) => state.viewerBounds);
    
    const setTutorialClosed = useSystemStore((state) => state.setTutorialClosed);

    // Close tutorial when the user uses OrbitControls
    useEffect(() => {
        const handleUserInput = () => {
            if (!visible) return;
            setVisible(false);
            const handleUserInputTimeout = setTimeout(() => {
                setShouldRender(false);
                setTutorialClosed(true);
            }, 1000);

            return () => clearTimeout(handleUserInputTimeout);

        };

        const handlePointerDown = () => handleUserInput();
        const handleWheel = () => handleUserInput();
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                handleUserInput();
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("wheel", handleWheel);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("wheel", handleWheel);
            window.removeEventListener("keydown", handleKeyDown);
        };
}, [visible]);

    useEffect(() => {
        const tutorialShown = localStorage.getItem('tutorialShown');
        if ((enable && showOnlyOnce && tutorialShown !== "true") || (enable && !showOnlyOnce)) {
            setShouldRender(true);
            const tutorialShownTimeout = setTimeout(() => {
                setVisible(true);
                // local cache
                localStorage.setItem('tutorialShown', 'true');
        }, 10);

        // Cleanup function to clear the timeout if the component unmounts
        return () => clearTimeout(tutorialShownTimeout);
        }
    }, [enable]);

    const handleClick = () => {
        setVisible(false);
        const handleClickTimeout = setTimeout(() => {

        setShouldRender(false);
        setTutorialClosed(true);
        }, 1000); // This duration should match the CSS transition duration
        
        return () => clearTimeout(handleClickTimeout);

    };

    const topImages = [];
    const bottomImages = [];

    if (visible) {
        topImagePaths.forEach((path, index) => {
            topImages.push(
                <img
                    src={config.resource_path + path}
                    key={`topImage-${index}`}
                    alt={`Top Tutorial ${index}`}
                    style={{ width: imageSize[0], height: imageSize[1], pointerEvents: 'none' }}
                />
            );
        });

        bottomImagePaths.forEach((path, index) => {
            bottomImages.push(
                <img
                    src={config.resource_path + path}
                    key={`bottomImage-${index}`}
                    alt={`Bottom Tutorial ${index}`}
                    style={{ width: imageSize[0], height: imageSize[1], pointerEvents: 'none' }}
                />
            );
        });
    }
    
    if (!shouldRender) return null;

    const overlayStyle = {
        position: 'fixed', // Centering in the viewport
        top: `${viewerBounds.top}px`,
        left: `${viewerBounds.left}px`,
        width: `${viewerBounds.width}px`,
        height: `${viewerBounds.height}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center', // Center vertically
        justifyContent: 'center', // Center horizontally
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none', // 🔽 this allows canvas to receive input

    };

    const contentStyle = {
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: `opacity 1s ease ${visible ? '1s' : '0s'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', // Center horizontally
        gap: '20px', // Adds space between the top and bottom image groups
        pointerEvents: 'none', // 🔼 re-enable for content

    };
    const imageRowStyle = {
        display: 'flex',
        flexDirection: 'row',
        gap: '10px', // Adds space between the images in each row
        pointerEvents: 'none' // 🔽 allows drag to go through image
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
