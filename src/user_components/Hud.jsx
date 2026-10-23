import { useState } from "react";
import config from "../config.js";

/**
 * Purpose: Shows navigation and object-visibility controls above the viewer.
 * Relationships: SceneViewer mounts it above the Canvas controls.
 * Example: <Hud />
 */
export function Hud({
    isTouchDevice = false,
    isFullscreen = false,
    fullscreenPending = false,
    onExitFullscreen,
    onExitControls,
    onToggleObjects,
    objectsHidden = false,
    hideObjectsKey = "a"
}) {
    const [exitIconMissing, setExitIconMissing] = useState(false);
    const iconSize = isTouchDevice ? 33.6 : 57.6;
    const buttonStyle = {
        minWidth: "44px",
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: isTouchDevice ? "center" : "flex-start",
        gap: "8px",
        padding: "8px",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "8px",
        background: isTouchDevice ? "#f8fafc" : "rgba(15,23,42,0.85)",
        color: isTouchDevice ? "#24342f" : "#fff",
        cursor: "pointer",
        font: "inherit"
    };

    // Keep touch controls accessible without blocking the canvas.
    return (
        <div
            data-viewer-control="true"
            role="group"
            aria-label="Viewer controls"
            style={{
                display: "flex",
                flexDirection: isTouchDevice ? "row" : "column",
                alignItems: isTouchDevice ? "center" : "stretch",
                gap: "8px",
                pointerEvents: "auto",
                userSelect: "none",
                color: "#fff"
            }}
        >
            {!isTouchDevice && (
                <button
                    type="button"
                    aria-label="Exit"
                    title="Release mouse controls (Esc)"
                    onClick={onExitControls}
                    style={buttonStyle}
                >
                    {exitIconMissing ? (
                        <kbd style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: iconSize,
                            height: iconSize,
                            flexShrink: 0,
                            borderRadius: "6px",
                            background: "#f8fafc",
                            color: "#24342f"
                        }}>Esc</kbd>
                    ) : (
                        <img
                            src={`${config.resource_path}/textures/key_esc.png`}
                            alt="Escape key"
                            draggable={false}
                            onError={() => setExitIconMissing(true)}
                            style={{ width: iconSize, height: iconSize, flexShrink: 0, objectFit: "contain" }}
                        />
                    )}
                    <span style={{ flex: 1, textAlign: "center" }}>Exit</span>
                </button>
            )}
            {isTouchDevice && isFullscreen && (
                <button
                    type="button"
                    aria-label="Exit fullscreen"
                    title="Exit fullscreen"
                    disabled={fullscreenPending}
                    onClick={onExitFullscreen}
                    style={{
                        ...buttonStyle,
                        fontSize: "36px",
                        fontWeight: 900,
                        cursor: fullscreenPending ? "default" : "pointer",
                        opacity: fullscreenPending ? 0.5 : 1
                    }}
                >
                    <span aria-hidden="true">×</span>
                </button>
            )}
            <button
                type="button"
                aria-label={objectsHidden ? "Show objects" : "Hide objects"}
                aria-pressed={objectsHidden}
                title={isTouchDevice ? undefined : `${objectsHidden ? "Show objects" : "Hide objects"} (${hideObjectsKey.toUpperCase()})`}
                onClick={onToggleObjects}
                style={buttonStyle}
            >
                <img
                    src={`${config.resource_path}/textures/${isTouchDevice ? "chair-icon.svg" : "key_a.png"}`}
                    alt={isTouchDevice ? "Chair" : "Object visibility keyboard shortcut"}
                    draggable={false}
                    style={{ width: iconSize, height: iconSize, flexShrink: 0, objectFit: "contain" }}
                />
                {!isTouchDevice && (
                    <span>{objectsHidden ? "Show objects" : "Hide objects"}</span>
                )}
            </button>
        </div>
    );
}
