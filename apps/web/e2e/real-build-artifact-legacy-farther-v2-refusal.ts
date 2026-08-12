import { legacyExactKeys, legacyRecord } from "./real-build-artifact-legacy-browser-v2-values";

const REFUSAL_STAGES = new Map([
  ["incomplete-parent-expansion", "evidence"],
  ["empty-parent-expansion", "evidence"],
  ["aggregate-candidate-budget-exhausted", "budget"],
  ["aggregate-narrowing-budget-exhausted", "budget"],
  ["panel-render-budget-exhausted", "budget"],
  ["incomplete-panel-evidence", "evidence"],
  ["farther-panel-limit-reached", "budget"],
  ["calibration-mismatch", "evidence"],
  ["not-observable", "evidence"],
]);

export function failedReservation(
  value: unknown,
  before: unknown,
  budget: unknown,
  candidate: boolean,
): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, ["reservedBefore", "requested", "budget"]) &&
    Number.isSafeInteger(before) &&
    Number.isSafeInteger(budget) &&
    value.reservedBefore === before &&
    value.budget === budget &&
    Number.isSafeInteger(value.requested) &&
    (value.requested as number) > 0 &&
    (before as number) >= 0 &&
    (before as number) <= (budget as number) &&
    (value.requested as number) > (budget as number) - (before as number) &&
    (!candidate || (value.requested === 1 && before === budget))
  );
}

export function coherentRefusal(input: {
  refusal: unknown;
  originStep: number;
  carries: readonly Record<string, unknown>[];
  panels: readonly Record<string, unknown>[];
  statuses: readonly string[];
  budgets: Record<string, unknown>;
  maximumReach: number;
  originCount: number;
  finalCount: number;
}): boolean {
  const { refusal, originStep, carries, panels, statuses, budgets } = input;
  if (
    !legacyRecord(refusal) ||
    !legacyExactKeys(refusal, ["code", "stage", "stepNumber", "message"]) ||
    REFUSAL_STAGES.get(String(refusal.code)) !== refusal.stage ||
    !Number.isSafeInteger(refusal.stepNumber) ||
    (refusal.stepNumber as number) < originStep ||
    (refusal.stepNumber as number) > originStep + input.maximumReach + 1 ||
    typeof refusal.message !== "string" ||
    refusal.message.length < 1 ||
    refusal.message.length > 8_192
  )
    return false;
  const lastCarry = carries.at(-1);
  const lastPanel = panels.at(-1);
  const noReservation =
    budgets.refusedReservation === false &&
    budgets.failedNarrowingReservation === null &&
    budgets.candidateRefusedReservation === false &&
    budgets.failedCandidateReservation === null;
  const narrowing =
    budgets.refusedReservation === true &&
    failedReservation(
      budgets.failedNarrowingReservation,
      budgets.narrowingRenders,
      budgets.maximumNarrowingRenders,
      false,
    );
  const candidate =
    budgets.candidateRefusedReservation === true &&
    failedReservation(
      budgets.failedCandidateReservation,
      budgets.offeredCandidates,
      budgets.maximumCandidates,
      true,
    );
  const fullCarry =
    lastCarry !== undefined && lastCarry.parentsExpanded === lastCarry.parentCandidates;
  const noReveal = statuses.every((status) => status !== "revealing");
  switch (refusal.code) {
    case "incomplete-parent-expansion":
      return (
        noReservation &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarry.stepNumber &&
        (lastCarry.parentsExpanded as number) < (lastCarry.parentCandidates as number)
      );
    case "empty-parent-expansion":
      return (
        noReservation &&
        fullCarry &&
        refusal.stepNumber === lastCarry!.stepNumber &&
        (lastCarry!.perParent as readonly Record<string, unknown>[]).some(
          ({ offeredCandidates }) => offeredCandidates === 0,
        )
      );
    case "aggregate-candidate-budget-exhausted":
      return (
        candidate &&
        !narrowing &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarry.stepNumber
      );
    case "aggregate-narrowing-budget-exhausted":
      return (
        narrowing &&
        !candidate &&
        lastCarry !== undefined &&
        refusal.stepNumber === lastCarry.stepNumber
      );
    case "panel-render-budget-exhausted":
      return (
        noReservation &&
        noReveal &&
        ((panels.length === 0 &&
          carries.length === 0 &&
          refusal.stepNumber === originStep + 1 &&
          input.originCount > (budgets.maximumPanelRenders as number)) ||
          (lastPanel !== undefined &&
            refusal.stepNumber === (lastPanel.stepNumber as number) + 1 &&
            (budgets.panelRenders as number) + input.finalCount >
              (budgets.maximumPanelRenders as number)))
      );
    case "incomplete-panel-evidence":
      return (
        noReservation &&
        noReveal &&
        refusal.stepNumber === ((lastPanel?.stepNumber as number | undefined) ?? originStep) + 1
      );
    case "farther-panel-limit-reached":
      return (
        noReservation &&
        noReveal &&
        input.maximumReach === 1 &&
        panels.length === 1 &&
        refusal.stepNumber === originStep + 2
      );
    case "calibration-mismatch":
      return (
        noReservation &&
        panels.length === 2 &&
        refusal.stepNumber === originStep + 2 &&
        statuses.at(-1) === "revealing"
      );
    case "not-observable":
      return (
        noReservation &&
        noReveal &&
        lastPanel !== undefined &&
        refusal.stepNumber === lastPanel.stepNumber
      );
    default:
      return false;
  }
}
