import { useState, useEffect, useRef } from "react";
import { TranslationTable } from "../TranslationTable";
import { HudMenuStyles } from "../Styles";
import { increaseOrDecreaseGraphics, graphicsModes, getKeyByValue } from "../Helper";
import config from '../config';
import { path_points_even_more_simple_lookat_dict, overrideCurves, overrideCurvesSimple} from "../PathPoints";

/* eslint-disable jsx-a11y/anchor-is-valid */
// has jsx HudMenuStyles
// A menu that is supposed to go on top of the canvas, use with PathNavigation.jsx
export function HudMenu(props) {
    const useStore = props.useStore;
    const {graphicalLevelIndicatorIsEnabled = true} = props;
    const {goesInvisible = false} = props;
    const {goesTransparent = true} = props; // setting this to true while goesInvisible is also true is useless
    const {transparentTimer = 5000} = props;
    const {transparency = 0.15} = props;

    const currentLanguage = useStore((state) => state.currentLanguage);
    const setLanguage = useStore((state) => state.setLanguage);
    const setGraphicalMode = useStore((state) => state.setGraphicalMode);
    const currentGraphicalMode = useStore((state) => state.currentGraphicalMode);
    const enableDynamicGraphicalModeSetting = useStore((state) => state.enableDynamicGraphicalModeSetting);
    const setEnableDynamicGraphicalModeSetting = useStore((state) => state.setEnableDynamicGraphicalModeSetting);
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);
    const transitionEnded = useStore((state) => state.transitionEnded);
    const setForcedCameraMovePathCurve = useStore((state) => state.setForcedCameraMovePathCurve);
    const setForcedCameraTarget = useStore((state) => state.setForcedCameraTarget);
    const setDesiredPath = useStore((state) => state.setDesiredPath);

    // const animationTriggerState = useStore((state) => state.animationTriggerState);
    // const setAnimationTriggerState = useStore((state) => state.setAnimationTriggerState);

	//DEBUG animations
    const toggleTrigger = useStore((state) => state.toggleTrigger);

    const setTrigger = useStore((state) => state.setTrigger);

    const [profExpClicked, setProfExpClicked] = useState(false);
    const [isTransparent, setIsTransparent] = useState(false);

    const marginDisplay = {marginBottom: "10px", marginLeft:"40px", "display": "inline-block"};

    const numberOfGraphicalModes = Object.keys(graphicsModes).length;

    const toggleDynamicGraphicalModeSetting = () => {
        setEnableDynamicGraphicalModeSetting(!enableDynamicGraphicalModeSetting);
      };

    // Function to hide the image after a delay
    const hideImage = () => {
        return setTimeout(() => {
            setIsTransparent(true);
        }, transparentTimer); // 5000 milliseconds = 5 seconds
    };

    // Initial hide after 5 seconds
    useEffect(() => {
        const timer = hideImage();

        return () => clearTimeout(timer);
    }, []);

    // Reset visibility and timer on currentGraphicalMode change
    useEffect(() => {
        setIsTransparent(false);
        const timer = hideImage();

        return () => clearTimeout(timer);
    }, [currentGraphicalMode, enableDynamicGraphicalModeSetting]);


