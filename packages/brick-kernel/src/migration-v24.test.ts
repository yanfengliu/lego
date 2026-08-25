import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V24_TRUTH_HASH = "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d";
const V25_TRUTH_HASH = "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f";
const V25_PART_ID = "builtin:plate-2x2-two-studs";

function documentSavedAtV24(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v24", name: "Saved at /24" });
  const roster = getReviewedHistoricalCatalogRoster(V24_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /24 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/24",
        hash: "sha256:8cf9f35a1a692f285994c1819d1063fde6912f7b0ef949fcca1ae2adadeaa65e",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:c88a4334befcea378749b7a31d7c46fb0d0a5818f5a5914c608e0ed9ef506623",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:5e4de952a9aa7b49211e563ef2d397572b805ffa6f80b3f96995a7511daff693",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:cf509b04cfab06646a74144cdcda8efc2f6313f7658fe7d2c08d77f53af7e56a",
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

describe("builtin.basic-parts/24 migration", () => {
  it("adds only the complete measured 33909 definition when /24 advances to /25", () => {
    const saved = documentSavedAtV24();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V24_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V25_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([V25_PART_ID]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/24",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /24 document that pre-seeds 33909 in constraints and parts", () => {
    const saved = documentSavedAtV24();
    const part = createPartInstance({ id: "future-two-stud-plate", catalogPartId: V25_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V25_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-two-stud-plate uses catalog part ${V25_PART_ID}, which reviewed source truth ${V24_TRUTH_HASH} (builtin.basic-parts/24) did not define; the part cannot be legitimized by migration`,
    );
  });
});
