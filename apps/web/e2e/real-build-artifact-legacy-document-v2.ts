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
 * compatibility oracle. `/14` adds one part and changes no existing catalog
 * interpretation; pinning every component makes a later change fail closed.
 */
const ADDITIVE_SUCCESSOR_TRUTH_V14 = Object.freeze({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/14",
    hash: "sha256:c2a3556085f8a3a3efe66a2f52d2a70378be04ff52c53a57fbff2f2701cd194c",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:537ec8b084b9ac9633c4511817204fcd2037e123d96b7628c3e6b803b32a31cf",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/2",
    hash: "sha256:a219f827b9dcceda98b7f320bb53c9f7fa172d515a8081af4b97623975aaf97b",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:a005d64462b0805e82b28f8571e40aeb48d6b3602b8fe5db01a4e1cf56635896",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/2",
    hash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
  },
});

const LEGACY_TRUTH_HASH = "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5";
const LEGACY_VALIDATOR_HASH = LEGACY_TRUTH_V2.validatorSet.hash;
const LEGACY_BRICK_KERNEL_VERSION = "lego.brick-kernel/1";
const ADDITIVE_CATALOG_PART_ID = "builtin:tile-1x1-quarter-round";
/** Measured identically at retained /13 HEAD 8fc0186 and the /14 85-row projection. */
const LEGACY_VALIDATOR_SEMANTICS_HASH =
  "sha256:dc519548463dc42a7d87e8283ec474aa35fc3e40fce04439e96e70c34d4ce4d3";

interface CatalogCompatibilityBasisV14 {
  readonly truth: TruthSnapshot;
  readonly constraints: Pick<
    BrickDocumentV1["constraints"],
    "allowedCatalogPartIds" | "allowedColorIds"
  >;
  readonly validatorSemanticsHash: string;
}

function activePredecessorValidatorSemanticsHashV14(): string {
  return canonicalDigest({
    orientations: UPRIGHT_ORIENTATIONS,
    connectorPairRules: CONNECTOR_PAIR_RULES,
    colorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    parts: PART_DEFINITIONS.filter(({ id }) => id !== ADDITIVE_CATALOG_PART_ID).map(
      ({ id, availableColorIds, legalOrientationIds, connectors, collision }) => ({
        id,
        availableColorIds,
        legalOrientationIds,
        connectors,
        collision,
      }),
    ),
  });
}

export function createFrozenLegacyAdditiveCatalogBasisV14(): CatalogCompatibilityBasisV14 {
  const active = createEmptyBrickDocument({
    id: "legacy-v2-compatibility-basis",
    name: "Legacy v2 compatibility basis",
  });
  return {
    truth: active.truth,
    constraints: active.constraints,
    validatorSemanticsHash: activePredecessorValidatorSemanticsHashV14(),
  };
}

/**
 * Proves that active catalog truth is the one reviewed additive successor and
 * that the retained document contains exactly the preceding catalog allowlist.
 */
export function assertFrozenLegacyAdditiveCatalogV2(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV14 = createFrozenLegacyAdditiveCatalogBasisV14(),
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
  if (JSON.stringify(active.truth) !== JSON.stringify(ADDITIVE_SUCCESSOR_TRUTH_V14)) {
    throw new TypeError(
      "Legacy diagnostic validation requires exact reviewed additive catalog successor builtin.basic-parts/14.",
    );
  }
  if (active.validatorSemanticsHash !== LEGACY_VALIDATOR_SEMANTICS_HASH) {
    throw new TypeError(
      "Legacy diagnostic validation requires the exact retained /13 validator-semantic projection; an existing catalog interpretation moved.",
    );
  }
  const successorPartIds = active.constraints.allowedCatalogPartIds;
  const addedPartCount = successorPartIds.filter(
    (partId) => partId === ADDITIVE_CATALOG_PART_ID,
  ).length;
  const precedingPartIds = successorPartIds.filter((partId) => partId !== ADDITIVE_CATALOG_PART_ID);
  if (
    addedPartCount !== 1 ||
    successorPartIds.length !== 86 ||
    precedingPartIds.length !== 85 ||
    JSON.stringify(document.constraints.allowedCatalogPartIds) !==
      JSON.stringify(precedingPartIds) ||
    JSON.stringify(document.constraints.allowedColorIds) !==
      JSON.stringify(active.constraints.allowedColorIds)
  ) {
    throw new TypeError(
      "Legacy diagnostic catalog constraints are not the exact 85-part predecessor of reviewed additive catalog /14.",
    );
  }
  if (document.parts.some(({ catalogPartId }) => catalogPartId === ADDITIVE_CATALOG_PART_ID)) {
    throw new TypeError(
      `Legacy diagnostic document references ${ADDITIVE_CATALOG_PART_ID}, which did not exist in frozen catalog /13.`,
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
        (partId) => partId !== ADDITIVE_CATALOG_PART_ID,
      ),
    },
  };
  assertFrozenLegacyAdditiveCatalogV2(document);
  return document;
}

function additiveCompatibilityProjectionV14(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV14 = createFrozenLegacyAdditiveCatalogBasisV14(),
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
  const active = createFrozenLegacyAdditiveCatalogBasisV14();
  const projected = additiveCompatibilityProjectionV14(document, active);
  const validation = validateBrickDocument(projected);
  if (
    validation.truthSnapshotHash !== canonicalDigest(active.truth) ||
    validation.targetDocumentHash !== documentStructuralHash(projected)
  ) {
    throw new TypeError(
      "Legacy compatibility projection did not reproduce its exact active truth and structural hash.",
    );
  }
  if (validation.validatorSetHash !== ADDITIVE_SUCCESSOR_TRUTH_V14.validatorSet.hash) {
    throw new TypeError(
      "Legacy compatibility projection was not evaluated by the pinned generation-2 validator set.",
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
  const sequence = deriveBuildSequence(additiveCompatibilityProjectionV14(input.document));
  if (!sequence.buildable) {
    throw new TypeError(
      `Legacy diagnostic document has an unbuildable prefix at step ${String(sequence.firstUnbuildableStepIndex)}.`,
    );
  }
  for (const report of input.reports) {
    const prefix = canonicalPrefixDocument(input.document, report.stepNumber);
    const validation = validateFrozenLegacyBrickDocumentV2(prefix);
    const prefixSequence = deriveBuildSequence(additiveCompatibilityProjectionV14(prefix));
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
