import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "./real-build-automatic-placement-compiler";
import {
  prepareRealBuildAtomicCompiledBranchBatch,
  requireRealBuildAtomicCompiledBranchBatchPreparation,
  type RealBuildAtomicCompiledBranchBatchPreparation,
} from "./real-build-atomic-compiled-branch-batch-input";
import {
  createRealBuildAtomicTerminalFailure,
  projectRealBuildAtomicCompilationFailure,
  realBuildAtomicLocalFailureIssue,
  sameRealBuildAtomicFailureIssue,
  type RealBuildAtomicStableFailureIssue,
} from "./real-build-atomic-compiled-branch-failure";
import {
  compileRealBuildAtomicPhysicalWork,
  createRealBuildAtomicCompiledChildRegistry,
  isRealBuildAtomicCompiledWorkResult,
  planRealBuildAtomicCompiledPhysicalWork,
  realBuildAtomicCompilerInput,
  sameRealBuildAtomicCompiledWorkResult,
  type RealBuildAtomicCompiledBranchCompiler,
  type RealBuildAtomicCompiledChildRegistry,
  type RealBuildAtomicCompiledPhysicalWorkPlan,
  type RealBuildAtomicCompiledWorkResult,
} from "./real-build-atomic-compiled-branch-work";
import {
  createRealBuildAtomicCompiledBranchEvidenceWire,
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  type RealBuildAtomicCompiledBranchEvidenceWire,
} from "./real-build-atomic-compiled-branch-wire";
import {
  deriveRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "./real-build-candidate-lineage-identity";
import { parseRealBuildCompiledPlacementLineage } from "./real-build-compiled-placement-lineage";
import type {
  RealBuildCompiledLineageEdge,
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTerminalFailure,
  RealBuildCompiledSearchRequest,
} from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES } from "./real-build-prepared-search-boundary";
import type { RealBuildPreparedSearchReservation } from "./real-build-prepared-search-ledger";
import { reserveRealBuildPreparedSearchInspectionBatch } from "./real-build-prepared-search-ledger";

export type { RealBuildAtomicCompiledBranchCompiler } from "./real-build-atomic-compiled-branch-work";
export { decodeRealBuildAtomicCompiledBranchEvidenceWire } from "./real-build-atomic-compiled-branch-wire";

export interface RealBuildAtomicCompiledBranchBatchResult {
  readonly status: "compiled" | "budget-refused" | "failed";
  readonly evidence: RealBuildCompiledPlacementLineageEvidence;
  readonly evidenceWire: RealBuildAtomicCompiledBranchEvidenceWire;
  readonly scoreAuthority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "compiled-branch-batch-has-no-score-authority";
  };
  readonly completionAuthority: RealBuildCompiledPlacementLineageEvidence["completionAuthority"];
  readonly acceptedTransition: null;
  readonly acceptedDocument: null;
}

const COMPLETION_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "compiled-placement-lineage-is-inspection-only" as const,
});

const SCORE_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "compiled-branch-batch-has-no-score-authority" as const,
});

