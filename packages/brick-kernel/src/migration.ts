import {
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
  getColorDefinition,
  getPartDefinition,
} from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { canonicalDigest, canonicalSha256 } from "./canonical.ts";
import { normalizeBrickDocument } from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";

/**
 * Catalog versions this kernel knows how to carry forward. A version outside
 * this list is refused rather than reinterpreted, because a document must never
 * float to a newer truth implicitly.
 */
export const MIGRATABLE_CATALOG_VERSIONS: readonly string[] = Object.freeze([
  "builtin.basic-parts/1",
  "builtin.basic-parts/2",
  "builtin.basic-parts/3",
  "builtin.basic-parts/4",
]);

export interface TruthMigrationReport {
  readonly schemaVersion: "lego.truth-migration/1";
  readonly migrated: boolean;
  readonly fromCatalogVersion: string;
  readonly toCatalogVersion: string;
  readonly fromTruthHash: string;
  readonly toTruthHash: string;
  /** Colour IDs the document gained access to, in catalog order. */
  readonly addedColorIds: readonly string[];
  readonly addedCatalogPartIds: readonly string[];
  /** Populated only when the document could not be carried forward. */
  readonly blockingReasons: readonly string[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Carries a document pinned to an older builtin truth onto the current one when
 * the change was purely additive. Every part must still resolve; anything else
 * is reported as a blocking reason and the document is returned untouched, so a
 * migration is always an explicit, inspectable event.
 */
export function migrateDocumentTruth(document: BrickDocumentV1): {
  readonly document: BrickDocumentV1;
  readonly report: TruthMigrationReport;
} {
  const expectedTruth = createBuiltinTruthSnapshot();
  const fromTruthHash = canonicalDigest(document.truth);
  const toTruthHash = canonicalDigest(expectedTruth);
  const fromCatalogVersion = document.truth.catalog.version;
  const toCatalogVersion = expectedTruth.catalog.version;
  const base = {
    schemaVersion: "lego.truth-migration/1",
    fromCatalogVersion,
    toCatalogVersion,
    fromTruthHash,
    toTruthHash,
    addedColorIds: [],
    addedCatalogPartIds: [],
  } as const;

  if (fromTruthHash === toTruthHash) {
    return { document, report: { ...base, migrated: false, blockingReasons: [] } };
  }

  const blockingReasons: string[] = [];
  if (!MIGRATABLE_CATALOG_VERSIONS.includes(fromCatalogVersion)) {
    blockingReasons.push(
      `Catalog version ${fromCatalogVersion} has no migration to ${toCatalogVersion}; known source versions are ${MIGRATABLE_CATALOG_VERSIONS.join(", ")}`,
    );
  }
  for (const part of document.parts) {
    if (!getPartDefinition(part.catalogPartId)) {
      blockingReasons.push(
        `Part ${part.id} uses catalog part ${part.catalogPartId}, which ${toCatalogVersion} no longer defines`,
      );
    }
    if (!getColorDefinition(part.colorId)) {
      blockingReasons.push(
        `Part ${part.id} uses color ${part.colorId}, which ${toCatalogVersion} no longer defines`,
      );
    }
  }
  if (blockingReasons.length > 0) {
    return {
      document,
      report: { ...base, migrated: false, blockingReasons: blockingReasons.slice(0, 32) },
    };
  }

  const colorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const catalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  const previousColorIds = new Set(document.constraints.allowedColorIds);
  const previousPartIds = new Set(document.constraints.allowedCatalogPartIds);

  const migrated = normalizeBrickDocument({
    ...document,
    revision: `revision-${canonicalSha256({
      baseRevision: document.revision,
      migration: "truth",
      fromTruthHash,
      toTruthHash,
    }).slice(0, 24)}`,
    truth: expectedTruth,
    constraints: {
      ...document.constraints,
      allowedCatalogPartIds: [...catalogPartIds].sort(compareStrings),
      allowedColorIds: [...colorIds].sort(compareStrings),
    },
  });

  return {
    document: migrated,
    report: {
      ...base,
      migrated: true,
      addedColorIds: colorIds.filter((id) => !previousColorIds.has(id)),
      addedCatalogPartIds: catalogPartIds.filter((id) => !previousPartIds.has(id)),
      blockingReasons: [],
    },
  };
}
