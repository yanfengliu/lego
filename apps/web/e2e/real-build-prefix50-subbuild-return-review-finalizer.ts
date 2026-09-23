import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44BlindDispositionLane,
  RealBuildPrefix50Step44FullResolutionOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  readRealBuildPrefix50Step44CompletedBlindRun,
  requireRealBuildPrefix50Step44CompletedBlindRun,
} from "./real-build-prefix50-subbuild-return-review-blind-io.ts";
import {
  createRealBuildPrefix50Step44BlindReviewClosure,
  readRealBuildPrefix50Step44PersistedBlindClosure,
  readRealBuildPrefix50Step44PersistedBlindReviewEvidence,
  type RealBuildPrefix50Step44BlindReviewOutputLayout,
} from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import {
  createRealBuildPrefix50Step44PersistedBlindPromotion,
  reopenRealBuildPrefix50Step44PersistedBlindPromotion,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { requireRealBuildPrefix50Step44ExactRealDirectory } from "./real-build-prefix50-subbuild-return-review-blind-filesystem.ts";
import {
  writeRealBuildPrefix50Step44FinalizationReceipt,
  type RealBuildPrefix50Step44FinalizationReceipt,
} from "./real-build-prefix50-subbuild-return-review-finalization-receipt.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
  readRealBuildPrefix50Step44SourceLockedProductionReceipt,
  type RealBuildPrefix50Step44SourceLockedProductionReceipt,
} from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import {
  preflightRealBuildPrefix50Step44ExactArtifacts,
  writeOrResumeRealBuildPrefix50Step44ExactArtifact,
  type RealBuildPrefix50Step44ExactArtifact,
} from "./real-build-prefix50-subbuild-return-review-source-locked-files.ts";
import { deriveRealBuildPrefix50Step44SourceLockedDecision } from "./real-build-prefix50-subbuild-return-review-source-locked-decision.ts";
import { assertRealBuildPrefix50Step44CompleteLockedInputRoot } from "./real-build-prefix50-subbuild-return-review-source-locked-tree.ts";
import { isContainedAtomicWriteTemporaryName } from "./contained-atomic-write.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import {
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44LockedInput,
  requireRealBuildPrefix50Step44SourceLockCapability,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

export {
  REAL_BUILD_PREFIX50_STEP44_FINALIZATION_FILE,
  readRealBuildPrefix50Step44FinalizationReceipt,
  type RealBuildPrefix50Step44FinalizationReceipt,
} from "./real-build-prefix50-subbuild-return-review-finalization-receipt.ts";

export {
  REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE,
} from "./real-build-prefix50-subbuild-return-review-source-locked-decision.ts";

const PACKET_COPY_FILE = "real-build-prefix50-step44-blind-review-packet-copy.json";
const LANE_FILE = "real-build-prefix50-step44-blind-disposition.json";
const FULL_RESOLUTION_FILE = "real-build-prefix50-step44-full-resolution-outcome.json";
const CLOSURE_FILE = "real-build-prefix50-step44-blind-review-closure.json";
const PROMOTION_FILES = [
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
] as const;

function existingDirectoryFiles(
  path: string,
  allowed: readonly string[],
): readonly string[] | null {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(path) !== resolve(path))
      throw new TypeError(`Step-44 finalization output is not one exact real directory: ${path}.`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const files = readdirSync(path)
    .filter((file) => !isContainedAtomicWriteTemporaryName(file, allowed))
    .sort();
  if (files.some((file) => !allowed.includes(file)))
    throw new TypeError(
      `Step-44 finalization output ${path} contains a conflicting artifact; allowed files are ${allowed.join(", ")}.`,
    );
  return files;
}