function rootCandidates(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledPlacementLineageEvidence["rootCandidates"] {
  const snapshot = preparation.rootDocumentSnapshot;
  return Object.freeze([
    Object.freeze({
      candidateId: realBuildDocumentCandidateId(snapshot.documentHash),
      documentHash: snapshot.documentHash,
      identities: preparation.rootIdentities,
      canonicalBytes: snapshot.canonicalBytes,
      canonicalBytesHash: snapshot.canonicalBytesHash,
      canonicalByteLength: snapshot.canonicalByteLength,
    }),
  ]);
}

function preparedStepEvidence(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledPlacementLineageEvidence["preparedStep"] {
  return Object.freeze({
    preparedRunInputDigest: preparation.preparedStep.preparedRunInputDigest,
    printedStepIdentity: preparation.preparedStep.printedStepIdentity,
    actionEvidenceDigest: preparation.printedStep.sourceActionDigest,
    compilerMetadata: preparation.printedStep,
  });
}

function searchRequest(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledSearchRequest {
  const inspection = preparation.searchInspection;
  return Object.freeze({
    preflightIdentity: inspection.preflightIdentity,
    parents: Object.freeze(
      inspection.parentBindings.map((binding) =>
        Object.freeze({
          parentLineageId: binding.parentLineageId,
          candidateId: binding.identity.candidateId,
          documentHash: binding.identity.documentHash,
          canonicalDocumentDigest: binding.canonicalDocumentDigest,
          offeredLineages: binding.offeredLineages,
        }),
      ),
    ),
    proposals: inspection.proposals,
    offeredLineages: inspection.offeredLineages,
    witnessCount: inspection.witnessCount,
    connectionCount: inspection.connectionCount,
    programOperationCount: inspection.programOperationCount,
  });
}

function emptyDecision(status: "unresolved" | "not-applicable") {
  return Object.freeze({
    status,
    decisionPanelStepNumber: null,
    selectedCandidateId: null,
    selectedLineageIds: Object.freeze([]),
    bestScore: null,
    runnerUpScore: null,
    margin: null,
  });
}

function closeResult(
  status: RealBuildAtomicCompiledBranchBatchResult["status"],
  evidence: RealBuildCompiledPlacementLineageEvidence,
): RealBuildAtomicCompiledBranchBatchResult {
  const bytes = new TextEncoder().encode(JSON.stringify(evidence));
  const evidenceWire = createRealBuildAtomicCompiledBranchEvidenceWire(bytes);
  const parsed = parseRealBuildCompiledPlacementLineage(
    decodeRealBuildAtomicCompiledBranchEvidenceWire(evidenceWire),
  );
  return Object.freeze({
    status,
    evidence: parsed,
    evidenceWire,
    scoreAuthority: SCORE_AUTHORITY,
    completionAuthority: parsed.completionAuthority,
    acceptedTransition: null,
    acceptedDocument: null,
  });
}

function evidenceBase(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
) {
  return {
    schemaVersion: "lego.real-build-compiled-placement-lineage/1" as const,
    throughStepNumber: preparation.preparedStep.stepNumber,
    preparedStep: preparedStepEvidence(preparation),
    rootCandidates: rootCandidates(preparation),
    searchRequest: searchRequest(preparation),
    searchReservation: reservation,
    observationBytes: null,
    observationRefs: Object.freeze([]),
    acceptedTransition: null,
    completionAuthority: COMPLETION_AUTHORITY,
  };
}

function failedResult(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  failure: RealBuildCompiledPlacementTerminalFailure,
) {
  return closeResult("failed", {
    ...evidenceBase(preparation, reservation),
    status: "failed",
    terminalFailure: failure,
    childCandidates: Object.freeze([]),
    uniqueTransitions: Object.freeze([]),
    lineageEdges: Object.freeze([]),
    selection: emptyDecision("not-applicable"),
  });
}

function classifyFailedCompilation(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  workPlan: RealBuildAtomicCompiledPhysicalWorkPlan,
  index: number,
  injectedIssue: RealBuildAtomicStableFailureIssue,
): RealBuildAtomicCompiledBranchBatchResult {
  let actualIssue: RealBuildAtomicStableFailureIssue | null = null;
  try {
    actualIssue = projectRealBuildAtomicCompilationFailure(
      compileRealBuildAutomaticPlacement(
        realBuildAtomicCompilerInput(preparation, workPlan.unique[index]!.proposal),
      ),
    );
  } catch {
    // A thrown compiler path is a local closure failure, not a deterministic refusal claim.
  }
  const genuine = sameRealBuildAtomicFailureIssue(injectedIssue, actualIssue);
  return failedResult(
    preparation,
    reservation,
    createRealBuildAtomicTerminalFailure({
      preparation,
      preparedStep: preparedStepEvidence(preparation),
      reservation,
      workPlan,
      workIndex: index,
      phase: genuine ? "compilation" : "evidence-closure",
      code: genuine ? "automatic-compilation-failed" : "compiled-evidence-closure-failed",
      issue: genuine
        ? injectedIssue
        : realBuildAtomicLocalFailureIssue(
            "The supplied compiler refusal did not reproduce under the current Node compiler.",
          ),
    }),
  );
}

function executeAdmitted(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  workPlan: RealBuildAtomicCompiledPhysicalWorkPlan,
  compiler: RealBuildAtomicCompiledBranchCompiler,
  childRegistry: RealBuildAtomicCompiledChildRegistry,
): RealBuildAtomicCompiledBranchBatchResult {
  const workResults = new Map<Sha256Digest, RealBuildAtomicCompiledWorkResult>();
  let activeIndex = 0;
  for (; activeIndex < workPlan.unique.length; activeIndex += 1) {
    const work = workPlan.unique[activeIndex]!;
    let compiled: RealBuildAtomicCompiledWorkResult;
    try {
      const supplied = compileRealBuildAtomicPhysicalWork(preparation, work.proposal, compiler);
      if (!isRealBuildAtomicCompiledWorkResult(supplied)) {
        const issue = projectRealBuildAtomicCompilationFailure(supplied);
        if (issue === null) {
          throw new TypeError("The supplied compiler returned no stable failure issue.");
        }
        return classifyFailedCompilation(preparation, reservation, workPlan, activeIndex, issue);
      }
      compiled = supplied;
    } catch {
      return failedResult(
        preparation,
        reservation,
        createRealBuildAtomicTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: realBuildAtomicLocalFailureIssue(
            "The supplied compiler threw while compiling this isolated proposal.",
          ),
        }),
      );
    }
    try {
      compiled = Object.freeze({
        transition: compiled.transition,
        childCandidate: childRegistry.admit(compiled.childCandidate),
      });
    } catch {
      return failedResult(
        preparation,
        reservation,
        createRealBuildAtomicTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: realBuildAtomicLocalFailureIssue(
            "This compiled child exceeded the aggregate exact-byte limit or aliased retained bytes.",
          ),
        }),
      );
    }
    try {
      const replayed = compileRealBuildAtomicPhysicalWork(
        preparation,
        work.proposal,
        compileRealBuildAutomaticPlacement,
      );
      if (
        !isRealBuildAtomicCompiledWorkResult(replayed) ||
        !sameRealBuildAtomicCompiledWorkResult(replayed, compiled)
      ) {
        throw new TypeError("The supplied compiler result did not reproduce under Node replay.");
      }
    } catch {
      return failedResult(
        preparation,
        reservation,
        createRealBuildAtomicTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: realBuildAtomicLocalFailureIssue(
            "The supplied compiler result did not reproduce under the current Node compiler.",
          ),
        }),
      );
    }
    workResults.set(work.digest, compiled);
  }

  const bindings = new Map(
    preparation.searchInspection.parentBindings.map((binding) => [
      binding.parentLineageId,
      binding,
    ]),
  );
  const edges: RealBuildCompiledLineageEdge[] = [];
  for (const proposal of preparation.searchInspection.proposals) {
    const planned = workPlan.byProposalId.get(proposal.proposalId)!;
    const workIndex = workPlan.indexByDigest.get(planned.digest)!;
    try {
      const work = workResults.get(planned.digest)!;
      const binding = bindings.get(proposal.parentLineageId)!;
      const child = deriveRealBuildLineageIdentity({
        candidateId: work.transition.childCandidateId,
        documentHash: work.transition.childDocumentHash,
        parent: binding.identity,
        throughStepNumber: preparation.preparedStep.stepNumber,
        localIdentity: { kind: "decision", id: `compiled-proposal:${proposal.proposalId}` },
      });
      edges.push(
        Object.freeze({
          parentLineageId: proposal.parentLineageId,
          proposalId: proposal.proposalId,
          child,
          transitionId: work.transition.transitionId,
        }),
      );
    } catch {
      return failedResult(
        preparation,
        reservation,
        createRealBuildAtomicTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: realBuildAtomicLocalFailureIssue(
            "This compiled work failed exact child and lineage-edge closure.",
          ),
        }),
      );
    }
  }
  try {
    return closeResult("compiled", {
      ...evidenceBase(preparation, reservation),
      status: "unresolved",
      terminalFailure: null,
      childCandidates: childRegistry.values(),
      uniqueTransitions: Object.freeze(
        [...workResults.values()].map(({ transition }) => transition),
      ),
      lineageEdges: Object.freeze(edges),
      selection: emptyDecision("unresolved"),
    });
  } catch {
    // Every unique work and edge has already closed independently in order;
    // this context cannot truthfully attribute an aggregate envelope defect to one work.
    return failedResult(
      preparation,
      reservation,
      createRealBuildAtomicTerminalFailure({
        preparation,
        preparedStep: preparedStepEvidence(preparation),
        reservation,
        workPlan,
        workIndex: null,
        phase: "aggregate-evidence-closure",
        code: "compiled-evidence-closure-failed",
        issue: realBuildAtomicLocalFailureIssue(
          "The independently closed works could not be encoded as one aggregate frontier envelope.",
        ),
      }),
    );
  }
}

