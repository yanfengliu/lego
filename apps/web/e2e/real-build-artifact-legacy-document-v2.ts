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
 * compatibility oracle. `/14` through `/26` each append one part without
 * changing an existing catalog interpretation; pinning every component makes a
 * later change fail closed.
 */
const ADDITIVE_SUCCESSOR_TRUTH_V26 = Object.freeze({
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/26",
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

/** Exact live truth allowed to execute the detached `/26` compatibility projection. */
const CURRENT_RUNTIME_TRUTH_V29 = Object.freeze({
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
  "builtin:brick-1x2-grille",
  "builtin:slope-1x2-45",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:plate-3x3",
  "builtin:plate-2x2-two-studs",
  "builtin:plate-1x5",
]);
const CURRENT_RUNTIME_ADDITIVE_PART_IDS_V27 = Object.freeze([
  "builtin:tile-1x2-chamfered-indented",
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:slope-1x1-double-45",
  "builtin:curved-slope-1x1-outside-bow",
]);
const CURRENT_RUNTIME_ADDITIVE_PART_IDS_V28 = Object.freeze([
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
]);
const CURRENT_RUNTIME_ADDITIVE_PART_IDS_V29 = Object.freeze([
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
]);
const CURRENT_RUNTIME_ADDITIVE_PART_IDS = Object.freeze([
  ...CURRENT_RUNTIME_ADDITIVE_PART_IDS_V27,
  ...CURRENT_RUNTIME_ADDITIVE_PART_IDS_V28,
  ...CURRENT_RUNTIME_ADDITIVE_PART_IDS_V29,
]);
const ALL_POST_LEGACY_CATALOG_PART_IDS = Object.freeze([
  ...ADDITIVE_CATALOG_PART_IDS,
  ...CURRENT_RUNTIME_ADDITIVE_PART_IDS,
]);
/**
 * Exact `/29` live projection over the retained 85-row predecessor roster.
 * This binds the current connector, proper-orientation, collision-profile, and
 * validator semantics without rewriting either frozen `/13` truth or the
 * separately retained `/26` migration projection.
 */
const CURRENT_RUNTIME_PREDECESSOR_SEMANTICS_HASH_V29 =
  "sha256:3366a2aba6de9918911d4f0bb02c82fed12a4cecd1dc9ee17710756b5a853bab";
const CURRENT_RUNTIME_PROFILED_PREDECESSOR_IDS_V29 = Object.freeze([
  "builtin:corner-plate-3x3",
  "builtin:plate-1x2-round-end",
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-2x4-wing",
]);

interface CatalogCompatibilityBasisV26 {
  readonly truth: TruthSnapshot;
  readonly constraints: Pick<
    BrickDocumentV1["constraints"],
    "allowedCatalogPartIds" | "allowedColorIds"
  >;
  readonly validatorSemanticsHash: string;
}

function haveExactStringMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return orderedLeft.every((value, index) => value === orderedRight[index]);
}

function activePredecessorValidatorSemanticsHashV26(): string {
  return canonicalDigest({
    orientations: UPRIGHT_ORIENTATIONS,
    connectorPairRules: CONNECTOR_PAIR_RULES,
    colorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    parts: PART_DEFINITIONS.filter(({ id }) => !ALL_POST_LEGACY_CATALOG_PART_IDS.includes(id)).map(
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

export function createFrozenLegacyAdditiveCatalogBasisV26(): CatalogCompatibilityBasisV26 {
  const active = createEmptyBrickDocument({
    id: "legacy-v2-compatibility-basis",
    name: "Legacy v2 compatibility basis",
  });
  const activePartIds = active.constraints.allowedCatalogPartIds;
  const runtimeAddedPartCounts = CURRENT_RUNTIME_ADDITIVE_PART_IDS.map(
    (addedPartId) => activePartIds.filter((partId) => partId === addedPartId).length,
  );
  const v26PartIds = activePartIds.filter(
    (partId) => !CURRENT_RUNTIME_ADDITIVE_PART_IDS.includes(partId),
  );
  if (
    JSON.stringify(active.truth) !== JSON.stringify(CURRENT_RUNTIME_TRUTH_V29) ||
    runtimeAddedPartCounts.some((count) => count !== 1) ||
    activePartIds.length !== 106 ||
    v26PartIds.length !== 98
  ) {
    throw new TypeError(
      "Legacy diagnostic validation requires the exact reviewed /29 runtime bridge over frozen builtin.basic-parts/26.",
    );
  }
  return {
    truth: structuredClone(ADDITIVE_SUCCESSOR_TRUTH_V26) as TruthSnapshot,
    constraints: {
      ...active.constraints,
      allowedCatalogPartIds: v26PartIds,
    },
    validatorSemanticsHash: activePredecessorValidatorSemanticsHashV26(),
  };
}

function currentRuntimeCompatibilityProjectionV29(document: BrickDocumentV1): BrickDocumentV1 {
  const active = createEmptyBrickDocument({
    id: "legacy-v2-current-runtime-projection",
    name: "Legacy v2 current runtime projection",
  });
  createFrozenLegacyAdditiveCatalogBasisV26();
  return {
    ...structuredClone(document),
    truth: structuredClone(active.truth),
  };
}

/**
 * Proves that active catalog truth is the one reviewed additive successor and
 * that the retained document contains exactly the preceding catalog allowlist.
 */
export function assertFrozenLegacyAdditiveCatalogV2(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV26 = createFrozenLegacyAdditiveCatalogBasisV26(),
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
  if (JSON.stringify(active.truth) !== JSON.stringify(ADDITIVE_SUCCESSOR_TRUTH_V26)) {
    throw new TypeError(
      "Legacy diagnostic validation requires exact reviewed additive catalog successor builtin.basic-parts/26.",
    );
  }
  if (active.validatorSemanticsHash !== CURRENT_RUNTIME_PREDECESSOR_SEMANTICS_HASH_V29) {
    throw new TypeError(
      "Legacy diagnostic validation requires the exact reviewed /29 predecessor-semantic projection; an existing catalog interpretation moved.",
    );
  }
  const profiledPredecessorIds = PART_DEFINITIONS.filter(
    ({ id, collision }) =>
      !ALL_POST_LEGACY_CATALOG_PART_IDS.includes(id) &&
      (collision.validatedConnectionStudProfile !== undefined ||
        collision.primitives.some(
          (primitive) =>
            primitive.kind === "cylinder" &&
            primitive.validatedConnectionProfileRadiusLdu !== undefined,
        )),
  )
    .map(({ id }) => id)
    .sort();
  if (
    JSON.stringify(profiledPredecessorIds) !==
    JSON.stringify(CURRENT_RUNTIME_PROFILED_PREDECESSOR_IDS_V29)
  ) {
    throw new TypeError(
      `Legacy diagnostic validation requires the exact reviewed /29 predecessor profile roster; received ${profiledPredecessorIds.join(", ")}.`,
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
    successorPartIds.length !== 98 ||
    precedingPartIds.length !== 85 ||
    !haveExactStringMembers(document.constraints.allowedCatalogPartIds, precedingPartIds) ||
    !haveExactStringMembers(
      document.constraints.allowedColorIds,
      active.constraints.allowedColorIds,
    )
  ) {
    throw new TypeError(
      "Legacy diagnostic catalog constraints are not the exact 85-part predecessor of reviewed additive catalogs /14 through /26.",
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
        (partId) => !ALL_POST_LEGACY_CATALOG_PART_IDS.includes(partId),
      ),
    },
  };
  assertFrozenLegacyAdditiveCatalogV2(document);
  return document;
}

function additiveCompatibilityProjectionV26(
  document: BrickDocumentV1,
  active: CatalogCompatibilityBasisV26 = createFrozenLegacyAdditiveCatalogBasisV26(),
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
  const active = createFrozenLegacyAdditiveCatalogBasisV26();
  additiveCompatibilityProjectionV26(document, active);
  const projected = currentRuntimeCompatibilityProjectionV29(document);
  const validation = validateBrickDocument(projected);
  if (
    validation.truthSnapshotHash !== canonicalDigest(CURRENT_RUNTIME_TRUTH_V29) ||
    validation.targetDocumentHash !== documentStructuralHash(projected)
  ) {
    throw new TypeError(
      "Legacy compatibility projection did not reproduce its exact active truth and structural hash.",
    );
  }
  if (validation.validatorSetHash !== CURRENT_RUNTIME_TRUTH_V29.validatorSet.hash) {
    throw new TypeError(
      "Legacy compatibility projection was not evaluated by the exact generation-5 runtime bridge under the frozen /26 predecessor semantic guard.",
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
  const sequence = deriveBuildSequence(currentRuntimeCompatibilityProjectionV29(input.document));
  if (!sequence.buildable) {
    throw new TypeError(
      `Legacy diagnostic document has an unbuildable prefix at step ${String(sequence.firstUnbuildableStepIndex)}.`,
    );
  }
  for (const report of input.reports) {
    const prefix = canonicalPrefixDocument(input.document, report.stepNumber);
    const validation = validateFrozenLegacyBrickDocumentV2(prefix);
    const prefixSequence = deriveBuildSequence(currentRuntimeCompatibilityProjectionV29(prefix));
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
