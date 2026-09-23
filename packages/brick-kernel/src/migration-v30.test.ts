import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import {
  VERSION_30_INTERPRETATION_CHANGES,
  VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE,
} from "./migration-v30.test-support.ts";
import { migrateDocumentTruth } from "./migration.ts";

const V29_TRUTH_HASH = "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb";
const V30_TRUTH_HASH = "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51";
const JUMPER_ID = "builtin:jumper-plate-1x2";
const V30_PROFILE_STUD_ENDPOINTS = [
  ["builtin:wedge-plate-3x3-cut-corner", 6],
  ["builtin:corner-plate-2x2-round", 2],
  ["builtin:bracket-1x2-1x4-rounded-bottom", 6],
  ["builtin:arch-1x6-thin-top", 6],
  ["builtin:bracket-2x2-1x2-vertical-studs", 2],
  ["builtin:brick-1x2-grille", 2],
  ["builtin:technic-brick-1x2-axle-hole", 2],
] as const;
const V30_PROFILE_CHANGED_ENDPOINTS = V30_PROFILE_STUD_ENDPOINTS.flatMap(([catalogPartId, count]) =>
  Array.from({ length: count }, (_, index) => [catalogPartId, `stud:${String(index)}`] as const),
);

function documentSavedAtV29(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v29", name: "Saved at /29" });
  const roster = getReviewedHistoricalCatalogRoster(V29_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /29 roster fixture is missing.");
  const saved: BrickDocumentV1 = {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/29",
        hash: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/2",
        hash: "sha256:b0b8a26e010f522ba88d55f3b8565add619b2e569f15abad59a46ffd2ccf0ddb",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/4",
        hash: "sha256:b1231af344c0c293e74c0721bd0005f4f7a6746ee144ccf71ca14e22caa07042",
      },
      transformPolicy: {
        id: "part-scoped-proper-orientations-negative-y-up",
        version: "part-scoped-proper-orientations-negative-y-up/1",
        hash: "sha256:44cf428cee1487a9441c609a75fbafefd6c3b4591512af30f8903e4508285f4c",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/5",
        hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
      },
    },
    constraints: { ...current.constraints, allowedCatalogPartIds: roster.catalogPartIds },
  };
  if (canonicalDigest(saved.truth) !== V29_TRUTH_HASH) {
    throw new Error("The /29 truth fixture no longer reproduces its reviewed complete hash.");
  }
  return saved;
}

