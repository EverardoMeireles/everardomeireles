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

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
    return Math.pow(t, 3);
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

export function removeFileExtensionString(inputString) {
    // Find the last dot in the string
    const lastDotIndex = inputString.lastIndexOf('.');

    // If a dot is found and it's not the first character
    if (lastDotIndex > 0) {
        // Return the string without the extension
        return inputString.slice(0, lastDotIndex);
    } else {
        // If no dot is found, return the original string
        return inputString;
    }
}

// Function to parse the JSON and get a specific object, if specified
export async function parseJson(filePath, objectToGet = null) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.log('File does not exist.');
            return null;
        }
        const jsonData = await response.json();
        if (objectToGet) {
            if (jsonData[objectToGet]) {
                console.log("json found!")
                return jsonData[objectToGet];
            } else {
                console.log(`${objectToGet} not found in the JSON.`);
                return null;
            }
        } else {
            return jsonData;
        }
    } catch (error) {
        console.log('Error fetching JSON:', error);
        return null;
    }
}