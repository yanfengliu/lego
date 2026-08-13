import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import { downsampleRaster } from "../src/assembly/panel-art";
import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  deriveRealBuildObservationSourceRasterCandidate,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate";
import { parseRealBuildObservationSourceStageTrace } from "./real-build-observation-source-stage-trace-parser";
import type { RealBuildObservationSourceStageMaskReference } from "./real-build-observation-source-stage-trace-types";
import { decodeRealBuildSourceParityCalibrationCapturePng } from "./real-build-observation-source-parity-calibration-capture-png";
import { mappedPanelCalloutRectangles } from "./real-build-panel-raster-geometry";
import {
  type RealBuildSourceParityCalibrationCaptureManifest,
  type RealBuildSourceParityCalibrationCapturePanel,
  type RealBuildSourceParityCalibrationCaptureRole,
  type RealBuildSourceParityCalibrationPairwiseMaskBinding,
} from "./real-build-observation-source-parity-calibration-capture-types";
import {
  captureDigest,
  equalCaptureBytes,
} from "./real-build-observation-source-parity-calibration-capture-structure";

export type CalibrationCaptureRoleBytes = ReadonlyMap<
  RealBuildSourceParityCalibrationCaptureRole,
  Uint8Array
>;
export type CalibrationCapturePngBytes = ReadonlyMap<string, Uint8Array>;

function requireExactValue(observed: unknown, expected: unknown, path: string): void {
  if (canonicalStringify(observed) !== canonicalStringify(expected)) {
    throw new TypeError(
      `${path} does not equal the value independently reproduced from retained capture evidence.`,
    );
  }
}

function boundSlice(
  bytes: Uint8Array,
  offset: number,
  length: number,
  digest: string,
  path: string,
): Uint8Array {
  const end = offset + length;
  if (!Number.isSafeInteger(end) || end > bytes.length) {
    throw new RangeError(
      `${path} requests bytes ${offset} through ${String(end)} from a ${bytes.length}-byte role.`,
    );
  }
  const slice = bytes.subarray(offset, end);
  const observedDigest = captureDigest(slice);
  if (observedDigest !== digest) {
    throw new TypeError(`${path} reproduces ${observedDigest}; descriptor requires ${digest}.`);
  }
  return slice;
}

function comparePair(
  declared: RealBuildSourceParityCalibrationPairwiseMaskBinding,
  leftName: "P" | "D",
  rightName: "D" | "W",
  left: Uint8Array,
  right: Uint8Array,
  path: string,
): void {
  const xor = new Uint8Array(left.length);
  let differingPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  for (let pixel = 0; pixel < left.length; pixel += 1) {
    const a = left[pixel]!;
    const b = right[pixel]!;
    if (a !== b) {
      xor[pixel] = 1;
      differingPixels += 1;
    }
    if (a === 1 && b === 1) intersectionPixels += 1;
    if (a === 1 || b === 1) unionPixels += 1;
  }
  requireExactValue(
    declared,
    {
      left: leftName,
      right: rightName,
      differingPixels,
      intersectionPixels,
      unionPixels,
      iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
      xorDigest: captureDigest(xor),
    },
    path,
  );
}

function flattenCallouts(panel: RealBuildSourceParityCalibrationCapturePanel): Float64Array {
  const result = new Float64Array(panel.calloutBoxes.length * 4);
  panel.calloutBoxes.forEach((box, index) => {
    result.set([box.minXPt, box.maxXPt, box.minYPt, box.maxYPt], index * 4);
  });
  return result;
}

