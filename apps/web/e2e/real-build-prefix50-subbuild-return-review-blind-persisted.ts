import { readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44BlindDispositionLane,
  RealBuildPrefix50Step44BlindPublicHarnessSuccess,
  RealBuildPrefix50Step44BlindReviewClosure,
  RealBuildPrefix50Step44BlindReviewPacket,
  RealBuildPrefix50Step44FullResolutionOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { requireRealBuildPrefix50Step44FullResolutionOutcome } from "./real-build-prefix50-subbuild-return-review-blind-full-resolution.ts";
import {
  readRealBuildPrefix50Step44CompletedBlindRun,
  requireRealBuildPrefix50Step44CompletedBlindRun,
} from "./real-build-prefix50-subbuild-return-review-blind-io.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44PublicationComplete } from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";
import { requireRealBuildPrefix50Step44BlindDispositionLane } from "./real-build-prefix50-subbuild-return-review-blind-lane.ts";
import { requireRealBuildPrefix50Step44ExactRealDirectory } from "./real-build-prefix50-subbuild-return-review-blind-filesystem.ts";
import { verifyRealBuildPrefix50Step44BlindShortlistPixels } from "./real-build-prefix50-subbuild-return-review-blind-pixels.ts";
import {
  rerenderRealBuildPrefix50Step44QualifiedPhysicalPage45,
  type RealBuildPrefix50Step44PhysicalPage45Verification,
  verifyRealBuildPrefix50Step44PhysicalPage45Provenance,
} from "./real-build-prefix50-subbuild-return-review-blind-provenance.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { requireRealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  preflightRealBuildPrefix50Step44ExactArtifacts,
  writeOrResumeRealBuildPrefix50Step44ExactArtifact,
  type RealBuildPrefix50Step44ExactArtifact,
} from "./real-build-prefix50-subbuild-return-review-source-locked-files.ts";
import { isContainedAtomicWriteTemporaryName } from "./contained-atomic-write.ts";

const PACKET_FILE = "real-build-prefix50-step44-blind-review-packet.json";
const PACKET_COPY_FILE = "real-build-prefix50-step44-blind-review-packet-copy.json";
const LANE_FILE = "real-build-prefix50-step44-blind-disposition.json";
const FULL_RESOLUTION_FILE = "real-build-prefix50-step44-full-resolution-outcome.json";
const CLOSURE_FILE = "real-build-prefix50-step44-blind-review-closure.json";
const MAXIMUM_JSON_BYTES = 8 * 1024 * 1024;

const persistedPackets = new WeakSet<object>();
const persistedLanes = new WeakSet<object>();
const persistedOutcomes = new WeakSet<object>();
const persistedClosures = new WeakSet<object>();
const promotionEvidenceReads = new WeakSet<object>();

export interface RealBuildPrefix50Step44BlindReviewOutputLayout {
  readonly reviewRoot: string;
  readonly publicRoot: string;
  readonly laneARoot: string;
  readonly laneBRoot: string;
  readonly fullResolutionRoot: string;
  readonly closureRoot: string;
  readonly promotionRoot: string;
}

export interface RealBuildPrefix50Step44PersistedReviewEvidence {
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly publicSuccess: RealBuildPrefix50Step44BlindPublicHarnessSuccess;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ];
  readonly outcome: RealBuildPrefix50Step44FullResolutionOutcome;
}

export interface RealBuildPrefix50Step44PersistedPromotionEvidence extends RealBuildPrefix50Step44PersistedReviewEvidence {
  readonly closure: RealBuildPrefix50Step44BlindReviewClosure;
  readonly physicalPage45Verification: RealBuildPrefix50Step44PhysicalPage45Verification;
}

function parseCanonical<T>(root: string, file: string, label: string): T {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(root, file, MAXIMUM_JSON_BYTES, label);
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text) throw new TypeError(`${label} is not canonical JSON.`);
  return value as T;
}

