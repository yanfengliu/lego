import type { RecoveryBenchmark, StrategyScore } from "./callout-types";

const STABLE_IDENTITY = /^p\d+\|q\d+\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;
const ARRAY_IS_ARRAY = Array.isArray;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_HAS_OWN = Object.hasOwn;
const REFLECT_APPLY = Reflect.apply;
const REGEXP_TEST = RegExp.prototype.test;

function boundedCount(value: unknown, maximum: number): value is number {
  return NUMBER_IS_SAFE_INTEGER(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < right.length; index += 1) {
    if (
      !OBJECT_HAS_OWN(left, index) ||
      !OBJECT_HAS_OWN(right, index) ||
      left[index] !== right[index]
    )
      return false;
  }
  return true;
}

function canonicalIdentities(value: unknown, expectedSize: unknown): value is readonly string[] {
  if (!ARRAY_IS_ARRAY(value) || value.length !== expectedSize) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!OBJECT_HAS_OWN(value, index)) return false;
    const identity = value[index];
    if (
      typeof identity !== "string" ||
      !(REFLECT_APPLY(REGEXP_TEST, STABLE_IDENTITY, [identity]) as boolean) ||
      (index > 0 && value[index - 1]! >= identity)
    ) {
      return false;
    }
  }
  return true;
}

function containsString(values: readonly string[], target: unknown): boolean {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === target) return true;
  }
  return false;
}

function validInvalidIdentities(
  value: unknown,
  expectedLength: number,
  observed: readonly string[],
): value is readonly string[] {
  if (!ARRAY_IS_ARRAY(value) || value.length !== expectedLength) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!OBJECT_HAS_OWN(value, index) || !containsString(observed, value[index])) return false;
    for (let prior = 0; prior < index; prior += 1) {
      if (value[prior] === value[index]) return false;
    }
  }
  return true;
}

export function assertMeasuredRecoveryBenchmark(
  benchmark: unknown,
  sourceHash: string,
  expectedFailureIdentities: readonly string[],
): asserts benchmark is RecoveryBenchmark {
  const value = benchmark as Partial<RecoveryBenchmark> | null;
  const size = value?.fixedFailureClassSize;
  const observed = value?.observedLegacyFailureIdentities;
  const scores = value?.scores;
  const identitiesAreCanonical = canonicalIdentities(observed, size);
  if (
    value?.schemaVersion !== "lego.callout-recovery-benchmark-result/2" ||
    value?.fixtureSourceHash !== sourceHash ||
    !NUMBER_IS_SAFE_INTEGER(size) ||
    (size as number) < 1 ||
    (size as number) > 64 ||
    !identitiesAreCanonical ||
    (ARRAY_IS_ARRAY(observed) && !sameStrings(observed, expectedFailureIdentities)) ||
    !ARRAY_IS_ARRAY(scores) ||
    scores.length !== 2 ||
    value?.selected !== "evidence-aware" ||
    value?.winner !== "evidence-aware"
  ) {
    throw new Error(
      "Callout recoveryBenchmark must be one bounded, measured /2 result for the exact source with a nonempty canonical fixed failure class and both recovery strategies.",
    );
  }

  const failureClassSize = size as number;
  let evidence: StrategyScore | undefined;
  let legacy: StrategyScore | undefined;
  for (let scoreIndex = 0; scoreIndex < scores.length; scoreIndex += 1) {
    if (!OBJECT_HAS_OWN(scores, scoreIndex)) {
      throw new Error(
        "Callout recoveryBenchmark scores must be two unique, bounded, internally derived strategy measurements over the declared failure class.",
      );
    }
    const score = scores[scoreIndex];
    const candidate = score as Partial<StrategyScore>;
    const strategy = candidate.strategy;
    const valid = candidate.valid;
    const recovered = candidate.recovered;
    const kindCorrect = candidate.kindCorrect;
    const regionCorrect = candidate.regionCorrect;
    const masksCorrect = candidate.masksCorrect;
    const uncontaminated = candidate.uncontaminated;
    if (
      (strategy !== "legacy-seed" && strategy !== "evidence-aware") ||
      (strategy === "legacy-seed" ? legacy !== undefined : evidence !== undefined) ||
      !boundedCount(valid, failureClassSize) ||
      !boundedCount(recovered, failureClassSize) ||
      !boundedCount(kindCorrect, failureClassSize) ||
      !boundedCount(regionCorrect, failureClassSize) ||
      !boundedCount(masksCorrect, failureClassSize) ||
      !boundedCount(uncontaminated, failureClassSize)
    ) {
      throw new Error(
        "Callout recoveryBenchmark scores must be two unique, bounded, internally derived strategy measurements over the declared failure class.",
      );
    }
    const invalid = candidate.invalidIdentities;
    const invalidAreCanonical = validInvalidIdentities(invalid, failureClassSize - valid, observed);
    const points =
      valid * 1_000_000 +
      kindCorrect * 10_000 +
      regionCorrect * 1_000 +
      masksCorrect * 100 +
      uncontaminated * 10 +
      recovered;
    if (
      recovered < valid ||
      kindCorrect < valid ||
      regionCorrect < valid ||
      masksCorrect < valid ||
      uncontaminated < valid ||
      !invalidAreCanonical ||
      !NUMBER_IS_SAFE_INTEGER(candidate.points) ||
      candidate.points !== points
    ) {
      throw new Error(
        "Callout recoveryBenchmark scores must be two unique, bounded, internally derived strategy measurements over the declared failure class.",
      );
    }
    if (strategy === "evidence-aware") evidence = candidate as StrategyScore;
    else legacy = candidate as StrategyScore;
  }

  if (
    evidence === undefined ||
    legacy === undefined ||
    evidence.valid !== failureClassSize ||
    legacy.valid !== 0 ||
    legacy.recovered !== 0 ||
    legacy.kindCorrect !== 0 ||
    legacy.regionCorrect !== 0 ||
    legacy.masksCorrect !== 0 ||
    legacy.uncontaminated !== 0 ||
    !sameStrings(legacy.invalidIdentities, observed) ||
    evidence.points <= legacy.points ||
    value.winningMargin !== evidence.points - legacy.points ||
    scores[0] !== evidence ||
    scores[1] !== legacy
  ) {
    throw new Error(
      "Callout recoveryBenchmark must show a complete evidence-aware result strictly winning the legacy baseline with its exact derived margin.",
    );
  }
}
