import { useFrame } from '@react-three/fiber';
import { useRef} from "react";

export function RegularFlickeringLight({ ...lightProps }) {
  const lightRef = useRef();

  useFrame((state) => {
    lightRef.current.intensity = 1 + Math.sin(state.clock.getElapsedTime() * 10) * 0.5;
  });

  return <pointLight ref = {lightRef} {...lightProps} />;
}
