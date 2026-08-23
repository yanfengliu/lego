import { createHash } from "node:crypto";

import {
  STEP7_GATE3_CANDIDATE_LIMIT,
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type Step7Gate3BrowserResult,
} from "./real-build-step7-gate3-diagnostic-browser";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(
      `${label} keys are [${actual.join(", ")}]; required [${expected.join(", ")}].`,
    );
  }
};

export function analyzeDepthCompositionEstimate(result: Step7Gate3BrowserResult) {
  const batches = new Map(
    result.batches.map((batch) => [
      JSON.stringify([batch.parentCandidateId, batch.batchIndex]),
      batch,
    ]),
  );
  if (batches.size !== result.batches.length) {
    throw new TypeError("Gate-3 diagnostic batches do not have unique parent-local indices.");
  }
  const exactSceneKeys = new Set<string>();
  const parentScopedCandidateKeys = new Set<string>();
  const prefixKeys = new Set<string>();
  const maskKeys = new Set<string>();
  const candidateMasks = new Map<string, Set<string>>();
  const candidateParentOrdinals = new Map<string, number>();
  const maskScores = new Map<string, Set<string>>();
  const perParent = new Map<
    string,
    { rows: number; prefixes: Set<string>; candidates: Set<string> }
  >();
  for (const parentCandidateId of result.orderedParentIds) {
    perParent.set(parentCandidateId, { rows: 0, prefixes: new Set(), candidates: new Set() });
  }
  if (perParent.size !== result.orderedParentIds.length) {
    throw new TypeError("Gate-3 diagnostic parents do not have unique ordered IDs.");
  }
  const parentOrdinals = new Map(
    result.orderedParentIds.map((parentCandidateId, index) => [parentCandidateId, index]),
  );
  for (const row of result.renders) {
    const batch = batches.get(JSON.stringify([row.parentCandidateId, row.batchIndex]));
    if (batch === undefined || batch.catalogPartId !== row.catalogPartId) {
      throw new TypeError(
        `Gate-3 render row ${row.parentCandidateId}/${row.batchIndex}/${row.rowIndex} has no exact batch.`,
      );
    }
    const surface = [
      row.catalogPartId,
      batch.colorId,
      row.transform.positionLdu,
      row.transform.orientationId,
    ];
    const exactSceneKey = JSON.stringify([row.prefixDocumentHash, ...surface]);
    const candidateKey = JSON.stringify([row.parentCandidateId, ...surface]);
    const parentOrdinal = parentOrdinals.get(row.parentCandidateId);
    if (parentOrdinal === undefined) {
      throw new TypeError(`Gate-3 render row names unknown parent ${row.parentCandidateId}.`);
    }
    const candidateCoordinateKey = JSON.stringify([parentOrdinal, ...surface]);
    exactSceneKeys.add(exactSceneKey);
    parentScopedCandidateKeys.add(candidateKey);
    prefixKeys.add(row.prefixDocumentHash);
    maskKeys.add(row.probeMaskDigest);
    const masks = candidateMasks.get(candidateCoordinateKey) ?? new Set<string>();
    masks.add(row.probeMaskDigest);
    candidateMasks.set(candidateCoordinateKey, masks);
    candidateParentOrdinals.set(candidateCoordinateKey, parentOrdinal);
    const scores = maskScores.get(row.probeMaskDigest) ?? new Set<string>();
    scores.add(Object.is(row.score, -0) ? "-0" : String(row.score));
    maskScores.set(row.probeMaskDigest, scores);
    const parent = perParent.get(row.parentCandidateId);
    if (parent === undefined) {
      throw new TypeError(`Gate-3 render row names unknown parent ${row.parentCandidateId}.`);
    }
    parent.rows += 1;
    parent.prefixes.add(row.prefixDocumentHash);
    parent.candidates.add(candidateKey);
  }
  const contextDependentCandidateKeys = [...candidateMasks.entries()]
    .filter(([, masks]) => masks.size > 1)
    .map(([candidateKey]) => candidateKey)
    .sort();
  const contextDependentCandidatesByParent = new Array<number>(result.orderedParentIds.length).fill(
    0,
  );
  for (const candidateKey of contextDependentCandidateKeys) {
    const parentOrdinal = candidateParentOrdinals.get(candidateKey);
    if (parentOrdinal === undefined) {
      throw new TypeError(`Gate-3 candidate coordinate ${candidateKey} has no parent ordinal.`);
    }
    contextDependentCandidatesByParent[parentOrdinal] =
      (contextDependentCandidatesByParent[parentOrdinal] ?? 0) + 1;
  }
  const estimatedPhysicalDepthLayerRenders = prefixKeys.size + parentScopedCandidateKeys.size;
  return Object.freeze({
    renderRows: result.renders.length,
    exactSceneKeys: exactSceneKeys.size,
    exactSceneRepeats: result.renders.length - exactSceneKeys.size,
    prefixLayers: prefixKeys.size,
    parentScopedCandidateLayers: parentScopedCandidateKeys.size,
    candidateLayerRepeats: result.renders.length - parentScopedCandidateKeys.size,
    uniqueMasks: maskKeys.size,
    maskRepeats: result.renders.length - maskKeys.size,
    candidateKeysWithContextDependentMasks: contextDependentCandidateKeys.length,
    contextDependentCandidateKeysDigest: `sha256:${createHash("sha256")
      .update(JSON.stringify(contextDependentCandidateKeys))
      .digest("hex")}`,
    maskKeysWithScoreDisagreement: [...maskScores.values()].filter((scores) => scores.size > 1)
      .length,
    estimatedPhysicalDepthLayerRenders,
    estimatedSavings: result.renders.length - estimatedPhysicalDepthLayerRenders,
    estimateWithinProductionLimit:
      estimatedPhysicalDepthLayerRenders <= STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
    perParent: Object.freeze(
      result.orderedParentIds.map((parentCandidateId, index) => {
        const parent = perParent.get(parentCandidateId)!;
        return Object.freeze({
          parentCandidateId,
          renderRows: parent.rows,
          prefixLayers: parent.prefixes.size,
          candidateLayers: parent.candidates.size,
          contextDependentCandidateLayers: contextDependentCandidatesByParent[index]!,
          estimatedPhysicalDepthLayerRenders: parent.prefixes.size + parent.candidates.size,
        });
      }),
    ),
  });
}

