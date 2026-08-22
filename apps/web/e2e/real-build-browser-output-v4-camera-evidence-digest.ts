import { canonicalDigest, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildBrowserCameraEvidenceChild,
  RealBuildBrowserCameraEvidenceFittedCamera,
  RealBuildBrowserCameraEvidenceLattice,
  RealBuildBrowserCameraEvidencePreparedPanel,
  RealBuildBrowserCameraEvidenceRenderReference,
  RealBuildBrowserCameraEvidenceRendererInputs,
  RealBuildBrowserCameraEvidenceRow,
} from "./real-build-browser-output-v4-camera-evidence-types";
import type {
  RealBuildCompiledObservationMaskReference,
  RealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-types";

export function digestRealBuildBrowserCameraEvidenceBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}` as Sha256Digest;
}

export function deriveRealBuildBrowserFittedCameraDigest(
  fittedCamera: RealBuildBrowserCameraEvidenceFittedCamera,
): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-browser-fitted-camera/1",
    fittedCamera,
  });
}

export function deriveRealBuildBrowserD4CameraRecipeDigest(input: {
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly child: RealBuildBrowserCameraEvidenceChild;
  readonly preparedPanel: RealBuildBrowserCameraEvidencePreparedPanel;
  readonly fittedCamera: RealBuildBrowserCameraEvidenceFittedCamera;
  readonly fittedCameraDigest: Sha256Digest;
  readonly lattice: RealBuildBrowserCameraEvidenceLattice;
}): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-browser-d4-camera-recipe/1",
    ...input,
  });
}

export function deriveRealBuildBrowserRendererSnapshotDigest(input: {
  readonly child: RealBuildBrowserCameraEvidenceChild;
  readonly d4CameraRecipeDigest: Sha256Digest;
  readonly rendererInputs: RealBuildBrowserCameraEvidenceRendererInputs;
  readonly render: RealBuildBrowserCameraEvidenceRenderReference;
}): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-browser-renderer-snapshot/1",
    ...input,
  });
}

export function deriveRealBuildBrowserCameraEvidenceId(
  row: Omit<RealBuildBrowserCameraEvidenceRow, "evidenceId">,
): `browser-camera-evidence:sha256:${string}` {
  return `browser-camera-evidence:${canonicalDigest({
    schemaVersion: "lego.real-build-browser-camera-evidence-row/1",
    row,
  })}`;
}

export function createRealBuildBrowserObservationMaskReference(input: {
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly widthPx: number;
  readonly heightPx: number;
}): RealBuildCompiledObservationMaskReference {
  return {
    role: "branch-observation-bytes",
    offset: input.offset,
    bytes: input.bytes,
    digest: input.digest,
    encoding: "packed-binary-mask-msb/1",
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  };
}
