/**
 * Gate: the renderer keeps LDraw's hand.
 *
 * Until 2026-09-24 catalog LDU reached Three.js as (x, -y, z), a reflection, and
 * every model drew as its mirror image: a left wing looked like a right one and
 * the booklet's step-31 picture came out flipped. The determinant check that
 * existed (`real-build-builder-proper-world-diagnostic.test.ts`) stayed at +1
 * the whole time, because it measured `lduTransformToThreeMatrix` alone, and
 * B·R·B is a rotation for either sign of det B: the reflection lived in the
 * vector map that positions, vertices and picks go through.
 *
 * So this file checks the composition, and checks it against an independent
 * reference: `makeRotationX(PI)` scaled, the frame Three's own `LDrawLoader`
 * gives LDraw data, built here without reading `LDU_TO_THREE_AXIS_SIGNS`.
 *
 * Bounds: the 24 proper orientations at one off-origin position; the chiral
 * pair `41770a`/`41769a` (2x4 wedge plates, left and right) at one position
 * and yaw, in the canonical `top` view. Geometry drawn without going through
 * `coordinates.ts` is covered only where it feeds these parts' meshes; picking
 * is gated in `apps/web/src/viewport`.
 */
import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import {
  PROPER_ORIENTATIONS,
  getPartDefinition,
  type LduVector3,
  type MeshReferenceGeometryRecipe,
  type PartDefinition,
} from "@lego-studio/catalog";
import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
import { Box3, Matrix3, Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { describe, expect, it } from "vitest";

import { SET_6651557_MESH_ASSETS } from "../../catalog/src/mesh-assets-6651557.ts";
import { createCatalogPartGeometry } from "./geometry.ts";
import {
  THREE_UNITS_PER_LDU,
  createCameraForView,
  createCanonicalViewPacket,
  deriveBrickScene,
  lduToThreeBasisMatrix,
  lduToThreeVector,
  lduTransformToThreeMatrix,
  threeToLduVector,
} from "./index.ts";

/** LDrawLoader's frame for LDraw data: a half-turn about X, then LDU to scene units. */
function ldrawLoaderReference(): Matrix4 {
  return new Matrix4()
    .makeRotationX(Math.PI)
    .multiply(
      new Matrix4().makeScale(THREE_UNITS_PER_LDU, THREE_UNITS_PER_LDU, THREE_UNITS_PER_LDU),
    );
}

function determinantOfColumns(columns: readonly Vector3[]): number {
  const [a, b, c] = columns;
  return new Matrix3().set(a!.x, b!.x, c!.x, a!.y, b!.y, c!.y, a!.z, b!.z, c!.z).determinant();
}

const UNIT_AXES: readonly LduVector3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

describe("LDU to Three basis change", () => {
  it("maps vectors through a rotation, the one LDrawLoader applies", () => {
    const columns = UNIT_AXES.map((axis) =>
      lduToThreeVector(axis).divideScalar(THREE_UNITS_PER_LDU),
    );
    expect(determinantOfColumns(columns)).toBeCloseTo(1, 12);
    expect(lduToThreeBasisMatrix().determinant()).toBeGreaterThan(0);

    const reference = ldrawLoaderReference();
    for (const point of [
      [20, -24, 40],
      [-30, 8, -110],
      [0, 0, 1],
    ] as const satisfies readonly LduVector3[]) {
      const mapped = lduToThreeVector(point);
      const expected = new Vector3(...point).applyMatrix4(reference);
      expect(mapped.distanceTo(expected), `LDU ${point.join(",")}`).toBeLessThan(1e-12);
      expect(threeToLduVector(mapped)).toEqual(point.map((value) => expect.closeTo(value, 9)));
    }
  });

  it("maps every proper orientation's full part transform through a rotation", () => {
    const positionLdu: LduVector3 = [60, -24, -140];
    const reference = ldrawLoaderReference();
    for (const orientation of PROPER_ORIENTATIONS) {
      const partMatrix = lduTransformToThreeMatrix({
        positionLdu,
        orientationId: orientation.id,
      });
      // A vertex authored in part-local LDU reaches the scene through the
      // vector map and then the part matrix, which is what deriveBrickScene does.
      const world = (local: LduVector3) => lduToThreeVector(local).applyMatrix4(partMatrix);
      const origin = world([0, 0, 0]);
      const columns = UNIT_AXES.map((axis) =>
        world(axis).sub(origin).divideScalar(THREE_UNITS_PER_LDU),
      );
      expect(determinantOfColumns(columns), orientation.id).toBeCloseTo(1, 12);

      // The same vertex placed in LDU first, then given LDrawLoader's frame.
      const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = orientation.matrix;
      for (const local of [[7, -3, 11]] as const satisfies readonly LduVector3[]) {
        const placed = new Vector3(
          m11 * local[0] + m12 * local[1] + m13 * local[2] + positionLdu[0],
          m21 * local[0] + m22 * local[1] + m23 * local[2] + positionLdu[1],
          m31 * local[0] + m32 * local[1] + m33 * local[2] + positionLdu[2],
        ).applyMatrix4(reference);
        expect(world(local).distanceTo(placed), orientation.id).toBeLessThan(1e-9);
      }
    }
  });
});

const CHIRAL_PAIR = [
  { catalogPartId: "builtin:wedge-plate-2x4-left", ldrawId: "41770a", expectedHand: -1 },
  { catalogPartId: "builtin:wedge-plate-2x4-right", ldrawId: "41769a", expectedHand: 1 },
] as const;

function documentWithPart(part: PartInstance): BrickDocumentV1 {
  const document = createEmptyBrickDocument({ id: "handedness", name: "Handedness fixture" });
  return {
    ...document,
    parts: [part],
    submodels: document.submodels.map((submodel) => ({ ...submodel, partIds: [part.id] })),
    steps: document.steps.map((step) => ({ ...step, partIds: [part.id] })),
  };
}

function worldVertices(root: import("three").Object3D): Vector3[] {
  root.updateMatrixWorld(true);
  const vertices: Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.renderRole !== "body") return;
    const positions = (object.geometry as BufferGeometry).getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      vertices.push(
        new Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld),
      );
    }
  });
  return vertices;
}

