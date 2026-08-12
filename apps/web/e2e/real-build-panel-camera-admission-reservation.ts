import type {
  RealBuildPanelCameraBranchBudgetFailure,
  RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";

export interface PanelCameraAdmissionLedgerState {
  readonly budget: number;
  readonly reserved: number;
  readonly refused: boolean;
  readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
}

export function reservePanelCameraAdmission(input: {
  readonly tryReserve: (count: number) => unknown;
  readonly ledger: RealBuildPanelCameraBranchBudgetLedger;
  readonly before: PanelCameraAdmissionLedgerState;
  readonly requested: number;
  readonly snapshot: (
    ledger: RealBuildPanelCameraBranchBudgetLedger,
  ) => PanelCameraAdmissionLedgerState;
  readonly describe: (value: unknown) => string;
}): { readonly admitted: boolean; readonly after: PanelCameraAdmissionLedgerState } {
  let answer: unknown;
  let thrown: unknown = null;
  try {
    answer = input.tryReserve.call(input.ledger, input.requested);
  } catch (error) {
    thrown = error;
  }
  const after = input.snapshot(input.ledger);
  if (thrown !== null) {
    throw new TypeError(
      `Panel-camera branch ledger tryReserve(${input.requested}) threw after state changed from ${input.describe(input.before)} to ${input.describe(after)}; admission stopped and the ledger must be discarded. ${thrown instanceof Error ? thrown.message : String(thrown)}`,
      { cause: thrown },
    );
  }
  if (typeof answer !== "boolean") {
    throw new TypeError(
      `Panel-camera branch ledger tryReserve(${input.requested}) returned ${input.describe(answer)}; required true or false. State before was ${input.describe(input.before)} and state after was ${input.describe(after)}; admission stopped and the invalid ledger must be discarded.`,
    );
  }
  const fits = input.requested <= input.before.budget - input.before.reserved;
  const expectedReserved = answer ? input.before.reserved + input.requested : input.before.reserved;
  const coherentFailure =
    after.failure !== null &&
    after.failure.reservedBefore === input.before.reserved &&
    after.failure.requested === input.requested &&
    after.failure.budget === input.before.budget;
  if (
    answer !== fits ||
    after.budget !== input.before.budget ||
    after.reserved !== expectedReserved ||
    after.reserved > after.budget ||
    (answer && (after.refused || after.failure !== null)) ||
    (!answer && (!after.refused || !coherentFailure))
  ) {
    throw new TypeError(
      `Panel-camera branch ledger recorded a non-atomic or capacity-inconsistent ${answer ? "acceptance" : "refusal"}; requested ${input.requested} with ${input.before.budget - input.before.reserved} remaining, required reserved ${expectedReserved}, received ${input.describe(after)}. Admission stopped and the ledger must be discarded.`,
    );
  }
  return { admitted: answer, after };
}
