/**
 * @param {Array<any> | Object | string} [progressBarPosition] - Screen position.
 * @param {Array<any> | Object | number} [progressBarSize] - Bar size.
 * @param {number} [progressBarCssPreset] - Visual preset from 0 to 5.
 * @param {number} [progress] - Progress value from 0 to 1.
 */
export function ProgressBar(props) {
    const { progressBarPosition = "bottom" } = props;
    const { progressBarSize = [260, 8] } = props;
    const { progressBarCssPreset = 0 } = props;
    const { progress = 0 } = props;

    // Convert numbers into CSS units.
    const toCssSize = (value) => {
        if (typeof value === "number") {
            return value + "px";
        }
        return value;
    };

    // Keep progress inside expected range.
    const safeProgress = Number.isFinite(progress) ? progress : 0;
    const currentProgress = Math.max(0, Math.min(safeProgress, 1));

    // Resolve position and size styles.
    let positionStyle = {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)"
    };
    let sizeStyle = {
        width: "260px",
        height: "8px"
    };

    if (Array.isArray(progressBarPosition)) {
        positionStyle = {
            position: "fixed",
            left: toCssSize(progressBarPosition[0] ?? 0),
            top: toCssSize(progressBarPosition[1] ?? 0)
        };
    } else if (progressBarPosition && typeof progressBarPosition === "object") {
        positionStyle = {
            position: "fixed",
            ...progressBarPosition
        };
    } else {
        switch (progressBarPosition) {
            case "top":
                positionStyle = {
                    position: "fixed",
                    left: "50%",
                    top: "28px",
                    transform: "translateX(-50%)"
                };
                break;
            case "left":
                positionStyle = {
                    position: "fixed",
                    left: "28px",
                    top: "50%",
                    transform: "translateY(-50%) rotate(-90deg)"
                };
                break;
            case "right":
                positionStyle = {
                    position: "fixed",
                    right: "28px",
                    top: "50%",
                    transform: "translateY(-50%) rotate(90deg)"
                };
                break;
            default:
                break;
        }
    }

    if (Array.isArray(progressBarSize)) {
        sizeStyle = {
            width: toCssSize(progressBarSize[0] ?? 260),
            height: toCssSize(progressBarSize[1] ?? 8)
        };
    } else if (typeof progressBarSize === "number") {
        sizeStyle = {
            width: toCssSize(progressBarSize),
            height: "8px"
        };
    } else if (progressBarSize && typeof progressBarSize === "object") {
        sizeStyle = {
            width: toCssSize(progressBarSize.width ?? 260),
            height: toCssSize(progressBarSize.height ?? 8)
        };
    }

    // Pick the visual preset.
    const presets = {
        0: {
            track: "rgba(255, 255, 255, 0.22)",
            fill: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.55)",
            shadow: "0 0 18px rgba(255, 255, 255, 0.22)"
        },
        1: {
            track: "rgba(10, 20, 32, 0.7)",
            fill: "#4fb3ff",
            border: "1px solid rgba(79, 179, 255, 0.6)",
            shadow: "0 0 16px rgba(79, 179, 255, 0.35)"
        },
        2: {
            track: "rgba(38, 13, 10, 0.75)",
            fill: "#ff6b35",
            border: "1px solid rgba(255, 107, 53, 0.65)",
            shadow: "0 0 16px rgba(255, 107, 53, 0.32)"
        },
        3: {
            track: "rgba(7, 28, 20, 0.75)",
            fill: "#51d88a",
            border: "1px solid rgba(81, 216, 138, 0.65)",
            shadow: "0 0 16px rgba(81, 216, 138, 0.3)"
        },
        4: {
            track: "rgba(20, 18, 28, 0.78)",
            fill: "#d8c35a",
            border: "1px solid rgba(216, 195, 90, 0.62)",
            shadow: "0 0 16px rgba(216, 195, 90, 0.28)"
        },
        5: {
            track: "rgba(255, 255, 255, 0.1)",
            fill: "#111111",
            border: "1px solid rgba(17, 17, 17, 0.7)",
            shadow: "0 0 0 rgba(0, 0, 0, 0)"
        }
    };
    const preset = presets[progressBarCssPreset] ?? presets[0];

    // Build the layered bar styles.
    const containerStyle = {
        ...positionStyle,
        ...sizeStyle,
        pointerEvents: "none",
        zIndex: 100000
    };
    const trackStyle = {
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: preset.track,
        border: preset.border,
        borderRadius: "4px",
        boxShadow: preset.shadow
    };
    const fillStyle = {
        width: (currentProgress * 100) + "%",
        height: "100%",
        backgroundColor: preset.fill,
        borderRadius: "3px",
        transition: "width 120ms linear"
    };

    return (
        <div style={containerStyle}>
            <div style={trackStyle}>
                <div style={fillStyle} />
            </div>
        </div>
    );
}
