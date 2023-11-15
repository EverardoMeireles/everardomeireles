import React from "react";

// this component is used to navigate trought the scene using the url paths, use with HudMenu.jsx
export function PathNavigation(props) {
    const useStore = props.useStore;
    const {setPath} = props.useStore();
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);

    var urlPath;
    let str;
    window.addEventListener('popstate', function (event) {
        str = event.currentTarget.location.href;
        urlPath = str.slice(str.indexOf('#') + 1);
        
        setPath(urlPath);
        setTransitionEnded(false);
    });
    return(
    <></>
    );
}
