import type { Step7Gate3ObserverLifecycleSnapshot } from "./real-build-step7-gate3-observer-lifecycle";
import type { Step7Gate3CspImportControlUrls } from "./real-build-step7-gate3-host-policy-control";
import type { Step7Gate3RedirectRequestProvenance } from "./real-build-step7-gate3-source-policy";

export type Gate3BoundaryResourceKind =
  | "runner"
  | "locked-source"
  | "pdf-worker"
  | "worker-control"
  | "close-time-control"
  | "close-time-companion"
  | "input-pdf";

export interface Gate3BoundaryEvent {
  readonly sequence: number;
  readonly absoluteRequestUrl: string;
  readonly origin: string;
  readonly relativeRequestUrl: string;
  readonly method: string;
  readonly resourceType: string;
  readonly fetchDestination: string | null;
  readonly navigationRequest: boolean;
  readonly redirectChain: readonly Step7Gate3RedirectRequestProvenance[];
  readonly resourceKind: Gate3BoundaryResourceKind;
  readonly sourcePath: string | null;
  readonly response: {
    readonly absoluteUrl: string;
    readonly status: number;
    readonly contentType: string;
    readonly contentSecurityPolicy: string | null;
    readonly location: null;
    readonly synthetic: boolean;
    readonly bodyDigest: string | null;
  };
}

export interface Step7Gate3BlockedBoundaryEvent {
  readonly sequence: number | null;
  readonly absoluteRequestUrl: string;
  readonly method: string;
  readonly resourceType: string;
  readonly fetchDestination: string | null;
  readonly failure: string;
}

export interface Step7Gate3UnverifiedSourceExecutionBoundarySnapshot {
  readonly schemaVersion: "lego.step7-gate3-unverified-source-execution/1";
  readonly verification: "unverified-counterevidence";
  readonly authority: "none";
  readonly expectedOrigin: string;
  readonly bootstrapSourceManifestDigest: string;
  readonly events: readonly Gate3BoundaryEvent[];
  readonly blockedRequests: readonly Step7Gate3BlockedBoundaryEvent[];
  readonly observerLifecycle: Step7Gate3ObserverLifecycleSnapshot;
}

export interface Step7Gate3SourceExecutionBoundaryManifest {
  readonly schemaVersion: "lego.step7-gate3-source-execution-boundary/2";
  readonly expectedOrigin: string;
  readonly bootstrapSourceManifestDigest: string;
  readonly allowedSourceFiles: number;
  readonly requiredEntryMatches: readonly {
    readonly requiredUrl: string;
    readonly allowedRelativeRequestUrls: readonly string[];
    readonly matchedAbsoluteRequestUrls: readonly string[];
  }[];
  readonly requiredPdfUrl: string | null;
  readonly requiredWorkerUrl: string | null;
  readonly requiredCloseTimeControlUrl: string | null;
  readonly contentSecurityPolicy: string;
  readonly workerContentSecurityPolicy: string | null;
  readonly blockedRequests: 0;
  readonly redirectResponses: 0;
  readonly upstreamResponseMemoryBound: "not-proved-route-fetch-may-materialize-before-body-evidence";
  readonly events: readonly Gate3BoundaryEvent[];
  readonly observerClosure: Step7Gate3ObserverLifecycleSnapshot;
  readonly manifestDigest: string;
}

export interface Step7Gate3SourceExecutionBoundary {
  install(): Promise<void>;
  authorizePreRouteCspControlRequests(urls: Step7Gate3CspImportControlUrls): void;
  drainExecutableResponseUrls(): Promise<readonly string[]>;
  quiesce(beforeContextClose?: () => Promise<void>): Promise<void>;
  finish(): Promise<Step7Gate3SourceExecutionBoundaryManifest>;
  dispose(): Promise<void>;
  snapshotUnverified(): Step7Gate3UnverifiedSourceExecutionBoundarySnapshot;
}
