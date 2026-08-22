import type { RealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-types";
import type { RealBuildCompiledPlacementLineageWorkInspection } from "./real-build-compiled-placement-lineage-parser";
import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import type { RealBuildBrowserBranchEvidenceV1 } from "./real-build-browser-output-v4-types";

export function requireRealBuildBrowserBranchLineageOnlyState(
  lineage: RealBuildCompiledPlacementLineageEvidence,
): void {
  if (lineage.status !== "unresolved") {
    throw new TypeError(
      `Browser /4 semantic inspection received compiled lineage status ${JSON.stringify(lineage.status)}; expected "unresolved" before typed closure replay.`,
    );
  }
  if (lineage.lineageEdges.length === 0) {
    throw new TypeError(
      "Browser /4 semantic inspection received 0 compiled lineage edges; expected at least one unresolved edge before typed closure replay.",
    );
  }
  if (lineage.observationBytes !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy observationBytes committing ${lineage.observationBytes.bytes} bytes; expected null because typed closure roles are verified separately.`,
    );
  }
  if (lineage.observationRefs.length !== 0) {
    throw new TypeError(
      `Browser /4 semantic inspection received ${lineage.observationRefs.length} legacy observationRefs; expected 0 because typed closure observations are verified separately.`,
    );
  }
  if (lineage.selection.status !== "unresolved") {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy selection status ${JSON.stringify(lineage.selection.status)}; expected "unresolved" before typed closure replay.`,
    );
  }
  if (lineage.selection.decisionPanelStepNumber !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy decisionPanelStepNumber ${lineage.selection.decisionPanelStepNumber}; expected null before typed closure replay.`,
    );
  }
  if (lineage.selection.selectedCandidateId !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy selectedCandidateId ${JSON.stringify(lineage.selection.selectedCandidateId)}; expected null before typed closure replay.`,
    );
  }
  if (lineage.selection.selectedLineageIds.length !== 0) {
    throw new TypeError(
      `Browser /4 semantic inspection received ${lineage.selection.selectedLineageIds.length} legacy selectedLineageIds; expected 0 before typed closure replay.`,
    );
  }
  if (lineage.selection.bestScore !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy bestScore ${lineage.selection.bestScore}; expected null before typed closure replay.`,
    );
  }
  if (lineage.selection.runnerUpScore !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy runnerUpScore ${lineage.selection.runnerUpScore}; expected null before typed closure replay.`,
    );
  }
  if (lineage.selection.margin !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy margin ${lineage.selection.margin}; expected null before typed closure replay.`,
    );
  }
  if (lineage.acceptedTransition !== null) {
    throw new TypeError(
      `Browser /4 semantic inspection received legacy acceptedTransition for candidate ${JSON.stringify(lineage.acceptedTransition.candidateId)}; expected null before typed closure replay.`,
    );
  }
}

export function requireRealBuildBrowserBranchTerminalState(
  lineage: RealBuildCompiledPlacementLineageEvidence,
  closure: RealBuildCompiledObservationClosure | null,
): void {
  if (lineage.status !== "failed" && lineage.status !== "budget-refused") {
    throw new TypeError(
      `Browser /4 terminal inspection received compiled lineage status ${JSON.stringify(lineage.status)}; expected failed or budget-refused.`,
    );
  }
  if (closure !== null) {
    throw new TypeError(
      `Browser /4 terminal step ${lineage.throughStepNumber} cannot retain an observation closure after ${lineage.status} compilation.`,
    );
  }
  if (
    lineage.observationBytes !== null ||
    lineage.observationRefs.length !== 0 ||
    lineage.selection.status !== "not-applicable" ||
    lineage.selection.decisionPanelStepNumber !== null ||
    lineage.selection.selectedCandidateId !== null ||
    lineage.selection.selectedLineageIds.length !== 0 ||
    lineage.selection.bestScore !== null ||
    lineage.selection.runnerUpScore !== null ||
    lineage.selection.margin !== null ||
    lineage.acceptedTransition !== null
  ) {
    throw new TypeError(
      `Browser /4 terminal step ${lineage.throughStepNumber} retains observation, selection, or accepted-transition state after ${lineage.status} compilation.`,
    );
  }
}

export function requireRealBuildBrowserBranchPreReplayObservationBindings(
  indexed: RealBuildBrowserBranchEvidenceV1["steps"][number],
  lineageInspection: RealBuildCompiledPlacementLineageWorkInspection,
  closure: RealBuildCompiledObservationClosure | null,
): void {
  if (closure === null) return;
  if (closure.compiledLineageBytesDigest !== lineageInspection.compiledLineageBytesDigest) {
    throw new TypeError(
      `Browser branch step ${indexed.stepNumber} observation closure commits compiled lineage digest ${closure.compiledLineageBytesDigest}; expected ${lineageInspection.compiledLineageBytesDigest} before replay.`,
    );
  }
  const reference = indexed.observations;
  if (closure.roleBytes === 0) {
    if (reference !== null) {
      throw new TypeError(
        `Browser branch step ${indexed.stepNumber} observation closure commits 0 raw-role bytes, but the branch index supplies ${reference.bytes}; expected no observation role reference before replay.`,
      );
    }
    return;
  }
  if (reference === null) {
    throw new TypeError(
      `Browser branch step ${indexed.stepNumber} observation closure commits ${closure.roleBytes} raw-role bytes, but the branch index has no observation role reference before replay.`,
    );
  }
  if (reference.bytes !== closure.roleBytes) {
    throw new TypeError(
      `Browser branch step ${indexed.stepNumber} observation role reference commits ${reference.bytes} bytes; expected the closure's ${closure.roleBytes} bytes before replay.`,
    );
  }
  if (reference.digest !== closure.roleDigest) {
    throw new TypeError(
      `Browser branch step ${indexed.stepNumber} observation role reference commits digest ${reference.digest}; expected the closure's ${closure.roleDigest} before replay.`,
    );
  }
}
