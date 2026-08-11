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
  it("keeps connector, allowance, collision, grid-centre and overhang evidence bytes at /12 literals", () => {
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
        "3a84f53caa2d2e2afd28b350491c3f9fabfbdf13cebd298e14ed0bc22e5cfda7",
      "builtin:wedge-plate-2x4-right":
        "b25a6db385c268e51c3f82df7a980d3947146c0025a8a71de567d7c923202eee",
      "builtin:wedge-plate-2x3-left":
        "c0b9a6f75daa9592fa7a09ab1feb0ee0356379df594447b2988a591010afbd02",
      "builtin:wedge-plate-2x3-right":
        "37ba3d22b38e3d5abee6ef93fd1aefbab1e83b49ae9802c1d12bec7228cb1055",
      "builtin:wedge-plate-3x6-right":
        "51787c581e5f746106c9e7d2dfbef4d935c2a6d0c454c3dc251ea981a155f88d",
      "builtin:arch-1x4": "88380f17eac9c1820aa011887c40e5a06f90ea3416107c2fb62b82762c437c0f",
      "builtin:arch-1x6": "e0d50d1a3880faf3c211329c40f711ce2823cbc822e6af28286824c63ce6f8a0",
      "builtin:curved-slope-1x2":
        "dc5383b3cb4bf8206f9d56a40840d527cca10e6ef6b14e6a9c29716c260c2af1",
      "builtin:curved-slope-1x3":
        "3c7c7c3f657a2acf130872d42ef22706909eb8701060f94a791e330ee5badd6f",
      "builtin:curved-slope-1x4":
        "029bb12832c24a00ffc2ea76532d4522c1fd203e538dcddd079dc6589285ebd6",
      "builtin:cheese-slope-1x1":
        "7999a18de7d3181276ee80bab4bb4d0d786ce32a5b461433bf8191fa165cfde2",
      "builtin:cheese-slope-2x1":
        "a73411c3d877c1482d57c5eb3b899aa21239a9026039af8c48ead246c3a76299",
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
