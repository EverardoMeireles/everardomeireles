import {useState} from "react";
import {useSpring, a} from '@react-spring/three';

export function BaseCube(props) {
    // default prop values:
    const {movementVector = [0.1, 0, 0]} = props;
    const {rgbHover = [120, 120, 120]} = props; // RGB for mouse hover
    const {minMovementDelay = 150} = props;
    const {maxMovementDelay = 500} = props;
    const {animationDelay = Math.floor(Math.random() * (maxMovementDelay - minMovementDelay) + maxMovementDelay)} = props;

    var minColorValue = 200;//180 180 180 light grey
    var maxColorValue = 255;//255 255 255 white
    const [hovered, setHover] = useState(false);

    var randcolor = Math.floor(Math.random() * (maxColorValue - minColorValue) + minColorValue);
        const springPosition = useSpring({
            loop: {reverse: true},
            from: {position: props.position},
            to: {position: [props.position[0] + movementVector[0], props.position[1] + movementVector[1], props.position[2] + movementVector[2]]},
            cancel: false,
            config: {
                duration: animationDelay
            }
        })

        const springColor = useSpring({
            color: hovered ? "rgb(" + rgbHover[0] + "," + rgbHover[1] + "," + rgbHover[2] + ")" : "rgb(" + randcolor + "," + randcolor + "," + randcolor + ")"
        });
        
    return(
    <a.mesh
    onPointerOver={() => setHover(true)}
    onPointerOut={() => setHover(false)}
    position = {springPosition.position}
    >
        <boxGeometry />
        <a.meshStandardMaterial attach="material" color={springColor.color}/>;    
    </a.mesh>
    );
}
