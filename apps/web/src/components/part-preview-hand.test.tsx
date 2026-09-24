/**
 * Gate: the palette preview draws a part in its own hand, the way the
 * canonical isometric camera sees it.
 *
 * Bound: one chiral pair, the bundled LDraw meshes of 41770a (Wing 2 x 4
 * Left, `builtin:wedge-plate-2x4-left`) and 41769a (Wing 2 x 4 Right,
 * `builtin:wedge-plate-2x4-right`), measured through the extents of the
 * preview's polygons only. A defect that keeps each silhouette's extents, such
 * as a wrong painter's order or shade, is outside it. The projection check
 * compares scene axes with one canonical view, `isometric`, at its default
 * padding and an empty document.
 *
 * The expected numbers come from LDraw facts, not from the renderer's
 * LDU-to-scene mapping. 41770a has its straight full-length edge at x = -20,
 * its narrow end from x = -20 to 0 at z = -40 (LDraw's front) and its wide
 * end from x = -20 to 20 at z = 40, so the cut removes the +X, -Z corner.
 * The plate runs from y = -4 (top) to y = 4 (underside), and its studs, at
 * x = -10, stay inside these extents. 41769a is its mirror image in x.
 */
import { getPartDefinition } from "@lego-studio/catalog";
import { createCameraForView, createCanonicalViewPacket } from "@lego-studio/rendering";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { PartPreview } from "./PartPreview";
import { STUD_PX, project } from "./part-preview-projection";

type PlanCorner = readonly [x: number, z: number];

const LEFT_WING_CORNERS: readonly PlanCorner[] = [
  [-20, -40],
  [0, -40],
  [20, 40],
  [-20, 40],
];
const RIGHT_WING_CORNERS = LEFT_WING_CORNERS.map(([x, z]) => [-x, z] as const);
const PLATE_TOP_AND_UNDERSIDE_Y = [-4, 4] as const;

interface Extents {
  readonly width: number;
  readonly height: number;
  readonly minX: number;
  readonly maxY: number;
}

/**
 * Where the isometric camera draws LDraw points. It sits at the LDraw front
 * (-Z), right (+X) and above (-Y): direction (1, -1, -1) with up (0, -1, 0).
 * LDraw axes are right-handed, so its screen right is the cross product of up
 * and direction, along (1, 0, 1), and its screen down runs along (1, 2, -1).
 * Only ratios of these extents are compared, so their scale does not matter.
 */
function expectedExtents(corners: readonly PlanCorner[]): Extents {
  const screen = corners.flatMap(([x, z]) =>
    PLATE_TOP_AND_UNDERSIDE_Y.map((y) => [x + z, x + 2 * y - z] as const),
  );
  return extentsOf(screen);
}

function extentsOf(points: readonly (readonly [number, number])[]): Extents {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  return { width: Math.max(...xs) - minX, height: maxY - Math.min(...ys), minX, maxY };
}

function previewExtents(partId: string): Extents {
  const part = getPartDefinition(partId);
  if (part === undefined) throw new Error(`The catalog has no part ${partId}.`);
  const markup = renderToStaticMarkup(<PartPreview part={part} colorHex="#C91A09" />);
  expect(markup).toContain('data-preview-source="preloaded-mesh-asset"');
  const points = [...markup.matchAll(/ points="([^"]+)"/g)].flatMap(([, list]) =>
    list!.split(" ").map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x!, y!] as const;
    }),
  );
  expect(points.length).toBeGreaterThan(0);
  return extentsOf(points);
}

describe("palette preview hand", () => {
  it("draws the Wing 2 x 4 Left and Right each in its own hand", () => {
    const left = previewExtents("builtin:wedge-plate-2x4-left");
    const right = previewExtents("builtin:wedge-plate-2x4-right");
    const expectedLeft = expectedExtents(LEFT_WING_CORNERS);
    const expectedRight = expectedExtents(RIGHT_WING_CORNERS);

    // From the front right, the front-left corner is the leftmost point and
    // the front-right corner the lowest. The left wing keeps the first and
    // loses the second; the right wing does the opposite.
    expect(expectedLeft.width / expectedRight.width).toBeCloseTo(120 / 100, 9);
    expect(expectedLeft.height / expectedRight.height).toBeCloseTo(116 / 136, 9);
    expect(left.minX).toBeLessThan(right.minX);
    expect(left.maxY).toBeLessThan(right.maxY);
    // The markup rounds each coordinate to 0.01 px on extents near 40 px, so
    // the ratios hold to about 1e-3; the mirror image gives 100 / 120 and
    // 136 / 116.
    expect(left.width / right.width).toBeCloseTo(expectedLeft.width / expectedRight.width, 2);
    expect(left.height / right.height).toBeCloseTo(expectedLeft.height / expectedRight.height, 2);
  });

  it("projects scene axes the way the canonical isometric camera sees them", () => {
    const packet = createCanonicalViewPacket({
      documentHash: "palette-preview",
      bounds: new Box3(),
    });
    const view = packet.views.find(({ name }) => name === "isometric");
    if (view === undefined) throw new Error("The canonical view packet has no isometric view.");
    const camera = createCameraForView(view);
    const screenRight = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const screenUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    // An isometric drawing puts STUD_PX along each axis, sqrt(3 / 2) times
    // the axis's orthographic length on screen.
    const scale = STUD_PX * Math.sqrt(3 / 2);

    const points: readonly (readonly [number, number, number])[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [2, -1, 3],
    ];
    for (const point of points) {
      const [x, y] = project(...point);
      expect(x).toBeCloseTo(scale * new Vector3(...point).dot(screenRight), 9);
      expect(y).toBeCloseTo(-scale * new Vector3(...point).dot(screenUp), 9);
    }
  });
});
