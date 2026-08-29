import {
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  CONNECTOR_TAXONOMY_VERSION,
  TRANSFORM_POLICY_ID,
  TRANSFORM_POLICY_VERSION,
} from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { migrateDocumentTruth } from "./migration.ts";
import { VALIDATOR_SET_VERSION } from "./truth-manifests.ts";

const V28_TRUTH_HASH = "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b";
const V29_PART_IDS = [
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
] as const;

function documentSavedAtV28(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v28", name: "Saved at /28" });
  const roster = getReviewedHistoricalCatalogRoster(V28_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /28 roster fixture is missing.");
  return {
    ...current,
    truth: {
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
    },
    constraints: { ...current.constraints, allowedCatalogPartIds: roster.catalogPartIds },
  };
}

describe("builtin.basic-parts/28 migration", () => {
  it("adds only the exact 10201 and 3245b definitions when /28 advances to /29", () => {
    const saved = documentSavedAtV28();
    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(report.fromTruthHash).toBe(V28_TRUTH_HASH);
    expect(report.addedCatalogPartIds).toEqual(V29_PART_IDS);
    expect(report.catalogInterpretationChanges).toEqual([
      {
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: BUILTIN_CATALOG_VERSION,
        affectedCatalogPartIds: [
          "builtin:plate-1x2-round-end",
          "builtin:wedge-plate-2x4-wing",
          "builtin:corner-plate-3x3",
          "builtin:plate-3x3-corner-round",
        ],
        changedFields: ["connector-semantics", "collision-semantics"],
      },
      {
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: BUILTIN_CATALOG_VERSION,
        affectedCatalogPartIds: [
          "builtin:technic-brick-1x1-axle-hole",
          "builtin:technic-brick-1x2-axle-hole",
        ],
        changedFields: ["connector-semantics", "collision-semantics"],
      },
    ]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/28",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
      {
        component: "connector-taxonomy",
        fromVersion: "stud-tube/1",
        toVersion: CONNECTOR_TAXONOMY_VERSION,
      },
      {
        component: "collision-model",
        fromVersion: "rectilinear-stud-clearance/3",
        toVersion: COLLISION_MODEL_VERSION,
      },
      {
        component: "transform-policy",
        fromVersion: "upright-quarter-turns-negative-y-up/1",
        toVersion: TRANSFORM_POLICY_VERSION,
      },
      {
        component: "validator-set",
        fromVersion: "lego.kernel-validators/4",
        toVersion: VALIDATOR_SET_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("refuses a /28 document that pre-seeds a /29 part in constraints and parts", () => {
    const saved = documentSavedAtV28();
    const futurePartId = V29_PART_IDS[0];
    const part = createPartInstance({ id: "future-v29-part", catalogPartId: futurePartId });
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
      `Part future-v29-part uses catalog part ${futurePartId}, which reviewed source truth ${V28_TRUTH_HASH} (builtin.basic-parts/28) did not define; the part cannot be legitimized by migration`,
    );
  });

  it("blocks an existing 4519-to-32064 edge only for its reviewed through-bore change", () => {
    const saved = documentSavedAtV28();
    const bearing = createPartInstance({
      id: "v28-bearing",
      catalogPartId: "builtin:technic-brick-1x2-axle-hole",
    });
    const axle = createPartInstance({
      id: "v28-axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const edge: ConnectionEdge = {
      id: "v28-existing-axle-edge",
      kind: "stud-tube",
      a: { partId: axle.id, portId: "axle:0" },
      b: { partId: bearing.id, portId: "axleHole:0" },
      provenance: { source: "manual" },
    };
    const connected: BrickDocumentV1 = {
      ...saved,
      parts: [axle, bearing],
      connections: [edge],
      submodels: [{ ...saved.submodels[0]!, partIds: [axle.id, bearing.id] }],
      steps: [{ ...saved.steps[0]!, partIds: [axle.id, bearing.id] }],
    };

    const { document, report } = migrateDocumentTruth(connected);

    expect(report.blockingReasons).toEqual([
      `Connection ${edge.id} endpoint ${bearing.id}/axleHole:0 changed after reviewed source truth ${V28_TRUTH_HASH}; migration cannot preserve its connector semantics`,
    ]);
    expect(report.migrated).toBe(false);
    expect(document).toEqual(connected);
  });

  it("refuses unknown component ids and cross-mixed transform identities", () => {
    const saved = documentSavedAtV28();
    const forged: BrickDocumentV1 = {
      ...saved,
      truth: {
        ...saved.truth,
        connectorTaxonomy: {
          ...saved.truth.connectorTaxonomy,
          id: "someone-elses-connectors",
        },
        collisionModel: {
          ...saved.truth.collisionModel,
          id: "someone-elses-collision-model",
        },
        transformPolicy: {
          ...saved.truth.transformPolicy,
          id: TRANSFORM_POLICY_ID,
          version: "upright-quarter-turns-negative-y-up/1",
        },
      },
    };

    const { document, report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(document).toBe(forged);
    expect(report.blockingReasons).toEqual(
      expect.arrayContaining([
        `Connector taxonomy id someone-elses-connectors cannot migrate to stud-tube; only the builtin truth component is supported`,
        `Collision model id someone-elses-collision-model cannot migrate to rectilinear-stud-clearance; only the builtin truth component is supported`,
        `Transform policy version upright-quarter-turns-negative-y-up/1 cannot migrate to ${TRANSFORM_POLICY_VERSION}; known source versions are ${TRANSFORM_POLICY_VERSION}`,
      ]),
    );
  });
});
