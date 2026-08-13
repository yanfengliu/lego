import {
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
  type RealBuildLineageLocalIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  createLineageEvidenceInputBudget,
  denseLineageEvidenceArray,
  exactLineageEvidenceRecord,
  freezeLineageEvidence,
  lineageEvidenceInteger,
  lineageEvidenceScore,
  lineageEvidenceString,
} from "./real-build-lineage-evidence-boundary";
import {
  DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS,
  REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION,
  type RealBuildLineageAttemptEvidence,
  type RealBuildLineageAttemptStatus,
  type RealBuildLineageEvidence,
  type RealBuildLineageEvidenceProjectionInput,
  type RealBuildLineageEvidenceStatus,
  type RealBuildLineageSelectionEvidence,
  type RealBuildLineageTiePolicy,
  type RealBuildLineageTransitionEvidence,
} from "./real-build-lineage-evidence-types";
import { validateRealBuildLineageEvidence } from "./real-build-lineage-evidence-validation";

const TOP_KEYS = [
  "schemaVersion",
  "status",
  "throughStepNumber",
  "registrationPanelStepNumber",
  "decisionPanelStepNumber",
  "tiePolicy",
  "parents",
  "attempts",
  "selection",
  "transitions",
  "completionAuthority",
] as const;
const IDENTITY_KEYS = [
  "candidateId",
  "documentHash",
  "lineageId",
  "lineageOrigin",
  "localIdentity",
  "originLineageId",
  "parentLineageId",
  "throughStepNumber",
] as const;
const ATTEMPT_KEYS = [
  ...IDENTITY_KEYS,
  "sourceEvidenceId",
  "attemptEvidenceId",
  "cameraEvidenceId",
  "registrationPanelStepNumber",
  "status",
  "score",
] as const;
const TIE_KEYS = ["metric", "direction", "minimumScore", "minimumMargin", "exactTie"] as const;
const SELECTION_KEYS = [
  "status",
  "scoredGroups",
  "selectedCandidateId",
  "selectedCameraEvidenceId",
  "selectedLineageIds",
  "bestScore",
  "runnerUpScore",
  "margin",
] as const;
const TRANSITION_KEYS = ["parentLineageId", "childLineageId"] as const;
const PROJECTION_KEYS = [
  "throughStepNumber",
  "registrationPanelStepNumber",
  "decisionPanelStepNumber",
  "tiePolicy",
  "parents",
  "attempts",
] as const;

function parseLocalIdentity(value: unknown, path: string): RealBuildLineageLocalIdentity {
  const row = exactLineageEvidenceRecord(value, path, ["kind", "id"]);
  if (row.kind !== "decision" && row.kind !== "evidence") {
    throw new TypeError(`${path}.kind must be "decision" or "evidence".`);
  }
  return {
    kind: row.kind,
    id: lineageEvidenceString(row.id, `${path}.id`),
  };
}

function parseIdentity(value: unknown, path: string): RealBuildLineageIdentity {
  const row = exactLineageEvidenceRecord(value, path, IDENTITY_KEYS);
  return snapshotRealBuildLineageIdentity({
    candidateId: lineageEvidenceString(row.candidateId, `${path}.candidateId`),
    documentHash: lineageEvidenceString(row.documentHash, `${path}.documentHash`),
    lineageId: lineageEvidenceString(row.lineageId, `${path}.lineageId`),
    lineageOrigin: row.lineageOrigin,
    localIdentity: parseLocalIdentity(row.localIdentity, `${path}.localIdentity`),
    originLineageId: lineageEvidenceString(row.originLineageId, `${path}.originLineageId`),
    parentLineageId:
      row.parentLineageId === null
        ? null
        : lineageEvidenceString(row.parentLineageId, `${path}.parentLineageId`),
    throughStepNumber: printedStepNumber(row.throughStepNumber, `${path}.throughStepNumber`, 0),
  });
}

function parseAttemptStatus(value: unknown, path: string): RealBuildLineageAttemptStatus {
  if (
    value !== "seeded" &&
    value !== "scored" &&
    value !== "not-observable" &&
    value !== "failed"
  ) {
    throw new TypeError(`${path} is not a lineage attempt status.`);
  }
  return value;
}

