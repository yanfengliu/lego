const REFUSAL_STAGES = new Map<string, string>([
  ["farther-input-invalid", "input"],
  ["incomplete-parent-expansion", "evidence"],
  ["incomplete-atomic-step", "evidence"],
  ["empty-parent-expansion", "evidence"],
  ["aggregate-candidate-budget-exhausted", "budget"],
  ["aggregate-narrowing-budget-exhausted", "budget"],
  ["panel-render-budget-exhausted", "budget"],
  ["incomplete-panel-evidence", "evidence"],
  ["farther-panel-limit-reached", "budget"],
  ["calibration-mismatch", "evidence"],
  ["not-observable", "evidence"],
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
  JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)));

export function isExactFailedBudgetReservation(
  value: unknown,
  reservedBefore: unknown,
  budget: unknown,
): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["reservedBefore", "requested", "budget"]) &&
    Number.isSafeInteger(reservedBefore) &&
    Number.isSafeInteger(budget) &&
    value.reservedBefore === reservedBefore &&
    value.budget === budget &&
    Number.isSafeInteger(value.requested) &&
    (value.requested as number) > 0 &&
    (reservedBefore as number) >= 0 &&
    (reservedBefore as number) <= (budget as number) &&
    (value.requested as number) > (budget as number) - (reservedBefore as number)
  );
}

export function isExactFailedCandidateReservation(
  value: unknown,
  reservedBefore: unknown,
  budget: unknown,
): boolean {
  return (
    isExactFailedBudgetReservation(value, reservedBefore, budget) &&
    isRecord(value) &&
    value.requested === 1 &&
    reservedBefore === budget
  );
}

export interface RealBuildFartherRefusalControlFacts {
  readonly refusal: unknown;
  readonly originStepNumber: number;
  readonly carries: readonly Record<string, unknown>[];
  readonly panels: readonly Record<string, unknown>[];
  readonly panelStatuses: readonly ("not-observable" | "unrevealing" | "revealing")[];
  readonly budgets: Record<string, unknown>;
  readonly maximumReachSteps: number;
  readonly originCandidateCount: number;
  readonly finalCandidateCount: number;
}

/**
 * Parses a hostile refusal and binds its label to report facts that independently
 * prove that control path. Producer-only defects with no retained witness fail
 * closed instead of becoming a relabeling primitive at the browser boundary.
 */
