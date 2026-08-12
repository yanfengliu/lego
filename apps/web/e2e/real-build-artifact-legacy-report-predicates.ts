import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPanelSpec, RealBuildStepReport, StepFailure } from "./real-build-safety";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const exact = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const exactTransform = (
  actual: { readonly positionLdu: readonly number[]; readonly orientationId: string },
  expected: { readonly positionLdu: readonly number[]; readonly orientationId: string },
): boolean =>
  actual.orientationId === expected.orientationId &&
  actual.positionLdu.length === 3 &&
  actual.positionLdu.every((coordinate, axis) => coordinate === expected.positionLdu[axis]);

export function isFrozenLegacyAtomicStepComplete(report: RealBuildStepReport): boolean {
  return (
    report.outcome.status === "complete" &&
    report.placedPieces === report.expectedAssembledPieces &&
    report.canonicalStepId !== null &&
    report.actionEvidenceDigest !== null &&
    SHA256_PATTERN.test(report.actionEvidenceDigest)
  );
}

function frozenPrerequisites(panel: RealBuildPanelSpec) {
  const resolvedPieces =
    panel.action.kind === "multi-build-copy"
      ? panel.action.copies.length
      : panel.pieces.length + panel.omittedPieces.length;
  let localFailure: StepFailure | null = null;
  if (panel.coverageFailures.length > 0) {
    localFailure = panel.coverageFailures[0]!;
  } else if (panel.unresolvedCallouts.length > 0) {
    localFailure = {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${panel.stepNumber} has unresolved callout evidence: ` +
        `${panel.unresolvedCallouts.join(", ")}. No catalog lookup or placement was attempted because an ` +
        `unidentified drawing is not evidence for a specific part.`,
    };
  } else if (panel.missingDesigns.length > 0) {
    localFailure = {
      code: "missing-catalog-part",
      stage: "catalog",
      message:
        `Step ${panel.stepNumber} places ${panel.calloutPieces} piece(s), but the catalog has no part for ` +
        `${panel.missingDesigns.join(", ")}. Nothing was placed or substituted; a different shape would make ` +
        `the reconstruction structurally false.`,
    };
  } else if (resolvedPieces === 0 && panel.action.kind !== "transition") {
    localFailure = {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${panel.stepNumber} has unresolved callout evidence: no printed callout was resolved. No catalog ` +
        `lookup or placement was attempted because an unidentified drawing is not evidence for a specific part.`,
    };
  } else if (resolvedPieces !== panel.action.assembledPieces) {
    localFailure = {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${panel.stepNumber} requires ${panel.action.assembledPieces} assembled piece(s) after semantic and ` +
        `omitted-piece classification, but only ${resolvedPieces} were resolved to catalog parts. A partial ` +
        `callout cannot pass as a complete printed step.`,
    };
  }
  return {
    blockingStep: null,
    coverageFailures: panel.coverageFailures,
    unresolvedCallouts: panel.unresolvedCallouts,
    missingDesigns: panel.missingDesigns,
    calloutPieces: panel.calloutPieces,
    expectedAssembledPieces: panel.action.assembledPieces,
    resolvedPieces,
    localFailure,
  };
}

function expectedPieces(panel: RealBuildPanelSpec) {
  if (panel.action.kind === "transition") return [];
  if (panel.action.kind === "multi-build-copy") {
    return panel.action.copies.map((piece) => ({
      catalogPartId: piece.catalogPartId,
      fixedTransform: piece.transform,
    }));
  }
  return [
    ...panel.pieces.map((piece) => ({ catalogPartId: piece.catalogPartId, fixedTransform: null })),
    ...panel.omittedPieces.map((piece) => ({
      catalogPartId: piece.catalogPartId,
      fixedTransform: piece.transform,
    })),
  ];
}

function expectedStepName(panel: RealBuildPanelSpec): string {
  return panel.action.kind === "transition"
    ? `Step ${panel.stepNumber} [transition:${panel.action.transition};` +
        `panel=${panel.action.panelEvidenceDigest}]`
    : `Step ${panel.stepNumber}`;
}

function expectedMechanisms(panel: RealBuildPanelSpec): readonly string[] {
  if (panel.action.kind === "transition") return ["instruction-transition"];
  if (panel.action.kind === "multi-build-copy" || panel.pieces.length === 0) {
    return ["official-ledger"];
  }
  return [
    "anchor-orientation",
    "highlight",
    "arrow",
    "exhaustive",
    "deferred-lookahead",
    "exploded-ghost",
  ];
}

function reportDefect(input: {
  readonly report: RealBuildStepReport;
  readonly panel: RealBuildPanelSpec;
  readonly step: BrickDocumentV1["steps"][number] | undefined;
  readonly cumulativeParts: number;
}): string | null {
  const { report, panel, step } = input;
  const prerequisites = frozenPrerequisites(panel);
  if (
    report.stepNumber !== panel.stepNumber ||
    report.pageNumber !== panel.pageNumber ||
    report.panelFace !== panel.panelFace ||
    !exact(report.prerequisites, prerequisites) ||
    prerequisites.localFailure !== null ||
    report.calloutPieces !== panel.calloutPieces ||
    report.attemptedPieces !== prerequisites.resolvedPieces
  ) {
    return "panel alignment, prerequisites, callout count, or attempted count differs";
  }
  const pieces = expectedPieces(panel);
  if (
    report.pieces.length !== pieces.length ||
    pieces.some((expected, index) => {
      const observed = report.pieces[index];
      return (
        observed === undefined ||
        observed.catalogPartId !== expected.catalogPartId ||
        observed.placed !== true ||
        observed.failure !== null ||
        typeof observed.orientationId !== "string" ||
        observed.positionLdu === null ||
        !SHA256_PATTERN.test(observed.blind.comparisonPrefixHash) ||
        (expected.fixedTransform !== null &&
          !exactTransform(observed as never, expected.fixedTransform))
      );
    })
  ) {
    return "piece identities, placement success, fixed transforms, or comparison digests differ";
  }
  if (
    !isFrozenLegacyAtomicStepComplete(report) ||
    !expectedMechanisms(panel).includes(report.outcome.mechanism) ||
    report.expectedAssembledPieces !== panel.action.assembledPieces ||
    report.placedPieces !== panel.action.assembledPieces ||
    report.actionEvidenceDigest !== panel.action.evidenceDigest ||
    !exact(report.action, panel.action)
  ) {
    return "atomic outcome, mechanism, expected count, placed count, action, or action digest differs";
  }
  if (
    step === undefined ||
    report.canonicalStepId !== step.id ||
    step.index !== panel.stepNumber - 1 ||
    step.name !== expectedStepName(panel) ||
    step.partIds.length !== panel.action.assembledPieces ||
    report.documentParts !== input.cumulativeParts
  ) {
    return "canonical step ownership, naming, or cumulative part count differs";
  }
  if (
    !Number.isFinite(report.elapsedMs) ||
    report.elapsedMs < 0 ||
    report.validation.attempted !== true ||
    report.validation.failure !== null ||
    report.validation.documentGloballyValid !== true ||
    report.validation.blockingIssues.length !== 0 ||
    report.validation.targetDocumentHash === null ||
    !SHA256_PATTERN.test(report.validation.targetDocumentHash) ||
    report.validation.truthSnapshotHash === null ||
    !SHA256_PATTERN.test(report.validation.truthSnapshotHash) ||
    report.validation.validatorSetHash === null ||
    !SHA256_PATTERN.test(report.validation.validatorSetHash)
  ) {
    return "elapsed time or validation success differs";
  }
  if (report.farther?.decision !== null && report.farther?.decision !== undefined) {
    const selected = report.farther.origin.candidates.find(
      ({ candidateId }) => candidateId === report.farther!.decision!.originCandidateId,
    );
    if (selected === undefined || report.validation.targetDocumentHash !== selected.documentHash) {
      return "farther decision does not bind its selected immutable origin document hash";
    }
  }
  return null;
}

/** Frozen generation-2 success predicates; no current finalizer code executes here. */
export function assertFrozenLegacyReportProjectionV2(input: {
  readonly reports: readonly RealBuildStepReport[];
  readonly panels: readonly RealBuildPanelSpec[];
  readonly document: BrickDocumentV1;
}): void {
  const stepIds = new Set(input.document.steps.map(({ id }) => id));
  const stepIndexes = new Set(input.document.steps.map(({ index }) => index));
  if (
    input.reports.length !== input.panels.length ||
    input.document.steps.length !== input.panels.length ||
    stepIds.size !== input.document.steps.length ||
    stepIndexes.size !== input.document.steps.length
  ) {
    throw new TypeError(
      "Legacy reports, panels, and document steps are not an exact one-for-one prefix.",
    );
  }
  let cumulativeParts = 0;
  for (const [index, panel] of input.panels.entries()) {
    const step = input.document.steps.find(({ index: stepIndex }) => stepIndex === index);
    cumulativeParts += step?.partIds.length ?? 0;
    const defect = reportDefect({
      report: input.reports[index]!,
      panel,
      step,
      cumulativeParts,
    });
    if (defect !== null) {
      throw new TypeError(
        `Legacy report ${panel.stepNumber} fails its frozen /2 predicate: ${defect}.`,
      );
    }
  }
}
