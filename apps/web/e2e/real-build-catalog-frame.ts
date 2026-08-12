import {
  UPRIGHT_ORIENTATIONS,
  type LduVector3,
  type OrientationMatrix,
} from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

type Point = readonly [number, number, number];

/** A horizontal proper or improper D4 frame in catalog LDU coordinates. */
export interface FrameTransform {
  readonly matrix: OrientationMatrix;
  readonly translationLdu: LduVector3;
}

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

export function requireFrame(frame: FrameTransform): FrameTransform {
  const { matrix, translationLdu } = frame;
  if (
    !Array.isArray(matrix) ||
    matrix.length !== 9 ||
    !matrix.every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 1) ||
    matrix[1] !== 0 ||
    matrix[3] !== 0 ||
    matrix[4] !== 1 ||
    matrix[5] !== 0 ||
    matrix[7] !== 0
  ) {
    throw new TypeError(
      `Catalog realization frame matrix ${JSON.stringify(matrix)} is not a horizontal D4 matrix that preserves catalog Y.`,
    );
  }
  const xx = matrix[0]! * matrix[0]! + matrix[6]! * matrix[6]!;
  const zz = matrix[2]! * matrix[2]! + matrix[8]! * matrix[8]!;
  const xz = matrix[0]! * matrix[2]! + matrix[6]! * matrix[8]!;
  const determinant = matrix[0]! * matrix[8]! - matrix[2]! * matrix[6]!;
  if (xx !== 1 || zz !== 1 || xz !== 0 || Math.abs(determinant) !== 1) {
    throw new TypeError(
      `Catalog realization frame matrix ${JSON.stringify(matrix)} is not orthogonal in the XZ plane.`,
    );
  }
  if (
    !Array.isArray(translationLdu) ||
    translationLdu.length !== 3 ||
    !translationLdu.every(Number.isSafeInteger)
  ) {
    throw new TypeError(
      `Catalog realization frame translation ${JSON.stringify(translationLdu)} must be three safe-integer LDU coordinates.`,
    );
  }
  return frame;
}

export function rotateFramePoint(frame: FrameTransform, point: Point): Point {
  const m = frame.matrix;
  return [
    normalizeZero(m[0] * point[0] + m[1] * point[1] + m[2] * point[2]),
    normalizeZero(m[3] * point[0] + m[4] * point[1] + m[5] * point[2]),
    normalizeZero(m[6] * point[0] + m[7] * point[1] + m[8] * point[2]),
  ];
}

export function applyFramePoint(frame: FrameTransform, point: Point): Point {
  const mapped = rotateFramePoint(frame, point);
  return mapped.map((value, axis) =>
    normalizeZero(value + frame.translationLdu[axis]!),
  ) as unknown as Point;
}

export function rigidTransformToFrameTransform(transform: RigidTransform): FrameTransform {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (orientation === undefined) {
    throw new TypeError(
      `Rigid transform orientation ${JSON.stringify(transform.orientationId)} is not one of ${UPRIGHT_ORIENTATIONS.map(({ id }) => id).join(", ")}.`,
    );
  }
  return requireFrame({ matrix: orientation.matrix, translationLdu: transform.positionLdu });
}

/** Composes `parent . local`, including a diagnostic improper parent frame. */
export function composeFrameTransforms(parentValue: FrameTransform, localValue: FrameTransform) {
  const parent = requireFrame(parentValue);
  const local = requireFrame(localValue);
  const matrix = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, inner) => sum + parent.matrix[row * 3 + inner]! * local.matrix[inner * 3 + column]!,
      0,
    );
  }) as unknown as OrientationMatrix;
  const rotatedTranslation = rotateFramePoint(parent, local.translationLdu as Point);
  return requireFrame({
    matrix,
    translationLdu: rotatedTranslation.map((value, axis) =>
      normalizeZero(value + parent.translationLdu[axis]!),
    ) as unknown as LduVector3,
  });
}

export function invertFrameTransform(frameValue: FrameTransform): FrameTransform {
  const frame = requireFrame(frameValue);
  const matrix: OrientationMatrix = [
    frame.matrix[0],
    frame.matrix[3],
    frame.matrix[6],
    frame.matrix[1],
    frame.matrix[4],
    frame.matrix[7],
    frame.matrix[2],
    frame.matrix[5],
    frame.matrix[8],
  ];
  const rotated = rotateFramePoint({ matrix, translationLdu: [0, 0, 0] }, frame.translationLdu);
  return requireFrame({
    matrix,
    translationLdu: rotated.map((value) => normalizeZero(-value)) as unknown as LduVector3,
  });
}

export const frameTransformKey = (frameValue: FrameTransform): string => {
  const frame = requireFrame(frameValue);
  return JSON.stringify([frame.matrix, frame.translationLdu]);
};
