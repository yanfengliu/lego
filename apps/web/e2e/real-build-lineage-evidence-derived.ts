import type {
  RealBuildLineageAttemptEvidence,
  RealBuildLineageEvidenceStatus,
  RealBuildLineageSelectionEvidence,
  RealBuildLineageTiePolicy,
  RealBuildLineageTransitionEvidence,
} from "./real-build-lineage-evidence-types";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export function deriveRealBuildLineageTransitions(
  attempts: readonly RealBuildLineageAttemptEvidence[],
): readonly RealBuildLineageTransitionEvidence[] {
  return Object.freeze(
    attempts.flatMap((attempt) =>
      attempt.parentLineageId === null
        ? []
        : [
            freeze({
              parentLineageId: attempt.parentLineageId,
              childLineageId: attempt.lineageId,
            }),
          ],
    ),
  );
}

export function deriveRealBuildLineageSelection(
  attempts: readonly RealBuildLineageAttemptEvidence[],
  tiePolicy: RealBuildLineageTiePolicy,
): RealBuildLineageSelectionEvidence {
  const allSeeded = attempts.every(({ status }) => status === "seeded");
  type ScoredGroup = {
    readonly candidateId: string;
    readonly cameraEvidenceId: string;
    readonly score: number;
    readonly lineageIds: string[];
    readonly encounterOrder: number;
  };
  const groups = new Map<string, ScoredGroup>();
  attempts.forEach((attempt, encounterOrder) => {
    if (
      attempt.status !== "scored" ||
      attempt.score === null ||
      attempt.cameraEvidenceId === null
    ) {
      return;
    }
    const key = `${attempt.candidateId}\0${attempt.cameraEvidenceId}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        candidateId: attempt.candidateId,
        cameraEvidenceId: attempt.cameraEvidenceId,
        score: attempt.score,
        lineageIds: [attempt.lineageId],
        encounterOrder,
      });
    } else {
      if (existing.score !== attempt.score) {
        throw new TypeError(
          `Lineage evidence score group ${JSON.stringify(key)} carries inconsistent scores.`,
        );
      }
      existing.lineageIds.push(attempt.lineageId);
    }
  });
  const scored = [...groups.values()].sort(
    (left, right) => right.score - left.score || left.encounterOrder - right.encounterOrder,
  );
  if (scored.length === 0 || attempts.some(({ status }) => status !== "scored")) {
    return freeze({
      status: allSeeded ? ("not-applicable" as const) : ("unresolved" as const),
      scoredGroups: scored.length,
      selectedCandidateId: null,
      selectedCameraEvidenceId: null,
      selectedLineageIds: Object.freeze([]),
      bestScore: scored[0]?.score ?? null,
      runnerUpScore: scored[1]?.score ?? null,
      margin: scored.length > 1 ? scored[0]!.score - scored[1]!.score : null,
    });
  }
  const best = scored[0]!;
  const runnerUp = scored[1] ?? null;
  const margin = runnerUp === null ? null : best.score - runnerUp.score;
  const qualifies =
    best.score >= tiePolicy.minimumScore &&
    (runnerUp === null || (margin !== null && margin > tiePolicy.minimumMargin));
  return freeze({
    status: qualifies ? ("selected" as const) : ("unresolved" as const),
    scoredGroups: scored.length,
    selectedCandidateId: qualifies ? best.candidateId : null,
    selectedCameraEvidenceId: qualifies ? best.cameraEvidenceId : null,
    selectedLineageIds: Object.freeze(qualifies ? [...best.lineageIds] : []),
    bestScore: best.score,
    runnerUpScore: runnerUp?.score ?? null,
    margin,
  });
}

export function deriveRealBuildLineageEvidenceStatus(
  attempts: readonly RealBuildLineageAttemptEvidence[],
  selection: RealBuildLineageSelectionEvidence,
): RealBuildLineageEvidenceStatus {
  if (attempts.every(({ status }) => status === "seeded")) return "seeded";
  if (selection.status === "selected") return "selected";
  if (attempts.some(({ status }) => status === "failed")) return "failed";
  return "unresolved";
}
