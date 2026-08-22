import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement as compilePlacement } from "./real-build-automatic-placement-compiler";
import {
  prepareRealBuildAtomicCompiledBranchBatch,
  requireRealBuildAtomicCompiledBranchParentIdentity,
  requireRealBuildAtomicCompiledBranchBatchPreparation as requireBatchPreparation,
  type RealBuildAtomicCompiledBranchBatchPreparation as BatchPreparation,
} from "./real-build-atomic-compiled-branch-batch-input";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  createRealBuildAtomicTerminalFailure as createTerminalFailure,
  projectRealBuildAtomicCompilationFailure,
  realBuildAtomicLocalFailureIssue as localFailureIssue,
  sameRealBuildAtomicFailureIssue,
  type RealBuildAtomicStableFailureIssue,
} from "./real-build-atomic-compiled-branch-failure";
import {
  budgetRefusedEvidence,
  emptyDecision,
  evidenceBase,
  failedEvidence,
  preparedStepEvidence,
} from "./real-build-atomic-compiled-branch-evidence";
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
  preflightRealBuildAtomicCompiledTerminalEnvelope,
  requireRealBuildAtomicCompiledLineageMaximumBytes,
  serializeRealBuildAtomicCompiledPlacementLineageEvidence,
} from "./real-build-atomic-compiled-branch-terminal-envelope";
import {
  createRealBuildAtomicCompiledBranchEvidenceWire,
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  type RealBuildAtomicCompiledBranchEvidenceWire,
} from "./real-build-atomic-compiled-branch-wire";
import { deriveRealBuildExactLineageIdentity } from "./real-build-exact-lineage-identity";
import { parseRealBuildCompiledPlacementLineage } from "./real-build-compiled-placement-lineage";
import type {
  RealBuildCompiledLineageEdge,
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTerminalFailure,
} from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES } from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES } from "./real-build-prepared-search-boundary";
import type { RealBuildPreparedSearchReservation } from "./real-build-prepared-search-ledger";
import {
  isReservedRealBuildPreparedSearchBatchInspection,
  reserveRealBuildPreparedSearchInspectionBatch,
} from "./real-build-prepared-search-ledger";

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

const batchResults = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_MAP = Map;
const SAFE_MAP_GET = Map.prototype.get;
const SAFE_MAP_SET = Map.prototype.set;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function mapGet<K, V>(map: ReadonlyMap<K, V>, key: K): V | undefined {
  return SAFE_REFLECT_APPLY(SAFE_MAP_GET, map, [key]) as V | undefined;
}

function mapSet<K, V>(map: Map<K, V>, key: K, value: V): void {
  SAFE_REFLECT_APPLY(SAFE_MAP_SET, map, [key, value]);
}

const SCORE_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "compiled-branch-batch-has-no-score-authority" as const,
});

function closeResult(
  status: RealBuildAtomicCompiledBranchBatchResult["status"],
  evidence: RealBuildCompiledPlacementLineageEvidence,
  maximumCompiledLineageBytes: number,
): RealBuildAtomicCompiledBranchBatchResult {
  const bytes = serializeRealBuildAtomicCompiledPlacementLineageEvidence(evidence);
  if (bytes.byteLength > maximumCompiledLineageBytes) {
    throw new RangeError(
      `Atomic compiled evidence contains ${bytes.byteLength} serialized bytes above maximum ${maximumCompiledLineageBytes}.`,
    );
  }
  const evidenceWire = createRealBuildAtomicCompiledBranchEvidenceWire(bytes);
  const parsed = parseRealBuildCompiledPlacementLineage(
    decodeRealBuildAtomicCompiledBranchEvidenceWire(evidenceWire),
    maximumCompiledLineageBytes,
  );
  const result = intrinsicRealBuildFreeze({
    status,
    evidence: parsed,
    evidenceWire,
    scoreAuthority: SCORE_AUTHORITY,
    completionAuthority: parsed.completionAuthority,
    acceptedTransition: null,
    acceptedDocument: null,
  });
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, batchResults, [result]);
  return result;
}

function failedResult(
  preparation: BatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  failure: RealBuildCompiledPlacementTerminalFailure,
  maximumCompiledLineageBytes: number,
) {
  return closeResult(
    "failed",
    failedEvidence(preparation, reservation, failure),
    maximumCompiledLineageBytes,
  );
}

