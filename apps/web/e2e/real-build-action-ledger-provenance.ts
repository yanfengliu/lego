import {
  REAL_BUILD_ACTION_LEDGER_GENERATOR,
  REAL_BUILD_ACTION_LEDGER_SCHEMA,
  type LedgerStep,
  type RealBuildActionLedgerProvenance,
} from "./real-build-ledger-contract";

const PROVENANCE_KEYS = [
  "generator",
  "authenticated",
  "expectedPrintedSteps",
  "requestedLastStep",
  "alignedThroughStep",
  "stopReason",
  "directPieceCount",
  "transitionStepCount",
  "refusals",
] as const;
const REFUSAL_KEYS = ["stepNumber", "calloutKey", "brickRef", "reason"] as const;
const MAXIMUM_PROVENANCE_REFUSALS = 4_000;
const MAXIMUM_STOP_REASON_CHARACTERS = 16_384;
const MAXIMUM_REFUSAL_REASON_CHARACTERS = 16_384;

function dataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, PropertyDescriptor>> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch {
    return null;
  }
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key)) ||
    expectedKeys.some((key) => {
      const descriptor = descriptors[key];
      return descriptor === undefined || !("value" in descriptor);
    })
  ) {
    return null;
  }
  return descriptors;
}

function boundedNullableString(value: unknown, maximum: number): boolean {
  return (
    value === null || (typeof value === "string" && value.length >= 1 && value.length <= maximum)
  );
}

/** Returns one bounded reason when current /3 prefix provenance cannot bind the supplied run. */
export function realBuildActionLedgerProvenanceFailure(input: {
  readonly provenance: unknown;
  readonly steps: readonly LedgerStep[];
  readonly requestedLastStep: number;
}): string | null {
  const provenance = dataRecord(input.provenance, PROVENANCE_KEYS);
  if (provenance === null) {
    return "Action ledger /3 provenance must contain exactly the current bounded data fields.";
  }
  const value = (key: (typeof PROVENANCE_KEYS)[number]): unknown => provenance[key]!.value;
  const requestedLastStep = value("requestedLastStep");
  const alignedThroughStep = value("alignedThroughStep");
  if (
    value("generator") !== REAL_BUILD_ACTION_LEDGER_GENERATOR ||
    value("authenticated") !== false ||
    value("expectedPrintedSteps") !== 359 ||
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep !== input.requestedLastStep ||
    !Number.isSafeInteger(alignedThroughStep) ||
    alignedThroughStep !== input.steps.length ||
    (alignedThroughStep as number) > (requestedLastStep as number)
  ) {
    return (
      `Action ledger /3 provenance must bind generator ${REAL_BUILD_ACTION_LEDGER_GENERATOR}, ` +
      `authenticated=false, expectedPrintedSteps=359, requestedLastStep=${input.requestedLastStep}, ` +
      `and alignedThroughStep equal to its ${input.steps.length} retained rows without crossing the request.`
    );
  }
  const stopReason = value("stopReason");
  if (
    typeof stopReason !== "string" ||
    stopReason.length < 1 ||
    stopReason.length > MAXIMUM_STOP_REASON_CHARACTERS
  ) {
    return `Action ledger /3 provenance.stopReason must contain 1 through ${MAXIMUM_STOP_REASON_CHARACTERS} characters.`;
  }
  let directPieceCount = 0;
  let transitionStepCount = 0;
  for (const step of input.steps) {
    if (step.action.kind === "place-callouts") directPieceCount += step.action.pieces.length;
    if (step.action.kind === "transition") transitionStepCount += 1;
  }
  if (
    !Number.isSafeInteger(value("directPieceCount")) ||
    value("directPieceCount") !== directPieceCount ||
    !Number.isSafeInteger(value("transitionStepCount")) ||
    value("transitionStepCount") !== transitionStepCount
  ) {
    return (
      `Action ledger /3 provenance counts must equal ${directPieceCount} direct action pieces and ` +
      `${transitionStepCount} transition rows in the retained prefix.`
    );
  }
  const refusals = value("refusals");
  if (!Array.isArray(refusals) || refusals.length > MAXIMUM_PROVENANCE_REFUSALS) {
    return `Action ledger /3 provenance.refusals must be an array of at most ${MAXIMUM_PROVENANCE_REFUSALS} records.`;
  }
  for (let index = 0; index < refusals.length; index += 1) {
    const refusal = dataRecord(refusals[index], REFUSAL_KEYS);
    if (refusal === null) {
      return `Action ledger /3 provenance refusal ${index} must contain exactly the bounded refusal fields.`;
    }
    const refusalValue = (key: (typeof REFUSAL_KEYS)[number]): unknown => refusal[key]!.value;
    if (
      !Number.isSafeInteger(refusalValue("stepNumber")) ||
      (refusalValue("stepNumber") as number) < 1 ||
      (refusalValue("stepNumber") as number) > (requestedLastStep as number) ||
      !boundedNullableString(refusalValue("calloutKey"), 512) ||
      !boundedNullableString(refusalValue("brickRef"), 256) ||
      typeof refusalValue("reason") !== "string" ||
      (refusalValue("reason") as string).length < 1 ||
      (refusalValue("reason") as string).length > MAXIMUM_REFUSAL_REASON_CHARACTERS
    ) {
      return `Action ledger /3 provenance refusal ${index} exceeds its requested-step, identity, or diagnostic bounds.`;
    }
  }
  return null;
}

/** Returns every current-artifact boundary failure without treating a broader ledger as a prefix. */
export function realBuildActionLedgerCurrentPrefixFailures(input: {
  readonly schemaVersion: unknown;
  readonly provenance: unknown;
  readonly steps: readonly LedgerStep[];
  readonly requestedLastStep: number;
  readonly validationLastStep: number;
}): readonly string[] {
  const failures: string[] = [];
  if (input.schemaVersion !== REAL_BUILD_ACTION_LEDGER_SCHEMA) {
    failures.push(
      `Action ledger schema ${JSON.stringify(input.schemaVersion)} is not the current ` +
        `${REAL_BUILD_ACTION_LEDGER_SCHEMA} prefix-provenance contract. Republish the ledger before use.`,
    );
  }
  const provenanceFailure = realBuildActionLedgerProvenanceFailure(input);
  if (provenanceFailure !== null) failures.push(provenanceFailure);
  const tailStep = input.steps.find(({ stepNumber }) => stepNumber > input.requestedLastStep);
  if (tailStep !== undefined) {
    failures.push(
      `Action ledger row ${tailStep.stepNumber} lies above requestedLastStep ${input.requestedLastStep}; ` +
        `current /3 ledgers must be compiled for exactly one bounded prefix and may not retain a broader ` +
        `raw action tail for a narrower run.`,
    );
  }
  const ordered = [...input.steps].sort((left, right) => left.stepNumber - right.stepNumber);
  if (
    ordered.length !== input.validationLastStep ||
    ordered.some(({ stepNumber }, index) => stepNumber !== index + 1)
  ) {
    failures.push(
      `Action ledger must contain exactly each validated printed step 1..${input.validationLastStep} once, ` +
        `while provenance separately retains requestedLastStep ${input.requestedLastStep}.`,
    );
  }
  return failures;
}

export type { RealBuildActionLedgerProvenance };