function requireExactFiles(
  root: string,
  expected: readonly string[],
  label: string,
  recoverableFinalNames: readonly string[] = [],
): void {
  const actual = readdirSync(root)
    .filter((file) => !isContainedAtomicWriteTemporaryName(file, recoverableFinalNames))
    .sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((file, index) => file !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function requireLayout(layout: RealBuildPrefix50Step44BlindReviewOutputLayout): void {
  const root = requireRealBuildPrefix50Step44ExactRealDirectory(
    layout.reviewRoot,
    "Step-44 review root",
  );
  const entries = [
    [layout.publicRoot, "public"],
    [layout.laneARoot, "lane-a"],
    [layout.laneBRoot, "lane-b"],
    [layout.fullResolutionRoot, "full-resolution"],
    [layout.closureRoot, "closure"],
    [layout.promotionRoot, "promotion"],
  ] as const;
  const realEntries = entries.map(([path, expectedName]) => {
    const real = requireRealBuildPrefix50Step44ExactRealDirectory(
      path,
      `Step-44 ${expectedName} root`,
    );
    if (dirname(real) !== root || basename(real) !== expectedName)
      throw new TypeError(
        "Step-44 public/lane/full-resolution/closure outputs must be distinct named sibling directories.",
      );
    return real;
  });
  if (new Set(realEntries).size !== realEntries.length)
    throw new TypeError("Step-44 review output directories must be pairwise distinct.");
}

async function ensureExactOutputDirectory(path: string, label: string): Promise<void> {
  try {
    await mkdir(path, { recursive: false });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
  requireRealBuildPrefix50Step44ExactRealDirectory(path, label);
}

function publishExactArtifacts(artifacts: readonly RealBuildPrefix50Step44ExactArtifact[]): void {
  preflightRealBuildPrefix50Step44ExactArtifacts(artifacts);
  for (const artifact of artifacts) writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact);
}

function requirePacketCopy(root: string, packet: RealBuildPrefix50Step44BlindReviewPacket): void {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    root,
    PACKET_COPY_FILE,
    MAXIMUM_JSON_BYTES,
    "Step-44 isolated lane packet copy",
  );
  if (Buffer.from(bytes).toString("utf8") !== canonicalStringify(packet))
    throw new TypeError("Step-44 isolated lane packet copy drifted from the public packet.");
}

function readLane(
  root: string,
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  expectedLane: "lane-a" | "lane-b",
): RealBuildPrefix50Step44BlindDispositionLane {
  requireExactFiles(root, [PACKET_COPY_FILE, LANE_FILE], `Step-44 ${expectedLane} output`);
  requirePacketCopy(root, packet);
  const lane = parseCanonical<RealBuildPrefix50Step44BlindDispositionLane>(
    root,
    LANE_FILE,
    `Step-44 ${expectedLane} persisted disposition`,
  );
  requireRealBuildPrefix50Step44BlindDispositionLane(lane, packet, expectedLane);
  const frozen = deepFreeze(lane);
  persistedLanes.add(frozen);
  return frozen;
}

function readOutcome(
  root: string,
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ],
): RealBuildPrefix50Step44FullResolutionOutcome {
  requireExactFiles(root, [FULL_RESOLUTION_FILE], "Step-44 full-resolution output");
  const outcome = deepFreeze(
    parseCanonical<RealBuildPrefix50Step44FullResolutionOutcome>(
      root,
      FULL_RESOLUTION_FILE,
      "Step-44 persisted full-resolution outcome",
    ),
  );
  requireRealBuildPrefix50Step44FullResolutionOutcome(packet, lanes, outcome);
  persistedOutcomes.add(outcome);
  return outcome;
}

function readEvidence(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): RealBuildPrefix50Step44PersistedReviewEvidence {
  requireLayout(layout);
  const completed = readRealBuildPrefix50Step44CompletedBlindRun({
    reviewRoot: layout.reviewRoot,
    publicRoot: layout.publicRoot,
    withheldRoot: resolve(layout.reviewRoot, "withheld"),
    batch,
    packetArtifactFile: PACKET_FILE,
  });
  requireRealBuildPrefix50Step44CompletedBlindRun(completed);
  const { packet, publicSuccess, publicationComplete } = completed;
  persistedPackets.add(packet);
  const laneA = readLane(layout.laneARoot, packet, "lane-a");
  const laneB = readLane(layout.laneBRoot, packet, "lane-b");
  if (
    laneA.reviewerAttestation.reviewerId === laneB.reviewerAttestation.reviewerId ||
    laneA.reviewerAttestation.reviewSessionId === laneB.reviewerAttestation.reviewSessionId ||
    laneA.reviewerAttestation.commitment === laneB.reviewerAttestation.commitment
  )
    throw new TypeError("Step-44 persisted lanes do not record independent reviewers/sessions.");
  const outcome = readOutcome(layout.fullResolutionRoot, packet, [laneA, laneB]);
  return deepFreeze({
    packet,
    publicSuccess,
    publicationComplete,
    lanes: [laneA, laneB] as const,
    outcome,
  });
}

