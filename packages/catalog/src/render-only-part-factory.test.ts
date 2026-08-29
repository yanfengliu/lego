import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getPartDefinition } from "./catalog.ts";
import { SET_6651557_RENDER_ONLY_BLUEPRINTS } from "./part-blueprints-6651557-render-only.ts";
import { PART_BLUEPRINTS } from "./part-blueprints.ts";
import { makePartDefinition } from "./part-factory.ts";
import {
  promoteRenderOnlyPart,
  renderPromotionStructuralBytes,
} from "./render-only-part-factory.ts";

const EXPECTED_IDS = [
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
  "builtin:wedge-plate-3x6-right",
  "builtin:arch-1x4",
  "builtin:arch-1x6",
  "builtin:curved-slope-1x2",
  "builtin:curved-slope-1x3",
  "builtin:curved-slope-1x4",
  "builtin:cheese-slope-1x1",
  "builtin:cheese-slope-2x1",
] as const;

const blueprintId = (blueprint: (typeof SET_6651557_RENDER_ONLY_BLUEPRINTS)[number]): string =>
  `builtin:${blueprint.family}-${blueprint.widthStuds}x${blueprint.lengthStuds}${
    "variant" in blueprint ? `-${blueprint.variant}` : ""
  }`;

const structuralHash = (bytes: string): string => createHash("sha256").update(bytes).digest("hex");

