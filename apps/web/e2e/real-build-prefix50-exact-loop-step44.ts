import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, BuildOperation } from "@lego-studio/protocol";

import type { RigidSubassemblyReturnEnumeration } from "../src/assembly/rigid-subassembly-return";
import type { RealBuildPrefix50Step44SelectionEvidence } from "./real-build-prefix50-exact-compiler-contract";
import { RealBuildPrefix50Step44ReviewRequiredError } from "./real-build-prefix50-exact-loop-contract";
import type {
  RealBuildPrefix50ChildSubBuildWindow,
  RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50DetachedSubBuildState } from "./real-build-prefix50-subbuild-state";
import {
  enumerateRealBuildPrefix50SubBuildReturn,
  requireRealBuildPrefix50SelectedSubBuildReturn,
} from "./real-build-prefix50-subbuild-return-runtime";
import {
  RealBuildPrefix50SubBuildReturnError,
  type RealBuildPrefix50SelectedSubBuildReturn,
  type RealBuildPrefix50SubBuildReturnResult,
} from "./real-build-prefix50-subbuild-return-contract";
import { mintRealBuildPrefix50Step43ReturnPredecessor } from "./real-build-prefix50-subbuild-return-predecessor";
import type { RealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair-contract";

const selectionEvidenceReceipts = new WeakSet<object>();
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

function brandRealBuildPrefix50Step44SelectionEvidence(
  evidence: RealBuildPrefix50Step44SelectionEvidence,
): void {
  SAFE_APPLY(SAFE_WEAK_SET_ADD, selectionEvidenceReceipts, [evidence]);
}

export function requireRealBuildPrefix50Step44SelectionEvidence(
  value: unknown,
): RealBuildPrefix50Step44SelectionEvidence {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_APPLY(SAFE_WEAK_SET_HAS, selectionEvidenceReceipts, [value])
  ) {
    throw new TypeError(
      "Step-45 relational compilation requires the exact runtime-branded Step-44 selection evidence; caller lookalikes and clones carry no lineage authority.",
    );
  }
  return value as RealBuildPrefix50Step44SelectionEvidence;
}

export interface RealBuildPrefix50Step44ReturnTransition {
  readonly document: BrickDocumentV1;
  readonly operations: readonly BuildOperation[];
  readonly enumeration: RigidSubassemblyReturnEnumeration;
  readonly selectedReturn: RealBuildPrefix50SelectedSubBuildReturn;
  readonly selectionEvidence: RealBuildPrefix50Step44SelectionEvidence;
}

function reviewRequired(
  result: RealBuildPrefix50SubBuildReturnResult,
  enumerationError: RealBuildPrefix50SubBuildReturnError | null,
): never {
  const summary = {
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    sourceDocumentHash: result.sourceDocumentHash,
    candidateRoster: result.candidateRoster,
    candidateDocumentHashes: result.enumeration.candidates.map(({ hardValidDocument }) =>
      documentStructuralHash(hardValidDocument),
    ),
  };
  throw new RealBuildPrefix50Step44ReviewRequiredError(
    `Prefix-50 exact compilation requires one runtime-branded persisted blind-reviewed Step-44 selected return; the disabled repository fixture and caller-decomposed fields carry no authority. Exact authority-free return receipt: ${JSON.stringify(summary)}.`,
    result,
    enumerationError,
  );
}

