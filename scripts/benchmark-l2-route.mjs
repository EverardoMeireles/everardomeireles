import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as THREE from "three";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { Capsule } from "three/examples/jsm/math/Capsule.js";

// Read the exact exported geometry without loading rendering resources.
const workspace = process.cwd();
const manifestPath = path.join(workspace, "public/models/housemaker_export.json");
const modelPath = path.join(workspace, "public/models/housemaker_export.glb");
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const modelBytes = fs.readFileSync(modelPath);
const jsonLength = modelBytes.readUInt32LE(12);
const gltf = JSON.parse(modelBytes.toString("utf8", 20, 20 + jsonLength));
const binary = modelBytes.subarray(28 + jsonLength);
const rooms = manifest.roomAssets.rooms.filter((room) => room.levelIndex === 2 && !room.fallback);
const floorY = manifest.firstPersonCamera.floorPosition[1];
const eyeHeight = manifest.firstPersonCamera.eyeHeightMeters;
const radius = 0.35;
const capsuleHeight = Math.max(eyeHeight + 0.35, radius * 2 + 0.4);
const gridSize = 0.2;
const sweepStep = 0.05;
const bounds = {
    min: [Math.min(...rooms.map((room) => room.bounds.min[0])), floorY, Math.min(...rooms.map((room) => room.bounds.min[2]))],
    max: [Math.max(...rooms.map((room) => room.bounds.max[0])), floorY, Math.max(...rooms.map((room) => room.bounds.max[2]))],
};

// Decode vertex and index attributes, including interleaved buffers.
function readAccessor(index) {
    const accessor = gltf.accessors[index];
    const view = gltf.bufferViews[accessor.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const component = { 5121: [1, "getUint8"], 5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"] }[accessor.componentType];
    if (!width || !component || accessor.sparse) throw new Error("Unsupported geometry accessor; inspect the new export before benchmarking.");
    const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? width * component[0];
    return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: width }, (unused, column) => (
        data[component[1]](start + row * stride + column * component[0], true)
    )));
}

// Preserve authored hierarchy transforms in both exported scenes.
const matrices = new Map();
function recordMatrices(nodeIndex, parentMatrix) {
    const node = gltf.nodes[nodeIndex];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
    const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, local);
    matrices.set(nodeIndex, world);
    (node.children ?? []).forEach((child) => recordMatrices(child, world));
}
gltf.scenes.forEach((scene) => scene.nodes.forEach((node) => recordMatrices(node, new THREE.Matrix4())));

// Collect exact collision triangles for the ground-level capsule.
const triangles = [];
const floorTriangles = [];
let completeTriangleCount = 0;
function collectNode(nodeIndex, worldOverride, reflected = false) {
    const node = gltf.nodes[nodeIndex];
    const world = worldOverride ?? matrices.get(nodeIndex);
    if (node.mesh !== undefined) {
        for (const primitive of gltf.meshes[node.mesh].primitives) {
            if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error("Only triangle geometry is supported.");
            const positions = readAccessor(primitive.attributes.POSITION);
            const indices = primitive.indices !== undefined ? readAccessor(primitive.indices).flat() : positions.map((unused, index) => index);
            for (let index = 0; index < indices.length; index += 3) {
                const vertices = indices.slice(index, index + 3).map((vertex) => new THREE.Vector3().fromArray(positions[vertex]).applyMatrix4(world));
                if (reflected) [vertices[1], vertices[2]] = [vertices[2], vertices[1]];
                completeTriangleCount += 1;
                if (vertices.every((vertex) => Math.abs(vertex.y - floorY) < 0.002)) floorTriangles.push(new THREE.Triangle(...vertices));
                if (Math.max(...vertices.map((vertex) => vertex.y)) < floorY + 0.003
                    || Math.min(...vertices.map((vertex) => vertex.y)) > floorY + capsuleHeight + 0.01) continue;
                triangles.push(new THREE.Triangle(...vertices));
            }
        }
    }
    for (const child of node.children ?? []) {
        const childWorld = worldOverride ? world.clone().multiply(matrices.get(nodeIndex).clone().invert()).multiply(matrices.get(child)) : undefined;
        collectNode(child, childWorld, reflected);
    }
}
gltf.scenes[gltf.scene ?? 0].nodes.forEach((node) => collectNode(node));

