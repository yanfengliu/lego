import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  canonicalSha256,
  deepFreeze,
  documentStructuralHash,
  verifyAssemblyPatchAgainstCapability,
} from "@lego-studio/brick-kernel";
import type { AssemblyPatchV1, BrickDocumentV1 } from "@lego-studio/protocol";

import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import {
  createRealBuildAutomaticScope,
  prepareRealBuildAutomaticPrintedStep,
  snapshotRealBuildAutomaticPrintedStepMetadata,
  type RealBuildAutomaticPrintedStepMetadata,
} from "./real-build-automatic-placement-step";

export const REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER = 44;

export const REAL_BUILD_PREFIX50_ZERO_STEP_MANIFEST = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-zero-step-manifest/1",
  compilerVersion: "lego.real-build-prefix50-zero-step-compiler/1",
  automaticPreparationPolicy: "exact-contiguous-automatic-printed-step/1",
  transitionPolicy: "printed-step-44-only-no-parts-no-connections/1",
  verificationPolicy: "normalized-scope-plus-independent-patch-replay/1",
  kernelCompilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
});

export const REAL_BUILD_PREFIX50_ZERO_STEP_COMPILER_SNAPSHOT_HASH = canonicalDigest(
  REAL_BUILD_PREFIX50_ZERO_STEP_MANIFEST,
);

export interface RealBuildPrefix50ZeroStepSuccess {
  readonly ok: true;
  readonly document: BrickDocumentV1;
  readonly patch: AssemblyPatchV1;
  readonly compilerInputDigest: `sha256:${string}`;
  readonly targetDocumentHash: `sha256:${string}`;
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
    throw new TypeError(
      `${label} must contain exactly ${wanted.join(", ")}; actions, transforms, and witnesses are not accepted.`,
    );
  }
}

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}-${canonicalSha256(value).slice(0, 24)}`;
}

/**
 * Compiles the booklet's genuine zero-piece transition without manufacturing
 * an empty placement witness. The normal automatic step preparation owns
 * contiguity, then the normal scope verifier independently replays its patch.
 */
export function compileRealBuildPrefix50ZeroPieceStep(
  unsafeInput: unknown,
): RealBuildPrefix50ZeroStepSuccess {
  exactKeys(
    unsafeInput,
    ["documentSnapshot", "printedStep", "printedStepNumber"],
    "Prefix-50 zero-piece input",
  );
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    data(unsafeInput, "documentSnapshot", "Prefix-50 zero-piece input"),
  );
  const printedStepNumber = data(unsafeInput, "printedStepNumber", "Prefix-50 zero-piece input");
  if (printedStepNumber !== REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER) {
    throw new TypeError(
      `Prefix-50 zero-piece compilation is reserved for exact printed step ${REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER}; found ${String(printedStepNumber)}.`,
    );
  }
  const printedStep = snapshotRealBuildAutomaticPrintedStepMetadata(
    data(unsafeInput, "printedStep", "Prefix-50 zero-piece input"),
  );
  return compileSnapshot(documentSnapshot, printedStep);
}

function compileSnapshot(
  snapshot: RealBuildCandidateDocumentSnapshot,
  printedStep: Readonly<RealBuildAutomaticPrintedStepMetadata>,
): RealBuildPrefix50ZeroStepSuccess {
  const document = snapshot.document;
  const compilerInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-zero-step-input/1",
    baseCanonicalBytesHash: snapshot.canonicalBytesHash,
    baseCanonicalByteLength: snapshot.canonicalByteLength,
    baseDocumentHash: snapshot.documentHash,
    printedStepNumber: REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER,
    printedStep,
  });
  const prepared = prepareRealBuildAutomaticPrintedStep({
    document,
    printedStepNumber: REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER,
    metadata: printedStep,
    compilerInputDigest,
  });
  const scope = createRealBuildAutomaticScope({
    document,
    printedStepNumber: REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER,
    maximumAddedParts: 0,
    maximumOperations: prepared.preparationOperations.length,
    requiredAttachmentPorts: [],
    compilerInputDigest,
    phase: "combined",
  });
  const targetDocumentHash = documentStructuralHash(prepared.documentWithStep);
  const candidateId = realBuildDocumentCandidateId(targetDocumentHash);
  const patch: AssemblyPatchV1 = {
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: document.revision,
    baseDocumentHash: documentStructuralHash(document),
    truthSnapshotHash: canonicalDigest(document.truth),
    scopeCapabilityId: scope.capabilityId,
    scopeDigest: canonicalDigest(scope),
    operations: [...prepared.preparationOperations],
    provenance: {
      jobId: deterministicId("prefix50-zero-job", { compilerInputDigest }),
      candidateId,
      compilerSnapshotHash: REAL_BUILD_PREFIX50_ZERO_STEP_COMPILER_SNAPSHOT_HASH,
      buildProgramHash: canonicalDigest({
        schemaVersion: "lego.real-build-prefix50-zero-step-program/1",
        compilerInputDigest,
        operations: prepared.preparationOperations,
      }),
    },
  };
  const verified = verifyAssemblyPatchAgainstCapability(document, patch, scope);
  if (!verified.ok) {
    const first = verified.issues[0];
    throw new TypeError(
      `Prefix-50 zero-piece step failed independent patch verification${first ? ` (${first.code} at ${first.path})` : ""}.`,
    );
  }
  const target = verified.document.steps[REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER - 1];
  if (
    documentStructuralHash(verified.document) !== targetDocumentHash ||
    verified.document.parts.length !== document.parts.length ||
    verified.document.connections.length !== document.connections.length ||
    verified.document.steps.length !== document.steps.length + 1 ||
    target?.index !== REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER - 1 ||
    target.partIds.length !== 0
  ) {
    throw new TypeError(
      "Prefix-50 zero-piece replay did not append exactly one empty contiguous BuildStep while retaining the graph.",
    );
  }
  return deepFreeze({
    ok: true as const,
    document: verified.document,
    patch,
    compilerInputDigest,
    targetDocumentHash,
  });
}
