import { readContainedBoundedRegularFile } from "./bounded-file-read";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import {
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  servedResponseChunkName,
} from "./real-build-served-response-policy";
import { verifyRealBuildServedResponseEvidenceBytes } from "./real-build-served-response-verification-memory";
import { parseFatalUtf8Json } from "./strict-json";

/** Filesystem adapter over the inert served-response semantic verifier. */
export function verifyRealBuildServedResponseEvidence(input: {
  readonly directory: string;
  readonly expectedManifestDigest: string;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly requireRunner?: boolean;
  readonly expectedCheckoutRoot?: string;
  readonly frozenLegacyArtifactManifestV3RunId?: string;
}): readonly string[] {
  const manifestBytes = readContainedBoundedRegularFile(
    input.directory,
    REAL_BUILD_SERVED_RESPONSE_MANIFEST,
    {
      label: "served-response manifest",
      minimumBytes: 2,
      maximumBytes: MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
      expectedSha256: input.expectedManifestDigest,
    },
  );
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestBytes,
    "served-response manifest chunk discovery",
  );
  if (!Array.isArray(manifest.bodyChunks) || manifest.bodyChunks.length > 4) {
    throw new TypeError("Served-response manifest declares an invalid body-chunk count.");
  }
  const bodyChunkBytes = manifest.bodyChunks.map((_chunk, index) =>
    readContainedBoundedRegularFile(input.directory, servedResponseChunkName(index), {
      label: `served-response body chunk ${index}`,
      minimumBytes: 1,
      maximumBytes: MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
    }),
  );
  return verifyRealBuildServedResponseEvidenceBytes({
    manifestBytes,
    bodyChunkBytes,
    expectedManifestDigest: input.expectedManifestDigest,
    sourceFiles: input.sourceFiles,
    ...(input.requireRunner === undefined ? {} : { requireRunner: input.requireRunner }),
    ...(input.expectedCheckoutRoot === undefined
      ? {}
      : { expectedCheckoutRoot: input.expectedCheckoutRoot }),
    ...(input.frozenLegacyArtifactManifestV3RunId === undefined
      ? {}
      : {
          frozenLegacyArtifactManifestV3RunId: input.frozenLegacyArtifactManifestV3RunId,
        }),
  });
}
