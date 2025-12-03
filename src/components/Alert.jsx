import React, { useState, useEffect } from 'react';
//lol
// Define icons for simplicity
const icons = {
  Error: '❌',
  Warning: '⚠️',
  Success: '✓',
};

// A component that displays a message on screen for a time.
// How to use:
// To activate the alert, set the zustand state: alertProperties with setAlertProperties()
// At the minimum, use setAlertProperties({active:true});
// You can set any of the alert's properties like this for example:
// setAlertProperties({active:false, type:'Success', text:"the button was pressed successfully!"});
export const Alert = (props) => {  
  const useStore = props.useStore;
  const alertProperties = useStore((state) => state.alertProperties);
  const setAlertProperties = useStore((state) => state.setAlertProperties);
  const viewerBounds = useStore((state) => state.viewerBounds);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeoutId;
    if (alertProperties.active) {
      setIsVisible(true); // Start to show the alert with fade-in
      timeoutId = setTimeout(() => {
        setIsVisible(false); // Start to hide the alert with fade-out
        setAlertProperties({active:false});
      }, alertProperties.duration * 1000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [alertProperties.active, alertProperties.duration, setAlertProperties]);

  // Inline styles for the alert box
  const margin = 10;

  const alertBoxStyle = {
    position: 'fixed',
    width: alertProperties.width,
    height: alertProperties.height,
    padding: '10px',
    margin: '10px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `opacity ${alertProperties.transitionDuration}s ease-in-out`,
    zIndex: 1000,
    opacity: isVisible ? 1 : 0,
    // Background and alertProperties.text color based on the alert alertProperties.type
    backgroundColor: alertProperties.type === 'Error' ? '#f8d7da' :
                    alertProperties.type === 'Warning' ? '#fff3cd' :
                    '#d4edda',
    color: alertProperties.type === 'Error' ? '#721c24' :
          alertProperties.type === 'Warning' ? '#856404' :
          '#155724',
    top: alertProperties.displaySide.includes('top') ? `${viewerBounds.top + margin}px` : 'auto',
    bottom: alertProperties.displaySide.includes('bottom') ? `${window.innerHeight - (viewerBounds.top + viewerBounds.height) + margin}px` : 'auto',
    left: alertProperties.displaySide.includes('Left') ? `${viewerBounds.left + margin}px` : 'auto',
    right: alertProperties.displaySide.includes('Right') ? `${window.innerWidth - (viewerBounds.left + viewerBounds.width) + margin}px` : 'auto',
  };

  // Only render the alert if it's set to be visible
  if (!isVisible && !alertProperties.active) return null;

  return (
    <div style={alertBoxStyle}>
      <span style={{ marginRight: '10px' }}>{icons[alertProperties.type]}</span>
      <span>{alertProperties.text}</span>
    </div>
  );
};
