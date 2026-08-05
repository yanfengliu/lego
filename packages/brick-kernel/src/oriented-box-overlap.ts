import type { LduBounds, LduVector3, OrientationMatrix } from "@lego-studio/catalog";

/**
 * A box whose local axes may differ from the catalog frame.
 *
 * Callers must provide the source-authored rotation unchanged. The overlap
 * implementation validates but never normalizes, projects, or otherwise
 * repairs that matrix: a reflection, scale, or shear is invalid catalog truth.
 */
export interface OrientedBox {
  readonly centerLdu: LduVector3;
  readonly halfExtentsLdu: LduVector3;
  readonly orientation: OrientationMatrix;
}

export const ORIENTED_BOX_MAX_SAT_AXES = 15;
/**
 * Largest dot-product or determinant deviation an authored rotation may carry
 * and still count as orthonormal catalog truth. One LDU is 0.4 mm, so at this
 * bound the worst shear displaces a corner of a 100 LDU half-extent part by
 * 1e-7 LDU — forty picometres, far below any authoring or rendering resolution.
 * A looser bound admits real shear as truth: 1e-3 would accept a corner
 * displacement of 0.1 LDU on that same part. `oriented-box-overlap.test.ts`
 * pins both sides of this boundary.
 */
export const ORIENTED_BOX_MATRIX_TOLERANCE = 1e-9;
export const ORIENTED_BOX_OVERLAP_TOLERANCE_LDU = 0;

/**
 * Smallest fraction of a source box's world-axis span that its eight computed
 * corners must still resolve. Corner arithmetic adds each rotated half-extent
 * to the center separately, so once a term falls below half the binary64
 * spacing at that center it vanishes outright (1e16 + 0.7071 is 1e16) and the
 * whole axis span can collapse to zero while the corners stay distinct in the
 * other two axes. Any span reaching four times that spacing survives to within
 * one spacing, so a surviving span below this fraction means the arithmetic,
 * not the source box, decided the shape.
 */
const ORIENTED_BOX_SPAN_RESOLUTION_FLOOR = 0.5;

const WORLD_AXIS_LABELS = ["x", "y", "z"] as const;

type Axis3 = readonly [x: number, y: number, z: number];

const FLOAT64_BITS = new DataView(new ArrayBuffer(8));

function dot(left: Axis3, right: Axis3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Axis3, right: Axis3): Axis3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function nextUp(value: number): number {
  if (Number.isNaN(value) || value === Number.POSITIVE_INFINITY) return value;
  if (value === Number.NEGATIVE_INFINITY) return -Number.MAX_VALUE;
  if (Object.is(value, -0) || value === 0) return Number.MIN_VALUE;
  FLOAT64_BITS.setFloat64(0, value);
  const bits = FLOAT64_BITS.getBigUint64(0);
  FLOAT64_BITS.setBigUint64(0, value > 0 ? bits + 1n : bits - 1n);
  return FLOAT64_BITS.getFloat64(0);
}

function nextDown(value: number): number {
  return -nextUp(-value);
}

function determinant(matrix: readonly number[]): number {
  return (
    matrix[0]! * (matrix[4]! * matrix[8]! - matrix[5]! * matrix[7]!) -
    matrix[1]! * (matrix[3]! * matrix[8]! - matrix[5]! * matrix[6]!) +
    matrix[2]! * (matrix[3]! * matrix[7]! - matrix[4]! * matrix[6]!)
  );
}

/** Columns of the row-major matrix: the three local axes in parent space. */
function matrixAxes(matrix: OrientationMatrix): readonly [Axis3, Axis3, Axis3] {
  return [
    [matrix[0], matrix[3], matrix[6]],
    [matrix[1], matrix[4], matrix[7]],
    [matrix[2], matrix[5], matrix[8]],
  ];
}

/**
 * Exact face normals for the source-authored edge frame.
 *
 * Accepted matrices may contain bounded decimal round-off rather than being
 * symbolically orthogonal. Deriving the normals keeps SAT exact for that
 * represented parallelepiped; substituting the edge axes as normals can miss a
 * separator once the tiny matrix error is multiplied by ordinary LDU extents.
 */
function faceNormals(axes: readonly [Axis3, Axis3, Axis3]): readonly [Axis3, Axis3, Axis3] {
  return [cross(axes[1], axes[2]), cross(axes[2], axes[0]), cross(axes[0], axes[1])];
}

