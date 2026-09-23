import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { enumerateRigidSubassemblyReturns } from "../src/assembly/rigid-subassembly-return";
import { ownData } from "./real-build-prefix50-exact-compiler-foundation";
import { realBuildPrefix50SubBuildReturnBrands } from "./real-build-prefix50-subbuild-return-brands";
import {
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  RealBuildPrefix50SubBuildReturnError,
  type RealBuildPrefix50SubBuildReturnInput,
  type RealBuildPrefix50SubBuildReturnResult,
  type RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract";
import { constructRealBuildPrefix50ReviewExportMaterials } from "./real-build-prefix50-subbuild-return-review-materials";
import {
  realBuildPrefix50SubBuildReturnCandidateRoster,
  requireCompleteRealBuildPrefix50SubBuildReturnEnumeration,
} from "./real-build-prefix50-subbuild-return-validation";
import { requireRealBuildPrefix50Step43ReturnPredecessor } from "./real-build-prefix50-subbuild-return-predecessor";
import { requireRealBuildPrefix50ExactKeys } from "./real-build-prefix50-subbuild-return-validation-primitives";

type Enumerator = typeof enumerateRigidSubassemblyReturns;

export const {
  brandRealBuildPrefix50ReviewedVisualBinding,
  brandRealBuildPrefix50SelectedSubBuildReturn,
  brandRealBuildPrefix50SubBuildReturnResult,
  brandRealBuildPrefix50SyntheticReviewResult,
  requireRealBuildPrefix50ReviewedVisualBinding,
  requireRealBuildPrefix50SelectedSubBuildReturn,
  requireRealBuildPrefix50SubBuildReturnResult,
  requireRealBuildPrefix50SubBuildReturnReviewResult,
} = realBuildPrefix50SubBuildReturnBrands;

export function constructRealBuildPrefix50SubBuildReturn(
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
      "Exact step-43 child return enumeration found no hard-valid parent bridge; inspect the complete authority-free receipt on this error's receipt.",
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
): RealBuildPrefix50SubBuildReturnResult {
  return constructRealBuildPrefix50SubBuildReturn(
    input,
    enumerateRigidSubassemblyReturns,
    brandRealBuildPrefix50SubBuildReturnResult,
  );
}

export function createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(
  resultValue: unknown,
): RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  if (arguments.length !== 1)
    throw new TypeError(
      "Prefix-50 Step 44 complete review-batch construction accepts only one runtime-branded return receipt.",
    );
  return constructRealBuildPrefix50ReviewExportMaterials(
    requireRealBuildPrefix50SubBuildReturnReviewResult(resultValue),
  ).reviewBatch;
}
