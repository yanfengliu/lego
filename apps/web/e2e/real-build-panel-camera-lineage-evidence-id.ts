import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPanelCameraRegistration } from "./real-build-panel-camera-registration";

/** Exact shared camera measurement identity; parent-specific lineage is derived separately. */
export function realBuildLivePanelCameraEvidenceId(input: {
  readonly candidateId: string;
  readonly documentHash: Sha256Digest;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly legacyObservationId: string;
  readonly registration: RealBuildPanelCameraRegistration;
  readonly centrePx: readonly [number, number];
  readonly silhouetteIou: number;
  readonly renderMaskDigest: string;
  readonly rasterMeasurement: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly builtMaskDigest: string;
    readonly excludedMaskDigest: string | null;
  };
}): string {
  return `camera-evidence:${sha256Hex(
    canonicalStringify({
      schema: "real-build-panel-camera-live-lineage-evidence/1",
      ...input,
    }),
  )}`;
}