/** Renders an arbitrary rejected value for an error message without throwing. */
function describeValue(value: unknown): string {
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }
  if (value === undefined) return "undefined";
  if (ArrayBuffer.isView(value)) return `${value.constructor.name}(${Array.from(value as never)})`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Accepts only a finite, proper orthonormal rotation. Tolerance permits source
 * decimal round-off; the matrix itself is retained byte-for-value unchanged.
 *
 * This is a total predicate over unknown input: a missing field, a string, a
 * plain object, or a typed array answers false rather than throwing, so callers
 * keep control of the rejection message. A typed array is rejected on purpose
 * — the narrowed `OrientationMatrix` is a readonly nine-number tuple, and a
 * `Float64Array` satisfies neither its element access contract nor its
 * structural identity under canonicalization.
 */
export function isProperOrthonormalMatrix(matrix: unknown): matrix is OrientationMatrix {
  if (!Array.isArray(matrix) || matrix.length !== 9) return false;
  const entries: readonly unknown[] = matrix;
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  if (!entries.every(isFiniteNumber)) return false;
  const axes = matrixAxes(entries as unknown as OrientationMatrix);
  for (let left = 0; left < axes.length; left += 1) {
    for (let right = left; right < axes.length; right += 1) {
      const expected = left === right ? 1 : 0;
      if (Math.abs(dot(axes[left]!, axes[right]!) - expected) > ORIENTED_BOX_MATRIX_TOLERANCE) {
        return false;
      }
    }
  }
  const det = determinant(entries);
  return det > 0 && Math.abs(det - 1) <= ORIENTED_BOX_MATRIX_TOLERANCE;
}