async function ensureDirectory(reviewRoot: string, name: string): Promise<string> {
  const root = requireRealBuildPrefix50Step44ExactRealDirectory(reviewRoot, "Step-44 review root");
  const path = resolve(root, name);
  if (dirname(path) !== root || basename(path) !== name)
    throw new TypeError(`Step-44 finalization directory ${name} escaped its review root.`);
  try {
    await mkdir(path, { recursive: false });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
  requireRealBuildPrefix50Step44ExactRealDirectory(path, `Step-44 ${name} root`);
  return path;
}

function layout(reviewRoot: string): RealBuildPrefix50Step44BlindReviewOutputLayout {
  return {
    reviewRoot,
    publicRoot: resolve(reviewRoot, "public"),
    laneARoot: resolve(reviewRoot, "lane-a"),
    laneBRoot: resolve(reviewRoot, "lane-b"),
    fullResolutionRoot: resolve(reviewRoot, "full-resolution"),
    closureRoot: resolve(reviewRoot, "closure"),
    promotionRoot: resolve(reviewRoot, "promotion"),
  };
}

function repositoryRelative(repositoryRoot: string, path: string, label: string): string {
  const value = relative(resolve(repositoryRoot), resolve(path)).replaceAll("\\", "/");
  if (value.length === 0 || value.startsWith("../"))
    throw new TypeError(`${label} escaped the source-locked repository.`);
  return value;
}

async function persistDerivedReview(input: {
  readonly layout: RealBuildPrefix50Step44BlindReviewOutputLayout;
  readonly lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ];
  readonly outcome: RealBuildPrefix50Step44FullResolutionOutcome;
  readonly packetBytes: Uint8Array;
}): Promise<void> {
  const artifacts: readonly RealBuildPrefix50Step44ExactArtifact[] = [
    {
      root: input.layout.laneARoot,
      path: PACKET_COPY_FILE,
      bytes: input.packetBytes,
      label: "Step-44 lane-a packet copy",
    },
    {
      root: input.layout.laneARoot,
      path: LANE_FILE,
      bytes: Buffer.from(canonicalStringify(input.lanes[0])),
      label: "Step-44 lane-a disposition",
    },
    {
      root: input.layout.laneBRoot,
      path: PACKET_COPY_FILE,
      bytes: input.packetBytes,
      label: "Step-44 lane-b packet copy",
    },
    {
      root: input.layout.laneBRoot,
      path: LANE_FILE,
      bytes: Buffer.from(canonicalStringify(input.lanes[1])),
      label: "Step-44 lane-b disposition",
    },
    {
      root: input.layout.fullResolutionRoot,
      path: FULL_RESOLUTION_FILE,
      bytes: Buffer.from(canonicalStringify(input.outcome)),
      label: "Step-44 full-resolution outcome",
    },
  ];
  await Promise.all([
    ensureDirectory(input.layout.reviewRoot, "lane-a"),
    ensureDirectory(input.layout.reviewRoot, "lane-b"),
    ensureDirectory(input.layout.reviewRoot, "full-resolution"),
    ensureDirectory(input.layout.reviewRoot, "closure"),
    ensureDirectory(input.layout.reviewRoot, "promotion"),
  ]);
  // No sibling is published until every existing final path has proved byte-identical.
  preflightRealBuildPrefix50Step44ExactArtifacts(artifacts);
  for (const artifact of artifacts) writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact);
}

