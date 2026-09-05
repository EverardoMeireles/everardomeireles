import { useMemo } from "react";
import * as THREE from "three";

/**
 * Purpose: Renders mirrored copies of meshes containing halfMesh metadata.
 * Relationships: Used by SceneContainer with GLTFLoader meshes and materials.
 * Example:
 * <HalfMeshMirroring nodes={halfMeshNodes} material={halfMeshMaterial} />
 * @param {Object} nodes - Half-mesh nodes keyed by name.
 * @param {THREE.Material} material - Shared material for marked atlas meshes.
 */
export const HalfMeshMirroring = ({ nodes, material }) => {
    const mirroredMeshes = useMemo(() => {
        const mirrorGroup = new THREE.Group();
        mirrorGroup.name = "Mirrored half meshes";

        Object.values(nodes).forEach((node) => {
            const mirrorPlane = node.userData?.halfMesh?.mirrorPlane;
            const planePoint = mirrorPlane?.point;
            const planeNormal = mirrorPlane?.normal;

            if (!Array.isArray(planePoint) || planePoint.length !== 3
                || !Array.isArray(planeNormal) || planeNormal.length !== 3) {
                console.warn(`[HALF] mesh "${node.name}" is missing mirror plane metadata.`);
                return;
            }

            const point = new THREE.Vector3(...planePoint);
            const normal = new THREE.Vector3(...planeNormal);

            if (normal.lengthSq() === 0) {
                console.warn(`[HALF] mesh "${node.name}" has an invalid mirror plane normal.`);
                return;
            }

            normal.normalize();

            // Build a world-space reflection from the exported plane.
            const planeDistance = normal.dot(point);
            const reflectionMatrix = new THREE.Matrix4().set(
                1 - 2 * normal.x * normal.x, -2 * normal.x * normal.y, -2 * normal.x * normal.z, 2 * planeDistance * normal.x,
                -2 * normal.y * normal.x, 1 - 2 * normal.y * normal.y, -2 * normal.y * normal.z, 2 * planeDistance * normal.y,
                -2 * normal.z * normal.x, -2 * normal.z * normal.y, 1 - 2 * normal.z * normal.z, 2 * planeDistance * normal.z,
                0, 0, 0, 1
            );

            node.updateWorldMatrix(true, false);

            // Preserve non-atlas materials, including transparent glass.
            const mirroredMaterial = node.material?.name?.startsWith("[HALF]")
                ? material ?? node.material
                : node.material;
            const mirroredMesh = new THREE.Mesh(node.geometry, mirroredMaterial);
            mirroredMesh.name = `[MIRRORED] ${node.name}`;
            mirroredMesh.castShadow = node.castShadow;
            mirroredMesh.receiveShadow = node.receiveShadow;
            mirroredMesh.renderOrder = node.renderOrder;
            mirroredMesh.matrixAutoUpdate = false;
            mirroredMesh.matrix.multiplyMatrices(reflectionMatrix, node.matrixWorld);
            mirroredMesh.matrixWorldNeedsUpdate = true;

            mirrorGroup.add(mirroredMesh);
        });

        return mirrorGroup;
    }, [nodes, material]);

    return <primitive object={mirroredMeshes} dispose={null} />;
};
