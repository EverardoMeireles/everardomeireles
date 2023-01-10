import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneContainer } from "./SceneContainer";

test('renders', async () => {
   const rendererr = await (ReactThreeTestRenderer.create(<SceneContainer />));
   const sceneMesh = rendererr.scene.children;
});