/** Points of `from` with no point of `to` within `tolerance` scene units. */
function unmatched(from: readonly Vector3[], to: readonly Vector3[], tolerance: number): Vector3[] {
  return from.filter((point) => !to.some((other) => other.distanceTo(point) <= tolerance));
}

/** Float32 attribute storage is the only difference a correct render may show. */
const VERTEX_TOLERANCE = 1e-5;

describe("a chiral pair renders with LDraw's hand", () => {
  const positionLdu: LduVector3 = [40, -8, -60];

  it.each(CHIRAL_PAIR)(
    "$catalogPartId draws LDraw $ldrawId's own vertices, not their mirror",
    ({ catalogPartId, ldrawId }) => {
      const definition = getPartDefinition(catalogPartId)!;
      const recipe = definition.geometry as MeshReferenceGeometryRecipe;
      expect(recipe.assetId).toBe(`ldraw:official:${ldrawId}.dat`);
      const source = SET_6651557_MESH_ASSETS[recipe.assetId]!;
      const frame = PROPER_ORIENTATIONS.find(
        ({ id }) => id === recipe.assetToCatalogFrame.orientationId,
      )!.matrix;
      const [tx, ty, tz] = recipe.assetToCatalogFrame.translationLdu;
      const reference = ldrawLoaderReference();
      const expected: Vector3[] = [];
      for (let index = 0; index < source.positionsLdu.length; index += 3) {
        const [x, y, z] = source.positionsLdu.slice(index, index + 3) as [number, number, number];
        const placed = new Vector3(
          frame[0]! * x + frame[1]! * y + frame[2]! * z + tx + positionLdu[0],
          frame[3]! * x + frame[4]! * y + frame[5]! * z + ty + positionLdu[1],
          frame[6]! * x + frame[7]! * y + frame[8]! * z + tz + positionLdu[2],
        );
        expected.push(placed.applyMatrix4(reference));
      }

      const part = createPartInstance({
        id: ldrawId,
        catalogPartId,
        transform: { positionLdu, orientationId: "upright-yaw-0" },
      });
      const projection = deriveBrickScene(documentWithPart(part));
      const drawn = worldVertices(projection.partObjects.get(part.id)!);
      projection.dispose();

      expect(drawn.length).toBeGreaterThan(0);
      expect(unmatched(drawn, expected, VERTEX_TOLERANCE)).toEqual([]);
      expect(unmatched(expected, drawn, VERTEX_TOLERANCE)).toEqual([]);
    },
  );

  /**
   * The same fact read off a picture, in LDraw's own terms. Each wing's body
   * sits toward its straight long edge (LDraw -X for the left wing, +X for the
   * right) and toward its full-width back end (LDraw +Z; the point faces -Z).
   * The `top` view puts LDraw +X to the right and LDraw +Z at the top, so the
   * vertex centroid's offset from the image centre has x and y of opposite
   * signs for the left wing and of the same sign for the right one.
   */
  it.each(CHIRAL_PAIR)(
    "$catalogPartId has the hand LDraw gives $ldrawId in the canonical top view",
    ({ catalogPartId, ldrawId, expectedHand }) => {
      const part = createPartInstance({
        id: ldrawId,
        catalogPartId,
        transform: { positionLdu, orientationId: "upright-yaw-0" },
      });
      const projection = deriveBrickScene(documentWithPart(part));
      const packet = createCanonicalViewPacket(projection);
      const top = packet.views.find(({ name }) => name === "top")!;
      const camera = createCameraForView(top);
      const projected = worldVertices(projection.partObjects.get(part.id)!).map((vertex) =>
        vertex.project(camera),
      );
      projection.dispose();

      const low = new Vector3(Infinity, Infinity, 0);
      const high = new Vector3(-Infinity, -Infinity, 0);
      const centroid = new Vector3();
      for (const point of projected) {
        low.min(point);
        high.max(point);
        centroid.add(point);
      }
      centroid.divideScalar(projected.length);
      const centre = low.clone().add(high).multiplyScalar(0.5);
      const hand = Math.sign(centroid.x - centre.x) * Math.sign(centroid.y - centre.y);
      expect(hand).toBe(expectedHand);
    },
  );
});

