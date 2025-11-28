import { Html } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { HtmlDreiMenuStyles } from "../Styles.jsx";

// has jsx styles
// Put inside default camera(tested in perspective camera)
export function HtmlDreiMenu(props) {
    const setDesiredPath = props.useStore((state) => state.setDesiredPath);
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
                    <p onClick={()=> {setDesiredPath("MainMenu"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Main Menu" />
                    <p onClick={()=> {setDesiredPath("Education"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Education" />
                    <p onClick={()=> {setDesiredPath("Skills"); setTransitionEnded(false); setParentMenuClicked(false)}}  children="Skills" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects0"); setTransitionEnded(true); setParentMenuClicked(true)}}  children="Professional experience" />
                {(parentMenuClicked === true) &&
                <div>
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects0"); }} children="Prospere ITB" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects1"); }} children="DRIM" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects2"); }} children="Everial" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects3"); }} children="Brésil eco-buggy" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects4"); }} children="EFN projet PPMS" />
                    <p onClick={()=> {setDesiredPath("ProfessionalExpProjects5"); }} children="EFN Professeur" />
                </div>
                }
                </div>
            </Html>
        </mesh>
    );
}
