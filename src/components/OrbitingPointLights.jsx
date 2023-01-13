import { useEffect, useRef} from "react";
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from "@react-three/postprocessing";

export function OrbitingPointLight(props) {
    const {orbitCenterPosition = [0, 0, 0]} = props
    const {orbitAxis = 'x'} = props
    const {orbitDistance = 4} = props
    const {orbitDirection = [0, 1, 0]} = props;
    const {orbitSpeed = 0.01} = props;
    const {lightIntensivity = 2} = props;
    const {bloomIntensivity = 10} = props;

    const orbitRef = useRef()
    const axis = axisVectorReplace(orbitAxis);

    function axisVectorReplace(axisSring){
        let axisVector;
        switch (axisSring) {
            case 'x':
                axisVector=[1 * orbitDistance, 0, 0];
            break;

            case 'y':
                axisVector=[0, 1 * orbitDistance, 0];
            break;

            case 'y':
                axisVector=[0, 0, 1 * orbitDistance];
            break;
        }
        return axisVector;
    }

    useEffect(() => {
        orbitRef.current.geometry.translate(axis[0], axis[1], axis[2])

    })

    useFrame(() => {
        orbitRef.current.rotation.x += orbitSpeed * orbitDirection[0]
        orbitRef.current.rotation.y += orbitSpeed * orbitDirection[1]
        orbitRef.current.rotation.z += orbitSpeed * orbitDirection[2]
    });

    return (
        <mesh
        position={orbitCenterPosition}
        ref={orbitRef}
        >
            <pointLight intensity={lightIntensivity} position={axis} />
            <boxGeometry />
            <meshStandardMaterial emissive="white" emissiveIntensity={bloomIntensivity} toneMapped={false} />
            <EffectComposer>
                <Bloom luminanceThreshold={1} mipmapBlur />
            </EffectComposer>
        </mesh>
    )
}