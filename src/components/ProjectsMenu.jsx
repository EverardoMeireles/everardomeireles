import { BaseCube } from "./BaseCube";

export function ProjectsMenu(props) {
    const {setPath, setTransitionEnded} = props.useStore();

    return(
    <>
        <mesh onClick= {() => (setPath("MainMenu"), setTransitionEnded(false))}>
            <BaseCube position={[0,23,-21]} />
        </mesh>
        
        <BaseCube position={[0,24,-21]} />
        <BaseCube position={[0,25,-21]} />
        <BaseCube position={[0,26,-21]} />
        <BaseCube position={[0,27,-21]} />
        <BaseCube position={[0,28,-21]} />
        <BaseCube position={[0,29,-21]} />
        <BaseCube position={[0,23,-20]} />
        <BaseCube position={[0,24,-20]} />
        <BaseCube position={[0,25,-20]} />
        <BaseCube position={[0,26,-20]} />
        <BaseCube position={[0,27,-20]} />
        <BaseCube position={[0,28,-20]} />
        <BaseCube position={[0,29,-20]} />
        <BaseCube position={[0,23,-19]} />
        <BaseCube position={[0,24,-19]} />
        <BaseCube position={[0,25,-19]} />
        <BaseCube position={[0,26,-19]} />
        <BaseCube position={[0,27,-19]} />
        <BaseCube position={[0,28,-19]} />
        <BaseCube position={[0,29,-19]} />
        <BaseCube position={[0,23,-18]} />
        <BaseCube position={[0,24,-18]} />
        <BaseCube position={[0,25,-18]} />
        <BaseCube position={[0,26,-18]} />
        <BaseCube position={[0,27,-18]} />
        <BaseCube position={[0,28,-18]} />
        <BaseCube position={[0,29,-18]} />
        <BaseCube position={[0,23,-17]} />
        <BaseCube position={[0,24,-17]} />
        <BaseCube position={[0,25,-17]} />
        <BaseCube position={[0,26,-17]} />
        <BaseCube position={[0,27,-17]} />
        <BaseCube position={[0,28,-17]} />
        <BaseCube position={[0,29,-17]} />
        
    </>

    /* onClick={() => setActive(!active)} */
    );
}