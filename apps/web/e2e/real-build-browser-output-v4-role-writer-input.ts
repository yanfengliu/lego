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
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a data object.`);
  }
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

export function planRealBuildBrowserBranchRoleWriterSteps(
  value: unknown,
): RealBuildBrowserBranchRoleWriterPlan {
  const count = arrayLength(value);
  const steps: RealBuildBrowserBranchRoleWriterPlannedStep[] = [];
  let compiledBytes = 0;
  let observationBytes = 0;
  let terminalStepNumber: number | null = null;
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
    if (stepNumber !== index + 1) {
      throw new TypeError(
        `${path}.batchResult retains printed step ${stepNumber}; production roles require the exact contiguous prefix step ${index + 1}.`,
      );
    }
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
    steps.push(intrinsicRealBuildFreeze({ stepNumber, batchResult, lineageLength, observation }));
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
