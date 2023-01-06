import { useRef, useEffect, useState } from "react";
import { useSpring, a } from '@react-spring/three';
import * as THREE from "three";
import { Text3D } from "@react-three/drei";

export function FadingTextModel() {
    // default prop values:
    const [ fade, setFade ] = useState(false);
    const text3DD = useRef();
    const thePlane = useRef();

    useEffect(() => {
        console.log(text3DD);
        console.log(thePlane);
        var textFieldPadding = 0.5
        var textFieldArray = [(thePlane.current.parameters.height) - textFieldPadding, (thePlane.current.parameters.depth) - textFieldPadding]
        console.log(textFieldArray)

    }, [])

    const springFade = useSpring({
        opacity:fade? 1 : 0
    })

    const TextRows = (text) => {
        const lettersPerUnit = 8
        const cubesPerRow = 5
        const rows = [];
        var replace = '.{1,'+(lettersPerUnit * cubesPerRow)+'}'
        const reg = (new RegExp(replace,"g"))
        const textChunksArray = text.match(reg);
        const Text3DD = useRef([]);
        for (let i = 0; i < textChunksArray.length; i++) {
            rows.push(<Text3D
                ref={el => Text3DD.current[i] = el} 
                key={i}
                position={[0,6-i,-2.5]}//Use a more standardised approach
                font={process.env.PUBLIC_URL + "roboto.json"}
                size={0.200}
                height={0.065}
                curveSegments={12}
                >
                    {textChunksArray[i]}
                    <meshStandardMaterial color={[1, 0.15, 0.1]} emissive={[1, 0.1, 0]} />
                </Text3D>
                );
        }

        useEffect(() => {
            for (let i = 0; i < textChunksArray.length; i++) {
                Text3DD.current[i].rotateOnAxis(new THREE.Vector3(0, 1, 0) , Math.PI/2)
            }
        }, [])

        return {rows};
    }

    var loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien in condimentum consectetur adipiscing elit. Integer facilisis semper libero, id aliquam justo suscipit eget. Aenean accumsan sapien.";
    const textPresentation = TextRows(loremIpsum)
    console.log(textPresentation)
    
    return(
    <>
        {textPresentation.rows}
        <a.mesh
        position = {[-0.1,3,-5]}
        >
            <boxGeometry args={[0.2, 7, 6]} ref={thePlane} />
            <a.meshStandardMaterial />            
        </a.mesh>
    </>
    );
}
