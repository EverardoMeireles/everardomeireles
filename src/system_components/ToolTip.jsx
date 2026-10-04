import React, { useRef } from 'react';

/**
 * Purpose: Displays custom HTML next to the selected circle.
 * Relationships: Mounted by SceneViewer, which derives its props from circlesData and currentCircleNameSelected.
 * Example:
 * <ToolTip active={true} html="<h2>Tooltip</h2><p>Tooltip content</p>" style={{width: '320px', padding: '24px', backgroundColor: 'rgba(0, 0, 0, 0.75)', color: '#fff', borderRadius: '16px'}} selectedCirclePositionX={25} viewerBounds={{left: 0, top: 0, width: 800, height: 600}} transitionDuration={0.5} />
 * @param {boolean} [active] - Whether the tooltip is visible.
 * @param {string} [html] - Trusted HTML markup to display.
 * @param {object} [style] - React styles for the tooltip div.
 * @param {number} [selectedCirclePositionX] - Selected circle X position in percent.
 * @param {*} [viewerBounds] - Viewer bounds used to position the tooltip.
 * @param {number} [transitionDuration] - Fade time in seconds.
 */
export const ToolTip = (props) => {
  const {active = false} = props;
  const {html = "<h2>Tooltip</h2><p>Tooltip content</p>"} = props;
  const {style = {
    width: '320px',
    padding: '24px',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    color: '#fff',
    borderRadius: '16px',
  }} = props;
  const {selectedCirclePositionX = undefined} = props;
  const {viewerBounds = { left: 0, top: 0, width: 0, height: 0 }} = props;
  const {transitionDuration = 0.5} = props;

  const lastSelectedCirclePositionX = useRef(50);

  // Keep the side stable while fading out.
  if (selectedCirclePositionX !== undefined) {
    lastSelectedCirclePositionX.current = selectedCirclePositionX;
  }

  const isVisible = Boolean(active);
  const verticalMargin = viewerBounds.height * 0.05;
  const horizontalMargin = verticalMargin;
  const tooltipPositionX = selectedCirclePositionX ?? lastSelectedCirclePositionX.current;
  const isSelectedCircleOnLeft = tooltipPositionX < 50;
  const viewerRight = viewerBounds.left + viewerBounds.width;

  // Combine supplied presentation with required tooltip behavior.
  const tooltipStyle = {
    ...style,
    position: 'fixed',
    top: `${viewerBounds.top + verticalMargin}px`,
    right: isSelectedCircleOnLeft
      ? `calc(100vw - ${viewerRight - horizontalMargin}px)`
      : 'auto',
    left: isSelectedCircleOnLeft
      ? 'auto'
      : `${viewerBounds.left + horizontalMargin}px`,
    transition: `opacity ${transitionDuration}s ease-in-out`,
    zIndex: isVisible ? 1000 : 1,
    opacity: isVisible ? 1 : 0,
    pointerEvents: 'none',
  };

  return (
    <div
      style={tooltipStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
