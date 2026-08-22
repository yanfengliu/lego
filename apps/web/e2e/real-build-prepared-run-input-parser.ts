import { preflightRealBuildOptions } from "./real-build-contract";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import { snapshotRealBuildRunInput } from "./real-build-run-input-snapshot";
import type { RealBuildOptions } from "./real-build-safety";

export const MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_PREPARED_RUN_JSON_DEPTH = 128;
const MAXIMUM_PREPARED_RUN_JSON_NODES = 2_000_000;

function snapshotWireBytes(value: unknown): Uint8Array {
  return snapshotHostileUint8Array(value, {
    maximumBytes: MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES,
    typeError: "Prepared run input must be a genuine Uint8Array of UTF-8 JSON bytes.",
    oversizeError: (length) =>
      `Prepared run input contains ${length} bytes, exceeding ${MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES}; no text was decoded or parsed.`,
    sharedError: "Prepared run input must not use concurrently mutable shared storage.",
    copyError: "Prepared run input changed or detached during bounded byte copying.",
  });
}

function requireBoundedJsonStructure(text: string): void {
  let depth = 0;
  let nodes = 1;
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
    else if (character === "{" || character === "[") {
      depth += 1;
      nodes += 1;
      if (depth > MAXIMUM_PREPARED_RUN_JSON_DEPTH) {
        throw new RangeError(
          `Prepared run input JSON exceeds depth ${MAXIMUM_PREPARED_RUN_JSON_DEPTH}; it was not parsed.`,
        );
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") nodes += 1;
    if (nodes > MAXIMUM_PREPARED_RUN_JSON_NODES) {
      throw new RangeError(
        `Prepared run input JSON exceeds ${MAXIMUM_PREPARED_RUN_JSON_NODES} structural values; it was not parsed. Remove unknown expansion or split the retained input at its declared run boundary.`,
      );
    }
    if (depth < 0) throw new TypeError("Prepared run input JSON has unbalanced containers.");
  }
  if (inString || depth !== 0) {
    throw new TypeError("Prepared run input JSON has an unterminated string or container.");
  }
}

export function parseRealBuildPreparedRunInput(value: unknown): {
  readonly options: RealBuildOptions;
  readonly canonical: string;
} {
  const bytes = snapshotWireBytes(value);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Prepared run input is not well-formed UTF-8.");
  }
  requireBoundedJsonStructure(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Prepared run input is not valid JSON.");
  }
  let snapshot: ReturnType<typeof snapshotRealBuildRunInput>;
  try {
    snapshot = snapshotRealBuildRunInput(parsed as RealBuildOptions);
  } catch {
    throw new TypeError("Prepared run input is not bounded detached real-build option data.");
  }
  let failures: ReturnType<typeof preflightRealBuildOptions>;
  try {
    failures = preflightRealBuildOptions(snapshot.options);
  } catch {
    throw new TypeError("Prepared run input does not have the complete real-build option shape.");
  }
  if (failures.length > 0) {
    const first = failures[0]!;
    throw new TypeError(
      `Prepared run input failed deterministic preflight with ${first.code} at ${first.stage}; no step authority was created.`,
    );
  }
  return { options: snapshot.options, canonical: snapshot.canonical };
}
