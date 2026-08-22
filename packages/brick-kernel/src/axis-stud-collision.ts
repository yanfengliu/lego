import type { LduVector3 } from "@lego-studio/catalog";

export type CollisionAxis = "x" | "y" | "z";
export type HorizontalPoint = readonly [x: number, z: number];

export interface AxisAlignedStudBounds {
  readonly min: LduVector3;
  readonly max: LduVector3;
  readonly center: LduVector3;
  readonly radiusLdu: number;
  readonly axis: CollisionAxis;
}

export interface VerticalPrismBounds {
  readonly min: LduVector3;
  readonly max: LduVector3;
  readonly sectionXZ: readonly HorizontalPoint[];
}

const AREA_EPSILON = 1e-6;

function signedArea(polygon: readonly HorizontalPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return twiceArea / 2;
}

function counterClockwise(polygon: readonly HorizontalPoint[]): readonly HorizontalPoint[] {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
}

function edgeSide(start: HorizontalPoint, end: HorizontalPoint, point: HorizontalPoint): number {
  return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]);
}

/** Keep `nx*x + nz*z <= offset`. */
function clip(
  polygon: readonly HorizontalPoint[],
  nx: number,
  nz: number,
  offset: number,
): readonly HorizontalPoint[] {
  const inside = ([x, z]: HorizontalPoint) => nx * x + nz * z <= offset;
  const result: HorizontalPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside) {
      const previousValue = nx * previous[0] + nz * previous[1] - offset;
      const currentValue = nx * current[0] + nz * current[1] - offset;
      const denominator = previousValue - currentValue;
      const ratio = denominator === 0 ? 0 : previousValue / denominator;
      result.push([
        previous[0] + ratio * (current[0] - previous[0]),
        previous[1] + ratio * (current[1] - previous[1]),
      ]);
    }
    if (currentInside) result.push(current);
  }
  return result;
}

function distanceToInterval(value: number, minimum: number, maximum: number): number {
  return Math.max(0, minimum - value, value - maximum);
}

export function axisAlignedStudIntersectsVerticalPrism(
  stud: AxisAlignedStudBounds,
  body: VerticalPrismBounds,
): boolean {
  if (stud.axis !== "y") {
    const alongX = stud.axis === "x";
    let clipped = clip(
      body.sectionXZ,
      alongX ? -1 : 0,
      alongX ? 0 : -1,
      -(alongX ? stud.min[0] : stud.min[2]),
    );
    clipped = clip(clipped, alongX ? 1 : 0, alongX ? 0 : 1, alongX ? stud.max[0] : stud.max[2]);
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= AREA_EPSILON) return false;
    const values = clipped.map((point) => point[alongX ? 1 : 0]);
    const center = stud.center[alongX ? 2 : 0];
    const horizontalDistance = Math.max(
      0,
      Math.min(...values) - center,
      center - Math.max(...values),
    );
    const verticalDistance = Math.max(
      0,
      body.min[1] - stud.center[1],
      stud.center[1] - body.max[1],
    );
    return horizontalDistance ** 2 + verticalDistance ** 2 < stud.radiusLdu ** 2;
  }

  if (stud.min[1] >= body.max[1] || body.min[1] >= stud.max[1]) return false;
  const section = counterClockwise(body.sectionXZ);
  const point: HorizontalPoint = [stud.center[0], stud.center[2]];
  if (
    section.every(
      (start, index) => edgeSide(start, section[(index + 1) % section.length]!, point) >= 0,
    )
  ) {
    return true;
  }
  return section.some((start, index) => {
    const end = section[(index + 1) % section.length]!;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const lengthSquared = dx * dx + dz * dz;
    const ratio =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared),
          );
    const awayX = point[0] - (start[0] + ratio * dx);
    const awayZ = point[1] - (start[1] + ratio * dz);
    return awayX * awayX + awayZ * awayZ < stud.radiusLdu * stud.radiusLdu;
  });
}

export function axisAlignedStudsIntersect(
  left: AxisAlignedStudBounds,
  right: AxisAlignedStudBounds,
): boolean {
  if (left.axis !== right.axis) {
    const leftAxis = "xyz".indexOf(left.axis);
    const rightAxis = "xyz".indexOf(right.axis);
    const thirdAxis = 3 - leftAxis - rightAxis;
    const leftDistanceAcrossRightAxis = distanceToInterval(
      left.center[rightAxis]!,
      right.min[rightAxis]!,
      right.max[rightAxis]!,
    );
    const rightDistanceAcrossLeftAxis = distanceToInterval(
      right.center[leftAxis]!,
      left.min[leftAxis]!,
      left.max[leftAxis]!,
    );
    if (
      leftDistanceAcrossRightAxis >= left.radiusLdu ||
      rightDistanceAcrossLeftAxis >= right.radiusLdu
    ) {
      return false;
    }
    const leftReachAlongThirdAxis = Math.sqrt(
      left.radiusLdu ** 2 - leftDistanceAcrossRightAxis ** 2,
    );
    const rightReachAlongThirdAxis = Math.sqrt(
      right.radiusLdu ** 2 - rightDistanceAcrossLeftAxis ** 2,
    );
    return (
      Math.abs(left.center[thirdAxis]! - right.center[thirdAxis]!) <
      leftReachAlongThirdAxis + rightReachAlongThirdAxis
    );
  }
  const axisIndex = "xyz".indexOf(left.axis);
  if (
    left.min[axisIndex]! >= right.max[axisIndex]! ||
    right.min[axisIndex]! >= left.max[axisIndex]!
  ) {
    return false;
  }
  const perpendicular = [0, 1, 2].filter((axis) => axis !== axisIndex);
  const first = left.center[perpendicular[0]!]! - right.center[perpendicular[0]!]!;
  const second = left.center[perpendicular[1]!]! - right.center[perpendicular[1]!]!;
  const combinedRadius = left.radiusLdu + right.radiusLdu;
  return first * first + second * second < combinedRadius * combinedRadius;
}
