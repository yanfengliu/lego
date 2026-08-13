import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";

import type { RealBuildLineageAttemptStatus } from "./real-build-lineage-evidence-types";

export interface RealBuildLineageAttemptEvidenceIdentityInput {
  readonly candidateId: string;
  readonly parentLineageId: string;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly status: Exclude<RealBuildLineageAttemptStatus, "seeded">;
  readonly sourceEvidenceId: string;
}

/** Binds an external score/failure witness to the exact branch, step, panel, and outcome. */
export function realBuildLineageAttemptEvidenceId(
  input: RealBuildLineageAttemptEvidenceIdentityInput,
): string {
  return `lineage-attempt-evidence:${sha256Hex(
    canonicalStringify({ schema: "real-build-lineage-attempt-evidence/1", ...input }),
  )}`;
}
