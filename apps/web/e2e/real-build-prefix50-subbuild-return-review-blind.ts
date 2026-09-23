import { createHash, createHmac, randomBytes } from "node:crypto";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT,
  type RealBuildPrefix50Step44BlindCriterionDisposition,
  type RealBuildPrefix50Step44BlindDispositionLane,
  type RealBuildPrefix50Step44BlindDispositionRow,
  type RealBuildPrefix50Step44BlindId,
  type RealBuildPrefix50Step44BlindReviewPacket,
  type RealBuildPrefix50Step44FullResolutionOutcome,
  type RealBuildPrefix50Step44FullResolutionReviewRow,
  type RealBuildPrefix50Step44Page45CriterionId,
  type RealBuildPrefix50Step44ReviewOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { requireRealBuildPrefix50Step44BlindReviewPacket } from "./real-build-prefix50-subbuild-return-review-blind-packet.ts";
import { requireRealBuildPrefix50Step44BlindDispositionLane } from "./real-build-prefix50-subbuild-return-review-blind-lane.ts";
import type {
  RealBuildPrefix50Step44BlindDispatchPlan,
  RealBuildPrefix50Step44WithheldUnblindingMap,
} from "./real-build-prefix50-subbuild-return-review-blind-unblinding-contract.ts";

export type {
  RealBuildPrefix50Step44BlindDispatchAssignment,
  RealBuildPrefix50Step44BlindDispatchPlan,
  RealBuildPrefix50Step44WithheldUnblindingMap,
  RealBuildPrefix50Step44WithheldUnblindingRow,
} from "./real-build-prefix50-subbuild-return-review-blind-unblinding-contract.ts";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const FORBIDDEN_LATER_SOURCE =
  /\bstep[\s_-]*(?:45|forty[\s-]*five)\b|\bpage[\s_-]*(?:46|forty[\s-]*six)\b/iu;
const FORBIDDEN_IDENTITY_REFERENCE =
  /\b(?:candidate|document|doc|key|hash|roster|operations?|op|sha256|batch[\s_-]*index)\b/iu;

interface CapturedUnblindingBinding {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly batchIndex: number;
  readonly artifactDirectory: string;
  readonly rosterIndex: number;
  readonly candidateKey: string;
  readonly operationsCommitment: `sha256:${string}`;
  readonly compactCandidateCommitment: `sha256:${string}`;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly captureManifestFile: string;
  readonly captureManifestByteDigest: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
  readonly sourceRowCommitment: `sha256:${string}`;
}

function withoutCommitment<T extends { readonly commitment: unknown }>(value: T) {
  const body = { ...value } as T & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function realBuildPrefix50Step44BlindId(index: number): RealBuildPrefix50Step44BlindId {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT
  )
    throw new RangeError("Step-44 blind index must be an integer from 0 through 210.");
  return `B${String(index + 1).padStart(3, "0")}`;
}

function requireExactBlindRoster(ids: readonly RealBuildPrefix50Step44BlindId[]): void {
  if (
    ids.length !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT ||
    ids.some((id, index) => id !== realBuildPrefix50Step44BlindId(index))
  )
    throw new TypeError("Step-44 blinded review requires the exact ordered B001..B211 roster.");
}

function rank(seed: Uint8Array, candidateCommitment: string): `sha256:${string}` {
  return `sha256:${createHmac("sha256", seed).update(candidateCommitment).digest("hex")}`;
}

