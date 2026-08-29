import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG_VERSION,
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
} from "./index.js";
import { BUNDLED_LDRAW_CLOSURE_MANIFESTS } from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS_H } from "./part-blueprints-6651557-measured-h.ts";

const BRACKET_ID = "builtin:bracket-1x2-1x4-rounded-corners";
const AXLE_HOLDER_BRICK_ID = "builtin:brick-1x2x2-inside-axle-holder";
const ROUNDED_BOTTOM_BRACKET_ID = "builtin:bracket-1x2-1x4-rounded-bottom";
const WITHOUT_UNDERSTUD_BRICK_ID = "builtin:brick-1x2x2-without-understud";

const connectorRows = (partId: string) =>
  getPartDefinition(partId)!.connectors.map((connector) => ({
    kind: connector.kind,
    positionLdu: connector.positionLdu,
    normal: connector.normal,
    orientationId: connector.orientationId,
    profileId: connector.profileId,
    ...(connector.kind === "blindAxleHole" ? { axialSpan: connector.axialSpan } : {}),
  }));

const primitiveCounts = (partId: string) => {
  const primitives = getPartDefinition(partId)!.collision.primitives;
  return {
    boxes: primitives.filter(({ kind }) => kind === "box").length,
    cylinders: primitives.filter(({ kind }) => kind === "cylinder").length,
  };
};

function expectCollisionInsideVisualBounds(partId: string): void {
  const part = getPartDefinition(partId)!;
  for (const primitive of part.collision.primitives) {
    if (primitive.kind === "box") {
      expect(primitive.minLdu.every((value, axis) => value >= part.boundsLdu.min[axis]!)).toBe(
        true,
      );
      expect(primitive.maxLdu.every((value, axis) => value <= part.boundsLdu.max[axis]!)).toBe(
        true,
      );
      continue;
    }
    if (primitive.kind !== "cylinder") continue;
    const axis = "xyz".indexOf(primitive.axis);
    const half = [primitive.radiusLdu, primitive.radiusLdu, primitive.radiusLdu];
    half[axis] = primitive.heightLdu / 2;
    expect(
      primitive.centerLdu.every(
        (value, coordinate) =>
          value - half[coordinate]! >= part.boundsLdu.min[coordinate]! &&
          value + half[coordinate]! <= part.boundsLdu.max[coordinate]!,
      ),
    ).toBe(true);
  }
}

