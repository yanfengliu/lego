import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  RealBuildBrowserOutputV4EnvelopeInspection,
  RealBuildBrowserOutputV4IdentityBinding,
} from "./real-build-browser-output-v4-envelope";

export const REAL_BUILD_BROWSER_OUTPUT_V4_READER_INSPECTION_SCHEMA =
  "lego.real-build-browser-output-v4-inspection/1" as const;

export const REAL_BUILD_BROWSER_OUTPUT_V4_READER_ABSENT_COMPLETION_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "exact-prefix-replay-is-not-trusted-user-completion-admission" as const,
});

export interface RealBuildBrowserOutputV4Inspection {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_READER_INSPECTION_SCHEMA;
  readonly envelopeInspection: RealBuildBrowserOutputV4EnvelopeInspection;
  readonly status: "failed" | "executed";
  readonly retainedReports: number;
  readonly completedSteps: number;
  readonly throughStepNumber: number;
  readonly branchSteps: number;
  readonly transitionSteps: number;
  readonly terminalDocument: RealBuildCandidateDocumentSnapshot;
  readonly identityBindings: readonly RealBuildBrowserOutputV4IdentityBinding[];
  readonly outputIdentityDigest: Sha256Digest;
  readonly derivationReproducible: true;
  readonly sourceExecutionProvenanceAuthority: "absent";
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_READER_ABSENT_COMPLETION_AUTHORITY;
}

export interface InspectRealBuildBrowserOutputV4Input {
  readonly browserOutput: unknown;
  readonly preparedRunInputBytes: unknown;
  readonly branchEvidenceBytes: unknown;
  readonly compiledBranchRoleBytes: unknown;
  readonly branchObservationRoleBytes: unknown;
  readonly sourceManifestBytes: unknown;
  readonly sourceInspection: unknown;
  readonly cameraManifestBytes: unknown;
  readonly cameraRenderRoleBytes: unknown;
  readonly cameraMaskRoleBytes: unknown;
  readonly transitionManifestBytes: unknown;
}