function deriveStagesFromRetainedHigh(
  panel: RealBuildSourceParityCalibrationCapturePanel,
  high: Uint8Array,
) {
  const renderScale = 6;
  const sourceWidth = (panel.maxXPt - panel.minXPt) * renderScale;
  const ratio = panel.highWidth / sourceWidth;
  return derivePanelArtStages({
    raster: {
      width: panel.highWidth,
      height: panel.highHeight,
      pixels: new Uint8ClampedArray(high),
    },
    workFactor: panel.workFactor,
    backgroundHex: 0x899093,
    backgroundToleranceLevels: 10,
    calloutRectangles: mappedPanelCalloutRectangles({
      width: panel.highWidth,
      height: panel.highHeight,
      renderScale,
      sourceXPx: panel.minXPt * renderScale,
      sourceYPx: 0,
      ratio,
      pageHeightPx: panel.maxYPt * renderScale,
      boxes: panel.calloutBoxes,
    }),
  });
}

function expectedCropDigest(panel: RealBuildSourceParityCalibrationCapturePanel) {
  return canonicalDigest({
    schemaVersion: "lego.real-build-calibration-crop/1",
    panel: {
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
      calloutBoxes: panel.calloutBoxes,
      panelEvidenceDigest: panel.panelEvidenceDigest,
    },
    highWidth: panel.highWidth,
    highHeight: panel.highHeight,
  });
}

function validatePng(
  panel: RealBuildSourceParityCalibrationCapturePanel,
  scale: "high" | "work",
  rgba: Uint8Array,
  pngs: CalibrationCapturePngBytes,
): void {
  const path = `Calibration capture step ${panel.stepNumber} ${scale} PNG`;
  const reference = scale === "high" ? panel.highPng : panel.workPng;
  const bytes = pngs.get(`${panel.stepNumber}:${scale}`);
  if (bytes === undefined) throw new TypeError(`${path} attachment is absent.`);
  if (bytes.length !== reference.byteLength || captureDigest(bytes) !== reference.digest) {
    throw new TypeError(
      `${path} attachment length/digest does not match ${reference.byteLength}/${reference.digest}.`,
    );
  }
  const decoded = decodeRealBuildSourceParityCalibrationCapturePng(
    bytes,
    scale === "high" ? panel.highPixelCount : panel.workPixelCount,
    path,
  );
  if (decoded.width !== reference.width || decoded.height !== reference.height) {
    throw new RangeError(
      `${path} decodes to ${decoded.width}x${decoded.height}; descriptor requires ${reference.width}x${reference.height}.`,
    );
  }
  if (captureDigest(decoded.rgba) !== reference.rgbaDigest) {
    throw new TypeError(`${path} decoded RGBA does not reproduce ${reference.rgbaDigest}.`);
  }
  if (!equalCaptureBytes(decoded.rgba, rgba)) {
    throw new TypeError(
      `${path} decoded RGBA differs from the exact ${scale} RGBA role slice despite its independent descriptor.`,
    );
  }
}

