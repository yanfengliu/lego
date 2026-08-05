import { describe, expect, it } from "vitest";

import type { LduBounds, LduVector3, OrientationMatrix } from "@lego-studio/catalog";

import {
  ORIENTED_BOX_MATRIX_TOLERANCE,
  ORIENTED_BOX_MAX_SAT_AXES,
  ORIENTED_BOX_OVERLAP_TOLERANCE_LDU,
  isProperOrthonormalMatrix,
  orientedBoxBounds,
  orientedBoxCorners,
  orientedBoxesShareVolume,
  type OrientedBox,
} from "./oriented-box-overlap.ts";
import { rotateLduVector } from "./transforms.ts";

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const satisfies OrientationMatrix;

function box(
  centerLdu: LduVector3,
  halfExtentsLdu: LduVector3,
  orientation: OrientationMatrix = IDENTITY,
): OrientedBox {
  return { centerLdu, halfExtentsLdu, orientation };
}

function boundsOverlap(left: LduBounds, right: LduBounds): boolean {
  return left.min.every(
    (minimum, axis) => minimum < right.max[axis]! && right.min[axis]! < left.max[axis]!,
  );
}

function matrixAxes(matrix: OrientationMatrix): readonly LduVector3[] {
  return [
    [matrix[0], matrix[3], matrix[6]],
    [matrix[1], matrix[4], matrix[7]],
    [matrix[2], matrix[5], matrix[8]],
  ];
}

function cross(left: LduVector3, right: LduVector3): LduVector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

// --------------------------------------------------------------------------
// Exact oracle.
//
// Every finite binary64 is exactly `mantissa * 2 ** exponent` for an integer
// mantissa, so the entire separating-axis test can be evaluated in BigInt with
// no rounding anywhere. This oracle deliberately shares no arithmetic with the
// implementation: it never normalizes an axis, never divides, never rounds, and
// differences the two centers exactly rather than in binary64. A reference that
// transliterates the implementation's own float formulation reproduces the
// implementation's rounding and therefore cannot witness an error in it.
// Layout per IEEE 754-2019 §3.4 binary64: one sign bit, an 11-bit exponent
// biased by 1023, and a 52-bit trailing significand with an implicit leading
// one for a nonzero biased exponent.
// --------------------------------------------------------------------------

interface Dyadic {
  readonly mantissa: bigint;
  readonly exponent: number;
}
type ExactVector = readonly [Dyadic, Dyadic, Dyadic];

const EXACT_BITS = new DataView(new ArrayBuffer(8));
const EXACT_ZERO: Dyadic = { mantissa: 0n, exponent: 0 };

/**
 * Relative half-width of the band around a separating-axis gap in which a
 * binary64 kernel may legitimately land on either side of exact truth. Both the
 * gap and the scale it is measured against are homogeneous of degree one in the
 * axis, so the ratio is independent of axis normalization.
 */
const EXACT_DECISION_BAND = 1e-12;

function exact(value: number): Dyadic {
  if (!Number.isFinite(value)) throw new Error(`exact oracle received a non-finite ${value}`);
  EXACT_BITS.setFloat64(0, value);
  const bits = EXACT_BITS.getBigUint64(0);
  const sign = bits >> 63n === 1n ? -1n : 1n;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xf_ffff_ffff_ffffn;
  return biased === 0
    ? { mantissa: sign * fraction, exponent: -1074 }
    : { mantissa: sign * (fraction + (1n << 52n)), exponent: biased - 1075 };
}

function exactAdd(left: Dyadic, right: Dyadic): Dyadic {
  const exponent = Math.min(left.exponent, right.exponent);
  return {
    mantissa:
      (left.mantissa << BigInt(left.exponent - exponent)) +
      (right.mantissa << BigInt(right.exponent - exponent)),
    exponent,
  };
}

