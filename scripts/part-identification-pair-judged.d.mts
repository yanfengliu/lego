export const PAIR_JUDGED_SAME_CONFIDENCE: "pair-judged-same";
export const PAIR_JUDGED_DIFFERENT_CONFIDENCE: "pair-judged-different";

export type ParsedJsonValue =
  string | number | boolean | null | ParsedJsonObject | readonly ParsedJsonValue[];

export interface ParsedJsonObject {
  readonly [key: string]: ParsedJsonValue;
}

export interface ParsedPairJudgedFeatureCallout {
  readonly evidenceKind?: string;
  readonly stepNumber?: number | null;
  readonly quantity?: number;
  readonly file?: string;
  readonly identity?: string;
  readonly sha256?: string;
}

export interface ParsedPairJudgedFeatures {
  readonly callouts: readonly ParsedPairJudgedFeatureCallout[];
}

export interface ParsedPairJudgedClaim {
  readonly clusterIndex?: number;
  readonly elementId?: string | null;
}

/** @internal Accepts only ordinary strict JSON already authenticated from bounded bytes. */
export function assertPairJudgedTruthFromParsedJson(
  value: ParsedJsonObject,
  label?: string,
): { readonly lastStep: number; readonly verdictCount: number };

/** @internal Accepts only parsed, authenticated, schema-validated inputs. */
export function pairJudgedVerdictsByCalloutIndexFromParsedJson(input: {
  readonly truth: ParsedJsonObject;
  readonly features: ParsedPairJudgedFeatures;
  readonly claims: ReadonlyMap<number, ParsedPairJudgedClaim>;
  readonly label?: string;
}): Map<
  number,
  {
    readonly verdict: "same" | "different";
    readonly judgedCrop: string;
    readonly judgedElementId: string;
  }
>;
