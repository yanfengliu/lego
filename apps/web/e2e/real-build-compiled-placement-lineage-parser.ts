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
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES,
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
  return Object.freeze({
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
    issue: Object.freeze({
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
  return Object.freeze({
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
  return Object.freeze({
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
  return Object.freeze({
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
    selectedLineageIds: Object.freeze(
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
  return Object.freeze({
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
  const evidence: RealBuildCompiledPlacementLineageEvidence = Object.freeze({
    schemaVersion: REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION,
    status: parseStatus(row.status),
    throughStepNumber: compiledEvidenceInteger(
      row.throughStepNumber,
      "compiledLineage.throughStepNumber",
      1,
      359,
    ),
    preparedStep: parseCompiledPreparedStep(row.preparedStep),
    rootCandidates: Object.freeze(
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
    childCandidates: Object.freeze(
      compiledEvidenceArray(
        row.childCandidates,
        "compiledLineage.childCandidates",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
      ).map(parseCompiledChildCandidate),
    ),
    uniqueTransitions: Object.freeze(
      compiledEvidenceArray(
        row.uniqueTransitions,
        "compiledLineage.uniqueTransitions",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
      ).map(parseCompiledTransition),
    ),
    lineageEdges: Object.freeze(
      compiledEvidenceArray(
        row.lineageEdges,
        "compiledLineage.lineageEdges",
        MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES,
      ).map(parseCompiledLineageEdge),
    ),
    observationBytes: parseObservationBytes(row.observationBytes),
    observationRefs: Object.freeze(
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
  validateRealBuildCompiledPlacementLineage(evidence);
  return evidence;
}

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

function snapshotCompiledLineageBytes(value: unknown, maximumBytes: number): Uint8Array {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1 ||
    maximumBytes > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES
  ) {
    throw new RangeError(
      `Compiled lineage maximumBytes must be 1 through ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES}.`,
    );
  }
  let length: number;
  let buffer: ArrayBufferLike;
  let tag: string;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined
    ) {
      throw null;
    }
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
    tag = TYPED_ARRAY_TAG.call(value) as string;
  } catch {
    throw new TypeError("Compiled lineage wire input must be a genuine Uint8Array.");
  }
  if (tag !== "Uint8Array") {
    throw new TypeError("Compiled lineage wire input must be a genuine Uint8Array.");
  }
  if (length > maximumBytes) {
    throw new RangeError(
      `Compiled lineage wire input contains ${length} bytes above maximumBytes ${maximumBytes}; no text was decoded or parsed.`,
    );
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // Ordinary ArrayBuffer storage rejects the SharedArrayBuffer intrinsic.
    }
    if (shared) {
      throw new TypeError(
        "Compiled lineage wire input cannot use concurrently mutable SharedArrayBuffer storage.",
      );
    }
  }
  const snapshot = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError("Compiled lineage wire bytes changed or detached during bounded copying.");
  }
  return snapshot;
}

/** Conservatively bounds hostile JSON expansion before JSON.parse allocates it. */
function requireBoundedCompiledLineageJson(text: string): void {
  let depth = 0;
  let values = 1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      values += 1;
      if (depth > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH) {
        throw new RangeError(
          `Compiled lineage wire JSON exceeds depth ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH} before parsing.`,
        );
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") values += 1;
    if (values > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES) {
      throw new RangeError(
        `Compiled lineage wire JSON exceeds ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES} structural values before parsing.`,
      );
    }
  }
}

/** External trust boundary: accepts only bounded, snapshotted, fatal-UTF-8 JSON bytes. */
export function parseRealBuildCompiledPlacementLineage(
  value: unknown,
  maximumBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildCompiledPlacementLineageEvidence {
  const bytes = snapshotCompiledLineageBytes(value, maximumBytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Compiled lineage wire input is not well-formed UTF-8.");
  }
  requireBoundedCompiledLineageJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Compiled lineage wire input is not valid JSON.");
  }
  return parseRealBuildCompiledPlacementLineageInertJsonValue(parsed);
}
