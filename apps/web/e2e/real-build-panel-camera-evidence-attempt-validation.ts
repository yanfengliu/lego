import { committedObservationIdForAttempt } from "./real-build-panel-camera-evidence-measurement";
import type {
  RealBuildPanelCameraAttemptEvidence,
  RealBuildPanelCameraCandidateEvidence,
  RealBuildPanelCameraEvidence,
  RealBuildPanelCameraFailureEvidence,
  RealBuildPanelCameraMeasurementEvidence,
} from "./real-build-panel-camera-evidence-types";

const ANGULAR_KEYS = (["as-fitted", "x-reflected"] as const).flatMap((hand) =>
  ([0, 90, 180, 270] as const).map((turnDegrees) => `${hand}:${turnDegrees}`),
);
const ANGULAR_KEY_SET = new Set(ANGULAR_KEYS);
const ANGULAR_RANK = new Map(ANGULAR_KEYS.map((key, index) => [key, index]));

export function failPanelCameraEvidence(message: string): never {
  throw new TypeError(`Panel-camera evidence is incoherent: ${message}`);
}

export function panelCameraAngularKey(value: {
  readonly latticeHand: string;
  readonly turnDegrees: number;
}): string {
  return `${value.latticeHand}:${value.turnDegrees}`;
}

export function samePanelCameraStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function requireUniquePanelCameraStrings(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      failPanelCameraEvidence(`${label} duplicates ${JSON.stringify(value)}.`);
    }
    seen.add(value);
  }
}

export function coherentPanelCameraFailure(
  status: RealBuildPanelCameraEvidence["status"] | RealBuildPanelCameraCandidateEvidence["status"],
  failure: RealBuildPanelCameraFailureEvidence | null,
  label: string,
): void {
  const requiredCode =
    status === "budget-refused"
      ? "resource-budget-exhausted"
      : status === "unresolved"
        ? "camera-handedness-unresolved"
        : null;
  if ((status === "seeded" || status === "observed") && failure !== null) {
    failPanelCameraEvidence(`${label} status ${status} requires failure null.`);
  }
  if (
    (status === "failed" || status === "unresolved" || status === "budget-refused") &&
    failure === null
  ) {
    failPanelCameraEvidence(`${label} status ${status} requires a failure.`);
  }
  if (requiredCode !== null && failure?.code !== requiredCode) {
    failPanelCameraEvidence(`${label} status ${status} requires failure code ${requiredCode}.`);
  }
  if (failure !== null) {
    const expectedStage =
      failure.code === "resource-budget-exhausted"
        ? "budget"
        : failure.code === "rendering-error"
          ? "rendering"
          : "camera-registration";
    if (failure.stage !== expectedStage) {
      failPanelCameraEvidence(`${label} failure ${failure.code} requires stage ${expectedStage}.`);
    }
  }
  if (
    status === "failed" &&
    failure?.code !== "camera-anchor-failed" &&
    failure?.code !== "rendering-error"
  ) {
    failPanelCameraEvidence(
      `${label} failed status requires a camera-anchor or rendering failure.`,
    );
  }
}

export function coherentPanelCameraAttempt(
  attempt: RealBuildPanelCameraAttemptEvidence,
  label: string,
): void {
  const determinant = attempt.latticeHand === "as-fitted" ? 1 : -1;
  if (attempt.latticeDeterminant !== determinant) {
    failPanelCameraEvidence(
      `${label} hand ${attempt.latticeHand} requires determinant ${determinant}.`,
    );
  }
  const allNull =
    attempt.silhouetteIou === null && attempt.shiftPx === null && attempt.centrePx === null;
  const allPresent =
    attempt.silhouetteIou !== null && attempt.shiftPx !== null && attempt.centrePx !== null;
  if ((attempt.status === "unregistered" || attempt.status === "empty") && !allNull) {
    failPanelCameraEvidence(
      `${label} status ${attempt.status} must carry no score, shift, or centre.`,
    );
  }
  if (attempt.status === "scored" && !allPresent) {
    failPanelCameraEvidence(`${label} scored status requires score, shift, and centre.`);
  }
  if (attempt.status === "unregistered" && attempt.renderMaskDigest !== null) {
    failPanelCameraEvidence(`${label} unregistered status cannot claim a rendered mask.`);
  }
  if (
    attempt.renderMaskDigest !== null &&
    !/^sha256:[0-9a-f]{64}$/u.test(attempt.renderMaskDigest)
  ) {
    failPanelCameraEvidence(`${label} renderMaskDigest is not a lowercase sha256 digest.`);
  }
  if (attempt.status === "scored" && attempt.renderMaskDigest === null) {
    failPanelCameraEvidence(`${label} scored status requires an exact render-mask digest.`);
  }
}

