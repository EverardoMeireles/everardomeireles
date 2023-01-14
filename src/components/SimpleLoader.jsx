import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useCallback, Suspense } from "react";
import * as THREE from "three";
import { useEffect } from "react";
import { BufferAttribute, Color } from "three";



export function SimpleLoader(props) {
    const {modelName = "rooms.glb"} = props;

    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + './models/' + modelName)

    useEffect(() => {
        if(!gltf) return;

        let mesh = gltf.scene.children[0];
        console.log(gltf);
        mesh.material.color = new Color(0.04,0.06,0.1);

    }, [gltf]);

    return (
    <Suspense fallback={null}>
        <primitive object={gltf.scene} />
        <meshStandardMaterial side={THREE.DoubleSide}></meshStandardMaterial>
    </Suspense>
    )
  }