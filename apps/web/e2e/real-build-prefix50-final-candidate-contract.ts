import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  deepFreeze,
} from "@lego-studio/brick-kernel";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  ScopeCapabilityV1,
  ValidationReportV1,
} from "@lego-studio/protocol";

import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  requireRealBuildPrefix50ExactCompilation,
  type RealBuildPrefix50ExactCompilation,
} from "./real-build-prefix50-exact-compiler";
import {
  requireRealBuildPrefix50SelectedSubBuildReturn,
  type RealBuildPrefix50SelectedSubBuildReturn,
} from "./real-build-prefix50-subbuild-return";

export const REAL_BUILD_PREFIX50_FINAL_CANDIDATE_MANIFEST = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-final-candidate-manifest/2",
  compilerVersion: "lego.real-build-prefix50-final-candidate/2",
  kernelCompilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
  transitionPolicy: "one-empty-root-to-exact-320-part-50-step-document/1",
  scopePolicy: "bounded-replay-envelope-not-operation-authority/1",
  exactnessPolicy: "runtime-branded-exact-compilation-plus-digest-bound-patch-receipt/1",
  verificationPolicy: "independent-capability-replay-plus-canonical-equality/1",
  userAcceptanceAuthority: false,
} as const);

export const REAL_BUILD_PREFIX50_FINAL_CANDIDATE_SNAPSHOT_HASH = canonicalDigest(
  REAL_BUILD_PREFIX50_FINAL_CANDIDATE_MANIFEST,
);

export interface RealBuildPrefix50FinalCandidateReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-final-candidate-receipt/2";
  readonly userAcceptanceAuthority: false;
  readonly compilerSnapshotHash: `sha256:${string}`;
  readonly exactCompilationCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly placementOrdinalRosterCommitment: `sha256:${string}`;
  readonly stateCommitmentsCommitment: `sha256:${string}`;
  readonly candidateStepCommitmentsCommitment: `sha256:${string}`;
  readonly finalStepRosterCommitment: `sha256:${string}`;
  readonly selectedSubBuildReturnCommitment: `sha256:${string}`;
  readonly selectedSubBuildReturnDocumentHash: `sha256:${string}`;
  readonly selectedSubBuildReturnResultCommitment: `sha256:${string}`;
  readonly reviewedVisualBindingCommitment: `sha256:${string}`;
  readonly emptyRootDocumentHash: `sha256:${string}`;
  readonly emptyRootCanonicalBytesHash: `sha256:${string}`;
  readonly finalDocumentHash: `sha256:${string}`;
  readonly finalCanonicalDocumentCommitment: `sha256:${string}`;
  readonly verifiedCanonicalDocumentCommitment: `sha256:${string}`;
  readonly scopeDigest: `sha256:${string}`;
  readonly patchDigest: `sha256:${string}`;
  readonly truthDigest: `sha256:${string}`;
  readonly partCount: 320;
  readonly stepCount: 50;
  readonly zeroPieceStepNumber: 44;
  readonly connectionCount: number;
  readonly operationCount: number;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50FinalCandidateResult {
  readonly kind: "realBuildPrefix50FinalCandidate";
  readonly status: "verified";
  readonly userAcceptanceAuthority: false;
  readonly scope: ScopeCapabilityV1;
  readonly patch: AssemblyPatchV1;
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly receipt: RealBuildPrefix50FinalCandidateReceipt;
}

export interface RealBuildPrefix50FinalCandidateInput {
  readonly emptyRootSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly exactCompilation: RealBuildPrefix50ExactCompilation & {
    readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn;
  };
  readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn;
}

function data(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let keys: readonly string[];
  try {
    keys = Object.keys(value).sort();
  } catch {
    throw new TypeError(`${label} could not be inspected safely.`);
  }
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

export function snapshotRealBuildPrefix50FinalCandidateInput(
  unsafeInput: unknown,
): RealBuildPrefix50FinalCandidateInput {
  const label = "Prefix-50 final-candidate input";
  exactKeys(
    unsafeInput,
    ["emptyRootSnapshot", "exactCompilation", "selectedSubBuildReturn"],
    label,
  );
  const exactCompilation = requireRealBuildPrefix50ExactCompilation(
    data(unsafeInput, "exactCompilation", label),
  );
  const selectedSubBuildReturn = requireRealBuildPrefix50SelectedSubBuildReturn(
    data(unsafeInput, "selectedSubBuildReturn", label),
  );
  const carriedSelectedSubBuildReturn = data(
    exactCompilation,
    "selectedSubBuildReturn",
    "Prefix-50 branded exact compilation",
  );
  if (carriedSelectedSubBuildReturn !== selectedSubBuildReturn) {
    throw new TypeError(
      "Prefix-50 final verification requires the exact selected step-44 return carried by the branded exact compilation.",
    );
  }
  return deepFreeze({
    emptyRootSnapshot: requireRealBuildCandidateDocumentSnapshotValue(
      data(unsafeInput, "emptyRootSnapshot", label),
    ),
    exactCompilation: exactCompilation as RealBuildPrefix50FinalCandidateInput["exactCompilation"],
    selectedSubBuildReturn,
  });
}
