import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Camera } from "./components/Camera";
import { CoordinateFindDebug } from "./components/CoordinateFindDebug";
import { OrbitingPointLight } from "./components/OrbitingPointLights"
import { SimpleLoader } from "./components/SimpleLoader";

export function SceneContainer() {
    
    return(
        <>
        <SimpleLoader /*modelName = {'rooms.glb'}*/></SimpleLoader>
            {/* <pointLight position={[2,4,7]}/> */}
            <CoordinateFindDebug></CoordinateFindDebug>
            <Camera/>
            <Suspense fallback = {null}>
                <Environment background = {"only"} files = {process.env.PUBLIC_URL + "/textures/bg.hdr"} />
                <Environment background = {false} files = {process.env.PUBLIC_URL + "/textures/envmap.hdr"} />
            </Suspense>
        </>
    );
}