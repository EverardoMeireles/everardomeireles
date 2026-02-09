import { useEffect, useMemo, useState } from "react";
import * as THREE from 'three';

export const HtmlDreiMenuStyles = ({
    menu: {
        width: "100%",
        height: "100%",
        padding: "10px",
        margin: "30px",
        backgroundColor: "rgba(255,255,255,1)",
        borderRadius: "10%",
        top: '6000vw',
        left: '6000vw'
    }
})

const simple_items_top = ( topBottomPercentage = 0, initialPosition = 0, spaceIncrement = 0, spaceMultiplier = 0, fontSize = 0 ) => ({
    color: "white",
    top: topBottomPercentage + "%",
    left: initialPosition + spaceIncrement * spaceMultiplier + "%",
    fontSize: fontSize + "px"
})

const simple_items_bottom = ( topBottomPercentage = 0, initialPosition = 0, spaceIncrement = 0, spaceMultiplier = 0, fontSize = 0 )=>( {
    color: "white",
    bottom: topBottomPercentage + "%",
    left: initialPosition + spaceIncrement * spaceMultiplier + "%",
    fontSize:fontSize + "px"
})

const FlagImgStyle = (width = 0, height = 0) => ({
    width : width + "px",
    height : height + "px",
})

const ListStyle = (topPercentage = 0, initialPosition = 0) => ({
    top: topPercentage + "%",
    left: initialPosition + "%",
    cursor: "pointer",
    listStyleType: "none",
    marginBlockStart:"0px",
    marginBlockEnd:"0px",
    // "display":"block",
    "position":"absolute",
    paddingInlineStart:0

})

const arrowContainerStyle = {
    position: 'fixed',
    top: 0,
    right: '20px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 100000
};

const arrowStyle = {
    textDecoration: 'none',
    color: 'black',
    cursor: 'pointer',
    fontSize:'24px',
};

export const HudMenuStyles = {
    simple_items_top: simple_items_top,
    simple_items_bottom: simple_items_bottom,
    FlagImgStyle: FlagImgStyle,
    ListStyle: ListStyle,
    arrowContainerStyle: arrowContainerStyle,
    arrowStyle : arrowStyle
}

//////////////////////////////////////////////////
/////////////// Responsive values ////////////////
//////////////////////////////////////////////////

export const ResponsiveBreakpoints = {
    scene: {
        mobileMax: 500,
        tabletMax: 1200
    },
    hud: {
        mobileMax: 500,
        tabletMax: 1800
    }
};

