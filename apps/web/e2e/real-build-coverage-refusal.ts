import type { StepFailure } from "./real-build-safety";

/**
 * The refusal a run owes when its catalog-coverage closure never bound.
 *
 * Before this existed the run substituted an empty index for the coverage it had
 * failed to recompile, and then let every coverage-derived check describe the
 * substitute: one unbound input role printed as dozens of further failures, each
 * asserting something false about the artifact on disk — that coverage bound its
 * PDF to "missing", that it carried no callout claims, that a ledger brick did
 * not match a claim that was simply never read. A reader had to go to disk to
 * find which one of them was the cause.
 *
 * So the refusal names its own cause and its own ceiling, and every number in it
 * is counted from this run's own evidence: how many printed steps and mapped
 * callout keys were left unevaluated, and how far the prefix could reach if the
 * closure bound and nothing else changed.
 */
export function describeUnboundCoverageRefusal(input: {
  /** The closure's own rejection text, quoted rather than summarised. */
  readonly rejection: string;
  readonly coveragePath: string;
  readonly requestedLastStep: number;
  readonly requestedPanels: readonly {
    readonly stepNumber: number;
    readonly mappedCalloutKeys: readonly string[];
  }[];
  /** Every other failure this run evaluated; the ceiling is read out of these. */
  readonly otherFailures: readonly StepFailure[];
}): StepFailure {
  const steps = [...new Set(input.requestedPanels.map(({ stepNumber }) => stepNumber))].sort(
    (left, right) => left - right,
  );
  const unevaluatedKeys = input.requestedPanels.reduce(
    (total, panel) => total + panel.mappedCalloutKeys.length,
    0,
  );
  // A step named by a failure that does not read coverage is blocked whatever the
  // closure does, so the lowest such step is where this prefix stops regardless.
  const blockedSteps = [
    ...new Set(
      input.otherFailures.flatMap(({ stepNumber }) =>
        Number.isInteger(stepNumber) ? [stepNumber as number] : [],
      ),
    ),
  ].sort((left, right) => left - right);
  const firstBlocked = blockedSteps[0];
  const ceiling = firstBlocked === undefined ? input.requestedLastStep : firstBlocked - 1;
  const blockingCodes = [
    ...new Set(
      input.otherFailures
        .filter(({ stepNumber }) => stepNumber === firstBlocked)
        .map(({ code }) => code),
    ),
  ].sort();
  return {
    code: "coverage-closure-unbound",
    stage: "input",
    inputKey: input.coveragePath,
    message:
      `The catalog-coverage closure at ${input.coveragePath} never bound, so this run refuses printed ` +
      `steps 1..${input.requestedLastStep} from one input role rather than from ${steps.length} step ` +
      `defects. Cause, verbatim from the closure: ${input.rejection} ` +
      `Left unevaluated as a consequence: every coverage-derived check over these ${steps.length} requested ` +
      `printed steps and the ${unevaluatedKeys} callout keys their panels map. An absent index yields no ` +
      `claims, and its silence is not evidence about the retained coverage artifact — do not read the ` +
      `absence of those checks as agreement or as disagreement. ` +
      (firstBlocked === undefined
        ? `Ceiling once that role binds: printed step ${ceiling}, the whole requested prefix, because no ` +
          `remaining failure names a printed step.`
        : `Ceiling once that role binds: printed step ${ceiling}. Printed step ${firstBlocked} is the ` +
          `lowest requested step still refused by a check that never reads coverage ` +
          `(${blockingCodes.join(", ")}), so binding the closure alone does not reach step ` +
          `${input.requestedLastStep}.`),
  };
}
