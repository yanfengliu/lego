import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  requireRealBuildAtomicCompiledBranchBatchResult,
  type RealBuildAtomicCompiledBranchBatchResult,
} from "./real-build-atomic-compiled-branch-batch";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
} from "./real-build-compiled-observation-closure";
import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES } from "./real-build-compiled-placement-lineage-types";
import {
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL,
} from "./real-build-browser-output-v4-role-limits";
import {
  inspectHostileUint8ArrayLength,
  snapshotHostileUint8Array,
} from "./real-build-hostile-uint8array";

const MAXIMUM_BRANCH_STEPS = 359;
const HAS_NATIVE_PROXY_INSPECTION =
  typeof process !== "undefined" && typeof process.getBuiltinModule === "function";
const NODE_IS_PROXY: (value: unknown) => boolean = HAS_NATIVE_PROXY_INSPECTION
  ? (process.getBuiltinModule("node:util") as typeof import("node:util")).types.isProxy
  : () => false;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;

interface BrowserWriterStepStorage {
  readonly batchResult: RealBuildAtomicCompiledBranchBatchResult;
  readonly observation: Readonly<{
    closureBytes: unknown;
    closureLength: number;
    roleBytes: unknown | null;
    roleLength: number;
    policyInspection: unknown;
  }> | null;
}

export interface RealBuildBrowserBranchRoleWriterStepInput {
  readonly schemaVersion: "lego.real-build-browser-branch-writer-step/1";
  readonly stepNumber: number;
  readonly observation: "absent" | "present";
  readonly authority: "absent";
}

export interface RealBuildBrowserBranchRoleWriterRequest {
  readonly schemaVersion: "lego.real-build-browser-branch-writer-request/1";
  readonly steps: number;
  readonly authority: "absent";
}

const BROWSER_STEPS = new WeakMap<object, BrowserWriterStepStorage>();
const BROWSER_REQUESTS = new WeakMap<object, RealBuildBrowserBranchRoleWriterPlan>();

function weakMapGet<Value>(map: WeakMap<object, Value>, key: object): Value | undefined {
  return SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, map, [key]) as Value | undefined;
}

function weakMapSet<Value>(map: WeakMap<object, Value>, key: object, value: Value): void {
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, map, [key, value]);
}

export interface RealBuildBrowserBranchRoleWriterPlannedObservation {
  readonly closureBytes: unknown;
  readonly closureLength: number;
  readonly roleBytes: unknown | null;
  readonly roleLength: number;
  readonly policyInspection: unknown;
}

export interface RealBuildBrowserBranchRoleWriterPlannedStep {
  readonly stepNumber: number;
  readonly batchResult: RealBuildAtomicCompiledBranchBatchResult;
  readonly lineageLength: number;
  readonly observation: RealBuildBrowserBranchRoleWriterPlannedObservation | null;
}

export interface RealBuildBrowserBranchRoleWriterPlan {
  readonly steps: readonly RealBuildBrowserBranchRoleWriterPlannedStep[];
  readonly compiledBytes: number;
  readonly observationBytes: number;
}

function ownData(value: unknown, key: string, path: string): unknown {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${path} must be a data object.`);
  }
  if (NODE_IS_PROXY(value)) throw new TypeError(`${path} may not be a Proxy.`);
  if (Array.isArray(value)) throw new TypeError(`${path} must be a data object.`);
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${path}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function arrayLength(value: unknown): number {
  let isArray: boolean;
  let length: unknown;
  try {
    if (value !== null && typeof value === "object" && NODE_IS_PROXY(value)) {
      throw null;
    }
    isArray = Array.isArray(value);
    length =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")?.value
        : undefined;
  } catch {
    throw new TypeError("Browser branch writer steps could not be inspected safely.");
  }
  if (
    !isArray ||
    !Number.isSafeInteger(length) ||
    (length as number) < 0 ||
    (length as number) > MAXIMUM_BRANCH_STEPS
  ) {
    throw new RangeError(
      `Browser branch writer steps must contain 0 through ${MAXIMUM_BRANCH_STEPS} dense entries.`,
    );
  }
  return length as number;
}

function arrayEntry(value: unknown, index: number): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, String(index))
        : undefined;
  } catch {
    throw new TypeError(`Browser branch writer steps[${index}] could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(
      `Browser branch writer steps[${index}] must be an enumerable own data property.`,
    );
  }
  return descriptor.value;
}