function classifyFailedCompilation(
  preparation: BatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  workPlan: RealBuildAtomicCompiledPhysicalWorkPlan,
  index: number,
  injectedIssue: RealBuildAtomicStableFailureIssue,
  maximumCompiledLineageBytes: number,
): RealBuildAtomicCompiledBranchBatchResult {
  let actualIssue: RealBuildAtomicStableFailureIssue | null = null;
  try {
    actualIssue = projectRealBuildAtomicCompilationFailure(
      compilePlacement(realBuildAtomicCompilerInput(preparation, workPlan.unique[index]!.proposal)),
    );
  } catch {
    // A thrown compiler path is a local closure failure, not a deterministic refusal claim.
  }
  const genuine = sameRealBuildAtomicFailureIssue(injectedIssue, actualIssue);
  return failedResult(
    preparation,
    reservation,
    createTerminalFailure({
      preparation,
      preparedStep: preparedStepEvidence(preparation),
      reservation,
      workPlan,
      workIndex: index,
      phase: genuine ? "compilation" : "evidence-closure",
      code: genuine ? "automatic-compilation-failed" : "compiled-evidence-closure-failed",
      issue: genuine
        ? injectedIssue
        : localFailureIssue(
            "The supplied compiler refusal did not reproduce under the current Node compiler.",
          ),
    }),
    maximumCompiledLineageBytes,
  );
}

