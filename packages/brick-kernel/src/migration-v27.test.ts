import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V27_TRUTH_HASH = "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f";
const V28_PART_IDS = [
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
] as const;

function documentSavedAtV27(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v27", name: "Saved at /27" });
  const roster = getReviewedHistoricalCatalogRoster(V27_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /27 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/27",
        hash: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:5153c1c3d58db63962698768885c0630b1c2c926a220e5895e7d55442ebbc7f1",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:1e727bf61b482bcaf8587f44175e46238926126de241ae0248a5e23b942118bd",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:ec8ce034cb7f39169783692259ec25bb028b95bce6d456917f88bd9bebebb03d",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/4",
        hash: "sha256:ac785c8f5ac9f2d642bf53c8ef51764b7954c981355b1d7d508a2228a5f1bf55",
      },
    },
    constraints: { ...current.constraints, allowedCatalogPartIds: roster.catalogPartIds },
  };
}

describe("builtin.basic-parts/27 migration", () => {
  it("adds only the two exact-suffix measured definitions when /27 advances to /28", () => {
    const saved = documentSavedAtV27();
    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(report.fromTruthHash).toBe(V27_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual(V28_PART_IDS);
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
        affectedCatalogPartIds: [
          "builtin:technic-brick-1x1-axle-hole",
          "builtin:technic-brick-1x2-axle-hole",
        ],
        changedFields: ["connector-semantics", "collision-semantics"],
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: "builtin.basic-parts/29",
      },
    ]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/27",
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
        fromVersion: "lego.kernel-validators/4",
        toVersion: "lego.kernel-validators/5",
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /27 document that pre-seeds a /28 part in constraints and parts", () => {
    const saved = documentSavedAtV27();
    const futurePartId = V28_PART_IDS[0];
    const part = createPartInstance({ id: "future-suffix-part", catalogPartId: futurePartId });
    const forged: BrickDocumentV1 = {
      ...saved,
      parts: [part],
      submodels: [{ ...saved.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [part.id] }],
      constraints: {
        ...saved.constraints,
        allowedCatalogPartIds: [...saved.constraints.allowedCatalogPartIds, futurePartId],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Part future-suffix-part uses catalog part ${futurePartId}, which reviewed source truth ${V27_TRUTH_HASH} (builtin.basic-parts/27) did not define; the part cannot be legitimized by migration`,
    );
  });
});
