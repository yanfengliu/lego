import { createHash } from "node:crypto";

import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import { deriveLegacyMeasuredFartherOriginSourceAttestationV2 } from "./real-build-farther-origin-source-attestation-legacy-v2";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import {
  LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2,
  hasValidLegacyRunBudgetsV2,
} from "./real-build-run-contract-budget-schema";
import {
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  type LegacyRealBuildRunContractV2,
  verifyRealBuildExecutionSourceBindings,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";

type LegacyRealBuildOptionsV2 = Omit<RealBuildOptions, "panelCameraBranchBudget">;

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Exact historical generation-2 projection. Do not add current fields here. */
function normalizedPanelsV2(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    bounds: [panel.minXPt, panel.maxXPt, panel.minYPt, panel.maxYPt],
    calloutBoxes: panel.calloutBoxes,
    mappedCalloutKeys: panel.mappedCalloutKeys,
    calloutPieces: panel.calloutPieces,
    classifiedPhysicalCalloutPieces: panel.classifiedPhysicalCalloutPieces,
    semanticMultiplierQuantity: panel.semanticMultiplierQuantity,
    omittedPhysicalPieces: panel.omittedPhysicalPieces,
  }));
}

/** Exact historical generation-2 action projection. Do not bind panelFace retroactively. */
function normalizedActionsV2(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
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

function legacyBudgets(options: LegacyRealBuildOptionsV2): Readonly<Record<string, number>> {
  return Object.fromEntries(LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2.map((key) => [key, options[key]]));
}

function legacyThresholds(
  options: LegacyRealBuildOptionsV2,
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
 * Inspects retained generation-2 options against their exact historical contract.
 * It never upgrades them or authorizes current execution/publication.
 */
export function verifyLegacyRealBuildRunContractV2(input: {
  readonly contract: LegacyRealBuildRunContractV2;
  readonly options: unknown;
  readonly roleDigests: Readonly<Record<string, string>>;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
}): void {
  if (!isRecord(input.options) || "panelCameraBranchBudget" in input.options) {
    throw new TypeError(
      "Retained run-contract /2 requires its exact legacy prepared-options shape without panelCameraBranchBudget; current options cannot be relabeled as generation 2.",
    );
  }
  const options = input.options as unknown as LegacyRealBuildOptionsV2;
  if (!Array.isArray(options.panels) || !isRecord(options.inputDigests)) {
    throw new TypeError(
      "Retained run-contract /2 prepared options must contain panel rows and input digests before historical inspection can reproduce them.",
    );
  }
  const budgets = legacyBudgets(options);
  if (!hasValidLegacyRunBudgetsV2(budgets)) {
    throw new TypeError(
      "Retained run-contract /2 prepared options do not reproduce the exact bounded generation-2 budget shape.",
    );
  }
  verifyRealBuildRunContractRoleDigests(input.contract, input.roleDigests);
  verifyRealBuildExecutionSourceBindings({
    sourceFiles: input.sourceFiles,
    pdfDigest: input.roleDigests.pdf!,
  });
  for (const [inputKey, role] of Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST)) {
    if (
      options.inputDigests[inputKey as keyof typeof options.inputDigests] !==
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
  if (options.measuredFartherOriginSourceAttestation != null) {
    const contractAttestation = deriveLegacyMeasuredFartherOriginSourceAttestationV2(
      input.contract.codeSnapshots,
    );
    const retainedSourceAttestation =
      deriveLegacyMeasuredFartherOriginSourceAttestationV2(codeSnapshots);
    if (
      JSON.stringify(options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(contractAttestation) ||
      JSON.stringify(options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(retainedSourceAttestation)
    ) {
      throw new TypeError(
        "Legacy prepared farther-origin source attestation does not reproduce from both run-contract /2 snapshots and retained source bytes.",
      );
    }
  }
  const actionLedger = normalizedActionsV2(options.panels);
  const base = {
    schemaVersion: "lego.real-build-run-contract/2" as const,
    inputDigests: options.inputDigests,
    identificationClosure: input.contract.identificationClosure,
    normalizedPanelsDigest: sha256(JSON.stringify(normalizedPanelsV2(options.panels))),
    actionLedger,
    actionLedgerDigest: sha256(JSON.stringify(actionLedger)),
    budgets,
    thresholds: legacyThresholds(options),
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
      "Retained generation-2 options do not exactly reproduce their historical raw-input/source-bound run contract.",
    );
  }
}
