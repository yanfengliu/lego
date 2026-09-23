import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import {
  canonicalBrickDocument,
  canonicalDigest,
  canonicalSha256,
  createEmptyBrickDocument,
  deepFreeze,
  documentStructuralHash,
  normalizeBrickDocument,
  normalizeScopeCapability,
  transformLduPoint,
  validateBrickDocument,
  verifyAssemblyPatchAgainstCapability,
} from "@lego-studio/brick-kernel";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildOperation,
  PartInstance,
  ScopeCapabilityV1,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import {
  REAL_BUILD_PREFIX50_FINAL_CANDIDATE_SNAPSHOT_HASH,
  snapshotRealBuildPrefix50FinalCandidateInput,
  type RealBuildPrefix50FinalCandidateInput,
  type RealBuildPrefix50FinalCandidateReceipt,
  type RealBuildPrefix50FinalCandidateResult,
} from "./real-build-prefix50-final-candidate-contract";
export {
  REAL_BUILD_PREFIX50_FINAL_CANDIDATE_MANIFEST,
  REAL_BUILD_PREFIX50_FINAL_CANDIDATE_SNAPSHOT_HASH,
} from "./real-build-prefix50-final-candidate-contract";
export type {
  RealBuildPrefix50FinalCandidateReceipt,
  RealBuildPrefix50FinalCandidateResult,
} from "./real-build-prefix50-final-candidate-contract";

const PART_COUNT = 320;
const STEP_COUNT = 50;
const ZERO_PIECE_STEP = 44;
const INCOMPLETE_CODES = new Set([
  "COLLISION_COMPARISON_BUDGET_EXCEEDED",
  "COLLISION_FINDING_BUDGET_EXCEEDED",
  "VALIDATION_ISSUE_BUDGET_EXCEEDED",
]);
const finalCandidates = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function brandFinalCandidate(value: object): void {
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, finalCandidates, [value]);
}

function hasFinalCandidateBrand(value: object): boolean {
  return SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, finalCandidates, [value]) as boolean;
}