function measuredBytes(value: unknown, maximumBytes: number, label: string): number {
  return inspectHostileUint8ArrayLength(value, {
    maximumBytes,
    typeError: `${label} must be a genuine Uint8Array.`,
    oversizeError: (length) =>
      `${label} contains ${length} bytes; maximum is ${maximumBytes}; no role bytes were copied.`,
    sharedError: `${label} cannot use concurrently mutable SharedArrayBuffer storage.`,
  });
}

export function copyRealBuildBrowserBranchRoleWriterBytes(
  value: unknown,
  exactLength: number,
  maximumBytes: number,
  label: string,
): Uint8Array {
  const snapshot = snapshotHostileUint8Array(value, {
    maximumBytes,
    typeError: `${label} must be a genuine Uint8Array.`,
    oversizeError: (length) =>
      `${label} contains ${length} bytes; maximum is ${maximumBytes}; no role output was created.`,
    sharedError: `${label} cannot use concurrently mutable SharedArrayBuffer storage.`,
    copyError: `${label} changed or detached during bounded byte copying.`,
  });
  if (snapshot.length !== exactLength) {
    throw new TypeError(
      `${label} changed from ${exactLength} to ${snapshot.length} bytes after aggregate preflight.`,
    );
  }
  return snapshot;
}

function addWithin(total: number, addition: number, maximum: number, label: string): number {
  if (addition > maximum - total) {
    throw new RangeError(
      `${label} exceed ${maximum}; no compiled or observation role bytes were copied.`,
    );
  }
  return total + addition;
}

function planBrowserWriterSteps(
  rows: readonly BrowserWriterStepStorage[],
): RealBuildBrowserBranchRoleWriterPlan {
  const steps: RealBuildBrowserBranchRoleWriterPlannedStep[] = [];
  let compiledBytes = 0;
  let observationBytes = 0;
  let terminalStepNumber: number | null = null;
  let previousStepNumber = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const path = `Browser branch writer steps[${index}]`;
    if (terminalStepNumber !== null) {
      throw new TypeError(
        `${path} follows terminal failed or budget-refused step ${terminalStepNumber}.`,
      );
    }
    const batchResult = row.batchResult;
    const stepNumber = batchResult.evidence.throughStepNumber;
    if (stepNumber <= previousStepNumber) {
      throw new TypeError(
        `${path}.batchResult retains printed step ${stepNumber}; production branch roles require strictly increasing placement-step numbers after ${previousStepNumber}.`,
      );
    }
    if (batchResult.status === "failed" || batchResult.status === "budget-refused") {
      terminalStepNumber = stepNumber;
    }
    const lineageLength = batchResult.evidenceWire.byteLength;
    if (lineageLength < 1 || lineageLength > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES) {
      throw new RangeError(`${path}.batchResult retains an impossible compiled-lineage length.`);
    }
    compiledBytes = addWithin(
      compiledBytes,
      lineageLength,
      MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
      "Browser compiled branch role bytes",
    );
    let observation: RealBuildBrowserBranchRoleWriterPlannedObservation | null = null;
    if (row.observation !== null) {
      const closureLength = row.observation.closureLength;
      const roleLength = row.observation.roleLength;
      compiledBytes = addWithin(
        compiledBytes,
        closureLength,
        MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
        "Browser compiled branch role bytes",
      );
      observationBytes = addWithin(
        observationBytes,
        roleLength,
        MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
        "Browser observation role bytes",
      );
      observation = intrinsicRealBuildFreeze({
        closureBytes: row.observation.closureBytes,
        closureLength,
        roleBytes: row.observation.roleBytes,
        roleLength,
        policyInspection: row.observation.policyInspection,
      });
    }
    steps[index] = intrinsicRealBuildFreeze({
      stepNumber,
      batchResult,
      lineageLength,
      observation,
    });
    previousStepNumber = stepNumber;
  }
  if (observationBytes > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL - compiledBytes) {
    throw new RangeError(
      `Browser branch roles exceed the combined ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL}-byte limit; no role bytes were copied.`,
    );
  }
  return intrinsicRealBuildFreeze({
    steps: intrinsicRealBuildFreeze(steps),
    compiledBytes,
    observationBytes,
  });
}

