import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compareBenchmarkSessions, writeBenchmarkComparison } from "./benchmark-l2.mjs";

// Keep fixtures small while retaining required compatibility provenance.
const session = (directory, finishedAt, averageFps = 60) => ({
    directory,
    report: {
        valid: true, smokeTest: false,
        metadata: {
            finishedAt, testMode: "standardized-full-route", comparisonBaselineEligible: true,
            code: { sha256: "code-a" }, assetFingerprint: "assets-a", injectedScriptSha256: "browser-script-a", build: "development",
            viewport: { width: 1280, height: 720, dpr: 1 }, gpu: { renderer: "NVIDIA native D3D11" },
            browser: { version: { Browser: "Chrome/155.0" } }, host: { cpu: "CPU-a", platform: "win32", architecture: "x64" },
            renderSettings: { ssao: { enabled: true, strength: 2, radius: 0.05, bias: 0.014, samples: 49, resolution: 0.5 },
                gi: { enabled: true, strength: 0.7 } },
            route: { sha256: "route-file-a", definition: {
                format: "route", version: 1, levelIndex: 2, coordinateSystem: "gltf-y-up", positionSpace: "floor", floorY: 0.6, eyeHeightMeters: 1.7,
                source: { glbSha256: "source-glb-a" }, policy: { speedMetersPerSecond: 1.5 },
                path: [{ position: [0, 0.6, 0], componentId: 1, checkpointId: "a" }],
                checkpoints: [{ id: "a", position: [0, 0.6, 0], roomId: "room-a", panoramaSeconds: 4 }],
            } },
        },
        methodology: { gi: true, ssao: true, shadows: true, cameraFovDegrees: 70, sun: "synchronized", measuredRuns: 3, warmupPasses: 1 },
        summary: { frames: 100, averageFps, frameTimeMs: { mean: 16, p95: 20 }, cpuSubmitMs: { mean: 2 }, gpuMs: { mean: 5 }, drawCalls: { mean: 600 }, heapBytesPeak: 100000, framesOver50ms: 0 },
        startup: { firstObservedHouseFrameMs: 800 }, finalStreaming: { bytesDownloaded: 1000, gpuResidentBytes: 2000 },
        runs: [{ run: 1, frames: 100, averageFps }],
        byRoom: [{ roomId: "room-a", averageFps, frameTimeMs: { mean: 16 } }],
    },
});

test("first full baseline has no fabricated history", () => {
    const result = compareBenchmarkSessions(session("current", "2026-10-24T04:00:00Z"), []);
    assert.equal(result.status, "no-previous-sessions");
    assert.deepEqual(result.previousSessions, []);
    assert.ok(result.notes.some((note) => /retained benchmark frame logs/.test(note)));
    assert.ok(result.notes.some((note) => /not presented-frame telemetry/.test(note)));
});

test("selects last two completed sessions, not their repetitions", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const history = [session("oldest", "2026-10-24T01:00:00Z"), session("latest", "2026-10-24T03:00:00Z"), session("middle", "2026-10-24T02:00:00Z")];
    history[1].report.runs = [{ run: 1 }, { run: 2 }, { run: 3 }];
    assert.deepEqual(compareBenchmarkSessions(now, history).previousSessions.map((entry) => entry.directory), ["latest", "middle"]);
});

test("excludes current, future, smoke, incomplete, failed and drifting sessions", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const cases = [
        ["smoke", (report) => { report.smokeTest = true; }],
        ["test-mode", (report) => { report.metadata.testMode = "setup-smoke-only"; }],
        ["failed", (report) => { report.valid = false; }],
        ["error", (report) => { report.error = "failure"; }],
        ["missing-time", (report) => { delete report.metadata.finishedAt; }],
        ["ineligible", (report) => { report.metadata.comparisonBaselineEligible = false; }],
        ["code-drift", (report) => { report.metadata.codeChangedDuringRun = true; }],
        ["asset-drift", (report) => { report.metadata.assetsChangedDuringRun = true; }],
    ].map(([name, mutate]) => { const entry = session(name, "2026-10-24T03:00:00Z"); mutate(entry.report); return entry; });
    cases.push(now, session("future", "2026-10-24T05:00:00Z"), session("good", "2026-10-24T02:00:00Z"));
    assert.deepEqual(compareBenchmarkSessions(now, cases).previousSessions.map((entry) => entry.directory), ["good"]);
});

test("does not compare an ineligible current smoke session", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    now.report.smokeTest = true;
    const result = compareBenchmarkSessions(now, [session("old", "2026-10-24T03:00:00Z")]);
    assert.equal(result.status, "current-session-ineligible");
    assert.deepEqual(result.previousSessions, []);
});

