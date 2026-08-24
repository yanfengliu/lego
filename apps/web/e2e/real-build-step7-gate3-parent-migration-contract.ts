import { canonicalSha256 } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  detachExactPlainData,
  exactPlainDataBytes,
} from "./real-build-step7-gate3-exact-plain-data";

const SAFE_ARRAY_PUSH = Array.prototype.push;
const SAFE_ARRAY_SLICE = Array.prototype.slice;
const SAFE_ARRAY_SORT = Array.prototype.sort;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_STRING_SLICE = String.prototype.slice;
const SAFE_TYPE_ERROR = TypeError;

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return SAFE_REFLECT_APPLY(fn, receiver, args) as T;
}

export const STEP7_GATE3_SOURCE_TRUTH_HASH =
  "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5";
export const STEP7_GATE3_TARGET_TRUTH_HASH =
  "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d";
export const STEP7_GATE3_SOURCE_CATALOG_VERSION = "builtin.basic-parts/13";
export const STEP7_GATE3_TARGET_CATALOG_VERSION = "builtin.basic-parts/24";
const ADDED_CATALOG_PART_IDS = [
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
  "builtin:slope-1x2-45",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:plate-3x3",
] as const;

const EXPECTED_TARGET_TRUTH: BrickDocumentV1["truth"] = SAFE_OBJECT_FREEZE({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: STEP7_GATE3_TARGET_CATALOG_VERSION,
    hash: "sha256:8cf9f35a1a692f285994c1819d1063fde6912f7b0ef949fcca1ae2adadeaa65e",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:c88a4334befcea378749b7a31d7c46fb0d0a5818f5a5914c608e0ed9ef506623",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/3",
    hash: "sha256:5e4de952a9aa7b49211e563ef2d397572b805ffa6f80b3f96995a7511daff693",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:cf509b04cfab06646a74144cdcda8efc2f6313f7658fe7d2c08d77f53af7e56a",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/3",
    hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
  },
});

export interface Step7Gate3MigrationResult {
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

const EXPECTED_MIGRATION_REPORT: Step7Gate3MigrationResult["report"] = SAFE_OBJECT_FREEZE({
  schemaVersion: "lego.truth-migration/2",
  migrated: true,
  fromCatalogVersion: STEP7_GATE3_SOURCE_CATALOG_VERSION,
  toCatalogVersion: STEP7_GATE3_TARGET_CATALOG_VERSION,
  fromTruthHash: STEP7_GATE3_SOURCE_TRUTH_HASH,
  toTruthHash: STEP7_GATE3_TARGET_TRUTH_HASH,
  addedColorIds: SAFE_OBJECT_FREEZE([]),
  addedCatalogPartIds: SAFE_OBJECT_FREEZE([...ADDED_CATALOG_PART_IDS]),
  catalogInterpretationChanges: SAFE_OBJECT_FREEZE([]),
  truthComponentChanges: SAFE_OBJECT_FREEZE([
    SAFE_OBJECT_FREEZE({
      component: "catalog",
      fromVersion: STEP7_GATE3_SOURCE_CATALOG_VERSION,
      toVersion: STEP7_GATE3_TARGET_CATALOG_VERSION,
    }),
    SAFE_OBJECT_FREEZE({
      component: "collision-model",
      fromVersion: "rectilinear-stud-clearance/2",
      toVersion: "rectilinear-stud-clearance/3",
    }),
    SAFE_OBJECT_FREEZE({
      component: "validator-set",
      fromVersion: "lego.kernel-validators/2",
      toVersion: "lego.kernel-validators/3",
    }),
  ]),
  blockingReasons: Object.freeze([]),
});

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function assertExactStep7Gate3FinalMigration(
  source: BrickDocumentV1,
  migration: Step7Gate3MigrationResult,
): string {
  const reportBytes = exactPlainDataBytes(migration.report, "Step-7 migration report");
  if (
    reportBytes !==
    exactPlainDataBytes(EXPECTED_MIGRATION_REPORT, "Expected Step-7 migration report")
  ) {
    throw new SAFE_TYPE_ERROR(
      "Step-7 source parent did not complete the exact reviewed /13 to /24 migration.",
    );
  }
  const sourceClone = detachExactPlainData(source, "Expected migration source clone").value;
  const targetTruth = detachExactPlainData(
    EXPECTED_TARGET_TRUTH,
    "Expected migration target truth",
  ).value;
  const allowedCatalogPartIds = apply<string[]>(
    SAFE_ARRAY_SLICE,
    sourceClone.constraints.allowedCatalogPartIds,
    [],
  );
  for (let index = 0; index < ADDED_CATALOG_PART_IDS.length; index += 1) {
    apply<number>(SAFE_ARRAY_PUSH, allowedCatalogPartIds, [ADDED_CATALOG_PART_IDS[index]!]);
  }
  apply<string[]>(SAFE_ARRAY_SORT, allowedCatalogPartIds, [compareStrings]);
  const allowedColorIds = apply<string[]>(
    SAFE_ARRAY_SLICE,
    sourceClone.constraints.allowedColorIds,
    [],
  );
  apply<string[]>(SAFE_ARRAY_SORT, allowedColorIds, [compareStrings]);
  const revisionHash = canonicalSha256({
    baseRevision: sourceClone.revision,
    migration: "truth",
    fromTruthHash: STEP7_GATE3_SOURCE_TRUTH_HASH,
    toTruthHash: STEP7_GATE3_TARGET_TRUTH_HASH,
  });
  const expectedDocument: BrickDocumentV1 = {
    ...sourceClone,
    revision: `revision-${apply<string>(SAFE_STRING_SLICE, revisionHash, [0, 24])}`,
    truth: targetTruth,
    constraints: {
      ...sourceClone.constraints,
      allowedCatalogPartIds,
      allowedColorIds,
    },
  };
  if (
    exactPlainDataBytes(migration.document, "Step-7 migrated document") !==
    exactPlainDataBytes(expectedDocument, "Expected Step-7 migrated document")
  ) {
    throw new SAFE_TYPE_ERROR(
      "Step-7 migration changed fields outside the exact reviewed revision, truth, and additive constraints delta.",
    );
  }
  return reportBytes;
}
