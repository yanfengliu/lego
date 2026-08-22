import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  parseCompiledAcceptedTransition,
  parseCompiledChildCandidate,
  parseCompiledLineageEdge,
  parseCompiledPreparedStep,
  parseCompiledReservation,
  parseCompiledRootCandidate,
  parseCompiledTransition,
} from "./real-build-compiled-placement-lineage-parser-components";
import {
  compiledEvidenceArray,
  compiledEvidenceCandidateId,
  compiledEvidenceDigest,
  compiledEvidenceInteger,
  compiledEvidenceLineageId,
  compiledEvidenceMaskReference,
  compiledEvidenceNullableScore,
  compiledEvidenceRecord,
  compiledEvidenceString,
} from "./real-build-compiled-placement-lineage-parse-primitives";
import { parseCompiledSearchRequest } from "./real-build-compiled-placement-lineage-parser-search-request";
import type { RealBuildCompiledPlacementTerminalFailure } from "./real-build-compiled-placement-lineage-types";
import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
  REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION,
  type RealBuildCompiledLineageSelection,
  type RealBuildCompiledObservationReference,
  type RealBuildCompiledObservationByteRole,
  type RealBuildCompiledPlacementLineageEvidence,
  type RealBuildCompiledPlacementLineageStatus,
} from "./real-build-compiled-placement-lineage-types";
import { validateRealBuildCompiledPlacementLineage } from "./real-build-compiled-placement-lineage-validation";
import { inspectRealBuildCompiledPlacementLineageWire } from "./real-build-compiled-placement-lineage-wire";
import {
  measureRealBuildCompiledPlacementLineageReplayWork,
  requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits,
  type RealBuildCompiledPlacementLineageReplayWork,
} from "./real-build-compiled-placement-lineage-replay-work";
import {
  measureRealBuildCompiledPlacementLineageStructuralWork,
  type RealBuildCompiledPlacementLineageWork,
} from "./real-build-compiled-placement-lineage-structural-work";

export const REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_WORK_INSPECTION_SCHEMA_VERSION =
  "lego.real-build-compiled-placement-lineage-work-inspection/1" as const;
export const REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_REPLAY_WORK_INSPECTION_SCHEMA_VERSION =
  "lego.real-build-compiled-placement-lineage-replay-work-inspection/1" as const;

export type { RealBuildCompiledPlacementLineageWork } from "./real-build-compiled-placement-lineage-structural-work";

export interface RealBuildCompiledPlacementLineageWorkInspection {
  readonly schemaVersion: typeof REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_WORK_INSPECTION_SCHEMA_VERSION;
  readonly compiledLineageBytesDigest: `sha256:${string}`;
  readonly evidence: RealBuildCompiledPlacementLineageEvidence;
  readonly work: RealBuildCompiledPlacementLineageWork;
}

export interface RealBuildCompiledPlacementLineageReplayWorkInspection {
  readonly schemaVersion: typeof REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_REPLAY_WORK_INSPECTION_SCHEMA_VERSION;
  readonly compiledLineageBytesDigest: `sha256:${string}`;
  readonly work: RealBuildCompiledPlacementLineageReplayWork;
}

const workInspections = new WeakSet<object>();
const validatedWorkInspections = new WeakSet<object>();
const replayAdmittedWorkInspections = new WeakSet<object>();
const replayWorkInspections = new WeakSet<object>();
const replayWorkInspectionByWorkInspection = new WeakMap<
  object,
  RealBuildCompiledPlacementLineageReplayWorkInspection
>();
const workInspectionByReplayWorkInspection = new WeakMap<object, object>();

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "status",
  "throughStepNumber",
  "preparedStep",
  "rootCandidates",
  "searchRequest",
  "searchReservation",
  "terminalFailure",
  "childCandidates",
  "uniqueTransitions",
  "lineageEdges",
  "observationBytes",
  "observationRefs",
  "selection",
  "acceptedTransition",
  "completionAuthority",
] as const;