export function readRealBuildPrefix50Step44PersistedBlindReviewEvidence(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): RealBuildPrefix50Step44PersistedReviewEvidence {
  return readEvidence(layout, batch);
}

export async function writeRealBuildPrefix50Step44BlindLaneOutput(input: {
  readonly publicRoot: string;
  readonly laneRoot: string;
  readonly lane: RealBuildPrefix50Step44BlindDispositionLane;
}): Promise<void> {
  if (basename(resolve(input.laneRoot)) !== input.lane.lane)
    throw new TypeError("Step-44 lane output directory name must equal its lane identity.");
  if (dirname(resolve(input.laneRoot)) !== dirname(resolve(input.publicRoot)))
    throw new TypeError("Step-44 lane output must be a sibling of the public packet root.");
  await ensureExactOutputDirectory(input.laneRoot, `Step-44 ${input.lane.lane} output`);
  const packetBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    PACKET_FILE,
    MAXIMUM_JSON_BYTES,
    "Step-44 public packet copied to isolated lane",
  );
  publishExactArtifacts([
    {
      root: input.laneRoot,
      path: PACKET_COPY_FILE,
      bytes: packetBytes,
      label: `Step-44 ${input.lane.lane} packet copy`,
    },
    {
      root: input.laneRoot,
      path: LANE_FILE,
      bytes: Buffer.from(canonicalStringify(input.lane)),
      label: `Step-44 ${input.lane.lane} disposition`,
    },
  ]);
}

export async function writeRealBuildPrefix50Step44FullResolutionOutput(input: {
  readonly publicRoot: string;
  readonly fullResolutionRoot: string;
  readonly outcome: RealBuildPrefix50Step44FullResolutionOutcome;
}): Promise<void> {
  if (
    basename(resolve(input.fullResolutionRoot)) !== "full-resolution" ||
    dirname(resolve(input.fullResolutionRoot)) !== dirname(resolve(input.publicRoot))
  )
    throw new TypeError("Step-44 full-resolution output must be a named public-root sibling.");
  await ensureExactOutputDirectory(input.fullResolutionRoot, "Step-44 full-resolution output");
  publishExactArtifacts([
    {
      root: input.fullResolutionRoot,
      path: FULL_RESOLUTION_FILE,
      bytes: Buffer.from(canonicalStringify(input.outcome)),
      label: "Step-44 full-resolution outcome",
    },
  ]);
}

function requirePersistedBrands(evidence: RealBuildPrefix50Step44PersistedReviewEvidence): void {
  if (
    !persistedPackets.has(evidence.packet) ||
    !evidence.lanes.every((lane) => persistedLanes.has(lane)) ||
    !persistedOutcomes.has(evidence.outcome)
  )
    throw new TypeError("Step-44 closure accepts only canonical persisted review readers.");
}

