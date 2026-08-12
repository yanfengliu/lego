import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { FrozenLegacyBrowserOutputV2 } from "./real-build-artifact-legacy-browser-v2";
import { assertFrozenLegacyDocumentProjectionV2 } from "./real-build-artifact-legacy-document-v2";
import {
  assertFrozenLegacyIdentityProjectionV2,
  type FrozenLegacyFrameMismatch,
} from "./real-build-artifact-legacy-identity-predicates";
import {
  assertFrozenLegacyReportProjectionV2,
  isFrozenLegacyAtomicStepComplete,
} from "./real-build-artifact-legacy-report-predicates";
import {
  type RealBuildOptions,
  type RealBuildStepReport,
  type StepFailure,
} from "./real-build-safety";

const completionFailure = (message: string): StepFailure => ({
  code: "run-incomplete",
  stage: "validation",
  message,
});

function expectedBindingCount(options: RealBuildOptions): number {
  return options.panels
    .filter(({ stepNumber }) => stepNumber <= options.lastStep)
    .reduce(
      (total, panel) =>
        total +
        (panel.action.kind === "transition"
          ? 0
          : panel.action.kind === "multi-build-copy"
            ? panel.action.copies.length
            : panel.pieces.length + panel.omittedPieces.length),
      0,
    );
}

function reportOutcome(report: RealBuildStepReport): string {
  const failure = report.outcome.failure;
  return (
    `step ${report.stepNumber} ${report.outcome.status}/${report.outcome.mechanism} ` +
    `${report.placedPieces}/${report.expectedAssembledPieces} placed ` +
    `[highlight ${report.highlight.regions} region(s), ${report.highlight.strokePx}px stroke, ` +
    `closed ${report.highlight.closedContourRate}; arrows ${report.arrows.kept} kept ` +
    `${report.arrows.rejected} rejected, family ${report.arrows.displacementFamily} ` +
    `${JSON.stringify(report.arrows.displacementFamilyLdu)}]` +
    (failure === null ? "" : ` — ${failure.code}: ${failure.message}`)
  );
}

function legacyReproductionDefect(
  output: FrozenLegacyBrowserOutputV2 & { readonly status: "executed" },
  reports: readonly RealBuildStepReport[],
  options: RealBuildOptions,
): string | null {
  const mismatch =
    reports.length !== options.lastStep
      ? `${reports.length} step report(s) were retained against the requested prefix of ${options.lastStep}`
      : typeof output.documentJson !== "string"
        ? `documentJson is ${output.documentJson === null ? "null" : typeof output.documentJson}, not a string`
        : output.documentJson.length === 0
          ? "documentJson is empty, so the run finished without a document"
          : output.fetchedPdfDigest !== options.inputDigests.pdf
            ? `the browser fetched PDF ${String(output.fetchedPdfDigest)} but the prepared inputs pin ${options.inputDigests.pdf}`
            : output.identityBindings.length !== expectedBindingCount(options)
              ? `${output.identityBindings.length} identity binding(s) were retained against ${expectedBindingCount(options)} the requested panels declare`
              : null;
  if (mismatch === null) return null;
  const outcomes = reports.slice(0, 6).map(reportOutcome);
  return (
    `Executed replay browser-output does not reproduce its prepared inputs: ${mismatch}. ` +
    (outcomes.length === 0 ? "No step reports were retained." : `Steps: ${outcomes.join(" | ")}`)
  );
}

function frozenFrameFailure(mismatches: readonly FrozenLegacyFrameMismatch[]): StepFailure | null {
  const first = mismatches[0];
  if (first === undefined) return null;
  return {
    code: "official-frame-calibration-missing",
    stage: "validation",
    stepNumber: first.stepNumber,
    message:
      `${mismatches.length} visually searched placement(s) differ from their raw calibrated ` +
      `official-model transforms; the first is ${first.identityKey} at printed step ${first.stepNumber}: ` +
      `searched ${JSON.stringify(first.transform)}, official ${JSON.stringify(first.officialTransform)}. ` +
      `The repository has no independently proven proper world-frame mapping from the booklet search branch ` +
      `to the official target. The exact valid candidate bytes remain diagnostic, but target equivalence and ` +
      `completion are unavailable; do not treat a reflection as a frame or use the official transforms to ` +
      `choose the visual-search answer.`,
  };
}

