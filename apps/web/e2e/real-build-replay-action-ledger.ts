import { canonicalStringify } from "@lego-studio/brick-kernel";

import type { TransitionClassificationBundle } from "./real-build-input-files";
import {
  validateRealBuildActionLedger,
  type CoverageLedgerClaim,
  type OfficialModelIndex,
  type RealBuildActionLedger,
} from "./real-build-ledger";
import { parseDuplicateFreeRealBuildJson } from "./real-build-json-admission";
import type { RealBuildReplayPanelSourceResult } from "./real-build-replay-panel-source";
import type { RealBuildOptions } from "./real-build-safety";
import { readTransitionClassificationBundle } from "./real-build-transition-classification";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reconstructedCoveragePrefix(
  coverage: unknown,
  lastStep: number,
): Readonly<Record<string, CoverageLedgerClaim>> {
  if (!isRecord(coverage) || !isRecord(coverage.byCallout)) {
    throw new TypeError(
      "Reconstructed retained coverage has no object-valued byCallout index for action-ledger replay.",
    );
  }
  return Object.fromEntries(
    Object.entries(coverage.byCallout).filter(([, claim]) => {
      if (!isRecord(claim)) return false;
      return Number.isSafeInteger(claim.stepNumber) && (claim.stepNumber as number) <= lastStep;
    }),
  ) as Readonly<Record<string, CoverageLedgerClaim>>;
}

function preparedCoverageProjection(
  coverage: Readonly<Record<string, CoverageLedgerClaim>>,
  calloutKeys: ReadonlySet<string>,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(coverage)
      .filter(([calloutKey]) => calloutKeys.has(calloutKey))
      .map(([calloutKey, claim]) => {
        const identity = (claim as CoverageLedgerClaim & { readonly identity?: string }).identity;
        return [
          calloutKey,
          {
            pageNumber: claim.pageNumber,
            quantity: claim.quantity,
            stepNumber: claim.stepNumber,
            ...(identity === undefined ? {} : { identity }),
            ...(claim.identificationConfidence === undefined
              ? {}
              : { identificationConfidence: claim.identificationConfidence }),
            ...(claim.cropDigest === undefined ? {} : { cropDigest: claim.cropDigest }),
            ...(claim.inputDigest === undefined ? {} : { inputDigest: claim.inputDigest }),
          },
        ];
      }),
  );
}

function panelGeometryProjection(panel: {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelFace: string | null;
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
  readonly calloutBoxes: readonly unknown[];
}): unknown {
  return {
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    bounds: {
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
    },
    calloutBoxes: panel.calloutBoxes,
  };
}

function sourcePanelGeometryProjection(
  replayed: RealBuildReplayPanelSourceResult,
  stepNumber: number,
): unknown {
  const panel = replayed.panels[stepNumber - 1];
  if (panel === undefined || panel.stepNumber !== stepNumber) {
    throw new TypeError(
      `Retained panel source omitted dense printed step ${stepNumber} before replay prefix projection.`,
    );
  }
  const panelFace = replayed.panelFaceByStep[stepNumber];
  if (panelFace === undefined) {
    throw new TypeError(
      `Retained panel source omitted the independently replayed face for bounded observation step ${stepNumber}.`,
    );
  }
  return {
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace,
    bounds: panel.bounds,
    calloutBoxes: replayed.calloutBoxesByStep[stepNumber] ?? [],
  };
}

function assertPreparedPanelGeometryMatchesRetainedSource(
  options: RealBuildOptions,
  replayed: RealBuildReplayPanelSourceResult,
): void {
  for (const panel of [...options.panels, ...options.passivePanels]) {
    const prepared = panelGeometryProjection(panel);
    const source = sourcePanelGeometryProjection(replayed, panel.stepNumber);
    if (canonicalStringify(prepared) !== canonicalStringify(source)) {
      throw new TypeError(
        `Prepared panel ${panel.stepNumber} page/face/bounds/calloutBoxes do not reproduce the independently replayed retained 359-step panel source.`,
      );
    }
  }
}

/** Replays the live ledger semantic gate from retained raw evidence before any browser result is read. */
export function verifyRealBuildReplayActionLedgerSemantics(input: {
  readonly ledger: RealBuildActionLedger;
  readonly ledgerDigest: string;
  readonly options: RealBuildOptions;
  readonly official: OfficialModelIndex;
  readonly reconstructedCoverage: unknown;
  readonly replayedPanelSource: RealBuildReplayPanelSourceResult;
  readonly transitionClassificationsBytes: Uint8Array;
}): void {
  if (input.replayedPanelSource.requestedLastStep !== input.options.lastStep) {
    throw new TypeError(
      `Retained panel-source requestedLastStep ${input.replayedPanelSource.requestedLastStep} does not equal prepared-options lastStep ${input.options.lastStep}.`,
    );
  }
  assertPreparedPanelGeometryMatchesRetainedSource(input.options, input.replayedPanelSource);
  const coverageByCallout = reconstructedCoveragePrefix(
    input.reconstructedCoverage,
    input.options.lastStep,
  );
  const mappedCalloutKeys = new Set(
    input.options.panels.flatMap(({ mappedCalloutKeys: keys }) => [...keys]),
  );
  const projectedCoverage = preparedCoverageProjection(coverageByCallout, mappedCalloutKeys);
  if (
    canonicalStringify(projectedCoverage) !== canonicalStringify(input.options.coverageByCallout)
  ) {
    throw new TypeError(
      "Prepared coverageByCallout does not exactly reproduce the requested prefix of retained raw coverage.",
    );
  }
  const transitionBundle = parseDuplicateFreeRealBuildJson<TransitionClassificationBundle>(
    input.transitionClassificationsBytes,
    "replay transition-classifications role",
  );
  const transitions = readTransitionClassificationBundle(
    transitionBundle,
    input.options.inputDigests.pdf,
  );
  if (transitions.rejections.length > 0) {
    throw new TypeError(
      `Replay transition-classifications role failed its deterministic reader: ${transitions.rejections.slice(0, 4).join(" ")}`,
    );
  }
  const failures = validateRealBuildActionLedger({
    ledger: input.ledger,
    ledgerDigest: input.ledgerDigest,
    requestedLastStep: input.options.lastStep,
    lastStep: input.options.lastStep,
    official: input.official,
    pdfDigest: input.options.inputDigests.pdf,
    coverageDigest: input.options.inputDigests.coverage,
    calloutManifestDigest: input.options.inputDigests.calloutManifest,
    builderCalibrationDigest: input.options.inputDigests.builderCalibration,
    transitionClassificationsDigest: input.options.inputDigests.transitionClassifications,
    coverageByCallout,
    panelEvidenceByStep: input.replayedPanelSource.panelEvidenceByStep,
    transitionClassificationsByStep: transitions.byStep,
  });
  if (failures.length > 0) {
    throw new TypeError(
      `Replay action-ledger /3 does not reproduce retained coverage, panel, official-model, or transition evidence: ${failures
        .slice(0, 4)
        .map(({ message }) => message)
        .join(" ")}`,
    );
  }
}
