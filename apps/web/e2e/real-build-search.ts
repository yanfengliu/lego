import { adjudicateSearchBenchmark } from "./real-build-contract";
import {
  selectUniquePlacementScore,
  type BlindSearchReport,
  type StepFailure,
} from "./real-build-safety";

export interface ScoredPlacement<T> {
  readonly candidate: T;
  readonly score: number;
}

/** Runs pruned and exhaustive search under the same scoring/refusal policy. */
export function evaluateSearchBenchmark<T, S extends ScoredPlacement<T>>(input: {
  readonly stepNumber: number;
  readonly pieceIndex: number;
  readonly catalogPartId: string;
  readonly prefixHash: string;
  readonly prunedCandidates: readonly T[];
  readonly exhaustiveCandidates: readonly T[];
  readonly maxPrunedRenders: number;
  readonly exhaustiveRenderBudget: number;
  readonly minimumMargin: number;
  readonly score: (candidate: T) => S;
  readonly key: (candidate: T | undefined) => string | null;
}): {
  readonly winner: S | null;
  readonly failure: StepFailure | null;
  readonly prunedScores: readonly S[];
  readonly blind: BlindSearchReport;
} {
  const prunedStarted = performance.now();
  // Over its budget the pruned strategy refuses rather than scoring a prefix of
  // its set — but it says so in its own words. Reporting that as
  // `incomplete-placement-scoring`, which is what fell out of handing an empty
  // score list to the shared selector, describes the symptom and hides both the
  // count that was eligible and the budget it passed; the run then prints a
  // disagreement between a strategy that looked and one that declined, with
  // nothing to say which.
  const prunedOverBudget = input.prunedCandidates.length > input.maxPrunedRenders;
  const prunedScores = prunedOverBudget
    ? []
    : input.prunedCandidates.map(input.score).sort((left, right) => right.score - left.score);
  const prunedDecision = prunedOverBudget
    ? {
        winner: null,
        runnerUp: null,
        failure: {
          code: "resource-budget-exhausted" as const,
          stage: "budget" as const,
          pieceIndex: input.pieceIndex,
          catalogPartId: input.catalogPartId,
          message:
            `Step ${input.stepNumber} pruned search has ${input.prunedCandidates.length} eligible ` +
            `placements for ${input.catalogPartId} after the proximity prune, over the explicit ` +
            `${input.maxPrunedRenders} per-piece render budget. It was refused rather than truncated, so ` +
            `nothing was scored.`,
        },
      }
    : selectUniquePlacementScore({
        stepNumber: input.stepNumber,
        pieceIndex: input.pieceIndex,
        catalogPartId: input.catalogPartId,
        eligibleCandidates: input.prunedCandidates.length,
        scores: prunedScores.map((entry) => ({ candidate: entry, score: entry.score })),
        minimumMargin: input.minimumMargin,
      });
  const prunedElapsedMs = Math.round(performance.now() - prunedStarted);

  let exhaustiveScores: S[] = [];
  let exhaustiveElapsedMs = 0;
  let exhaustiveDecision: typeof prunedDecision;
  let exhaustiveRefusal: string | null;

  if (input.exhaustiveCandidates.length > input.exhaustiveRenderBudget) {
    const failure: StepFailure = {
      code: "resource-budget-exhausted",
      stage: "budget",
      pieceIndex: input.pieceIndex,
      catalogPartId: input.catalogPartId,
      message:
        `Exhaustive search needs ${input.exhaustiveCandidates.length} renders, over the explicit ` +
        `${input.exhaustiveRenderBudget} budget. It was refused rather than truncated.`,
    };
    exhaustiveDecision = { winner: null, runnerUp: null, failure };
    exhaustiveRefusal = failure.message;
  } else {
    const exhaustiveStarted = performance.now();
    exhaustiveScores = input.exhaustiveCandidates
      .map(input.score)
      .sort((left, right) => right.score - left.score);
    exhaustiveDecision = selectUniquePlacementScore({
      stepNumber: input.stepNumber,
      pieceIndex: input.pieceIndex,
      catalogPartId: input.catalogPartId,
      eligibleCandidates: input.exhaustiveCandidates.length,
      scores: exhaustiveScores.map((entry) => ({ candidate: entry, score: entry.score })),
      minimumMargin: input.minimumMargin,
    });
    exhaustiveElapsedMs = Math.round(performance.now() - exhaustiveStarted);
    exhaustiveRefusal = exhaustiveDecision.failure?.message ?? null;
  }

  const blind: BlindSearchReport = {
    comparisonPrefixHash: input.prefixHash,
    distinctCandidates: input.exhaustiveCandidates.length,
    feasible: exhaustiveDecision.failure?.code !== "resource-budget-exhausted",
    rendered: exhaustiveScores.length,
    bestScore: exhaustiveScores[0]?.score ?? null,
    runnerUpScore: exhaustiveScores[1]?.score ?? null,
    agreesWithHighlight:
      prunedDecision.failure === null && exhaustiveDecision.failure === null
        ? input.key(exhaustiveDecision.winner?.candidate.candidate) ===
          input.key(prunedDecision.winner?.candidate.candidate)
        : null,
    refusal: exhaustiveRefusal,
    elapsedMs: exhaustiveElapsedMs,
  };
  const benchmark = adjudicateSearchBenchmark({
    stepNumber: input.stepNumber,
    pruned: {
      strategy: "pruned",
      winnerKey: input.key(prunedDecision.winner?.candidate.candidate),
      bestScore: prunedScores[0]?.score ?? null,
      runnerUpScore: prunedScores[1]?.score ?? null,
      rendered: prunedScores.length,
      elapsedMs: prunedElapsedMs,
      failure: prunedDecision.failure,
    },
    exhaustive: {
      strategy: "exhaustive",
      winnerKey: input.key(exhaustiveDecision.winner?.candidate.candidate),
      bestScore: blind.bestScore,
      runnerUpScore: blind.runnerUpScore,
      rendered: blind.rendered,
      elapsedMs: blind.elapsedMs,
      failure: exhaustiveDecision.failure,
    },
  });
  const acceptedDecision = prunedDecision;
  return {
    winner: acceptedDecision.winner?.candidate ?? null,
    failure: benchmark.failure ?? acceptedDecision.failure,
    prunedScores,
    blind,
  };
}