test("retains most recent incompatible sessions without cherry-picking older ones", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const latest = session("latest", "2026-10-24T03:00:00Z");
    latest.report.metadata.viewport.dpr = 2;
    const result = compareBenchmarkSessions(now, [session("oldest-compatible", "2026-10-24T01:00:00Z"), session("middle", "2026-10-24T02:00:00Z"), latest]);
    assert.deepEqual(result.previousSessions.map((entry) => entry.directory), ["latest", "middle"]);
    assert.equal(result.previousSessions[0].comparable, false);
    assert.equal(result.previousSessions[0].summary.averageFps.changePercent, null);
    assert.equal(result.previousSessions[0].summary.averageFps.previous, 60);
});

test("app and asset changes warn but identical paths remain comparable", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const old = session("old", "2026-10-24T03:00:00Z");
    old.report.metadata.code.sha256 = "previous-code";
    old.report.metadata.assetFingerprint = "previous-assets";
    old.report.metadata.route.sha256 = "previous-route-file";
    old.report.metadata.route.definition.source.glbSha256 = "previous-source";
    const comparison = compareBenchmarkSessions(now, [old]).previousSessions[0];
    assert.equal(comparison.comparable, true);
    assert.equal(comparison.warnings.length, 3);
});

for (const [name, mutate, difference] of [
    ["path", (report) => { report.metadata.route.definition.path[0].position[0] = 1; }, "route"],
    ["speed", (report) => { report.metadata.route.definition.policy.speedMetersPerSecond = 3; }, "route"],
    ["DPR", (report) => { report.metadata.viewport.dpr = 2; }, "viewport"],
    ["graphics", (report) => { report.methodology.ssao = false; }, "methodology"],
    ["SSAO numeric settings", (report) => { report.metadata.renderSettings.ssao.samples = 17; }, "renderSettings"],
    ["GI native flag", (report) => { report.metadata.renderSettings.gi.enabled = false; }, "renderSettings"],
    ["sun", (report) => { report.methodology.sun = "unsynchronized"; }, "methodology"],
    ["GPU", (report) => { report.metadata.gpu.renderer = "Different GPU"; }, "gpu"],
    ["browser", (report) => { report.metadata.browser.version.Browser = "Chrome/156.0"; }, "browser"],
    ["protocol", (report) => { report.metadata.injectedScriptSha256 = "changed-injection"; }, "injectedScript"],
    ["CPU", (report) => { report.metadata.host.cpu = "Different CPU"; }, "cpu"],
]) {
    test(`${name} differences suppress speed claims`, () => {
        const old = session("old", "2026-10-24T03:00:00Z");
        mutate(old.report);
        const comparison = compareBenchmarkSessions(session("current", "2026-10-24T04:00:00Z"), [old]).previousSessions[0];
        assert.equal(comparison.comparable, false);
        assert.ok(comparison.differences.includes(difference));
        assert.equal(comparison.summary.averageFps.performanceImprovementPercent, null);
    });
}

test("missing native settings suppress strict comparisons but retain labelled observations", () => {
    const now = session("current", "2026-10-24T04:00:00Z", 60);
    const old = session("old", "2026-10-24T03:00:00Z", 50);
    delete old.report.metadata.renderSettings;
    old.report.startup.firstObservedHouseFrameMs = 1000;
    const comparison = compareBenchmarkSessions(now, [old]).previousSessions[0];
    assert.equal(comparison.comparable, false);
    assert.ok(comparison.differences.includes("renderSettings: missing provenance"));
    assert.equal(comparison.summary.averageFps.changePercent, null);
    assert.equal(comparison.observedSummary.averageFps.changePercent, 20);
    assert.equal(comparison.observedSummary.averageFps.direction, "higher observed FPS");
    assert.equal(comparison.observedSummary.averageFps.performanceImprovementPercent, null);
    assert.equal(comparison.observedStartup.firstObservedHouseFrameMs.changePercent, -20);
    assert.equal(comparison.observedStartup.firstObservedHouseFrameMs.performanceImprovementPercent, null);
    assert.match(comparison.observedDeltaInterpretation, /Descriptive, unadjusted/);
    assert.match(comparison.observedDeltaInterpretation, /prevent attributing changes to the export/);
});

test("older sessions both lacking native settings remain non-comparable", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const old = session("old", "2026-10-24T03:00:00Z");
    delete now.report.metadata.renderSettings;
    delete old.report.metadata.renderSettings;
    const comparison = compareBenchmarkSessions(now, [old]).previousSessions[0];
    assert.equal(comparison.comparable, false);
    assert.ok(comparison.differences.includes("renderSettings: missing provenance"));
});

test("compatible comparisons do not add unadjusted duplicate metrics", () => {
    const comparison = compareBenchmarkSessions(session("current", "2026-10-24T04:00:00Z"),
        [session("old", "2026-10-24T03:00:00Z")]).previousSessions[0];
    assert.equal(comparison.comparable, true);
    assert.equal(comparison.observedSummary, undefined);
    assert.equal(comparison.observedStartup, undefined);
});

