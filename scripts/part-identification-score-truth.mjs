import { assertPairJudgedTruthFromParsedJson } from "./part-identification-pair-judged.mjs";
import {
  judgedPairs,
  truthVerdictKey,
  verdictsByCropDigest,
} from "./part-identification-truth-key.mjs";

const FULL_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const SHARED_DIGEST_ROLES = [
  "features",
  "match",
  "distances",
  "inventoryLabels",
  "elementResolution",
  "truthFirstFifty",
];
const REQUIRED_SHARED_DIGEST_ROLES = SHARED_DIGEST_ROLES.slice(0, 5);
const VARIANT_DIGEST_ROLES = ["cards", "cardImages", "answers"];

/**
 * Snapshots one score's complete provenance and proves its generation-shared
 * roles still equal the first variant. Cards, card images, and answers remain per-variant;
 * feature, retrieval, inventory, resolution, and truth generations may not
 * change while a summary is being assembled.
 */
export function snapshotScoreSummaryInputDigests(value, label, expectedShared = null) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `Score summary variant ${label} has no inputDigests object. Re-run the score from one authenticated identification generation before comparing variants.`,
    );
  }
  const supported = new Set([...SHARED_DIGEST_ROLES, ...VARIANT_DIGEST_ROLES]);
  const malformed = Object.entries(value).filter(
    ([role, digest]) =>
      !supported.has(role) || typeof digest !== "string" || !FULL_SHA256.test(digest),
  );
  if (malformed.length > 0) {
    throw new Error(
      `Score summary variant ${label} carries unsupported or malformed digest roles ${JSON.stringify(malformed.map(([role]) => role))}. Every retained role must be a full sha256 digest from the score that produced this variant.`,
    );
  }
  const missing = REQUIRED_SHARED_DIGEST_ROLES.filter((role) => !Object.hasOwn(value, role));
  if (missing.length > 0) {
    throw new Error(
      `Score summary variant ${label} is missing shared digest roles ${JSON.stringify(missing)}. Each variant must bind features, match, distances, inventory labels, and element resolution before its numbers can be compared.`,
    );
  }
  const roles = [...SHARED_DIGEST_ROLES, ...VARIANT_DIGEST_ROLES];
  const all = Object.fromEntries(
    roles.filter((role) => Object.hasOwn(value, role)).map((role) => [role, value[role]]),
  );
  const shared = Object.fromEntries(
    SHARED_DIGEST_ROLES.filter((role) => Object.hasOwn(value, role)).map((role) => [
      role,
      value[role],
    ]),
  );
  if (expectedShared !== null) {
    for (const role of SHARED_DIGEST_ROLES) {
      const expected = Object.hasOwn(expectedShared, role) ? expectedShared[role] : null;
      const actual = Object.hasOwn(shared, role) ? shared[role] : null;
      if (actual !== expected) {
        throw new Error(
          `Score summary variant ${label} changed shared input digest ${role} from ${JSON.stringify(expected)} to ${JSON.stringify(actual)}. Stop and rebuild every variant from one immutable identification, inventory, resolution, and truth generation.`,
        );
      }
    }
  }
  return { all, shared };
}

/**
 * Scores only verdicts bound to the exact current crop-and-element pair.
 * Similarity-cluster membership never transfers a judgement between crops.
 */
export function scoreAgainstTruth(truth, features, _match, claims, names) {
  assertPairJudgedTruthFromParsedJson(truth, "Part-identification score truth");
  const { bound: verdicts } = verdictsByCropDigest(truth);
  const lastStep = truth.lastStep ?? 50;
  const pairs = judgedPairs(features, claims, lastStep);
  const rows = [];
  const currentClaimKeys = new Set();
  for (const [index, callout] of features.callouts.entries()) {
    if (callout.evidenceKind !== "part-art") continue;
    if (callout.stepNumber === null || callout.stepNumber > lastStep) continue;
    const claim = claims.get(index);
    if (claim?.elementId !== null && claim?.elementId !== undefined) {
      currentClaimKeys.add(truthVerdictKey(callout.sha256, claim.elementId));
    }
    const pair =
      claim?.elementId === null || claim?.elementId === undefined
        ? null
        : (pairs.get(truthVerdictKey(callout.sha256, claim.elementId)) ?? null);
    const exactPair = pair !== null && callout.sha256 === pair.leadSha256 ? pair : null;
    const verdict =
      exactPair === null || exactPair.elementId === null
        ? null
        : (verdicts.get(truthVerdictKey(exactPair.leadSha256, exactPair.elementId)) ?? null);
    rows.push({
      file: callout.file,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      clusterIndex: claim?.clusterIndex ?? null,
      judgedCropSha256: verdict === null ? null : exactPair.leadSha256,
      claimedElement: claim?.elementId ?? null,
      claimedName: claim?.elementId ? (names.get(claim.elementId)?.name ?? null) : null,
      verdict: verdict === null ? "unjudged" : verdict.same === true ? "same" : "different",
    });
  }
  const judged = rows.filter(({ verdict }) => verdict !== "unjudged");
  const correct = judged.filter(({ verdict }) => verdict === "same");
  const drawings = new Set(judged.map(({ judgedCropSha256 }) => judgedCropSha256));
  const unboundVerdicts = truth.verdicts
    .filter(
      (verdict) =>
        !currentClaimKeys.has(truthVerdictKey(verdict.judgedCropSha256, verdict.elementId)),
    )
    .map((verdict) => ({
      n: verdict.n,
      judgedCropSha256: verdict.judgedCropSha256,
      judgedElementId: verdict.elementId,
      reason:
        "no current physical callout in the judged range claims this exact crop as this element",
    }));
  return {
    method: truth.method,
    labelSource: truth.note,
    lastStep,
    calloutsInRange: rows.length,
    calloutsJudged: judged.length,
    calloutsUnjudged: rows.length - judged.length,
    verdictsUnboundToCurrentClaims: unboundVerdicts.length,
    unboundVerdicts: unboundVerdicts.slice(0, 200),
    unboundVerdictsTruncated: Math.max(0, unboundVerdicts.length - 200),
    drawingsJudged: drawings.size,
    correct: correct.length,
    accuracy: judged.length === 0 ? 0 : correct.length / judged.length,
    piecesJudged: judged.reduce((total, row) => total + row.quantity, 0),
    piecesCorrect: correct.reduce((total, row) => total + row.quantity, 0),
    misses: judged.filter(({ verdict }) => verdict !== "same"),
    rows,
  };
}
