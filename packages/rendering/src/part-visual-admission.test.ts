import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  createPartVisualAdmissionCamera,
  createPartVisualAdmissionCameraPacket,
  ldrawAssetToCatalogThreeMatrix,
} from "./part-visual-admission.ts";

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
    const matrix = ldrawAssetToCatalogThreeMatrix({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [11, -7, 5],
    });
    // yaw-90 maps raw [x,y,z] to catalog [z,y,-x], then the renderer flips Y.
    expect(new Vector3(2, 3, 5).applyMatrix4(matrix).toArray()).toEqual([0.8, 0.2, 0.15]);
  });

  it("accepts a non-upright proper source frame without widening placement", () => {
    const matrix = ldrawAssetToCatalogThreeMatrix({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "proper-m-p000n000n",
      translationLdu: [11, -7, 5],
    });
    // The proper frame maps raw [x,y,z] to catalog [x,-y,-z], then Three flips Y.
    expect(new Vector3(2, 3, 5).applyMatrix4(matrix).toArray()).toEqual([0.65, 0.5, 0]);
  });

  it("refuses a reflection-derived frame ID and an unknown orientation", () => {
    for (const orientationId of ["proper-m-p000p000n", "unknown-frame"]) {
      expect(() =>
        ldrawAssetToCatalogThreeMatrix({
          schemaVersion: "mesh-asset-to-catalog-frame/1",
          orientationId,
          translationLdu: [0, 0, 0],
        }),
      ).toThrow(/24 proper source\/catalog orientations/);
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
