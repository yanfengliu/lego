import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

import { enumerateRigidSubassemblyReturns } from "../src/assembly/rigid-subassembly-return";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { ownData } from "./real-build-prefix50-exact-compiler-foundation";
import { realBuildPrefix50SubBuildReturnBrands } from "./real-build-prefix50-subbuild-return-brands";
import {
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  RealBuildPrefix50SubBuildReturnError,
  type RealBuildPrefix50ReviewedVisualBinding,
  type RealBuildPrefix50SelectedSubBuildReturn,
  type RealBuildPrefix50SubBuildReturnInput,
  type RealBuildPrefix50SubBuildReturnResult,
  type RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract";
import {
  realBuildPrefix50SubBuildReturnCandidateRoster,
  requireCompleteRealBuildPrefix50SubBuildReturnEnumeration,
} from "./real-build-prefix50-subbuild-return-validation";
import { deriveRepositoryReviewedRealBuildPrefix50ReturnBinding } from "./real-build-prefix50-subbuild-return-review";
import { REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE } from "./real-build-prefix50-subbuild-return-review-fixture";
import {
  constructRealBuildPrefix50ReviewExportMaterials,
  constructRealBuildPrefix50ReviewHarnessEnvelope,
  constructRealBuildPrefix50ReviewRosterMaterials,
} from "./real-build-prefix50-subbuild-return-review-materials";
import { realBuildPrefix50ReviewedVisualBindingCommitment } from "./real-build-prefix50-subbuild-return-review-commitments";
import {
  createRealBuildPrefix50Step44PersistedBlindPromotion,
  reopenRealBuildPrefix50Step44PersistedBlindPromotion,
  requireRealBuildPrefix50Step44PersistedPromotion,
  type RealBuildPrefix50Step44BlindPromotionInput as BlindPromotionInput,
  type RealBuildPrefix50Step44BlindPromotionReceipt,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion.ts";
import type { RealBuildPrefix50Step44PersistedBlindPromotion } from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import {
  requireRealBuildPrefix50OfflineFinalizedPromotion,
  type RealBuildPrefix50OfflineFinalizedPromotionSelection,
} from "./real-build-prefix50-offline-finalized-promotion-selector.ts";
import { requireRealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { requireRealBuildPrefix50Step43ReturnPredecessor } from "./real-build-prefix50-subbuild-return-predecessor";
import {
  createRealBuildPrefix50SubBuildReturnTestHooks,
  type RealBuildPrefix50SubBuildReturnTestHooks,
} from "./real-build-prefix50-subbuild-return-test-hooks";
import { requireRealBuildPrefix50ExactKeys } from "./real-build-prefix50-subbuild-return-validation-primitives";

export * from "./real-build-prefix50-subbuild-return-contract";

const {
  brandRealBuildPrefix50ReviewedVisualBinding,
  brandRealBuildPrefix50SelectedSubBuildReturn,
  brandRealBuildPrefix50SubBuildReturnResult,
  brandRealBuildPrefix50SyntheticReviewResult,
  requireRealBuildPrefix50ReviewedVisualBinding,
  requireRealBuildPrefix50SelectedSubBuildReturn,
  requireRealBuildPrefix50SubBuildReturnResult,
  requireRealBuildPrefix50SubBuildReturnReviewResult,
} = realBuildPrefix50SubBuildReturnBrands;

type Enumerator = typeof enumerateRigidSubassemblyReturns;
function construct(
  unsafeInput: RealBuildPrefix50SubBuildReturnInput,
  enumerate: Enumerator,
  brand: (result: RealBuildPrefix50SubBuildReturnResult) => void,
): RealBuildPrefix50SubBuildReturnResult {
  requireRealBuildPrefix50ExactKeys(unsafeInput, ["predecessor"], "Prefix-50 return input");
  const predecessor = requireRealBuildPrefix50Step43ReturnPredecessor(
    ownData(unsafeInput, "predecessor", "Prefix-50 return input"),
  );
  const { combinedDraft: draft, ordinalPartRows: rows } = predecessor;
  const childPartIds = rows.map(({ partId }) => partId);
  const enumeration = enumerate({
    document: draft.document,
    childPartIds,
    workLimits: REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  });
  requireCompleteRealBuildPrefix50SubBuildReturnEnumeration(
    enumeration,
    predecessor.sourceDocumentHash,
    childPartIds,
  );
  const roster = realBuildPrefix50SubBuildReturnCandidateRoster(enumeration);
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    completedPrintedStep: 43 as const,
    returnPrintedStepNumber: 44 as const,
    projectionCommitment: predecessor.projectionCommitment,
    childSubBuildWindowCommitment: predecessor.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: predecessor.sourceMemberRowsCommitment,
    detachedStateCommitment: predecessor.detachedStateCommitment,
    step42_43RepairCommitment: predecessor.step42_43RepairCommitment,
    step43PredecessorCommitment: predecessor.predecessorCommitment,
    sourceDocumentHash: predecessor.sourceDocumentHash,
    parentPartCount: 257 as const,
    childPartCount: 23 as const,
    workLimits: REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
    enumeration,
    candidateRoster: roster,
    candidateRosterCommitment: canonicalDigest(roster),
  };
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  brand(result);
  if (roster.length === 0)
    throw new RealBuildPrefix50SubBuildReturnError(
      "NO_HARD_VALID_RETURN",
      "Exact step-43 child return enumeration found no hard-valid parent bridge; inspect the complete authority-free receipt on this error.",
      result,
    );
  if (roster.length !== 1)
    throw new RealBuildPrefix50SubBuildReturnError(
      "AMBIGUOUS_RETURN_REQUIRES_VISUAL_BINDING",
      `Exact step-43 child return enumeration found ${roster.length} hard-valid poses; no pose is selected. Stable candidate keys, deltas, and cross ports are retained on this error's receipt.`,
      result,
    );
  return result;
}

export function enumerateRealBuildPrefix50SubBuildReturn(
  input: RealBuildPrefix50SubBuildReturnInput,
) {
  return construct(
    input,
    enumerateRigidSubassemblyReturns,
    brandRealBuildPrefix50SubBuildReturnResult,
  );
}

function repositoryReviewedCandidateKey(): string {
  const fixture = REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE;
  if (fixture.reviewStatus !== "reviewed")
    throw new TypeError(
      `Prefix-50 Step 44 repository review remains unreviewed: ${fixture.reason}`,
    );
  return fixture.candidateKey;
}

export function createRealBuildPrefix50SubBuildReturnReviewHarnessEnvelope(resultValue: unknown) {
  if (arguments.length !== 1) {
    throw new TypeError(
      "Prefix-50 Step 44 review-envelope construction accepts only one runtime-branded return receipt.",
    );
  }
  const result = requireRealBuildPrefix50SubBuildReturnResult(resultValue);
  return constructRealBuildPrefix50ReviewHarnessEnvelope(result, repositoryReviewedCandidateKey());
}

function constructReviewBatchEnvelope(
  result: RealBuildPrefix50SubBuildReturnResult,
): RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  return constructRealBuildPrefix50ReviewExportMaterials(result).reviewBatch;
}

/** Internal production bridge for the deterministic Step-44 artifact exporter. */
export function createRealBuildPrefix50SubBuildReturnReviewExportMaterials(resultValue: unknown) {
  if (arguments.length !== 1)
    throw new TypeError(
      "Prefix-50 Step 44 review-export construction accepts only one runtime-branded return receipt.",
    );
  return constructRealBuildPrefix50ReviewExportMaterials(
    requireRealBuildPrefix50SubBuildReturnResult(resultValue),
  );
}

export function createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(resultValue: unknown) {
  if (arguments.length !== 1)
    throw new TypeError(
      "Prefix-50 Step 44 complete review-batch construction accepts only one runtime-branded return receipt.",
    );
  return constructReviewBatchEnvelope(
    requireRealBuildPrefix50SubBuildReturnReviewResult(resultValue),
  );
}

export function createRealBuildPrefix50SubBuildReturnReviewRosterSummary(resultValue: unknown) {
  if (arguments.length !== 1)
    throw new TypeError(
      "Prefix-50 Step 44 roster-summary construction accepts only one runtime-branded return receipt.",
    );
  return constructRealBuildPrefix50ReviewRosterMaterials(
    requireRealBuildPrefix50SubBuildReturnReviewResult(resultValue),
  ).rosterSummary;
}

function selectWithReviewedBinding(
  resultValue: unknown,
  bindingValue: unknown,
  persistedPromotion?: RealBuildPrefix50Step44PersistedBlindPromotion,
  offlinePromotion?: RealBuildPrefix50OfflineFinalizedPromotionSelection,
): RealBuildPrefix50SelectedSubBuildReturn {
  const result = requireRealBuildPrefix50SubBuildReturnResult(resultValue);
  const binding = requireRealBuildPrefix50ReviewedVisualBinding(bindingValue);
  const descriptor = result.candidateRoster.find(
    ({ candidateKey }) => candidateKey === binding.candidateKey,
  );
  const candidate = result.enumeration.candidates.find(
    ({ candidateKey }) => candidateKey === binding.candidateKey,
  );
  if (persistedPromotion !== undefined && offlinePromotion !== undefined)
    throw new TypeError("Step-44 selection accepts exactly one persisted promotion authority.");
  if (persistedPromotion !== undefined)
    requireRealBuildPrefix50Step44PersistedPromotion(persistedPromotion);
  if (offlinePromotion !== undefined)
    requireRealBuildPrefix50OfflineFinalizedPromotion(offlinePromotion, result);
  const selectedDocument =
    offlinePromotion?.selectedDocument ??
    persistedPromotion?.selectedDocument ??
    candidate?.hardValidDocument;
  if (
    binding.schemaVersion !== "lego.real-build-prefix50-reviewed-return-visual-binding/4" ||
    binding.sourceSetId !== "6651557" ||
    binding.allSixCriteriaSame !== true ||
    binding.returnResultCommitment !== result.commitment ||
    binding.candidateRosterCommitment !== result.candidateRosterCommitment ||
    binding.projectionCommitment !== result.projectionCommitment ||
    binding.childSubBuildWindowCommitment !== result.childSubBuildWindowCommitment ||
    binding.sourceMemberRowsCommitment !== result.sourceMemberRowsCommitment ||
    binding.detachedStateCommitment !== result.detachedStateCommitment ||
    binding.step42_43RepairCommitment !== result.step42_43RepairCommitment ||
    binding.step43PredecessorCommitment !== result.step43PredecessorCommitment ||
    binding.sourceDocumentHash !== result.sourceDocumentHash ||
    descriptor === undefined ||
    candidate === undefined ||
    selectedDocument === undefined ||
    binding.selectedDocumentHash !== documentStructuralHash(candidate.hardValidDocument) ||
    binding.selectedDocumentCommitment !== canonicalDigest(candidate.hardValidDocument) ||
    binding.selectedDocumentHash !== documentStructuralHash(selectedDocument) ||
    binding.selectedDocumentCommitment !== canonicalDigest(selectedDocument) ||
    (persistedPromotion !== undefined &&
      (persistedPromotion.receipt.commitment !== binding.repositoryReviewCommitment ||
        persistedPromotion.selectedEnvelope.commitment !==
          binding.reviewHarnessEnvelopeCommitment ||
        canonicalStringify(persistedPromotion.selectedEnvelope.selectedDocument) !==
          canonicalStringify(selectedDocument))) ||
    (offlinePromotion !== undefined &&
      (offlinePromotion.promotionReceipt.commitment !== binding.repositoryReviewCommitment ||
        offlinePromotion.selectedEnvelope.commitment !== binding.reviewHarnessEnvelopeCommitment ||
        canonicalStringify(offlinePromotion.selectedEnvelope.selectedDocument) !==
          canonicalStringify(selectedDocument))) ||
    binding.commitment !== realBuildPrefix50ReviewedVisualBindingCommitment(binding)
  )
    throw new TypeError(
      "Reviewed visual binding does not match this exact candidate roster and return receipt.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    returnResultCommitment: result.commitment,
    reviewedVisualBinding: binding,
    candidateKey: candidate.candidateKey,
    groupDelta: candidate.groupDelta,
    crossPorts: descriptor.crossPorts,
    selectedDocumentHash: documentStructuralHash(selectedDocument),
    selectedDocument,
  };
  const selected = deepFreeze({
    ...body,
    commitment: canonicalDigest({
      schemaVersion: body.schemaVersion,
      authority: body.authority,
      sourceSetId: body.sourceSetId,
      returnResultCommitment: body.returnResultCommitment,
      reviewedVisualBindingCommitment: body.reviewedVisualBinding.commitment,
      candidateKey: body.candidateKey,
      groupDelta: body.groupDelta,
      crossPorts: body.crossPorts,
      selectedDocumentHash: body.selectedDocumentHash,
    }),
  });
  brandRealBuildPrefix50SelectedSubBuildReturn(selected);
  return selected;
}

function bindingFromBlindPromotion(
  result: RealBuildPrefix50SubBuildReturnResult,
  receipt: RealBuildPrefix50Step44BlindPromotionReceipt,
): RealBuildPrefix50ReviewedVisualBinding {
  if (
    receipt.returnResultCommitment !== result.commitment ||
    receipt.candidateRosterCommitment !== result.candidateRosterCommitment ||
    receipt.allSixCriteriaSame !== true
  )
    throw new TypeError("Step-44 promotion receipt drifted from the runtime return result.");
  const body = {
    schemaVersion: "lego.real-build-prefix50-reviewed-return-visual-binding/4" as const,
    sourceSetId: "6651557" as const,
    repositoryReviewCommitment: receipt.commitment,
    artifactVerificationCommitment: receipt.publicPixelVerificationCommitment,
    reviewHarnessEnvelopeCommitment: receipt.reviewHarnessEnvelopeCommitment,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    projectionCommitment: result.projectionCommitment,
    childSubBuildWindowCommitment: result.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: result.sourceMemberRowsCommitment,
    detachedStateCommitment: result.detachedStateCommitment,
    step42_43RepairCommitment: result.step42_43RepairCommitment,
    step43PredecessorCommitment: result.step43PredecessorCommitment,
    sourceDocumentHash: result.sourceDocumentHash,
    candidateKey: receipt.candidateKey,
    selectedDocumentHash: receipt.selectedDocumentHash,
    selectedDocumentCommitment: receipt.selectedDocumentCommitment,
    blindReviewPacketCommitment: receipt.blindReviewPacketCommitment,
    publicHarnessSuccessCommitment: receipt.publicHarnessSuccessCommitment,
    laneCommitments: receipt.laneCommitments,
    fullResolutionOutcomeCommitment: receipt.fullResolutionOutcomeCommitment,
    blindReviewClosureCommitment: receipt.blindReviewClosureCommitment,
    publicPixelVerificationCommitment: receipt.publicPixelVerificationCommitment,
    withheldUnblindingMapCommitment: receipt.withheldUnblindingMapCommitment,
    selectedMapRowCommitment: receipt.selectedMapRowCommitment,
    reviewBatchEnvelopeCommitment: receipt.reviewBatchEnvelopeCommitment,
    allSixCriteriaSame: true as const,
  };
  return deepFreeze({
    ...body,
    commitment: realBuildPrefix50ReviewedVisualBindingCommitment(body),
  });
}

export type RealBuildPrefix50BlindReviewedSelectionInput = Omit<
  BlindPromotionInput,
  "capability" | "rawInputRoot" | "result"
> & {
  readonly result: unknown;
  readonly rawInputRoot?: BlindPromotionInput["rawInputRoot"];
  readonly capability?: BlindPromotionInput["capability"];
};

function selectPersistedBlindPromotion(
  result: RealBuildPrefix50SubBuildReturnResult,
  persisted: RealBuildPrefix50Step44PersistedBlindPromotion,
): RealBuildPrefix50SelectedSubBuildReturn {
  requireRealBuildPrefix50Step44PersistedPromotion(persisted);
  const binding = bindingFromBlindPromotion(result, persisted.receipt);
  brandRealBuildPrefix50ReviewedVisualBinding(binding);
  return selectWithReviewedBinding(result, binding, persisted);
}

export function selectOfflineFinalizedRealBuildPrefix50SubBuildReturn(
  resultValue: unknown,
  selectionValue: unknown,
): RealBuildPrefix50SelectedSubBuildReturn {
  if (arguments.length !== 2)
    throw new TypeError(
      "Step-44 offline selection requires one runtime return result and its exact finalized-promotion read.",
    );
  const result = requireRealBuildPrefix50SubBuildReturnResult(resultValue);
  const selection = requireRealBuildPrefix50OfflineFinalizedPromotion(selectionValue, result);
  const binding = bindingFromBlindPromotion(result, selection.promotionReceipt);
  brandRealBuildPrefix50ReviewedVisualBinding(binding);
  return selectWithReviewedBinding(result, binding, undefined, selection);
}

export function selectBlindReviewedRealBuildPrefix50SubBuildReturn(
  input: RealBuildPrefix50BlindReviewedSelectionInput,
): Promise<RealBuildPrefix50SelectedSubBuildReturn> {
  const result = requireRealBuildPrefix50SubBuildReturnResult(input.result);
  if (input.rawInputRoot === undefined || input.capability === undefined)
    throw new TypeError(
      "Step-44 direct selection is closed; publication requires the exact source-locked finalizer capability and raw reviewer-input tree.",
    );
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (realDomainQualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 direct selection requires the exact real-domain qualification for its review batch.",
    );
  return createRealBuildPrefix50Step44PersistedBlindPromotion({
    layout: input.layout,
    withheldRoot: input.withheldRoot,
    rawInputRoot: input.rawInputRoot,
    repositoryRoot: input.repositoryRoot,
    batch,
    capability: input.capability,
    realDomainQualification,
    result,
  }).then((persisted) => selectPersistedBlindPromotion(result, persisted));
}

/** Selects only from an already-persisted promotion; this route performs no artifact writes. */
export function selectPersistedBlindReviewedRealBuildPrefix50SubBuildReturn(
  input: RealBuildPrefix50BlindReviewedSelectionInput,
): Promise<RealBuildPrefix50SelectedSubBuildReturn> {
  const result = requireRealBuildPrefix50SubBuildReturnResult(input.result);
  if (input.rawInputRoot === undefined || input.capability === undefined)
    throw new TypeError(
      "Step-44 direct persisted selection is closed; reopen requires the exact source-locked finalizer capability and raw reviewer-input tree.",
    );
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (realDomainQualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 persisted selection requires the exact real-domain qualification for its review batch.",
    );
  return reopenRealBuildPrefix50Step44PersistedBlindPromotion({
    layout: input.layout,
    withheldRoot: input.withheldRoot,
    rawInputRoot: input.rawInputRoot,
    repositoryRoot: input.repositoryRoot,
    batch,
    capability: input.capability,
    realDomainQualification,
    result,
  }).then((persisted) => selectPersistedBlindPromotion(result, persisted));
}

export function selectRepositoryReviewedRealBuildPrefix50SubBuildReturn(
  resultValue: unknown,
): RealBuildPrefix50SelectedSubBuildReturn {
  if (arguments.length !== 1) {
    throw new TypeError(
      "Prefix-50 Step 44 selection does not accept caller-provided visual evidence; the reviewed binding is repository-owned.",
    );
  }
  const result = requireRealBuildPrefix50SubBuildReturnResult(resultValue);
  const envelope = constructRealBuildPrefix50ReviewHarnessEnvelope(
    result,
    repositoryReviewedCandidateKey(),
  );
  const binding = deriveRepositoryReviewedRealBuildPrefix50ReturnBinding(result, envelope);
  brandRealBuildPrefix50ReviewedVisualBinding(binding);
  return selectWithReviewedBinding(result, binding);
}

export {
  requireRealBuildPrefix50SelectedSubBuildReturn,
  requireRealBuildPrefix50SubBuildReturnResult,
};

export const __testOnly: Readonly<Partial<RealBuildPrefix50SubBuildReturnTestHooks>> =
  typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? createRealBuildPrefix50SubBuildReturnTestHooks(
        (input, enumerate) =>
          construct(input, enumerate, brandRealBuildPrefix50SyntheticReviewResult),
        brandRealBuildPrefix50SyntheticReviewResult,
        (value, candidateKey) =>
          constructRealBuildPrefix50ReviewHarnessEnvelope(
            requireRealBuildPrefix50SubBuildReturnReviewResult(value),
            candidateKey,
          ),
        (value) =>
          constructRealBuildPrefix50ReviewExportMaterials(
            requireRealBuildPrefix50SubBuildReturnReviewResult(value),
          ),
      )
    : intrinsicRealBuildFreeze({});
