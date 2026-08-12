import {
  DEFAULT_REAL_BUILD_PANEL_CAMERA_EVIDENCE_MAXIMUM_ENTRIES,
  REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
  type RealBuildPanelCameraAttemptEvidence,
  type RealBuildPanelCameraCandidateEvidence,
  type RealBuildPanelCameraCandidateEvidenceStatus,
  type RealBuildPanelCameraEvidence,
  type RealBuildPanelCameraEvidenceHand,
  type RealBuildPanelCameraEvidenceStatus,
  type RealBuildPanelCameraEvidenceTurn,
  type RealBuildPanelCameraFailureEvidence,
  type RealBuildPanelCameraObservationEvidence,
  type RealBuildPanelCameraRegistrationEvidence,
  type RealBuildPanelCameraReservationEvidence,
  type RealBuildPanelCameraSelectedLineageEvidence,
} from "./real-build-panel-camera-evidence-types";
import {
  createEvidenceInputBudget,
  denseEvidenceArray,
  describeEvidenceValue,
  evidenceFinitePair,
  evidenceIntegerPair,
  evidenceSafeInteger,
  evidenceString,
  evidenceUnitInterval,
  exactEvidenceRecord,
  freezeEvidence,
} from "./real-build-panel-camera-evidence-parse-boundary";
import { validateRealBuildPanelCameraEvidence } from "./real-build-panel-camera-evidence-validation";
import { parsePanelCameraMeasurement } from "./real-build-panel-camera-evidence-measurement-parser";

type InputBudget = ReturnType<typeof createEvidenceInputBudget>;

const TOP_KEYS = [
  "schemaVersion",
  "status",
  "throughStepNumber",
  "registrationPanelStepNumber",
  "measurement",
  "candidates",
  "observations",
  "reservation",
  "failure",
  "physicalFrameDecision",
] as const;
const CANDIDATE_KEYS = [
  "candidateId",
  "documentHash",
  "status",
  "parentLineageIds",
  "attempts",
  "observationIds",
  "selectedObservationId",
  "selectedLineageIds",
  "failure",
] as const;
const ATTEMPT_KEYS = [
  "latticeHand",
  "latticeDeterminant",
  "turnDegrees",
  "status",
  "silhouetteIou",
  "shiftPx",
  "centrePx",
  "renderMaskDigest",
] as const;
const OBSERVATION_KEYS = [
  "candidateId",
  "lineageId",
  "parentLineageId",
  "observationId",
  "registration",
  "silhouetteIou",
] as const;
const REGISTRATION_KEYS = [
  "latticeHand",
  "latticeDeterminant",
  "registrationPanelStepNumber",
  "turnDegrees",
  "shiftPx",
] as const;
const FAILURE_KEYS = ["code", "stage", "stepNumber", "message"] as const;
const RESERVATION_KEYS = [
  "budget",
  "reservedBefore",
  "requested",
  "reservedAfter",
  "failure",
] as const;
const RESERVATION_FAILURE_KEYS = ["budget", "reservedBefore", "requested"] as const;

