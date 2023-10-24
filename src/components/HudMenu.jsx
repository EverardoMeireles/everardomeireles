
import { useState, useEffect } from "react";
import { TranslationTable } from "../TranslationTable";

// A menu that is supposed to go on top of the canvas, use with PathNavigation.jsx
export function HudMenu(props) {
    const useStore = props.useStore;
    const currentLanguage = useStore((state) => state.currentLanguage);
    const setLanguage = useStore((state) => state.setLanguage);

    const [profExpClicked, setProfExpClicked] = useState(false);

    const [screenSize, setScreenSize] = useState(getCurrentDimension());

    // const lol = screen.width;

    function getCurrentDimension(){
        console.log(window.innerWidth);
        console.log(window.innerHeight);
        // console.log("Maximum screen width:" + screen.width);

        return {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }
    const lol = props.responsive
    useEffect(()=>{console.log(props.responsive)})
    // useEffect(() => {
    //       const updateDimension = () => {
    //             setScreenSize(getCurrentDimension())
    //       }
    //       window.addEventListener('resize', updateDimension);

    //       return(() => {
    //           window.removeEventListener('resize', updateDimension);
    //       })
    // }, [screenSize])

    const styles = (topBottomPercentage, initialPosition, spaceIncrement, spaceMultiplier, fontSize) => ({
        simple_items_top: {
            color: "white",
            top: topBottomPercentage + "%",
            left: initialPosition + spaceIncrement * spaceMultiplier + "%",
            fontSize: fontSize + "px"/*screenSize.width >= 900 ? 30 * (screenSize.width / 1920) : 17 + "px"*/
        },
        simple_items_bottom: {
            color: "white",
            bottom: topBottomPercentage + "%",
            left: initialPosition + spaceIncrement * spaceMultiplier + "%",
            fontSize:fontSize + "px"
        },
    })

    const FlagImgStyle = (width, height) => ({
        width : width + "px",
        height : height + "px",
    })

    const ListStyle = (topPercentage, initialPosition) => ({
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

    const marginDisplay = {marginBottom: "10px", marginLeft:"40px", "display": "inline-block"}

    return(
    <>
        {props.responsive.width <= 500 &&
        <>
            <ul style = {ListStyle(0, -7, 0)}>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("English"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/gbr.svg"}></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("French"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/fra.svg"}></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick={() => setProfExpClicked(false)} style = {styles(1, 30, 20, 0, 17).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick={() => setProfExpClicked(false)} style = {styles(1, 30, 20, 1, 17).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick={() => setProfExpClicked(false)} style = {styles(6, 30, 20, 0, 17).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {styles(6, 30, 20, 1, 17).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                    
            { (profExpClicked == true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {styles(1, 8, 35, 0, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {styles(1, 8, 35, 1, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {styles(1, 8, 35, 2, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {styles(7, 8, 35, 0, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {styles(7, 8, 35, 1, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {styles(7, 8, 35, 2, 13).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }

        {(props.responsive.width >= 500 && props.responsive.width <= 1800) &&
        <>
            <ul style = {ListStyle(0, 0, 0)}>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("English"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/gbr.svg"}></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("French"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/fra.svg"}></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 0, 20).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 1, 20).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick={() => setProfExpClicked(false)} style = {styles(5, 15, 20, 2, 20).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {styles(5, 10, 20, 3, 20).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                    
            { (profExpClicked == true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {styles(1, 8, 35, 0, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {styles(1, 8, 35, 1, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {styles(1, 8, 35, 2, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {styles(5, 8, 35, 0, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {styles(5, 8, 35, 1, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {styles(5, 8, 35, 2, 20).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }

        {props.responsive.width > 1800 &&
        <>
            <ul style = {ListStyle(0, 0, 0)}>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("English"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/gbr.svg"}></img></a>
                </li>
                <li style={marginDisplay}>
                    <a onClick={() => (setLanguage("French"))}> <img style = {FlagImgStyle(32,24)} src = {process.env.PUBLIC_URL + "CountryFlags/fra.svg"}></img></a>
                </li>
            </ul>
            <a href = "#MainMenu" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 0, 30).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_MainMenu"]} />
            <a href = "#Education" onClick={() => setProfExpClicked(false)} style = {styles(5, 10, 20, 1, 30).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Education"]} />
            <a href = "#Skills" onClick={() => setProfExpClicked(false)} style = {styles(5, 15, 20, 2, 30).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_Skills"]} />
            {/* This menu element is supposed to have sub elements */}
            <a href = "#ProfessionalExpProjects0" onClick = {() => (setProfExpClicked(true))} style = {styles(5, 10, 20, 3, 30).simple_items_top} children = {TranslationTable[currentLanguage]["Menu_ProfessionalExperience"]} />
                    
            { (profExpClicked == true) &&
            // the sub elements
            <div>
                <a href = "#ProfessionalExpProjects0" style = {styles(5, 8, 15, 0, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_ProspereITB"]} />
                <a href = "#ProfessionalExpProjects1" style = {styles(5, 8, 15, 1, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_DRIM"]} />
                <a href = "#ProfessionalExpProjects2" style = {styles(5, 8, 15, 2, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_Everial"]} />
                <a href = "#ProfessionalExpProjects3" style = {styles(5, 8, 15, 3, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_BresilEcoBuggy"]} />
                <a href = "#ProfessionalExpProjects4" style = {styles(5, 8, 15, 4, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN1"]} />
                <a href = "#ProfessionalExpProjects5" style = {styles(5, 8, 15, 5, 30).simple_items_bottom} children = {TranslationTable[currentLanguage]["Menu_EFN2"]} />
            </div>    
            }
        </>
        }
    </>
    );
}
