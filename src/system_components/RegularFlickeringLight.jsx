import { useFrame } from '@react-three/fiber';
import { useRef} from "react";

/**
 * Purpose: Renders a pointLight with sinusoidal intensity flicker.
 * Relationships: Standalone light helper that forwards extra props directly to pointLight.
 * Example:
 * <RegularFlickeringLight color="white" position={[0, 0, 0]} intensity={1} />
 * @param {Object} [lightProps] - Light props.
 */
export function RegularFlickeringLight(props) {
  // Example: { color: "white", position: [0, 0, 0], intensity: 1 }
  const {...lightProps} = props;

  const lightRef = useRef();

  useFrame((state) => {
    lightRef.current.intensity = 1 + Math.sin(state.clock.getElapsedTime() * 10) * 0.5;
  });

  return <pointLight ref = {lightRef} {...lightProps} />;
}
