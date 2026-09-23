import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createPartInstance } from "./factory.ts";
import {
  historicalTransformPolicyBlockingReasons,
  REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH,
} from "./historical-transform-policies.ts";
import { documentAtReviewedTruth } from "./migration-historical-fixtures.test-support.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS, migrateDocumentTruth } from "./migration.ts";

const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";
const V29_TRUTH_HASH = "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb";
const LEGACY_UPRIGHT_ORIENTATION_IDS = [
  "upright-yaw-0",
  "upright-yaw-90",
  "upright-yaw-180",
  "upright-yaw-270",
] as const;
const V29_NON_UPRIGHT_ROWS = [
  ["builtin:plate-1x4", "proper-m-00nn000p0"],
  ["builtin:tile-1x2", "proper-m-00nn000p0"],
  ["builtin:tile-1x2", "proper-m-00pp000p0"],
  ["builtin:tile-1x6", "proper-m-00nn000p0"],
  ["builtin:plate-1x12", "proper-m-00nn000p0"],
  ["builtin:tile-1x8", "proper-m-00nn000p0"],
  ["builtin:plate-1x2-round-end", "proper-m-00nn000p0"],
  ["builtin:bracket-2x2-1x2-vertical-studs", "proper-m-p0000n0p0"],
  ["builtin:slope-1x2-45", "proper-m-00nn000p0"],
  ["builtin:slope-1x2-45", "proper-m-00pp000p0"],
  ["builtin:axle-1x3", "proper-m-00pp000p0"],
  ["builtin:technic-brick-1x2-axle-hole", "proper-m-00pp000p0"],
  ["builtin:technic-brick-1x1-axle-hole", "proper-m-00nn000p0"],
] as const;
const V29_NON_UPRIGHT_ROWS_BY_CATALOG_PART_ID = {
  "builtin:plate-1x4": ["proper-m-00nn000p0"],
  "builtin:tile-1x2": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
  "builtin:tile-1x6": ["proper-m-00nn000p0"],
  "builtin:plate-1x12": ["proper-m-00nn000p0"],
  "builtin:tile-1x8": ["proper-m-00nn000p0"],
  "builtin:plate-1x2-round-end": ["proper-m-00nn000p0"],
  "builtin:bracket-2x2-1x2-vertical-studs": ["proper-m-p0000n0p0"],
  "builtin:slope-1x2-45": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
  "builtin:axle-1x3": ["proper-m-00pp000p0"],
  "builtin:technic-brick-1x2-axle-hole": ["proper-m-00pp000p0"],
  "builtin:technic-brick-1x1-axle-hole": ["proper-m-00nn000p0"],
} as const;

const REVIEWED_TRUTH_V28 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/28",
    hash: "sha256:15decef17024421dec825287923d2ae0142973f83281b3479b0eeeb5e5ddd837",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:41b9011f2ae13baadd4bc173936ea962d5ef6419809bc17fa3dcfcf01e83a553",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/3",
    hash: "sha256:11a791eaed761857eeb7446a4feaa278635593a8767e0d6d7ed9426d0cebeabd",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:b67a6b5226f97eeef8d18dc038df8e6e51da51843b0846cb64a61c328f46eb9a",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/4",
    hash: "sha256:ac785c8f5ac9f2d642bf53c8ef51764b7954c981355b1d7d508a2228a5f1bf55",
  },
} as const satisfies BrickDocumentV1["truth"];

const REVIEWED_TRUTH_V29 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/29",
    hash: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/2",
    hash: "sha256:b0b8a26e010f522ba88d55f3b8565add619b2e569f15abad59a46ffd2ccf0ddb",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/4",
    hash: "sha256:b1231af344c0c293e74c0721bd0005f4f7a6746ee144ccf71ca14e22caa07042",
  },
  transformPolicy: {
    id: "part-scoped-proper-orientations-negative-y-up",
    version: "part-scoped-proper-orientations-negative-y-up/1",
    hash: "sha256:44cf428cee1487a9441c609a75fbafefd6c3b4591512af30f8903e4508285f4c",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/5",
    hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
  },
} as const satisfies BrickDocumentV1["truth"];

