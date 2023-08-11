import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useState } from "react";

export const AlertText3D = React.memo((props) => {
    const {textTitle = 'Hello, World!'} = props;
    const {text = ''} = props;
    const {titleColor = 'red'} = props;
    const {textColor = 'blue'} = props;
    const {textSize = 23} = props;
    const {positionX = '-10'} = props;// RIGHT
    const {positionY = '-50'} = props;// TOP
    const {width = 1000} = props;
    const {durationMiliseconds = 6000} = props;

    const [render, setRender] = useState(true);
    setTimeout(() => {
        setRender(false)
    }, durationMiliseconds)

    if(!render){
    return null
    }

    return (
        <>
            {render && <Html style={{width:width, transform: 'translateX(' + positionX + 'vw) translateY(' + positionY + 'vh)'}}>
                <h1 style={{color:titleColor}}>
                    {textTitle}
                </h1>
                <p style={{color:titleColor, size:textSize, color:textColor}}>
                    {text}
                </p>
            </Html>}
        </>
    );
})