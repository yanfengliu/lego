import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindId,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  digestPromotionArtifactBytes,
  promotionBodyWithoutCommitment,
  readCanonicalPromotionArtifact,
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
  requireExactPromotionFiles,
  requireExactPromotionKeys,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifact-io.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT,
  isRealBuildPrefix50Step44ProductionPromotionAuthorityGuardName,
  reassertRealBuildPrefix50Step44ProductionPromotionAuthority,
  releaseRealBuildPrefix50Step44ProductionPromotionAuthority,
  type RealBuildPrefix50Step44ProductionPromotionAuthority,
  requireRealBuildPrefix50Step44ProductionPromotionAuthority,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-authority.ts";
import {
  preflightRealBuildPrefix50Step44ExactArtifact,
  preflightRealBuildPrefix50Step44ExactArtifacts,
  writeOrResumeRealBuildPrefix50Step44ExactArtifact,
  type RealBuildPrefix50Step44ExactArtifact,
} from "./real-build-prefix50-subbuild-return-review-source-locked-files.ts";
import {
  requireRealBuildPrefix50Step44SourceLockCapability,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";
import { isContainedAtomicWriteTemporaryName } from "./contained-atomic-write.ts";

export { REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT };
export {
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
};
const persistedPromotions = new WeakSet<object>();
const persistedReceipts = new WeakSet<object>();
const PROMOTION_FILES: readonly string[] = [
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
];

function withReleasedAuthority<T>(
  promotionRoot: string,
  authority: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
  action: () => T,
): T {
  let result: T | null = null;
  let failure: Error | null = null;
  try {
    result = action();
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  const release = releaseRealBuildPrefix50Step44ProductionPromotionAuthority(authority, capability);
  if (failure !== null && release !== null)
    throw new AggregateError(
      [failure, release],
      "Step-44 promotion failed and its live directory guard could not be released safely.",
    );
  if (failure !== null) throw failure;
  if (release !== null) throw release;
  requireExactPromotionFiles(promotionRoot, PROMOTION_FILES, "Step-44 persisted promotion output");
  return result as T;
}

export interface RealBuildPrefix50Step44BlindPromotionReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-return-promotion/3";
  readonly authority: "repository-reviewed-step44";
  readonly reviewStatus: "reviewed";
  readonly selectionAuthority: "blind-page45-closure";
  readonly fixturePromotionAuthority: true;
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf";
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly physicalPage45VerificationCommitment: `sha256:${string}`;
  readonly productionCaptureChainCommitment: `sha256:${string}`;
  readonly publicationCompleteCommitment: `sha256:${string}`;
  readonly finalizationSourceLockCommitment: `sha256:${string}`;
  readonly finalizationOperationInputsCommitment: `sha256:${string}`;
  readonly proceduralIndependenceStatement: typeof REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT;
  readonly selectedBlindId: RealBuildPrefix50Step44BlindId;
  readonly candidateKey: string;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly publicHarnessSuccessCommitment: `sha256:${string}`;
  readonly laneCommitments: readonly [`sha256:${string}`, `sha256:${string}`];
  readonly fullResolutionOutcomeCommitment: `sha256:${string}`;
  readonly blindReviewClosureCommitment: `sha256:${string}`;
  readonly publicPixelVerificationCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly selectedMapRowCommitment: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly candidateKeysCommitment: `sha256:${string}`;
  readonly returnCandidateCommitment: `sha256:${string}`;
  readonly rosterDescriptorCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly compactCandidateCommitment: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
  readonly sourceRowCommitment: `sha256:${string}`;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly selectedDocumentArtifactFile: typeof REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE;
  readonly selectedDocumentArtifactByteDigest: `sha256:${string}`;
  readonly selectedEnvelopeArtifactFile: typeof REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE;
  readonly selectedEnvelopeArtifactByteDigest: `sha256:${string}`;
  readonly selectedEnvelopeCommitment: `sha256:${string}`;
  readonly allSixCriteriaSame: true;
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44BlindPromotionReceiptBody = Omit<
  RealBuildPrefix50Step44BlindPromotionReceipt,
  | "commitment"
  | "selectedDocumentArtifactByteDigest"
  | "selectedDocumentArtifactFile"
  | "selectedEnvelopeArtifactByteDigest"
  | "selectedEnvelopeArtifactFile"
  | "selectedEnvelopeCommitment"
>;

export interface RealBuildPrefix50Step44PersistedBlindPromotion {
  readonly receipt: RealBuildPrefix50Step44BlindPromotionReceipt;
  readonly selectedDocument: BrickDocumentV1;
  readonly selectedEnvelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
}

function promotionArtifactsForAuthority(
  authority: RealBuildPrefix50Step44ProductionPromotionAuthority,
): Readonly<{
  selectedDocumentBytes: Buffer;
  selectedEnvelopeBytes: Buffer;
  receipt: RealBuildPrefix50Step44BlindPromotionReceipt;
}> {
  const selectedDocumentBytes = Buffer.from(canonicalStringify(authority.selectedDocument));
  const selectedEnvelopeBytes = Buffer.from(canonicalStringify(authority.selectedEnvelope));
  const body = {
    ...authority.receiptBody,
    selectedDocumentArtifactFile: REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
    selectedDocumentArtifactByteDigest: digestPromotionArtifactBytes(selectedDocumentBytes),
    selectedEnvelopeArtifactFile: REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
    selectedEnvelopeArtifactByteDigest: digestPromotionArtifactBytes(selectedEnvelopeBytes),
    selectedEnvelopeCommitment: authority.selectedEnvelope.commitment,
  };
  return {
    selectedDocumentBytes,
    selectedEnvelopeBytes,
    receipt: { ...body, commitment: canonicalDigest(body) },
  };
}

export async function writeRealBuildPrefix50Step44PromotionArtifacts(input: {
  readonly promotionRoot: string;
  readonly authority: RealBuildPrefix50Step44ProductionPromotionAuthority;
  readonly capability?: RealBuildPrefix50Step44SourceLockCapability;
  readonly __testHooks?: { readonly afterPayloadBeforeReceipt?: () => void };
}): Promise<RealBuildPrefix50Step44PersistedBlindPromotion> {
  const capability = input.capability;
  if (capability === undefined)
    throw new TypeError("Step-44 promotion artifact publication requires a live capability.");
  return withReleasedAuthority(input.promotionRoot, input.authority, capability, () => {
    requireRealBuildPrefix50Step44ProductionPromotionAuthority(input.authority, capability);
    const sourceLock = requireRealBuildPrefix50Step44SourceLockCapability(capability);
    if (
      input.authority.receiptBody.finalizationSourceLockCommitment !== sourceLock.commitment ||
      input.authority.receiptBody.finalizationOperationInputsCommitment !==
        sourceLock.operationInputsCommitment
    )
      throw new TypeError(
        "Step-44 promotion authority drifted from its live source-lock capability.",
      );
    reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
      input.authority,
      capability,
      input.promotionRoot,
    );
    if (basename(resolve(input.promotionRoot)) !== "promotion")
      throw new TypeError("Step-44 promotion artifacts require the exact promotion/ directory.");
    if (
      readdirSync(input.promotionRoot).some(
        (file) =>
          !PROMOTION_FILES.includes(file) &&
          !isContainedAtomicWriteTemporaryName(file, PROMOTION_FILES) &&
          !isRealBuildPrefix50Step44ProductionPromotionAuthorityGuardName(
            input.authority,
            capability,
            file,
          ),
      )
    )
      throw new TypeError(
        "Step-44 promotion output contains an artifact outside its exact resumable roster.",
      );
    const { receipt, selectedDocumentBytes, selectedEnvelopeBytes } =
      promotionArtifactsForAuthority(input.authority);
    const artifacts: readonly RealBuildPrefix50Step44ExactArtifact[] = [
      {
        root: input.promotionRoot,
        path: REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
        bytes: selectedDocumentBytes,
        label: "Step-44 selected document",
      },
      {
        root: input.promotionRoot,
        path: REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
        bytes: selectedEnvelopeBytes,
        label: "Step-44 selected envelope",
      },
      {
        root: input.promotionRoot,
        path: REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
        bytes: Buffer.from(canonicalStringify(receipt)),
        label: "Step-44 promotion authority receipt",
      },
    ];
    preflightRealBuildPrefix50Step44ExactArtifacts(artifacts);
    const receiptAlreadyExists = preflightRealBuildPrefix50Step44ExactArtifact(artifacts[2]!);
    if (
      receiptAlreadyExists &&
      artifacts
        .slice(0, 2)
        .some((artifact) => !preflightRealBuildPrefix50Step44ExactArtifact(artifact))
    )
      throw new TypeError(
        "Step-44 promotion authority receipt exists without its complete exact sibling payload.",
      );
    for (const artifact of artifacts.slice(0, 2)) {
      reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
        input.authority,
        capability,
        input.promotionRoot,
      );
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact, {
        beforePublish: () =>
          reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
            input.authority,
            capability,
            input.promotionRoot,
          ),
        afterPublish: () =>
          reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
            input.authority,
            capability,
            input.promotionRoot,
          ),
      });
    }
    input.__testHooks?.afterPayloadBeforeReceipt?.();
    reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
      input.authority,
      capability,
      input.promotionRoot,
    );
    writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifacts[2]!, {
      beforePublish: () =>
        reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
          input.authority,
          capability,
          input.promotionRoot,
        ),
      afterPublish: () =>
        reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
          input.authority,
          capability,
          input.promotionRoot,
        ),
    });
    reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
      input.authority,
      capability,
      input.promotionRoot,
    );
    return readRealBuildPrefix50Step44PersistedPromotionGuarded(
      input.promotionRoot,
      input.authority,
      capability,
    );
  });
}

