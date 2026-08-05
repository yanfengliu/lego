import { createHash } from "node:crypto";

import {
  BUILTIN_CATALOG_VERSION,
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
} from "@lego-studio/catalog";
import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";

import { enumeratePlacements } from "../src/assembly/enumerate-placements";
import { realBuildInputChainRecovery } from "./real-build-input-chain";
import {
  BUILDER_STEP1_CALIBRATION_CASES,
  BUILDER_STEP1_DESIGN_SOURCES,
  BUILDER_STEP1_GEOMETRY_BUNDLE,
  BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
  BUILDER_STEP1_ORIGIN_POLICY,
  type BuilderDesignSourcePin,
  type BuilderFramePoint,
  type BuilderTriangleSlicePin,
} from "./real-build-builder-sources";
import type {
  BuilderBoneTransform,
  LedgerTransform,
  OfficialModelIndex,
} from "./real-build-official";

export const BUILDER_CANONICAL_CALIBRATION_SCHEMA = "lego.builder-canonical-calibration/6" as const;
export const BUILDER_FRAME_EVIDENCE_PROTOCOL = "builder-type23-frame-plus-ldraw-surface/2" as const;

type FramePoint = BuilderFramePoint;
type FrameTriangle = readonly [FramePoint, FramePoint, FramePoint];

export interface BuilderFrameEvidence {
  readonly catalogDefinitionDigest: `sha256:${string}`;
  readonly catalogGeometryDigest: `sha256:${string}`;
  readonly connectorFrameDigest: `sha256:${string}`;
  readonly collisionFrameDigest: `sha256:${string}`;
  readonly catalogToBuilderLocalTransform: LedgerTransform;
  readonly trustedSourceDigest: `sha256:${string}`;
  readonly inputDigest: `sha256:${string}`;
  readonly evidenceDigest: `sha256:${string}`;
  readonly uniqueBuilderVertexCount: number;
  readonly builderTriangleCount: number;
  readonly ldrawTriangleCount: number;
  readonly p95SurfaceDistanceMicroLdu: number;
  readonly maximumSurfaceDistanceMicroLdu: number;
}

export interface BuilderCanonicalCalibration {
  readonly schemaVersion: typeof BUILDER_CANONICAL_CALIBRATION_SCHEMA;
  readonly officialModelDigest: string;
  readonly geometryBundle: {
    readonly format: typeof BUILDER_STEP1_GEOMETRY_BUNDLE.format;
    readonly byteLength: number;
    readonly digest: string;
  };
  readonly cases: readonly {
    readonly brickRef: string;
    readonly builderTransformationDigest: string;
    readonly expectedTransform: LedgerTransform;
  }[];
  readonly originPolicy: {
    readonly protocol: typeof BUILDER_STEP1_ORIGIN_POLICY.protocol;
    readonly anchorBrickRef: string;
    readonly anchorBuilderTransformationDigest: string;
    readonly expectedComposedTransform: LedgerTransform;
    readonly expectedEmptyEnumerationTransform: LedgerTransform;
  };
  readonly designFrames: readonly {
    readonly designRevision: string;
    readonly catalogPartId: string;
    readonly catalogVersion: string;
    readonly trustedSourceDigest: string;
    readonly catalogDefinitionDigest: string;
    readonly catalogGeometryDigest: string;
    readonly connectorFrameDigest: string;
    readonly collisionFrameDigest: string;
    readonly catalogToBuilderLocalTransform: LedgerTransform;
    readonly verification: {
      readonly protocol: typeof BUILDER_FRAME_EVIDENCE_PROTOCOL;
      readonly inputDigest: string;
      readonly evidenceDigest: string;
      readonly uniqueBuilderVertexCount: number;
      readonly builderTriangleCount: number;
      readonly ldrawTriangleCount: number;
      readonly p95SurfaceDistanceMicroLdu: number;
      readonly maximumSurfaceDistanceMicroLdu: number;
    };
  }[];
}

