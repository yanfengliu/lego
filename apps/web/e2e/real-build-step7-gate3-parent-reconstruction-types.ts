import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import type { Step7Gate3MigrationResult } from "./real-build-step7-gate3-parent-migration-contract";

export const STEP7_GATE3_CALLER_PIN_AUTHORITY = "caller-supplied-unverified" as const;
export const STEP7_GATE3_PRIVATE_PIN_AUTHORITY = "reviewed-private-pins" as const;

export interface Step7Gate3ParentOrigin {
  readonly candidateId: string;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface Step7Gate3ParentReconstructionDependencies {
  readonly truthDigest: (truth: BrickDocumentV1["truth"]) => string;
  readonly documentStructuralHash: (document: BrickDocumentV1) => string;
  readonly sourcePlace: (
    document: BrickDocumentV1,
    witness: FartherPlacementWitness,
    stepId: string | null,
  ) => { readonly document: BrickDocumentV1; readonly stepId: string };
  readonly migrateDocumentTruth: (document: BrickDocumentV1) => Step7Gate3MigrationResult;
}

export interface Step7Gate3ReconstructedParent {
  readonly origin: Step7Gate3ParentOrigin;
  readonly document: BrickDocumentV1;
  readonly sourceDocumentHash: string;
  readonly documentHash: string;
  readonly candidateId: string;
  readonly partsPreserved: true;
}

export interface Step7Gate3ParentMigrationPin {
  readonly sourceDocumentHash: string;
  readonly currentDocumentHash: string;
}

export interface Step7Gate3ParentReconstructionInput {
  readonly baseDocument: BrickDocumentV1;
  readonly origins: readonly Step7Gate3ParentOrigin[];
  readonly dependencies: Step7Gate3ParentReconstructionDependencies;
}

export interface Step7Gate3PrivateParentReconstructionInput {
  readonly baseDocument: BrickDocumentV1;
  readonly origins: readonly Step7Gate3ParentOrigin[];
}

interface Step7Gate3ParentReconstructionResultBase {
  readonly parents: readonly Step7Gate3ReconstructedParent[];
  readonly migrationReport: Step7Gate3MigrationResult["report"];
}

export interface Step7Gate3CallerPinnedParentReconstructionResult extends Step7Gate3ParentReconstructionResultBase {
  readonly pinAuthority: typeof STEP7_GATE3_CALLER_PIN_AUTHORITY;
}

export interface Step7Gate3ParentReconstructionResult extends Step7Gate3ParentReconstructionResultBase {
  readonly pinAuthority: typeof STEP7_GATE3_PRIVATE_PIN_AUTHORITY;
}
