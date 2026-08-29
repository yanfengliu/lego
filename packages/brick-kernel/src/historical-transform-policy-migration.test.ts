import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPartInstance } from "./factory.ts";
import { REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH } from "./historical-transform-policies.ts";
import { documentAtReviewedTruth } from "./migration-historical-fixtures.test-support.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS, migrateDocumentTruth } from "./migration.ts";

const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";

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
    expect(
      Object.values(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH).every(
        ({ legalOrientationIds }) =>
          legalOrientationIds.join("|") ===
          "upright-yaw-0|upright-yaw-90|upright-yaw-180|upright-yaw-270",
      ),
    ).toBe(true);
    expect(Object.isFrozen(REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH)).toBe(true);
  });

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
