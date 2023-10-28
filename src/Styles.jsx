export const ResponsiveTable = {
    "Mobile":{
        "floatingTextPos0":[0, 0, 0]
    },

    "Widescreen":{
        "floatingTextPos0":[0, 0, 0]
    },

    "English" : [0, 0, 0],
    "titlePosition0" : [170, 148, 58]
}

export const HtmlDreiMenuStyles = ({
    menu: {
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        padding: "10px",
        margin: "30px",
        backgroundColor: "rgba(255,255,255,1)",
        borderRadius: "10%",
        top: '6000vw',
        left: '6000vw'
    },
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

export const HudMenuStyles = {
    simple_items_top: simple_items_top,
    simple_items_bottom: simple_items_bottom,
    FlagImgStyle: FlagImgStyle,
    ListStyle: ListStyle,
}