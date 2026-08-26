import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V20_TRUTH_HASH = "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2";
const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";
const V21_PART_ID = "builtin:slope-1x2-45";
const V22_PART_ID = "builtin:axle-1x3";
const V23_PART_ID = "builtin:technic-brick-1x2-axle-hole";
const V24_PART_ID = "builtin:plate-3x3";
const V25_PART_ID = "builtin:plate-2x2-two-studs";
const V26_PART_ID = "builtin:plate-1x5";
const POST_V26_PART_IDS = [
  "builtin:tile-1x2-chamfered-indented",
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:slope-1x1-double-45",
  "builtin:curved-slope-1x1-outside-bow",
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
] as const;

function documentSavedAtV20(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v20", name: "Saved at /20" });
  const roster = getReviewedHistoricalCatalogRoster(V20_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /20 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/20",
        hash: "sha256:343846c404bce8b33127724f77fc64b7b2f260ea921b2db9a9c8fe38b1929347",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:6306333aaebbc66453d8a27c88c3e632e503fa183cebaa62f29717d3b651a554",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:6a11a85b4b17be5c93f16f2b36b0a8deab0fb8c33f3a97626c4b5ab76aa69534",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:205d3e0461e6d778b9108d45c4927352ae5923be47288306b8e731b1fcef0a5c",
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

describe("builtin.basic-parts/20 migration", () => {
  it("adds only the complete measured definitions from /21 through /28", () => {
    const saved = documentSavedAtV20();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V20_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V28_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([
      V21_PART_ID,
      V22_PART_ID,
      V23_PART_ID,
      V24_PART_ID,
      V25_PART_ID,
      V26_PART_ID,
      ...POST_V26_PART_IDS,
    ]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/20",
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

  it("refuses a /20 document that pre-seeds 3040 in both constraints and parts", () => {
    const saved = documentSavedAtV20();
    const part = createPartInstance({ id: "future-slope", catalogPartId: V21_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V21_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-slope uses catalog part ${V21_PART_ID}, which reviewed source truth ${V20_TRUTH_HASH} (builtin.basic-parts/20) did not define; the part cannot be legitimized by migration`,
    );
  });
});
