import {
  assertRealBuildLineageParent,
  snapshotRealBuildLineageIdentity,
  type DetachedRealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  deriveRealBuildLineageEvidenceStatus,
  deriveRealBuildLineageSelection,
  deriveRealBuildLineageTransitions,
} from "./real-build-lineage-evidence-derived";
import { realBuildLineageAttemptEvidenceId } from "./real-build-lineage-attempt-evidence-id";
import type {
  RealBuildLineageAttemptEvidence,
  RealBuildLineageEvidence,
} from "./real-build-lineage-evidence-types";

const CAMERA_EVIDENCE_ID_PATTERN =
  /^(?:panel-camera-observation-v[1-9][0-9]*|camera-evidence):[0-9a-f]{64}$/u;
const ATTEMPT_EVIDENCE_ID_PATTERN = /^lineage-attempt-evidence:[0-9a-f]{64}$/u;
const FAILURE_EVIDENCE_ID_PATTERN = /^failure-evidence:[0-9a-f]{64}$/u;
const NOT_OBSERVABLE_EVIDENCE_ID_PATTERN = /^not-observable-evidence:[0-9a-f]{64}$/u;
const expectedRootSeedIds = (candidateId: string, registrationPanelStepNumber: number) =>
  (["as-fitted", "x-reflected"] as const).flatMap((hand) => {
    const determinant = hand === "as-fitted" ? 1 : -1;
    return ([0, 90, 180, 270] as const).map(
      (turn) =>
        `${candidateId}:panel-camera-seed:p${String(registrationPanelStepNumber).padStart(3, "0")}:` +
        `${hand}:d${determinant}:q${String(turn).padStart(3, "0")}`,
    );
  });

const fail = (message: string): never => {
  throw new TypeError(`Lineage evidence ${message}`);
};

function identityWire(value: DetachedRealBuildLineageIdentity | RealBuildLineageAttemptEvidence) {
  return {
    candidateId: value.candidateId,
    documentHash: value.documentHash,
    lineageId: value.lineageId,
    lineageOrigin: value.lineageOrigin,
    localIdentity: value.localIdentity,
    originLineageId: value.originLineageId,
    parentLineageId: value.parentLineageId,
    throughStepNumber: value.throughStepNumber,
  };
}

function validateIdentity(
  value: DetachedRealBuildLineageIdentity | RealBuildLineageAttemptEvidence,
  label: string,
): DetachedRealBuildLineageIdentity {
  try {
    return snapshotRealBuildLineageIdentity(identityWire(value));
  } catch {
    throw new TypeError(`${label} does not reproduce its central lineage identity.`);
  }
}