const digest = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

const pointKey = (point: FramePoint): string => point.map(normalizeZero).join(",");

const comparePoints = (left: FramePoint, right: FramePoint): number =>
  left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

const sortedPoints = (points: readonly FramePoint[]): FramePoint[] =>
  points.map((point) => point.map(normalizeZero) as unknown as FramePoint).sort(comparePoints);

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

function inverseTransformFramePoint(
  transform: LedgerTransform,
  point: FramePoint,
): FramePoint | null {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (orientation === undefined) return null;
  const translated = point.map(
    (coordinate, axis) => coordinate - transform.positionLdu[axis]!,
  ) as unknown as FramePoint;
  return [0, 1, 2].map((column) =>
    [0, 1, 2].reduce(
      (sum, row) => sum + orientation.matrix[row * 3 + column]! * translated[row]!,
      0,
    ),
  ) as unknown as FramePoint;
}

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

export function composeBuilderTransforms(
  world: LedgerTransform,
  catalogToBuilder: LedgerTransform,
  tolerance = 0.000001,
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
  const rotatedLocal = [0, 1, 2].map((row) =>
    [0, 1, 2].reduce(
      (sum, column) =>
        sum + worldOrientation.matrix[row * 3 + column]! * catalogToBuilder.positionLdu[column]!,
      0,
    ),
  );
  return {
    positionLdu: world.positionLdu.map(
      (coordinate, axis) => coordinate + rotatedLocal[axis]!,
    ) as unknown as LedgerTransform["positionLdu"],
    orientationId: orientation.id,
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

export function resolveBuilderBoneTransform(transform: BuilderBoneTransform): {
  readonly transform: LedgerTransform | null;
  readonly failure: string | null;
} {
  const matrix = transformedMatrix(transform.matrix);
  const orientation = UPRIGHT_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((expected, index) => Math.abs(expected - matrix[index]!) <= 0.000001),
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
    transform.position[0] / 0.04,
    -transform.position[1] / 0.04,
    transform.position[2] / 0.04,
  ] as const;
  const rounded = scaled.map(Math.round) as [number, number, number];
  const residual = Math.max(...scaled.map((value, index) => Math.abs(value - rounded[index]!)));
  if (residual > 0.001) {
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

function deriveUniqueCatalogToBuilderFrame(
  catalogStudCenters: readonly FramePoint[],
  builderStudCenters: readonly FramePoint[],
): LedgerTransform {
  if (catalogStudCenters.length < 1 || catalogStudCenters.length !== builderStudCenters.length) {
    throw new TypeError(
      `Builder type-23 stud set has ${builderStudCenters.length} centers while the catalog has ` +
        `${catalogStudCenters.length}; a missing, extra, or clutch-center substitution cannot calibrate a frame.`,
    );
  }
  const expectedKeys = sortedPoints(builderStudCenters).map(pointKey);
  const firstCatalog = catalogStudCenters[0]!;
  const candidates = new Map<string, LedgerTransform>();
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    const rotatedFirst = transformFramePoint(
      { positionLdu: [0, 0, 0], orientationId: orientation.id },
      firstCatalog,
    )!;
    for (const target of builderStudCenters) {
      const candidate: LedgerTransform = {
        positionLdu: target.map(
          (coordinate, axis) => coordinate - rotatedFirst[axis]!,
        ) as unknown as LedgerTransform["positionLdu"],
        orientationId: orientation.id,
      };
      const transformed = sortedPoints(
        catalogStudCenters.map((point) => transformFramePoint(candidate, point)!),
      ).map(pointKey);
      if (JSON.stringify(transformed) === JSON.stringify(expectedKeys)) {
        candidates.set(JSON.stringify(candidate), candidate);
      }
    }
  }
  if (candidates.size !== 1) {
    throw new TypeError(
      `Builder type-23 centers and catalog stud centers yield ${candidates.size} upright local frames; ` +
        `exactly one is required so geometry cannot choose its own registration.`,
    );
  }
  return [...candidates.values()][0]!;
}

function sliceBytes(bundleBytes: Uint8Array, reference: BuilderTriangleSlicePin): Buffer {
  if (
    !Number.isSafeInteger(reference.byteOffset) ||
    reference.byteOffset < 0 ||
    !Number.isSafeInteger(reference.byteLength) ||
    reference.byteLength !== reference.triangleCount * 36 ||
    reference.byteOffset + reference.byteLength > bundleBytes.length
  ) {
    throw new TypeError(
      `Pinned ${reference.format} slice ${reference.byteOffset}+${reference.byteLength} is outside the ` +
        `${bundleBytes.length}-byte bundle or disagrees with its ${reference.triangleCount}-triangle layout.`,
    );
  }
  const bytes = Buffer.from(
    bundleBytes.buffer,
    bundleBytes.byteOffset + reference.byteOffset,
    reference.byteLength,
  );
  if (digest(bytes) !== reference.digest) {
    throw new TypeError(
      `Pinned ${reference.format} slice at ${reference.byteOffset}+${reference.byteLength} does not ` +
        `reproduce ${reference.digest}; tandem-rehashed calibration metadata cannot replace reviewed source pins.`,
    );
  }
  return bytes;
}

function assertPinnedBundleLayout(): void {
  const sections = [
    ...BUILDER_STEP1_DESIGN_SOURCES.map(({ builderGeometry }) => builderGeometry),
    ...BUILDER_STEP1_DESIGN_SOURCES.map(({ ldrawReferenceGeometry }) => ldrawReferenceGeometry),
  ].sort((left, right) => left.byteOffset - right.byteOffset);
  let expectedOffset = 0;
  for (const section of sections) {
    if (section.byteOffset !== expectedOffset) {
      throw new TypeError(
        `Reviewed Builder geometry registry has a gap, overlap, or reordered section at byte ` +
          `${expectedOffset}; received ${section.format} at ${section.byteOffset}.`,
      );
    }
    expectedOffset += section.byteLength;
  }
  if (expectedOffset !== BUILDER_STEP1_GEOMETRY_BUNDLE.byteLength) {
    throw new TypeError(
      `Reviewed Builder geometry sections cover ${expectedOffset} bytes, not the exact ` +
        `${BUILDER_STEP1_GEOMETRY_BUNDLE.byteLength}-byte bundle.`,
    );
  }
}

function decodeTriangles(
  bundleBytes: Uint8Array,
  reference: BuilderTriangleSlicePin,
): FrameTriangle[] {
  const bytes = sliceBytes(bundleBytes, reference);
  const builder = reference.format === "lego.builder-shell-triangles-f32le/1";
  const triangles: FrameTriangle[] = [];
  for (let offset = 0; offset < bytes.length; offset += 36) {
    const triangle = Array.from({ length: 3 }, (_, pointIndex) => {
      const base = offset + pointIndex * 12;
      const encoded = [
        bytes.readFloatLE(base),
        bytes.readFloatLE(base + 4),
        bytes.readFloatLE(base + 8),
      ] as const;
      const decoded: FramePoint = builder
        ? [encoded[0] / 0.04, -encoded[1] / 0.04, encoded[2] / 0.04]
        : encoded;
      if (decoded.some((coordinate) => !Number.isFinite(coordinate))) {
        throw new TypeError(`Pinned ${reference.format} contains a non-finite coordinate.`);
      }
      return decoded;
    }) as unknown as FrameTriangle;
    triangles.push(triangle);
  }
  return triangles;
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

function pointSegmentDistance(point: FramePoint, start: FramePoint, end: FramePoint): number {
  const direction = subtract(end, start);
  const denominator = dot(direction, direction);
  const ratio =
    denominator <= 1e-24
      ? 0
      : Math.max(0, Math.min(1, dot(subtract(point, start), direction) / denominator));
  return distance(point, [
    start[0] + ratio * direction[0],
    start[1] + ratio * direction[1],
    start[2] + ratio * direction[2],
  ]);
}

function pointTriangleDistance(point: FramePoint, [a, b, c]: FrameTriangle): number {
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
  const denominator = va + vb + vc;
  if (Math.abs(denominator) <= 1e-24) {
    return Math.min(
      pointSegmentDistance(point, a, b),
      pointSegmentDistance(point, b, c),
      pointSegmentDistance(point, c, a),
    );
  }
  const v = vb / denominator;
  const w = vc / denominator;
  return distance(point, [
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ]);
}

/** Generic frame proof used by the fixed production registry and project-authored unit fixtures. */
export function createBuilderFrameEvidence(input: {
  readonly source: BuilderDesignSourcePin;
  readonly builderGeometryBundleBytes: Uint8Array;
  readonly builderGeometryBundleDigest: string;
}): BuilderFrameEvidence {
  const { source, builderGeometryBundleBytes, builderGeometryBundleDigest } = input;
  if (digest(builderGeometryBundleBytes) !== builderGeometryBundleDigest) {
    throw new TypeError(
      `Builder geometry bytes do not reproduce declared digest ${builderGeometryBundleDigest}.`,
    );
  }
  const definition = getPartDefinition(source.catalogPartId);
  if (definition === undefined) {
    throw new TypeError(
      `Pinned Builder source maps to absent catalog part ${source.catalogPartId}.`,
    );
  }
  const catalogDefinitionDigest = digest(JSON.stringify(definition));
  const catalogGeometryDigest = digest(JSON.stringify(definition.geometry));
  const connectorFrameDigest = digest(JSON.stringify(definition.connectors));
  const collisionFrameDigest = digest(JSON.stringify(definition.collision));
  if (
    catalogDefinitionDigest !== source.expectedCatalogDefinitionDigest ||
    catalogGeometryDigest !== source.expectedCatalogGeometryDigest ||
    connectorFrameDigest !== source.expectedCatalogConnectorDigest ||
    collisionFrameDigest !== source.expectedCatalogCollisionDigest
  ) {
    const differing = [
      ["definition", catalogDefinitionDigest, source.expectedCatalogDefinitionDigest],
      ["geometry", catalogGeometryDigest, source.expectedCatalogGeometryDigest],
      ["connector", connectorFrameDigest, source.expectedCatalogConnectorDigest],
      ["collision", collisionFrameDigest, source.expectedCatalogCollisionDigest],
    ]
      .filter(([, observed, expected]) => observed !== expected)
      .map(([role, observed, expected]) => `${role} ${expected} -> ${observed}`);
    throw new TypeError(
      `Pinned Builder source ${source.designRevision}/${source.catalogPartId} is stale against catalog ` +
        `${BUILTIN_CATALOG_VERSION}; ${differing.join(", ")}. ` +
        realBuildInputChainRecovery("apps/web/e2e/real-build-builder-sources.ts"),
    );
  }
  const pinnedCenters = sortedPoints(source.builderStudCentersLdu);
  if (digest(JSON.stringify(pinnedCenters)) !== source.builderStudCentersDigest) {
    throw new TypeError(
      `Pinned Builder type-23 centers for ${source.designRevision} do not reproduce ` +
        `${source.builderStudCentersDigest}.`,
    );
  }
  const catalogStudCenters = definition.connectors
    .filter(({ kind }) => kind === "stud")
    .map(({ positionLdu }) => positionLdu as FramePoint);
  const catalogToBuilderLocalTransform = deriveUniqueCatalogToBuilderFrame(
    catalogStudCenters,
    pinnedCenters,
  );
  const builderTriangles = decodeTriangles(builderGeometryBundleBytes, source.builderGeometry);
  const sourceLdrawTriangles = decodeTriangles(
    builderGeometryBundleBytes,
    source.ldrawReferenceGeometry,
  );
  const ldrawTriangles = sourceLdrawTriangles.map(
    (triangle) =>
      triangle.map((point) => {
        const transformed = transformFramePoint(source.ldrawToCatalogLocalTransform, point);
        if (transformed === null) {
          throw new TypeError(
            `Pinned LDraw-to-catalog frame for ${source.designRevision} is not an upright transform.`,
          );
        }
        return transformed;
      }) as unknown as FrameTriangle,
  );
  const uniqueBuilderPoints = new Map<string, FramePoint>();
  for (const point of builderTriangles.flat()) uniqueBuilderPoints.set(pointKey(point), point);
  if (
    builderTriangles.length !== source.sourceIdentity.shellTriangleCount ||
    builderTriangles.length !== source.builderGeometry.triangleCount ||
    uniqueBuilderPoints.size !== source.uniqueBuilderVertexCount ||
    ldrawTriangles.length !== source.ldrawReferenceGeometry.triangleCount
  ) {
    throw new TypeError(
      `Pinned geometry counts for ${source.designRevision} disagree with exact source sections: ` +
        `${builderTriangles.length} Builder triangles, ${uniqueBuilderPoints.size} unique Builder vertices, ` +
        `${ldrawTriangles.length} LDraw triangles.`,
    );
  }
  const distancesMicroLdu = [...uniqueBuilderPoints.values()].map((builderPoint) => {
    const catalogPoint = inverseTransformFramePoint(catalogToBuilderLocalTransform, builderPoint);
    if (catalogPoint === null) {
      throw new TypeError(`Derived Builder frame for ${source.designRevision} is not invertible.`);
    }
    let nearest = Number.POSITIVE_INFINITY;
    for (const triangle of ldrawTriangles) {
      nearest = Math.min(nearest, pointTriangleDistance(catalogPoint, triangle));
    }
    if (!Number.isFinite(nearest)) {
      throw new TypeError(
        `Surface evidence for ${source.designRevision} produced a non-finite distance.`,
      );
    }
    return Math.round(nearest * 1_000_000);
  });
  const ordered = [...distancesMicroLdu].sort((left, right) => left - right);
  const p95SurfaceDistanceMicroLdu =
    ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0;
  const maximumSurfaceDistanceMicroLdu = ordered.at(-1) ?? 0;
  if (p95SurfaceDistanceMicroLdu > 2_000_000 || maximumSurfaceDistanceMicroLdu > 2_000_000) {
    throw new TypeError(
      `Pinned Builder Shell ${source.designRevision} is not independently corroborated by the pinned ` +
        `expanded LDraw surface: p95=${p95SurfaceDistanceMicroLdu / 1_000_000} LDU, ` +
        `max=${maximumSurfaceDistanceMicroLdu / 1_000_000} LDU; both must be at most 2 LDU.`,
    );
  }
  const trustedSourceDigest = digest(JSON.stringify(source));
  const evidenceInput = {
    protocol: BUILDER_FRAME_EVIDENCE_PROTOCOL,
    catalogVersion: BUILTIN_CATALOG_VERSION,
    catalogDefinitionDigest,
    catalogGeometryDigest,
    connectorFrameDigest,
    collisionFrameDigest,
    trustedSourceDigest,
    builderGeometryBundleDigest,
    catalogToBuilderLocalTransform,
  };
  const inputDigest = digest(JSON.stringify(evidenceInput));
  return {
    catalogDefinitionDigest,
    catalogGeometryDigest,
    connectorFrameDigest,
    collisionFrameDigest,
    catalogToBuilderLocalTransform,
    trustedSourceDigest,
    inputDigest,
    evidenceDigest: digest(JSON.stringify({ inputDigest, distancesMicroLdu })),
    uniqueBuilderVertexCount: uniqueBuilderPoints.size,
    builderTriangleCount: builderTriangles.length,
    ldrawTriangleCount: ldrawTriangles.length,
    p95SurfaceDistanceMicroLdu,
    maximumSurfaceDistanceMicroLdu,
  };
}

function firstOrderedDirectBrickRef(official: OfficialModelIndex): string | null {
  for (const phase of official.builderOrder.phases) {
    if (phase.kind === "direct" && phase.brickRefs.length > 0) return phase.brickRefs[0]!;
  }
  return null;
}

function expectedFrameReport(
  source: BuilderDesignSourcePin,
  evidence: BuilderFrameEvidence,
): BuilderCanonicalCalibration["designFrames"][number] {
  return {
    designRevision: source.designRevision,
    catalogPartId: source.catalogPartId,
    catalogVersion: BUILTIN_CATALOG_VERSION,
    trustedSourceDigest: evidence.trustedSourceDigest,
    catalogDefinitionDigest: evidence.catalogDefinitionDigest,
    catalogGeometryDigest: evidence.catalogGeometryDigest,
    connectorFrameDigest: evidence.connectorFrameDigest,
    collisionFrameDigest: evidence.collisionFrameDigest,
    catalogToBuilderLocalTransform: evidence.catalogToBuilderLocalTransform,
    verification: {
      protocol: BUILDER_FRAME_EVIDENCE_PROTOCOL,
      inputDigest: evidence.inputDigest,
      evidenceDigest: evidence.evidenceDigest,
      uniqueBuilderVertexCount: evidence.uniqueBuilderVertexCount,
      builderTriangleCount: evidence.builderTriangleCount,
      ldrawTriangleCount: evidence.ldrawTriangleCount,
      p95SurfaceDistanceMicroLdu: evidence.p95SurfaceDistanceMicroLdu,
      maximumSurfaceDistanceMicroLdu: evidence.maximumSurfaceDistanceMicroLdu,
    },
  };
}

/** Recomputes the deterministic v6 report from reviewed pins; no output field authorizes itself. */
export function createBuilderCanonicalCalibration(
  official: OfficialModelIndex,
  builderGeometryBundleBytes: Uint8Array,
  builderGeometryBundleDigest: string,
): BuilderCanonicalCalibration {
  if (official.digest !== BUILDER_STEP1_OFFICIAL_MODEL_DIGEST) {
    throw new TypeError(
      `Builder v6 calibration is pinned to official model ${BUILDER_STEP1_OFFICIAL_MODEL_DIGEST}; ` +
        `received ${official.digest}. Rehashing a modified model cannot update this reviewed source pin.`,
    );
  }
  if (
    builderGeometryBundleBytes.length !== BUILDER_STEP1_GEOMETRY_BUNDLE.byteLength ||
    builderGeometryBundleDigest !== BUILDER_STEP1_GEOMETRY_BUNDLE.digest ||
    digest(builderGeometryBundleBytes) !== BUILDER_STEP1_GEOMETRY_BUNDLE.digest
  ) {
    throw new TypeError(
      `Builder v6 requires the exact ${BUILDER_STEP1_GEOMETRY_BUNDLE.byteLength}-byte reviewed geometry ` +
        `bundle ${BUILDER_STEP1_GEOMETRY_BUNDLE.digest}; appended, truncated, swapped, or tandem-rehashed ` +
        `bytes are forbidden.`,
    );
  }
  assertPinnedBundleLayout();
  for (const calibrationCase of BUILDER_STEP1_CALIBRATION_CASES) {
    const brick = official.bricks[calibrationCase.brickRef];
    if (
      brick?.builderTransform === null ||
      brick?.builderTransform === undefined ||
      brick.builderTransform.sourceDigest !== calibrationCase.builderTransformationDigest
    ) {
      throw new TypeError(
        `Reviewed Builder calibration case ${calibrationCase.brickRef} is absent or its exact raw Bone ` +
          `digest differs from ${calibrationCase.builderTransformationDigest}.`,
      );
    }
    const resolved = resolveBuilderBoneTransform(brick.builderTransform);
    if (JSON.stringify(resolved.transform) !== JSON.stringify(calibrationCase.expectedTransform)) {
      throw new TypeError(
        `Reviewed Builder calibration case ${calibrationCase.brickRef} resolves to ` +
          `${JSON.stringify(resolved.transform ?? resolved.failure)}, not ` +
          `${JSON.stringify(calibrationCase.expectedTransform)}.`,
      );
    }
  }
  const designFrames = BUILDER_STEP1_DESIGN_SOURCES.map((source) =>
    expectedFrameReport(
      source,
      createBuilderFrameEvidence({
        source,
        builderGeometryBundleBytes,
        builderGeometryBundleDigest,
      }),
    ),
  );
  return {
    schemaVersion: BUILDER_CANONICAL_CALIBRATION_SCHEMA,
    officialModelDigest: BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
    geometryBundle: BUILDER_STEP1_GEOMETRY_BUNDLE,
    cases: BUILDER_STEP1_CALIBRATION_CASES,
    originPolicy: BUILDER_STEP1_ORIGIN_POLICY,
    designFrames,
  };
}

function parseCanonicalCalibration(calibrationBytes: Uint8Array): BuilderCanonicalCalibration {
  const maximumCalibrationBytes = 64 * 1_024;
  if (calibrationBytes.length > maximumCalibrationBytes) {
    throw new TypeError(
      `Builder calibration is ${calibrationBytes.length} bytes; the canonical v6 report is bounded to ` +
        `${maximumCalibrationBytes} bytes. Remove unrelated or repeated data instead of increasing the limit.`,
    );
  }
  let source: string;
  let parsed: unknown;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(calibrationBytes);
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    throw new TypeError(
      `Builder calibration is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (JSON.stringify(parsed) !== source) {
    throw new TypeError(
      "Builder calibration must be canonical JSON with generator key order, no duplicate keys, whitespace, or alternate numeric spellings.",
    );
  }
  return parsed as BuilderCanonicalCalibration;
}

function addTranslation(transform: LedgerTransform, offset: FramePoint): LedgerTransform {
  return {
    positionLdu: transform.positionLdu.map(
      (coordinate, axis) => coordinate + offset[axis]!,
    ) as unknown as LedgerTransform["positionLdu"],
    orientationId: transform.orientationId,
  };
}

/** Applies only the reviewed retained-21066 v6 registry; callers cannot substitute trust pins. */
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
  const calibration = parseCanonicalCalibration(calibrationBytes);
  const expected = createBuilderCanonicalCalibration(
    official,
    builderGeometryBundleBytes,
    builderGeometryBundleDigest,
  );
  if (JSON.stringify(calibration) !== JSON.stringify(expected)) {
    const retainedVersions = [
      ...new Set(calibration.designFrames?.map(({ catalogVersion }) => catalogVersion) ?? []),
    ];
    throw new TypeError(
      `Builder calibration does not exactly reproduce the code-pinned ${BUILDER_CANONICAL_CALIBRATION_SCHEMA} ` +
        `report; artifact-authored sources, frames, cases, metrics, or extra fields are forbidden. ` +
        `The retained report is pinned to catalog ${retainedVersions.join(", ") || "an unstated version"} ` +
        `and this build is ${BUILTIN_CATALOG_VERSION}, so the usual cause is a catalog bump rather than ` +
        `a hand edit. ` +
        realBuildInputChainRecovery("output/real-build/builder-canonical-calibration.json"),
    );
  }
  const frames = new Map(calibration.designFrames.map((frame) => [frame.designRevision, frame]));
  const preNormalized = Object.fromEntries(
    Object.entries(official.bricks).map(([brickRef, brick]) => {
      if (brick.builderTransform === null) return [brickRef, null] as const;
      const resolved = resolveBuilderBoneTransform(brick.builderTransform);
      const frame = frames.get(brick.designRevision);
      return [
        brickRef,
        resolved.transform === null || frame === undefined
          ? null
          : composeBuilderTransforms(resolved.transform, frame.catalogToBuilderLocalTransform),
      ] as const;
    }),
  );
  const firstDirectBrickRef = firstOrderedDirectBrickRef(official);
  if (firstDirectBrickRef !== BUILDER_STEP1_ORIGIN_POLICY.anchorBrickRef) {
    throw new TypeError(
      `Builder canonical origin requires first ordered direct Brick ` +
        `${BUILDER_STEP1_ORIGIN_POLICY.anchorBrickRef}; received ${firstDirectBrickRef ?? "none"}.`,
    );
  }
  const anchorBrick = official.bricks[firstDirectBrickRef];
  const anchorTransform = preNormalized[firstDirectBrickRef];
  if (
    anchorBrick?.builderTransform?.sourceDigest !==
      BUILDER_STEP1_ORIGIN_POLICY.anchorBuilderTransformationDigest ||
    anchorTransform === null ||
    anchorTransform === undefined ||
    JSON.stringify(anchorTransform) !==
      JSON.stringify(BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform) ||
    anchorBrick.calibratedCatalogPartId !== null
  ) {
    throw new TypeError(
      `Builder origin anchor ${firstDirectBrickRef} does not reproduce its reviewed raw Bone and ` +
        `design-local composed transform ${JSON.stringify(BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform)}.`,
    );
  }
  const anchorFrame = frames.get(anchorBrick.designRevision)!;
  const empty = createEmptyBrickDocument({
    id: "builder-origin-calibration",
    name: "Builder origin calibration",
    maxParts: 1,
  });
  const enumeration = enumeratePlacements(empty, anchorFrame.catalogPartId, {
    orientationIds: [anchorTransform.orientationId],
    includeBuildPlate: true,
    maxDistinctTransforms: 1,
  });
  if (
    enumeration.candidates.length !== 1 ||
    JSON.stringify(enumeration.candidates[0]!.transform) !==
      JSON.stringify(BUILDER_STEP1_ORIGIN_POLICY.expectedEmptyEnumerationTransform)
  ) {
    throw new TypeError(
      `Builder origin anchor must reproduce the exact empty-document enumeration ` +
        `${JSON.stringify(BUILDER_STEP1_ORIGIN_POLICY.expectedEmptyEnumerationTransform)}; received ` +
        `${JSON.stringify(enumeration.candidates.map(({ transform }) => transform))}.`,
    );
  }
  const originOffset = enumeration.candidates[0]!.transform.positionLdu.map(
    (coordinate, axis) => coordinate - anchorTransform.positionLdu[axis]!,
  ) as unknown as FramePoint;
  const bricks = Object.fromEntries(
    Object.entries(official.bricks).map(([brickRef, brick]) => {
      const frame = frames.get(brick.designRevision);
      const composed = preNormalized[brickRef];
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
      if (frame === undefined || composed === null || composed === undefined) {
        const resolved = resolveBuilderBoneTransform(brick.builderTransform);
        return [
          brickRef,
          {
            ...brick,
            canonicalTransform: null,
            canonicalTransformFailure:
              resolved.failure ??
              `Design revision ${brick.designRevision} has no independently verified code-pinned Builder type-23 plus ` +
                `independent LDraw surface calibration.`,
            calibratedCatalogPartId: null,
            frameEvidenceDigest: null,
          },
        ];
      }
      return [
        brickRef,
        {
          ...brick,
          canonicalTransform: addTranslation(composed, originOffset),
          canonicalTransformFailure: null,
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
