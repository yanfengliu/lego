import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { decodeRealBuildAtomicCompiledBranchEvidenceWire } from "./real-build-atomic-compiled-branch-batch";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
} from "./real-build-compiled-observation-closure";
import { parseRealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-parser";
import {
  inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork,
  type RealBuildCompiledObservationPreflight,
} from "./real-build-compiled-observation-closure-preflight";
import { requireRealBuildCompiledObservationClosurePreReplayRows } from "./real-build-compiled-observation-closure-pre-replay";
import { verifyRealBuildCompiledObservationRows } from "./real-build-compiled-observation-closure-verification";
import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
} from "./real-build-compiled-placement-lineage-parser";
import { MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES } from "./real-build-browser-output-v4-role-limits";
import {
  copyRealBuildBrowserBranchRoleWriterBytes,
  planRealBuildBrowserBranchRoleWriterSteps,
  type RealBuildBrowserBranchRoleWriterPlan,
} from "./real-build-browser-output-v4-role-writer-input";
import {
  REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION,
  type RealBuildBrowserBranchEvidenceV1,
  type RealBuildBrowserBranchObservationReference,
  type RealBuildBrowserCompiledBranchJsonReference,
} from "./real-build-browser-output-v4-types";
import {
  chargeRealBuildBrowserBranchAggregateReplayWork,
  chargeRealBuildBrowserBranchAggregateWork,
  createRealBuildBrowserBranchAggregateWork,
} from "./real-build-browser-output-v4-semantic-work";
import { createIntrinsicUint8Array, setIntrinsicUint8Array } from "./real-build-hostile-uint8array";
import { encodeRealBuildSafeJson } from "./real-build-safe-json-bytes";
import { inspectRealBuildBrowserBranchEvidenceV1 } from "./real-build-browser-output-v4-role";

export {
  createRealBuildBrowserBranchRoleWriterObservedStepInput,
  createRealBuildBrowserBranchRoleWriterRequest,
  createRealBuildBrowserBranchRoleWriterStepInput,
  type RealBuildBrowserBranchRoleWriterRequest,
  type RealBuildBrowserBranchRoleWriterStepInput,
} from "./real-build-browser-output-v4-role-writer-input";

export interface RealBuildBrowserBranchRoleWriterResult {
  readonly evidence: RealBuildBrowserBranchEvidenceV1;
  readonly authority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "browser-branch-role-writer-is-transport-only";
  };
}

export interface RealBuildBrowserBranchRoleWriterBytes {
  readonly branchEvidence: Uint8Array;
  readonly compiledBranchRole: Uint8Array;
  readonly observationRole: Uint8Array;
}

interface PreflightedStep {
  readonly lineageDigest: Sha256Digest;
  readonly closureDigest: Sha256Digest | null;
}

const AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "browser-branch-role-writer-is-transport-only" as const,
});
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;

const retainedBytes = new WeakMap<
  object,
  Readonly<{
    branchEvidence: Uint8Array;
    compiledBranchRole: Uint8Array;
    observationRole: Uint8Array;
  }>
>();

function preflightSteps(planned: RealBuildBrowserBranchRoleWriterPlan): readonly PreflightedStep[] {
  let aggregate = createRealBuildBrowserBranchAggregateWork();
  const preflighted: PreflightedStep[] = [];
  for (let index = 0; index < planned.steps.length; index += 1) {
    const step = planned.steps[index]!;
    const path = `Browser branch writer steps[${index}]`;
    const lineageBytes = decodeRealBuildAtomicCompiledBranchEvidenceWire(
      step.batchResult.evidenceWire,
    );
    if (lineageBytes.length !== step.lineageLength) {
      throw new TypeError(`${path}.batchResult changed after aggregate byte preflight.`);
    }
    const lineageInspection = inspectRealBuildCompiledPlacementLineageWork(lineageBytes);
    let closure = null;
    let closureDigest: Sha256Digest | null = null;
    if (step.observation !== null) {
      const closureBytes = copyRealBuildBrowserBranchRoleWriterBytes(
        step.observation.closureBytes,
        step.observation.closureLength,
        MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
        `${path}.observation.closureBytes`,
      );
      closure = parseRealBuildCompiledObservationClosure(closureBytes);
      requireRealBuildCompiledObservationClosurePreReplayRows(closure);
      if (closure.roleBytes !== step.observation.roleLength) {
        throw new TypeError(
          `${path}.observation closure commits ${closure.roleBytes} raw-role bytes; measured input has ${step.observation.roleLength}.`,
        );
      }
      closureDigest = digest(closureBytes);
    }
    aggregate = chargeRealBuildBrowserBranchAggregateWork(
      aggregate,
      lineageInspection.work,
      closure,
    );
    const replayInspection = inspectRealBuildCompiledPlacementLineageReplayWork(lineageInspection);
    aggregate = chargeRealBuildBrowserBranchAggregateReplayWork(aggregate, replayInspection.work);
    preflighted[index] = intrinsicRealBuildFreeze({
      lineageDigest: digest(lineageBytes),
      closureDigest,
    });
  }
  return intrinsicRealBuildFreeze(preflighted);
}

