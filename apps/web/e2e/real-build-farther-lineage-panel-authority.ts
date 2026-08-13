import type {
  RealBuildLineageId,
  RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";

declare const liveFartherPanelAuthorityType: unique symbol;

export interface TrustedLineagedFartherPanelScore {
  readonly identity: RealBuildLineageIdentity;
  readonly fartherOriginLineageId: RealBuildLineageId;
  readonly cameraEvidenceId: string;
  readonly measure: "iou" | "containment";
  readonly candidateMaskDigest: string;
  readonly builtMaskDigest: string;
  readonly excludedMaskDigest: string | null;
  readonly shiftPx: readonly [number, number];
  readonly agreement: number;
}

/**
 * Reserved execution type for a future broker-owned PDF/crop/render measurement producer.
 * Current public panel-camera resolvers accept caller masks and can emit inspection evidence only.
 */
export interface TrustedLineagedFartherPanelObservation {
  readonly stepNumber: number;
  readonly status: "scored";
  readonly renderCount: number;
  readonly scores: readonly TrustedLineagedFartherPanelScore[];
  readonly [liveFartherPanelAuthorityType]: true;
}

const trustedObservations = new WeakSet<object>();

/** No public producer exists: generic scored farther panels remain refusal-only. */
export function requireTrustedLineagedFartherPanelObservation(
  value: unknown,
): TrustedLineagedFartherPanelObservation {
  if (value === null || typeof value !== "object" || !trustedObservations.has(value)) {
    throw new TypeError(
      "A scored farther panel requires nonforgeable trusted PDF/crop/render measurement authority; current public panel-camera evidence is inspection-only.",
    );
  }
  return value as TrustedLineagedFartherPanelObservation;
}
