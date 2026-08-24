import {
  BRICK_KERNEL_VERSION,
  canonicalDigest,
  createEmptyBrickDocument,
  deriveBuildSequence,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import {
  COLOR_DEFINITIONS,
  CONNECTOR_PAIR_RULES,
  PART_DEFINITIONS,
  UPRIGHT_ORIENTATIONS,
} from "@lego-studio/catalog";
import type { BrickDocumentV1, TruthSnapshot, ValidationReportV1 } from "@lego-studio/protocol";

import type { RealBuildStepReport } from "./real-build-safety";

/** Exact truth bundle retained by the artifact-manifest /3, browser /2 generation. */
const LEGACY_TRUTH_V2 = Object.freeze({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/13",
    hash: "sha256:100283423bf1cfecfdfec5ba2216d1834a9eb19b1757c71772f7fa53223190d6",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/2",
    hash: "sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/2",
    hash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
  },
});

/**
 * The only reviewed successor this frozen validator may use as a semantic
 * compatibility oracle. `/14` through `/19` each append one part without
 * changing an existing catalog interpretation; pinning every component makes a
 * later change fail closed.
 */
const ADDITIVE_SUCCESSOR_TRUTH_V19 = Object.freeze({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/19",
    hash: "sha256:90eae14b0755f6c2b9d5515f4e5db53966d938b5d9867ee1aed90b09ea247016",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:03ccce5b7d3ad14c6b9c9749abb3a806139ade4f786919d54e989ca1a14c6750",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/3",
    hash: "sha256:911806345cb509dad7c3b0c923f8d87364c66e71627ffec9bd934b4df344f3fd",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:d2888660cff26c2f5665e76c02fecc532b3a04aada1810695495230eb5f664d9",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/3",
    hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
  },
});

const LEGACY_TRUTH_HASH = "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5";
const LEGACY_VALIDATOR_HASH = LEGACY_TRUTH_V2.validatorSet.hash;
const LEGACY_BRICK_KERNEL_VERSION = "lego.brick-kernel/1";
const ADDITIVE_CATALOG_PART_IDS = Object.freeze([
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
]);
/**
 * Measured identically at retained /13 HEAD 8fc0186 and the /19 85-row
 * projection after restoring the historical collision truth label. Collision
 * model `/3` adds semantics only for the excluded 11253 row; predecessor part
 * payloads remain `/2`-identical and are compared under that label below.
 */
const LEGACY_VALIDATOR_SEMANTICS_HASH =
  "sha256:dc519548463dc42a7d87e8283ec474aa35fc3e40fce04439e96e70c34d4ce4d3";

interface CatalogCompatibilityBasisV19 {
  readonly truth: TruthSnapshot;
  readonly constraints: Pick<
    BrickDocumentV1["constraints"],
    "allowedCatalogPartIds" | "allowedColorIds"
  >;
  readonly validatorSemanticsHash: string;
}

function activePredecessorValidatorSemanticsHashV19(): string {
  return canonicalDigest({
    orientations: UPRIGHT_ORIENTATIONS,
    connectorPairRules: CONNECTOR_PAIR_RULES,
    colorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    parts: PART_DEFINITIONS.filter(({ id }) => !ADDITIVE_CATALOG_PART_IDS.includes(id)).map(
      ({ id, availableColorIds, legalOrientationIds, connectors, collision }) => ({
        id,
        availableColorIds,
        legalOrientationIds,
        connectors,
        collision: { ...collision, modelVersion: "rectilinear-stud-clearance/2" },
      }),
    ),
  });
}

export function createFrozenLegacyAdditiveCatalogBasisV19(): CatalogCompatibilityBasisV19 {
  const active = createEmptyBrickDocument({
    id: "legacy-v2-compatibility-basis",
    name: "Legacy v2 compatibility basis",
  });
  return {
    truth: active.truth,
    constraints: active.constraints,
    validatorSemanticsHash: activePredecessorValidatorSemanticsHashV19(),
  };
}

/**
 * Proves that active catalog truth is the one reviewed additive successor and
 * that the retained document contains exactly the preceding catalog allowlist.
 */
