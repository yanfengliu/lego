import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V23_TRUTH_HASH = "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb";
const V24_TRUTH_HASH = "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d";
const V24_PART_ID = "builtin:plate-3x3";

function documentSavedAtV23(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v23", name: "Saved at /23" });
  const roster = getReviewedHistoricalCatalogRoster(V23_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /23 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/23",
        hash: "sha256:d7df28c96d3b4d8c31267289a972f0441c9b275ab1d65aa21a2247ca7f1d7a19",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:57eb657485d5049c5e3624e2811886473b0f230463815fd6ddfd677329b8c62f",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:daeb4dcd18ecb29153b425c6c9db060b087a5486e0238dbe3673cfdd521e6cfa",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:397a1cddf7cba68e3fae67753075cdd82003f5a0d2d00ebbae066848610d3d27",
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

describe("builtin.basic-parts/23 migration", () => {
  it("adds only the complete measured 11212 definition when /23 advances to /24", () => {
    const saved = documentSavedAtV23();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V23_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V24_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([V24_PART_ID]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/23",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /23 document that pre-seeds 11212 in constraints and parts", () => {
    const saved = documentSavedAtV23();
    const part = createPartInstance({ id: "future-plate", catalogPartId: V24_PART_ID });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, V24_PART_ID],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-plate uses catalog part ${V24_PART_ID}, which reviewed source truth ${V23_TRUTH_HASH} (builtin.basic-parts/23) did not define; the part cannot be legitimized by migration`,
    );
  });
});
