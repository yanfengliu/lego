import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V21_TRUTH_HASH = "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1";
const V23_TRUTH_HASH = "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb";
const V22_PART_ID = "builtin:axle-1x3";
const V23_PART_ID = "builtin:technic-brick-1x2-axle-hole";

function documentSavedAtV21(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v21", name: "Saved at /21" });
  const roster = getReviewedHistoricalCatalogRoster(V21_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /21 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/21",
        hash: "sha256:2e7bed932f81ae85af63d689924f66161ece3d3e12d3520d3839727054a8a73d",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:be31f7dc69941b200254ecea0e2e81af60954a2edb79790eb64ad5eba9bf354b",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:b953a7541a50fd1b32fb255356d760134c61c180f77c6059cbcdb42c9cecada1",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:2f1dd7d46273c829e7990f0e28a091ca68c0335089f785442088746ae23f10af",
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

describe("builtin.basic-parts/21 migration", () => {
  it("adds only the complete measured 4519 and 32064 definitions", () => {
    const saved = documentSavedAtV21();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V21_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V23_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([V22_PART_ID, V23_PART_ID]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/21",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /21 document that pre-seeds 4519 in both constraints and parts", () => {
    const saved = documentSavedAtV21();
    const part = createPartInstance({ id: "future-axle", catalogPartId: V22_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V22_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-axle uses catalog part ${V22_PART_ID}, which reviewed source truth ${V21_TRUTH_HASH} (builtin.basic-parts/21) did not define; the part cannot be legitimized by migration`,
    );
  });
});
