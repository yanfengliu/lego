import { STUD_PITCH_LDU, type LduVector3 } from "@lego-studio/catalog";
import { LDU_TO_THREE_AXIS_SIGNS, lduDirectionToThree } from "@lego-studio/rendering";

/**
 * The palette preview's view. It draws a part the way the canonical
 * `isometric` camera sees it: from scene direction (1, 1, 1) with +Y up, as a
 * parallel projection. Catalog LDU reaches scene axes through the renderer's
 * own basis change, so the preview shows the part's LDraw right side (+X),
 * top and front (-Z), in the same hand the viewport draws it.
 */

/** Screen x per unit of scene `x - z`. */
export const ISO_X = Math.cos(Math.PI / 6);
/** Screen y per unit of scene `x + z`. */
export const ISO_Y = Math.sin(Math.PI / 6);
/** Screen size of one stud pitch. */
export const STUD_PX = 9;

/** A point in preview scene axes, measured in studs. */
export type ScenePoint = readonly [x: number, y: number, z: number];

/** A catalog LDU point mapped into preview scene axes. */
export type ToPreviewScene = (x: number, y: number, z: number) => ScenePoint;

/** An axis-aligned box in preview scene axes, each minimum below its maximum. */
export interface SceneBox {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/**
 * Maps catalog LDU into preview scene axes, in studs. The axes come from the
 * renderer's basis change; the origin is the corner of `bounds` that lands at
 * the scene minimum, so every point inside `bounds` has coordinates of at
 * least zero.
 */
export function createPreviewFrame(bounds: {
  readonly min: LduVector3;
  readonly max: LduVector3;
}): ToPreviewScene {
  const origin = LDU_TO_THREE_AXIS_SIGNS.map((sign, axis) =>
    sign > 0 ? bounds.min[axis]! : bounds.max[axis]!,
  );
  return (x, y, z) => {
    const [sceneX, sceneY, sceneZ] = lduDirectionToThree(
      x - origin[0]!,
      y - origin[1]!,
      z - origin[2]!,
    );
    return [sceneX / STUD_PITCH_LDU, sceneY / STUD_PITCH_LDU, sceneZ / STUD_PITCH_LDU];
  };
}

/**
 * Projects a preview scene point for a camera at scene (1, 1, 1) with +Y up.
 * Screen x runs right and screen y down, so scene +X draws down-right, scene
 * +Z down-left and scene +Y straight up.
 */
export function project(x: number, y: number, z: number): readonly [number, number] {
  return [(x - z) * ISO_X * STUD_PX, ((x + z) * ISO_Y - y) * STUD_PX];
}

/** A catalog LDU box in preview scene axes. */
export function lduBoxToScene(
  toScene: ToPreviewScene,
  minLdu: LduVector3,
  maxLdu: LduVector3,
): SceneBox {
  const a = toScene(...minLdu);
  const b = toScene(...maxLdu);
  return {
    x0: Math.min(a[0], b[0]),
    x1: Math.max(a[0], b[0]),
    y0: Math.min(a[1], b[1]),
    y1: Math.max(a[1], b[1]),
    z0: Math.min(a[2], b[2]),
    z1: Math.max(a[2], b[2]),
  };
}

/**
 * The outward normal of each edge of a closed plan polygon in scene (x, z).
 * The basis change turns LDU z around, which reverses a polygon's winding, so
 * the side the normal points to is read from the polygon's own signed area
 * rather than assumed.
 */
export function outwardEdgeNormals(
  boundary: readonly (readonly [x: number, z: number])[],
): readonly (readonly [x: number, z: number])[] {
  let twiceArea = 0;
  for (let index = 0; index < boundary.length; index += 1) {
    const [x, z] = boundary[index]!;
    const [nextX, nextZ] = boundary[(index + 1) % boundary.length]!;
    twiceArea += x * nextZ - nextX * z;
  }
  const turn = twiceArea >= 0 ? 1 : -1;
  return boundary.map(([x, z], index) => {
    const [nextX, nextZ] = boundary[(index + 1) % boundary.length]!;
    return [turn * (nextZ - z), -turn * (nextX - x)] as const;
  });
}
