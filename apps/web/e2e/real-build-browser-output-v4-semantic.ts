import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
  type RealBuildCompiledPlacementLineageEvidence,
} from "./real-build-compiled-placement-lineage-types";
import {
  inspectRealBuildCompiledPlacementLineageWork,
  inspectRealBuildCompiledPlacementLineageReplayWork,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
  type RealBuildCompiledPlacementLineageWork,
} from "./real-build-compiled-placement-lineage-parser";
import type { RealBuildCompiledPlacementLineageReplayWork } from "./real-build-compiled-placement-lineage-replay-work";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
} from "./real-build-automatic-placement-step";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  type RealBuildCompiledObservationClosure,
} from "./real-build-compiled-observation-closure-types";
import { REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS } from "./real-build-browser-output-v4-semantic-limits";
import { parseRealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-parser";
import {
  inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork,
  type RealBuildCompiledObservationPreflight,
} from "./real-build-compiled-observation-closure-preflight";
import { requireRealBuildCompiledObservationClosurePreReplayRows } from "./real-build-compiled-observation-closure-pre-replay";
import { verifyRealBuildCompiledObservationRows } from "./real-build-compiled-observation-closure-verification";
import { realBuildCompiledObservationRegistrationVisits } from "./real-build-compiled-observation-registration";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
} from "./real-build-prepared-search-boundary";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";
import {
  inspectRealBuildPreparedObservationPolicyFromRunInput,
  inspectRealBuildPreparedRunInput,
  inspectRealBuildPreparedStepFromRunInput,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import {
  inspectRealBuildBrowserBranchEvidenceV1,
  readRealBuildBrowserBranchStepEvidenceBytes,
} from "./real-build-browser-output-v4-role";
import {
  requireRealBuildBrowserBranchLineageOnlyState,
  requireRealBuildBrowserBranchPreReplayObservationBindings,
} from "./real-build-browser-output-v4-semantic-preflight";

export const REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION =
  "lego.real-build-browser-branch-semantic-inspection/1" as const;

const ABSENT_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "browser-output-v4-report-source-camera-and-terminal-continuity-not-bound" as const,
});

export interface RealBuildBrowserBranchSemanticStepInspection {
  readonly stepNumber: number;
  readonly lineageStatus: RealBuildCompiledPlacementLineageEvidence["status"];
  readonly rootLineages: number;
  readonly childCandidates: number;
  readonly uniqueTransitions: number;
  readonly lineageEdges: number;
  readonly observationClosure: "absent" | "verified";
  readonly allObservationRowsScored: boolean | null;
  readonly failedObservations: number;
  readonly selectionStatus:
    | RealBuildCompiledPlacementLineageEvidence["selection"]["status"]
    | RealBuildCompiledObservationClosure["selection"]["status"];
  readonly selectedCandidateId: string | null;
  readonly acceptedTransitionInspected: boolean;
  readonly provenanceAuthority: "absent";
  readonly completionAuthority: typeof ABSENT_AUTHORITY;
}

export interface RealBuildBrowserBranchSemanticInspection {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly preparedLastStep: number;
  readonly indexedSteps: number;
  /** This local sidecar has no report-order or attempted-work coverage authority. */
  readonly coverageAuthority: "absent";
  readonly steps: readonly RealBuildBrowserBranchSemanticStepInspection[];
  readonly provenanceAuthority: "absent";
  readonly placementAuthority: typeof ABSENT_AUTHORITY;
  readonly completionAuthority: typeof ABSENT_AUTHORITY;
}

interface AggregateWork {
  rootCandidateGroups: number;
  roots: number;
  children: number;
  transitions: number;
  edges: number;
  proposals: number;
  searchParents: number;
  proposalWitnesses: number;
  proposalProgramOperations: number;
  transitionWitnesses: number;
  transitionProgramOperations: number;
  observations: number;
  observationSources: number;
  observationCameras: number;
  selectedLineageReferences: number;
  acceptedLineageReferences: number;
  acceptedTransitionReferences: number;
  pixelVisits: number;
  canonicalDocumentBytes: number;
  compilerReplayOperations: number;
  compilerGraphVisits: number;
  compilerByteVisits: number;
}

