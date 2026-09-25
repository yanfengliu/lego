import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
  type PartDefinition,
} from "./index.js";
import { resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { meshClutchUndersides } from "./mesh-underside.ts";
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";

const PART_ID = "builtin:bracket-2x2-1x2-vertical-studs";

const EXPECTED_CLOSURE = [
  [
    "p/4-4cyli.dat",
    2_687,
    "sha256:4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
  ],
  [
    "p/4-4disc.dat",
    1_137,
    "sha256:a00b5547776f61a7389d303616987c76b3c4de86ad8ec32f22857e1bd5e5e40f",
  ],
  [
    "p/4-4edge.dat",
    1_084,
    "sha256:54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da",
  ],
  [
    "p/4-4ring3.dat",
    1_628,
    "sha256:1f2835ac308154edc2d6f479d8e742a55be981f6167b20bfa100c195bc0731dd",
  ],
  ["p/box4-1.dat", 973, "sha256:2ed58df5da841827dfc5f9ac11c0bd7ffd8a455e46f166638e635f61a014b44d"],
  [
    "p/box4-4a.dat",
    1_067,
    "sha256:58c69e00462c0a74c1bd6d75d757d826ae13e98bd3928b0e685209003bfbee54",
  ],
  ["p/box5.dat", 963, "sha256:ccb7b8a1d36692335b10ea6aa196849afcad4b15331683ed8112a10b50977318"],
  ["p/rect.dat", 654, "sha256:ffeb2dd3d9b83c38841f18f1f74800fbba9e90c5fb6badfff2a795f08a96cb71"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  ["p/stud3.dat", 710, "sha256:d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd"],
  ["p/stud4.dat", 935, "sha256:871cdcab26e7f5113488a24c453d6fabda75b275b06de592e0bfaad4292c12a3"],
  [
    "p/stug-2x1.dat",
    341,
    "sha256:03d08cea230e892e1b6cbfe523c19b568a834c5888aac5c789d1fb8d6ee93d96",
  ],
  ["p/tri3a4.dat", 468, "sha256:8c1cf47d85e2d2b429c0ac404108a9e91048fe7c9501b527dda55e75ad11bc4e"],
  [
    "parts/41682.dat",
    2_085,
    "sha256:5cfa8cee2d25fca26c2283a12b43978f4861359bc69affc26c337c3bdfcfb8f2",
  ],
] as const;

describe("41682 vertical-stud bracket catalog truth", () => {
  it("retains the exact /19 admission position and its measured upright frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "41682")!;

    expect(PART_DEFINITIONS[90]?.id).toBe(PART_ID);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "bracket",
      displayName: "Bracket 2 x 2 with 1 x 2 Vertical Studs",
      dimensions: { widthStuds: 2, lengthStuds: 2, heightLdu: 28 },
      bodyBoundsLdu: { min: [-20, -14, -20], max: [20, 14, 20] },
      boundsLdu: { min: [-20, -14, -20], max: [20, 14, 20] },
      substitutionGroupId: "bracket:2x2-vertical-studs",
    });
    expect(resolvePartId("41682.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:41682.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, 6, 0],
    });
  });

  it("pins the exact official closure, attribution, and closure manifest", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["41682"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "41682")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Bracket  2 x  2 -  1 x  2 Up Centred",
      author: "Gerald Lasser [GeraldLasser]",
      ldrawOrg: "Part UPDATE 2019-01",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:5cfa8cee2d25fca26c2283a12b43978f4861359bc69affc26c337c3bdfcfb8f2",
      closureFileCount: 14,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["41682"]).toEqual({
      bytes: 15_430,
      manifestSha256: "sha256:b16625dfbd49f9c365f06e4b088fd0e1a8e469e649e2b028041767b5f09a03e6",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(45);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(237);
  });

  it("uses only the pinned LDCad walk for six clutches and two side studs", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "41682")!;
    if (!("ldcadShadowSource" in blueprint)) throw new Error("41682 has no pinned LDCad route");

    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/stud.dat", "p/stud3.dat", "p/stud4.dat", "parts/41682.dat"],
    });
    expect(
      part.connectors.map(({ kind, positionLdu, normal, orientationId }) => ({
        kind,
        positionLdu,
        normal,
        orientationId,
      })),
    ).toEqual([
      {
        kind: "stud",
        positionLdu: [-10, -4, -4],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      {
        kind: "stud",
        positionLdu: [10, -4, -4],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      ...[-10, 10].flatMap((x) =>
        [-10, 10].map((z) => ({
          kind: "undersideClutch" as const,
          positionLdu: [x, 14, z],
          normal: [0, 1, 0],
          orientationId: "connector-down",
        })),
      ),
      // /32: the square-S6 socket in the wall's back recess, appended so the
      // four underside seats keep undersideClutch:0..3.
      ...[-10, 10].map((x) => ({
        kind: "undersideClutch" as const,
        positionLdu: [x, -4, 4],
        normal: [0, 0, 1],
        orientationId: "connector-z-positive",
      })),
    ]);
    expect(part.connectors.map(({ id }) => id)).toEqual([
      "stud:0",
      "stud:1",
      ...[0, 1, 2, 3, 4, 5].map((index) => `undersideClutch:${index}`),
    ]);
  });

  it("binds 336 triangles and all 64 positive-volume collision primitives", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:41682.dat"]!;
    if (asset.indices === undefined) throw new Error("41682 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 240 },
      { role: "stud", triangleStart: 240, triangleCount: 96 },
    ]);
    expect(asset.indices.length / 3).toBe(336);
    expect(asset.positionsLdu.length / 3).toBe(399);
    expect(boxes).toHaveLength(62);
    expect(cylinders).toEqual(
      [-10, 10].map((x, index) => ({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "z",
        centerLdu: [x, -4, -6],
        radiusLdu: 6.0001514980873605,
        validatedConnectionProfileRadiusLdu: 6,
        heightLdu: 4,
      })),
    );
    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(part.collision.allowances.map(({ portId, centerLdu }) => [portId, centerLdu])).toEqual([
      ["undersideClutch:0", [-10, 12, -10]],
      ["undersideClutch:1", [-10, 12, 10]],
      ["undersideClutch:2", [10, 12, -10]],
      ["undersideClutch:3", [10, 12, 10]],
      // Centred half the 4-LDU stud depth inside each recess seat, along -Z.
      ["undersideClutch:4", [-10, -4, 2]],
      ["undersideClutch:5", [10, -4, 2]],
    ]);
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("leaves the recess empty and stands nothing past the wall's back face", () => {
    const part = getPartDefinition(PART_ID)!;
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    // The nominal stud a recess seat takes: radius 6 about [x, -4], z from 0 to 4.
    for (const x of [-10, 10]) {
      const intruding = boxes.filter(({ minLdu, maxLdu }) => {
        const dx = Math.max(minLdu[0] - x, 0, x - maxLdu[0]);
        const dy = Math.max(minLdu[1] + 4, 0, -4 - maxLdu[1]);
        return minLdu[2] < 4 && maxLdu[2] > 0 && dx * dx + dy * dy < 36;
      });
      expect(intruding, `seat at x=${x}`).toEqual([]);
    }
    // Behind the wall (z > 4) only the 2 x 2 plate stands, below y = 6. /31's
    // height field put two 1-LDU columns there up to the wall top (y = -14).
    expect(boxes.filter(({ minLdu, maxLdu }) => maxLdu[2] > 4 && minLdu[1] < 6)).toEqual([]);
  });

  it("refuses the /31 stick-out and a seat whose orientation does not name its normal", () => {
    const part = getPartDefinition(PART_ID)!;
    const stickOut: PartDefinition = {
      ...part,
      collision: {
        ...part.collision,
        primitives: [
          ...part.collision.primitives,
          {
            id: "body:stick-out",
            kind: "box",
            tag: "body",
            minLdu: [-12, -14, 4],
            maxLdu: [-11, 10, 5],
          },
        ],
      },
    };
    const stickOutResult = validateMeshPartDefinitionAdmission(stickOut);
    expect(stickOutResult.issues.map(({ code, path }) => [code, path])).toEqual([
      ["MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH", "/connectors/6/positionLdu"],
    ]);
    expect(stickOutResult.issues[0]!.message).toMatch(
      /seats at Z=4, but 1 body collision primitive\(s\) stand out to Z=5 along its outward normal \[0, 0, 1\]/u,
    );

    const misnamed: PartDefinition = {
      ...part,
      connectors: part.connectors.map((connector) =>
        connector.id === "undersideClutch:4"
          ? { ...connector, orientationId: "connector-down" as const }
          : connector,
      ),
    };
    expect(
      validateMeshPartDefinitionAdmission(misnamed).issues.map(({ code, path }) => [code, path]),
    ).toEqual([["MESH_ADMISSION_CONNECTOR_INVALID", "/connectors/6"]]);
  });

  it("reads each recess seat as recessed along its own axis", () => {
    const part = getPartDefinition(PART_ID)!;
    if (part.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("41682 is unexpectedly not a preloaded mesh");
    }
    const resolution = resolvePreloadedMeshAsset(part.geometry);
    if (!resolution.ok) throw new Error(`41682 mesh resolution failed: ${resolution.message}`);
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");
    const seats = {
      positionsLdu: resolution.asset.positionsLdu,
      indices: resolution.asset.indices,
      groups: resolution.asset.groups,
      bodyBoundsLdu: part.bodyBoundsLdu,
      clutchSeatsLdu: clutches.map(({ positionLdu }) => positionLdu),
    };
    const input = { ...seats, clutchNormals: clutches.map(({ normal }) => normal) };

    // The recess floor faces +Z 4 LDU behind each recess seat.
    expect(meshClutchUndersides(input)).toEqual(Array(6).fill("recessed"));
    expect(part.geometry.undersideMode).toBe("modelled-shell-cavity");
    // Read as underside seats instead (no normals), the recess seats' plan point
    // lands under the plate's cavity ceiling, a verdict about the wrong face.
    expect(meshClutchUndersides(seats).slice(4)).toEqual(["recessed", "recessed"]);
    // A seat moved onto the flange's solid back face at x = 18 reads flat.
    expect(
      meshClutchUndersides({
        ...input,
        clutchSeatsLdu: [[18, -4, 4]],
        clutchNormals: [[0, 0, 1]],
      }),
    ).toEqual(["flat"]);
  });

  it("pins the reviewed /32 projection of the /18 prefix under its historical truth label", () => {
    // /32 moves no part of this prefix, only the label. /31 moved these with
    // seven parts' nominal-stud-tube/1 stud profiles; removing those and
    // restoring the /30 label reproduces the /30 pins.
    const priorParts = PART_DEFINITIONS.slice(0, 90);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/32",
      "builtin.basic-parts/18",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));
    const collision = priorParts.map(({ id, collision: value }) => ({ id, collision: value }));

    expect(priorParts).toHaveLength(90);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collision)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_579_898,
      definitionHash: "38bbdc808011147d145ad0f3f057e9757f075cf9f7e085211698ba4104a31667",
      connectorCollisionHash: "c7050ab5f00faed3d0f7c699f64cc12b927f21ebbd2250161daeb3e29a888e10",
      collisionHash: "f3311ca95758a2448fcafbb08ef5b030e4d5555e0ee13ce8547670bb1daf11e0",
    });
  });
});
