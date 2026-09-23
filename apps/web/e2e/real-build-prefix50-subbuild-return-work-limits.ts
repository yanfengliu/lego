import { deepFreeze } from "@lego-studio/brick-kernel";

import type { RigidSubassemblyReturnWorkLimits } from "../src/assembly/rigid-subassembly-return";

export const REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS = deepFreeze({
  maxDocumentParts: 280,
  maxDocumentConnections: 4_096,
  maxConnectorPairingChecks: 5_000_000,
  maxDistinctGroupDeltas: 1_000_000,
  maxCandidateDocuments: 1_000_000,
  maxTransformedChildParts: 23_000_000,
  maxCrossConnectionChecks: 250_000_000_000,
  maxCrossEdgesPerCandidate: 4_096,
} satisfies RigidSubassemblyReturnWorkLimits);
