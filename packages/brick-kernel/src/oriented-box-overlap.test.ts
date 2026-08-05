import { describe, expect, it } from "vitest";

import type { LduBounds, LduVector3, OrientationMatrix } from "@lego-studio/catalog";

import {
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

function dot(left: LduVector3, right: LduVector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: LduVector3, right: LduVector3): LduVector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function faceNormals(axes: readonly LduVector3[]): readonly LduVector3[] {
  return [cross(axes[1]!, axes[2]!), cross(axes[2]!, axes[0]!), cross(axes[0]!, axes[1]!)];
}

function referenceShareVolume(left: OrientedBox, right: OrientedBox): boolean {
  const leftAxes = matrixAxes(left.orientation);
  const rightAxes = matrixAxes(right.orientation);
  const candidates = [
    ...faceNormals(leftAxes),
    ...faceNormals(rightAxes),
    ...leftAxes.flatMap((leftAxis) => rightAxes.map((rightAxis) => cross(leftAxis, rightAxis))),
  ];
  const centerDelta: LduVector3 = [
    right.centerLdu[0] - left.centerLdu[0],
    right.centerLdu[1] - left.centerLdu[1],
    right.centerLdu[2] - left.centerLdu[2],
  ];
  for (const candidate of candidates) {
    const scale = Math.max(...candidate.map(Math.abs));
    if (scale === 0) continue;
    const scaled = candidate.map((value) => value / scale) as unknown as LduVector3;
    const length = Math.hypot(...scaled);
    const axis = scaled.map((value) => value / length) as unknown as LduVector3;
    const leftRadius = leftAxes.reduce(
      (total, localAxis, index) =>
        total + left.halfExtentsLdu[index]! * Math.abs(dot(localAxis, axis)),
      0,
    );
    const rightRadius = rightAxes.reduce(
      (total, localAxis, index) =>
        total + right.halfExtentsLdu[index]! * Math.abs(dot(localAxis, axis)),
      0,
    );
    if (
      Math.abs(dot(centerDelta, axis)) + ORIENTED_BOX_OVERLAP_TOLERANCE_LDU >=
      leftRadius + rightRadius
    ) {
      return false;
    }
  }
  return true;
}

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
    expect(referenceShareVolume(left, right)).toBe(false);
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
    expect(referenceShareVolume(left, right)).toBe(false);
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

  it("matches an independent center-radius SAT formulation over deterministic rotations", () => {
    let state = 0x6651557;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };

    for (let sample = 0; sample < 128; sample += 1) {
      const subject = box(
        [(random() - 0.5) * 8, (random() - 0.5) * 8, (random() - 0.5) * 8],
        [0.1 + random() * 2, 0.1 + random() * 2, 0.1 + random() * 2],
        eulerRotation(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      );
      const probe = box(
        [(random() - 0.5) * 8, (random() - 0.5) * 8, (random() - 0.5) * 8],
        [0.1 + random() * 2, 0.1 + random() * 2, 0.1 + random() * 2],
        eulerRotation(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      );
      const expected = referenceShareVolume(subject, probe);
      expect(orientedBoxesShareVolume(subject, probe)).toBe(expected);
      expect(orientedBoxesShareVolume(probe, subject)).toBe(expected);
    }
  });
});