export function assertFrozenLegacyAdditiveCatalogV2(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV19 = createFrozenLegacyAdditiveCatalogBasisV19(),
): void {
  if (JSON.stringify(document.truth) !== JSON.stringify(LEGACY_TRUTH_V2)) {
    throw new TypeError(
      "Legacy diagnostic document truth is not exact builtin.basic-parts/13 validator generation /2.",
    );
  }
  if (canonicalDigest(document.truth) !== LEGACY_TRUTH_HASH) {
    throw new TypeError(
      "Legacy diagnostic document truth does not reproduce the pinned generation /2 truth hash.",
    );
  }
  if (JSON.stringify(active.truth) !== JSON.stringify(ADDITIVE_SUCCESSOR_TRUTH_V19)) {
    throw new TypeError(
      "Legacy diagnostic validation requires exact reviewed additive catalog successor builtin.basic-parts/19.",
    );
  }
  if (active.validatorSemanticsHash !== LEGACY_VALIDATOR_SEMANTICS_HASH) {
    throw new TypeError(
      "Legacy diagnostic validation requires the exact retained /13 validator-semantic projection; an existing catalog interpretation moved.",
    );
  }
  const profiledPredecessor = PART_DEFINITIONS.find(
    ({ id, collision }) =>
      !ADDITIVE_CATALOG_PART_IDS.includes(id) &&
      (collision.validatedConnectionStudProfile !== undefined ||
        collision.primitives.some(
          (primitive) =>
            primitive.kind === "cylinder" &&
            primitive.validatedConnectionProfileRadiusLdu !== undefined,
        )),
  );
  if (profiledPredecessor !== undefined) {
    throw new TypeError(
      `Legacy diagnostic validation found nominal connection-profile semantics on predecessor part ${profiledPredecessor.id}; the /3 behavior is reviewed only for excluded additive row builtin:roller-skate.`,
    );
  }
  const successorPartIds = active.constraints.allowedCatalogPartIds;
  const addedPartCounts = ADDITIVE_CATALOG_PART_IDS.map(
    (addedPartId) => successorPartIds.filter((partId) => partId === addedPartId).length,
  );
  const precedingPartIds = successorPartIds.filter(
    (partId) => !ADDITIVE_CATALOG_PART_IDS.includes(partId),
  );
  if (
    addedPartCounts.some((count) => count !== 1) ||
    successorPartIds.length !== 91 ||
    precedingPartIds.length !== 85 ||
    JSON.stringify(document.constraints.allowedCatalogPartIds) !==
      JSON.stringify(precedingPartIds) ||
    JSON.stringify(document.constraints.allowedColorIds) !==
      JSON.stringify(active.constraints.allowedColorIds)
  ) {
    throw new TypeError(
      "Legacy diagnostic catalog constraints are not the exact 85-part predecessor of reviewed additive catalogs /14 through /19.",
    );
  }
  const referencedAddedPart = document.parts.find(({ catalogPartId }) =>
    ADDITIVE_CATALOG_PART_IDS.includes(catalogPartId),
  )?.catalogPartId;
  if (referencedAddedPart !== undefined) {
    throw new TypeError(
      `Legacy diagnostic document references ${referencedAddedPart}, which did not exist in frozen catalog /13.`,
    );
  }
}

/** Constructs the exact empty document shape emitted by generation /2. */
export function createFrozenLegacyEmptyBrickDocumentV2(options: {
  readonly id: string;
  readonly name: string;
  readonly maxParts: number;
}): BrickDocumentV1 {
  const active = createEmptyBrickDocument(options);
  const document: BrickDocumentV1 = {
    ...active,
    truth: structuredClone(LEGACY_TRUTH_V2) as TruthSnapshot,
    constraints: {
      ...active.constraints,
      allowedCatalogPartIds: active.constraints.allowedCatalogPartIds.filter(
        (partId) => !ADDITIVE_CATALOG_PART_IDS.includes(partId),
      ),
    },
  };
  assertFrozenLegacyAdditiveCatalogV2(document);
  return document;
}

function additiveCompatibilityProjectionV19(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV19 = createFrozenLegacyAdditiveCatalogBasisV19(),
): BrickDocumentV1 {
  assertFrozenLegacyAdditiveCatalogV2(document, active);
  return {
    ...structuredClone(document),
    truth: structuredClone(active.truth),
  };
}

/**
 * Runs semantic validation on a detached truth-only compatibility projection,
 * then binds the result back to the untouched historical bytes and hashes.
 */
export function validateFrozenLegacyBrickDocumentV2(document: BrickDocumentV1): ValidationReportV1 {
  const active = createFrozenLegacyAdditiveCatalogBasisV19();
  const projected = additiveCompatibilityProjectionV19(document, active);
  const validation = validateBrickDocument(projected);
  if (
    validation.truthSnapshotHash !== canonicalDigest(active.truth) ||
    validation.targetDocumentHash !== documentStructuralHash(projected)
  ) {
    throw new TypeError(
      "Legacy compatibility projection did not reproduce its exact active truth and structural hash.",
    );
  }
  if (validation.validatorSetHash !== ADDITIVE_SUCCESSOR_TRUTH_V19.validatorSet.hash) {
    throw new TypeError(
      "Legacy compatibility projection was not evaluated by the pinned generation-3 validator set under the predecessor semantic guard.",
    );
  }
  return {
    ...validation,
    targetDocumentHash: documentStructuralHash(document),
    truthSnapshotHash: LEGACY_TRUTH_HASH,
    validatorSetHash: LEGACY_VALIDATOR_HASH,
  };
}