function validatePanel(
  panel: RealBuildSourceParityCalibrationCapturePanel,
  stagePanel: ReturnType<typeof parseRealBuildObservationSourceStageTrace>["panels"][number],
  pdfDigest: RealBuildSourceParityCalibrationCaptureManifest["pdfDigest"],
  roleBytes: CalibrationCaptureRoleBytes,
  pngBytes: CalibrationCapturePngBytes,
): void {
  const high = boundSlice(
    roleBytes.get("calibration-high-rgba8")!,
    panel.highRgba.offset,
    panel.highRgba.byteLength,
    panel.highRgba.digest,
    `Calibration capture step ${panel.stepNumber} highRgba`,
  );
  const work = boundSlice(
    roleBytes.get("calibration-work-rgba8")!,
    panel.workRgba.offset,
    panel.workRgba.byteLength,
    panel.workRgba.digest,
    `Calibration capture step ${panel.stepNumber} workRgba`,
  );
  const packedW = boundSlice(
    roleBytes.get("calibration-w-packed-msb")!,
    panel.wMask.offset,
    panel.wMask.byteLength,
    panel.wMask.digest,
    `Calibration capture step ${panel.stepNumber} wMask`,
  );
  const w = unpackRealBuildCompiledBinaryMaskMsb(packedW, panel.workWidth, panel.workHeight);
  if (captureDigest(w) !== panel.wMask.unpackedDigest) {
    throw new TypeError(
      `Calibration capture step ${panel.stepNumber} W unpacked digest does not match ${panel.wMask.unpackedDigest}.`,
    );
  }
  validatePng(panel, "high", high, pngBytes);
  validatePng(panel, "work", work, pngBytes);

  const downsampled = downsampleRaster(
    {
      width: panel.highWidth,
      height: panel.highHeight,
      pixels: new Uint8ClampedArray(high),
    },
    panel.workFactor,
  );
  if (
    downsampled.width !== panel.workWidth ||
    downsampled.height !== panel.workHeight ||
    !equalCaptureBytes(
      new Uint8Array(
        downsampled.pixels.buffer,
        downsampled.pixels.byteOffset,
        downsampled.pixels.byteLength,
      ),
      work,
    )
  ) {
    throw new TypeError(
      `Calibration capture step ${panel.stepNumber} work RGBA is not the exact factor-${panel.workFactor} production downsample of retained high RGBA.`,
    );
  }

  requireExactValue(stagePanel.stepNumber, panel.stepNumber, `stageTrace step ${panel.stepNumber}`);
  requireExactValue(stagePanel.pageNumber, panel.pageNumber, `stageTrace page ${panel.stepNumber}`);
  requireExactValue(
    stagePanel.dimensions,
    {
      highWidth: panel.highWidth,
      highHeight: panel.highHeight,
      workWidth: panel.workWidth,
      workHeight: panel.workHeight,
      workFactor: panel.workFactor,
    },
    `stageTrace step ${panel.stepNumber}.dimensions`,
  );
  requireExactValue(
    stagePanel.source.pdfDigest,
    pdfDigest,
    `stageTrace step ${panel.stepNumber}.source.pdfDigest`,
  );
  requireExactValue(
    stagePanel.source.panelEvidenceDigest,
    panel.panelEvidenceDigest,
    `stageTrace step ${panel.stepNumber}.source.panelEvidenceDigest`,
  );
  requireExactValue(
    stagePanel.source.cropDescriptorDigest,
    expectedCropDigest(panel),
    `stageTrace step ${panel.stepNumber}.source.cropDescriptorDigest`,
  );
  requireExactValue(
    stagePanel.source.workPixelsDigest,
    panel.workRgba.digest,
    `stageTrace step ${panel.stepNumber}.source.workPixelsDigest`,
  );
  const p = stagePanel.stages.find(({ stage }) => stage === "isolate-then-downsample");
  const d = stagePanel.stages.find(({ stage }) => stage === "downsample-then-isolate");
  requireExactValue(p, panel.pMask, `stageTrace step ${panel.stepNumber}.P`);
  requireExactValue(d, panel.dMask, `stageTrace step ${panel.stepNumber}.D`);
  const unpackStage = (reference: RealBuildObservationSourceStageMaskReference): Uint8Array => {
    const packed = boundSlice(
      roleBytes.get("calibration-stage-packed-msb")!,
      reference.offset,
      reference.bytes,
      reference.packedDigest,
      `Calibration capture step ${panel.stepNumber} ${reference.stage}`,
    );
    const mask = unpackRealBuildCompiledBinaryMaskMsb(packed, reference.width, reference.height);
    if (captureDigest(mask) !== reference.unpackedDigest) {
      throw new TypeError(
        `Calibration capture step ${panel.stepNumber} ${reference.stage} unpacked digest does not match ${reference.unpackedDigest}.`,
      );
    }
    return mask;
  };
  const retainedStages = stagePanel.stages.map((reference) => unpackStage(reference));
  const pMask = retainedStages[5]!;
  const dMask = retainedStages[6]!;
  const derivedStages = deriveStagesFromRetainedHigh(panel, high);
  const independentlyDerivedMasks = [
    derivedStages.highCleanedArtMask,
    derivedStages.highArtKeyDownsampledMask,
    derivedStages.highPrintedFurnitureDownsampledMask,
    derivedStages.highCalloutClearDownsampledMask,
    derivedStages.highCleanedArtDownsampledMask,
    derivedStages.isolateThenDownsampleMask,
    derivedStages.downsampleThenIsolateMask,
  ];
  independentlyDerivedMasks.forEach((mask, index) => {
    if (!equalCaptureBytes(mask, retainedStages[index]!)) {
      throw new TypeError(
        `Calibration capture step ${panel.stepNumber} retained stage ${stagePanel.stages[index]!.stage} differs from the stage independently re-derived from exact high RGBA and prepared callouts.`,
      );
    }
  });

  const candidate = deriveRealBuildObservationSourceRasterCandidate(
    panel.workWidth,
    panel.workHeight,
    panel.workFactor,
    new Uint8ClampedArray(work),
    panel.minXPt,
    panel.maxXPt,
    panel.minYPt,
    panel.maxYPt,
    flattenCallouts(panel),
  );
  requireExactValue(
    candidate.workPixelsDigest,
    panel.workRgba.digest,
    `Calibration capture step ${panel.stepNumber} candidate.workPixelsDigest`,
  );
  requireExactValue(
    candidate.policyDescriptorDigest,
    panel.candidatePolicyDigest,
    `Calibration capture step ${panel.stepNumber} candidate.policyDescriptorDigest`,
  );
  requireExactValue(
    candidate.derivationDescriptorDigest,
    panel.candidateDerivationDigest,
    `Calibration capture step ${panel.stepNumber} candidate.derivationDescriptorDigest`,
  );
  requireExactValue(
    stagePanel.source.policyDescriptorDigest,
    candidate.policyDescriptorDigest,
    `stageTrace step ${panel.stepNumber}.source.policyDescriptorDigest`,
  );
  const candidateW = unpackRealBuildObservationSourceRasterCandidateMask(candidate.assemblyMask);
  if (!equalCaptureBytes(candidateW, w)) {
    throw new TypeError(
      `Calibration capture step ${panel.stepNumber} retained W differs from W independently re-derived from exact work RGBA and prepared crop.`,
    );
  }
  comparePair(
    panel.pairwisePdw[0],
    "P",
    "D",
    pMask,
    dMask,
    `Calibration capture step ${panel.stepNumber} P/D`,
  );
  comparePair(
    panel.pairwisePdw[1],
    "P",
    "W",
    pMask,
    w,
    `Calibration capture step ${panel.stepNumber} P/W`,
  );
  comparePair(
    panel.pairwisePdw[2],
    "D",
    "W",
    dMask,
    w,
    `Calibration capture step ${panel.stepNumber} D/W`,
  );
}

