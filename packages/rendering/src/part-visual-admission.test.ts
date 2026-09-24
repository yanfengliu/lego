import {
  PROPER_ORIENTATIONS,
  createPreloadedMeshAssetResolver,
  meshAssetContentHash,
  type LduVector3,
  type MeshReferenceGeometryRecipe,
  type PreloadedMeshAsset,
} from "@lego-studio/catalog";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  Mesh,
  Vector3,
  type TypedArray,
} from "three";
import { describe, expect, it } from "vitest";

import {
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  bakeLDrawSourceIntoCatalogThree,
  createPartVisualAdmissionCamera,
  createPartVisualAdmissionCameraPacket,
} from "./part-visual-admission.ts";
import { createResolvedMeshGeometry } from "./resolved-mesh-geometry.ts";

type SourceFrame = MeshReferenceGeometryRecipe["assetToCatalogFrame"];

function frame(orientationId: string, translationLdu: LduVector3 = [11, -7, 5]): SourceFrame {
  return { schemaVersion: "mesh-asset-to-catalog-frame/1", orientationId, translationLdu };
}

/** Raw LDU attributes stored as `LDrawLoader` stores them, in Float32. */
function rawGeometry(attributes: Readonly<Record<string, readonly number[]>>): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, values] of Object.entries(attributes)) {
    geometry.setAttribute(name, new BufferAttribute(new Float32Array(values), 3));
  }
  return geometry;
}

function values(geometry: BufferGeometry, name: string): number[] {
  return Array.from(geometry.getAttribute(name).array as TypedArray);
}

/** An asymmetric tetrahedron whose coordinates Float32 holds exactly; its normals it does not. */
const ADMISSION_ASSET = {
  assetId: "test:visual-admission-tetrahedron/1",
  positionsLdu: [0, 0, 0, 20, 0.5, 0, 0, -8, 0.25, 1.5, 0, 10],
  normalsAssetLocal: [0.6, 0, 0.8, 0, -1, 0, 0.48, 0.6, 0.64, -0.8, 0, -0.6],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
  groups: [{ role: "body", triangleStart: 0, triangleCount: 4 }],
} as const satisfies PreloadedMeshAsset;

/** Every triangle corner's xyz for one attribute, in draw order. */
function corners(geometry: BufferGeometry, name: string): number[] {
  const attribute = geometry.getAttribute(name);
  const count = geometry.index?.count ?? attribute.count;
  return Array.from(
    { length: count },
    (_, corner) => geometry.index?.getX(corner) ?? corner,
  ).flatMap((vertex) => [attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex)]);
}