const exactNegate = (value: Dyadic): Dyadic => ({
  mantissa: -value.mantissa,
  exponent: value.exponent,
});
const exactSubtract = (left: Dyadic, right: Dyadic): Dyadic => exactAdd(left, exactNegate(right));
const exactMultiply = (left: Dyadic, right: Dyadic): Dyadic => ({
  mantissa: left.mantissa * right.mantissa,
  exponent: left.exponent + right.exponent,
});
const exactAbsolute = (value: Dyadic): Dyadic => (value.mantissa < 0n ? exactNegate(value) : value);

function exactCompare(left: Dyadic, right: Dyadic): number {
  const difference = exactSubtract(left, right).mantissa;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

const exactVector = (values: readonly [number, number, number]): ExactVector => [
  exact(values[0]),
  exact(values[1]),
  exact(values[2]),
];
const exactDot = (left: ExactVector, right: ExactVector): Dyadic =>
  exactAdd(
    exactAdd(exactMultiply(left[0], right[0]), exactMultiply(left[1], right[1])),
    exactMultiply(left[2], right[2]),
  );
const exactCross = (left: ExactVector, right: ExactVector): ExactVector => [
  exactSubtract(exactMultiply(left[1], right[2]), exactMultiply(left[2], right[1])),
  exactSubtract(exactMultiply(left[2], right[0]), exactMultiply(left[0], right[2])),
  exactSubtract(exactMultiply(left[0], right[1]), exactMultiply(left[1], right[0])),
];

function exactAxes(subject: OrientedBox): readonly [ExactVector, ExactVector, ExactVector] {
  const matrix = subject.orientation;
  return [
    exactVector([matrix[0], matrix[3], matrix[6]]),
    exactVector([matrix[1], matrix[4], matrix[7]]),
    exactVector([matrix[2], matrix[5], matrix[8]]),
  ];
}

function exactReach(subject: OrientedBox, axes: readonly ExactVector[], axis: ExactVector): Dyadic {
  let total = EXACT_ZERO;
  for (let index = 0; index < 3; index += 1) {
    total = exactAdd(
      total,
      exactMultiply(
        exact(subject.halfExtentsLdu[index]!),
        exactAbsolute(exactDot(axes[index]!, axis)),
      ),
    );
  }
  return total;
}

/**
 * Exact fifteen-axis SAT verdict. `decisive` is false when some axis's gap sits
 * inside EXACT_DECISION_BAND, the band where binary64 rounding alone can flip
 * that axis and therefore the verdict.
 */
function exactShareVolume(
  left: OrientedBox,
  right: OrientedBox,
): { share: boolean; decisive: boolean } {
  const leftAxes = exactAxes(left);
  const rightAxes = exactAxes(right);
  const faces = (axes: readonly [ExactVector, ExactVector, ExactVector]): ExactVector[] => [
    exactCross(axes[1], axes[2]),
    exactCross(axes[2], axes[0]),
    exactCross(axes[0], axes[1]),
  ];
  const candidates = [
    ...faces(leftAxes),
    ...faces(rightAxes),
    ...leftAxes.flatMap((leftAxis) =>
      rightAxes.map((rightAxis) => exactCross(leftAxis, rightAxis)),
    ),
  ];
  if (candidates.length !== ORIENTED_BOX_MAX_SAT_AXES) throw new Error("oracle axis count drifted");
  const delta = [0, 1, 2].map((axis) =>
    exactSubtract(exact(right.centerLdu[axis]!), exact(left.centerLdu[axis]!)),
  ) as unknown as ExactVector;
  const band = exact(EXACT_DECISION_BAND);
  let separated = false;
  let decisive = true;
  for (const axis of candidates) {
    if (axis.every((component) => component.mantissa === 0n)) continue;
    const distance = exactAbsolute(exactDot(delta, axis));
    const reach = exactAdd(exactReach(left, leftAxes, axis), exactReach(right, rightAxes, axis));
    const gap = exactSubtract(distance, reach);
    if (exactCompare(gap, EXACT_ZERO) >= 0) separated = true;
    const scale = exactMultiply(band, exactAdd(distance, reach));
    if (exactCompare(exactAbsolute(gap), scale) <= 0) decisive = false;
  }
  return { share: !separated, decisive };
}

/** The exact axis-aligned bounds of a source box, with no rounding at all. */
function exactBounds(subject: OrientedBox): { min: ExactVector; max: ExactVector } {
  const axes = exactAxes(subject);
  const min: Dyadic[] = [];
  const max: Dyadic[] = [];
  for (let worldAxis = 0; worldAxis < 3; worldAxis += 1) {
    let span = EXACT_ZERO;
    for (let localAxis = 0; localAxis < 3; localAxis += 1) {
      span = exactAdd(
        span,
        exactMultiply(
          exact(subject.halfExtentsLdu[localAxis]!),
          exactAbsolute(axes[localAxis]![worldAxis]!),
        ),
      );
    }
    const center = exact(subject.centerLdu[worldAxis]!);
    min.push(exactSubtract(center, span));
    max.push(exactAdd(center, span));
  }
  return { min: min as unknown as ExactVector, max: max as unknown as ExactVector };
}

// --------------------------------------------------------------------------

function multiply(left: OrientationMatrix, right: OrientationMatrix): OrientationMatrix {
  return [
    left[0] * right[0] + left[1] * right[3] + left[2] * right[6],
    left[0] * right[1] + left[1] * right[4] + left[2] * right[7],
    left[0] * right[2] + left[1] * right[5] + left[2] * right[8],
    left[3] * right[0] + left[4] * right[3] + left[5] * right[6],
    left[3] * right[1] + left[4] * right[4] + left[5] * right[7],
    left[3] * right[2] + left[4] * right[5] + left[5] * right[8],
    left[6] * right[0] + left[7] * right[3] + left[8] * right[6],
    left[6] * right[1] + left[7] * right[4] + left[8] * right[7],
    left[6] * right[2] + left[7] * right[5] + left[8] * right[8],
  ];
}

function eulerRotation(x: number, y: number, z: number): OrientationMatrix {
  const [cx, sx, cy, sy, cz, sz] = [
    Math.cos(x),
    Math.sin(x),
    Math.cos(y),
    Math.sin(y),
    Math.cos(z),
    Math.sin(z),
  ];
  const rotateX: OrientationMatrix = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const rotateY: OrientationMatrix = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rotateZ: OrientationMatrix = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return multiply(rotateZ, multiply(rotateY, rotateX));
}

function axisAngleRotation(axis: LduVector3, angle: number): OrientationMatrix {
  const [x, y, z] = axis;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const complement = 1 - cosine;
  return [
    cosine + x * x * complement,
    x * y * complement - z * sine,
    x * z * complement + y * sine,
    y * x * complement + z * sine,
    cosine + y * y * complement,
    y * z * complement - x * sine,
    z * x * complement - y * sine,
    z * y * complement + x * sine,
    cosine + z * z * complement,
  ];
}

function separatedOnAxis(
  leftCorners: readonly LduVector3[],
  rightCorners: readonly LduVector3[],
  axis: LduVector3,
): boolean {
  const project = (point: LduVector3): number =>
    point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2];
  const left = leftCorners.map(project);
  const right = rightCorners.map(project);
  return Math.max(...left) <= Math.min(...right) || Math.max(...right) <= Math.min(...left);
}

