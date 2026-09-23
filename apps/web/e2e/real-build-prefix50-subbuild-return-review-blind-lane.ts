import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  type RealBuildPrefix50Step44BlindDispositionLane,
  type RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";

const FORBIDDEN_LATER_SOURCE =
  /\bstep[\s_-]*(?:45|forty[\s-]*five)\b|\bpage[\s_-]*(?:46|forty[\s-]*six)\b/iu;
const FORBIDDEN_IDENTITY_REFERENCE =
  /\b(?:candidate|document|doc|key|hash|roster|operations?|op|sha256|batch[\s_-]*index)\b/iu;
const ATTESTATION =
  "I independently reviewed every blinded row using only the committed page-45 source policy.";

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function requireBlindSafeText(value: string, label: string): void {
  if (
    value.trim() !== value ||
    value.length < 1 ||
    value.length > 500 ||
    FORBIDDEN_LATER_SOURCE.test(value) ||
    FORBIDDEN_IDENTITY_REFERENCE.test(value)
  )
    throw new TypeError(`${label} is empty, unbounded, later-step-derived, or identity-bearing.`);
}

export function requireRealBuildPrefix50Step44BlindDispositionLane(
  lane: RealBuildPrefix50Step44BlindDispositionLane,
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  expectedLane: "lane-a" | "lane-b",
): void {
  exactKeys(
    lane,
    [
      "authority",
      "blindReviewPacketCommitment",
      "candidateCount",
      "commitment",
      "lane",
      "page45SourcePolicyCommitment",
      "reviewerAttestation",
      "rows",
      "schemaVersion",
      "shortlist",
    ],
    `Step-44 ${expectedLane}`,
  );
  exactKeys(
    lane.reviewerAttestation,
    ["commitment", "reviewerId", "reviewSessionId", "statement"],
    `Step-44 ${expectedLane} attestation`,
  );
  requireBlindSafeText(lane.reviewerAttestation.reviewerId, `Step-44 ${expectedLane} reviewer ID`);
  requireBlindSafeText(
    lane.reviewerAttestation.reviewSessionId,
    `Step-44 ${expectedLane} session ID`,
  );
  if (
    lane.schemaVersion !== "lego.real-build-prefix50-step44-blind-disposition-lane/1" ||
    lane.authority !== "none" ||
    lane.lane !== expectedLane ||
    lane.blindReviewPacketCommitment !== packet.commitment ||
    lane.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    lane.candidateCount !== 211 ||
    lane.rows.length !== 211 ||
    lane.reviewerAttestation.statement !== ATTESTATION ||
    lane.reviewerAttestation.commitment !==
      canonicalDigest(withoutCommitment(lane.reviewerAttestation)) ||
    lane.commitment !== canonicalDigest(withoutCommitment(lane))
  )
    throw new TypeError(`Step-44 ${expectedLane} header, attestation, or commitment drifted.`);
  const expectedShortlist: string[] = [];
  for (const [index, row] of lane.rows.entries()) {
    const expectedBlindId = `B${String(index + 1).padStart(3, "0")}`;
    exactKeys(
      row,
      ["blindId", "commitment", "criteria", "shortlistNote", "shortlisted"],
      `Step-44 ${expectedLane} ${expectedBlindId}`,
    );
    if (
      row.blindId !== expectedBlindId ||
      row.criteria.length !== REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA.length ||
      row.commitment !== canonicalDigest(withoutCommitment(row))
    )
      throw new TypeError(`Step-44 ${expectedLane} ${expectedBlindId} row drifted.`);
    requireBlindSafeText(
      row.shortlistNote,
      `Step-44 ${expectedLane} ${expectedBlindId} shortlist note`,
    );
    for (const [criterionIndex, criterion] of row.criteria.entries()) {
      exactKeys(
        criterion,
        ["commitment", "criterionId", "note", "outcome"],
        `Step-44 ${expectedLane} ${expectedBlindId} criterion ${criterionIndex + 1}`,
      );
      if (
        criterion.criterionId !==
          REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA[criterionIndex]!.id ||
        !(["same", "different", "not-observable"] as const).includes(criterion.outcome) ||
        criterion.commitment !== canonicalDigest(withoutCommitment(criterion))
      )
        throw new TypeError(
          `Step-44 ${expectedLane} ${expectedBlindId} criterion ${criterionIndex + 1} drifted.`,
        );
      requireBlindSafeText(
        criterion.note,
        `Step-44 ${expectedLane} ${expectedBlindId} criterion note`,
      );
    }
    const expected = row.criteria.every(({ outcome }) => outcome !== "different");
    if (row.shortlisted !== expected)
      throw new TypeError(`Step-44 ${expectedLane} ${expectedBlindId} shortlist rule drifted.`);
    if (row.shortlisted) expectedShortlist.push(row.blindId);
  }
  if (
    lane.shortlist.length !== expectedShortlist.length ||
    lane.shortlist.some((id, index) => id !== expectedShortlist[index])
  )
    throw new TypeError(`Step-44 ${expectedLane} shortlist does not equal its exact 211 rows.`);
}