function exactPreparedPieces(
  lineage: RealBuildCompiledPlacementLineageEvidence,
  prepared: RealBuildPreparedStepInspection,
): void {
  for (const [proposalIndex, proposal] of lineage.searchRequest.proposals.entries()) {
    if (
      proposal.pieces.length !== prepared.expectedAtomicPieces.length ||
      proposal.pieces.some((piece, pieceIndex) => {
        const expected = prepared.expectedAtomicPieces[pieceIndex];
        return (
          expected === undefined ||
          piece.identityKey !== expected.identityKey ||
          piece.catalogPartId !== expected.catalogPartId ||
          piece.colorId !== expected.colorId
        );
      })
    ) {
      throw new TypeError(
        `Browser branch step ${prepared.stepNumber} proposal ${proposalIndex} does not preserve the exact ordered identity, catalog part, and color rows from prepared input.`,
      );
    }
  }
}

function requirePreparedBinding(
  indexedStepNumber: number,
  lineage: RealBuildCompiledPlacementLineageEvidence,
  prepared: RealBuildPreparedStepInspection,
): void {
  const compiled = lineage.preparedStep;
  if (lineage.throughStepNumber !== indexedStepNumber) {
    throw new TypeError(
      `Browser branch index step ${indexedStepNumber} contains compiled lineage through step ${lineage.throughStepNumber}; both must name the same printed step.`,
    );
  }
  if (
    compiled.preparedRunInputDigest !== prepared.preparedRunInputDigest ||
    compiled.printedStepIdentity !== prepared.printedStepIdentity
  ) {
    throw new TypeError(
      `Browser branch step ${indexedStepNumber} does not bind the exact inspected prepared-run digest and printed-step identity.`,
    );
  }
  if (
    compiled.actionEvidenceDigest !== prepared.compilerMetadata.sourceActionDigest ||
    compiled.compilerMetadata.name !== prepared.compilerMetadata.name ||
    compiled.compilerMetadata.sourceActionDigest !== prepared.compilerMetadata.sourceActionDigest
  ) {
    throw new TypeError(
      `Browser branch step ${indexedStepNumber} does not bind the prepared action digest and compiler name.`,
    );
  }
  exactPreparedPieces(lineage, prepared);
}

function closurePixelVisits(closure: RealBuildCompiledObservationClosure): number {
  const sources = new Map<string, RealBuildCompiledObservationClosure["sources"][number]>(
    closure.sources.map((source) => [source.sourceId, source] as const),
  );
  let visits = closure.sources.reduce(
    (total, source) => total + source.sourceMask.widthPx * source.sourceMask.heightPx,
    0,
  );
  const pairs = new Set<string>();
  for (const observation of closure.observations) {
    if (observation.status === "scored") {
      pairs.add(`${observation.sourceId}\0${observation.cameraId}`);
    }
  }
  for (const pair of pairs) {
    const sourceId = pair.slice(0, pair.indexOf("\0"));
    const source = sources.get(sourceId);
    if (source === undefined) {
      throw new TypeError(
        `Parsed browser branch observation references sourceId ${JSON.stringify(sourceId)}; expected one committed closure source row before replay.`,
      );
    }
    visits += realBuildCompiledObservationRegistrationVisits(
      source.sourceMask.widthPx,
      source.sourceMask.heightPx,
    );
  }
  return visits;
}

