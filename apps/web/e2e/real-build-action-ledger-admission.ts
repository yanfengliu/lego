import { parseStrictJsonBytes } from "../../../scripts/part-identification-strict-json.mjs";

import { encodeRealBuildActionLedger } from "./real-build-action-ledger";
import { realBuildActionLedgerCurrentPrefixFailures } from "./real-build-action-ledger-provenance";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import { preflightRealBuildActionLedger } from "./real-build-ledger-bounds";
import type { RealBuildActionLedger } from "./real-build-ledger-contract";

export type RealBuildActionLedgerAdmissionMode = "retained-prefix" | "exact-execution";

const MAXIMUM_ACTION_LEDGER_BYTES = 16 * 1024 * 1024;
const MAXIMUM_ACTION_LEDGER_JSON_DEPTH = 128;
const MAXIMUM_ACTION_LEDGER_OBJECT_MEMBERS = 16;
const MAXIMUM_ACTION_LEDGER_ARRAY_ENTRIES = 4_000;
const MAXIMUM_ACTION_LEDGER_JSON_VALUES = 100_000;

interface ActionLedgerJsonContainer {
  readonly kind: "array" | "object";
  entries: number;
}

function snapshotActionLedgerBytes(value: unknown, label: string): Uint8Array {
  return snapshotHostileUint8Array(value, {
    maximumBytes: MAXIMUM_ACTION_LEDGER_BYTES,
    typeError: `${label} must be a genuine Uint8Array of current /4 UTF-8 JSON bytes.`,
    oversizeError: (length) =>
      `${label} contains ${length} bytes, exceeding the ${MAXIMUM_ACTION_LEDGER_BYTES}-byte ` +
      `action-ledger limit; no JSON was parsed.`,
    sharedError: `${label} must not use concurrently mutable shared storage.`,
    copyError: `${label} changed or detached during bounded byte copying.`,
  });
}

/** Rejects impossible ledger container fan-out before the strict parser allocates those rows. */
function requireBoundedActionLedgerJsonContainers(bytes: Uint8Array, label: string): void {
  const stack: ActionLedgerJsonContainer[] = [];
  let values = 1;
  let inString = false;
  let escaped = false;

  const consumeEntry = (frame: ActionLedgerJsonContainer, next: boolean): void => {
    if (!next && frame.entries > 0) return;
    frame.entries += 1;
    values += 1;
    const maximum =
      frame.kind === "object"
        ? MAXIMUM_ACTION_LEDGER_OBJECT_MEMBERS
        : MAXIMUM_ACTION_LEDGER_ARRAY_ENTRIES;
    if (frame.entries > maximum) {
      const noun = frame.kind === "object" ? "members" : "entries";
      throw new RangeError(
        `${label} JSON contains more than ${maximum} ${noun} in one ${frame.kind}; ` +
          `no action-ledger JSON was parsed.`,
      );
    }
    if (values > MAXIMUM_ACTION_LEDGER_JSON_VALUES) {
      throw new RangeError(
        `${label} JSON contains more than ${MAXIMUM_ACTION_LEDGER_JSON_VALUES} structural values; ` +
          `no action-ledger JSON was parsed.`,
      );
    }
  };

  const consumeCurrentEntry = (next: boolean): void => {
    const frame = stack[stack.length - 1];
    if (frame === undefined) return;
    if (next && frame.entries === 0) consumeEntry(frame, false);
    consumeEntry(frame, next);
  };

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (byte === 0x5c) escaped = true;
      else if (byte === 0x22) inString = false;
      continue;
    }
    if (byte === 0x22) {
      consumeCurrentEntry(false);
      inString = true;
      continue;
    }
    if (byte === 0x7b || byte === 0x5b) {
      consumeCurrentEntry(false);
      if (stack.length >= MAXIMUM_ACTION_LEDGER_JSON_DEPTH) {
        throw new RangeError(
          `${label} JSON exceeds ${MAXIMUM_ACTION_LEDGER_JSON_DEPTH} container levels; ` +
            `no action-ledger JSON was parsed.`,
        );
      }
      stack.push({ kind: byte === 0x7b ? "object" : "array", entries: 0 });
      continue;
    }
    if (byte === 0x7d || byte === 0x5d) {
      stack.pop();
      continue;
    }
    if (byte === 0x2c) {
      consumeCurrentEntry(true);
      continue;
    }
    if (byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      consumeCurrentEntry(false);
    }
  }
}

/**
 * Admits only duplicate-free, canonically encoded current /4 bytes and returns the closed clone
 * produced by the descriptor-safe shape preflight. A retained artifact may be a nonempty aligned
 * prefix; live execution additionally requires that prefix to reach the requested last step.
 */
export function admitCanonicalRealBuildActionLedgerBytes(input: {
  readonly bytes: Uint8Array;
  readonly label: string;
  readonly mode: RealBuildActionLedgerAdmissionMode;
  readonly requestedLastStep?: number;
}): RealBuildActionLedger {
  const bytes = snapshotActionLedgerBytes(input.bytes, input.label);
  requireBoundedActionLedgerJsonContainers(bytes, input.label);
  let parsed: unknown;
  try {
    parsed = parseStrictJsonBytes(bytes);
  } catch {
    throw new TypeError(
      `${input.label} must be duplicate-free finite UTF-8 JSON before current /4 admission.`,
    );
  }
  const shape = preflightRealBuildActionLedger(parsed);
  if (shape.failure !== null) {
    throw new TypeError(
      `${input.label} failed the closed current /4 schema: ${shape.failure.message}`,
    );
  }
  const requestedLastStep = input.requestedLastStep ?? shape.ledger.provenance.requestedLastStep;
  if (!Number.isSafeInteger(requestedLastStep) || requestedLastStep < 1 || requestedLastStep > 50) {
    throw new TypeError(
      `${input.label} requires one requestedLastStep integer from 1 through the current prefix boundary 50.`,
    );
  }
  const boundaryFailures = realBuildActionLedgerCurrentPrefixFailures({
    schemaVersion: shape.ledger.schemaVersion,
    provenance: shape.ledger.provenance,
    steps: shape.ledger.steps,
    requestedLastStep,
    validationLastStep:
      input.mode === "exact-execution" ? requestedLastStep : shape.ledger.steps.length,
  });
  if (boundaryFailures.length > 0) {
    throw new TypeError(
      `${input.label} failed current /4 prefix provenance: ${boundaryFailures[0]}`,
    );
  }
  const canonical = encodeRealBuildActionLedger(shape.ledger);
  if (!canonical.equals(Buffer.from(bytes))) {
    throw new TypeError(
      `${input.label} is not the exact canonical current /4 encoding; re-encode the closed ledger object.`,
    );
  }
  return shape.ledger;
}
