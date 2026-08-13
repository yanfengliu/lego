import { canonicalDigest, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { alreadyBuiltMask, highlightExclusionMask } from "../src/assembly/arrow-placement";
import { isolateAssembly, keyPanelArt, keyPrintedBoxes } from "../src/assembly/panel-art";
import { extractHighlightRegions } from "../src/instructions/highlight-region";
import {
  classifyRealBuildLookaheadMeasure,
  type RealBuildLookaheadMeasureClassification,
} from "./real-build-lookahead-measure";
import {
  clearObservationSourceCandidateCalloutRectangles,
  mapObservationSourceCandidateCalloutRectangles,
  MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_GRID_CELLS,
  OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_CLEARING_POLICY,
  type ObservationSourceCandidatePdfBox,
} from "./real-build-observation-source-raster-candidate-callouts";
import {
  snapshotObservationSourceCandidateCallouts,
  snapshotObservationSourceCandidateRgba,
} from "./real-build-observation-source-raster-candidate-input";
import {
  createRealBuildObservationSourceRasterCandidateMask,
  type RealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate-mask";

export {
  unpackRealBuildObservationSourceRasterCandidateMask,
  type RealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate-mask";

/**
 * A work-raster-only candidate for independently deriving observation masks.
 *
 * This deliberately does not claim parity with the current high-resolution-then-downsampled
 * browser path. It has no authority and remains a candidate until an all-359-panel measurement
 * establishes where the two derivations agree and where a versioned replacement is needed.
 */
export const REAL_BUILD_OBSERVATION_SOURCE_RASTER_CANDIDATE_SCHEMA =
  "lego.real-build-observation-source-raster-candidate/1" as const;
export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_PIXELS = 1_048_576;
export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS = 1_024;
export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_HIGHLIGHT_FILL_PIXELS =
  64 * MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_PIXELS;

const BACKGROUND_HEX = 0x899093;
const BACKGROUND_TOLERANCE_LEVELS = 10;
const PRINTED_BOX_WHITE_LEVEL = 246;
const PRINTED_BOX_HIGH_RESOLUTION_MINIMUM_AREA_PX = 400;
const PRINTED_BOX_HIGH_RESOLUTION_MARGIN_PX = 6;
const CALLOUT_HIGH_RESOLUTION_MARGIN_PX = 4;
const HIGHLIGHT_HIGH_RESOLUTION_MINIMUM_OUTLINE_PX = 40;
const HIGHLIGHT_MINIMUM_OUTLINE_FLOOR_PX = 10;
const HIGHLIGHT_CLOSE_RADIUS_PX = 2;

export interface ObservationSourceRasterCandidateMode {
  readonly mode: "lookahead" | "own-panel";
  readonly builtMask: RealBuildObservationSourceRasterCandidateMask;
  readonly builtMaskDigest: Sha256Digest;
  readonly excludedMask: RealBuildObservationSourceRasterCandidateMask;
  readonly excludedMaskDigest: Sha256Digest;
  readonly sourceDescriptorInputs: Readonly<Record<string, unknown>>;
  readonly sourceDescriptorDigest: Sha256Digest;
  readonly exclusionDescriptorInputs: Readonly<Record<string, unknown>>;
  readonly exclusionDescriptorDigest: Sha256Digest;
}

export interface RealBuildObservationSourceRasterCandidate {
  readonly schemaVersion: typeof REAL_BUILD_OBSERVATION_SOURCE_RASTER_CANDIDATE_SCHEMA;
  readonly authority: "absent";
  readonly width: number;
  readonly height: number;
  readonly workFactor: number;
  readonly workPixelsDigest: Sha256Digest;
  readonly assemblyMask: RealBuildObservationSourceRasterCandidateMask;
  readonly assemblyMaskDigest: Sha256Digest;
  readonly policyDescriptorInputs: Readonly<Record<string, unknown>>;
  readonly policyDescriptorDigest: Sha256Digest;
  readonly derivationDescriptorInputs: Readonly<Record<string, unknown>>;
  readonly derivationDescriptorDigest: Sha256Digest;
  readonly lookahead: ObservationSourceRasterCandidateMode;
  readonly ownPanel: ObservationSourceRasterCandidateMode;
}

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function described(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "undefined") {
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  return `a ${typeof value}`;
}

function positiveSafeInteger(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `${label} must be a positive safe integer; received ${described(value)}. ` +
        "Pass the exact dimensions and integer work factor used to create the retained RGBA raster.",
    );
  }
  return value;
}

function finite(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(
      `${label} must be a finite PDF-point coordinate; received ${described(value)}. ` +
        "Pass the printed panel or callout bounds recorded by preparation.",
    );
  }
  return value;
}

