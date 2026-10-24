/* Injected only into the benchmark's isolated Chrome session. */
(() => {
    const configuration = window.__HOUSEMAKER_BENCHMARK_CONFIG__;
    if (!configuration || window.__houseMakerBenchmark) return;
    const roots = new Set();
    const frames = [];
    const longTasks = [];
    const phases = [];
    const materialTransitions = [];
    const materialTiers = new Map();
    let context;
    let active;
    let error;
    let resultPromise;
    let firstHouseFrameMs;
    let initialObservation;
    let observer;
    let systemStore;
    let previousSettings;
    let phaseName = "waiting-for-house";
    let collisionReadyObservedMs;

    // Capture component refs without modifying application source files.
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        renderers: new Map(),
        inject(renderer) {
            const id = this.renderers.size + 1;
            this.renderers.set(id, renderer);
            return id;
        },
        onCommitFiberRoot(id, root) { roots.add(root); },
        onCommitFiberUnmount() {},
    };

    // Find mounted components across React DOM and Fiber roots.
    function findComponent(name) {
        const visited = new Set();
        const pending = [...roots].map((root) => root.current);
        while (pending.length) {
            const fiber = pending.pop();
            if (!fiber || visited.has(fiber)) continue;
            visited.add(fiber);
            const type = fiber.type?.type ?? fiber.type;
            if (type?.name === name || type?.displayName === name) return fiber;
            pending.push(fiber.child, fiber.sibling);
        }
    }

    // Inspect existing refs and memoized values without changing hooks.
    function hookValues(fiber) {
        const values = [];
        let hook = fiber?.memoizedState;
        while (hook && typeof hook === "object") {
            values.push(hook.memoizedState);
            hook = hook.next;
        }
        return values;
    }

    // Build an explicit, versioned timeline from collision-checked floor paths.
    function buildTimeline(route) {
        if (route.levelIndex !== 2 || !Array.isArray(route.path) || route.path.length < 1) {
            throw new Error("Expected an L2 route with a chronological path.");
        }
        const speed = route.policy?.speedMetersPerSecond ?? route.speedMetersPerSecond;
        if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(route.eyeHeightMeters) || route.eyeHeightMeters <= 0) throw new Error("Invalid route speed or eye height.");
        const checkpoints = new Map(route.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
        const segments = [];
        let elapsed = 0;
        let previous;
        let yaw = Math.atan2(-1, 0);
        const append = (segment, duration) => {
            if (duration <= 0) return;
            segments.push({ ...segment, start: elapsed, end: elapsed + duration });
            elapsed += duration;
        };
        for (const entry of route.path) {
            if (!Array.isArray(entry.position) || entry.position.length !== 3 || !entry.position.every(Number.isFinite)) {
                throw new Error("Route contains a non-finite floor position.");
            }
            const checkpoint = checkpoints.get(entry.checkpointId);
            const roomId = checkpoint?.roomId ?? entry.roomId ?? previous?.roomId ?? null;
            const base = { roomId, checkpointId: entry.checkpointId ?? null, componentId: entry.componentId ?? previous?.componentId ?? 0 };
            const relocated = !previous || entry.teleportBefore === true || base.componentId !== previous.componentId;
            if (relocated) {
                append({ ...base, kind: "relocate", from: entry.position, to: entry.position, yawFrom: yaw, yawTo: yaw }, 1);
            } else {
                const distance = Math.hypot(...entry.position.map((value, axis) => value - previous.position[axis]));
                if (distance > 0.0001) {
                    const targetYaw = Math.atan2(previous.position[0] - entry.position[0], previous.position[2] - entry.position[2]);
                    let turn = targetYaw - yaw;
                    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
                    append({ ...base, kind: "move", from: previous.position, to: entry.position, yawFrom: yaw, yawTo: yaw + turn }, distance / speed);
                    yaw += turn;
                }
            }
            if (checkpoint?.panoramaSeconds > 0) {
                append({ ...base, kind: "pan", from: entry.position, to: entry.position, yawFrom: yaw, yawTo: yaw + Math.PI * 2 }, checkpoint.panoramaSeconds);
                yaw += Math.PI * 2;
            }
            previous = { ...entry, roomId, componentId: base.componentId };
        }
        return { segments, durationSeconds: elapsed, scoredSeconds: segments.filter((segment) => segment.kind !== "relocate").reduce((sum, segment) => sum + segment.end - segment.start, 0) };
    }

    // Report percentiles without hiding slow-frame tails behind average FPS.
    function summarize(rows) {
        const valid = rows.filter((row) => Number.isFinite(row.frameMs) && row.frameMs > 0 && row.kind !== "relocate");
        const statistics = (values) => {
            const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
            if (!sorted.length) return null;
            const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
            return { samples: sorted.length, mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: sorted[sorted.length - 1] };
        };
        const frameTimeMs = statistics(valid.map((row) => row.frameMs));
        return {
            frames: valid.length,
            averageFps: frameTimeMs ? 1000 / frameTimeMs.mean : null,
            frameTimeMs,
            cpuSubmitMs: statistics(valid.map((row) => row.cpuSubmitMs)),
            gpuMs: statistics(valid.map((row) => row.gpuMs)),
            drawCalls: statistics(valid.map((row) => row.drawCalls)),
            triangles: statistics(valid.map((row) => row.triangles)),
            framesOver33ms: valid.filter((row) => row.frameMs > 1000 / 30).length,
            framesOver50ms: valid.filter((row) => row.frameMs > 50).length,
            framesOver100ms: valid.filter((row) => row.frameMs > 100).length,
            heapBytesPeak: valid.reduce((peak, row) => Math.max(peak, Number.isFinite(row.heapBytes) ? row.heapBytes : 0), 0),
            textureCountPeak: valid.reduce((peak, row) => Math.max(peak, Number.isFinite(row.textures) ? row.textures : 0), 0),
            geometryCountPeak: valid.reduce((peak, row) => Math.max(peak, Number.isFinite(row.geometries) ? row.geometries : 0), 0),
        };
    }

    // Read shared streaming telemetry already maintained by the loader.
    function streaming() {
        return context.houseRoot.userData.housemakerMaterialStreaming ?? {};
    }

    // Keep shadow orientation identical at corresponding route timestamps.
    function synchronizeSun(elapsed, delta) {
        if (!context.orbit) return;
        const orbit = context.orbit;
        orbit.phase = ((elapsed - delta) * orbit.radiansPerSecond) % (Math.PI * 2);
    }

    // Drive the existing rig without allocating transforms each frame.
    function applyPose(segment, fraction) {
        const { controller, yaw, pitch, camera } = context;
        controller.position.set(...segment.from.map((value, axis) => value + (segment.to[axis] - value) * fraction));
        controller.quaternion.identity();
        yaw.rotation.set(0, segment.yawFrom + (segment.yawTo - segment.yawFrom) * fraction, 0);
        pitch.rotation.set(0, 0, 0);
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        controller.updateWorldMatrix(true, true);
    }

    // Read timer queries later, never blocking waiting for GPU results.
    function collectGpuQueries() {
        const { gl, timer, queries } = context;
        if (!timer || !queries.length) return;
        const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
        for (let index = queries.length - 1; index >= 0; index--) {
            const pending = queries[index];
            if (!disjoint && !gl.getQueryParameter(pending.query, gl.QUERY_RESULT_AVAILABLE)) continue;
            if (!disjoint) pending.row.gpuMs = gl.getQueryParameter(pending.query, gl.QUERY_RESULT) / 1000000;
            else context.disjointGpuSamples += 1;
            gl.deleteQuery(pending.query);
            queries.splice(index, 1);
        }
    }

    // Start measurements before native scene callbacks and composer passes.
    function beforeFrame(state, delta) {
        const now = performance.now();
        collectGpuQueries();
        context.frameStarted = now;
        if (context.previousRow && context.previousRow.phase === (active?.label ?? phaseName)) {
            context.previousRow.frameMs = now - context.previousFrameStarted;
        }
        context.previousFrameStarted = now;
        state.gl.info.reset();
        if (active) {
            active.startedAt ??= now;
            active.elapsed = Math.min((now - active.startedAt) / 1000, context.timeline.durationSeconds);
            while (active.segmentIndex < context.timeline.segments.length - 1
                && active.elapsed >= context.timeline.segments[active.segmentIndex].end) active.segmentIndex++;
            active.segment = context.timeline.segments[active.segmentIndex];
            const segment = active.segment;
            applyPose(segment, Math.max(0, Math.min(1, (active.elapsed - segment.start) / (segment.end - segment.start))));
            synchronizeSun(active.elapsed, delta);
        }
        context.currentQuery = null;
        if (context.captureQueries && context.timer && context.queries.length < 8
            && !context.gl.getQuery(context.timer.TIME_ELAPSED_EXT, context.gl.CURRENT_QUERY)) {
            context.currentQuery = context.gl.createQuery();
            context.gl.beginQuery(context.timer.TIME_ELAPSED_EXT, context.currentQuery);
        }
        context.cpuStarted = performance.now();
    }

    // Aggregate full-frame counts, including shadows and post-processing.
    function afterFrame(state) {
        const now = performance.now();
        const info = state.gl.info;
        const telemetry = streaming();
        Object.entries(telemetry.materials ?? {}).forEach(([id, material]) => {
            if (materialTiers.get(id) === material.tier) return;
            materialTiers.set(id, material.tier);
            materialTransitions.push({ id, tier: material.tier, observedAtMs: now, phase: active?.label ?? phaseName });
        });
        const segment = active?.segment;
        const row = {
            phase: active?.label ?? phaseName, run: active?.run ?? 0,
            elapsedSeconds: active?.elapsed ?? (now - context.attachedAt) / 1000,
            kind: segment?.kind ?? "hold", roomId: segment?.roomId ?? context.route.startRoomId ?? null,
            checkpointId: segment?.checkpointId ?? null,
            x: context.controller.position.x, y: context.controller.position.y + context.route.eyeHeightMeters, z: context.controller.position.z,
            frameMs: null, cpuSubmitMs: now - context.cpuStarted, gpuMs: null,
            drawCalls: info.render.calls, triangles: info.render.triangles,
            textures: info.memory.textures, geometries: info.memory.geometries, programs: info.programs?.length ?? 0,
            heapBytes: performance.memory?.usedJSHeapSize ?? null,
            downloadedBytes: telemetry.bytesDownloaded ?? 0, residentMaterialBytesEstimate: telemetry.gpuResidentBytes ?? 0,
            activeDownloads: telemetry.activeDownloads ?? 0, activeDecodes: telemetry.activeDecodes ?? 0,
            streamingErrors: telemetry.errors ?? 0, uploadBudgetOverruns: telemetry.uploadFrameStalls ?? 0,
        };
        if (context.currentQuery) {
            context.gl.endQuery(context.timer.TIME_ELAPSED_EXT);
            context.queries.push({ query: context.currentQuery, row });
        }
        frames.push(row);
        context.previousRow = row;
        firstHouseFrameMs ??= now;
        if (context.collisionReadyRef?.current) collisionReadyObservedMs ??= now;
        if (active?.elapsed >= context.timeline.durationSeconds) {
            const completed = active;
            phases.push({ label: completed.label, run: completed.run, startedAtMs: completed.startedAt, endedAtMs: now });
            active = null;
            phaseName = `${completed.label}-complete`;
            completed.resolve();
        }
    }

    // Validate every route segment against the controller's actual collision octrees.
    async function validateRuntimeRoute() {
        const hooks = hookValues(findComponent("FirstPersonController"));
        const groups = hooks.map((value) => value?.current).find((value) => Array.isArray(value)
            && value.length && value.every((group) => group.octree && Array.isArray(group.meshes)));
        const capsule = hooks.map((value) => value?.current).find((value) => value?.start?.isVector3 && value.end?.isVector3 && value.radius === 0.35)?.clone();
        if (!groups || !capsule) throw new Error("Controller collision data not available for route validation.");
        const failures = [];
        let samples = 0;
        for (const segment of context.timeline.segments) {
            const distance = Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
            const steps = Math.max(1, Math.ceil(distance / 0.05));
            for (let index = 0; index <= steps; index++) {
                const position = segment.from.map((value, axis) => value + (segment.to[axis] - value) * index / steps);
                capsule.start.set(position[0], position[1] + 0.353, position[2]);
                capsule.end.set(position[0], position[1] + context.route.eyeHeightMeters + 0.003, position[2]);
                for (const group of groups) {
                    if (group.root?.userData.housemakerObjectsHidden) continue;
                    const hit = group.octree.capsuleIntersect(capsule);
                    if (hit && hit.depth > 0.008) {
                        failures.push({ position, depth: hit.depth, checkpointId: segment.checkpointId });
                        break;
                    }
                }
                samples++;
                if (samples % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        return { samples, failures: failures.slice(0, 30), failureCount: failures.length, spacingMeters: 0.05 };
    }

    // Locate the live scene and initialize controlled benchmark conditions.
    function attach() {
        if (!systemStore) {
            const chunkName = Object.keys(window).find((key) => key.startsWith("webpackChunk") && Array.isArray(window[key]));
            if (!chunkName) return;
            let require;
            window[chunkName].push([[`housemaker-benchmark-${Date.now()}`], {}, (runtime) => { require = runtime; }]);
            systemStore = require?.("./src/SystemStore.js")?.default;
            if (!systemStore?.setState) throw new Error("Benchmark requires the local development build's SystemStore module.");
            previousSettings = systemStore.getState();
            systemStore.setState({ tutorialClosed: true, r3fPerfEnabled: false, currentGraphicalMode: "normal", viewerDpr: 1,
                realTimeGiEnabled: true, ssaoEnabled: true, shadowsEnabled: true, showBakedPvs: false, anisotropicFilteringEnabled: false });
        }
        const bridge = window.__R3F_DOM__;
        const cameraEntry = bridge?.getByType("PerspectiveCamera")?.[0];
        const camera = cameraEntry && bridge.getObject3D(cameraEntry.uuid);
        const store = camera?.__r3f?.root;
        const state = store?.getState();
        const container = findComponent("SceneContainer");
        const navigation = container?.memoizedProps.navigationRef?.current;
        let houseRoot;
        state?.scene.traverse((node) => { if (node.userData.housemakerMaterialStreaming) houseRoot = node; });
        if (!state || !navigation || !houseRoot) return;
        const pitch = camera.parent;
        const yaw = pitch.parent;
        const controller = yaw.parent;
        const gl = state.gl.getContext();
        const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = rendererInfo ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        if (/swiftshader|software|llvmpipe|warp/i.test(renderer)) throw new Error(`Native GPU required, got ${renderer}.`);
        const light = hookValues(findComponent("HouseMakerDirectionalLight"));
        const orbit = light.map((value) => Array.isArray(value) ? value[0] : null)
            .find((value) => value?.lightId && Number.isFinite(value.radiansPerSecond));
        const route = configuration.route;
        const controllerHooks = hookValues(findComponent("FirstPersonController"));
        const capsuleIndex = controllerHooks.findIndex((value) => value?.current?.start?.isVector3 && value.current.end?.isVector3 && value.current.radius === 0.35);
        const timeline = buildTimeline(route);
        if (configuration.smoke) {
            timeline.segments = timeline.segments.filter((segment) => segment.start < 8)
                .map((segment) => ({ ...segment, end: Math.min(segment.end, 8) }));
            timeline.durationSeconds = 8;
            timeline.scoredSeconds = 7;
        }
        context = { state, store, route, navigation, camera, pitch, yaw, controller, houseRoot, gl, orbit, renderer,
            systemStore, previousSettings, snapshot: navigation.suspend(), timeline,
            attachedAt: performance.now(), previousFrameStarted: null, previousAutoReset: state.gl.info.autoReset,
            timer: gl.getExtension("EXT_disjoint_timer_query_webgl2"), queries: [], disjointGpuSamples: 0, captureQueries: true,
            collisionReadyRef: controllerHooks[capsuleIndex - 1] };
        phaseName = "startup-observation";
        state.gl.info.autoReset = false;
        context.unsubscribeBefore = state.internal.subscribe({ current: beforeFrame }, -2000, store);
        context.unsubscribeAfter = state.internal.subscribe({ current: afterFrame }, 2, store);
        try {
            observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push({ startMs: entry.startTime, durationMs: entry.duration })));
            observer.observe({ type: "longtask", buffered: true });
        } catch {}
    }

    // Keep phase timing inside the renderer, not CDP polling intervals.
    function play(label, run) {
        context.previousFrameStarted = null;
        context.previousRow = null;
        return new Promise((resolve) => { active = { label, run, resolve, startedAt: null, segmentIndex: 0, elapsed: 0 }; });
    }

    // Restore only settings and state changed by this isolated session.
    function restore() {
        if (!context) return;
        context.unsubscribeBefore?.();
        context.unsubscribeAfter?.();
        context.state.gl.info.autoReset = context.previousAutoReset;
        context.navigation.restore(context.snapshot);
        context.systemStore.setState(context.previousSettings);
        context.queries.forEach(({ query }) => context.gl.deleteQuery(query));
        observer?.disconnect();
    }

    // Expose a small runner contract and pure regression-test functions.
    window.__houseMakerBenchmark = {
        buildTimeline,
        summarize,
        getStatus: () => ({ ready: Boolean(context), phase: error ? "failed" : active?.label ?? phaseName, error,
            renderer: context?.renderer, timelineSeconds: context?.timeline.durationSeconds, firstHouseFrameMs,
            elapsedSeconds: active?.elapsed,
            activeDownloads: context ? streaming().activeDownloads ?? 0 : null }),
        run() {
            if (resultPromise) return resultPromise;
            resultPromise = (async () => {
                if (!context) throw new Error("House scene is not ready.");
                try {
                    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 10000 - (performance.now() - context.attachedAt))));
                    initialObservation = { firstObservedHouseFrameMs: firstHouseFrameMs, sceneAttachedMs: context.attachedAt,
                        collisionReadyObservedMs,
                        streaming: JSON.parse(JSON.stringify(streaming())) };
                    phaseName = "validating-route";
                    const validation = await validateRuntimeRoute();
                    if (validation.failureCount) throw new Error(`Route intersects runtime collision geometry at ${validation.failureCount}/${validation.samples} samples: ${JSON.stringify(validation.failures.slice(0, 3))}`);
                    await play("warmup", 0);
                    phaseName = "settling-materials";
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    for (let run = 1; run <= configuration.runs; run++) {
                        await play(`measured-${run}`, run);
                    }
                    phaseName = "collecting-gpu-results";
                    context.captureQueries = false;
                    const queryDeadline = performance.now() + 3000;
                    while (context.queries.length && performance.now() < queryDeadline) {
                        await new Promise((resolve) => setTimeout(resolve, 50));
                        collectGpuQueries();
                    }
                    collectGpuQueries();
                    const measured = frames.filter((frame) => frame.run > 0);
                    const runs = Array.from({ length: configuration.runs }, (_, index) => {
                        const rows = measured.filter((frame) => frame.run === index + 1);
                        return { run: index + 1, ...summarize(rows), byRoom: [...new Set(rows.map((row) => row.roomId))].map((roomId) => ({ roomId, ...summarize(rows.filter((row) => row.roomId === roomId)) })) };
                    });
                    const finalGlError = context.gl.getError();
                    const completed = {
                        valid: finalGlError === 0,
                        smokeTest: configuration.smoke === true,
                        methodology: { type: "collision-validated camera replay", movementPhysicsMeasured: false, build: "development",
                            viewport: configuration.viewport, speedMetersPerSecond: context.route.policy?.speedMetersPerSecond ?? context.route.speedMetersPerSecond,
                            actualDrawingBuffer: { width: context.gl.drawingBufferWidth, height: context.gl.drawingBufferHeight },
                            actualCanvasSize: { width: context.store.getState().size.width, height: context.store.getState().size.height },
                            actualDpr: context.state.gl.getPixelRatio(), cameraFovDegrees: context.camera.fov,
                            measuredRuns: configuration.runs, warmupPasses: 1, routeSeconds: context.timeline.durationSeconds,
                            scoredRouteSeconds: context.timeline.scoredSeconds, relocationFramesExcluded: true,
                            gi: true, ssao: true, shadows: true, anisotropicFiltering: false, performanceOverlay: false,
                            sun: "Native orbit synchronized to route time each repetition", gpuTimerSupported: Boolean(context.timer),
                            disjointGpuSamplesDiscarded: context.disjointGpuSamples, counters: "Full frame including shadows, offscreen preparation, GI and post-processing",
                            pendingGpuSamplesUnavailable: context.queries.length,
                            cpuSubmitTiming: "Native R3F callbacks and renderer submission, not total browser CPU or GPU time",
                            frameTiming: "Intervals between successive native R3F frames; rAF cadence, not presented-frame telemetry",
                            cache: "Isolated browser profile; startup observation separate from warmed route repetitions" },
                        startup: initialObservation,
                        runtimeRouteValidation: validation,
                        summary: summarize(measured),
                        byRoom: [...new Set(measured.map((row) => row.roomId))].map((roomId) => ({ roomId, ...summarize(measured.filter((row) => row.roomId === roomId)) })),
                        runs, phases, longTasks, materialTransitions,
                        finalStreaming: JSON.parse(JSON.stringify(streaming())),
                        finalGlError,
                        frames,
                    };
                    phaseName = "finished";
                    return completed;
                } finally { restore(); }
            })();
            return resultPromise;
        },
    };

    // Poll only until the scene is mounted; no permanent background timer.
    const attachmentTimer = setInterval(() => {
        try { if (!context) attach(); }
        catch (failure) { error = failure.stack ?? String(failure); }
        if (context || error) clearInterval(attachmentTimer);
    }, 50);
})();