export function expectedPanelCameraObservationId(
  candidateId: string,
  registrationPanelStepNumber: number,
  attempt: RealBuildPanelCameraAttemptEvidence,
  measurement: RealBuildPanelCameraMeasurementEvidence,
): string {
  return committedObservationIdForAttempt({
    candidateId,
    registrationPanelStepNumber,
    attempt,
    measurement,
  });
}

export function resolverDerivedPanelCameraStatus(
  candidate: RealBuildPanelCameraCandidateEvidence,
): RealBuildPanelCameraCandidateEvidence["status"] {
  if (candidate.status === "seeded") return "seeded";
  if (candidate.failure?.code === "rendering-error") {
    if (!candidate.attempts.some(({ status }) => status === "empty")) {
      failPanelCameraEvidence(
        "a rendering-error candidate must retain at least one failed empty attempt.",
      );
    }
    return "failed";
  }
  const scored = candidate.attempts.filter(
    (
      attempt,
    ): attempt is RealBuildPanelCameraAttemptEvidence & { readonly silhouetteIou: number } =>
      attempt.status === "scored",
  );
  if (scored.length === 0) return "failed";
  const bestScore = scored[0]!.silhouetteIou;
  const leaders = scored.filter(({ silhouetteIou }) => silhouetteIou === bestScore);
  if (new Set(leaders.map(({ latticeHand }) => latticeHand)).size > 1) return "unresolved";
  return leaders.length > 1 ? "failed" : "observed";
}

export function coherentPanelCameraAttemptOrder(
  candidate: RealBuildPanelCameraCandidateEvidence,
  label: string,
): void {
  if (candidate.attempts.length === 0) {
    if (candidate.status !== "failed" || candidate.failure?.code !== "camera-anchor-failed") {
      failPanelCameraEvidence(
        `${label} may omit attempts only for an early camera-anchor failure.`,
      );
    }
    return;
  }
  if (candidate.attempts.length !== 8) {
    failPanelCameraEvidence(`${label} must retain zero or eight angular attempts.`);
  }
  const keys = candidate.attempts.map(panelCameraAngularKey);
  requireUniquePanelCameraStrings(keys, `${label}.attempts angular hypotheses`);
  if (keys.some((key) => !ANGULAR_KEY_SET.has(key))) {
    failPanelCameraEvidence(`${label} attempts do not cover the fixed eight angular hypotheses.`);
  }
  const expected = [...candidate.attempts].sort((left, right) => {
    if (candidate.status === "seeded") {
      return (
        ANGULAR_RANK.get(panelCameraAngularKey(left))! -
        ANGULAR_RANK.get(panelCameraAngularKey(right))!
      );
    }
    if (left.status !== right.status) return left.status === "scored" ? -1 : 1;
    if (
      left.status === "scored" &&
      right.status === "scored" &&
      left.silhouetteIou !== right.silhouetteIou
    ) {
      return right.silhouetteIou! - left.silhouetteIou!;
    }
    return (
      ANGULAR_RANK.get(panelCameraAngularKey(left))! -
      ANGULAR_RANK.get(panelCameraAngularKey(right))!
    );
  });
  if (!samePanelCameraStrings(keys, expected.map(panelCameraAngularKey))) {
    failPanelCameraEvidence(
      `${label}.attempts are not in the resolver's deterministic ranking order.`,
    );
  }
}