function validateAttemptStatus(attempt: RealBuildLineageAttemptEvidence, index: number): void {
  const path = `attempts[${index}]`;
  if (attempt.localIdentity.kind !== "evidence") {
    fail(`${path}.localIdentity must retain the exact evidence identity for this attempt.`);
  }
  if (
    attempt.cameraEvidenceId !== null &&
    !CAMERA_EVIDENCE_ID_PATTERN.test(attempt.cameraEvidenceId)
  ) {
    fail(`${path}.cameraEvidenceId is not a canonical camera evidence id.`);
  }
  if (attempt.status === "seeded") {
    if (
      attempt.parentLineageId !== null ||
      attempt.originLineageId !== attempt.lineageId ||
      attempt.sourceEvidenceId !== null ||
      attempt.attemptEvidenceId !== null ||
      attempt.cameraEvidenceId !== null ||
      attempt.score !== null ||
      attempt.throughStepNumber !== 0
    ) {
      fail(`${path} seeded root must be its own origin and carry no parent, camera, or score.`);
    }
  } else if (attempt.parentLineageId === null) {
    fail(`${path} non-seeded branch requires a parent lineage.`);
  }
  if (attempt.status !== "seeded") {
    if (
      attempt.sourceEvidenceId === null ||
      attempt.attemptEvidenceId === null ||
      !ATTEMPT_EVIDENCE_ID_PATTERN.test(attempt.attemptEvidenceId) ||
      attempt.localIdentity.id !== attempt.attemptEvidenceId ||
      attempt.attemptEvidenceId !==
        realBuildLineageAttemptEvidenceId({
          candidateId: attempt.candidateId,
          parentLineageId: attempt.parentLineageId!,
          throughStepNumber: attempt.throughStepNumber,
          registrationPanelStepNumber: attempt.registrationPanelStepNumber,
          status: attempt.status,
          sourceEvidenceId: attempt.sourceEvidenceId,
        })
    ) {
      fail(`${path} non-seed branch must bind its exact attemptEvidenceId as local identity.`);
    }
  }
  if (attempt.status === "scored") {
    if (
      attempt.cameraEvidenceId === null ||
      attempt.score === null ||
      attempt.sourceEvidenceId !== attempt.cameraEvidenceId
    ) {
      fail(`${path} scored branch requires exact cameraEvidenceId and score.`);
    }
  } else if (attempt.score !== null || attempt.cameraEvidenceId !== null) {
    fail(`${path} ${attempt.status} branch cannot carry camera score evidence.`);
  }
  if (
    attempt.status === "failed" &&
    !FAILURE_EVIDENCE_ID_PATTERN.test(attempt.sourceEvidenceId ?? "")
  ) {
    fail(`${path} failed branch requires a typed failure evidence identity.`);
  }
  if (
    attempt.status === "not-observable" &&
    !NOT_OBSERVABLE_EVIDENCE_ID_PATTERN.test(attempt.sourceEvidenceId ?? "")
  ) {
    fail(`${path} not-observable branch requires a typed not-observable evidence identity.`);
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSelection(
  left: RealBuildLineageEvidence["selection"],
  right: RealBuildLineageEvidence["selection"],
): boolean {
  return (
    left.status === right.status &&
    left.scoredGroups === right.scoredGroups &&
    left.selectedCandidateId === right.selectedCandidateId &&
    left.selectedCameraEvidenceId === right.selectedCameraEvidenceId &&
    sameStrings(left.selectedLineageIds, right.selectedLineageIds) &&
    left.bestScore === right.bestScore &&
    left.runnerUpScore === right.runnerUpScore &&
    left.margin === right.margin
  );
}

export function validateRealBuildLineageEvidence(evidence: RealBuildLineageEvidence): void {
  if (evidence.registrationPanelStepNumber <= evidence.throughStepNumber) {
    fail(`registrationPanelStepNumber must strictly follow throughStepNumber.`);
  }
  if (
    evidence.decisionPanelStepNumber !== null &&
    evidence.decisionPanelStepNumber < evidence.registrationPanelStepNumber
  ) {
    fail(`decisionPanelStepNumber must be null or at least registrationPanelStepNumber.`);
  }
  if (evidence.attempts.length === 0) fail(`requires at least one retained lineage attempt.`);

  const parents = new Map<string, DetachedRealBuildLineageIdentity>();
  for (const [index, parent] of evidence.parents.entries()) {
    if (parents.has(parent.lineageId)) fail(`duplicates parent lineage ${parent.lineageId}.`);
    parents.set(parent.lineageId, validateIdentity(parent, `parents[${index}]`));
  }

  const attemptLineages = new Set<string>();
  for (const [index, attempt] of evidence.attempts.entries()) {
    if (attempt.throughStepNumber !== evidence.throughStepNumber) {
      fail(`attempts[${index}].throughStepNumber does not equal the enclosing evidence step.`);
    }
    if (attempt.registrationPanelStepNumber !== evidence.registrationPanelStepNumber) {
      fail(`attempts[${index}].registrationPanelStepNumber does not equal the enclosing panel.`);
    }
    const validatedParent =
      attempt.parentLineageId === null ? null : (parents.get(attempt.parentLineageId) ?? null);
    if (attempt.parentLineageId !== null && validatedParent === null) {
      fail(`attempts[${index}] parent must be retained before its child.`);
    }
    if (parents.has(attempt.lineageId) || attemptLineages.has(attempt.lineageId)) {
      fail(`duplicates lineageId ${attempt.lineageId}.`);
    }
    validateAttemptStatus(attempt, index);
    const validated = validateIdentity(attempt, `attempts[${index}]`);
    try {
      assertRealBuildLineageParent(validated, validatedParent);
    } catch {
      throw new TypeError(`attempts[${index}] does not match its exact direct parent.`);
    }
    attemptLineages.add(attempt.lineageId);
  }

  if (evidence.throughStepNumber > 0) {
    const referencedParents = new Set(
      evidence.attempts.flatMap(({ parentLineageId }) =>
        parentLineageId === null ? [] : [parentLineageId],
      ),
    );
    if (
      referencedParents.size !== parents.size ||
      [...parents.keys()].some((lineageId) => !referencedParents.has(lineageId))
    ) {
      fail(`parents must be exactly the direct-parent identity set used by current attempts.`);
    }
  }

  if (evidence.throughStepNumber === 0) {
    if (
      evidence.parents.length !== 0 ||
      evidence.attempts.length !== 8 ||
      evidence.attempts.some(({ status }) => status !== "seeded")
    ) {
      fail(`step-0 root requires no parents and exactly eight distinct seeded attempts.`);
    }
    const first = evidence.attempts[0]!;
    if (
      evidence.attempts.some(
        ({ candidateId, documentHash }) =>
          candidateId !== first.candidateId || documentHash !== first.documentHash,
      )
    ) {
      fail(`step-0 root must seed one shared canonical candidate document eight ways.`);
    }
    const actualSeedIds = evidence.attempts.map(({ localIdentity }) => localIdentity.id);
    const expectedSeedIds = expectedRootSeedIds(
      first.candidateId,
      evidence.registrationPanelStepNumber,
    );
    if (
      actualSeedIds.length !== expectedSeedIds.length ||
      actualSeedIds.some((id, index) => id !== expectedSeedIds[index])
    ) {
      fail(`step-0 root must retain the canonical eight D4 camera hypotheses in fixed order.`);
    }
  } else if (evidence.attempts.some(({ status }) => status === "seeded")) {
    fail(`only the eight-way step-0 root may retain seeded attempts.`);
  }

  const derivedSelection = deriveRealBuildLineageSelection(evidence.attempts, evidence.tiePolicy);
  if (!sameSelection(evidence.selection, derivedSelection)) {
    fail(`selection does not reproduce exact score-evidence groups and fixed tie policy.`);
  }
  if (derivedSelection.selectedLineageIds.some((lineageId) => !attemptLineages.has(lineageId))) {
    fail(`selection names a lineage outside the current attempts.`);
  }
  if (
    evidence.status !== deriveRealBuildLineageEvidenceStatus(evidence.attempts, derivedSelection)
  ) {
    fail(`status is not derived from attempt statuses and selection.`);
  }
  const transitions = deriveRealBuildLineageTransitions(evidence.attempts);
  if (
    transitions.length !== evidence.transitions.length ||
    transitions.some(
      (transition, index) =>
        transition.parentLineageId !== evidence.transitions[index]?.parentLineageId ||
        transition.childLineageId !== evidence.transitions[index]?.childLineageId,
    )
  ) {
    fail(`transitions do not reproduce every current parent-to-child attempt in encounter order.`);
  }
  if (derivedSelection.status === "selected" && evidence.decisionPanelStepNumber === null) {
    fail(`a derived selected score group requires an exact decision panel.`);
  }
  if (derivedSelection.status !== "selected" && evidence.decisionPanelStepNumber !== null) {
    fail(`an unresolved or seeded result cannot claim a decision panel.`);
  }
}
