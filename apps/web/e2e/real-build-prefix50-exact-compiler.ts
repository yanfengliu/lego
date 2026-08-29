import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type { AddPartOperation, PlacePartInstruction } from "@lego-studio/protocol";

import { diagnosePlacementTransform } from "../src/assembly/enumerate-placements";
import { compileRealBuildAutomaticPlacement } from "./real-build-automatic-placement-compiler";
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
import { requireIntegralProtocolGaugeCompatibility } from "./real-build-prefix50-integral-gauge";
import { requireRealBuildPrefix50Occurrence30SourceRepairProof } from "./real-build-prefix50-occurrence30-source-repair";
import { proposeRealBuildPrefix50SourcePlacementRepairs } from "./real-build-prefix50-source-placement-repair";
import { compileRealBuildPrefix50ZeroPieceStep } from "./real-build-prefix50-zero-step";
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
  snapshot,
  targetsFor,
  verifyStepResult,
} from "./real-build-prefix50-exact-compiler-operations";
import {
  searchStateMemoCommitment,
  searchStep,
  searchStepForTest,
} from "./real-build-prefix50-exact-compiler-search";

export {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
  requireRealBuildPrefix50CompleteEnumeration,
};
export type {
  RealBuildPrefix50BoundOccurrence30SourceRepair,
  RealBuildPrefix50BoundPlacementRepair,
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
  requireOccurrence30Proof: boolean,
): RealBuildPrefix50ExactCompilationCore {
  exactInputKeys(unsafeInput, requireOccurrence30Proof);
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
  const occurrence30SourceRepairProposal = requireOccurrence30Proof
    ? proposeRealBuildPrefix50Occurrence30SourceRepair(
        sourceProjection,
        requireRealBuildPrefix50Occurrence30SourceRepairProof(
          ownData(unsafeInput, "occurrence30SourceRepairProof", "Prefix-50 exact compiler input"),
        ),
        readRealBuildPrefix50Occurrence30ActionBinding(projectionReader),
      )
    : null;
  const integralView = proposeRealBuildPrefix50SourcePlacementRepairs(sourceProjection);
  const projection = integralView.projection;
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
  let document = initialSnapshot.document;
  const placementOrdinals: number[] = [];
  const partIdByOccurrenceOrdinal = new Map<number, string>();
  const stateCommitments: RealBuildPrefix50StateCommitment[] = [
    {
      completedPrintedStep: 0,
      partCount: 0,
      documentHash: documentStructuralHash(document),
    },
  ];
  for (
    let printedStepNumber = 1;
    printedStepNumber <= REAL_BUILD_PREFIX50_LAST_STEP;
    printedStepNumber += 1
  ) {
    const metadata = projection.steps[printedStepNumber - 1]!;
    const targets = targetsFor(
      projection,
      gauge,
      printedStepNumber,
      worldGaugeSourceRepairProposal,
      occurrence30SourceRepairProposal,
    );
    const before = document;
    if (printedStepNumber === REAL_BUILD_PREFIX50_TRANSITION_STEP) {
      document = compileRealBuildPrefix50ZeroPieceStep({
        documentSnapshot: snapshot(document),
        printedStepNumber,
        printedStep: metadata,
      }).document;
    } else {
      const basePartIds = new Set(document.parts.map(({ id }) => id));
      const searched = searchStep(
        {
          document,
          remaining: targets,
          witnesses: [],
          ordinals: [],
          witnessIndexByTempId: new Map(),
        },
        basePartIds,
        printedStepNumber === 1,
        budget,
        new Set(),
      );
      if (searched === null) {
        const firstNeverMatched = targets.find(
          ({ ordinal }) => budget.targetAttempts.get(ordinal)?.matches === 0,
        );
        const attempt =
          firstNeverMatched === undefined
            ? undefined
            : budget.targetAttempts.get(firstNeverMatched.ordinal);
        const diagnosis =
          firstNeverMatched === undefined
            ? undefined
            : diagnosePlacementTransform(
                document,
                firstNeverMatched.partIdentity.reconciledCatalogPartId,
                firstNeverMatched.targetTransform,
              );
        const detail =
          firstNeverMatched === undefined || attempt === undefined
            ? " every target appeared individually, but no complete dependency ordering survived"
            : ` occurrence ${firstNeverMatched.ordinal} (${firstNeverMatched.partIdentity.reconciledCatalogPartId}) source ${firstNeverMatched.sourceWorldTransform.positionLdu.join(",")}/${firstNeverMatched.sourceWorldTransform.orientationId} target ${firstNeverMatched.targetTransform.positionLdu.join(",")}/${firstNeverMatched.targetTransform.orientationId} never appeared across ${attempt.attempts} complete enumerations; gauge ${JSON.stringify(gauge)}; base part count ${document.parts.length}; diagnosis ${JSON.stringify(diagnosis)}; last counts ${JSON.stringify(attempt.lastCounts)}`;
        const message = `Prefix-50 selected committed-prefix path has no bounded within-step ordering at printed step ${printedStepNumber} in which every exact target is present in complete placement enumeration; earlier printed-step choices were not revisited;${detail}.`;
        throw new RealBuildPrefix50SelectedPathBlockerError(message, {
          message,
          printedStepNumber,
          occurrenceOrdinal: firstNeverMatched?.ordinal ?? null,
          catalogPartId: firstNeverMatched?.partIdentity.reconciledCatalogPartId ?? null,
          sourceWorldTransform: firstNeverMatched?.sourceWorldTransform ?? null,
          targetTransform: firstNeverMatched?.targetTransform ?? null,
          diagnosis: diagnosis ?? null,
          lastCounts: attempt?.lastCounts ?? null,
          basePartCount: document.parts.length,
          baseStepCount: document.steps.length,
          enumerationCount: budget.enumerations,
          searchNodeCount: budget.nodes,
        });
      }
      const compiled = compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot(document),
        printedStepNumber,
        printedStep: metadata,
        witnesses: searched.witnesses,
      });
      if (!compiled.ok) {
        const firstIssue = compiled.issues[0];
        throw new TypeError(
          `Prefix-50 automatic compilation failed at printed step ${printedStepNumber}${firstIssue ? ` (${firstIssue.code}: ${firstIssue.message})` : ""}.`,
        );
      }
      document = compiled.document;
      placementOrdinals.push(...searched.ordinals);
      const placementOperations =
        compiled.automaticPlacement.program.placementProgram.operations.filter(
          (operation): operation is PlacePartInstruction => operation.kind === "placePart",
        );
      const compiledPartOperations = compiled.patch.operations.filter(
        (operation): operation is AddPartOperation => operation.kind === "addPart",
      );
      for (const [ordinal, partId] of verifyStepResult(
        before,
        document,
        targets,
        searched.ordinals,
        placementOperations,
        compiledPartOperations,
        printedStepNumber,
      )) {
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      }
    }
    stateCommitments.push({
      completedPrintedStep: printedStepNumber,
      partCount: document.parts.length,
      documentHash: documentStructuralHash(document),
    });
  }
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
  return deepFreeze({
    projectionCommitment,
    gauge,
    gaugeCommitment: canonicalDigest({
      schemaVersion: "lego.real-build-prefix50-world-gauge/3",
      firstOccurrenceOrdinal: first.ordinal,
      sourceWorldTransform: first.sourceWorldTransform,
      worldGaugeSourceRepair,
      occurrence30SourceRepairCommitment: occurrence30SourceRepair?.repairCommitment ?? null,
      gauge,
    }),
    worldGaugeSourceRepair,
    occurrence30SourceRepair,
    placementOrdinals,
    stateCommitments,
    enumerationCount: budget.enumerations,
    orientationNarrowedEnumerationCount: budget.orientationNarrowedEnumerations,
    searchNodeCount: budget.nodes,
    sourcePlacementRepairs: bindPlacementRepairs(
      document,
      integralView.repairs,
      gauge,
      partIdByOccurrenceOrdinal,
    ),
    document,
  });
}

export function compileRealBuildPrefix50ExactProjection(
  unsafeInput: unknown,
): RealBuildPrefix50ExactCompilation {
  const compilation = compileRealBuildPrefix50ProjectionCore(
    unsafeInput,
    readRealBuildPrefix50VerifiedProjection,
    true,
  );
  if (compilation.occurrence30SourceRepair === null) {
    throw new TypeError(
      "Canonical prefix-50 compilation requires its opaque occurrence-30 source repair proof.",
    );
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-exact-compilation/2" as const,
    ...compilation,
    occurrence30SourceRepair: compilation.occurrence30SourceRepair,
  });
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
  proposeRealBuildPrefix50WorldGaugeSourceRepair,
  proposeRealBuildPrefix50Occurrence30SourceRepair,
  occurrence30RepairCommitment,
  bindOccurrence30SourceRepair,
  requireUniqueExactPlacementRepairEdge,
  searchStateMemoCommitment,
  searchStep: searchStepForTest,
});
