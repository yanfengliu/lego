import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import {
  inspectRealBuildCompiledPlacementLineageWork,
  inspectRealBuildCompiledPlacementLineageReplayWork,
  type RealBuildCompiledPlacementLineageWorkInspection,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
} from "./real-build-compiled-placement-lineage-parser";
import type {
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationClosureInspection,
} from "./real-build-compiled-observation-closure-types";
import { parseRealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-parser";
import {
  inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork,
  type RealBuildCompiledObservationPreflight,
} from "./real-build-compiled-observation-closure-preflight";
import { requireRealBuildCompiledObservationClosurePreReplayRows } from "./real-build-compiled-observation-closure-pre-replay";
import { verifyRealBuildCompiledObservationRows } from "./real-build-compiled-observation-closure-verification";
import {
  inspectRealBuildPreparedObservationPolicyFromRunInput,
  inspectRealBuildPreparedRunInput,
  inspectRealBuildPreparedStepFromRunInput,
  type RealBuildPreparedRunInputInspection,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import {
  inspectRealBuildBrowserBranchEvidenceV1,
  readRealBuildBrowserBranchStepEvidenceBytes,
} from "./real-build-browser-output-v4-role";
import type {
  RealBuildBrowserBranchEvidenceV1,
  RealBuildBrowserBranchStepEvidenceIndex,
} from "./real-build-browser-output-v4-types";
import {
  requireRealBuildBrowserBranchLineageOnlyState,
  requireRealBuildBrowserBranchPreReplayObservationBindings,
  requireRealBuildBrowserBranchTerminalState,
} from "./real-build-browser-output-v4-semantic-preflight";
import {
  chargeRealBuildBrowserBranchAggregateReplayWork,
  chargeRealBuildBrowserBranchAggregateWork,
  createRealBuildBrowserBranchAggregateWork,
} from "./real-build-browser-output-v4-semantic-work";

export const REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION =
  "lego.real-build-browser-branch-semantic-inspection/1" as const;
export const REAL_BUILD_BROWSER_BRANCH_DETAILED_INSPECTION_SCHEMA_VERSION =
  "lego.real-build-browser-branch-detailed-inspection/1" as const;

const ABSENT_AUTHORITY = intrinsicRealBuildFreeze({
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

export interface RealBuildBrowserBranchDetailedStepInspection {
  readonly stepNumber: number;
  readonly index: RealBuildBrowserBranchStepEvidenceIndex;
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly lineageInspection: RealBuildCompiledPlacementLineageWorkInspection;
  readonly closure: RealBuildCompiledObservationClosure | null;
  readonly observation: RealBuildCompiledObservationClosureInspection | null;
}

/**
 * Branded authority-free detail retained by the semantic replay. A future outer
 * browser-output reader can derive exact frontier and provenance continuity from
 * these already-verified rows without reparsing or rerunning branch work.
 */
export interface RealBuildBrowserBranchDetailedInspection {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_BRANCH_DETAILED_INSPECTION_SCHEMA_VERSION;
  readonly preparedRun: RealBuildPreparedRunInputInspection;
  readonly branch: RealBuildBrowserBranchEvidenceV1;
  readonly steps: readonly RealBuildBrowserBranchDetailedStepInspection[];
  readonly semantic: RealBuildBrowserBranchSemanticInspection;
  readonly authority: "absent";
}

const detailedInspections = new WeakSet<object>();

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

/**
 * Verifies local compiled branch and observation calculations without reading a /4 report envelope.
 * The result cannot authorize placement, document mutation, publication, or build completion.
 */
export function inspectRealBuildBrowserBranchDetailedEvidence(
  branchEvidenceBytes: unknown,
  compiledBranchRoleBytes: unknown,
  observationRoleBytes: unknown,
  preparedRunInputBytes: unknown,
): RealBuildBrowserBranchDetailedInspection {
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
  let aggregate = createRealBuildBrowserBranchAggregateWork();
  const steps: RealBuildBrowserBranchSemanticStepInspection[] = [];
  const detailedSteps: RealBuildBrowserBranchDetailedStepInspection[] = [];
  let terminalStep: number | null = null;
  for (const indexed of branch.steps) {
    if (terminalStep !== null) {
      throw new TypeError(
        `Browser branch step ${indexed.stepNumber} follows terminal compiled step ${terminalStep}; no later branch work may survive a failed or budget-refused batch.`,
      );
    }
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
    aggregate = chargeRealBuildBrowserBranchAggregateWork(
      aggregate,
      lineageInspection.work,
      closure,
    );
    const preparedStep = inspectRealBuildPreparedStepFromRunInput(preparedRun, indexed.stepNumber);
    requirePreparedBinding(indexed.stepNumber, lineage, preparedStep);
    const terminal = lineage.status === "failed" || lineage.status === "budget-refused";
    if (terminal) requireRealBuildBrowserBranchTerminalState(lineage, closure);
    else requireRealBuildBrowserBranchLineageOnlyState(lineage);
    if (terminal) terminalStep = indexed.stepNumber;
    const replayWorkInspection =
      inspectRealBuildCompiledPlacementLineageReplayWork(lineageInspection);
    aggregate = chargeRealBuildBrowserBranchAggregateReplayWork(
      aggregate,
      replayWorkInspection.work,
    );
    validateRealBuildCompiledPlacementLineageReplayWorkInspection(replayWorkInspection);
    const preflight: RealBuildCompiledObservationPreflight | null =
      closure === null || terminal
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
    detailedSteps.push(
      intrinsicRealBuildFreeze({
        stepNumber: indexed.stepNumber,
        index: indexed,
        preparedStep,
        lineageInspection,
        closure,
        observation,
      }),
    );
    steps.push(
      intrinsicRealBuildFreeze({
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
  const semantic = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION,
    preparedRunInputDigest: preparedRun.preparedRunInputDigest,
    preparedLastStep: preparedRun.lastStep,
    indexedSteps: steps.length,
    coverageAuthority: "absent",
    steps: intrinsicRealBuildFreeze(steps),
    provenanceAuthority: "absent",
    placementAuthority: ABSENT_AUTHORITY,
    completionAuthority: ABSENT_AUTHORITY,
  });
  const detailed = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_BRANCH_DETAILED_INSPECTION_SCHEMA_VERSION,
    preparedRun,
    branch,
    steps: intrinsicRealBuildFreeze(detailedSteps),
    semantic,
    authority: "absent" as const,
  });
  detailedInspections.add(detailed);
  return detailed;
}

export function requireRealBuildBrowserBranchDetailedInspection(
  value: unknown,
): RealBuildBrowserBranchDetailedInspection {
  if (value === null || typeof value !== "object" || !detailedInspections.has(value)) {
    throw new TypeError(
      "Detailed browser branch inspection must be the exact authority-free result of semantic replay.",
    );
  }
  return value as RealBuildBrowserBranchDetailedInspection;
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
  return inspectRealBuildBrowserBranchDetailedEvidence(
    branchEvidenceBytes,
    compiledBranchRoleBytes,
    observationRoleBytes,
    preparedRunInputBytes,
  ).semantic;
}