/**
 * Winding follows the basis change: a triangle's front face is decided by its
 * vertex order in the scene, so a solid built from LDU numbers faces out only if
 * its winding is chosen after the basis change. Every material here is
 * `FrontSide`, so an inward face is not drawn at all. The procedural wedge wound
 * its side walls inward even before 2026-09-24; no catalog part reaches it
 * today (every wedge plate is an LDraw mesh), so these build it from a
 * parametric recipe on purpose. A closed solid wound outward has a positive
 * signed volume.
 *
 * Bound: one wedge (`30503`'s cut) and one arc (`30565`'s quarter disc), at one
 * off-origin position and yaw.
 */
describe("procedural solids face out in the scene", () => {
  function signedVolume(mesh: Mesh): number {
    mesh.updateMatrixWorld(true);
    const source = mesh.geometry as BufferGeometry;
    const geometry = source.index ? source.toNonIndexed() : source;
    const positions = geometry.getAttribute("position");
    const corner = (index: number) =>
      new Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
    let volume = 0;
    for (let index = 0; index < positions.count; index += 3) {
      volume += corner(index).dot(corner(index + 1).cross(corner(index + 2))) / 6;
    }
    return volume;
  }

  const parametric = getPartDefinition("builtin:plate-2x2")!.geometry;

  it.each([
    {
      catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
      bodyArc: undefined,
      primitive: (definition: PartDefinition) =>
        definition.collision.primitives.find(({ kind }) => kind === "wedge")!.id,
    },
    {
      catalogPartId: "builtin:corner-plate-4x4-round",
      bodyArc: {
        centerXZLdu: [-40, 40],
        innerRadiusLdu: 0,
        outerRadiusLdu: 80,
        startAngleDegrees: -90,
        endAngleDegrees: 0,
        segmentCount: 8,
      } as const,
      primitive: () => "body:arc",
    },
  ])(
    "builds $catalogPartId's procedural body wound outward",
    ({ catalogPartId, bodyArc, primitive }) => {
      const catalogDefinition = getPartDefinition(catalogPartId)!;
      const definition: PartDefinition = {
        ...catalogDefinition,
        geometry: { ...parametric, ...(bodyArc ? { bodyArc } : {}) } as PartDefinition["geometry"],
      };
      const part = createPartInstance({
        id: "procedural",
        catalogPartId,
        transform: { positionLdu: [40, -8, -60], orientationId: "upright-yaw-90" },
      });
      const group = createCatalogPartGeometry(part, definition, false, []);
      group.applyMatrix4(lduTransformToThreeMatrix(part.transform));
      const primitiveId = primitive(definition);
      const bodies: Mesh[] = [];
      group.traverse((object) => {
        if (object instanceof Mesh && object.userData.primitiveId === primitiveId)
          bodies.push(object);
      });
      expect(bodies).toHaveLength(1);
      const volume = signedVolume(bodies[0]!);
      const bounds = new Box3().setFromObject(bodies[0]!);
      const size = bounds.getSize(new Vector3());
      expect(volume, `${catalogPartId} signed volume`).toBeGreaterThan(0);
      // Sanity: an outward solid's signed volume is its volume, below its box's.
      expect(volume).toBeLessThanOrEqual(size.x * size.y * size.z + 1e-9);
    },
  );
});
