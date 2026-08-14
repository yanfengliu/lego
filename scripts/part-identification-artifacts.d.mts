export const PART_FEATURES_SCHEMA: "lego.part-identification-features/3";
export const PART_MATCH_SCHEMA: "lego.part-identification-match/3";
export const PART_DISTANCES_SCHEMA: "lego.part-identification-distances/3";
export const PART_CARDS_SCHEMA: "lego.part-identification-cards/4";
export const PART_ANSWERS_SCHEMA: "lego.part-identification-answers/4";
export const PART_SCORE_SCHEMA: "lego.part-identification-score/2";
export const PART_SCORE_SUMMARY_SCHEMA: "lego.part-identification-score-summary/2";
export const DESCRIPTOR_GRID_CELLS: number;
export const MAX_DESCRIPTOR_COMPARISON_CELLS: number;

export const FULL_CALLOUT_MANIFEST_EXPECTATION: Readonly<{
  readonly sourceHash: string;
  readonly pagesCropped: number;
  readonly identityCount: number;
  readonly rawQuantity: number;
  readonly identitySetDigest: string;
  readonly accounting: Readonly<Record<string, number>>;
  readonly recoveryFailureIdentities: readonly string[];
}>;

export class PartIdentificationArtifactBindingError extends Error {
  readonly artifactRole: string;
  readonly mismatches: readonly string[];
  constructor(artifactRole: string, mismatches: readonly string[]);
}

export interface JsonArtifact<T = unknown> {
  readonly bytes: Uint8Array;
  readonly digest?: `sha256:${string}`;
  readonly value?: T;
}

export interface AuthenticatedJsonArtifact<T = unknown> {
  readonly bytes: Uint8Array;
  readonly digest: `sha256:${string}`;
  readonly value: T;
}

export function sha256Digest(bytes: Uint8Array | string): `sha256:${string}`;

export function jsonArtifactFromBytes<T = unknown>(
  bytes: Uint8Array,
  label?: string,
): AuthenticatedJsonArtifact<T>;

export function authenticateJsonArtifact<T = unknown>(
  artifact: JsonArtifact<T>,
  label?: string,
): AuthenticatedJsonArtifact<T>;

export function assertV6CalloutManifest<T>(manifest: T, expectation?: unknown): T;

export function readBoundManifestCrop<T>(
  entry: { readonly identity?: string; readonly file: string; readonly sha256: string },
  root: string,
  decode: (bytes: Buffer) => T | Promise<T>,
): Promise<T>;

export function readBoundInventoryThumbnail<T>(
  elementId: string,
  expectedDigest: string,
  root: string,
  decode: (bytes: Buffer) => T | Promise<T>,
): Promise<T>;

export function nonClusteredCalloutRecords(callouts: readonly unknown[]): unknown[];

export function readJsonArtifact<T = unknown>(
  path: string,
  label: string,
): AuthenticatedJsonArtifact<T>;

export function assertFeaturesArtifact(artifact: JsonArtifact): {
  readonly callouts: readonly unknown[];
  readonly [key: string]: unknown;
};

export function assertBoundMatchArtifacts(input: {
  readonly featuresArtifact: JsonArtifact;
  readonly matchArtifact: JsonArtifact;
  readonly distancesArtifact: JsonArtifact;
}): {
  readonly features: { readonly callouts: readonly unknown[]; readonly [key: string]: unknown };
  readonly match: { readonly clusters: readonly unknown[]; readonly [key: string]: unknown };
  readonly distances: {
    readonly elementIds: readonly string[];
    readonly rows: readonly (readonly number[])[];
    readonly [key: string]: unknown;
  };
  readonly artifacts: {
    readonly features: AuthenticatedJsonArtifact;
    readonly match: AuthenticatedJsonArtifact;
    readonly distances: AuthenticatedJsonArtifact;
  };
};

export function deriveCardRunId(
  featuresDigest: string,
  matchDigest: string,
  cards: Readonly<
    Record<string, { readonly sha256: string; readonly candidateElementIds: readonly string[] }>
  >,
): string;

export function assertCardsArtifact(
  artifact: JsonArtifact,
  binding: {
    readonly featuresDigest: string;
    readonly matchDigest: string;
    readonly clusters: readonly {
      readonly clusterIndex: number;
      readonly candidates: readonly { readonly elementId: string }[];
    }[];
  },
): {
  readonly cards: Readonly<
    Record<string, { readonly sha256: string; readonly candidateElementIds: readonly string[] }>
  >;
  readonly [key: string]: unknown;
};

export function boundAnswers(
  artifact: JsonArtifact,
  binding: {
    readonly model: string;
    readonly matchDigest: string;
    readonly cardsDigest: string;
    readonly promptDigest: string;
    readonly clusters: readonly { readonly clusterIndex: number }[];
    readonly cards: Readonly<Record<string, { readonly candidateElementIds: readonly string[] }>>;
  },
): Readonly<Record<string, PartIdentificationAnswer | null>>;

export type PartIdentificationDifference =
  "nothing" | "mirrored" | "size" | "colour" | "view" | "detail" | "not-on-card" | "other";

export interface PartIdentificationAnswer {
  readonly kind:
    "brick" | "plate" | "tile" | "slope" | "wedge" | "arch" | "round" | "technic" | "other";
  readonly studsLong: number;
  readonly studsWide: number;
  readonly colour: string;
  readonly pick: number;
  readonly alsoCouldBe: number;
  readonly differsFromPick: PartIdentificationDifference;
  readonly confidence: number;
  /** Present only when the call chose to write; never an empty string. */
  readonly note?: string;
}

export function assertAnswerRecord<T extends PartIdentificationAnswer | null>(
  answer: T,
  label?: string,
): T;

export function canonicalAnswerRecord<T>(answer: T): T;

export function answerBundle(input: {
  readonly model: string;
  readonly modelIdentity: unknown;
  readonly matchDigest: string;
  readonly cardsDigest: string;
  readonly promptDigest: string;
  readonly answers: Readonly<Record<string, PartIdentificationAnswer | null>>;
}): unknown;