function documentAtV29WithPart(catalogPartId: string, orientationId: string): BrickDocumentV1 {
  const part = createPartInstance({
    id: `v29-${catalogPartId}-${orientationId}`,
    catalogPartId,
    transform: { positionLdu: [0, 0, 0], orientationId },
  });
  return documentAtReviewedTruth({
    id: `v29-${catalogPartId}`,
    name: "Reviewed /29 transform",
    truth: REVIEWED_TRUTH_V29,
    part,
  });
}

describe("historical transform-policy migration authority", () => {
  it("binds every reviewed source truth to its exact global or part-scoped policy", () => {
    expect(V29_NON_UPRIGHT_ROWS).toHaveLength(13);
    expect(Object.keys(V29_NON_UPRIGHT_ROWS_BY_CATALOG_PART_ID)).toHaveLength(11);
    expect(
      Object.entries(V29_NON_UPRIGHT_ROWS_BY_CATALOG_PART_ID).flatMap(
        ([catalogPartId, orientationIds]) =>
          orientationIds.map((orientationId) => [catalogPartId, orientationId]),
      ),
    ).toEqual(V29_NON_UPRIGHT_ROWS);
    expect(Object.keys(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH).sort()).toEqual(
      REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash).sort(),
    );
    for (const { catalogVersion, truthHash } of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const policy = REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH[truthHash];
      expect(policy, truthHash).toBeDefined();
      expect(policy?.defaultLegalOrientationIds, truthHash).toEqual(LEGACY_UPRIGHT_ORIENTATION_IDS);
      if (catalogVersion !== "builtin.basic-parts/29") {
        expect(policy, truthHash).toMatchObject({
          scope: "global",
          id: "upright-quarter-turns-negative-y-up",
          version: "upright-quarter-turns-negative-y-up/1",
        });
      }
    }
    const v29Policy = REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH[V29_TRUTH_HASH];
    expect(v29Policy).toEqual({
      scope: "part-scoped",
      id: "part-scoped-proper-orientations-negative-y-up",
      version: "part-scoped-proper-orientations-negative-y-up/1",
      defaultLegalOrientationIds: LEGACY_UPRIGHT_ORIENTATION_IDS,
      nonUprightLegalOrientationIdsByCatalogPartId: V29_NON_UPRIGHT_ROWS_BY_CATALOG_PART_ID,
    });
    expect(Object.isFrozen(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH)).toBe(true);
    expect(Object.isFrozen(v29Policy)).toBe(true);
    if (v29Policy?.scope === "part-scoped") {
      expect(Object.isFrozen(v29Policy.nonUprightLegalOrientationIdsByCatalogPartId)).toBe(true);
      expect(
        Object.values(v29Policy.nonUprightLegalOrientationIdsByCatalogPartId).every((rows) =>
          Object.isFrozen(rows),
        ),
      ).toBe(true);
    }
  });

  it.each(V29_NON_UPRIGHT_ROWS)(
    "migrates exact /29 part-scoped row %s / %s",
    (catalogPartId, orientationId) => {
      expect(canonicalDigest(REVIEWED_TRUTH_V29)).toBe(V29_TRUTH_HASH);
      const saved = documentAtV29WithPart(catalogPartId, orientationId);
      expect(historicalTransformPolicyBlockingReasons(saved, V29_TRUTH_HASH)).toEqual([]);

      const { document, report } = migrateDocumentTruth(saved);

      expect(report.migrated).toBe(true);
      expect(report.blockingReasons).toEqual([]);
      expect(document.parts).toEqual(saved.parts);
      expect(document.parts[0]?.transform.orientationId).toBe(orientationId);
    },
  );

  it("rejects a /29 non-upright row granted to a different catalog part", () => {
    const forged = documentAtV29WithPart("builtin:plate-1x1", "proper-m-p0000n0p0");
    const expectedReason = `Part ${forged.parts[0]?.id} uses orientation proper-m-p0000n0p0, which reviewed source transform policy part-scoped-proper-orientations-negative-y-up/1 at ${V29_TRUTH_HASH} did not permit; migration cannot legitimize a transform introduced only by current truth`;

    expect(historicalTransformPolicyBlockingReasons(forged, V29_TRUTH_HASH)).toEqual([
      expectedReason,
    ]);

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(document).toBe(forged);
    expect(report.blockingReasons).toContain(expectedReason);
  });

  it("rejects a future-only 35480 orientation falsely claimed as /29", () => {
    const forged = documentAtV29WithPart("builtin:plate-1x2-round-end", "proper-m-00n0n0n00");
    const expectedReason = `Part ${forged.parts[0]?.id} uses orientation proper-m-00n0n0n00, which reviewed source transform policy part-scoped-proper-orientations-negative-y-up/1 at ${V29_TRUTH_HASH} did not permit; migration cannot legitimize a transform introduced only by current truth`;

    expect(historicalTransformPolicyBlockingReasons(forged, V29_TRUTH_HASH)).toEqual([
      expectedReason,
    ]);

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(document).toBe(forged);
    expect(report.blockingReasons).toContain(expectedReason);
  });

  it("rejects the future-only tile-1x6 panel-face orientation falsely claimed as /29", () => {
    const forged = documentAtV29WithPart("builtin:tile-1x6", "proper-m-00n0n0n00");
    const expectedReason = `Part ${forged.parts[0]?.id} uses orientation proper-m-00n0n0n00, which reviewed source transform policy part-scoped-proper-orientations-negative-y-up/1 at ${V29_TRUTH_HASH} did not permit; migration cannot legitimize a transform introduced only by current truth`;

    expect(historicalTransformPolicyBlockingReasons(forged, V29_TRUTH_HASH)).toEqual([
      expectedReason,
    ]);

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(document).toBe(forged);
    expect(report.blockingReasons).toContain(expectedReason);
  });

  it.each([
    ["builtin:tile-1x2", "proper-m-00n0n0n00"],
    ["builtin:plate-1x4", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00p0n0p00"],
  ] as const)(
    "rejects future-only /30 placement row %s / %s falsely claimed as /29",
    (catalogPartId, orientationId) => {
      const forged = documentAtV29WithPart(catalogPartId, orientationId);
      const expectedReason = `Part ${forged.parts[0]?.id} uses orientation ${orientationId}, which reviewed source transform policy part-scoped-proper-orientations-negative-y-up/1 at ${V29_TRUTH_HASH} did not permit; migration cannot legitimize a transform introduced only by current truth`;

      expect(historicalTransformPolicyBlockingReasons(forged, V29_TRUTH_HASH)).toEqual([
        expectedReason,
      ]);

      const { document, report } = migrateDocumentTruth(forged);

      expect(report.migrated).toBe(false);
      expect(document).toBe(forged);
      expect(report.blockingReasons).toContain(expectedReason);
    },
  );

  it("does not let current /29 transform truth legitimize a non-upright transform claimed as /28", () => {
    const axle = createPartInstance({
      id: "forged-horizontal-v28-axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [20, -2, 0], orientationId: "proper-m-00pp000p0" },
    });
    const forged = documentAtReviewedTruth({
      id: "forged-v28-transform",
      name: "Forged /28 transform",
      truth: REVIEWED_TRUTH_V28,
      part: axle,
    });

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(document).toBe(forged);
    expect(document.truth).toBe(REVIEWED_TRUTH_V28);
    expect(report.blockingReasons).toContain(
      `Part ${axle.id} uses orientation proper-m-00pp000p0, which reviewed source transform policy upright-quarter-turns-negative-y-up/1 at ${V28_TRUTH_HASH} did not permit; migration cannot legitimize a transform introduced only by current truth`,
    );
  });
});
