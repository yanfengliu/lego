export const PAIR_JUDGED_SAME_CONFIDENCE: "pair-judged-same";
export const PAIR_JUDGED_DIFFERENT_CONFIDENCE: "pair-judged-different";

export function assertPairJudgedTruth(
  value: unknown,
  label?: string,
): { readonly lastStep: number; readonly verdictCount: number };

export function pairJudgedVerdictsByCalloutIndex(input: {
  readonly truth: unknown;
  readonly features: unknown;
  readonly claims: ReadonlyMap<number, unknown>;
  readonly label?: string;
}): Map<
  number,
  {
    readonly verdict: "same" | "different";
    readonly judgedCrop: string;
    readonly judgedElementId: string;
  }
>;