export function compileRealBuildPrefix50Step44ReturnTransition(input: {
  readonly sourceProjection: RealBuildPrefix50VerifiedProjection;
  readonly window: RealBuildPrefix50ChildSubBuildWindow;
  readonly document: BrickDocumentV1;
  readonly childPartIds: readonly string[];
  readonly detachedState: RealBuildPrefix50DetachedSubBuildState;
  readonly step42_43SourceRepairProof: RealBuildPrefix50Step42_43SourceRepairProof;
  readonly selectedReturn: RealBuildPrefix50SelectedSubBuildReturn | null;
}): RealBuildPrefix50Step44ReturnTransition {
  const predecessor = mintRealBuildPrefix50Step43ReturnPredecessor({
    projection: input.sourceProjection,
    window: input.window,
    combinedDraft: deepFreeze({
      schemaVersion: "lego.real-build-prefix50-step43-combined-draft/1" as const,
      authority: "none" as const,
      sourceSetId: "6651557" as const,
      completedPrintedStep: 43 as const,
      documentHash: documentStructuralHash(input.document),
      document: input.document,
    }),
    ordinalPartRows: input.window.sourceBuilderIdentityOrdinals.map((ordinal) => ({
      ordinal,
      partId: input.childPartIds[ordinal - input.window.firstOccurrenceOrdinal]!,
    })),
    detachedStateCommitment: input.detachedState.commitment,
    step42_43SourceRepairProof: input.step42_43SourceRepairProof,
  });
  let result: RealBuildPrefix50SubBuildReturnResult;
  let enumerationError: RealBuildPrefix50SubBuildReturnError | null = null;
  try {
    result = enumerateRealBuildPrefix50SubBuildReturn({ predecessor });
  } catch (error) {
    if (
      !(error instanceof RealBuildPrefix50SubBuildReturnError) ||
      error.code !== "AMBIGUOUS_RETURN_REQUIRES_VISUAL_BINDING"
    )
      throw error;
    enumerationError = error;
    result = error.result;
  }
  if (input.selectedReturn === null) reviewRequired(result, enumerationError);
  const selected = requireRealBuildPrefix50SelectedSubBuildReturn(input.selectedReturn);
  const candidates = result.enumeration.candidates.filter(
    ({ candidateKey }) => candidateKey === selected.candidateKey,
  );
  const descriptors = result.candidateRoster.filter(
    ({ candidateKey }) => candidateKey === selected.candidateKey,
  );
  const candidate = candidates[0];
  const descriptor = descriptors[0];
  const selectedDocumentCommitment = canonicalDigest(selected.selectedDocument);
  if (
    selected.returnResultCommitment !== result.commitment ||
    selected.reviewedVisualBinding.returnResultCommitment !== result.commitment ||
    selected.reviewedVisualBinding.candidateRosterCommitment !== result.candidateRosterCommitment ||
    selected.reviewedVisualBinding.candidateKey !== selected.candidateKey ||
    candidates.length !== 1 ||
    descriptors.length !== 1 ||
    candidate === undefined ||
    descriptor === undefined ||
    selected.selectedDocumentHash !== documentStructuralHash(selected.selectedDocument) ||
    selected.selectedDocumentHash !== documentStructuralHash(candidate.hardValidDocument) ||
    selectedDocumentCommitment !== canonicalDigest(candidate.hardValidDocument) ||
    selected.reviewedVisualBinding.selectedDocumentHash !== selected.selectedDocumentHash ||
    selected.reviewedVisualBinding.selectedDocumentCommitment !== selectedDocumentCommitment ||
    canonicalDigest(selected.groupDelta) !== canonicalDigest(candidate.groupDelta) ||
    canonicalDigest(selected.crossPorts) !== canonicalDigest(descriptor.crossPorts)
  ) {
    throw new TypeError(
      "Prefix-50 Step-44 selected return does not bind this exact live enumeration, candidate, reviewed visual evidence, and selected document.",
    );
  }
  const step44PrintedStep = input.sourceProjection.steps[43];
  if (step44PrintedStep?.printedStepNumber !== 44) {
    throw new TypeError(
      "Prefix-50 Step-44 selection evidence requires authoritative printed-step metadata from source projection index 43.",
    );
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step44-selection-evidence/2" as const,
    authority: "none" as const,
    printedStepNumber: 44 as const,
    step44PrintedStep,
    step44PrintedStepCommitment: canonicalDigest(step44PrintedStep),
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    selectedSubBuildReturnCommitment: selected.commitment,
    reviewedVisualBindingCommitment: selected.reviewedVisualBinding.commitment,
    candidateKey: selected.candidateKey,
    selectedDocumentHash: selected.selectedDocumentHash,
    selectedDocumentCommitment,
  });
  const selectionEvidence: RealBuildPrefix50Step44SelectionEvidence = deepFreeze({
    ...body,
    commitment: canonicalDigest(body),
  });
  brandRealBuildPrefix50Step44SelectionEvidence(selectionEvidence);
  return deepFreeze({
    document: selected.selectedDocument,
    operations: candidate.operations,
    enumeration: result.enumeration,
    selectedReturn: selected,
    selectionEvidence,
  });
}
