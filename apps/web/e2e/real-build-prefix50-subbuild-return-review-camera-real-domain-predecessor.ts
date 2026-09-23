import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  requireRealBuildPrefix50Step44HeldOutUnlockCapability,
  type RealBuildPrefix50Step44HeldOutUnlockCapability,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_BATCH_COMMITMENT =
  "sha256:a6b3199bc292c8ae742880d48fd55efe790edfd911c0c8771f269b23c9aa7c26" as const;
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_DOCUMENT_HASH =
  "sha256:9c370be37badb5c810bb7c5860e7f1cd43154f0f95db761ddf026775f40fc866" as const;
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_REPLAY_BASE_COMMITMENT =
  "sha256:7bef266486049a55a7565ae4c83258eecdcc3377a09bc23d28d6e7cdcc6f9fe8" as const;
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CHILD_ROSTER_COMMITMENT =
  "sha256:2a63c0e43d7af9143c3ea2aef18f846d9a40e0216e4eba4a5ea0e2fc2be86fd2" as const;
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_ENUMERATION_COMMITMENT =
  "sha256:ea2cdce0e8df4a13d303c8037272a9f3afcc779fb663045a5390c06713f7cd4e" as const;

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS = Object.freeze([
  "builtin:dark-azure",
  "builtin:medium-azure",
] as const);
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS = Object.freeze([
  "builtin:black",
] as const);

