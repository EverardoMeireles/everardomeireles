import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const argumentsList = isMain ? process.argv.slice(2) : [];
const options = {
    url: "http://localhost:3000",
    runs: 3,
    route: "performance-benchmarks/l2-ground.route.json",
    output: null,
    chrome: process.env.CHROME_PATH,
    timeout: 60 * 60 * 1000,
    smoke: false,
    compareOnly: false,
};

// Parse explicit options without adding another dependency.
for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") {
        console.log(`Usage: node scripts/benchmark-l2.mjs [options]

  --url <url>       Existing viewer server (default: http://localhost:3000)
  --runs <count>    Measured warm repetitions (default: 3)
  --route <file>    Frozen route JSON (default: performance-benchmarks/l2-ground.route.json)
  --output <dir>    Run artifacts directory (default: performance-benchmarks/runs/<UTC timestamp>)
  --chrome <file>   Chrome executable (or set CHROME_PATH)
  --timeout <secs>  Overall run limit (default: 3600)
  --smoke           Short setup check only; never a comparison baseline
  --compare-only    Update an existing --output report without running Chrome

Uses isolated, headless native Chrome at 1280x720 / DPR 1.
Refuses software-rendered results. Does not start or stop the viewer server.
Full reports compare all statistics with the previous two completed sessions.
Smoke, incomplete, failed, and changed-during-measurement sessions are excluded.`);
        process.exit(0);
    }
    if (argument === "--smoke") { options.smoke = true; continue; }
    if (argument === "--compare-only") { options.compareOnly = true; continue; }
    const key = { "--url": "url", "--runs": "runs", "--route": "route", "--output": "output", "--chrome": "chrome", "--timeout": "timeout" }[argument];
    if (!key || !argumentsList[index + 1] || argumentsList[index + 1].startsWith("--")) {
        throw new Error(`Unknown or incomplete option: ${argument}. Use --help.`);
    }
    const value = argumentsList[++index];
    options[key] = key === "runs" || key === "timeout" ? Number(value) : value;
}
if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 20) {
    throw new Error("--runs must be an integer between 1 and 20.");
}
if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new Error("--timeout must be positive.");
if (argumentsList.includes("--timeout")) options.timeout *= 1000;
if (options.compareOnly && !options.output) throw new Error("--compare-only requires --output <existing session directory>.");
const viewerUrl = new URL(options.url);
if (!["http:", "https:"].includes(viewerUrl.protocol)) throw new Error("--url must use HTTP or HTTPS.");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.resolve(repository, options.output ?? `performance-benchmarks/runs/${timestamp}`);
const routePath = path.resolve(repository, options.route);
const injectionPath = path.join(repository, "scripts", "benchmark-l2-browser.js");
const consoleEvents = [];
const metadata = { startedAt: new Date().toISOString(), url: viewerUrl.href, measuredRuns: options.runs, viewport: { width: 1280, height: 720, dpr: 1 } };
metadata.cachePolicy = "Fresh isolated browser profile; operating-system and GPU-driver caches are not controlled.";
metadata.assetHashScope = "Local checkout files; remote server responses are not attested by these hashes.";
metadata.testMode = options.smoke ? "setup-smoke-only" : "standardized-full-route";
metadata.comparisonBaselineEligible = false;
let browser;
let profile;
let socket;
let send;
let stopping = false;
let codeBefore;
let deadline;
let ownsOutput = false;

// Hash raw bytes, preserving reproducibility across export changes.
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 }).trim();

