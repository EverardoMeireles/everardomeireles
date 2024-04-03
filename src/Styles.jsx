export const ResponsiveTable = {
    "Mobile":{
        "fadingTitlePosition0": [170, 148, 58],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 146, 59.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [1, 4, -82],
        "fadingTextScale0": 2,
        // "fadingTextLettersPerUnit0": 5,d
        "fadingTextPosition1": [11.5, 4.5, -95],
        "fadingTextScale1": 1.8,
        "fadingTextPosition2": [-2, 5.5, -105],
        "fadingTextScale2": 2,
        "fadingTextPosition3": [-11, 7, -94.5],
        "fadingTextScale3": 1.7,
        "fadingTextPosition4": [-0.5, 25, -82.2],
        "fadingTextScale4": 1.8,
        "fadingTextPosition5": [11.5, 25, -95],
        "fadingTextScale5": 2,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },

    "Tablet":{
        "fadingTitlePosition0": [170, 148, 58],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 146, 59.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [1, 4, -82],
        "fadingTextScale0": 2,
        // "fadingTextLettersPerUnit0": 5,
        "fadingTextPosition1": [11.5, 4.5, -95],
        "fadingTextScale1": 1.8,
        "fadingTextPosition2": [-2, 5.5, -105],
        "fadingTextScale2": 2,
        "fadingTextPosition3": [-11, 7, -94.5],
        "fadingTextScale3": 1.7,
        "fadingTextPosition4": [-0.5, 25, -82.2],
        "fadingTextScale4": 1.8,
        "fadingTextPosition5": [11.5, 25, -95],
        "fadingTextScale5": 2,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
    
    "Widescreen":{
        "fadingTitlePosition0": [170, 148, 58],
        "fadingTitleScale0": 17,
        "fadingTitlePosition1": [170, 146, 59.5],
        "fadingTitleScale1": 17,
        "fadingTextPosition0": [0, 3, -82],
        "fadingTextScale0": 2,
        // "fadingTextLettersPerUnit0": 5,
        "fadingTextPosition1": [11.5, 3.5, -93],
        "fadingTextScale1": 2.1,
        "fadingTextPosition2": [1, 3, -105],
        "fadingTextScale2": 2.3,
        "fadingTextPosition3": [-11, 3, -95.5],
        "fadingTextScale3": 2,
        "fadingTextPosition4": [-1.5, 21.5, -82.2],
        "fadingTextScale4": 2,
        "fadingTextPosition5": [11.5, 23.5, -92.5],
        "fadingTextScale5": 2,
        "FloatingTextSkillsPosition" : [[0, 5, 0], [-3, 0, 3], [2, 5, 8], [0, 0, 4], [3, 3, 0], [-6, 3, 5], [5,0, 5], [4, 2, 6], [3, 3, 8], [0, 0, 8]]
    },
}

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