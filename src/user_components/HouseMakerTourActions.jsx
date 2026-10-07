// ### Imports ###

import { Suspense, useId, useLayoutEffect, useRef, useState } from "react";
import { Center, Html, Text3D } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import helvetikerFont from "three/examples/fonts/helvetiker_regular.typeface.json";

// ### Constants ###

// Keep tooltip defaults readable on small viewports.
const TOOLTIP_MARGIN = 16;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_FALLBACK = 120;
const TEXT_HEIGHT_PER_POINT = 0.025;

// Allow presentation-focused HTML without executable elements.
const ALLOWED_HTML_TAGS = new Set([
    "a",
    "abbr",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "ul"
]);

// Remove dangerous elements together with their contents.
const DROPPED_HTML_TAGS = new Set([
    "applet",
    "audio",
    "base",
    "embed",
    "form",
    "frame",
    "frameset",
    "iframe",
    "link",
    "math",
    "meta",
    "noscript",
    "object",
    "script",
    "style",
    "svg",
    "template",
    "video"
]);

// Restrict attributes to content and accessibility metadata.
const ALLOWED_GLOBAL_ATTRIBUTES = new Set([
    "class",
    "id",
    "role",
    "title"
]);

// Scope defaults and authored rules inside the shadow root.
const BASE_TOOLTIP_STYLES = `
    :host {
        display: block;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .tooltip-body {
        box-sizing: border-box;
        width: 100%;
        max-height: var(--housemaker-tooltip-max-height, calc(100vh - 32px));
        overflow: auto;
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.82);
        color: #ffffff;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
        overflow-wrap: anywhere;
    }

    .tooltip-body > :first-child {
        margin-top: 0;
    }

    .tooltip-body > :last-child {
        margin-bottom: 0;
    }

    .tooltip-body img {
        display: block;
        max-width: 100%;
        height: auto;
    }

    .tooltip-body a {
        color: inherit;
    }
`;

// Block CSS capable of loading external resources.
const DANGEROUS_CSS_VALUE = /(?:url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|position\s*:\s*(?:fixed|sticky))/i;
const DANGEROUS_STYLESHEET = /(?:\\|@import|@font-face|@namespace|@property|url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|position\s*:\s*(?:fixed|sticky)|:host|!important)/i;

// Reuse simple DOM styles for every hotspot.
const HOTSPOT_STYLE = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "24px",
    height: "24px",
    padding: 0,
    transform: "translate(-50%, -50%)",
    border: 0,
    borderRadius: "50%",
    background: "transparent",
    cursor: "pointer",
    pointerEvents: "auto"
};

// ### Sanitization helpers ###

/**
 * Purpose: Creates sanitized tooltip DOM without HTML injection.
 * @param {string} htmlBody - Authored tooltip markup.
 * @param {string} manifestUrl - Companion JSON URL used for relative assets.
 * @param {Document} ownerDocument - Document receiving the sanitized nodes.
 * @returns {DocumentFragment} Safe tooltip content.
 */
