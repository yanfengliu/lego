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
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { meshClutchUndersides } from "./mesh-underside.ts";
import { studSeatTouchesOutwardBoxFace } from "./measured-stud.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { SET_6651557_NATIVE_RECORD_DIGESTS } from "./quarantine/set-6651557-native-record-digests.ts";

const PART_ID = "builtin:roller-skate";

const EXPECTED_CLOSURE = [
  ["p/1-4disc.dat", 584, "sha256:3b8faa77185c576085c38f37b13c6a04e2e889eea6a7dc8c4db2d1699a33bcda"],
  ["p/1-4edge.dat", 545, "sha256:9ce2de7e67bbac575d52cfdc771b9d00856efc9b88002d97db8e665e50f4d467"],
  ["p/2-4cylc.dat", 428, "sha256:a5b68e5d662209f4139803034f45330ba677b1aff449fb609d95a6f27ddc5469"],
  [
    "p/2-4cyli.dat",
    1_543,
    "sha256:d486780f0f84893899d9eadcd13150f13a42e15e77a3cda38cdf24ded98862c6",
  ],
  ["p/2-4disc.dat", 803, "sha256:1d4662b73e3196fadeb5ecf2fd27f3dbf7cecce0802cf3d7108ab67bb380eb15"],
  ["p/2-4edge.dat", 683, "sha256:665400f76566b161c28303cdadce40d17d979a8ff9a8a133675af2d17fbe6763"],
  ["p/3-4edge.dat", 831, "sha256:d7f5aff979bc227b601abbb8e0226d6055d08eafb5faaf507b3055f712cd4c04"],
  ["p/3-8edge.dat", 615, "sha256:a590f230678d592d514a9c5e307c6a30945e50e4c529fc06accf37530d0e0ed5"],
  ["p/4-4cylc.dat", 476, "sha256:0183cffc7f56a2f3e5e3511f0d07ac484d3039c2d41bee802a94344ec95ec8bd"],
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
    "p/4-4ring1.dat",
    1_641,
    "sha256:4ae21061a6d0c9c80c608decb750f16fe1d113d84e08ef2f6082bcbb0f55194c",
  ],
  [
    "p/box4-7a.dat",
    1_008,
    "sha256:93ac5f1805fc4e785c9532c0b40851a9d03da37241f85d5513b059c4358839f4",
  ],
  ["p/box5-4a.dat", 752, "sha256:70d5f7f2d0720b84a06100b12b449b8ad37d66a02fc4650b31d556d7b1d0fe41"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  [
    "parts/11253.dat",
    12_837,
    "sha256:73bd3e4ac6080ee535bf4a0ba514322abe3e9d8ff073e2d6b789f0ed105a00fc",
  ],
] as const;