function executePreparedBatch(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  compiler: RealBuildAtomicCompiledBranchCompiler,
  maximumUniqueChildCanonicalBytes = MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
): RealBuildAtomicCompiledBranchBatchResult {
  const childRegistry = createRealBuildAtomicCompiledChildRegistry(
    maximumUniqueChildCanonicalBytes,
  );
  const workPlan = planRealBuildAtomicCompiledPhysicalWork(preparation);
  const reservation = reserveRealBuildPreparedSearchInspectionBatch(
    preparation.ledger,
    preparation.searchInspection,
  );
  if (!reservation.admitted) {
    return closeResult("budget-refused", {
      ...evidenceBase(preparation, reservation),
      status: "budget-refused",
      terminalFailure: null,
      childCandidates: Object.freeze([]),
      uniqueTransitions: Object.freeze([]),
      lineageEdges: Object.freeze([]),
      selection: emptyDecision("not-applicable"),
    });
  }
  return executeAdmitted(preparation, reservation, workPlan, compiler, childRegistry);
}

/** Inspection-only atomic root-to-child compilation; it never selects or accepts a document. */
export function executeRealBuildAtomicCompiledBranchBatch(
  input: unknown,
  compiler: RealBuildAtomicCompiledBranchCompiler = compileRealBuildAutomaticPlacement,
): RealBuildAtomicCompiledBranchBatchResult {
  return executePreparedBatch(prepareRealBuildAtomicCompiledBranchBatch(input), compiler);
}

export function executePreparedRealBuildAtomicCompiledBranchBatch(
  preparation: unknown,
  compiler: RealBuildAtomicCompiledBranchCompiler = compileRealBuildAutomaticPlacement,
  maximumUniqueChildCanonicalBytes = MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
): RealBuildAtomicCompiledBranchBatchResult {
  return executePreparedBatch(
    requireRealBuildAtomicCompiledBranchBatchPreparation(preparation),
    compiler,
    maximumUniqueChildCanonicalBytes,
  );
}