// Compare whole sessions without changing their recorded measurements.
export function compareBenchmarkSessions(current, history) {
    const notes = [
        "Previous runs mean completed benchmark sessions, not repetitions within one session.",
        "FPS is native rAF cadence, not presented-frame telemetry; a refresh-rate ceiling can hide performance improvements.",
        "FPS throughput change and lower/higher frame, CPU-submit, or GPU time are reported separately.",
        "Heap includes retained benchmark frame logs; heap and texture/geometry counts are not total GPU or browser memory.",
        "Material GPU-resident bytes are estimates. Startup, OS/driver caches, background load, and thermal conditions are not controlled.",
        "Native SSAO/GI settings must match; historical sessions without captured settings are not strict comparison baselines.",
        "Observed deltas for incompatible sessions are descriptive and unadjusted, not export-only speed improvements.",
    ];
    const eligible = ({ report }) => report?.valid === true && report.smokeTest !== true
        && report.metadata?.testMode === "standardized-full-route" && report.metadata.comparisonBaselineEligible === true
        && !report.metadata.error && !report.error && !report.metadata.codeChangedDuringRun && !report.metadata.assetsChangedDuringRun
        && Number.isFinite(Date.parse(report.metadata.finishedAt));
    const signature = (report) => {
        const metadata = report.metadata ?? {};
        const route = metadata.route?.definition;
        const methodology = { ...report.methodology };
        for (const key of ["disjointGpuSamplesDiscarded", "pendingGpuSamplesUnavailable", "memory"]) delete methodology[key];
        return {
            route: route ? {
                format: route.format, version: route.version, levelIndex: route.levelIndex,
                coordinateSystem: route.coordinateSystem, positionSpace: route.positionSpace, floorY: route.floorY, eyeHeightMeters: route.eyeHeightMeters,
                policy: Object.entries(route.policy ?? {}).sort(([left], [right]) => left.localeCompare(right)),
                path: route.path?.map((entry) => ({ position: entry.position, componentId: entry.componentId, roomId: entry.roomId, checkpointId: entry.checkpointId, teleportBefore: entry.teleportBefore })),
                checkpoints: route.checkpoints?.map((entry) => ({ id: entry.id, position: entry.position, roomId: entry.roomId, lookAt: entry.lookAt, panoramaSeconds: entry.panoramaSeconds })),
            } : null,
            viewport: metadata.viewport,
            methodology,
            renderSettings: metadata.renderSettings,
            build: metadata.build,
            gpu: metadata.gpu?.renderer,
            browser: metadata.browser?.version?.Browser,
            injectedScript: metadata.injectedScriptSha256,
            cpu: metadata.host?.cpu,
            platform: metadata.host?.platform,
            architecture: metadata.host?.architecture,
        };
    };
    const numericMetrics = (value, prefix = "", entries = {}) => {
        for (const [key, item] of Object.entries(value ?? {})) {
            const name = prefix ? `${prefix}.${key}` : key;
            if (typeof item === "number" || item === null) entries[name] = Number.isFinite(item) ? item : null;
            else if (item && typeof item === "object" && !Array.isArray(item)) numericMetrics(item, name, entries);
        }
        return entries;
    };
    const metrics = (now, previous, comparable, descriptive = false) => {
        const nowMetrics = numericMetrics(now);
        const previousMetrics = numericMetrics(previous);
        return Object.fromEntries([...new Set([...Object.keys(nowMetrics), ...Object.keys(previousMetrics)])].map((name) => {
            const value = nowMetrics[name] ?? null;
            const before = previousMetrics[name] ?? null;
            const available = comparable && value !== null && before !== null;
            const change = available ? value - before : null;
            const percentage = available && before > 0 ? change / before * 100 : null;
            const fps = name === "averageFps";
            const time = /(?:Ms|Seconds)(?:\.|$)/.test(name) && !name.endsWith(".samples");
            const direction = !available ? "N/A" : change === 0 ? "unchanged"
                : fps ? descriptive ? change > 0 ? "higher observed FPS" : "lower observed FPS"
                    : change > 0 ? "faster FPS throughput" : "slower FPS throughput"
                    : time ? change < 0 ? "lower time" : "higher time" : change < 0 ? "lower" : "higher";
            return [name, { current: value, previous: before, absoluteChange: change, changePercent: percentage,
                performanceImprovementPercent: descriptive || percentage === null ? null : fps ? percentage : time ? -percentage : null,
                direction, unavailableReason: !comparable ? "Incompatible benchmark conditions" : value === null || before === null ? "Missing/non-finite measurement" : before <= 0 ? "No positive percentage baseline" : null }];
        }));
    };
    const currentSignature = signature(current.report);
    const result = {
        currentSession: { directory: current.directory, finishedAt: current.report?.metadata?.finishedAt, summary: current.report?.summary,
            codeCommit: current.report?.metadata?.code?.commit, codeFingerprint: current.report?.metadata?.code?.sha256,
            assetFingerprint: current.report?.metadata?.assetFingerprint, compatibilitySignature: currentSignature },
        status: eligible(current) ? "no-previous-sessions" : "current-session-ineligible",
        notes,
        previousSessions: [],
    };
    if (!eligible(current)) return result;
    const previous = history.filter((entry) => entry.directory !== current.directory && eligible(entry)
        && Date.parse(entry.report.metadata.finishedAt) < Date.parse(current.report.metadata.finishedAt))
        .sort((left, right) => Date.parse(right.report.metadata.finishedAt) - Date.parse(left.report.metadata.finishedAt)).slice(0, 2);
    for (const entry of previous) {
        const previousSignature = signature(entry.report);
        const differences = Object.keys(currentSignature).filter((key) => JSON.stringify(currentSignature[key]) !== JSON.stringify(previousSignature[key]));
        for (const key of ["route", "viewport", "renderSettings", "gpu", "browser", "injectedScript", "cpu", "build"]) {
            if (!currentSignature[key] || !previousSignature[key]) differences.push(`${key}: missing provenance`);
        }
        const comparable = differences.length === 0;
        const warnings = [];
        if (current.report.metadata.code?.sha256 !== entry.report.metadata.code?.sha256) warnings.push("App code changed; expected when evaluating an optimization.");
        if (current.report.metadata.assetFingerprint !== entry.report.metadata.assetFingerprint) warnings.push("Export/material assets changed; inspect visual quality and route validation before attributing speed changes.");
        if (current.report.metadata.route?.sha256 !== entry.report.metadata.route?.sha256) warnings.push("Route file hash changed; only identical recorded paths and policies qualify for timing comparisons.");
        result.previousSessions.push({
            directory: entry.directory, finishedAt: entry.report.metadata.finishedAt,
            codeCommit: entry.report.metadata.code?.commit, codeFingerprint: entry.report.metadata.code?.sha256,
            assetFingerprint: entry.report.metadata.assetFingerprint,
            comparable, differences, warnings, methodology: entry.report.methodology,
            summary: metrics(current.report.summary, entry.report.summary, comparable),
            startup: metrics(current.report.startup, entry.report.startup, comparable),
            streaming: metrics(current.report.finalStreaming, entry.report.finalStreaming, comparable),
            ...(!comparable ? {
                observedDeltaInterpretation: "Descriptive, unadjusted changes only; incompatible conditions prevent attributing changes to the export.",
                observedSummary: metrics(current.report.summary, entry.report.summary, true, true),
                observedStartup: metrics(current.report.startup, entry.report.startup, true, true),
            } : {}),
            repetitions: (current.report.runs ?? []).map((run) => {
                const previousRun = entry.report.runs?.find((item) => item.run === run.run);
                return { run: run.run, available: Boolean(previousRun), metrics: metrics(run, previousRun, comparable && Boolean(previousRun)) };
            }),
            byRoom: (current.report.byRoom ?? []).map((room) => {
                const previousRoom = entry.report.byRoom?.find((item) => item.roomId === room.roomId);
                return { roomId: room.roomId, available: Boolean(previousRoom), metrics: metrics(room, previousRoom, comparable && Boolean(previousRoom)) };
            }),
        });
    }
    if (result.previousSessions.length) result.status = "compared";
    return result;
}

