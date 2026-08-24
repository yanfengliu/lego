import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  detachAndFreezeExactPlainData,
  detachExactPlainData,
  exactPlainDataBytes,
} from "./real-build-step7-gate3-exact-plain-data";
import {
  assertExactStep7Gate3FinalMigration,
  STEP7_GATE3_SOURCE_CATALOG_VERSION,
  STEP7_GATE3_SOURCE_TRUTH_HASH,
  STEP7_GATE3_TARGET_TRUTH_HASH,
  type Step7Gate3MigrationResult,
} from "./real-build-step7-gate3-parent-migration-contract";
import {
  detachedStructuralHash,
  detachedTruthDigest,
} from "./real-build-step7-gate3-parent-reconstruction-snapshots";
import { STEP7_GATE3_PRODUCTION_PARENT_DEPENDENCIES } from "./real-build-step7-gate3-parent-production-dependencies";
import {
  STEP7_GATE3_CALLER_PIN_AUTHORITY,
  STEP7_GATE3_PRIVATE_PIN_AUTHORITY,
  type Step7Gate3CallerPinnedParentReconstructionResult,
  type Step7Gate3ParentMigrationPin,
  type Step7Gate3ParentReconstructionInput,
  type Step7Gate3ParentReconstructionResult,
  type Step7Gate3PrivateParentReconstructionInput,
  type Step7Gate3ReconstructedParent,
} from "./real-build-step7-gate3-parent-reconstruction-types";

export type {
  Step7Gate3CallerPinnedParentReconstructionResult,
  Step7Gate3ParentMigrationPin,
  Step7Gate3ParentOrigin,
  Step7Gate3ParentReconstructionDependencies,
  Step7Gate3ParentReconstructionInput,
  Step7Gate3ParentReconstructionResult,
  Step7Gate3PrivateParentReconstructionInput,
  Step7Gate3ReconstructedParent,
} from "./real-build-step7-gate3-parent-reconstruction-types";

const SAFE_ARRAY_PUSH = Array.prototype.push;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_TYPE_ERROR = TypeError;
const SAFE_WEAK_SET = WeakSet;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const PRIVATE_PIN_RESULTS = new SAFE_WEAK_SET<object>();

function push<T>(values: T[], value: T): void {
  SAFE_REFLECT_APPLY(SAFE_ARRAY_PUSH, values, [value]);
}

export function isStep7Gate3PrivatePinResult(
  value: unknown,
): value is Step7Gate3ParentReconstructionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, PRIVATE_PIN_RESULTS, [value])
  );
}

const EXPECTED_PARENT_MIGRATIONS = SAFE_OBJECT_FREEZE([
  {
    sourceDocumentHash: "sha256:a806c6e4db60f71f1193cf7f28aa99189f7666278b64bff6beb075d2646d27e4",
    currentDocumentHash: "sha256:529c58b15b47ab1c22dfbf9261103cf2ef866cd3e79dba769abd0e2847bf4ae2",
  },
  {
    sourceDocumentHash: "sha256:e637dbcdbad7994ae642f3ab8e3d9c366864730b0d957e2ac75836e150edf1bf",
    currentDocumentHash: "sha256:d23e7f512c76f409d90447f10557c459df1c65e27414ff264a31bed3f613752d",
  },
  {
    sourceDocumentHash: "sha256:d3c69d1704953033eeca63f5702d237cf8a066fc83d3a46e12d1eea23a2f5898",
    currentDocumentHash: "sha256:a01ee1b65aa53d78dfe1c6cb870394258f9f47be8136767ffc0e30696e0dd721",
  },
  {
    sourceDocumentHash: "sha256:0ecf6da53de325a283cc64d5c317583d831c82ab707d64b8b21eb6765169f1c1",
    currentDocumentHash: "sha256:2642931112fbfc8d0c1e77e4d364dfec964c7016108802e31465141c1139488e",
  },
]);

/**
 * Mechanical reconstruction against explicit caller assertions. This helper
 * grants no retained-evidence authority; the production wrapper below binds
 * the four independently reviewed hashes.
 */