// Include reconstructed instanced halves using loader-equivalent source transforms.
for (const group of manifest.instanceGroups ?? []) {
    for (const sourceName of group.sourceNodeNames ?? [group.sourceNodeName]) {
        const sourceIndex = gltf.nodes.findIndex((node) => node.name === sourceName || node.extras?.housemaker_instance_source_name === sourceName);
        if (sourceIndex < 0) throw new Error(`Missing instance source ${sourceName}.`);
        const sourceMatrix = matrices.get(sourceIndex);
        for (const instance of group.instances) {
            const placement = new THREE.Matrix4().fromArray(instance.worldMatrix);
            collectNode(sourceIndex, placement);
            if (group.halfMesh) {
                const descendants = [sourceIndex];
                while (descendants.length > 0) {
                    const index = descendants.pop();
                    const node = gltf.nodes[index];
                    descendants.push(...node.children ?? []);
                    const plane = node.extras?.halfMesh?.mirrorPlane;
                    if (node.mesh === undefined || !plane) continue;
                    const normal = new THREE.Vector3().fromArray(plane.normal).normalize();
                    const point = new THREE.Vector3().fromArray(plane.point);
                    const { x, y, z } = normal;
                    const distance = 2 * normal.dot(point);
                    const reflection = new THREE.Matrix4().set(
                        1 - 2 * x * x, -2 * x * y, -2 * x * z, distance * x,
                        -2 * y * x, 1 - 2 * y * y, -2 * y * z, distance * y,
                        -2 * z * x, -2 * z * y, 1 - 2 * z * z, distance * z,
                        0, 0, 0, 1,
                    );
                    collectNode(index, placement.clone().multiply(reflection).multiply(sourceMatrix.clone().invert()).multiply(matrices.get(index)), true);
                }
            }
        }
    }
}
if ((manifest.doorBodyReconstructions ?? []).length > 0) throw new Error("Door reconstruction changed; verify runtime geometry before regenerating this route.");
const mainIndices = new Set();
const pendingMain = [...gltf.scenes[gltf.scene ?? 0].nodes];
while (pendingMain.length > 0) {
    const index = pendingMain.pop();
    mainIndices.add(index);
    pendingMain.push(...gltf.nodes[index].children ?? []);
}
if ([...mainIndices].some((index) => gltf.nodes[index].extras?.halfMesh)) throw new Error("Main-scene half meshes changed; verify runtime geometry before regenerating this route.");

// Bin collision triangles for precise local capsule queries.
const bins = new Map();
const binSize = 1;
for (const triangle of triangles) {
    const minX = Math.floor(Math.min(triangle.a.x, triangle.b.x, triangle.c.x) / binSize);
    const maxX = Math.floor(Math.max(triangle.a.x, triangle.b.x, triangle.c.x) / binSize);
    const minZ = Math.floor(Math.min(triangle.a.z, triangle.b.z, triangle.c.z) / binSize);
    const maxZ = Math.floor(Math.max(triangle.a.z, triangle.b.z, triangle.c.z) / binSize);
    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            const key = `${x},${z}`;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(triangle);
        }
    }
}
const collision = new Octree();
const capsule = new Capsule(new THREE.Vector3(), new THREE.Vector3(), radius);
const floorPoint = new THREE.Vector3();
function hasFloor(x, z) {
    floorPoint.set(x, floorY, z);
    return floorTriangles.some((triangle) => triangle.containsPoint(floorPoint));
}
function isClear(x, z) {
    capsule.start.set(x, floorY + radius + 0.003, z);
    capsule.end.set(x, floorY + capsuleHeight - radius + 0.003, z);
    const candidates = new Set();
    for (let bx = Math.floor((x - radius) / binSize); bx <= Math.floor((x + radius) / binSize); bx += 1) {
        for (let bz = Math.floor((z - radius) / binSize); bz <= Math.floor((z + radius) / binSize); bz += 1) {
            for (const triangle of bins.get(`${bx},${bz}`) ?? []) candidates.add(triangle);
        }
    }
    for (const triangle of candidates) {
        const hit = collision.triangleCapsuleIntersect(capsule, triangle);
        if (hit && hit.depth > 0.00001) return false;
    }
    return true;
}