export function sanitizeTooltipHtml(htmlBody, manifestUrl, ownerDocument = document) {
    // Parse markup in an inert document.
    const Parser = ownerDocument.defaultView?.DOMParser ?? window.DOMParser;
    const parsedDocument = new Parser().parseFromString(String(htmlBody ?? ""), "text/html");
    const output = ownerDocument.createDocumentFragment();
    const documentBaseUrl = ownerDocument.baseURI || window.location.href || "http://localhost/";

    // Resolve authored URLs against the companion manifest.
    const resolveSafeUrl = (value, allowedProtocols) => {
        try {
            const manifestBaseUrl = new URL(manifestUrl || documentBaseUrl, documentBaseUrl);
            const resolvedUrl = new URL(value, manifestBaseUrl);

            return allowedProtocols.has(resolvedUrl.protocol) ? resolvedUrl.href : undefined;
        } catch {
            return undefined;
        }
    };

    // Copy one parsed node through strict allowlists.
    const copySafeNode = (sourceNode) => {
        if (sourceNode.nodeType === 3) {
            return ownerDocument.createTextNode(sourceNode.textContent ?? "");
        }

        if (sourceNode.nodeType !== 1) return undefined;

        const tagName = sourceNode.tagName.toLowerCase();
        if (DROPPED_HTML_TAGS.has(tagName)) return undefined;

        // Preserve safe descendants of unknown formatting elements.
        if (!ALLOWED_HTML_TAGS.has(tagName)) {
            const fragment = ownerDocument.createDocumentFragment();
            sourceNode.childNodes.forEach((childNode) => {
                const safeChild = copySafeNode(childNode);
                if (safeChild) fragment.appendChild(safeChild);
            });
            return fragment;
        }

        const safeElement = ownerDocument.createElement(tagName);

        // Copy only tag-specific safe attributes.
        Array.from(sourceNode.attributes).forEach((attribute) => {
            const attributeName = attribute.name.toLowerCase();
            const attributeValue = attribute.value;

            if (attributeName.startsWith("on") || attributeName === "style") return;

            if (ALLOWED_GLOBAL_ATTRIBUTES.has(attributeName) || attributeName.startsWith("aria-")) {
                safeElement.setAttribute(attributeName, attributeValue);
                return;
            }

            if (tagName === "img" && attributeName === "src") {
                const safeSource = resolveSafeUrl(attributeValue, new Set(["http:", "https:"]));
                if (safeSource) safeElement.setAttribute("src", safeSource);
                return;
            }

            if (tagName === "img" && ["alt", "title"].includes(attributeName)) {
                safeElement.setAttribute(attributeName, attributeValue);
                return;
            }

            if (tagName === "img" && ["width", "height"].includes(attributeName)) {
                if (/^\d{1,4}$/.test(attributeValue)) {
                    safeElement.setAttribute(attributeName, attributeValue);
                }
                return;
            }

            if (tagName === "img" && attributeName === "loading") {
                if (["eager", "lazy"].includes(attributeValue.toLowerCase())) {
                    safeElement.setAttribute("loading", attributeValue.toLowerCase());
                }
                return;
            }

            if (tagName === "a" && attributeName === "href") {
                const safeLink = resolveSafeUrl(attributeValue, new Set(["http:", "https:", "mailto:", "tel:"]));
                if (safeLink) safeElement.setAttribute("href", safeLink);
                return;
            }

            if (tagName === "a" && attributeName === "target") {
                if (["_blank", "_self"].includes(attributeValue.toLowerCase())) {
                    safeElement.setAttribute("target", attributeValue.toLowerCase());
                }
            }
        });

        // Prevent opener access from new tabs.
        if (tagName === "a" && safeElement.getAttribute("target") === "_blank") {
            safeElement.setAttribute("rel", "noopener noreferrer");
        }

        sourceNode.childNodes.forEach((childNode) => {
            const safeChild = copySafeNode(childNode);
            if (safeChild) safeElement.appendChild(safeChild);
        });

        return safeElement;
    };

    // Sanitize every top-level body node.
    parsedDocument.body.childNodes.forEach((sourceNode) => {
        const safeNode = copySafeNode(sourceNode);
        if (safeNode) output.appendChild(safeNode);
    });

    return output;
}

/**
 * Purpose: Filters a tooltip wrapper declaration list.
 * @param {string} styleText - Authored CSS declarations.
 * @param {Document} ownerDocument - Document providing CSS parsing.
 * @returns {string} Safe normalized declarations.
 */
export function sanitizeTooltipDeclarations(styleText, ownerDocument = document) {
    // Let the browser parse individual declarations.
    const parsedStyle = ownerDocument.createElement("div").style;
    const safeStyle = ownerDocument.createElement("div").style;
    parsedStyle.cssText = String(styleText ?? "");

    Array.from(parsedStyle).forEach((propertyName) => {
        const propertyValue = parsedStyle.getPropertyValue(propertyName);
        if (DANGEROUS_CSS_VALUE.test(`${propertyName}:${propertyValue}`)) return;

        safeStyle.setProperty(
            propertyName,
            propertyValue,
            parsedStyle.getPropertyPriority(propertyName)
        );
    });

    return safeStyle.cssText;
}

