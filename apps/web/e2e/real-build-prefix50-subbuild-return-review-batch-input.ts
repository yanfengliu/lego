import { canonicalDigest, documentStructuralHash } from "@lego-studio/brick-kernel";
import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import { validateBuildOperation, validateBrickDocumentV1 } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SubBuildReturnCompactReviewCandidate,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt,
  RealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import { REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS } from "./real-build-prefix50-subbuild-return-work-limits.ts";
import {
  requireRealBuildPrefix50Step44CandidatePacketAccounting,
  requireRealBuildPrefix50Step44EnumerationAccounting,
} from "./real-build-prefix50-subbuild-return-review-batch-accounting.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_CANDIDATE_COUNT,
  realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment,
  realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment,
  realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment,
  realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment,
} from "./real-build-prefix50-subbuild-return-review-batch.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REPLAY_BASE_REVISION_POLICY,
  hydrateRealBuildPrefix50Step44ReviewEnvelope,
  realBuildPrefix50Step44SyntheticReviewReplayRevision,
} from "./real-build-prefix50-subbuild-return-review-batch-replay.ts";

const CANDIDATE_KEY = /^[0-9a-f]{64}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const FINAL_REVISION = /^revision-[0-9a-f]{24}$/u;
const WORK_LIMIT_KEYS = [
  "maxCandidateDocuments",
  "maxConnectorPairingChecks",
  "maxCrossConnectionChecks",
  "maxCrossEdgesPerCandidate",
  "maxDistinctGroupDeltas",
  "maxDocumentConnections",
  "maxDocumentParts",
  "maxTransformedChildParts",
] as const;
const COUNT_KEYS = [
  "accepted",
  "axisCompatiblePairingSeeds",
  "candidateValidationRuns",
  "childParts",
  "connectorPairingChecks",
  "crossConnectionChecks",
  "distinctGroupDeltas",
  "duplicateDeltaSeeds",
  "exactCrossEdgesDiscovered",
  "existingInternalEdges",
  "freeChildConnectors",
  "freeParentConnectors",
  "groupDeltasVisited",
  "parentParts",
  "properGroupOrientations",
  "rejectedBelowGround",
  "rejectedCollision",
  "rejectedConnectorCapacityConflict",
  "rejectedDisconnected",
  "rejectedIllegalPartOrientation",
  "rejectedNoCrossEdge",
  "rejectedNonIntegralDeltaSeeds",
  "rejectedOtherBlockingValidation",
  "rejectedTransformPolicy",
  "transformedChildPartComputations",
] as const;

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    throw new TypeError(`${label} must be a data object.`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function requireDigest(value: unknown, label: string): void {
  if (typeof value !== "string" || !SHA256.test(value))
    throw new TypeError(`${label} must be an exact sha256 digest.`);
}

function requireRosterSummary(value: unknown): RealBuildPrefix50SubBuildReturnReviewRosterSummary {
  exactKeys(
    value,
    [
      "authority",
      "candidateCount",
      "candidateRosterCommitment",
      "candidates",
      "commitment",
      "enumerationComplete",
      "fixturePromotionAuthority",
      "returnResultCommitment",
      "schemaVersion",
      "selectionAuthority",
      "sourceDocumentHash",
      "sourceSetId",
    ],
    "Step-44 review roster summary",
  );
  const summary = value as RealBuildPrefix50SubBuildReturnReviewRosterSummary;
  if (
    summary.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-roster/1" ||
    summary.authority !== "none" ||
    summary.selectionAuthority !== false ||
    summary.fixturePromotionAuthority !== false ||
    summary.sourceSetId !== "6651557" ||
    summary.enumerationComplete !== true ||
    !Number.isSafeInteger(summary.candidateCount) ||
    summary.candidateCount < 1 ||
    summary.candidateCount > REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES ||
    !Array.isArray(summary.candidates) ||
    summary.candidates.length !== summary.candidateCount
  )
    throw new TypeError("Step-44 review roster summary must describe one complete bounded roster.");
  for (const [label, digest] of [
    ["returnResultCommitment", summary.returnResultCommitment],
    ["candidateRosterCommitment", summary.candidateRosterCommitment],
    ["sourceDocumentHash", summary.sourceDocumentHash],
    ["commitment", summary.commitment],
  ] as const)
    requireDigest(digest, `Step-44 review roster summary.${label}`);
  const properOrientationIds = new Set(PROPER_ORIENTATIONS.map(({ id }) => id));
  const descriptors = summary.candidates.map((candidate, index) => {
    exactKeys(
      candidate,
      [
        "candidateKey",
        "crossPorts",
        "groupDelta",
        "reviewHarnessEnvelopeCommitment",
        "rosterIndex",
        "selectedDocumentCommitment",
        "selectedDocumentHash",
      ],
      `Step-44 review roster candidate ${index}`,
    );
    exactKeys(candidate.groupDelta, ["orientationId", "positionLdu"], "candidate group delta");
    if (
      candidate.rosterIndex !== index ||
      !CANDIDATE_KEY.test(candidate.candidateKey) ||
      !Array.isArray(candidate.groupDelta.positionLdu) ||
      candidate.groupDelta.positionLdu.length !== 3 ||
      !candidate.groupDelta.positionLdu.every(Number.isSafeInteger) ||
      !properOrientationIds.has(candidate.groupDelta.orientationId) ||
      !Array.isArray(candidate.crossPorts) ||
      candidate.crossPorts.length < 1 ||
      candidate.crossPorts.length > 4_096
    )
      throw new TypeError(`Step-44 review roster candidate ${index} is structurally invalid.`);
    for (const [portIndex, port] of candidate.crossPorts.entries()) {
      exactKeys(
        port,
        ["aPartId", "aPortId", "bPartId", "bPortId"],
        `Step-44 review roster candidate ${index} cross port ${portIndex}`,
      );
      if (
        Object.values(port).some(
          (field) => typeof field !== "string" || field.length < 1 || field.length > 512,
        )
      )
        throw new TypeError(
          `Step-44 review roster candidate ${index} cross port ${portIndex} is invalid.`,
        );
    }
    for (const [label, digest] of [
      ["selectedDocumentHash", candidate.selectedDocumentHash],
      ["selectedDocumentCommitment", candidate.selectedDocumentCommitment],
      ["reviewHarnessEnvelopeCommitment", candidate.reviewHarnessEnvelopeCommitment],
    ] as const)
      requireDigest(digest, `Step-44 review roster candidate ${index}.${label}`);
    return {
      candidateKey: candidate.candidateKey,
      groupDelta: candidate.groupDelta,
      crossPorts: candidate.crossPorts,
    };
  });
  if (
    new Set(summary.candidates.map(({ candidateKey }) => candidateKey)).size !==
      summary.candidates.length ||
    summary.candidateRosterCommitment !== canonicalDigest(descriptors)
  )
    throw new TypeError(
      "Step-44 review roster summary does not bind one unique row for the exact candidate roster.",
    );
  const body = { ...summary } as typeof summary & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (summary.commitment !== realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment(body))
    throw new TypeError("Step-44 review roster-summary self commitment is inconsistent.");
  return summary;
}

function requireEnumerationReceipt(
  value: unknown,
  candidateCount: number,
): RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt {
  exactKeys(
    value,
    [
      "childPartIds",
      "commitment",
      "counts",
      "enumerationSchemaVersion",
      "schemaVersion",
      "sourceDocumentHash",
      "workLimits",
    ],
    "Step-44 review enumeration receipt",
  );
  const receipt = value as RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt;
  exactKeys(receipt.workLimits, WORK_LIMIT_KEYS, "Step-44 review enumeration work limits");
  exactKeys(receipt.counts, COUNT_KEYS, "Step-44 review enumeration counts");
  requireDigest(receipt.sourceDocumentHash, "Step-44 review enumeration sourceDocumentHash");
  requireDigest(receipt.commitment, "Step-44 review enumeration commitment");
  const childPartIds = receipt.childPartIds;
  const counts = receipt.counts;
  const numericCounts = COUNT_KEYS.map((key) => counts[key]);
  if (
    receipt.schemaVersion !==
      "lego.real-build-prefix50-subbuild-return-review-enumeration-receipt/1" ||
    receipt.enumerationSchemaVersion !== "lego.rigid-subassembly-return-enumeration/1" ||
    !Array.isArray(childPartIds) ||
    childPartIds.length !== 23 ||
    childPartIds.some(
      (partId, index) =>
        typeof partId !== "string" ||
        partId.length < 1 ||
        partId.length > 512 ||
        (index > 0 && childPartIds[index - 1]! >= partId),
    ) ||
    numericCounts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    canonicalDigest(receipt.workLimits) !==
      canonicalDigest(REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS)
  )
    throw new TypeError(
      "Step-44 review enumeration receipt must bind complete, exhaustive, bounded 257+23 accounting.",
    );
  requireRealBuildPrefix50Step44EnumerationAccounting(receipt, candidateCount);
  const body = { ...receipt } as typeof receipt & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (
    receipt.commitment !== realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment(body)
  )
    throw new TypeError("Step-44 review enumeration-receipt self commitment is inconsistent.");
  return receipt;
}

function requireCompactCandidate(
  value: unknown,
  index: number,
  candidateCount: number,
): RealBuildPrefix50SubBuildReturnCompactReviewCandidate {
  exactKeys(
    value,
    [
      "candidateKey",
      "commitment",
      "operations",
      "operationsCommitment",
      "rosterIndex",
      "selectedDocumentRevision",
    ],
    `Step-44 compact candidate ${index}`,
  );
  const row = value as RealBuildPrefix50SubBuildReturnCompactReviewCandidate;
  requireDigest(
    row.operationsCommitment,
    `Step-44 compact candidate ${index}.operationsCommitment`,
  );
  requireDigest(row.commitment, `Step-44 compact candidate ${index}.commitment`);
  if (
    !CANDIDATE_KEY.test(row.candidateKey) ||
    !Number.isSafeInteger(row.rosterIndex) ||
    row.rosterIndex < 0 ||
    row.rosterIndex >= candidateCount ||
    !Array.isArray(row.operations) ||
    row.operations.length < 24 ||
    row.operations.length >
      23 + REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS.maxCrossEdgesPerCandidate ||
    !FINAL_REVISION.test(row.selectedDocumentRevision) ||
    row.operations.some((operation) => !validateBuildOperation(operation)) ||
    row.operationsCommitment !== canonicalDigest(row.operations)
  )
    throw new TypeError(
      `Step-44 compact candidate ${index} must contain one bounded exact replay operation packet.`,
    );
  const body = { ...row } as typeof row & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (row.commitment !== realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment(body))
    throw new TypeError(`Step-44 compact candidate ${index} self commitment is inconsistent.`);
  return row;
}

export function requireRealBuildPrefix50Step44ReviewBatchEnvelope(
  value: unknown,
): RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  exactKeys(
    value,
    [
      "authority",
      "candidateCount",
      "candidateKeysCommitment",
      "candidateRosterCommitment",
      "candidates",
      "childSubBuildWindowCommitment",
      "commitment",
      "detachedStateCommitment",
      "enumerationReceipt",
      "fixturePromotionAuthority",
      "ordering",
      "projectionCommitment",
      "reviewReplayBaseDocument",
      "reviewReplayBaseDocumentCommitment",
      "reviewReplayBaseRevisionPolicy",
      "returnResultCommitment",
      "rosterSummary",
      "schemaVersion",
      "selectionAuthority",
      "sourceDocumentHash",
      "sourceMemberRowsCommitment",
      "sourceSetId",
      "step42_43RepairCommitment",
      "step43PredecessorCommitment",
    ],
    "Step-44 review batch input",
  );
  const batch = value as RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  if (
    batch.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-batch-input/2" ||
    batch.authority !== "none" ||
    batch.selectionAuthority !== false ||
    batch.fixturePromotionAuthority !== false ||
    batch.sourceSetId !== "6651557" ||
    batch.reviewReplayBaseRevisionPolicy !==
      REAL_BUILD_PREFIX50_STEP44_REPLAY_BASE_REVISION_POLICY ||
    batch.ordering !== "candidate-key-lexicographic" ||
    !Number.isSafeInteger(batch.candidateCount) ||
    batch.candidateCount !== REAL_BUILD_PREFIX50_STEP44_REVIEW_CANDIDATE_COUNT ||
    batch.candidateCount > REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES ||
    !Array.isArray(batch.candidates) ||
    batch.candidates.length !== batch.candidateCount
  )
    throw new TypeError(
      "Step-44 review batch must be the complete bounded authority-none candidate roster.",
    );
  for (const [label, digest] of [
    ["returnResultCommitment", batch.returnResultCommitment],
    ["candidateRosterCommitment", batch.candidateRosterCommitment],
    ["projectionCommitment", batch.projectionCommitment],
    ["childSubBuildWindowCommitment", batch.childSubBuildWindowCommitment],
    ["sourceMemberRowsCommitment", batch.sourceMemberRowsCommitment],
    ["detachedStateCommitment", batch.detachedStateCommitment],
    ["step42_43RepairCommitment", batch.step42_43RepairCommitment],
    ["step43PredecessorCommitment", batch.step43PredecessorCommitment],
    ["sourceDocumentHash", batch.sourceDocumentHash],
    ["reviewReplayBaseDocumentCommitment", batch.reviewReplayBaseDocumentCommitment],
    ["candidateKeysCommitment", batch.candidateKeysCommitment],
    ["commitment", batch.commitment],
  ] as const)
    requireDigest(digest, `Step-44 review batch.${label}`);
  const baseValue = batch.reviewReplayBaseDocument as unknown;
  if (baseValue === null || typeof baseValue !== "object" || Array.isArray(baseValue))
    throw new TypeError("Step-44 review replay base must be a bounded data object.");
  const baseShape = baseValue as Record<string, unknown>;
  if (
    !Array.isArray(baseShape.parts) ||
    baseShape.parts.length !== 280 ||
    !Array.isArray(baseShape.steps) ||
    baseShape.steps.length !== 43 ||
    !Array.isArray(baseShape.connections) ||
    baseShape.connections.length >
      REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS.maxDocumentConnections ||
    !validateBrickDocumentV1(baseValue)
  )
    throw new TypeError(
      "Step-44 review replay base must be one schema-valid 280-part/43-step bounded document.",
    );
  const enumerationReceipt = requireEnumerationReceipt(
    batch.enumerationReceipt,
    batch.candidateCount,
  );
  const childIds = new Set(enumerationReceipt.childPartIds);
  const expectedReplayRevision = realBuildPrefix50Step44SyntheticReviewReplayRevision(
    batch.sourceDocumentHash,
  );
  if (
    batch.reviewReplayBaseDocument.revision !== expectedReplayRevision ||
    batch.reviewReplayBaseDocumentCommitment !== canonicalDigest(batch.reviewReplayBaseDocument) ||
    documentStructuralHash(batch.reviewReplayBaseDocument) !== batch.sourceDocumentHash ||
    enumerationReceipt.sourceDocumentHash !== batch.sourceDocumentHash ||
    enumerationReceipt.counts.existingInternalEdges !==
      batch.reviewReplayBaseDocument.connections.length ||
    batch.reviewReplayBaseDocument.parts.filter(({ id }) => childIds.has(id)).length !== 23 ||
    batch.reviewReplayBaseDocument.connections.some(
      ({ a, b }) => childIds.has(a.partId) !== childIds.has(b.partId),
    )
  )
    throw new TypeError(
      "Step-44 review replay base drifted from its exact synthetic revision, source structure, child roster, or internal-edge accounting.",
    );
  const candidates = batch.candidates.map((candidate, index) =>
    requireCompactCandidate(candidate, index, batch.candidateCount),
  );
  const aggregateCrossEdgeAdds = candidates.reduce(
    (total, candidate) =>
      total + candidate.operations.filter(({ kind }) => kind === "addConnection").length,
    0,
  );
  requireRealBuildPrefix50Step44CandidatePacketAccounting(
    enumerationReceipt,
    candidates.reduce((total, candidate) => total + candidate.operations.length, 0),
    aggregateCrossEdgeAdds,
  );
  const rosterSummary = requireRosterSummary(batch.rosterSummary);
  const candidateKeys = candidates.map(({ candidateKey }) => candidateKey);
  if (
    new Set(candidateKeys).size !== candidateKeys.length ||
    candidateKeys.some((key, index) => index > 0 && candidateKeys[index - 1]! >= key) ||
    batch.candidateKeysCommitment !== canonicalDigest(candidateKeys) ||
    new Set(candidates.map(({ rosterIndex }) => rosterIndex)).size !== candidates.length ||
    [...candidates]
      .sort((left, right) => left.rosterIndex - right.rosterIndex)
      .some(({ rosterIndex }, index) => rosterIndex !== index)
  )
    throw new TypeError(
      "Step-44 review batch candidate keys must be unique, lexicographically ordered, and commitment-bound.",
    );
  if (
    rosterSummary.returnResultCommitment !== batch.returnResultCommitment ||
    rosterSummary.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    rosterSummary.sourceDocumentHash !== batch.sourceDocumentHash ||
    rosterSummary.candidateCount !== batch.candidateCount ||
    candidates.some((candidate) => {
      const summary = rosterSummary.candidates[candidate.rosterIndex];
      return summary === undefined || summary.candidateKey !== candidate.candidateKey;
    })
  )
    throw new TypeError(
      "Step-44 review batch does not cover every exact roster-summary candidate document and envelope.",
    );
  const body = { ...batch } as typeof batch & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (batch.commitment !== realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment(body))
    throw new TypeError("Step-44 review batch self commitment is inconsistent.");
  for (const candidate of candidates)
    hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, candidate);
  return batch;
}
