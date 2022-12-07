import { useLoader } from "@react-three/fiber";
import { useEffect } from "react";
import { BufferAttribute, Color } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export function Test_scene() {
    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + "models/test_scene.glb");

    useEffect(() => {
        if(!gltf) return;

        let mesh = gltf.scene.children[0];
        console.log(gltf);
        mesh.material.color = new Color(0.04,0.06,0.1);

    }, [gltf]);

    return(
        <primitive object={gltf.scene}/>
    );
}