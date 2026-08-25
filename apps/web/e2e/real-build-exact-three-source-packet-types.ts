import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { ScopedRealBuildPanelEvidence } from "./real-build-panel-evidence";
import type {
  RealBuildBrowserOutputV4SourceEvidencePanel,
  RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
  RealBuildBrowserOutputV4SourceEvidenceRole,
} from "./real-build-browser-output-v4-source-evidence-types";

export const REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION =
  "lego.real-build-exact-three-source-packet/1" as const;

export const REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS = Object.freeze([1, 2, 3] as const);
export const REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS = Object.freeze([2, 3, 4] as const);
export const REAL_BUILD_EXACT_THREE_PAGE_NUMBER = 11 as const;
export const REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT = 359 as const;
export const REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT = 4 as const;
export const REAL_BUILD_EXACT_THREE_SOURCE_ROLES = Object.freeze([
  "source-high-rgba8",
  "source-work-rgba8",
  "source-masks-packed-msb",
] as const);

export const REAL_BUILD_EXACT_THREE_SOURCE_ROLE_ENCODINGS = Object.freeze({
  "source-high-rgba8": "rgba8-clamped/1",
  "source-work-rgba8": "rgba8-clamped/1",
  "source-masks-packed-msb": "packed-binary-mask-msb/1",
} as const);

export const REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY = Object.freeze({
  sourceText: "caller-supplied-unverified" as const,
  sourceExecution: "absent" as const,
  preparedRun: "absent" as const,
  physicalFrame: "absent" as const,
  placement: "absent" as const,
  completion: "absent" as const,
});

export const MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES = 8 * 1024 * 1024;

export interface RealBuildExactThreeSourcePacketBounds {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface RealBuildExactThreeSourcePacketRoleDescriptor {
  readonly role: RealBuildBrowserOutputV4SourceEvidenceRole;
  readonly contentEncoding: (typeof REAL_BUILD_EXACT_THREE_SOURCE_ROLE_ENCODINGS)[RealBuildBrowserOutputV4SourceEvidenceRole];
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildExactThreeSourcePacketRoleSlice {
  readonly role: RealBuildBrowserOutputV4SourceEvidenceRole;
  readonly offset: number;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildExactThreeSourcePacketPanel {
  readonly placementStepNumber: 1 | 2 | 3;
  readonly registrationPanelStepNumber: 2 | 3 | 4;
  readonly pageNumber: typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER;
  readonly bounds: RealBuildExactThreeSourcePacketBounds;
  readonly calloutBoxes: readonly RealBuildExactThreeSourcePacketBounds[];
  readonly callerSourcePanelCommitmentDigest: Sha256Digest;
  readonly sourceArtifactDescriptor: RealBuildBrowserOutputV4SourceEvidencePanel;
  readonly roleSlices: readonly RealBuildExactThreeSourcePacketRoleSlice[];
}

export interface RealBuildExactThreeSourcePacketManifest {
  readonly schemaVersion: typeof REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION;
  readonly scope: Readonly<{
    placementStepNumbers: typeof REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS;
    registrationPanelStepNumbers: typeof REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS;
    calloutProbePageNumbers: readonly [typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER];
    indexedStepLabelCount: typeof REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT;
    materializedPagePanelCount: typeof REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT;
    emittedPanelCount: 3;
  }>;
  readonly binding: Readonly<{
    pdfBytesDigest: Sha256Digest;
    callerInstructionSourceSnapshotDigest: Sha256Digest;
    callerSourceContentHashClaimMatchedPdfBytes: true;
    sourceTextParserReplay: "not-performed";
  }>;
  readonly roles: readonly RealBuildExactThreeSourcePacketRoleDescriptor[];
  readonly panels: readonly RealBuildExactThreeSourcePacketPanel[];
  readonly authority: typeof REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY;
  readonly acceptedDocument: null;
}

export interface CreateRealBuildExactThreeSourcePacketInput {
  readonly scopedPanelEvidence: ScopedRealBuildPanelEvidence;
  readonly sourcePanels: readonly RealBuildBrowserOutputV4SourceEvidencePanelArtifact[];
}

export interface RealBuildExactThreeSourcePacketBytes {
  readonly manifestBytes: Uint8Array;
  readonly highRgbaRoleBytes: Uint8Array;
  readonly workRgbaRoleBytes: Uint8Array;
  readonly maskRoleBytes: Uint8Array;
}

export interface RealBuildExactThreeSourcePacketArtifact {
  readonly manifest: RealBuildExactThreeSourcePacketManifest;
  readonly manifestDigest: Sha256Digest;
  readonly authority: typeof REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY;
  readonly acceptedDocument: null;
}

export interface RealBuildExactThreeSourcePacketInspection {
  readonly manifest: RealBuildExactThreeSourcePacketManifest;
  readonly reproducible: true;
  readonly sourceExecutionAuthority: "absent";
  readonly preparedRunAuthority: "absent";
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: "absent";
  readonly acceptedDocument: null;
}
