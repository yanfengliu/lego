export const PART_IDENTIFICATION_MODEL_ID: "claude-opus-4-8";
export const PART_IDENTIFICATION_MODEL_IDENTITY: Readonly<{
  readonly requestedModelId: "claude-opus-4-8";
  readonly responseModelId: "claude-opus-4-8";
  readonly canonicalModel: "claude-opus-4-8";
  readonly provider: "firstParty";
}>;

export function requirePinnedPartIdentificationModel(
  model: string,
): typeof PART_IDENTIFICATION_MODEL_IDENTITY;

export function responseModelIdentity(
  payload: unknown,
  requestedModelId: string,
): typeof PART_IDENTIFICATION_MODEL_IDENTITY;

export function isPinnedModelIdentity(value: unknown, model: string): boolean;
