import { useEffect, useMemo, useState } from "react";

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

// Keep tutorial layouts consistent across viewport orientations.
export const TutorialStyles = {
    overlay: {
        position: "absolute",
        inset: 0,
        zIndex: 100002,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflow: "hidden",
        background: "rgba(13, 18, 22, 0.97)",
        color: "#f7f5ed",
        fontFamily: "Arial, sans-serif",
        transition: "opacity 300ms ease",
        outline: "none",
        touchAction: "pan-y"
    },
    panel: {
        width: "100%",
        maxWidth: "2160px",
        maxHeight: "100%",
        padding: "24px",
        overflowY: "auto",
        overscrollBehavior: "contain",
        border: "1px solid #394349",
        borderRadius: "20px",
        background: "#1c252a",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)"
    },
    heading: { margin: "0 0 24px", fontSize: "37px", lineHeight: 1.15, textAlign: "center" },
    grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" },
    card: {
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        gap: "12px",
        padding: "18px",
        border: "1px solid #465257",
        borderRadius: "12px",
        background: "#273238",
        color: "inherit",
        textAlign: "center",
        font: "inherit"
    },
    title: { display: "block", margin: 0, fontSize: "20px", fontWeight: 700, lineHeight: 1.2 },
    text: { display: "block", margin: 0, color: "#d4dbda", fontSize: "15px", lineHeight: 1.45 },
    images: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" },
    image: { display: "block", width: "100%", maxHeight: "460px", objectFit: "contain", borderRadius: "8px" },
    hint: { margin: "20px 0 0", color: "#b2bfbe", fontSize: "13px", textAlign: "center" },
    mobileGrid: { position: "relative", "--tutorial-cue-duration": "8s", "--tutorial-cue-delay": "-1s" },
    controlChoice: { position: "relative" },
    controlCue: {
        position: "absolute",
        inset: 0,
        gridColumn: "1 / -1",
        gridRow: "1 / 2",
        zIndex: 2,
        overflow: "hidden",
        pointerEvents: "none"
    },
    controlCueTrack: {
        position: "absolute",
        left: "37.5%",
        top: "6px",
        width: "25%",
        animation: "housemaker-tutorial-finger-move var(--tutorial-cue-duration) ease-in-out infinite",
        animationDelay: "var(--tutorial-cue-delay)",
        willChange: "transform"
    },
    controlFinger: {
        display: "block",
        width: "96px",
        height: "auto",
        opacity: 0.5,
        pointerEvents: "none",
        transformOrigin: "25% 10%",
        filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45))",
        animation: "housemaker-tutorial-finger-press var(--tutorial-cue-duration) ease-in-out infinite",
        animationDelay: "var(--tutorial-cue-delay)",
        willChange: "transform"
    },
    portrait: {
        overlay: { padding: "12px" },
        panel: { padding: "14px", borderRadius: "16px" },
        heading: { marginBottom: "16px", fontSize: "25px" },
        grid: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
        card: { padding: "12px", gap: "10px" },
        title: { fontSize: "16px" },
        text: { fontSize: "13px" },
        controlFinger: { width: "84px" },
        gyroImage: { maxHeight: "220px" },
        dualImage: { maxHeight: "440px" }
    },
    landscape: {
        overlay: { padding: "10px" },
        panel: { padding: "12px", maxWidth: "1880px", borderRadius: "14px" },
        heading: { marginBottom: "12px", fontSize: "24px" },
        grid: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
        card: { padding: "10px", gap: "6px" },
        title: { fontSize: "16px" },
        text: { fontSize: "12px" },
        gyroImages: { flexDirection: "column" },
        gyroImage: { maxHeight: "190px" },
        dualImage: { maxHeight: "190px" }
    }
};

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