function snapshotCalloutBounds(value: unknown): Float64Array {
  const snapshot = snapshotObservationSourceCandidateCallouts(
    value,
    MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS * 4,
  );
  if (snapshot.length % 4 !== 0) {
    throw new RangeError(
      `Observation source candidate callouts hold ${snapshot.length} coordinates, which is not a whole minX,maxX,minY,maxY group. ` +
        "Pass four PDF-point coordinates per callout box.",
    );
  }
  return snapshot;
}

function sourceMode(
  mode: "lookahead" | "own-panel",
  derivationDescriptorDigest: Sha256Digest,
  builtMask: RealBuildObservationSourceRasterCandidateMask,
  excludedMask: RealBuildObservationSourceRasterCandidateMask,
  lookaheadMeasure: RealBuildLookaheadMeasureClassification,
): ObservationSourceRasterCandidateMode {
  const builtMaskDigest = builtMask.unpackedDigest;
  const excludedMaskDigest = excludedMask.unpackedDigest;
  const measureClassifierInputs =
    mode === "lookahead"
      ? lookaheadMeasure
      : Object.freeze({
          schemaVersion: "lego.real-build-own-panel-measure-classifier/1",
          rule: "fixed-whole-child-silhouette-iou/1",
          measure: "iou" as const,
        });
  const measure = mode === "lookahead" ? lookaheadMeasure.measure : "iou";
  const sourceDescriptorInputs = Object.freeze({
    schemaVersion: "lego.real-build-observation-source-raster-descriptor-input/1",
    authority: "absent",
    derivationDescriptorDigest,
    mode,
    observationTarget:
      mode === "lookahead"
        ? "lookahead-built-prefix/1"
        : "own-panel-isolated-printed-assembly-art/1",
    highlightTreatment:
      mode === "lookahead" ? "removed-from-source-and-excluded/1" : "retained-as-printed/1",
    measure,
    measureRecommendation: measure,
    measureClassifierInputs,
    measureClassifierDigest: canonicalDigest(measureClassifierInputs),
    sourceMaskSemantics:
      mode === "lookahead" ? "already-built-minus-highlight" : "full-isolated-own-panel-assembly",
    sourceMaskDigest: builtMaskDigest,
  });
  const exclusionDescriptorInputs = Object.freeze({
    schemaVersion: "lego.real-build-observation-exclusion-raster-descriptor-input/1",
    authority: "absent",
    derivationDescriptorDigest,
    mode,
    exclusionMaskSemantics:
      mode === "lookahead" ? "highlight-region-or-undilated-stroke/1" : "zero-mask/1",
    exclusionMaskDigest: excludedMaskDigest,
  });
  return Object.freeze({
    mode,
    builtMask,
    builtMaskDigest,
    excludedMask,
    excludedMaskDigest,
    sourceDescriptorInputs,
    sourceDescriptorDigest: canonicalDigest(sourceDescriptorInputs),
    exclusionDescriptorInputs,
    exclusionDescriptorDigest: canonicalDigest(exclusionDescriptorInputs),
  });
}

/**
 * Derives both candidate observation modes from exact positional input.
 *
 * Callouts are flat PDF-point groups in the same bottom-origin coordinate system as the panel.
 * Mapping them relative to the panel bounds makes row zero the panel top without consulting an
 * ambient page height, viewport, DOM canvas, or caller-owned options object.
 */
