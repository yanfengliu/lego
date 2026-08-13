import { unexecutedStepReport } from "./real-build-contract";
import {
  stepPrerequisiteFailure,
  type RealBuildPanelSpec,
  type RealBuildStepReport,
} from "./real-build-safety";

/** Pure causal row construction for a suffix blocked by an earlier printed step. */
export function blockedRealBuildRunStepReport(input: {
  readonly panel: RealBuildPanelSpec;
  readonly blockingStep: number;
  readonly documentParts: number;
}): RealBuildStepReport {
  const { panel, blockingStep } = input;
  const blocked = stepPrerequisiteFailure({
    stepNumber: panel.stepNumber,
    actionKind: panel.action.kind,
    blockingStep,
    coverageFailures: panel.coverageFailures,
    unresolvedCallouts: panel.unresolvedCallouts,
    missingDesigns: panel.missingDesigns,
    calloutPieces: panel.calloutPieces,
    expectedAssembledPieces: panel.action.assembledPieces,
    resolvedPieces:
      panel.action.kind === "multi-build-copy"
        ? panel.action.copies.length
        : panel.pieces.length + panel.omittedPieces.length,
  });
  if (blocked === null) {
    throw new TypeError(
      `Printed step ${panel.stepNumber} followed blocking step ${blockingStep}, but causality produced no blocked outcome.`,
    );
  }
  return unexecutedStepReport(panel, blocked.failure, {
    blockingStep,
    documentParts: input.documentParts,
    elapsedMs: 0,
    reason: blocked.failure.message,
  });
}

function renderingFailureReport(input: {
  readonly panel: RealBuildPanelSpec;
  readonly blockingStep: number | null;
  readonly documentParts: number;
  readonly elapsedMs: number;
  readonly reason: string;
  readonly message: string;
  readonly panelCamera: RealBuildStepReport["panelCamera"];
}): RealBuildStepReport {
  return unexecutedStepReport(
    input.panel,
    {
      code: "rendering-error",
      stage: "rendering",
      stepNumber: input.panel.stepNumber,
      message: input.message,
    },
    input,
  );
}

export function failedRealBuildPageReport(input: {
  readonly panel: RealBuildPanelSpec;
  readonly pageNumber: number | null;
  readonly pageFailure: string | null;
  readonly blockingStep: number | null;
  readonly documentParts: number;
  readonly panelCamera: RealBuildStepReport["panelCamera"];
}): RealBuildStepReport {
  const reason = input.pageFailure ?? "the page renderer returned no page and no diagnostic";
  return renderingFailureReport({
    ...input,
    elapsedMs: 0,
    reason,
    message:
      `Booklet page ${input.pageNumber} for printed step ${input.panel.stepNumber} could not be rendered: ` +
      `${reason}. The exact preceding document was retained, this step placed no pieces, and ` +
      `later printed steps remain represented as causally blocked scoreboard rows.`,
  });
}

export function failedRealBuildPanelEvidenceReport(input: {
  readonly panel: RealBuildPanelSpec;
  readonly reason: string;
  readonly blockingStep: number | null;
  readonly documentParts: number;
  readonly elapsedMs: number;
  readonly panelCamera: RealBuildStepReport["panelCamera"];
}): RealBuildStepReport {
  return renderingFailureReport({
    ...input,
    message:
      `Step ${input.panel.stepNumber} failed while preparing or rendering its panel evidence: ${input.reason}. ` +
      `The exact step base was retained and later printed steps remain in the scoreboard.`,
  });
}
