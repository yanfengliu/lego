import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildSourceParityBounds } from "./real-build-observation-source-parity-types";
import type { RealBuildPreparedRunInputInspection } from "./real-build-prepared-step-authority";

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA =
  "lego.real-build-browser-output-v4-source-evidence/1" as const;

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES = Object.freeze([
  "source-high-rgba8",
  "source-work-rgba8",
  "source-masks-packed-msb",
] as const);

export type RealBuildBrowserOutputV4SourceEvidenceRole =
  (typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES)[number];

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS = Object.freeze({
  "source-high-rgba8": "rgba8-clamped/1",
  "source-work-rgba8": "rgba8-clamped/1",
  "source-masks-packed-msb": "packed-binary-mask-msb/1",
} as const);

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS = Object.freeze([
  "H",
  "P",
  "D",
  "W",
  "own-panel-source",
  "own-panel-exclusion",
  "lookahead-source",
  "lookahead-exclusion",
] as const);

export type RealBuildBrowserOutputV4SourceEvidenceMask =
  (typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS)[number];

export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS = 359;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_CALLOUTS = 1_024;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES = 4 * 4_194_304;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES = 4 * 1_048_576;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES =
  Math.ceil(4_194_304 / 8) + 7 * Math.ceil(1_048_576 / 8);
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS = 96_000_000;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS = 384_000_000;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES =
  128 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES = 64 * 1024 * 1024;
/** External storage ceiling; no reader call allocates this aggregate contiguously. */
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES = 2_080_000_000;

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason:
    "source-evidence-is-reproducible-inspection-not-placement-or-completion-authority/1" as const,
});

export const REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE = Object.freeze({
  status: "absent" as const,
  reason: "pdf-render-execution-and-provisional-step-identity-not-bound/1" as const,
});