function chargeAggregate(
  aggregate: AggregateWork,
  work: RealBuildCompiledPlacementLineageWork,
  closure: RealBuildCompiledObservationClosure | null,
): AggregateWork {
  const charged = {
    rootCandidateGroups: aggregate.rootCandidateGroups + work.rootCandidateGroups,
    roots: aggregate.roots + work.rootLineages,
    children: aggregate.children + work.childCandidates,
    transitions: aggregate.transitions + work.uniqueTransitions,
    edges: aggregate.edges + work.lineageEdges,
    proposals: aggregate.proposals + work.searchProposals,
    searchParents: aggregate.searchParents + work.searchParents,
    proposalWitnesses: aggregate.proposalWitnesses + work.placementWitnesses,
    proposalProgramOperations:
      aggregate.proposalProgramOperations + work.placementProgramOperations,
    transitionWitnesses: aggregate.transitionWitnesses + work.transitionPlacementWitnesses,
    transitionProgramOperations:
      aggregate.transitionProgramOperations + work.transitionPlacementProgramOperations,
    observations:
      aggregate.observations + work.legacyObservations + (closure?.observations.length ?? 0),
    observationSources: aggregate.observationSources + (closure?.sources.length ?? 0),
    observationCameras: aggregate.observationCameras + (closure?.cameras.length ?? 0),
    selectedLineageReferences:
      aggregate.selectedLineageReferences + (closure?.selection.selectedLineageIds.length ?? 0),
    acceptedLineageReferences:
      aggregate.acceptedLineageReferences + (closure?.acceptedTransition?.lineageIds.length ?? 0),
    acceptedTransitionReferences:
      aggregate.acceptedTransitionReferences +
      (closure?.acceptedTransition?.transitionIds.length ?? 0),
    pixelVisits: aggregate.pixelVisits + (closure === null ? 0 : closurePixelVisits(closure)),
    canonicalDocumentBytes:
      aggregate.canonicalDocumentBytes +
      work.rootCanonicalDocumentBytes +
      work.childCanonicalDocumentBytes,
    compilerReplayOperations: aggregate.compilerReplayOperations,
    compilerGraphVisits: aggregate.compilerGraphVisits,
    compilerByteVisits: aggregate.compilerByteVisits,
  };
  const bounds = [
    [
      "root candidate groups",
      charged.rootCandidateGroups,
      MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS,
    ],
    ["root lineages", charged.roots, MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS],
    ["child candidates", charged.children, MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN],
    ["unique transitions", charged.transitions, MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS],
    ["lineage edges", charged.edges, MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES],
    ["search proposals", charged.proposals, MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN],
    [
      "search parents",
      charged.searchParents,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.searchParents,
    ],
    [
      "proposal placement witnesses",
      charged.proposalWitnesses,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
    ],
    [
      "proposal placement program operations",
      charged.proposalProgramOperations,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ],
    [
      "transition placement witnesses",
      charged.transitionWitnesses,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
    ],
    [
      "transition placement program operations",
      charged.transitionProgramOperations,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ],
    ["observations", charged.observations, MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS],
    [
      "observation sources",
      charged.observationSources,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.sources,
    ],
    [
      "observation cameras",
      charged.observationCameras,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.cameras,
    ],
    [
      "selected lineage references",
      charged.selectedLineageReferences,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.selectedLineageReferences,
    ],
    [
      "accepted lineage references",
      charged.acceptedLineageReferences,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.acceptedLineageReferences,
    ],
    [
      "accepted transition references",
      charged.acceptedTransitionReferences,
      REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS.acceptedTransitionReferences,
    ],
    [
      "observation pixel visits",
      charged.pixelVisits,
      MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
    ],
    [
      "canonical document bytes",
      charged.canonicalDocumentBytes,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
    ],
  ] as const;
  const exceeded = bounds.find(([, value, maximum]) => value > maximum);
  if (exceeded !== undefined) {
    throw new RangeError(
      `Browser branch semantic inspection aggregates ${exceeded[1]} ${exceeded[0]}; maximum is ${exceeded[2]}. Split or refuse the retained run before further semantic work.`,
    );
  }
  return charged;
}

function chargeAggregateReplayWork(
  aggregate: AggregateWork,
  work: RealBuildCompiledPlacementLineageReplayWork,
): AggregateWork {
  const charged = {
    ...aggregate,
    compilerReplayOperations: aggregate.compilerReplayOperations + work.compilerReplayOperations,
    compilerGraphVisits: aggregate.compilerGraphVisits + work.compilerGraphVisits,
    compilerByteVisits: aggregate.compilerByteVisits + work.compilerByteVisits,
  };
  const bounds = [
    [
      "compiler replay operations",
      charged.compilerReplayOperations,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ],
    [
      "compiler graph-visit work-policy units",
      charged.compilerGraphVisits,
      REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
    ],
    [
      "compiler byte-visit work-policy units",
      charged.compilerByteVisits,
      REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
    ],
  ] as const;
  const exceeded = bounds.find(([, value, maximum]) => value > maximum);
  if (exceeded !== undefined) {
    throw new RangeError(
      `Browser branch semantic inspection aggregates ${exceeded[1]} ${exceeded[0]}; maximum is ${exceeded[2]}. Split or refuse the retained run before compiler replay.`,
    );
  }
  return charged;
}

/**
 * Verifies local compiled branch and observation calculations without reading a /4 report envelope.
 * The result cannot authorize placement, document mutation, publication, or build completion.
 */
