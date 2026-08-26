import { REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS } from "./real-build-production-policy";

const MAXIMUM_REPORTED_ENVIRONMENT_VALUE_LENGTH = 80;

function boundedEnvironmentValue(value: string): string {
  return JSON.stringify(
    value.length <= MAXIMUM_REPORTED_ENVIRONMENT_VALUE_LENGTH
      ? value
      : `${value.slice(0, MAXIMUM_REPORTED_ENVIRONMENT_VALUE_LENGTH)}...`,
  );
}

/** Parses the one live/publisher prefix knob without accepting numeric coercion. */
export function parseRealBuildRequestedLastStep(value: string | undefined): number {
  if (value === undefined) {
    throw new TypeError(
      `LEGO_REAL_BUILD_LAST_STEP must be set explicitly to an integer from 1 through ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}; no implicit full-booklet prefix is selected.`,
    );
  }
  if (!/^[1-9][0-9]{0,2}$/u.test(value)) {
    throw new TypeError(
      `LEGO_REAL_BUILD_LAST_STEP must be an integer from 1 through ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}; received ${boundedEnvironmentValue(value)}.`,
    );
  }
  const requestedLastStep = Number(value);
  if (requestedLastStep > REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS) {
    throw new TypeError(
      `LEGO_REAL_BUILD_LAST_STEP must be an integer from 1 through ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}; received ${boundedEnvironmentValue(value)}.`,
    );
  }
  return requestedLastStep;
}
