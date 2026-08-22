import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
} from "./real-build-automatic-placement-step";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  type RealBuildCompiledObservationClosure,
} from "./real-build-compiled-observation-closure-types";
import { realBuildCompiledObservationRegistrationVisits } from "./real-build-compiled-observation-registration";
import type { RealBuildCompiledPlacementLineageReplayWork } from "./real-build-compiled-placement-lineage-replay-work";
import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS,
} from "./real-build-compiled-placement-lineage-types";
import type { RealBuildCompiledPlacementLineageWork } from "./real-build-compiled-placement-lineage-structural-work";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
} from "./real-build-prepared-search-boundary";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";
import { REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS } from "./real-build-browser-output-v4-semantic-limits";

export interface RealBuildBrowserBranchAggregateWork {
  readonly rootCandidateGroups: number;
  readonly roots: number;
  readonly children: number;
  readonly transitions: number;
  readonly edges: number;
  readonly proposals: number;
  readonly searchParents: number;
  readonly proposalWitnesses: number;
  readonly proposalProgramOperations: number;
  readonly transitionWitnesses: number;
  readonly transitionProgramOperations: number;
  readonly observations: number;
  readonly observationSources: number;
  readonly observationCameras: number;
  readonly selectedLineageReferences: number;
  readonly acceptedLineageReferences: number;
  readonly acceptedTransitionReferences: number;
  readonly pixelVisits: number;
  readonly canonicalDocumentBytes: number;
  readonly compilerReplayOperations: number;
  readonly compilerGraphVisits: number;
  readonly compilerByteVisits: number;
}

export function createRealBuildBrowserBranchAggregateWork(): RealBuildBrowserBranchAggregateWork {
  return intrinsicRealBuildFreeze({
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
  });
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

export function chargeRealBuildBrowserBranchAggregateWork(
  aggregate: RealBuildBrowserBranchAggregateWork,
  work: RealBuildCompiledPlacementLineageWork,
  closure: RealBuildCompiledObservationClosure | null,
): RealBuildBrowserBranchAggregateWork {
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
  return intrinsicRealBuildFreeze(charged);
}

export function chargeRealBuildBrowserBranchAggregateReplayWork(
  aggregate: RealBuildBrowserBranchAggregateWork,
  work: RealBuildCompiledPlacementLineageReplayWork,
): RealBuildBrowserBranchAggregateWork {
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
  return intrinsicRealBuildFreeze(charged);
}
