import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V25_TRUTH_HASH = "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f";
const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";
const V26_PART_ID = "builtin:plate-1x5";
const POST_V26_PART_IDS = [
  "builtin:tile-1x2-chamfered-indented",
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:slope-1x1-double-45",
  "builtin:curved-slope-1x1-outside-bow",
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
] as const;

function documentSavedAtV25(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v25", name: "Saved at /25" });
  const roster = getReviewedHistoricalCatalogRoster(V25_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /25 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/25",
        hash: "sha256:77f8faaacf9e0ad21f74bab3a06daab8e5cb4df088ee672d21da1e639ad76036",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:5c1ee759633b3962e41e26a3f94f296fdd07b3450381f2613ee018caba8ba48d",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:8a39981fddfbd1d4e9a5e4a21656105094a11dbdfb35305cb4da07c51263c742",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:e8066b7f1c3c18530536525bbc569a6dff4b311d4c2002c2d0c55f2cde30c4f5",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/3",
        hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
      },
    },
    constraints: { ...current.constraints, allowedCatalogPartIds: roster.catalogPartIds },
  };
}

describe("builtin.basic-parts/25 migration", () => {
  it("adds only the complete measured definitions when /25 advances to /28", () => {
    const saved = documentSavedAtV25();
    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V25_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V28_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([V26_PART_ID, ...POST_V26_PART_IDS]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/25",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
      {
        component: "validator-set",
        fromVersion: "lego.kernel-validators/3",
        toVersion: "lego.kernel-validators/4",
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /25 document that pre-seeds 78329 in constraints and parts", () => {
    const saved = documentSavedAtV25();
    const part = createPartInstance({ id: "future-plate-1x5", catalogPartId: V26_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V26_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-plate-1x5 uses catalog part ${V26_PART_ID}, which reviewed source truth ${V25_TRUTH_HASH} (builtin.basic-parts/25) did not define; the part cannot be legitimized by migration`,
    );
  });
});
