import type { Sha256Digest } from "@lego-studio/brick-kernel";

export const REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA =
  "lego.real-build-observation-source-stage-trace/1" as const;
export const REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE = "observation-source-stage-bytes" as const;
export const REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING =
  "packed-binary-mask-msb/1" as const;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS = 4_194_304;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS = 1_048_576;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR = 4;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES = 128 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_VERIFICATION_PIXELS =
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES * 8;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS = 359;
export const MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_COMPONENT_SUMMARIES = 16;

export const REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER = [
  "high-cleaned-art",
  "high-art-key-downsampled",
  "high-printed-furniture-downsampled",
  "high-callout-clear-downsampled",
  "high-cleaned-art-downsampled",
  "isolate-then-downsample",
  "downsample-then-isolate",
] as const;

export type RealBuildObservationSourceStageName =
  (typeof REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER)[number];

export interface RealBuildObservationSourceStageMaskReference {
  readonly stage: RealBuildObservationSourceStageName;
  readonly scale: "high" | "work";
  readonly role: typeof REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE;
  readonly encoding: typeof REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING;
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly offset: number;
  readonly bytes: number;
  readonly lowPaddingBits: number;
  readonly packedDigest: Sha256Digest;
  readonly unpackedDigest: Sha256Digest;
}

export interface RealBuildObservationSourceStageComponentSummary {
  readonly scanIndex: number;
  readonly seedPixel: number;
  readonly areaPx: number;
  readonly bounds: {
    readonly minXPx: number;
    readonly minYPx: number;
    readonly maxXPx: number;
    readonly maxYPx: number;
  };
  readonly touchesLeft: boolean;
  readonly touchesRight: boolean;
  readonly touchesTop: boolean;
  readonly touchesBottom: boolean;
}

export interface RealBuildObservationSourceStageComponentFacts {
  readonly width: number;
  readonly height: number;
  readonly componentCount: number;
  readonly setPixels: number;
  readonly componentPartitionDigest: Sha256Digest;
  readonly maximumAreaPx: number;
  readonly largestComponentCount: number;
  readonly retainedTopComponents: readonly RealBuildObservationSourceStageComponentSummary[];
  readonly legacySelectedScanIndex: number | null;
  readonly unambiguousLargestSelectionScanIndex: number | null;
  readonly selectionRefusal:
    "no-component" | "equal-largest-components" | "frame-spanning-thin-component" | null;
}

export interface RealBuildObservationSourceStageTopologyComparison {
  readonly status: "equal" | "different";
  readonly differingPixels: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly iou: number | null;
}

export interface RealBuildObservationSourceStagePanelTrace {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly source: {
    readonly schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1";
    readonly reproduction: "not-claimed";
    readonly pdfDigest: Sha256Digest;
    readonly panelEvidenceDigest: Sha256Digest;
    readonly cropDescriptorDigest: Sha256Digest;
    readonly policyDescriptorDigest: Sha256Digest;
    readonly workPixelsDigest: Sha256Digest;
  };
  readonly dimensions: {
    readonly highWidth: number;
    readonly highHeight: number;
    readonly workWidth: number;
    readonly workHeight: number;
    readonly workFactor: number;
  };
  readonly highComponents: RealBuildObservationSourceStageComponentFacts;
  readonly downsampledComponents: RealBuildObservationSourceStageComponentFacts;
  readonly topology: RealBuildObservationSourceStageTopologyComparison;
  readonly workOnlyStage: {
    readonly status: "missing";
    readonly reason: "work-raster-candidate-is-not-coupled-to-panel-art-stages/1";
  };
  readonly stages: readonly RealBuildObservationSourceStageMaskReference[];
}

export interface RealBuildObservationSourceStageTrace {
  readonly schemaVersion: typeof REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA;
  readonly authority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "observation-source-stage-trace-is-inspection-only/1";
  };
  readonly coverage: {
    readonly expectedPanelCount: 359;
    readonly retainedPanelCount: number;
    readonly status: "partial" | "complete";
  };
  readonly role: {
    readonly name: typeof REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE;
    readonly bytes: number;
    readonly digest: Sha256Digest;
  };
  readonly panels: readonly RealBuildObservationSourceStagePanelTrace[];
}

export interface RealBuildObservationSourceStageTraceArtifact {
  readonly manifest: RealBuildObservationSourceStageTrace;
  readonly manifestDigest: Sha256Digest;
  readonly readManifestBytes: () => Uint8Array;
  readonly readRoleBytes: () => Uint8Array;
}
