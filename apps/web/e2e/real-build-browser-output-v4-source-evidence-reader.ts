import { types as nodeTypes } from "node:util";

import { downsampleRaster } from "../src/assembly/panel-art";
import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  deriveRealBuildObservationSourceRasterCandidate,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate";
import { mappedPanelCalloutRectangles } from "./real-build-panel-raster-geometry";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { requireRealBuildSourceDerivationPrimordials } from "./real-build-source-derivation-primordials";
import { parseRealBuildBrowserOutputV4SourceEvidenceManifest } from "./real-build-browser-output-v4-source-evidence-parser";
import { bindRealBuildBrowserOutputV4SourceEvidencePreparedRun } from "./real-build-browser-output-v4-source-evidence-prepared";
import {
  sourceEvidenceCopyBytes,
  sourceEvidenceDigest,
  sourceEvidenceEqualBytes,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
  type RealBuildBrowserOutputV4SourceEvidenceInspection,
  type RealBuildBrowserOutputV4SourceEvidenceInspectionSession,
  type RealBuildBrowserOutputV4SourceEvidenceManifest,
  type RealBuildBrowserOutputV4SourceEvidenceMask,
  type RealBuildBrowserOutputV4SourceEvidencePanel,
  type RealBuildBrowserOutputV4SourceEvidencePanelInspection,
} from "./real-build-browser-output-v4-source-evidence-types";

interface InspectionState {
  readonly manifest: RealBuildBrowserOutputV4SourceEvidenceManifest;
  nextStep: number;
  finished: boolean;
  inFlight: boolean;
}

const STATES = new WeakMap<
  RealBuildBrowserOutputV4SourceEvidenceInspectionSession,
  InspectionState
>();
const INSPECTIONS = new WeakSet<RealBuildBrowserOutputV4SourceEvidenceInspection>();
const IS_PROXY = nodeTypes.isProxy;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const REFLECT_APPLY = Reflect.apply;
const UINT8_ARRAY_SUBARRAY = Uint8Array.prototype.subarray;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_HAS = WeakMap.prototype.has;
const WEAK_MAP_SET = WeakMap.prototype.set;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

function stateFor(value: unknown): InspectionState {
  if (
    value === null ||
    typeof value !== "object" ||
    IS_PROXY(value) ||
    !REFLECT_APPLY(WEAK_MAP_HAS, STATES, [value])
  ) {
    throw new TypeError("Source evidence inspection requires the exact branded session.");
  }
  return REFLECT_APPLY(WEAK_MAP_GET, STATES, [value]) as InspectionState;
}

function flattenCallouts(panel: RealBuildBrowserOutputV4SourceEvidencePanel): Float64Array {
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

function deriveExpected(
  panel: RealBuildBrowserOutputV4SourceEvidencePanel,
  high: Uint8Array,
  work: Uint8Array,
) {
  const ratio = panel.highWidth / ((panel.maxXPt - panel.minXPt) * 6);
  const stages = derivePanelArtStages({
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
      renderScale: 6,
      sourceXPx: panel.minXPt * 6,
      sourceYPx: 0,
      ratio,
      pageHeightPx: panel.maxYPt * 6,
      boxes: panel.calloutBoxes as never,
    }),
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
  const masks: Readonly<Record<RealBuildBrowserOutputV4SourceEvidenceMask, Uint8Array>> =
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
  return intrinsicRealBuildFreeze({ stages, candidate, masks });
}

function verifyMasks(
  panel: RealBuildBrowserOutputV4SourceEvidencePanel,
  packedRole: Uint8Array,
  expected: Readonly<Record<RealBuildBrowserOutputV4SourceEvidenceMask, Uint8Array>>,
): void {
  for (let index = 0; index < panel.masks.length; index += 1) {
    const reference = panel.masks[index]!;
    const end = reference.offset + reference.byteLength;
    const packed = REFLECT_APPLY(UINT8_ARRAY_SUBARRAY, packedRole, [reference.offset, end]);
    if (sourceEvidenceDigest(packed) !== reference.packedDigest) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} ${reference.name} packed bytes do not reproduce.`,
      );
    }
    const unpacked = unpackRealBuildCompiledBinaryMaskMsb(
      packed,
      reference.width,
      reference.height,
    );
    if (
      sourceEvidenceDigest(unpacked) !== reference.unpackedDigest ||
      !sourceEvidenceEqualBytes(unpacked, expected[reference.name])
    ) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} ${reference.name} does not equal independently derived bytes.`,
      );
    }
  }
}

