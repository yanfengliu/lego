import {
  canonicalDigest,
  canonicalStringify,
  isBoundedDataOnlyJson,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import {
  requireRealBuildPreparedPanelInspection,
  type RealBuildPreparedPanelInspection,
} from "./real-build-prepared-step-authority";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROWS,
  REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_SCHEMA,
  REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA,
  type RealBuildBrowserOutputV4ExactDocumentBinding,
  type RealBuildBrowserOutputV4TransitionActionCommitment,
  type RealBuildBrowserOutputV4TransitionEvidenceManifest,
  type RealBuildBrowserOutputV4TransitionEvidenceRow,
  type RealBuildBrowserOutputV4TransitionValidationCommitment,
} from "./real-build-browser-output-v4-transition-frontier-types";
import {
  realBuildBrowserOutputV4TransitionArrayEntry as arrayEntry,
  realBuildBrowserOutputV4TransitionArrayLength,
  realBuildBrowserOutputV4TransitionData as data,
  realBuildBrowserOutputV4TransitionWeakSetAdd,
  realBuildBrowserOutputV4TransitionWeakSetHas,
} from "./real-build-browser-output-v4-transition-primitives";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const STEP_ID = /^real-build-step-(?:[1-9]|[1-9][0-9]|[1-2][0-9]{2}|3[0-5][0-9])$/u;
const rows = new WeakSet<object>();
const manifests = new WeakSet<object>();
const SAFE_TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });
const SAFE_TEXT_ENCODER = new TextEncoder();
const NO_COMPLETION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "transition-evidence-cannot-authorize-completion" as const,
});
function arrayLength(value: unknown, path: string, maximum: number): number {
  return realBuildBrowserOutputV4TransitionArrayLength(value, path, 0, maximum);
}

function digest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(`${path} must be one lowercase sha256 digest.`);
  }
  return value as Sha256Digest;
}

function safeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}

function binding(value: unknown, path: string): RealBuildBrowserOutputV4ExactDocumentBinding {
  return intrinsicRealBuildFreeze({
    documentHash: digest(data(value, "documentHash", path), `${path}.documentHash`),
    canonicalBytesHash: digest(
      data(value, "canonicalBytesHash", path),
      `${path}.canonicalBytesHash`,
    ),
    canonicalByteLength: safeInteger(
      data(value, "canonicalByteLength", path),
      `${path}.canonicalByteLength`,
      1,
      16 * 1024 * 1024,
    ),
  });
}

function action(value: unknown, path: string): RealBuildBrowserOutputV4TransitionActionCommitment {
  if (data(value, "kind", path) !== "transition" || data(value, "assembledPieces", path) !== 0) {
    throw new TypeError(`${path} must describe a zero-piece transition action.`);
  }
  const transition = data(value, "transition", path);
  if (transition !== "rotation" && transition !== "attachment" && transition !== "final-view") {
    throw new TypeError(`${path}.transition must be rotation, attachment, or final-view.`);
  }
  return intrinsicRealBuildFreeze({
    kind: "transition" as const,
    assembledPieces: 0 as const,
    transition,
    panelEvidenceDigest: digest(
      data(value, "panelEvidenceDigest", path),
      `${path}.panelEvidenceDigest`,
    ),
    classificationEvidenceDigest: digest(
      data(value, "classificationEvidenceDigest", path),
      `${path}.classificationEvidenceDigest`,
    ),
    evidenceDigest: digest(data(value, "evidenceDigest", path), `${path}.evidenceDigest`),
  });
}

function validation(
  value: unknown,
  path: string,
): RealBuildBrowserOutputV4TransitionValidationCommitment {
  const blockingIssues = data(value, "blockingIssues", path);
  if (arrayLength(blockingIssues, `${path}.blockingIssues`, 10_000) !== 0) {
    throw new TypeError(`${path}.blockingIssues must be the exact empty dense array.`);
  }
  if (
    data(value, "attempted", path) !== true ||
    data(value, "documentGloballyValid", path) !== true ||
    data(value, "failure", path) !== null
  ) {
    throw new TypeError(`${path} must retain one successful independent validation.`);
  }
  return intrinsicRealBuildFreeze({
    attempted: true as const,
    targetDocumentHash: digest(
      data(value, "targetDocumentHash", path),
      `${path}.targetDocumentHash`,
    ),
    truthSnapshotHash: digest(data(value, "truthSnapshotHash", path), `${path}.truthSnapshotHash`),
    validatorSetHash: digest(data(value, "validatorSetHash", path), `${path}.validatorSetHash`),
    documentGloballyValid: true as const,
    blockingIssues: intrinsicRealBuildFreeze([]) as readonly never[],
    failure: null,
  });
}

