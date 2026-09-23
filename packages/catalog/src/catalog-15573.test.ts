import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG_VERSION,
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
} from "./index.js";
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import {
  NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU,
  NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
} from "./measured-stud.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS_I } from "./part-blueprints-6651557-measured-i.ts";

const PART_ID = "builtin:jumper-plate-1x2";

describe("15573 centered-stud jumper catalog truth", () => {
  it("promotes the existing identity in place without appending or aliasing another part", () => {
    const part = getPartDefinition(PART_ID)!;

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/30");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.filter(({ id }) => id === PART_ID)).toEqual([part]);
    expect(PART_DEFINITIONS[52]).toBe(part);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "jumper-plate",
      displayName: "Jumper plate 1 x 2",
      dimensions: { widthStuds: 1, lengthStuds: 2, heightLdu: 8 },
      connectorGridCenterLdu: [0, 0],
      bodyBoundsLdu: { min: [-10, -4, -20], max: [10, 4, 20] },
      boundsLdu: { min: [-10, -8, -20], max: [10, 4, 20] },
      substitutionGroupId: "jumper-plate:1x2",
    });
    expect(resolvePartId("15573.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:15573.dat")).toBe(PART_ID);
    expect(resolvePartId("15573")).toBeUndefined();
  });

  it("binds the exact official closure, frame, and 220-triangle surface", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_I[0]!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:15573.dat"]!;
    const closurePaths = BUNDLED_LDRAW_CLOSURES["15573"]!.map(
      (index) => BUNDLED_LDRAW_SOURCE_FILES[index]!.path,
    );

    expect(blueprint).toMatchObject({
      designId: "15573",
      ldrawId: "15573.dat",
      validatedConnectionStudProfile: "nominal-stud-tube/1",
      studsLdu: [[0, -4, 0, 6.0001514980873605, 4]],
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-90",
        translationLdu: [0, -4, 0],
      },
      ldrawSource: {
        rootSha256: "sha256:c6946965875a8275996c4559cd355ea13a20197e96f33585cd750bb1da89b56d",
        closureFileCount: 11,
      },
      ldcadShadowSource: {
        commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
        manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
        shadowFiles: ["p/stud2.dat", "parts/15573.dat"],
      },
    });
    expect(closurePaths).toEqual([
      "p/4-4cyli.dat",
      "p/4-4edge.dat",
      "p/4-4ring2.dat",
      "p/box2-5.dat",
      "p/box3u4a.dat",
      "p/box4.dat",
      "p/box5.dat",
      "p/rect1.dat",
      "p/stud2.dat",
      "p/box3u6.dat",
      "parts/15573.dat",
    ]);
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["15573"]).toEqual({
      bytes: 12_907,
      manifestSha256: "sha256:c7a8d39b4b45fee945580a3e59f3d2e54dd231667ed24b0186ecc88bee73c2d1",
    });
    expect(asset.positionsLdu).toHaveLength(288 * 3);
    expect(asset.indices).toHaveLength(220 * 3);
    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 124 },
      { role: "stud", triangleStart: 124, triangleCount: 96 },
    ]);
  });

  it("preserves the two historical outer ids and adds one source-witnessed center seat", () => {
    const part = getPartDefinition(PART_ID)!;
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

    expect(clutches).toEqual([
      expect.objectContaining({
        id: "undersideClutch:0:0",
        positionLdu: [0, 4, -10],
        sharedCapacityGroupIds: ["15573:negative-z-half"],
      }),
      expect.objectContaining({
        id: "undersideClutch:center",
        positionLdu: [0, 4, 0],
        sharedCapacityGroupIds: ["15573:negative-z-half", "15573:positive-z-half"],
      }),
      expect.objectContaining({
        id: "undersideClutch:0:1",
        positionLdu: [0, 4, 10],
        sharedCapacityGroupIds: ["15573:positive-z-half"],
      }),
    ]);
    expect(part.collision.allowances).toEqual([
      expect.objectContaining({
        id: "tubeSeat:0:0",
        portId: "undersideClutch:0:0",
        centerLdu: [0, 2, -10],
      }),
      expect.objectContaining({
        id: "tubeSeat:center",
        portId: "undersideClutch:center",
        centerLdu: [0, 2, 0],
      }),
      expect.objectContaining({
        id: "tubeSeat:0:1",
        portId: "undersideClutch:0:1",
        centerLdu: [0, 2, 10],
      }),
    ]);
  });

  it("bounds its source-rounded stud to the reviewed nominal connection profile", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_I[0]!;
    const part = getPartDefinition(PART_ID)!;
    const [, , , sourceRadiusLdu, sourceHeightLdu] = blueprint.studsLdu[0]!;
    const sourceRoundingDeltaLdu = sourceRadiusLdu - 6;

    expect(sourceRoundingDeltaLdu).toBe(0.00015149808736047987);
    expect(sourceRoundingDeltaLdu).toBeLessThan(NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU);
    expect(NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU).toBe(0.0004242640687119286);
    expect(sourceHeightLdu).toBe(4);
    expect(part.collision).toMatchObject({
      validatedConnectionStudProfile: "nominal-stud-tube/1",
      primitives: expect.arrayContaining([
        expect.objectContaining({
          id: "stud:0",
          radiusLdu: sourceRadiusLdu,
          validatedConnectionProfileRadiusLdu: 6,
          heightLdu: sourceHeightLdu,
        }),
      ]),
    });

    const profiled = {
      ...blueprint,
      validatedConnectionStudProfile: NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
    } as const;
    const withStud = (radiusLdu: number, heightLdu: number) => ({
      ...profiled,
      studsLdu: [[0, -4, 0, radiusLdu, heightLdu]] as const,
    });
    expect(() => makeMeasuredPartDefinition(withStud(6.001, 4))).toThrow(
      /source rounding delta no greater than/u,
    );
    expect(() => makeMeasuredPartDefinition(withStud(5.999, 4))).toThrow(
      /radius at least the nominal 6/u,
    );
    expect(() => makeMeasuredPartDefinition(withStud(sourceRadiusLdu, 5))).toThrow(
      /requires height 4/u,
    );
  });

  it("uses the measured physical definition for pixels, collision, and connection admission", () => {
    const part = getPartDefinition(PART_ID)!;

    expect(part.geometry).toMatchObject({
      generatorId: "builtin:preloaded-mesh-reference/1",
      assetId: "ldraw:official:15573.dat",
      collisionMode: "mesh-derived-height-field",
      bodyMode: "bundled-source-mesh",
      studMode: "measured-stud-seats",
      undersideMode: "modelled-shell-cavity",
    });
    expect(part.collision.primitives.filter(({ kind }) => kind === "box")).toHaveLength(29);
    expect(part.collision.primitives.filter(({ kind }) => kind === "cylinder")).toHaveLength(1);
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });
});