// Update only the current session, leaving historical reports untouched.
export function writeBenchmarkComparison(sessionDirectory, historyDirectory = path.dirname(sessionDirectory)) {
    const directory = path.resolve(sessionDirectory);
    const summaryPath = path.join(directory, "summary.json");
    const resultPath = path.join(directory, "result.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const result = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : null;
    if (result?.runs && summary.runs) {
        summary.runs.forEach((run, index) => {
            const recorded = result.runs.find((entry) => entry.run === run.run) ?? result.runs[index];
            if (typeof recorded?.frames === "number" && run.frames === undefined) run.frames = recorded.frames;
        });
    }
    const history = [];
    const warnings = [];
    for (const entry of fs.readdirSync(historyDirectory, { withFileTypes: true })) {
        const previousDirectory = path.resolve(historyDirectory, entry.name);
        const previousSummary = path.join(previousDirectory, "summary.json");
        if (!entry.isDirectory() || previousDirectory === directory || !fs.existsSync(previousSummary)) continue;
        try { history.push({ directory: previousDirectory, report: JSON.parse(fs.readFileSync(previousSummary, "utf8")) }); }
        catch (error) { warnings.push(`Skipped unreadable historical report ${previousSummary}: ${error.message}`); }
    }
    const comparison = compareBenchmarkSessions({ directory, report: summary }, history);
    comparison.generatedAt = new Date().toISOString();
    comparison.historyWarnings = warnings;
    summary.comparison = comparison;
    if (result) result.comparison = comparison;
    fs.writeFileSync(path.join(directory, "comparison.json"), JSON.stringify(comparison, null, 2));
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    if (result) fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`Historical comparison: ${comparison.previousSessions.length ? `${comparison.previousSessions.length} previous sessions` : "N/A — no eligible previous full sessions"}.`);
    for (const previous of comparison.previousSessions) {
        const fps = previous.summary.averageFps;
        const percent = fps?.performanceImprovementPercent;
        console.log(`  ${path.basename(previous.directory)}: ${previous.comparable && percent !== null ? percent === 0 ? "unchanged FPS throughput" : `${Math.abs(percent).toFixed(2)}% ${percent < 0 ? "slower" : "faster"} FPS throughput` : `N/A (${previous.differences.join(", ") || "missing FPS baseline"})`}`);
    }
    return comparison;
}

