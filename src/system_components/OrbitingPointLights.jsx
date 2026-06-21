import { useEffect, useRef } from "react";
import { useFrame } from '@react-three/fiber'

/**
 * Purpose: Moves a point light around a center point on a selected axis.
 * Relationships: Used by SceneContainer inside ObjectLink and other effect groups.
 * Example:
 * <OrbitingPointLight orbitCenterPosition={[0, 0, 0]} orbitAxis="x" orbitDistance={4} orbitDirection={[0, 1, 0]} orbitSpeed={0.01} lightIntensivity={2} bloomIntensivity={10} lightColor="white" />
 * @param {Array<any>} [orbitCenterPosition] - Position value for orbit center position.
 * @param {string} [orbitAxis] - Orbit axis.
 * @param {number} [orbitDistance] - Orbit distance.
 * @param {Array<any>} [orbitDirection] - Orbit direction.
 * @param {number} [orbitSpeed] - Speed value for orbit speed.
 * @param {number} [lightIntensivity] - Light intensivity.
 * @param {number} [bloomIntensivity] - Bloom intensivity.
 * @param {string} [lightColor] - Color value for light color.
 */
export function OrbitingPointLight(props) {
    // Example: [0, 0, 0]
    const {orbitCenterPosition = [0, 0, 0]} = props;

    // Example: "x"
    const {orbitAxis = 'x'} = props;
    const {orbitDistance = 4} = props;

    // Example: [0, 1, 0]
    const {orbitDirection = [0, 1, 0]} = props;
    const {orbitSpeed = 0.01} = props;
    const {lightIntensivity = 2} = props;
    const {bloomIntensivity = 10} = props;
    // Example: 0xb8774f
    const {lightColor = 'white'} = props;

    const orbitRef = useRef();
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

            case 'z':
                axisVector=[0, 0, 1 * orbitDistance];
            break;

            default:
                axisVector=[1 * orbitDistance, 0, 0];
        }
        return axisVector;
    }

    useEffect(() => {
        orbitRef.current.geometry.translate(axis[0], axis[1], axis[2]);

    })

    useFrame(() => {
        orbitRef.current.rotation.x += orbitSpeed * orbitDirection[0];
        orbitRef.current.rotation.y += orbitSpeed * orbitDirection[1];
        orbitRef.current.rotation.z += orbitSpeed * orbitDirection[2];
    });

    return (
        <mesh
        position={orbitCenterPosition}
        ref={orbitRef}
        >
            <pointLight color={lightColor} intensity={lightIntensivity} position={axis} />
        </mesh>
    )
}