/** Deterministic linear congruential sequence, so every sample set is fixed. */
function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const randomRotation = (random: () => number): OrientationMatrix =>
  eulerRotation(random() * Math.PI, random() * Math.PI, random() * Math.PI);
const randomExtents = (random: () => number, scale = 1): LduVector3 => [
  scale * (0.1 + random() * 2),
  scale * (0.1 + random() * 2),
  scale * (0.1 + random() * 2),
];
const randomCenter = (random: () => number, scale = 1): LduVector3 => [
  (random() - 0.5) * 8 * scale,
  (random() - 0.5) * 8 * scale,
  (random() - 0.5) * 8 * scale,
];

describe("oriented-box overlap", () => {
  it("accepts only a proper orthonormal rotation without repairing it", () => {
    const quarterTurn = [0, -1, 0, 1, 0, 0, 0, 0, 1] as const;
    expect(isProperOrthonormalMatrix(IDENTITY)).toBe(true);
    expect(isProperOrthonormalMatrix(quarterTurn)).toBe(true);
    expect(isProperOrthonormalMatrix([-1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(false);
    expect(isProperOrthonormalMatrix([2, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(false);
    expect(isProperOrthonormalMatrix([1, 0.1, 0, 0, 1, 0, 0, 0, 1])).toBe(false);
    expect(isProperOrthonormalMatrix([1, 0, 0, 0, 1, 0, 0, 0, Number.NaN])).toBe(false);
    expect(isProperOrthonormalMatrix([1, 0, 0])).toBe(false);
  });

  it("pins the orthonormality tolerance on both sides of 1e-9", () => {
    expect(ORIENTED_BOX_MATRIX_TOLERANCE).toBe(1e-9);
    // A shear is measured by the off-diagonal dot product, which equals the
    // shear itself: the sharp edge of the accepted band.
    const shear = (amount: number): readonly number[] => [1, amount, 0, 0, 1, 0, 0, 0, 1];
    expect(isProperOrthonormalMatrix(shear(9.9e-10))).toBe(true);
    expect(isProperOrthonormalMatrix(shear(1e-9))).toBe(true);
    expect(isProperOrthonormalMatrix(shear(1.01e-9))).toBe(false);
    // A tolerance loose enough to admit this shear as truth would displace a
    // corner of a 100 LDU half-extent part by 0.1 LDU.
    expect(isProperOrthonormalMatrix(shear(1e-3))).toBe(false);
    // A uniform scale is caught by the determinant instead, which deviates by
    // three times the scale error: a second, independent edge of the same band.
    const uniformScale = (factor: number): readonly number[] => [
      factor,
      0,
      0,
      0,
      factor,
      0,
      0,
      0,
      factor,
    ];
    expect((1 + 3.3e-10) ** 3 - 1).toBeLessThanOrEqual(ORIENTED_BOX_MATRIX_TOLERANCE);
    expect((1 + 3.4e-10) ** 3 - 1).toBeGreaterThan(ORIENTED_BOX_MATRIX_TOLERANCE);
    expect(isProperOrthonormalMatrix(uniformScale(1 + 3.3e-10))).toBe(true);
    expect(isProperOrthonormalMatrix(uniformScale(1 + 3.4e-10))).toBe(false);
  });

  it("rejects malformed matrix and box input with a named message, not an engine TypeError", () => {
    for (const malformed of [
      undefined,
      null,
      "identity",
      { length: 9 },
      new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      [1, 0, 0, 0, 1, 0, 0, 0, "1"],
    ]) {
      expect(isProperOrthonormalMatrix(malformed)).toBe(false);
    }
    expect(() =>
      orientedBoxCorners({
        centerLdu: [0, 0, 0],
        halfExtentsLdu: [1, 1, 1],
      } as unknown as OrientedBox),
    ).toThrow(/orientation undefined must be a finite proper orthonormal 3x3 matrix/);
    expect(() =>
      orientedBoxesShareVolume(box([0, 0, 0], [1, 1, 1]), {
        halfExtentsLdu: [1, 1, 1],
        orientation: IDENTITY,
      } as unknown as OrientedBox),
    ).toThrow(/Right oriented box centerLdu undefined must contain three finite coordinates/);
    expect(() =>
      orientedBoxBounds({
        centerLdu: new Float64Array(3),
        halfExtentsLdu: [1, 1, 1],
        orientation: IDENTITY,
      } as unknown as OrientedBox),
    ).toThrow(/centerLdu Float64Array\(0,0,0\) must contain three finite coordinates/);
    expect(() => orientedBoxCorners(undefined as unknown as OrientedBox)).toThrow(
      /Oriented box must be an object with centerLdu, halfExtentsLdu, and orientation/,
    );
  });

  it("emits exactly eight corners and a conservative rotated broad-phase bound", () => {
    const angle = Math.PI / 4;
    const rotation = [
      Math.cos(angle),
      -Math.sin(angle),
      0,
      Math.sin(angle),
      Math.cos(angle),
      0,
      0,
      0,
      1,
    ] as const satisfies OrientationMatrix;
    const subject = box([1, 2, 3], [2, 1, 4], rotation);
    const corners = orientedBoxCorners(subject);
    const bounds = orientedBoxBounds(subject);

    expect(corners).toHaveLength(8);
    expect(new Set(corners.map((corner) => corner.join(",")))).toHaveLength(8);
    expect(bounds.min[0]).toBeCloseTo(1 - 3 / Math.sqrt(2), 12);
    expect(bounds.max[0]).toBeCloseTo(1 + 3 / Math.sqrt(2), 12);
    expect(bounds.min[1]).toBeCloseTo(2 - 3 / Math.sqrt(2), 12);
    expect(bounds.max[1]).toBeCloseTo(2 + 3 / Math.sqrt(2), 12);
    expect(bounds.min[2]).toBeLessThanOrEqual(-1);
    expect(bounds.max[2]).toBeGreaterThanOrEqual(7);
  });

  it("rounds every broad-phase bound strictly outside the exact bounds", () => {
    const random = deterministicRandom(0x51de51de);
    let directed = 0;
    for (let sample = 0; sample < 96; sample += 1) {
      // Eight orders of magnitude: the outward rounding must hold at every one.
      const magnitude = 10 ** (random() * 8 - 4);
      const subject = box(
        randomCenter(random, magnitude),
        randomExtents(random, magnitude),
        randomRotation(random),
      );
      const bounds = orientedBoxBounds(subject);
      const truth = exactBounds(subject);
      for (let axis = 0; axis < 3; axis += 1) {
        // Direction, not closeness: a bound that lands inside the exact box can
        // drop a real overlap from the broad phase, and no tolerance-based
        // assertion sees the difference between inside and outside.
        expect(exactCompare(exact(bounds.min[axis]!), truth.min[axis]!)).toBe(-1);
        expect(exactCompare(exact(bounds.max[axis]!), truth.max[axis]!)).toBe(1);
        directed += 2;
      }
    }
    expect(directed).toBe(576);
  });

  it("uses the catalog row-major active-rotation convention for every corner", () => {
    const orientation = eulerRotation(0.37, -0.61, 1.19);
    const subject = box([11, -7, 5], [2, 3, 4], orientation);
    const expected: LduVector3[] = [];
    for (const xSign of [-1, 1] as const) {
      for (const ySign of [-1, 1] as const) {
        for (const zSign of [-1, 1] as const) {
          const rotated = rotateLduVector(orientation, [xSign * 2, ySign * 3, zSign * 4]);
          expected.push([rotated[0] + 11, rotated[1] - 7, rotated[2] + 5]);
        }
      }
    }
    const actual = orientedBoxCorners(subject);
    for (let corner = 0; corner < actual.length; corner += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        expect(actual[corner]![axis]).toBeCloseTo(expected[corner]![axis]!, 14);
      }
    }
  });

  it("refuses a box whose rotated span was rounded away on a single world axis", () => {
    const rotation = eulerRotation(0, 0, Math.PI / 4);
    for (const magnitude of [1e16, 1e300]) {
      const collapsed = box([magnitude, 0, 0], [1, 1, 1], rotation);
      // Same accumulation order as the kernel: center first, then each rotated
      // half-extent in turn.
      const coordinate = (row: number): Set<number> => {
        const values = new Set<number>();
        for (const x of [-1, 1]) {
          for (const y of [-1, 1]) {
            for (const z of [-1, 1]) {
              const center = row === 0 ? magnitude : 0;
              values.add(
                center +
                  x * rotation[row * 3]! +
                  y * rotation[row * 3 + 1]! +
                  z * rotation[row * 3 + 2]!,
              );
            }
          }
        }
        return values;
      };
      // The +/-1.414 LDU x span is gone: every corner shares one x value. The
      // y coordinates still differ, which is exactly what kept whole-corner
      // distinctness satisfied while the box had lost its shape.
      expect(coordinate(0)).toEqual(new Set([magnitude]));
      expect(coordinate(1).size).toBeGreaterThan(1);
      expect(() => orientedBoxCorners(collapsed)).toThrow(
        /precision collapsed the x span .* corners resolve only 0 LDU/s,
      );
      expect(() => orientedBoxesShareVolume(collapsed, collapsed)).toThrow(
        /precision collapsed the x span/,
      );
      expect(() => orientedBoxesShareVolume(box([0, 0, 0], [1, 1, 1]), collapsed)).toThrow(
        /precision collapsed the x span/,
      );
      // The same center with an axis-aligned box loses every axis at once.
      expect(() => orientedBoxCorners(box([magnitude, 0, 0], [1, 1, 1]))).toThrow(
        /precision collapsed/,
      );
    }
    // A center that still resolves its span stays usable.
    expect(orientedBoxCorners(box([1e15, 0, 0], [1, 1, 1], rotation))).toHaveLength(8);
    expect(orientedBoxCorners(box([1e16, 0, 0], [1e3, 1e3, 1e3], rotation))).toHaveLength(8);
  });

  it("treats contact as non-collision but detects positive-volume penetration and containment", () => {
    const left = box([0, 0, 0], [1, 1, 1]);
    expect(orientedBoxesShareVolume(left, box([2, 0, 0], [1, 1, 1]))).toBe(false);
    expect(ORIENTED_BOX_OVERLAP_TOLERANCE_LDU).toBe(0);
    expect(orientedBoxesShareVolume(left, box([2 - 5e-10, 0, 0], [1, 1, 1]))).toBe(true);
    expect(orientedBoxesShareVolume(left, box([2 - 1e-6, 0, 0], [1, 1, 1]))).toBe(true);
    expect(orientedBoxesShareVolume(left, box([0, 0, 0], [0.25, 0.25, 0.25]))).toBe(true);

    const rotated = box([0, 0, 0], [1, 1, 1], eulerRotation(0, 0, Math.PI / 4));
    const rotatedContact = box([Math.SQRT2 + 1, 0, 0], [1, 1, 1]);
    expect(orientedBoxesShareVolume(rotated, rotatedContact)).toBe(false);
    expect(orientedBoxesShareVolume(rotated, box([Math.SQRT2 + 1 - 1e-12, 0, 0], [1, 1, 1]))).toBe(
      true,
    );
  });

  it("uses edge cross-product axes when all six face axes and both AABBs overlap", () => {
    const left = box([0, 0, 0], [2, 0.25, 0.35]);
    const right = box(
      [-1.279949507676065, 0.9900073893368244, 0.9940077690407634],
      [1.7, 0.3, 0.25],
      [
        0.13420438236220197, 0.6224733135084229, 0.7710487388775267, 0.7281180607421771,
        0.465852119762994, -0.5028179512839376, -0.6721854456739086, 0.6288948850818947,
        -0.39071466589059506,
      ],
    );

    expect(ORIENTED_BOX_MAX_SAT_AXES).toBe(15);
    expect(boundsOverlap(orientedBoxBounds(left), orientedBoxBounds(right))).toBe(true);
    const leftCorners = orientedBoxCorners(left);
    const rightCorners = orientedBoxCorners(right);
    const sixFaceAxes = [...matrixAxes(left.orientation), ...matrixAxes(right.orientation)];
    expect(sixFaceAxes.some((axis) => separatedOnAxis(leftCorners, rightCorners, axis))).toBe(
      false,
    );
    expect(exactShareVolume(left, right)).toEqual({ share: false, decisive: true });
    expect(orientedBoxesShareVolume(left, right)).toBe(false);
    expect(orientedBoxesShareVolume(right, left)).toBe(false);
  });

  it("retains a tiny nonzero cross axis when it is the only separator", () => {
    const inverseSqrtTwo = 1 / Math.sqrt(2);
    const rotationAxis = [0, -inverseSqrtTwo, inverseSqrtTwo] as const;
    const angle = 4e-10;
    const orientation = axisAngleRotation(rotationAxis, angle);
    const crossAxis = cross(matrixAxes(IDENTITY)[0]!, matrixAxes(orientation)[0]!);
    const crossAxisLength = Math.hypot(...crossAxis);
    const left = box([0, 0, 0], [2e14, 1, 1]);
    const right = box(
      [0, rotationAxis[1] * 48_000, rotationAxis[2] * 48_000],
      [2e14, 1, 1],
      orientation,
    );

    expect(isProperOrthonormalMatrix(orientation)).toBe(true);
    expect(crossAxisLength).toBeGreaterThan(0);
    expect(crossAxisLength).toBeLessThan(1e-9);
    expect(exactShareVolume(left, right)).toEqual({ share: false, decisive: true });
    expect(orientedBoxesShareVolume(left, right)).toBe(false);
    expect(orientedBoxesShareVolume(right, left)).toBe(false);
  });

  it("derives face normals when accepted source round-off makes edge axes non-orthogonal", () => {
    const leftOrientation = [
      0.9807626417840538, -0.05165990162978927, 0.1882442430576945, 0.1550965477495239,
      0.7917932709096785, -0.5907693937110456, -0.11853143615490164, 0.6086005838854848,
      0.7845735325240737,
    ] as const satisfies OrientationMatrix;
    const rightOrientation = [
      0.5966357360919774, 0.3294137481714362, 0.7317871144900202, -0.1432021128621002,
      0.9409368212410288, -0.30680784426845803, -0.7896321632822555, 0.07825906304367372,
      0.60856927770116,
    ] as const satisfies OrientationMatrix;
    const left = box(
      [0, 0, 0],
      [99.21289016434027, 49.64356923192644, 51.14492191925317],
      leftOrientation,
    );
    const right = box(
      [31.6715097968645, -99.3951174779946, 132.002062416756],
      [107.354343811087, 64.0875158226769, 55.2648530219014],
      rightOrientation,
    );

    expect(isProperOrthonormalMatrix(leftOrientation)).toBe(true);
    expect(isProperOrthonormalMatrix(rightOrientation)).toBe(true);
    expect(exactShareVolume(left, right)).toEqual({ share: false, decisive: true });
    expect(orientedBoxesShareVolume(left, right)).toBe(false);
    expect(orientedBoxesShareVolume(right, left)).toBe(false);
  });

  it("is translation-safe at large finite coordinates and fails closed on overflow", () => {
    const rotation = eulerRotation(0, 0, Math.PI / 4);
    const precisionBoundary = box(
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0],
      [0.5, 0.5, 0.5],
      rotation,
    );
    expect(() => orientedBoxesShareVolume(precisionBoundary, precisionBoundary)).toThrow(
      /precision collapsed distinct source corners/,
    );
    const precisionBounds = orientedBoxBounds(precisionBoundary);
    expect(precisionBounds.min[0]).toBeLessThan(precisionBoundary.centerLdu[0]);
    expect(precisionBounds.max[0]).toBeGreaterThan(precisionBoundary.centerLdu[0]);
    expect(precisionBounds.min[1]).toBeLessThan(precisionBoundary.centerLdu[1]);
    expect(precisionBounds.max[1]).toBeGreaterThan(precisionBoundary.centerLdu[1]);

    const projectionOverflowBoundary = box([1.3e308, 1.3e308, 0], [1e292, 1e292, 1e292], rotation);
    expect(() =>
      orientedBoxesShareVolume(projectionOverflowBoundary, projectionOverflowBoundary),
    ).toThrow(/precision collapsed distinct source corners/);
    const extremeBounds = orientedBoxBounds(projectionOverflowBoundary);
    expect(extremeBounds.min.every(Number.isFinite)).toBe(true);
    expect(extremeBounds.max.every(Number.isFinite)).toBe(true);

    const nearOrigin = box([0, 0, 0], [2, 1, 1], rotation);
    const nearProbe = box([2.5, 0, 0], [2, 1, 1]);
    const translated = [1e15, -1e15, 1e15] as const;
    const translatedSubject = box(translated, nearOrigin.halfExtentsLdu, nearOrigin.orientation);
    const translatedProbe = box(
      [translated[0] + 2.5, translated[1], translated[2]],
      nearProbe.halfExtentsLdu,
      nearProbe.orientation,
    );
    expect(orientedBoxesShareVolume(translatedSubject, translatedProbe)).toBe(
      orientedBoxesShareVolume(nearOrigin, nearProbe),
    );

    expect(() =>
      orientedBoxesShareVolume(
        box([Number.MAX_VALUE, 0, 0], [1, 1, 1]),
        box([-Number.MAX_VALUE, 0, 0], [1, 1, 1]),
      ),
    ).toThrow(/precision collapsed distinct source corners/);
  });

  it("fails closed on nonpositive extents and arithmetic overflow", () => {
    expect(() => orientedBoxCorners(box([0, 0, 0], [1, 0, 1]))).toThrow(
      /three finite positive extents/,
    );
    expect(() =>
      orientedBoxCorners(box([Number.MAX_VALUE, 0, 0], [Number.MAX_VALUE, 1, 1])),
    ).toThrow(/overflowed finite coordinates/);
  });

  it("matches an exact BigInt fifteen-axis SAT oracle over deterministic rotations", () => {
    const random = deterministicRandom(0x6651557);
    for (let sample = 0; sample < 128; sample += 1) {
      const subject = box(randomCenter(random), randomExtents(random), randomRotation(random));
      const probe = box(randomCenter(random), randomExtents(random), randomRotation(random));
      const truth = exactShareVolume(subject, probe);
      expect(truth.decisive).toBe(true);
      expect(orientedBoxesShareVolume(subject, probe)).toBe(truth.share);
      expect(orientedBoxesShareVolume(probe, subject)).toBe(truth.share);
    }
  });

  it("matches the exact oracle on both sides of the measured contact distance", () => {
    const random = deterministicRandom(0x6651557);
    let decided = 0;
    for (let sample = 0; sample < 64; sample += 1) {
      const subject = box([0, 0, 0], randomExtents(random), randomRotation(random));
      const direction = [random() - 0.5, random() - 0.5, random() - 0.5] as const;
      const length = Math.hypot(...direction);
      const extents = randomExtents(random);
      const orientation = randomRotation(random);
      const at = (distance: number): OrientedBox =>
        box(
          direction.map((value) => (value / length) * distance) as unknown as LduVector3,
          extents,
          orientation,
        );
      expect(orientedBoxesShareVolume(subject, at(0))).toBe(true);
      expect(orientedBoxesShareVolume(subject, at(20))).toBe(false);
      let overlapping = 0;
      let separated = 20;
      for (let step = 0; step < 64; step += 1) {
        const middle = (overlapping + separated) / 2;
        if (middle === overlapping || middle === separated) break;
        if (orientedBoxesShareVolume(subject, at(middle))) overlapping = middle;
        else separated = middle;
      }
      // A relative offset of 1e-11 either side of the kernel's own contact
      // distance: any formulation error that moves the true contact boundary
      // by more than that puts both probes on one side of exact truth.
      for (const probe of [at(overlapping * (1 - 1e-11)), at(overlapping * (1 + 1e-11))]) {
        const truth = exactShareVolume(subject, probe);
        if (!truth.decisive) continue;
        decided += 1;
        expect(orientedBoxesShareVolume(subject, probe)).toBe(truth.share);
        expect(orientedBoxesShareVolume(probe, subject)).toBe(truth.share);
      }
    }
    expect(decided).toBeGreaterThanOrEqual(120);
  });
});