export const ResponsiveTable = {
    "Mobile":{
        "fadingTitlePosition0": [170, 148, 58],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 146, 59.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [-0.5, 4, -82],
        "fadingTextScale0": 1.5,
        // "fadingTextLettersPerUnit0": 5,d
        "fadingTextPosition1": [11.5, 4.5, -94],
        "fadingTextScale1": 1.3,
        "fadingTextPosition2": [-0.5, 5.5, -105],
        "fadingTextScale2": 1.3,
        "fadingTextPosition3": [-11, 7, -95.5],
        "fadingTextScale3": 1.4,
        "fadingTextPosition4": [-1.5, 22, -82.2],
        "fadingTextScale4": 1.4,
        "fadingTextPosition5": [11.5, 25, -93],
        "fadingTextScale5": 1.3,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },

    "Tablet":{
        "fadingTitlePosition0": [170, 148, 58],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 146, 59.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [1, -0.5, -82],
        "fadingTextScale0": 2.4,
        // "fadingTextLettersPerUnit0": 5,
        "fadingTextPosition1": [11.5, 4.5, -94],
        "fadingTextScale1": 1.8,
        "fadingTextPosition2": [0, 5.5, -105],
        "fadingTextScale2": 2,
        "fadingTextPosition3": [-11, 7, -94.5],
        "fadingTextScale3": 1.7,
        "fadingTextPosition4": [-0.5, 22, -82.2],
        "fadingTextScale4": 1.8,
        "fadingTextPosition5": [11.5, 25, -93],
        "fadingTextScale5": 2,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
    
    "Widescreen":{
        "fadingTitlePosition0": [170, 146, 56],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 144, 57.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [0, 3, -82],
        "fadingTextScale0": 2,
        // "fadingTextLettersPerUnit0": 5,
        "fadingTextPosition1": [11.5, 3.5, -92],
        "fadingTextScale1": 2.1,
        "fadingTextPosition2": [-1, 3, -105],
        "fadingTextScale2": 2.3,
        "fadingTextPosition3": [-11, 3, -95.5],
        "fadingTextScale3": 2,
        "fadingTextPosition4": [-1.5, 18.5, -82.2],
        "fadingTextScale4": 2,
        "fadingTextPosition5": [11.5, 23.5, -90.5],
        "fadingTextScale5": 2,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
}

export const ResponsiveCurveTransitions = {
    Mobile: {
        StartingPoint: [251, 222, -16],
        MainMenu: [194, 150, 63],
        Education: [-17, 97, 27],
        Skills: [13, 35, -15],
        ProfessionalExpProjects0: [4, 4, -71],
        ProfessionalExpProjects1: [22, 4, -99],
        ProfessionalExpProjects2: [-6, 4, -116],
        ProfessionalExpProjects3: [-23, 4, -89],
        ProfessionalExpProjects4: [5, 24, -71],
        ProfessionalExpProjects5: [23, 24, -98],
        ProfessionalExpProjects6: [-6, 24, -116],
        ProfessionalExpProjects7: [-23, 24, -90],
        ProfessionalExpProjects8: [3, 44, -70],
        ProfessionalExpProjects9: [22, 44, -99],
        ProfessionalExpProjects10: [-6, 44, -116],
        ProfessionalExpProjects11: [-23, 44, -89]
    },
    Tablet: {
        StartingPoint: [251, 222, -16],
        MainMenu: [194, 150, 63],
        Education: [-17, 97, 27],
        Skills: [13, 35, -15],
        ProfessionalExpProjects0: [4, 4, -71],
        ProfessionalExpProjects1: [22, 4, -99],
        ProfessionalExpProjects2: [-6, 4, -116],
        ProfessionalExpProjects3: [-23, 4, -89],
        ProfessionalExpProjects4: [5, 24, -71],
        ProfessionalExpProjects5: [23, 24, -98],
        ProfessionalExpProjects6: [-6, 24, -116],
        ProfessionalExpProjects7: [-23, 24, -90],
        ProfessionalExpProjects8: [3, 44, -70],
        ProfessionalExpProjects9: [22, 44, -99],
        ProfessionalExpProjects10: [-6, 44, -116],
        ProfessionalExpProjects11: [-23, 44, -89]
    },
    Widescreen: {
        StartingPoint: [251, 222, -16],
        MainMenu: [194, 150, 63],
        Education: [-17, 97, 27],
        Skills: [13, 35, -15],
        ProfessionalExpProjects0: [4, 4, -71],
        ProfessionalExpProjects1: [22, 4, -99],
        ProfessionalExpProjects2: [-6, 4, -116],
        ProfessionalExpProjects3: [-23, 4, -89],
        ProfessionalExpProjects4: [5, 24, -71],
        ProfessionalExpProjects5: [23, 24, -98],
        ProfessionalExpProjects6: [-6, 24, -116],
        ProfessionalExpProjects7: [-23, 24, -90],
        ProfessionalExpProjects8: [3, 44, -70],
        ProfessionalExpProjects9: [22, 44, -99],
        ProfessionalExpProjects10: [-6, 44, -116],
        ProfessionalExpProjects11: [-23, 44, -89]
    }
};

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!! To set the camera's responsive starting position, go to config.js!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const getViewportSize = () => {
    if (typeof window === "undefined") {
        return { width: 0, height: 0 };
    }

    return { width: window.innerWidth, height: window.innerHeight };
};

export const getSceneLayoutKey = (width) => {
    if (width < ResponsiveBreakpoints.scene.mobileMax) {
        return "Mobile";
    }
    if (width < ResponsiveBreakpoints.scene.tabletMax) {
        return "Tablet";
    }
    return "Widescreen";
};

export const getHudLayoutKey = (width) => {
    if (width <= ResponsiveBreakpoints.hud.mobileMax) {
        return "Mobile";
    }
    if (width <= ResponsiveBreakpoints.hud.tabletMax) {
        return "Tablet";
    }
    return "Widescreen";
};

const applySceneOverrides = (layoutKey, layout) => {
    if (layoutKey === "Mobile" || layoutKey === "Tablet") {
        return {
            ...layout,
            fadingTextPosition4: layout.fadingTextPosition3,
            fadingTextScale4: layout.fadingTextScale3,
            fadingTextPosition5: layout.fadingTextPosition3,
            fadingTextScale5: layout.fadingTextScale3
        };
    }

    return layout;
};

export const useViewportSize = () => {
    const [size, setSize] = useState(getViewportSize);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const handleResize = () => setSize(getViewportSize());
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return size;
};

export const useResponsive = (kind = "scene") => {
    const size = useViewportSize();
    const layoutKey = useMemo(() => {
        if (kind === "hud") {
            return getHudLayoutKey(size.width);
        }
        return getSceneLayoutKey(size.width);
    }, [kind, size.width]);

    const layoutBase = ResponsiveTable[layoutKey] || ResponsiveTable.Widescreen;
    const layout = useMemo(() => {
        if (kind === "scene") {
            return applySceneOverrides(layoutKey, layoutBase);
        }
        return layoutBase;
    }, [kind, layoutKey, layoutBase]);

    return { ...size, key: layoutKey, layout };
};