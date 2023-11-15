import React, { useState, useEffect } from 'react';

export const TutorialOverlay = (props) => {
    const useStore = props.useStore;
    const {showAfterTransition = false} = props;
    const {showOnlyOnce = false} = props;
    const {imagesPaths = ["textures/Gif1.gif", "textures/Gif2.gif"]} = props;
    const {imageSize = [200, 200]} = props;
    const {textH1 = "Use left click to rotate, shift + left click to pan and the mouseWheel to zoom"} = props;
    const {textH2 = "Click to go to the page"} = props;
    const {fontColor = "white"} = props;
    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const setTutorialClosed = useStore((state) => state.setTutorialClosed);

    useEffect(() => {
    const tutorialShown = localStorage.getItem('tutorialShown');

        if ((!showAfterTransition || transitionEnded) ) {
            setShouldRender(true);
            const timer = setTimeout(() => {
            if(!showOnlyOnce || tutorialShown !=='true'){
                setVisible(true);
                localStorage.setItem('tutorialShown', 'true');
            }
        }, 10);

        // Cleanup function to clear the timeout if the component unmounts
        return () => clearTimeout(timer);
        }
    }, [transitionEnded]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = () => {
        setVisible(false);
        setTimeout(() => {
        setShouldRender(false);
        setTutorialClosed(true);
        }, 1000); // This duration should match the CSS transition duration
    };

    const images = [];
    if(visible){
        for (let i = 0; i < imagesPaths.length; i++) {
            images.push(
                <img src={process.env.PUBLIC_URL + imagesPaths[i]} key={i} alt="Tutorial" style={{ width: imageSize[0], height: imageSize[1] }}></img>
            )
        }
    }
    
    if (!shouldRender) return null;

    const overlayStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
    };

    const contentStyle = {
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: `opacity 1s ease ${visible ? '1s' : '0s'}`,
    };

    return (
        shouldRender && (
            <div style={overlayStyle} onClick={handleClick}>
                <div style={contentStyle}>
                    <h1 style={{ color:fontColor }} >{textH1}</h1>
                    {images}
                    <h1 style={{ color:fontColor }} >{textH2}</h1>
                </div>
            </div>
        )
    );
};