function verifyDescriptors(
  panel: RealBuildBrowserOutputV4SourceEvidencePanel,
  work: Uint8Array,
  derived: ReturnType<typeof deriveExpected>,
): void {
  const candidate = derived.candidate;
  const ownMeasure = candidate.ownPanel.sourceDescriptorInputs.measure;
  const ownRecommendation = candidate.ownPanel.sourceDescriptorInputs.measureRecommendation;
  const lookaheadMeasure = candidate.lookahead.sourceDescriptorInputs.measure;
  const lookaheadRecommendation = candidate.lookahead.sourceDescriptorInputs.measureRecommendation;
  if (
    sourceEvidenceDigest(work) !== panel.workPixelsDigest ||
    candidate.workPixelsDigest !== panel.workPixelsDigest ||
    candidate.policyDescriptorDigest !== panel.policyDescriptorDigest ||
    candidate.derivationDescriptorDigest !== panel.derivationDescriptorDigest ||
    candidate.assemblyMaskDigest !== panel.assemblyMaskDigest ||
    ownMeasure !== "iou" ||
    ownRecommendation !== ownMeasure ||
    panel.ownPanel.measure !== ownMeasure ||
    candidate.ownPanel.sourceDescriptorDigest !== panel.ownPanel.sourceDescriptorDigest ||
    candidate.ownPanel.exclusionDescriptorDigest !== panel.ownPanel.exclusionDescriptorDigest ||
    (lookaheadMeasure !== "iou" && lookaheadMeasure !== "containment") ||
    lookaheadRecommendation !== lookaheadMeasure ||
    panel.lookahead.measure !== lookaheadMeasure ||
    candidate.lookahead.sourceDescriptorDigest !== panel.lookahead.sourceDescriptorDigest ||
    candidate.lookahead.exclusionDescriptorDigest !== panel.lookahead.exclusionDescriptorDigest
  ) {
    throw new TypeError(
      `Source evidence step ${panel.stepNumber} canonical candidate or source/exclusion descriptor digests do not reproduce.`,
    );
  }
}

/** Parses all 359 descriptors without loading any panel payload. */
export function beginRealBuildBrowserOutputV4SourceEvidenceInspection(
  manifestBytes: unknown,
  preparedRunInputInspection: unknown,
): RealBuildBrowserOutputV4SourceEvidenceInspectionSession {
  if (IS_PROXY(manifestBytes)) {
    throw new TypeError("Source evidence manifest bytes may not be a Proxy.");
  }
  const manifest = parseRealBuildBrowserOutputV4SourceEvidenceManifest(manifestBytes);
  const preparedBinding = bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(
    preparedRunInputInspection,
    manifest.panels,
  );
  if (
    preparedBinding.preparedRunInputDigest !== manifest.preparedRunInputDigest ||
    preparedBinding.pdfDigest !== manifest.pdfDigest
  ) {
    throw new TypeError(
      "Source evidence manifest does not bind the supplied exact prepared-run/PDF inspection.",
    );
  }
  const session = intrinsicRealBuildFreeze({
    schemaVersion:
      "lego.real-build-browser-output-v4-source-evidence-inspection-session/1" as const,
    authority: "absent" as const,
  });
  REFLECT_APPLY(WEAK_MAP_SET, STATES, [
    session,
    { manifest, nextStep: 1, finished: false, inFlight: false },
  ]);
  return session;
}

