import { OFFICIAL_REAL_BUILD_ACCOUNTING } from "./real-build-contract";
import type { LedgerStep } from "./real-build-ledger-contract";
import type { StepFailure } from "./real-build-safety";

const MAXIMUM_LEDGER_STEPS = 359;
const MAXIMUM_LEDGER_IDENTITIES = OFFICIAL_REAL_BUILD_ACCOUNTING.inventoryPieces;
const MAXIMUM_LEDGER_FAILURES = 4_096;

const limitFailure = (message: string): StepFailure => ({
  code: "action-ledger-incomplete",
  stage: "input",
  inputKey: "actionLedger.steps",
  message,
});

/** Bounds every ledger row before validation copies or iterates any nested array. */
export function preflightActionLedgerRows(
  value: unknown,
):
  | { readonly steps: readonly LedgerStep[]; readonly failure: null }
  | { readonly steps: null; readonly failure: StepFailure } {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_LEDGER_STEPS) {
    const count = Array.isArray(value) ? value.length : "no array";
    return {
      steps: null,
      failure: limitFailure(
        `Action ledger steps must be an array containing 1 through ${MAXIMUM_LEDGER_STEPS} ` +
          `printed-step rows; received ${count}.`,
      ),
    };
  }
  let actionIdentities = 0;
  let callouts = 0;
  let physicalReferences = 0;
  for (let index = 0; index < value.length; index += 1) {
    const step = value[index] as Partial<LedgerStep> | null;
    if (step === null || typeof step !== "object") continue;
    if (!Array.isArray(step.callouts) || step.callouts.length > MAXIMUM_LEDGER_IDENTITIES) {
      return {
        steps: null,
        failure: limitFailure(
          `Action ledger step ${index + 1} callouts must be an array of at most ` +
            `${MAXIMUM_LEDGER_IDENTITIES} official identities.`,
        ),
      };
    }
    callouts += step.callouts.length;
    for (let calloutIndex = 0; calloutIndex < step.callouts.length; calloutIndex += 1) {
      const refs = step.callouts[calloutIndex]?.physicalBrickRefs;
      if (!Array.isArray(refs) || refs.length > MAXIMUM_LEDGER_IDENTITIES) {
        return {
          steps: null,
          failure: limitFailure(
            `Action ledger step ${index + 1} callout ${calloutIndex + 1} physicalBrickRefs must be ` +
              `an array of at most ${MAXIMUM_LEDGER_IDENTITIES} official identities.`,
          ),
        };
      }
      physicalReferences += refs.length;
    }
    const action = step.action as Partial<LedgerStep["action"]> | null | undefined;
    const arrays =
      action?.kind === "place-callouts"
        ? [action.pieces, action.omittedPieces]
        : action?.kind === "multi-build-copy"
          ? [action.copies]
          : [];
    for (const rows of arrays) {
      if (!Array.isArray(rows) || rows.length > MAXIMUM_LEDGER_IDENTITIES) {
        return {
          steps: null,
          failure: limitFailure(
            `Action ledger step ${index + 1} action identity lists must be arrays of at most ` +
              `${MAXIMUM_LEDGER_IDENTITIES} official identities.`,
          ),
        };
      }
      actionIdentities += rows.length;
    }
    if (
      actionIdentities > MAXIMUM_LEDGER_IDENTITIES ||
      callouts > MAXIMUM_LEDGER_IDENTITIES ||
      physicalReferences > MAXIMUM_LEDGER_IDENTITIES
    ) {
      return {
        steps: null,
        failure: limitFailure(
          `Action ledger exceeds the ${MAXIMUM_LEDGER_IDENTITIES}-identity official inventory bound ` +
            `across its action rows, callouts, or physical references.`,
        ),
      };
    }
  }
  return { steps: value, failure: null };
}

/** Retains a bounded prefix plus one explicit sentinel instead of silently truncating failures. */
export function boundedLedgerFailures(): {
  readonly add: (...items: readonly StepFailure[]) => void;
  readonly result: () => readonly StepFailure[];
} {
  const retained: StepFailure[] = [];
  let omitted = 0;
  return {
    add: (...items) => {
      for (const item of items) {
        if (retained.length < MAXIMUM_LEDGER_FAILURES - 1) retained.push(item);
        else omitted += 1;
      }
    },
    result: () =>
      omitted === 0
        ? retained
        : [
            ...retained,
            {
              code: "validation-failure-limit",
              stage: "input",
              inputKey: "actionLedger.validationFailures",
              message:
                `Action ledger validation retained ${retained.length} failures and omitted ${omitted} ` +
                `after reaching the ${MAXIMUM_LEDGER_FAILURES}-entry result bound.`,
            },
          ],
  };
}
