import { isDeepStrictEqual } from "node:util";

import {
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS,
  PREFIX50_REVIEW_AUTHORITY,
  PREFIX50_REVIEW_METHOD,
  PREFIX50_REVIEW_OUTCOMES_SCHEMA,
  PREFIX50_STATIC_REVIEWED_MAP,
  exactCommitment,
} from "./part-identification-prefix50-semantic-closure-source.mjs";

const exactKeys = (value, keys) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");

export function assertReviewOutcomes(value, expectedRows) {
  const expectedInputs = {
    calloutManifestDigest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.calloutManifest.digest,
    inventoryManifestDigest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest.digest,
    sourceArtifactDigest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.sourceArtifact.digest,
    review57Digest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57.digest,
    review3Digest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3.digest,
    staticReviewedMap: exactCommitment(
      "lego.part-identification-prefix50-static-reviewed-map/1",
      PREFIX50_STATIC_REVIEWED_MAP,
    ),
  };
  if (
    !exactKeys(value, [
      "authority",
      "inputs",
      "reviewMethod",
      "reviewedAt",
      "rows",
      "schemaVersion",
    ]) ||
    value.schemaVersion !== PREFIX50_REVIEW_OUTCOMES_SCHEMA ||
    value.reviewedAt !== "2026-08-26" ||
    value.reviewMethod !== PREFIX50_REVIEW_METHOD ||
    !isDeepStrictEqual(value.authority, PREFIX50_REVIEW_AUTHORITY) ||
    !isDeepStrictEqual(value.inputs, expectedInputs) ||
    !Array.isArray(value.rows) ||
    value.rows.length !== 101 ||
    expectedRows.length !== 101
  ) {
    throw new Error(
      "Prefix-50 semantic closure requires the exact 101-row inspected review-outcomes contract and its closed authority/input commitments.",
    );
  }
  const allowedOutcomes = new Set(["same", "different", "not-observable"]);
  for (const [index, row] of value.rows.entries()) {
    const expected = expectedRows[index];
    if (
      !exactKeys(row, ["calloutDigest", "elementId", "identity", "inventoryDigest", "review"]) ||
      !allowedOutcomes.has(row.review) ||
      !isDeepStrictEqual(
        {
          identity: row.identity,
          elementId: row.elementId,
          calloutDigest: row.calloutDigest,
          inventoryDigest: row.inventoryDigest,
        },
        expected,
      )
    ) {
      throw new Error(
        `Prefix-50 review outcome row ${index} drifted identity, element, crop commitments, order, or explicit outcome.`,
      );
    }
  }
  return value.rows;
}

export function bindSameReviewOutcomes(verifiedRows, reviewRows) {
  const outcomeByIdentity = new Map(reviewRows.map((row) => [row.identity, row.review]));
  return verifiedRows
    .map((row) => ({
      ...row,
      reviewOutcome: outcomeByIdentity.get(row.semantic.identity),
    }))
    .filter(({ reviewOutcome }) => reviewOutcome === "same");
}
