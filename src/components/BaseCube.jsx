import {useState} from "react";
import {useSpring, a} from '@react-spring/three';

export function BaseCube(props) {
    // default prop values:
    const {position = [0, 0, 0]} = props;
    const {width = 1} = props;
    const {height = 1} = props;
    const {depth = 1} = props;
    const {movementVector = [0.4, 0, 0]} = props;
    const {rgbHover = [120, 120, 120]} = props; // RGB for mouse hover
    const {minMovementDelay = 150} = props;
    const {maxMovementDelay = 500} = props;
    const {animationDelay = Math.floor(Math.random() * (maxMovementDelay - minMovementDelay) + maxMovementDelay)} = props;
    const {hasMovementAnimation = true} = props;
    const {hasScaleAnimation = true} = props;
    const {opacity = 1} = props;

    const minColorValue = 200;//180 180 180 light grey
    const maxColorValue = 255;//255 255 255 white
    const randcolor = hasMovementAnimation ? Math.floor(Math.random() * (maxColorValue - minColorValue) + minColorValue) : 255;

    const [hovered, setHover] = useState(false);

    const springPosition = useSpring({
        loop: {reverse: true},
        from: {position: position},
        to: {position: [position[0] + movementVector[0], position[1] + movementVector[1], position[2] + movementVector[2]]},
        cancel: false,
        config: {
            duration: animationDelay
        }
    })

    const springColor = useSpring({
        color: hovered ? "rgb(" + rgbHover[0] + "," + rgbHover[1] + "," + rgbHover[2] + ")" : "rgb(" + randcolor + "," + randcolor + "," + randcolor + ")"
    });

    const springScale = useSpring({
        scale: hovered ? 1.2 : 1
    });

    return(
    <a.mesh
    onPointerOver={() => setHover(true)}
    onPointerOut={() => setHover(false)}
    position = {hasMovementAnimation ? springPosition.position : position}
    scale = {hasScaleAnimation ? springScale.scale : 1}
    >
        {props.children}
        <boxGeometry  args={[width, height, depth]}/>
        <a.meshStandardMaterial attach="material" color={springColor.color} opacity={opacity}/>;    
    </a.mesh>
    );
}
