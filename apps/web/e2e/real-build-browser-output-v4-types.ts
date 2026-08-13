import type { Sha256Digest } from "@lego-studio/brick-kernel";

export const REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION =
  "lego.real-build-browser-branch-evidence/1" as const;

export type RealBuildBrowserBranchRoleName =
  "compiled-branch-evidence-bytes" | "branch-observation-bytes";

export interface RealBuildBrowserBranchRoleDescriptor<Role extends RealBuildBrowserBranchRoleName> {
  readonly role: Role;
  readonly bytes: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildBrowserCompiledBranchJsonReference {
  readonly role: "compiled-branch-evidence-bytes";
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly encoding: "utf8-json/1";
}

export interface RealBuildBrowserBranchObservationReference {
  readonly role: "branch-observation-bytes";
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly encoding: "raw-bytes/1";
}

export interface RealBuildBrowserBranchStepEvidenceIndex {
  readonly stepNumber: number;
  readonly compiledLineage: RealBuildBrowserCompiledBranchJsonReference;
  readonly observationClosure: RealBuildBrowserCompiledBranchJsonReference | null;
  readonly observations: RealBuildBrowserBranchObservationReference | null;
}

/** Byte transport only. Its references and digests grant no placement or completion authority. */
export interface RealBuildBrowserBranchEvidenceV1 {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION;
  readonly compiledBranchRole: RealBuildBrowserBranchRoleDescriptor<"compiled-branch-evidence-bytes">;
  readonly observationRole: RealBuildBrowserBranchRoleDescriptor<"branch-observation-bytes">;
  readonly steps: readonly RealBuildBrowserBranchStepEvidenceIndex[];
}
