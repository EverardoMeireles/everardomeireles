import {useState} from "react";
import {useSpring, a} from '@react-spring/three';

/**
 * @param {Array<any>} [position] - Position in the scene.
 * @param {number} [width] - Width.
 * @param {number} [height] - Height.
 * @param {number} [depth] - Depth.
 * @param {Array<any>} [movementVector] - Movement vector.
 * @param {Array<any>} [rgbHover] - RGB for mouse hover.
 * @param {number} [minMovementDelay] - Timing value for min movement delay.
 * @param {number} [maxMovementDelay] - Timing value for max movement delay.
 * @param {number} [animationDelay] - Timing value for animation delay.
 * @param {boolean} [hasMovementAnimation] - Whether to movement animation.
 * @param {boolean} [hasScaleAnimation] - Whether to scale animation.
 * @param {number} [opacity] - Opacity.
 * @param {boolean} [visible] - Whether this element is visible.
 */
export function BaseCube(props) {
    const {position = [0, 0, 0]} = props;
    const {width = 1} = props;
    const {height = 1} = props;
    const {depth = 1} = props;
    const {movementVector = [0.4, 0, 0]} = props;
    const {rgbHover = [120, 120, 120]} = props;
    const {minMovementDelay = 150} = props;
    const {maxMovementDelay = 500} = props;
    const {animationDelay = Math.floor(Math.random() * (maxMovementDelay - minMovementDelay) + maxMovementDelay)} = props;
    const {hasMovementAnimation = true} = props;
    const {hasScaleAnimation = true} = props;
    const {opacity = 1} = props;
    const {visible = true} = props;

    const minColorValue = 200; // 200 200 200 light grey
    const maxColorValue = 255; // 255 255 255 white
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
        <a.meshStandardMaterial visible={visible} attach="material" color={springColor.color} opacity={opacity}/>;    
    </a.mesh>
    );
}
