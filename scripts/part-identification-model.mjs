import { exactOwnKeys, isOrdinaryObject } from "./part-identification-safe-shape.mjs";

export const PART_IDENTIFICATION_MODEL_ID = "claude-opus-5";

export const PART_IDENTIFICATION_MODEL_IDENTITY = Object.freeze({
  requestedModelId: PART_IDENTIFICATION_MODEL_ID,
  responseModelId: PART_IDENTIFICATION_MODEL_ID,
  canonicalModel: "claude-opus-5",
  provider: "firstParty",
});

export function requirePinnedPartIdentificationModel(model) {
  if (model !== PART_IDENTIFICATION_MODEL_ID) {
    throw new Error(
      `Part-identification model calls are pinned to ${PART_IDENTIFICATION_MODEL_ID}; received ` +
        `${JSON.stringify(model)}. Aliases such as opus and sonnet are mutable and cannot reproduce evidence.`,
    );
  }
  return PART_IDENTIFICATION_MODEL_IDENTITY;
}

export function responseModelIdentity(payload, requestedModelId) {
  const expected = requirePinnedPartIdentificationModel(requestedModelId);
  const usage = payload?.modelUsage?.[requestedModelId];
  if (
    payload?.is_error !== false ||
    typeof payload.result !== "string" ||
    payload.result.length === 0 ||
    !isOrdinaryObject(payload.modelUsage) ||
    !exactOwnKeys(payload.modelUsage, [requestedModelId]) ||
    !isOrdinaryObject(usage) ||
    usage.canonicalModel !== expected.canonicalModel ||
    usage.provider !== expected.provider
  ) {
    throw new Error(
      `Claude response did not prove pinned model ${requestedModelId}/${expected.canonicalModel}/` +
        `${expected.provider}; preserve the raw CLI failure and rerun without aliases or fallback models.`,
    );
  }
  return expected;
}

export function isPinnedModelIdentity(value, model) {
  const expected = requirePinnedPartIdentificationModel(model);
  return (
    exactOwnKeys(value, ["requestedModelId", "responseModelId", "canonicalModel", "provider"]) &&
    value.requestedModelId === expected.requestedModelId &&
    value.responseModelId === expected.responseModelId &&
    value.canonicalModel === expected.canonicalModel &&
    value.provider === expected.provider
  );
}
