import { createHash } from "node:crypto";

import {
  BUILTIN_CATALOG_VERSION,
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
} from "@lego-studio/catalog";

import type { StepFailure } from "./real-build-safety";

export const BUILDER_CANONICAL_CALIBRATION_SCHEMA = "lego.builder-canonical-calibration/5" as const;

export interface LedgerTransform {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
}

export interface BuilderBoneTransform {
  readonly matrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  readonly position: readonly [number, number, number];
  readonly sourceDigest: string;
}

export interface OfficialBrickRecord {
  readonly brickRef: string;
  readonly designId: string;
  readonly designRevision: string;
  readonly materialId: string;
  readonly builderTransform: BuilderBoneTransform | null;
  readonly builderTransformFailure: string | null;
  readonly canonicalTransform: LedgerTransform | null;
  readonly canonicalTransformFailure: string | null;
  readonly calibratedCatalogPartId: string | null;
  readonly frameEvidenceDigest: string | null;
}

export interface OfficialModelIndex {
  readonly digest: string;
  readonly calibrationDigest: string | null;
  readonly builderGeometryDigest: string | null;
  readonly bricks: Readonly<Record<string, OfficialBrickRecord>>;
  readonly instructionBrickRefs: ReadonlySet<string>;
  readonly directBrickRefs: ReadonlySet<string>;
  readonly multiBuildByActualRef: ReadonlyMap<string, string>;
  readonly unmatchedInventoryBrickRefs: ReadonlySet<string>;
}

export interface BuilderCanonicalCalibration {
  readonly schemaVersion: typeof BUILDER_CANONICAL_CALIBRATION_SCHEMA;
  readonly matrixConvention: "lxf-row-major-transposed-to-canonical-column-vector";
  readonly builderUnitsPerLdu: 0.04;
  readonly axisMapping: readonly ["x", "-y", "z"];
  readonly maximumMatrixError: 0.000001;
  readonly maximumPositionErrorLdu: 0.001;
  readonly maximumFrameP95DistanceLdu: 2;
  readonly builderGeometryBundleDigest: string;
  readonly cases: readonly {
    readonly brickRef: string;
    readonly builderTransformationDigest: string;
    readonly expectedTransform: LedgerTransform;
  }[];
  readonly designFrames: readonly {
    readonly designRevision: string;
    readonly catalogPartId: string;
    readonly catalogVersion: string;
    readonly catalogDefinitionDigest: string;
    readonly route: "builder-native" | "verified-ldraw-fallback";
    readonly catalogToBuilderLocalTransform: LedgerTransform;
    readonly builderGeometry: {
      readonly format: "lego.builder-shell-triangles-f32le/1";
      readonly bundleDigest: string;
      readonly byteOffset: number;
      readonly byteLength: number;
      readonly digest: string;
    };
    readonly catalogGeometryDigest: string;
    readonly connectorFrameDigest: string;
    readonly collisionFrameDigest: string;
    readonly verification: {
      readonly protocol: "builder-native-manifest-frame/1" | "builder-ldraw-surface-alignment/1";
      readonly inputDigest: string;
      readonly evidenceDigest: string;
      readonly sampleCount: number;
      readonly builderTriangleCount: number;
      readonly p95SurfaceDistanceLdu: number;
    };
  }[];
}

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const attributes = (source: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...source.matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/gu)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );

const baseDesign = (value: string): string => value.split(";", 1)[0]!;
const baseMaterial = (value: string): string => value.split(":", 1)[0]!;

