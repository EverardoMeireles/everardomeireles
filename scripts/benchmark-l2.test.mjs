import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Exercise browser-independent logic without launching or changing the viewer.
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = JSON.parse(fs.readFileSync(path.join(repository, "performance-benchmarks/l2-ground.route.json"), "utf8"));
const sandbox = { window: { __HOUSEMAKER_BENCHMARK_CONFIG__: {} }, setInterval: () => 1 };
vm.runInNewContext(fs.readFileSync(path.join(repository, "scripts/benchmark-l2-browser.js"), "utf8"), sandbox);
const { buildTimeline, summarize } = sandbox.window.__houseMakerBenchmark;

// Compare accumulated distances without depending on floating-point summation order.
const approximately = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`);

test("frozen L2 route matches the current manifest and GLB", () => {
    for (const [file, expected] of [[route.source.manifest, route.source.manifestSha256], [route.source.glb, route.source.glbSha256]]) {
        const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(repository, file))).digest("hex");
        assert.equal(actual, expected, `Revalidate the route after changing ${file}.`);
    }
});

test("route uses exported ground coordinates without applying global scale again", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repository, route.source.manifest), "utf8"));
    assert.equal(route.levelIndex, 2);
    assert.equal(route.coordinateSystem, "gltf-y-up");
    assert.equal(route.positionSpace, "floor");
    assert.equal(route.floorY, manifest.firstPersonCamera.floorPosition[1]);
    assert.equal(route.eyeHeightMeters, manifest.firstPersonCamera.eyeHeightMeters);
    assert.deepEqual(route.path[0].position, manifest.firstPersonCamera.floorPosition);
    assert.ok(route.path.every((entry) => entry.position.length === 3 && entry.position.every(Number.isFinite)
        && entry.position[1] === route.floorY));
});

test("all 15 exported L2 rooms receive one four-second panorama", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repository, route.source.manifest), "utf8"));
    const expected = manifest.roomAssets.rooms.filter((room) => room.levelIndex === 2 && !room.fallback).map((room) => room.id).sort();
    const panoramas = buildTimeline(route).segments.filter((segment) => segment.kind === "pan");
    assert.equal(expected.length, 15);
    assert.equal(panoramas.length, 15);
    assert.deepEqual(Array.from(panoramas, (segment) => segment.roomId).sort(), expected);
    panoramas.forEach((segment) => {
        approximately(segment.end - segment.start, 4);
        approximately(segment.yawTo - segment.yawFrom, Math.PI * 2);
        assert.deepEqual(segment.from, segment.to);
    });
});

test("timeline preserves 1.5 m/s movement and excludes nine stabilization intervals", () => {
    const timeline = buildTimeline(route);
    let distance = 0;
    let relocationSeconds = 0;
    assert.equal(route.policy.speedMetersPerSecond, 1.5);
    assert.equal(timeline.segments.filter((segment) => segment.kind === "relocate").length, 9);
    timeline.segments.forEach((segment, index) => {
        assert.equal(segment.start, index === 0 ? 0 : timeline.segments[index - 1].end);
        assert.ok(segment.end > segment.start);
        if (segment.kind === "move") {
            const length = Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
            distance += length;
            approximately(length / (segment.end - segment.start), route.policy.speedMetersPerSecond);
        }
        if (segment.kind === "relocate") {
            assert.deepEqual(segment.from, segment.to);
            approximately(segment.end - segment.start, 1);
            relocationSeconds += segment.end - segment.start;
        }
    });
    approximately(distance, route.summary.pathDistanceMeters);
    approximately(timeline.scoredSeconds, route.summary.estimatedTimedDurationSeconds);
    approximately(timeline.durationSeconds, timeline.scoredSeconds + relocationSeconds);
    approximately(relocationSeconds, 9);
});

test("no movement segment bridges disconnected route components", () => {
    const timeline = buildTimeline(route);
    const components = new Map(route.components.map((component) => [component.id,
        route.path.slice(component.pathStartIndex, component.pathEndIndex + 1).map((entry) => entry.position)]));
    for (const segment of timeline.segments.filter((entry) => entry.kind === "move")) {
        const positions = components.get(segment.componentId);
        assert.ok(positions, `Unknown component ${segment.componentId}.`);
        assert.ok(positions.some((position) => position.every((value, axis) => value === segment.from[axis])));
        assert.ok(positions.some((position) => position.every((value, axis) => value === segment.to[axis])));
    }
});

test("timeline generation is deterministic and leaves the frozen route untouched", () => {
    const before = JSON.stringify(route);
    assert.equal(JSON.stringify(buildTimeline(route)), JSON.stringify(buildTimeline(route)));
    assert.equal(JSON.stringify(route), before);
    assert.ok(route.summary.maximumGraphDistanceToRouteMeters <= route.policy.maximumCoverageDistanceMeters);
    assert.equal(route.policy.validationSweepStepMeters, 0.05);
    assert.equal(route.policy.capsuleRadiusMeters, 0.35);
});

test("explicit relocation and component changes never add travel time", () => {
    const timeline = buildTimeline({ levelIndex: 2, eyeHeightMeters: 1.7,
        policy: { speedMetersPerSecond: 1.5 }, checkpoints: [], path: [
            { position: [0, 0, 0], componentId: "a" },
            { position: [3, 0, 0], componentId: "a" },
            { position: [300, 0, 0], componentId: "a", teleportBefore: true },
            { position: [900, 0, 0], componentId: "b" },
        ] });
    assert.equal(Array.from(timeline.segments, (segment) => segment.kind).join(","), "relocate,move,relocate,relocate");
    assert.equal(timeline.scoredSeconds, 2);
    assert.equal(timeline.durationSeconds, 5);
});

test("legacy route speed remains supported", () => {
    const timeline = buildTimeline({ levelIndex: 2, eyeHeightMeters: 1.7, speedMetersPerSecond: 2,
        checkpoints: [], path: [{ position: [0, 0, 0] }, { position: [0, 0, 4] }] });
    assert.equal(timeline.scoredSeconds, 2);
});

test("invalid levels, empty paths, speeds, heights and positions are rejected", () => {
    const valid = { levelIndex: 2, eyeHeightMeters: 1.7, policy: { speedMetersPerSecond: 1.5 }, checkpoints: [], path: [{ position: [0, 0, 0] }] };
    for (const patch of [
        { levelIndex: 3 }, { path: [] }, { path: null }, { policy: { speedMetersPerSecond: 0 } },
        { policy: { speedMetersPerSecond: -1 } }, { policy: { speedMetersPerSecond: Infinity } },
        { eyeHeightMeters: NaN }, { eyeHeightMeters: 0 }, { eyeHeightMeters: -1 },
        { path: [{ position: [0, 0] }] }, { path: [{ position: [0, Infinity, 0] }] },
    ]) assert.throws(() => buildTimeline({ ...valid, ...patch }));
});

test("summary reports nearest-rank frame percentiles and time-weighted FPS", () => {
    const rows = Array.from({ length: 100 }, (unused, index) => ({ kind: "move", frameMs: index + 1,
        cpuSubmitMs: 2, gpuMs: 3, drawCalls: 400, triangles: 90000, heapBytes: index, textures: index, geometries: index }));
    const summary = summarize(rows);
    assert.equal(summary.frames, 100);
    approximately(summary.averageFps, 1000 / 50.5);
    assert.equal(summary.frameTimeMs.mean, 50.5);
    assert.equal(summary.frameTimeMs.p50, 50);
    assert.equal(summary.frameTimeMs.p95, 95);
    assert.equal(summary.frameTimeMs.p99, 99);
    assert.equal(summary.frameTimeMs.max, 100);
    assert.equal(summary.cpuSubmitMs.mean, 2);
    assert.equal(summary.gpuMs.mean, 3);
    assert.equal(summary.drawCalls.mean, 400);
    assert.equal(summary.triangles.mean, 90000);
    assert.equal(summary.framesOver33ms, 67);
    assert.equal(summary.framesOver50ms, 50);
    assert.equal(summary.framesOver100ms, 0);
    assert.equal(summary.heapBytesPeak, 99);
    assert.equal(summary.textureCountPeak, 99);
    assert.equal(summary.geometryCountPeak, 99);
});

test("relocation and invalid frame intervals never affect scored measurements", () => {
    const rows = [{ kind: "pan", frameMs: 10 }, { kind: "move", frameMs: 30 },
        { kind: "relocate", frameMs: 9000, gpuMs: 9000 },
        ...[null, undefined, NaN, Infinity, -1, 0].map((frameMs) => ({ kind: "move", frameMs }))];
    const summary = summarize(rows);
    assert.equal(summary.frames, 2);
    assert.equal(summary.averageFps, 50);
    assert.equal(summary.frameTimeMs.max, 30);
    assert.equal(summary.gpuMs, null);
    assert.equal(summary.framesOver100ms, 0);
});

test("missing and non-finite optional samples stay unavailable instead of becoming zero", () => {
    const summary = summarize([{ kind: "move", frameMs: 10, cpuSubmitMs: null, gpuMs: undefined, drawCalls: NaN, triangles: Infinity },
        { kind: "move", frameMs: 20, cpuSubmitMs: 4, gpuMs: 8, drawCalls: 500, triangles: 100000 }]);
    assert.equal(summary.cpuSubmitMs.mean, 4);
    assert.equal(summary.gpuMs.mean, 8);
    assert.equal(summary.drawCalls.mean, 500);
    assert.equal(summary.triangles.mean, 100000);
});

test("empty scored input reports unavailable timings and zero counts", () => {
    for (const rows of [[], [{ kind: "relocate", frameMs: 100 }]]) {
        const summary = summarize(rows);
        assert.equal(summary.frames, 0);
        for (const key of ["averageFps", "frameTimeMs", "cpuSubmitMs", "gpuMs", "drawCalls", "triangles"]) assert.equal(summary[key], null);
        for (const key of ["framesOver33ms", "framesOver50ms", "framesOver100ms", "heapBytesPeak", "textureCountPeak", "geometryCountPeak"]) assert.equal(summary[key], 0);
    }
});

test("long multi-run logs summarize without exceeding argument limits", () => {
    const rows = Array.from({ length: 200000 }, (unused, index) => ({ kind: "move",
        frameMs: index % 2 === 0 ? 16 : 32, heapBytes: index, textures: index % 100, geometries: index % 40 }));
    const summary = summarize(rows);
    assert.equal(summary.frames, 200000);
    assert.equal(summary.frameTimeMs.mean, 24);
    approximately(summary.averageFps, 1000 / 24);
    assert.equal(summary.heapBytesPeak, 199999);
    assert.equal(summary.textureCountPeak, 99);
    assert.equal(summary.geometryCountPeak, 39);
});

test("non-finite resource peaks never contaminate available measurements", () => {
    const unavailable = [NaN, Infinity, -Infinity, undefined, null].map((value) => ({ kind: "move",
        frameMs: 16, heapBytes: value, textures: value, geometries: value }));
    const emptyPeaks = summarize(unavailable);
    assert.equal(emptyPeaks.heapBytesPeak, 0);
    assert.equal(emptyPeaks.textureCountPeak, 0);
    assert.equal(emptyPeaks.geometryCountPeak, 0);
    const validPeaks = summarize([...unavailable, { kind: "move", frameMs: 16, heapBytes: 128, textures: 7, geometries: 4 }]);
    assert.equal(validPeaks.heapBytesPeak, 128);
    assert.equal(validPeaks.textureCountPeak, 7);
    assert.equal(validPeaks.geometryCountPeak, 4);
});
