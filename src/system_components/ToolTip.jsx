import React, { useRef } from 'react';
import config from '../config';
import SystemStore from "../SystemStore";

/**
 * Purpose: Displays the active tooltip panel next to the selected tooltip circle.
 * Relationships: Mounted by SceneViewer and driven by ToolTipCircle through SystemStore tooltipProperties.
 * Example:
 * <ToolTip imagePercentHeight={40} textPercentHeight={60} fontSize={18} transitionDuration={0.5} />
 * @param {number} [imagePercentHeight] - Image percent height.
 * @param {number} [textPercentHeight] - Text percent height.
 * @param {number} [fontSize] - Font size.
 * @param {number} [transitionDuration] - fade time in seconds.
 */
export const ToolTip = (props) => {
  const {imagePercentHeight = 40} = props;
  const {textPercentHeight = 60} = props;
  const {fontSize = 18} = props;
  const {transitionDuration = 0.5} = props;

  const tooltipProperties = SystemStore((state) => state.tooltipProperties);
  const tooltipCirclesData = SystemStore((state) => state.tooltipCirclesData);
  const currentCircleNameSelected = SystemStore((state) => state.currentCircleNameSelected);
  const viewerBounds = SystemStore((state) => state.viewerBounds);

  const lastSelectedCirclePositionX = useRef(50);

  const isVisible = Boolean(tooltipProperties.active);
  const boxWidth = viewerBounds.width * 0.4;
  const verticalMargin = viewerBounds.height * 0.05;
  const horizontalMargin = verticalMargin;
  const selectedCircleData = tooltipCirclesData.find((circle) => circle.circleName === currentCircleNameSelected);
  const selectedCirclePositionX = selectedCircleData?.position?.[0];

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
