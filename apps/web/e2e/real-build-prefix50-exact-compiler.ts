import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { requireRealBuildCandidateDocumentSnapshotValue } from "./real-build-candidate-document-snapshot";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_OCCURRENCE_COUNT,
  REAL_BUILD_PREFIX50_TRANSITION_STEP,
  readRealBuildPrefix50Occurrence30ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
  readSyntheticRealBuildPrefix50DiagnosticProjectionForTest,
  realBuildPrefix50ProjectionCommitment,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  compileRealBuildPrefix50ExactLoop,
  type RealBuildPrefix50Step45RelationalCompiler,
} from "./real-build-prefix50-exact-loop";
import { requireIntegralProtocolGaugeCompatibility } from "./real-build-prefix50-integral-gauge";
import {
  brandRealBuildPrefix50ExactCompilation,
  requireRealBuildPrefix50ExactCompilation,
} from "./real-build-prefix50-exact-compiler-brand.ts";
import type { RealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-contract";
import { requireRealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-runtime";
import { requireRealBuildPrefix50Occurrence30SourceRepairProof } from "./real-build-prefix50-occurrence30-source-repair";
import { proposeRealBuildPrefix50SourcePlacementRepairs } from "./real-build-prefix50-source-placement-repair";
import {
  applyRealBuildPrefix50Step41SourceRepair,
  bindRealBuildPrefix50Step41SourceRepair,
  type RealBuildPrefix50BoundStep41SourceRepair,
} from "./real-build-prefix50-step41-source-repair-application";
import { requireRealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract";
import { applyRealBuildPrefix50Step42SourceRepair } from "./real-build-prefix50-step42-source-repair-application";
import type { RealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair-contract";
import { applyRealBuildPrefix50Step42_43SourceRepair } from "./real-build-prefix50-step42-43-source-repair-application";
import type { RealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair-contract";
import { bindRealBuildPrefix50LateSourceRepairs } from "./real-build-prefix50-late-source-repair-binding";
import {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
  RealBuildPrefix50SelectedPathBlockerError,
  type RealBuildPrefix50BoundOccurrence30SourceRepair,
  type RealBuildPrefix50BoundPlacementRepair,
  type RealBuildPrefix50DiagnosticObservation,
  type RealBuildPrefix50ExactCompilation,
  type RealBuildPrefix50ExactCompilationCore,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50StateCommitment,
  type RealBuildPrefix50WorldGaugeSourceRepair,
  type RealBuildPrefix50WorldGaugeSourceRepairProof,
} from "./real-build-prefix50-exact-compiler-contract";
import {
  buildRealBuildPrefix50ExactEnumerationQuery,
  bindWorldGaugeSourceRepair,
  deriveGauge,
  exactInputKeys,
  ownData,
  proposeRealBuildPrefix50WorldGaugeSourceRepair,
  requireRealBuildPrefix50CompleteEnumeration,
} from "./real-build-prefix50-exact-compiler-foundation";
import {
  bindOccurrence30SourceRepair,
  bindPlacementRepairs,
  occurrence30RepairCommitment,
  proposeRealBuildPrefix50Occurrence30SourceRepair,
  requireUniqueExactPlacementRepairEdge,
} from "./real-build-prefix50-exact-compiler-operations";
import {
  searchStateMemoCommitment,
  searchStepForTest,
  stateLocalEnumerationQueryCommitment,
} from "./real-build-prefix50-exact-compiler-search";

export {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
  requireRealBuildPrefix50CompleteEnumeration,
  requireRealBuildPrefix50ExactCompilation,
};
export type {
  RealBuildPrefix50BoundOccurrence30SourceRepair,
  RealBuildPrefix50BoundPlacementRepair,
  RealBuildPrefix50BoundStep41SourceRepair,
  RealBuildPrefix50DiagnosticObservation,
  RealBuildPrefix50ExactCompilation,
  RealBuildPrefix50StateCommitment,
  RealBuildPrefix50WorldGaugeSourceRepair,
  RealBuildPrefix50WorldGaugeSourceRepairProof,
};

/**
 * Consumes only an already-verified frozen projection reader. Every final part
 * transform and connection is copied from an actual enumeration candidate;
 * temporary operations exist solely to discover within-step dependencies.
 */
function compileRealBuildPrefix50ProjectionCore(
  unsafeInput: unknown,
  readProjection: (unsafeReader: unknown) => RealBuildPrefix50VerifiedProjection,
  requireSourceRepairProofs: boolean,
  requireSelectedSubBuildReturn: boolean,
  step45RelationalCompiler: RealBuildPrefix50Step45RelationalCompiler | null,
): RealBuildPrefix50ExactCompilationCore {
  exactInputKeys(unsafeInput, requireSourceRepairProofs, requireSelectedSubBuildReturn);
  const selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn | null =
    requireSelectedSubBuildReturn
      ? requireRealBuildPrefix50SelectedSubBuildReturn(
          ownData(unsafeInput, "selectedSubBuildReturn", "Prefix-50 exact compiler input"),
        )
      : null;
  const initialSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    ownData(unsafeInput, "documentSnapshot", "Prefix-50 exact compiler input"),
  );
  const projectionReader = ownData(
    unsafeInput,
    "projectionReader",
    "Prefix-50 exact compiler input",
  );
  const sourceProjection = readProjection(projectionReader);
  if (
    initialSnapshot.document.parts.length !== 0 ||
    initialSnapshot.document.connections.length !== 0
  ) {
    throw new TypeError("Prefix-50 exact compilation requires the exact empty root graph.");
  }
  const worldGaugeSourceRepairProposal =
    proposeRealBuildPrefix50WorldGaugeSourceRepair(sourceProjection);
  const occurrence30SourceRepairProposal = requireSourceRepairProofs
    ? proposeRealBuildPrefix50Occurrence30SourceRepair(
        sourceProjection,
        requireRealBuildPrefix50Occurrence30SourceRepairProof(
          ownData(unsafeInput, "occurrence30SourceRepairProof", "Prefix-50 exact compiler input"),
        ),
        readRealBuildPrefix50Occurrence30ActionBinding(projectionReader),
      )
    : null;
  const integralView = proposeRealBuildPrefix50SourcePlacementRepairs(sourceProjection);
  const step41SourceRepairProofValue = requireSourceRepairProofs
    ? ownData(unsafeInput, "step41SourceRepairProof", "Prefix-50 exact compiler input")
    : null;
  const step41SourceRepairEvidence =
    step41SourceRepairProofValue === null
      ? null
      : requireRealBuildPrefix50Step41SourceRepairProof(step41SourceRepairProofValue);
  const step41SourceRepairView =
    step41SourceRepairEvidence === null
      ? null
      : applyRealBuildPrefix50Step41SourceRepair(
          sourceProjection,
          integralView,
          step41SourceRepairEvidence,
        );
  const step42SourceRepairProofValue = requireSourceRepairProofs
    ? ownData(unsafeInput, "step42SourceRepairProof", "Prefix-50 exact compiler input")
    : null;
  const step42SourceRepairView =
    step41SourceRepairView === null ||
    step41SourceRepairProofValue === null ||
    step42SourceRepairProofValue === null
      ? null
      : applyRealBuildPrefix50Step42SourceRepair(
          sourceProjection,
          step41SourceRepairView,
          step41SourceRepairProofValue as RealBuildPrefix50Step41SourceRepairProof,
          step42SourceRepairProofValue as RealBuildPrefix50Step42SourceRepairProof,
        );
  const step42_43SourceRepairProofValue = requireSourceRepairProofs
    ? ownData(unsafeInput, "step42_43SourceRepairProof", "Prefix-50 exact compiler input")
    : null;
  const step42_43SourceRepairView =
    step42SourceRepairView === null ||
    step41SourceRepairProofValue === null ||
    step42SourceRepairProofValue === null ||
    step42_43SourceRepairProofValue === null
      ? null
      : applyRealBuildPrefix50Step42_43SourceRepair(
          sourceProjection,
          step42SourceRepairView.projection,
          {
            step41SourceRepairProof:
              step41SourceRepairProofValue as RealBuildPrefix50Step41SourceRepairProof,
            step42SourceRepairProof:
              step42SourceRepairProofValue as RealBuildPrefix50Step42SourceRepairProof,
          },
          step42_43SourceRepairProofValue as RealBuildPrefix50Step42_43SourceRepairProof,
        );
  const projection =
    step42_43SourceRepairView?.projection ??
    step42SourceRepairView?.projection ??
    step41SourceRepairView?.projection ??
    integralView.projection;
  requireIntegralProtocolGaugeCompatibility(projection);
  const budget: RealBuildPrefix50SearchBudget = {
    nodes: 0,
    enumerations: 0,
    orientationNarrowedEnumerations: 0,
    targetAttempts: new Map(),
  };
  const first = projection.occurrences[0]!;
  const gauge = deriveGauge(
    initialSnapshot.document,
    first,
    worldGaugeSourceRepairProposal?.repairedSourceWorldTransform ?? first.sourceWorldTransform,
    budget,
  );
  const loop = compileRealBuildPrefix50ExactLoop({
    initialDocument: initialSnapshot.document,
    sourceProjection,
    projection,
    gauge,
    worldGaugeSourceRepair: worldGaugeSourceRepairProposal,
    occurrence30SourceRepair: occurrence30SourceRepairProposal,
    sourcePlacementRepairs: integralView.repairs,
    step42_43SourceRepairProof:
      step42_43SourceRepairProofValue as RealBuildPrefix50Step42_43SourceRepairProof | null,
    selectedSubBuildReturn,
    step45RelationalCompiler,
    budget,
    requireExactSuffix: requireSourceRepairProofs,
  });
  const { document, placementOrdinals, partIdByOccurrenceOrdinal, stateCommitments } = loop;
  if (
    document.parts.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    document.steps.length !== REAL_BUILD_PREFIX50_LAST_STEP ||
    placementOrdinals.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    stateCommitments.length !== REAL_BUILD_PREFIX50_LAST_STEP + 1 ||
    document.steps[REAL_BUILD_PREFIX50_TRANSITION_STEP - 1]?.partIds.length !== 0 ||
    document.steps.some(({ index }) => index < 0 || index >= REAL_BUILD_PREFIX50_LAST_STEP)
  ) {
    throw new TypeError(
      "Prefix-50 completion must contain 51 state commitments, exactly 50 BuildSteps, exactly 320 parts, a zero-part step 44, and no step-51 suffix.",
    );
  }
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(sourceProjection);
  const worldGaugeSourceRepair = bindWorldGaugeSourceRepair(
    document,
    worldGaugeSourceRepairProposal,
    gauge,
    projection,
    projectionCommitment,
    placementOrdinals,
    stateCommitments,
    partIdByOccurrenceOrdinal,
  );
  const occurrence30SourceRepair =
    occurrence30SourceRepairProposal === null
      ? null
      : bindOccurrence30SourceRepair(
          document,
          occurrence30SourceRepairProposal,
          gauge,
          projection,
          projectionCommitment,
          placementOrdinals,
          partIdByOccurrenceOrdinal,
        );
  const step41SourceRepair =
    step41SourceRepairView === null || loop.selectedSubBuildReturn === null
      ? null
      : bindRealBuildPrefix50Step41SourceRepair(
          document,
          step41SourceRepairView.proposal,
          sourceProjection,
          gauge,
          loop.selectedSubBuildReturn,
          placementOrdinals,
          partIdByOccurrenceOrdinal,
        );
  const lateSourceRepairs =
    step42SourceRepairView === null ||
    step42_43SourceRepairView === null ||
    loop.selectedSubBuildReturn === null ||
    loop.terminalDetachedState === null
      ? null
      : bindRealBuildPrefix50LateSourceRepairs({
          document,
          step42Proposal: step42SourceRepairView.proposal,
          step42_43Proposal: step42_43SourceRepairView.proposal,
          sourceProjection,
          gauge,
          selectedReturn: loop.selectedSubBuildReturn,
          terminalDetachedState: loop.terminalDetachedState,
          placementOrdinals,
          partIdByOccurrenceOrdinal,
        });
  return deepFreeze({
    projectionCommitment,
    gauge,
    gaugeCommitment: canonicalDigest({
      schemaVersion: "lego.real-build-prefix50-world-gauge/4",
      firstOccurrenceOrdinal: first.ordinal,
      sourceWorldTransform: first.sourceWorldTransform,
      worldGaugeSourceRepair,
      occurrence30SourceRepairCommitment: occurrence30SourceRepair?.repairCommitment ?? null,
      step41SourceRepairCommitment: step41SourceRepair?.repairCommitment ?? null,
      step42SourceRepairCommitment: lateSourceRepairs?.step42SourceRepair.repairCommitment ?? null,
      step42_43SourceRepairCommitment:
        lateSourceRepairs?.step42_43SourceRepair.repairCommitment ?? null,
      gauge,
    }),
    worldGaugeSourceRepair,
    occurrence30SourceRepair,
    step41SourceRepair,
    step42SourceRepair: lateSourceRepairs?.step42SourceRepair ?? null,
    step42_43SourceRepair: lateSourceRepairs?.step42_43SourceRepair ?? null,
    placementOrdinals,
    stateCommitments,
    playbackTrace: loop.playbackTrace,
    enumerationCount: budget.enumerations,
    orientationNarrowedEnumerationCount: budget.orientationNarrowedEnumerations,
    searchNodeCount: budget.nodes,
    sourcePlacementRepairs: bindPlacementRepairs(
      document,
      integralView.repairs,
      gauge,
      partIdByOccurrenceOrdinal,
    ),
    candidateStepCommitments: loop.candidateStepCommitments,
    atomicSubBuildRoot: loop.atomicSubBuildRoot,
    detachedSubBuildStates: loop.detachedSubBuildStates,
    subBuildReturnEnumeration: loop.subBuildReturnEnumeration,
    selectedSubBuildReturn: loop.selectedSubBuildReturn,
    step44SelectionEvidence: loop.step44SelectionEvidence,
    step45RelationalEvidence: loop.step45RelationalEvidence,
    suffixSubBuildPlan: loop.suffixSubBuildPlan,
    sameStepReturnStates: loop.sameStepReturnStates,
    step50AtomicRoot: loop.step50AtomicRoot,
    terminalDetachedState: loop.terminalDetachedState,
    document,
  });
}

export function compileRealBuildPrefix50ExactProjection(
  unsafeInput: unknown,
  step45RelationalCompiler: RealBuildPrefix50Step45RelationalCompiler,
): RealBuildPrefix50ExactCompilation {
  const compilation = compileRealBuildPrefix50ProjectionCore(
    unsafeInput,
    readRealBuildPrefix50VerifiedProjection,
    true,
    true,
    step45RelationalCompiler,
  );
  if (compilation.occurrence30SourceRepair === null) {
    throw new TypeError(
      "Canonical prefix-50 compilation requires its opaque occurrence-30 source repair proof.",
    );
  }
  if (compilation.step41SourceRepair === null) {
    throw new TypeError(
      "Canonical prefix-50 compilation requires its opaque Step-41 source repair proof and reviewed Step-44 return.",
    );
  }
  if (compilation.step42SourceRepair === null || compilation.step42_43SourceRepair === null) {
    throw new TypeError(
      "Canonical prefix-50 compilation requires its opaque Step-42 and combined Step-42/43 repair proofs to survive the reviewed Step-44 return and complete exact prefix.",
    );
  }
  if (
    compilation.selectedSubBuildReturn === null ||
    compilation.step44SelectionEvidence === null ||
    compilation.step45RelationalEvidence === null ||
    compilation.suffixSubBuildPlan === null ||
    compilation.sameStepReturnStates === null ||
    compilation.step50AtomicRoot === null ||
    compilation.terminalDetachedState === null
  ) {
    throw new TypeError(
      "Canonical prefix-50 compilation requires exact Steps 45 through 50 SubBuild planning, same-step return receipts, and the Step-50 intentional-detached boundary receipt.",
    );
  }
  const result: RealBuildPrefix50ExactCompilation = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-exact-compilation/6" as const,
    ...compilation,
    occurrence30SourceRepair: compilation.occurrence30SourceRepair,
    step41SourceRepair: compilation.step41SourceRepair,
    step42SourceRepair: compilation.step42SourceRepair,
    step42_43SourceRepair: compilation.step42_43SourceRepair,
    selectedSubBuildReturn: compilation.selectedSubBuildReturn,
    step44SelectionEvidence: compilation.step44SelectionEvidence,
    step45RelationalEvidence: compilation.step45RelationalEvidence,
    suffixSubBuildPlan: compilation.suffixSubBuildPlan,
    sameStepReturnStates: compilation.sameStepReturnStates,
    step50AtomicRoot: compilation.step50AtomicRoot,
    terminalDetachedState: compilation.terminalDetachedState,
  });
  brandRealBuildPrefix50ExactCompilation(result);
  return result;
}

/** Synthetic and incomplete runs can observe blockers but can mint no authority. */
function diagnoseRealBuildPrefix50Projection(
  unsafeInput: unknown,
  readProjection: (unsafeReader: unknown) => RealBuildPrefix50VerifiedProjection,
  requireOccurrence30Proof: boolean,
): RealBuildPrefix50DiagnosticObservation {
  exactInputKeys(unsafeInput, requireOccurrence30Proof);
  const initialSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    ownData(unsafeInput, "documentSnapshot", "Prefix-50 exact compiler input"),
  );
  const projection = readProjection(
    ownData(unsafeInput, "projectionReader", "Prefix-50 exact compiler input"),
  );
  const evidence = {
    sourceSetId: projection.sourceSetId,
    sourceArtifactDigest: projection.sourceArtifactDigest,
    projectionCommitment: realBuildPrefix50ProjectionCommitment(projection),
    truthDigest: canonicalDigest(initialSnapshot.document.truth),
  };
  const searchScope = {
    committedPrefixSelection: "first-locally-complete-order-per-step" as const,
    currentStepBacktracking: "within-step-only" as const,
    crossStepBacktracking: false as const,
    nodeBudget: "cumulative-across-prefix" as const,
  };
  try {
    const compilation = compileRealBuildPrefix50ProjectionCore(
      unsafeInput,
      readProjection,
      requireOccurrence30Proof,
      false,
      null,
    );
    return deepFreeze({
      schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1" as const,
      placementAuthority: false as const,
      completionAuthority: false as const,
      documentAuthority: false as const,
      publicationAuthority: false as const,
      searchScope,
      outcome: "selected-path-complete" as const,
      ...evidence,
      blocker: null,
      observation: {
        completedPrintedStep: compilation.stateCommitments.at(-1)?.completedPrintedStep ?? 0,
        compiledPartCount: compilation.document.parts.length,
        compiledStepCount: compilation.document.steps.length,
        enumerationCount: compilation.enumerationCount,
        searchNodeCount: compilation.searchNodeCount,
      },
    });
  } catch (error) {
    if (!(error instanceof RealBuildPrefix50SelectedPathBlockerError)) throw error;
    return deepFreeze({
      schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1" as const,
      placementAuthority: false as const,
      completionAuthority: false as const,
      documentAuthority: false as const,
      publicationAuthority: false as const,
      searchScope,
      outcome: "selected-committed-prefix-within-step-blocker" as const,
      ...evidence,
      blocker: error.blocker,
      observation: {
        completedPrintedStep: error.blocker.printedStepNumber - 1,
        compiledPartCount: error.blocker.basePartCount,
        compiledStepCount: error.blocker.baseStepCount,
        enumerationCount: error.blocker.enumerationCount,
        searchNodeCount: error.blocker.searchNodeCount,
      },
    });
  }
}

export function diagnoseRealBuildPrefix50VerifiedProjection(
  unsafeInput: unknown,
): RealBuildPrefix50DiagnosticObservation {
  return diagnoseRealBuildPrefix50Projection(
    unsafeInput,
    readRealBuildPrefix50VerifiedProjection,
    true,
  );
}

export function diagnoseRealBuildPrefix50ProjectionForTest(
  unsafeInput: unknown,
): RealBuildPrefix50DiagnosticObservation {
  return diagnoseRealBuildPrefix50Projection(
    unsafeInput,
    readSyntheticRealBuildPrefix50DiagnosticProjectionForTest,
    false,
  );
}

export const __testOnly = Object.freeze({
  buildRealBuildPrefix50ExactEnumerationQuery,
  proposeRealBuildPrefix50WorldGaugeSourceRepair,
  proposeRealBuildPrefix50Occurrence30SourceRepair,
  occurrence30RepairCommitment,
  bindOccurrence30SourceRepair,
  requireUniqueExactPlacementRepairEdge,
  searchStateMemoCommitment,
  stateLocalEnumerationQueryCommitment,
  searchStep: searchStepForTest,
});
