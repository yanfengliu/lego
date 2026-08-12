import type { AcceptedCanonicalStepSemantics } from "./real-build-browser-output-transition-continuity";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const empty = (value: unknown): boolean => Array.isArray(value) && value.length === 0;

export interface RealBuildAcceptedContinuityState {
  readonly acceptedSteps: Map<number, AcceptedCanonicalStepSemantics>;
  acceptedDocumentParts: number;
  blockingStep: number | null;
}

function unattemptedValidation(value: unknown, allowNullFailure = false): boolean {
  if (!isRecord(value)) return false;
  return (
    value.attempted === false &&
    value.targetDocumentHash === null &&
    value.truthSnapshotHash === null &&
    value.validatorSetHash === null &&
    value.documentGloballyValid === null &&
    empty(value.blockingIssues) &&
    ((typeof value.failure === "string" && value.failure.length > 0) ||
      (allowNullFailure && value.failure === null))
  );
}

function noCandidateArtifacts(report: Record<string, unknown>, allowRootCamera = false): boolean {
  return (
    empty(report.pieces) &&
    report.jointVisual === null &&
    report.deferral === null &&
    report.farther === null &&
    empty(report.fartherCaptures) &&
    report.explodedGhost === null &&
    report.buildPng === null &&
    report.camera === null &&
    (allowRootCamera || report.panelCamera === null)
  );
}

function noCandidateWork(report: Record<string, unknown>, allowRootCamera = false): boolean {
  const fit = isRecord(report.fit) ? report.fit : null;
  const highlight = isRecord(report.highlight) ? report.highlight : null;
  const arrows = isRecord(report.arrows) ? report.arrows : null;
  return (
    noCandidateArtifacts(report, allowRootCamera) &&
    fit?.azimuthDegrees === null &&
    fit.elevationDegrees === null &&
    fit.pixelsPerUnit === null &&
    fit.residualPx === null &&
    fit.coherence === 0 &&
    typeof fit.failure === "string" &&
    fit.failure.length > 0 &&
    highlight?.regions === 0 &&
    highlight.closedContourRate === 0 &&
    highlight.strokePx === 0 &&
    highlight.boundsPx === null &&
    arrows?.kept === 0 &&
    arrows.redPx === 0 &&
    arrows.rejected === 0 &&
    arrows.displacementFamily === 0 &&
    empty(arrows.displacementFamilyLdu) &&
    report.panelPng === null &&
    Number.isFinite(report.elapsedMs) &&
    (report.elapsedMs as number) >= 0 &&
    (report.elapsedMs as number) <= 4 * 60 * 60 * 1_000
  );
}

export function rootSeedRefusalIsPrePlacement(
  report: Record<string, unknown>,
  outcome: Record<string, unknown> | null,
): boolean {
  const failure = isRecord(outcome?.failure) ? outcome.failure : null;
  const cameraRefusal =
    failure?.stepNumber === 1 &&
    typeof failure.message === "string" &&
    failure.code === "camera-handedness-unresolved" &&
    failure.stage === "camera-registration";
  const renderingRefusal =
    failure?.stepNumber === 1 &&
    typeof failure.message === "string" &&
    failure.code === "rendering-error" &&
    failure.stage === "rendering";
  return (
    outcome?.status === "failed" &&
    outcome.mechanism === "deferred" &&
    outcome.attemptedMechanism === null &&
    (cameraRefusal || renderingRefusal) &&
    report.attemptedPieces === 0 &&
    report.placedPieces === 0 &&
    report.documentParts === 0 &&
    report.canonicalStepId === null &&
    unattemptedValidation(report.validation, cameraRefusal) &&
    (cameraRefusal ? noCandidateArtifacts(report, true) : noCandidateWork(report, true))
  );
}

export function priorBlockDefect(
  report: Record<string, unknown>,
  index: number,
  state: RealBuildAcceptedContinuityState,
): string | null {
  if (state.blockingStep === null) return null;
  const outcome = isRecord(report.outcome) ? report.outcome : null;
  const prerequisites = isRecord(report.prerequisites) ? report.prerequisites : null;
  const failure = isRecord(outcome?.failure) ? outcome.failure : null;
  if (
    outcome?.status === "failed" &&
    outcome.mechanism === "blocked" &&
    outcome.attemptedMechanism === null &&
    failure?.code === "blocked-by-prior-step" &&
    failure.stage === "causality" &&
    failure.causedByStep === state.blockingStep &&
    prerequisites?.blockingStep === state.blockingStep &&
    report.attemptedPieces === 0 &&
    report.placedPieces === 0 &&
    report.canonicalStepId === null &&
    report.documentParts === state.acceptedDocumentParts &&
    unattemptedValidation(report.validation) &&
    noCandidateWork(report) &&
    report.elapsedMs === 0
  ) {
    return null;
  }
  return (
    `Replay browser-output report[${index}] follows failed printed step ${state.blockingStep}, but does not ` +
    `retain an exact unattempted zero-placement blocked outcome with no validation, candidate, render, or ` +
    `document drift and naming that exact prior step.`
  );
}

export function recordAcceptedStep(
  report: Record<string, unknown>,
  index: number,
  state: RealBuildAcceptedContinuityState,
): void {
  const action = report.action as Record<string, unknown>;
  const stepNumber = index + 1;
  state.acceptedSteps.set(stepNumber, {
    stepNumber,
    id: report.canonicalStepId as string,
    name:
      action.kind === "transition"
        ? `Step ${stepNumber} [transition:${String(action.transition)};panel=${String(action.panelEvidenceDigest)}]`
        : `Step ${stepNumber}`,
    partCount: report.expectedAssembledPieces as number,
  });
  state.acceptedDocumentParts = report.documentParts as number;
}
