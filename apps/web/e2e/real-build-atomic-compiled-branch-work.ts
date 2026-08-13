import {
  canonicalBrickDocument,
  canonicalDigest,
  canonicalStringify,
  documentStructuralHash,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import {
  compileRealBuildAutomaticPlacement,
  isRealBuildAutomaticPlacementCompilationResult,
} from "./real-build-automatic-placement-compiler";
import type { RealBuildAtomicCompiledBranchBatchPreparation } from "./real-build-atomic-compiled-branch-batch-input";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import { deriveRealBuildCompiledTransitionId } from "./real-build-compiled-placement-lineage-digest";
import type {
  RealBuildCompiledLineageChildCandidate,
  RealBuildCompiledPlacementTransitionEvidence,
  RealBuildCompiledValidationEvidence,
} from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPreparedSearchProposal } from "./real-build-prepared-search-batch-authority";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES } from "./real-build-prepared-search-boundary";

export type RealBuildAtomicCompiledBranchCompiler = typeof compileRealBuildAutomaticPlacement;

export interface RealBuildAtomicCompiledPhysicalWork {
  readonly digest: Sha256Digest;
  readonly canonicalBytes: string;
  readonly parentCanonicalBytes: string;
  readonly proposal: RealBuildPreparedSearchProposal;
}

export interface RealBuildAtomicCompiledPhysicalWorkPlan {
  readonly unique: readonly RealBuildAtomicCompiledPhysicalWork[];
  readonly byProposalId: ReadonlyMap<Sha256Digest, RealBuildAtomicCompiledPhysicalWork>;
  readonly indexByDigest: ReadonlyMap<Sha256Digest, number>;
}

export interface RealBuildAtomicCompiledWorkResult {
  readonly transition: RealBuildCompiledPlacementTransitionEvidence;
  readonly childCandidate: RealBuildCompiledLineageChildCandidate;
}

export interface RealBuildAtomicCompiledChildRegistry {
  readonly admit: (
    child: RealBuildCompiledLineageChildCandidate,
  ) => RealBuildCompiledLineageChildCandidate;
  readonly values: () => readonly RealBuildCompiledLineageChildCandidate[];
}

function sameChildCandidate(
  left: RealBuildCompiledLineageChildCandidate,
  right: RealBuildCompiledLineageChildCandidate,
): boolean {
  return (
    left.candidateId === right.candidateId &&
    left.documentHash === right.documentHash &&
    left.canonicalBytesHash === right.canonicalBytesHash &&
    left.canonicalByteLength === right.canonicalByteLength &&
    left.canonicalBytes === right.canonicalBytes
  );
}

/** Retains at most one exact byte string per convergent child and bounds the aggregate eagerly. */
export function createRealBuildAtomicCompiledChildRegistry(
  maximumUniqueCanonicalBytes: number,
): RealBuildAtomicCompiledChildRegistry {
  if (
    !Number.isSafeInteger(maximumUniqueCanonicalBytes) ||
    maximumUniqueCanonicalBytes < 1 ||
    maximumUniqueCanonicalBytes > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES
  ) {
    throw new RangeError(
      `Atomic compiled child byte limit must be 1 through ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES}.`,
    );
  }
  const byCandidate = new Map<string, RealBuildCompiledLineageChildCandidate>();
  const byCanonicalHash = new Map<Sha256Digest, RealBuildCompiledLineageChildCandidate>();
  let retainedBytes = 0;
  return Object.freeze({
    admit(child: RealBuildCompiledLineageChildCandidate) {
      const candidateMatch = byCandidate.get(child.candidateId);
      const hashMatch = byCanonicalHash.get(child.canonicalBytesHash);
      if (candidateMatch !== undefined || hashMatch !== undefined) {
        const shared = candidateMatch ?? hashMatch!;
        if (
          (candidateMatch !== undefined &&
            hashMatch !== undefined &&
            candidateMatch !== hashMatch) ||
          !sameChildCandidate(shared, child)
        ) {
          throw new TypeError(
            "One compiled child candidate or canonical hash aliases non-identical exact bytes.",
          );
        }
        return shared;
      }
      if (child.canonicalByteLength > maximumUniqueCanonicalBytes - retainedBytes) {
        throw new RangeError(
          `Atomic compiled unique child canonical bytes exceed ${maximumUniqueCanonicalBytes}; no partial frontier was retained.`,
        );
      }
      retainedBytes += child.canonicalByteLength;
      byCandidate.set(child.candidateId, child);
      byCanonicalHash.set(child.canonicalBytesHash, child);
      return child;
    },
    values() {
      return Object.freeze([...byCandidate.values()]);
    },
  });
}

