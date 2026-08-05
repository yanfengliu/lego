export const PART_TRUTH_SCHEMA: "lego.part-identification-truth/2";
export const PART_TRUTH_PATH: "scripts/fixtures/part-identification-truth-first50.json";
export const CROP_DIGEST_KEY_HEX: 16;

export function cropDigestKey(sha256: string): string;

export function truthVerdictKey(judgedCropSha256: string, elementId: string): string;

export function judgedPairs(
  features: unknown,
  claims: ReadonlyMap<number, unknown>,
  lastStep: number,
): Map<string, unknown>;

export function verdictsByCropDigest(truth: unknown): {
  readonly bound: Map<string, unknown>;
  readonly unbindable: number;
};
