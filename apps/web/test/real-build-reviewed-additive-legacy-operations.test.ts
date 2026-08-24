import { PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  canonicalDigest,
  documentStructuralHash,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../src/manual-commands";
import { applyReviewedAdditiveLegacyBuildOperations } from "../e2e/real-build-reviewed-additive-legacy-operations";
import {
  legacyThirteenDocument,
  mutateMaxParts,
  runGate3ParentReconstruction,
  SYNTHETIC_PARENT_MIGRATIONS,
  SYNTHETIC_PARENT_PIECES,
  type HashPhase,
  type MigrationMutation,
} from "./real-build-step7-gate3-parent-reconstruction.test-support";

describe("reviewed additive legacy operation projection", () => {
  it("uses active truth only transiently and restores the exact /13 source truth", () => {
    const source = legacyThirteenDocument();
    expect(migrateDocumentTruth(source).report).toMatchObject({
      migrated: true,
      fromCatalogVersion: "builtin.basic-parts/13",
      toCatalogVersion: "builtin.basic-parts/21",
      fromTruthHash: "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
      toTruthHash: "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1",
      addedCatalogPartIds: [
        "builtin:tile-1x1-quarter-round",
        "builtin:bracket-1x2-1x4-rounded-bottom",
        "builtin:tile-2x2-triangular",
        "builtin:roller-skate",
        "builtin:arch-1x6-thin-top",
        "builtin:bracket-2x2-1x2-vertical-studs",
        "builtin:brick-1x2-grille",
        "builtin:slope-1x2-45",
      ],
      catalogInterpretationChanges: [],
      blockingReasons: [],
    });
    const transaction = createPlacePartTransaction(source, {
      catalogPartId: "builtin:brick-2x2",
      colorId: "builtin:red",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    });
    expect(() => applyBuildOperations(source, transaction.operations)).toThrowError(
      "Base document requires an explicit truth-snapshot migration before operations can apply",
    );

    const events: string[] = [];
    const reconstructed = applyReviewedAdditiveLegacyBuildOperations(
      source,
      transaction.operations,
      {
        truthDigest: canonicalDigest,
        migrateDocumentTruth: (document) => {
          events.push(`migrate:${document.truth.catalog.version}`);
          return migrateDocumentTruth(document);
        },
        applyBuildOperations: (document, operations) => {
          events.push(`apply:${document.truth.catalog.version}`);
          if (document.truth.catalog.version !== "builtin.basic-parts/21") {
            throw new TypeError("test sentinel saw current operations receive historical truth");
          }
          return applyBuildOperations(
            document,
            operations as Parameters<typeof applyBuildOperations>[1],
          );
        },
      },
    );

    expect(events).toEqual([
      "migrate:builtin.basic-parts/13",
      "apply:builtin.basic-parts/21",
      "migrate:builtin.basic-parts/13",
    ]);
    expect(reconstructed.truth).toEqual(source.truth);
    expect(reconstructed.constraints).toEqual(source.constraints);
    expect(reconstructed.parts).toHaveLength(1);
    expect(reconstructed.parts[0]?.catalogPartId).toBe("builtin:brick-2x2");
    expect(migrateDocumentTruth(reconstructed).document.parts).toEqual(reconstructed.parts);
    expect(documentStructuralHash(reconstructed)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("refuses a current-only part before it can be relabeled with /13 truth", () => {
    const source = legacyThirteenDocument();
    const addedPart = PART_DEFINITIONS.find(({ id }) => id === "builtin:tile-1x1-quarter-round");
    if (addedPart === undefined || addedPart.availableColorIds[0] === undefined) {
      throw new TypeError("The additive-catalog attack fixture is unavailable.");
    }
    const transaction = createPlacePartTransaction(source, {
      catalogPartId: addedPart.id,
      colorId: addedPart.availableColorIds[0],
      transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
    });

    expect(() =>
      applyReviewedAdditiveLegacyBuildOperations(source, transaction.operations, {
        truthDigest: canonicalDigest,
        migrateDocumentTruth,
        applyBuildOperations: (document, operations) =>
          applyBuildOperations(document, operations as Parameters<typeof applyBuildOperations>[1]),
      }),
    ).toThrowError(
      /Reviewed \/13 operation result contains disallowed catalog part builtin:tile-1x1-quarter-round/,
    );
  });
});

describe("step-7 Gate-3 parent migration boundary", () => {
  it("reconstructs and verifies every /13 parent before the first final migration", () => {
    const { result, events, currentAuthorities, migrationReports } = runGate3ParentReconstruction();

    expect(events).toEqual([
      "place:0",
      "place:0",
      "place:0",
      "place:0",
      "hash:source:0",
      "place:1",
      "place:1",
      "place:1",
      "place:1",
      "hash:source:1",
      "place:2",
      "place:2",
      "place:2",
      "place:2",
      "hash:source:2",
      "place:3",
      "place:3",
      "place:3",
      "place:3",
      "hash:source:3",
      "final-migrate:0",
      "hash:current:0",
      "final-migrate:1",
      "hash:current:1",
      "final-migrate:2",
      "hash:current:2",
      "final-migrate:3",
      "hash:current:3",
    ]);
    expect(result.parents.map(({ sourceDocumentHash }) => sourceDocumentHash)).toEqual(
      SYNTHETIC_PARENT_MIGRATIONS.map(({ sourceDocumentHash }) => sourceDocumentHash),
    );
    expect(result.parents.map(({ documentHash }) => documentHash)).toEqual(
      SYNTHETIC_PARENT_MIGRATIONS.map(({ currentDocumentHash }) => currentDocumentHash),
    );
    for (const [index, parent] of result.parents.entries()) {
      expect(parent.document.parts).toHaveLength(4);
      expect(
        parent.document.parts.every(({ catalogPartId }) => catalogPartId === "builtin:brick-2x2"),
      ).toBe(true);
      expect(
        parent.document.parts
          .map(({ transform }) => transform.positionLdu[0])
          .sort((left, right) => left - right),
      ).toEqual(
        SYNTHETIC_PARENT_PIECES[index]!.map(({ transform }) => transform.positionLdu[0]).sort(
          (left, right) => left - right,
        ),
      );
      expect(
        parent.document.parts.every(
          ({ transform }) =>
            transform.positionLdu[1] === 0 &&
            transform.positionLdu[2] === 0 &&
            transform.orientationId === "upright-yaw-0",
        ),
      ).toBe(true);
      expect(documentStructuralHash(parent.document)).toBe(
        SYNTHETIC_PARENT_MIGRATIONS[index]!.currentDocumentHash,
      );
    }
    mutateMaxParts(currentAuthorities[0]!);
    Object.assign(migrationReports[0]!, { migrated: false });
    expect(result.parents[0]!.document.constraints.maxParts).toBe(
      legacyThirteenDocument().constraints.maxParts,
    );
    expect(result.migrationReport.migrated).toBe(true);
  });

  it("rejects a migrated structural hash that drifts from the independent pins", () => {
    expect(() => runGate3ParentReconstruction({ tamperCurrentHashIndex: 2 })).toThrowError(
      /required pinned current hash sha256:0cfcae543c79ac23369ee91af57da1bb32f18c5c5f78b99fe16eaba59aef1cae/u,
    );
  });

  it.each<HashPhase>(["source", "current"])(
    "detaches the %s document passed to a hostile hash callback",
    (phase) => {
      const { result } = runGate3ParentReconstruction({ mutateDetachedHashPhase: phase });
      expect(result.parents.map(({ documentHash }) => documentHash)).toEqual(
        SYNTHETIC_PARENT_MIGRATIONS.map(({ currentDocumentHash }) => currentDocumentHash),
      );
      expect(
        result.parents.every(
          ({ document }) =>
            document.constraints.maxParts === legacyThirteenDocument().constraints.maxParts,
        ),
      ).toBe(true);
    },
  );

  it.each(["document", "report"] as const)(
    "severs a later callback from an earlier dependency-owned %s authority",
    (authority) => {
      const { result } = runGate3ParentReconstruction({ mutateEarlierAtFinalHash: authority });
      expect(result.parents.map(({ documentHash }) => documentHash)).toEqual(
        SYNTHETIC_PARENT_MIGRATIONS.map(({ currentDocumentHash }) => currentDocumentHash),
      );
      expect(result.migrationReport.migrated).toBe(true);
    },
  );

  it("rejects identical unreviewed fields in all four migration reports", () => {
    expect(() => runGate3ParentReconstruction({ addUnreviewedReportField: true })).toThrowError(
      /did not complete the exact reviewed \/13 to \/21 migration/u,
    );
  });

  it.each<HashPhase>(["source", "current"])(
    "severs a hostile hash callback from captured dependency-owned %s authority",
    (phase) => {
      const { result } = runGate3ParentReconstruction({ mutateAuthoritativeHashPhase: phase });
      expect(result.parents.map(({ documentHash }) => documentHash)).toEqual(
        SYNTHETIC_PARENT_MIGRATIONS.map(({ currentDocumentHash }) => currentDocumentHash),
      );
    },
  );

  it.each<readonly [string, MigrationMutation]>([
    ["identity", (document) => ({ ...document, id: "tampered-document" })],
    ["revision", (document) => ({ ...document, revision: "revision-tampered" })],
    ["metadata", (document) => ({ ...document, name: "Tampered migration" })],
    [
      "provenance",
      (document) => ({
        ...document,
        provenance: { ...document.provenance, origin: "import" },
      }),
    ],
    [
      "parts",
      (document) => ({
        ...document,
        parts: [{ id: "tampered-part" }] as unknown as BrickDocumentV1["parts"],
      }),
    ],
    [
      "connections",
      (document) => ({
        ...document,
        connections: [{ id: "tampered-connection" }] as unknown as BrickDocumentV1["connections"],
      }),
    ],
    [
      "submodels",
      (document) => ({
        ...document,
        submodels: document.submodels.map((submodel, index) =>
          index === 0 ? { ...submodel, name: "Tampered submodel" } : submodel,
        ),
      }),
    ],
    [
      "steps",
      (document) => ({
        ...document,
        steps: document.steps.map((step, index) =>
          index === 0 ? { ...step, name: "Tampered step" } : step,
        ),
      }),
    ],
    [
      "constraints",
      (document) => ({
        ...document,
        constraints: { ...document.constraints, maxParts: document.constraints.maxParts + 1 },
      }),
    ],
    [
      "truth",
      (document) => ({
        ...document,
        truth: {
          ...document.truth,
          catalog: { ...document.truth.catalog, hash: `sha256:${"f".repeat(64)}` },
        },
      }),
    ],
  ])("rejects an injected %s mutation outside the exact migration delta", (_label, mutate) => {
    expect(() => runGate3ParentReconstruction({ mutateFirstMigration: mutate })).toThrowError(
      "Step-7 migration changed fields outside the exact reviewed revision, truth, and additive constraints delta.",
    );
  });
});