function parseTerminalFailure(value: unknown): RealBuildCompiledPlacementTerminalFailure | null {
  if (value === null) return null;
  const path = "compiledLineage.terminalFailure";
  const row = compiledEvidenceRecord(value, path, [
    "schemaVersion",
    "proposalId",
    "phase",
    "code",
    "attemptedUniqueTransitionNumber",
    "uniquePhysicalTransitionCount",
    "issue",
    "failureDigest",
  ]);
  if (row.schemaVersion !== "lego.real-build-compiled-placement-terminal-failure/1") {
    throw new TypeError(`${path}.schemaVersion must be compiled-placement-terminal-failure/1.`);
  }
  if (
    row.phase !== "compilation" &&
    row.phase !== "evidence-closure" &&
    row.phase !== "aggregate-evidence-closure"
  ) {
    throw new TypeError(
      `${path}.phase must be compilation, evidence-closure, or aggregate-evidence-closure.`,
    );
  }
  if (
    row.code !== "automatic-compilation-failed" &&
    row.code !== "compiled-evidence-closure-failed"
  ) {
    throw new TypeError(`${path}.code is not a known stable compiled-placement failure code.`);
  }
  const issue = compiledEvidenceRecord(row.issue, `${path}.issue`, ["code", "path", "reason"]);
  return intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-compiled-placement-terminal-failure/1",
    proposalId:
      row.proposalId === null ? null : compiledEvidenceDigest(row.proposalId, `${path}.proposalId`),
    phase: row.phase,
    code: row.code,
    attemptedUniqueTransitionNumber:
      row.attemptedUniqueTransitionNumber === null
        ? null
        : compiledEvidenceInteger(
            row.attemptedUniqueTransitionNumber,
            `${path}.attemptedUniqueTransitionNumber`,
            1,
            MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
          ),
    uniquePhysicalTransitionCount: compiledEvidenceInteger(
      row.uniquePhysicalTransitionCount,
      `${path}.uniquePhysicalTransitionCount`,
      1,
      MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
    ),
    issue: intrinsicRealBuildFreeze({
      code: compiledEvidenceString(issue.code, `${path}.issue.code`, 256),
      path: compiledEvidenceString(issue.path, `${path}.issue.path`, 256),
      reason: compiledEvidenceString(issue.reason, `${path}.issue.reason`, 1_024),
    }),
    failureDigest: compiledEvidenceDigest(row.failureDigest, `${path}.failureDigest`),
  });
}

function parseStatus(value: unknown): RealBuildCompiledPlacementLineageStatus {
  if (
    value !== "selected" &&
    value !== "unresolved" &&
    value !== "failed" &&
    value !== "budget-refused"
  ) {
    throw new TypeError(
      "compiledLineage.status must be selected, unresolved, failed, or budget-refused.",
    );
  }
  return value;
}

