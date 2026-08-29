import { TRANSITION_CLASSIFICATIONS_DIGEST_FIELD } from "./part-identification-action-ledger-field-names.mjs";

const CURRENT_SCHEMA = "lego.real-build-action-ledger/4";
const CURRENT_GENERATOR = "apps/web/e2e/real-build-action-ledger.spec.ts";
const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "pdfDigest",
  "officialModelDigest",
  "coverageDigest",
  "calloutManifestDigest",
  "sourceArtReboundDigest",
  "builderCalibrationDigest",
  TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
  "steps",
  "provenance",
];
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
];
const REFUSAL_KEYS = ["stepNumber", "calloutKey", "brickRef", "reason"];
const MAXIMUM_IDENTITIES = 4_000;

function exactRecord(value, keys, label) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== keys.length ||
    Reflect.ownKeys(value).some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    throw new TypeError(`${label} must contain exactly the current bounded data fields.`);
  }
  return value;
}

function boundedNullableString(value, maximum) {
  return (
    value === null || (typeof value === "string" && value.length >= 1 && value.length <= maximum)
  );
}

/** Inspects only the current closed /4 prefix boundary shared by MJS consumers. */
export function inspectCurrentActionLedgerPrefix(value) {
  const ledger = exactRecord(value, TOP_LEVEL_KEYS, "Action ledger /4");
  if (ledger.schemaVersion !== CURRENT_SCHEMA) {
    throw new TypeError(`Action ledger must use the current ${CURRENT_SCHEMA} schema.`);
  }
  for (const field of [
    "pdfDigest",
    "officialModelDigest",
    "coverageDigest",
    "calloutManifestDigest",
    "sourceArtReboundDigest",
    "builderCalibrationDigest",
    TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
  ]) {
    if (typeof ledger[field] !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(ledger[field])) {
      throw new TypeError(`Action ledger /4 ${field} must be one lowercase sha256 digest.`);
    }
  }
  if (!Array.isArray(ledger.steps) || ledger.steps.length < 1 || ledger.steps.length > 50) {
    throw new TypeError("Action ledger /4 steps must contain 1 through 50 bounded rows.");
  }
  const provenance = exactRecord(ledger.provenance, PROVENANCE_KEYS, "Action ledger /4 provenance");
  const requestedLastStep = provenance.requestedLastStep;
  if (
    provenance.generator !== CURRENT_GENERATOR ||
    provenance.authenticated !== false ||
    provenance.expectedPrintedSteps !== 359 ||
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep < 1 ||
    requestedLastStep > 50 ||
    !Number.isSafeInteger(provenance.alignedThroughStep) ||
    provenance.alignedThroughStep < 1 ||
    provenance.alignedThroughStep > requestedLastStep ||
    provenance.alignedThroughStep !== ledger.steps.length
  ) {
    throw new TypeError(
      "Action ledger /4 provenance must bind the current generator, authenticated=false, the 359-step " +
        "source/index, and one nonempty aligned prefix bounded by its explicit request.",
    );
  }
  if (
    typeof provenance.stopReason !== "string" ||
    provenance.stopReason.length < 1 ||
    provenance.stopReason.length > 16_384
  ) {
    throw new TypeError(
      "Action ledger /4 provenance.stopReason is outside its bounded string contract.",
    );
  }
  let directPieceCount = 0;
  let transitionStepCount = 0;
  for (let index = 0; index < ledger.steps.length; index += 1) {
    const step = ledger.steps[index];
    if (
      typeof step !== "object" ||
      step === null ||
      Array.isArray(step) ||
      step.stepNumber !== index + 1 ||
      step.stepNumber > requestedLastStep ||
      typeof step.action !== "object" ||
      step.action === null ||
      Array.isArray(step.action)
    ) {
      throw new TypeError("Action ledger /4 rows must be dense and bounded by requestedLastStep.");
    }
    if (step.action.kind === "place-callouts") {
      if (!Array.isArray(step.action.pieces) || step.action.pieces.length > MAXIMUM_IDENTITIES) {
        throw new TypeError(
          "Action ledger /4 direct action pieces exceed their bounded array contract.",
        );
      }
      directPieceCount += step.action.pieces.length;
    } else if (step.action.kind === "transition") {
      transitionStepCount += 1;
    } else if (step.action.kind !== "multi-build-copy") {
      throw new TypeError("Action ledger /4 contains an unknown action kind.");
    }
  }
  if (
    !Number.isSafeInteger(provenance.directPieceCount) ||
    provenance.directPieceCount !== directPieceCount ||
    !Number.isSafeInteger(provenance.transitionStepCount) ||
    provenance.transitionStepCount !== transitionStepCount
  ) {
    throw new TypeError(
      "Action ledger /4 provenance counts do not match its retained action rows.",
    );
  }
  if (!Array.isArray(provenance.refusals) || provenance.refusals.length > MAXIMUM_IDENTITIES) {
    throw new TypeError("Action ledger /4 provenance.refusals exceeds its bounded array contract.");
  }
  for (let index = 0; index < provenance.refusals.length; index += 1) {
    const refusal = exactRecord(
      provenance.refusals[index],
      REFUSAL_KEYS,
      `Action ledger /4 provenance refusal ${index}`,
    );
    if (
      !Number.isSafeInteger(refusal.stepNumber) ||
      refusal.stepNumber < 1 ||
      refusal.stepNumber > requestedLastStep ||
      !boundedNullableString(refusal.calloutKey, 512) ||
      !boundedNullableString(refusal.brickRef, 256) ||
      typeof refusal.reason !== "string" ||
      refusal.reason.length < 1 ||
      refusal.reason.length > 16_384
    ) {
      throw new TypeError(
        `Action ledger /4 provenance refusal ${index} exceeds its prefix bounds.`,
      );
    }
  }
  return { requestedLastStep, alignedThroughStep: provenance.alignedThroughStep };
}
