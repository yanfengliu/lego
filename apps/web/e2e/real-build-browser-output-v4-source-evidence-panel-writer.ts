import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { downsampleRaster } from "../src/assembly/panel-art";
import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  deriveRealBuildObservationSourceRasterCandidate,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate";
import type {
  RealBuildSourceParityBounds,
  RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import { mappedPanelCalloutRectangles } from "./real-build-panel-raster-geometry";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { requireRealBuildSourceDerivationPrimordials } from "./real-build-source-derivation-primordials";
import { brandRealBuildBrowserOutputV4SourceEvidencePanelDescriptor } from "./real-build-browser-output-v4-source-evidence-brands";
import {
  sourceEvidenceActiveBytes,
  sourceEvidenceConcat,
  sourceEvidenceCopyBytes,
  sourceEvidenceDenseArray,
  sourceEvidenceDigest,
  sourceEvidenceDigestValue,
  sourceEvidenceEqualBytes,
  sourceEvidenceExactRecord,
  sourceEvidenceFinite,
  sourceEvidenceInteger,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_CALLOUTS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES,
  type RealBuildBrowserOutputV4SourceEvidenceMask,
  type RealBuildBrowserOutputV4SourceEvidenceMaskReference,
  type RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
  type RealBuildBrowserOutputV4SourceEvidencePanelInput,
} from "./real-build-browser-output-v4-source-evidence-types";

const HIGH_WIDTH = 1_000;
const RENDER_SCALE = 6;
const WORK_FACTOR = 2;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;

function snapshotBounds(value: unknown, path: string): RealBuildSourceParityBounds {
  const row = sourceEvidenceExactRecord(value, ["minXPt", "maxXPt", "minYPt", "maxYPt"], path);
  const result = intrinsicRealBuildFreeze({
    minXPt: sourceEvidenceFinite(row.minXPt, `${path}.minXPt`),
    maxXPt: sourceEvidenceFinite(row.maxXPt, `${path}.maxXPt`),
    minYPt: sourceEvidenceFinite(row.minYPt, `${path}.minYPt`),
    maxYPt: sourceEvidenceFinite(row.maxYPt, `${path}.maxYPt`),
  });
  if (result.maxXPt <= result.minXPt || result.maxYPt <= result.minYPt) {
    throw new RangeError(`${path} must have positive PDF-point width and height.`);
  }
  return result;
}

function snapshotPreparedPanel(
  value: unknown,
  pdfDigest: Sha256Digest,
): RealBuildSourceParityProbePanel & { readonly panelEvidenceDigest: Sha256Digest } {
  const path = "Source evidence panel input.panel";
  const row = sourceEvidenceExactRecord(
    value,
    [
      "stepNumber",
      "pageNumber",
      "minXPt",
      "maxXPt",
      "minYPt",
      "maxYPt",
      "calloutBoxes",
      "panelEvidenceDigest",
    ],
    path,
  );
  const stepNumber = sourceEvidenceInteger(
    row.stepNumber,
    1,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
    `${path}.stepNumber`,
  );
  const pageNumber = sourceEvidenceInteger(row.pageNumber, 1, 400, `${path}.pageNumber`);
  const panelBounds = snapshotBounds(
    {
      minXPt: row.minXPt,
      maxXPt: row.maxXPt,
      minYPt: row.minYPt,
      maxYPt: row.maxYPt,
    },
    path,
  );
  const rawCallouts = sourceEvidenceDenseArray(
    row.calloutBoxes,
    0,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_CALLOUTS,
    `${path}.calloutBoxes`,
  );
  const calloutBoxes: RealBuildSourceParityBounds[] = [];
  for (let index = 0; index < rawCallouts.length; index += 1) {
    calloutBoxes[index] = snapshotBounds(rawCallouts[index], `${path}.calloutBoxes[${index}]`);
  }
  const panelEvidenceDigest = sourceEvidenceDigestValue(
    row.panelEvidenceDigest,
    `${path}.panelEvidenceDigest`,
  );
  const result = intrinsicRealBuildFreeze({
    stepNumber,
    pageNumber,
    ...panelBounds,
    calloutBoxes: intrinsicRealBuildFreeze(calloutBoxes),
    panelEvidenceDigest,
  });
  const reproduced = stepPanelEvidenceDigest({
    pdfDigest,
    stepNumber,
    pageNumber,
    bounds: panelBounds,
    calloutBoxes,
  });
  if (panelEvidenceDigest !== reproduced) {
    throw new TypeError(
      `${path}.panelEvidenceDigest observed ${panelEvidenceDigest}; exact PDF/page/bounds/callouts reproduce ${reproduced}.`,
    );
  }
  return result;
}

function flattenCallouts(panel: RealBuildSourceParityProbePanel): Float64Array {
  const result = new Float64Array(panel.calloutBoxes.length * 4);
  for (let index = 0; index < panel.calloutBoxes.length; index += 1) {
    const box = panel.calloutBoxes[index]!;
    result[index * 4] = box.minXPt;
    result[index * 4 + 1] = box.maxXPt;
    result[index * 4 + 2] = box.minYPt;
    result[index * 4 + 3] = box.maxYPt;
  }
  return result;
}

function modeMeasure(value: unknown, path: string, ownPanel: boolean): "iou" | "containment" {
  if (value !== "iou" && value !== "containment") {
    throw new TypeError(`${path} must be iou or containment.`);
  }
  if (ownPanel && value !== "iou")
    throw new TypeError(`${path} must be iou for own-panel evidence.`);
  return value;
}

/** Snapshots and derives one panel so its three roles can be persisted and released immediately. */
export function createRealBuildBrowserOutputV4SourceEvidencePanel(
  value: RealBuildBrowserOutputV4SourceEvidencePanelInput | unknown,
): RealBuildBrowserOutputV4SourceEvidencePanelArtifact {
  const input = sourceEvidenceExactRecord(
    value,
    ["pdfDigest", "panel", "highRgba", "workRgba"],
    "Source evidence panel input",
  );
  requireRealBuildSourceDerivationPrimordials();
  const pdfDigest = sourceEvidenceDigestValue(
    input.pdfDigest,
    "Source evidence panel input.pdfDigest",
  );
  const panel = snapshotPreparedPanel(input.panel, pdfDigest);
  const highHeight = Math.max(
    1,
    Math.round(((panel.maxYPt - panel.minYPt) * HIGH_WIDTH) / (panel.maxXPt - panel.minXPt)),
  );
  const highPixels = HIGH_WIDTH * highHeight;
  const workWidth = Math.ceil(HIGH_WIDTH / WORK_FACTOR);
  const workHeight = Math.ceil(highHeight / WORK_FACTOR);
  const workPixels = workWidth * workHeight;
  if (!NUMBER_IS_SAFE_INTEGER(highPixels) || highPixels > 4_194_304) {
    throw new RangeError(
      `Source evidence step ${panel.stepNumber} requires ${highPixels} high pixels.`,
    );
  }
  if (!NUMBER_IS_SAFE_INTEGER(workPixels) || workPixels > 1_048_576) {
    throw new RangeError(
      `Source evidence step ${panel.stepNumber} requires ${workPixels} work pixels.`,
    );
  }
  const expectedPackedBytes = Math.ceil(highPixels / 8) + 7 * Math.ceil(workPixels / 8);
  const activeBytes = sourceEvidenceActiveBytes(highPixels, workPixels, expectedPackedBytes);
  if (activeBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES) {
    throw new RangeError(
      `Source evidence step ${panel.stepNumber} requires ${activeBytes} estimated active bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES}.`,
    );
  }
  const high = sourceEvidenceCopyBytes(
    input.highRgba,
    ["Uint8ClampedArray"],
    highPixels * 4,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
    `Source evidence step ${panel.stepNumber} high RGBA`,
  );
  const work = sourceEvidenceCopyBytes(
    input.workRgba,
    ["Uint8ClampedArray"],
    workPixels * 4,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
    `Source evidence step ${panel.stepNumber} work RGBA`,
  );
  const downsampled = downsampleRaster(
    { width: HIGH_WIDTH, height: highHeight, pixels: new Uint8ClampedArray(high) },
    WORK_FACTOR,
  );
  if (!sourceEvidenceEqualBytes(new Uint8Array(downsampled.pixels), work)) {
    throw new TypeError(
      `Source evidence step ${panel.stepNumber} work RGBA is not the deterministic factor-${WORK_FACTOR} downsample of high RGBA.`,
    );
  }
  const ratio = HIGH_WIDTH / ((panel.maxXPt - panel.minXPt) * RENDER_SCALE);
  const stages = derivePanelArtStages({
    raster: { width: HIGH_WIDTH, height: highHeight, pixels: new Uint8ClampedArray(high) },
    workFactor: WORK_FACTOR,
    backgroundHex: 0x899093,
    backgroundToleranceLevels: 10,
    calloutRectangles: mappedPanelCalloutRectangles({
      width: HIGH_WIDTH,
      height: highHeight,
      renderScale: RENDER_SCALE,
      sourceXPx: panel.minXPt * RENDER_SCALE,
      sourceYPx: 0,
      ratio,
      pageHeightPx: panel.maxYPt * RENDER_SCALE,
      boxes: panel.calloutBoxes as never,
    }),
  });
  const candidate = deriveRealBuildObservationSourceRasterCandidate(
    workWidth,
    workHeight,
    WORK_FACTOR,
    new Uint8ClampedArray(work),
    panel.minXPt,
    panel.maxXPt,
    panel.minYPt,
    panel.maxYPt,
    flattenCallouts(panel),
  );
  const unpacked: Readonly<Record<RealBuildBrowserOutputV4SourceEvidenceMask, Uint8Array>> =
    intrinsicRealBuildFreeze({
      H: stages.highCleanedArtMask,
      P: stages.isolateThenDownsampleMask,
      D: stages.downsampleThenIsolateMask,
      W: unpackRealBuildObservationSourceRasterCandidateMask(candidate.assemblyMask),
      "own-panel-source": unpackRealBuildObservationSourceRasterCandidateMask(
        candidate.ownPanel.builtMask,
      ),
      "own-panel-exclusion": unpackRealBuildObservationSourceRasterCandidateMask(
        candidate.ownPanel.excludedMask,
      ),
      "lookahead-source": unpackRealBuildObservationSourceRasterCandidateMask(
        candidate.lookahead.builtMask,
      ),
      "lookahead-exclusion": unpackRealBuildObservationSourceRasterCandidateMask(
        candidate.lookahead.excludedMask,
      ),
    });
  const packed: Uint8Array[] = [];
  for (
    let index = 0;
    index < REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS.length;
    index += 1
  ) {
    const name = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS[index]!;
    packed[index] = packRealBuildCompiledBinaryMaskMsb(
      unpacked[name],
      name === "H" ? HIGH_WIDTH : workWidth,
      name === "H" ? highHeight : workHeight,
    );
  }
  const maskRole = sourceEvidenceConcat(
    packed,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
    `Source evidence step ${panel.stepNumber} packed masks`,
  );
  const roleBytes = intrinsicRealBuildFreeze({
    "source-high-rgba8": high,
    "source-work-rgba8": work,
    "source-masks-packed-msb": maskRole.bytes,
  });
  const roles = [];
  for (
    let index = 0;
    index < REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES.length;
    index += 1
  ) {
    const role = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES[index]!;
    roles[index] = intrinsicRealBuildFreeze({
      role,
      contentEncoding: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS[role],
      byteLength: roleBytes[role].byteLength,
      digest: sourceEvidenceDigest(roleBytes[role]),
    });
  }
  const maskReferences: RealBuildBrowserOutputV4SourceEvidenceMaskReference[] = [];
  for (
    let index = 0;
    index < REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS.length;
    index += 1
  ) {
    const name = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS[index]!;
    const width = name === "H" ? HIGH_WIDTH : workWidth;
    const height = name === "H" ? highHeight : workHeight;
    maskReferences[index] = intrinsicRealBuildFreeze({
      name,
      role: "source-masks-packed-msb",
      contentEncoding: "packed-binary-mask-msb/1",
      width,
      height,
      pixelCount: width * height,
      offset: maskRole.offsets[index]!,
      byteLength: packed[index]!.byteLength,
      lowPaddingBits: (8 - ((width * height) & 7)) & 7,
      packedDigest: sourceEvidenceDigest(packed[index]!),
      unpackedDigest: sourceEvidenceDigest(unpacked[name]),
    });
  }
  const ownMeasure = modeMeasure(
    candidate.ownPanel.sourceDescriptorInputs.measure,
    "Own-panel source measure",
    true,
  );
  const lookaheadMeasure = modeMeasure(
    candidate.lookahead.sourceDescriptorInputs.measure,
    "Lookahead source measure",
    false,
  );
  const descriptor = brandRealBuildBrowserOutputV4SourceEvidencePanelDescriptor(
    intrinsicRealBuildFreeze({
      ...panel,
      cropDescriptorDigest: canonicalDigest({
        schemaVersion: "lego.real-build-calibration-crop/1",
        panel,
        highWidth: HIGH_WIDTH,
        highHeight,
      }),
      highWidth: HIGH_WIDTH,
      highHeight,
      highPixelCount: highPixels,
      workWidth,
      workHeight,
      workPixelCount: workPixels,
      workFactor: WORK_FACTOR as 2,
      roles: intrinsicRealBuildFreeze(roles),
      highRgba: intrinsicRealBuildFreeze({
        role: "source-high-rgba8" as const,
        offset: 0,
        byteLength: high.byteLength,
        digest: sourceEvidenceDigest(high),
      }),
      workRgba: intrinsicRealBuildFreeze({
        role: "source-work-rgba8" as const,
        offset: 0,
        byteLength: work.byteLength,
        digest: sourceEvidenceDigest(work),
      }),
      masks: intrinsicRealBuildFreeze(maskReferences),
      workPixelsDigest: candidate.workPixelsDigest,
      policyDescriptorDigest: candidate.policyDescriptorDigest,
      derivationDescriptorDigest: candidate.derivationDescriptorDigest,
      assemblyMaskDigest: candidate.assemblyMaskDigest,
      ownPanel: intrinsicRealBuildFreeze({
        measure: ownMeasure as "iou",
        sourceDescriptorDigest: candidate.ownPanel.sourceDescriptorDigest,
        exclusionDescriptorDigest: candidate.ownPanel.exclusionDescriptorDigest,
      }),
      lookahead: intrinsicRealBuildFreeze({
        measure: lookaheadMeasure,
        sourceDescriptorDigest: candidate.lookahead.sourceDescriptorDigest,
        exclusionDescriptorDigest: candidate.lookahead.exclusionDescriptorDigest,
      }),
    }),
  );
  return intrinsicRealBuildFreeze({
    descriptor,
    highRgbaBytes: high,
    workRgbaBytes: work,
    packedMaskBytes: maskRole.bytes,
  });
}
