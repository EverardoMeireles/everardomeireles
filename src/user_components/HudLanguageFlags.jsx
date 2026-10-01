import { HudMenuStyles, useResponsive } from "../Styles.jsx";
import config from "../config.js";
import SystemStore from "../SystemStore";

/**
 * Purpose: Renders the HUD language selection flags.
 * Relationships: Independently reads its layout and updates SystemStore.
 */
export function HudLanguageFlags() {
    // Read layout and shared language actions.
    const { key: hudLayoutKey } = useResponsive("hud");
    const setLanguage = SystemStore((state) => state.setLanguage);
    const setTrigger = SystemStore((state) => state.setTrigger);

    // Keep the existing flag spacing across layouts.
    const marginDisplay = {marginBottom: "10px", marginLeft:"40px", "display": "inline-block"};
    const listTop = hudLayoutKey === "Mobile" ? -7 : 0;

    return (
        <ul style={HudMenuStyles.ListStyle(0, listTop)}>
            <li style={marginDisplay}>
                <a onClick={() => {
                    setLanguage("English");
                    if (hudLayoutKey === "Tablet") setTrigger(true);
                }}>
                    <img style={HudMenuStyles.FlagImgStyle(32,24)} src={config.resource_path + "/CountryFlags/gbr.svg"} alt="British flag"></img>
                </a>
            </li>
            <li style={marginDisplay}>
                <a onClick={() => setLanguage("French")}>
                    <img style={HudMenuStyles.FlagImgStyle(32,24)} src={config.resource_path + "/CountryFlags/fra.svg"} alt="French flag"></img>
                </a>
            </li>
            <li style={marginDisplay}>
                <a onClick={() => setLanguage("Portuguese")}>
                    <img style={HudMenuStyles.FlagImgStyle(32,24)} src={config.resource_path + "/CountryFlags/bra.svg"} alt="Brazilian flag"></img>
                </a>
            </li>
        </ul>
    );
}
