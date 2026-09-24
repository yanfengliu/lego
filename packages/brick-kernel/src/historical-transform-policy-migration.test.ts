import { BUILTIN_TRANSFORM_POLICY_MANIFEST } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import {
  PART_SCOPED_V29_TRANSFORM_POLICY,
  REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH,
} from "./historical-transform-policies.ts";
import {
  REVIEWED_TRUTH_V29,
  documentAtReviewedTruth,
} from "./migration-historical-fixtures.test-support.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS, migrateDocumentTruth } from "./migration.ts";

const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";
const V29_TRUTH_HASH = "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb";

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

describe("historical transform-policy migration authority", () => {
  it("requires explicit transform authority for every reviewed source truth snapshot", () => {
    expect(Object.keys(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH).sort()).toEqual(
      REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash).sort(),
    );
    for (const [truthHash, policy] of Object.entries(
      REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH,
    )) {
      // Through /28 every source held the global upright policy; /29 introduced
      // the part-scoped one.
      expect(policy.legalOrientationIds.join("|"), truthHash).toBe(
        "upright-yaw-0|upright-yaw-90|upright-yaw-180|upright-yaw-270",
      );
      expect(policy.id, truthHash).toBe(
        truthHash === V29_TRUTH_HASH
          ? "part-scoped-proper-orientations-negative-y-up"
          : "upright-quarter-turns-negative-y-up",
      );
    }
    expect(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH[V29_TRUTH_HASH]).toBe(
      PART_SCOPED_V29_TRANSFORM_POLICY,
    );
    expect(Object.isFrozen(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH)).toBe(true);
  });

  /**
   * Binds the /29 literal table to the /29 truth. Bound: the rebuild borrows the
   * live manifest's non-part fields (id, version, provenance, orientations),
   * which equal /29's while the transform-policy digest is unchanged, as it is
   * at /30. When a later truth changes them, pin /29's fields here instead.
   */
  it("rebuilds the /29 transform-policy digest from the reviewed part-scoped table", () => {
    const roster = getReviewedHistoricalCatalogRoster(V29_TRUTH_HASH);
    expect(roster).toBeDefined();
    const additional = PART_SCOPED_V29_TRANSFORM_POLICY.additionalLegalOrientationIdsByPartId;
    expect(Object.keys(additional).every((id) => roster!.catalogPartIds.includes(id))).toBe(true);
    const parts = roster!.catalogPartIds.map((id) => ({
      id,
      legalOrientationIds: [
        ...PART_SCOPED_V29_TRANSFORM_POLICY.legalOrientationIds,
        ...((additional as Readonly<Record<string, readonly string[]>>)[id] ?? []),
      ],
    }));

    expect(canonicalDigest({ ...BUILTIN_TRANSFORM_POLICY_MANIFEST, parts })).toBe(
      REVIEWED_TRUTH_V29.transformPolicy.hash,
    );
  });

  it("does not let current transform truth legitimize a non-upright transform claimed as /28", () => {
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

  it("carries a /29 non-upright transform only on a part /29 admitted it for", () => {
    const axle = createPartInstance({
      id: "v29-horizontal-axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [20, -2, 0], orientationId: "proper-m-00pp000p0" },
    });
    const plate = createPartInstance({
      id: "v29-horizontal-plate",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [20, -2, 0], orientationId: "proper-m-00pp000p0" },
    });
    const admitted = documentAtReviewedTruth({
      id: "v29-axle",
      name: "/29 horizontal axle",
      truth: REVIEWED_TRUTH_V29,
      part: axle,
    });
    const forged = documentAtReviewedTruth({
      id: "v29-plate",
      name: "/29 horizontal plate",
      truth: REVIEWED_TRUTH_V29,
      part: plate,
    });

    const carried = migrateDocumentTruth(admitted);
    const refused = migrateDocumentTruth(forged);

    expect(carried.report.blockingReasons).toEqual([]);
    expect(carried.report.migrated).toBe(true);
    expect(carried.document.parts).toEqual(admitted.parts);
    expect(refused.report.migrated).toBe(false);
    expect(refused.document).toBe(forged);
    expect(refused.report.blockingReasons).toEqual([
      `Part ${plate.id} uses orientation proper-m-00pp000p0, which reviewed source transform policy part-scoped-proper-orientations-negative-y-up/1 at ${V29_TRUTH_HASH} did not permit for catalog part builtin:plate-1x1; migration cannot legitimize a transform introduced only by current truth`,
    ]);
  });
});
