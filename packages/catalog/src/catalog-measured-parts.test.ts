import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getPartDefinition, resolvePartId } from "./index.js";
import { makePartDefinition } from "./part-factory.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { PART_BLUEPRINTS } from "./part-blueprints.ts";

const MEASURED_NEW_PARTS = [
  {
    id: "builtin:plate-2x14",
    ldrawId: "91988.dat",
    bodyBoundsLdu: { min: [-20, -4, -140], max: [20, 4, 140] },
    connectorsXZ: [
      [-10, -130],
      [-10, -110],
      [-10, -90],
      [-10, -70],
      [-10, -50],
      [-10, -30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
      [-10, 50],
      [-10, 70],
      [-10, 90],
      [-10, 110],
      [-10, 130],
      [10, -130],
      [10, -110],
      [10, -90],
      [10, -70],
      [10, -50],
      [10, -30],
      [10, -10],
      [10, 10],
      [10, 30],
      [10, 50],
      [10, 70],
      [10, 90],
      [10, 110],
      [10, 130],
    ],
  },
  {
    id: "builtin:wedge-plate-4x4-cut-corner",
    ldrawId: "30503.dat",
    bodyBoundsLdu: { min: [-40, -4, -40], max: [40, 4, 40] },
    connectorsXZ: [
      [-30, -30],
      [-30, -10],
      [-30, 10],
      [-30, 30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
      [10, 10],
      [10, 30],
      [30, 30],
    ],
  },
  {
    id: "builtin:wedge-plate-6x6-cut-corner",
    ldrawId: "6106.dat",
    bodyBoundsLdu: { min: [-60, -4, -60], max: [60, 4, 60] },
    connectorsXZ: [
      [-50, -50],
      [-50, -30],
      [-50, -10],
      [-50, 10],
      [-50, 30],
      [-50, 50],
      [-30, -50],
      [-30, -30],
      [-30, -10],
      [-30, 10],
      [-30, 30],
      [-30, 50],
      [-10, -30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
      [-10, 50],
      [10, -10],
      [10, 10],
      [10, 30],
      [10, 50],
      [30, 10],
      [30, 30],
      [30, 50],
      [50, 30],
      [50, 50],
    ],
  },
  {
    id: "builtin:wedge-plate-3x6-right",
    ldrawId: "54383.dat",
    bodyBoundsLdu: { min: [-29, -4, -60], max: [30, 4, 60] },
    connectorsXZ: [
      [0, 10],
      [0, 30],
      [0, 50],
      [20, -50],
      [20, -30],
      [20, -10],
      [20, 10],
      [20, 30],
      [20, 50],
    ],
  },
  {
    id: "builtin:corner-plate-4x4-round",
    ldrawId: "30565.dat",
    bodyBoundsLdu: { min: [-40, -4, -40], max: [40, 4, 40] },
    connectorsXZ: [
      [-30, -30],
      [-30, -10],
      [-30, 10],
      [-30, 30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
      [10, -10],
      [10, 10],
      [10, 30],
      [30, 30],
    ],
  },
  {
    id: "builtin:corner-plate-5x5-quarter-ring",
    ldrawId: "80015.dat",
    bodyBoundsLdu: { min: [-20, -4, -80], max: [80, 4, 20] },
    connectorsXZ: [
      [-10, -70],
      [10, -70],
      [50, -50],
      [70, -10],
      [70, 10],
    ],
    clutchConnectorsXZ: [
      [-10, -70],
      [10, -70],
      [30, -70],
      [50, -50],
      [70, -30],
      [70, -10],
      [70, 10],
    ],
  },
] as const;

describe("measured set 6651557 catalog parts", () => {
  it("records the six measured parts without inventing connectors", () => {
    for (const facts of MEASURED_NEW_PARTS) {
      const part = getPartDefinition(facts.id);
      const clutchConnectorsXZ =
        "clutchConnectorsXZ" in facts ? facts.clutchConnectorsXZ : facts.connectorsXZ;
      expect(part, facts.id).toBeDefined();
      expect(part!.bodyBoundsLdu).toEqual(facts.bodyBoundsLdu);
      expect(resolvePartId(facts.ldrawId)).toBe(facts.id);
      expect(resolvePartId(`ldraw:${facts.ldrawId}`)).toBe(facts.id);
      expect(
        part!.connectors
          .filter(({ kind }) => kind === "stud")
          .map(({ positionLdu }) => [positionLdu[0], positionLdu[2]]),
      ).toEqual(facts.connectorsXZ);
      expect(
        part!.connectors
          .filter(({ kind }) => kind === "undersideClutch")
          .map(({ positionLdu }) => [positionLdu[0], positionLdu[2]]),
      ).toEqual(clutchConnectorsXZ);
      expect(part!.collision.allowances).toHaveLength(clutchConnectorsXZ.length);
    }

    expect(getPartDefinition("builtin:corner-plate-5x5-quarter-ring")!.geometry).toMatchObject({
      generatorId: "builtin:parametric-plan-feature-part/1",
      bodyMode: "arc-prism",
      connectorGridCenterLdu: [30, -30],
      bodyArc: {
        centerXZLdu: [0, 0],
        innerRadiusLdu: 60,
        outerRadiusLdu: 80,
        startAngleDegrees: -90,
        endAngleDegrees: 0,
        segmentCount: 12,
        capRectanglesLdu: [
          { minXZLdu: [-20, -80], maxXZLdu: [0, -60] },
          { minXZLdu: [60, 0], maxXZLdu: [80, 20] },
        ],
      },
      partialOverhangClutchEvidence: {
        backingMode: "source-verified-partial-overhang",
        manifestSha256: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
        manifestMd5: "md5:bb72d5b5609e411392df36903c8c5daa",
        bundleSha256: "sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
        primitiveXmlSha256:
          "sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
        independentSourceRevision: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
        independentPartSha256:
          "sha256:c4dbcc5c5e2969e2b6e5c394519606a66b8483437503b8f4886cdf9262cd7170",
        independentSubpartSha256:
          "sha256:fa4324fccee90f9903c68c65a75bb4e747a76d429a94d648c10b9e24ceb4d879",
        normalizedClutchOffsetsSha256:
          "sha256:0e77ae20bce268bcde610fa8d2b34fa2e91a0c3a0132e298e933433591e8f0d5",
        overrides: [
          {
            positionLdu: [30, -70],
            kind: "source-verified-partial-overhang",
            maximumOuterOverhangLdu: 2.2,
          },
          {
            positionLdu: [70, -30],
            kind: "source-verified-partial-overhang",
            maximumOuterOverhangLdu: 2.2,
          },
        ],
      },
    });
    expect(
      getPartDefinition("builtin:corner-plate-5x5-quarter-ring")!.connectors.some(
        ({ kind, positionLdu }) =>
          kind === "undersideClutch" && positionLdu[0] === 50 && positionLdu[2] === -70,
      ),
    ).toBe(false);
    expect(getPartDefinition("builtin:corner-plate-4x4-round")!.geometry.bodyArc).toEqual({
      centerXZLdu: [-40, 40],
      innerRadiusLdu: 0,
      outerRadiusLdu: 80,
      startAngleDegrees: -90,
      endAngleDegrees: 0,
      segmentCount: 12,
    });
    for (const [id, cutNormalXZ, cutOffsetLdu] of [
      ["builtin:wedge-plate-4x4-cut-corner", [1, -1], 20],
      ["builtin:wedge-plate-6x6-cut-corner", [1, -1], 40],
      ["builtin:wedge-plate-3x6-right", [-3, -1], 30],
    ] as const) {
      expect(
        getPartDefinition(id)!.collision.primitives.find(
          ({ id: primitiveId }) => primitiveId === "body",
        ),
      ).toMatchObject({ kind: "wedge", cutNormalXZ, cutOffsetLdu });
    }
    expect(
      getPartDefinition("builtin:plate-2x14")!.collision.primitives.find(({ id }) => id === "body"),
    ).toMatchObject({
      kind: "box",
      minLdu: [-20, -4, -140],
      maxLdu: [20, 4, 140],
    });
    expect(getPartDefinition("builtin:plate-2x14")!.ldrawFrame).toEqual({
      ldrawToCatalogOrientationId: "upright-yaw-90",
      provenance: {
        sourceId: "ldraw:official:91988.dat",
        sourceType: "interoperability-mapping",
        sourceVersion: "UPDATE-2012-02;measured-2026-08-02",
        licenseExpression: "CC-BY-2.0",
        attribution:
          "91988.dat authored by Owen Burgoyne [C3POwen] for LDraw.org; frame measured without bundling geometry.",
        runtimeRole: "interchange-frame-measurement",
        redistributionAllowed: true,
        trainingUseAllowed: false,
        externalGeometryBundled: false,
      },
    });
  });

  it("fails closed when a partial-overhang clutch loses or exceeds its pinned evidence", () => {
    const blueprint: PartBlueprint | undefined = PART_BLUEPRINTS.find(
      ({ ldrawId }) => ldrawId === "80015.dat",
    );
    expect(blueprint).toBeDefined();
    if (blueprint === undefined || blueprint.partialOverhangClutchEvidence === undefined) return;

    const { partialOverhangClutchEvidence, ...withoutEvidence } = blueprint;
    expect(partialOverhangClutchEvidence).toBeDefined();
    expect(() => makePartDefinition(withoutEvidence)).toThrow(
      /lacks full body backing and has no source-verified partial-overhang evidence/,
    );

    const moveFirstEdgeTo =
      (targetX: number) =>
      ([x, z]: readonly [number, number]): readonly [number, number] =>
        x === 30 && z === -70 ? [targetX, -70] : [x, z];
    const inward = {
      ...blueprint,
      clutchOffsetsLdu: blueprint.clutchOffsetsLdu!.map(moveFirstEdgeTo(29)),
      partialOverhangClutchEvidence: {
        ...blueprint.partialOverhangClutchEvidence,
        overrides: blueprint.partialOverhangClutchEvidence.overrides.map((override) => ({
          ...override,
          positionLdu: moveFirstEdgeTo(29)(override.positionLdu),
        })),
      },
    };
    expect(() => makePartDefinition(inward)).toThrow(
      /does not match source-extracted normalized digest/,
    );

    const outwardOffsets = blueprint.clutchOffsetsLdu!.map(moveFirstEdgeTo(31));
    const normalizedOutwardOffsets = JSON.stringify(
      [...outwardOffsets].sort(
        ([leftX, leftZ], [rightX, rightZ]) => leftX - rightX || leftZ - rightZ,
      ),
    );
    const outward = {
      ...blueprint,
      clutchOffsetsLdu: outwardOffsets,
      partialOverhangClutchEvidence: {
        ...blueprint.partialOverhangClutchEvidence,
        normalizedClutchOffsetsSha256:
          `sha256:${createHash("sha256").update(normalizedOutwardOffsets).digest("hex")}` as const,
        overrides: blueprint.partialOverhangClutchEvidence.overrides.map((override) => ({
          ...override,
          positionLdu: moveFirstEdgeTo(31)(override.positionLdu),
        })),
      },
    };
    expect(() => makePartDefinition(outward)).toThrow(/at most 2\.2 LDU overhang/);
  });
});
