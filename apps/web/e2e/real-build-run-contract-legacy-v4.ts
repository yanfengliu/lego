import { createHash } from "node:crypto";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import { deriveMeasuredFartherOriginSourceAttestation } from "./real-build-farther-origin-source-attestation";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import {
  assertRealBuildRetainedActionPrefix,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_PANEL_SOURCE_ROLE,
  realBuildRunBudgets,
  realBuildRunThresholds,
  selectRealBuildExecutablePanels,
  type LegacyRealBuildRunContractV4,
  verifyRealBuildExecutionSourceBindings,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";
import { hasValidCurrentRunBudgets } from "./real-build-run-contract-budget-schema";
import type {
  RealBuildOptions,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
} from "./real-build-safety";

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function normalizedPanels(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
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

function normalizedPassivePanels(panels: readonly RealBuildPanelRasterSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    bounds: [panel.minXPt, panel.maxXPt, panel.minYPt, panel.maxYPt],
    calloutBoxes: panel.calloutBoxes,
  }));
}

function normalizedActions(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
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

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

/** Inspects retained generation-4 prefix bytes without upgrading them to rebound authority. */
export function verifyLegacyRealBuildRunContractV4(input: {
  readonly contract: LegacyRealBuildRunContractV4;
  readonly options: RealBuildOptions;
  readonly roleDigests: Readonly<Record<string, string>>;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
}): void {
  const budgets = realBuildRunBudgets(input.options);
  if (!hasValidCurrentRunBudgets(budgets)) {
    throw new TypeError(
      "Retained run-contract /4 prepared options do not reproduce the exact bounded generation-4 budget shape.",
    );
  }
  assertRealBuildRetainedActionPrefix({ contract: input.contract, options: input.options });
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
        "Legacy prepared farther-origin source attestation does not reproduce from both run-contract /4 codeSnapshots and the exact retained source bundle.",
      );
    }
  }
  const executablePanels = selectRealBuildExecutablePanels(
    input.options.panels,
    input.options.lastStep,
  );
  const actionLedger = canonicalClone(normalizedActions(executablePanels));
  const base = canonicalClone({
    schemaVersion: "lego.real-build-run-contract/4" as const,
    inputDigests: input.options.inputDigests,
    identificationClosure: input.contract.identificationClosure,
    panelSourceDigest: input.roleDigests[REAL_BUILD_PANEL_SOURCE_ROLE]!,
    normalizedPanelsDigest: sha256(canonicalStringify(normalizedPanels(executablePanels))),
    normalizedPassivePanelsDigest: sha256(
      canonicalStringify(normalizedPassivePanels(input.options.passivePanels)),
    ),
    actionLedger,
    actionLedgerDigest: sha256(canonicalStringify(actionLedger)),
    budgets,
    thresholds: realBuildRunThresholds(input.options),
    policy: {
      searchDisagreement: "refuse" as const,
      partialStep: "rollback" as const,
      unboundIdentity: "refuse" as const,
    },
    codeSnapshots,
  });
  const reproduced = { ...base, contractDigest: sha256(canonicalStringify(base)) };
  if (canonicalStringify(reproduced) !== canonicalStringify(input.contract)) {
    throw new TypeError(
      "Retained generation-4 options do not exactly reproduce their historical bounded-prefix raw-input/source-bound run contract.",
    );
  }
}