/**
 * Purpose: Rejects unsafe authored shadow-root stylesheets.
 * @param {string} styleText - Authored scoped stylesheet.
 * @returns {string} Safe stylesheet or an empty string.
 */
export function sanitizeTooltipStylesheet(styleText) {
    const stylesheet = String(styleText ?? "");
    if (!stylesheet.includes("{") || DANGEROUS_STYLESHEET.test(stylesheet)) return "";

    return stylesheet;
}

// ### Placement helpers ###

/**
 * Purpose: Places a tooltip on a clamped viewport side.
 * @param {object} options - Tooltip and viewport dimensions.
 * @returns {object} Pixel placement, side, and size limits.
 */
export function getTooltipPlacement(options = {}) {
    const viewportWidth = Math.max(0, Number(options.viewportWidth) || 0);
    const viewportHeight = Math.max(0, Number(options.viewportHeight) || 0);
    const margin = Math.max(0, Number(options.margin) || 0);
    const usableMarginX = Math.min(margin, viewportWidth / 2);
    const usableMarginY = Math.min(margin, viewportHeight / 2);
    const maxWidth = Math.max(0, viewportWidth - (usableMarginX * 2));
    const maxHeight = Math.max(0, viewportHeight - (usableMarginY * 2));
    const tooltipWidth = Math.min(Math.max(0, Number(options.tooltipWidth) || 0), maxWidth);
    const tooltipHeight = Math.min(Math.max(0, Number(options.tooltipHeight) || 0), maxHeight);
    const anchorX = Number(options.anchorX) || 0;
    const anchorY = Number(options.anchorY) || 0;
    const requestedSide = options.tooltipPosition;

    // Resolve opposite placement from the projected hotspot half.
    const side = requestedSide === "left" || requestedSide === "right"
        ? requestedSide
        : anchorX < viewportWidth / 2 ? "right" : "left";
    const left = side === "left"
        ? usableMarginX
        : Math.max(usableMarginX, viewportWidth - usableMarginX - tooltipWidth);
    const maximumTop = Math.max(usableMarginY, viewportHeight - usableMarginY - tooltipHeight);
    const top = Math.min(
        maximumTop,
        Math.max(usableMarginY, anchorY - (tooltipHeight / 2))
    );

    return { left, top, side, maxWidth, maxHeight };
}

/**
 * Purpose: Calculates one ref-driven text fade sample.
 * @param {object} options - Fade timing and endpoints.
 * @returns {number} Clamped material opacity.
 */
export function getTextFadeOpacity(options = {}) {
    const elapsedSeconds = Number(options.elapsedSeconds) || 0;
    const startedAtSeconds = Number(options.startedAtSeconds) || 0;
    const delaySeconds = Math.max(0, Number(options.delayMs) || 0) / 1000;
    const durationSeconds = Math.max(0, Number(options.durationMs) || 0) / 1000;
    const fromOpacity = Number.isFinite(options.fromOpacity) ? options.fromOpacity : 0;
    const toOpacity = Number.isFinite(options.toOpacity) ? options.toOpacity : 1;
    const fadeElapsed = elapsedSeconds - startedAtSeconds - delaySeconds;
    const progress = durationSeconds === 0
        ? Number(fadeElapsed >= 0)
        : Math.min(1, Math.max(0, fadeElapsed / durationSeconds));

    return THREE.MathUtils.lerp(fromOpacity, toOpacity, progress);
}

/**
 * Purpose: Allows only explicitly matching tooltip wait input.
 * @param {Event|object} event - Native or React input event.
 * @param {string} activeWaitInput - Active wait action token.
 * @returns {boolean} Whether this event may reach the wait listener.
 */