function readRealBuildPrefix50Step44PersistedPromotionGuarded(
  promotionRoot: string,
  authority: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
): RealBuildPrefix50Step44PersistedBlindPromotion {
  requireRealBuildPrefix50Step44ProductionPromotionAuthority(authority, capability);
  reassertRealBuildPrefix50Step44ProductionPromotionAuthority(authority, capability, promotionRoot);
  requireExactPromotionFiles(
    promotionRoot,
    PROMOTION_FILES,
    "Step-44 persisted promotion output",
    (name) =>
      isRealBuildPrefix50Step44ProductionPromotionAuthorityGuardName(authority, capability, name),
  );
  const receiptRead = readCanonicalPromotionArtifact<RealBuildPrefix50Step44BlindPromotionReceipt>(
    promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
    "Step-44 persisted promotion receipt",
  );
  const documentRead = readCanonicalPromotionArtifact<BrickDocumentV1>(
    promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
    "Step-44 persisted selected document",
  );
  const envelopeRead =
    readCanonicalPromotionArtifact<RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope>(
      promotionRoot,
      REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
      "Step-44 persisted selected envelope",
    );
  const receipt = receiptRead.value;
  const selectedDocument = documentRead.value;
  const selectedEnvelope = envelopeRead.value;
  const expected = promotionArtifactsForAuthority(authority);
  requireExactPromotionKeys(
    receipt,
    [
      "allSixCriteriaSame",
      "authority",
      "blindReviewClosureCommitment",
      "blindReviewPacketCommitment",
      "candidateKey",
      "candidateKeysCommitment",
      "candidateRosterCommitment",
      "captureManifestCommitment",
      "commitment",
      "compactCandidateCommitment",
      "fixturePromotionAuthority",
      "fullResolutionOutcomeCommitment",
      "finalizationOperationInputsCommitment",
      "finalizationSourceLockCommitment",
      "laneCommitments",
      "page45SourcePolicyCommitment",
      "physicalPage45VerificationCommitment",
      "proceduralIndependenceStatement",
      "productionCaptureChainCommitment",
      "publicationCompleteCommitment",
      "publicHarnessSuccessCommitment",
      "publicPixelVerificationCommitment",
      "returnCandidateCommitment",
      "returnResultCommitment",
      "reviewBatchEnvelopeCommitment",
      "reviewHarnessEnvelopeCommitment",
      "reviewStatus",
      "rosterDescriptorCommitment",
      "schemaVersion",
      "selectedBlindId",
      "selectedDocumentArtifactByteDigest",
      "selectedDocumentArtifactFile",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "selectedEnvelopeArtifactByteDigest",
      "selectedEnvelopeArtifactFile",
      "selectedEnvelopeCommitment",
      "selectedMapRowCommitment",
      "selectionAuthority",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourceRowCommitment",
      "sourceSetId",
      "withheldUnblindingMapCommitment",
    ],
    "Step-44 persisted promotion receipt",
  );
  requireExactPromotionKeys(
    selectedEnvelope,
    [
      "authority",
      "candidateKey",
      "candidateRosterCommitment",
      "childSubBuildWindowCommitment",
      "commitment",
      "detachedStateCommitment",
      "projectionCommitment",
      "returnResultCommitment",
      "schemaVersion",
      "selectedDocument",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "sourceDocumentHash",
      "sourceMemberRowsCommitment",
      "sourceSetId",
      "step42_43RepairCommitment",
      "step43PredecessorCommitment",
    ],
    "Step-44 persisted selected envelope",
  );
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-blind-return-promotion/3" ||
    receipt.authority !== "repository-reviewed-step44" ||
    receipt.reviewStatus !== "reviewed" ||
    receipt.selectionAuthority !== "blind-page45-closure" ||
    receipt.fixturePromotionAuthority !== true ||
    receipt.sourceSetId !== "6651557" ||
    receipt.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    receipt.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    receipt.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    receipt.proceduralIndependenceStatement !==
      REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT ||
    receipt.selectedDocumentArtifactFile !== REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE ||
    receipt.selectedEnvelopeArtifactFile !== REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE ||
    receipt.selectedDocumentArtifactByteDigest !==
      digestPromotionArtifactBytes(documentRead.bytes) ||
    receipt.selectedEnvelopeArtifactByteDigest !==
      digestPromotionArtifactBytes(envelopeRead.bytes) ||
    receipt.selectedEnvelopeCommitment !== selectedEnvelope.commitment ||
    receipt.commitment !== canonicalDigest(promotionBodyWithoutCommitment(receipt)) ||
    !validateBrickDocumentV1(selectedDocument) ||
    documentStructuralHash(selectedDocument) !== receipt.selectedDocumentHash ||
    canonicalDigest(selectedDocument) !== receipt.selectedDocumentCommitment ||
    selectedEnvelope.commitment !==
      canonicalDigest(promotionBodyWithoutCommitment(selectedEnvelope)) ||
    selectedEnvelope.candidateKey !== receipt.candidateKey ||
    selectedEnvelope.selectedDocumentHash !== receipt.selectedDocumentHash ||
    selectedEnvelope.selectedDocumentCommitment !== receipt.selectedDocumentCommitment ||
    selectedEnvelope.returnResultCommitment !== receipt.returnResultCommitment ||
    selectedEnvelope.candidateRosterCommitment !== receipt.candidateRosterCommitment ||
    canonicalStringify(selectedEnvelope.selectedDocument) !==
      canonicalStringify(selectedDocument) ||
    canonicalStringify(receipt) !== canonicalStringify(expected.receipt) ||
    !Buffer.from(documentRead.bytes).equals(expected.selectedDocumentBytes) ||
    !Buffer.from(envelopeRead.bytes).equals(expected.selectedEnvelopeBytes)
  )
    throw new TypeError(
      "Step-44 persisted promotion receipt, selected envelope, or selected document drifted from the freshly rederived production authority.",
    );
  const frozenReceipt = deepFreeze(receipt);
  const persisted = deepFreeze({
    receipt: frozenReceipt,
    selectedDocument: deepFreeze(selectedDocument),
    selectedEnvelope: deepFreeze(selectedEnvelope),
  });
  persistedReceipts.add(frozenReceipt);
  persistedPromotions.add(persisted);
  reassertRealBuildPrefix50Step44ProductionPromotionAuthority(authority, capability, promotionRoot);
  return persisted;
}

export function readRealBuildPrefix50Step44PersistedPromotion(
  promotionRoot: string,
  authority: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability?: RealBuildPrefix50Step44SourceLockCapability,
): RealBuildPrefix50Step44PersistedBlindPromotion {
  if (capability === undefined)
    throw new TypeError("Step-44 persisted promotion reopen requires a live capability.");
  return withReleasedAuthority(promotionRoot, authority, capability, () =>
    readRealBuildPrefix50Step44PersistedPromotionGuarded(promotionRoot, authority, capability),
  );
}

export function requireRealBuildPrefix50Step44PersistedPromotion(
  value: RealBuildPrefix50Step44PersistedBlindPromotion,
): void {
  if (!persistedPromotions.has(value) || !persistedReceipts.has(value.receipt))
    throw new TypeError(
      "Step-44 selection requires a runtime-branded write-once persisted promotion read.",
    );
}

export function requireRealBuildPrefix50Step44BlindPromotionReceipt(
  receipt: RealBuildPrefix50Step44BlindPromotionReceipt,
): void {
  if (!persistedReceipts.has(receipt))
    throw new TypeError(
      "Step-44 repository-reviewed evidence requires its persisted promotion reader brand.",
    );
}
