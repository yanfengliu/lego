import {
  getPartDefinition,
  resolvePreloadedMeshAsset,
  type PreloadedMeshGroup,
  type ResolvedMeshAsset,
} from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { BrickFinish } from "./types.ts";

export const RENDER_LIMITS = Object.freeze({
  maxParts: 2_000,
  maxCollisionPrimitives: 32_000,
  maxMeshVerticesPerScene: 2_000_000,
  maxMeshTrianglesPerScene: 4_000_000,
  maxMeshBufferBytesPerScene: 256 * 1024 * 1024,
});

export class RenderBudgetError extends Error {
  readonly code = "RENDER_BUDGET_EXCEEDED" as const;

  constructor(message: string) {
    super(message);
    this.name = "RenderBudgetError";
  }
}

export interface MeshRenderCost {
  readonly partId: string;
  /** Position-attribute vertex slots, including transient indexed sources and instruction outlines. */
  readonly vertexCount: number;
  readonly triangleCount: number;
  /** Conservative typed BufferAttribute bytes, including normals, colors, indices, and outlines. */
  readonly bufferBytes: number;
}

export interface MeshRenderCostOptions {
  readonly finish: BrickFinish;
  readonly includeStuds: boolean;
}

function roleAllocation(
  asset: ResolvedMeshAsset,
  role: PreloadedMeshGroup["role"],
): { readonly vertexCount: number; readonly triangleCount: number } {
  const vertices = new Set<number>();
  let triangleCount = 0;
  for (const group of asset.groups) {
    if (group.role !== role) continue;
    triangleCount += group.triangleCount;
    for (
      let triangle = group.triangleStart;
      triangle < group.triangleStart + group.triangleCount;
      triangle += 1
    ) {
      for (let corner = 0; corner < 3; corner += 1) {
        vertices.add(asset.indices?.[triangle * 3 + corner] ?? triangle * 3 + corner);
      }
    }
  }
  return { vertexCount: vertices.size, triangleCount };
}

/**
 * Conservatively prices the actual per-instance BufferGeometry path.
 *
 * Flat/presentation meshes allocate typed constructor inputs plus copied source
 * positions, normals and indices. Instruction meshes split body/stud roles,
 * retain each role's indexed source at peak, de-index fill positions/normals/colors
 * to three vertices per triangle, and allow six line vertices per triangle for outlines.
 */
export function estimateMeshRenderCost(
  partId: string,
  asset: ResolvedMeshAsset,
  { finish, includeStuds }: MeshRenderCostOptions,
): MeshRenderCost {
  let sourceVertexCount: number;
  let triangleCount: number;
  if (finish !== "instruction" && includeStuds) {
    sourceVertexCount = asset.vertexCount;
    triangleCount = asset.triangleCount;
  } else {
    const body = roleAllocation(asset, "body");
    const stud = includeStuds
      ? roleAllocation(asset, "stud")
      : { vertexCount: 0, triangleCount: 0 };
    sourceVertexCount = body.vertexCount + stud.vertexCount;
    triangleCount = body.triangleCount + stud.triangleCount;
  }

  if (finish !== "instruction") {
    return {
      partId,
      vertexCount: sourceVertexCount,
      triangleCount,
      // Position constructor input + copied position attribute + computed
      // normal are 3 * xyz Float32. Uint32 constructor input + copied index are
      // conservative for an originally unindexed asset.
      bufferBytes: sourceVertexCount * 36 + triangleCount * 24,
    };
  }
  return {
    partId,
    // Indexed role sources + de-indexed fill (3/T) + worst-case edges (6/T).
    vertexCount: sourceVertexCount + triangleCount * 9,
    triangleCount,
    // Source constructor input+position+normal (36/V) + index input+copy
    // (24/T) + de-indexed position+normal and color input+copy (144/T) +
    // worst-case edge positions (72/T).
    bufferBytes: sourceVertexCount * 36 + triangleCount * 240,
  };
}