describe("11253 roller-skate catalog truth", () => {
  it("keeps minifig footwear out of the plate family and pins its upright frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "11253")!;

    expect(part).toMatchObject({
      id: PART_ID,
      family: "minifig-accessory",
      displayName: "Roller Skate",
      dimensions: { widthStuds: 1, lengthStuds: 1, heightLdu: 8 },
      bodyBoundsLdu: { min: [-10, -7, -14], max: [10, 4, 14] },
      boundsLdu: { min: [-10, -8, -14], max: [10, 4, 14] },
    });
    expect(resolvePartId("11253.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:11253.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -4, 0],
    });
    expect(
      "validatedConnectionStudProfile" in blueprint
        ? blueprint.validatedConnectionStudProfile
        : undefined,
    ).toBe("nominal-stud-tube/1");
    expect(part.geometry.contentHash).toBe(
      "sha256:b7e84dd110ee09c12946233e2f581be196dc4ffce97dce462e9c88d3cee5a905",
    );
  });

  it("pins the exact official 17-file closure and root attribution", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["11253"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "11253")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Minifig Roller Skate",
      author: "Magnus Forsberg [MagFors]",
      ldrawOrg: "Part UPDATE 2013-01",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:73bd3e4ac6080ee535bf4a0ba514322abe3e9d8ff073e2d6b789f0ed105a00fc",
      closureFileCount: 17,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["11253"]).toEqual({
      bytes: 28_352,
      manifestSha256: "sha256:a95ff67e17b326856aec2d59be0d8062c91dd5093dd380bdf61c610fda2bad60",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(34);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(206);
  });

  it("retains Builder only as counterevidence and selects one exact LDCad route", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "11253")!;
    if (!("ldcadShadowSource" in blueprint)) throw new Error("11253 has no pinned LDCad route");

    expect(SET_6651557_NATIVE_RECORD_DIGESTS.find(({ designId }) => designId === "11253")).toEqual({
      designId: "11253",
      recordSha256: "sha256:384918db62cb723726a725cb920b02469fab50c1287cb987d593242bba3df112",
    });
    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/stud.dat", "parts/11253.dat"],
    });
    expect(part.provenance.sourceId).toBe("lego-studio:ldcad-shadow-measured-part-admission");
  });

  it("maps the raw stud and clutch through the same exact frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "11253")!;

    expect(blueprint.studsLdu).toEqual([[0, -4, 0, 6.0001514980873605, 4]]);
    expect(blueprint.clutchesLdu).toEqual([[0, 4, 0]]);
    expect(part.connectors).toEqual([
      {
        id: "stud:0",
        kind: "stud",
        geometryRole: "stud",
        profileId: "stud-tube/1",
        gender: "male",
        positionLdu: [0, -4, 0],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      },
      {
        id: "undersideClutch:0",
        kind: "undersideClutch",
        geometryRole: "tubeSeat",
        profileId: "stud-tube/1",
        gender: "female",
        positionLdu: [0, 4, 0],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      },
    ]);
  });

  it("admits the stud on its local shoe deck without mistaking the roller for that deck", () => {
    const part = getPartDefinition(PART_ID)!;
    const boxes = part.collision.primitives
      .filter(
        (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
          primitive.kind === "box",
      )
      .map(({ minLdu, maxLdu }) => ({ min: minLdu, max: maxLdu }));
    const stud = part.connectors.find(({ kind }) => kind === "stud")!;

    expect(part.bodyBoundsLdu.min[1]).toBe(-7);
    expect(stud.positionLdu[1]).toBe(-4);
    expect(
      boxes.filter(
        ({ min, max }) =>
          min[1] === stud.positionLdu[1] &&
          stud.positionLdu[0] > min[0] &&
          stud.positionLdu[0] < max[0] &&
          stud.positionLdu[2] > min[2] &&
          stud.positionLdu[2] < max[2],
      ),
    ).toEqual([{ min: [-3, -4, -5], max: [3, 0, 5] }]);
    expect(studSeatTouchesOutwardBoxFace(boxes, stud.positionLdu, stud.normal)).toBe(true);
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });

    const supportIndex = part.collision.primitives.findIndex(
      (primitive) =>
        primitive.kind === "box" &&
        primitive.minLdu[1] === -4 &&
        0 > primitive.minLdu[0] &&
        0 < primitive.maxLdu[0] &&
        0 > primitive.minLdu[2] &&
        0 < primitive.maxLdu[2],
    );
    expect(supportIndex).toBeGreaterThanOrEqual(0);
    const primitives = part.collision.primitives.map((primitive, index) =>
      index === supportIndex && primitive.kind === "box"
        ? { ...primitive, minLdu: [primitive.minLdu[0], -3, primitive.minLdu[2]] as const }
        : primitive,
    );
    const withoutLocalFace: PartDefinition = {
      ...part,
      collision: { ...part.collision, primitives },
    };
    expect(
      validateMeshPartDefinitionAdmission(withoutLocalFace).issues.map(({ code }) => code),
    ).toContain("MESH_ADMISSION_VERTICAL_EXTENTS_INVALID");
  });

  it("binds the measured mesh, conservative collision, and recessed clutch stop", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:11253.dat"]!;
    if (asset.indices === undefined) throw new Error("11253 mesh is unexpectedly unindexed");
    if (part.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("11253 is unexpectedly not a preloaded mesh");
    }
    const resolution = resolvePreloadedMeshAsset(part.geometry);
    if (!resolution.ok) throw new Error(`11253 mesh resolution failed: ${resolution.message}`);

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 642 },
      { role: "stud", triangleStart: 642, triangleCount: 48 },
    ]);
    expect(asset.indices.length / 3).toBe(690);
    expect(asset.positionsLdu.length / 3).toBe(705);
    expect(part.collision.primitives.filter(({ kind }) => kind === "box")).toHaveLength(78);
    expect(part.collision.primitives.filter(({ kind }) => kind === "cylinder")).toEqual([
      {
        id: "stud:0",
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [0, -6, 0],
        radiusLdu: 6.0001514980873605,
        validatedConnectionProfileRadiusLdu: 6,
        heightLdu: 4,
      },
    ]);
    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(part.collision.allowances).toEqual([
      {
        id: "tubeSeat:0",
        portId: "undersideClutch:0",
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [0, 2, 0],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      },
    ]);
    expect(
      meshClutchUndersides({
        positionsLdu: resolution.asset.positionsLdu,
        indices: resolution.asset.indices,
        groups: resolution.asset.groups,
        bodyBoundsLdu: part.bodyBoundsLdu,
        clutchSeatsLdu: [[0, 4, 0]],
      }),
    ).toEqual(["recessed"]);
  });

  it("fails admission if either half of the nominal connection profile is removed", () => {
    const part = getPartDefinition(PART_ID)!;
    const collisionWithoutProfile = { ...part.collision };
    delete collisionWithoutProfile.validatedConnectionStudProfile;
    const withoutDefinitionProfile: PartDefinition = {
      ...part,
      collision: collisionWithoutProfile,
    };
    expect(
      validateMeshPartDefinitionAdmission(withoutDefinitionProfile).issues.map(({ code }) => code),
    ).toContain("MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH");

    const primitives = part.collision.primitives.map((primitive) => {
      if (primitive.kind !== "cylinder" || primitive.tag !== "stud") return primitive;
      const withoutProfileRadius = { ...primitive };
      delete withoutProfileRadius.validatedConnectionProfileRadiusLdu;
      return withoutProfileRadius;
    });
    const withoutPrimitiveProfile: PartDefinition = {
      ...part,
      collision: { ...part.collision, primitives },
    };
    expect(
      validateMeshPartDefinitionAdmission(withoutPrimitiveProfile).issues.map(({ code }) => code),
    ).toContain("MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH");
  });

  it("keeps every /16 part payload byte unchanged after restoring its historical truth labels", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 88);
    const priorDefinitionBytes = JSON.stringify(priorParts)
      .replaceAll("builtin.basic-parts/23", "builtin.basic-parts/16")
      .replaceAll("rectilinear-stud-clearance/3", "rectilinear-stud-clearance/2");
    const rows = priorParts.map(({ id, connectors, collision }) => ({ id, connectors, collision }));
    const collisionRows = priorParts.map(({ id, collision }) => ({ id, collision }));

    expect(priorParts).toHaveLength(88);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(
          JSON.stringify(rows).replaceAll(
            "rectilinear-stud-clearance/3",
            "rectilinear-stud-clearance/2",
          ),
        )
        .digest("hex"),
      collisionHash: createHash("sha256")
        .update(
          JSON.stringify(collisionRows).replaceAll(
            "rectilinear-stud-clearance/3",
            "rectilinear-stud-clearance/2",
          ),
        )
        .digest("hex"),
    }).toEqual({
      definitionBytes: 1_494_703,
      definitionHash: "7b18e2b127cb11bf8374f0cf2fa68a00299ee4832fba6396decf07f297e42390",
      connectorCollisionHash: "31f8e27773200da7326986266d000f36e0304d6de1b5151a408ba1399799f1ac",
      collisionHash: "3a8b0fadd9f8434a714ff792df1638399c12b53066001661c3bc8fdf2aafd941",
    });
  });
});
