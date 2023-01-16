import { BaseCube } from "./BaseCube";

export function EmptyMovingSlab(props) {
    const {position = [0,0,0]} = props;

    return(
    <mesh position={position}>
        <BaseCube position = {[0,0,0]} />
        <BaseCube position = {[0,1,0]} />
        <BaseCube position = {[0,2,0]} />
        <BaseCube position = {[0,3,0]} />
        <BaseCube position = {[0,4,0]} />
        <BaseCube position = {[0,5,0]} />
        <BaseCube position = {[0,6,0]} />
        <BaseCube position = {[0,1,1]} />
        <BaseCube position = {[0,2,1]} />
        <BaseCube position = {[0,3,1]} />
        <BaseCube position = {[0,4,1]} />
        <BaseCube position = {[0,5,1]} />
        <BaseCube position = {[0,6,1]} />
        <BaseCube position = {[0,1,2]} />
        <BaseCube position = {[0,2,2]} />
        <BaseCube position = {[0,3,2]} />
        <BaseCube position = {[0,4,2]} />
        <BaseCube position = {[0,5,2]} />
        <BaseCube position = {[0,6,2]} />
        <BaseCube position = {[0,1,3]} />
        <BaseCube position = {[0,2,3]} />
        <BaseCube position = {[0,3,3]} />
        <BaseCube position = {[0,4,3]} />
        <BaseCube position = {[0,5,3]} />
        <BaseCube position = {[0,6,3]} />
        <BaseCube position = {[0,1,4]} />
        <BaseCube position = {[0,2,4]} />
        <BaseCube position = {[0,3,4]} />
        <BaseCube position = {[0,4,4]} />
        <BaseCube position = {[0,5,4]} />
        <BaseCube position = {[0,6,4]} />
    </mesh>
    );
}