////////////////////////////////////////////////////////////////////////////////////////////
/// Make the camera transition when the url changes(when one of the buttons are clicked) ///
////////////////////////////////////////////////////////////////////////////////////////////

    const currentPath = useRef("MainMenu");
    const desiredPath = useRef("MainMenu");
    useEffect(() => {
    const handlePopState = (event) => {
        const href = event.currentTarget.location.href;
        const urlPath = href.slice(href.indexOf('#') + 1);

        if (desiredPath.current !== urlPath) {
            desiredPath.current = urlPath;
            setDesiredPath(desiredPath.current)
            setForcedCameraTarget(path_points_even_more_simple_lookat_dict[desiredPath.current])
            setForcedCameraMovePathCurve(overrideCurves[currentPath.current + "-" + desiredPath.current]);
            setTransitionEnded(false);
        }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
}, []);
    

    // Once the transition is over, set the new current path position
    useEffect(() => {
        currentPath.current = desiredPath.current;
    }, [transitionEnded]);


    return(
    <>
        {/* hide the toggle unless the graphics toggle is enabled in the settings
        and in case the graphics check is also enabled, wait for the benchmark to 
        finish before showing the toggle */}
        {(config.show_html_menu_graphics_toggle && (!config.check_graphics || (config.check_graphics))) &&
            <div style={HudMenuStyles.arrowContainerStyle}>
                {/* Auto button */}
                <div
                    onClick={toggleDynamicGraphicalModeSetting}
                    style={{
                        color: enableDynamicGraphicalModeSetting ? 'green' : 'red',
                        cursor: 'pointer',
                        opacity: goesTransparent && isTransparent ? transparency : 1,
                        visibility: goesInvisible && isTransparent ? 'hidden' : 'visible'
                    }}>Auto</div>

                {/* Graphical mode arrows */}
                <b onClick={() => {/*setAnimationTriggerState(!animationTriggerState)*/increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, -1); setEnableDynamicGraphicalModeSetting(false)}} style = {HudMenuStyles.arrowStyle}>&#x2190;</b>
                <b onClick={() => {/*setAnimationTriggerState(!animationTriggerState)*/increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, 1); setEnableDynamicGraphicalModeSetting(false)}} style = {HudMenuStyles.arrowStyle}>&#x2192;</b>
                
                {/* Graphical mode indicator */}
                {graphicalLevelIndicatorIsEnabled && <img 
                    style = { {...HudMenuStyles.FlagImgStyle(24, 32), opacity: goesTransparent && isTransparent ? transparency : 1, 
                    visibility: goesInvisible && isTransparent ? 'hidden' : 'visible'}} 
                    src = {config.resource_path + "/LevelIndicators/" + getKeyByValue(graphicsModes, currentGraphicalMode) + "of" + (numberOfGraphicalModes-1).toString() + ".png"} 
                    alt = "Graphic level"></img>}
            </div> 
        }
        {props.responsive.width <= 500 &&
        <>
            <ul style = {HudMenuStyles.ListStyle(0, -7)}>
                <li style = {marginDisplay}>
                    <a onClick = {() => (setLanguage("English"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/gbr.svg"} alt = "British flag"></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("French"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/fra.svg"} alt = "French flag"></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("Portuguese"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/bra.svg"} alt = "Brazilian flag"></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(1, 30, 20, 0, 17)} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(1, 30, 20, 1, 17)} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(6, 30, 20, 0, 17)} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {HudMenuStyles.simple_items_top(6, 30, 20, 1, 17)} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
            
            { (profExpClicked === true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 0, 13)} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 1, 13)} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 2, 13)} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {HudMenuStyles.simple_items_bottom(7, 8, 35, 0, 13)} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {HudMenuStyles.simple_items_bottom(7, 8, 35, 1, 13)} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {HudMenuStyles.simple_items_bottom(7, 8, 35, 2, 13)} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }

        {(props.responsive.width >= 500 && props.responsive.width <= 1800) &&
        <>
            <ul style = {HudMenuStyles.ListStyle(0, 0)}>
                <li style={marginDisplay}>
                    <a onClick = {() => (setLanguage("English"),setTrigger(true))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/gbr.svg"} alt = "British flag"></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick = {() => (setLanguage("French"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/fra.svg"} alt = "French flag"></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("Portuguese"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/bra.svg"} alt = "Brazilian flag"></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 10, 20, 0, 20)} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 10, 20, 1, 20)} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 15, 20, 2, 20)} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {HudMenuStyles.simple_items_top(5, 10, 20, 3, 20)} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                    
            { (profExpClicked === true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 0, 20)} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 1, 20)} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {HudMenuStyles.simple_items_bottom(1, 8, 35, 2, 20)} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {HudMenuStyles.simple_items_bottom(5, 8, 35, 0, 20)} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {HudMenuStyles.simple_items_bottom(5, 8, 35, 1, 20)} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {HudMenuStyles.simple_items_bottom(5, 8, 35, 2, 20)} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }

        {props.responsive.width > 1800 &&
        <>
            <ul style = {HudMenuStyles.ListStyle(0, 0)}>
                <li style = {marginDisplay}>
                    <a onClick = {() => (setLanguage("English"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/gbr.svg"} alt = "British flag"></img></a>
                </li>
                <li style = {marginDisplay}>
                    <a onClick = {() => (setLanguage("French"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/fra.svg"} alt = "French flag"></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("Portuguese"))}> <img style = {HudMenuStyles.FlagImgStyle(32,24)} src = {config.resource_path + "/CountryFlags/bra.svg"} alt = "Brazilian flag"></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 10, 20, 0, 30)} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 10, 20, 1, 30)} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick = {() => setProfExpClicked(false)} style = {HudMenuStyles.simple_items_top(5, 15, 20, 2, 30)} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {HudMenuStyles.simple_items_top(5, 10, 20, 3, 30)} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                    
            { (profExpClicked === true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 0, 30)} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 1, 30)} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 2, 30)} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 3, 30)} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 4, 30)} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {HudMenuStyles.simple_items_bottom(5, 8, 15, 5, 30)} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }
    </>
    );
}