function outcome(value: unknown, path: string) {
  if (
    data(value, "status", path) !== "complete" ||
    data(value, "mechanism", path) !== "instruction-transition" ||
    data(value, "failure", path) !== null
  ) {
    throw new TypeError(`${path} must be a successful instruction-transition outcome.`);
  }
  return intrinsicRealBuildFreeze({
    status: "complete" as const,
    mechanism: "instruction-transition" as const,
    failure: null,
  });
}

function closeRow(
  value: unknown,
  preparedPanel?: RealBuildPreparedPanelInspection,
  deriveClaimedDigest = false,
): RealBuildBrowserOutputV4TransitionEvidenceRow {
  const path = "Transition evidence row";
  if (data(value, "schemaVersion", path) !== REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA) {
    throw new TypeError(`${path}.schemaVersion is unsupported.`);
  }
  const stepNumber = safeInteger(data(value, "stepNumber", path), `${path}.stepNumber`, 1, 359);
  const pageNumber = safeInteger(data(value, "pageNumber", path), `${path}.pageNumber`, 1, 10_000);
  const preparedPanelIdentity = digest(
    data(value, "preparedPanelIdentity", path),
    `${path}.preparedPanelIdentity`,
  );
  const source = binding(data(value, "source", path), `${path}.source`);
  const target = binding(data(value, "target", path), `${path}.target`);
  const committedAction = action(data(value, "action", path), `${path}.action`);
  const actionEvidenceDigest = digest(
    data(value, "actionEvidenceDigest", path),
    `${path}.actionEvidenceDigest`,
  );
  const canonicalStepId = data(value, "canonicalStepId", path);
  if (canonicalStepId !== `real-build-step-${stepNumber}` || !STEP_ID.test(canonicalStepId)) {
    throw new TypeError(`${path}.canonicalStepId must be the deterministic ID for its step.`);
  }
  for (const key of [
    "calloutPieces",
    "expectedAssembledPieces",
    "attemptedPieces",
    "placedPieces",
  ] as const) {
    if (data(value, key, path) !== 0) {
      throw new TypeError(`${path}.${key} must be zero for a metadata-only transition.`);
    }
  }
  const documentParts = safeInteger(
    data(value, "documentParts", path),
    `${path}.documentParts`,
    0,
    10_000,
  );
  const committedOutcome = outcome(data(value, "outcome", path), `${path}.outcome`);
  const committedValidation = validation(data(value, "validation", path), `${path}.validation`);
  if (
    committedValidation.targetDocumentHash !== target.documentHash ||
    committedAction.evidenceDigest !== actionEvidenceDigest
  ) {
    throw new TypeError(`${path} does not internally bind its target validation or action digest.`);
  }
  if (preparedPanel !== undefined) {
    const prepared = requireRealBuildPreparedPanelInspection(preparedPanel);
    let preparedAction: unknown;
    try {
      preparedAction = JSON.parse(prepared.actionCanonicalJson);
    } catch {
      throw new TypeError("Prepared transition action is not canonical inert JSON.");
    }
    if (
      prepared.stepNumber !== stepNumber ||
      prepared.pageNumber !== pageNumber ||
      prepared.preparedPanelIdentity !== preparedPanelIdentity ||
      prepared.actionKind !== "transition" ||
      prepared.assembledPieces !== 0 ||
      prepared.expectedAtomicPieces.length !== 0 ||
      prepared.actionEvidenceDigest !== actionEvidenceDigest ||
      committedAction.panelEvidenceDigest !== prepared.panelEvidenceDigest ||
      canonicalStringify(committedAction) !== canonicalStringify(preparedAction)
    ) {
      throw new TypeError(
        "Transition evidence action, step, page, or panel does not match the exact prepared panel.",
      );
    }
  }
  const payload = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA,
    stepNumber,
    pageNumber,
    preparedPanelIdentity,
    source,
    target,
    action: committedAction,
    actionEvidenceDigest,
    canonicalStepId,
    calloutPieces: 0 as const,
    expectedAssembledPieces: 0 as const,
    attemptedPieces: 0 as const,
    placedPieces: 0 as const,
    documentParts,
    outcome: committedOutcome,
    validation: committedValidation,
  });
  const expectedDigest = canonicalDigest(payload);
  if (!deriveClaimedDigest && data(value, "rowDigest", path) !== expectedDigest) {
    throw new TypeError(`${path}.rowDigest does not reproduce its exact commitments.`);
  }
  const closed = intrinsicRealBuildFreeze({ ...payload, rowDigest: expectedDigest });
  realBuildBrowserOutputV4TransitionWeakSetAdd(rows, closed);
  return closed;
}