export function isRealBuildPrefix50FinalCandidateResult(
  value: unknown,
): value is RealBuildPrefix50FinalCandidateResult {
  return typeof value === "object" && value !== null && hasFinalCandidateBrand(value);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function same(left: unknown, right: unknown): boolean {
  return canonicalDigest(left) === canonicalDigest(right);
}

function requireExactEmptyRoot(base: BrickDocumentV1): void {
  const expected = createEmptyBrickDocument({
    id: base.id,
    name: base.name,
    revision: base.revision,
    maxParts: base.constraints.maxParts,
  });
  if (canonicalBrickDocument(base) !== canonicalBrickDocument(expected)) {
    throw new TypeError(
      "Prefix-50 final verification requires the exact module-snapshotted empty root bootstrap.",
    );
  }
}

function scaffoldWithoutMemberships(document: BrickDocumentV1): unknown {
  return {
    schemaVersion: document.schemaVersion,
    id: document.id,
    truth: document.truth,
    name: document.name,
    submodels: document.submodels.map(({ id, name }) => ({ id, name })),
    semanticRegions: document.semanticRegions.map(({ id, label }) => ({ id, label })),
    constraints: document.constraints,
    provenance: document.provenance,
  };
}

function requireFinalShape(input: RealBuildPrefix50FinalCandidateInput): void {
  const { document: final } = input.exactCompilation;
  const { emptyRootSnapshot } = input;
  const base = emptyRootSnapshot.document;
  if (final.parts.length !== PART_COUNT) {
    throw new TypeError(`Prefix-50 final document must contain exactly ${PART_COUNT} parts.`);
  }
  if (final.steps.length !== STEP_COUNT) {
    throw new TypeError(`Prefix-50 final document must contain exactly ${STEP_COUNT} BuildSteps.`);
  }
  for (let index = 0; index < STEP_COUNT; index += 1) {
    const step = final.steps[index]!;
    if (step.index !== index || step.name.length === 0) {
      throw new TypeError(
        `Prefix-50 final BuildStep ${index} must be contiguous and retain its authenticated exact-compilation name.`,
      );
    }
  }
  if (final.steps[ZERO_PIECE_STEP - 1]!.partIds.length !== 0) {
    throw new TypeError(`Prefix-50 printed step ${ZERO_PIECE_STEP} must contain zero parts.`);
  }
  if (final.steps.some(({ index }) => index < 0 || index >= STEP_COUNT)) {
    throw new TypeError(
      "Prefix-50 final document must not contain step 51 or any suffix BuildStep.",
    );
  }
  if (!same(scaffoldWithoutMemberships(final), scaffoldWithoutMemberships(base))) {
    throw new TypeError(
      "Prefix-50 final truth and document scaffold must match the exact empty root.",
    );
  }
  if (
    final.parts.some(
      ({ provenance }) =>
        provenance.source !== "ai" ||
        typeof provenance.sourceId !== "string" ||
        provenance.sourceId.length === 0,
    ) ||
    final.connections.some(
      ({ provenance }) =>
        provenance.source !== "ai" ||
        typeof provenance.sourceId !== "string" ||
        provenance.sourceId.length === 0,
    )
  ) {
    throw new TypeError(
      "Prefix-50 final parts and connections must retain compiler-authored AI provenance.",
    );
  }
}

function requireEvidence(input: RealBuildPrefix50FinalCandidateInput): void {
  const compilation = input.exactCompilation;
  if (
    compilation.placementOrdinals.some((ordinal, index) => ordinal !== index + 1) ||
    new Set(compilation.placementOrdinals).size !== PART_COUNT
  ) {
    throw new TypeError(
      "Prefix-50 placement ordinals must be the exact unique roster 1 through 320.",
    );
  }
  if (
    compilation.stateCommitments.length !== STEP_COUNT + 1 ||
    compilation.candidateStepCommitments.length !== STEP_COUNT ||
    compilation.candidateStepCommitments.some(
      ({ printedStepNumber }, index) => printedStepNumber !== index + 1,
    )
  ) {
    throw new TypeError(
      "Prefix-50 exact compilation must carry one authenticated candidate commitment for every printed step 1 through 50.",
    );
  }
  const finalHash = documentStructuralHash(compilation.document);
  const stepIndexById = new Map(compilation.document.steps.map(({ id, index }) => [id, index]));
  const countsByCompletedStep = Array.from(
    { length: STEP_COUNT + 1 },
    (_, completed) =>
      compilation.document.parts.filter(
        ({ stepId }) => (stepIndexById.get(stepId) ?? STEP_COUNT) < completed,
      ).length,
  );
  for (let index = 0; index < compilation.stateCommitments.length; index += 1) {
    const state = compilation.stateCommitments[index]!;
    if (state.completedPrintedStep !== index || state.partCount !== countsByCompletedStep[index]) {
      throw new TypeError(
        `Prefix-50 state commitment ${index} must match its exact completed-step part count.`,
      );
    }
  }
  const first = compilation.stateCommitments[0]!;
  const last = compilation.stateCommitments[STEP_COUNT]!;
  if (first.documentHash !== input.emptyRootSnapshot.documentHash) {
    throw new TypeError("Prefix-50 state 0 must bind the exact empty-root structural hash.");
  }
  if (
    last.completedPrintedStep !== STEP_COUNT ||
    last.partCount !== PART_COUNT ||
    last.documentHash !== finalHash
  ) {
    throw new TypeError(
      "Prefix-50 final state must bind printed step 50, count 320, and final hash.",
    );
  }
}

function requireSelectedReturnEvidence(input: RealBuildPrefix50FinalCandidateInput): void {
  const selected = input.selectedSubBuildReturn;
  const compilation = input.exactCompilation;
  const returned = selected.selectedDocument;
  if (
    selected.authority !== "none" ||
    selected.sourceSetId !== "6651557" ||
    returned.parts.length !== 280 ||
    returned.steps.length !== ZERO_PIECE_STEP - 1 ||
    selected.selectedDocumentHash !== documentStructuralHash(returned) ||
    !same(
      scaffoldWithoutMemberships(returned),
      scaffoldWithoutMemberships(input.emptyRootSnapshot.document),
    )
  ) {
    throw new TypeError(
      "Prefix-50 final verification requires the exact authenticated hard-valid 280-part step-43 selected return.",
    );
  }
  requireCompleteHardValidity(returned);
  const state44 = normalizeBrickDocument({
    ...returned,
    steps: [...returned.steps, compilation.document.steps[ZERO_PIECE_STEP - 1]!],
  });
  if (
    documentStructuralHash(state44) !== compilation.stateCommitments[ZERO_PIECE_STEP]?.documentHash
  ) {
    throw new TypeError(
      "Prefix-50 selected return plus the zero-piece step must bind exact authenticated state 44.",
    );
  }
}

function requireCompleteHardValidity(document: BrickDocumentV1): ValidationReportV1 {
  const report = validateBrickDocument(document);
  const incomplete = [
    ...new Set(report.issues.map(({ code }) => code).filter((code) => INCOMPLETE_CODES.has(code))),
  ].sort(compareStrings);
  const blocking = [
    ...new Set(
      report.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code),
    ),
  ].sort(compareStrings);
  if (incomplete.length > 0 || blocking.length > 0 || !report.documentGloballyValid) {
    throw new TypeError(
      `Prefix-50 final document requires complete global hard validity; incomplete/blocking=${incomplete.join("+") || "none"}/${blocking.join("+") || "none"}.`,
    );
  }
  return report;
}

