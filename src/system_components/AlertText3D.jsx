import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useState } from "react";

/**
 * @param {string} [textTitle] - Text title.
 * @param {string} [text] - Text content to display.
 * @param {string} [titleColor] - Color value for title color.
 * @param {string} [textColor] - Color value for text color.
 * @param {number} [textSize] - Text size.
 * @param {string} [positionX] - RIGHT.
 * @param {string} [positionY] - TOP.
 * @param {number} [width] - Width.
 * @param {number} [durationMiliseconds] - Timing value for duration miliseconds.
 */
export const AlertText3D = React.memo((props) => {
    const {textTitle = 'Hello, World!'} = props;
    const {text = ''} = props;
    const {titleColor = 'red'} = props;
    const {textColor = 'blue'} = props;
    const {textSize = 23} = props;
    const {positionX = '-10'} = props;
    const {positionY = '-50'} = props;
    const {width = 1000} = props;
    const {durationMiliseconds = 6000} = props;

    const [render, setRender] = useState(true);
    setTimeout(() => {
        setRender(false);
    }, durationMiliseconds);

    if(!render){
    return null;
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

AlertText3D.displayName = "AlertText3D";
