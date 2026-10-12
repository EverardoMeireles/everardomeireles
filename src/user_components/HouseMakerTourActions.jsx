// ### Imports ###

import { Suspense, useEffect, useId, useRef } from "react";
import { Center, Text3D } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import helvetikerFont from "three/examples/fonts/helvetiker_regular.typeface.json";
import SystemStore from "../SystemStore";

// ### Constants ###

const TEXT_HEIGHT_PER_POINT = 0.025;
const TOUR_CIRCLE_PREFIX = "housemaker-tour-circle:";
const POSITION_CHANGE_THRESHOLD = 0.02;

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

// Block CSS capable of loading external resources.
const DANGEROUS_CSS_VALUE = /(?:url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|position\s*:\s*(?:fixed|sticky))/i;

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

// Convert safe CSS property names for React inline styles.
function toReactStyleProperty(propertyName) {
    if (propertyName.startsWith("--")) return propertyName;

    return propertyName
        .replace(/^-ms-/, "ms-")
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Purpose: Serializes sanitized tooltip markup for ToolTip.jsx.
 * @param {string} htmlBody - Authored tooltip markup.
 * @param {string} manifestUrl - Companion JSON URL.
 * @param {Document} ownerDocument - Document creating the safe markup.
 * @returns {string} Sanitized serialized HTML.
 */
export function getTourTooltipHtml(htmlBody, manifestUrl, ownerDocument = document) {
    const container = ownerDocument.createElement("div");
    container.appendChild(sanitizeTooltipHtml(htmlBody, manifestUrl, ownerDocument));
    return container.innerHTML;
}

/**
 * Purpose: Converts authored CSS declarations into React styles.
 * @param {string} styleText - Authored CSS declaration list.
 * @param {Document} ownerDocument - Document providing CSS parsing.
 * @returns {object|undefined} Safe React inline styles.
 */
export function getTourTooltipStyle(styleText, ownerDocument = document) {
    const safeDeclarations = sanitizeTooltipDeclarations(styleText, ownerDocument);
    if (!safeDeclarations) return undefined;

    const parsedStyle = ownerDocument.createElement("div").style;
    const reactStyle = {};
    parsedStyle.cssText = safeDeclarations;

    Array.from(parsedStyle).forEach((propertyName) => {
        reactStyle[toReactStyleProperty(propertyName)] = parsedStyle
            .getPropertyValue(propertyName)
            .trim();
    });

    return Object.keys(reactStyle).length > 0 ? reactStyle : undefined;
}

/**
 * Purpose: Projects one tour anchor into circle percentage coordinates.
 * @param {THREE.Vector3|Array<number>} anchorPoint - Loader-local hotspot anchor.
 * @param {THREE.Object3D} root - Loader transform root.
 * @param {THREE.Camera} camera - Active R3F camera.
 * @param {object} scratch - Optional reusable vectors.
 * @returns {object} Screen percentage position and visibility.
 */
export function projectTourCircle(anchorPoint, root, camera, scratch = {}) {
    const output = scratch.output ?? { position: [0, 0], circleIsVisible: false };
    const worldPosition = scratch.worldPosition ?? new THREE.Vector3();
    const cameraPosition = scratch.cameraPosition ?? new THREE.Vector3();
    const cameraDirection = scratch.cameraDirection ?? new THREE.Vector3();
    const directionToAnchor = scratch.directionToAnchor ?? new THREE.Vector3();
    const projectedPosition = scratch.projectedPosition ?? new THREE.Vector3();
    const validAnchor = anchorPoint?.isVector3
        || (Array.isArray(anchorPoint) && anchorPoint.length === 3);

    if (!validAnchor || !root?.isObject3D || !camera?.isCamera) {
        output.circleIsVisible = false;
        return output;
    }

    root.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    worldPosition.copy(anchorPoint.isVector3
        ? anchorPoint
        : new THREE.Vector3(...anchorPoint));
    worldPosition.applyMatrix4(root.matrixWorld);
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    directionToAnchor.copy(worldPosition).sub(cameraPosition);
    projectedPosition.copy(worldPosition).project(camera);

    const inFront = cameraDirection.dot(directionToAnchor) > 0;
    const insideClipSpace = projectedPosition.x >= -1 && projectedPosition.x <= 1
        && projectedPosition.y >= -1 && projectedPosition.y <= 1
        && projectedPosition.z >= -1 && projectedPosition.z <= 1;

    output.position[0] = (projectedPosition.x * 0.5 + 0.5) * 100;
    output.position[1] = (-projectedPosition.y * 0.5 + 0.5) * 100;
    output.circleIsVisible = inFront && insideClipSpace;
    return output;
}

/**
 * Purpose: Maps one tour tooltip action into circlesData.
 * @param {object} action - Parsed floatingTooltip action.
 * @param {string} circleName - Stable namespaced circle identity.
 * @param {string} ownerId - Tour publisher identity.
 * @param {string} manifestUrl - Companion JSON URL.
 * @returns {object} Legacy circle and tooltip data.
 */
export function createTourCircleRecord(action, circleName, ownerId, manifestUrl) {
    return {
        circleName,
        circleSize: 30,
        playPulseAnimation: true,
        position: [0, 0],
        circleIsVisible: false,
        html: getTourTooltipHtml(action.htmlBody, manifestUrl),
        style: getTourTooltipStyle(action.style),
        textShowMode: "Canvas",
        tooltipPosition: action.tooltipPosition,
        ariaLabel: "Show tour tooltip",
        housemakerTourCircle: true,
        housemakerTourCircleOwner: ownerId
    };
}

// Compare published records without frame-rate store churn.
function tourCircleMatches(currentCircle, nextCircle) {
    return currentCircle.circleName === nextCircle.circleName
        && currentCircle.circleIsVisible === nextCircle.circleIsVisible
        && Math.abs(currentCircle.position[0] - nextCircle.position[0])
            <= POSITION_CHANGE_THRESHOLD
        && Math.abs(currentCircle.position[1] - nextCircle.position[1])
            <= POSITION_CHANGE_THRESHOLD
        && currentCircle.html === nextCircle.html
        && currentCircle.style === nextCircle.style
        && currentCircle.tooltipPosition === nextCircle.tooltipPosition
        && currentCircle.circleSize === nextCircle.circleSize
        && currentCircle.playPulseAnimation === nextCircle.playPulseAnimation
        && currentCircle.ariaLabel === nextCircle.ariaLabel;
}

/**
 * Purpose: Reconciles one publisher's circles without touching others.
 * @param {string} ownerId - Tour publisher identity.
 * @param {Array<object>} desiredCircles - Complete owned circle records.
 */
export function reconcileTourCircles(ownerId, desiredCircles) {
    const circleNamePrefix = `${TOUR_CIRCLE_PREFIX}${ownerId}:`;

    SystemStore.setState((state) => {
        const currentOwned = state.circlesData.filter((circle) => (
            circle.housemakerTourCircleOwner === ownerId
        ));
        const currentByName = new Map(currentOwned.map((circle) => [
            circle.circleName,
            circle
        ]));
        let circlesChanged = currentOwned.length !== desiredCircles.length;

        const nextOwned = desiredCircles.map((desiredCircle, index) => {
            const currentCircle = currentByName.get(desiredCircle.circleName);
            const unchanged = currentCircle
                && currentOwned[index] === currentCircle
                && tourCircleMatches(currentCircle, desiredCircle);

            if (unchanged) return currentCircle;
            circlesChanged = true;
            return desiredCircle;
        });
        let nextOwnedIndex = 0;
        const nextCircles = state.circlesData.flatMap((circle) => {
            if (circle.housemakerTourCircleOwner !== ownerId) return [circle];

            const replacement = nextOwned[nextOwnedIndex];
            nextOwnedIndex += 1;
            return replacement ? [replacement] : [];
        });

        if (nextOwnedIndex < nextOwned.length) {
            nextCircles.push(...nextOwned.slice(nextOwnedIndex));
        }

        const selectedName = state.currentCircleNameSelected;
        const selectedDesired = desiredCircles.find((circle) => (
            circle.circleName === selectedName
        ));
        const selectedBelongsToOwner = typeof selectedName === "string"
            && selectedName.startsWith(circleNamePrefix);
        const clearSelection = selectedBelongsToOwner
            && (!selectedDesired || !selectedDesired.circleIsVisible);
        const pinnedName = state.circleProperties.pinnedCircleName;
        const pinnedDesired = desiredCircles.find((circle) => (
            circle.circleName === pinnedName
        ));
        const pinnedBelongsToOwner = typeof pinnedName === "string"
            && pinnedName.startsWith(circleNamePrefix);
        const clearPin = pinnedBelongsToOwner
            && (!pinnedDesired || !pinnedDesired.circleIsVisible);
        const visiblePinnedCircle = clearPin
            ? undefined
            : nextCircles.find((circle) => (
                circle.circleName === pinnedName && circle.circleIsVisible
            ));

        if (!circlesChanged && !clearSelection && !clearPin) return state;

        return {
            circlesData: circlesChanged
                ? nextCircles
                : state.circlesData,
            ...(clearSelection ? {
                currentCircleNameSelected: visiblePinnedCircle?.circleName
            } : {}),
            ...((clearSelection || clearPin) ? {
                circleProperties: {
                    ...state.circleProperties,
                    ...(clearSelection ? { active: Boolean(visiblePinnedCircle) } : {}),
                    ...(clearPin ? { pinnedCircleName: undefined } : {})
                }
            } : {})
        };
    });
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

// ### Tooltip circle publisher ###

/**
 * Purpose: Publishes active tour tooltips through circlesData.
 * Relationships: SceneViewer renders the records with Circle and ToolTip.
 * Example: <TourTooltipActions actions={actions} rootRef={rootRef} />
 * @param {Array<object>} props.actions - Active floating-tooltip actions.
 * @param {string} props.manifestUrl - Companion JSON URL.
 * @param {THREE.Camera} props.camera - Optional camera override.
 * @param {React.MutableRefObject<THREE.Object3D>} props.rootRef - Loader root.
 */
export function TourTooltipActions(props) {
    const { actions = [], manifestUrl = "", camera: cameraOverride, rootRef } = props;
    const defaultCamera = useThree((state) => state.camera);
    const camera = cameraOverride ?? defaultCamera;
    const reactOwnerId = useId();
    const ownerId = useRef();
    const recordsRef = useRef([]);
    const projectionScratch = useRef();

    // Keep one stable owner across ordinary rerenders.
    if (!ownerId.current) ownerId.current = `tour-${reactOwnerId}`;

    // Allocate projection values once for every active action.
    if (!projectionScratch.current) {
        projectionScratch.current = {
            output: { position: [0, 0], circleIsVisible: false },
            worldPosition: new THREE.Vector3(),
            cameraPosition: new THREE.Vector3(),
            cameraDirection: new THREE.Vector3(),
            directionToAnchor: new THREE.Vector3(),
            projectedPosition: new THREE.Vector3()
        };
    }

    // Rebuild static records only when authored actions change.
    useEffect(() => {
        const currentCircles = new Map(SystemStore.getState().circlesData
            .filter((circle) => circle.housemakerTourCircleOwner === ownerId.current)
            .map((circle) => [circle.circleName, circle]));

        recordsRef.current = actions.filter(Boolean).map((action, index) => {
            const actionKey = action.renderKey ?? action.id ?? "tooltip";
            const circleName = `${TOUR_CIRCLE_PREFIX}${ownerId.current}:${actionKey}:${index}`;
            const currentCircle = currentCircles.get(circleName);
            const circle = createTourCircleRecord(
                action,
                circleName,
                ownerId.current,
                manifestUrl
            );

            return {
                action,
                circle: currentCircle ? {
                    ...circle,
                    position: currentCircle.position,
                    circleIsVisible: currentCircle.circleIsVisible
                } : circle
            };
        });

        reconcileTourCircles(
            ownerId.current,
            recordsRef.current.map((record) => record.circle)
        );
    }, [actions, manifestUrl]);

    // Remove only this publisher's records during unmounts.
    useEffect(() => () => {
        recordsRef.current = [];
        reconcileTourCircles(ownerId.current, []);
    }, []);

    // Update projected percentages in one atomic store write.
    useFrame(() => {
        const root = rootRef?.current;
        const desiredCircles = recordsRef.current.map((record) => {
            const projection = projectTourCircle(
                record.action.anchorPoint,
                root,
                camera,
                projectionScratch.current
            );

            return {
                ...record.circle,
                position: [...projection.position],
                circleIsVisible: projection.circleIsVisible
            };
        });

        reconcileTourCircles(ownerId.current, desiredCircles);
    });

    return null;
}
