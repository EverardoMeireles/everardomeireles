    // replace it by store's value later
export const graphicsModes = {
    0:"potato",
    1:"potatoPremium",
    2:"normal",
    3:"high"
}

export var oneOrZero = {
    1: 0,
    0: 1
}

// get a dictionary's key by its value
export function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

// A function to smooth out the camera movement
export function smoothStep(x) {
    let Sn = -2 * Math.pow(x, 3) + 3 * Math.pow(x, 2);
    if(x >= 1){
        Sn = 1;
    }
    return Sn;
}

// increase or decrease the graphics settings
export function increaseOrDecreaseGraphics(currentGraphicalMode, setGraphicalMode, higherOrLower)
{
    let newGraphicalModeKey;
    let newGraphicalMode;

    newGraphicalModeKey = parseInt(getKeyByValue(graphicsModes, currentGraphicalMode)) + higherOrLower
    newGraphicalMode = graphicsModes[newGraphicalModeKey]

    if(!(newGraphicalModeKey < 0) && !(newGraphicalModeKey >= Object.keys(graphicsModes).length)){
        setGraphicalMode(newGraphicalMode)
    }
}

export function getRandomInt(min, max) {
    return Math.random() * (max - min + 1) + min;
}