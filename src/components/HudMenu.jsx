import { useState } from "react";
import { TranslationTable } from "../TranslationTable";

// A menu that is supposed to go on top of the canvas, use with PathNavigation.jsx
export function HudMenu(props) {
    const useStore = props.useStore;
    const currentLanguage = useStore((state) => state.currentLanguage);
    const setLanguage = useStore((state) => state.setLanguage);

    const [profExpClicked, setProfExpClicked] = useState(false);

    const styles = (topBottomPercentage, initialPosition, spaceIncrement, spaceMultiplier) => ({
        simple_items_top: {
            color: "white",
            top: topBottomPercentage + "%",
            left: initialPosition + spaceIncrement * spaceMultiplier + "%",
        },
        simple_items_bottom: {
            color: "white",
            bottom: topBottomPercentage + "%",
            left: initialPosition + spaceIncrement * spaceMultiplier + "%",
        },
    })

    const FlagImgStyle = (width, height) => ({
        width : width + "px",
        height : height + "px",        
    })

    const ListStyle = (topPercentage, initialPosition, spaceIncrement, spaceMultiplier) => ({
        top: topPercentage + "%",
        left: initialPosition + spaceIncrement * spaceMultiplier + "%",
        cursor: "pointer",
        listStyleType: "none",
        marginBlockStart:"0px",
        marginBlockEnd:"0px",
        // "display":"block",
        "position":"absolute"
    })

    const marginDisplay = {marginBottom: "10px", marginLeft:"40px", "display": "inline-block"}

    return(
    <>
        {/* Language change flags */}
        <ul style = {ListStyle(0, 0, 20, 0)}>
            <li style={marginDisplay}>
                <a onClick={() => (setLanguage("English"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "flags/gbr.svg"}></img></a>
            </li>
            <li style={marginDisplay}>
                <a onClick={() => (setLanguage("French"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "flags/fra.svg"}></img></a>
            </li>
        </ul>
        {/* if those are clicked, hide sub elements */}
        <a href = "#MainMenu" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 0).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
        <a href = "#Education" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 1).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
        <a href = "#Skills" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 2).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
        {/* This menu element is supposed to have sub elements */}
        <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {styles(5, 10, 20, 3).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                
        { (profExpClicked == true) &&
        // the sub elements
        <div>
            <a href = "#ProfessionalExpProjects0" style = {styles(5, 8, 15, 0).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
            <a href = "#ProfessionalExpProjects1" style = {styles(5, 8, 15, 1).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
            <a href = "#ProfessionalExpProjects2" style = {styles(5, 8, 15, 2).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
            <a href = "#ProfessionalExpProjects3" style = {styles(5, 8, 15, 3).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
            <a href = "#ProfessionalExpProjects4" style = {styles(5, 8, 15, 4).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
            <a href = "#ProfessionalExpProjects5" style = {styles(5, 8, 15, 5).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
        </div>    
        }
    </>
    );
}