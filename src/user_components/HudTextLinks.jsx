import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TranslationTable } from "../TranslationTable.jsx";
import { HudMenuStyles, Responsive3DCurveTransitions, useResponsive } from "../Styles.jsx";
import { createArchCurve } from "../Helper.js";
import { path_points_even_more_simple_lookat_dict } from "../PathPoints.jsx";
import SystemStore from "../SystemStore";

/**
 * Purpose: Renders the HUD navigation text links.
 * Relationships: Independently drives navigation through SystemStore.
 */
export function HudTextLinks() {
    // Read responsive layouts and translated labels.
    const { key: hudLayoutKey } = useResponsive("hud");
    const { key: sceneLayoutKey } = useResponsive("scene");
    const currentLanguage = SystemStore((state) => state.currentLanguage);

    // Read camera transition state and actions.
    const setIsCameraMoving = SystemStore((state) => state.setIsCameraMoving);
    const isCameraMoving = SystemStore((state) => state.isCameraMoving);
    const setForcedCameraMovePathCurve = SystemStore((state) => state.setForcedCameraMovePathCurve);
    const setForcedCameraTarget = SystemStore((state) => state.setForcedCameraTarget);
    const setDesiredPath = SystemStore((state) => state.setDesiredPath);
    const cameraState = SystemStore((state) => state.cameraState);
    const cameraStateTracking = SystemStore((state) => state.cameraStateTracking);
    const setCameraStateTracking = SystemStore((state) => state.setCameraStateTracking);

    // Track navigation and experience menu state.
    const [profExpClicked, setProfExpClicked] = useState(false);
    const currentPath = useRef("MainMenu");
    const desiredPath = useRef("MainMenu");

    // Drive camera transitions from URL changes.
    useEffect(() => {
        const handlePopState = (event) => {
            const href = event.currentTarget.location.href;
            const urlPath = href.slice(href.indexOf('#') + 1);

            if (desiredPath.current === urlPath) return;

            desiredPath.current = urlPath;
            setIsCameraMoving(true);
            setDesiredPath(desiredPath.current);
            setForcedCameraTarget(path_points_even_more_simple_lookat_dict[desiredPath.current].toArray());

            const transitionPositions = Responsive3DCurveTransitions?.[sceneLayoutKey]
                ?? Responsive3DCurveTransitions?.Widescreen
                ?? Responsive3DCurveTransitions;
            const isCurveLike = (value) =>
                !!value &&
                (value.isCurve ||
                    value.isCatmullRomCurve3 ||
                    value instanceof THREE.CatmullRomCurve3 ||
                    (Array.isArray(value.points) && typeof value.getPointAt === "function"));

            if (isCurveLike(transitionPositions)) {
                setForcedCameraMovePathCurve(transitionPositions);
                return;
            }

            const transitionValue = transitionPositions?.[desiredPath.current];
            const startPosition = transitionPositions?.[currentPath.current];

            if (isCurveLike(transitionValue)) {
                setForcedCameraMovePathCurve(transitionValue);
                return;
            }

            if (!transitionValue) return;

            const transitionStartPosition = startPosition ?? cameraState?.position;
            if (!transitionStartPosition) return;

            setForcedCameraMovePathCurve(
                createArchCurve(transitionStartPosition, transitionValue)
            );
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [cameraState?.position, sceneLayoutKey, setDesiredPath, setForcedCameraMovePathCurve, setForcedCameraTarget, setIsCameraMoving]);

    // Save the destination after camera movement.
    useEffect(() => {
        if (isCameraMoving) return;
        currentPath.current = desiredPath.current;
    }, [isCameraMoving]);

    // Enable camera state tracking while mounted.
    useEffect(() => {
        if (!cameraStateTracking) setCameraStateTracking(true);
    }, [cameraStateTracking, setCameraStateTracking]);

    if (hudLayoutKey === "Mobile") {
        return (
            <>
                {/* Render primary navigation links. */}
                <a href="#MainMenu" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(1, 30, 20, 0, 17)} children={TranslationTable[currentLanguage]["Menu_MainMenu"]} />
                <a href="#Education" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(1, 30, 20, 1, 17)} children={TranslationTable[currentLanguage]["Menu_Education"]} />
                <a href="#Skills" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(6, 30, 20, 0, 17)} children={TranslationTable[currentLanguage]["Menu_Skills"]} />
                <a href="#ProfessionalExpProjects0" onClick={() => setProfExpClicked(true)} style={HudMenuStyles.simple_items_top(6, 30, 20, 1, 17)} children={TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />

                {/* Reveal professional experience sublinks. */}
                {profExpClicked &&
                    <div>
                        <a href="#ProfessionalExpProjects0" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 0, 13)} children={TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                        <a href="#ProfessionalExpProjects1" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 1, 13)} children={TranslationTable[currentLanguage]["Menu_DRIM"]} />
                        <a href="#ProfessionalExpProjects2" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 2, 13)} children={TranslationTable[currentLanguage]["Menu_Everial"]} />
                        <a href="#ProfessionalExpProjects3" style={HudMenuStyles.simple_items_bottom(7, 8, 35, 0, 13)} children={TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                        <a href="#ProfessionalExpProjects4" style={HudMenuStyles.simple_items_bottom(7, 8, 35, 1, 13)} children={TranslationTable[currentLanguage]["Menu_EFN1"]} />
                        <a href="#ProfessionalExpProjects5" style={HudMenuStyles.simple_items_bottom(7, 8, 35, 2, 13)} children={TranslationTable[currentLanguage]["Menu_EFN2"]} />
                    </div>
                }
            </>
        );
    }

    if (hudLayoutKey === "Tablet") {
        return (
            <>
                {/* Render primary navigation links. */}
                <a href="#MainMenu" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 10, 20, 0, 20)} children={TranslationTable[currentLanguage]["Menu_MainMenu"]} />
                <a href="#Education" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 10, 20, 1, 20)} children={TranslationTable[currentLanguage]["Menu_Education"]} />
                <a href="#Skills" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 15, 20, 2, 20)} children={TranslationTable[currentLanguage]["Menu_Skills"]} />
                <a href="#ProfessionalExpProjects0" onClick={() => setProfExpClicked(true)} style={HudMenuStyles.simple_items_top(5, 10, 20, 3, 20)} children={TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />

                {/* Reveal professional experience sublinks. */}
                {profExpClicked &&
                    <div>
                        <a href="#ProfessionalExpProjects0" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 0, 20)} children={TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                        <a href="#ProfessionalExpProjects1" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 1, 20)} children={TranslationTable[currentLanguage]["Menu_DRIM"]} />
                        <a href="#ProfessionalExpProjects2" style={HudMenuStyles.simple_items_bottom(1, 8, 35, 2, 20)} children={TranslationTable[currentLanguage]["Menu_Everial"]} />
                        <a href="#ProfessionalExpProjects3" style={HudMenuStyles.simple_items_bottom(5, 8, 35, 0, 20)} children={TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                        <a href="#ProfessionalExpProjects4" style={HudMenuStyles.simple_items_bottom(5, 8, 35, 1, 20)} children={TranslationTable[currentLanguage]["Menu_EFN1"]} />
                        <a href="#ProfessionalExpProjects5" style={HudMenuStyles.simple_items_bottom(5, 8, 35, 2, 20)} children={TranslationTable[currentLanguage]["Menu_EFN2"]} />
                    </div>
                }
            </>
        );
    }

    return (
        <>
            {/* Render primary navigation links. */}
            <a href="#MainMenu" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 10, 20, 0, 30)} children={TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href="#Education" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 10, 20, 1, 30)} children={TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href="#Skills" onClick={() => setProfExpClicked(false)} style={HudMenuStyles.simple_items_top(5, 15, 20, 2, 30)} children={TranslationTable[currentLanguage]["Menu_Skills"]} />
            <a href="#ProfessionalExpProjects0" onClick={() => setProfExpClicked(true)} style={HudMenuStyles.simple_items_top(5, 10, 20, 3, 30)} children={TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />

            {/* Reveal professional experience sublinks. */}
            {profExpClicked &&
                <div>
                    <a href="#ProfessionalExpProjects0" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 0, 30)} children={TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                    <a href="#ProfessionalExpProjects1" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 1, 30)} children={TranslationTable[currentLanguage]["Menu_DRIM"]} />
                    <a href="#ProfessionalExpProjects2" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 2, 30)} children={TranslationTable[currentLanguage]["Menu_Everial"]} />
                    <a href="#ProfessionalExpProjects3" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 3, 30)} children={TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                    <a href="#ProfessionalExpProjects4" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 4, 30)} children={TranslationTable[currentLanguage]["Menu_EFN1"]} />
                    <a href="#ProfessionalExpProjects5" style={HudMenuStyles.simple_items_bottom(5, 8, 15, 5, 30)} children={TranslationTable[currentLanguage]["Menu_EFN2"]} />
                </div>
            }
        </>
    );
}
