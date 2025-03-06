import React, { useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const Raycaster = React.memo((props) => {
    const useStore = props.useStore;
    const {children} = props;
    const {mouse} = props;
    const {frameInterval = 1} = props; // Ray is casted every x frames
    const {enabled = false} = props; // enable raycaster

    const setCurrentObjectClicked = useStore((state) => state.setCurrentObjectClicked);
    const currentObjectClicked = useStore((state) => state.currentObjectClicked);
    
    const { scene, camera } = useThree();
    const [hoveredObject, setHoveredObject] = useState(null);
    const raycaster = new THREE.Raycaster();
    let frameCount = 0;

    useFrame(() => {
        if(enabled){
        // Perform raycasting every 'frameInterval' frames
            if (++frameCount % frameInterval === 0) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                if (hoveredObject !== intersects[0].object) {
                setHoveredObject(intersects[0].object.name);
                console.log("hover: "+hoveredObject)
                }
            } else if (hoveredObject) {
                setHoveredObject(null);
            }
            }
        }
    });

    const handleRaycastClick = () => {
        if(enabled){
            if (hoveredObject) {
                setCurrentObjectClicked(hoveredObject);
                console.log(currentObjectClicked)
            } 
            else {
                setCurrentObjectClicked(""); // Optionally clear the clicked object if clicking on empty space
            }
        }
    };

    return(
        <group onClick={handleRaycastClick}>
        {React.Children.map(children, child => 
            React.isValidElement(child) ? React.cloneElement(child, { hoveredObject }) : child
            )}
        </group>
    );
});