function parseBone(
  source: string,
  brickRef: string,
): {
  readonly transform: BuilderBoneTransform | null;
  readonly failure: string | null;
} {
  const bones = [...source.matchAll(/<Bone\b([^>]*)\/?\s*>/gu)];
  if (bones.length !== 1) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} has ${bones.length} Bone transforms; the current rigid-part protocol requires exactly one.`,
    };
  }
  const encoded = attributes(bones[0]![1]!).transformation;
  if (encoded === undefined) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} Bone has no transformation attribute.`,
    };
  }
  const values = encoded.split(",").map(Number);
  if (values.length !== 12 || values.some((value) => !Number.isFinite(value))) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} Bone transformation must contain 12 finite numbers; received ${values.length}.`,
    };
  }
  const tuple = values as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return {
    transform: {
      matrix: tuple.slice(0, 9) as unknown as BuilderBoneTransform["matrix"],
      position: tuple.slice(9, 12) as unknown as BuilderBoneTransform["position"],
      sourceDigest: digest(JSON.stringify(tuple)),
    },
    failure: null,
  };
}

/** Parses stable instruction identities and the exact Builder Bone transform for each physical Brick. */
export function parseOfficialModelIndex(xmlBytes: Uint8Array): OfficialModelIndex {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
  const bricks: Record<string, OfficialBrickRecord> = {};
  for (const match of xml.matchAll(/<Brick\b([^>]*)>([\s\S]*?)<\/Brick>/gu)) {
    const brick = attributes(match[1]!);
    const brickRef = brick.uuid;
    if (brickRef === undefined) continue;
    const parts = [...match[2]!.matchAll(/<Part\b([^>]*)>/gu)];
    if (parts.length !== 1) {
      throw new TypeError(
        `Official physical Brick ${brickRef} must contain exactly one Part; received ${parts.length}.`,
      );
    }
    const part = attributes(parts[0]![1]!);
    if (part.designID === undefined || part.materials === undefined) {
      throw new TypeError(`Official physical Brick ${brickRef} lacks Part designID/materials.`);
    }
    if (bricks[brickRef] !== undefined) {
      throw new TypeError(`Official model repeats physical Brick uuid ${brickRef}.`);
    }
    const bone = parseBone(match[2]!, brickRef);
    bricks[brickRef] = {
      brickRef,
      designId: baseDesign(part.designID),
      designRevision: part.designID,
      materialId: baseMaterial(part.materials),
      builderTransform: bone.transform,
      builderTransformFailure: bone.failure,
      canonicalTransform: null,
      canonicalTransformFailure: "Builder-to-canonical calibration has not been applied.",
      calibratedCatalogPartId: null,
      frameEvidenceDigest: null,
    };
  }
  const instructionBrickRefs = new Set<string>();
  for (const match of xml.matchAll(/<In\b([^>]*)\/?\s*>/gu)) {
    const brickRef = attributes(match[1]!).brickRef;
    if (brickRef !== undefined) {
      if (instructionBrickRefs.has(brickRef)) {
        throw new TypeError(`Official instructions repeat In brickRef ${brickRef}.`);
      }
      instructionBrickRefs.add(brickRef);
    }
  }
  const multiBuildByActualRef = new Map<string, string>();
  for (const match of xml.matchAll(/<MultiBuildBrick\b([^>]*)\/?\s*>/gu)) {
    const entry = attributes(match[1]!);
    if (entry.actualBrickRef === undefined || entry.originalBrickRef === undefined) continue;
    if (multiBuildByActualRef.has(entry.actualBrickRef)) {
      throw new TypeError(
        `Official model repeats MultiBuild actual Brick ${entry.actualBrickRef}.`,
      );
    }
    multiBuildByActualRef.set(entry.actualBrickRef, entry.originalBrickRef);
  }
  const directBrickRefs = new Set(
    [...instructionBrickRefs].filter((brickRef) => !multiBuildByActualRef.has(brickRef)),
  );
  const unmatchedInventoryBrickRefs = new Set(
    Object.keys(bricks).filter((brickRef) => !instructionBrickRefs.has(brickRef)),
  );
  if (Object.keys(bricks).length < 1 || instructionBrickRefs.size < 1) {
    throw new TypeError(
      "Official model XML has no physical Brick/Part and instruction In identities.",
    );
  }
  for (const brickRef of instructionBrickRefs) {
    if (bricks[brickRef] === undefined) {
      throw new TypeError(`Official instruction In references missing physical Brick ${brickRef}.`);
    }
  }
  for (const [actualBrickRef, originalBrickRef] of multiBuildByActualRef) {
    if (
      !instructionBrickRefs.has(actualBrickRef) ||
      !instructionBrickRefs.has(originalBrickRef) ||
      bricks[actualBrickRef] === undefined ||
      bricks[originalBrickRef] === undefined
    ) {
      throw new TypeError(
        `Official MultiBuild ${actualBrickRef} -> ${originalBrickRef} is not a valid instruction Brick pair.`,
      );
    }
  }
  return {
    digest: digest(xmlBytes),
    calibrationDigest: null,
    builderGeometryDigest: null,
    bricks,
    instructionBrickRefs,
    directBrickRefs,
    multiBuildByActualRef,
    unmatchedInventoryBrickRefs,
  };
}

function transformedMatrix(matrix: BuilderBoneTransform["matrix"]): readonly number[] {
  const signs = [1, -1, 1] as const;
  return matrix.map((_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return matrix[column * 3 + row]! * signs[row]! * signs[column]!;
  });
}

const SHA256 = /^sha256:[0-9a-f]{64}$/u;

function multiplyMatrices(left: readonly number[], right: readonly number[]): readonly number[] {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset]! * right[offset * 3 + column]!,
      0,
    );
  });
}

function composeTransforms(
  world: LedgerTransform,
  catalogToBuilder: LedgerTransform,
  tolerance: number,
): LedgerTransform | null {
  const worldOrientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === world.orientationId);
  const localOrientation = UPRIGHT_ORIENTATIONS.find(
    ({ id }) => id === catalogToBuilder.orientationId,
  );
  if (worldOrientation === undefined || localOrientation === undefined) return null;
  const matrix = multiplyMatrices(worldOrientation.matrix, localOrientation.matrix);
  const orientation = UPRIGHT_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((expected, index) => Math.abs(expected - matrix[index]!) <= tolerance),
  );
  if (orientation === undefined) return null;
  const local = catalogToBuilder.positionLdu;
  const rotated = [0, 1, 2].map((row) =>
    [0, 1, 2].reduce(
      (sum, column) => sum + worldOrientation.matrix[row * 3 + column]! * local[column]!,
      0,
    ),
  );
  return {
    positionLdu: world.positionLdu.map(
      (coordinate, axis) => coordinate + rotated[axis]!,
    ) as unknown as LedgerTransform["positionLdu"],
    orientationId: orientation.id,
  };
}

type DesignFrame = BuilderCanonicalCalibration["designFrames"][number];
type FramePoint = readonly [number, number, number];
type BuilderTriangle = readonly [FramePoint, FramePoint, FramePoint];

const FRAME_SAMPLE_COUNT = 256;
const MAX_BUILDER_GEOMETRY_BYTES = 24 * 1024 * 1024;
const MAX_BUILDER_GEOMETRY_BUNDLE_BYTES = 256 * 1024 * 1024;

function transformFramePoint(transform: LedgerTransform, point: FramePoint): FramePoint | null {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (orientation === undefined) return null;
  return [0, 1, 2].map(
    (row) =>
      transform.positionLdu[row]! +
      [0, 1, 2].reduce(
        (sum, column) => sum + orientation.matrix[row * 3 + column]! * point[column]!,
        0,
      ),
  ) as unknown as FramePoint;
}

function radicalInverse(value: number, base: number): number {
  let result = 0;
  let fraction = 1 / base;
  for (let cursor = value; cursor > 0; cursor = Math.floor(cursor / base)) {
    result += (cursor % base) * fraction;
    fraction /= base;
  }
  return result;
}

/** Fixed quasi-uniform catalog-frame landmarks; callers cannot choose correspondence pairs. */
function catalogFrameSamples(bounds: {
  readonly min: FramePoint;
  readonly max: FramePoint;
}): FramePoint[] {
  return Array.from({ length: FRAME_SAMPLE_COUNT }, (_, index) => {
    const face = index % 6;
    const sequence = Math.floor(index / 6) + 1;
    const u = radicalInverse(sequence, 2);
    const v = radicalInverse(sequence, 3);
    const x = bounds.min[0] + (bounds.max[0] - bounds.min[0]) * u;
    const y = bounds.min[1] + (bounds.max[1] - bounds.min[1]) * v;
    const z = bounds.min[2] + (bounds.max[2] - bounds.min[2]) * (1 - u);
    switch (face) {
      case 0:
        return [bounds.min[0], y, z];
      case 1:
        return [bounds.max[0], y, z];
      case 2:
        return [x, bounds.min[1], z];
      case 3:
        return [x, bounds.max[1], z];
      case 4:
        return [x, y, bounds.min[2]];
      default:
        return [x, y, bounds.max[2]];
    }
  });
}

const subtract = (left: FramePoint, right: FramePoint): FramePoint => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
];
const dot = (left: FramePoint, right: FramePoint): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
const distance = (left: FramePoint, right: FramePoint): number =>
  Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);

/** Exact point-to-triangle distance, used against retained raw Builder Shell triangles. */
function pointTriangleDistance(point: FramePoint, [a, b, c]: BuilderTriangle): number {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return distance(point, a);
  const bp = subtract(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return distance(point, b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const ratio = d1 / (d1 - d3);
    return distance(point, [a[0] + ratio * ab[0], a[1] + ratio * ab[1], a[2] + ratio * ab[2]]);
  }
  const cp = subtract(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return distance(point, c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const ratio = d2 / (d2 - d6);
    return distance(point, [a[0] + ratio * ac[0], a[1] + ratio * ac[1], a[2] + ratio * ac[2]]);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const ratio = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return distance(point, [
      b[0] + ratio * (c[0] - b[0]),
      b[1] + ratio * (c[1] - b[1]),
      b[2] + ratio * (c[2] - b[2]),
    ]);
  }
  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  return distance(point, [
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ]);
}

function decodeBuilderTriangles(
  geometry: DesignFrame["builderGeometry"],
  bundleBytes: Uint8Array,
  bundleDigest: string,
): BuilderTriangle[] | null {
  const expectedKeys = ["bundleDigest", "byteLength", "byteOffset", "digest", "format"];
  if (
    geometry?.format !== "lego.builder-shell-triangles-f32le/1" ||
    Object.keys(geometry).sort().join(",") !== expectedKeys.sort().join(",") ||
    geometry.bundleDigest !== bundleDigest ||
    !SHA256.test(geometry.bundleDigest) ||
    !SHA256.test(geometry.digest) ||
    !Number.isInteger(geometry.byteOffset) ||
    geometry.byteOffset < 0 ||
    !Number.isInteger(geometry.byteLength) ||
    geometry.byteLength < 12 * 36 ||
    geometry.byteLength > MAX_BUILDER_GEOMETRY_BYTES ||
    geometry.byteOffset + geometry.byteLength > bundleBytes.length
  ) {
    return null;
  }
  const slice = bundleBytes.subarray(
    geometry.byteOffset,
    geometry.byteOffset + geometry.byteLength,
  );
  const bytes = Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
  if (bytes.length % 36 !== 0 || digest(bytes) !== geometry.digest) {
    return null;
  }
  const triangles: BuilderTriangle[] = [];
  for (let offset = 0; offset < bytes.length; offset += 36) {
    const points = Array.from({ length: 3 }, (_, pointIndex) => {
      const base = offset + pointIndex * 12;
      const builder = [
        bytes.readFloatLE(base),
        bytes.readFloatLE(base + 4),
        bytes.readFloatLE(base + 8),
      ] as const;
      return [builder[0] / 0.04, -builder[1] / 0.04, builder[2] / 0.04] as FramePoint;
    }) as unknown as BuilderTriangle;
    if (
      points
        .flat()
        .some((coordinate) => !Number.isFinite(coordinate) || Math.abs(coordinate) > 1_000_000)
    ) {
      return null;
    }
    const ab = subtract(points[1], points[0]);
    const ac = subtract(points[2], points[0]);
    const cross: FramePoint = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    if (dot(cross, cross) <= 1e-12) return null;
    triangles.push(points);
  }
  return triangles;
}

function recomputeFrameEvidence(input: {
  readonly catalogPartId: string;
  readonly catalogToBuilderLocalTransform: LedgerTransform;
  readonly builderGeometry: DesignFrame["builderGeometry"];
  readonly builderGeometryBundleBytes: Uint8Array;
  readonly builderGeometryBundleDigest: string;
  readonly protocol: DesignFrame["verification"]["protocol"];
}): {
  readonly catalogDefinitionDigest: string;
  readonly catalogGeometryDigest: string;
  readonly connectorFrameDigest: string;
  readonly collisionFrameDigest: string;
  readonly inputDigest: string;
  readonly evidenceDigest: string;
  readonly sampleCount: number;
  readonly builderTriangleCount: number;
  readonly p95SurfaceDistanceLdu: number;
} | null {
  const definition = getPartDefinition(input.catalogPartId);
  const triangles = decodeBuilderTriangles(
    input.builderGeometry,
    input.builderGeometryBundleBytes,
    input.builderGeometryBundleDigest,
  );
  if (definition === undefined || triangles === null) return null;
  const catalogDefinitionDigest = digest(JSON.stringify(definition));
  const catalogGeometryDigest = digest(JSON.stringify(definition.geometry));
  const connectorFrameDigest = digest(JSON.stringify(definition.connectors));
  const collisionFrameDigest = digest(JSON.stringify(definition.collision));
  const samples = catalogFrameSamples(definition.boundsLdu);
  const distances = samples.map((sample) => {
    const transformed = transformFramePoint(input.catalogToBuilderLocalTransform, sample);
    if (transformed === null) return Number.NaN;
    let nearest = Number.POSITIVE_INFINITY;
    for (const triangle of triangles) {
      nearest = Math.min(nearest, pointTriangleDistance(transformed, triangle));
    }
    return nearest;
  });
  if (distances.some((distance) => !Number.isFinite(distance))) return null;
  const ordered = [...distances].sort((left, right) => left - right);
  const p95SurfaceDistanceLdu = ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0;
  const evidenceInput = {
    protocol: input.protocol,
    catalogPartId: input.catalogPartId,
    catalogVersion: BUILTIN_CATALOG_VERSION,
    catalogDefinitionDigest,
    catalogGeometryDigest,
    connectorFrameDigest,
    collisionFrameDigest,
    builderGeometry: {
      format: input.builderGeometry.format,
      bundleDigest: input.builderGeometry.bundleDigest,
      byteOffset: input.builderGeometry.byteOffset,
      byteLength: input.builderGeometry.byteLength,
      digest: input.builderGeometry.digest,
    },
    builderTriangleCount: triangles.length,
    catalogToBuilderLocalTransform: input.catalogToBuilderLocalTransform,
    samplingProtocol: "catalog-bounds-halton-256-to-builder-triangle-surface/1",
  };
  const inputDigest = digest(JSON.stringify(evidenceInput));
  return {
    catalogDefinitionDigest,
    catalogGeometryDigest,
    connectorFrameDigest,
    collisionFrameDigest,
    inputDigest,
    evidenceDigest: digest(JSON.stringify({ inputDigest, distances })),
    sampleCount: samples.length,
    builderTriangleCount: triangles.length,
    p95SurfaceDistanceLdu,
  };
}

/** Recomputes frame evidence from exact retained Builder triangle bytes; callers cannot supply samples. */
export function createBuilderFrameEvidence(input: {
  readonly catalogPartId: string;
  readonly catalogToBuilderLocalTransform: LedgerTransform;
  readonly builderGeometry: DesignFrame["builderGeometry"];
  readonly builderGeometryBundleBytes: Uint8Array;
  readonly builderGeometryBundleDigest: string;
  readonly protocol: DesignFrame["verification"]["protocol"];
}): NonNullable<ReturnType<typeof recomputeFrameEvidence>> {
  const evidence = recomputeFrameEvidence(input);
  if (evidence === null) {
    throw new TypeError(
      `Cannot create Builder frame evidence for catalog part ${input.catalogPartId}.`,
    );
  }
  return evidence;
}

function resolveBoneTransform(
  transform: BuilderBoneTransform,
  calibration: BuilderCanonicalCalibration,
): { readonly transform: LedgerTransform | null; readonly failure: string | null } {
  const matrix = transformedMatrix(transform.matrix);
  const orientation = UPRIGHT_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every(
      (expected, index) => Math.abs(expected - matrix[index]!) <= calibration.maximumMatrixError,
    ),
  );
  if (orientation === undefined) {
    return {
      transform: null,
      failure:
        `Builder Bone orientation [${transform.matrix.join(",")}] cannot be expressed by the current ` +
        `canonical upright quarter-turn protocol. Add a reviewed transform type; rounding or substituting an ` +
        `upright orientation is forbidden.`,
    };
  }
  const scaled = [
    transform.position[0] / calibration.builderUnitsPerLdu,
    -transform.position[1] / calibration.builderUnitsPerLdu,
    transform.position[2] / calibration.builderUnitsPerLdu,
  ] as const;
  const rounded = scaled.map(Math.round) as [number, number, number];
  const residual = Math.max(...scaled.map((value, index) => Math.abs(value - rounded[index]!)));
  if (residual > calibration.maximumPositionErrorLdu) {
    return {
      transform: null,
      failure:
        `Builder Bone position [${transform.position.join(",")}] is ${residual} LDU off the integer ` +
        `construction lattice after the versioned axis/unit calibration. Off-lattice placement is not ` +
        `representable by the current protocol.`,
    };
  }
  return {
    transform: { positionLdu: rounded, orientationId: orientation.id },
    failure: null,
  };
}

function assertCalibrationShape(calibration: BuilderCanonicalCalibration): void {
  if (
    calibration.schemaVersion !== BUILDER_CANONICAL_CALIBRATION_SCHEMA ||
    calibration.matrixConvention !== "lxf-row-major-transposed-to-canonical-column-vector" ||
    calibration.builderUnitsPerLdu !== 0.04 ||
    calibration.maximumMatrixError !== 0.000001 ||
    calibration.maximumPositionErrorLdu !== 0.001 ||
    calibration.maximumFrameP95DistanceLdu !== 2 ||
    !SHA256.test(calibration.builderGeometryBundleDigest) ||
    calibration.axisMapping.length !== 3 ||
    calibration.axisMapping[0] !== "x" ||
    calibration.axisMapping[1] !== "-y" ||
    calibration.axisMapping[2] !== "z" ||
    !Array.isArray(calibration.cases) ||
    !Array.isArray(calibration.designFrames)
  ) {
    throw new TypeError(
      `Builder calibration must use ${BUILDER_CANONICAL_CALIBRATION_SCHEMA} with the fixed LXF ` +
        `row-to-column transpose, 0.04 Builder-units/LDU, x/-y/z mapping, and reviewed tolerances.`,
    );
  }
}

/** Recomputes every calibration case from raw Bone data, then resolves every physical Brick. */
export function applyBuilderCanonicalCalibration(
  official: OfficialModelIndex,
  calibrationBytes: Uint8Array,
  calibrationDigest: string,
  builderGeometryBundleBytes: Uint8Array,
  builderGeometryBundleDigest: string,
): OfficialModelIndex {
  if (digest(calibrationBytes) !== calibrationDigest) {
    throw new TypeError(
      `Builder calibration bytes do not match their declared digest ${calibrationDigest}.`,
    );
  }
  let calibration: BuilderCanonicalCalibration;
  try {
    calibration = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(calibrationBytes),
    ) as BuilderCanonicalCalibration;
  } catch (error) {
    throw new TypeError(
      `Builder calibration is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  assertCalibrationShape(calibration);
  if (!/^sha256:[0-9a-f]{64}$/u.test(calibrationDigest)) {
    throw new TypeError(`Builder calibration digest is malformed: ${calibrationDigest}.`);
  }
  if (
    !SHA256.test(builderGeometryBundleDigest) ||
    builderGeometryBundleBytes.length < 12 * 36 ||
    builderGeometryBundleBytes.length > MAX_BUILDER_GEOMETRY_BUNDLE_BYTES ||
    digest(builderGeometryBundleBytes) !== builderGeometryBundleDigest ||
    calibration.builderGeometryBundleDigest !== builderGeometryBundleDigest
  ) {
    throw new TypeError(
      `Builder geometry bundle must be a separate bounded raw input whose exact bytes reproduce ` +
        `${calibration.builderGeometryBundleDigest}; embedded calibration geometry is forbidden.`,
    );
  }
  const frames = new Map<string, BuilderCanonicalCalibration["designFrames"][number]>();
  for (const [index, frame] of calibration.designFrames.entries()) {
    const digestFields = [
      frame.builderGeometry?.digest,
      frame.builderGeometry?.bundleDigest,
      frame.catalogGeometryDigest,
      frame.catalogDefinitionDigest,
      frame.connectorFrameDigest,
      frame.collisionFrameDigest,
      frame.verification.inputDigest,
      frame.verification.evidenceDigest,
    ];
    const native = frame.route === "builder-native";
    const catalogDefinition = getPartDefinition(frame.catalogPartId);
    const recomputed = recomputeFrameEvidence({
      catalogPartId: frame.catalogPartId,
      catalogToBuilderLocalTransform: frame.catalogToBuilderLocalTransform,
      builderGeometry: frame.builderGeometry,
      builderGeometryBundleBytes,
      builderGeometryBundleDigest,
      protocol: frame.verification.protocol,
    });
    const identityLocalFrame =
      frame.catalogToBuilderLocalTransform.orientationId === "upright-yaw-0" &&
      frame.catalogToBuilderLocalTransform.positionLdu.every((coordinate) => coordinate === 0);
    if (
      frames.has(frame.designRevision) ||
      frame.designRevision.length < 1 ||
      frame.catalogPartId.length < 1 ||
      (frame.route !== "builder-native" && frame.route !== "verified-ldraw-fallback") ||
      frame.catalogVersion !== BUILTIN_CATALOG_VERSION ||
      catalogDefinition === undefined ||
      digest(JSON.stringify(catalogDefinition)) !== frame.catalogDefinitionDigest ||
      recomputed === null ||
      recomputed.catalogDefinitionDigest !== frame.catalogDefinitionDigest ||
      recomputed.catalogGeometryDigest !== frame.catalogGeometryDigest ||
      recomputed.connectorFrameDigest !== frame.connectorFrameDigest ||
      recomputed.collisionFrameDigest !== frame.collisionFrameDigest ||
      recomputed.inputDigest !== frame.verification.inputDigest ||
      recomputed.evidenceDigest !== frame.verification.evidenceDigest ||
      recomputed.sampleCount !== frame.verification.sampleCount ||
      recomputed.builderTriangleCount !== frame.verification.builderTriangleCount ||
      recomputed.p95SurfaceDistanceLdu !== frame.verification.p95SurfaceDistanceLdu ||
      frame.catalogToBuilderLocalTransform.positionLdu.length !== 3 ||
      frame.catalogToBuilderLocalTransform.positionLdu.some(
        (coordinate) => !Number.isInteger(coordinate),
      ) ||
      !UPRIGHT_ORIENTATIONS.some(
        ({ id }) => id === frame.catalogToBuilderLocalTransform.orientationId,
      ) ||
      digestFields.some((value) => !SHA256.test(value)) ||
      !Number.isInteger(frame.verification.sampleCount) ||
      frame.verification.sampleCount !== FRAME_SAMPLE_COUNT ||
      !Number.isInteger(frame.verification.builderTriangleCount) ||
      frame.verification.builderTriangleCount < 12 ||
      !Number.isFinite(frame.verification.p95SurfaceDistanceLdu) ||
      frame.verification.p95SurfaceDistanceLdu < 0 ||
      frame.verification.p95SurfaceDistanceLdu > calibration.maximumFrameP95DistanceLdu ||
      (native &&
        (frame.verification.protocol !== "builder-native-manifest-frame/1" ||
          !identityLocalFrame ||
          frame.verification.p95SurfaceDistanceLdu > 0.001)) ||
      (!native && frame.verification.protocol !== "builder-ldraw-surface-alignment/1")
    ) {
      throw new TypeError(
        `Builder design-frame calibration ${index} (${frame.designRevision}/${frame.catalogPartId}) ` +
          `is duplicate, malformed, stale against catalog ${BUILTIN_CATALOG_VERSION}, above the fixed ` +
          `2 LDU p95 limit, or inconsistent with its route.`,
      );
    }
    frames.set(frame.designRevision, frame);
  }
  const uniqueCases = new Set<string>();
  const orientations = new Set<string>();
  for (const [index, calibrationCase] of calibration.cases.entries()) {
    const brick = official.bricks[calibrationCase.brickRef];
    if (
      uniqueCases.has(calibrationCase.brickRef) ||
      brick?.builderTransform === null ||
      brick?.builderTransform === undefined
    ) {
      throw new TypeError(
        `Builder calibration case ${index} references a missing, duplicate, or transformless Brick ${calibrationCase.brickRef}.`,
      );
    }
    uniqueCases.add(calibrationCase.brickRef);
    if (brick.builderTransform.sourceDigest !== calibrationCase.builderTransformationDigest) {
      throw new TypeError(
        `Builder calibration case ${calibrationCase.brickRef} does not bind its exact raw Bone transform.`,
      );
    }
    const resolved = resolveBoneTransform(brick.builderTransform, calibration);
    if (
      resolved.transform === null ||
      resolved.transform.orientationId !== calibrationCase.expectedTransform.orientationId ||
      resolved.transform.positionLdu.some(
        (coordinate, axis) => coordinate !== calibrationCase.expectedTransform.positionLdu[axis],
      )
    ) {
      throw new TypeError(
        `Builder calibration case ${calibrationCase.brickRef} recomputes to ` +
          `${JSON.stringify(resolved.transform ?? resolved.failure)}, not ` +
          `${JSON.stringify(calibrationCase.expectedTransform)}.`,
      );
    }
    orientations.add(resolved.transform.orientationId);
  }
  if (
    calibration.cases.length < UPRIGHT_ORIENTATIONS.length ||
    UPRIGHT_ORIENTATIONS.some(({ id }) => !orientations.has(id))
  ) {
    throw new TypeError(
      "Builder calibration must contain independently retained cases covering all four canonical upright orientations.",
    );
  }
  const bricks = Object.fromEntries(
    Object.entries(official.bricks).map(([brickRef, brick]) => {
      if (brick.builderTransform === null) {
        return [
          brickRef,
          {
            ...brick,
            canonicalTransform: null,
            canonicalTransformFailure: brick.builderTransformFailure,
          },
        ];
      }
      const resolved = resolveBoneTransform(brick.builderTransform, calibration);
      const frame = frames.get(brick.designRevision);
      if (resolved.transform === null || frame === undefined) {
        return [
          brickRef,
          {
            ...brick,
            canonicalTransform: null,
            canonicalTransformFailure:
              resolved.failure ??
              `Design revision ${brick.designRevision} has no independently verified Builder-native or ` +
                `per-design LDraw catalog-frame calibration.`,
            calibratedCatalogPartId: null,
            frameEvidenceDigest: null,
          },
        ];
      }
      const composed = composeTransforms(
        resolved.transform,
        frame.catalogToBuilderLocalTransform,
        calibration.maximumMatrixError,
      );
      return [
        brickRef,
        {
          ...brick,
          canonicalTransform: composed,
          canonicalTransformFailure:
            composed === null
              ? `Design revision ${brick.designRevision} frame cannot compose into an upright canonical transform.`
              : null,
          calibratedCatalogPartId: frame.catalogPartId,
          frameEvidenceDigest: frame.verification.evidenceDigest,
        },
      ];
    }),
  );
  return {
    ...official,
    calibrationDigest,
    builderGeometryDigest: builderGeometryBundleDigest,
    bricks,
  };
}