test("separates faster FPS throughput from lower latency and workload changes", () => {
    const now = session("current", "2026-10-24T04:00:00Z", 62.5);
    const old = session("old", "2026-10-24T03:00:00Z", 50);
    old.report.summary.frameTimeMs.mean = 20;
    old.report.summary.drawCalls.mean = 750;
    const metrics = compareBenchmarkSessions(now, [old]).previousSessions[0].summary;
    assert.equal(metrics.averageFps.performanceImprovementPercent, 25);
    assert.equal(metrics.averageFps.direction, "faster FPS throughput");
    assert.equal(metrics["frameTimeMs.mean"].performanceImprovementPercent, 20);
    assert.equal(metrics["frameTimeMs.mean"].direction, "lower time");
    assert.equal(metrics["drawCalls.mean"].changePercent, -20);
    assert.equal(metrics["drawCalls.mean"].performanceImprovementPercent, null);
    const slower = compareBenchmarkSessions(old, [{ ...now, report: { ...now.report, metadata: { ...now.report.metadata, finishedAt: "2026-10-24T02:00:00Z" } } }]).previousSessions[0].summary;
    assert.equal(slower.averageFps.performanceImprovementPercent, -20);
    assert.equal(slower.averageFps.direction, "slower FPS throughput");
});

test("missing, non-finite and zero baselines never produce invalid percentages", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const old = session("old", "2026-10-24T03:00:00Z");
    old.report.summary.gpuMs.mean = Infinity;
    delete old.report.summary.heapBytesPeak;
    const metrics = compareBenchmarkSessions(now, [old]).previousSessions[0].summary;
    assert.equal(metrics["gpuMs.mean"].previous, null);
    assert.equal(metrics["gpuMs.mean"].changePercent, null);
    assert.equal(metrics.heapBytesPeak.changePercent, null);
    assert.equal(metrics.framesOver50ms.changePercent, null);
    assert.equal(metrics.framesOver50ms.direction, "unchanged");
});

test("compares rooms by stable IDs without matching unrelated rooms", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    now.report.byRoom.push({ roomId: "new-room", averageFps: 60 });
    const old = session("old", "2026-10-24T03:00:00Z");
    const rooms = compareBenchmarkSessions(now, [old]).previousSessions[0].byRoom;
    assert.equal(rooms[0].available, true);
    assert.equal(rooms[1].available, false);
    assert.equal(rooms[1].metrics.averageFps.changePercent, null);
});

test("pure comparisons do not mutate historical or current reports", () => {
    const now = session("current", "2026-10-24T04:00:00Z");
    const history = [session("old", "2026-10-24T03:00:00Z")];
    const before = JSON.stringify({ now, history });
    compareBenchmarkSessions(now, history);
    assert.equal(JSON.stringify({ now, history }), before);
});

test("compare-only preserves old reports and repairs numeric frame counts", (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "housemaker-comparison-test-"));
    context.after(() => { fs.rmSync(root, { recursive: true, force: true }); });
    const current = session(path.join(root, "current"), "2026-10-24T04:00:00Z");
    const old = session(path.join(root, "old"), "2026-10-24T03:00:00Z");
    for (const entry of [current, old]) {
        fs.mkdirSync(entry.directory);
        fs.writeFileSync(path.join(entry.directory, "summary.json"), JSON.stringify(entry.report));
    }
    const rawResult = { ...current.report, frames: [{ frame: 1 }, { frame: 2 }] };
    fs.writeFileSync(path.join(current.directory, "result.json"), JSON.stringify(rawResult));
    delete current.report.runs[0].frames;
    fs.writeFileSync(path.join(current.directory, "summary.json"), JSON.stringify(current.report));
    fs.mkdirSync(path.join(root, "corrupt"));
    fs.writeFileSync(path.join(root, "corrupt", "summary.json"), "invalid json");
    const previousBytes = fs.readFileSync(path.join(old.directory, "summary.json"), "utf8");
    const comparison = writeBenchmarkComparison(current.directory, root);
    assert.equal(comparison.previousSessions.length, 1);
    assert.equal(comparison.historyWarnings.length, 1);
    const saved = JSON.parse(fs.readFileSync(path.join(current.directory, "summary.json"), "utf8"));
    const result = JSON.parse(fs.readFileSync(path.join(current.directory, "result.json"), "utf8"));
    assert.equal(saved.runs[0].frames, 100);
    assert.deepEqual(result.frames, rawResult.frames);
    assert.deepEqual(result.metadata, rawResult.metadata);
    assert.deepEqual(result.comparison, saved.comparison);
    assert.equal(fs.readFileSync(path.join(old.directory, "summary.json"), "utf8"), previousBytes);
});