export function createRealBuildBrowserOutputV4TransitionEvidenceRow(input: {
  readonly preparedPanel: RealBuildPreparedPanelInspection;
  readonly report: unknown;
  readonly source: unknown;
  readonly target: unknown;
}): RealBuildBrowserOutputV4TransitionEvidenceRow {
  const path = "Transition evidence creation input";
  const prepared = requireRealBuildPreparedPanelInspection(data(input, "preparedPanel", path));
  const report = data(input, "report", path);
  const payload = {
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA,
    stepNumber: data(report, "stepNumber", "Transition report"),
    pageNumber: data(report, "pageNumber", "Transition report"),
    preparedPanelIdentity: prepared.preparedPanelIdentity,
    source: data(input, "source", path),
    target: data(input, "target", path),
    action: data(report, "action", "Transition report"),
    actionEvidenceDigest: data(report, "actionEvidenceDigest", "Transition report"),
    canonicalStepId: data(report, "canonicalStepId", "Transition report"),
    calloutPieces: data(report, "calloutPieces", "Transition report"),
    expectedAssembledPieces: data(report, "expectedAssembledPieces", "Transition report"),
    attemptedPieces: data(report, "attemptedPieces", "Transition report"),
    placedPieces: data(report, "placedPieces", "Transition report"),
    documentParts: data(report, "documentParts", "Transition report"),
    outcome: data(report, "outcome", "Transition report"),
    validation: data(report, "validation", "Transition report"),
  };
  return closeRow({ ...payload, rowDigest: null }, prepared, true);
}

export function requireRealBuildBrowserOutputV4TransitionEvidenceRow(
  value: unknown,
): RealBuildBrowserOutputV4TransitionEvidenceRow {
  if (
    value === null ||
    typeof value !== "object" ||
    !realBuildBrowserOutputV4TransitionWeakSetHas(rows, value)
  ) {
    throw new TypeError("Transition evidence row must be created or read by this module.");
  }
  return value as RealBuildBrowserOutputV4TransitionEvidenceRow;
}

function manifestPayload(rows_: readonly RealBuildBrowserOutputV4TransitionEvidenceRow[]) {
  return {
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_SCHEMA,
    rows: rows_,
    completionAuthority: NO_COMPLETION_AUTHORITY,
  };
}

function closeManifest(
  rows_: readonly RealBuildBrowserOutputV4TransitionEvidenceRow[],
): RealBuildBrowserOutputV4TransitionEvidenceManifest {
  let previous = 0;
  const retained: RealBuildBrowserOutputV4TransitionEvidenceRow[] = [];
  for (let index = 0; index < rows_.length; index += 1) {
    const row = requireRealBuildBrowserOutputV4TransitionEvidenceRow(rows_[index]);
    if (row.stepNumber <= previous) {
      throw new TypeError("Transition evidence rows must be strictly increasing by printed step.");
    }
    previous = row.stepNumber;
    retained.push(row);
  }
  const frozenRows = intrinsicRealBuildFreeze(retained);
  const payload = manifestPayload(frozenRows);
  const manifestDigest = canonicalDigest(payload);
  const canonicalBytes = canonicalStringify({ ...payload, manifestDigest });
  const canonicalByteLength = SAFE_TEXT_ENCODER.encode(canonicalBytes).byteLength;
  if (canonicalByteLength > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_BYTES) {
    throw new RangeError("Transition evidence manifest exceeds its serialized byte limit.");
  }
  const manifest = intrinsicRealBuildFreeze({
    ...payload,
    manifestDigest,
    canonicalBytesHash: `sha256:${sha256Hex(canonicalBytes)}` as Sha256Digest,
    canonicalByteLength,
  });
  realBuildBrowserOutputV4TransitionWeakSetAdd(manifests, manifest);
  return manifest;
}