// Restrict traversal to exported floor polygons and their holes.
function polygonContains(polygon, x, z) {
    let inside = false;
    for (let first = 0, last = polygon.length - 1; first < polygon.length; last = first++) {
        const a = polygon[first];
        const b = polygon[last];
        if ((a[2] > z) !== (b[2] > z) && x < (b[0] - a[0]) * (z - a[2]) / (b[2] - a[2]) + a[0]) inside = !inside;
    }
    return inside;
}
function roomAt(x, z) {
    return rooms.find((room) => polygonContains(room.floorOutline, x, z)
        && !(room.floorHoles ?? []).some((hole) => polygonContains(hole, x, z)));
}
function segmentClear(first, second) {
    const distance = Math.hypot(second[0] - first[0], second[2] - first[2]);
    const samples = Math.max(1, Math.ceil(distance / sweepStep));
    for (let index = 0; index <= samples; index += 1) {
        const ratio = index / samples;
        const x = first[0] + (second[0] - first[0]) * ratio;
        const z = first[2] + (second[2] - first[2]) * ratio;
        if ((!roomAt(x, z) && !hasFloor(x, z)) || !isClear(x, z)) return false;
    }
    return true;
}

// Sample walkability and connect only collision-free neighboring cells.
const origin = [Math.floor(bounds.min[0] / gridSize) * gridSize, Math.floor(bounds.min[2] / gridSize) * gridSize];
const width = Math.ceil((bounds.max[0] - origin[0]) / gridSize) + 1;
const depth = Math.ceil((bounds.max[2] - origin[1]) / gridSize) + 1;
const cells = new Map();
for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
        const position = [origin[0] + x * gridSize, floorY, origin[1] + z * gridSize];
        const room = roomAt(position[0], position[2]);
        if ((!room && !hasFloor(position[0], position[2])) || !isClear(position[0], position[2])) continue;
        const id = z * width + x;
        cells.set(id, { id, x, z, position, roomId: room?.id ?? null, neighbors: [] });
    }
}
for (const cell of cells.values()) {
    for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const neighbor = cells.get((cell.z + dz) * width + cell.x + dx);
        if (!neighbor || !segmentClear(cell.position, neighbor.position)) continue;
        cell.neighbors.push(neighbor.id);
        neighbor.neighbors.push(cell.id);
    }
}
const startPosition = manifest.firstPersonCamera.floorPosition;
const start = [...cells.values()].filter((cell) => segmentClear(startPosition, cell.position)).sort((a, b) => (
    Math.hypot(a.position[0] - startPosition[0], a.position[2] - startPosition[2])
    - Math.hypot(b.position[0] - startPosition[0], b.position[2] - startPosition[2])
))[0];
if (!start) throw new Error("The exported camera cannot reach a clear floor cell.");
const reachable = new Set([start.id]);
const queue = [start.id];
for (let index = 0; index < queue.length; index += 1) {
    for (const neighbor of cells.get(queue[index]).neighbors) {
        if (reachable.has(neighbor)) continue;
        reachable.add(neighbor);
        queue.push(neighbor);
    }
}
const reachableCells = [...reachable].map((id) => cells.get(id));

// Separate disconnected walkable regions instead of crossing solid walls.
const components = [];
const assigned = new Set();
for (const first of [start, ...cells.values()]) {
    if (assigned.has(first.id)) continue;
    const ids = [first.id];
    assigned.add(first.id);
    for (let index = 0; index < ids.length; index += 1) {
        for (const neighbor of cells.get(ids[index]).neighbors) {
            if (assigned.has(neighbor)) continue;
            assigned.add(neighbor);
            ids.push(neighbor);
        }
    }
    components.push({ ids, roomIds: [...new Set(ids.map((id) => cells.get(id).roomId).filter(Boolean))] });
}
components.sort((first, second) => (first.ids.includes(start.id) ? -1 : second.ids.includes(start.id) ? 1 : second.ids.length - first.ids.length));