function isNumberTriple(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function assertOrientedBox(box: OrientedBox, label: string): void {
  if (box === null || typeof box !== "object") {
    throw new TypeError(
      `${label} must be an object with centerLdu, halfExtentsLdu, and orientation, ` +
        `received ${describeValue(box)}.`,
    );
  }
  if (!isNumberTriple(box.centerLdu)) {
    throw new TypeError(
      `${label} centerLdu ${describeValue(box.centerLdu)} must contain three finite coordinates ` +
        "as a plain array of numbers.",
    );
  }
  if (!isNumberTriple(box.halfExtentsLdu) || !box.halfExtentsLdu.every((extent) => extent > 0)) {
    throw new TypeError(
      `${label} halfExtentsLdu ${describeValue(box.halfExtentsLdu)} must contain three finite ` +
        "positive extents as a plain array of numbers; a zero or negative extent has no volume.",
    );
  }
  if (!isProperOrthonormalMatrix(box.orientation)) {
    throw new TypeError(
      `${label} orientation ${describeValue(box.orientation)} must be a finite proper ` +
        `orthonormal 3x3 matrix, given as a plain array of nine numbers in row-major order, ` +
        `within ${ORIENTED_BOX_MATRIX_TOLERANCE}; reflections, ` +
        "scale, shear, and zero or duplicate axes are invalid.",
    );
  }
}

function cornersUnchecked(box: OrientedBox): readonly LduVector3[] {
  const axes = matrixAxes(box.orientation);
  const corners: LduVector3[] = [];
  for (const xSign of [-1, 1] as const) {
    for (const ySign of [-1, 1] as const) {
      for (const zSign of [-1, 1] as const) {
        const corner: LduVector3 = [
          box.centerLdu[0] +
            xSign * box.halfExtentsLdu[0] * axes[0][0] +
            ySign * box.halfExtentsLdu[1] * axes[1][0] +
            zSign * box.halfExtentsLdu[2] * axes[2][0],
          box.centerLdu[1] +
            xSign * box.halfExtentsLdu[0] * axes[0][1] +
            ySign * box.halfExtentsLdu[1] * axes[1][1] +
            zSign * box.halfExtentsLdu[2] * axes[2][1],
          box.centerLdu[2] +
            xSign * box.halfExtentsLdu[0] * axes[0][2] +
            ySign * box.halfExtentsLdu[1] * axes[1][2] +
            zSign * box.halfExtentsLdu[2] * axes[2][2],
        ];
        if (!corner.every(Number.isFinite)) {
          throw new RangeError("Oriented-box corner arithmetic overflowed finite coordinates");
        }
        corners.push(corner);
      }
    }
  }
  assertCornerResolution(box, corners);
  return corners;
}

/**
 * Rejects a corner set that no longer carries the source box's shape.
 *
 * Whole-corner distinctness is necessary but not sufficient: one surviving
 * coordinate keeps all eight corner tuples distinct while another coordinate's
 * entire span has been rounded away, so each world axis is checked on its own
 * against the span the source box actually has there.
 */
function assertCornerResolution(box: OrientedBox, corners: readonly LduVector3[]): void {
  if (new Set(corners.map((corner) => corner.join(","))).size !== 8) {
    throw new RangeError(
      `Oriented-box corner precision collapsed distinct source corners for center ` +
        `${JSON.stringify(box.centerLdu)} and half-extents ${JSON.stringify(box.halfExtentsLdu)}. ` +
        "Reduce the center-coordinate magnitude or use extents large enough for all eight " +
        "source corners to remain distinct binary64 positions.",
    );
  }
  const axes = matrixAxes(box.orientation);
  for (let worldAxis = 0; worldAxis < 3; worldAxis += 1) {
    let sourceSpan = 0;
    for (let localAxis = 0; localAxis < 3; localAxis += 1) {
      sourceSpan += Math.abs(axes[localAxis]![worldAxis]!) * box.halfExtentsLdu[localAxis]!;
    }
    sourceSpan *= 2;
    if (!(sourceSpan > 0)) continue;
    const projected = corners.map((corner) => corner[worldAxis]!);
    const resolvedSpan = Math.max(...projected) - Math.min(...projected);
    if (resolvedSpan >= sourceSpan * ORIENTED_BOX_SPAN_RESOLUTION_FLOOR) continue;
    const magnitude = Math.abs(box.centerLdu[worldAxis]!);
    const spacing = nextUp(magnitude) - magnitude;
    throw new RangeError(
      `Oriented-box corner precision collapsed the ${WORLD_AXIS_LABELS[worldAxis]} span for ` +
        `center ${JSON.stringify(box.centerLdu)} and half-extents ` +
        `${JSON.stringify(box.halfExtentsLdu)}: the source box spans ${sourceSpan} LDU on that ` +
        `axis but its eight binary64 corners resolve only ${resolvedSpan} LDU. Binary64 spacing ` +
        `at that center coordinate is ${spacing} LDU, which rounds away rotated half-extents ` +
        `smaller than ${spacing / 2} LDU. Reduce the center-coordinate magnitude, or use ` +
        `half-extents whose ${WORLD_AXIS_LABELS[worldAxis]} span exceeds ${4 * spacing} LDU.`,
    );
  }
}

/** Returns the fixed eight source-preserving corners after validation. */
export function orientedBoxCorners(box: OrientedBox): readonly LduVector3[] {
  assertOrientedBox(box, "Oriented box");
  return cornersUnchecked(box);
}

/** Conservative world/catalog AABB used only for broad-phase indexing. */
export function orientedBoxBounds(box: OrientedBox): LduBounds {
  assertOrientedBox(box, "Oriented box");
  const axes = matrixAxes(box.orientation);
  const spans: number[] = [];
  for (let worldAxis = 0; worldAxis < 3; worldAxis += 1) {
    let upperSpan = 0;
    for (let localAxis = 0; localAxis < 3; localAxis += 1) {
      const factor = Math.abs(axes[localAxis]![worldAxis]!);
      if (factor === 0) continue;
      const product = factor * box.halfExtentsLdu[localAxis]!;
      if (!Number.isFinite(product)) {
        throw new RangeError("Oriented-box broad-phase span arithmetic overflowed");
      }
      const productUpper = nextUp(product);
      const sum = upperSpan + productUpper;
      if (!Number.isFinite(productUpper) || !Number.isFinite(sum)) {
        throw new RangeError("Oriented-box broad-phase span arithmetic overflowed");
      }
      upperSpan = nextUp(sum);
      if (!Number.isFinite(upperSpan)) {
        throw new RangeError("Oriented-box broad-phase span arithmetic overflowed");
      }
    }
    spans.push(upperSpan);
  }

  const minimum = box.centerLdu.map((center, axis) => {
    const value = center - spans[axis]!;
    if (!Number.isFinite(value)) {
      throw new RangeError("Oriented-box broad-phase lower bound overflowed");
    }
    return nextDown(value);
  }) as unknown as LduVector3;
  const maximum = box.centerLdu.map((center, axis) => {
    const value = center + spans[axis]!;
    if (!Number.isFinite(value)) {
      throw new RangeError("Oriented-box broad-phase upper bound overflowed");
    }
    return nextUp(value);
  }) as unknown as LduVector3;
  if (
    !minimum.every(Number.isFinite) ||
    !maximum.every(Number.isFinite) ||
    minimum.some((value, axis) => value >= maximum[axis]!)
  ) {
    throw new RangeError("Oriented-box broad-phase bounds are not finite distinct intervals");
  }
  return { min: minimum, max: maximum };
}

function normalizedAxis(axis: Axis3): Axis3 | null {
  const scale = Math.max(Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2]));
  if (scale === 0) return null;
  const scaled: Axis3 = [axis[0] / scale, axis[1] / scale, axis[2] / scale];
  const length = Math.hypot(scaled[0], scaled[1], scaled[2]);
  const normalized: Axis3 = [scaled[0] / length, scaled[1] / length, scaled[2] / length];
  if (!normalized.every(Number.isFinite)) {
    throw new RangeError("Oriented-box SAT axis normalization overflowed finite arithmetic");
  }
  return normalized;
}