function createBlindDispatchPlan(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  seedBytes: Uint8Array,
): RealBuildPrefix50Step44BlindDispatchPlan {
  if (
    batch.candidateCount !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT ||
    batch.candidates.length !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT
  )
    throw new TypeError("Step-44 blinding requires the complete exact 211-candidate batch.");
  const seed = Buffer.from(seedBytes);
  if (seed.length !== 32)
    throw new RangeError("Step-44 blinding seed must contain exactly 32 bytes.");
  const ranked = batch.candidates
    .map((candidate, batchIndex) => ({
      batchIndex,
      rankDigest: rank(seed, candidate.commitment),
      tieBreaker: candidate.commitment,
    }))
    .sort((left, right) =>
      left.rankDigest === right.rankDigest
        ? left.tieBreaker.localeCompare(right.tieBreaker)
        : left.rankDigest.localeCompare(right.rankDigest),
    );
  if (new Set(ranked.map(({ rankDigest }) => rankDigest)).size !== ranked.length)
    throw new Error("Step-44 blinding produced a rank collision; use a fresh blinding seed.");
  const assignments = ranked.map(({ batchIndex, rankDigest }, blindIndex) => ({
    blindId: realBuildPrefix50Step44BlindId(blindIndex),
    batchIndex,
    rankDigest,
  }));
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-dispatch-plan/1" as const,
    authority: "none" as const,
    blindingSeedHex: Buffer.from(seed).toString("hex"),
    reviewBatchEnvelopeCommitment: batch.commitment,
    candidateCount: REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
    assignments,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function createRealBuildPrefix50Step44BlindDispatchPlan(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): RealBuildPrefix50Step44BlindDispatchPlan {
  if (arguments.length !== 1)
    throw new TypeError("Step-44 production blinding accepts only its closed batch input.");
  return createBlindDispatchPlan(batch, randomBytes(32));
}

export function requireRealBuildPrefix50Step44BlindDispatchPlan(
  plan: RealBuildPrefix50Step44BlindDispatchPlan,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): void {
  const seed = Buffer.from(plan.blindingSeedHex, "hex");
  const expected = createBlindDispatchPlan(batch, seed);
  if (canonicalStringify(plan) !== canonicalStringify(expected))
    throw new TypeError("Step-44 dispatch plan is not the exact seed-ranked batch permutation.");
}

export const realBuildPrefix50Step44BlindTestOnly = Object.freeze({
  createDispatchPlan(
    batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
    seed: Uint8Array,
  ): RealBuildPrefix50Step44BlindDispatchPlan {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError(
        "Deterministic Step-44 blinding seed injection is available only to tests.",
      );
    return createBlindDispatchPlan(batch, seed);
  },
});

export function createRealBuildPrefix50Step44WithheldUnblindingMap(input: {
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly captures: readonly CapturedUnblindingBinding[];
  readonly publicPacketCoreCommitment: `sha256:${string}`;
}): RealBuildPrefix50Step44WithheldUnblindingMap {
  const { batch, plan, captures } = input;
  if (
    plan.reviewBatchEnvelopeCommitment !== batch.commitment ||
    plan.commitment !== canonicalDigest(withoutCommitment(plan)) ||
    !SHA256.test(input.publicPacketCoreCommitment) ||
    captures.length !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT
  )
    throw new TypeError("Step-44 withheld map requires its exact committed 211-row dispatch plan.");
  requireExactBlindRoster(captures.map(({ blindId }) => blindId));
  const seed = Buffer.from(plan.blindingSeedHex, "hex");
  if (seed.length !== 32 || seed.toString("hex") !== plan.blindingSeedHex)
    throw new TypeError("Step-44 dispatch plan contains a malformed blinding seed.");
  const rows = captures.map((capture, blindIndex) => {
    const assignment = plan.assignments[blindIndex]!;
    const compact = batch.candidates[assignment.batchIndex]!;
    const roster = batch.rosterSummary.candidates[compact.rosterIndex]!;
    if (
      assignment.blindId !== capture.blindId ||
      assignment.batchIndex !== capture.batchIndex ||
      assignment.rankDigest !== rank(seed, compact.commitment) ||
      capture.artifactDirectory !== capture.blindId ||
      capture.rosterIndex !== compact.rosterIndex ||
      capture.candidateKey !== compact.candidateKey ||
      capture.operationsCommitment !== compact.operationsCommitment ||
      capture.compactCandidateCommitment !== compact.commitment ||
      capture.selectedDocumentHash !== roster.selectedDocumentHash ||
      capture.selectedDocumentCommitment !== roster.selectedDocumentCommitment ||
      capture.reviewHarnessEnvelopeCommitment !== roster.reviewHarnessEnvelopeCommitment ||
      !SHA256.test(capture.captureManifestByteDigest) ||
      !SHA256.test(capture.captureManifestCommitment) ||
      !SHA256.test(capture.sourceRowCommitment)
    )
      throw new TypeError(
        `Step-44 withheld map row ${capture.blindId} drifted from its shuffled batch/capture binding.`,
      );
    const body = { ...capture, rankDigest: assignment.rankDigest };
    return deepFreeze({ ...body, commitment: canonicalDigest(body) });
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-withheld-unblinding-map/1" as const,
    authority: "none" as const,
    publicDuringReview: false as const,
    sourceSetId: "6651557" as const,
    dispatchPlanCommitment: plan.commitment,
    blindingSeedHex: plan.blindingSeedHex,
    reviewBatchEnvelopeCommitment: batch.commitment,
    returnResultCommitment: batch.returnResultCommitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    publicPacketCoreCommitment: input.publicPacketCoreCommitment,
    candidateCount: REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
    rows,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

function requireNote(note: string, label: string): void {
  if (note.trim() !== note || note.length < 1 || note.length > 500)
    throw new TypeError(`${label} must contain 1..500 trimmed characters.`);
  if (FORBIDDEN_LATER_SOURCE.test(note))
    throw new TypeError(`${label} may not cite printed Step 45 or physical PDF page 46.`);
  if (FORBIDDEN_IDENTITY_REFERENCE.test(note))
    throw new TypeError(
      `${label} may not cite candidate, document, roster, or operation identity.`,
    );
}

function criterionDisposition(input: {
  readonly criterionId: RealBuildPrefix50Step44Page45CriterionId;
  readonly outcome: RealBuildPrefix50Step44ReviewOutcome;
  readonly note: string;
}): RealBuildPrefix50Step44BlindCriterionDisposition {
  requireNote(input.note, `Step-44 ${input.criterionId} note`);
  if (!(["same", "different", "not-observable"] as const).includes(input.outcome))
    throw new TypeError(`Step-44 ${input.criterionId} outcome is outside the closed vocabulary.`);
  return deepFreeze({ ...input, commitment: canonicalDigest(input) });
}

function normalizeCriteria(
  input: readonly {
    readonly criterionId: RealBuildPrefix50Step44Page45CriterionId;
    readonly outcome: RealBuildPrefix50Step44ReviewOutcome;
    readonly note: string;
  }[],
): readonly RealBuildPrefix50Step44BlindCriterionDisposition[] {
  if (
    input.length !== REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA.length ||
    input.some(
      ({ criterionId }, index) =>
        criterionId !== REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA[index]!.id,
    )
  )
    throw new TypeError("Step-44 disposition must answer every closed page-45 criterion in order.");
  return input.map(criterionDisposition);
}

function qualifiesForShortlist(
  criteria: readonly RealBuildPrefix50Step44BlindCriterionDisposition[],
): boolean {
  return criteria.every(({ outcome }) => outcome !== "different");
}

function qualifiesForFinalSurvival(
  criteria: readonly RealBuildPrefix50Step44BlindCriterionDisposition[],
): boolean {
  return criteria.every(({ outcome }) => outcome === "same");
}

export function createRealBuildPrefix50Step44BlindDispositionLane(input: {
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly lane: "lane-a" | "lane-b";
  readonly reviewerId: string;
  readonly reviewSessionId: string;
  readonly rows: readonly {
    readonly blindId: RealBuildPrefix50Step44BlindId;
    readonly criteria: readonly {
      readonly criterionId: RealBuildPrefix50Step44Page45CriterionId;
      readonly outcome: RealBuildPrefix50Step44ReviewOutcome;
      readonly note: string;
    }[];
    readonly shortlisted: boolean;
    readonly shortlistNote: string;
  }[];
}): RealBuildPrefix50Step44BlindDispositionLane {
  requireRealBuildPrefix50Step44BlindReviewPacket(input.packet);
  requireExactBlindRoster(input.rows.map(({ blindId }) => blindId));
  requireNote(input.reviewerId, `Step-44 ${input.lane} reviewer ID`);
  requireNote(input.reviewSessionId, `Step-44 ${input.lane} review session ID`);
  const rows: RealBuildPrefix50Step44BlindDispositionRow[] = input.rows.map((row) => {
    const criteria = normalizeCriteria(row.criteria);
    requireNote(row.shortlistNote, `Step-44 ${input.lane} ${row.blindId} shortlist note`);
    if (row.shortlisted !== qualifiesForShortlist(criteria))
      throw new TypeError(
        `Step-44 ${input.lane} ${row.blindId} shortlist must equal the closed page-45 outcome rule.`,
      );
    const body = { ...row, criteria };
    return deepFreeze({ ...body, commitment: canonicalDigest(body) });
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-disposition-lane/1" as const,
    authority: "none" as const,
    lane: input.lane,
    reviewerAttestation: (() => {
      const attestationBody = {
        reviewerId: input.reviewerId,
        reviewSessionId: input.reviewSessionId,
        statement:
          "I independently reviewed every blinded row using only the committed page-45 source policy." as const,
      };
      return deepFreeze({
        ...attestationBody,
        commitment: canonicalDigest(attestationBody),
      });
    })(),
    blindReviewPacketCommitment: input.packet.commitment,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    candidateCount: REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
    rows,
    shortlist: rows.filter(({ shortlisted }) => shortlisted).map(({ blindId }) => blindId),
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

function packetCells(packet: RealBuildPrefix50Step44BlindReviewPacket) {
  return new Map(
    packet.pages.flatMap((page) =>
      page.rows.map(
        (row) =>
          [
            row.blindId,
            {
              cells: row.cells.map(({ commitment }) => commitment),
              fixedCameraEvidenceCommitment: row.fixedCameraEvidence.commitment,
            },
          ] as const,
      ),
    ),
  );
}

export function createRealBuildPrefix50Step44FullResolutionOutcome(input: {
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ];
  readonly fullResolutionReviews: readonly {
    readonly blindId: RealBuildPrefix50Step44BlindId;
    readonly reviewedCellCommitments: readonly `sha256:${string}`[];
    readonly reviewedFixedCameraEvidenceCommitment: `sha256:${string}`;
    readonly criteria: readonly {
      readonly criterionId: RealBuildPrefix50Step44Page45CriterionId;
      readonly outcome: RealBuildPrefix50Step44ReviewOutcome;
      readonly note: string;
    }[];
    readonly survives: boolean;
    readonly note: string;
  }[];
  readonly disposition:
    | Readonly<{
        readonly kind: "selected-one";
        readonly blindId: RealBuildPrefix50Step44BlindId;
        readonly note: string;
      }>
    | Readonly<{ readonly kind: "refused"; readonly reason: string }>;
}): RealBuildPrefix50Step44FullResolutionOutcome {
  requireRealBuildPrefix50Step44BlindReviewPacket(input.packet);
  const [first, second] = input.lanes;
  requireRealBuildPrefix50Step44BlindDispositionLane(first, input.packet, "lane-a");
  requireRealBuildPrefix50Step44BlindDispositionLane(second, input.packet, "lane-b");
  if (
    first.lane !== "lane-a" ||
    second.lane !== "lane-b" ||
    first.reviewerAttestation.reviewerId === second.reviewerAttestation.reviewerId ||
    first.reviewerAttestation.reviewSessionId === second.reviewerAttestation.reviewSessionId ||
    first.reviewerAttestation.commitment === second.reviewerAttestation.commitment ||
    first.reviewerAttestation.commitment !==
      canonicalDigest(withoutCommitment(first.reviewerAttestation)) ||
    second.reviewerAttestation.commitment !==
      canonicalDigest(withoutCommitment(second.reviewerAttestation)) ||
    first.blindReviewPacketCommitment !== input.packet.commitment ||
    second.blindReviewPacketCommitment !== input.packet.commitment ||
    first.commitment !== canonicalDigest(withoutCommitment(first)) ||
    second.commitment !== canonicalDigest(withoutCommitment(second))
  )
    throw new TypeError("Step-44 closure requires exact independent lane-a and lane-b receipts.");
  const unionShortlist = [...new Set([...first.shortlist, ...second.shortlist])].sort();
  const reviewIds = input.fullResolutionReviews.map(({ blindId }) => blindId);
  if (
    reviewIds.length !== unionShortlist.length ||
    reviewIds.some((id, index) => id !== unionShortlist[index])
  )
    throw new TypeError("Step-44 full-resolution review must cover the exact sorted lane union.");
  const cells = packetCells(input.packet);
  const fullResolutionReviews: RealBuildPrefix50Step44FullResolutionReviewRow[] =
    input.fullResolutionReviews.map((row) => {
      const criteria = normalizeCriteria(row.criteria);
      requireNote(row.note, `Step-44 full-resolution ${row.blindId} note`);
      const expectedSources = cells.get(row.blindId);
      if (
        expectedSources === undefined ||
        row.reviewedCellCommitments.length !== expectedSources.cells.length ||
        row.reviewedCellCommitments.some(
          (value, index) => value !== expectedSources.cells[index],
        ) ||
        row.reviewedFixedCameraEvidenceCommitment !== expectedSources.fixedCameraEvidenceCommitment
      )
        throw new TypeError(
          `Step-44 full-resolution ${row.blindId} must reopen all exact source cells.`,
        );
      if (row.survives !== qualifiesForFinalSurvival(criteria))
        throw new TypeError(
          `Step-44 full-resolution ${row.blindId} survival must equal the closed page-45 outcome rule.`,
        );
      const body = { ...row, criteria };
      return deepFreeze({ ...body, commitment: canonicalDigest(body) });
    });
  const survivors = fullResolutionReviews.filter(({ survives }) => survives);
  if (input.disposition.kind === "selected-one") {
    requireNote(input.disposition.note, "Step-44 selected-one note");
    if (survivors.length !== 1 || survivors[0]!.blindId !== input.disposition.blindId)
      throw new TypeError("Step-44 selected-one closure requires exactly its one named survivor.");
  } else {
    requireNote(input.disposition.reason, "Step-44 refusal reason");
    if (survivors.length === 1)
      throw new TypeError(
        "Step-44 refusal closure is invalid when exactly one fully observed candidate survives.",
      );
  }
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-full-resolution-outcome/1" as const,
    authority: "none" as const,
    fixturePromotionAuthority: false as const,
    storageStatement: REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT,
    blindReviewPacketCommitment: input.packet.commitment,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    laneCommitments: [first.commitment, second.commitment] as const,
    unionShortlist,
    fullResolutionReviews,
    disposition: input.disposition,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function sha256RealBuildPrefix50Step44BlindBytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