// Responsive cell arrangement, build css grid according to these values.
const ResponsiveGridArray = {
    Mobile: {
        intro: [
            { row: "13fr", columns: ["1fr"] },
            { row: "15fr", columns: ["1fr"] },
            { row: "50fr", columns: ["2fr", "1fr"] }
        ],
        services: [
            { row: "4fr", columns: ["1fr"] },
            { row: "66fr", columns: ["1fr"] }
        ],
        examples: [
            { row: "3fr", columns: ["1fr"] },
            { row: "5.5fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] }
        ],
    },

    Tablet: {
        intro: [
            { row: "2.5fr", columns: ["1fr"] },
            { row: "2.5fr", columns: ["1fr"] },
            { row: "11fr", columns: ["2fr", "1fr"] }
        ],

        services: [
            { row: "1fr", columns: ["1fr"] },
            { row: "8.88fr", columns: ["1fr"] }
        ],

        examples: [
            { row: "3fr", columns: ["1fr"] },
            { row: "4fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] },
            { row: "2fr", columns: ["1fr"] },
            { row: "20fr", columns: ["1fr"] }
        ],
    },

    Widescreen: {
        intro: [
            { row: "4.5fr", columns: ["1fr"] },
            { row: "3fr", columns: ["1fr"] },
            { row: "11fr", columns: ["2fr", "1fr"] }

        ],

        services: [
            { row: "1fr", columns: ["1fr"] },
            { row: "8.18fr", columns: ["1fr"] }
        ],

        examples: [
            { row: "1fr", columns: ["1fr"] },
            { row: "0.8fr", columns: ["1fr"] },
            { row: "0.3fr", columns: ["1fr", "1fr", "1fr"] },
            { row: "3.5fr", columns: ["1fr", "1fr", "1fr"] },
            { row: "3.5fr", columns: ["1fr", "1fr", "1fr"] }
        ],
    }

};

export const ResponsiveTable = {
    Mobile: {
        fadingTitlePosition0: [170, 148, 58],
        fadingTitleScale0: 17,
        fadingTitlePosition1: [170, 146, 59.5],
        fadingTitleScale1: 17,
        fadingTextPosition0: [-0.5, 4, -82],
        fadingTextScale0: 1.5,
        // "fadingTextLettersPerUnit0": 5,d
        fadingTextPosition1: [11.5, 4.5, -94],
        fadingTextScale1: 1.3,
        fadingTextPosition2: [-0.5, 5.5, -105],
        fadingTextScale2: 1.3,
        fadingTextPosition3: [-11, 7, -95.5],
        fadingTextScale3: 1.4,
        fadingTextPosition4: [-1.5, 22, -82.2],
        fadingTextScale4: 1.4,
        fadingTextPosition5: [11.5, 25, -93],
        fadingTextScale5: 1.3,
        FloatingTextSkillsPosition: [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },

    Tablet: {
        fadingTitlePosition0: [170, 148, 58],
        fadingTitleScale0: 17,
        fadingTitlePosition1: [170, 146, 59.5],
        fadingTitleScale1: 17,
        fadingTextPosition0: [1, -0.5, -82],
        fadingTextScale0: 2.4,
        // "fadingTextLettersPerUnit0": 5,
        fadingTextPosition1: [11.5, 4.5, -94],
        fadingTextScale1: 1.8,
        fadingTextPosition2: [0, 5.5, -105],
        fadingTextScale2: 2,
        fadingTextPosition3: [-11, 7, -94.5],
        fadingTextScale3: 1.7,
        fadingTextPosition4: [-0.5, 22, -82.2],
        fadingTextScale4: 1.8,
        fadingTextPosition5: [11.5, 25, -93],
        fadingTextScale5: 2,
        FloatingTextSkillsPosition: [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
    
    Widescreen: {
        fadingTitlePosition0: [170, 146, 56],
        fadingTitleScale0: 17,
        fadingTitlePosition1: [170, 144, 57.5],
        fadingTitleScale1: 17,
        fadingTextPosition0: [0, 3, -82],
        fadingTextScale0: 2,
        // "fadingTextLettersPerUnit0": 5,
        fadingTextPosition1: [11.5, 3.5, -92],
        fadingTextScale1: 2.1,
        fadingTextPosition2: [-1, 3, -105],
        fadingTextScale2: 2.3,
        fadingTextPosition3: [-11, 3, -95.5],
        fadingTextScale3: 2,
        fadingTextPosition4: [-1.5, 18.5, -82.2],
        fadingTextScale4: 2,
        fadingTextPosition5: [11.5, 23.5, -90.5],
        fadingTextScale5: 2,
        FloatingTextSkillsPosition: [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
}

export const Responsive3DCurveTransitions = {
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
        window.addEventListener("orientationchange", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
        };
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
