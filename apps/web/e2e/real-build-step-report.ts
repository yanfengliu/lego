import type { DeferralEvidence } from "./real-build-deferral";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type {
  RealBuildPanelSpec,
  RealBuildPieceReport,
  RealBuildStepReport,
  StepOutcome,
  StepPrerequisiteFacts,
  WholeStepVisualEvidence,
} from "./real-build-safety";

/**
 * The row a printed step leaves behind, assembled in one place.
 *
 * Split out of the run loop because it is the boundary the Node finalizer and
 * the replay verifier both read: every field here is checked against the
 * prepared panel it claims to describe, so the mapping from raster evidence to
 * reported evidence is worth reading without the search around it.
 */

/** The panel's own reported facts, none of which depend on any candidate. */
export function panelEvidenceReport(
  evidence: PanelRasterEvidence,
): Pick<RealBuildStepReport, "fit" | "highlight" | "arrows"> {
  const solution = evidence.fitSolution;
  return {
    fit: {
      azimuthDegrees: solution?.azimuthDegrees ?? null,
      elevationDegrees: solution?.elevationDegrees ?? null,
      pixelsPerUnit: solution?.pixelsPerUnit ?? null,
      residualPx: solution?.residualPx ?? null,
      coherence: evidence.fitCoherence,
      failure: evidence.fitFailure,
    },
    highlight: {
      regions: evidence.highlight.regions.length,
      closedContourRate: evidence.highlight.closedContourRate,
      strokePx: evidence.highlight.keyedPx,
      boundsPx:
        evidence.highlightBox === null
          ? null
          : [
              evidence.highlightBox.minXPx,
              evidence.highlightBox.minYPx,
              evidence.highlightBox.maxXPx,
              evidence.highlightBox.maxYPx,
            ],
    },
    arrows: {
      kept: evidence.arrows.arrows.length,
      redPx: evidence.arrows.redPx,
      rejected: evidence.arrows.rejected.length,
      displacementFamily: evidence.arrowFamily.length,
      displacementFamilyLdu: evidence.arrowFamily
        .slice(0, 8)
        .map((entry) => [entry.lduX, entry.lduY, entry.lduZ] as const),
    },
  };
}

export function composeExecutedStepReport(input: {
  readonly spec: RealBuildPanelSpec;
  readonly evidence: PanelRasterEvidence;
  readonly prerequisites: StepPrerequisiteFacts;
  readonly outcome: StepOutcome;
  readonly validation: RealBuildStepReport["validation"];
  readonly camera: RealBuildStepReport["camera"];
  readonly pieces: readonly RealBuildPieceReport[];
  readonly jointVisual: WholeStepVisualEvidence | null;
  readonly deferral: DeferralEvidence | null;
  readonly placedPieces: number;
  readonly canonicalStepId: string | null;
  readonly documentParts: number;
  readonly elapsedMs: number;
  readonly panelPng: string | null;
  readonly buildPng: string | null;
}): RealBuildStepReport {
  const { spec } = input;
  return {
    stepNumber: spec.stepNumber,
    pageNumber: spec.pageNumber,
    panelFace: spec.panelFace,
    ...panelEvidenceReport(input.evidence),
    calloutPieces: spec.calloutPieces,
    expectedAssembledPieces: spec.action.assembledPieces,
    attemptedPieces:
      spec.action.kind === "multi-build-copy"
        ? spec.action.copies.length
        : spec.pieces.length + spec.omittedPieces.length,
    placedPieces: input.placedPieces,
    action: spec.action,
    actionEvidenceDigest: spec.action.evidenceDigest,
    canonicalStepId: input.outcome.status === "complete" ? input.canonicalStepId : null,
    prerequisites: input.prerequisites,
    outcome: input.outcome,
    validation: input.validation,
    camera: input.camera,
    pieces: input.pieces,
    jointVisual: input.jointVisual,
    deferral: input.deferral,
    documentParts: input.documentParts,
    elapsedMs: input.elapsedMs,
    panelPng: input.panelPng,
    buildPng: input.buildPng,
  };
}