/** Counts per-instance mesh allocations before any BufferGeometry is created. */
export function assertMeshGeometryBudget(costs: readonly MeshRenderCost[]): void {
  let vertexCount = 0;
  let triangleCount = 0;
  let bufferBytes = 0;
  for (const cost of costs) {
    if (
      !Number.isSafeInteger(cost.vertexCount) ||
      cost.vertexCount < 0 ||
      !Number.isSafeInteger(cost.triangleCount) ||
      cost.triangleCount < 0 ||
      !Number.isSafeInteger(cost.bufferBytes) ||
      cost.bufferBytes < 0
    ) {
      throw new RenderBudgetError(
        `Mesh render cost for part ${cost.partId} must use non-negative safe-integer vertex, triangle, and buffer-byte counts; received ${cost.vertexCount} vertices, ${cost.triangleCount} triangles, and ${cost.bufferBytes} bytes`,
      );
    }
    vertexCount += cost.vertexCount;
    triangleCount += cost.triangleCount;
    bufferBytes += cost.bufferBytes;
    if (vertexCount > RENDER_LIMITS.maxMeshVerticesPerScene) {
      throw new RenderBudgetError(
        `Scene mesh allocation reaches ${vertexCount} per-instance vertices at part ${cost.partId}; renderer limit is ${RENDER_LIMITS.maxMeshVerticesPerScene}`,
      );
    }
    if (triangleCount > RENDER_LIMITS.maxMeshTrianglesPerScene) {
      throw new RenderBudgetError(
        `Scene mesh allocation reaches ${triangleCount} per-instance triangles at part ${cost.partId}; renderer limit is ${RENDER_LIMITS.maxMeshTrianglesPerScene}`,
      );
    }
    if (bufferBytes > RENDER_LIMITS.maxMeshBufferBytesPerScene) {
      throw new RenderBudgetError(
        `Scene mesh allocation reaches ${bufferBytes} conservative BufferAttribute bytes at part ${cost.partId}; renderer limit is ${RENDER_LIMITS.maxMeshBufferBytesPerScene}`,
      );
    }
  }
}

/** Rejects oversized documents before hashing, validation, or Three.js allocation. */
export function assertRenderBudget(
  document: Pick<BrickDocumentV1, "parts">,
  options: Partial<MeshRenderCostOptions> = {},
): void {
  if (document.parts.length > RENDER_LIMITS.maxParts) {
    throw new RenderBudgetError(
      `Document has ${document.parts.length} parts; renderer limit is ${RENDER_LIMITS.maxParts}`,
    );
  }

  let primitiveCount = 0;
  const meshCosts: MeshRenderCost[] = [];
  const meshCostByAsset = new Map<ResolvedMeshAsset, Omit<MeshRenderCost, "partId">>();
  const finish = options.finish ?? "flat";
  const includeStuds = options.includeStuds ?? true;
  for (const part of document.parts) {
    const definition = getPartDefinition(part.catalogPartId);
    primitiveCount += definition?.collision.primitives.length ?? 1;
    if (primitiveCount > RENDER_LIMITS.maxCollisionPrimitives) {
      throw new RenderBudgetError(
        `Document requires more than ${RENDER_LIMITS.maxCollisionPrimitives} render primitives`,
      );
    }
    if (definition?.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
      const resolution = resolvePreloadedMeshAsset(definition.geometry);
      if (resolution.ok) {
        let cost = meshCostByAsset.get(resolution.asset);
        if (cost === undefined) {
          const { partId: _partId, ...estimated } = estimateMeshRenderCost(
            part.id,
            resolution.asset,
            { finish, includeStuds },
          );
          void _partId;
          cost = estimated;
          meshCostByAsset.set(resolution.asset, cost);
        }
        meshCosts.push({ partId: part.id, ...cost });
      }
    }
  }
  assertMeshGeometryBudget(meshCosts);
}