describe("render-only part promotion", () => {
  it("pins reviewed connector, allowance, collision, grid-centre and overhang evidence bytes", () => {
    const precedingById = new Map(
      PART_BLUEPRINTS.map(makePartDefinition).map((part) => [part.id, part] as const),
    );
    const actualHashes: Record<string, string> = {};

    for (const id of EXPECTED_IDS) {
      const preceding = precedingById.get(id);
      const promoted = getPartDefinition(id);
      expect(preceding, `${id} needs a preceding parametric definition`).toBeDefined();
      expect(promoted, `${id} needs a promoted catalog definition`).toBeDefined();
      if (preceding === undefined || promoted === undefined) continue;

      const precedingBytes = renderPromotionStructuralBytes(preceding);
      const promotedBytes = renderPromotionStructuralBytes(promoted);
      expect(promotedBytes, id).toBe(precedingBytes);
      const blueprint = SET_6651557_RENDER_ONLY_BLUEPRINTS.find(
        (candidate) => blueprintId(candidate) === id,
      );
      expect(blueprint, `${id} needs one render-only blueprint`).toBeDefined();
      if (blueprint === undefined) continue;
      const directlyPromoted = promoteRenderOnlyPart(preceding, blueprint);
      expect(directlyPromoted.connectors, `${id} connectors`).toBe(preceding.connectors);
      expect(directlyPromoted.collision, `${id} collision`).toBe(preceding.collision);
      expect(directlyPromoted.collision.allowances, `${id} allowances`).toBe(
        preceding.collision.allowances,
      );
      const authoredGridCenter =
        preceding.connectorGridCenterLdu ??
        ("connectorGridCenterLdu" in preceding.geometry
          ? preceding.geometry.connectorGridCenterLdu
          : undefined);
      if (authoredGridCenter === undefined) {
        expect(directlyPromoted.connectorGridCenterLdu, `${id} connector grid centre`).toEqual([
          0, 0,
        ]);
      } else {
        expect(directlyPromoted.connectorGridCenterLdu, `${id} connector grid centre`).toBe(
          authoredGridCenter,
        );
      }
      expect(
        directlyPromoted.geometry.partialOverhangClutchEvidence,
        `${id} partial-overhang evidence`,
      ).toBe(preceding.geometry.partialOverhangClutchEvidence);
      expect(renderPromotionStructuralBytes(directlyPromoted), id).toBe(precedingBytes);
      actualHashes[id] = structuralHash(precedingBytes);
    }

    expect(actualHashes).toEqual({
      "builtin:wedge-plate-2x4-left":
        "ab2372d9aaf6499fe7eb0dd57da18c0c9f952cf0d22c69f5af3345ef1a8e1a33",
      "builtin:wedge-plate-2x4-right":
        "f30f110c01d60d67c32df1815d66fc1af3b3450e6cb54d1b6acc06c2d635329d",
      "builtin:wedge-plate-2x3-left":
        "c67aa00a9fb6e35140fe50e0dfb5f450294a620198511e9b350f86bf14b62f91",
      "builtin:wedge-plate-2x3-right":
        "5f7415f51f3ee3fcde8c6ba84168c05b9c06c73365a5464be28e5721d597fa93",
      "builtin:wedge-plate-3x6-right":
        "3442481d44e9053b36d582ce8a0918158eac979b853f4d49db4f2c997ae46f0b",
      "builtin:arch-1x4": "ebc4ccfc806f46dbfcf58a8c003dd8673d7c9805ec0353b36cef3daad485a920",
      "builtin:arch-1x6": "aa373aa17387a0094e9ae14c6a492ae3d99e006f4c38e5f5ba4990b52a4025f9",
      "builtin:curved-slope-1x2":
        "38f34102d9a2a55945ef7cff8efb88ce55435376b1a9f7f48c23e8d14f3ba7ea",
      "builtin:curved-slope-1x3":
        "b7d97e08931f99f4468bf5299a1820bb7b87432e67cd38ea452a4d32859f5327",
      "builtin:curved-slope-1x4":
        "b9d9a0c06129c5fd5d6dcf1e4b88da557c36648ff038d9a4f0fcfd7800e54a16",
      "builtin:cheese-slope-1x1":
        "fd0b0a89c904a75f1b8f90c499f5abf80b9337419da718926549b0dd4ccedb13",
      "builtin:cheese-slope-2x1":
        "9bc85844c8e6b7030e0f8d7f4962e5f36d46f5ddd3794c26c80687dd8eb5e951",
    });
  });

  it("keeps structural facts out of the generated render authority", () => {
    expect(SET_6651557_RENDER_ONLY_BLUEPRINTS.map(blueprintId)).toEqual(EXPECTED_IDS);
    expect(SET_6651557_RENDER_ONLY_BLUEPRINTS.map(({ ldrawId }) => ldrawId)).toEqual([
      "41770a.dat",
      "41769a.dat",
      "43723a.dat",
      "43722a.dat",
      "54383.dat",
      "3659.dat",
      "3455.dat",
      "11477.dat",
      "50950.dat",
      "61678.dat",
      "54200.dat",
      "85984.dat",
    ]);
    expect(
      SET_6651557_RENDER_ONLY_BLUEPRINTS.map(({ assetToCatalogFrame }) => [
        assetToCatalogFrame.orientationId,
        assetToCatalogFrame.translationLdu,
      ]),
    ).toEqual([
      ["upright-yaw-0", [0, -4, 0]],
      ["upright-yaw-0", [0, -4, 0]],
      ["upright-yaw-0", [0, -4, 0]],
      ["upright-yaw-0", [0, -4, 0]],
      ["upright-yaw-0", [0, -4, 0]],
      ["upright-yaw-90", [0, -12, 0]],
      ["upright-yaw-90", [0, -12, 0]],
      ["upright-yaw-0", [0, 8, 0]],
      ["upright-yaw-0", [0, -12, 0]],
      ["upright-yaw-0", [0, -12, 0]],
      ["upright-yaw-0", [0, 8, 0]],
      ["upright-yaw-0", [0, 8, 0]],
    ]);
    expect(
      SET_6651557_RENDER_ONLY_BLUEPRINTS.map(({ sourceStudSeatsLdu }) => sourceStudSeatsLdu.length),
    ).toEqual([4, 4, 3, 3, 9, 4, 6, 0, 0, 0, 0, 0]);
    const permittedKeys = [
      "assetToCatalogFrame",
      "designId",
      "exactBodyBoundsLdu",
      "exactBoundsLdu",
      "family",
      "heightLdu",
      "ldrawId",
      "ldrawSource",
      "lengthStuds",
      "meshAssetId",
      "sourceStudSeatsLdu",
      "variant",
      "widthStuds",
    ];
    for (const blueprint of SET_6651557_RENDER_ONLY_BLUEPRINTS) {
      expect(Object.keys(blueprint).sort(), blueprint.ldrawId).toEqual(
        permittedKeys.filter((key) => key !== "variant" || "variant" in blueprint),
      );
    }
  });

  it("refuses a source frame whose visible studs disagree with predecessor connectors", () => {
    const blueprint = SET_6651557_RENDER_ONLY_BLUEPRINTS[0];
    const preceding = PART_BLUEPRINTS.map(makePartDefinition).find(
      ({ id }) => id === blueprintId(blueprint),
    );
    expect(preceding).toBeDefined();
    if (preceding === undefined) return;

    expect(() =>
      promoteRenderOnlyPart(preceding, {
        ...blueprint,
        sourceStudSeatsLdu: blueprint.sourceStudSeatsLdu.map(([x, y, z]) => [x + 1, y, z]),
      }),
    ).toThrow(/never move connector truth to meet a mesh/);
  });
});