export function validateOfficialModelAccounting(
  official: OfficialModelIndex,
): readonly StepFailure[] {
  const unmatched = [...official.unmatchedInventoryBrickRefs].map(
    (brickRef) => official.bricks[brickRef],
  );
  if (
    official.directBrickRefs.size === 1_395 &&
    official.multiBuildByActualRef.size === 69 &&
    official.instructionBrickRefs.size === 1_464 &&
    Object.keys(official.bricks).length === 1_465 &&
    unmatched.length === 1 &&
    unmatched[0]?.designId === "31510"
  ) {
    return [];
  }
  return [
    {
      code: "official-model-accounting-mismatch",
      stage: "input",
      inputKey: "officialModel",
      message:
        `Official XML independently yields ${official.directBrickRefs.size} direct + ` +
        `${official.multiBuildByActualRef.size} MultiBuild = ${official.instructionBrickRefs.size} ` +
        `instruction identities from ${Object.keys(official.bricks).length} physical Bricks, with unmatched ` +
        `[${unmatched.map((brick) => brick?.designId ?? "missing").join(",") || "none"}]. ` +
        `Set 6651557 requires exactly 1395 + 69 = 1464 and one unmatched 31510 separator.`,
    },
  ];
}

export function officialTransformFailure(
  brick: OfficialBrickRecord,
  stepNumber: number,
): StepFailure {
  const frameMissing =
    brick.calibratedCatalogPartId === null &&
    brick.canonicalTransformFailure?.includes("no independently verified") === true;
  return {
    code: frameMissing
      ? "official-frame-calibration-missing"
      : "official-transform-unrepresentable",
    stage: "input",
    inputKey: brick.brickRef,
    stepNumber,
    message:
      `Official Brick ${brick.brickRef} (${brick.designId}/${brick.materialId}) has no exact canonical ` +
      `transform: ${brick.canonicalTransformFailure ?? brick.builderTransformFailure ?? "missing Bone"}.`,
  };
}