function semanticRegionIdsForPart(document: BrickDocumentV1, partId: string): readonly string[] {
  return document.semanticRegions
    .filter(({ partIds }) => partIds.includes(partId))
    .map(({ id }) => id)
    .sort(compareStrings);
}

function operationsFor(base: BrickDocumentV1, final: BrickDocumentV1): readonly BuildOperation[] {
  const operations: BuildOperation[] = [
    {
      kind: "removeStep",
      operationId: "prefix50-final-remove-empty-bootstrap",
      step: base.steps[0]!,
    },
  ];
  for (let index = 0; index < final.steps.length; index += 1) {
    operations.push({
      kind: "addStep",
      operationId: `prefix50-final-add-step-${String(index + 1).padStart(2, "0")}`,
      step: { ...final.steps[index]!, partIds: [] },
    });
  }
  for (let index = 0; index < final.parts.length; index += 1) {
    const part = final.parts[index]!;
    operations.push({
      kind: "addPart",
      operationId: `prefix50-final-add-part-${String(index + 1).padStart(3, "0")}`,
      part,
      semanticRegionIds: semanticRegionIdsForPart(final, part.id),
    });
  }
  for (let index = 0; index < final.connections.length; index += 1) {
    operations.push({
      kind: "addConnection",
      operationId: `prefix50-final-add-connection-${String(index + 1).padStart(3, "0")}`,
      connection: final.connections[index]!,
    });
  }
  return deepFreeze(operations);
}

function partWorldBounds(part: PartInstance): {
  readonly min: LduVector3;
  readonly max: LduVector3;
} {
  const definition = getPartDefinition(part.catalogPartId);
  if (definition === undefined) {
    throw new TypeError(`Prefix-50 final scope cannot resolve catalog part ${part.catalogPartId}.`);
  }
  const points: LduVector3[] = [];
  for (const x of [definition.boundsLdu.min[0], definition.boundsLdu.max[0]]) {
    for (const y of [definition.boundsLdu.min[1], definition.boundsLdu.max[1]]) {
      for (const z of [definition.boundsLdu.min[2], definition.boundsLdu.max[2]]) {
        points.push(transformLduPoint(part.transform, [x, y, z]));
      }
    }
  }
  return {
    min: [
      Math.min(...points.map(([x]) => x)),
      Math.min(...points.map(([, y]) => y)),
      Math.min(...points.map(([, , z]) => z)),
    ],
    max: [
      Math.max(...points.map(([x]) => x)),
      Math.max(...points.map(([, y]) => y)),
      Math.max(...points.map(([, , z]) => z)),
    ],
  };
}

function scopeFor(
  base: BrickDocumentV1,
  final: BrickDocumentV1,
  operations: readonly BuildOperation[],
  evidenceDigest: `sha256:${string}`,
): ScopeCapabilityV1 {
  const bounds = final.parts.map(partWorldBounds);
  const minLdu: LduVector3 = [
    Math.min(...bounds.map(({ min }) => min[0])),
    Math.min(...bounds.map(({ min }) => min[1])),
    Math.min(...bounds.map(({ min }) => min[2])),
  ];
  const maxLdu: LduVector3 = [
    Math.max(...bounds.map(({ max }) => max[0])),
    Math.max(...bounds.map(({ max }) => max[1])),
    Math.max(...bounds.map(({ max }) => max[2])),
  ];
  return normalizeScopeCapability({
    schemaVersion: "lego.scope-capability/1",
    capabilityId: `prefix50-final-scope-${canonicalSha256({ evidenceDigest, minLdu, maxLdu }).slice(0, 24)}`,
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu, maxLdu },
    allowedCatalogPartIds: [...new Set(final.parts.map(({ catalogPartId }) => catalogPartId))],
    allowedColorIds: [...new Set(final.parts.map(({ colorId }) => colorId))],
    budgets: {
      maxAddedParts: PART_COUNT,
      maxRemovedParts: 0,
      maxOperations: operations.length,
    },
  });
}

function canonicalModuloRevision(document: BrickDocumentV1, revision: string): string {
  return canonicalBrickDocument({ ...document, revision });
}