export function reconstructStep7Gate3ParentsAgainstCallerPins(
  input: Step7Gate3ParentReconstructionInput,
  expectedParentMigrations: readonly Step7Gate3ParentMigrationPin[],
): Step7Gate3CallerPinnedParentReconstructionResult {
  const detachedOrigins = detachAndFreezeExactPlainData(
    input.origins,
    "Step-7 retained parent origins",
  );
  const detachedPins = detachAndFreezeExactPlainData(
    expectedParentMigrations,
    "Step-7 caller migration pins",
  );
  const detachedBase = detachAndFreezeExactPlainData(
    input.baseDocument,
    "Step-7 source base document",
  );
  const dependencies = SAFE_OBJECT_FREEZE({
    truthDigest: input.dependencies.truthDigest,
    documentStructuralHash: input.dependencies.documentStructuralHash,
    sourcePlace: input.dependencies.sourcePlace,
    migrateDocumentTruth: input.dependencies.migrateDocumentTruth,
  });
  if (
    typeof dependencies.truthDigest !== "function" ||
    typeof dependencies.documentStructuralHash !== "function" ||
    typeof dependencies.sourcePlace !== "function" ||
    typeof dependencies.migrateDocumentTruth !== "function"
  ) {
    throw new SAFE_TYPE_ERROR("Step-7 parent reconstruction dependencies must be functions.");
  }
  const origins = detachedOrigins.value;
  const parentPins = detachedPins.value;
  const baseDocument = detachedBase.value;
  let originsMatchPins = origins.length === 4 && parentPins.length === 4;
  for (let index = 0; originsMatchPins && index < origins.length; index += 1) {
    const origin = origins[index]!;
    const expected = parentPins[index];
    originsMatchPins =
      expected !== undefined &&
      origin.candidateId === `step-006:${expected.sourceDocumentHash}` &&
      origin.documentHash === expected.sourceDocumentHash &&
      origin.pieces.length === 4;
  }
  if (
    !originsMatchPins ||
    detachedTruthDigest(baseDocument, "Step-7 source base", dependencies) !==
      STEP7_GATE3_SOURCE_TRUTH_HASH
  ) {
    throw new SAFE_TYPE_ERROR(
      "Step-7 parent reconstruction requires the four exact ordered retained origins over /13 truth.",
    );
  }
  const sourceParents: Array<{
    readonly origin: (typeof origins)[number];
    readonly document: BrickDocumentV1;
    readonly sourceDocumentHash: string;
    readonly sourceBytes: string;
    readonly originBytes: string;
  }> = [];
  for (let originIndex = 0; originIndex < origins.length; originIndex += 1) {
    const origin = origins[originIndex]!;
    const originBytes = exactPlainDataBytes(origin, `Source origin ${origin.candidateId}`);
    const baseClone = detachExactPlainData(
      baseDocument,
      `Source parent ${origin.candidateId} base clone`,
    );
    let document = baseClone.value;
    if (baseClone.bytes !== detachedBase.bytes) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${origin.candidateId} changed while its base was cloned.`,
      );
    }
    let stepId: string | null = null;
    for (let witnessIndex = 0; witnessIndex < origin.pieces.length; witnessIndex += 1) {
      const witness = origin.pieces[witnessIndex]!;
      const beforeBytes = exactPlainDataBytes(
        document,
        `Source parent ${origin.candidateId} before placement`,
      );
      if (
        detachedTruthDigest(
          document,
          `Source parent ${origin.candidateId} before placement`,
          dependencies,
        ) !== STEP7_GATE3_SOURCE_TRUTH_HASH ||
        document.truth.catalog.version !== STEP7_GATE3_SOURCE_CATALOG_VERSION
      ) {
        throw new SAFE_TYPE_ERROR(`Source parent ${origin.candidateId} left /13 before placement.`);
      }
      const placementInput = detachExactPlainData(
        document,
        `Source parent ${origin.candidateId} detached placement input`,
      );
      if (placementInput.bytes !== beforeBytes) {
        throw new SAFE_TYPE_ERROR(
          `Source parent ${origin.candidateId} changed while placement detached.`,
        );
      }
      const rawPlaced = dependencies.sourcePlace(placementInput.value, witness, stepId);
      const placed = detachAndFreezeExactPlainData(
        rawPlaced,
        `Source parent ${origin.candidateId} placement result`,
      ).value;
      if (
        exactPlainDataBytes(document, `Source parent ${origin.candidateId} placement closure`) !==
          beforeBytes ||
        detachedTruthDigest(
          placed.document,
          `Source parent ${origin.candidateId} placement result`,
          dependencies,
        ) !== STEP7_GATE3_SOURCE_TRUTH_HASH ||
        placed.document.truth.catalog.version !== STEP7_GATE3_SOURCE_CATALOG_VERSION
      ) {
        throw new SAFE_TYPE_ERROR(
          `Source parent ${origin.candidateId} placement mutated or left /13.`,
        );
      }
      document = placed.document;
      stepId = placed.stepId;
    }
    const sourceMeasurement = detachedStructuralHash(
      document,
      `Source parent ${origin.candidateId}`,
      dependencies,
    );
    const sourceDocumentHash = sourceMeasurement.hash;
    if (
      origin.candidateId !== `step-006:${origin.documentHash}` ||
      sourceDocumentHash !== origin.documentHash
    ) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${origin.candidateId} reconstructed as ${sourceDocumentHash}; required retained structural hash ${origin.documentHash}.`,
      );
    }
    push(
      sourceParents,
      SAFE_OBJECT_FREEZE({
        origin,
        document,
        sourceDocumentHash,
        sourceBytes: sourceMeasurement.bytes,
        originBytes,
      }),
    );
  }

  let sharedMigrationReportBytes: string | null = null;
  let detachedMigrationReport: Step7Gate3MigrationResult["report"] | null = null;
  const closures: Array<{
    readonly documentSnapshot: BrickDocumentV1;
    readonly reportSnapshot: Step7Gate3MigrationResult["report"];
    readonly documentBytes: string;
    readonly migrationReportBytes: string;
    readonly parent: Step7Gate3ReconstructedParent;
  }> = [];
  for (let index = 0; index < sourceParents.length; index += 1) {
    const sourceParent = sourceParents[index]!;
    const expected = parentPins[index]!;
    const migrationInput = detachExactPlainData(
      sourceParent.document,
      `Source parent ${sourceParent.origin.candidateId} detached migration input`,
    );
    if (migrationInput.bytes !== sourceParent.sourceBytes) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${sourceParent.origin.candidateId} changed while migration detached.`,
      );
    }
    const rawMigration = dependencies.migrateDocumentTruth(migrationInput.value);
    const migration = detachAndFreezeExactPlainData(
      rawMigration,
      `Migration result for ${sourceParent.origin.candidateId}`,
    ).value;
    const migrationReportBytes = assertExactStep7Gate3FinalMigration(
      sourceParent.document,
      migration,
    );
    if (
      exactPlainDataBytes(
        sourceParent.document,
        `Source parent ${sourceParent.origin.candidateId} migration closure`,
      ) !== sourceParent.sourceBytes ||
      detachedTruthDigest(
        migration.document,
        `Migrated parent ${sourceParent.origin.candidateId}`,
        dependencies,
      ) !== STEP7_GATE3_TARGET_TRUTH_HASH
    ) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${sourceParent.origin.candidateId} changed across final migration.`,
      );
    }
    if (
      sharedMigrationReportBytes !== null &&
      migrationReportBytes !== sharedMigrationReportBytes
    ) {
      throw new SAFE_TYPE_ERROR("The four retained parents did not produce one migration report.");
    }
    sharedMigrationReportBytes ??= migrationReportBytes;
    detachedMigrationReport ??= migration.report;
    const currentMeasurement = detachedStructuralHash(
      migration.document,
      `Migrated parent ${sourceParent.origin.candidateId}`,
      dependencies,
    );
    if (
      exactPlainDataBytes(
        sourceParent.document,
        `Source parent ${sourceParent.origin.candidateId} current-hash closure`,
      ) !== sourceParent.sourceBytes
    ) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${sourceParent.origin.candidateId} changed while its migrated structural hash was measured.`,
      );
    }
    const documentHash = currentMeasurement.hash;
    if (documentHash !== expected.currentDocumentHash) {
      throw new SAFE_TYPE_ERROR(
        `Migrated parent ${sourceParent.origin.candidateId} hashed as ${documentHash}; required pinned current hash ${expected.currentDocumentHash}.`,
      );
    }
    const detachedDocument = detachAndFreezeExactPlainData(
      migration.document,
      `Migrated parent ${sourceParent.origin.candidateId} detached result`,
    );
    if (detachedDocument.bytes !== currentMeasurement.bytes) {
      throw new SAFE_TYPE_ERROR(
        `Migrated parent ${sourceParent.origin.candidateId} changed while its result detached.`,
      );
    }
    push(closures, {
      documentSnapshot: migration.document,
      reportSnapshot: migration.report,
      documentBytes: currentMeasurement.bytes,
      migrationReportBytes,
      parent: SAFE_OBJECT_FREEZE({
        origin: sourceParent.origin,
        document: detachedDocument.value,
        sourceDocumentHash: sourceParent.sourceDocumentHash,
        documentHash,
        candidateId: `step-006:${documentHash}`,
        partsPreserved: true as const,
      }),
    });
  }
  if (sharedMigrationReportBytes === null || detachedMigrationReport === null) {
    throw new SAFE_TYPE_ERROR("Step-7 parent reconstruction produced no migration report.");
  }
  for (let index = 0; index < closures.length; index += 1) {
    const closure = closures[index]!;
    const sourceParent = sourceParents[index]!;
    if (
      exactPlainDataBytes(
        sourceParent.origin,
        `Source origin ${sourceParent.origin.candidateId} final closure`,
      ) !== sourceParent.originBytes ||
      exactPlainDataBytes(
        sourceParent.document,
        `Source parent ${sourceParent.origin.candidateId} final closure`,
      ) !== sourceParent.sourceBytes
    ) {
      throw new SAFE_TYPE_ERROR(
        `Source parent ${sourceParent.origin.candidateId} changed after reconstruction closed.`,
      );
    }
    if (
      exactPlainDataBytes(
        closure.documentSnapshot,
        `Migrated parent ${closure.parent.origin.candidateId} authority closure`,
      ) !== closure.documentBytes ||
      exactPlainDataBytes(
        closure.parent.document,
        `Migrated parent ${closure.parent.origin.candidateId} result closure`,
      ) !== closure.documentBytes
    ) {
      throw new SAFE_TYPE_ERROR(
        `Migrated parent ${closure.parent.origin.candidateId} changed after its structural hash was measured.`,
      );
    }
    if (
      exactPlainDataBytes(
        closure.reportSnapshot,
        `Migration report for ${closure.parent.origin.candidateId} authority closure`,
      ) !== closure.migrationReportBytes ||
      exactPlainDataBytes(detachedMigrationReport, "Shared migration report final closure") !==
        sharedMigrationReportBytes
    ) {
      throw new SAFE_TYPE_ERROR(
        `Migration report for ${closure.parent.origin.candidateId} changed after review.`,
      );
    }
  }
  if (
    exactPlainDataBytes(origins, "Step-7 retained parent origins final closure") !==
      detachedOrigins.bytes ||
    exactPlainDataBytes(parentPins, "Step-7 caller migration pins final closure") !==
      detachedPins.bytes ||
    exactPlainDataBytes(baseDocument, "Step-7 source base final closure") !== detachedBase.bytes
  ) {
    throw new SAFE_TYPE_ERROR(
      "Step-7 detached reconstruction inputs changed across dependency callbacks.",
    );
  }
  const parents: Step7Gate3ReconstructedParent[] = [];
  for (let index = 0; index < closures.length; index += 1) {
    push(parents, closures[index]!.parent);
  }
  return SAFE_OBJECT_FREEZE({
    pinAuthority: STEP7_GATE3_CALLER_PIN_AUTHORITY,
    parents: SAFE_OBJECT_FREEZE(parents),
    migrationReport: detachedMigrationReport,
  });
}

/** Reconstructs every retained source parent before final migration and retains frozen closure snapshots. */
export function reconstructStep7Gate3Parents(
  input: Step7Gate3PrivateParentReconstructionInput,
): Step7Gate3ParentReconstructionResult {
  const reconstructed = reconstructStep7Gate3ParentsAgainstCallerPins(
    {
      baseDocument: input.baseDocument,
      origins: input.origins,
      dependencies: STEP7_GATE3_PRODUCTION_PARENT_DEPENDENCIES,
    },
    EXPECTED_PARENT_MIGRATIONS,
  );
  const privateResult = SAFE_OBJECT_FREEZE({
    pinAuthority: STEP7_GATE3_PRIVATE_PIN_AUTHORITY,
    parents: reconstructed.parents,
    migrationReport: reconstructed.migrationReport,
  });
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, PRIVATE_PIN_RESULTS, [privateResult]);
  return privateResult;
}
