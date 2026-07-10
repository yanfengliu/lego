import { assertIdentifier, normalizeAppendInput } from "./run-ledger-codec.ts";
import { RunLedgerError, type FinalizeRunBundleInput } from "./run-ledger-types.ts";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RunLedgerError("INVALID_RECORD", "Bundle finalization must be a plain object");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) throw new Error("not plain");
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw new RunLedgerError("INVALID_RECORD", "Bundle finalization cannot be inspected", {
      cause: error,
    });
  }
  const actual = Reflect.ownKeys(descriptors);
  const expected = [...keys].sort();
  if (
    actual.some((key) => typeof key !== "string") ||
    actual.length !== expected.length ||
    (actual as string[]).sort().some((key, index) => key !== expected[index]) ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor))
  ) {
    throw new RunLedgerError(
      "INVALID_RECORD",
      "Bundle finalization has unknown, missing, or accessor fields",
    );
  }
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of expected) record[key] = descriptors[key]!.value;
  return record;
}

export function normalizeFinalizeRunBundleInput(value: unknown): FinalizeRunBundleInput {
  const record = exactRecord(value, [
    "schemaVersion",
    "namespace",
    "expectedRunId",
    "expectedEventCount",
    "expectedEventRoot",
    "append",
  ]);
  if (record.schemaVersion !== "lego.test-run-finalize/1" || record.namespace !== "test") {
    throw new RunLedgerError(
      "INVALID_RECORD",
      "Bundle finalization has an unsupported schema or namespace",
    );
  }
  assertIdentifier(record.expectedRunId, "Finalization run ID");
  if (
    !Number.isSafeInteger(record.expectedEventCount) ||
    (record.expectedEventCount as number) < 0 ||
    typeof record.expectedEventRoot !== "string" ||
    !DIGEST.test(record.expectedEventRoot)
  ) {
    throw new RunLedgerError("INVALID_RECORD", "Bundle finalization checkpoint is malformed");
  }
  const append = normalizeAppendInput(record.append);
  const transition = append.transition;
  if (
    append.expectedRunId !== record.expectedRunId ||
    append.namespace !== "test" ||
    transition.subject !== "run" ||
    transition.subjectId !== record.expectedRunId ||
    transition.from !== "draining" ||
    transition.to !== "exhausted" ||
    append.artifactRefs.length !== 1 ||
    append.artifactRefs[0]!.kind !== "bundle" ||
    append.artifactRefs[0]!.mediaType !== "application/json"
  ) {
    throw new RunLedgerError(
      "INVALID_RECORD",
      "Bundle finalization must append one draining-to-exhausted bundle manifest",
    );
  }
  return Object.freeze({
    schemaVersion: "lego.test-run-finalize/1",
    namespace: "test",
    expectedRunId: record.expectedRunId as string,
    expectedEventCount: record.expectedEventCount as number,
    expectedEventRoot: record.expectedEventRoot as `sha256:${string}`,
    append,
  });
}
