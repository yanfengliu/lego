export const PART_MATCH_SCHEMA: "lego.part-identification-match/3";
export const PART_DISTANCES_SCHEMA: "lego.part-identification-distances/3";
export const PART_IDENTIFICATION_MATCH_NOTE: string;
export const PART_IDENTIFICATION_DISTANCES_NOTE: string;
export const PART_IDENTIFICATION_CLUSTER_GUARD: Readonly<Record<string, unknown>>;

/**
 * @internal `features` must first be authenticated and accepted by
 * `assertFeaturesArtifact`; this allocation-oriented seam does not preflight
 * hostile structured values itself.
 */
export function derivePartIdentificationMatch(
  features: unknown,
  candidateLimit?: number,
): {
  readonly candidateLimit: number;
  readonly clusterGuard: Readonly<Record<string, unknown>>;
  readonly elementIds: readonly string[];
  readonly clusters: readonly unknown[];
  readonly rows: readonly (readonly number[])[];
};

export function partIdentificationMatchValue(featuresDigest: string, derived: unknown): unknown;

export function partIdentificationDistancesValue(
  featuresDigest: string,
  matchDigest: string,
  derived: unknown,
): unknown;