export interface RealBuildBrowserOutputV4SourceEvidenceRoleDescriptor {
  readonly role: RealBuildBrowserOutputV4SourceEvidenceRole;
  readonly contentEncoding: (typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS)[RealBuildBrowserOutputV4SourceEvidenceRole];
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4SourceEvidenceByteReference {
  readonly role: "source-high-rgba8" | "source-work-rgba8";
  readonly offset: number;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4SourceEvidenceMaskReference {
  readonly name: RealBuildBrowserOutputV4SourceEvidenceMask;
  readonly role: "source-masks-packed-msb";
  readonly contentEncoding: "packed-binary-mask-msb/1";
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly offset: number;
  readonly byteLength: number;
  readonly lowPaddingBits: number;
  readonly packedDigest: Sha256Digest;
  readonly unpackedDigest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4SourceEvidencePanel extends RealBuildSourceParityBounds {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly calloutBoxes: readonly RealBuildSourceParityBounds[];
  readonly panelEvidenceDigest: Sha256Digest;
  readonly cropDescriptorDigest: Sha256Digest;
  readonly highWidth: number;
  readonly highHeight: number;
  readonly highPixelCount: number;
  readonly workWidth: number;
  readonly workHeight: number;
  readonly workPixelCount: number;
  readonly workFactor: 2;
  readonly roles: readonly RealBuildBrowserOutputV4SourceEvidenceRoleDescriptor[];
  readonly highRgba: RealBuildBrowserOutputV4SourceEvidenceByteReference;
  readonly workRgba: RealBuildBrowserOutputV4SourceEvidenceByteReference;
  readonly masks: readonly RealBuildBrowserOutputV4SourceEvidenceMaskReference[];
  readonly workPixelsDigest: Sha256Digest;
  readonly policyDescriptorDigest: Sha256Digest;
  readonly derivationDescriptorDigest: Sha256Digest;
  readonly assemblyMaskDigest: Sha256Digest;
  readonly ownPanel: {
    readonly measure: "iou";
    readonly sourceDescriptorDigest: Sha256Digest;
    readonly exclusionDescriptorDigest: Sha256Digest;
  };
  readonly lookahead: {
    readonly measure: "iou" | "containment";
    readonly sourceDescriptorDigest: Sha256Digest;
    readonly exclusionDescriptorDigest: Sha256Digest;
  };
}

export interface RealBuildBrowserOutputV4SourceEvidenceManifest {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA;
  readonly authority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY;
  readonly sourceExecutionProvenance: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE;
  readonly coverage: {
    readonly expectedPanelCount: 359;
    readonly retainedPanelCount: 359;
    readonly status: "complete";
  };
  readonly preparedRunInputDigest: Sha256Digest;
  readonly pdfDigest: Sha256Digest;
  readonly preparedPanelsDigest: Sha256Digest;
  readonly rasterPolicy: {
    readonly renderScale: 6;
    readonly panelWidth: 1_000;
    readonly workFactor: 2;
  };
  readonly aggregate: {
    readonly highRgbaBytes: number;
    readonly workRgbaBytes: number;
    readonly maskBytes: number;
    readonly totalRoleBytes: number;
    readonly totalHighPixels: number;
    readonly totalWorkPixels: number;
  };
  readonly panels: readonly RealBuildBrowserOutputV4SourceEvidencePanel[];
}

export interface RealBuildBrowserOutputV4SourceEvidencePanelInput {
  readonly pdfDigest: Sha256Digest;
  readonly panel: Readonly<{
    stepNumber: number;
    pageNumber: number;
    minXPt: number;
    maxXPt: number;
    minYPt: number;
    maxYPt: number;
    calloutBoxes: readonly RealBuildSourceParityBounds[];
    panelEvidenceDigest: Sha256Digest;
  }>;
  readonly highRgba: Uint8ClampedArray;
  readonly workRgba: Uint8ClampedArray;
}

export interface CreateRealBuildBrowserOutputV4SourceEvidenceManifestInput {
  readonly preparedRunInputInspection: RealBuildPreparedRunInputInspection;
  readonly panels: readonly RealBuildBrowserOutputV4SourceEvidencePanel[];
}

export interface RealBuildBrowserOutputV4SourceEvidencePanelArtifact {
  readonly descriptor: RealBuildBrowserOutputV4SourceEvidencePanel;
  readonly highRgbaBytes: Uint8Array;
  readonly workRgbaBytes: Uint8Array;
  readonly packedMaskBytes: Uint8Array;
}

export interface RealBuildBrowserOutputV4SourceEvidenceManifestArtifact {
  readonly manifest: RealBuildBrowserOutputV4SourceEvidenceManifest;
  readonly manifestDigest: Sha256Digest;
  readManifestBytes(): Uint8Array;
}

export interface RealBuildBrowserOutputV4SourceEvidenceInspection {
  readonly manifest: RealBuildBrowserOutputV4SourceEvidenceManifest;
  readonly reproducible: true;
  readonly provenanceAuthority: "absent";
  readonly sourceExecutionProvenance: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE;
  readonly placementAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY;
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY;
}

export interface RealBuildBrowserOutputV4SourceEvidenceInspectionSession {
  readonly schemaVersion: "lego.real-build-browser-output-v4-source-evidence-inspection-session/1";
  readonly authority: "absent";
}

export interface RealBuildBrowserOutputV4SourceEvidencePanelInspection {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly reproducible: true;
  readonly highRgba: "verified";
  readonly workRgbaDownsample: "verified";
  readonly masks: "verified";
  readonly descriptorDigests: "verified";
  readonly provenanceAuthority: "absent";
  readonly sourceExecutionProvenance: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE;
  readonly placementAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY;
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY;
}

export interface RealBuildBrowserOutputV4SourceEvidencePanelBytes {
  readonly highRgba: Uint8Array;
  readonly workRgba: Uint8Array;
  readonly masks: Readonly<Record<RealBuildBrowserOutputV4SourceEvidenceMask, Uint8Array>>;
}