/** Creates a trap-free browser input for one module-produced batch with no observation. */
export function createRealBuildBrowserBranchRoleWriterStepInput(
  batchResultValue: unknown,
): RealBuildBrowserBranchRoleWriterStepInput {
  const batchResult = requireRealBuildAtomicCompiledBranchBatchResult(batchResultValue);
  const input = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-branch-writer-step/1" as const,
    stepNumber: batchResult.evidence.throughStepNumber,
    observation: "absent" as const,
    authority: "absent" as const,
  });
  weakMapSet(BROWSER_STEPS, input, { batchResult, observation: null });
  return input;
}

/** Measures hostile bytes positionally before branding one observed browser writer step. */
export function createRealBuildBrowserBranchRoleWriterObservedStepInput(
  batchResultValue: unknown,
  closureBytesValue: unknown,
  roleBytesValue: unknown | null,
  policyInspection: unknown,
): RealBuildBrowserBranchRoleWriterStepInput {
  const batchResult = requireRealBuildAtomicCompiledBranchBatchResult(batchResultValue);
  const closureLength = inspectHostileUint8ArrayLength(closureBytesValue, {
    maximumBytes: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
    typeError: "Browser branch writer observed closure must be a genuine Uint8Array.",
    oversizeError: (length) =>
      `Browser branch writer observed closure contains ${length} bytes; maximum is ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES}.`,
    sharedError: "Browser branch writer observed closure cannot use SharedArrayBuffer storage.",
  });
  const roleLength =
    roleBytesValue === null
      ? 0
      : inspectHostileUint8ArrayLength(roleBytesValue, {
          maximumBytes: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
          typeError: "Browser branch writer observed role must be a genuine Uint8Array.",
          oversizeError: (length) =>
            `Browser branch writer observed role contains ${length} bytes; maximum is ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES}.`,
          sharedError: "Browser branch writer observed role cannot use SharedArrayBuffer storage.",
        });
  const input = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-branch-writer-step/1" as const,
    stepNumber: batchResult.evidence.throughStepNumber,
    observation: "present" as const,
    authority: "absent" as const,
  });
  weakMapSet(BROWSER_STEPS, input, {
    batchResult,
    observation: intrinsicRealBuildFreeze({
      closureBytes: closureBytesValue,
      closureLength,
      roleBytes: roleBytesValue,
      roleLength,
      policyInspection,
    }),
  });
  return input;
}

/** Rest parameters create the only browser-side container accepted without native Proxy inspection. */
export function createRealBuildBrowserBranchRoleWriterRequest(
  ...stepInputs: readonly unknown[]
): RealBuildBrowserBranchRoleWriterRequest {
  if (stepInputs.length > MAXIMUM_BRANCH_STEPS) {
    throw new RangeError(
      `Browser branch writer request must contain 0 through ${MAXIMUM_BRANCH_STEPS} branded steps.`,
    );
  }
  const rows: BrowserWriterStepStorage[] = [];
  for (let index = 0; index < stepInputs.length; index += 1) {
    const value = stepInputs[index];
    const retained =
      value !== null && typeof value === "object" ? weakMapGet(BROWSER_STEPS, value) : undefined;
    if (retained === undefined) {
      throw new TypeError(
        `Browser branch writer request step ${index} must be the exact result of a positional step-input creator.`,
      );
    }
    rows[index] = retained;
  }
  const request = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-branch-writer-request/1" as const,
    steps: rows.length,
    authority: "absent" as const,
  });
  weakMapSet(BROWSER_REQUESTS, request, planBrowserWriterSteps(rows));
  return request;
}

