import { useEffect, useMemo, useState } from "react";

export function TwoDSplashScreen({
    duration = 2000,
    animationDuration,
    // animation options: "zoom_out_spin_right", "zoom_out_spin_left", "simple_zoom_out",
    // "zoom_in_spin_right", "zoom_in_spin_left", "simple_zoom_in",
    // "zoom_in_bounce", "zoom_out_bounce", "ps2_blur_fadein",
    // "3D_x_rotate_front", "3D_x_rotate_back"
    animation = "3D_x_rotate_back",
    // interpolation options: "lerp", "smoothstep", "ease", "ease-in", "ease-out", "ease-in-out"
    interpolationAlgorithm = "ease-out",
    // effect options: "wave_sound", "elastic_blur", "explosive_blur", "lateral_glow"
    effect,
    color = "#ffffff",
    scale = 1,
    backgroundColor = "#000",
    image,
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [isFading, setIsFading] = useState(false);
    const [isEffectActive, setIsEffectActive] = useState(false);
    const isSoundEffect = effect === "wave_sound";
    const isElasticBlurEffect = effect === "elastic_blur";
    const isExplosiveBlurEffect = effect === "explosive_blur";
    const isLateralGlowEffect = effect === "lateral_glow";
    const effectDurationMs = isElasticBlurEffect
        ? 800
        : isExplosiveBlurEffect
        ? 700
        : isLateralGlowEffect
        ? 1000
        : isSoundEffect
        ? 600
        : 700;

    useEffect(() => {
        if (!Number.isFinite(duration) || duration <= 0) {
            return undefined;
        }

        const fadeDuration = 400;
        const fadeDelay = Math.max(duration - fadeDuration, 0);

        const fadeTimer = setTimeout(() => setIsFading(true), fadeDelay);
        const hideTimer = setTimeout(() => setIsVisible(false), duration);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
        };
    }, [duration]);

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

    const resolvedImage = useMemo(() => {
        if (!image) return "";
        if (image.startsWith("/")) return image;
        return `${process.env.PUBLIC_URL}/textures/${image}`;
    }, [image]);

    const isRotateBack = animation === "3D_x_rotate_back";

    const animationName = useMemo(() => {
        const map = {
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
        return map[animation] ?? "zoom_out_spin_right";
    }, [animation]);

    const effectName = useMemo(() => (isSoundEffect ? "sound" : ""), [isSoundEffect]);

    const timingFunction = useMemo(() => {
        const map = {
            lerp: "linear",
            smoothstep: "cubic-bezier(0.42, 0, 0.58, 1)",
            ease: "ease",
            "ease-in": "ease-in",
            "ease-out": "ease-out",
            "ease-in-out": "ease-in-out",
        };

        return map[interpolationAlgorithm] ?? "ease-out";
    }, [interpolationAlgorithm]);

    const elasticBlurActive = isElasticBlurEffect && isEffectActive;
    const explosiveBlurActive = isExplosiveBlurEffect && isEffectActive;
    const blurEffectActive = elasticBlurActive || explosiveBlurActive;
    const lateralGlowActive = isLateralGlowEffect && isEffectActive;

    if (!isVisible) return null;

    return (
        <div
            className="splash-screen-2d"
            style={{
                backgroundColor,
                "--splash-duration": `${duration}ms`,
                "--splash-animation-duration": `${Number.isFinite(animationDuration) ? animationDuration : duration}ms`,
                "--splash-animation-name": animationName,
                "--splash-animation-timing": timingFunction,
                "--splash-image-scale": scale,
                "--splash-effect-duration": `${effectDurationMs}ms`,
                "--splash-effect-color": color,
                opacity: isFading ? 0 : 1,
                transition: "opacity 400ms ease",
            }}
        >
            <style>{`
                .splash-screen-2d {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    overflow: hidden;
                }

                .splash-screen-2d__image-wrap {
                    transform: scale(var(--splash-image-scale));
                    transform-origin: center center;
                    display: inline-block;
                    position: relative;
                    overflow: visible;
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
            `}</style>
            {resolvedImage && (
                <div className="splash-screen-2d__image-wrap">
                    <div
                        className={`splash-screen-2d__image-anim${lateralGlowActive ? " splash-screen-2d__image-anim--sheen" : ""}${isRotateBack ? " splash-screen-2d__image-anim--back" : ""}`}
                    >
                        <img className="splash-screen-2d__image" src={resolvedImage} alt="" />
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
                        {isSoundEffect && isEffectActive && effectName && (
                            <>
                                <span
                                    className={`splash-screen-2d__effect splash-screen-2d__effect--${effectName}`}
                                    style={{ "--effect-delay": "0ms" }}
                                />
                                <span
                                    className={`splash-screen-2d__effect splash-screen-2d__effect--${effectName}`}
                                    style={{ "--effect-delay": "140ms" }}
                                />
                                <span
                                    className={`splash-screen-2d__effect splash-screen-2d__effect--${effectName}`}
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
