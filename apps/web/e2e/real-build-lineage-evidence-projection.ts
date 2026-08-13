import {
  deriveRealBuildLineageEvidenceStatus,
  deriveRealBuildLineageSelection,
  deriveRealBuildLineageTransitions,
} from "./real-build-lineage-evidence-derived";
import {
  parseDetachedRealBuildLineageEvidence,
  snapshotRealBuildLineageEvidenceProjectionInput,
} from "./real-build-lineage-evidence-parser";
import {
  DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
  REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION,
  type RealBuildLineageEvidence,
} from "./real-build-lineage-evidence-types";

/**
 * Projects only retained identities and attempts. Selection, status, and
 * transitions are recomputed here and verified again by the parser.
 */
export function projectRealBuildLineageEvidence(
  input: unknown,
  maximumAttempts = DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
): RealBuildLineageEvidence {
  const snapshot = snapshotRealBuildLineageEvidenceProjectionInput(input, maximumAttempts);
  const selection = deriveRealBuildLineageSelection(snapshot.attempts, snapshot.tiePolicy);
  return parseDetachedRealBuildLineageEvidence(
    {
      schemaVersion: REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION,
      status: deriveRealBuildLineageEvidenceStatus(snapshot.attempts, selection),
      throughStepNumber: snapshot.throughStepNumber,
      registrationPanelStepNumber: snapshot.registrationPanelStepNumber,
      decisionPanelStepNumber: snapshot.decisionPanelStepNumber,
      tiePolicy: snapshot.tiePolicy,
      parents: snapshot.parents,
      attempts: snapshot.attempts,
      selection,
      transitions: deriveRealBuildLineageTransitions(snapshot.attempts),
      completionAuthority: {
        status: "absent",
        authorized: false,
        reason: "lineage-evidence-is-inspection-only",
      },
    },
    maximumAttempts,
  );
}