function frozenVisualEvidenceFailure(stepNumber: number): StepFailure {
  return {
    code: "visual-evidence-unverified",
    stage: "evidence",
    stepNumber,
    message:
      `Printed step ${stepNumber} assembles physical pieces, but the Node finalizer cannot ` +
      `independently recompute the PDF crop, lattice fit, camera registration, highlight masks, rendered ` +
      `candidate scores, or decoded PNG pixels from retained raw rasters. Browser-supplied metrics and image ` +
      `headers remain diagnostic only, so completion is unavailable until a deterministic Node visual audit ` +
      `derives panel pixels from the pinned PDF and renders the canonical document.`,
  };
}

function exactFailure(left: StepFailure, right: StepFailure): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Reproduces the frozen `/2 browser -> /4 score` failure projection without creating a current
 * result, trusting deserialized finalizer output, or exposing a publication-verifier shape.
 */
export function projectLegacyRealBuildCompletionFailuresV4(input: {
  readonly output: FrozenLegacyBrowserOutputV2 & { readonly status: "executed" };
  readonly options: RealBuildOptions;
  readonly diagnosticDocument: BrickDocumentV1;
}): readonly StepFailure[] {
  const reports = input.output.reports as unknown as readonly RealBuildStepReport[];
  const reproductionDefect = legacyReproductionDefect(input.output, reports, input.options);
  const prefix: RealBuildStepReport[] = [];
  for (const report of reports) {
    if (!isFrozenLegacyAtomicStepComplete(report)) break;
    prefix.push(report);
  }
  if (reproductionDefect === null && prefix.length !== reports.length) {
    throw new TypeError(
      "Legacy score /4 has a non-complete report without the reproduction refusal its frozen finalizer required.",
    );
  }
  const lastStep = prefix.at(-1)?.stepNumber ?? 0;
  if (lastStep < 1) {
    throw new TypeError(
      "Legacy artifact-manifest /3 diagnostic inspection requires a non-empty atomic-complete prefix.",
    );
  }
  const panels = input.options.panels
    .filter(({ stepNumber }) => stepNumber <= lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  if (panels.length !== prefix.length) {
    throw new TypeError(
      "Legacy diagnostic reports do not align one-for-one with their frozen prepared panel prefix.",
    );
  }
  assertFrozenLegacyReportProjectionV2({
    reports: prefix,
    panels,
    document: input.diagnosticDocument,
  });
  assertFrozenLegacyDocumentProjectionV2({
    document: input.diagnosticDocument,
    reports: prefix,
    expectedStructuralHash: prefix.at(-1)!.validation.targetDocumentHash!,
  });
  const frameMismatches = assertFrozenLegacyIdentityProjectionV2({
    panels,
    reports: prefix,
    document: input.diagnosticDocument,
    bindings: input.output.identityBindings.filter(({ stepNumber }) => stepNumber <= lastStep),
  });
  const failures: StepFailure[] =
    reproductionDefect === null ? [] : [completionFailure(reproductionDefect)];
  for (const panel of panels) {
    if (panel.action.assembledPieces > 0) {
      failures.push(frozenVisualEvidenceFailure(panel.stepNumber));
    }
  }
  const frameFailure = frozenFrameFailure(frameMismatches);
  if (frameFailure !== null) failures.push(frameFailure);
  if (
    failures.some((failure, index) =>
      failures.some((other, otherIndex) => otherIndex < index && exactFailure(failure, other)),
    )
  ) {
    throw new TypeError("Legacy frozen completion projection produced duplicate failure rows.");
  }
  return failures;
}
