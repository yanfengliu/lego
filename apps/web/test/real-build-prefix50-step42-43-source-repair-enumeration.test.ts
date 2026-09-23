import { getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import type { RealBuildPrefix50ProjectionOccurrence } from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP42_43_REPAIRS } from "../e2e/real-build-prefix50-step42-43-source-repair-contract";
import { enumerateRealBuildPrefix50Step42_43SourceRepair } from "../e2e/real-build-prefix50-step42-43-source-repair-enumeration";

const SOURCE_ROWS = [
  [258, "builtin:plate-1x2-round-end", 440, -98, -86, "proper-m-00nn000p0"],
  [259, "builtin:plate-1x12", 340, -98, -78, "proper-m-00nn000p0"],
  [260, "builtin:plate-1x2-round-end", 240, -98, -86, "proper-m-00nn000p0"],
  [261, "builtin:technic-brick-1x1-axle-hole", 270, -98, -94, "proper-m-00nn000p0"],
  [262, "builtin:plate-1x2-round-end", 380, -98, -86, "proper-m-00nn000p0"],
  [263, "builtin:plate-1x2-round-end", 300, -98, -86, "proper-m-00nn000p0"],
  [264, "builtin:technic-brick-1x2-axle-hole", 340, -98, -94, "proper-m-00pp000p0"],
  [265, "builtin:technic-brick-1x1-axle-hole", 410, -98, -94, "proper-m-00nn000p0"],
  [266, "builtin:bracket-2x2-1x2-vertical-studs", 240, -88, -104, "proper-m-p0000n0p0"],
  [267, "builtin:bracket-2x2-1x2-vertical-studs", 440, -88, -104, "proper-m-p0000n0p0"],
  [268, "builtin:bracket-2x2-1x2-vertical-studs", 380, -88, -104, "proper-m-p0000n0p0"],
  [269, "builtin:bracket-2x2-1x2-vertical-studs", 300, -88, -104, "proper-m-p0000n0p0"],
  [270, "builtin:plate-1x2-round-end", 440, -98, -102, "proper-m-00nn000p0"],
  [271, "builtin:plate-1x2-round-end", 240, -98, -102, "proper-m-00nn000p0"],
  [272, "builtin:plate-1x2-round-end", 300, -98, -102, "proper-m-00nn000p0"],
  [273, "builtin:plate-1x2-round-end", 380, -98, -102, "proper-m-00nn000p0"],
  [274, "builtin:tile-1x6", 400, -98, -110, "proper-m-00nn000p0"],
  [275, "builtin:tile-1x2", 240, -98, -110, "proper-m-00pp000p0"],
  [276, "builtin:plate-1x4", 300, -98, -110, "proper-m-00nn000p0"],
  [277, "builtin:plate-1x4", 300, -98, -118, "proper-m-00nn000p0"],
  [278, "builtin:slope-1x2-45", 320, -98, -134, "proper-m-00nn000p0"],
  [279, "builtin:slope-1x2-45", 280, -98, -134, "proper-m-00pp000p0"],
  [280, "builtin:tile-1x2", 300, -98, -150, "proper-m-00nn000p0"],
] as const;

const rows: readonly RealBuildPrefix50ProjectionOccurrence[] = SOURCE_ROWS.map(
  ([ordinal, catalogPartId, x, y, z, orientationId]) => ({
    ordinal,
    printedStepNumber: ordinal < 274 ? 41 : ordinal < 277 ? 42 : 43,
    phaseSequence: ordinal < 274 ? 67 : ordinal < 277 ? 68 : 69,
    phaseMemberOrdinal: 1,
    subBuildPath: ["7004cf0d-d97f-4b0d-8572-970e23815c05", "2956f76b-0e29-497c-84ae-d8bd9099aa3f"],
    colorId: getPartDefinition(catalogPartId)!.availableColorIds[0]!,
    partIdentity: {
      publishedCatalogPartId: catalogPartId,
      reconciledCatalogPartId: catalogPartId,
      officialDesignId: "synthetic",
      officialDesignRevision: "synthetic;A",
      sourceLDrawPartId: "synthetic",
      catalogLDrawPartId: "synthetic",
      identityProofId: null,
      basis: "published-exact",
    },
    sourceWorldTransform: { positionLdu: [x, y, z], orientationId },
  }),
);

