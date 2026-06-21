import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SystemStore from "../SystemStore";

/**
 * Purpose: Performs periodic raycasts and stores the hovered object name.
 * Relationships: Reads the active R3F scene/camera and writes the hovered object name to SystemStore.
 * Example:
 * <Raycaster frameInterval={1} enabled={true} />
 * @param {number} [frameInterval] - Ray is casted every x frames.
 * @param {boolean} [enabled] - enable raycaster.
 */
export const Raycaster = React.memo((props) => {
    const {frameInterval = 1} = props;
    const {enabled = true} = props;

    const setCurrentObjectHovered = SystemStore((state) => state.setCurrentObjectHovered);

    const { scene, camera, mouse } = useThree();
    const frameCountRef = useRef(0);
    const hoveredObjectRef = useRef("");
    const raycasterRef = useRef(new THREE.Raycaster());
    const isEnabled = enabled;
    const raycastFrameInterval = Math.max(1, frameInterval);

    // Clear hover state when the raycaster is disabled.
    useEffect(() => {
        if (isEnabled) return;

        hoveredObjectRef.current = "";
        setCurrentObjectHovered("");
    }, [isEnabled, setCurrentObjectHovered]);

    // Clear hover state when this component unmounts.
    useEffect(() => {
        return () => {
            hoveredObjectRef.current = "";
            setCurrentObjectHovered("");
        };
    }, [setCurrentObjectHovered]);

    // Store the hovered object name when it changes.
    useFrame(() => {
        if (!isEnabled) return;

        frameCountRef.current += 1;
        if (frameCountRef.current % raycastFrameInterval !== 0) return;

        raycasterRef.current.setFromCamera(mouse, camera);
        const intersects = raycasterRef.current.intersectObjects(scene.children, true);
        const hoveredObjectName = intersects[0]?.object?.name || "";

        if (hoveredObjectRef.current === hoveredObjectName) return;

        hoveredObjectRef.current = hoveredObjectName;
        setCurrentObjectHovered(hoveredObjectName);
    });

    return null;
});

Raycaster.displayName = "Raycaster";