function withParts(saved: BrickDocumentV1, catalogPartIds: readonly string[]): BrickDocumentV1 {
  const parts = catalogPartIds.map((catalogPartId, index) =>
    createPartInstance({ id: `part-${String(index)}`, catalogPartId }),
  );
  return {
    ...saved,
    parts,
    submodels: [{ ...saved.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: [{ ...saved.steps[0]!, partIds: parts.map(({ id }) => id) }],
  };
}

describe("builtin.basic-parts/29 migration to /30", () => {
  it("migrates an unconnected 15573 while naming its exact reinterpretation", () => {
    const saved = withParts(documentSavedAtV29(), [JUMPER_ID]);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report).toMatchObject({
      migrated: true,
      fromCatalogVersion: "builtin.basic-parts/29",
      toCatalogVersion: BUILTIN_CATALOG_VERSION,
      fromTruthHash: V29_TRUTH_HASH,
      toTruthHash: V30_TRUTH_HASH,
      addedColorIds: [],
      addedCatalogPartIds: [],
      blockingReasons: [],
      truthComponentChanges: [
        {
          component: "catalog",
          fromVersion: "builtin.basic-parts/29",
          toVersion: BUILTIN_CATALOG_VERSION,
        },
        {
          component: "transform-policy",
          fromVersion: "part-scoped-proper-orientations-negative-y-up/1",
          toVersion: "part-scoped-proper-orientations-negative-y-up/2",
        },
      ],
      catalogInterpretationChanges: VERSION_30_INTERPRETATION_CHANGES,
    });
    expect(document.parts).toEqual(saved.parts);
    expect(canonicalDigest(document.truth)).toBe(V30_TRUTH_HASH);
  });

  it("migrates unconnected instances of all seven profile-class parts with an explicit report", () => {
    const profilePartIds =
      VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE.affectedCatalogPartIds;
    const saved = withParts(documentSavedAtV29(), profilePartIds);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.catalogInterpretationChanges).toEqual(VERSION_30_INTERPRETATION_CHANGES);
    expect(document.parts).toEqual(saved.parts);
    expect(canonicalDigest(document.truth)).toBe(V30_TRUTH_HASH);
  });

  it("migrates a document that does not use the reinterpreted part", () => {
    const saved = withParts(documentSavedAtV29(), ["builtin:brick-1x1"]);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.catalogInterpretationChanges).toEqual(VERSION_30_INTERPRETATION_CHANGES);
    expect(document.parts).toEqual(saved.parts);
  });

  it.each(V30_PROFILE_CHANGED_ENDPOINTS)(
    "refuses an existing /29 edge through changed profile endpoint %s/%s",
    (catalogPartId, profilePortId) => {
      expect(V30_PROFILE_CHANGED_ENDPOINTS).toHaveLength(26);
      const saved = withParts(documentSavedAtV29(), [catalogPartId, "builtin:plate-1x1"]);
      const edge: ConnectionEdge = {
        id: `v29-${catalogPartId}-${profilePortId}`,
        kind: "stud-tube",
        a: { partId: "part-0", portId: profilePortId },
        b: { partId: "part-1", portId: "undersideClutch:0:0" },
        provenance: { source: "manual" },
      };
      const connected = { ...saved, connections: [edge] };

      const { document, report } = migrateDocumentTruth(connected);

      expect(report.migrated).toBe(false);
      expect(report.blockingReasons).toEqual([
        `Connection ${edge.id} endpoint part-0/${profilePortId} changed after reviewed source truth ${V29_TRUTH_HASH}; migration cannot preserve its connector semantics`,
      ]);
      expect(document).toBe(connected);
    },
  );

  it.each([
    ["stud:0", "undersideClutch:0:0"],
    ["undersideClutch:0:0", "stud:0:0"],
    ["undersideClutch:0:1", "stud:0:0"],
  ] as const)(
    "refuses an existing edge through changed 15573 endpoint %s",
    (jumperPortId, otherPortId) => {
      const saved = withParts(documentSavedAtV29(), [JUMPER_ID, "builtin:plate-1x1"]);
      const edge: ConnectionEdge = {
        id: `v29-${jumperPortId}`,
        kind: "stud-tube",
        a: { partId: "part-0", portId: jumperPortId },
        b: { partId: "part-1", portId: otherPortId },
        provenance: { source: "manual" },
      };
      const connected = { ...saved, connections: [edge] };

      const { document, report } = migrateDocumentTruth(connected);

      expect(report.migrated).toBe(false);
      expect(report.blockingReasons).toEqual([
        `Connection ${edge.id} endpoint part-0/${jumperPortId} changed after reviewed source truth ${V29_TRUTH_HASH}; migration cannot preserve its connector semantics`,
      ]);
      expect(document).toBe(connected);
    },
  );

  it("refuses a /29 edge that pre-seeds the later centred clutch", () => {
    const saved = withParts(documentSavedAtV29(), [JUMPER_ID, "builtin:plate-1x1"]);
    const edge: ConnectionEdge = {
      id: "v29-future-centre",
      kind: "stud-tube",
      a: { partId: "part-0", portId: "undersideClutch:center" },
      b: { partId: "part-1", portId: "stud:0:0" },
      provenance: { source: "manual" },
    };
    const forged = { ...saved, connections: [edge] };

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toEqual([
      `Connection ${edge.id} endpoint part-0/undersideClutch:center did not exist in reviewed source truth ${V29_TRUTH_HASH}; migration cannot legitimize a later connector`,
    ]);
    expect(document).toBe(forged);
  });
});