// Include dirty and untracked sources, excluding generated reports.
const fingerprintCode = () => {
    const candidates = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0");
    const files = [...new Set(candidates)].filter((file) => file && !file.startsWith("performance-benchmarks/runs/")
        && !file.startsWith("public/") && !file.startsWith("build/") && !file.startsWith("node_modules/")
        && !path.resolve(repository, file).startsWith(output + path.sep)).sort();
    const entries = files.filter((file) => fs.existsSync(path.join(repository, file)) && fs.statSync(path.join(repository, file)).isFile())
        .map((file) => ({ file: file.replaceAll("\\", "/"), sha256: sha256(fs.readFileSync(path.join(repository, file))) }));
    return { commit: git("rev-parse", "HEAD"), status: git("status", "--short", "--untracked-files=all"), sha256: sha256(JSON.stringify(entries)), files: entries };
};

// Resolve exported packs relative to the companion manifest.
const fingerprintAssets = (manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const files = new Set([manifestPath, path.resolve(path.dirname(manifestPath), manifest.asset?.glb ?? "housemaker_export.glb")]);
    const pvsPath = path.resolve(path.dirname(manifestPath), (manifest.asset?.glb ?? "housemaker_export.glb").replace(/\.glb$/i, ".pvs.mjs"));
    if (fs.existsSync(pvsPath)) files.add(pvsPath);
    for (const file of ["public/basis/basis_transcoder.js", "public/basis/basis_transcoder.wasm", "public/textures/kloofendal_48d_partly_cloudy_puresky_1k.hdr"]) {
        if (fs.existsSync(path.join(repository, file))) files.add(path.join(repository, file));
    }
    for (const material of manifest.roomAssets?.materials ?? []) {
        for (const variant of Object.values(material.variants ?? {})) {
            if (typeof variant?.file === "string") files.add(path.resolve(path.dirname(manifestPath), variant.file));
        }
    }
    return [...files].sort().map((file) => ({
        file: path.relative(repository, file).replaceAll("\\", "/"),
        bytes: fs.existsSync(file) ? fs.statSync(file).size : null,
        sha256: fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null,
    }));
};