export interface HistoricalStep7Control {
  readonly sourceParentIds: readonly string[];
  readonly perParent: readonly {
    readonly parentCandidateId: string;
    readonly offeredCandidates: number;
    readonly narrowingRenders: number;
    readonly offeredPerPiece: readonly number[];
    readonly carriedPerPiece: readonly number[];
  }[];
  readonly measuredLineages: number;
  readonly reservedBeforeRefusal: number;
  readonly refusedRequest: number;
  readonly narrowingBudget: number;
  readonly candidateBudget: number;
  readonly refusedParentCandidateId: string;
}

export function projectHistoricalStep7Control(
  score: unknown,
  expectedParentIds: readonly string[],
): HistoricalStep7Control {
  if (!isRecord(score) || !Array.isArray(score.steps)) {
    throw new TypeError("Pinned score does not contain a step array.");
  }
  const step6 = score.steps.find(
    (step): step is Record<string, unknown> => isRecord(step) && step.stepNumber === 6,
  );
  const farther = isRecord(step6?.farther) ? step6.farther : null;
  const carries = farther !== null && Array.isArray(farther.carries) ? farther.carries : null;
  const carry = carries?.length === 1 && isRecord(carries[0]) ? carries[0] : null;
  const budgets = farther !== null && isRecord(farther.budgets) ? farther.budgets : null;
  const refusal = farther !== null && isRecord(farther.refusal) ? farther.refusal : null;
  if (carry === null || budgets === null || refusal === null) {
    throw new TypeError("Pinned score does not contain the exact historical step-7 carry refusal.");
  }
  exactKeys(
    carry,
    [
      "parentCandidates",
      "parentsExpanded",
      "offeredCandidates",
      "narrowingRenders",
      "maximumCandidates",
      "maximumNarrowingRenders",
      "expectedAtomicPieces",
      "perParent",
      "measuredLineages",
      "stepNumber",
    ],
    "Pinned step-7 carry",
  );
  const perParent = Array.isArray(carry.perParent) ? carry.perParent : [];
  const measuredLineages = Array.isArray(carry.measuredLineages) ? carry.measuredLineages : [];
  const expectedRows = [
    {
      offeredCandidates: 2,
      narrowingRenders: 2_218,
      offeredPerPiece: [36, 379, 513, 641],
      carriedPerPiece: [1, 1, 2, 1],
    },
    {
      offeredCandidates: 2,
      narrowingRenders: 2_169,
      offeredPerPiece: [36, 364, 507, 627],
      carriedPerPiece: [1, 1, 2, 1],
    },
    {
      offeredCandidates: 4,
      narrowingRenders: 3_650,
      offeredPerPiece: [37, 391, 453, 570],
      carriedPerPiece: [1, 5, 1, 1],
    },
  ];
  const projected = perParent.map((row, index) => {
    if (!isRecord(row)) throw new TypeError(`Pinned step-7 parent ${index} must be an object.`);
    exactKeys(
      row,
      [
        "parentCandidateId",
        "offeredCandidates",
        "narrowingRenders",
        "offeredPerPiece",
        "carriedPerPiece",
      ],
      `Pinned step-7 parent ${index}`,
    );
    return {
      parentCandidateId: row.parentCandidateId,
      offeredCandidates: row.offeredCandidates,
      narrowingRenders: row.narrowingRenders,
      offeredPerPiece: row.offeredPerPiece,
      carriedPerPiece: row.carriedPerPiece,
    };
  });
  const failedReservation = isRecord(budgets.failedNarrowingReservation)
    ? budgets.failedNarrowingReservation
    : null;
  const exact =
    expectedParentIds.length === 4 &&
    carry.parentCandidates === 4 &&
    carry.parentsExpanded === 3 &&
    carry.offeredCandidates === 8 &&
    carry.narrowingRenders === 8_037 &&
    carry.maximumCandidates === STEP7_GATE3_CANDIDATE_LIMIT &&
    carry.maximumNarrowingRenders === STEP7_GATE3_PRODUCTION_NARROWING_LIMIT &&
    carry.stepNumber === 7 &&
    JSON.stringify(projected) ===
      JSON.stringify(
        expectedRows.map((row, index) => ({ parentCandidateId: expectedParentIds[index], ...row })),
      ) &&
    measuredLineages.length === 8 &&
    JSON.stringify(
      expectedParentIds
        .slice(0, 3)
        .map(
          (parentCandidateId) =>
            measuredLineages.filter(
              (lineage) => isRecord(lineage) && lineage.parentCandidateId === parentCandidateId,
            ).length,
        ),
    ) === "[2,2,4]" &&
    budgets.narrowingRenders === 8_037 &&
    budgets.maximumNarrowingRenders === STEP7_GATE3_PRODUCTION_NARROWING_LIMIT &&
    budgets.refusedReservation === true &&
    failedReservation?.reservedBefore === 8_037 &&
    failedReservation.requested === 599 &&
    failedReservation.budget === STEP7_GATE3_PRODUCTION_NARROWING_LIMIT &&
    budgets.offeredCandidates === 8 &&
    budgets.maximumCandidates === STEP7_GATE3_CANDIDATE_LIMIT &&
    budgets.candidateRefusedReservation === false &&
    budgets.failedCandidateReservation === null &&
    refusal.code === "aggregate-narrowing-budget-exhausted" &&
    refusal.stage === "budget" &&
    refusal.stepNumber === 7 &&
    typeof refusal.message === "string" &&
    refusal.message.includes(expectedParentIds[2]!);
  if (!exact) {
    throw new TypeError("Pinned score's historical step-7 boundary did not reproduce exactly.");
  }
  return Object.freeze({
    sourceParentIds: Object.freeze([...expectedParentIds]),
    perParent: Object.freeze(projected) as HistoricalStep7Control["perParent"],
    measuredLineages: measuredLineages.length,
    reservedBeforeRefusal: 8_037,
    refusedRequest: 599,
    narrowingBudget: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
    candidateBudget: STEP7_GATE3_CANDIDATE_LIMIT,
    refusedParentCandidateId: expectedParentIds[2]!,
  });
}
