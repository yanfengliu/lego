import { createHash } from "node:crypto";

import { deriveMeasuredFartherOriginSourceAttestation } from "./real-build-farther-origin-source-attestation";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import {
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  type LegacyRealBuildRunContractV3,
  verifyRealBuildExecutionSourceBindings,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";
import { hasValidCurrentRunBudgets } from "./real-build-run-contract-budget-schema";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** Exact historical generation-3 panel projection. It deliberately includes every panel. */
function normalizedPanelsV3(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    bounds: [panel.minXPt, panel.maxXPt, panel.minYPt, panel.maxYPt],
    calloutBoxes: panel.calloutBoxes,
    mappedCalloutKeys: panel.mappedCalloutKeys,
    calloutPieces: panel.calloutPieces,
    classifiedPhysicalCalloutPieces: panel.classifiedPhysicalCalloutPieces,
    semanticMultiplierQuantity: panel.semanticMultiplierQuantity,
    omittedPhysicalPieces: panel.omittedPhysicalPieces,
  }));
}

/** Exact historical generation-3 action projection. It deliberately includes every panel. */
function normalizedActionsV3(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    panelFace: panel.panelFace,
    action: panel.action,
    directIdentities: panel.pieces.map(
      ({
        identityKey,
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence,
        cropDigest,
        identificationInputDigest,
        expectedTransform,
      }) => ({
        identityKey,
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence,
        cropDigest,
        identificationInputDigest,
        expectedTransform,
      }),
    ),
    omittedIdentities: panel.omittedPieces,
  }));
}

function legacyBudgetsV3(options: RealBuildOptions): Readonly<Record<string, number>> {
  return {
    lastStep: options.lastStep,
    expectedPrintedSteps: options.expectedPrintedSteps,
    maxParts: options.maxParts,
    targetPartCount: options.targetPartCount,
    maxRendersPerPiece: options.maxRendersPerPiece,
    blindRenderBudget: options.blindRenderBudget,
    deferredCandidateBudget: options.deferredCandidateBudget,
    panelCameraBranchBudget: options.panelCameraBranchBudget,
    explodedGhostRenderBudget: options.explodedGhostRenderBudget,
    deferredNarrowingRenderBudget: options.deferredNarrowingRenderBudget,
    fartherPanelMaximumReachSteps: options.fartherPanelMaximumReachSteps,
    fartherPanelRenderBudget: options.fartherPanelRenderBudget,
  };
}

function legacyThresholdsV3(
  options: RealBuildOptions,
): Readonly<Record<string, number | string | null>> {
  return {
    minimumScoreMargin: options.minimumScoreMargin,
    minimumDeferredAgreementMargin: options.minimumDeferredAgreementMargin,
    minimumDeferredAgreement: options.minimumDeferredAgreement,
    minimumWholeStepScore: options.minimumWholeStepScore,
    minimumExclusiveHighlightPixelsPerPiece: options.minimumExclusiveHighlightPixelsPerPiece,
    highlightCalibrationDigest: options.highlightCalibrationDigest,
    proximityMarginPx: options.proximityMarginPx,
    renderScale: options.renderScale,
    panelWidth: options.panelWidth,
    workFactor: options.workFactor,
  };
}

/**
 * Inspects retained generation-3 options against their exact pre-prefix contract.
 * It never upgrades them or authorizes current execution/publication.
 */
export function verifyLegacyRealBuildRunContractV3(input: {
  readonly contract: LegacyRealBuildRunContractV3;
  readonly options: RealBuildOptions;
  readonly roleDigests: Readonly<Record<string, string>>;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
}): void {
  const budgets = legacyBudgetsV3(input.options);
  if (!hasValidCurrentRunBudgets(budgets)) {
    throw new TypeError(
      "Retained run-contract /3 prepared options do not reproduce the exact bounded generation-3 budget shape.",
    );
  }
  verifyRealBuildRunContractRoleDigests(input.contract, input.roleDigests);
  verifyRealBuildExecutionSourceBindings({
    sourceFiles: input.sourceFiles,
    pdfDigest: input.roleDigests.pdf!,
  });
  for (const [inputKey, role] of Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST)) {
    if (
      input.options.inputDigests[inputKey as keyof typeof input.options.inputDigests] !==
      input.roleDigests[role]
    ) {
      throw new TypeError(
        `Legacy prepared options ${inputKey} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  const codeSnapshots = Object.fromEntries(
    input.sourceFiles
      .map(({ path, digest }) => [path, digest] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  if (input.options.measuredFartherOriginSourceAttestation != null) {
    const contractAttestation = deriveMeasuredFartherOriginSourceAttestation(
      input.contract.codeSnapshots,
    );
    const retainedSourceAttestation = deriveMeasuredFartherOriginSourceAttestation(codeSnapshots);
    if (
      JSON.stringify(input.options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(contractAttestation) ||
      JSON.stringify(input.options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(retainedSourceAttestation)
    ) {
      throw new TypeError(
        "Legacy prepared farther-origin source attestation does not reproduce from both " +
          "run-contract /3 snapshots and retained source bytes.",
      );
    }
  }
  const actionLedger = normalizedActionsV3(input.options.panels);
  const base = {
    schemaVersion: "lego.real-build-run-contract/3" as const,
    inputDigests: input.options.inputDigests,
    identificationClosure: input.contract.identificationClosure,
    normalizedPanelsDigest: sha256(JSON.stringify(normalizedPanelsV3(input.options.panels))),
    actionLedger,
    actionLedgerDigest: sha256(JSON.stringify(actionLedger)),
    budgets,
    thresholds: legacyThresholdsV3(input.options),
    policy: {
      searchDisagreement: "refuse" as const,
      partialStep: "rollback" as const,
      unboundIdentity: "refuse" as const,
    },
    codeSnapshots,
  };
  const reproduced = { ...base, contractDigest: sha256(JSON.stringify(base)) };
  if (JSON.stringify(reproduced) !== JSON.stringify(input.contract)) {
    throw new TypeError(
      "Retained generation-3 options do not exactly reproduce their historical all-panel raw-input/source-bound run contract.",
    );
  }
}