function parseObservation(value: unknown, index: number): RealBuildCompiledObservationReference {
  const path = `compiledLineage.observationRefs[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "observationId",
    "lineageId",
    "sourceEvidenceId",
    "cameraEvidenceId",
    "registrationPanelStepNumber",
    "status",
    "score",
    "sourceMask",
    "candidateMask",
    "excludedMask",
  ]);
  if (row.status !== "scored" && row.status !== "not-observable" && row.status !== "failed") {
    throw new TypeError(`${path}.status must be scored, not-observable, or failed.`);
  }
  if (row.cameraEvidenceId !== null && typeof row.cameraEvidenceId !== "string") {
    throw new TypeError(`${path}.cameraEvidenceId must be null or a bounded string.`);
  }
  return intrinsicRealBuildFreeze({
    observationId: compiledEvidenceString(row.observationId, `${path}.observationId`),
    lineageId: compiledEvidenceLineageId(row.lineageId, `${path}.lineageId`),
    sourceEvidenceId: compiledEvidenceString(row.sourceEvidenceId, `${path}.sourceEvidenceId`),
    cameraEvidenceId:
      row.cameraEvidenceId === null
        ? null
        : compiledEvidenceString(row.cameraEvidenceId, `${path}.cameraEvidenceId`),
    registrationPanelStepNumber: compiledEvidenceInteger(
      row.registrationPanelStepNumber,
      `${path}.registrationPanelStepNumber`,
      1,
      359,
    ),
    status: row.status,
    score: compiledEvidenceNullableScore(row.score, `${path}.score`),
    sourceMask: compiledEvidenceMaskReference(row.sourceMask, `${path}.sourceMask`),
    candidateMask: compiledEvidenceMaskReference(row.candidateMask, `${path}.candidateMask`),
    excludedMask: compiledEvidenceMaskReference(row.excludedMask, `${path}.excludedMask`),
  });
}

function parseObservationBytes(value: unknown): RealBuildCompiledObservationByteRole | null {
  if (value === null) return null;
  const path = "compiledLineage.observationBytes";
  const row = compiledEvidenceRecord(value, path, ["role", "bytes", "digest"]);
  if (row.role !== "branch-observation-bytes") {
    throw new TypeError(`${path}.role must be branch-observation-bytes.`);
  }
  return intrinsicRealBuildFreeze({
    role: "branch-observation-bytes",
    bytes: compiledEvidenceInteger(row.bytes, `${path}.bytes`, 1, 512 * 1024 * 1024),
    digest: compiledEvidenceDigest(row.digest, `${path}.digest`),
  });
}

function parseSelection(value: unknown): RealBuildCompiledLineageSelection {
  const path = "compiledLineage.selection";
  const row = compiledEvidenceRecord(value, path, [
    "status",
    "decisionPanelStepNumber",
    "selectedCandidateId",
    "selectedLineageIds",
    "bestScore",
    "runnerUpScore",
    "margin",
  ]);
  if (row.status !== "not-applicable" && row.status !== "selected" && row.status !== "unresolved") {
    throw new TypeError(`${path}.status must be not-applicable, selected, or unresolved.`);
  }
  if (row.selectedCandidateId !== null && typeof row.selectedCandidateId !== "string") {
    throw new TypeError(`${path}.selectedCandidateId must be null or a document candidate ID.`);
  }
  return intrinsicRealBuildFreeze({
    status: row.status,
    decisionPanelStepNumber:
      row.decisionPanelStepNumber === null
        ? null
        : compiledEvidenceInteger(
            row.decisionPanelStepNumber,
            `${path}.decisionPanelStepNumber`,
            1,
            359,
          ),
    selectedCandidateId:
      row.selectedCandidateId === null
        ? null
        : compiledEvidenceCandidateId(row.selectedCandidateId, `${path}.selectedCandidateId`),
    selectedLineageIds: intrinsicRealBuildFreeze(
      compiledEvidenceArray(row.selectedLineageIds, `${path}.selectedLineageIds`, 8_192).map(
        (id, index) => compiledEvidenceLineageId(id, `${path}.selectedLineageIds[${index}]`),
      ),
    ),
    bestScore: compiledEvidenceNullableScore(row.bestScore, `${path}.bestScore`),
    runnerUpScore: compiledEvidenceNullableScore(row.runnerUpScore, `${path}.runnerUpScore`),
    margin: compiledEvidenceNullableScore(row.margin, `${path}.margin`),
  });
}

function parseCompletionAuthority(
  value: unknown,
): RealBuildCompiledPlacementLineageEvidence["completionAuthority"] {
  const path = "compiledLineage.completionAuthority";
  const row = compiledEvidenceRecord(value, path, ["status", "authorized", "reason"]);
  if (
    row.status !== "absent" ||
    row.authorized !== false ||
    row.reason !== "compiled-placement-lineage-is-inspection-only"
  ) {
    throw new TypeError(
      `${path} must explicitly retain absent/false compiled-placement-lineage-is-inspection-only authority.`,
    );
  }
  return intrinsicRealBuildFreeze({
    status: "absent",
    authorized: false,
    reason: "compiled-placement-lineage-is-inspection-only",
  });
}

/** Parses an already-detached JSON value. Public hostile input enters through the byte parser. */
function parseRealBuildCompiledPlacementLineageInertJsonValue(
  value: unknown,
): RealBuildCompiledPlacementLineageEvidence {
  const row = compiledEvidenceRecord(value, "compiledLineage", TOP_LEVEL_KEYS);
  if (row.schemaVersion !== REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION) {
    throw new TypeError(
      `compiledLineage.schemaVersion must be ${REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION}.`,
    );
  }
  const evidence: RealBuildCompiledPlacementLineageEvidence = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION,
    status: parseStatus(row.status),
    throughStepNumber: compiledEvidenceInteger(
      row.throughStepNumber,
      "compiledLineage.throughStepNumber",
      1,
      359,
    ),
    preparedStep: parseCompiledPreparedStep(row.preparedStep),
    rootCandidates: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.rootCandidates,
        "compiledLineage.rootCandidates",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS,
        1,
      ).map(parseCompiledRootCandidate),
    ),
    searchRequest: parseCompiledSearchRequest(row.searchRequest),
    searchReservation: parseCompiledReservation(row.searchReservation),
    terminalFailure: parseTerminalFailure(row.terminalFailure),
    childCandidates: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.childCandidates,
        "compiledLineage.childCandidates",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
      ).map(parseCompiledChildCandidate),
    ),
    uniqueTransitions: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.uniqueTransitions,
        "compiledLineage.uniqueTransitions",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
      ).map(parseCompiledTransition),
    ),
    lineageEdges: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.lineageEdges,
        "compiledLineage.lineageEdges",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES,
      ).map(parseCompiledLineageEdge),
    ),
    observationBytes: parseObservationBytes(row.observationBytes),
    observationRefs: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.observationRefs,
        "compiledLineage.observationRefs",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS,
      ).map(parseObservation),
    ),
    selection: parseSelection(row.selection),
    acceptedTransition: parseCompiledAcceptedTransition(row.acceptedTransition),
    completionAuthority: parseCompletionAuthority(row.completionAuthority),
  });
  return evidence;
}

function requireWorkInspection(value: unknown): RealBuildCompiledPlacementLineageWorkInspection {
  if (value === null || typeof value !== "object" || !workInspections.has(value)) {
    throw new TypeError(
      "Compiled lineage semantic validation requires its exact branded structural work inspection.",
    );
  }
  return value as RealBuildCompiledPlacementLineageWorkInspection;
}

/** Parses and measures exact retained rows without reconstructing documents or replaying compilation. */
export function inspectRealBuildCompiledPlacementLineageWork(
  value: unknown,
  maximumBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildCompiledPlacementLineageWorkInspection {
  const wire = inspectRealBuildCompiledPlacementLineageWire(value, maximumBytes);
  const evidence = parseRealBuildCompiledPlacementLineageInertJsonValue(wire.value);
  const inspection = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_WORK_INSPECTION_SCHEMA_VERSION,
    compiledLineageBytesDigest: wire.bytesDigest,
    evidence,
    work: measureRealBuildCompiledPlacementLineageStructuralWork(evidence),
  });
  workInspections.add(inspection);
  return inspection;
}

/** Reconstructs bounded roots once and caches exact compiler replay policy meters. */
export function inspectRealBuildCompiledPlacementLineageReplayWork(
  value: unknown,
): RealBuildCompiledPlacementLineageReplayWorkInspection {
  const inspection = requireWorkInspection(value);
  const cached = replayWorkInspectionByWorkInspection.get(inspection);
  if (cached !== undefined) return cached;
  const replayInspection = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_REPLAY_WORK_INSPECTION_SCHEMA_VERSION,
    compiledLineageBytesDigest: inspection.compiledLineageBytesDigest,
    work: measureRealBuildCompiledPlacementLineageReplayWork(inspection.evidence),
  });
  replayWorkInspections.add(replayInspection);
  replayWorkInspectionByWorkInspection.set(inspection, replayInspection);
  workInspectionByReplayWorkInspection.set(replayInspection, inspection);
  return replayInspection;
}

function requireReplayWorkInspection(
  value: unknown,
): RealBuildCompiledPlacementLineageReplayWorkInspection {
  if (value === null || typeof value !== "object" || !replayWorkInspections.has(value)) {
    throw new TypeError(
      "Compiled lineage replay requires its exact branded replay-work inspection.",
    );
  }
  return value as RealBuildCompiledPlacementLineageReplayWorkInspection;
}

/** Admits only replay work measured from a branded structural inspection. */
export function validateRealBuildCompiledPlacementLineageReplayWorkInspection(
  value: unknown,
): RealBuildCompiledPlacementLineageEvidence {
  const replayInspection = requireReplayWorkInspection(value);
  const inspection = requireWorkInspection(
    workInspectionByReplayWorkInspection.get(replayInspection),
  );
  requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits(replayInspection.work);
  const evidence = validateRealBuildCompiledPlacementLineageWorkInspection(inspection);
  replayAdmittedWorkInspections.add(inspection);
  return evidence;
}

/** Preserves the public /1 parser's branded semantic-validation contract. */
export function validateRealBuildCompiledPlacementLineageWorkInspection(
  value: unknown,
): RealBuildCompiledPlacementLineageEvidence {
  const inspection = requireWorkInspection(value);
  if (!validatedWorkInspections.has(inspection)) {
    validateRealBuildCompiledPlacementLineage(inspection.evidence);
    validatedWorkInspections.add(inspection);
  }
  return inspection.evidence;
}

export function requireValidatedRealBuildCompiledPlacementLineageWorkInspection(
  value: unknown,
): RealBuildCompiledPlacementLineageWorkInspection {
  const inspection = requireWorkInspection(value);
  if (!validatedWorkInspections.has(inspection)) {
    throw new TypeError(
      "Compiled lineage observation preflight requires prior semantic validation of its exact work inspection.",
    );
  }
  return inspection;
}

export function requireReplayAdmittedRealBuildCompiledPlacementLineageWorkInspection(
  value: unknown,
): RealBuildCompiledPlacementLineageWorkInspection {
  const inspection = requireWorkInspection(value);
  if (!replayAdmittedWorkInspections.has(inspection)) {
    throw new TypeError(
      "Compiled lineage observation preflight requires prior replay-work admission and semantic validation of its exact work inspection.",
    );
  }
  return inspection;
}

/** Existing /1 trust boundary; new aggregate callers add the replay-work admission brand. */
export function parseRealBuildCompiledPlacementLineage(
  value: unknown,
  maximumBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildCompiledPlacementLineageEvidence {
  return validateRealBuildCompiledPlacementLineageWorkInspection(
    inspectRealBuildCompiledPlacementLineageWork(value, maximumBytes),
  );
}