export type RealBuildPrefix50Step44RealDomainCalibrationStep = 41 | 42;
export type RealBuildPrefix50Step44RealDomainPanelStep = 41 | 42 | 43;
export type { RealBuildPrefix50Step44RealDomainBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";

const predecessorCaseBrands = new WeakSet<object>();

export interface RealBuildPrefix50Step44RealDomainDocumentSummary {
  readonly partCount: number;
  readonly connectionCount: number;
  readonly stepCount: number;
  readonly documentHash: Sha256Digest;
  readonly documentCommitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44RealDomainSemanticClassification {
  readonly targetColorIds: typeof REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS;
  readonly targetPartIds: readonly string[];
  readonly otherPartIds: readonly string[];
}

export interface RealBuildPrefix50Step44RealDomainPredecessorCase {
  readonly panelStep: RealBuildPrefix50Step44RealDomainPanelStep;
  readonly predecessorThroughStep: 40 | 41 | 42;
  readonly splitRole: "calibration" | "held-out-validation";
  readonly fullPredecessor: RealBuildPrefix50Step44RealDomainDocumentSummary;
  readonly activeChildPredecessor: RealBuildPrefix50Step44RealDomainDocumentSummary;
  readonly activeChildDocument: BrickDocumentV1;
  readonly semanticClassification: RealBuildPrefix50Step44RealDomainSemanticClassification;
  readonly semanticClassificationCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

const EXPECTED_CASES = deepFreeze({
  41: {
    full: {
      partCount: 269,
      connectionCount: 847,
      stepCount: 40,
      documentHash: "sha256:899938cb2e52d8fef8fe5d24fefa14ea2e30b45b86a1f0cc193d9a089b740f14",
      documentCommitment: "sha256:41ddd950313852ce7b913e433b283bc7560944e1be8acef3a0870bdc85250b97",
    },
    active: {
      partCount: 12,
      connectionCount: 20,
      stepCount: 40,
      documentHash: "sha256:03a054c7e1760c7fad02d2625af7807c2d948861e8095609af56abdc2b6c562b",
      documentCommitment: "sha256:c47ee2cf77afed2f5d7fca91a3fadcb582eb04e9fda0780d27edb449220e152a",
    },
    targetPartCount: 7,
    otherPartCount: 5,
    semanticClassificationCommitment:
      "sha256:2a61afa24d803a7bd0c637759c3df0848e634603370a5d728d6589eac6832144",
  },
  42: {
    full: {
      partCount: 273,
      connectionCount: 855,
      stepCount: 41,
      documentHash: "sha256:e9fc1f9e4c28aa2188a04d65c39db1a386f54a5155f2a6e4b93deba4b43f77cb",
      documentCommitment: "sha256:be733994971ee53e59ea6da24667bea137f8f350e58662dfbb09e6de57cfd70a",
    },
    active: {
      partCount: 16,
      connectionCount: 28,
      stepCount: 41,
      documentHash: "sha256:de2be010bd68c55ec57f780b61ab0e787253012cdd5ed4f5a89345756b128d57",
      documentCommitment: "sha256:a838a325f78a925141526aefc3e2bf8a84d11eacc83e6a1650502ed6e3995394",
    },
    targetPartCount: 11,
    otherPartCount: 5,
    semanticClassificationCommitment:
      "sha256:73a81e4d042904c4f5c5482aba428846b88fb2f7cddef4c35180821f1304f647",
  },
} as const);

function restrictedDocument(input: {
  readonly source: BrickDocumentV1;
  readonly allowedPartIds: ReadonlySet<string>;
  readonly throughStep: number;
  readonly role: "full" | "active-child";
}): BrickDocumentV1 {
  const filterMembership = <T extends { readonly partIds: readonly string[] }>(value: T): T => ({
    ...value,
    partIds: value.partIds.filter((partId) => input.allowedPartIds.has(partId)),
  });
  return deepFreeze({
    ...input.source,
    revision: `revision-${canonicalDigest({
      source: canonicalDigest(input.source),
      throughStep: input.throughStep,
      role: input.role,
    }).slice("sha256:".length, 31)}`,
    parts: input.source.parts.filter(({ id }) => input.allowedPartIds.has(id)),
    connections: input.source.connections.filter(
      ({ a, b }) => input.allowedPartIds.has(a.partId) && input.allowedPartIds.has(b.partId),
    ),
    submodels: input.source.submodels.map(filterMembership),
    steps: input.source.steps.slice(0, input.throughStep).map(filterMembership),
    semanticRegions: input.source.semanticRegions.map(filterMembership),
  });
}

function summary(document: BrickDocumentV1): RealBuildPrefix50Step44RealDomainDocumentSummary {
  return deepFreeze({
    partCount: document.parts.length,
    connectionCount: document.connections.length,
    stepCount: document.steps.length,
    documentHash: documentStructuralHash(document),
    documentCommitment: canonicalDigest(document),
  });
}

export function assertRealBuildPrefix50Step44RealDomainBatch(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): void {
  const base = batch.reviewReplayBaseDocument;
  if (
    batch.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-batch-input/2" ||
    batch.authority !== "none" ||
    batch.selectionAuthority !== false ||
    batch.fixturePromotionAuthority !== false ||
    batch.sourceSetId !== "6651557" ||
    batch.commitment !== REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_BATCH_COMMITMENT ||
    batch.sourceDocumentHash !== REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_DOCUMENT_HASH ||
    batch.reviewReplayBaseDocumentCommitment !==
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_REPLAY_BASE_COMMITMENT ||
    canonicalDigest(base) !== REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_REPLAY_BASE_COMMITMENT ||
    documentStructuralHash(base) !== REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_DOCUMENT_HASH ||
    base.parts.length !== 280 ||
    base.steps.length !== 43 ||
    batch.enumerationReceipt.commitment !==
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_ENUMERATION_COMMITMENT ||
    batch.enumerationReceipt.childPartIds.length !== 23 ||
    canonicalDigest(batch.enumerationReceipt.childPartIds) !==
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CHILD_ROSTER_COMMITMENT
  )
    throw new TypeError(
      "Real-domain camera calibration requires the exact authority-none 211-candidate Step-44 batch, 280-part replay base, and sorted 23-part detached child roster.",
    );
}

export function deriveRealBuildPrefix50Step44RealDomainPredecessorCase(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  panelStep: RealBuildPrefix50Step44RealDomainCalibrationStep,
): RealBuildPrefix50Step44RealDomainPredecessorCase {
  const throughStep = (panelStep - 1) as 40 | 41;
  const childIds = new Set(batch.enumerationReceipt.childPartIds);
  const fullIds = new Set(
    batch.reviewReplayBaseDocument.steps.slice(0, throughStep).flatMap(({ partIds }) => partIds),
  );
  const activeIds = new Set([...fullIds].filter((partId) => childIds.has(partId)));
  const fullPredecessor = summary(
    restrictedDocument({
      source: batch.reviewReplayBaseDocument,
      allowedPartIds: fullIds,
      throughStep,
      role: "full",
    }),
  );
  const activeChildDocument = restrictedDocument({
    source: batch.reviewReplayBaseDocument,
    allowedPartIds: activeIds,
    throughStep,
    role: "active-child",
  });
  const activeChildPredecessor = summary(activeChildDocument);
  const expected = EXPECTED_CASES[panelStep];
  const report = validateBrickDocument(activeChildDocument);
  const targetColorSet = new Set<string>(REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS);
  const targetPartIds = activeChildDocument.parts
    .filter(({ colorId }) => targetColorSet.has(colorId))
    .map(({ id }) => id)
    .sort();
  const otherPartIds = activeChildDocument.parts
    .filter(({ colorId }) => !targetColorSet.has(colorId))
    .map(({ id }) => id)
    .sort();
  const observedOtherColors = [
    ...new Set(
      activeChildDocument.parts
        .filter(({ id }) => otherPartIds.includes(id))
        .map(({ colorId }) => colorId),
    ),
  ].sort();
  const semanticClassification = deepFreeze({
    targetColorIds: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS,
    targetPartIds,
    otherPartIds,
  });
  const semanticClassificationCommitment = canonicalDigest(semanticClassification);
  if (
    canonicalDigest(fullPredecessor) !== canonicalDigest(expected.full) ||
    canonicalDigest(activeChildPredecessor) !== canonicalDigest(expected.active) ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== activeChildPredecessor.documentHash ||
    targetPartIds.length !== expected.targetPartCount ||
    otherPartIds.length !== expected.otherPartCount ||
    canonicalDigest(observedOtherColors) !==
      canonicalDigest(REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS) ||
    semanticClassificationCommitment !== expected.semanticClassificationCommitment
  )
    throw new TypeError(
      `Real-domain panel ${panelStep} did not reproduce its exact Step-${throughStep} full lineage, hard-valid active child, and dark/medium-azure versus black semantic policy.`,
    );
  const body = {
    panelStep,
    predecessorThroughStep: throughStep,
    splitRole: "calibration" as const,
    fullPredecessor,
    activeChildPredecessor,
    activeChildDocument,
    semanticClassification,
    semanticClassificationCommitment,
  };
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  predecessorCaseBrands.add(result);
  return result;
}

export function requireRealBuildPrefix50Step44RealDomainPredecessorCase(
  value: RealBuildPrefix50Step44RealDomainPredecessorCase,
): RealBuildPrefix50Step44RealDomainPredecessorCase {
  if (!predecessorCaseBrands.has(value))
    throw new TypeError(
      "Real-domain camera predecessor lacks its exact runtime-branded 211-batch lineage.",
    );
  return value;
}

export function brandRealBuildPrefix50Step44HeldOutPredecessorCase(input: {
  readonly capability: RealBuildPrefix50Step44HeldOutUnlockCapability;
  readonly value: RealBuildPrefix50Step44RealDomainPredecessorCase;
}): RealBuildPrefix50Step44RealDomainPredecessorCase {
  requireRealBuildPrefix50Step44HeldOutUnlockCapability(input.capability);
  const { commitment, ...body } = input.value;
  if (
    input.value.panelStep !== 43 ||
    input.value.predecessorThroughStep !== 42 ||
    input.value.splitRole !== "held-out-validation" ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Held-out predecessor registration requires the exact consumed Step-43 case.",
    );
  predecessorCaseBrands.add(input.value);
  return input.value;
}
