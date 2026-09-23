import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import {
  compileRealBuildPrefix50ZeroPieceStepCandidate,
  isRealBuildPrefix50ZeroPieceStepCandidate,
} from "./real-build-automatic-placement-candidate";
import { compileRealBuildPrefix50CandidateStep } from "./real-build-prefix50-exact-candidate-step";
import {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50Step44SelectionEvidence,
  type RealBuildPrefix50Step45RelationalCompilationEvidence,
  type RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import { sameTransform } from "./real-build-prefix50-exact-compiler-foundation";
import {
  requireUniqueExactPlacementRepairEdge,
  snapshot,
} from "./real-build-prefix50-exact-compiler-operations";
import type { RealBuildPrefix50ProjectionStep } from "./real-build-prefix50-projection";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";
import type { RealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-contract";
import { requireRealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-runtime";
import { requireRealBuildPrefix50Step44SelectionEvidence } from "./real-build-prefix50-exact-loop-step44";
import { requireExactDataKeys } from "./real-build-prefix50-step45-relational-accounting";
import {
  requireRealBuildPrefix50Step45RelationalResolution,
  resolveRealBuildPrefix50Step45RelationalPlacements,
  type RealBuildPrefix50Step45OrdinalPartRow,
  type RealBuildPrefix50Step45RelationalResolution,
} from "./real-build-prefix50-step45-relational-resolver";

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";

interface Step45SelectionIdentity {
  readonly schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1";
  readonly authority: "none";
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedSubBuildReturnCommitment: `sha256:${string}`;
  readonly reviewedVisualBindingCommitment: `sha256:${string}`;
  readonly selectedDocument: BrickDocumentV1;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
}

interface Step45ResolvedTransitionInput {
  readonly document: BrickDocumentV1;
  readonly printedStep: RealBuildPrefix50ProjectionStep;
  readonly targets: readonly RealBuildPrefix50TargetOccurrence[];
  readonly selection: Step45SelectionIdentity;
  readonly selectionEvidence: RealBuildPrefix50Step44SelectionEvidence;
  readonly resolution: RealBuildPrefix50Step45RelationalResolution;
  readonly routingAccounting: {
    readonly relationalResolverCallCount: number;
    readonly genericSearchCallCount: number;
  };
  readonly budget: RealBuildPrefix50SearchBudget;
}

export interface RealBuildPrefix50Step45RelationalTransition {
  readonly document: BrickDocumentV1;
  readonly assignments: readonly (readonly [occurrenceOrdinal: number, partId: string])[];
  readonly operations: ReturnType<
    typeof compileRealBuildPrefix50CandidateStep
  >["candidate"]["operations"];
  readonly candidateStepCommitment: `sha256:${string}`;
  readonly evidence: RealBuildPrefix50Step45RelationalCompilationEvidence;
}

function exactStep44DocumentBinding(
  selection: Step45SelectionIdentity,
  selectionEvidence: RealBuildPrefix50Step44SelectionEvidence,
  step44Document: BrickDocumentV1,
): `sha256:${string}` {
  const candidate = compileRealBuildPrefix50ZeroPieceStepCandidate({
    documentSnapshot: snapshot(selection.selectedDocument),
    printedStepNumber: 44,
    printedStep: selectionEvidence.step44PrintedStep,
  });
  if (
    !isRealBuildPrefix50ZeroPieceStepCandidate(candidate) ||
    selection.selectedDocument.steps.length !== 43 ||
    documentStructuralHash(candidate.document) !== documentStructuralHash(step44Document) ||
    canonicalDigest(candidate.document) !== canonicalDigest(step44Document)
  ) {
    throw new TypeError(
      "Step-45 relational compilation requires the branded selected document plus exactly one deterministic empty Step-44 transition.",
    );
  }
  return candidate.lineage.programHash;
}

function requireSelectionIdentity(
  selectedValue: RealBuildPrefix50SelectedSubBuildReturn,
  evidenceValue: RealBuildPrefix50Step44SelectionEvidence,
): Step45SelectionIdentity {
  const selected = requireRealBuildPrefix50SelectedSubBuildReturn(selectedValue);
  const evidence = requireRealBuildPrefix50Step44SelectionEvidence(evidenceValue);
  const selectedDocumentHash = documentStructuralHash(selected.selectedDocument);
  const selectedDocumentCommitment = canonicalDigest(selected.selectedDocument);
  const { commitment, ...evidenceBody } = evidence;
  requireExactDataKeys(
    evidence.step44PrintedStep,
    ["name", "printedStepNumber", "sourceActionDigest"],
    "Step-44 branded printed-step metadata",
  );
  if (
    selected.schemaVersion !== "lego.real-build-prefix50-selected-subbuild-return/1" ||
    selected.authority !== "none" ||
    evidence.schemaVersion !== "lego.real-build-prefix50-step44-selection-evidence/2" ||
    evidence.authority !== "none" ||
    evidence.printedStepNumber !== 44 ||
    evidence.step44PrintedStep.printedStepNumber !== 44 ||
    evidence.step44PrintedStepCommitment !== canonicalDigest(evidence.step44PrintedStep) ||
    commitment !== canonicalDigest(evidenceBody) ||
    evidence.returnResultCommitment !== selected.returnResultCommitment ||
    evidence.returnResultCommitment !== selected.reviewedVisualBinding.returnResultCommitment ||
    evidence.candidateRosterCommitment !==
      selected.reviewedVisualBinding.candidateRosterCommitment ||
    evidence.candidateKey !== selected.candidateKey ||
    evidence.candidateKey !== selected.reviewedVisualBinding.candidateKey ||
    evidence.selectedDocumentHash !== selected.selectedDocumentHash ||
    evidence.selectedDocumentHash !== selected.reviewedVisualBinding.selectedDocumentHash ||
    evidence.selectedDocumentHash !== selectedDocumentHash ||
    evidence.selectedDocumentCommitment !==
      selected.reviewedVisualBinding.selectedDocumentCommitment ||
    evidence.selectedDocumentCommitment !== selectedDocumentCommitment ||
    evidence.reviewedVisualBindingCommitment !== selected.reviewedVisualBinding.commitment ||
    evidence.selectedSubBuildReturnCommitment !== selected.commitment
  ) {
    throw new TypeError(
      "Step-45 relational compilation requires every Step-44 evidence field to cross-bind the exact branded selected return.",
    );
  }
  return deepFreeze({
    schemaVersion: selected.schemaVersion,
    authority: selected.authority,
    returnResultCommitment: selected.returnResultCommitment,
    candidateRosterCommitment: evidence.candidateRosterCommitment,
    candidateKey: selected.candidateKey,
    selectedSubBuildReturnCommitment: selected.commitment,
    reviewedVisualBindingCommitment: selected.reviewedVisualBinding.commitment,
    selectedDocument: selected.selectedDocument,
    selectedDocumentHash,
    selectedDocumentCommitment,
  });
}

function compileResolvedTransition(
  input: Step45ResolvedTransitionInput,
): RealBuildPrefix50Step45RelationalTransition {
  const resolution = requireRealBuildPrefix50Step45RelationalResolution(input.resolution);
  const { commitment: selectionEvidenceCommitment, ...selectionEvidenceBody } =
    input.selectionEvidence;
  if (
    selectionEvidenceCommitment !== canonicalDigest(selectionEvidenceBody) ||
    resolution.selectedStep44EvidenceCommitment !==
      input.selection.reviewedVisualBindingCommitment ||
    resolution.selectedStep44DocumentHash !== documentStructuralHash(input.document) ||
    resolution.selectedStep44DocumentCommitment !== canonicalDigest(input.document) ||
    input.selectionEvidence.selectedSubBuildReturnCommitment !==
      input.selection.selectedSubBuildReturnCommitment ||
    input.selectionEvidence.reviewedVisualBindingCommitment !==
      input.selection.reviewedVisualBindingCommitment ||
    input.selectionEvidence.selectedDocumentHash !== input.selection.selectedDocumentHash ||
    input.targets.length !== 3 ||
    resolution.rows.length !== 3 ||
    input.routingAccounting.relationalResolverCallCount !== 1 ||
    input.routingAccounting.genericSearchCallCount !== 0
  ) {
    throw new TypeError(
      "Step-45 relational resolution drifted from the exact selected return, Step-44 state, or three-occurrence boundary.",
    );
  }
  const step44ZeroStepProgramHash = exactStep44DocumentBinding(
    input.selection,
    input.selectionEvidence,
    input.document,
  );
  const targets = new Map(input.targets.map((target) => [target.ordinal, target] as const));
  if (targets.size !== resolution.rows.length) {
    throw new TypeError("Step-45 relational compilation requires three distinct exact targets.");
  }
  const witnesses: RealBuildAutomaticPlacementWitness[] = resolution.rows.map((row) => {
    const target = targets.get(row.occurrenceOrdinal);
    if (
      target === undefined ||
      target.printedStepNumber !== 45 ||
      target.partIdentity.reconciledCatalogPartId !== "builtin:axle-1x3" ||
      !sameTransform(target.targetTransform, row.enumeratedTransform)
    ) {
      throw new TypeError(
        `Step-45 relational occurrence ${row.occurrenceOrdinal} does not equal its exact repaired compiler target.`,
      );
    }
    return deepFreeze({
      catalogPartId: target.partIdentity.reconciledCatalogPartId,
      colorId: target.colorId,
      transform: row.enumeratedTransform,
      connections: row.connections.map((connection) => ({
        target: { kind: "base" as const, partId: connection.targetPartId },
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
        connectionKind: connection.connectionKind,
      })),
    });
  });
  const enumerationBefore = input.budget.enumerations;
  const narrowedBefore = input.budget.orientationNarrowedEnumerations;
  const nodesBefore = input.budget.nodes;
  const enumerationDelta = input.routingAccounting.relationalResolverCallCount;
  const searchNodeDelta = resolution.rows.length;
  if (input.budget.nodes + searchNodeDelta > REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES) {
    throw new RangeError(
      `Step-45 relational compilation exceeded the cumulative ${REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES}-node budget.`,
    );
  }
  const compiled = compileRealBuildPrefix50CandidateStep({
    document: input.document,
    printedStepNumber: 45,
    printedStep: input.printedStep,
    targets: input.targets,
    placementOrdinals: resolution.rows.map(({ occurrenceOrdinal }) => occurrenceOrdinal),
    witnesses,
    mode: "ordinary",
    expectedBlockingCodes: [],
  });
  const assignmentIds = new Map(compiled.assignments);
  const receiverPairs = resolution.rows.map((row) => {
    const candidatePartId = assignmentIds.get(row.occurrenceOrdinal);
    if (candidatePartId === undefined) {
      throw new TypeError(
        `Step-45 relational occurrence ${row.occurrenceOrdinal} was not compiled.`,
      );
    }
    const edge = requireUniqueExactPlacementRepairEdge(
      compiled.document,
      row.occurrenceOrdinal,
      candidatePartId,
      row.receiverPartId,
      row.candidatePortId,
      row.receiverPortId,
    );
    return deepFreeze({
      occurrenceOrdinal: row.occurrenceOrdinal,
      receiverOrdinal: row.receiverOrdinal,
      candidatePartId,
      receiverPartId: row.receiverPartId,
      connectionId: edge.id,
      candidateCommitment: row.candidateCommitment,
    });
  });
  input.budget.enumerations += enumerationDelta;
  input.budget.nodes += searchNodeDelta;
  const accounting = deepFreeze({
    relationalResolverCallCount: input.routingAccounting.relationalResolverCallCount as 1,
    genericSearchCallCount: input.routingAccounting.genericSearchCallCount as 0,
    enumerationDelta: (input.budget.enumerations - enumerationBefore) as 1,
    orientationNarrowedEnumerationDelta: (input.budget.orientationNarrowedEnumerations -
      narrowedBefore) as 0,
    searchNodeDelta: (input.budget.nodes - nodesBefore) as 3,
  });
  if (
    accounting.enumerationDelta !== 1 ||
    accounting.orientationNarrowedEnumerationDelta !== 0 ||
    accounting.searchNodeDelta !== 3
  ) {
    throw new TypeError("Step-45 relational compiler accounting did not conserve its exact work.");
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step45-relational-compilation/1" as const,
    authority: "none" as const,
    printedStepNumber: 45 as const,
    selectedSubBuildReturnCommitment: input.selection.selectedSubBuildReturnCommitment,
    reviewedVisualBindingCommitment: input.selection.reviewedVisualBindingCommitment,
    step44SelectionEvidenceCommitment: input.selectionEvidence.commitment,
    step44ZeroStepProgramHash,
    resolution,
    accounting,
    receiverPairs,
    candidateStepCommitment: compiled.candidateCommitment,
    playbackOperationsCommitment: canonicalDigest(compiled.candidate.operations),
    resultDocumentHash: documentStructuralHash(compiled.document),
  });
  return deepFreeze({
    document: compiled.document,
    assignments: compiled.assignments,
    operations: compiled.candidate.operations,
    candidateStepCommitment: compiled.candidateCommitment,
    evidence: { ...body, commitment: canonicalDigest(body) },
  });
}

export function compileRealBuildPrefix50Step45RelationalTransition(input: {
  readonly document: BrickDocumentV1;
  readonly printedStep: RealBuildPrefix50ProjectionStep;
  readonly targets: readonly RealBuildPrefix50TargetOccurrence[];
  readonly ordinalPartRows: readonly RealBuildPrefix50Step45OrdinalPartRow[];
  readonly sourceRepairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[];
  readonly selectedReturn: RealBuildPrefix50SelectedSubBuildReturn;
  readonly selectionEvidence: RealBuildPrefix50Step44SelectionEvidence;
  readonly genericSearchCallCount: number;
  readonly budget: RealBuildPrefix50SearchBudget;
}): RealBuildPrefix50Step45RelationalTransition {
  requireExactDataKeys(
    input,
    [
      "budget",
      "document",
      "genericSearchCallCount",
      "ordinalPartRows",
      "printedStep",
      "selectedReturn",
      "selectionEvidence",
      "sourceRepairs",
      "targets",
    ],
    "Step-45 relational compilation input",
  );
  const selection = requireSelectionIdentity(input.selectedReturn, input.selectionEvidence);
  let relationalResolverCallCount = 0;
  relationalResolverCallCount += 1;
  const resolution = resolveRealBuildPrefix50Step45RelationalPlacements({
    selectedStep44Document: input.document,
    selectedStep44EvidenceCommitment: selection.reviewedVisualBindingCommitment,
    ordinalPartRows: input.ordinalPartRows,
    sourceRepairs: input.sourceRepairs,
  });
  return compileResolvedTransition({
    document: input.document,
    printedStep: input.printedStep,
    targets: input.targets,
    selection,
    selectionEvidence: input.selectionEvidence,
    resolution,
    routingAccounting: {
      relationalResolverCallCount,
      genericSearchCallCount: input.genericSearchCallCount,
    },
    budget: input.budget,
  });
}

export const __testOnly: Readonly<{
  compileResolvedTransition?: typeof compileResolvedTransition;
}> = deepFreeze(TEST_MODE ? { compileResolvedTransition } : {});
