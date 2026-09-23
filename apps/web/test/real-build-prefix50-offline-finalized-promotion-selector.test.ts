import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  canonicalDigest,
  canonicalStringify,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { describe, expect, it, vi } from "vitest";

import {
  readRealBuildPrefix50OfflineFinalizedPromotion,
  realBuildPrefix50OfflineFinalizedPromotionSelectorTestOnly,
  type RealBuildPrefix50OfflineFinalizedPromotionInput,
} from "../e2e/real-build-prefix50-offline-finalized-promotion-selector.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
  type RealBuildPrefix50Step44BlindPromotionReceipt,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import { REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-authority.ts";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-replay.ts";
import type { RealBuildPrefix50Step44FinalizationReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-finalization-receipt.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE,
} from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-decision.ts";
import { REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return.ts";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result.ts";
import { createUnbrandedRealDomainQualificationForNegativeTest } from "./real-build-prefix50-real-domain-qualification-negative-test-support.ts";

type Digest = `sha256:${string}`;
type LockedRow = Readonly<{ path: string; digest: Digest; bytes: number }>;

function sha256(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digest(label: string): Digest {
  return sha256(Buffer.from(label));
}

function commit<T extends object>(body: T): T & { readonly commitment: Digest } {
  return { ...body, commitment: canonicalDigest(body) };
}

function sourceLock(input: {
  readonly roots: readonly string[];
  readonly inputs: readonly LockedRow[];
  readonly batchInput: LockedRow;
  readonly stableSourceCommitment?: Digest;
  readonly sourceRootsPolicyDigest?: Digest;
}) {
  const roots = [...input.roots].sort((left, right) => left.localeCompare(right));
  const inputs = [...input.inputs].sort((left, right) => left.path.localeCompare(right.path));
  const operationInputByteCount = inputs.reduce((total, row) => total + row.bytes, 0);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-source-lock-binding/2" as const,
    sourceRootsPolicyDigest: input.sourceRootsPolicyDigest ?? digest("source-roots"),
    stableSourceCommitment: input.stableSourceCommitment ?? digest("stable-sources"),
    operationSourceManifestDigest: digest("source-manifest"),
    operationLockManifestDigest: digest("lock-manifest"),
    lockedFileCount: inputs.length + 1,
    lockedByteCount: operationInputByteCount + 1,
    operationInputRoots: roots,
    operationInputFileCount: inputs.length,
    operationInputByteCount,
    operationInputsCommitment: canonicalDigest({ roots, files: inputs }),
    batchInput: input.batchInput,
  };
  return commit(body);
}

interface FixtureOptions {
  readonly unbrandedQualification?: boolean;
  readonly productionStableSourceCommitment?: Digest;
  readonly productionSourceRootsPolicyDigest?: Digest;
  readonly productionBatchInput?: Partial<LockedRow>;
  readonly mutateFinalizationRoots?: (roots: readonly string[]) => readonly string[];
  readonly mutateFinalizationInputs?: (rows: readonly LockedRow[]) => readonly LockedRow[];
}

function buildFixture(options: FixtureOptions = {}) {
  const result = createStep44ReviewTestResult(211);
  const brand = __testOnly.brandReturnResultForReviewTests;
  if (brand === undefined) throw new Error("Synthetic Step-44 result brand is unavailable.");
  brand(result);
  const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
  const compact = batch.candidates[0]!;
  const candidate = result.enumeration.candidates.find(
    ({ candidateKey }) => candidateKey === compact.candidateKey,
  )!;
  const descriptor = result.candidateRoster.find(
    ({ candidateKey }) => candidateKey === compact.candidateKey,
  )!;
  const selectedDocument = candidate.hardValidDocument;
  const selectedEnvelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
  const documentBytes = Buffer.from(canonicalStringify(selectedDocument));
  const envelopeBytes = Buffer.from(canonicalStringify(selectedEnvelope));
  const selectedDocumentHash = documentStructuralHash(selectedDocument);
  const selectedDocumentCommitment = canonicalDigest(selectedDocument);
  const mapRow = commit({
    blindId: "B001" as const,
    batchIndex: 0,
    rosterIndex: compact.rosterIndex,
    candidateKey: candidate.candidateKey,
    reviewHarnessEnvelopeCommitment: selectedEnvelope.commitment,
    compactCandidateCommitment: canonicalDigest(compact),
    captureManifestCommitment: digest("capture-manifest"),
    sourceRowCommitment: digest("source-row"),
    selectedDocumentHash,
    selectedDocumentCommitment,
  });
  const map = commit({ rows: [mapRow] });
  const evidence = {
    packet: { commitment: digest("packet") },
    publicSuccess: { commitment: digest("public-success") },
    publicationComplete: {
      expectedHarnessInputBytesHash: digest("harness-input"),
      commitment: digest("publication-complete"),
    },
    lanes: [{ commitment: digest("lane-a") }, { commitment: digest("lane-b") }],
    outcome: {
      commitment: digest("full-resolution"),
      fullResolutionReviews: [
        {
          blindId: "B001",
          survives: true,
          criteria: Array.from({ length: 6 }, () => ({ outcome: "same" as const })),
        },
      ],
    },
    closure: {
      commitment: digest("closure"),
      publicPixelVerificationCommitment: digest("public-pixels"),
      disposition: { kind: "selected-one" as const, blindId: "B001" as const },
    },
    physicalPage45Verification: { commitment: digest("physical-page-45") },
  };
  const productionChain = { commitment: digest("production-chain") };
  const repositoryRoot = resolve(".");
  const reviewRelative = "var/runs/offline-finalized-test";
  const reviewRoot = resolve(repositoryRoot, reviewRelative);
  const batchInput: LockedRow = {
    path: `${reviewRelative}/review-batch.json`,
    digest: evidence.publicationComplete.expectedHarnessInputBytesHash,
    bytes: 1,
  };
  const productionBatchInput: LockedRow = {
    ...batchInput,
    ...options.productionBatchInput,
  };
  const productionLock = sourceLock({
    roots: [productionBatchInput.path],
    inputs: [productionBatchInput],
    batchInput: productionBatchInput,
    ...(options.productionStableSourceCommitment === undefined
      ? {}
      : { stableSourceCommitment: options.productionStableSourceCommitment }),
    ...(options.productionSourceRootsPolicyDigest === undefined
      ? {}
      : { sourceRootsPolicyDigest: options.productionSourceRootsPolicyDigest }),
  });
  const productionReceipt = commit({
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-production/2" as const,
    sourceSetId: "6651557" as const,
    authority: "none" as const,
    sourceLock: productionLock,
    reviewBatchEnvelopeCommitment: batch.commitment,
    expectedHarnessInputBytesHash: evidence.publicationComplete.expectedHarnessInputBytesHash,
    publicHarnessSuccessCommitment: evidence.publicSuccess.commitment,
    publicationCompleteCommitment: evidence.publicationComplete.commitment,
  });
  const productionReceiptBytes = Buffer.from(canonicalStringify(productionReceipt));
  const rawRoot = `${reviewRelative}/raw`;
  const productionReceiptPath = `${reviewRelative}/${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE}`;
  const finalizationRoots = options.mutateFinalizationRoots?.([
    batchInput.path,
    rawRoot,
    `${reviewRelative}/public`,
    `${reviewRelative}/withheld`,
    productionReceiptPath,
  ]) ?? [
    batchInput.path,
    rawRoot,
    `${reviewRelative}/public`,
    `${reviewRelative}/withheld`,
    productionReceiptPath,
  ];
  const baseFinalizationInputs: readonly LockedRow[] = [
    batchInput,
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE}`,
      digest: digest("raw-lane-a"),
      bytes: 1,
    },
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE}`,
      digest: digest("raw-lane-b"),
      bytes: 1,
    },
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE}`,
      digest: digest("raw-full-resolution"),
      bytes: 1,
    },
    {
      path: `${reviewRelative}/public/captured.json`,
      digest: digest("captured-public"),
      bytes: 1,
    },
    {
      path: `${reviewRelative}/withheld/captured.json`,
      digest: digest("captured-withheld"),
      bytes: 1,
    },
    {
      path: productionReceiptPath,
      digest: sha256(productionReceiptBytes),
      bytes: productionReceiptBytes.byteLength,
    },
  ];
  const finalizationInputs =
    options.mutateFinalizationInputs?.(baseFinalizationInputs) ?? baseFinalizationInputs;
  const finalizationLock = sourceLock({
    roots: finalizationRoots,
    inputs: finalizationInputs,
    batchInput,
  });
  const promotionBody = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-return-promotion/3" as const,
    authority: "repository-reviewed-step44" as const,
    reviewStatus: "reviewed" as const,
    selectionAuthority: "blind-page45-closure" as const,
    fixturePromotionAuthority: true as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    physicalPage45VerificationCommitment: evidence.physicalPage45Verification.commitment,
    productionCaptureChainCommitment: productionChain.commitment,
    publicationCompleteCommitment: evidence.publicationComplete.commitment,
    finalizationSourceLockCommitment: finalizationLock.commitment,
    finalizationOperationInputsCommitment: finalizationLock.operationInputsCommitment,
    proceduralIndependenceStatement: REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT,
    selectedBlindId: "B001" as const,
    candidateKey: candidate.candidateKey,
    blindReviewPacketCommitment: evidence.packet.commitment,
    publicHarnessSuccessCommitment: evidence.publicSuccess.commitment,
    laneCommitments: [evidence.lanes[0]!.commitment, evidence.lanes[1]!.commitment] as const,
    fullResolutionOutcomeCommitment: evidence.outcome.commitment,
    blindReviewClosureCommitment: evidence.closure.commitment,
    publicPixelVerificationCommitment: evidence.closure.publicPixelVerificationCommitment,
    withheldUnblindingMapCommitment: map.commitment,
    selectedMapRowCommitment: mapRow.commitment,
    reviewBatchEnvelopeCommitment: batch.commitment,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    returnCandidateCommitment: canonicalDigest(candidate),
    rosterDescriptorCommitment: canonicalDigest(descriptor),
    reviewHarnessEnvelopeCommitment: selectedEnvelope.commitment,
    compactCandidateCommitment: mapRow.compactCandidateCommitment,
    captureManifestCommitment: mapRow.captureManifestCommitment,
    sourceRowCommitment: mapRow.sourceRowCommitment,
    selectedDocumentHash,
    selectedDocumentCommitment,
    selectedDocumentArtifactFile: REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
    selectedDocumentArtifactByteDigest: sha256(documentBytes),
    selectedEnvelopeArtifactFile: REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
    selectedEnvelopeArtifactByteDigest: sha256(envelopeBytes),
    selectedEnvelopeCommitment: selectedEnvelope.commitment,
    allSixCriteriaSame: true as const,
  };
  const promotion = commit(promotionBody) as RealBuildPrefix50Step44BlindPromotionReceipt;
  const finalization = commit({
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-finalization/3" as const,
    sourceSetId: "6651557" as const,
    status: "promoted" as const,
    productionReceiptCommitment: productionReceipt.commitment,
    laneCommitments: promotion.laneCommitments,
    fullResolutionOutcomeCommitment: evidence.outcome.commitment,
    blindReviewClosureCommitment: evidence.closure.commitment,
    promotionReceiptCommitment: promotion.commitment,
    finalizationSourceLock: finalizationLock,
    finalizationOperationInputs: finalizationInputs
      .slice()
      .sort((left, right) => left.path.localeCompare(right.path)),
  }) as RealBuildPrefix50Step44FinalizationReceipt;
  const input: RealBuildPrefix50OfflineFinalizedPromotionInput = {
    repositoryRoot,
    reviewLayout: {
      reviewRoot,
      publicRoot: resolve(reviewRoot, "public"),
      laneARoot: resolve(reviewRoot, "lane-a"),
      laneBRoot: resolve(reviewRoot, "lane-b"),
      fullResolutionRoot: resolve(reviewRoot, "full-resolution"),
      closureRoot: resolve(reviewRoot, "closure"),
      promotionRoot: resolve(reviewRoot, "promotion"),
    },
    qualificationOutputPath: `${reviewRoot}.page44-real-domain-calibration`,
    reviewBatch: batch,
    returnResult: result,
  };
  const qualification = options.unbrandedQualification
    ? { commitment: digest("qualification") }
    : createUnbrandedRealDomainQualificationForNegativeTest(batch.commitment);
  const liveSourceLock = Object.freeze({ fabricatedNegativeSourceLock: true });
  const values = new Map<string, { bytes: Uint8Array; value: unknown }>([
    [
      REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
      { bytes: Buffer.from(canonicalStringify(promotion)), value: promotion },
    ],
    [
      REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
      { bytes: documentBytes, value: selectedDocument },
    ],
    [
      REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
      { bytes: envelopeBytes, value: selectedEnvelope },
    ],
    [
      REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
      { bytes: productionReceiptBytes, value: productionReceipt },
    ],
  ]);
  const reopenQualification = vi.fn(async () => qualification as never);
  const dependencies = {
    readFinalization: vi.fn(() => finalization),
    readEvidence: vi.fn(() => evidence),
    requireEvidence: vi.fn(),
    readMap: vi.fn(() => map),
    captureSourceLock: vi.fn(() => liveSourceLock as never),
    reopenQualification,
    verifyProductionChain: vi.fn(async () => productionChain),
    requireProductionChain: vi.fn(),
    readArtifact: vi.fn(
      <T>(_root: string, file: string) => values.get(file)! as { bytes: Uint8Array; value: T },
    ),
    readPromotionFiles: vi.fn((root: string): readonly string[] => {
      void root;
      return [
        REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
        REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
        REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
      ];
    }),
  };
  return {
    input,
    dependencies,
    finalization,
    finalizationInputs,
    finalizationRoots,
    promotion,
    productionLock,
    productionReceipt,
    productionReceiptBytes,
    productionReceiptPath,
    evidence,
    result,
    selectedDocument,
    liveSourceLock,
    values,
  };
}

function readFixture(fixture: ReturnType<typeof buildFixture>) {
  const read = realBuildPrefix50OfflineFinalizedPromotionSelectorTestOnly.readWithDependencies;
  if (read === undefined) throw new Error("Offline finalized-promotion test hook is unavailable.");
  return read(fixture.input, fixture.dependencies as never);
}

describe("prefix-50 offline finalized-promotion selector", () => {
  it("refuses a fabricated qualifier while forwarding the exact source, result, and batch", async () => {
    const fixture = buildFixture({ unbrandedQualification: true });
    expect(fixture.productionLock.operationInputRoots).toHaveLength(1);
    expect(fixture.finalization.finalizationSourceLock.operationInputRoots).toHaveLength(5);
    await expect(readFixture(fixture)).rejects.toThrow(/runtime-branded persisted/u);
    expect(fixture.dependencies.captureSourceLock).toHaveBeenCalledWith(
      fixture.input.repositoryRoot,
    );
    expect(fixture.dependencies.reopenQualification).toHaveBeenCalledWith({
      qualificationOutputPath: fixture.input.qualificationOutputPath,
      repositoryRoot: fixture.input.repositoryRoot,
      sourceLock: fixture.liveSourceLock,
      returnResult: fixture.input.returnResult,
      reviewBatch: fixture.input.reviewBatch,
    });
    expect(fixture.dependencies.verifyProductionChain).not.toHaveBeenCalled();
  }, 60_000);

  it("refuses non-v3 and non-promoted finalization receipts before qualification", async () => {
    const fixture = buildFixture();
    const v2Body = { ...fixture.finalization } as Record<string, unknown>;
    Reflect.deleteProperty(v2Body, "commitment");
    Reflect.deleteProperty(v2Body, "finalizationOperationInputs");
    v2Body.schemaVersion = "lego.real-build-prefix50-step44-source-locked-finalization/2";
    const v2 = commit(v2Body);
    fixture.dependencies.readFinalization.mockReturnValue(v2 as never);
    await expect(readFixture(fixture)).rejects.toThrow(
      /must contain exactly.*finalizationOperationInputs/u,
    );
    expect(fixture.dependencies.readEvidence).not.toHaveBeenCalled();
    fixture.dependencies.readFinalization.mockReturnValue(fixture.finalization);

    fixture.dependencies.readFinalization.mockReturnValue({
      ...fixture.finalization,
      status: "refused",
      promotionReceiptCommitment: null,
    } as never);
    await expect(readFixture(fixture)).rejects.toThrow(/promoted finalization receipt v3/u);
    fixture.dependencies.readFinalization.mockReturnValue(fixture.finalization);
  }, 60_000);

  it.todo(
    "replays promotion schema, closure drift, and extra-artifact negatives after a genuine persisted qualification fixture exists",
  );

  it("rejects caller-supplied live authority fields before reading persisted evidence", async () => {
    const fixture = buildFixture();
    await expect(
      readFixture({
        ...fixture,
        input: { ...fixture.input, capability: Object.freeze({}) } as never,
      }),
    ).rejects.toThrow(/must contain exactly/u);
    expect(fixture.dependencies.readFinalization).not.toHaveBeenCalled();
    await expect(
      readRealBuildPrefix50OfflineFinalizedPromotion({
        ...fixture.input,
        realDomainQualification: Object.freeze({}),
      } as never),
    ).rejects.toThrow(/must contain exactly/u);
  }, 60_000);
});
