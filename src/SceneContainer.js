import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Camera } from "./components/Camera";
import { CoordinateFindDebug } from "./components/CoordinateFindDebug";

export function SceneContainer() {
    
    return(
        <>
            <ambientLight/>
            <CoordinateFindDebug></CoordinateFindDebug>
            <Camera/>
            <Suspense fallback = {null}>
                <Environment background = {"only"} files = {process.env.PUBLIC_URL + "/textures/bg.hdr"} />
                <Environment background = {false} files = {process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
            </Suspense>
        </>
    );
}