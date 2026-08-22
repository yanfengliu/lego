import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  RealBuildExactLineageIdentity,
  RealBuildExactLineageId,
} from "./real-build-exact-lineage-identity";

export const REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA =
  "lego.real-build-browser-output-v4-transition-evidence-row/1" as const;
export const REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_SCHEMA =
  "lego.real-build-browser-output-v4-transition-evidence-manifest/1" as const;
export const REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_FRONTIER_SCHEMA =
  "lego.real-build-browser-output-v4-transition-frontier/1" as const;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROWS = 359;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_BYTES = 2 * 1024 * 1024;

export interface RealBuildBrowserOutputV4ExactDocumentBinding {
  readonly documentHash: Sha256Digest;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
}

export interface RealBuildBrowserOutputV4TransitionActionCommitment {
  readonly kind: "transition";
  readonly assembledPieces: 0;
  readonly transition: "rotation" | "attachment" | "final-view";
  readonly panelEvidenceDigest: Sha256Digest;
  readonly classificationEvidenceDigest: Sha256Digest;
  readonly evidenceDigest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4TransitionValidationCommitment {
  readonly attempted: true;
  readonly targetDocumentHash: Sha256Digest;
  readonly truthSnapshotHash: Sha256Digest;
  readonly validatorSetHash: Sha256Digest;
  readonly documentGloballyValid: true;
  readonly blockingIssues: readonly never[];
  readonly failure: null;
}

export interface RealBuildBrowserOutputV4TransitionEvidenceRow {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_ROW_SCHEMA;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly preparedPanelIdentity: Sha256Digest;
  readonly source: RealBuildBrowserOutputV4ExactDocumentBinding;
  readonly target: RealBuildBrowserOutputV4ExactDocumentBinding;
  readonly action: RealBuildBrowserOutputV4TransitionActionCommitment;
  readonly actionEvidenceDigest: Sha256Digest;
  readonly canonicalStepId: string;
  readonly calloutPieces: 0;
  readonly expectedAssembledPieces: 0;
  readonly attemptedPieces: 0;
  readonly placedPieces: 0;
  readonly documentParts: number;
  readonly outcome: Readonly<{
    status: "complete";
    mechanism: "instruction-transition";
    failure: null;
  }>;
  readonly validation: RealBuildBrowserOutputV4TransitionValidationCommitment;
  readonly rowDigest: Sha256Digest;
}

export interface RealBuildBrowserOutputV4TransitionEvidenceManifest {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_MANIFEST_SCHEMA;
  readonly rows: readonly RealBuildBrowserOutputV4TransitionEvidenceRow[];
  readonly completionAuthority: Readonly<{
    status: "absent";
    authorized: false;
    reason: "transition-evidence-cannot-authorize-completion";
  }>;
  readonly manifestDigest: Sha256Digest;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
}

export interface RealBuildBrowserOutputV4TransitionDelta {
  readonly rowDigest: Sha256Digest;
  readonly operationId: string;
  readonly canonicalStepId: string;
  readonly source: RealBuildBrowserOutputV4ExactDocumentBinding;
  readonly target: RealBuildBrowserOutputV4ExactDocumentBinding;
  readonly localIdentity: Readonly<{
    kind: "evidence";
    id: string;
  }>;
  readonly orderedParentExactLineageIds: readonly RealBuildExactLineageId[];
}

export interface RealBuildBrowserOutputV4TransitionFrontier {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_FRONTIER_SCHEMA;
  readonly throughStepNumber: number;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly identities: readonly RealBuildExactLineageIdentity[];
  readonly lastTransition: RealBuildBrowserOutputV4TransitionDelta | null;
  readonly completionAuthority: Readonly<{
    status: "absent";
    authorized: false;
    reason: "transition-frontier-cannot-authorize-completion";
  }>;
}
