import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import { UPRIGHT_ORIENTATIONS } from "./constants.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import type { LduVector3, MeshReferenceGeometryRecipe } from "./types.ts";

export interface PreloadedMeshGroup {
  readonly role: "body" | "stud";
  /** First triangle in this contiguous range, not the first scalar index. */
  readonly triangleStart: number;
  readonly triangleCount: number;
}

export interface PreloadedMeshAsset {
  readonly assetId: string;
  /** Flat xyz triples in the immutable source asset-local LDU frame. */
  readonly positionsLdu: readonly number[];
  /** Unit vectors in the same asset-local basis, one xyz triple per position. */
  readonly normalsAssetLocal?: readonly number[];
  /** Triangle indices. Omit only when each consecutive three vertices is a face. */
  readonly indices?: readonly number[];
  /** Integrity-bound, gap-free partition of every triangle into body/stud ranges. */
  readonly groups: readonly PreloadedMeshGroup[];
}

export interface MeshAssetLimits {
  readonly maxVertices: number;
  readonly maxTriangles: number;
  readonly maxGroups: number;
  readonly maxComponents: number;
  readonly maxAssets: number;
  readonly maxTotalVertices: number;
  readonly maxTotalTriangles: number;
  readonly maxTotalBytes: number;
  readonly maxResolvedCacheEntries: number;
}

export const MESH_ASSET_LIMITS: MeshAssetLimits = Object.freeze({
  maxVertices: 100_000,
  maxTriangles: 200_000,
  maxGroups: 128,
  maxComponents: 512,
  maxAssets: 64,
  maxTotalVertices: 1_000_000,
  maxTotalTriangles: 2_000_000,
  maxTotalBytes: 64 * 1024 * 1024,
  maxResolvedCacheEntries: 16,
});

export const PRELOADED_MESH_GENERATOR_ID = "builtin:preloaded-mesh-reference/1" as const;
/** Exact scale used before mesh positions enter Three.js Float32 attributes. */
export const MESH_RENDER_UNITS_PER_LDU = 0.05 as const;
/** Maximum admitted Float32 renderer drift when mapped back into catalog LDU. */
export const MESH_RENDER_QUANTIZATION_TOLERANCE_LDU = 1e-4;

const MESH_ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,127}$/;
const LOWERCASE_SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MAX_FINITE_FLOAT32 = 3.402_823_466_385_288_6e38;
const NORMAL_UNIT_TOLERANCE = 1e-5;

export function isValidMeshAssetId(value: string): boolean {
  return MESH_ASSET_ID_PATTERN.test(value);
}

export function isLowercaseSha256(value: string): value is `sha256:${string}` {
  return LOWERCASE_SHA256_PATTERN.test(value);
}

export type MeshAssetResolutionErrorCode =
  | "MESH_GENERATOR_INVALID"
  | "MESH_ASSET_MISSING"
  | "MESH_ASSET_TAMPERED"
  | "MESH_ASSET_OVERSIZED"
  | "MESH_ASSET_NONFINITE"
  | "MESH_ASSET_NORMAL_INVALID"
  | "MESH_ASSET_FLOAT32_RANGE"
  | "MESH_ASSET_RENDER_PRECISION"
  | "MESH_ASSET_INDEX_INVALID"
  | "MESH_ASSET_TRIANGLE_INVALID"
  | "MESH_ASSET_VERTEX_UNREFERENCED"
  | "MESH_ASSET_GROUP_INVALID"
  | "MESH_ASSET_COMPONENT_LIMIT"
  | "MESH_ASSET_ID_INVALID"
  | "MESH_ASSET_HASH_INVALID"
  | "MESH_FRAME_MISSING"
  | "MESH_FRAME_INVALID";