export async function finalizeRealBuildPrefix50Step44SourceLockedReview(input: {
  readonly reviewRoot: string;
  readonly rawInputRoot: string;
  readonly repositoryRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): Promise<RealBuildPrefix50Step44FinalizationReceipt> {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (realDomainQualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 finalization requires the exact real-domain qualification for its review batch.",
    );
  const output = layout(resolve(input.reviewRoot));
  const sourceLock = requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  const reviewRelative = repositoryRelative(
    input.repositoryRoot,
    output.reviewRoot,
    "Step-44 captured review tree",
  );
  const rawRelative = repositoryRelative(
    input.repositoryRoot,
    input.rawInputRoot,
    "Step-44 raw review input tree",
  );
  const expectedInputRoots = [
    sourceLock.batchInput.path,
    rawRelative,
    `${reviewRelative}/public`,
    `${reviewRelative}/withheld`,
    `${reviewRelative}/${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE}`,
  ].sort();
  if (
    sourceLock.operationInputRoots.length !== expectedInputRoots.length ||
    sourceLock.operationInputRoots.some((root, index) => root !== expectedInputRoots[index])
  )
    throw new TypeError(
      "Step-44 finalization capability must lock exactly the compact batch, complete captured public/withheld trees, prior production receipt, and raw review-input tree.",
    );
  for (const [logicalRoot, label] of [
    [sourceLock.batchInput.path, "Step-44 compact batch"],
    [rawRelative, "Step-44 raw reviewer-input tree"],
    [`${reviewRelative}/public`, "Step-44 captured public tree"],
    [`${reviewRelative}/withheld`, "Step-44 captured withheld tree"],
    [
      `${reviewRelative}/${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE}`,
      "Step-44 prior production receipt",
    ],
  ] as const)
    assertRealBuildPrefix50Step44CompleteLockedInputRoot({
      repositoryRoot: input.repositoryRoot,
      logicalRoot,
      label,
      capability: input.capability,
    });
  const completed = readRealBuildPrefix50Step44CompletedBlindRun({
    reviewRoot: output.reviewRoot,
    publicRoot: output.publicRoot,
    withheldRoot: resolve(output.reviewRoot, "withheld"),
    batch,
    packetArtifactFile: "real-build-prefix50-step44-blind-review-packet.json",
  });
  requireRealBuildPrefix50Step44CompletedBlindRun(completed);
  const productionReceipt: RealBuildPrefix50Step44SourceLockedProductionReceipt =
    readRealBuildPrefix50Step44SourceLockedProductionReceipt({
      repositoryRoot: input.repositoryRoot,
      reviewRoot: output.reviewRoot,
      batch,
      capability: input.capability,
      completedRun: completed,
    });
  const decision = deriveRealBuildPrefix50Step44SourceLockedDecision({
    repositoryRoot: input.repositoryRoot,
    rawLogicalRoot: rawRelative,
    packet: completed.packet,
    capability: input.capability,
  });
  const [laneA, laneB] = decision.lanes;
  const { outcome } = decision;
  // No filesystem mutation occurs above: all three canonical reviewer inputs and the exact
  // completed packet are reopened and the complete lane/outcome graph is derived first.
  const existingPromotionFiles = existingDirectoryFiles(output.promotionRoot, PROMOTION_FILES);
  for (const [path, allowed] of [
    [output.laneARoot, [PACKET_COPY_FILE, LANE_FILE]],
    [output.laneBRoot, [PACKET_COPY_FILE, LANE_FILE]],
    [output.fullResolutionRoot, [FULL_RESOLUTION_FILE]],
    [output.closureRoot, [CLOSURE_FILE]],
  ] as const)
    existingDirectoryFiles(path, allowed);
  if (
    outcome.disposition.kind !== "selected-one" &&
    existingPromotionFiles !== null &&
    existingPromotionFiles.length !== 0
  )
    throw new TypeError(
      "Step-44 refusal finalization requires an empty promotion directory before any derived output is written.",
    );
  const packetRow = requireRealBuildPrefix50Step44LockedInput(
    input.capability,
    `${reviewRelative}/public/real-build-prefix50-step44-blind-review-packet.json`,
  );
  const packetBytes = readRealBuildPrefix50Step44ReviewArtifact(
    output.publicRoot,
    "real-build-prefix50-step44-blind-review-packet.json",
    packetRow.bytes,
    "Step-44 finalizer packet copy source",
    packetRow.digest,
  );
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  await persistDerivedReview({ layout: output, lanes: [laneA, laneB], outcome, packetBytes });
  const evidence = readRealBuildPrefix50Step44PersistedBlindReviewEvidence(output, batch);
  const existingClosure = existingDirectoryFiles(output.closureRoot, [CLOSURE_FILE]);
  const closure =
    existingClosure?.length === 0
      ? await createRealBuildPrefix50Step44BlindReviewClosure(output, batch)
      : readRealBuildPrefix50Step44PersistedBlindClosure(output, batch);
  let promotionReceiptCommitment: `sha256:${string}` | null = null;
  if (closure.disposition.kind === "selected-one") {
    const existingPromotion = existingDirectoryFiles(output.promotionRoot, PROMOTION_FILES);
    const promotion =
      existingPromotion?.length !== PROMOTION_FILES.length
        ? await createRealBuildPrefix50Step44PersistedBlindPromotion({
            layout: output,
            withheldRoot: resolve(output.reviewRoot, "withheld"),
            rawInputRoot: input.rawInputRoot,
            repositoryRoot: input.repositoryRoot,
            batch,
            result: input.result,
            capability: input.capability,
            realDomainQualification,
          })
        : await reopenRealBuildPrefix50Step44PersistedBlindPromotion({
            layout: output,
            withheldRoot: resolve(output.reviewRoot, "withheld"),
            rawInputRoot: input.rawInputRoot,
            repositoryRoot: input.repositoryRoot,
            batch,
            result: input.result,
            capability: input.capability,
            realDomainQualification,
          });
    promotionReceiptCommitment = promotion.receipt.commitment;
  } else if (
    existingDirectoryFiles(output.promotionRoot, PROMOTION_FILES)?.length !== 0 ||
    readdirSync(output.promotionRoot).length !== 0
  ) {
    throw new TypeError("Step-44 refusal finalization requires an empty promotion directory.");
  }
  for (const [logicalRoot, label] of [
    [rawRelative, "Step-44 raw reviewer-input tree"],
    [`${reviewRelative}/public`, "Step-44 captured public tree"],
    [`${reviewRelative}/withheld`, "Step-44 captured withheld tree"],
  ] as const)
    assertRealBuildPrefix50Step44CompleteLockedInputRoot({
      repositoryRoot: input.repositoryRoot,
      logicalRoot,
      label,
      capability: input.capability,
    });
  return writeRealBuildPrefix50Step44FinalizationReceipt({
    repositoryRoot: input.repositoryRoot,
    reviewRoot: output.reviewRoot,
    capability: input.capability,
    body: {
      status:
        closure.disposition.kind === "selected-one" ? ("promoted" as const) : ("refused" as const),
      productionReceiptCommitment: productionReceipt.commitment,
      laneCommitments: [evidence.lanes[0].commitment, evidence.lanes[1].commitment] as const,
      fullResolutionOutcomeCommitment: evidence.outcome.commitment,
      blindReviewClosureCommitment: closure.commitment,
      promotionReceiptCommitment,
    },
  });
}
