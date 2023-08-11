import React, { useRef, useEffect } from "react";
import {useSpring, a} from '@react-spring/three';

// this component is used to navigate trought the scene using the url paths, use with HudMenu.jsx
export function PathNavigation(props) {
    const {setPath} = props.useStore();
    var urlPath;
    let str;
    window.addEventListener('popstate', function (event) {
        str = event.currentTarget.location.href;
        urlPath = str.slice(str.indexOf('#') + 1);
        
        console.log(urlPath)
        setPath(urlPath);
    });
    return(
    <></>
    );
}