// Find reproducible graph distances and predecessor paths.
function distancesFrom(sources, allowed) {
    const distances = new Map(sources.map((id) => [id, 0]));
    const previous = new Map();
    const heap = sources.map((id) => [0, id]);
    while (heap.length > 0) {
        const [distance, id] = heap[0];
        const last = heap.pop();
        if (heap.length > 0) {
            heap[0] = last;
            let index = 0;
            while (true) {
                const left = index * 2 + 1;
                const right = left + 1;
                let smallest = index;
                if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
                if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
                if (smallest === index) break;
                [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
                index = smallest;
            }
        }
        if (distance !== distances.get(id)) continue;
        const cell = cells.get(id);
        for (const neighborId of cell.neighbors) {
            if (!allowed.has(neighborId)) continue;
            const neighbor = cells.get(neighborId);
            const candidate = distance + Math.hypot(neighbor.position[0] - cell.position[0], neighbor.position[2] - cell.position[2]);
            if (candidate >= (distances.get(neighborId) ?? Infinity)) continue;
            distances.set(neighborId, candidate);
            previous.set(neighborId, id);
            heap.push([candidate, neighborId]);
            let index = heap.length - 1;
            while (index > 0) {
                const parent = Math.floor((index - 1) / 2);
                if (heap[parent][0] <= heap[index][0]) break;
                [heap[parent], heap[index]] = [heap[index], heap[parent]];
                index = parent;
            }
        }
    }
    return { distances, previous };
}

// Prefer clear room interiors, avoiding arbitrary centroid placement.
const boundary = [...cells.values()].filter((cell) => cell.neighbors.length < 8).map((cell) => cell.id);
const clearance = distancesFrom(boundary, new Set(cells.keys())).distances;
const included = components.filter((component) => component.roomIds.length > 0 && component.ids.length * gridSize ** 2 >= 0.96);
const excluded = components.filter((component) => !included.includes(component));
const checkpoints = [];
const routeComponents = [];
const routePath = [];
const principalRooms = new Set();
let totalDistance = 0;
let validationSamples = 0;
let worstCoverage = 0;
for (const [componentIndex, component] of included.entries()) {
    const componentId = `l2-component-${String(componentIndex + 1).padStart(2, "0")}`;
    const allowed = new Set(component.ids);
    const targets = [];
    for (const roomId of component.roomIds) {
        const room = rooms.find((entry) => entry.id === roomId);
        const center = [(room.bounds.min[0] + room.bounds.max[0]) / 2, (room.bounds.min[2] + room.bounds.max[2]) / 2];
        const candidates = component.ids.map((id) => cells.get(id)).filter((cell) => cell.roomId === roomId);
        candidates.sort((first, second) => (clearance.get(second.id) - clearance.get(first.id)
            || Math.hypot(first.position[0] - center[0], first.position[2] - center[1]) - Math.hypot(second.position[0] - center[0], second.position[2] - center[1])
            || first.id - second.id));
        const principal = !principalRooms.has(roomId);
        principalRooms.add(roomId);
        const cell = componentIndex === 0 && roomId === start.roomId ? start : candidates[0];
        targets.push({ cellId: cell.id, roomId, panoramaSeconds: principal ? 4 : 0, kind: principal ? "room" : "disconnected-pocket" });
    }
    let coverage = distancesFrom(targets.map((target) => target.cellId), allowed).distances;
    while (Math.max(...coverage.values()) > 4) {
        const farthest = component.ids.reduce((best, id) => coverage.get(id) > coverage.get(best) ? id : best, component.ids[0]);
        targets.push({ cellId: farthest, roomId: cells.get(farthest).roomId, panoramaSeconds: 0, kind: "coverage" });
        coverage = distancesFrom(targets.map((target) => target.cellId), allowed).distances;
    }
    let current = componentIndex === 0 ? start.id : targets[0].cellId;
    const visitedPath = [current];
    const chronological = [];
    const unvisited = [...targets];
    while (unvisited.length > 0) {
        const search = distancesFrom([current], allowed);
        unvisited.sort((first, second) => search.distances.get(first.cellId) - search.distances.get(second.cellId) || first.cellId - second.cellId);
        const target = unvisited.shift();
        const connection = [target.cellId];
        while (connection[connection.length - 1] !== current) connection.push(search.previous.get(connection[connection.length - 1]));
        connection.reverse();
        for (const id of connection.slice(1)) visitedPath.push(id);
        chronological.push({ target, connection });
        current = target.cellId;
    }
    const routeStartIndex = routePath.length;
    routePath.push({ position: componentIndex === 0 ? startPosition : cells.get(chronological[0].target.cellId).position, componentId, roomId: cells.get(visitedPath[0]).roomId, teleportBefore: componentIndex > 0 });
    for (const { target, connection } of chronological) {
        const checkpointId = `l2-checkpoint-${String(checkpoints.length + 1).padStart(2, "0")}`;
        const position = cells.get(target.cellId).position;
        checkpoints.push({ id: checkpointId, componentId, roomId: target.roomId, name: rooms.find((room) => room.id === target.roomId)?.name ?? "Doorway threshold", position, lookAt: [position[0] + 1, floorY + eyeHeight, position[2]], panoramaSeconds: target.panoramaSeconds, kind: target.kind });
        const simplified = [cells.get(connection[0]).position];
        let anchor = 0;
        while (anchor < connection.length - 1) {
            let next = anchor + 1;
            while (next + 1 < connection.length && segmentClear(cells.get(connection[anchor]).position, cells.get(connection[next + 1]).position)) next += 1;
            simplified.push(cells.get(connection[next]).position);
            anchor = next;
        }
        for (const nextPosition of simplified) {
            const previousPosition = routePath[routePath.length - 1].position;
            const distance = Math.hypot(nextPosition[0] - previousPosition[0], nextPosition[2] - previousPosition[2]);
            if (distance < 0.00001) continue;
            if (!segmentClear(previousPosition, nextPosition)) throw new Error(`Unsafe route segment in ${componentId}.`);
            validationSamples += Math.ceil(distance / sweepStep) + 1;
            totalDistance += distance;
            routePath.push({ position: nextPosition, componentId, roomId: roomAt(nextPosition[0], nextPosition[2])?.id ?? null });
        }
        routePath[routePath.length - 1].checkpointId = checkpointId;
    }
    const actualTraceCells = new Set();
    const componentPath = routePath.slice(routeStartIndex);
    for (let index = 0; index < componentPath.length; index += 1) {
        const first = componentPath[Math.max(0, index - 1)].position;
        const second = componentPath[index].position;
        const samples = Math.max(1, Math.ceil(Math.hypot(second[0] - first[0], second[2] - first[2]) / sweepStep));
        for (let sample = 0; sample <= samples; sample += 1) {
            const x = Math.round((first[0] + (second[0] - first[0]) * sample / samples - origin[0]) / gridSize);
            const z = Math.round((first[2] + (second[2] - first[2]) * sample / samples - origin[1]) / gridSize);
            const id = z * width + x;
            if (allowed.has(id)) actualTraceCells.add(id);
        }
    }
    const routeCoverage = distancesFrom([...actualTraceCells], allowed).distances;
    const maxCoverage = Math.max(...routeCoverage.values());
    worstCoverage = Math.max(worstCoverage, maxCoverage);
    routeComponents.push({ id: componentId, startsAtAuthoredCamera: componentIndex === 0, teleportBefore: componentIndex > 0, sampledAreaSquareMeters: component.ids.length * gridSize ** 2, roomIds: component.roomIds, pathStartIndex: routeStartIndex, pathEndIndex: routePath.length - 1, maximumGraphDistanceToRouteMeters: maxCoverage });
}

// Save reproducible route inputs and honest coverage limitations.
const route = {
    format: "housemaker-standard-benchmark-route", version: 1, id: "l2-ground-v1", levelIndex: 2,
    coordinateSystem: "gltf-y-up", positionSpace: "floor", floorY, eyeHeightMeters: eyeHeight,
    source: { manifest: "public/models/housemaker_export.json", glb: "public/models/housemaker_export.glb", manifestSha256: crypto.createHash("sha256").update(manifestBytes).digest("hex"), glbSha256: crypto.createHash("sha256").update(modelBytes).digest("hex") },
    policy: { speedMetersPerSecond: 1.5, panoramaSecondsPerRoom: 4, gridSizeMeters: gridSize, validationSweepStepMeters: sweepStep, capsuleRadiusMeters: radius, capsuleHeightMeters: capsuleHeight, maximumCoverageDistanceMeters: 4, interComponentRelocation: "teleport; exclude relocation and stabilization frames from timing" },
    summary: { exportedRoomCount: rooms.length, benchmarkedRoomCount: principalRooms.size, componentCount: routeComponents.length, checkpointCount: checkpoints.length, pathDistanceMeters: totalDistance, estimatedTimedDurationSeconds: totalDistance / 1.5 + rooms.length * 4, walkableSampleCount: cells.size, benchmarkedSampleCount: included.reduce((sum, component) => sum + component.ids.length, 0), excludedSampleCount: excluded.reduce((sum, component) => sum + component.ids.length, 0), exactTriangleCount: completeTriangleCount, capsuleRelevantTriangleCount: triangles.length, validatedSegmentSampleCount: validationSamples, maximumGraphDistanceToRouteMeters: worstCoverage },
    limitations: ["The route measures deterministic camera traversal, not first-person controller physics.", "Seven exported rooms are disconnected from the authored start at this capsule size; independent subroutes do not imply a walkable connection.", "Unassigned disconnected floor slivers and isolated pockets smaller than 0.96 square meters are excluded, not assumed accessible.", "Walkability is sampled at 0.2 meters; every movement segment is rechecked against exact collision triangles at intervals no larger than 0.05 meters.", "The decorative Book.glb instances at world Y=75 are outside the ground-floor capsule and do not affect route validation."],
    excludedRegions: excluded.map((component, index) => ({ id: `excluded-${index + 1}`, sampledAreaSquareMeters: component.ids.length * gridSize ** 2, roomIds: component.roomIds, reason: component.roomIds.length === 0 ? "Disconnected floor footprint without an exported room; accessibility uncertain." : "Isolated capsule-clear pocket smaller than 0.96 square meters.", bounds: { min: [Math.min(...component.ids.map((id) => cells.get(id).position[0])), floorY, Math.min(...component.ids.map((id) => cells.get(id).position[2]))], max: [Math.max(...component.ids.map((id) => cells.get(id).position[0])), floorY, Math.max(...component.ids.map((id) => cells.get(id).position[2]))] } })),
    rooms: rooms.map((room) => ({ id: room.id, name: room.name, floorOutline: room.floorOutline, floorHoles: room.floorHoles })),
    components: routeComponents, checkpoints, path: routePath,
};
const outputDirectory = path.join(workspace, "performance-benchmarks");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "l2-ground.route.json"), `${JSON.stringify(route, null, 2)}\n`);
console.log(JSON.stringify(route.summary, null, 2));

