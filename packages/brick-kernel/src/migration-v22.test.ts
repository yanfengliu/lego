import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V22_TRUTH_HASH = "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e";
const V23_TRUTH_HASH = "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb";
const V23_PART_ID = "builtin:technic-brick-1x2-axle-hole";

function documentSavedAtV22(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v22", name: "Saved at /22" });
  const roster = getReviewedHistoricalCatalogRoster(V22_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /22 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/22",
        hash: "sha256:3700b53f804db905fc0b7b1f41f5e2b5d3f60f79dd6ee6ae0bc1f33ed2f99176",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:ba08980d0b651273651f5abd00a9eda0da412ef1ce82fbf8252f09dbff6db1fc",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:29d9de56ab3e4215749d51b14923457528f2afd04ce6c149731802db65e748b0",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:3ac16864f8a77c198b0cf78d055bedfee61990c84ff2a14fbe2ef2684632071d",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/3",
        hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
      },
    },
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: roster.catalogPartIds,
    },
  };
}

describe("builtin.basic-parts/22 migration", () => {
  it("adds only the complete measured 32064 definition when /22 advances to /23", () => {
    const saved = documentSavedAtV22();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V22_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V23_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([V23_PART_ID]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/22",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /22 document that pre-seeds 32064 in both constraints and parts", () => {
    const saved = documentSavedAtV22();
    const part = createPartInstance({ id: "future-axle-hole", catalogPartId: V23_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V23_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-axle-hole uses catalog part ${V23_PART_ID}, which reviewed source truth ${V22_TRUTH_HASH} (builtin.basic-parts/22) did not define; the part cannot be legitimized by migration`,
    );
  });
});
