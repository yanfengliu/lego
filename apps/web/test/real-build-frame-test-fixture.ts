import { getPartDefinition, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";

import { sha256Digest } from "../e2e/real-build-artifacts";
import type { BuilderCanonicalCalibration, LedgerTransform } from "../e2e/real-build-official";

type Point = readonly [number, number, number];

/** Synthetic cuboid Builder Shell bytes for deterministic frame-verifier tests only. */
export function builderCuboidGeometry(
  catalogPartId: string,
  transform: LedgerTransform,
): {
  readonly bytes: Buffer;
  readonly digest: string;
  readonly reference: BuilderCanonicalCalibration["designFrames"][number]["builderGeometry"];
} {
  const definition = getPartDefinition(catalogPartId);
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (definition === undefined || orientation === undefined) {
    throw new TypeError(`Cannot create test Builder geometry for ${catalogPartId}.`);
  }
  const { min, max } = definition.boundsLdu;
  const corners: readonly Point[] = [
    [min[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], max[1], max[2]],
  ];
  const triangleIndexes = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [3, 7, 6],
    [3, 6, 2],
    [0, 4, 7],
    [0, 7, 3],
    [1, 2, 6],
    [1, 6, 5],
  ] as const;
  const bytes = Buffer.alloc(triangleIndexes.length * 36);
  let offset = 0;
  for (const triangle of triangleIndexes) {
    for (const pointIndex of triangle) {
      const point = corners[pointIndex]!;
      const canonicalBuilder = [0, 1, 2].map(
        (row) =>
          transform.positionLdu[row]! +
          [0, 1, 2].reduce(
            (sum, column) => sum + orientation.matrix[row * 3 + column]! * point[column]!,
            0,
          ),
      );
      bytes.writeFloatLE(canonicalBuilder[0]! * 0.04, offset);
      bytes.writeFloatLE(-canonicalBuilder[1]! * 0.04, offset + 4);
      bytes.writeFloatLE(canonicalBuilder[2]! * 0.04, offset + 8);
      offset += 12;
    }
  }
  const bundleDigest = sha256Digest(bytes);
  return {
    bytes,
    digest: bundleDigest,
    reference: {
      format: "lego.builder-shell-triangles-f32le/1",
      bundleDigest,
      byteOffset: 0,
      byteLength: bytes.length,
      digest: bundleDigest,
    },
  };
}