function parseAttempt(value: unknown, path: string): RealBuildLineageAttemptEvidence {
  const row = exactLineageEvidenceRecord(value, path, ATTEMPT_KEYS);
  const identity = parseIdentity(
    Object.fromEntries(IDENTITY_KEYS.map((key) => [key, row[key]])),
    `${path}.identity`,
  );
  return {
    ...identity,
    sourceEvidenceId:
      row.sourceEvidenceId === null
        ? null
        : lineageEvidenceString(row.sourceEvidenceId, `${path}.sourceEvidenceId`),
    attemptEvidenceId:
      row.attemptEvidenceId === null
        ? null
        : lineageEvidenceString(row.attemptEvidenceId, `${path}.attemptEvidenceId`),
    cameraEvidenceId:
      row.cameraEvidenceId === null
        ? null
        : lineageEvidenceString(row.cameraEvidenceId, `${path}.cameraEvidenceId`),
    registrationPanelStepNumber: printedStepNumber(
      row.registrationPanelStepNumber,
      `${path}.registrationPanelStepNumber`,
      1,
    ),
    status: parseAttemptStatus(row.status, `${path}.status`),
    score: row.score === null ? null : lineageEvidenceScore(row.score, `${path}.score`),
  };
}

export function snapshotRealBuildLineageTiePolicy(value: unknown): RealBuildLineageTiePolicy {
  const row = exactLineageEvidenceRecord(value, "lineage.tiePolicy", TIE_KEYS);
  if (
    row.metric !== "panel-agreement/1" ||
    row.direction !== "higher-is-better" ||
    row.exactTie !== "refuse"
  ) {
    throw new TypeError(
      `lineage.tiePolicy must use panel-agreement/1, higher-is-better, and refuse exact ties.`,
    );
  }
  return {
    metric: row.metric,
    direction: row.direction,
    minimumScore: lineageEvidenceScore(row.minimumScore, "lineage.tiePolicy.minimumScore"),
    minimumMargin: lineageEvidenceScore(row.minimumMargin, "lineage.tiePolicy.minimumMargin"),
    exactTie: row.exactTie,
  };
}

function nullableScore(value: unknown, path: string): number | null {
  return value === null ? null : lineageEvidenceScore(value, path);
}

function parseSelection(
  value: unknown,
  budget: ReturnType<typeof createLineageEvidenceInputBudget>,
): RealBuildLineageSelectionEvidence {
  const path = "lineage.selection";
  const row = exactLineageEvidenceRecord(value, path, SELECTION_KEYS);
  if (row.status !== "not-applicable" && row.status !== "selected" && row.status !== "unresolved") {
    throw new TypeError(`${path}.status is not a lineage selection status.`);
  }
  return {
    status: row.status,
    scoredGroups: lineageEvidenceInteger(row.scoredGroups, `${path}.scoredGroups`),
    selectedCandidateId:
      row.selectedCandidateId === null
        ? null
        : lineageEvidenceString(row.selectedCandidateId, `${path}.selectedCandidateId`),
    selectedCameraEvidenceId:
      row.selectedCameraEvidenceId === null
        ? null
        : lineageEvidenceString(row.selectedCameraEvidenceId, `${path}.selectedCameraEvidenceId`),
    selectedLineageIds: denseLineageEvidenceArray(
      row.selectedLineageIds,
      `${path}.selectedLineageIds`,
      budget,
    ).map((item, index) => lineageEvidenceString(item, `${path}.selectedLineageIds[${index}]`)),
    bestScore: nullableScore(row.bestScore, `${path}.bestScore`),
    runnerUpScore: nullableScore(row.runnerUpScore, `${path}.runnerUpScore`),
    margin: nullableScore(row.margin, `${path}.margin`),
  };
}

function parseStatus(value: unknown): RealBuildLineageEvidenceStatus {
  if (value !== "seeded" && value !== "selected" && value !== "unresolved" && value !== "failed") {
    throw new TypeError(`lineage.status is not a current lineage evidence status.`);
  }
  return value;
}

function printedStepNumber(value: unknown, path: string, minimum = 1): number {
  const number = lineageEvidenceInteger(value, path, minimum);
  if (number > 359) throw new RangeError(`${path} must not exceed printed step 359.`);
  return number;
}

function parseTransition(value: unknown, path: string): RealBuildLineageTransitionEvidence {
  const row = exactLineageEvidenceRecord(value, path, TRANSITION_KEYS);
  return {
    parentLineageId: lineageEvidenceString(row.parentLineageId, `${path}.parentLineageId`),
    childLineageId: lineageEvidenceString(row.childLineageId, `${path}.childLineageId`),
  };
}

function requireMaximumAttempts(maximumAttempts: number): number {
  if (
    !Number.isSafeInteger(maximumAttempts) ||
    maximumAttempts < 1 ||
    maximumAttempts > MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS
  ) {
    throw new RangeError(
      `Lineage evidence maximumAttempts must be a safe integer from 1 through ${MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS}.`,
    );
  }
  return maximumAttempts;
}

