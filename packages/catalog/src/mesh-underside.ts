import type { PreloadedMeshGroup } from "./mesh-assets.ts";
import type { LduBounds, LduVector3 } from "./types.ts";

/**
 * Whether a bundled source mesh draws its own underside, measured from the mesh.
 *
 * A part admitted through the mesh route draws the expanded LDraw surface
 * itself, which is the highest-fidelity geometry in this catalog — LDraw models
 * a plate's cavity, its walls and its tubes, so these parts have never had the
 * flat-underside defect the generated parts did. What they had was no way to say
 * so: `MeshReferenceGeometryRecipe` carried no mode at all, so `part-standard`
 * could not check what they draw and reported all eight as unverifiable.
 *
 * This is that check. It is a measurement rather than a declaration for the same
 * reason `undersideMode` is derived on the generated side: a claim that outruns
 * the geometry is the thing the standard exists to catch, and a hand-written
 * mode on a mesh part would be exactly that.
 *
 * ## What is measured
 *
 * For each underside clutch the part declares, the *lowest* horizontal body
 * surface standing over that cell — lowest meaning largest y, because LDU points
 * -Y up. One of three things is true there:
 *
 *  - **recessed** — that surface sits above the part's own bottom face, so the
 *    stud has somewhere to go. A plate's cavity ceiling is 4 LDU up.
 *  - **open** — there is no horizontal surface over the cell at all, because the
 *    part is pierced there. `35480` is exactly this: a rounded 1 x 2 plate with
 *    open studs, whose ceiling is an annulus around a hole that goes all the way
 *    through. Its cavity ceiling is measurably present at y 0 over x [-6, 6] and
 *    z [-16, 16] and measurably absent at both clutch centres, which is the part
 *    being right rather than the mesh being wrong.
 *  - **flat** — the lowest surface is the bottom face, so the part is solid
 *    under its own clutch and a render from below is the flat rectangle this
 *    whole standard exists to refuse.
 *
 * The underside is drawn when no clutch is flat. Nothing is sampled and no ray
 * is cast: an LDraw part is an open surface, so crossing parity cannot say what
 * is inside it, and the containment test below asks only what the triangles
 * directly state.
 */

/** Cosine of the steepest tilt still counted as a horizontal surface. */
const HORIZONTAL_NORMAL = 0.999;
const EPSILON = 1e-6;

export type ClutchUndersideVerdict = "recessed" | "open" | "flat";

export interface MeshUndersideInput {
  /** Catalog-local LDU, three per vertex, exactly as the renderer draws them. */
  readonly positionsLdu: readonly number[];
  readonly indices: readonly number[] | null;
  readonly groups: readonly PreloadedMeshGroup[];
  readonly bodyBoundsLdu: LduBounds;
  readonly clutchSeatsLdu: readonly LduVector3[];
}

interface HorizontalTriangle {
  readonly y: number;
  readonly xz: readonly (readonly [number, number])[];
}

/** Whether a point lies in a triangle's plan projection, edges included. */
function containsXZ(triangle: HorizontalTriangle, x: number, z: number): boolean {
  const [a, b, c] = triangle.xz;
  const side = (from: readonly [number, number], to: readonly [number, number]): number =>
    (to[0] - from[0]) * (z - from[1]) - (to[1] - from[1]) * (x - from[0]);
  const sides = [side(a!, b!), side(b!, c!), side(c!, a!)];
  return sides.every((value) => value >= -EPSILON) || sides.every((value) => value <= EPSILON);
}

function horizontalBodyTriangles(input: MeshUndersideInput): HorizontalTriangle[] {
  const { positionsLdu, indices, groups } = input;
  const vertex = (index: number): LduVector3 => [
    positionsLdu[index * 3]!,
    positionsLdu[index * 3 + 1]!,
    positionsLdu[index * 3 + 2]!,
  ];
  const triangles: HorizontalTriangle[] = [];
  for (const group of groups) {
    if (group.role !== "body") continue;
    for (
      let triangle = group.triangleStart;
      triangle < group.triangleStart + group.triangleCount;
      triangle += 1
    ) {
      const corners = [0, 1, 2].map((corner) => {
        const at = triangle * 3 + corner;
        return vertex(indices === null ? at : indices[at]!);
      }) as [LduVector3, LduVector3, LduVector3];
      const [a, b, c] = corners;
      const edge1: LduVector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const edge2: LduVector3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal: LduVector3 = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0],
      ];
      const length = Math.hypot(normal[0], normal[1], normal[2]);
      if (length < EPSILON) continue;
      if (Math.abs(normal[1]) / length < HORIZONTAL_NORMAL) continue;
      triangles.push({
        y: (a[1] + b[1] + c[1]) / 3,
        xz: corners.map((corner) => [corner[0], corner[2]] as const),
      });
    }
  }
  return triangles;
}

/** One verdict per declared clutch, in the order the part declares them. */
export function meshClutchUndersides(input: MeshUndersideInput): readonly ClutchUndersideVerdict[] {
  const bottomY = input.bodyBoundsLdu.max[1];
  const triangles = horizontalBodyTriangles(input);
  return input.clutchSeatsLdu.map(([x, , z]) => {
    let lowest = Number.NEGATIVE_INFINITY;
    for (const triangle of triangles) {
      if (triangle.y > bottomY + EPSILON) continue;
      if (triangle.y <= lowest) continue;
      if (containsXZ(triangle, x, z)) lowest = triangle.y;
    }
    if (lowest === Number.NEGATIVE_INFINITY) return "open";
    return lowest < bottomY - EPSILON ? "recessed" : "flat";
  });
}

/**
 * Whether the mesh draws an underside at every clutch it declares.
 *
 * A part with no clutches has no underside to draw and is not making the claim,
 * so it answers `false` and takes the `none` mode rather than a shell one.
 */
export function meshUndersideIsDrawn(input: MeshUndersideInput): boolean {
  if (input.clutchSeatsLdu.length === 0) return false;
  return meshClutchUndersides(input).every((verdict) => verdict !== "flat");
}