export function inspectRealBuildBrowserBranchSemanticEvidence(
  branchEvidenceBytes: unknown,
  compiledBranchRoleBytes: unknown,
  observationRoleBytes: unknown,
  preparedRunInputBytes: unknown,
): RealBuildBrowserBranchSemanticInspection {
  const preparedRun = inspectRealBuildPreparedRunInput(preparedRunInputBytes);
  const policy = inspectRealBuildPreparedObservationPolicyFromRunInput(preparedRun);
  const branch = inspectRealBuildBrowserBranchEvidenceV1(
    branchEvidenceBytes,
    compiledBranchRoleBytes,
    observationRoleBytes,
  );
  const outOfPreparedRange = branch.steps.find(
    ({ stepNumber }) => stepNumber > preparedRun.lastStep,
  );
  if (outOfPreparedRange !== undefined) {
    throw new RangeError(
      `Browser branch step ${outOfPreparedRange.stepNumber} lies beyond prepared lastStep ${preparedRun.lastStep}.`,
    );
  }
  let aggregate: AggregateWork = {
    rootCandidateGroups: 0,
    roots: 0,
    children: 0,
    transitions: 0,
    edges: 0,
    proposals: 0,
    searchParents: 0,
    proposalWitnesses: 0,
    proposalProgramOperations: 0,
    transitionWitnesses: 0,
    transitionProgramOperations: 0,
    observations: 0,
    observationSources: 0,
    observationCameras: 0,
    selectedLineageReferences: 0,
    acceptedLineageReferences: 0,
    acceptedTransitionReferences: 0,
    pixelVisits: 0,
    canonicalDocumentBytes: 0,
    compilerReplayOperations: 0,
    compilerGraphVisits: 0,
    compilerByteVisits: 0,
  };
  const steps: RealBuildBrowserBranchSemanticStepInspection[] = [];
  for (const indexed of branch.steps) {
    const bytes = readRealBuildBrowserBranchStepEvidenceBytes(branch, indexed.stepNumber);
    const closure =
      bytes.observationClosure === null
        ? null
        : parseRealBuildCompiledObservationClosure(bytes.observationClosure);
    if (closure !== null) requireRealBuildCompiledObservationClosurePreReplayRows(closure);
    const lineageInspection = inspectRealBuildCompiledPlacementLineageWork(bytes.compiledLineage);
    const lineage = lineageInspection.evidence;
    if (lineage.throughStepNumber !== indexed.stepNumber) {
      throw new TypeError(
        `Browser branch index step ${indexed.stepNumber} contains compiled lineage through step ${lineage.throughStepNumber}; both must name the same printed step.`,
      );
    }
    requireRealBuildBrowserBranchPreReplayObservationBindings(indexed, lineageInspection, closure);
    aggregate = chargeAggregate(aggregate, lineageInspection.work, closure);
    const preparedStep = inspectRealBuildPreparedStepFromRunInput(preparedRun, indexed.stepNumber);
    requirePreparedBinding(indexed.stepNumber, lineage, preparedStep);
    requireRealBuildBrowserBranchLineageOnlyState(lineage);
    const replayWorkInspection =
      inspectRealBuildCompiledPlacementLineageReplayWork(lineageInspection);
    aggregate = chargeAggregateReplayWork(aggregate, replayWorkInspection.work);
    validateRealBuildCompiledPlacementLineageReplayWorkInspection(replayWorkInspection);
    const preflight: RealBuildCompiledObservationPreflight | null =
      closure === null
        ? null
        : inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
            lineageInspection,
            bytes.observationClosure,
            policy,
          );
    const observation =
      preflight === null
        ? null
        : verifyRealBuildCompiledObservationRows(preflight, bytes.observations);
    steps.push(
      Object.freeze({
        stepNumber: indexed.stepNumber,
        lineageStatus: lineage.status,
        rootLineages: lineage.rootCandidates.reduce(
          (total, candidate) => total + candidate.identities.length,
          0,
        ),
        childCandidates: lineage.childCandidates.length,
        uniqueTransitions: lineage.uniqueTransitions.length,
        lineageEdges: lineage.lineageEdges.length,
        observationClosure: observation === null ? "absent" : "verified",
        allObservationRowsScored: observation?.reproducible ?? null,
        failedObservations: observation?.failedObservationIds.length ?? 0,
        selectionStatus: observation?.closure.selection.status ?? lineage.selection.status,
        selectedCandidateId:
          observation?.closure.selection.selectedCandidateId ??
          lineage.selection.selectedCandidateId,
        acceptedTransitionInspected:
          (observation?.closure.acceptedTransition ?? lineage.acceptedTransition) !== null,
        provenanceAuthority: "absent",
        completionAuthority: ABSENT_AUTHORITY,
      }),
    );
  }
  return Object.freeze({
    schemaVersion: REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION,
    preparedRunInputDigest: preparedRun.preparedRunInputDigest,
    preparedLastStep: preparedRun.lastStep,
    indexedSteps: steps.length,
    coverageAuthority: "absent",
    steps: Object.freeze(steps),
    provenanceAuthority: "absent",
    placementAuthority: ABSENT_AUTHORITY,
    completionAuthority: ABSENT_AUTHORITY,
  });
}
