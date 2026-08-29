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
  "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9";
export const STEP7_GATE3_SOURCE_CATALOG_VERSION = "builtin.basic-parts/13";
export const STEP7_GATE3_TARGET_CATALOG_VERSION = "builtin.basic-parts/26";
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
  "builtin:plate-2x2-two-studs",
  "builtin:plate-1x5",
] as const;
const CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V27 = [
  "builtin:tile-1x2-chamfered-indented",
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:slope-1x1-double-45",
  "builtin:curved-slope-1x1-outside-bow",
] as const;
const CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V28 = [
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
] as const;
const CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V29 = [
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
] as const;
const CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS = [
  ...CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V27,
  ...CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V28,
  ...CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS_V29,
] as const;

const EXPECTED_TARGET_TRUTH: BrickDocumentV1["truth"] = SAFE_OBJECT_FREEZE({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: STEP7_GATE3_TARGET_CATALOG_VERSION,
    hash: "sha256:f86310b89f3224cff7a8d571de5a26fd36440ab46235abf1cf530e2f65f41b37",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:93f0a5fc899083be25c5364266e7046b397683204e0e0991f106425ec5a99059",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/3",
    hash: "sha256:7e9905d9f988c288eaeddee3d7befb7af79266518612bbba171d9b7f7fb1c463",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:a8694ddcdc39da5afd946a6012ac2588233bebe2eed457e8501cf572661b2956",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/3",
    hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
  },
});