function inspectObservationBeforeRoleCopy(
  lineageBytes: Uint8Array,
  closureBytes: Uint8Array,
  policyInspection: unknown,
): RealBuildCompiledObservationPreflight {
  const lineageInspection = inspectRealBuildCompiledPlacementLineageWork(lineageBytes);
  const replayInspection = inspectRealBuildCompiledPlacementLineageReplayWork(lineageInspection);
  validateRealBuildCompiledPlacementLineageReplayWorkInspection(replayInspection);
  return inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
    lineageInspection,
    closureBytes,
    policyInspection,
  );
}

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}` as Sha256Digest;
}

function compiledReference(
  offset: number,
  bytes: Uint8Array,
): RealBuildBrowserCompiledBranchJsonReference {
  return intrinsicRealBuildFreeze({
    role: "compiled-branch-evidence-bytes",
    offset,
    bytes: bytes.length,
    digest: digest(bytes),
    encoding: "utf8-json/1",
  });
}

function observationReference(
  offset: number,
  bytes: Uint8Array,
): RealBuildBrowserBranchObservationReference {
  return intrinsicRealBuildFreeze({
    role: "branch-observation-bytes",
    offset,
    bytes: bytes.length,
    digest: digest(bytes),
    encoding: "raw-bytes/1",
  });
}

function copyRetained(bytes: Uint8Array): Uint8Array {
  const copy = createIntrinsicUint8Array(bytes.length);
  setIntrinsicUint8Array(copy, bytes);
  return copy;
}

/**
 * Finalizes a terminal-respecting, strictly increasing placement-step sequence into two
 * dense roles. It verifies byte semantics but cannot classify any skipped prepared panels;
 * the complete /4 reader checks those gaps. It grants no source, placement, selection,
 * completion, or consent authority.
 */
export function createRealBuildBrowserBranchRoleWriterResult(
  stepInputs: unknown,
): RealBuildBrowserBranchRoleWriterResult {
  const planned = planRealBuildBrowserBranchRoleWriterSteps(stepInputs);
  const preflighted = preflightSteps(planned);
  const compiledBranchRole = createIntrinsicUint8Array(planned.compiledBytes);
  const observationRole = createIntrinsicUint8Array(planned.observationBytes);
  const steps: RealBuildBrowserBranchEvidenceV1["steps"][number][] = [];
  let compiledOffset = 0;
  let observationOffset = 0;
  for (let index = 0; index < planned.steps.length; index += 1) {
    const step = planned.steps[index]!;
    const path = `Browser branch writer steps[${index}]`;
    const admitted = preflighted[index];
    if (admitted === undefined) {
      throw new TypeError(`${path} has no aggregate semantic admission record.`);
    }
    const lineageBytes = decodeRealBuildAtomicCompiledBranchEvidenceWire(
      step.batchResult.evidenceWire,
    );
    if (
      lineageBytes.length !== step.lineageLength ||
      digest(lineageBytes) !== admitted.lineageDigest
    ) {
      throw new TypeError(`${path}.batchResult changed after aggregate semantic preflight.`);
    }
    let closureBytes: Uint8Array | null = null;
    let observationBytes: Uint8Array | null = null;
    if (step.observation !== null) {
      closureBytes = copyRealBuildBrowserBranchRoleWriterBytes(
        step.observation.closureBytes,
        step.observation.closureLength,
        MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
        `${path}.observation.closureBytes`,
      );
      if (digest(closureBytes) !== admitted.closureDigest) {
        throw new TypeError(
          `${path}.observation.closureBytes changed after aggregate semantic preflight.`,
        );
      }
      const observationPreflight = inspectObservationBeforeRoleCopy(
        lineageBytes,
        closureBytes,
        step.observation.policyInspection,
      );
      observationBytes =
        step.observation.roleBytes === null
          ? null
          : copyRealBuildBrowserBranchRoleWriterBytes(
              step.observation.roleBytes,
              step.observation.roleLength,
              MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
              `${path}.observation.roleBytes`,
            );
      verifyRealBuildCompiledObservationRows(observationPreflight, observationBytes);
    }
    setIntrinsicUint8Array(compiledBranchRole, lineageBytes, compiledOffset);
    const compiledLineage = compiledReference(compiledOffset, lineageBytes);
    compiledOffset += lineageBytes.length;
    let observationClosure: RealBuildBrowserCompiledBranchJsonReference | null = null;
    if (closureBytes !== null) {
      setIntrinsicUint8Array(compiledBranchRole, closureBytes, compiledOffset);
      observationClosure = compiledReference(compiledOffset, closureBytes);
      compiledOffset += closureBytes.length;
    }
    let observations: RealBuildBrowserBranchObservationReference | null = null;
    if (observationBytes !== null && observationBytes.length > 0) {
      setIntrinsicUint8Array(observationRole, observationBytes, observationOffset);
      observations = observationReference(observationOffset, observationBytes);
      observationOffset += observationBytes.length;
    }
    steps[index] = intrinsicRealBuildFreeze({
      stepNumber: step.stepNumber,
      compiledLineage,
      observationClosure,
      observations,
    });
  }
  if (
    compiledOffset !== compiledBranchRole.length ||
    observationOffset !== observationRole.length
  ) {
    throw new TypeError("Browser branch writer failed exact dense role closure.");
  }
  const evidence = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION,
    compiledBranchRole: intrinsicRealBuildFreeze({
      role: "compiled-branch-evidence-bytes" as const,
      bytes: compiledBranchRole.length,
      digest: digest(compiledBranchRole),
    }),
    observationRole: intrinsicRealBuildFreeze({
      role: "branch-observation-bytes" as const,
      bytes: observationRole.length,
      digest: digest(observationRole),
    }),
    steps: intrinsicRealBuildFreeze(steps),
  });
  const branchEvidence = encodeRealBuildSafeJson(evidence);
  if (branchEvidence.length > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES) {
    throw new RangeError(
      `Browser branch writer index contains ${branchEvidence.length} bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES}.`,
    );
  }
  inspectRealBuildBrowserBranchEvidenceV1(branchEvidence, compiledBranchRole, observationRole);
  const result = intrinsicRealBuildFreeze({ evidence, authority: AUTHORITY });
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, retainedBytes, [
    result,
    intrinsicRealBuildFreeze({ branchEvidence, compiledBranchRole, observationRole }),
  ]);
  return result;
}

/** Returns fresh storage; mutating a prior read cannot alter retained role bytes. */
export function readRealBuildBrowserBranchRoleWriterBytes(
  writerResult: unknown,
): RealBuildBrowserBranchRoleWriterBytes {
  if (writerResult === null || typeof writerResult !== "object") {
    throw new TypeError(
      "Browser branch role bytes require the exact module-created writer result.",
    );
  }
  const retained = SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, retainedBytes, [writerResult]) as
    | Readonly<{
        branchEvidence: Uint8Array;
        compiledBranchRole: Uint8Array;
        observationRole: Uint8Array;
      }>
    | undefined;
  if (retained === undefined) {
    throw new TypeError(
      "Browser branch role bytes require the exact module-created writer result.",
    );
  }
  return intrinsicRealBuildFreeze({
    branchEvidence: copyRetained(retained.branchEvidence),
    compiledBranchRole: copyRetained(retained.compiledBranchRole),
    observationRole: copyRetained(retained.observationRole),
  });
}