function deriveClosure(
  evidence: RealBuildPrefix50Step44PersistedReviewEvidence,
  publicRoot: string,
): RealBuildPrefix50Step44BlindReviewClosure {
  requirePersistedBrands(evidence);
  const pixelReceipt = verifyRealBuildPrefix50Step44BlindShortlistPixels({
    publicRoot,
    packet: evidence.packet,
    blindIds: evidence.outcome.unionShortlist,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-review-closure/2" as const,
    authority: "none" as const,
    fixturePromotionAuthority: false as const,
    storageStatement: REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT,
    blindReviewPacketCommitment: evidence.packet.commitment,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    laneCommitments: [evidence.lanes[0].commitment, evidence.lanes[1].commitment] as const,
    fullResolutionOutcomeCommitment: evidence.outcome.commitment,
    publicHarnessSuccessCommitment: evidence.publicSuccess.commitment,
    publicPixelVerificationCommitment: pixelReceipt.commitment,
    unionShortlist: evidence.outcome.unionShortlist,
    disposition: evidence.outcome.disposition,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export async function createRealBuildPrefix50Step44BlindReviewClosure(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): Promise<RealBuildPrefix50Step44BlindReviewClosure> {
  const evidence = readEvidence(layout, batch);
  requireExactFiles(layout.closureRoot, [], "Step-44 closure output", [CLOSURE_FILE]);
  const closure = deriveClosure(evidence, layout.publicRoot);
  writeOrResumeRealBuildPrefix50Step44ExactArtifact({
    root: layout.closureRoot,
    path: CLOSURE_FILE,
    bytes: Buffer.from(canonicalStringify(closure)),
    label: "Step-44 blind-review closure",
  });
  return readRealBuildPrefix50Step44PersistedBlindClosure(layout, batch);
}

export function readRealBuildPrefix50Step44PersistedBlindClosure(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): RealBuildPrefix50Step44BlindReviewClosure {
  const evidence = readEvidence(layout, batch);
  requireExactFiles(layout.closureRoot, [CLOSURE_FILE], "Step-44 closure output");
  const closure = deepFreeze(
    parseCanonical<RealBuildPrefix50Step44BlindReviewClosure>(
      layout.closureRoot,
      CLOSURE_FILE,
      "Step-44 persisted blind review closure",
    ),
  );
  const expected = deriveClosure(evidence, layout.publicRoot);
  if (canonicalStringify(closure) !== canonicalStringify(expected))
    throw new TypeError("Step-44 persisted blind closure drifted from reopened public evidence.");
  persistedClosures.add(closure);
  return closure;
}

export function requireRealBuildPrefix50Step44PersistedBlindClosure(
  closure: RealBuildPrefix50Step44BlindReviewClosure,
): void {
  if (!persistedClosures.has(closure))
    throw new TypeError("Step-44 promotion requires a runtime-branded persisted closure read.");
}

export async function readRealBuildPrefix50Step44PersistedPromotionEvidence(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  repositoryRoot: string,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  realDomainQualification: import("./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts").RealBuildPrefix50Step44RealDomainQualificationBinding,
): Promise<RealBuildPrefix50Step44PersistedPromotionEvidence> {
  const qualification =
    requireRealBuildPrefix50Step44RealDomainQualificationBinding(realDomainQualification);
  const qualifiedBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(batch);
  const qualifiedRender = await rerenderRealBuildPrefix50Step44QualifiedPhysicalPage45({
    repositoryRoot,
    reviewBatchEnvelopeCommitment: qualifiedBatch.commitment,
    realDomainQualification: qualification,
  });
  const evidence = readEvidence(layout, qualifiedBatch);
  const closure = readRealBuildPrefix50Step44PersistedBlindClosure(layout, qualifiedBatch);
  if (
    closure.blindReviewPacketCommitment !== evidence.packet.commitment ||
    closure.laneCommitments[0] !== evidence.lanes[0].commitment ||
    closure.laneCommitments[1] !== evidence.lanes[1].commitment ||
    closure.fullResolutionOutcomeCommitment !== evidence.outcome.commitment ||
    closure.publicHarnessSuccessCommitment !== evidence.publicSuccess.commitment
  )
    throw new TypeError("Step-44 persisted promotion evidence drifted across disk rereads.");
  const physicalPage45Verification = verifyRealBuildPrefix50Step44PhysicalPage45Provenance({
    publicRoot: layout.publicRoot,
    packet: evidence.packet,
    qualifiedRender,
  });
  const result = deepFreeze({ ...evidence, closure, physicalPage45Verification });
  promotionEvidenceReads.add(result);
  return result;
}

export function requireRealBuildPrefix50Step44PersistedPromotionEvidence(
  evidence: RealBuildPrefix50Step44PersistedPromotionEvidence,
): void {
  if (!promotionEvidenceReads.has(evidence))
    throw new TypeError("Step-44 promotion requires a runtime-branded persisted evidence read.");
}

export const realBuildPrefix50Step44BlindPersistedTestOnly = Object.freeze({
  readEvidence(
    layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
    batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  ) {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 persisted evidence injection is available only to tests.");
    return readEvidence(layout, batch);
  },
  readLane(
    root: string,
    packet: RealBuildPrefix50Step44BlindReviewPacket,
    expectedLane: "lane-a" | "lane-b",
  ) {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 persisted lane injection is available only to tests.");
    return readLane(root, packet, expectedLane);
  },
  readOutcome(
    root: string,
    packet: RealBuildPrefix50Step44BlindReviewPacket,
    lanes: readonly [
      RealBuildPrefix50Step44BlindDispositionLane,
      RealBuildPrefix50Step44BlindDispositionLane,
    ],
  ) {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 persisted outcome injection is available only to tests.");
    return readOutcome(root, packet, lanes);
  },
  constants: { PACKET_FILE, PACKET_COPY_FILE, LANE_FILE, FULL_RESOLUTION_FILE, CLOSURE_FILE },
});