const CURRENT_RUNTIME_TRUTH: BrickDocumentV1["truth"] = SAFE_OBJECT_FREEZE({
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

const EXPECTED_CURRENT_RUNTIME_MIGRATION_REPORT: Step7Gate3MigrationResult["report"] =
  SAFE_OBJECT_FREEZE({
    schemaVersion: "lego.truth-migration/2",
    fromCatalogVersion: STEP7_GATE3_SOURCE_CATALOG_VERSION,
    toCatalogVersion: "builtin.basic-parts/29",
    fromTruthHash: STEP7_GATE3_SOURCE_TRUTH_HASH,
    toTruthHash: "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb",
    addedColorIds: SAFE_OBJECT_FREEZE([]),
    addedCatalogPartIds: SAFE_OBJECT_FREEZE([
      ...ADDED_CATALOG_PART_IDS,
      ...CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS,
    ]),
    catalogInterpretationChanges: SAFE_OBJECT_FREEZE([
      SAFE_OBJECT_FREEZE({
        fromCatalogVersion: "builtin.basic-parts/28",
        toCatalogVersion: "builtin.basic-parts/29",
        affectedCatalogPartIds: SAFE_OBJECT_FREEZE([
          "builtin:plate-1x2-round-end",
          "builtin:wedge-plate-2x4-wing",
          "builtin:corner-plate-3x3",
          "builtin:plate-3x3-corner-round",
        ]),
        changedFields: SAFE_OBJECT_FREEZE(["connector-semantics", "collision-semantics"]),
      }),
    ]),
    truthComponentChanges: SAFE_OBJECT_FREEZE([
      SAFE_OBJECT_FREEZE({
        component: "catalog",
        fromVersion: STEP7_GATE3_SOURCE_CATALOG_VERSION,
        toVersion: "builtin.basic-parts/29",
      }),
      SAFE_OBJECT_FREEZE({
        component: "connector-taxonomy",
        fromVersion: "stud-tube/1",
        toVersion: "stud-tube/2",
      }),
      SAFE_OBJECT_FREEZE({
        component: "collision-model",
        fromVersion: "rectilinear-stud-clearance/2",
        toVersion: "rectilinear-stud-clearance/4",
      }),
      SAFE_OBJECT_FREEZE({
        component: "transform-policy",
        fromVersion: "upright-quarter-turns-negative-y-up/1",
        toVersion: "part-scoped-proper-orientations-negative-y-up/1",
      }),
      SAFE_OBJECT_FREEZE({
        component: "validator-set",
        fromVersion: "lego.kernel-validators/2",
        toVersion: "lego.kernel-validators/5",
      }),
    ]),
    migrated: true,
    blockingReasons: SAFE_OBJECT_FREEZE([]),
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
      "Step-7 source parent did not complete the exact reviewed /13 to /26 migration.",
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

/**
 * Projects the one exact live `/13` -> `/29` migration back onto the retained
 * additive `/26` boundary used by Gate-3 evidence. The live report authenticates
 * the roster-intersected `/29` connector/collision reinterpretation; migration
 * has already refused any edge using a changed endpoint. The four `/27`, two
 * `/28`, and two `/29` rows plus later semantics never enter the projection.
 */
export function projectExactCurrentMigrationToFrozenV26(
  source: BrickDocumentV1,
  current: Step7Gate3MigrationResult,
): Step7Gate3MigrationResult {
  if (
    exactPlainDataBytes(current.report, "Current runtime migration report") !==
      exactPlainDataBytes(
        EXPECTED_CURRENT_RUNTIME_MIGRATION_REPORT,
        "Expected current runtime migration report",
      ) ||
    exactPlainDataBytes(current.document.truth, "Current runtime migration truth") !==
      exactPlainDataBytes(CURRENT_RUNTIME_TRUTH, "Expected current runtime truth")
  ) {
    throw new SAFE_TYPE_ERROR(
      "Frozen /26 projection requires the exact reviewed /13 to /29 runtime migration bridge.",
    );
  }
  const expectedRuntimeRevision = `revision-${apply<string>(
    SAFE_STRING_SLICE,
    canonicalSha256({
      baseRevision: source.revision,
      migration: "truth",
      fromTruthHash: STEP7_GATE3_SOURCE_TRUTH_HASH,
      toTruthHash: EXPECTED_CURRENT_RUNTIME_MIGRATION_REPORT.toTruthHash,
    }),
    [0, 24],
  )}`;
  const runtimePartIds = current.document.constraints.allowedCatalogPartIds;
  let runtimeRowsExact =
    current.document.revision === expectedRuntimeRevision && runtimePartIds.length === 106;
  for (
    let index = 0;
    runtimeRowsExact && index < CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS.length;
    index += 1
  ) {
    const expectedId = CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS[index]!;
    let count = 0;
    for (let row = 0; row < runtimePartIds.length; row += 1) {
      if (runtimePartIds[row] === expectedId) count += 1;
    }
    runtimeRowsExact = count === 1;
  }
  if (!runtimeRowsExact) {
    throw new SAFE_TYPE_ERROR(
      "Frozen /26 projection requires all eight exact additive /27 through /29 runtime rows and its exact revision.",
    );
  }

  const projectedPartIds: string[] = [];
  for (let index = 0; index < runtimePartIds.length; index += 1) {
    const id = runtimePartIds[index]!;
    let isRuntimeOnly = false;
    for (let added = 0; added < CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS.length; added += 1) {
      isRuntimeOnly ||= id === CURRENT_RUNTIME_ADDED_CATALOG_PART_IDS[added];
    }
    if (!isRuntimeOnly) apply<number>(SAFE_ARRAY_PUSH, projectedPartIds, [id]);
  }
  const projectedRevisionHash = canonicalSha256({
    baseRevision: source.revision,
    migration: "truth",
    fromTruthHash: STEP7_GATE3_SOURCE_TRUTH_HASH,
    toTruthHash: STEP7_GATE3_TARGET_TRUTH_HASH,
  });
  const projected: Step7Gate3MigrationResult = {
    document: {
      ...current.document,
      revision: `revision-${apply<string>(SAFE_STRING_SLICE, projectedRevisionHash, [0, 24])}`,
      truth: detachExactPlainData(EXPECTED_TARGET_TRUTH, "Frozen /26 projection truth").value,
      constraints: {
        ...current.document.constraints,
        allowedCatalogPartIds: projectedPartIds,
      },
    },
    report: detachExactPlainData(
      EXPECTED_MIGRATION_REPORT,
      "Frozen /26 projection migration report",
    ).value,
  };
  assertExactStep7Gate3FinalMigration(source, projected);
  return projected;
}
