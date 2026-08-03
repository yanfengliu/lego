import { createHash } from "node:crypto";

import type {
  RealBuildInputDigests,
  RealBuildOptions,
  RealBuildPanelSpec,
} from "./real-build-safety";

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const REAL_BUILD_INPUT_ROLE_BY_DIGEST = {
  pdf: "pdf",
  calloutManifest: "callout-manifest",
  coverage: "coverage",
  officialModel: "official-model",
  actionLedger: "action-ledger",
  highlightCalibration: "highlight-calibration",
  builderCalibration: "builder-calibration",
  builderGeometry: "builder-geometry",
  transitionClassifications: "transition-classifications",
} as const satisfies Readonly<Record<keyof RealBuildInputDigests, string>>;

export interface RealBuildRunContract {
  readonly schemaVersion: "lego.real-build-run-contract/1";
  readonly inputDigests: RealBuildInputDigests;
  readonly normalizedPanelsDigest: string;
  readonly actionLedger: readonly unknown[];
  readonly actionLedgerDigest: string;
  readonly budgets: Readonly<Record<string, number>>;
  readonly thresholds: Readonly<Record<string, number | string | null>>;
  readonly policy: {
    readonly searchDisagreement: "refuse";
    readonly partialStep: "rollback";
    readonly unboundIdentity: "refuse";
  };
  readonly codeSnapshots: Readonly<Record<string, string>>;
  readonly contractDigest: string;
}

function normalizedPanels(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
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

function normalizedActions(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
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

export function realBuildRunBudgets(options: RealBuildOptions): Readonly<Record<string, number>> {
  return {
    lastStep: options.lastStep,
    expectedPrintedSteps: options.expectedPrintedSteps,
    maxParts: options.maxParts,
    targetPartCount: options.targetPartCount,
    maxRendersPerPiece: options.maxRendersPerPiece,
    blindRenderBudget: options.blindRenderBudget,
  };
}

export function realBuildRunThresholds(
  options: RealBuildOptions,
): Readonly<Record<string, number | string | null>> {
  return {
    minimumScoreMargin: options.minimumScoreMargin,
    minimumWholeStepScore: options.minimumWholeStepScore,
    minimumExclusiveHighlightPixelsPerPiece: options.minimumExclusiveHighlightPixelsPerPiece,
    highlightCalibrationDigest: options.highlightCalibrationDigest,
    proximityMarginPx: options.proximityMarginPx,
    renderScale: options.renderScale,
    panelWidth: options.panelWidth,
    workFactor: options.workFactor,
  };
}

export function createRealBuildRunContract(input: {
  readonly inputDigests: RealBuildInputDigests;
  readonly panels: readonly RealBuildPanelSpec[];
  readonly budgets: Readonly<Record<string, number>>;
  readonly thresholds: Readonly<Record<string, number | string | null>>;
  readonly codeSnapshots: Readonly<Record<string, string>>;
}): RealBuildRunContract {
  const actionLedger = normalizedActions(input.panels);
  const base = {
    schemaVersion: "lego.real-build-run-contract/1" as const,
    inputDigests: input.inputDigests,
    normalizedPanelsDigest: sha256(JSON.stringify(normalizedPanels(input.panels))),
    actionLedger,
    actionLedgerDigest: sha256(JSON.stringify(actionLedger)),
    budgets: input.budgets,
    thresholds: input.thresholds,
    policy: {
      searchDisagreement: "refuse" as const,
      partialStep: "rollback" as const,
      unboundIdentity: "refuse" as const,
    },
    codeSnapshots: input.codeSnapshots,
  };
  return { ...base, contractDigest: sha256(JSON.stringify(base)) };
}

export function parseRealBuildRunContract(bytes: Uint8Array): RealBuildRunContract {
  let parsed: RealBuildRunContract;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf8", { fatal: true }).decode(bytes),
    ) as RealBuildRunContract;
  } catch (error) {
    throw new TypeError(
      `Retained real-build run contract is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    parsed.schemaVersion !== "lego.real-build-run-contract/1" ||
    typeof parsed.contractDigest !== "string"
  ) {
    throw new TypeError("Retained real-build run contract has a malformed schema.");
  }
  const { contractDigest, ...base } = parsed;
  if (sha256(JSON.stringify(base)) !== contractDigest) {
    throw new TypeError("Retained real-build run contract does not reproduce its content digest.");
  }
  return parsed;
}

/** Binds deserialized options to raw role hashes, the canonical run contract, and every source byte. */
export function verifyRealBuildRunContract(input: {
  readonly contract: RealBuildRunContract;
  readonly options: RealBuildOptions;
  readonly roleDigests: Readonly<Record<string, string>>;
  readonly sourceFiles: readonly { readonly path: string; readonly digest: string }[];
}): void {
  for (const [inputKey, role] of Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST) as [
    keyof RealBuildInputDigests,
    string,
  ][]) {
    if (
      input.options.inputDigests[inputKey] !== input.roleDigests[role] ||
      input.contract.inputDigests[inputKey] !== input.roleDigests[role]
    ) {
      throw new TypeError(
        `Run contract ${inputKey} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  const codeSnapshots = Object.fromEntries(
    input.sourceFiles
      .map(({ path, digest }) => [path, digest] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const regenerated = createRealBuildRunContract({
    inputDigests: input.options.inputDigests,
    panels: input.options.panels,
    budgets: realBuildRunBudgets(input.options),
    thresholds: realBuildRunThresholds(input.options),
    codeSnapshots,
  });
  if (JSON.stringify(regenerated) !== JSON.stringify(input.contract)) {
    throw new TypeError(
      "Retained options do not exactly reproduce the raw-input/source-bound real-build run contract.",
    );
  }
}
