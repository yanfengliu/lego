import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  PanelArtStageComponentFacts,
  PanelArtStageComponentSummary,
  PanelArtStages,
} from "../src/assembly/panel-art-stages";
import type { RealBuildSourceParityProbePanel } from "./real-build-observation-source-parity-types";

export interface RealBuildSourceParityCalibrationPanelCaptureInput {
  readonly panel: RealBuildSourceParityProbePanel;
  readonly width: number;
  readonly height: number;
  readonly highRgba: Uint8ClampedArray;
  readonly workRgba: Uint8ClampedArray;
  readonly sourceArtStages: PanelArtStages;
  readonly wMask: Uint8Array;
  readonly candidatePolicyDigest: Sha256Digest;
  readonly candidateDerivationDigest: Sha256Digest;
  readonly candidateWorkPixelsDigest: Sha256Digest;
}

function componentSummary(value: PanelArtStageComponentSummary): PanelArtStageComponentSummary {
  return Object.freeze({
    scanIndex: value.scanIndex,
    seedPixel: value.seedPixel,
    areaPx: value.areaPx,
    bounds: Object.freeze({ ...value.bounds }),
    touchesLeft: value.touchesLeft,
    touchesRight: value.touchesRight,
    touchesTop: value.touchesTop,
    touchesBottom: value.touchesBottom,
  });
}

function componentFacts(value: PanelArtStageComponentFacts): PanelArtStageComponentFacts {
  const summaries = new Map(
    value.retainedTopComponents.map((summary) => [summary.scanIndex, componentSummary(summary)]),
  );
  const selected = (summary: PanelArtStageComponentSummary | null) =>
    summary === null ? null : (summaries.get(summary.scanIndex) ?? componentSummary(summary));
  return Object.freeze({
    width: value.width,
    height: value.height,
    componentCount: value.componentCount,
    setPixels: value.setPixels,
    componentPartitionDigest: value.componentPartitionDigest,
    maximumAreaPx: value.maximumAreaPx,
    largestComponentCount: value.largestComponentCount,
    retainedTopComponents: Object.freeze([...summaries.values()]),
    legacySelected: selected(value.legacySelected),
    unambiguousLargestSelection: selected(value.unambiguousLargestSelection),
    selectionRefusal: value.selectionRefusal,
  });
}

export function snapshotRealBuildSourceParityCalibrationPanelCaptureInput(
  value: RealBuildSourceParityCalibrationPanelCaptureInput,
): RealBuildSourceParityCalibrationPanelCaptureInput {
  const stages = value.sourceArtStages;
  const sourceArtStages: PanelArtStages = Object.freeze({
    schemaVersion: stages.schemaVersion,
    authority: stages.authority,
    width: stages.width,
    height: stages.height,
    workWidth: stages.workWidth,
    workHeight: stages.workHeight,
    workFactor: stages.workFactor,
    highArtKeyMask: new Uint8Array(stages.highArtKeyMask),
    highPrintedFurnitureMask: new Uint8Array(stages.highPrintedFurnitureMask),
    highCalloutClearMask: new Uint8Array(stages.highCalloutClearMask),
    highCleanedArtMask: new Uint8Array(stages.highCleanedArtMask),
    highLegacySelectedMask: new Uint8Array(stages.highLegacySelectedMask),
    highComponents: componentFacts(stages.highComponents),
    highArtKeyDownsampledMask: new Uint8Array(stages.highArtKeyDownsampledMask),
    highPrintedFurnitureDownsampledMask: new Uint8Array(stages.highPrintedFurnitureDownsampledMask),
    highCalloutClearDownsampledMask: new Uint8Array(stages.highCalloutClearDownsampledMask),
    highCleanedArtDownsampledMask: new Uint8Array(stages.highCleanedArtDownsampledMask),
    isolateThenDownsampleMask: new Uint8Array(stages.isolateThenDownsampleMask),
    downsampleThenIsolateMask: new Uint8Array(stages.downsampleThenIsolateMask),
    downsampledComponents: componentFacts(stages.downsampledComponents),
    workOnlyStage: Object.freeze({ ...stages.workOnlyStage }),
  });
  return Object.freeze({
    panel: Object.freeze({
      ...value.panel,
      calloutBoxes: Object.freeze(value.panel.calloutBoxes.map((box) => Object.freeze({ ...box }))),
    }),
    width: value.width,
    height: value.height,
    highRgba: new Uint8ClampedArray(value.highRgba),
    workRgba: new Uint8ClampedArray(value.workRgba),
    sourceArtStages,
    wMask: new Uint8Array(value.wMask),
    candidatePolicyDigest: value.candidatePolicyDigest,
    candidateDerivationDigest: value.candidateDerivationDigest,
    candidateWorkPixelsDigest: value.candidateWorkPixelsDigest,
  });
}