describe("part visual-admission camera and frame policy", () => {
  it("pins the required review order and labels every camera without aliases", () => {
    expect(PART_VISUAL_ADMISSION_VIEW_NAMES).toEqual([
      "top",
      "bottom",
      "front",
      "back",
      "left",
      "right",
      "isometric",
      "underside-oblique",
    ]);
    const packet = createPartVisualAdmissionCameraPacket(
      new Box3(new Vector3(-1, -2, -3), new Vector3(4, 5, 6)),
      new Box3(new Vector3(-7, -1, -2), new Vector3(2, 8, 3)),
    );
    expect(packet.views.map(({ name }) => name)).toEqual(PART_VISUAL_ADMISSION_VIEW_NAMES);
    expect(
      packet.views.map(({ name, projection, position, target, up }) => ({
        name,
        projection,
        direction: new Vector3(...position)
          .sub(new Vector3(...target))
          .normalize()
          .toArray()
          .map((value) => Math.round(value * 1_000_000) / 1_000_000),
        up,
      })),
    ).toEqual([
      { name: "top", projection: "orthographic", direction: [0, 1, 0], up: [0, 0, -1] },
      { name: "bottom", projection: "orthographic", direction: [0, -1, 0], up: [0, 0, 1] },
      { name: "front", projection: "orthographic", direction: [0, 0, 1], up: [0, 1, 0] },
      { name: "back", projection: "orthographic", direction: [0, 0, -1], up: [0, 1, 0] },
      { name: "left", projection: "orthographic", direction: [-1, 0, 0], up: [0, 1, 0] },
      { name: "right", projection: "orthographic", direction: [1, 0, 0], up: [0, 1, 0] },
      {
        name: "isometric",
        projection: "perspective",
        direction: [0.57735, 0.57735, 0.57735],
        up: [0, 1, 0],
      },
      {
        name: "underside-oblique",
        projection: "perspective",
        direction: [0.57735, -0.57735, 0.57735],
        up: [0, 1, 0],
      },
    ]);
    expect(packet.views.map((view) => createPartVisualAdmissionCamera(view).name)).toEqual(
      PART_VISUAL_ADMISSION_VIEW_NAMES.map((name) => `part-visual-admission-camera:${name}`),
    );
  });

  it("maps all three asymmetric raw axes through the actual yaw and LDU basis exactly once", () => {
    const surface = new Mesh(rawGeometry({ position: [2, 3, 5], normal: [1, 0, 0] }));
    const line = new LineSegments(
      rawGeometry({ position: [2, 3, 5], control0: [2, 3, 5], direction: [1, 2, 3] }),
    );
    const root = new Group().add(surface, line);
    bakeLDrawSourceIntoCatalogThree(root, frame("upright-yaw-90"));
    // yaw-90 maps raw [x,y,z] to catalog [z,y,-x], then the renderer's half-turn
    // about X negates Y and Z. A point takes the translation and the 0.05 scale,
    // a displacement the scale alone, a normal only the rotation.
    const point = [0.8, 0.2, -0.15].map(Math.fround);
    expect(values(surface.geometry, "position")).toEqual(point);
    expect(values(surface.geometry, "normal")).toEqual([0, 0, 1]);
    expect(values(line.geometry, "position")).toEqual(point);
    expect(values(line.geometry, "control0")).toEqual(point);
    expect(values(line.geometry, "direction")).toEqual([0.15, -0.1, 0.05].map(Math.fround));
  });

  it("accepts a non-upright proper source frame without widening placement", () => {
    const surface = new Mesh(rawGeometry({ position: [2, 3, 5] }));
    bakeLDrawSourceIntoCatalogThree(new Group().add(surface), frame("proper-m-p000n000n"));
    // The proper frame maps raw [x,y,z] to catalog [x,-y,-z], then Three negates Y and Z.
    expect(values(surface.geometry, "position")).toEqual([0.65, 0.5, 0].map(Math.fround));
  });

  it("refuses a reflection-derived frame ID and an unknown orientation", () => {
    for (const orientationId of ["proper-m-p000p000n", "unknown-frame"]) {
      expect(() =>
        bakeLDrawSourceIntoCatalogThree(new Group(), frame(orientationId, [0, 0, 0])),
      ).toThrow(/24 proper source\/catalog orientations/);
    }
  });

  it("refuses a source object off identity and an attribute it cannot place", () => {
    const moved = new Mesh(rawGeometry({ position: [2, 3, 5] }));
    moved.position.set(1, 0, 0);
    expect(() =>
      bakeLDrawSourceIntoCatalogThree(new Group().add(moved), frame("upright-yaw-0")),
    ).toThrow(/must sit at identity; Mesh "" has world matrix/);
    const tangent = new Mesh(rawGeometry({ position: [2, 3, 5], tangent: [1, 0, 0] }));
    expect(() =>
      bakeLDrawSourceIntoCatalogThree(new Group().add(tangent), frame("upright-yaw-0")),
    ).toThrow(/cannot move source attribute "tangent" into scene units/);
  });

  // The pixel comparison is exact only because both sides reach the GPU as
  // these same Float32 attributes under identity matrices. Bound: coordinates
  // Float32 holds exactly. `LDrawLoader` rounds raw LDU into Float32 before the
  // bake while production rounds once after scaling, so a coordinate such as
  // 12.4 LDU lands one Float32 step apart and is not covered here.
  it("hands the GPU the production candidate's own Float32 attributes under every proper frame", () => {
    const asset = ADMISSION_ASSET;
    const resolve = createPreloadedMeshAssetResolver({ [asset.assetId]: asset });
    for (const { id } of PROPER_ORIENTATIONS) {
      const resolution = resolve({
        generatorId: "builtin:preloaded-mesh-reference/1",
        assetId: asset.assetId,
        contentHash: meshAssetContentHash(asset),
        assetToCatalogFrame: frame(id),
        provenance: {
          sourceId: "lego-studio:test-visual-admission-tetrahedron",
          sourceType: "project-authored",
          sourceVersion: "1",
          licenseExpression: "MIT",
          attribution: "Synthetic test fixture authored for LEGO Studio.",
          runtimeRole: "render-mesh-asset",
          redistributionAllowed: true,
          trainingUseAllowed: false,
          externalGeometryBundled: false,
        },
      });
      if (!resolution.ok) throw new Error(`${id}: ${resolution.message}`);
      const candidate = createResolvedMeshGeometry(resolution.asset, true);
      // The loader's shape: one unindexed corner per triangle vertex, in the same order.
      const source = rawGeometry({
        position: asset.indices.flatMap((vertex) =>
          asset.positionsLdu.slice(vertex * 3, vertex * 3 + 3),
        ),
        normal: asset.indices.flatMap((vertex) =>
          asset.normalsAssetLocal.slice(vertex * 3, vertex * 3 + 3),
        ),
      });
      bakeLDrawSourceIntoCatalogThree(new Group().add(new Mesh(source)), frame(id));
      expect(corners(source, "position"), `${id} positions`).toEqual(
        corners(candidate, "position"),
      );
      expect(corners(source, "normal"), `${id} normals`).toEqual(corners(candidate, "normal"));
    }
  });

  it("fits every corner of both differently sized surfaces inside one shared frustum", () => {
    const source = new Box3(new Vector3(-4, -2, -1), new Vector3(7, 3, 2));
    const candidate = new Box3(new Vector3(-2, -6, -9), new Vector3(3, 8, 5));
    const packet = createPartVisualAdmissionCameraPacket(source, candidate);
    expect(packet.unionBounds).toEqual({ min: [-4, -6, -9], max: [7, 8, 5] });

    const corners = [source, candidate].flatMap((box) =>
      [box.min.x, box.max.x].flatMap((x) =>
        [box.min.y, box.max.y].flatMap((y) =>
          [box.min.z, box.max.z].map((z) => new Vector3(x, y, z)),
        ),
      ),
    );
    for (const view of packet.views) {
      const camera = createPartVisualAdmissionCamera(view);
      for (const corner of corners) {
        const projected = corner.clone().project(camera);
        expect(Math.abs(projected.x), `${view.name} x`).toBeLessThanOrEqual(1);
        expect(Math.abs(projected.y), `${view.name} y`).toBeLessThanOrEqual(1);
        expect(projected.z, `${view.name} near`).toBeGreaterThanOrEqual(-1);
        expect(projected.z, `${view.name} far`).toBeLessThanOrEqual(1);
      }
    }
  });
});
