import {
  parseClosureCamera,
  parseClosureSource,
} from "./real-build-compiled-observation-closure-parser-commitments";
import {
  parseClosureAcceptedTransition,
  parseClosureObservation,
  parseClosureSelection,
} from "./real-build-compiled-observation-closure-parser-rows";
import {
  closureArray,
  closureDigest,
  closureInteger,
  closureRecord,
} from "./real-build-compiled-observation-closure-primitives";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
  REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION,
  type RealBuildCompiledObservationClosure,
} from "./real-build-compiled-observation-closure-types";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";

function snapshotBytes(value: unknown): Uint8Array {
  return snapshotHostileUint8Array(value, {
    maximumBytes: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
    typeError: "Compiled observation closure must be a genuine Uint8Array.",
    oversizeError: (length) =>
      `Compiled observation closure contains ${length} bytes, exceeding ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES}; no bytes were copied or decoded.`,
    sharedError: "Compiled observation closure cannot use SharedArrayBuffer storage.",
    copyError: "Compiled observation closure changed or detached during bounded byte copying.",
  });
}

function parseJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Compiled observation closure is not well-formed UTF-8.");
  }
  let depth = 0;
  let values = 1;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") depth += 1;
    else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") values += 1;
    if (depth > 128) throw new RangeError("Compiled observation closure JSON exceeds depth 128.");
    if (values > 2_000_000) {
      throw new RangeError("Compiled observation closure JSON exceeds 2000000 values.");
    }
    if (depth < 0) throw new TypeError("Compiled observation closure JSON is unbalanced.");
  }
  if (inString || depth !== 0)
    throw new TypeError("Compiled observation closure JSON is incomplete.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Compiled observation closure is not valid JSON.");
  }
}

export function parseRealBuildCompiledObservationClosure(
  bytes: unknown,
): RealBuildCompiledObservationClosure {
  const row = closureRecord(parseJson(snapshotBytes(bytes)), "compiledObservationClosure", [
    "schemaVersion",
    "compiledLineageBytesDigest",
    "roleBytes",
    "roleDigest",
    "sources",
    "cameras",
    "observations",
    "selection",
    "acceptedTransition",
    "completionAuthority",
  ]);
  if (row.schemaVersion !== REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION) {
    throw new TypeError(
      "compiledObservationClosure.schemaVersion must be compiled-observation-closure/1.",
    );
  }
  const roleBytes = closureInteger(
    row.roleBytes,
    "compiledObservationClosure.roleBytes",
    0,
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
  );
  const roleDigest =
    row.roleDigest === null
      ? null
      : closureDigest(row.roleDigest, "compiledObservationClosure.roleDigest");
  if ((roleBytes === 0) !== (roleDigest === null)) {
    throw new TypeError(
      "compiledObservationClosure roleBytes and roleDigest must be absent together.",
    );
  }
  const authority = closureRecord(
    row.completionAuthority,
    "compiledObservationClosure.completionAuthority",
    ["status", "authorized", "reason"],
  );
  if (
    authority.status !== "absent" ||
    authority.authorized !== false ||
    authority.reason !== "compiled-observation-closure-is-inspection-only"
  ) {
    throw new TypeError(
      "compiledObservationClosure must explicitly retain absent completion authority.",
    );
  }
  return Object.freeze({
    schemaVersion: REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION,
    compiledLineageBytesDigest: closureDigest(
      row.compiledLineageBytesDigest,
      "compiledObservationClosure.compiledLineageBytesDigest",
    ),
    roleBytes,
    roleDigest,
    sources: Object.freeze(
      closureArray(row.sources, "compiledObservationClosure.sources", 8_192).map(
        parseClosureSource,
      ),
    ),
    cameras: Object.freeze(
      closureArray(row.cameras, "compiledObservationClosure.cameras", 8_192).map(
        parseClosureCamera,
      ),
    ),
    observations: Object.freeze(
      closureArray(row.observations, "compiledObservationClosure.observations", 8_192).map(
        parseClosureObservation,
      ),
    ),
    selection: parseClosureSelection(row.selection),
    acceptedTransition: parseClosureAcceptedTransition(row.acceptedTransition),
    completionAuthority: Object.freeze({
      status: "absent",
      authorized: false,
      reason: "compiled-observation-closure-is-inspection-only",
    }),
  });
}
