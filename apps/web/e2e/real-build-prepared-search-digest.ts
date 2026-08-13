import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildLineageId } from "./real-build-candidate-lineage-identity";
import type { RealBuildPreparedPlacementWitness } from "./real-build-prepared-search-boundary";

export function deriveRealBuildPreparedSearchCanonicalDocumentDigest(
  canonicalBytesHash: Sha256Digest,
): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-parent-document-bytes/1",
    canonicalBytesHash,
  });
}

export function deriveRealBuildPreparedSearchProposalId(input: {
  readonly printedStepIdentity: Sha256Digest;
  readonly parentLineageId: RealBuildLineageId;
  readonly canonicalDocumentDigest: Sha256Digest;
  readonly pieces: readonly RealBuildPreparedPlacementWitness[];
}): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prepared-search-proposal/1",
    printedStepIdentity: input.printedStepIdentity,
    parentLineageId: input.parentLineageId,
    canonicalDocumentDigest: input.canonicalDocumentDigest,
    pieces: input.pieces,
  });
}