export function deriveRealBuildObservationSourceRasterCandidate(
  ...input: readonly [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
): RealBuildObservationSourceRasterCandidate {
  const [
    widthValue,
    heightValue,
    workFactorValue,
    rgbaValue,
    panelMinXValue,
    panelMaxXValue,
    panelMinYValue,
    panelMaxYValue,
    calloutBoundsValue,
  ] = input;
  const width = positiveSafeInteger("Observation source candidate width", widthValue);
  const height = positiveSafeInteger("Observation source candidate height", heightValue);
  const workFactor = positiveSafeInteger(
    "Observation source candidate work factor",
    workFactorValue,
  );
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(pixelCount) ||
    pixelCount > MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_PIXELS
  ) {
    throw new RangeError(
      `Observation source candidate raster ${width}x${height} exceeds the ${MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_PIXELS}-pixel bound. ` +
        "Reject or resample the retained panel before deriving observation masks.",
    );
  }
  const pixels = snapshotObservationSourceCandidateRgba(rgbaValue, pixelCount * 4);
  const panelMinXPt = finite("Observation source candidate panel minX", panelMinXValue);
  const panelMaxXPt = finite("Observation source candidate panel maxX", panelMaxXValue);
  const panelMinYPt = finite("Observation source candidate panel minY", panelMinYValue);
  const panelMaxYPt = finite("Observation source candidate panel maxY", panelMaxYValue);
  if (panelMaxXPt <= panelMinXPt || panelMaxYPt <= panelMinYPt) {
    throw new RangeError(
      `Observation source candidate panel bounds ${panelMinXPt},${panelMaxXPt},${panelMinYPt},${panelMaxYPt} do not have positive width and height. ` +
        "Pass the exact prepared panel PDF-point bounds in minX,maxX,minY,maxY order.",
    );
  }
  const calloutValues = snapshotCalloutBounds(calloutBoundsValue);
  const panelWidthPt = panelMaxXPt - panelMinXPt;
  const panelHeightPt = panelMaxYPt - panelMinYPt;
  if (!Number.isFinite(panelWidthPt) || !Number.isFinite(panelHeightPt)) {
    throw new RangeError(
      `Observation source candidate panel spans are ${String(panelWidthPt)} by ${String(panelHeightPt)} PDF points after subtracting bounds. Pass finite bounds whose positive width and height do not overflow.`,
    );
  }
  const retainedCallouts: ObservationSourceCandidatePdfBox[] = [];
  for (let index = 0; index < calloutValues.length; index += 4) {
    const suppliedMinX = finite(
      `Observation source candidate callout ${index / 4} minX`,
      calloutValues[index],
    );
    const suppliedMaxX = finite(
      `Observation source candidate callout ${index / 4} maxX`,
      calloutValues[index + 1],
    );
    const suppliedMinY = finite(
      `Observation source candidate callout ${index / 4} minY`,
      calloutValues[index + 2],
    );
    const suppliedMaxY = finite(
      `Observation source candidate callout ${index / 4} maxY`,
      calloutValues[index + 3],
    );
    if (suppliedMaxX <= suppliedMinX || suppliedMaxY <= suppliedMinY) {
      throw new RangeError(
        `Observation source candidate callout ${index / 4} bounds ${suppliedMinX},${suppliedMaxX},${suppliedMinY},${suppliedMaxY} do not have positive width and height. ` +
          "Pass each prepared callout in minX,maxX,minY,maxY order.",
      );
    }
    retainedCallouts.push(
      Object.freeze({
        minXPt: suppliedMinX,
        maxXPt: suppliedMaxX,
        minYPt: suppliedMinY,
        maxYPt: suppliedMaxY,
      }),
    );
  }

  const printedBoxMinimumAreaPx = Math.ceil(
    PRINTED_BOX_HIGH_RESOLUTION_MINIMUM_AREA_PX / workFactor / workFactor,
  );
  const printedBoxMarginPx = Math.ceil(PRINTED_BOX_HIGH_RESOLUTION_MARGIN_PX / workFactor);
  const calloutMarginPx = Math.ceil(CALLOUT_HIGH_RESOLUTION_MARGIN_PX / workFactor);
  const highlightMinimumOutlinePx = Math.max(
    HIGHLIGHT_MINIMUM_OUTLINE_FLOOR_PX,
    Math.round(HIGHLIGHT_HIGH_RESOLUTION_MINIMUM_OUTLINE_PX / workFactor),
  );
  const policyDescriptorInputs = Object.freeze({
    schemaVersion: "lego.real-build-observation-source-raster-policy-input/1",
    backgroundHex: BACKGROUND_HEX,
    backgroundToleranceLevels: BACKGROUND_TOLERANCE_LEVELS,
    printedBoxWhiteLevel: PRINTED_BOX_WHITE_LEVEL,
    printedBoxHighResolutionMinimumAreaPx: PRINTED_BOX_HIGH_RESOLUTION_MINIMUM_AREA_PX,
    printedBoxHighResolutionMarginPx: PRINTED_BOX_HIGH_RESOLUTION_MARGIN_PX,
    printedBoxMinimumAreaPx,
    printedBoxMarginPx,
    calloutHighResolutionMarginPx: CALLOUT_HIGH_RESOLUTION_MARGIN_PX,
    calloutMarginPx,
    calloutMapping: "panel-relative-bottom-origin-pdf-points-to-top-origin-work-raster/1",
    calloutMaximumBoxes: MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS,
    calloutClearingPolicy: OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_CLEARING_POLICY,
    calloutClearingMaximumDifferenceGridCells:
      MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_GRID_CELLS,
    calloutClearingMaximumCornerUpdates: MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS * 4,
    calloutClearingMaximumMaskPixelVisits: MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_PIXELS,
    highlightHighResolutionMinimumOutlinePx: HIGHLIGHT_HIGH_RESOLUTION_MINIMUM_OUTLINE_PX,
    highlightMinimumOutlineFloorPx: HIGHLIGHT_MINIMUM_OUTLINE_FLOOR_PX,
    highlightMinimumOutlinePx,
    highlightCloseRadiusPx: HIGHLIGHT_CLOSE_RADIUS_PX,
    highlightMaximumAggregateCandidateMaskPixels:
      MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_HIGHLIGHT_FILL_PIXELS,
    isolationConnectivity: 4,
    isolationSelection: "largest-component",
    isolationOpeningRadiusPx: 0,
  });
  const policyDescriptorDigest = canonicalDigest(policyDescriptorInputs);
  const panelBounds = Object.freeze({ panelMinXPt, panelMaxXPt, panelMinYPt, panelMaxYPt });
  const retainedCalloutBounds = Object.freeze(retainedCallouts);
  const mappedCalloutRectangles = mapObservationSourceCandidateCalloutRectangles({
    width,
    height,
    marginPx: calloutMarginPx,
    panelBounds,
    callouts: retainedCalloutBounds,
  });

  const raster = { width, height, pixels };
  const artMask = keyPanelArt(raster, {
    backgroundHex: BACKGROUND_HEX,
    toleranceLevels: BACKGROUND_TOLERANCE_LEVELS,
  });
  const furnitureMask = keyPrintedBoxes(raster, {
    whiteLevel: PRINTED_BOX_WHITE_LEVEL,
    minimumAreaPx: printedBoxMinimumAreaPx,
    marginPx: printedBoxMarginPx,
  });
  for (let index = 0; index < artMask.length; index += 1) {
    if (furnitureMask[index] === 1) artMask[index] = 0;
  }
  clearObservationSourceCandidateCalloutRectangles(artMask, width, height, mappedCalloutRectangles);
  const assemblyMaskBytes = isolateAssembly(
    { width, height, mask: artMask },
    { openingRadiusPx: 0 },
  ).mask;
  const highlight = extractHighlightRegions(pixels, width, height, {
    minimumOutlinePx: highlightMinimumOutlinePx,
    closeRadiusPx: HIGHLIGHT_CLOSE_RADIUS_PX,
    maximumAggregateCandidateMaskPixels:
      MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_HIGHLIGHT_FILL_PIXELS,
  });
  const lookaheadMeasure = classifyRealBuildLookaheadMeasure(highlight);
  const lookaheadBuiltMask = alreadyBuiltMask(
    assemblyMaskBytes,
    highlight.mask,
    highlight.strokeMask,
    width,
    height,
  );
  const lookaheadExcludedMask = highlightExclusionMask(
    highlight.mask,
    highlight.strokeMask,
    width,
    height,
  );
  const ownPanelExcludedMask = new Uint8Array(pixelCount);
  const workPixelsDigest = rawDigest(Uint8Array.from(pixels));
  const assemblyMaskDigest = rawDigest(assemblyMaskBytes);
  const derivationDescriptorInputs = Object.freeze({
    schemaVersion: "lego.real-build-observation-source-raster-derivation-input/1",
    authority: "absent",
    width,
    height,
    workFactor,
    workPixelsDigest,
    panelBounds,
    calloutBoundsDigest: canonicalDigest(retainedCalloutBounds),
    mappedCalloutRectanglesDigest: canonicalDigest(mappedCalloutRectangles),
    policyDescriptorDigest,
    assemblyMaskDigest,
    highlightMaskDigest: rawDigest(highlight.mask),
    highlightStrokeMaskDigest: rawDigest(highlight.strokeMask),
  });
  const derivationDescriptorDigest = canonicalDigest(derivationDescriptorInputs);
  const retainedMasks = new Map<Sha256Digest, RealBuildObservationSourceRasterCandidateMask>();
  const retainMask = (mask: Uint8Array): RealBuildObservationSourceRasterCandidateMask => {
    const digest = rawDigest(mask);
    const retained = retainedMasks.get(digest);
    if (retained !== undefined) return retained;
    const created = createRealBuildObservationSourceRasterCandidateMask(mask, width, height);
    retainedMasks.set(digest, created);
    return created;
  };
  const assemblyMask = retainMask(assemblyMaskBytes);
  const lookaheadBuilt = retainMask(lookaheadBuiltMask);
  const lookaheadExcluded = retainMask(lookaheadExcludedMask);
  const ownPanelExcluded = retainMask(ownPanelExcludedMask);

  return Object.freeze({
    schemaVersion: REAL_BUILD_OBSERVATION_SOURCE_RASTER_CANDIDATE_SCHEMA,
    authority: "absent",
    width,
    height,
    workFactor,
    workPixelsDigest,
    assemblyMask,
    assemblyMaskDigest,
    policyDescriptorInputs,
    policyDescriptorDigest,
    derivationDescriptorInputs,
    derivationDescriptorDigest,
    lookahead: sourceMode(
      "lookahead",
      derivationDescriptorDigest,
      lookaheadBuilt,
      lookaheadExcluded,
      lookaheadMeasure,
    ),
    ownPanel: sourceMode(
      "own-panel",
      derivationDescriptorDigest,
      assemblyMask,
      ownPanelExcluded,
      lookaheadMeasure,
    ),
  });
}