export function tooltipEventMatchesWaitInput(event, activeWaitInput) {
    const input = String(activeWaitInput ?? "").toLowerCase();
    const nativeEvent = event?.nativeEvent ?? event;
    if (!input || input === "any" || !nativeEvent || nativeEvent.repeat) return false;
    const eventType = String(nativeEvent.type ?? "").toLowerCase();

    // Match authored mouse buttons exactly.
    const mouseButtons = {
        "mouse:left": 0,
        "mouse:middle": 1,
        "mouse:right": 2
    };

    if (Object.prototype.hasOwnProperty.call(mouseButtons, input)) {
        return eventType === "pointerdown"
            && (!nativeEvent.pointerType || nativeEvent.pointerType === "mouse")
            && Number(nativeEvent.button) === mouseButtons[input];
    }

    if (input.startsWith("key_code:")) {
        const expectedKeyCode = Number(input.slice("key_code:".length));
        return eventType === "keydown"
            && Number.isFinite(expectedKeyCode)
            && Number(nativeEvent.keyCode ?? nativeEvent.which) === expectedKeyCode;
    }

    if (!input.startsWith("key:") || eventType !== "keydown") return false;

    // Normalize named browser keys and printable characters.
    const keyNames = {
        space: " ",
        enter: "enter",
        escape: "escape",
        tab: "tab",
        up: "arrowup",
        down: "arrowdown",
        left: "arrowleft",
        right: "arrowright"
    };
    const expectedKey = input.slice("key:".length);
    const normalizedExpectedKey = keyNames[expectedKey] ?? expectedKey;
    const normalizedEventKey = String(nativeEvent.key ?? "").toLowerCase();

    return normalizedEventKey === normalizedExpectedKey;
}

// ### Text components ###

/**
 * Purpose: Renders one pre-oriented HouseMaker text action.
 * @param {object} props - Prepared action record and completion callback.
 */
function TourTextAction(props) {
    const { record, onFadeComplete } = props;
    const { action, position = [0, 0, 0], quaternion = [0, 0, 0, 1] } = record;
    const phase = record.phase === "outgoing" ? "outgoing" : "current";
    const materialRef = useRef();
    const fadeState = useRef({
        phase: undefined,
        startedAtSeconds: 0,
        fromOpacity: phase === "outgoing" ? 1 : 0,
        completed: false
    });
    const completionCallback = useRef(onFadeComplete);
    completionCallback.current = onFadeComplete;

    // Derive stable text geometry measurements.
    const sizePoints = Number.isFinite(action.sizePoints) ? action.sizePoints : 12;
    const textSize = Math.max(0.001, sizePoints * TEXT_HEIGHT_PER_POINT);
    const textHeight = Math.max(0.005, textSize * 0.08);
    const fadeDelayMs = phase === "current"
        ? Math.max(0, Number(action.fadeDelayMs) || 0)
        : 0;
    const fadeDurationMs = Math.max(0, Number(action.fadeDurationMs) || 0);
    const initialOpacity = phase === "outgoing" ? 1 : 0;

    // Set mount opacity without resetting it on phase changes.
    const captureMaterial = (material) => {
        if (!material) return;
        if (materialRef.current !== material) material.opacity = initialOpacity;
        materialRef.current = material;
    };

    // Update opacity without triggering React renders.
    useFrame((state) => {
        const material = materialRef.current;
        if (!material) return;

        if (fadeState.current.phase !== phase) {
            fadeState.current.phase = phase;
            fadeState.current.startedAtSeconds = state.clock.elapsedTime;
            fadeState.current.fromOpacity = Number.isFinite(material.opacity)
                ? material.opacity
                : initialOpacity;
            fadeState.current.completed = false;
        }

        const toOpacity = phase === "outgoing" ? 0 : 1;
        material.opacity = getTextFadeOpacity({
            elapsedSeconds: state.clock.elapsedTime,
            startedAtSeconds: fadeState.current.startedAtSeconds,
            delayMs: fadeDelayMs,
            durationMs: fadeDurationMs,
            fromOpacity: fadeState.current.fromOpacity,
            toOpacity
        });

        const fadeFinishedAt = fadeState.current.startedAtSeconds
            + (fadeDelayMs / 1000)
            + (fadeDurationMs / 1000);

        if (!fadeState.current.completed && state.clock.elapsedTime >= fadeFinishedAt) {
            fadeState.current.completed = true;
            completionCallback.current?.(record.key ?? action.id, phase);
        }
    });

    return (
        <group position={position} quaternion={quaternion}>
            <Center cacheKey={`${action.id ?? "text"}-${action.text ?? ""}`}>
                <Text3D
                    font={helvetikerFont}
                    size={textSize}
                    height={textHeight}
                    curveSegments={6}
                    bevelEnabled={false}
                >
                    {String(action.text ?? "")}
                    <meshBasicMaterial
                        ref={captureMaterial}
                        color={action.color ?? "#ffffff"}
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </Text3D>
            </Center>
        </group>
    );
}

