import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import type { RealBuildBrowserBranchDetailedStepInspection } from "./real-build-browser-output-v4-semantic";
import {
  requireRealBuildPreparedPanelResolvedPrerequisites,
  type RealBuildPreparedPanelInspection,
} from "./real-build-prepared-step-authority";
import type {
  RealBuildStepReport,
  StepFailure,
  SuccessfulStepMechanism,
} from "./real-build-safety";
import type { RealBuildBrowserOutputV4PlacementAdvance } from "./real-build-browser-output-v4-reader-frontier";
import type { RealBuildBrowserOutputV4TransitionEvidenceRow } from "./real-build-browser-output-v4-transition-frontier";

type TerminalAdvance = Extract<RealBuildBrowserOutputV4PlacementAdvance, { status: "terminal" }>;

function terminalInputKey(
  step: RealBuildBrowserBranchDetailedStepInspection,
  reason: TerminalAdvance["reason"],
): string {
  return `browser-output-v4-terminal:${canonicalDigest({
    schemaVersion: "lego.real-build-browser-output-v4-terminal-report-binding/1",
    stepNumber: step.stepNumber,
    reason,
    compiledLineageBytesDigest: step.lineageInspection.compiledLineageBytesDigest,
    observationClosureDigest: step.index.observationClosure?.digest ?? null,
    observationRoleDigest: step.index.observations?.digest ?? null,
  })}`;
}

export function deriveRealBuildBrowserOutputV4TerminalPlacementFailure(
  step: RealBuildBrowserBranchDetailedStepInspection,
  terminal: TerminalAdvance,
): Readonly<{ failure: StepFailure; attemptedMechanism: SuccessfulStepMechanism | null }> {
  const lineage = step.lineageInspection.evidence;
  const inputKey = terminalInputKey(step, terminal.reason);
  if (terminal.reason === "failed") {
    const retained = lineage.terminalFailure;
    if (lineage.status !== "failed" || retained === null || step.observation !== null) {
      throw new TypeError(
        `Browser output /4 terminal step ${step.stepNumber} lacks typed failure evidence.`,
      );
    }
    return {
      failure: {
        code: "run-incomplete",
        stage: retained.phase === "compilation" ? "placement" : "replay",
        stepNumber: step.stepNumber,
        inputKey,
        message:
          `Compiled branch step ${step.stepNumber} failed with ${retained.code} during ${retained.phase}: ` +
          `${retained.issue.code} at ${retained.issue.path}: ${retained.issue.reason} ` +
          `The retained failure identity is ${retained.failureDigest}; repair that exact proposal or evidence closure before retrying.`,
      },
      attemptedMechanism: "compiled-observation",
    };
  }
  if (terminal.reason === "budget-refused") {
    const reservation = lineage.searchReservation;
    const frozen = reservation.terminalFailure;
    if (
      lineage.status !== "budget-refused" ||
      reservation.admitted ||
      reservation.refusal === null ||
      frozen === null ||
      step.observation !== null
    ) {
      throw new TypeError(
        `Browser output /4 terminal step ${step.stepNumber} lacks exact refused reservation evidence.`,
      );
    }
    return {
      failure: {
        code: "resource-budget-exhausted",
        stage: "budget",
        stepNumber: step.stepNumber,
        inputKey,
        message:
          `Compiled branch step ${step.stepNumber} was not admitted: ${reservation.refusal} at reservation ` +
          `${reservation.reservationNumber}, with ${reservation.reservedBefore} reserved + ${reservation.requested} ` +
          `requested over budget ${reservation.budget}. The frozen preflight identity is ${frozen.preflightIdentity}; ` +
          `raise the explicit branch budget or reduce the exact proposal set.`,
      },
      attemptedMechanism: null,
    };
  }
  const observation = step.observation;
  if (lineage.status !== "unresolved") {
    throw new TypeError(
      `Browser output /4 terminal step ${step.stepNumber} reason ${terminal.reason} requires unresolved compiled lineage evidence.`,
    );
  }
  if (terminal.reason === "closure-absent") {
    if (observation !== null || step.closure !== null) {
      throw new TypeError(
        `Browser output /4 terminal step ${step.stepNumber} claims an absent closure but retains one.`,
      );
    }
    return {
      failure: {
        code: "visual-evidence-unverified",
        stage: "evidence",
        stepNumber: step.stepNumber,
        inputKey,
        message: `Compiled branch step ${step.stepNumber} retains an exact unresolved frontier but no observation closure; supply a digest-bound closure and raw role before selecting a child.`,
      },
      attemptedMechanism: "compiled-observation",
    };
  }
  if (observation === null || observation.closure.selection.status !== terminal.reason) {
    throw new TypeError(
      `Browser output /4 terminal step ${step.stepNumber} does not reproduce ${terminal.reason} observation selection.`,
    );
  }
  const selection = observation.closure.selection;
  const failureCount = observation.failedObservationIds.length;
  if (
    (terminal.reason === "unresolved" && failureCount !== 0) ||
    (terminal.reason === "unverified-failure" && failureCount === 0)
  ) {
    throw new TypeError(
      `Browser output /4 terminal step ${step.stepNumber} has ${failureCount} failed observations inconsistent with ${terminal.reason}.`,
    );
  }
  return {
    failure: {
      code: "visual-evidence-unverified",
      stage: "evidence",
      stepNumber: step.stepNumber,
      inputKey,
      message:
        terminal.reason === "unverified-failure"
          ? `Compiled branch step ${step.stepNumber} retained ${failureCount} unverified failed observation row(s); no raw failure claim can select a child.`
          : `Compiled branch step ${step.stepNumber} remained unresolved with best score ${String(selection.bestScore)}, runner-up ${String(selection.runnerUpScore)}, and margin ${String(selection.margin)}; the verified closure selected no child.`,
    },
    attemptedMechanism: "compiled-observation",
  };
}