function executeAdmitted(
  preparation: BatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  workPlan: RealBuildAtomicCompiledPhysicalWorkPlan,
  compiler: RealBuildAtomicCompiledBranchCompiler,
  childRegistry: RealBuildAtomicCompiledChildRegistry,
  maximumCompiledLineageBytes: number,
): RealBuildAtomicCompiledBranchBatchResult {
  const workResults = new SAFE_MAP<Sha256Digest, RealBuildAtomicCompiledWorkResult>();
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
        return classifyFailedCompilation(
          preparation,
          reservation,
          workPlan,
          activeIndex,
          issue,
          maximumCompiledLineageBytes,
        );
      }
      compiled = supplied;
    } catch {
      return failedResult(
        preparation,
        reservation,
        createTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: localFailureIssue(
            "The supplied compiler threw while compiling this isolated proposal.",
          ),
        }),
        maximumCompiledLineageBytes,
      );
    }
    try {
      compiled = intrinsicRealBuildFreeze({
        transition: compiled.transition,
        childCandidate: childRegistry.admit(compiled.childCandidate),
      });
    } catch {
      return failedResult(
        preparation,
        reservation,
        createTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: localFailureIssue(
            "This compiled child exceeded the aggregate exact-byte limit or aliased retained bytes.",
          ),
        }),
        maximumCompiledLineageBytes,
      );
    }
    try {
      const replayed = compileRealBuildAtomicPhysicalWork(
        preparation,
        work.proposal,
        compilePlacement,
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
        createTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex: activeIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: localFailureIssue(
            "The supplied compiler result did not reproduce under the current Node compiler.",
          ),
        }),
        maximumCompiledLineageBytes,
      );
    }
    mapSet(workResults, work.digest, compiled);
  }

  const bindings = new SAFE_MAP<
    string,
    BatchPreparation["searchInspection"]["parentBindings"][number]
  >();
  for (const binding of preparation.searchInspection.parentBindings) {
    mapSet(bindings, binding.parentLineageId, binding);
  }
  const edges: RealBuildCompiledLineageEdge[] = [];
  for (const proposal of preparation.searchInspection.proposals) {
    const planned = mapGet(workPlan.byProposalId, proposal.proposalId)!;
    const workIndex = mapGet(workPlan.indexByDigest, planned.digest)!;
    try {
      const work = mapGet(workResults, planned.digest)!;
      const binding = mapGet(bindings, proposal.parentLineageId)!;
      const childSnapshot = createRealBuildCandidateDocumentSnapshot({
        canonicalDocument: work.childCandidate.canonicalBytes,
        expectedDocumentHash: work.childCandidate.documentHash,
      });
      const child = deriveRealBuildExactLineageIdentity({
        candidateId: work.transition.childCandidateId,
        documentHash: work.transition.childDocumentHash,
        documentSnapshot: childSnapshot,
        parent: requireRealBuildAtomicCompiledBranchParentIdentity(
          preparation,
          binding.identity.lineageId,
        ),
        throughStepNumber: preparation.preparedStep.stepNumber,
        localIdentity: { kind: "decision", id: `compiled-proposal:${proposal.proposalId}` },
      });
      edges.push(
        intrinsicRealBuildFreeze({
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
        createTerminalFailure({
          preparation,
          preparedStep: preparedStepEvidence(preparation),
          reservation,
          workPlan,
          workIndex,
          phase: "evidence-closure",
          code: "compiled-evidence-closure-failed",
          issue: localFailureIssue(
            "This compiled work failed exact child and lineage-edge closure.",
          ),
        }),
        maximumCompiledLineageBytes,
      );
    }
  }
  try {
    return closeResult(
      "compiled",
      {
        ...evidenceBase(preparation, reservation),
        status: "unresolved",
        terminalFailure: null,
        childCandidates: childRegistry.values(),
        uniqueTransitions: intrinsicRealBuildFreeze(
          [...workResults.values()].map(({ transition }) => transition),
        ),
        lineageEdges: intrinsicRealBuildFreeze(edges),
        selection: emptyDecision("unresolved"),
      },
      maximumCompiledLineageBytes,
    );
  } catch {
    // Every unique work and edge has already closed independently in order;
    // this context cannot truthfully attribute an aggregate envelope defect to one work.
    return failedResult(
      preparation,
      reservation,
      createTerminalFailure({
        preparation,
        preparedStep: preparedStepEvidence(preparation),
        reservation,
        workPlan,
        workIndex: null,
        phase: "aggregate-evidence-closure",
        code: "compiled-evidence-closure-failed",
        issue: localFailureIssue(
          "The independently closed works could not be encoded as one aggregate frontier envelope.",
        ),
      }),
      maximumCompiledLineageBytes,
    );
  }
}

function executePreparedBatch(
  preparation: BatchPreparation,
  compiler: RealBuildAtomicCompiledBranchCompiler,
  maximumUniqueChildCanonicalBytes = MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
  maximumCompiledLineageBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildAtomicCompiledBranchBatchResult {
  const maximumEvidenceBytes = requireRealBuildAtomicCompiledLineageMaximumBytes(
    maximumCompiledLineageBytes,
  );
  const childRegistry = createRealBuildAtomicCompiledChildRegistry(
    maximumUniqueChildCanonicalBytes,
  );
  const workPlan = planRealBuildAtomicCompiledPhysicalWork(preparation);
  if (isReservedRealBuildPreparedSearchBatchInspection(preparation.searchInspection)) {
    throw new TypeError("Prepared search inspection may be reserved exactly once.");
  }
  preflightRealBuildAtomicCompiledTerminalEnvelope(
    preparation,
    workPlan,
    preparedStepEvidence(preparation),
    maximumEvidenceBytes,
    (reservation, terminalFailure) =>
      terminalFailure === null
        ? budgetRefusedEvidence(preparation, reservation)
        : failedEvidence(preparation, reservation, terminalFailure),
  );
  const reservation = reserveRealBuildPreparedSearchInspectionBatch(
    preparation.ledger,
    preparation.searchInspection,
  );
  if (!reservation.admitted) {
    return closeResult(
      "budget-refused",
      budgetRefusedEvidence(preparation, reservation),
      maximumEvidenceBytes,
    );
  }
  return executeAdmitted(
    preparation,
    reservation,
    workPlan,
    compiler,
    childRegistry,
    maximumEvidenceBytes,
  );
}

/** Inspection-only atomic root-to-child compilation; it never selects or accepts a document. */
export function executeRealBuildAtomicCompiledBranchBatch(
  input: unknown,
  compiler: RealBuildAtomicCompiledBranchCompiler = compilePlacement,
): RealBuildAtomicCompiledBranchBatchResult {
  return executePreparedBatch(prepareRealBuildAtomicCompiledBranchBatch(input), compiler);
}

export function executePreparedRealBuildAtomicCompiledBranchBatch(
  preparation: unknown,
  compiler: RealBuildAtomicCompiledBranchCompiler = compilePlacement,
  maximumUniqueChildCanonicalBytes = MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
  maximumCompiledLineageBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildAtomicCompiledBranchBatchResult {
  return executePreparedBatch(
    requireBatchPreparation(preparation),
    compiler,
    maximumUniqueChildCanonicalBytes,
    maximumCompiledLineageBytes,
  );
}

/** Checks private provenance before a transport producer reads retained batch evidence. */
export function requireRealBuildAtomicCompiledBranchBatchResult(
  value: unknown,
): RealBuildAtomicCompiledBranchBatchResult {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, batchResults, [value]) as boolean)
  ) {
    throw new TypeError(
      "Atomic compiled branch result must be the exact immutable result returned by this module.",
    );
  }
  return value as RealBuildAtomicCompiledBranchBatchResult;
}