/**
 * Purpose: Renders current and outgoing HouseMaker text records.
 * Relationships: Receives precomputed transforms from the tour controller.
 * Example: <TourTextActions records={[{action, position, quaternion, phase: "current"}]} />
 * @param {Array<object>} props.records - Prepared text action records.
 * @param {Function} props.onFadeComplete - Optional one-shot fade callback.
 */
export function TourTextActions(props) {
    const { records = [], onFadeComplete } = props;

    return (
        <Suspense fallback={null}>
            {records.map((record, index) => (
                record?.action ? (
                    <TourTextAction
                        key={record.key ?? record.action.id ?? `text-${index}`}
                        record={record}
                        onFadeComplete={onFadeComplete}
                    />
                ) : null
            ))}
        </Suspense>
    );
}

// ### Tooltip components ###

/**
 * Purpose: Renders accessible tooltip DOM and isolated authored content.
 * @param {object} props - Tooltip action, wait token, and shared refs.
 */
export function TourTooltipInteraction(props) {
    const { action, manifestUrl, activeWaitInput, tooltipHostRef, interactionRef } = props;
    const localTooltipHostRef = useRef();
    const localInteractionRef = useRef();
    const resolvedTooltipHostRef = tooltipHostRef ?? localTooltipHostRef;
    const resolvedInteractionRef = interactionRef ?? localInteractionRef;
    const tooltipId = useId();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [clickedOpen, setClickedOpen] = useState(false);
    const visible = hovered || focused || clickedOpen;

    // Build isolated sanitized content after mounting.
    useLayoutEffect(() => {
        const host = resolvedTooltipHostRef.current;
        if (!host) return undefined;

        const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
        const ownerDocument = host.ownerDocument;
        const stylesheet = ownerDocument.createElement("style");
        const tooltipBody = ownerDocument.createElement("div");
        const authoredStyle = String(action.style ?? "");
        const authoredStylesheet = authoredStyle.includes("{")
            ? sanitizeTooltipStylesheet(authoredStyle)
            : "";

        shadowRoot.replaceChildren();
        stylesheet.textContent = `${BASE_TOOLTIP_STYLES}\n${authoredStylesheet}`;
        tooltipBody.className = "tooltip-body";

        if (authoredStyle && !authoredStyle.includes("{")) {
            tooltipBody.style.cssText = sanitizeTooltipDeclarations(authoredStyle, ownerDocument);
        }

        tooltipBody.appendChild(sanitizeTooltipHtml(
            action.htmlBody ?? "<p>Tooltip</p>",
            manifestUrl,
            ownerDocument
        ));
        shadowRoot.append(stylesheet, tooltipBody);

        // Clear detached content during remounts and unmounts.
        return () => {
            if (host.shadowRoot === shadowRoot) shadowRoot.replaceChildren();
        };
    }, [action.htmlBody, action.style, manifestUrl, resolvedTooltipHostRef]);

    // Stop tooltip input unless the active wait explicitly matches.
    const guardTooltipEvent = (event) => {
        if (!tooltipEventMatchesWaitInput(event, activeWaitInput)) {
            event.stopPropagation();
        }
    };

    // Toggle persistent visibility for click and touch users.
    const handleHotspotClick = (event) => {
        guardTooltipEvent(event);
        setClickedOpen((isOpen) => !isOpen);
    };

    // Keep focus visibility while moving inside tooltip content.
    const handleBlur = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false);
        }
    };

    return (
        <div
            ref={resolvedInteractionRef}
            data-housemaker-tooltip-interaction="true"
            style={{ position: "relative", width: 0, height: 0 }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={handleBlur}
            onPointerDown={guardTooltipEvent}
            onMouseDown={guardTooltipEvent}
            onTouchStart={guardTooltipEvent}
            onContextMenu={guardTooltipEvent}
            onWheel={guardTooltipEvent}
            onKeyDown={guardTooltipEvent}
            onClick={guardTooltipEvent}
        >
            <button
                type="button"
                aria-label="Show tour tooltip"
                aria-expanded={visible}
                aria-describedby={visible ? tooltipId : undefined}
                data-housemaker-tooltip-hotspot="true"
                style={HOTSPOT_STYLE}
                onClick={handleHotspotClick}
            />
            <div
                ref={resolvedTooltipHostRef}
                id={tooltipId}
                role="tooltip"
                aria-hidden={!visible}
                data-housemaker-tooltip-content="true"
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: `${TOOLTIP_WIDTH}px`,
                    maxWidth: `calc(100vw - ${TOOLTIP_MARGIN * 2}px)`,
                    maxHeight: `calc(100vh - ${TOOLTIP_MARGIN * 2}px)`,
                    overflow: "auto",
                    boxSizing: "border-box",
                    visibility: visible ? "visible" : "hidden",
                    opacity: visible ? 1 : 0,
                    pointerEvents: visible ? "auto" : "none",
                    transition: "opacity 150ms ease-out",
                    zIndex: 1000
                }}
            />
        </div>
    );
}