export function createRealBuildBrowserOutputV4TransitionEvidenceManifest(
  value: unknown,
): RealBuildBrowserOutputV4TransitionEvidenceManifest {
  const count = arrayLength(
    value,
    "Transition evidence manifest rows",
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROWS,
  );
  const retained: RealBuildBrowserOutputV4TransitionEvidenceRow[] = [];
  for (let index = 0; index < count; index += 1) {
    retained.push(
      requireRealBuildBrowserOutputV4TransitionEvidenceRow(
        arrayEntry(value, index, "Transition evidence manifest rows"),
      ),
    );
  }
  return closeManifest(retained);
}

export function serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(
  value: unknown,
): Uint8Array {
  const manifest = requireRealBuildBrowserOutputV4TransitionEvidenceManifest(value);
  return SAFE_TEXT_ENCODER.encode(
    canonicalStringify({
      ...manifestPayload(manifest.rows),
      manifestDigest: manifest.manifestDigest,
    }),
  );
}

function boundedJsonDepth(text: string): void {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > 16) throw new TypeError("Transition evidence manifest exceeds depth 16.");
    } else if (character === "}" || character === "]") {
      depth -= 1;
      if (depth < 0) throw new TypeError("Transition evidence manifest JSON is malformed.");
    }
  }
  if (inString || depth !== 0)
    throw new TypeError("Transition evidence manifest JSON is malformed.");
}

export function readRealBuildBrowserOutputV4TransitionEvidenceManifest(
  value: unknown,
): RealBuildBrowserOutputV4TransitionEvidenceManifest {
  const bytes = snapshotHostileUint8Array(value, {
    maximumBytes: MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_BYTES,
    typeError: "Transition evidence manifest must be a genuine Uint8Array.",
    oversizeError: (length) =>
      `Transition evidence manifest contains ${length} bytes above ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_BYTES}.`,
    sharedError: "Transition evidence manifest cannot use shared mutable storage.",
    copyError: "Transition evidence manifest changed while its bytes were copied.",
  });
  let text: string;
  try {
    text = SAFE_TEXT_DECODER.decode(bytes);
  } catch {
    throw new TypeError("Transition evidence manifest is not valid UTF-8.");
  }
  boundedJsonDepth(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TypeError("Transition evidence manifest is not valid JSON.");
  }
  if (!isBoundedDataOnlyJson(parsed, { maxDepth: 16, maxNodes: 50_000 })) {
    throw new TypeError("Transition evidence manifest exceeds its inert JSON node boundary.");
  }
  if (canonicalStringify(parsed) !== text) {
    throw new TypeError("Transition evidence manifest bytes are not exact canonical JSON.");
  }
  const path = "Transition evidence manifest";
  if (
    data(parsed, "schemaVersion", path) !== REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_SCHEMA
  ) {
    throw new TypeError(`${path}.schemaVersion is unsupported.`);
  }
  const authority = data(parsed, "completionAuthority", path);
  if (
    data(authority, "status", `${path}.completionAuthority`) !== "absent" ||
    data(authority, "authorized", `${path}.completionAuthority`) !== false ||
    data(authority, "reason", `${path}.completionAuthority`) !==
      "transition-evidence-cannot-authorize-completion"
  ) {
    throw new TypeError(`${path} must carry exactly absent completion authority.`);
  }
  const rowValues = data(parsed, "rows", path);
  const count = arrayLength(
    rowValues,
    `${path}.rows`,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROWS,
  );
  const retained: RealBuildBrowserOutputV4TransitionEvidenceRow[] = [];
  for (let index = 0; index < count; index += 1) {
    retained.push(closeRow(arrayEntry(rowValues, index, `${path}.rows`)));
  }
  const manifest = closeManifest(retained);
  if (
    data(parsed, "manifestDigest", path) !== manifest.manifestDigest ||
    manifest.canonicalBytesHash !== `sha256:${sha256Hex(bytes)}` ||
    manifest.canonicalByteLength !== bytes.byteLength
  ) {
    throw new TypeError(`${path} does not reproduce its digest, byte digest, or byte length.`);
  }
  return manifest;
}

export function requireRealBuildBrowserOutputV4TransitionEvidenceManifest(
  value: unknown,
): RealBuildBrowserOutputV4TransitionEvidenceManifest {
  if (
    value === null ||
    typeof value !== "object" ||
    !realBuildBrowserOutputV4TransitionWeakSetHas(manifests, value)
  ) {
    throw new TypeError("Transition evidence manifest must be created or read by this module.");
  }
  return value as RealBuildBrowserOutputV4TransitionEvidenceManifest;
}