export function snapshotRealBuildLineageEvidenceProjectionInput(
  value: unknown,
  maximumAttempts = DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
): RealBuildLineageEvidenceProjectionInput {
  const maximum = requireMaximumAttempts(maximumAttempts);
  const row = exactLineageEvidenceRecord(value, "lineage projection input", PROJECTION_KEYS);
  const budget = createLineageEvidenceInputBudget(maximum * 2);
  const parents = denseLineageEvidenceArray(row.parents, "lineage projection parents", budget).map(
    (item, index) => parseIdentity(item, `lineage projection parents[${index}]`),
  );
  const attempts = denseLineageEvidenceArray(
    row.attempts,
    "lineage projection attempts",
    budget,
  ).map((item, index) => parseAttempt(item, `lineage projection attempts[${index}]`));
  if (attempts.length > maximum || parents.length > maximum) {
    throw new RangeError(
      `lineage projection parents or attempts exceed maximumAttempts ${maximum}.`,
    );
  }
  return freezeLineageEvidence({
    throughStepNumber: printedStepNumber(
      row.throughStepNumber,
      "lineage projection throughStepNumber",
      0,
    ),
    registrationPanelStepNumber: printedStepNumber(
      row.registrationPanelStepNumber,
      "lineage projection registrationPanelStepNumber",
      1,
    ),
    decisionPanelStepNumber:
      row.decisionPanelStepNumber === null
        ? null
        : printedStepNumber(
            row.decisionPanelStepNumber,
            "lineage projection decisionPanelStepNumber",
            1,
          ),
    tiePolicy: snapshotRealBuildLineageTiePolicy(row.tiePolicy),
    parents,
    attempts,
  });
}

/** Internal parser for already detached inert JSON or trusted projection snapshots. */
export function parseDetachedRealBuildLineageEvidence(
  value: unknown,
  maximumAttempts = DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
): RealBuildLineageEvidence {
  const maximum = requireMaximumAttempts(maximumAttempts);
  const row = exactLineageEvidenceRecord(value, "lineage", TOP_KEYS);
  if (row.schemaVersion !== REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError(
      `lineage.schemaVersion must be ${REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION}.`,
    );
  }
  const budget = createLineageEvidenceInputBudget(maximum * 4);
  const parents = denseLineageEvidenceArray(row.parents, "lineage.parents", budget).map(
    (item, index) => parseIdentity(item, `lineage.parents[${index}]`),
  );
  const attempts = denseLineageEvidenceArray(row.attempts, "lineage.attempts", budget).map(
    (item, index) => parseAttempt(item, `lineage.attempts[${index}]`),
  );
  if (attempts.length > maximum || parents.length > maximum) {
    throw new RangeError(`lineage parents or attempts exceed maximumAttempts ${maximum}.`);
  }
  const transitions = denseLineageEvidenceArray(row.transitions, "lineage.transitions", budget).map(
    (item, index) => parseTransition(item, `lineage.transitions[${index}]`),
  );
  const authority = exactLineageEvidenceRecord(
    row.completionAuthority,
    "lineage.completionAuthority",
    ["status", "authorized", "reason"],
  );
  if (
    authority.status !== "absent" ||
    authority.authorized !== false ||
    authority.reason !== "lineage-evidence-is-inspection-only"
  ) {
    throw new TypeError(`lineage completionAuthority cannot authorize completion.`);
  }
  const evidence: RealBuildLineageEvidence = {
    schemaVersion: REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION,
    status: parseStatus(row.status),
    throughStepNumber: printedStepNumber(row.throughStepNumber, "lineage.throughStepNumber", 0),
    registrationPanelStepNumber: printedStepNumber(
      row.registrationPanelStepNumber,
      "lineage.registrationPanelStepNumber",
      1,
    ),
    decisionPanelStepNumber:
      row.decisionPanelStepNumber === null
        ? null
        : printedStepNumber(row.decisionPanelStepNumber, "lineage.decisionPanelStepNumber", 1),
    tiePolicy: snapshotRealBuildLineageTiePolicy(row.tiePolicy),
    parents,
    attempts,
    selection: parseSelection(row.selection, budget),
    transitions,
    completionAuthority: {
      status: "absent",
      authorized: false,
      reason: "lineage-evidence-is-inspection-only",
    },
  };
  validateRealBuildLineageEvidence(evidence);
  return freezeLineageEvidence(evidence);
}
