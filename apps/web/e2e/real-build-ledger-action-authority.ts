import type { CoverageLedgerClaim, LedgerStep } from "./real-build-ledger-contract";

export function coverageStepNumbers(
  coverageByCallout: Readonly<Record<string, CoverageLedgerClaim>> | null,
): ReadonlySet<number> | null {
  if (coverageByCallout === null) return null;
  return new Set(
    Object.values(coverageByCallout).flatMap(({ stepNumber }) =>
      stepNumber === null ? [] : [stepNumber],
    ),
  );
}

/** Derives step-action authority from runtime shape and the independently bound coverage closure. */
export function ledgerStepActionAuthorityFailure(
  step: LedgerStep,
  coveredSteps: ReadonlySet<number> | null,
): string | null {
  const action = step.action as { readonly kind?: unknown } | null | undefined;
  if (
    action === null ||
    typeof action !== "object" ||
    !["place-callouts", "multi-build-copy", "transition"].some((kind) => kind === action.kind)
  ) {
    return (
      `Ledger step ${step.stepNumber} has no recognized action kind; use place-callouts, ` +
      `multi-build-copy, or transition and retain that action's required evidence.`
    );
  }
  if (coveredSteps !== null && !coveredSteps.has(step.stepNumber) && action.kind !== "transition") {
    return (
      `Bound coverage contains zero retained callouts for printed step ${step.stepNumber}, so the ledger must ` +
      `retain its reproduced transition action and classification instead of ${action.kind}.`
    );
  }
  return null;
}
