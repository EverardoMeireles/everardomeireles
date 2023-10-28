import { Html } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { HtmlDreiMenuStyles } from "../Styles";

// has jsx styles
// Put inside default camera(tested in perspective camera)
export function HtmlDreiMenu(props) {
    const setPath = props.useStore((state) => state.setPath);
    const setTransitionEnded = props.useStore((state) => state.setTransitionEnded);

    const meshHtmlRef = useRef();

    const [parentMenuClicked, setParentMenuClicked] = useState(false);

    useEffect(()=>{
        meshHtmlRef.current.position.x=100;
        meshHtmlRef.current.position.y=150;
    })

    useFrame((state) => {
        if (meshHtmlRef.current) {
        meshHtmlRef.current.position.z=state.camera.position.z-1000;
        // meshHtmlRef.current.position.y=state.camera.position.y;
        // meshHtmlRef.current.position.x=state.camera.position.x-150;
        }
    });

    return(
        <mesh position={[0,0,0]} ref={meshHtmlRef}>
            <Html position={[-1200,-100,-140]} >
                <div /*id='menu'*/ style={HtmlDreiMenuStyles.menu}>
                    <p onClick={()=> {setPath("MainMenu"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Main Menu" />
                    <p onClick={()=> {setPath("Education"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Education" />
                    <p onClick={()=> {setPath("Skills"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Skills" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects0"); setTransitionEnded(true); setParentMenuClicked(true)}}  children="Professional experience" />
                {(parentMenuClicked == true) &&
                <div>
                    <p onClick={()=> {setPath("ProfessionalExpProjects0"); }} children="Prospere ITB" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects1"); }} children="DRIM" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects2"); }} children="Everial" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects3"); }} children="Brésil eco-buggy" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects4"); }} children="EFN projet PPMS" />
                    <p onClick={()=> {setPath("ProfessionalExpProjects5"); }} children="EFN Professeur" />
                </div>
                }
                </div>
            </Html>
        </mesh>
    );
}