describe("official first-50 catalog tranche /29", () => {
  it("appends the two exact official identities without moving the /28 suffix tranche", () => {
    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/29");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.slice(-4).map(({ id }) => id)).toEqual([
      WITHOUT_UNDERSTUD_BRICK_ID,
      "builtin:brick-1x1x5-solid-stud",
      BRACKET_ID,
      AXLE_HOLDER_BRICK_ID,
    ]);
    expect(SET_6651557_MEASURED_BLUEPRINTS_H.map(({ designId }) => designId)).toEqual([
      "3245c",
      "2453b",
      "10201",
      "3245b",
    ]);
  });

  it("admits 10201 under only its exact public root and keeps 2436b as closure evidence", () => {
    const part = getPartDefinition(BRACKET_ID)!;
    expect(part).toMatchObject({
      id: BRACKET_ID,
      family: "bracket",
      displayName: "Bracket 1 x 2 - 1 x 4 with Rounded Corners",
      dimensions: { widthStuds: 4, lengthStuds: 1, heightLdu: 20 },
      bodyBoundsLdu: { min: [-40, -10, -14], max: [40, 10, 10] },
      boundsLdu: { min: [-40, -14, -18], max: [40, 10, 10] },
    });
    expect(resolvePartId("10201.dat")).toBe(BRACKET_ID);
    expect(resolvePartId("ldraw:10201.dat")).toBe(BRACKET_ID);
    expect(
      part.aliases.filter(({ namespace }) => namespace === "ldraw").map(({ value }) => value),
    ).toEqual(["10201.dat"]);
    expect(resolvePartId("10201")).toBeUndefined();
    expect(resolvePartId("2436b.dat")).toBeUndefined();
    expect(resolvePartId("28802.dat")).toBe(ROUNDED_BOTTOM_BRACKET_ID);
    expect(resolvePartId("28802.dat")).not.toBe(BRACKET_ID);
  });

  it("pins 10201's six studs and two exact square-S6 underside cells", () => {
    expect(connectorRows(BRACKET_ID)).toEqual([
      {
        kind: "stud",
        positionLdu: [-30, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [-10, -10, 0],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [-10, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [10, -10, 0],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [10, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [30, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
        profileId: "stud-tube/1",
      },
      {
        kind: "undersideClutch",
        positionLdu: [-10, -2, 0],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        profileId: "stud-tube/1",
      },
      {
        kind: "undersideClutch",
        positionLdu: [10, -2, 0],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        profileId: "stud-tube/1",
      },
    ]);
  });

  it("binds 10201's exact closure, 660-triangle surface, and conservative collision field", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_H.find(
      ({ designId }) => designId === "10201",
    )!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:10201.dat"]!;
    expect(blueprint.ldrawSource).toEqual({
      title: "=Bracket  1 x  2 -  1 x  4 with Rounded Corners",
      author: "Chris Dee [cwdee]",
      ldrawOrg: "Part Alias UPDATE 2014-02",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:028bc441268df93c08a363d375406cdf1eb70a25250bb3b56945fd6828395b7e",
      closureFileCount: 21,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["10201"]).toEqual({
      bytes: 18_905,
      manifestSha256: "sha256:3c786b7ef3c89032ab9e4568f53e1962b06987c9cda780c399f752721a4e4a24",
    });
    expect(asset.indices?.length).toBe(660 * 3);
    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 180 },
      { role: "stud", triangleStart: 180, triangleCount: 480 },
    ]);
    expect(primitiveCounts(BRACKET_ID)).toEqual({ boxes: 23, cylinders: 6 });
    expect(validateMeshPartDefinitionAdmission(getPartDefinition(BRACKET_ID)!)).toEqual({
      accepted: true,
      issues: [],
    });
    expectCollisionInsideVisualBounds(BRACKET_ID);
  });

  it("admits only exact 3245b while retaining physically distinct 3245c", () => {
    const part = getPartDefinition(AXLE_HOLDER_BRICK_ID)!;
    expect(part).toMatchObject({
      id: AXLE_HOLDER_BRICK_ID,
      family: "brick",
      displayName: "Brick 1 x 2 x 2 with Inside Axle Holder",
      dimensions: { widthStuds: 1, lengthStuds: 2, heightLdu: 48 },
      bodyBoundsLdu: { min: [-10, -24, -20], max: [10, 24, 20] },
      boundsLdu: { min: [-10, -28, -20], max: [10, 24, 20] },
    });
    expect(resolvePartId("3245b.dat")).toBe(AXLE_HOLDER_BRICK_ID);
    expect(resolvePartId("ldraw:3245b.dat")).toBe(AXLE_HOLDER_BRICK_ID);
    expect(
      part.aliases.filter(({ namespace }) => namespace === "ldraw").map(({ value }) => value),
    ).toEqual(["3245b.dat"]);
    expect(resolvePartId("3245.dat")).toBeUndefined();
    expect(resolvePartId("3245a.dat")).toBeUndefined();
    expect(resolvePartId("3245c.dat")).toBe(WITHOUT_UNDERSTUD_BRICK_ID);
    expect(resolvePartId("3245c.dat")).not.toBe(AXLE_HOLDER_BRICK_ID);
  });

  it("pins 3245b's two studs, two round underside cells, and exact blind axle holder", () => {
    expect(connectorRows(AXLE_HOLDER_BRICK_ID)).toEqual([
      {
        kind: "stud",
        positionLdu: [0, -24, -10],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        profileId: "stud-tube/1",
      },
      {
        kind: "stud",
        positionLdu: [0, -24, 10],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        profileId: "stud-tube/1",
      },
      {
        kind: "undersideClutch",
        positionLdu: [0, 24, -10],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        profileId: "stud-tube/1",
      },
      {
        kind: "undersideClutch",
        positionLdu: [0, 24, 10],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        profileId: "stud-tube/1",
      },
      {
        kind: "blindAxleHole",
        positionLdu: [0, 2, 0],
        normal: [0, 1, 0],
        orientationId: "connector-up",
        profileId: "axle-cross/1",
        axialSpan: {
          schemaVersion: "connector-axial-span/1",
          openEndLdu: [0, 24, 0],
          closedEndLdu: [0, -20, 0],
          depthLdu: 44,
          sliding: false,
        },
      },
    ]);
    expect(
      getPartDefinition(AXLE_HOLDER_BRICK_ID)!.connectors.some(
        ({ kind }) => kind === "axle" || kind === "axleHole" || kind === "blindAxleHole",
      ),
    ).toBe(true);
  });

  it("binds 3245b's exact closure, 144-triangle surface, and conservative collision field", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_H.find(
      ({ designId }) => designId === "3245b",
    )!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:3245b.dat"]!;
    expect(blueprint.ldrawSource).toEqual({
      title: "Brick  1 x  2 x  2 with Inside Axle Holder",
      author: "Steve Bliss [sbliss]",
      ldrawOrg: "Part UPDATE 2020-03",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:3741551acda207402f56b5f7905f1ccc507f8261ea92359fec7829b464b08649",
      closureFileCount: 11,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["3245b"]).toEqual({
      bytes: 10_868,
      manifestSha256: "sha256:9fdf84fa4dac343eaa9f4f3f30950044ae86613d66033b5c4bffd20a46b139c1",
    });
    expect(asset.indices?.length).toBe(144 * 3);
    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 48 },
      { role: "stud", triangleStart: 48, triangleCount: 96 },
    ]);
    expect(primitiveCounts(AXLE_HOLDER_BRICK_ID)).toEqual({ boxes: 29, cylinders: 2 });
    expect(validateMeshPartDefinitionAdmission(getPartDefinition(AXLE_HOLDER_BRICK_ID)!)).toEqual({
      accepted: true,
      issues: [],
    });
    expectCollisionInsideVisualBounds(AXLE_HOLDER_BRICK_ID);
  });
});