function finiteDot(left: Axis3, right: Axis3, label: string): number {
  const value = left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
  if (!Number.isFinite(value)) {
    throw new RangeError(`Oriented-box ${label} arithmetic overflowed finite values`);
  }
  return value;
}

function projectedRadius(box: OrientedBox, localAxes: readonly Axis3[], axis: Axis3): number {
  let radius = 0;
  for (let index = 0; index < localAxes.length; index += 1) {
    const contribution =
      box.halfExtentsLdu[index]! * Math.abs(finiteDot(localAxes[index]!, axis, "projected-radius"));
    const nextRadius = radius + contribution;
    if (!Number.isFinite(contribution) || !Number.isFinite(nextRadius)) {
      throw new RangeError("Oriented-box projected radius overflowed finite arithmetic");
    }
    radius = nextRadius;
  }
  return radius;
}

function separates(
  left: OrientedBox,
  right: OrientedBox,
  leftAxes: readonly Axis3[],
  rightAxes: readonly Axis3[],
  centerDelta: Axis3,
  candidateAxis: Axis3,
): boolean {
  const axis = normalizedAxis(candidateAxis);
  if (axis === null) return false;
  const centerDistance = Math.abs(finiteDot(centerDelta, axis, "center projection"));
  const combinedRadius =
    projectedRadius(left, leftAxes, axis) + projectedRadius(right, rightAxes, axis);
  if (!Number.isFinite(combinedRadius)) {
    throw new RangeError("Oriented-box combined projected radius overflowed finite arithmetic");
  }
  return centerDistance >= combinedRadius - ORIENTED_BOX_OVERLAP_TOLERANCE_LDU;
}

/**
 * Exact-shape narrow phase for two validated OBBs.
 *
 * The separating-axis theorem needs at most fifteen axes: three derived face
 * normals from each source-authored edge frame plus nine pairwise edge cross
 * products. Face/edge contact is not shared volume and therefore is not
 * reported as a collision.
 * Axis completeness follows Gottschalk, Lin, and Manocha, section 5:
 * https://techreports.cs.unc.edu/papers/96-013.pdf
 */
export function orientedBoxesShareVolume(left: OrientedBox, right: OrientedBox): boolean {
  assertOrientedBox(left, "Left oriented box");
  assertOrientedBox(right, "Right oriented box");
  cornersUnchecked(left);
  cornersUnchecked(right);
  const leftAxes = matrixAxes(left.orientation);
  const rightAxes = matrixAxes(right.orientation);
  const centerDelta: Axis3 = [
    right.centerLdu[0] - left.centerLdu[0],
    right.centerLdu[1] - left.centerLdu[1],
    right.centerLdu[2] - left.centerLdu[2],
  ];
  if (!centerDelta.every(Number.isFinite)) {
    throw new RangeError("Oriented-box center delta overflowed finite arithmetic");
  }
  const axes: Axis3[] = [...faceNormals(leftAxes), ...faceNormals(rightAxes)];
  for (const leftAxis of leftAxes) {
    for (const rightAxis of rightAxes) axes.push(cross(leftAxis, rightAxis));
  }
  if (axes.length !== ORIENTED_BOX_MAX_SAT_AXES) {
    throw new Error(`Oriented-box SAT axis construction produced ${axes.length} axes, expected 15`);
  }
  return !axes.some((axis) => separates(left, right, leftAxes, rightAxes, centerDelta, axis));
}
