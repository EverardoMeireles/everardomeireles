import { useState } from "react";

// A menu that is supposed to go on top of the canvas, use with PathNavigation.jsx
export function HudMenu() {
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

    return(
    <>
        {/* if those are clicked, hide sub elements */}
        <a href="#MainMenu" onClick={()=>setProfExpClicked(false)} style={styles(5, 10, 20, 0).simple_items_top}/*className="first-item menu-items"*/ children="Accueil" />
        <a href="#Education" onClick={()=>setProfExpClicked(false)} style={styles(5, 10, 20, 1).simple_items_top}/*className="second-item menu-items"*/ children="Formation" />
        <a href="#Skills" onClick={()=>setProfExpClicked(false)} style={styles(5, 10, 20, 2).simple_items_top} /*className="third-item menu-items"*/ children="Compétences" />
        {/* This menu element is supposed to have sub elements */}
        <a href="#ProfessionalExpProjects0" onClick={()=>(setProfExpClicked(true), console.log(profExpClicked))} style={styles(5, 10, 20, 3).simple_items_top} /*className="fourth-item menu-items"*/ children="Expérience professionnelle" />
        { (profExpClicked == true) &&
        // the sub elements
        <div>
            <a href="#ProfessionalExpProjects0" style={styles(5, 8, 15, 0).simple_items_bottom} children="Prospere ITB" />
            <a href="#ProfessionalExpProjects1" style={styles(5, 8, 15, 1).simple_items_bottom} children="DRIM" />
            <a href="#ProfessionalExpProjects2" style={styles(5, 8, 15, 2).simple_items_bottom} children="Everial" />
            <a href="#ProfessionalExpProjects3" style={styles(5, 8, 15, 3).simple_items_bottom} children="Brésil eco-buggy" />
            <a href="#ProfessionalExpProjects4" style={styles(5, 8, 15, 4).simple_items_bottom} children="EFN projet PPMS" />
            <a href="#ProfessionalExpProjects5" style={styles(5, 8, 15, 5).simple_items_bottom} children="EFN Professeur" />
        </div>    
        }
    </>
    );
}
