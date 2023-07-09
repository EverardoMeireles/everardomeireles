import { Canvas } from "@react-three/fiber";
import { SceneContainer } from "./SceneContainer";
import { HudMenu } from "./components/HudMenu";

function App() {
  return (
    <>
      <HudMenu/>
      <Canvas>
        <SceneContainer/>
      </Canvas>
    </>
  );
}

export default App;