/**
 * Purpose: Anchors one accessible tooltip inside the 3D scene.
 * @param {object} props - Tooltip action and runtime context.
 */
function TourTooltipAction(props) {
    const { action, manifestUrl, activeWaitInput, camera: cameraOverride } = props;
    const defaultCamera = useThree((state) => state.camera);
    const viewportSize = useThree((state) => state.size);
    const camera = cameraOverride ?? defaultCamera;
    const anchorGroupRef = useRef();
    const tooltipHostRef = useRef();
    const interactionRef = useRef();
    const temporaryValues = useRef();

    // Allocate projection vectors once per hotspot.
    if (!temporaryValues.current) {
        temporaryValues.current = {
            worldPosition: new THREE.Vector3(),
            cameraPosition: new THREE.Vector3(),
            cameraDirection: new THREE.Vector3(),
            directionToAnchor: new THREE.Vector3(),
            projectedPosition: new THREE.Vector3(),
            tooltipWidth: 0,
            tooltipHeight: 0,
            viewportWidth: -1,
            viewportHeight: -1,
            markerVisible: undefined
        };
    }

    // Cache content dimensions instead of forcing layout every frame.
    useLayoutEffect(() => {
        const tooltipHost = tooltipHostRef.current;
        if (!tooltipHost || typeof ResizeObserver === "undefined") return undefined;

        const observer = new ResizeObserver((entries) => {
            const bounds = entries[0]?.contentRect;
            if (!bounds) return;
            temporaryValues.current.tooltipWidth = bounds.width;
            temporaryValues.current.tooltipHeight = bounds.height;
        });
        observer.observe(tooltipHost);
        return () => observer.disconnect();
    }, [action.htmlBody, action.style]);

    // Project and place DOM without frame-rate React updates.
    useFrame(() => {
        const anchorGroup = anchorGroupRef.current;
        const tooltipHost = tooltipHostRef.current;
        const interaction = interactionRef.current;
        if (!anchorGroup || !tooltipHost || !interaction || !camera) return;

        const values = temporaryValues.current;
        anchorGroup.getWorldPosition(values.worldPosition);
        camera.getWorldPosition(values.cameraPosition);
        camera.getWorldDirection(values.cameraDirection);
        values.directionToAnchor.copy(values.worldPosition).sub(values.cameraPosition);
        values.projectedPosition.copy(values.worldPosition).project(camera);

        const inFront = values.cameraDirection.dot(values.directionToAnchor) > 0;
        const projected = values.projectedPosition;
        const insideClipSpace = projected.x >= -1 && projected.x <= 1
            && projected.y >= -1 && projected.y <= 1
            && projected.z >= -1 && projected.z <= 1;
        const markerVisible = inFront && insideClipSpace;
        if (values.markerVisible !== markerVisible) {
            interaction.style.visibility = markerVisible ? "visible" : "hidden";
            values.markerVisible = markerVisible;
        }

        const anchorX = (projected.x * 0.5 + 0.5) * viewportSize.width;
        const anchorY = (-projected.y * 0.5 + 0.5) * viewportSize.height;
        const availableWidth = Math.max(0, viewportSize.width - (TOOLTIP_MARGIN * 2));
        const availableHeight = Math.max(0, viewportSize.height - (TOOLTIP_MARGIN * 2));
        if (
            values.viewportWidth !== viewportSize.width
            || values.viewportHeight !== viewportSize.height
        ) {
            tooltipHost.style.width = `${Math.min(TOOLTIP_WIDTH, availableWidth)}px`;
            tooltipHost.style.maxHeight = `${availableHeight}px`;
            tooltipHost.style.setProperty(
                "--housemaker-tooltip-max-height",
                `${availableHeight}px`
            );
            values.viewportWidth = viewportSize.width;
            values.viewportHeight = viewportSize.height;
            values.tooltipWidth = 0;
            values.tooltipHeight = 0;
        }

        if (values.tooltipWidth <= 0 || values.tooltipHeight <= 0) {
            const tooltipBounds = tooltipHost.getBoundingClientRect();
            values.tooltipWidth = tooltipBounds.width
                || Math.min(TOOLTIP_WIDTH, availableWidth);
            values.tooltipHeight = tooltipBounds.height
                || Math.min(TOOLTIP_HEIGHT_FALLBACK, availableHeight);
        }
        const placement = getTooltipPlacement({
            anchorX,
            anchorY,
            tooltipWidth: values.tooltipWidth,
            tooltipHeight: values.tooltipHeight,
            viewportWidth: viewportSize.width,
            viewportHeight: viewportSize.height,
            tooltipPosition: action.tooltipPosition,
            margin: TOOLTIP_MARGIN
        });

        tooltipHost.style.left = `${placement.left - anchorX}px`;
        tooltipHost.style.top = `${placement.top - anchorY}px`;
        tooltipHost.dataset.side = placement.side;
    });

    return (
        <group ref={anchorGroupRef} position={action.position ?? action.anchorPoint ?? [0, 0, 0]}>
            {/* Keep the visible marker sized in model space. */}
            <mesh>
                <sphereGeometry args={[0.055, 16, 12]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.9}
                    toneMapped={false}
                />
            </mesh>
            <Html zIndexRange={[1000, 900]} pointerEvents="auto">
                <TourTooltipInteraction
                    action={action}
                    manifestUrl={manifestUrl}
                    activeWaitInput={activeWaitInput}
                    tooltipHostRef={tooltipHostRef}
                    interactionRef={interactionRef}
                />
            </Html>
        </group>
    );
}

/**
 * Purpose: Renders active HouseMaker floating-tooltip actions.
 * Relationships: Receives only the active step's tooltip actions.
 * Example: <TourTooltipActions actions={actions} manifestUrl="/models/scene.json" />
 * @param {Array<object>} props.actions - Active floating-tooltip actions.
 * @param {string} props.manifestUrl - Companion JSON URL.
 * @param {string} props.activeWaitInput - Current wait token, when present.
 * @param {THREE.Camera} props.camera - Optional camera override.
 */
export function TourTooltipActions(props) {
    const { actions = [], manifestUrl = "", activeWaitInput, camera } = props;

    return actions.map((action, index) => (
        action ? (
            <TourTooltipAction
                key={action.renderKey ?? `${action.id ?? "tooltip"}-${index}`}
                action={action}
                manifestUrl={manifestUrl}
                activeWaitInput={activeWaitInput}
                camera={camera}
            />
        ) : null
    ));
}
