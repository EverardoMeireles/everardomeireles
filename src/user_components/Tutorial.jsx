import { useEffect, useRef, useState } from "react";
import config from "../config.js";
import { TutorialStyles, useViewportSize } from "../Styles.jsx";

/**
 * Introduces desktop controls or lets mobile visitors choose navigation.
 * SceneViewer handles control activation and fullscreen from the selection.
 */
export function Tutorial({ isTouchDevice = false, azertyMode = false, keyboardLayoutReady = true, controlsReady = true, onSelectControl, onDesktopStart, onClose }) {
    // Share viewport measurements with the existing responsive system.
    const { width, height } = useViewportSize();
    const orientation = width > height ? "landscape" : "portrait";
    const layout = isTouchDevice ? TutorialStyles[orientation] : {};
    const imagesPath = `${config.resource_path}/textures/Tutorial/`;
    const [isClosing, setIsClosing] = useState(false);
    const overlayRef = useRef(null);
    const closingRef = useRef(false);
    const fadeTimerRef = useRef(null);
    const onDesktopStartRef = useRef(onDesktopStart);
    const onCloseRef = useRef(onClose);
    onDesktopStartRef.current = onDesktopStart;
    onCloseRef.current = onClose;

    // Block the dismissing input from reaching scene navigation.
    useEffect(() => {
        const previouslyFocused = document.activeElement;
        overlayRef.current?.focus({ preventScroll: true });
        const handleDesktopInput = (event) => {
            if (event.type === "keydown" && (
                event.ctrlKey || event.altKey || event.metaKey
                || ["Escape", "Shift", "Control", "Alt", "Meta", "AltGraph", "ContextMenu"].includes(event.key)
                || /^F\d{1,2}$/.test(event.key)
            )) return;
            if ((event.type === "pointerdown" || event.type === "click") && event.button != null && event.button !== 0) return;
            event.stopImmediatePropagation();
            if (event.cancelable) event.preventDefault();
            if (closingRef.current) return;
            if (onDesktopStartRef.current?.() === false) return;
            closingRef.current = true;
            setIsClosing(true);
            fadeTimerRef.current = window.setTimeout(() => onCloseRef.current?.(), 300);
        };
        const inputEvents = ["keydown", "pointerdown", "click"];
        if (!isTouchDevice) {
            inputEvents.forEach((type) => window.addEventListener(type, handleDesktopInput, { capture: true, passive: false }));
        }
        return () => {
            inputEvents.forEach((type) => window.removeEventListener(type, handleDesktopInput, true));
            window.clearTimeout(fadeTimerRef.current);
            if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
        };
    }, [isTouchDevice]);

    // Keep fullscreen and permission requests inside the selection gesture.
    const selectControl = (mode) => {
        if (!controlsReady || closingRef.current) return;
        closingRef.current = true;
        onSelectControl?.(mode);
        setIsClosing(true);
        fadeTimerRef.current = window.setTimeout(() => onCloseRef.current?.(), 300);
    };

    // Keep tutorial interactions separate from gameplay input.
    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-tutorial-title"
            data-viewer-control="true"
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            style={{ ...TutorialStyles.overlay, ...layout.overlay, opacity: isClosing ? 0 : 1 }}
        >
            <section style={{ ...TutorialStyles.panel, ...layout.panel }}>
                <h1 id="viewer-tutorial-title" style={{ ...TutorialStyles.heading, ...layout.heading }}>
                    {isTouchDevice ? "Choose your controls." : "Controls"}
                </h1>
                {isTouchDevice ? (
                    <>
                        <div style={{ ...TutorialStyles.grid, ...layout.grid, ...TutorialStyles.mobileGrid }}>
                            <button
                                type="button"
                                className={!isClosing ? "tutorial-control-choice tutorial-control-choice-gyro" : undefined}
                                aria-labelledby="viewer-tutorial-gyro"
                                disabled={!controlsReady || isClosing}
                                onClick={() => selectControl("gyroscope")}
                                style={{ ...TutorialStyles.card, ...layout.card, ...TutorialStyles.controlChoice, cursor: controlsReady ? "pointer" : "wait" }}
                            >
                                <span role="heading" aria-level={2} id="viewer-tutorial-gyro" style={{ ...TutorialStyles.title, ...layout.title }}>
                                    Real movement control.
                                </span>
                                <span style={{ ...TutorialStyles.text, ...layout.text }}>Move your phone to look around</span>
                                <span style={{ ...TutorialStyles.images, ...layout.gyroImages }}>
                                    <img src={`${imagesPath}mobile-gyro-${orientation}-look.gif`} alt="Move your phone to look around" draggable={false} style={{ ...TutorialStyles.image, ...layout.gyroImage }} />
                                </span>
                            </button>
                            <button
                                type="button"
                                className={!isClosing ? "tutorial-control-choice tutorial-control-choice-joystick" : undefined}
                                aria-labelledby="viewer-tutorial-joystick"
                                disabled={!controlsReady || isClosing}
                                onClick={() => selectControl("dual_joystick")}
                                style={{ ...TutorialStyles.card, ...layout.card, ...TutorialStyles.controlChoice, cursor: controlsReady ? "pointer" : "wait" }}
                            >
                                <span role="heading" aria-level={2} id="viewer-tutorial-joystick" style={{ ...TutorialStyles.title, ...layout.title }}>
                                    Phone joystick control.
                                </span>
                                <span style={{ ...TutorialStyles.text, ...layout.text }}>Use your left thumb to move and your right thumb to look around.</span>
                                <span style={TutorialStyles.images}>
                                    <img src={`${imagesPath}mobile-dual-${orientation}-controls.gif`} alt="Move with the left thumb and look with the right thumb" draggable={false} style={{ ...TutorialStyles.image, ...layout.dualImage }} />
                                </span>
                            </button>
                            {!isClosing && (
                                <span
                                    className="tutorial-control-cue"
                                    data-testid="tutorial-control-cue"
                                    aria-hidden="true"
                                    style={TutorialStyles.controlCue}
                                >
                                    <span style={TutorialStyles.controlCueTrack}>
                                        <img
                                            src={`${config.resource_path}/textures/pointed_finger.png`}
                                            alt=""
                                            aria-hidden="true"
                                            draggable={false}
                                            style={{ ...TutorialStyles.controlFinger, ...layout.controlFinger }}
                                        />
                                    </span>
                                </span>
                            )}
                        </div>
                        {!controlsReady && <p role="status" style={TutorialStyles.hint}>Loading controls...</p>}
                    </>
                ) : (
                    <>
                        <div style={TutorialStyles.grid}>
                            <article style={TutorialStyles.card}>
                                <h2 style={TutorialStyles.title}>Hide objects</h2>
                                {keyboardLayoutReady && (
                                    <>
                                        <p style={TutorialStyles.text}>You can hide objects with the '{azertyMode ? "A" : "Q"}' key</p>
                                        <span style={TutorialStyles.images}>
                                            <img src={`${imagesPath}desktop-${azertyMode ? "zqsd" : "wasd"}-chair.gif`} alt="Hide objects with the keyboard" draggable={false} style={TutorialStyles.image} />
                                        </span>
                                    </>
                                )}
                            </article>
                            <article style={TutorialStyles.card}>
                                <h2 style={TutorialStyles.title}>Movement.</h2>
                                {keyboardLayoutReady && (
                                    <>
                                        <p style={TutorialStyles.text}>Use {azertyMode ? "ZQSD" : "WASD"} to move</p>
                                        <span style={TutorialStyles.images}>
                                            <img src={`${imagesPath}desktop-${azertyMode ? "zqsd" : "wasd"}-move.gif`} alt="Keyboard movement controls" draggable={false} style={TutorialStyles.image} />
                                        </span>
                                    </>
                                )}
                            </article>
                            <article style={TutorialStyles.card}>
                                <h2 style={TutorialStyles.title}>Look around</h2>
                                <p style={TutorialStyles.text}>Use the mouse to look around</p>
                                <span style={TutorialStyles.images}>
                                    <img src={`${imagesPath}desktop-look.gif`} alt="Mouse look controls" draggable={false} style={TutorialStyles.image} />
                                </span>
                            </article>
                        </div>
                        {!keyboardLayoutReady && <p role="status" style={TutorialStyles.hint}>Loading keyboard controls...</p>}
                        <p style={TutorialStyles.hint}>Press any key or click to begin.</p>
                    </>
                )}
            </section>
        </div>
    );
}