function parseHand(value: unknown, path: string): RealBuildPanelCameraEvidenceHand {
  if (value !== "as-fitted" && value !== "x-reflected") {
    throw new TypeError(
      `${path} must be "as-fitted" or "x-reflected"; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value;
}

function parseTurn(value: unknown, path: string): RealBuildPanelCameraEvidenceTurn {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    throw new RangeError(
      `${path} must be 0, 90, 180, or 270; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value;
}

function parseStatus(value: unknown, path: string): RealBuildPanelCameraEvidenceStatus {
  if (
    value !== "seeded" &&
    value !== "observed" &&
    value !== "unresolved" &&
    value !== "failed" &&
    value !== "budget-refused"
  ) {
    throw new TypeError(
      `${path} is not a panel-camera evidence status; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value;
}

function parseCandidateStatus(
  value: unknown,
  path: string,
): RealBuildPanelCameraCandidateEvidenceStatus {
  const status = parseStatus(value, path);
  if (status === "budget-refused") {
    throw new TypeError(`${path} cannot be "budget-refused"; refused work admits no candidate.`);
  }
  return status;
}

function parseFailure(value: unknown, path: string): RealBuildPanelCameraFailureEvidence | null {
  if (value === null) return null;
  const row = exactEvidenceRecord(value, path, FAILURE_KEYS);
  const code = evidenceString(row.code, `${path}.code`, 64);
  if (
    code !== "camera-anchor-failed" &&
    code !== "camera-handedness-unresolved" &&
    code !== "rendering-error" &&
    code !== "resource-budget-exhausted"
  ) {
    throw new TypeError(
      `${path}.code ${JSON.stringify(code)} is not emitted by panel-camera resolution.`,
    );
  }
  const stage = evidenceString(row.stage, `${path}.stage`, 32);
  if (stage !== "camera-registration" && stage !== "rendering" && stage !== "budget") {
    throw new TypeError(
      `${path}.stage ${JSON.stringify(stage)} is not a panel-camera failure stage.`,
    );
  }
  return {
    code,
    stage,
    stepNumber:
      row.stepNumber === null ? null : evidenceSafeInteger(row.stepNumber, `${path}.stepNumber`, 1),
    message: evidenceString(row.message, `${path}.message`, 8_192),
  };
}

function parseAttempt(value: unknown, path: string): RealBuildPanelCameraAttemptEvidence {
  const row = exactEvidenceRecord(value, path, ATTEMPT_KEYS);
  const status = row.status;
  if (status !== "unregistered" && status !== "empty" && status !== "scored") {
    throw new TypeError(
      `${path}.status is not unregistered, empty, or scored; received ${describeEvidenceValue(status)}.`,
    );
  }
  return {
    latticeHand: parseHand(row.latticeHand, `${path}.latticeHand`),
    latticeDeterminant:
      row.latticeDeterminant === 1
        ? 1
        : row.latticeDeterminant === -1
          ? -1
          : (() => {
              throw new TypeError(`${path}.latticeDeterminant must be 1 or -1.`);
            })(),
    turnDegrees: parseTurn(row.turnDegrees, `${path}.turnDegrees`),
    status,
    silhouetteIou:
      row.silhouetteIou === null
        ? null
        : evidenceUnitInterval(row.silhouetteIou, `${path}.silhouetteIou`),
    shiftPx: row.shiftPx === null ? null : evidenceIntegerPair(row.shiftPx, `${path}.shiftPx`),
    centrePx: row.centrePx === null ? null : evidenceFinitePair(row.centrePx, `${path}.centrePx`),
    renderMaskDigest:
      row.renderMaskDigest === null
        ? null
        : (() => {
            const digest = evidenceString(row.renderMaskDigest, `${path}.renderMaskDigest`, 71);
            if (!/^sha256:[0-9a-f]{64}$/u.test(digest)) {
              throw new TypeError(`${path}.renderMaskDigest must be a lowercase sha256 digest.`);
            }
            return digest;
          })(),
  };
}

function parseSelectedLineage(
  value: unknown,
  path: string,
): RealBuildPanelCameraSelectedLineageEvidence {
  const row = exactEvidenceRecord(value, path, ["parentLineageId", "lineageId"]);
  return {
    parentLineageId: evidenceString(row.parentLineageId, `${path}.parentLineageId`, 256),
    lineageId: evidenceString(row.lineageId, `${path}.lineageId`, 256),
  };
}

function parseCandidate(
  value: unknown,
  path: string,
  budget: InputBudget,
): RealBuildPanelCameraCandidateEvidence {
  const row = exactEvidenceRecord(value, path, CANDIDATE_KEYS);
  const strings = (entry: unknown, name: string) =>
    denseEvidenceArray(entry, `${path}.${name}`, budget).map((item, index) =>
      evidenceString(item, `${path}.${name}[${index}]`, 256),
    );
  return {
    candidateId: evidenceString(row.candidateId, `${path}.candidateId`, 256),
    documentHash: evidenceString(row.documentHash, `${path}.documentHash`, 71),
    status: parseCandidateStatus(row.status, `${path}.status`),
    parentLineageIds: strings(row.parentLineageIds, "parentLineageIds"),
    attempts: denseEvidenceArray(row.attempts, `${path}.attempts`, budget).map((item, index) =>
      parseAttempt(item, `${path}.attempts[${index}]`),
    ),
    observationIds: strings(row.observationIds, "observationIds"),
    selectedObservationId:
      row.selectedObservationId === null
        ? null
        : evidenceString(row.selectedObservationId, `${path}.selectedObservationId`, 256),
    selectedLineageIds: denseEvidenceArray(
      row.selectedLineageIds,
      `${path}.selectedLineageIds`,
      budget,
    ).map((item, index) => parseSelectedLineage(item, `${path}.selectedLineageIds[${index}]`)),
    failure: parseFailure(row.failure, `${path}.failure`),
  };
}

function parseRegistration(value: unknown, path: string): RealBuildPanelCameraRegistrationEvidence {
  const row = exactEvidenceRecord(value, path, REGISTRATION_KEYS);
  return {
    latticeHand: parseHand(row.latticeHand, `${path}.latticeHand`),
    latticeDeterminant:
      row.latticeDeterminant === 1
        ? 1
        : row.latticeDeterminant === -1
          ? -1
          : (() => {
              throw new TypeError(`${path}.latticeDeterminant must be 1 or -1.`);
            })(),
    registrationPanelStepNumber: evidenceSafeInteger(
      row.registrationPanelStepNumber,
      `${path}.registrationPanelStepNumber`,
      1,
    ),
    turnDegrees: parseTurn(row.turnDegrees, `${path}.turnDegrees`),
    shiftPx: row.shiftPx === null ? null : evidenceIntegerPair(row.shiftPx, `${path}.shiftPx`),
  };
}

function parseObservation(value: unknown, path: string): RealBuildPanelCameraObservationEvidence {
  const row = exactEvidenceRecord(value, path, OBSERVATION_KEYS);
  return {
    candidateId: evidenceString(row.candidateId, `${path}.candidateId`, 256),
    lineageId: evidenceString(row.lineageId, `${path}.lineageId`, 256),
    parentLineageId:
      row.parentLineageId === null
        ? null
        : evidenceString(row.parentLineageId, `${path}.parentLineageId`, 256),
    observationId:
      row.observationId === null
        ? null
        : evidenceString(row.observationId, `${path}.observationId`, 256),
    registration: parseRegistration(row.registration, `${path}.registration`),
    silhouetteIou:
      row.silhouetteIou === null
        ? null
        : evidenceUnitInterval(row.silhouetteIou, `${path}.silhouetteIou`),
  };
}

function parseReservation(value: unknown): RealBuildPanelCameraReservationEvidence {
  const row = exactEvidenceRecord(value, "panelCamera.reservation", RESERVATION_KEYS);
  const failure =
    row.failure === null
      ? null
      : exactEvidenceRecord(
          row.failure,
          "panelCamera.reservation.failure",
          RESERVATION_FAILURE_KEYS,
        );
  return {
    budget: evidenceSafeInteger(row.budget, "panelCamera.reservation.budget"),
    reservedBefore: evidenceSafeInteger(
      row.reservedBefore,
      "panelCamera.reservation.reservedBefore",
    ),
    requested: evidenceSafeInteger(row.requested, "panelCamera.reservation.requested"),
    reservedAfter: evidenceSafeInteger(row.reservedAfter, "panelCamera.reservation.reservedAfter"),
    failure:
      failure === null
        ? null
        : {
            budget: evidenceSafeInteger(failure.budget, "panelCamera.reservation.failure.budget"),
            reservedBefore: evidenceSafeInteger(
              failure.reservedBefore,
              "panelCamera.reservation.failure.reservedBefore",
            ),
            requested: evidenceSafeInteger(
              failure.requested,
              "panelCamera.reservation.failure.requested",
            ),
          },
  };
}

export function parseRealBuildPanelCameraEvidence(
  value: unknown,
  maximumEntries = DEFAULT_REAL_BUILD_PANEL_CAMERA_EVIDENCE_MAXIMUM_ENTRIES,
): RealBuildPanelCameraEvidence {
  const budget = createEvidenceInputBudget(maximumEntries);
  const row = exactEvidenceRecord(value, "panelCamera", TOP_KEYS);
  if (row.schemaVersion !== REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError(
      `panelCamera.schemaVersion must be ${JSON.stringify(REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION)}; received ${describeEvidenceValue(row.schemaVersion)}.`,
    );
  }
  const physical = exactEvidenceRecord(
    row.physicalFrameDecision,
    "panelCamera.physicalFrameDecision",
    ["status", "authorizedTransform", "reason"],
  );
  const parsed: RealBuildPanelCameraEvidence = {
    schemaVersion: REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
    status: parseStatus(row.status, "panelCamera.status"),
    throughStepNumber: evidenceSafeInteger(row.throughStepNumber, "panelCamera.throughStepNumber"),
    registrationPanelStepNumber: evidenceSafeInteger(
      row.registrationPanelStepNumber,
      "panelCamera.registrationPanelStepNumber",
      1,
    ),
    measurement: parsePanelCameraMeasurement(row.measurement),
    candidates: denseEvidenceArray(row.candidates, "panelCamera.candidates", budget).map(
      (item, index) => parseCandidate(item, `panelCamera.candidates[${index}]`, budget),
    ),
    observations: denseEvidenceArray(row.observations, "panelCamera.observations", budget).map(
      (item, index) => parseObservation(item, `panelCamera.observations[${index}]`),
    ),
    reservation: parseReservation(row.reservation),
    failure: parseFailure(row.failure, "panelCamera.failure"),
    physicalFrameDecision: {
      status:
        physical.status === "unresolved"
          ? "unresolved"
          : (() => {
              throw new TypeError("panelCamera.physicalFrameDecision.status must be unresolved.");
            })(),
      authorizedTransform:
        physical.authorizedTransform === null
          ? null
          : (() => {
              throw new TypeError(
                "panelCamera.physicalFrameDecision.authorizedTransform must be null.",
              );
            })(),
      reason:
        physical.reason === "panel-camera-silhouette-is-not-physical-transform-authority"
          ? physical.reason
          : (() => {
              throw new TypeError(
                "panelCamera.physicalFrameDecision.reason must refuse physical-transform authority.",
              );
            })(),
    },
  };
  validateRealBuildPanelCameraEvidence(parsed, maximumEntries);
  return freezeEvidence(parsed);
}