export function deriveRealBuildBrowserOutputV4MissingRoleFailure(
  panel: RealBuildPreparedPanelInspection,
): StepFailure {
  requireRealBuildPreparedPanelResolvedPrerequisites(panel);
  const inputKey = `browser-output-v4-missing-role:${canonicalDigest({
    schemaVersion: "lego.real-build-browser-output-v4-missing-role-binding/1",
    preparedPanelIdentity: panel.preparedPanelIdentity,
    actionKind: panel.actionKind,
  })}`;
  if (panel.actionKind === "transition") {
    return {
      code: "transition-evidence-missing",
      stage: "evidence",
      stepNumber: panel.stepNumber,
      inputKey,
      message: `Printed transition step ${panel.stepNumber} has no exact transition evidence row; retain and replay its zero-piece BuildStep before advancing.`,
    };
  }
  if (panel.actionKind !== "place-callouts") {
    return {
      code: "fixed-ledger-frame-unresolved",
      stage: "validation",
      stepNumber: panel.stepNumber,
      inputKey,
      message: `Printed fixed-action step ${panel.stepNumber} has no deterministic physical-frame replay role; completion is refused until that exact action is independently reproduced.`,
    };
  }
  return {
    code: "visual-evidence-unverified",
    stage: "evidence",
    stepNumber: panel.stepNumber,
    inputKey,
    message: `Printed placement step ${panel.stepNumber} has no exact compiled branch evidence row; retain the compiled lineage and verified observation closure before selecting a child.`,
  };
}

export function realBuildBrowserOutputV4HasCleanPrerequisites(
  report: RealBuildStepReport,
): boolean {
  return (
    canonicalStringify(report.prerequisites) ===
    canonicalStringify({
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: report.calloutPieces,
      expectedAssembledPieces: report.expectedAssembledPieces,
      resolvedPieces: report.expectedAssembledPieces,
      localFailure: null,
    })
  );
}

function neutralLegacyFields(report: RealBuildStepReport, failure: string | null): boolean {
  return (
    canonicalStringify(report.fit) ===
      canonicalStringify({
        azimuthDegrees: null,
        elevationDegrees: null,
        pixelsPerUnit: null,
        residualPx: null,
        coherence: 0,
        failure,
      }) &&
    report.camera === null &&
    canonicalStringify(report.highlight) ===
      canonicalStringify({ regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null }) &&
    canonicalStringify(report.arrows) ===
      canonicalStringify({
        kept: 0,
        redPx: 0,
        rejected: 0,
        displacementFamily: 0,
        displacementFamilyLdu: [],
      }) &&
    report.pieces.length === 0 &&
    report.jointVisual === null &&
    report.deferral === null &&
    report.farther === null &&
    report.fartherCaptures.length === 0 &&
    report.explodedGhost === null &&
    report.panelPng === null &&
    report.buildPng === null
  );
}

export function requireRealBuildBrowserOutputV4FailedReport(
  report: RealBuildStepReport,
  currentDocumentParts: number,
  expected: Readonly<{
    failure: StepFailure;
    attemptedMechanism: SuccessfulStepMechanism | null;
  }>,
): void {
  const expectedOutcome = {
    status: "failed" as const,
    mechanism: "deferred" as const,
    attemptedMechanism: expected.attemptedMechanism,
    failure: expected.failure,
  };
  const expectedValidation = {
    attempted: false,
    targetDocumentHash: null,
    truthSnapshotHash: null,
    validatorSetHash: null,
    documentGloballyValid: null,
    blockingIssues: [],
    failure: expected.failure.message,
  };
  if (
    canonicalStringify(report.outcome) !== canonicalStringify(expectedOutcome) ||
    report.attemptedPieces !== 0 ||
    report.placedPieces !== 0 ||
    report.canonicalStepId !== null ||
    report.documentParts !== currentDocumentParts ||
    canonicalStringify(report.validation) !== canonicalStringify(expectedValidation) ||
    !realBuildBrowserOutputV4HasCleanPrerequisites(report) ||
    !neutralLegacyFields(report, expected.failure.message)
  ) {
    throw new TypeError(
      `Browser output /4 failed step ${report.stepNumber} does not equal its exact evidence-bound failure projection and unchanged frontier.`,
    );
  }
}

export function requireRealBuildBrowserOutputV4TransitionReport(
  report: RealBuildStepReport,
  row: RealBuildBrowserOutputV4TransitionEvidenceRow,
): void {
  if (
    report.stepNumber !== row.stepNumber ||
    report.pageNumber !== row.pageNumber ||
    report.panelFace === null ||
    report.calloutPieces !== 0 ||
    report.expectedAssembledPieces !== 0 ||
    report.attemptedPieces !== 0 ||
    report.placedPieces !== 0 ||
    report.actionEvidenceDigest !== row.actionEvidenceDigest ||
    report.canonicalStepId !== row.canonicalStepId ||
    report.documentParts !== row.documentParts ||
    canonicalStringify(report.action) !== canonicalStringify(row.action) ||
    canonicalStringify(report.outcome) !== canonicalStringify(row.outcome) ||
    canonicalStringify(report.validation) !== canonicalStringify(row.validation) ||
    !realBuildBrowserOutputV4HasCleanPrerequisites(report) ||
    !neutralLegacyFields(report, null)
  ) {
    throw new TypeError(
      `Browser output /4 transition report ${report.stepNumber} does not equal its exact replay row and neutral non-placement projection.`,
    );
  }
}
