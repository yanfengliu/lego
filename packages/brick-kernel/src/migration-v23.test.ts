import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V23_TRUTH_HASH = "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb";
const V29_TRUTH_HASH = "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb";
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
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
] as const;

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
  it("adds only the complete measured definitions when /23 advances to /28", () => {
    const saved = documentSavedAtV23();

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(V23_TRUTH_HASH);
    expect(report.toTruthHash).toBe(V29_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual([
      V24_PART_ID,
      V25_PART_ID,
      V26_PART_ID,
      ...POST_V26_PART_IDS,
    ]);
    expect(report.catalogInterpretationChanges).toEqual([
      {
        affectedCatalogPartIds: [
          "builtin:plate-1x2-round-end",
          "builtin:wedge-plate-2x4-wing",
          "builtin:corner-plate-3x3",
          "builtin:plate-3x3-corner-round",
        ],
        changedFields: ["connector-semantics", "collision-semantics"],
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: "builtin.basic-parts/29",
      },
      {
        affectedCatalogPartIds: ["builtin:technic-brick-1x2-axle-hole"],
        changedFields: ["connector-semantics", "collision-semantics"],
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: "builtin.basic-parts/29",
      },
    ]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/23",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
      {
        component: "connector-taxonomy",
        fromVersion: "stud-tube/1",
        toVersion: "stud-tube/2",
      },
      {
        component: "collision-model",
        fromVersion: "rectilinear-stud-clearance/3",
        toVersion: "rectilinear-stud-clearance/4",
      },
      {
        component: "transform-policy",
        fromVersion: "upright-quarter-turns-negative-y-up/1",
        toVersion: "part-scoped-proper-orientations-negative-y-up/1",
      },
      {
        component: "validator-set",
        fromVersion: "lego.kernel-validators/3",
        toVersion: "lego.kernel-validators/5",
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