export function isRealBuildFartherRefusalCoherent(
  input: RealBuildFartherRefusalControlFacts,
): boolean {
  const { refusal, originStepNumber, maximumReachSteps } = input;
  if (
    !isRecord(refusal) ||
    !exactKeys(refusal, ["code", "stage", "stepNumber", "message"]) ||
    REFUSAL_STAGES.get(String(refusal.code)) !== refusal.stage ||
    !Number.isSafeInteger(refusal.stepNumber) ||
    (refusal.stepNumber as number) < originStepNumber ||
    typeof refusal.message !== "string" ||
    refusal.message.length === 0 ||
    refusal.message.length > 8_192
  ) {
    return false;
  }
  const maximumEvidenceStep = originStepNumber + maximumReachSteps;
  if (
    (refusal.stepNumber as number) > maximumEvidenceStep &&
    !(
      refusal.code === "farther-panel-limit-reached" &&
      refusal.stepNumber === maximumEvidenceStep + 1
    )
  ) {
    return false;
  }

  const { carries, panels, panelStatuses, budgets } = input;
  const lastCarry = carries.at(-1);
  const lastPanel = panels.at(-1);
  const lastCarryStep = typeof lastCarry?.stepNumber === "number" ? lastCarry.stepNumber : null;
  const lastPanelStep = typeof lastPanel?.stepNumber === "number" ? lastPanel.stepNumber : null;
  const narrowingRefused =
    budgets.refusedReservation === true &&
    isExactFailedBudgetReservation(
      budgets.failedNarrowingReservation,
      budgets.narrowingRenders,
      budgets.maximumNarrowingRenders,
    );
  const candidateRefused =
    budgets.candidateRefusedReservation === true &&
    isExactFailedCandidateReservation(
      budgets.failedCandidateReservation,
      budgets.offeredCandidates,
      budgets.maximumCandidates,
    );
  const noReservationRefusal =
    budgets.refusedReservation === false &&
    budgets.failedNarrowingReservation === null &&
    budgets.candidateRefusedReservation === false &&
    budgets.failedCandidateReservation === null;
  const noCarryOriginProbe =
    noReservationRefusal &&
    carries.length === 0 &&
    input.finalCandidateCount === input.originCandidateCount &&
    budgets.offeredCandidates === 0 &&
    budgets.narrowingRenders === 0;
  const directNPlusOneOnly =
    noCarryOriginProbe &&
    panels.length === 1 &&
    lastPanelStep === originStepNumber + 1 &&
    budgets.reachSteps === 1;
  const directThroughK =
    noCarryOriginProbe &&
    panels.length === 2 &&
    panels[0]?.stepNumber === originStepNumber + 1 &&
    lastPanelStep === originStepNumber + 2 &&
    budgets.reachSteps === 2;
  const noRevealingPanel = panelStatuses.every((status) => status !== "revealing");
  const fullLastCarry =
    lastCarry !== undefined && lastCarry.parentsExpanded === lastCarry.parentCandidates;

  switch (refusal.code) {
    case "farther-input-invalid":
    case "incomplete-atomic-step":
      // Neither the invalid callback/hash nor the rejected atomic child is
      // serialized. Their typed producer tests remain the proof; hostile report
      // JSON cannot publish either uncheckable claim.
      return false;
    case "incomplete-parent-expansion":
      return (
        noReservationRefusal &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarryStep &&
        (lastCarry.parentsExpanded as number) < (lastCarry.parentCandidates as number)
      );
    case "empty-parent-expansion":
      return (
        noReservationRefusal &&
        fullLastCarry &&
        refusal.stepNumber === lastCarryStep &&
        (lastCarry.perParent as readonly Record<string, unknown>[]).some(
          ({ offeredCandidates }) => offeredCandidates === 0,
        )
      );
    case "aggregate-candidate-budget-exhausted":
      return (
        candidateRefused &&
        !narrowingRefused &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarryStep
      );
    case "aggregate-narrowing-budget-exhausted":
      return (
        narrowingRefused &&
        !candidateRefused &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarryStep
      );
    case "panel-render-budget-exhausted":
      if (!noReservationRefusal) return false;
      if (panels.length === 0) {
        return (
          carries.length === 0 &&
          refusal.stepNumber === originStepNumber + 1 &&
          input.originCandidateCount > (budgets.maximumPanelRenders as number)
        );
      }
      return (
        noRevealingPanel &&
        ((fullLastCarry &&
          refusal.stepNumber === (lastPanelStep as number) + 1 &&
          (budgets.panelRenders as number) + input.finalCandidateCount >
            (budgets.maximumPanelRenders as number)) ||
          (directNPlusOneOnly &&
            maximumReachSteps >= 2 &&
            refusal.stepNumber === originStepNumber + 2 &&
            (budgets.panelRenders as number) + input.originCandidateCount >
              (budgets.maximumPanelRenders as number)))
      );
    case "incomplete-panel-evidence":
      return (
        noReservationRefusal &&
        noRevealingPanel &&
        ((fullLastCarry && refusal.stepNumber === (lastPanelStep ?? originStepNumber) + 1) ||
          (directNPlusOneOnly &&
            maximumReachSteps >= 2 &&
            refusal.stepNumber === originStepNumber + 2))
      );
    case "farther-panel-limit-reached":
      return (
        noReservationRefusal &&
        noRevealingPanel &&
        maximumReachSteps === 1 &&
        panels.length === 1 &&
        lastPanelStep === originStepNumber + 1 &&
        budgets.reachSteps === 1 &&
        refusal.stepNumber === originStepNumber + 2 &&
        (fullLastCarry || directNPlusOneOnly)
      );
    case "calibration-mismatch":
      return (
        noReservationRefusal &&
        directThroughK &&
        refusal.stepNumber === originStepNumber + 2 &&
        panelStatuses.at(-1) === "revealing"
      );
    case "not-observable":
      return (
        noReservationRefusal &&
        noRevealingPanel &&
        ((fullLastCarry && lastPanel !== undefined && refusal.stepNumber === lastPanelStep) ||
          (directThroughK && refusal.stepNumber === originStepNumber + 2))
      );
    default:
      return false;
  }
}