function canonicalPrefixDocument(
  document: BrickDocumentV1,
  lastStepNumber: number,
): BrickDocumentV1 {
  const steps = document.steps.filter(({ index }) => index < lastStepNumber);
  const stepIds = new Set(steps.map(({ id }) => id));
  const parts = document.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => partIds.has(partId)),
  });
  return {
    ...document,
    parts,
    steps,
    connections: document.connections.filter(
      ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
}

function blockingIssues(report: ReturnType<typeof validateBrickDocument>) {
  return report.issues
    .filter(({ severity }) => severity === "blocking")
    .map(({ code, message, path, partIds }) => ({ code, message, path, partIds }));
}

function assertPinnedLegacyReport(
  report: ReturnType<typeof validateBrickDocument>,
  label: string,
): void {
  if (
    report.truthSnapshotHash !== LEGACY_TRUTH_HASH ||
    report.validatorSetHash !== LEGACY_VALIDATOR_HASH
  ) {
    throw new TypeError(
      `${label} was evaluated by truth ${report.truthSnapshotHash}/${report.validatorSetHash}, not frozen artifact generation /3 truth ${LEGACY_TRUTH_HASH}/${LEGACY_VALIDATOR_HASH}.`,
    );
  }
}

/** Replays the historical Node semantic/prefix audit against its exact pinned truth generation. */
export function assertFrozenLegacyDocumentProjectionV2(input: {
  readonly document: BrickDocumentV1;
  readonly reports: readonly RealBuildStepReport[];
  readonly expectedStructuralHash: string;
}): void {
  if (String(BRICK_KERNEL_VERSION) !== LEGACY_BRICK_KERNEL_VERSION) {
    throw new TypeError(
      `Legacy diagnostic inspection requires retained ${LEGACY_BRICK_KERNEL_VERSION}, not ${String(BRICK_KERNEL_VERSION)}.`,
    );
  }
  const full = validateFrozenLegacyBrickDocumentV2(input.document);
  assertPinnedLegacyReport(full, "Legacy diagnostic document");
  const structuralHash = documentStructuralHash(input.document);
  if (
    !full.documentGloballyValid ||
    blockingIssues(full).length > 0 ||
    full.targetDocumentHash !== structuralHash ||
    structuralHash !== input.expectedStructuralHash
  ) {
    throw new TypeError(
      "Legacy diagnostic document is not globally valid or does not reproduce its exact structural hash under frozen truth.",
    );
  }
  const sequence = deriveBuildSequence(additiveCompatibilityProjectionV19(input.document));
  if (!sequence.buildable) {
    throw new TypeError(
      `Legacy diagnostic document has an unbuildable prefix at step ${String(sequence.firstUnbuildableStepIndex)}.`,
    );
  }
  for (const report of input.reports) {
    const prefix = canonicalPrefixDocument(input.document, report.stepNumber);
    const validation = validateFrozenLegacyBrickDocumentV2(prefix);
    const prefixSequence = deriveBuildSequence(additiveCompatibilityProjectionV19(prefix));
    assertPinnedLegacyReport(validation, `Legacy printed-step ${report.stepNumber} prefix`);
    const expectedBlocking = blockingIssues(validation);
    if (
      !validation.documentGloballyValid ||
      expectedBlocking.length > 0 ||
      !prefixSequence.buildable ||
      report.validation.attempted !== true ||
      report.validation.targetDocumentHash !== validation.targetDocumentHash ||
      report.validation.targetDocumentHash !== documentStructuralHash(prefix) ||
      report.validation.truthSnapshotHash !== LEGACY_TRUTH_HASH ||
      report.validation.validatorSetHash !== LEGACY_VALIDATOR_HASH ||
      report.validation.documentGloballyValid !== validation.documentGloballyValid ||
      JSON.stringify(report.validation.blockingIssues) !== JSON.stringify(expectedBlocking) ||
      report.validation.failure !== null
    ) {
      throw new TypeError(
        `Legacy printed-step ${report.stepNumber} validation tuple is stale or does not reproduce its exact semantic prefix.`,
      );
    }
  }
}
