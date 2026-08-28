import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";

import type { BuilderBoneTransform, LedgerTransform } from "./real-build-official";

type OrientationRegistry = readonly {
  readonly id: string;
  readonly matrix: readonly number[];
}[];

const multiplyMatrices = (left: readonly number[], right: readonly number[]): readonly number[] =>
  Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset]! * right[offset * 3 + column]!,
      0,
    );
  });

function composeFromRegistry(
  world: LedgerTransform,
  catalogToBuilder: LedgerTransform,
  orientations: OrientationRegistry,
  tolerance: number,
): LedgerTransform | null {
  const worldOrientation = orientations.find(({ id }) => id === world.orientationId);
  const localOrientation = orientations.find(({ id }) => id === catalogToBuilder.orientationId);
  if (worldOrientation === undefined || localOrientation === undefined) return null;
  const matrix = multiplyMatrices(worldOrientation.matrix, localOrientation.matrix);
  const orientation = orientations.find(({ matrix: candidate }) =>
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

/** Canonical composition remains restricted to the four authorable upright orientations. */
export function composeBuilderTransforms(
  world: LedgerTransform,
  catalogToBuilder: LedgerTransform,
  tolerance = 0.000001,
): LedgerTransform | null {
  return composeFromRegistry(world, catalogToBuilder, UPRIGHT_ORIENTATIONS, tolerance);
}

/** Diagnostic-only composition over the determinant-positive source-frame registry. */
export function composeBuilderProperTransforms(
  world: LedgerTransform,
  catalogToBuilder: LedgerTransform,
  tolerance = 0.000001,
): LedgerTransform | null {
  return composeFromRegistry(world, catalogToBuilder, PROPER_ORIENTATIONS, tolerance);
}

/**
 * The single right-handed LXFML-to-LDraw change of basis, shared by canonical and diagnostic reads.
 * The same signs bind rotation conjugation and translation scaling; reflections are never admitted.
 */
const LDD_TO_LDRAW_BASIS_SIGNS = [1, -1, -1] as const;

function transformedMatrix(matrix: BuilderBoneTransform["matrix"]): readonly number[] {
  return matrix.map((_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return (
      matrix[column * 3 + row]! * LDD_TO_LDRAW_BASIS_SIGNS[row]! * LDD_TO_LDRAW_BASIS_SIGNS[column]!
    );
  });
}

function latticePosition(transform: BuilderBoneTransform): {
  readonly positionLdu: readonly [number, number, number] | null;
  readonly residual: number;
} {
  const scaled = [
    (LDD_TO_LDRAW_BASIS_SIGNS[0] * transform.position[0]) / 0.04,
    (LDD_TO_LDRAW_BASIS_SIGNS[1] * transform.position[1]) / 0.04,
    (LDD_TO_LDRAW_BASIS_SIGNS[2] * transform.position[2]) / 0.04,
  ] as const;
  const positionLdu = scaled.map(Math.round) as [number, number, number];
  const residual = Math.max(...scaled.map((value, index) => Math.abs(value - positionLdu[index]!)));
  return { positionLdu: residual <= 0.001 ? positionLdu : null, residual };
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
  const { positionLdu, residual } = latticePosition(transform);
  if (positionLdu === null) {
    return {
      transform: null,
      failure:
        `Builder Bone position [${transform.position.join(",")}] is ${residual} LDU off the integer ` +
        `construction lattice after the versioned axis/unit calibration. Off-lattice placement is not ` +
        `representable by the current protocol.`,
    };
  }
  return { transform: { positionLdu, orientationId: orientation.id }, failure: null };
}

/** Resolves exact proper source data without making it a canonical document transform. */
export function resolveBuilderBoneProperTransform(transform: BuilderBoneTransform): {
  readonly transform: LedgerTransform | null;
  readonly failure: string | null;
} {
  const matrix = transformedMatrix(transform.matrix);
  const orientation = PROPER_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((expected, index) => Math.abs(expected - matrix[index]!) <= 0.000001),
  );
  if (orientation === undefined) {
    return {
      transform: null,
      failure:
        `Builder Bone orientation [${transform.matrix.join(",")}] is not one of the exact ` +
        `${PROPER_ORIENTATIONS.length} determinant-positive signed-permutation rotations; ` +
        `reflection, rounding, or arbitrary rotation is forbidden.`,
    };
  }
  const { positionLdu, residual } = latticePosition(transform);
  if (positionLdu === null) {
    return {
      transform: null,
      failure:
        `Builder Bone position [${transform.position.join(",")}] is ${residual} LDU off the integer ` +
        `construction lattice after the versioned axis/unit calibration. Off-lattice diagnostic ` +
        `placement is not representable.`,
    };
  }
  return { transform: { positionLdu, orientationId: orientation.id }, failure: null };
}