export function compileRealBuildPrefix50FinalCandidate(
  unsafeInput: unknown,
): RealBuildPrefix50FinalCandidateResult {
  const input = snapshotRealBuildPrefix50FinalCandidateInput(unsafeInput);
  const base = input.emptyRootSnapshot.document;
  const compilation = input.exactCompilation;
  const final = compilation.document;
  const selectedReturn = input.selectedSubBuildReturn;
  requireExactEmptyRoot(base);
  requireFinalShape(input);
  requireEvidence(input);
  requireSelectedReturnEvidence(input);
  requireCompleteHardValidity(final);
  const finalHash = documentStructuralHash(final);
  const exactCompilationCommitment = canonicalDigest(compilation);
  const evidenceDigest = canonicalDigest({
    exactCompilationCommitment,
    projectionCommitment: compilation.projectionCommitment,
    placementOrdinals: compilation.placementOrdinals,
    stateCommitments: compilation.stateCommitments,
    candidateStepCommitments: compilation.candidateStepCommitments,
    selectedSubBuildReturnCommitment: selectedReturn.commitment,
    selectedSubBuildReturnDocumentHash: selectedReturn.selectedDocumentHash,
    emptyRootDocumentHash: input.emptyRootSnapshot.documentHash,
    finalDocumentHash: finalHash,
  });
  const operations = operationsFor(base, final);
  const scope = scopeFor(base, final, operations, evidenceDigest);
  const candidateId = realBuildDocumentCandidateId(finalHash);
  const patch: AssemblyPatchV1 = deepFreeze({
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    truthSnapshotHash: canonicalDigest(base.truth),
    scopeCapabilityId: scope.capabilityId,
    scopeDigest: canonicalDigest(scope),
    operations,
    provenance: {
      jobId: `prefix50-final-job-${canonicalSha256(evidenceDigest).slice(0, 24)}`,
      candidateId,
      compilerSnapshotHash: REAL_BUILD_PREFIX50_FINAL_CANDIDATE_SNAPSHOT_HASH,
      buildProgramHash: evidenceDigest,
    },
  });
  const verified = verifyAssemblyPatchAgainstCapability(base, patch, scope);
  if (!verified.ok) {
    const first = verified.issues[0];
    throw new TypeError(
      `Prefix-50 final patch failed independent capability verification${first ? ` (${first.code} at ${first.path})` : ""}.`,
    );
  }
  if (
    documentStructuralHash(verified.document) !== finalHash ||
    canonicalModuloRevision(verified.document, final.revision) !== canonicalBrickDocument(final)
  ) {
    throw new TypeError(
      "Prefix-50 final patch replay must equal the complete candidate modulo derived revision and structural hash.",
    );
  }
  const receiptValue = {
    schemaVersion: "lego.real-build-prefix50-final-candidate-receipt/2" as const,
    userAcceptanceAuthority: false as const,
    compilerSnapshotHash: REAL_BUILD_PREFIX50_FINAL_CANDIDATE_SNAPSHOT_HASH,
    exactCompilationCommitment,
    projectionCommitment: compilation.projectionCommitment,
    placementOrdinalRosterCommitment: canonicalDigest(compilation.placementOrdinals),
    stateCommitmentsCommitment: canonicalDigest(compilation.stateCommitments),
    candidateStepCommitmentsCommitment: canonicalDigest(compilation.candidateStepCommitments),
    finalStepRosterCommitment: canonicalDigest(
      final.steps.map(({ id, index, name }) => ({ id, index, name })),
    ),
    selectedSubBuildReturnCommitment: selectedReturn.commitment,
    selectedSubBuildReturnDocumentHash: selectedReturn.selectedDocumentHash,
    selectedSubBuildReturnResultCommitment: selectedReturn.returnResultCommitment,
    reviewedVisualBindingCommitment: selectedReturn.reviewedVisualBinding.commitment,
    emptyRootDocumentHash: input.emptyRootSnapshot.documentHash,
    emptyRootCanonicalBytesHash: input.emptyRootSnapshot.canonicalBytesHash,
    finalDocumentHash: finalHash,
    finalCanonicalDocumentCommitment: canonicalDigest(final),
    verifiedCanonicalDocumentCommitment: canonicalDigest(verified.document),
    scopeDigest: canonicalDigest(scope),
    patchDigest: canonicalDigest(patch),
    truthDigest: canonicalDigest(base.truth),
    partCount: 320 as const,
    stepCount: 50 as const,
    zeroPieceStepNumber: 44 as const,
    connectionCount: final.connections.length,
    operationCount: operations.length,
  };
  const receipt: RealBuildPrefix50FinalCandidateReceipt = deepFreeze({
    ...receiptValue,
    commitment: canonicalDigest(receiptValue),
  });
  const result: RealBuildPrefix50FinalCandidateResult = deepFreeze({
    kind: "realBuildPrefix50FinalCandidate",
    status: "verified",
    userAcceptanceAuthority: false,
    scope,
    patch,
    document: verified.document,
    validationReport: verified.validationReport,
    receipt,
  });
  brandFinalCandidate(result);
  return result;
}