export interface ResolvedMeshAsset {
  readonly assetId: string;
  /** Framed positions quantized exactly as the renderer, then mapped back to catalog-local LDU. */
  readonly positionsLdu: readonly number[];
  /** Source-faithful normals rotated into catalog-local axes, or legacy fallback. */
  readonly normalsCatalogLocal: readonly number[] | null;
  readonly indices: readonly number[] | null;
  readonly groups: readonly PreloadedMeshGroup[];
  /** One guaranteed preview triangle for each disconnected indexed component. */
  readonly componentFirstTriangles: readonly number[];
  /** Triangles that reference deterministic min/max vertices on all three axes. */
  readonly extremalTriangles: readonly number[];
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export type MeshAssetResolution =
  | { readonly ok: true; readonly asset: ResolvedMeshAsset }
  | {
      readonly ok: false;
      readonly code: MeshAssetResolutionErrorCode;
      readonly message: string;
    };

type MeshAssetFailure = Extract<MeshAssetResolution, { readonly ok: false }>;

export type MeshAssetResolver = (recipe: MeshReferenceGeometryRecipe) => MeshAssetResolution;

function hashInput(asset: PreloadedMeshAsset): string {
  return JSON.stringify({
    schemaVersion:
      asset.normalsAssetLocal === undefined
        ? "lego.preloaded-mesh-asset/2"
        : "lego.preloaded-mesh-asset/3",
    assetId: asset.assetId,
    positionsLdu: asset.positionsLdu,
    ...(asset.normalsAssetLocal === undefined
      ? {}
      : { normalsAssetLocal: asset.normalsAssetLocal }),
    indices: asset.indices ?? null,
    groups: asset.groups,
  });
}

/** Content identity for immutable, bundled mesh data. */
export function meshAssetContentHash(asset: PreloadedMeshAsset): `sha256:${string}` {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(hashInput(asset))))}`;
}

function validateLimits(limits: MeshAssetLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(
        `Mesh asset limit ${name} must be a positive safe integer; got ${value}`,
      );
    }
  }
}

function logicalAssetBytes(asset: PreloadedMeshAsset): number {
  return (
    asset.assetId.length * 2 +
    asset.positionsLdu.length * 8 +
    (asset.normalsAssetLocal?.length ?? 0) * 8 +
    (asset.indices?.length ?? 0) * 4 +
    (Array.isArray(asset.groups) ? asset.groups.length : 0) * 24
  );
}

function immutableAsset(asset: PreloadedMeshAsset): PreloadedMeshAsset {
  const positionsLdu = Object.freeze([...asset.positionsLdu]);
  const normalsAssetLocal =
    asset.normalsAssetLocal === undefined ? undefined : Object.freeze([...asset.normalsAssetLocal]);
  const indices = asset.indices === undefined ? undefined : Object.freeze([...asset.indices]);
  const groups = Object.freeze(
    (Array.isArray(asset.groups) ? asset.groups : []).map((group) => Object.freeze({ ...group })),
  );
  return Object.freeze({
    assetId: asset.assetId,
    positionsLdu,
    ...(normalsAssetLocal === undefined ? {} : { normalsAssetLocal }),
    ...(indices === undefined ? {} : { indices }),
    groups,
  });
}

type PreloadedMeshEntry =
  | { readonly kind: "asset"; readonly asset: PreloadedMeshAsset }
  | {
      readonly kind: "oversized";
      readonly assetId: string;
      readonly coordinateCount: number;
      readonly indexCount: number | null;
      readonly groupCount: number;
    };

function failure(code: MeshAssetResolutionErrorCode, message: string): MeshAssetFailure {
  return Object.freeze({ ok: false, code, message });
}

function generatorFailure(recipe: MeshReferenceGeometryRecipe): MeshAssetFailure {
  const received = (recipe as { readonly generatorId: unknown }).generatorId;
  const description =
    typeof received === "string"
      ? `${JSON.stringify(received.slice(0, 128))} (${received.length} characters)`
      : `${typeof received} ${JSON.stringify(received)}`;
  return failure(
    "MESH_GENERATOR_INVALID",
    `Mesh resolver accepts only generatorId ${PRELOADED_MESH_GENERATOR_ID}; received ${description}. Reject the recipe before constructing a cache key.`,
  );
}

function resolveRecipeFrame(recipe: MeshReferenceGeometryRecipe):
  | {
      readonly ok: true;
      readonly matrix: readonly number[];
      readonly translationLdu: LduVector3;
      readonly cacheFields: readonly string[];
    }
  | MeshAssetFailure {
  const frame = recipe.assetToCatalogFrame;
  if (frame === undefined) {
    return failure(
      "MESH_FRAME_MISSING",
      `Mesh asset ${recipe.assetId} has no assetToCatalogFrame; declare the versioned orientation and safe-integer LDU translation that normalize immutable asset-local coordinates into catalog coordinates. PartDefinition.ldrawFrame is interchange-only and is not a substitute.`,
    );
  }
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === frame.orientationId);
  const translation = frame.translationLdu;
  if (
    frame.schemaVersion !== "mesh-asset-to-catalog-frame/1" ||
    orientation === undefined ||
    !Array.isArray(translation) ||
    translation.length !== 3 ||
    !translation.every(Number.isSafeInteger)
  ) {
    return failure(
      "MESH_FRAME_INVALID",
      `Mesh asset ${recipe.assetId} has invalid assetToCatalogFrame ${JSON.stringify(frame)}; require schemaVersion mesh-asset-to-catalog-frame/1, one of ${UPRIGHT_ORIENTATIONS.map(({ id }) => id).join(", ")}, and exactly three safe-integer translation LDU coordinates.`,
    );
  }
  return {
    ok: true,
    matrix: orientation.matrix,
    translationLdu: translation,
    cacheFields: [
      frame.schemaVersion,
      frame.orientationId,
      ...translation.map((coordinate) => String(coordinate)),
    ],
  };
}

function validateGroups(
  assetId: string,
  groups: readonly PreloadedMeshGroup[],
  triangleCount: number,
): MeshAssetFailure | null {
  if (groups.length === 0) {
    return failure(
      "MESH_ASSET_GROUP_INVALID",
      `Mesh asset ${assetId} has no body/stud triangle groups; declare a gap-free integrity-bound partition so includeStuds=false cannot silently render studs.`,
    );
  }
  let nextTriangle = 0;
  let bodyTriangles = 0;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    if (
      (group.role !== "body" && group.role !== "stud") ||
      !Number.isSafeInteger(group.triangleStart) ||
      !Number.isSafeInteger(group.triangleCount) ||
      group.triangleStart !== nextTriangle ||
      group.triangleCount <= 0 ||
      group.triangleStart + group.triangleCount > triangleCount
    ) {
      return failure(
        "MESH_ASSET_GROUP_INVALID",
        `Mesh asset ${assetId} group ${index} is ${JSON.stringify(group)}; groups must be positive safe-integer body/stud ranges in exact contiguous triangle order starting at zero and ending at ${triangleCount}.`,
      );
    }
    nextTriangle += group.triangleCount;
    if (group.role === "body") bodyTriangles += group.triangleCount;
  }
  if (nextTriangle !== triangleCount || bodyTriangles === 0) {
    return failure(
      "MESH_ASSET_GROUP_INVALID",
      `Mesh asset ${assetId} groups cover ${nextTriangle} of ${triangleCount} triangles with ${bodyTriangles} body triangles; every triangle needs exactly one range and at least one body triangle is required.`,
    );
  }
  return null;
}

function validateTriangles(
  assetId: string,
  positions: readonly number[],
  indices: readonly number[] | null,
  triangleCount: number,
  failureCode:
    "MESH_ASSET_TRIANGLE_INVALID" | "MESH_ASSET_RENDER_PRECISION" = "MESH_ASSET_TRIANGLE_INVALID",
  representation = "asset-local LDU",
): MeshAssetFailure | null {
  const vertexIndex = (triangle: number, corner: number): number =>
    indices?.[triangle * 3 + corner] ?? triangle * 3 + corner;
  const coordinate = (vertex: number, axis: number): number => positions[vertex * 3 + axis]!;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertices = [
      vertexIndex(triangle, 0),
      vertexIndex(triangle, 1),
      vertexIndex(triangle, 2),
    ] as const;
    const samePosition = (left: number, right: number): boolean =>
      [0, 1, 2].every((axis) => coordinate(left, axis) === coordinate(right, axis));
    if (
      samePosition(vertices[0], vertices[1]) ||
      samePosition(vertices[0], vertices[2]) ||
      samePosition(vertices[1], vertices[2])
    ) {
      return failure(
        failureCode,
        `Mesh asset ${assetId} triangle ${triangle} uses repeated ${representation} vertex positions at indices [${vertices.join(", ")}]. Every integrity-bound body/stud triangle must contain three distinct positions after the exact render conversion; a repeated or precision-collapsed outlier cannot supply visual bounds or preview coverage.`,
      );
    }
    const edge1 = [0, 1, 2].map(
      (axis) => coordinate(vertices[1], axis) - coordinate(vertices[0], axis),
    );
    const edge2 = [0, 1, 2].map(
      (axis) => coordinate(vertices[2], axis) - coordinate(vertices[0], axis),
    );
    const cross = [
      edge1[1]! * edge2[2]! - edge1[2]! * edge2[1]!,
      edge1[2]! * edge2[0]! - edge1[0]! * edge2[2]!,
      edge1[0]! * edge2[1]! - edge1[1]! * edge2[0]!,
    ];
    const areaSquared = cross.reduce((total, component) => total + component * component, 0);
    if (!cross.every(Number.isFinite) || !Number.isFinite(areaSquared)) {
      return failure(
        failureCode,
        `Mesh asset ${assetId} triangle ${triangle} has non-finite area arithmetic from finite ${representation} coordinates at indices [${vertices.join(", ")}]. Scale the bundled geometry before it can reach topology, extrema, preview, or rendering claims.`,
      );
    }
    if (areaSquared === 0) {
      return failure(
        failureCode,
        `Mesh asset ${assetId} triangle ${triangle} is collinear and has zero area in ${representation} at indices [${vertices.join(", ")}]. Remove it or reduce its coordinate magnitude; a zero-area body/stud face cannot supply visual bounds or preview coverage.`,
      );
    }
  }
  return null;
}

function validateRendererBounds(
  asset: PreloadedMeshAsset,
  catalogPositions: readonly number[],
  quantizedCatalogPositions: readonly number[],
  indices: readonly number[] | null,
): MeshAssetFailure | null {
  const scopes = [
    { name: "complete mesh", groups: asset.groups },
    ...(["body", "stud"] as const)
      .map((role) => ({
        name: `${role} role`,
        groups: asset.groups.filter((group) => group.role === role),
      }))
      .filter(({ groups }) => groups.length > 0),
  ];
  const axisNames = ["X", "Y", "Z"] as const;
  for (const scope of scopes) {
    const beforeMin = [Infinity, Infinity, Infinity];
    const beforeMax = [-Infinity, -Infinity, -Infinity];
    const afterMin = [Infinity, Infinity, Infinity];
    const afterMax = [-Infinity, -Infinity, -Infinity];
    for (const group of scope.groups) {
      for (
        let triangle = group.triangleStart;
        triangle < group.triangleStart + group.triangleCount;
        triangle += 1
      ) {
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = indices?.[triangle * 3 + corner] ?? triangle * 3 + corner;
          for (let axis = 0; axis < 3; axis += 1) {
            const offset = vertex * 3 + axis;
            beforeMin[axis] = Math.min(beforeMin[axis]!, catalogPositions[offset]!);
            beforeMax[axis] = Math.max(beforeMax[axis]!, catalogPositions[offset]!);
            afterMin[axis] = Math.min(afterMin[axis]!, quantizedCatalogPositions[offset]!);
            afterMax[axis] = Math.max(afterMax[axis]!, quantizedCatalogPositions[offset]!);
          }
        }
      }
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const minimumDrift = Math.abs(afterMin[axis]! - beforeMin[axis]!);
      const maximumDrift = Math.abs(afterMax[axis]! - beforeMax[axis]!);
      if (
        minimumDrift > MESH_RENDER_QUANTIZATION_TOLERANCE_LDU ||
        maximumDrift > MESH_RENDER_QUANTIZATION_TOLERANCE_LDU
      ) {
        const collapsed = beforeMin[axis] !== beforeMax[axis] && afterMin[axis] === afterMax[axis];
        return failure(
          "MESH_ASSET_RENDER_PRECISION",
          `Mesh asset ${asset.assetId} ${scope.name} ${axisNames[axis]} extent [${beforeMin[axis]}, ${beforeMax[axis]}] maps back from exact renderer Float32 bounds as [${afterMin[axis]}, ${afterMax[axis]}], drifting by [${minimumDrift}, ${maximumDrift}] LDU beyond tolerance ${MESH_RENDER_QUANTIZATION_TOLERANCE_LDU}${collapsed ? ` and collapses the non-zero ${axisNames[axis]} extent` : ""}. Reduce the frame translation or coordinate magnitude before topology, extrema, bounds, preview, admission, or rendering claims.`,
        );
      }
    }
  }
  return null;
}

function validateRendererVertexPrecision(
  assetId: string,
  rendererPositions: readonly number[],
  quantizedRendererPositions: readonly number[],
  normalsCatalogLocal: readonly number[] | null,
): MeshAssetFailure | null {
  const sourceVertexByQuantizedPosition = new Map<
    string,
    { positionKey: string; normalVertices: Map<string, number>; vertex: number }
  >();
  for (let vertex = 0; vertex < rendererPositions.length / 3; vertex += 1) {
    const offset = vertex * 3;
    const positionKey = JSON.stringify(rendererPositions.slice(offset, offset + 3));
    const quantizedPositionKey = JSON.stringify(
      quantizedRendererPositions.slice(offset, offset + 3),
    );
    const normalKey = JSON.stringify(normalsCatalogLocal?.slice(offset, offset + 3) ?? null);
    const prior = sourceVertexByQuantizedPosition.get(quantizedPositionKey);
    if (prior !== undefined && prior.positionKey !== positionKey) {
      return failure(
        "MESH_ASSET_RENDER_PRECISION",
        `Mesh asset ${assetId} distinct renderer-space positions at vertices ${prior.vertex} and ${vertex} both become ${quantizedPositionKey} after Float32 allocation, even though their normals may differ. Reduce the frame translation or coordinate magnitude so exact LDU-to-render scaling preserves distinct positions before topology, extrema, bounds, preview, or rendering claims.`,
      );
    }
    const duplicateNormalVertex = prior?.normalVertices.get(normalKey);
    if (duplicateNormalVertex !== undefined) {
      return failure(
        "MESH_ASSET_RENDER_PRECISION",
        `Mesh asset ${assetId} vertices ${duplicateNormalVertex} and ${vertex} duplicate renderer-space position ${positionKey} and normal ${normalKey}. Coincident rows are admitted only when distinct stored normals preserve an intentional hard-edge smoothing island.`,
      );
    }
    if (prior === undefined) {
      sourceVertexByQuantizedPosition.set(quantizedPositionKey, {
        positionKey,
        normalVertices: new Map([[normalKey, vertex]]),
        vertex,
      });
    } else {
      prior.normalVertices.set(normalKey, vertex);
    }
  }
  return null;
}

interface MeshTopologyAnalysis {
  readonly componentFirstTriangles: readonly number[];
  readonly extremalTriangles: readonly number[];
}

function analyzeMeshTopology(
  asset: PreloadedMeshAsset,
  indices: readonly number[] | null,
  vertexCount: number,
  triangleCount: number,
  maxComponents: number,
): MeshTopologyAnalysis | MeshAssetFailure {
  const parent = new Int32Array(vertexCount);
  const referenced = new Uint8Array(vertexCount);
  const firstTriangle = new Int32Array(vertexCount);
  firstTriangle.fill(-1);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) parent[vertex] = vertex;

  const find = (vertex: number): number => {
    let root = vertex;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[vertex] !== vertex) {
      const next = parent[vertex]!;
      parent[vertex] = root;
      vertex = next;
    }
    return root;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  // Asset generators commonly duplicate a position at hard-normal seams. Exact
  // coincident vertices still join one geometric component for preview coverage.
  const vertexByPosition = new Map<string, number>();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const key = JSON.stringify([
      asset.positionsLdu[offset],
      asset.positionsLdu[offset + 1],
      asset.positionsLdu[offset + 2],
    ]);
    const prior = vertexByPosition.get(key);
    if (prior === undefined) vertexByPosition.set(key, vertex);
    else union(prior, vertex);
  }

  const triangleVertex = (triangle: number, corner: number): number =>
    indices?.[triangle * 3 + corner] ?? triangle * 3 + corner;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const first = triangleVertex(triangle, 0);
    const second = triangleVertex(triangle, 1);
    const third = triangleVertex(triangle, 2);
    for (const vertex of [first, second, third]) {
      referenced[vertex] = 1;
      if (firstTriangle[vertex] === -1) firstTriangle[vertex] = triangle;
    }
    union(first, second);
    union(first, third);
  }

  const unreferencedVertex = referenced.findIndex((value) => value === 0);
  if (unreferencedVertex !== -1) {
    return failure(
      "MESH_ASSET_VERTEX_UNREFERENCED",
      `Mesh asset ${asset.assetId} vertex ${unreferencedVertex} is not referenced by any integrity-bound body/stud triangle. Remove it or reference it explicitly; hidden vertices cannot influence bounds or preview coverage.`,
    );
  }

  const firstTriangleByComponent = new Map<number, number>();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const root = find(vertex);
    const triangle = firstTriangle[vertex]!;
    const prior = firstTriangleByComponent.get(root);
    if (prior === undefined || triangle < prior) firstTriangleByComponent.set(root, triangle);
  }
  const componentFirstTriangles = [...firstTriangleByComponent.values()].sort(
    (left, right) => left - right,
  );
  if (componentFirstTriangles.length > maxComponents) {
    return failure(
      "MESH_ASSET_COMPONENT_LIMIT",
      `Mesh asset ${asset.assetId} has ${componentFirstTriangles.length} disconnected geometric components; limit is ${maxComponents} so a bounded preview can preserve every component. Join coincident seams or split the catalog asset.`,
    );
  }

  const minimumVertex = [0, 0, 0];
  const maximumVertex = [0, 0, 0];
  for (let vertex = 1; vertex < vertexCount; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const coordinate = asset.positionsLdu[vertex * 3 + axis]!;
      if (coordinate < asset.positionsLdu[minimumVertex[axis]! * 3 + axis]!) {
        minimumVertex[axis] = vertex;
      }
      if (coordinate > asset.positionsLdu[maximumVertex[axis]! * 3 + axis]!) {
        maximumVertex[axis] = vertex;
      }
    }
  }
  const extremalTriangles = [
    ...new Set([...minimumVertex, ...maximumVertex].map((vertex) => firstTriangle[vertex]!)),
  ].sort((left, right) => left - right);
  return { componentFirstTriangles, extremalTriangles };
}

/**
 * Closes over an eagerly copied set of in-memory assets. The returned resolver
 * is synchronous and has no path, URL, loader, callback, or registration API.
 */
export function createPreloadedMeshAssetResolver(
  assets: Readonly<Record<string, PreloadedMeshAsset>>,
  limits: Partial<MeshAssetLimits> = MESH_ASSET_LIMITS,
): MeshAssetResolver {
  const boundedLimits = Object.freeze({ ...MESH_ASSET_LIMITS, ...limits });
  validateLimits(boundedLimits);
  const assetEntries = Object.entries(assets);
  if (assetEntries.length > boundedLimits.maxAssets) {
    throw new RangeError(
      `Preloaded mesh registry has ${assetEntries.length} assets; aggregate limit is ${boundedLimits.maxAssets}. Admit a smaller immutable registry.`,
    );
  }
  let totalCoordinates = 0;
  let totalTriangles = 0;
  let totalBytes = 0;
  for (const [, asset] of assetEntries) {
    totalCoordinates += asset.positionsLdu.length;
    totalTriangles +=
      asset.indices === undefined
        ? Math.ceil(asset.positionsLdu.length / 9)
        : Math.ceil(asset.indices.length / 3);
    totalBytes += logicalAssetBytes(asset);
  }
  if (
    totalCoordinates > boundedLimits.maxTotalVertices * 3 ||
    totalTriangles > boundedLimits.maxTotalTriangles ||
    totalBytes > boundedLimits.maxTotalBytes
  ) {
    throw new RangeError(
      `Preloaded mesh registry totals ${totalCoordinates / 3} vertices, ${totalTriangles} triangles, and ${totalBytes} logical bytes; aggregate limits are ${boundedLimits.maxTotalVertices} vertices, ${boundedLimits.maxTotalTriangles} triangles, and ${boundedLimits.maxTotalBytes} bytes. Reduce the closed registry before copying it.`,
    );
  }
  const preloaded = new Map<string, PreloadedMeshEntry>();
  for (const [assetId, asset] of assetEntries) {
    const indexCount = asset.indices?.length ?? null;
    const groupCount = Array.isArray(asset.groups) ? asset.groups.length : 0;
    if (
      asset.positionsLdu.length > boundedLimits.maxVertices * 3 ||
      (indexCount !== null && indexCount > boundedLimits.maxTriangles * 3) ||
      groupCount > boundedLimits.maxGroups
    ) {
      preloaded.set(
        assetId,
        Object.freeze({
          kind: "oversized",
          assetId: asset.assetId,
          coordinateCount: asset.positionsLdu.length,
          indexCount,
          groupCount,
        }),
      );
    } else {
      preloaded.set(assetId, Object.freeze({ kind: "asset", asset: immutableAsset(asset) }));
    }
  }
  const resolutionCache = new Map<string, MeshAssetResolution>();

  const resolveUncached: MeshAssetResolver = (recipe) => {
    if ((recipe as { readonly generatorId: unknown }).generatorId !== PRELOADED_MESH_GENERATOR_ID) {
      return generatorFailure(recipe);
    }
    if (!isValidMeshAssetId(recipe.assetId)) {
      return failure(
        "MESH_ASSET_ID_INVALID",
        `Mesh asset id ${JSON.stringify(recipe.assetId)} is invalid; use 1..128 lowercase ASCII letters, digits, dot, underscore, colon, slash, or hyphen, beginning with a letter or digit. NUL and control characters are forbidden.`,
      );
    }
    if (!isLowercaseSha256(recipe.contentHash)) {
      return failure(
        "MESH_ASSET_HASH_INVALID",
        `Mesh asset ${recipe.assetId} has contentHash ${JSON.stringify(recipe.contentHash)}; admission requires exactly sha256: followed by 64 lowercase hexadecimal digits.`,
      );
    }
    const frame = resolveRecipeFrame(recipe);
    if (!frame.ok) return frame;

    const entry = preloaded.get(recipe.assetId);
    if (entry === undefined) {
      return failure(
        "MESH_ASSET_MISSING",
        `Mesh recipe ${recipe.assetId} is not in the closed preloaded asset set; preload that exact bundled asset before referencing it. Paths and network URLs are not accepted.`,
      );
    }
    if (entry.kind === "oversized") {
      return failure(
        "MESH_ASSET_OVERSIZED",
        `Mesh asset ${recipe.assetId} preloads ${entry.coordinateCount / 3} vertices, ${entry.indexCount === null ? "an unindexed mesh" : `${entry.indexCount / 3} indexed triangles`}, and ${entry.groupCount} groups; limits are ${boundedLimits.maxVertices} vertices, ${boundedLimits.maxTriangles} triangles, and ${boundedLimits.maxGroups} groups, so its arrays were not copied. Reduce the bundled asset before rendering it.`,
      );
    }
    const asset = entry.asset;
    if (!isValidMeshAssetId(asset.assetId)) {
      return failure(
        "MESH_ASSET_ID_INVALID",
        `Preloaded mesh key ${recipe.assetId} contains invalid asset id ${JSON.stringify(asset.assetId)}; restore the reviewed lowercase bundled identifier.`,
      );
    }

    const coordinateCount = asset.positionsLdu.length;
    if (coordinateCount > boundedLimits.maxVertices * 3) {
      return failure(
        "MESH_ASSET_OVERSIZED",
        `Mesh asset ${recipe.assetId} declares ${coordinateCount / 3} vertices, above the limit of ${boundedLimits.maxVertices}; reduce the preloaded asset before rendering it.`,
      );
    }
    if (coordinateCount < 9 || coordinateCount % 3 !== 0) {
      return failure(
        "MESH_ASSET_INDEX_INVALID",
        `Mesh asset ${recipe.assetId} has ${coordinateCount} position values; it needs at least nine values and complete xyz triples.`,
      );
    }
    const nonfinitePosition = asset.positionsLdu.findIndex((value) => !Number.isFinite(value));
    if (nonfinitePosition !== -1) {
      return failure(
        "MESH_ASSET_NONFINITE",
        `Mesh asset ${recipe.assetId} position value ${nonfinitePosition} is ${String(asset.positionsLdu[nonfinitePosition])}; every LDU coordinate must be finite.`,
      );
    }
    const normalsAssetLocal = asset.normalsAssetLocal ?? null;
    if (normalsAssetLocal !== null && normalsAssetLocal.length !== coordinateCount) {
      return failure(
        "MESH_ASSET_NORMAL_INVALID",
        `Mesh asset ${recipe.assetId} has ${coordinateCount / 3} positions but ${normalsAssetLocal.length / 3} asset-local normals; provide exactly one xyz unit normal per position or omit the field for a legacy asset.`,
      );
    }
    if (normalsAssetLocal !== null) {
      const nonfiniteNormal = normalsAssetLocal.findIndex((value) => !Number.isFinite(value));
      if (nonfiniteNormal !== -1) {
        return failure(
          "MESH_ASSET_NONFINITE",
          `Mesh asset ${recipe.assetId} normal value ${nonfiniteNormal} is ${String(normalsAssetLocal[nonfiniteNormal])}; every asset-local normal component must be finite.`,
        );
      }
      for (let vertex = 0; vertex < normalsAssetLocal.length / 3; vertex += 1) {
        const offset = vertex * 3;
        const length = Math.hypot(
          normalsAssetLocal[offset]!,
          normalsAssetLocal[offset + 1]!,
          normalsAssetLocal[offset + 2]!,
        );
        if (!Number.isFinite(length) || Math.abs(length - 1) > NORMAL_UNIT_TOLERANCE) {
          return failure(
            "MESH_ASSET_NORMAL_INVALID",
            `Mesh asset ${recipe.assetId} normal ${vertex} has length ${String(length)}; every source-faithful normal must be unit length within ${NORMAL_UNIT_TOLERANCE}. Regenerate it from the pinned LDraw hard-edge policy rather than normalizing untrusted bytes at render time.`,
          );
        }
      }
    }
    const vertexCount = coordinateCount / 3;
    const indices = asset.indices ?? null;
    let triangleCount: number;
    if (indices === null) {
      if (vertexCount % 3 !== 0) {
        return failure(
          "MESH_ASSET_INDEX_INVALID",
          `Unindexed mesh asset ${recipe.assetId} has ${vertexCount} vertices; an unindexed triangle mesh needs a multiple of three.`,
        );
      }
      triangleCount = vertexCount / 3;
    } else {
      if (indices.length > boundedLimits.maxTriangles * 3) {
        return failure(
          "MESH_ASSET_OVERSIZED",
          `Mesh asset ${recipe.assetId} declares ${indices.length / 3} indexed triangles, above the limit of ${boundedLimits.maxTriangles}; reduce the preloaded asset before rendering it.`,
        );
      }
      if (indices.length < 3 || indices.length % 3 !== 0) {
        return failure(
          "MESH_ASSET_INDEX_INVALID",
          `Mesh asset ${recipe.assetId} has ${indices.length} indices; a triangle index needs at least three entries and a multiple of three.`,
        );
      }
      const badIndex = indices.findIndex(
        (value) => !Number.isSafeInteger(value) || value < 0 || value >= vertexCount,
      );
      if (badIndex !== -1) {
        return failure(
          "MESH_ASSET_INDEX_INVALID",
          `Mesh asset ${recipe.assetId} index ${badIndex} is ${String(indices[badIndex])}, outside integer vertex range 0..${vertexCount - 1}.`,
        );
      }
      triangleCount = indices.length / 3;
    }
    if (triangleCount > boundedLimits.maxTriangles) {
      return failure(
        "MESH_ASSET_OVERSIZED",
        `Mesh asset ${recipe.assetId} declares ${triangleCount} triangles, above the limit of ${boundedLimits.maxTriangles}; reduce the preloaded asset before rendering it.`,
      );
    }
    const groupFailure = validateGroups(recipe.assetId, asset.groups, triangleCount);
    if (groupFailure !== null) return groupFailure;
    const triangleFailure = validateTriangles(
      asset.assetId,
      asset.positionsLdu,
      indices,
      triangleCount,
    );
    if (triangleFailure !== null) return triangleFailure;
    const outOfFloat32Range = asset.positionsLdu.findIndex(
      (value) => Math.abs(value) > MAX_FINITE_FLOAT32,
    );
    if (outOfFloat32Range !== -1) {
      return failure(
        "MESH_ASSET_FLOAT32_RANGE",
        `Mesh asset ${recipe.assetId} position value ${outOfFloat32Range} is ${String(asset.positionsLdu[outOfFloat32Range])}, outside finite Float32 range +/-${MAX_FINITE_FLOAT32}; reduce or reject the asset before BufferGeometry allocation.`,
      );
    }
    if (asset.assetId !== recipe.assetId) {
      return failure(
        "MESH_ASSET_TAMPERED",
        `Preloaded mesh key ${recipe.assetId} contains asset ${asset.assetId}; the registry key and integrity-bound asset id must match.`,
      );
    }
    const actualHash = meshAssetContentHash(asset);
    if (actualHash !== recipe.contentHash) {
      return failure(
        "MESH_ASSET_TAMPERED",
        `Mesh asset ${recipe.assetId} hashes to ${actualHash}, not catalog-pinned ${recipe.contentHash}; restore the reviewed bytes or update the catalog through an explicit admission.`,
      );
    }

    const matrix = frame.matrix;
    const [translateX, translateY, translateZ] = frame.translationLdu;
    const transformed: number[] = [];
    for (let index = 0; index < coordinateCount; index += 3) {
      const source: LduVector3 = [
        asset.positionsLdu[index]!,
        asset.positionsLdu[index + 1]!,
        asset.positionsLdu[index + 2]!,
      ];
      const catalogPosition = [
        matrix[0]! * source[0] + matrix[1]! * source[1] + matrix[2]! * source[2] + translateX,
        matrix[3]! * source[0] + matrix[4]! * source[1] + matrix[5]! * source[2] + translateY,
        matrix[6]! * source[0] + matrix[7]! * source[1] + matrix[8]! * source[2] + translateZ,
      ] as const;
      const invalidCoordinate = catalogPosition.findIndex(
        (coordinate) => !Number.isFinite(coordinate) || Math.abs(coordinate) > MAX_FINITE_FLOAT32,
      );
      if (invalidCoordinate !== -1) {
        return failure(
          "MESH_ASSET_FLOAT32_RANGE",
          `Mesh asset ${recipe.assetId} framed vertex ${index / 3} axis ${invalidCoordinate} becomes ${String(catalogPosition[invalidCoordinate])}, outside finite Float32 range after applying assetToCatalogFrame; reduce the asset or translation.`,
        );
      }
      transformed.push(...catalogPosition);
    }
    const normalsCatalogLocal: number[] | null =
      normalsAssetLocal === null
        ? null
        : normalsAssetLocal.reduce<number[]>((result, _component, index) => {
            if (index % 3 !== 0) return result;
            const source: LduVector3 = [
              normalsAssetLocal[index]!,
              normalsAssetLocal[index + 1]!,
              normalsAssetLocal[index + 2]!,
            ];
            const transformedNormal = [
              matrix[0]! * source[0] + matrix[1]! * source[1] + matrix[2]! * source[2],
              matrix[3]! * source[0] + matrix[4]! * source[1] + matrix[5]! * source[2],
              matrix[6]! * source[0] + matrix[7]! * source[1] + matrix[8]! * source[2],
            ];
            result.push(...transformedNormal.map((component) => Math.fround(component)));
            return result;
          }, []);

    // Mirror geometry.ts exactly: scale catalog LDU, invert Y, then assign into
    // a Float32Array. Precision loss is rejected before it can redefine
    // topology, extrema, bounds, preview coverage, or admission truth.
    const rendererPositions = transformed.map(
      (coordinate, index) => coordinate * MESH_RENDER_UNITS_PER_LDU * (index % 3 === 1 ? -1 : 1),
    );
    const quantizedRendererPositions = rendererPositions.map((coordinate) =>
      Math.fround(coordinate),
    );
    const nonfiniteRendererCoordinate = quantizedRendererPositions.findIndex(
      (coordinate) => !Number.isFinite(coordinate),
    );
    if (nonfiniteRendererCoordinate !== -1) {
      return failure(
        "MESH_ASSET_RENDER_PRECISION",
        `Mesh asset ${recipe.assetId} renderer coordinate ${nonfiniteRendererCoordinate} becomes ${String(quantizedRendererPositions[nonfiniteRendererCoordinate])} after exact LDU-to-render scaling and Float32 allocation. Reduce the asset or frame translation before rendering.`,
      );
    }
    const quantizedCatalogPositions = quantizedRendererPositions.map(
      (coordinate, index) => (coordinate * (index % 3 === 1 ? -1 : 1)) / MESH_RENDER_UNITS_PER_LDU,
    );
    const driftedCoordinate = quantizedCatalogPositions.findIndex(
      (coordinate, index) =>
        Math.abs(coordinate - transformed[index]!) > MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
    );
    if (driftedCoordinate !== -1) {
      const vertex = Math.floor(driftedCoordinate / 3);
      const axis = ["X", "Y", "Z"][driftedCoordinate % 3]!;
      const framedCoordinate = transformed[driftedCoordinate]!;
      const quantizedCoordinate = quantizedCatalogPositions[driftedCoordinate]!;
      return failure(
        "MESH_ASSET_RENDER_PRECISION",
        `Mesh asset ${recipe.assetId} framed vertex ${vertex} ${axis}=${framedCoordinate} maps through exact LDU-to-render scaling and Float32 allocation back to ${quantizedCoordinate}, drifting ${Math.abs(quantizedCoordinate - framedCoordinate)} LDU beyond tolerance ${MESH_RENDER_QUANTIZATION_TOLERANCE_LDU}. Reduce the frame translation or coordinate magnitude before topology, extrema, bounds, preview, admission, or rendering.`,
      );
    }
    const vertexPrecisionFailure = validateRendererVertexPrecision(
      asset.assetId,
      rendererPositions,
      quantizedRendererPositions,
      normalsCatalogLocal,
    );
    if (vertexPrecisionFailure !== null) return vertexPrecisionFailure;
    const rendererTriangleFailure = validateTriangles(
      asset.assetId,
      quantizedRendererPositions,
      indices,
      triangleCount,
      "MESH_ASSET_RENDER_PRECISION",
      "renderer Float32",
    );
    if (rendererTriangleFailure !== null) return rendererTriangleFailure;
    const rendererBoundsFailure = validateRendererBounds(
      asset,
      transformed,
      quantizedCatalogPositions,
      indices,
    );
    if (rendererBoundsFailure !== null) return rendererBoundsFailure;
    const topology = analyzeMeshTopology(
      { ...asset, positionsLdu: quantizedCatalogPositions },
      indices,
      vertexCount,
      triangleCount,
      boundedLimits.maxComponents,
    );
    if ("ok" in topology) return topology;

    return Object.freeze({
      ok: true,
      asset: Object.freeze({
        assetId: asset.assetId,
        positionsLdu: Object.freeze(quantizedCatalogPositions),
        normalsCatalogLocal:
          normalsCatalogLocal === null ? null : Object.freeze(normalsCatalogLocal),
        indices,
        groups: asset.groups,
        componentFirstTriangles: Object.freeze([...topology.componentFirstTriangles]),
        extremalTriangles: Object.freeze([...topology.extremalTriangles]),
        vertexCount,
        triangleCount,
      }),
    });
  };

  return (recipe) => {
    // Reject attacker-controlled strings and invalid frames before constructing
    // a cache key. Only finite, bounded, successful closed-set resolutions cache.
    if (
      (recipe as { readonly generatorId: unknown }).generatorId !== PRELOADED_MESH_GENERATOR_ID ||
      !isValidMeshAssetId(recipe.assetId) ||
      !isLowercaseSha256(recipe.contentHash)
    ) {
      return resolveUncached(recipe);
    }
    const frame = resolveRecipeFrame(recipe);
    if (!frame.ok) return frame;
    const cacheKey = [recipe.generatorId, recipe.assetId, recipe.contentHash, ...frame.cacheFields]
      .map((field) => `${field.length}:${field}`)
      .join("");
    const cached = resolutionCache.get(cacheKey);
    if (cached !== undefined) {
      resolutionCache.delete(cacheKey);
      resolutionCache.set(cacheKey, cached);
      return cached;
    }
    const resolution = resolveUncached(recipe);
    if (resolution.ok) {
      while (resolutionCache.size >= boundedLimits.maxResolvedCacheEntries) {
        const oldest = resolutionCache.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        resolutionCache.delete(oldest);
      }
      resolutionCache.set(cacheKey, resolution);
    }
    return resolution;
  };
}

// The closed production registry contains the 24 LDraw meshes admitted through
// catalog builtin.basic-parts/13. It cannot be mutated at runtime; a new asset
// enters only through a reviewed catalog admission.
const PRELOADED_PRODUCTION_MESH_ASSETS = SET_6651557_MESH_ASSETS;

export const resolvePreloadedMeshAsset = createPreloadedMeshAssetResolver(
  PRELOADED_PRODUCTION_MESH_ASSETS,
);