/** Closes every retained descriptor against its bytes before a capture artifact is admitted. */
export function validateRealBuildSourceParityCalibrationCapture(
  manifest: RealBuildSourceParityCalibrationCaptureManifest,
  roles: CalibrationCaptureRoleBytes,
  pngs: CalibrationCapturePngBytes,
): void {
  for (const descriptor of manifest.roles) {
    const bytes = roles.get(descriptor.role);
    if (bytes === undefined)
      throw new TypeError(`Calibration capture role ${descriptor.role} is absent.`);
    if (bytes.length !== descriptor.byteLength || captureDigest(bytes) !== descriptor.digest) {
      throw new TypeError(
        `Calibration capture role ${descriptor.role} does not match declared length/digest ${descriptor.byteLength}/${descriptor.digest}.`,
      );
    }
  }
  const stageTrace = parseRealBuildObservationSourceStageTrace(
    roles.get("calibration-stage-manifest-json")!,
    roles.get("calibration-stage-packed-msb")!,
  );
  if (stageTrace.panels.length !== manifest.panels.length) {
    throw new RangeError(
      `Calibration stage trace retains ${stageTrace.panels.length} panels; capture requires ${manifest.panels.length}.`,
    );
  }
  manifest.panels.forEach((panel, index) =>
    validatePanel(panel, stageTrace.panels[index]!, manifest.pdfDigest, roles, pngs),
  );
}