// Draw an inspectable plan without adding application UI.
const margin = 30;
const scale = 22;
const svgWidth = (bounds.max[0] - bounds.min[0]) * scale + margin * 2;
const svgHeight = (bounds.max[2] - bounds.min[2]) * scale + margin * 2;
const point = (position) => `${((position[0] - bounds.min[0]) * scale + margin).toFixed(1)},${((position[2] - bounds.min[2]) * scale + margin).toFixed(1)}`;
const plan = [`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`, `<rect width="100%" height="100%" fill="#101820"/>`, `<text x="20" y="19" fill="white" font-family="sans-serif" font-size="12">L2 ground — green: authored-start component; blue: separate subroutes</text>`];
for (const room of rooms) plan.push(`<polygon points="${room.floorOutline.map(point).join(" ")}" fill="#263541" stroke="#657986" stroke-width="1"/>`);
for (const component of routeComponents) {
    const points = routePath.slice(component.pathStartIndex, component.pathEndIndex + 1).map((entry) => point(entry.position));
    plan.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${component.startsAtAuthoredCamera ? "#59e887" : "#53bfff"}" stroke-width="2"/>`);
}
for (const checkpoint of checkpoints) {
    const [x, y] = point(checkpoint.position).split(",");
    plan.push(`<circle cx="${x}" cy="${y}" r="${checkpoint.kind === "room" ? 4 : 2}" fill="#ffd26f"/>`);
    if (checkpoint.kind === "room") plan.push(`<text x="${Number(x) + 6}" y="${Number(y) - 6}" fill="white" font-family="sans-serif" font-size="10">${checkpoint.name.replace("L2 — ", "")}</text>`);
}
plan.push("</svg>");
fs.writeFileSync(path.join(outputDirectory, "l2-ground.route.svg"), `${plan.join("\n")}\n`);
