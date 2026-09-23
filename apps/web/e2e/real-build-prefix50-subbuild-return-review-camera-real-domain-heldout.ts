import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  assertRealBuildPrefix50Step44RealDomainBatch,
  brandRealBuildPrefix50Step44HeldOutPredecessorCase,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS,
  type RealBuildPrefix50Step44RealDomainPredecessorCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import {
  materializeRealBuildPrefix50Step44HeldOutSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceSequence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import {
  requireRealBuildPrefix50Step44HeldOutUnlockCapability,
  type RealBuildPrefix50Step44HeldOutUnlockCapability,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";

const EXPECTED_PREDECESSOR = deepFreeze({
  full: {
    partCount: 276,
    connectionCount: 863,
    stepCount: 42,
    documentHash: "sha256:dd605c9ffbc1c42e9a08dbe02fbf690b0f3da90770ab7a146bdc5f80ee9560a9",
    documentCommitment: "sha256:aec7c568bdc0598f60af1004d1ac7cdb5ef0e326b10fc88203730794af67ebd1",
  },
  active: {
    partCount: 19,
    connectionCount: 36,
    stepCount: 42,
    documentHash: "sha256:8af365dbf36221f07451cc48f7d6ddbbaa5b496b315587f1f28e01fae7017873",
    documentCommitment: "sha256:ff9304665b83662ab9cb2913c256474e4f9c08edb97ad8353ef2d7f248561ccc",
  },
  targetPartCount: 11,
  otherPartCount: 8,
  semanticClassificationCommitment:
    "sha256:704967962c2b29a17b14cee4ddcba04227fab1cef44142567e8a3fd5df3af66d",
});

function restrictedDocument(input: {
  readonly source: BrickDocumentV1;
  readonly allowedPartIds: ReadonlySet<string>;
  readonly role: "full" | "active-child";
}): BrickDocumentV1 {
  const filter = <T extends { readonly partIds: readonly string[] }>(value: T): T => ({
    ...value,
    partIds: value.partIds.filter((partId) => input.allowedPartIds.has(partId)),
  });
  return deepFreeze({
    ...input.source,
    revision: `revision-${canonicalDigest({ source: canonicalDigest(input.source), throughStep: 42, role: input.role }).slice("sha256:".length, 31)}`,
    parts: input.source.parts.filter(({ id }) => input.allowedPartIds.has(id)),
    connections: input.source.connections.filter(
      ({ a, b }) => input.allowedPartIds.has(a.partId) && input.allowedPartIds.has(b.partId),
    ),
    submodels: input.source.submodels.map(filter),
    steps: input.source.steps.slice(0, 42).map(filter),
    semanticRegions: input.source.semanticRegions.map(filter),
  });
}

function derivePredecessor(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  capability: RealBuildPrefix50Step44HeldOutUnlockCapability,
): RealBuildPrefix50Step44RealDomainPredecessorCase {
  assertRealBuildPrefix50Step44RealDomainBatch(batch);
  const childIds = new Set(batch.enumerationReceipt.childPartIds);
  const fullIds = new Set(
    batch.reviewReplayBaseDocument.steps.slice(0, 42).flatMap(({ partIds }) => partIds),
  );
  const activeIds = new Set([...fullIds].filter((partId) => childIds.has(partId)));
  const fullDocument = restrictedDocument({
    source: batch.reviewReplayBaseDocument,
    allowedPartIds: fullIds,
    role: "full",
  });
  const activeChildDocument = restrictedDocument({
    source: batch.reviewReplayBaseDocument,
    allowedPartIds: activeIds,
    role: "active-child",
  });
  const summary = (document: BrickDocumentV1) => ({
    partCount: document.parts.length,
    connectionCount: document.connections.length,
    stepCount: document.steps.length,
    documentHash: documentStructuralHash(document),
    documentCommitment: canonicalDigest(document),
  });
  const fullPredecessor = deepFreeze(summary(fullDocument));
  const activeChildPredecessor = deepFreeze(summary(activeChildDocument));
  const targetColorIds = new Set<string>(REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS);
  const targetPartIds = activeChildDocument.parts
    .filter(({ colorId }) => targetColorIds.has(colorId))
    .map(({ id }) => id)
    .sort();
  const otherPartIds = activeChildDocument.parts
    .filter(({ colorId }) => !targetColorIds.has(colorId))
    .map(({ id }) => id)
    .sort();
  const otherColors = [
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
  const validation = validateBrickDocument(activeChildDocument);
  if (
    canonicalDigest(fullPredecessor) !== canonicalDigest(EXPECTED_PREDECESSOR.full) ||
    canonicalDigest(activeChildPredecessor) !== canonicalDigest(EXPECTED_PREDECESSOR.active) ||
    !validation.documentGloballyValid ||
    validation.targetDocumentHash !== activeChildPredecessor.documentHash ||
    targetPartIds.length !== EXPECTED_PREDECESSOR.targetPartCount ||
    otherPartIds.length !== EXPECTED_PREDECESSOR.otherPartCount ||
    canonicalDigest(otherColors) !==
      canonicalDigest(REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS) ||
    semanticClassificationCommitment !== EXPECTED_PREDECESSOR.semanticClassificationCommitment
  )
    throw new TypeError(
      "Consumed Step-43 predecessor did not reproduce its exact held-out lineage.",
    );
  const body = {
    panelStep: 43 as const,
    predecessorThroughStep: 42 as const,
    splitRole: "held-out-validation" as const,
    fullPredecessor,
    activeChildPredecessor,
    activeChildDocument,
    semanticClassification,
    semanticClassificationCommitment,
  };
  return brandRealBuildPrefix50Step44HeldOutPredecessorCase({
    capability,
    value: deepFreeze({ ...body, commitment: canonicalDigest(body) }),
  });
}

export async function openRealBuildPrefix50Step44RealDomainHeldOut(input: {
  readonly capability: RealBuildPrefix50Step44HeldOutUnlockCapability;
  readonly sourceSequence: RealBuildPrefix50Step44RealDomainSourceSequence;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<
  Readonly<{
    sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
    predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  }>
> {
  const capability = requireRealBuildPrefix50Step44HeldOutUnlockCapability(input.capability);
  return Object.freeze({
    sourceCase: await materializeRealBuildPrefix50Step44HeldOutSourceCase({
      capability,
      sourceSequence: input.sourceSequence,
    }),
    predecessorCase: derivePredecessor(input.reviewBatch, capability),
  });
}
