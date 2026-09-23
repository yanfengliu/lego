import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

const MAXIMUM_JSON_BYTES = 16 * 1024 * 1024;

export const REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE =
  "real-build-prefix50-step44-promotion-receipt.json" as const;
export const REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE =
  "real-build-prefix50-step44-selected-document.json" as const;
export const REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE =
  "real-build-prefix50-step44-selected-envelope.json" as const;

export function digestPromotionArtifactBytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function requireExactPromotionFiles(
  root: string,
  expected: readonly string[],
  label: string,
  ignore?: (name: string) => boolean,
): void {
  const actual = readdirSync(root)
    .filter((name) => ignore?.(name) !== true)
    .sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((file, index) => file !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function requireExactPromotionKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function promotionBodyWithoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function readCanonicalPromotionArtifact<T>(
  root: string,
  file: string,
  label: string,
): Readonly<{ bytes: Uint8Array; value: T }> {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(root, file, MAXIMUM_JSON_BYTES, label);
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text) throw new TypeError(`${label} is not canonical JSON.`);
  return { bytes, value: value as T };
}