/** Verifies one panel and advances only after every byte and descriptor reproduces. */
export function inspectRealBuildBrowserOutputV4SourceEvidencePanel(
  sessionValue: unknown,
  stepNumberValue: unknown,
  highRgbaValue: unknown,
  workRgbaValue: unknown,
  packedMaskValue: unknown,
): RealBuildBrowserOutputV4SourceEvidencePanelInspection {
  const state = stateFor(sessionValue);
  if (state.inFlight) {
    throw new TypeError(
      `Source evidence inspection is already verifying sequential step ${state.nextStep}; reentrant panel verification is refused.`,
    );
  }
  state.inFlight = true;
  try {
    if (state.finished)
      throw new TypeError("Source evidence inspection session is already finished.");
    if (
      !NUMBER_IS_SAFE_INTEGER(stepNumberValue) ||
      (stepNumberValue as number) !== state.nextStep
    ) {
      throw new RangeError(
        `Source evidence inspection requires sequential step ${state.nextStep}; the supplied step number was different or was not a safe integer.`,
      );
    }
    if (IS_PROXY(highRgbaValue))
      throw new TypeError("Source evidence high RGBA may not be a Proxy.");
    if (IS_PROXY(workRgbaValue))
      throw new TypeError("Source evidence work RGBA may not be a Proxy.");
    if (IS_PROXY(packedMaskValue))
      throw new TypeError("Source evidence packed masks may not be a Proxy.");
    const panel = state.manifest.panels[state.nextStep - 1]!;
    const high = sourceEvidenceCopyBytes(
      highRgbaValue,
      ["Uint8Array"],
      panel.roles[0]!.byteLength,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
      `Source evidence step ${panel.stepNumber} high RGBA role`,
    );
    const work = sourceEvidenceCopyBytes(
      workRgbaValue,
      ["Uint8Array"],
      panel.roles[1]!.byteLength,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
      `Source evidence step ${panel.stepNumber} work RGBA role`,
    );
    const packed = sourceEvidenceCopyBytes(
      packedMaskValue,
      ["Uint8Array"],
      panel.roles[2]!.byteLength,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
      `Source evidence step ${panel.stepNumber} packed-mask role`,
    );
    requireRealBuildSourceDerivationPrimordials();
    if (
      sourceEvidenceDigest(high) !== panel.roles[0]!.digest ||
      sourceEvidenceDigest(work) !== panel.roles[1]!.digest ||
      sourceEvidenceDigest(packed) !== panel.roles[2]!.digest
    ) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} role digest does not reproduce.`,
      );
    }
    const downsampled = downsampleRaster(
      { width: panel.highWidth, height: panel.highHeight, pixels: new Uint8ClampedArray(high) },
      panel.workFactor,
    );
    if (!sourceEvidenceEqualBytes(new Uint8Array(downsampled.pixels), work)) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} work RGBA is not the deterministic downsample of high RGBA.`,
      );
    }
    const derived = deriveExpected(panel, high, work);
    verifyMasks(panel, packed, derived.masks);
    verifyDescriptors(panel, work, derived);
    state.nextStep += 1;
    return intrinsicRealBuildFreeze({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      reproducible: true as const,
      highRgba: "verified" as const,
      workRgbaDownsample: "verified" as const,
      masks: "verified" as const,
      descriptorDigests: "verified" as const,
      provenanceAuthority: "absent" as const,
      sourceExecutionProvenance: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
      placementAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
      completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
    });
  } finally {
    state.inFlight = false;
  }
}

/** Completes only after the exact dense 359-panel stream has reproduced. */
export function finishRealBuildBrowserOutputV4SourceEvidenceInspection(
  sessionValue: unknown,
): RealBuildBrowserOutputV4SourceEvidenceInspection {
  const state = stateFor(sessionValue);
  if (state.finished)
    throw new TypeError("Source evidence inspection session is already finished.");
  if (state.nextStep !== 360) {
    throw new TypeError(
      `Source evidence inspection verified ${state.nextStep - 1} panels; exactly 359 are required.`,
    );
  }
  state.finished = true;
  const inspection = intrinsicRealBuildFreeze({
    manifest: state.manifest,
    reproducible: true as const,
    provenanceAuthority: "absent" as const,
    sourceExecutionProvenance: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
    placementAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
  });
  REFLECT_APPLY(WEAK_SET_ADD, INSPECTIONS, [inspection]);
  return inspection;
}

/** Accepts only the exact final result minted after all 359 panels reproduced. */
export function requireRealBuildBrowserOutputV4SourceEvidenceInspection(
  value: unknown,
): RealBuildBrowserOutputV4SourceEvidenceInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    IS_PROXY(value) ||
    !REFLECT_APPLY(WEAK_SET_HAS, INSPECTIONS, [value])
  ) {
    throw new TypeError("Source evidence requires the exact branded finished inspection.");
  }
  return value as RealBuildBrowserOutputV4SourceEvidenceInspection;
}
