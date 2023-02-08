import { useLoader, useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useCallback, Suspense } from "react";
import * as THREE from "three";
import { useEffect } from "react";
import { BufferAttribute, Color } from "three";



export function SimpleLoader(props) {
    const {modelName = "threeJsScene.glb"} = props;

    const gltf = useLoader(GLTFLoader, process.env.PUBLIC_URL + '/models/' + modelName)

    useEffect(() => {
        if(!gltf) return;

        let mesh = gltf.scene.children[0];
        console.log(gltf);

    }, [gltf]);

    let mixer
    if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach(clip => {
            const action = mixer.clipAction(clip)
            action.play();
        });
    }

    useFrame((state, delta) => {
        mixer?.update(delta)
    })

    return (
    <Suspense fallback={null}>
        <primitive object={gltf.scene} />
        {/* <meshStandardMaterial side={THREE.DoubleSide}></meshStandardMaterial> */}
    </Suspense>
    )
  }