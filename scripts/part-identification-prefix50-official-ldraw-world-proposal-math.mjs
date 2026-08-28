import {
  PREFIX50_OFFICIAL_LDRAW_HALF_LDU_TOLERANCE,
  PREFIX50_OFFICIAL_LDRAW_WORLD_ORIENTATION_TOLERANCE,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const MAX_POSITION_ABS_LDU = 10_000;

function determinant(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

function transpose(matrix) {
  return [
    matrix[0],
    matrix[3],
    matrix[6],
    matrix[1],
    matrix[4],
    matrix[7],
    matrix[2],
    matrix[5],
    matrix[8],
  ];
}

function multiply(left, right) {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset] * right[offset * 3 + column],
      0,
    );
  });
}

function requireProperRigidMatrix(matrix, label) {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const gram = multiply(transpose(matrix), matrix);
  const orthogonalResidual = Math.max(
    ...gram.map((value, index) => Math.abs(value - identity[index])),
  );
  const determinantResidual = Math.abs(determinant(matrix) - 1);
  if (orthogonalResidual > 1e-9 || determinantResidual > 1e-9) {
    throw new TypeError(
      `${label} must be a determinant-positive rigid matrix; orthogonal residual ${orthogonalResidual}, determinant residual ${determinantResidual}.`,
    );
  }
}

function requireProperOrientationRegistry(orientations) {
  if (!Array.isArray(orientations) || orientations.length !== 24) {
    throw new TypeError("Proper-orientation registry must contain exactly 24 rows.");
  }
  const keys = new Set();
  for (const [index, orientation] of orientations.entries()) {
    if (
      typeof orientation?.id !== "string" ||
      !Array.isArray(orientation.matrix) ||
      orientation.matrix.length !== 9 ||
      orientation.matrix.some((value) => ![-1, 0, 1].includes(value)) ||
      determinant(orientation.matrix) !== 1
    ) {
      throw new TypeError(
        `Proper-orientation registry row ${index} is not an exact proper signed permutation.`,
      );
    }
    const key = orientation.matrix.join(",");
    if (keys.has(key)) throw new TypeError(`Proper-orientation registry repeats matrix ${key}.`);
    keys.add(key);
  }
}

export function snapPrefix50ProperWorldOrientation(matrix, orientations) {
  if (
    !Array.isArray(matrix) ||
    matrix.length !== 9 ||
    matrix.some((value) => !Number.isFinite(value))
  ) {
    throw new TypeError("World orientation proposal requires exactly nine finite numbers.");
  }
  requireProperRigidMatrix(matrix, "World orientation proposal");
  requireProperOrientationRegistry(orientations);
  const candidates = orientations
    .map((orientation) => ({
      orientation,
      residual: Math.max(
        ...matrix.map((value, index) => Math.abs(value - orientation.matrix[index])),
      ),
    }))
    .filter(({ residual }) => residual <= PREFIX50_OFFICIAL_LDRAW_WORLD_ORIENTATION_TOLERANCE)
    .sort((left, right) => left.residual - right.residual);
  if (candidates.length !== 1) {
    throw new TypeError(
      `World orientation is not uniquely within ${PREFIX50_OFFICIAL_LDRAW_WORLD_ORIENTATION_TOLERANCE} of one proper signed permutation.`,
    );
  }
  return Object.freeze({
    orientationId: candidates[0].orientation.id,
    residual: candidates[0].residual,
  });
}

export function snapPrefix50HalfLduPosition(position) {
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    position.some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_POSITION_ABS_LDU)
  ) {
    throw new TypeError("World position proposal requires three finite bounded LDU coordinates.");
  }
  const doubled = position.map((value) => Math.round(value * 2));
  const snapped = doubled.map((value) => value / 2);
  const residual = Math.max(...position.map((value, axis) => Math.abs(value - snapped[axis])));
  if (residual > PREFIX50_OFFICIAL_LDRAW_HALF_LDU_TOLERANCE) {
    throw new TypeError(
      `World position is ${residual} LDU off the half-LDU proposal lattice; maximum is ${PREFIX50_OFFICIAL_LDRAW_HALF_LDU_TOLERANCE}.`,
    );
  }
  return Object.freeze({ positionLdu: Object.freeze(snapped), residual });
}
