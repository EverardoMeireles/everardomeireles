import React, { useState, useEffect } from 'react';
import config from '../config';

// A component that displays a message on screen for a time.
// Usage: setTooltipProperties({ active: true, duration: 2 /*sec*/, text: "...", image: "..." })
export const ToolTip = (props) => {
  const useStore = props.useStore;
  const {imagePercentHeight = 40} = props;
  const {textPercentHeight = 60} = props;
  const {fontSize = 18} = props;
  const {transitionDuration = 0.5} = props; // fade time in seconds

  const tooltipProperties = useStore((state) => state.tooltipProperties);
  const setTooltipProperties = useStore((state) => state.setTooltipProperties);
  const isCircleOnLeftSelected = useStore((state) => state.isCircleOnLeftSelected);

  const [isVisible, setIsVisible] = useState(false);
  const [isDivDisabled, setIsDivDisabled] = useState(true);

  // 1) Show + auto-hide
  useEffect(() => {
    let timeoutId;
    if (tooltipProperties.active) {
      setIsVisible(true);
      setIsDivDisabled(false);

      // fallback to 3s if duration is undefined
      const displaySec = tooltipProperties.duration ?? 3;

      timeoutId = setTimeout(() => {
        setIsVisible(false);
        setTooltipProperties({ active: false });
      }, displaySec * 50000); // Stay on screen a long time before disappearing on its own(see if there are leaks)
    } else {
      setIsVisible(false);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    tooltipProperties.active,
    tooltipProperties.duration,
    setTooltipProperties,
  ]);

  // 2) After fade-out, collapse the div
  useEffect(() => {
    if (!isVisible) {
      const id = setTimeout(() => {
        setIsDivDisabled(true);
      }, transitionDuration * 1000);
      return () => clearTimeout(id);
    }
  }, [isVisible, transitionDuration]);

  const boxStyle = {
    position: 'fixed',
    width:  isDivDisabled ? '0vw' : '40vw',
    height: isDivDisabled ? '0vh' : '90vh',
    margin: '5vh',
    borderRadius: '50px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    transition: `opacity ${transitionDuration}s ease-in-out`,
    zIndex:  isVisible ? 1000 : 1,
    opacity:  isVisible ?   1  : 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFF',
    right: isCircleOnLeftSelected ? 0 : 'auto',
    left:  isCircleOnLeftSelected ? 'auto' : 0,
    pointerEvents: 'none',
  };

  const textStyle = {
    padding: '10px',
    textAlign: 'center',
    color: '#FFF',
    flex:    `${textPercentHeight} 1 0`,
    fontSize: `${fontSize}px`,
  };

  const imgContainer = {
    width:         '100%',
    position:      'relative',
    flex:          `${imagePercentHeight} 1 0`,
    display:       'flex',
    justifyContent:'center',
    alignItems:    'center',
    marginBottom:  '2vh',
    overflow:      'hidden',
    borderRadius:  '20px',
  };

  const imgStyle = {
    position: 'absolute',
    top:      0,
    left:     0,
    width:   '100%',
    height:  '100%',
    objectFit:'contain',
  };

  return (
    <div style={boxStyle}>
      <div style={textStyle}>
        {tooltipProperties.text}
      </div>
      <div style={imgContainer}>
        <img
          style={imgStyle}
          src={`${config.resource_path}/textures/${tooltipProperties.image}`}
          alt="Tooltip"
        />
      </div>
    </div>
  );
};