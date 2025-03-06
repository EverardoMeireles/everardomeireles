import React from "react";

// this component is used to navigate trought the scene using the url paths, use with HudMenu.jsx 
// or another component that uses the url paths
export function PathNavigation(props) {
    const useStore = props.useStore;
    const {setDesiredPath} = props.useStore();
    const setTransitionEnded = useStore((state) => state.setTransitionEnded);
    const desired_path = useStore((state) => state.desired_path);

    var urlPath;
    let str;
    window.addEventListener('popstate', function (event) {
        str = event.currentTarget.location.href;
        urlPath = str.slice(str.indexOf('#') + 1);
            setDesiredPath(urlPath);
            setTransitionEnded(false);        
    });
    return(
    <></>
    );
}