// Only terminate the browser created by this invocation.
const cleanup = async () => {
    if (stopping) return;
    stopping = true;
    if (send && socket?.readyState === WebSocket.OPEN) {
        await Promise.race([send("Browser.close").catch(() => {}), delay(2000)]);
    }
    socket?.close();
    if (browser && browser.exitCode === null && browser.signalCode === null) {
        await Promise.race([new Promise((resolve) => browser.once("exit", resolve)), delay(3000)]);
        if (browser.exitCode === null && browser.signalCode === null) {
            if (process.platform === "win32") {
                try { execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {}
            } else browser.kill("SIGTERM");
        }
    }
    if (profile) {
        const resolved = path.resolve(profile);
        const temporaryRoot = path.resolve(os.tmpdir());
        if (resolved.startsWith(temporaryRoot + path.sep) && path.basename(resolved).startsWith("housemaker-l2-benchmark-")) {
            try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (error) { metadata.profileCleanupWarning = error.message; }
        }
    }
};

// Surface renderer exceptions alongside the measured artifacts.
const main = async () => {
    const routeBytes = fs.readFileSync(routePath);
    const route = JSON.parse(routeBytes);
    const injection = fs.readFileSync(injectionPath, "utf8");
    fs.mkdirSync(output, { recursive: true });
    if (fs.existsSync(path.join(output, "summary.json")) || fs.existsSync(path.join(output, "metadata.json"))) {
        throw new Error("Output already contains a benchmark. Choose another --output directory.");
    }
    ownsOutput = true;
    const manifestPath = path.resolve(repository, route.source?.manifest ?? "public/models/housemaker_export.json");
    const glbPath = path.resolve(repository, route.source?.glb ?? "public/models/housemaker_export.glb");
    for (const [file, expected, name] of [[manifestPath, route.source?.manifestSha256, "manifest"], [glbPath, route.source?.glbSha256, "GLB"]]) {
        if (typeof expected !== "string" || !/^[a-f\d]{64}$/i.test(expected)) throw new Error(`Route is missing a valid ${name} SHA-256.`);
        const actual = sha256(fs.readFileSync(file));
        if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`Frozen route ${name} hash does not match the current export. Revalidate the route before benchmarking.`);
    }
    codeBefore = fingerprintCode();
    metadata.code = codeBefore;
    metadata.route = { file: path.relative(repository, routePath).replaceAll("\\", "/"), sha256: sha256(routeBytes), definition: route };
    metadata.assets = fingerprintAssets(manifestPath);
    metadata.assetFingerprint = sha256(JSON.stringify(metadata.assets));
    metadata.injectedScriptSha256 = sha256(injection);
    metadata.runnerSha256 = sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
    metadata.host = { platform: process.platform, architecture: process.arch, release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, physicalMemoryBytes: os.totalmem(), node: process.version };
    fs.writeFileSync(path.join(output, "metadata.json"), JSON.stringify(metadata, null, 2));
    const response = await fetch(viewerUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Viewer server returned HTTP ${response.status}. Start it separately.`);
    const html = await response.text();
    metadata.build = /static\/js\/bundle\.js|webpack-dev-server|react-refresh/i.test(html) ? "development" : "production-or-unknown";
    const chrome = options.chrome ?? [
        process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
        process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
        process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome",
        "/usr/bin/chromium", "/usr/bin/chromium-browser",
    ].find((file) => file && fs.existsSync(file));
    if (!chrome || !fs.existsSync(chrome)) throw new Error("Chrome not found. Set CHROME_PATH or pass --chrome.");
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "housemaker-l2-benchmark-"));
    const port = await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => { const assigned = server.address().port; server.close(() => resolve(assigned)); });
    });
    const flags = ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=1280,720", "--force-device-scale-factor=1", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank"];
    if (process.platform === "win32") flags.unshift("--use-angle=d3d11");
    metadata.browser = { executable: chrome, flags: flags.map((flag) => flag.startsWith("--user-data-dir=") ? "--user-data-dir=<isolated-temporary-profile>" : flag) };
    browser = spawn(chrome, flags, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    browser.on("error", (error) => { metadata.browserLaunchError = error.message; });
    const chromeLog = [];
    browser.stderr.on("data", (data) => { if (chromeLog.length < 200) chromeLog.push(String(data)); });
    const endpoint = `http://127.0.0.1:${port}`;
    let version;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (metadata.browserLaunchError) throw new Error(metadata.browserLaunchError);
        if (browser.exitCode !== null) throw new Error(`Chrome exited before CDP was ready: ${chromeLog.join("")}`);
        try { version = await (await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) })).json(); break; } catch {}
        await delay(100);
    }
    if (!version) throw new Error("Chrome debugging endpoint did not become ready.");
    metadata.browser.version = version;
    const page = await (await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" })).json();
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    let sequence = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    socket.on("close", () => { for (const task of pending.values()) task.reject(new Error("Chrome debugging connection closed.")); pending.clear(); });
    socket.on("message", (raw) => {
        const message = JSON.parse(raw);
        if (message.id) {
            const task = pending.get(message.id);
            if (task) { pending.delete(message.id); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
        } else if (["Runtime.exceptionThrown", "Runtime.consoleAPICalled", "Log.entryAdded", "Inspector.targetCrashed"].includes(message.method)) {
            if (consoleEvents.length < 5000) consoleEvents.push(message);
        }
    });
    const evaluate = async (expression, timeout = 180000) => {
        const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, timeout });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__HOUSEMAKER_BENCHMARK_CONFIG__ = ${JSON.stringify({ route, runs: options.runs, viewport: metadata.viewport, smoke: options.smoke })};\n${injection}` });
    await send("Page.navigate", { url: viewerUrl.href });
    await send("Page.bringToFront");
    let ready;
    let previousPhase;
    const initializationLimit = Date.now() + 180000;
    while (Date.now() < initializationLimit) {
        const status = await evaluate("window.__houseMakerBenchmark?.getStatus() ?? null");
        if (status?.error) throw new Error(typeof status.error === "string" ? status.error : JSON.stringify(status.error));
        if (status?.phase && status.phase !== previousPhase) { console.log(`Phase: ${status.phase}`); previousPhase = status.phase; }
        if (status?.ready) { ready = status; break; }
        await delay(250);
    }
    if (!ready) throw new Error("Viewer benchmark instrumentation was not ready within 180 seconds.");
    metadata.sceneReady = ready;
    // Capture applied native settings, not only UI defaults.
    metadata.renderSettings = await evaluate(`(() => {
        const chunkName = Object.keys(window).find((key) => key.startsWith("webpackChunk") && Array.isArray(window[key]));
        let require;
        window[chunkName].push([["housemaker-benchmark-settings-" + Date.now()], {}, (runtime) => { require = runtime; }]);
        const moduleId = Object.keys(require.m).find((id) => id.endsWith("/@react-three/fiber/dist/react-three-fiber.esm.js"));
        const roots = require(moduleId)._roots;
        const pending = [...roots.values()].map((root) => root.fiber.current);
        let container;
        while (pending.length) {
            const fiber = pending.pop();
            if (!fiber) continue;
            const type = fiber.type?.type ?? fiber.type;
            if (type?.name === "SceneContainer" || type?.displayName === "SceneContainer") { container = fiber; break; }
            pending.push(fiber.child, fiber.sibling);
        }
        let hook = container?.memoizedState;
        let passes;
        while (hook) {
            if (hook.memoizedState?.current?.ssao?.ssaoMaterial) { passes = hook.memoizedState.current; break; }
            hook = hook.next;
        }
        if (!passes) throw new Error("Cannot capture native benchmark SSAO/GI settings.");
        const settings = {
            ssao: {
                enabled: passes.ssaoPass.enabled,
                strength: passes.ssao.intensity,
                radius: passes.ssao.ssaoMaterial.radius,
                bias: passes.ssao.ssaoMaterial.bias,
                samples: passes.ssao.ssaoMaterial.samples,
                resolution: passes.ssao.resolution.scale,
            },
            gi: { enabled: passes.giPass.enabled, strength: passes.giPass.effects[0]?.uniforms.get("giStrength")?.value },
        };
        if (![settings.ssao.strength, settings.ssao.radius, settings.ssao.bias, settings.ssao.samples,
            settings.ssao.resolution, settings.gi.strength].every(Number.isFinite)) {
            throw new Error("Native benchmark SSAO/GI settings contain non-finite values.");
        }
        return settings;
    })()`);
    console.log(`Native render settings: ${JSON.stringify(metadata.renderSettings)}`);
    const gpu = await evaluate(`(() => { const canvases = [...document.querySelectorAll('canvas')]; for (const canvas of canvases) { const gl = canvas.getContext('webgl2'); if (!gl) continue; const extension = gl.getExtension('WEBGL_debug_renderer_info'); const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'); return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), gpuTimerQueryAvailable: !!timer }; } return null; })()`);
    metadata.gpu = gpu;
    if (!gpu?.renderer || /swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp|^WebKit WebGL$|^ANGLE$/i.test(gpu.renderer)) {
        throw new Error(`A native hardware GPU is required; received ${gpu?.renderer ?? "no renderer"}.`);
    }
    console.log(`GPU: ${gpu.renderer}`);
    console.log(`Build: ${metadata.build}. Measured route repetitions: ${options.runs}.`);
    if (options.smoke) console.log("SMOKE TEST ONLY: shortened playback is not a comparison baseline.");
    let lastProgressAt = 0;
    const progressTimer = setInterval(async () => {
        try {
            const status = await evaluate("window.__houseMakerBenchmark.getStatus()", 10000);
            if (status?.phase !== previousPhase || Date.now() - lastProgressAt >= 30000) {
                const progress = Number.isFinite(status?.elapsedSeconds) ? ` (${status.elapsedSeconds.toFixed(0)}/${status.timelineSeconds.toFixed(0)} s)` : "";
                console.log(`Phase: ${status?.phase}${progress}`);
                previousPhase = status?.phase;
                lastProgressAt = Date.now();
            }
        } catch {}
    }, 5000);
    deadline = setTimeout(() => { send("Runtime.terminateExecution").catch(() => {}); }, options.timeout);
    let result;
    try { result = await evaluate("window.__houseMakerBenchmark.run()", options.timeout); }
    finally { clearInterval(progressTimer); clearTimeout(deadline); }
    if (!result || typeof result !== "object") throw new Error("Browser benchmark did not return a result.");
    const codeAfter = fingerprintCode();
    metadata.codeFingerprintAfter = codeAfter.sha256;
    metadata.codeChangedDuringRun = codeAfter.sha256 !== codeBefore.sha256 || codeAfter.commit !== codeBefore.commit;
    metadata.assetsAfter = fingerprintAssets(manifestPath);
    metadata.assetFingerprintAfter = sha256(JSON.stringify(metadata.assetsAfter));
    metadata.assetsChangedDuringRun = metadata.assetFingerprintAfter !== metadata.assetFingerprint;
    metadata.comparisonBaselineEligible = !options.smoke && !metadata.codeChangedDuringRun && !metadata.assetsChangedDuringRun && result.valid !== false && !result.error;
    metadata.finishedAt = new Date().toISOString();
    const frames = result.frames ?? result.runs?.flatMap((run, index) => (run.frames ?? []).map((frame) => ({ run: index + 1, ...frame }))) ?? [];
    const columns = [...new Set(frames.flatMap((frame) => Object.keys(frame)))];
    const csvValue = (value) => JSON.stringify(value !== null && typeof value === "object" ? JSON.stringify(value) : value ?? "");
    const csv = [columns.map(csvValue).join(","), ...frames.map((frame) => columns.map((column) => csvValue(frame[column])).join(","))].join("\n") + "\n";
    fs.writeFileSync(path.join(output, "frames.csv"), csv);
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ metadata, ...result }, null, 2));
    const summary = { ...result };
    delete summary.frames;
    if (summary.runs) summary.runs = summary.runs.map((run) => {
        if (!Array.isArray(run.frames)) return run;
        const { frames: ignored, ...statistics } = run;
        return statistics;
    });
    fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify({ metadata, ...summary }, null, 2));
    writeBenchmarkComparison(output);
    if (metadata.codeChangedDuringRun) console.warn("WARNING: Source files changed during measurement; do not use this as a comparison baseline.");
    if (metadata.assetsChangedDuringRun) console.warn("WARNING: Export assets changed during measurement; do not use this as a comparison baseline.");
    console.log(`Saved ${frames.length} per-frame records to ${output}`);
    if (result.valid === false || result.error || metadata.assetsChangedDuringRun || metadata.codeChangedDuringRun) process.exitCode = 1;
};

// Always save errors and release the isolated Chrome instance.
if (isMain) {
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
        metadata.interrupted = signal;
        cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
    });

    try {
        if (options.compareOnly) writeBenchmarkComparison(output);
        else await main();
    } catch (error) {
        process.exitCode = 1;
        metadata.error = error.stack ?? String(error);
        console.error(error.message);
        if (ownsOutput) fs.writeFileSync(path.join(output, "failure.json"), JSON.stringify({ metadata, consoleEvents }, null, 2));
    } finally {
        clearTimeout(deadline);
        await cleanup();
        if (ownsOutput) {
            fs.writeFileSync(path.join(output, "metadata.json"), JSON.stringify(metadata, null, 2));
            fs.writeFileSync(path.join(output, "console.json"), JSON.stringify(consoleEvents, null, 2));
        }
    }
}