describe("late Step-42/43 structural enumeration", () => {
  it("proves the exact repaired child without opaque-artifact regeneration", () => {
    const evidence = enumerateRealBuildPrefix50Step42_43SourceRepair(rows);
    expect(evidence).toMatchObject({
      catalogVersion: "builtin.basic-parts/30",
      catalogSnapshotHash:
        "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290",
      truthSnapshotHash: "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51",
      predecessorDocumentHash:
        "sha256:a1a67e206e39c358429beba83ebf8dfe375e160970fc90675b907857d827d448",
      terminalDocumentHash:
        "sha256:2a1a62bbb4762b817911eef23a0cf1426682c54c5c30fc05d3c222524833ae3b",
      terminalPartCount: 23,
      terminalConnectionCount: 46,
      terminalCollisionFindingCount: 0,
      terminalBlockingIssueCount: 0,
      terminalReciprocalConnectionCount: 14,
    });
    expect(evidence.rows.map(({ ordinal }) => ordinal)).toEqual([275, 276, 277, 278, 279, 280]);
    expect(evidence.rows.map(({ selectedConnections }) => selectedConnections.length)).toEqual([
      2, 2, 4, 2, 2, 2,
    ]);
    expect(evidence.rows.map(({ rawCollisionFindings }) => rawCollisionFindings)).toEqual([
      [{ code: "PART_BODY_COLLISION", counterpartOrdinals: [266] }],
      [
        { code: "PART_BODY_COLLISION", counterpartOrdinals: [269] },
        { code: "PART_STUD_BODY_COLLISION", counterpartOrdinals: [269] },
      ],
      [{ code: "PART_BODY_COLLISION", counterpartOrdinals: [269] }],
      [],
      [],
      [],
    ]);
    expect(
      evidence.rows.map(({ reciprocalExactTargetCount, reciprocalExactConnectionCount }) => [
        reciprocalExactTargetCount,
        reciprocalExactConnectionCount,
      ]),
    ).toEqual([
      [1, 2],
      [1, 2],
      [1, 4],
      [1, 2],
      [1, 2],
      [2, 2],
    ]);
    expect(evidence.rows.map(({ symmetryOccupancyRelation }) => symmetryOccupancyRelation)).toEqual(
      [
        "same-physical-occupancy",
        "same-physical-occupancy",
        "same-physical-occupancy",
        "distinct-facing-occupancy",
        "distinct-facing-occupancy",
        "same-physical-occupancy",
      ],
    );
    for (const [index, repair] of REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.entries()) {
      const candidate = evidence.rows[index]!.sourceXAcceptedCandidates.find(
        ({ transform }) =>
          transform.orientationId === repair.repaired.orientationId &&
          transform.positionLdu.join(",") === repair.repaired.positionLdu.join(","),
      );
      expect(candidate?.currentCatalogLegal, `occurrence ${repair.ordinal}`).toBe(true);
    }
    expect(
      evidence.rows.map(({ rawSeedCount, distinctTransformCount }) => [
        rawSeedCount,
        distinctTransformCount,
      ]),
    ).toEqual([
      [64, 58],
      [448, 330],
      [512, 374],
      [160, 152],
      [152, 148],
      [48, 44],
    ]);
    expect(evidence.terminalConnectorCapacityClaimCount).toBe(92);
    expect(evidence.rows.map(({ enumerationCounts }) => enumerationCounts)).toEqual([
      { rejectedNoConnections: 0, rejectedColliding: 24, accepted: 34 },
      { rejectedNoConnections: 0, rejectedColliding: 116, accepted: 214 },
      { rejectedNoConnections: 0, rejectedColliding: 116, accepted: 258 },
      { rejectedNoConnections: 0, rejectedColliding: 44, accepted: 108 },
      { rejectedNoConnections: 0, rejectedColliding: 46, accepted: 102 },
      { rejectedNoConnections: 0, rejectedColliding: 20, accepted: 24 },
    ]);
  }, 20_000);
});
