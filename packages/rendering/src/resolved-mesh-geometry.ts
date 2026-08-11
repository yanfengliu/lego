import type { PreloadedMeshGroup, ResolvedMeshAsset } from "@lego-studio/catalog";
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three";

import { lduToThreeVector } from "./coordinates.ts";

interface SelectedResolvedMesh {
  readonly positionsLdu: readonly number[];
  readonly normalsCatalogLocal: readonly number[] | null;
  readonly indices: readonly number[] | null;
  readonly groups: readonly PreloadedMeshGroup[];
}

function selectResolvedMesh(
  asset: ResolvedMeshAsset,
  includeStuds: boolean,
  selectedRole?: PreloadedMeshGroup["role"],
): SelectedResolvedMesh {
  if (includeStuds && selectedRole === undefined) return asset;

  const positionsLdu: number[] = [];
  const normalsCatalogLocal: number[] | null = asset.normalsCatalogLocal === null ? null : [];
  const indices: number[] = [];
  const groups: PreloadedMeshGroup[] = [];
  const remappedVertex = new Map<number, number>();
  let selectedTriangleStart = 0;
  const includedRole = selectedRole ?? "body";
  for (const group of asset.groups) {
    if (group.role !== includedRole) continue;
    groups.push({
      role: group.role,
      triangleStart: selectedTriangleStart,
      triangleCount: group.triangleCount,
    });
    selectedTriangleStart += group.triangleCount;
    for (
      let triangle = group.triangleStart;
      triangle < group.triangleStart + group.triangleCount;
      triangle += 1
    ) {
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceIndex = asset.indices?.[triangle * 3 + corner] ?? triangle * 3 + corner;
        let selectedIndex = remappedVertex.get(sourceIndex);
        if (selectedIndex === undefined) {
          selectedIndex = positionsLdu.length / 3;
          remappedVertex.set(sourceIndex, selectedIndex);
          const sourceOffset = sourceIndex * 3;
          positionsLdu.push(
            asset.positionsLdu[sourceOffset]!,
            asset.positionsLdu[sourceOffset + 1]!,
            asset.positionsLdu[sourceOffset + 2]!,
          );
          if (normalsCatalogLocal !== null) {
            const sourceNormals = asset.normalsCatalogLocal;
            if (sourceNormals === null) {
              throw new Error(
                `Mesh asset ${asset.assetId} lost its source-faithful normals while selecting ${includedRole} triangles.`,
              );
            }
            normalsCatalogLocal.push(
              sourceNormals[sourceOffset]!,
              sourceNormals[sourceOffset + 1]!,
              sourceNormals[sourceOffset + 2]!,
            );
          }
        }
        indices.push(selectedIndex);
      }
    }
  }
  return { positionsLdu, normalsCatalogLocal, indices, groups };
}

export function createResolvedMeshGeometry(
  asset: ResolvedMeshAsset,
  includeStuds: boolean,
  selectedRole?: PreloadedMeshGroup["role"],
) {
  const { positionsLdu, normalsCatalogLocal, indices, groups } = selectResolvedMesh(
    asset,
    includeStuds,
    selectedRole,
  );
  const positions = new Float32Array(positionsLdu.length);
  for (let index = 0; index < positionsLdu.length; index += 3) {
    const position = lduToThreeVector([
      positionsLdu[index]!,
      positionsLdu[index + 1]!,
      positionsLdu[index + 2]!,
    ]);
    positions[index] = position.x;
    positions[index + 1] = position.y;
    positions[index + 2] = position.z;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  if (normalsCatalogLocal !== null) {
    const normals = new Float32Array(normalsCatalogLocal.length);
    for (let index = 0; index < normalsCatalogLocal.length; index += 3) {
      // LDU-to-Three reflects Y. The independent LDrawLoader applies that
      // negative-determinant transform at Object3D level, so Three reverses the
      // front-face test while its normal matrix applies (x, -y, z). This baked
      // geometry reverses every triangle below and applies the same normal
      // transform, preserving both FrontSide visibility and source lighting.
      normals[index] = normalsCatalogLocal[index]!;
      normals[index + 1] =
        normalsCatalogLocal[index + 1] === 0 ? 0 : -normalsCatalogLocal[index + 1]!;
      normals[index + 2] = normalsCatalogLocal[index + 2]!;
    }
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  }
  if (normalsCatalogLocal !== null) {
    const sourceIndices =
      indices ?? Array.from({ length: positions.length / 3 }, (_, index) => index);
    const reflectedIndices = new Uint32Array(sourceIndices.length);
    for (let index = 0; index < sourceIndices.length; index += 3) {
      reflectedIndices[index] = sourceIndices[index]!;
      reflectedIndices[index + 1] = sourceIndices[index + 2]!;
      reflectedIndices[index + 2] = sourceIndices[index + 1]!;
    }
    geometry.setIndex(new Uint32BufferAttribute(reflectedIndices, 1));
  } else if (indices !== null) {
    // Legacy schema-/2 assets already encode catalog-to-Three winding and have
    // no independent source normals. Preserve that compatibility route; all
    // source-faithful LDraw assets use the explicit-normal branch above.
    geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(indices), 1));
  }
  for (const group of groups) {
    geometry.addGroup(group.triangleStart * 3, group.triangleCount * 3, 0);
  }
  geometry.userData = {
    meshTriangleGroups: groups.map((group) => ({ ...group })),
    includedMeshRoles: [...new Set(groups.map(({ role }) => role))],
  };
  if (normalsCatalogLocal === null) geometry.computeVertexNormals();
  return geometry;
}
