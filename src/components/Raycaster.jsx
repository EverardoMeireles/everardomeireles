import React, { useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const Raycaster = React.memo((props) => {
    const {children} = props;
    const {mouse} = props;
    const {frameInterval = 1} = props; // Ray is casted every x frames
    const { scene, camera } = useThree();
    const [hoveredObject, setHoveredObject] = useState(null);
    const raycaster = new THREE.Raycaster();
    let frameCount = 0;

    useFrame(() => {
    // Perform raycasting every 'frameInterval' frames
    if (++frameCount % frameInterval === 0) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            if (hoveredObject !== intersects[0].object) {
            setHoveredObject(intersects[0].object.name);
            console.log(hoveredObject)
            }
        } else if (hoveredObject) {
            setHoveredObject(null);
        }
        }
    });

    return React.Children.map(children, child => 
        React.isValidElement(child) ? React.cloneElement(child, { hoveredObject }) : child
    );
    });