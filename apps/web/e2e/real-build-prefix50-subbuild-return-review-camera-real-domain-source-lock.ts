import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-source-pdf-pins.ts";

export function requireRealBuildPrefix50Step44RealDomainSourceLock(input: {
  readonly repositoryRoot: string;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
}): Sha256Digest {
  const { evidence, runtimeIdentity } = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(
    input.sourceLock,
  );
  const { commitment, ...body } = evidence;
  if (
    runtimeIdentity.repoRoot !== input.repositoryRoot ||
    !/^sha256:[0-9a-f]{64}$/u.test(runtimeIdentity.lockManifestDigest) ||
    evidence.sourcePdf.artifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    evidence.sourcePdf.byteDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Real-domain source loader requires the exact live PDF source lock.");
  return commitment;
}