export function planRealBuildBrowserBranchRoleWriterSteps(
  value: unknown,
): RealBuildBrowserBranchRoleWriterPlan {
  if (value !== null && typeof value === "object") {
    const browserRequest = weakMapGet(BROWSER_REQUESTS, value);
    if (browserRequest !== undefined) return browserRequest;
  }
  if (!HAS_NATIVE_PROXY_INSPECTION) {
    throw new TypeError(
      "Browser branch writer requires the exact result of createRealBuildBrowserBranchRoleWriterRequest when native Proxy inspection is unavailable.",
    );
  }
  const count = arrayLength(value);
  const steps: RealBuildBrowserBranchRoleWriterPlannedStep[] = [];
  let compiledBytes = 0;
  let observationBytes = 0;
  let terminalStepNumber: number | null = null;
  let previousStepNumber = 0;
  for (let index = 0; index < count; index += 1) {
    const path = `Browser branch writer steps[${index}]`;
    if (terminalStepNumber !== null) {
      throw new TypeError(
        `${path} follows terminal failed or budget-refused step ${terminalStepNumber}.`,
      );
    }
    const row = arrayEntry(value, index);
    const batchResult = requireRealBuildAtomicCompiledBranchBatchResult(
      ownData(row, "batchResult", path),
    );
    const stepNumber = batchResult.evidence.throughStepNumber;
    if (stepNumber <= previousStepNumber) {
      throw new TypeError(
        `${path}.batchResult retains printed step ${stepNumber}; production branch roles require strictly increasing placement-step numbers after ${previousStepNumber}.`,
      );
    }
    previousStepNumber = stepNumber;
    if (batchResult.status !== "compiled") terminalStepNumber = stepNumber;
    const lineageLength = batchResult.evidenceWire.byteLength;
    if (lineageLength < 1 || lineageLength > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES) {
      throw new RangeError(`${path}.batchResult retains an impossible compiled-lineage length.`);
    }
    compiledBytes = addWithin(
      compiledBytes,
      lineageLength,
      MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
      "Browser compiled branch role bytes",
    );

    const rawObservation = ownData(row, "observation", path);
    let observation: RealBuildBrowserBranchRoleWriterPlannedObservation | null = null;
    if (rawObservation !== null) {
      const closureBytes = ownData(rawObservation, "closureBytes", `${path}.observation`);
      const closureLength = measuredBytes(
        closureBytes,
        MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
        `${path}.observation.closureBytes`,
      );
      const roleBytes = ownData(rawObservation, "roleBytes", `${path}.observation`);
      const roleLength =
        roleBytes === null
          ? 0
          : measuredBytes(
              roleBytes,
              MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
              `${path}.observation.roleBytes`,
            );
      compiledBytes = addWithin(
        compiledBytes,
        closureLength,
        MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
        "Browser compiled branch role bytes",
      );
      observationBytes = addWithin(
        observationBytes,
        roleLength,
        MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
        "Browser observation role bytes",
      );
      observation = intrinsicRealBuildFreeze({
        closureBytes,
        closureLength,
        roleBytes,
        roleLength,
        policyInspection: ownData(rawObservation, "policyInspection", `${path}.observation`),
      });
    }
    steps[index] = intrinsicRealBuildFreeze({
      stepNumber,
      batchResult,
      lineageLength,
      observation,
    });
  }
  if (observationBytes > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL - compiledBytes) {
    throw new RangeError(
      `Browser branch roles exceed the combined ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL}-byte limit; no role bytes were copied.`,
    );
  }
  return intrinsicRealBuildFreeze({
    steps: intrinsicRealBuildFreeze(steps),
    compiledBytes,
    observationBytes,
  });
}
