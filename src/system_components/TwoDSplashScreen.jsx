import { useEffect, useRef, useState } from "react";
import SystemStore from "../SystemStore.js";
import { setNamedTrigger } from "../Helper";

/**
 * @param {number} [duration] - Duration in milliseconds.
 * @param {string} [animation] - Animation.
 * @param {string} [interpolationAlgorithm] - Interpolation algorithm.
 * @param {number} [animationDuration] - Timing value for animation duration.
 * @param {string} [effect] - Effect.
 * @param {string} [color] - Color value used by this component.
 * @param {number} [scale] - Scale value.
 * @param {string} [backgroundColor] - Color value for background color.
 * @param {number} [backgroundFadeOutDuration] - Timing value for background fade out duration.
 * @param {*} image - Image file name or path.
 * @param {Array<any>} [slideOnEndPosition] - Position value for slide on end position.
 * @param {number} [slideDuration] - Timing value for slide duration.
 * @param {number} [slideSizeAfterEnd] - Slide size after end.
 * @param {string} [slideInterpolationAlgorithm] - Slide interpolation algorithm.
 * @param {string} [triggerOutSlideEnded] - Trigger key set when this behavior finishes.
 */
export function TwoDSplashScreen(props) {
    const {duration = 1000} = props;
    const {animation = "3D_x_rotate_back"} = props;
    const {interpolationAlgorithm = "ease-out"} = props;
    const {animationDuration = 1000} = props;
    const {effect = "explosive_blur"} = props;
    const {color = "#1226dd"} = props;
    const {scale = 1} = props;
    const {backgroundColor = "#000"} = props;
    const {backgroundFadeOutDuration = 2500} = props;
    const {image} = props;
    const {slideOnEndPosition = [100, 100]} = props;
    const {slideDuration = 1000} = props;
    const {slideSizeAfterEnd = 0.5} = props;
    const {slideInterpolationAlgorithm = "ease"} = props;
    const {triggerOutSlideEnded = "trigger999"} = props;

    /////////////////////
    // State and Store //
    /////////////////////
    const [isVisible, setIsVisible] = useState(true);
    const [isImageVisible, setIsImageVisible] = useState(true);
    const [isFading, setIsFading] = useState(false);
    const [isSlidingOut, setIsSlidingOut] = useState(false);
    const [isEffectActive, setIsEffectActive] = useState(false);
    const [slideScaleProgress, setSlideScaleProgress] = useState(0);
    const slideScaleAnimationFrameRef = useRef(null);
    const setTrigger = SystemStore((state) => state.setTrigger);

    ///////////////////////
    // Normalized Inputs //
    ///////////////////////
    const slideDurationMs = Number.isFinite(slideDuration) && slideDuration > 0 ? slideDuration : 700;
    const animationLeadDurationMs = Number.isFinite(animationDuration) && animationDuration > 0 ? animationDuration : 0;
    const backgroundFadeDurationMs = Number.isFinite(backgroundFadeOutDuration) && backgroundFadeOutDuration > 0 ? backgroundFadeOutDuration : 520;

    ////////////////////////
    // Effect State Flags //
    ////////////////////////
    const isSoudWaveEffect = effect === "wave_sound";
    const isElasticBlurEffect = effect === "elastic_blur";
    const isExplosiveBlurEffect = effect === "explosive_blur";
    const isLateralGlowEffect = effect === "lateral_glow";

    const effectDurationMs = isElasticBlurEffect
        ? 800
        : isExplosiveBlurEffect
        ? 700
        : isLateralGlowEffect
        ? 1000
        : isSoudWaveEffect
        ? 600
        : 700;

    //////////////////////////
    // Slide Derived Values //
    //////////////////////////
    const slideOutEnabled = hasSlideTargetPosition(slideOnEndPosition);
    const slideTargetPosition = resolveSlideTargetPosition(slideOnEndPosition);
    const slideTargetScale = resolveSlideTargetScale(slideSizeAfterEnd, scale);

    // Reset trigger to false so listeners can react to the next true edge.
    useEffect(() => {
        setNamedTrigger(setTrigger, triggerOutSlideEnded, false);
    }, [setTrigger, triggerOutSlideEnded]);

    // Restart slide scale interpolation when image or scale inputs change.
    useEffect(() => {
        setSlideScaleProgress(0);
    }, [image, slideSizeAfterEnd, scale]);

    // Main visibility lifecycle: orchestrates fade, slide, trigger, and final unmount.
    useEffect(() => {
        if (!Number.isFinite(duration) || duration <= 0) {
            return undefined;
        }

        setIsVisible(true);
        setIsImageVisible(true);
        setIsFading(false);
        setIsSlidingOut(false);
        setSlideScaleProgress(0);

        const fadeDuration = backgroundFadeDurationMs;
        const durationStartDelay = animationLeadDurationMs;
        let fadeStartTimeMs = 0;
        let fadeTimer;
        let hideTimer;
        let slideStartTimer;
        let slideStartFrame;
        let slideEndTimer;
        let slideHideTimer;
        let fullHideTimer;

        if (slideOutEnabled) {
            slideStartTimer = setTimeout(() => {
                fadeStartTimeMs = performance.now();
                setIsFading(true);
                setSlideScaleProgress(0);
                slideStartFrame = requestAnimationFrame(() => {
                    setIsSlidingOut(true);
                    slideEndTimer = setTimeout(() => {
                        setNamedTrigger(setTrigger, triggerOutSlideEnded, true);

                        const elapsedFadeMs = performance.now() - fadeStartTimeMs;
                        const remainingFadeMs = Math.max(fadeDuration - elapsedFadeMs, 0);

                        // Wait 0.1s so trigger fires first when slide movement ends.
                        slideHideTimer = setTimeout(() => {
                            setIsImageVisible(false);
                        }, 100);

                        fullHideTimer = setTimeout(
                            () => setIsVisible(false),
                            Math.max(remainingFadeMs, 100)
                        );
                    }, slideDurationMs);
                });
            }, durationStartDelay + duration);
        } else {
            const fadeDelay = Math.max(duration - fadeDuration, 0);
            fadeTimer = setTimeout(() => setIsFading(true), durationStartDelay + fadeDelay);
            hideTimer = setTimeout(() => setIsVisible(false), durationStartDelay + duration);
        }

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
            clearTimeout(slideStartTimer);
            if (slideStartFrame !== undefined) {
                cancelAnimationFrame(slideStartFrame);
            }
            clearTimeout(slideEndTimer);
            clearTimeout(slideHideTimer);
            clearTimeout(fullHideTimer);
        };
    }, [
        duration,
        setTrigger,
        slideOutEnabled,
        slideDurationMs,
        animationLeadDurationMs,
        backgroundFadeDurationMs,
        triggerOutSlideEnded,
    ]);

    // Per-frame scale interpolation during slide-out.
    useEffect(() => {
        if (!isSlidingOut || !slideOutEnabled) return undefined;

        const startTime = performance.now();
        const tick = (currentTime) => {
            const elapsed = currentTime - startTime;
            const rawProgress = slideDurationMs > 0 ? elapsed / slideDurationMs : 1;
            const easedProgress = resolveInterpolationProgress(slideInterpolationAlgorithm, rawProgress);

            setSlideScaleProgress(easedProgress);

            if (rawProgress < 1) {
                slideScaleAnimationFrameRef.current = requestAnimationFrame(tick);
            } else {
                setSlideScaleProgress(1);
                slideScaleAnimationFrameRef.current = null;
            }
        };

        slideScaleAnimationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (slideScaleAnimationFrameRef.current !== null) {
                cancelAnimationFrame(slideScaleAnimationFrameRef.current);
                slideScaleAnimationFrameRef.current = null;
            }
        };
    }, [
        isSlidingOut,
        slideDurationMs,
        slideInterpolationAlgorithm,
        slideOutEnabled,
    ]);

    // Activates optional image effects after the configured animation lead-in.
    useEffect(() => {
        if (!effect) return undefined;

        const resolvedAnimationDuration = Number.isFinite(animationDuration) ? animationDuration : duration;
        const effectDelay = Math.max(Math.min(resolvedAnimationDuration, duration), 0);

        const startTimer = setTimeout(() => setIsEffectActive(true), effectDelay);
        const endTimer = setTimeout(
            () => setIsEffectActive(false),
            effectDelay + effectDurationMs + 200
        );

        return () => {
            clearTimeout(startTimer);
            clearTimeout(endTimer);
        };
    }, [effect, animationDuration, duration, effectDurationMs]);

    const resolvedImage = !image
        ? ""
        : image.startsWith("/")
        ? image
        : `${process.env.PUBLIC_URL}/textures/${image}`;

    ////////////////////////
    // Render Derivations //
    ////////////////////////
    const isRotateBack = animation === "3D_x_rotate_back";

    const animationName = ANIMATION_NAME_MAP[animation] ?? "zoom_out_spin_right";
    const timingFunction = resolveTimingFunction(interpolationAlgorithm, "ease-out");
    const slideTimingFunction = resolveTimingFunction(slideInterpolationAlgorithm, "lerp");
    const currentSlideScale = !slideOutEnabled || !isSlidingOut
        ? scale
        : scale + (slideTargetScale - scale) * slideScaleProgress;

    const elasticBlurActive = isElasticBlurEffect && isEffectActive;
    const explosiveBlurActive = isExplosiveBlurEffect && isEffectActive;
    const blurEffectActive = elasticBlurActive || explosiveBlurActive;
    const lateralGlowActive = isLateralGlowEffect && isEffectActive;

    // Fully removed from tree after exit sequence completes.
    if (!isVisible) return null;

    //////////////
    /// Render ///
    //////////////
    return (
        <div
            className="splash-screen-2d"
            style={{
                "--splash-duration": `${duration}ms`,
                "--splash-animation-duration": `${Number.isFinite(animationDuration) ? animationDuration : duration}ms`,
                "--splash-animation-name": animationName,
                "--splash-animation-timing": timingFunction,
                "--splash-effect-duration": `${effectDurationMs}ms`,
                "--splash-effect-color": color,
            }}
        >
            <style>{SPLASH_SCREEN_STYLES}</style>
            <div
                className="splash-screen-2d__background"
                style={{
                    backgroundColor,
                    opacity: isFading ? 0 : 1,
                    transition: `opacity ${backgroundFadeDurationMs}ms ease`,
                }}
            />
            {resolvedImage && isImageVisible && (
                <div
                    className="splash-screen-2d__image-wrap"
                    style={{
                        left: isSlidingOut ? slideTargetPosition.left : "50%",
                        top: isSlidingOut ? slideTargetPosition.top : "50%",
                        transform: `translate(-50%, -50%) scale(${currentSlideScale})`,
                        opacity: !slideOutEnabled && isFading ? 0 : 1,
                        transition: slideOutEnabled
                            ? `left ${slideDurationMs}ms ${slideTimingFunction}, top ${slideDurationMs}ms ${slideTimingFunction}, opacity 400ms ease`
                            : "opacity 400ms ease",
                    }}
                >
                    <div
                        className={`splash-screen-2d__image-anim${lateralGlowActive ? " splash-screen-2d__image-anim--sheen" : ""}${isRotateBack ? " splash-screen-2d__image-anim--back" : ""}`}
                    >
                        <img
                            className="splash-screen-2d__image"
                            src={resolvedImage}
                            alt=""
                        />
                        {blurEffectActive && (
                            <>
                                <img
                                    className={`splash-screen-2d__image ${elasticBlurActive ? "splash-screen-2d__image--elastic-edge" : "splash-screen-2d__image--explosive-edge"}`}
                                    src={resolvedImage}
                                    alt=""
                                    aria-hidden="true"
                                />
                                {elasticBlurActive && (
                                    <span className="splash-screen-2d__elastic-distort" />
                                )}
                                {explosiveBlurActive && (
                                    <span className="splash-screen-2d__explosive-distort" />
                                )}
                            </>
                        )}
                        {isSoudWaveEffect && isEffectActive && (
                            <>
                                <span
                                    className="splash-screen-2d__effect splash-screen-2d__effect--sound"
                                    style={{ "--effect-delay": "0ms" }}
                                />
                                <span
                                    className="splash-screen-2d__effect splash-screen-2d__effect--sound"
                                    style={{ "--effect-delay": "140ms" }}
                                />
                                <span
                                    className="splash-screen-2d__effect splash-screen-2d__effect--sound"
                                    style={{ "--effect-delay": "280ms" }}
                                />
                            </>
                        )}
                        {lateralGlowActive && (
                            <span className="splash-screen-2d__image-sheen" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

TwoDSplashScreen.displayName = "TwoDSplashScreen";

//////////////
/// Styles ///
//////////////
// Kept in this file intentionally; injected into the component via <style>.
const SPLASH_SCREEN_STYLES = `
                .splash-screen-2d {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    overflow: hidden;
                }

                .splash-screen-2d__background {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                }

                .splash-screen-2d__image-wrap {
                    transform-origin: center center;
                    display: inline-block;
                    position: fixed;
                    left: 50%;
                    top: 50%;
                    overflow: visible;
                    z-index: 1;
                    will-change: left, top, transform, opacity;
                }

                .splash-screen-2d__image-anim {
                    position: relative;
                    display: inline-block;
                    transform-origin: center center;
                    transform-style: preserve-3d;
                    backface-visibility: hidden;
                    animation-name: var(--splash-animation-name);
                    animation-duration: var(--splash-animation-duration);
                    animation-timing-function: var(--splash-animation-timing);
                    animation-fill-mode: forwards;
                }

                .splash-screen-2d__image-anim--sheen {
                    overflow: hidden;
                }

                .splash-screen-2d__image-anim--back {
                    backface-visibility: visible;
                }

                .splash-screen-2d__image {
                    max-width: 80vw;
                    max-height: 80vh;
                    width: auto;
                    height: auto;
                    display: block;
                    position: relative;
                    z-index: 2;
                }

                .splash-screen-2d__image-sheen {
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(
                            45deg,
                            color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 0%,
                            color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 35%,
                            color-mix(in srgb, var(--splash-effect-color) 55%, transparent) 50%,
                            color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 65%,
                            color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 100%
                        );
                    background-size: 220% 220%;
                    background-position: -120% -120%;
                    background-repeat: no-repeat;
                    opacity: 0;
                    mix-blend-mode: screen;
                    pointer-events: none;
                    filter: blur(3px);
                    animation: sheen-sweep var(--splash-effect-duration) ease-out forwards;
                    z-index: 3;
                }

                .splash-screen-2d__image--elastic-edge,
                .splash-screen-2d__image--explosive-edge {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    opacity: 0.6;
                    filter: blur(1.6px) saturate(1.35) brightness(1.15);
                    mix-blend-mode: screen;
                    -webkit-mask-image: radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 1) 75%);
                    mask-image: radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 1) 75%);
                    z-index: 1;
                }

                .splash-screen-2d__image--elastic-edge {
                    animation: elastic-edge-wobble var(--splash-effect-duration) ease-out forwards;
                }

                .splash-screen-2d__image--explosive-edge {
                    animation: explosive-edge-expand var(--splash-effect-duration) ease-out forwards;
                }

                .splash-screen-2d__effect {
                    position: absolute;
                    inset: -12%;
                    border-radius: 50%;
                    opacity: 0;
                    pointer-events: none;
                    animation: splash-wave var(--splash-effect-duration) ease-out forwards;
                    animation-delay: var(--effect-delay, 0ms);
                }

                .splash-screen-2d__effect--sound {
                    border: 3px solid color-mix(in srgb, var(--splash-effect-color) 85%, transparent);
                    box-shadow:
                        0 0 10px color-mix(in srgb, var(--splash-effect-color) 60%, transparent),
                        0 0 24px color-mix(in srgb, var(--splash-effect-color) 40%, transparent),
                        inset 0 0 12px color-mix(in srgb, var(--splash-effect-color) 40%, transparent);
                    filter: brightness(1.1);
                }

                .splash-screen-2d__elastic-distort {
                    position: absolute;
                    inset: -14%;
                    border-radius: 50%;
                    background: radial-gradient(circle,
                        color-mix(in srgb, var(--splash-effect-color) 55%, transparent) 0%,
                        color-mix(in srgb, var(--splash-effect-color) 22%, transparent) 38%,
                        color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 70%);
                    mix-blend-mode: screen;
                    opacity: 0.75;
                    pointer-events: none;
                    animation: elastic-distort var(--splash-effect-duration) ease-out forwards;
                    z-index: 0;
                }

                .splash-screen-2d__explosive-distort {
                    position: absolute;
                    inset: -14%;
                    border-radius: 50%;
                    background: radial-gradient(circle,
                        color-mix(in srgb, var(--splash-effect-color) 55%, transparent) 0%,
                        color-mix(in srgb, var(--splash-effect-color) 22%, transparent) 38%,
                        color-mix(in srgb, var(--splash-effect-color) 0%, transparent) 70%);
                    mix-blend-mode: screen;
                    opacity: 0.75;
                    pointer-events: none;
                    animation: explosive-distort var(--splash-effect-duration) ease-out forwards;
                    z-index: 0;
                }

                @keyframes splash-wave {
                    0% {
                        transform: scale(0.7);
                        opacity: 0.9;
                    }
                    100% {
                        transform: scale(1.55);
                        opacity: 0;
                    }
                }

                .splash-screen-2d__effect--sound {
                    animation-name: splash-wave-sound;
                }

                @keyframes splash-wave-sound {
                    0% {
                        transform: scale(0.75);
                        opacity: 0.95;
                    }
                    60% {
                        transform: scale(1.35);
                        opacity: 0.35;
                    }
                    100% {
                        transform: scale(1.6);
                        opacity: 0;
                    }
                }

                @keyframes elastic-distort {
                    0% {
                        transform: scale(0.92);
                        opacity: 0.6;
                    }
                    55% {
                        transform: scale(1.42);
                        opacity: 0.85;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 0;
                    }
                }

                @keyframes explosive-distort {
                    0% {
                        transform: scale(0.9);
                        opacity: 0.7;
                    }
                    100% {
                        transform: scale(1.87);
                        opacity: 0;
                    }
                }

                @keyframes elastic-edge-wobble {
                    0% {
                        transform: translate(0px, 0px) scale(1);
                        opacity: 0.65;
                    }
                    40% {
                        transform: translate(2px, -1px) scale(1.02);
                    }
                    70% {
                        transform: translate(-2px, 1px) scale(0.99);
                        opacity: 0.45;
                    }
                    100% {
                        transform: translate(0px, 0px) scale(1);
                        opacity: 0;
                    }
                }

                @keyframes explosive-edge-expand {
                    0% {
                        transform: translate(0px, 0px) scale(1);
                        opacity: 0.6;
                    }
                    100% {
                        transform: translate(0px, 0px) scale(1.19);
                        opacity: 0;
                    }
                }

                @keyframes sheen-sweep {
                    0% {
                        opacity: 0;
                        background-position: 160% -60%;
                    }
                    25% {
                        opacity: 0.5;
                    }
                    70% {
                        opacity: 0.35;
                    }
                    100% {
                        opacity: 0;
                        background-position: -160% 160%;
                    }
                }

                @keyframes zoom_out_spin_right {
                    0% {
                        transform: scale(1.6) rotate(0deg);
                    }
                    100% {
                        transform: scale(1) rotate(360deg);
                    }
                }

                @keyframes zoom_out_spin_left {
                    0% {
                        transform: scale(1.6) rotate(0deg);
                    }
                    100% {
                        transform: scale(1) rotate(-360deg);
                    }
                }

                @keyframes simple_zoom_out {
                    0% {
                        transform: scale(1.6);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                @keyframes zoom_in_spin_right {
                    0% {
                        transform: scale(0.6) rotate(0deg);
                    }
                    100% {
                        transform: scale(1) rotate(360deg);
                    }
                }

                @keyframes zoom_in_spin_left {
                    0% {
                        transform: scale(0.6) rotate(0deg);
                    }
                    100% {
                        transform: scale(1) rotate(-360deg);
                    }
                }

                @keyframes simple_zoom_in {
                    0% {
                        transform: scale(0.6);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                @keyframes zoom_in_bounce {
                    0% {
                        transform: scale(0.6);
                    }
                    80% {
                        transform: scale(1.08);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                @keyframes zoom_out_bounce {
                    0% {
                        transform: scale(1.6);
                    }
                    80% {
                        transform: scale(0.92);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                @keyframes ps2_blur_fadein {
                    0% {
                        opacity: 0;
                        filter: blur(6px) saturate(0.9);
                        transform: scale(1.05);
                    }
                    70% {
                        opacity: 0.9;
                        filter: blur(1.2px) saturate(1.05);
                        transform: scale(1.01);
                    }
                    100% {
                        opacity: 1;
                        filter: blur(0px) saturate(1);
                        transform: scale(1);
                    }
                }

                @keyframes three_d_x_rotate_front {
                    0% {
                        transform: perspective(1200px) translateZ(-1200px) scale(0.2) rotateY(0deg);
                        opacity: 0;
                        filter: blur(6px);
                    }
                    30% {
                        opacity: 0.7;
                        filter: blur(3px);
                    }
                    100% {
                        transform: perspective(1200px) translateZ(0px) scale(1) rotateY(720deg);
                        opacity: 1;
                        filter: blur(0px);
                    }
                }

                @keyframes three_d_x_rotate_back {
                    0% {
                        transform: perspective(1200px) translateZ(900px) scale(1.8) rotateY(180deg);
                        opacity: 0.2;
                        filter: blur(4px);
                    }
                    50% {
                        transform: perspective(1200px) translateZ(300px) scale(1.2) rotateY(540deg);
                        opacity: 0.75;
                        filter: blur(2px);
                    }
                    100% {
                        transform: perspective(1200px) translateZ(0px) scale(1) rotateY(900deg);
                        opacity: 1;
                        filter: blur(0px);
                    }
                }
            
`;


////////////////
/// Helpers ///
///////////////

// Maps public animation values to CSS keyframe names.
const ANIMATION_NAME_MAP = {
    zoom_out_spin_right: "zoom_out_spin_right",
    zoom_out_spin_left: "zoom_out_spin_left",
    simple_zoom_out: "simple_zoom_out",
    zoom_in_spin_right: "zoom_in_spin_right",
    zoom_in_spin_left: "zoom_in_spin_left",
    simple_zoom_in: "simple_zoom_in",
    zoom_in_bounce: "zoom_in_bounce",
    zoom_out_bounce: "zoom_out_bounce",
    ps2_blur_fadein: "ps2_blur_fadein",
    "3D_x_rotate_front": "three_d_x_rotate_front",
    "3D_x_rotate_back": "three_d_x_rotate_back",
};

// Maps interpolation keywords to CSS timing functions.
const INTERPOLATION_TIMING_MAP = {
    lerp: "linear",
    smoothstep: "cubic-bezier(0.42, 0, 0.58, 1)",
    ease: "ease",
    "ease-in": "ease-in",
    "ease-out": "ease-out",
    "ease-in-out": "ease-in-out",
};

// True when the value is not undefined, null, or empty string.
const hasValue = (value) => value !== undefined && value !== null && value !== "";

// Resolve supported timing keyword with fallback.
const resolveTimingFunction = (algorithm, fallback = "ease-out") =>
    INTERPOLATION_TIMING_MAP[algorithm] ?? INTERPOLATION_TIMING_MAP[fallback] ?? "ease-out";

// Converts numeric values to px and preserves valid CSS strings.
const toCssPositionValue = (value, fallback = "50%") => {
    if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
    if (typeof value === "string" && value.trim() !== "") return value;
    return fallback;
};

// Supports [x, y] or object shape ({x,y}/{left,top}).
const resolveSlideTargetPosition = (slideOnEndPosition) => {
    if (Array.isArray(slideOnEndPosition)) {
        const [x, y] = slideOnEndPosition;
        return {
            left: toCssPositionValue(x),
            top: toCssPositionValue(y),
        };
    }

    if (slideOnEndPosition && typeof slideOnEndPosition === "object") {
        const x = slideOnEndPosition.left ?? slideOnEndPosition.x;
        const y = slideOnEndPosition.top ?? slideOnEndPosition.y;

        return {
            left: toCssPositionValue(x),
            top: toCssPositionValue(y),
        };
    }

    return { left: "50%", top: "50%" };
};

// Uses provided scale when valid; otherwise falls back to the current base scale.
const resolveSlideTargetScale = (slideSizeAfterEnd, fallbackScale) => {
    const parsed = Number(slideSizeAfterEnd);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackScale;
};

// Runtime interpolation used for slide scale animation.
const resolveInterpolationProgress = (algorithm, t) => {
    const clamped = Math.max(0, Math.min(1, t));
    switch (algorithm) {
        case "smoothstep":
            return clamped * clamped * (3 - 2 * clamped);
        case "ease":
        case "ease-in-out":
            return clamped < 0.5
                ? 2 * clamped * clamped
                : 1 - ((-2 * clamped + 2) ** 2) / 2;
        case "ease-in":
            return clamped * clamped;
        case "ease-out":
            return 1 - (1 - clamped) ** 2;
        case "lerp":
        default:
            return clamped;
    }
};

// Slide mode is enabled only when a target position is provided.
const hasSlideTargetPosition = (slideOnEndPosition) => {
    if (Array.isArray(slideOnEndPosition)) {
        const [x, y] = slideOnEndPosition;
        return hasValue(x) || hasValue(y);
    }

    if (slideOnEndPosition && typeof slideOnEndPosition === "object") {
        const x = slideOnEndPosition.left ?? slideOnEndPosition.x;
        const y = slideOnEndPosition.top ?? slideOnEndPosition.y;
        return hasValue(x) || hasValue(y);
    }

    return false;
};
