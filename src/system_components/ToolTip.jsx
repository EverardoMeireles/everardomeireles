import React, { useRef } from 'react';
import config from '../config';

/**
 * Purpose: Displays the active tooltip panel next to the selected circle.
 * Relationships: Mounted by SceneViewer, which derives its props from circlesData and currentCircleNameSelected.
 * Example:
 * <ToolTip active={true} text="Sample text" image="textures/4x3.png" selectedCirclePositionX={25} viewerBounds={{left: 0, top: 0, width: 800, height: 600}} imagePercentHeight={40} textPercentHeight={60} fontSize={18} transitionDuration={0.5} />
 * @param {boolean} [active] - Whether the tooltip is visible.
 * @param {string} [text] - Text content to display.
 * @param {string} [image] - Image file name or path.
 * @param {number} [selectedCirclePositionX] - Selected circle X position in percent.
 * @param {*} [viewerBounds] - Viewer bounds used to position the tooltip.
 * @param {number} [imagePercentHeight] - Image percent height.
 * @param {number} [textPercentHeight] - Text percent height.
 * @param {number} [fontSize] - Font size.
 * @param {number} [transitionDuration] - fade time in seconds.
 */
export const ToolTip = (props) => {
  const {active = false} = props;
  const {text = ""} = props;

  // Example: "textures/4x3.png"
  const {image = ""} = props;
  const {selectedCirclePositionX = undefined} = props;

  // Example: { left: 0, top: 0, width: 800, height: 600 }
  const {viewerBounds = { left: 0, top: 0, width: 0, height: 0 }} = props;
  const {imagePercentHeight = 40} = props;
  const {textPercentHeight = 60} = props;
  const {fontSize = 18} = props;
  const {transitionDuration = 0.5} = props;

  const lastSelectedCirclePositionX = useRef(50);

  const isVisible = Boolean(active);
  const boxWidth = viewerBounds.width * 0.4;
  const verticalMargin = viewerBounds.height * 0.05;
  const horizontalMargin = verticalMargin;

  // Keep the side stable while fading out.
  if (selectedCirclePositionX !== undefined) {
    lastSelectedCirclePositionX.current = selectedCirclePositionX;
  }

  const tooltipPositionX = selectedCirclePositionX ?? lastSelectedCirclePositionX.current;
  const isSelectedCircleOnLeft = tooltipPositionX < 50;

  const boxStyle = {
    position: 'fixed',
    width: `${boxWidth}px`,
    height: `${viewerBounds.height * 0.9}px`,
    borderRadius: '50px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    transition: `opacity ${transitionDuration}s ease-in-out`,
    zIndex:  isVisible ? 1000 : 1,
    opacity:  isVisible ?   1  : 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFF',
    top: `${viewerBounds.top + verticalMargin}px`,
    left: isSelectedCircleOnLeft
      ? `${viewerBounds.left + viewerBounds.width - boxWidth - horizontalMargin}px`
      : `${viewerBounds.left + horizontalMargin}px`,
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
        {text}
      </div>
      <div style={imgContainer}>
        <img
          style={imgStyle}
          src={`${config.resource_path}/textures/${image}`}
          alt="Tooltip"
        />
      </div>
    </div>
  );
};
