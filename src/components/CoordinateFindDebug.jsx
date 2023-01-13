import { useRef } from "react";

export function CoordinateFindDebug(){
    const pivotCube = useRef();

    return(
        <>  
            <mesh
                position = {[0, 0, -3]}
                ref = {pivotCube}
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[0, 8, 8]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.x -= 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[4, 8, 8]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.x += 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 12, 8]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.y += 1;
                    console.log(pivotCube.current.position);
                }}                
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 4, 8]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.y -= 1;
                    console.log(pivotCube.current.position);
                }}            
                >
                <boxGeometry/>
                <meshStandardMaterial attach = "material" color = {0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 4]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.z -= 1;
                    console.log(pivotCube.current.position);
                }}              
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>

            <mesh
                position = {[2, 8, 12]}
                onClick = {(e) => {
                    e.stopPropagation();
                    pivotCube.current.position.z += 1;
                    console.log(pivotCube.current.position);
                }}           
                >
                <boxGeometry/>
                <meshStandardMaterial attach="material" color={0x00ff00}/>
            </mesh>
        </>
    )
}