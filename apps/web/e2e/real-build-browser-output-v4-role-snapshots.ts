import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type {
  RealBuildBrowserBranchEvidenceV1,
  RealBuildBrowserBranchObservationReference,
  RealBuildBrowserCompiledBranchJsonReference,
} from "./real-build-browser-output-v4-types";

interface VerifiedBranchRoleSnapshots {
  readonly compiled: Uint8Array;
  readonly observations: Uint8Array;
}

const BYTE_ARRAY = Uint8Array;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_BYTE_OFFSET = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_SET = Uint8Array.prototype.set;
const ARRAY_FIND = Array.prototype.find;
const OBJECT_FREEZE = intrinsicRealBuildFreeze;
const REFLECT_APPLY = Reflect.apply;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_HAS = WeakMap.prototype.has;
const WEAK_MAP_SET = WeakMap.prototype.set;

export interface RealBuildBrowserBranchStepEvidenceBytes {
  readonly compiledLineage: Uint8Array;
  readonly observationClosure: Uint8Array | null;
  readonly observations: Uint8Array | null;
}

function copyReference(
  role: Uint8Array,
  reference:
    RealBuildBrowserCompiledBranchJsonReference | RealBuildBrowserBranchObservationReference,
): Uint8Array {
  if (TYPED_ARRAY_BUFFER === undefined || TYPED_ARRAY_BYTE_OFFSET === undefined) {
    throw new TypeError("Verified browser branch role intrinsics are unavailable.");
  }
  const buffer = REFLECT_APPLY(TYPED_ARRAY_BUFFER, role, []) as ArrayBuffer;
  const byteOffset = REFLECT_APPLY(TYPED_ARRAY_BYTE_OFFSET, role, []) as number;
  const source = new BYTE_ARRAY(buffer, byteOffset + reference.offset, reference.bytes);
  const result = new BYTE_ARRAY(reference.bytes);
  REFLECT_APPLY(TYPED_ARRAY_SET, result, [source]);
  return result;
}

/** Each factory owns an isolated brand registry; only role.ts retains its production instance. */
export function createRealBuildBrowserBranchRoleSnapshotRegistry() {
  const snapshots = new WeakMap<RealBuildBrowserBranchEvidenceV1, VerifiedBranchRoleSnapshots>();
  const retain = (
    evidence: RealBuildBrowserBranchEvidenceV1,
    compiled: Uint8Array,
    observations: Uint8Array,
  ): void => {
    REFLECT_APPLY(WEAK_MAP_SET, snapshots, [evidence, OBJECT_FREEZE({ compiled, observations })]);
  };
  const read = (
    inspectedEvidence: unknown,
    stepNumber: unknown,
  ): RealBuildBrowserBranchStepEvidenceBytes => {
    if (
      inspectedEvidence === null ||
      typeof inspectedEvidence !== "object" ||
      !REFLECT_APPLY(WEAK_MAP_HAS, snapshots, [
        inspectedEvidence as RealBuildBrowserBranchEvidenceV1,
      ])
    ) {
      throw new TypeError(
        "Browser branch step bytes require the exact result of role transport inspection.",
      );
    }
    if (
      !Number.isSafeInteger(stepNumber) ||
      (stepNumber as number) < 1 ||
      (stepNumber as number) > 359
    ) {
      throw new RangeError("Browser branch step number must be a safe integer from 1 through 359.");
    }
    const evidence = inspectedEvidence as RealBuildBrowserBranchEvidenceV1;
    const step = REFLECT_APPLY(ARRAY_FIND, evidence.steps, [
      ({ stepNumber: candidate }: RealBuildBrowserBranchEvidenceV1["steps"][number]) =>
        candidate === stepNumber,
    ]) as RealBuildBrowserBranchEvidenceV1["steps"][number] | undefined;
    if (step === undefined) {
      throw new TypeError(`Browser branch evidence has no indexed step ${String(stepNumber)}.`);
    }
    const roles = REFLECT_APPLY(WEAK_MAP_GET, snapshots, [evidence]) as VerifiedBranchRoleSnapshots;
    return OBJECT_FREEZE({
      compiledLineage: copyReference(roles.compiled, step.compiledLineage),
      observationClosure:
        step.observationClosure === null
          ? null
          : copyReference(roles.compiled, step.observationClosure),
      observations:
        step.observations === null ? null : copyReference(roles.observations, step.observations),
    });
  };
  return OBJECT_FREEZE({ retain, read });
}
