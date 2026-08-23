import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  assertFrozenLegacyAdditiveCatalogV2,
  createFrozenLegacyAdditiveCatalogBasisV15,
} from "./real-build-artifact-legacy-document-v2";

const SOURCE_CATALOG_VERSION = "builtin.basic-parts/13";
const TARGET_CATALOG_VERSION = "builtin.basic-parts/15";
const SOURCE_TRUTH_HASH = "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5";
const TARGET_TRUTH_HASH = "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f";
const ADDED_CATALOG_PART_IDS = [
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
] as const;

interface ReviewedAdditiveMigration {
  readonly document: BrickDocumentV1;
  readonly report: {
    readonly schemaVersion: string;
    readonly migrated: boolean;
    readonly fromCatalogVersion: string;
    readonly toCatalogVersion: string;
    readonly fromTruthHash: string;
    readonly toTruthHash: string;
    readonly addedColorIds: readonly string[];
    readonly addedCatalogPartIds: readonly string[];
    readonly catalogInterpretationChanges: readonly unknown[];
    readonly truthComponentChanges: readonly unknown[];
    readonly blockingReasons: readonly string[];
  };
}

interface ReviewedLegacyOperationDependencies {
  readonly truthDigest: (truth: BrickDocumentV1["truth"]) => string;
  readonly migrateDocumentTruth: (document: BrickDocumentV1) => ReviewedAdditiveMigration;
  readonly applyBuildOperations: (
    base: BrickDocumentV1,
    operations: readonly unknown[],
  ) => BrickDocumentV1;
}

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function assertCanonicalFrozenAdditiveCatalog(document: BrickDocumentV1): void {
  const active = createFrozenLegacyAdditiveCatalogBasisV15();
  assertFrozenLegacyAdditiveCatalogV2(document, {
    ...active,
    constraints: {
      ...active.constraints,
      allowedCatalogPartIds: [...active.constraints.allowedCatalogPartIds].sort(compareStrings),
      allowedColorIds: [...active.constraints.allowedColorIds].sort(compareStrings),
    },
  });
}

function assertExactReviewedAdditiveMigration(
  source: BrickDocumentV1,
  migration: ReviewedAdditiveMigration,
): void {
  if (
    migration.report.schemaVersion !== "lego.truth-migration/2" ||
    migration.report.migrated !== true ||
    migration.report.fromCatalogVersion !== SOURCE_CATALOG_VERSION ||
    migration.report.toCatalogVersion !== TARGET_CATALOG_VERSION ||
    migration.report.fromTruthHash !== SOURCE_TRUTH_HASH ||
    migration.report.toTruthHash !== TARGET_TRUTH_HASH ||
    JSON.stringify(migration.report.addedColorIds) !== "[]" ||
    JSON.stringify(migration.report.addedCatalogPartIds) !==
      JSON.stringify(ADDED_CATALOG_PART_IDS) ||
    migration.report.catalogInterpretationChanges.length !== 0 ||
    JSON.stringify(migration.report.truthComponentChanges) !==
      '[{"component":"catalog","fromVersion":"builtin.basic-parts/13","toVersion":"builtin.basic-parts/15"}]' ||
    migration.report.blockingReasons.length !== 0 ||
    JSON.stringify(migration.document.parts) !== JSON.stringify(source.parts)
  ) {
    throw new TypeError(
      `Legacy operation projection requires the exact reviewed additive /13 to /15 migration; received ${JSON.stringify(migration.report)}.`,
    );
  }
}

/**
 * Reconstructs retained /13 diagnostic parents with current operation code.
 *
 * Current operation admission intentionally refuses a historical truth
 * snapshot. For this one exact additive migration, current truth may be used as
 * a transient execution precondition and then replaced with the unchanged
 * source truth. Exact retained structural hashes dispose of the result; they do
 * not claim historical revision or wire-byte identity. This helper grants no
 * general legacy execution or document-migration authority.
 */
export function applyReviewedAdditiveLegacyBuildOperations(
  base: BrickDocumentV1,
  operations: readonly unknown[],
  dependencies: ReviewedLegacyOperationDependencies,
): BrickDocumentV1 {
  const baseBytes = JSON.stringify(base);
  assertCanonicalFrozenAdditiveCatalog(base);
  if (dependencies.truthDigest(base.truth) !== SOURCE_TRUTH_HASH) {
    throw new TypeError("Reviewed legacy operations require the exact /13 source truth digest.");
  }
  const sourceAllowedPartIds = new Set(base.constraints.allowedCatalogPartIds);
  if (ADDED_CATALOG_PART_IDS.some((id) => sourceAllowedPartIds.has(id))) {
    throw new TypeError("Reviewed /13 source constraints already contain a /14 or /15 part ID.");
  }
  const migration = dependencies.migrateDocumentTruth(structuredClone(base));
  assertExactReviewedAdditiveMigration(base, migration);
  if (
    dependencies.truthDigest(migration.document.truth) !== TARGET_TRUTH_HASH ||
    JSON.stringify(base) !== baseBytes
  ) {
    throw new TypeError("Reviewed legacy operation migration mutated its source document.");
  }

  const projectedBase: BrickDocumentV1 = {
    ...structuredClone(base),
    truth: structuredClone(migration.document.truth),
  };
  const applied = dependencies.applyBuildOperations(projectedBase, operations);
  const forbiddenPart = applied.parts.find(
    ({ catalogPartId }) => !sourceAllowedPartIds.has(catalogPartId),
  );
  if (forbiddenPart !== undefined) {
    throw new TypeError(
      `Reviewed /13 operation result contains disallowed catalog part ${forbiddenPart.catalogPartId} on ${forbiddenPart.id}.`,
    );
  }
  if (
    dependencies.truthDigest(applied.truth) !== TARGET_TRUTH_HASH ||
    JSON.stringify(applied.truth) !== JSON.stringify(migration.document.truth)
  ) {
    throw new TypeError("Reviewed legacy operation execution did not retain active truth.");
  }
  const restored: BrickDocumentV1 = {
    ...structuredClone(applied),
    truth: structuredClone(base.truth),
  };
  assertCanonicalFrozenAdditiveCatalog(restored);
  const verification = dependencies.migrateDocumentTruth(structuredClone(restored));
  assertExactReviewedAdditiveMigration(restored, verification);
  if (JSON.stringify(base) !== baseBytes) {
    throw new TypeError("Reviewed legacy operation projection mutated its source document.");
  }
  return restored;
}
