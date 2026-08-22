import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type {
  RealBuildPreparedBrowserOutputBoundaryInspection,
  RealBuildPreparedRunInputInspection,
} from "./real-build-prepared-step-authority";
import type { RealBuildStepReport, StepFailure } from "./real-build-safety";

export const REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION =
  "lego.real-build-browser-output/4" as const;
export const MAXIMUM_REAL_BUILD_BROWSER_TRANSITION_EVIDENCE_BYTES = 8 * 1024 * 1024;

export const REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "browser-output-v4-requires-separate-trusted-user-admission" as const,
});

export type RealBuildBrowserOutputV4RoleName =
  | "branch-evidence-index"
  | "compiled-branch-evidence-bytes"
  | "branch-observation-bytes"
  | "source-evidence-manifest"
  | "camera-evidence-manifest"
  | "d4-child-render-rgba-bytes"
  | "transition-evidence-manifest";

export interface RealBuildBrowserOutputV4RoleBinding {
  readonly role: RealBuildBrowserOutputV4RoleName;
  readonly bytes: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4EvidenceBindings {
  readonly preparedRunInputDigest: Sha256Digest;
  readonly branchEvidence: RealBuildBrowserOutputV4RoleBinding;
  readonly compiledBranchRole: RealBuildBrowserOutputV4RoleBinding;
  readonly branchObservationRole: RealBuildBrowserOutputV4RoleBinding;
  readonly sourceManifest: RealBuildBrowserOutputV4RoleBinding;
  readonly cameraManifest: RealBuildBrowserOutputV4RoleBinding;
  readonly cameraRenderRole: RealBuildBrowserOutputV4RoleBinding;
  readonly cameraMaskRole: RealBuildBrowserOutputV4RoleBinding;
  readonly transitionManifest: RealBuildBrowserOutputV4RoleBinding;
}

export type RealBuildBrowserOutputV4EvidenceRoleKey = Exclude<
  keyof RealBuildBrowserOutputV4EvidenceBindings,
  "preparedRunInputDigest"
>;

export interface RealBuildBrowserOutputV4IdentityBinding {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export interface RealBuildBrowserOutputV4DetachedEnvelope {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION;
  readonly status: "executed" | "failed";
  readonly evidence: RealBuildBrowserOutputV4EvidenceBindings;
  readonly reports: readonly RealBuildStepReport[];
  readonly documentJson: string;
  readonly identityBindings: readonly RealBuildBrowserOutputV4IdentityBinding[];
  readonly fetchedPdfDigest: Sha256Digest;
  readonly failure?: StepFailure;
  readonly totalElapsedMs: number;
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY;
}

export interface RealBuildBrowserOutputV4EnvelopeInspection {
  readonly schemaVersion: "lego.real-build-browser-output-v4-envelope-inspection/1";
  readonly preparedRun: RealBuildPreparedRunInputInspection;
  readonly preparedBoundary: RealBuildPreparedBrowserOutputBoundaryInspection;
  readonly envelope: RealBuildBrowserOutputV4DetachedEnvelope;
  readonly terminalReportStepNumber: number | null;
  readonly authority: "absent";
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY;
}