/** Compares replay without reserializing either potentially-large child canonical string. */
export function sameRealBuildAtomicCompiledWorkResult(
  left: RealBuildAtomicCompiledWorkResult,
  right: RealBuildAtomicCompiledWorkResult,
): boolean {
  return (
    canonicalStringify(left.transition) === canonicalStringify(right.transition) &&
    sameChildCandidate(left.childCandidate, right.childCandidate)
  );
}

export function realBuildAtomicCompilerInput(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  proposal: RealBuildPreparedSearchProposal,
) {
  return Object.freeze({
    documentSnapshot: preparation.rootDocumentSnapshot,
    printedStepNumber: preparation.preparedStep.stepNumber,
    printedStep: preparation.printedStep,
    witnesses: Object.freeze(
      proposal.pieces.map(({ catalogPartId, colorId, transform, connections }) =>
        Object.freeze({ catalogPartId, colorId, transform, connections }),
      ),
    ),
  });
}

/** Plans exact physical compiler work and closes digest collisions before reservation. */
export function planRealBuildAtomicCompiledPhysicalWork(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildAtomicCompiledPhysicalWorkPlan {
  const snapshot = preparation.rootDocumentSnapshot;
  const uniqueByDigest = new Map<Sha256Digest, RealBuildAtomicCompiledPhysicalWork>();
  const byProposalId = new Map<Sha256Digest, RealBuildAtomicCompiledPhysicalWork>();
  for (const proposal of preparation.searchInspection.proposals) {
    const canonicalBytes = canonicalStringify({
      schemaVersion: "lego.real-build-atomic-compiled-physical-work/1",
      parentCandidateId: realBuildDocumentCandidateId(snapshot.documentHash),
      parentDocumentHash: snapshot.documentHash,
      parentCanonicalBytesHash: snapshot.canonicalBytesHash,
      parentCanonicalByteLength: snapshot.canonicalByteLength,
      preparedRunInputDigest: preparation.preparedStep.preparedRunInputDigest,
      printedStepIdentity: preparation.preparedStep.printedStepIdentity,
      printedStepNumber: preparation.preparedStep.stepNumber,
      printedStep: preparation.printedStep,
      projectedWitnesses: proposal.pieces,
    });
    const digest = canonicalDigest({ canonicalBytes });
    const prior = uniqueByDigest.get(digest);
    if (
      prior !== undefined &&
      (prior.canonicalBytes !== canonicalBytes ||
        prior.parentCanonicalBytes !== snapshot.canonicalBytes)
    ) {
      throw new TypeError(
        `Atomic compiled physical-work digest ${digest} aliases non-identical canonical work bytes; no budget was reserved.`,
      );
    }
    const work =
      prior ??
      Object.freeze({
        digest,
        canonicalBytes,
        parentCanonicalBytes: snapshot.canonicalBytes,
        proposal,
      } satisfies RealBuildAtomicCompiledPhysicalWork);
    uniqueByDigest.set(digest, work);
    byProposalId.set(proposal.proposalId, work);
  }
  return Object.freeze({
    unique: Object.freeze([...uniqueByDigest.values()]),
    byProposalId,
    indexByDigest: new Map([...uniqueByDigest.values()].map((work, index) => [work.digest, index])),
  });
}

function validationEvidence(
  report: Extract<
    ReturnType<RealBuildAtomicCompiledBranchCompiler>,
    { readonly ok: true }
  >["validationReport"],
): RealBuildCompiledValidationEvidence {
  if (
    !report.documentGloballyValid ||
    report.issues.some(({ severity }) => severity === "blocking")
  ) {
    throw new TypeError(
      "Atomic compiled branch compiler returned success without one globally valid blocking-issue-free document.",
    );
  }
  return Object.freeze({
    targetDocumentHash: report.targetDocumentHash as Sha256Digest,
    truthSnapshotHash: report.truthSnapshotHash as Sha256Digest,
    validatorSetHash: report.validatorSetHash as Sha256Digest,
    documentGloballyValid: true,
    blockingIssues: Object.freeze([]) as readonly [],
  });
}

export function compileRealBuildAtomicPhysicalWork(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  proposal: RealBuildPreparedSearchProposal,
  compiler: RealBuildAtomicCompiledBranchCompiler,
): RealBuildAtomicCompiledWorkResult | ReturnType<RealBuildAtomicCompiledBranchCompiler> {
  const compilation = compiler(realBuildAtomicCompilerInput(preparation, proposal));
  if (!isRealBuildAutomaticPlacementCompilationResult(compilation)) {
    throw new TypeError(
      "Atomic compiled branch compiler returned a result not created by the restricted compiler module.",
    );
  }
  if (!compilation.ok) return compilation;
  const snapshot = preparation.rootDocumentSnapshot;
  const childDocumentHash = documentStructuralHash(compilation.document) as Sha256Digest;
  const childSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(compilation.document),
    expectedDocumentHash: childDocumentHash,
  });
  const childCandidateId = realBuildDocumentCandidateId(childDocumentHash);
  const canonicalStepId = compilation.document.steps[preparation.preparedStep.stepNumber - 1]?.id;
  if (canonicalStepId === undefined) {
    throw new TypeError(
      `Atomic compiled branch proposal ${proposal.proposalId} produced no canonical printed step ${preparation.preparedStep.stepNumber}.`,
    );
  }
  const withoutId: Omit<RealBuildCompiledPlacementTransitionEvidence, "transitionId"> = {
    parentCandidateId: realBuildDocumentCandidateId(snapshot.documentHash),
    parentDocumentHash: snapshot.documentHash,
    childCandidateId,
    childDocumentHash,
    printedStep: preparation.printedStep,
    pieces: proposal.pieces,
    receipt: {
      schemaVersion: "lego.real-build-automatic-placement-receipt/1",
      compilerSnapshotHash: compilation.automaticPlacement.compilerSnapshotHash,
      compilerInputDigest: compilation.automaticPlacement.program.compilerInputDigest,
      programHash: compilation.automaticPlacement.programHash,
      placementProgramHash: compilation.automaticPlacement.placementProgramHash,
      jobId: compilation.automaticPlacement.jobId,
      candidateId: childCandidateId,
      baseCanonicalBytesHash: snapshot.canonicalBytesHash,
      baseCanonicalByteLength: snapshot.canonicalByteLength,
      baseDocumentHash: snapshot.documentHash,
      printedStepNumber: preparation.preparedStep.stepNumber,
      canonicalStepId,
      finalDocumentHash: childDocumentHash,
      finalRevision: compilation.document.revision,
      validation: validationEvidence(compilation.validationReport),
    },
  };
  return Object.freeze({
    transition: Object.freeze({
      transitionId: deriveRealBuildCompiledTransitionId(withoutId),
      ...withoutId,
    }),
    childCandidate: Object.freeze({
      candidateId: childCandidateId,
      documentHash: childDocumentHash,
      canonicalBytes: childSnapshot.canonicalBytes,
      canonicalBytesHash: childSnapshot.canonicalBytesHash,
      canonicalByteLength: childSnapshot.canonicalByteLength,
    }),
  });
}

export function isRealBuildAtomicCompiledWorkResult(
  value: RealBuildAtomicCompiledWorkResult | ReturnType<RealBuildAtomicCompiledBranchCompiler>,
): value is RealBuildAtomicCompiledWorkResult {
  return !("ok" in value);
}
