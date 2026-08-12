import { documentStructuralHash } from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildDiagnosticPrefix } from "./real-build-result";

export const REAL_BUILD_DIAGNOSTIC_PREFIX_FILE = "diagnostic-prefix.json" as const;

export type RealBuildDiagnosticPrefixSummary = Omit<RealBuildDiagnosticPrefix, "documentJson">;

export function createRealBuildDiagnosticPrefix(
  document: BrickDocumentV1,
): RealBuildDiagnosticPrefix {
  return {
    schemaVersion: "lego.real-build-diagnostic-prefix/1",
    throughStepNumber: document.steps.length,
    targetEquivalence: "unreconciled",
    documentJson: JSON.stringify(document),
    structuralHash: documentStructuralHash(document),
    parts: document.parts.length,
  };
}

export function realBuildDiagnosticPrefixSummary(
  prefix: RealBuildDiagnosticPrefix | null,
): RealBuildDiagnosticPrefixSummary | null {
  if (prefix === null) return null;
  const { documentJson: _documentJson, ...summary } = prefix;
  void _documentJson;
  return summary;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)))
  );
}

export function isRealBuildDiagnosticPrefixSummary(
  value: unknown,
): value is RealBuildDiagnosticPrefixSummary {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Record<string, unknown>;
  return (
    exactKeys(summary, [
      "schemaVersion",
      "throughStepNumber",
      "targetEquivalence",
      "structuralHash",
      "parts",
    ]) &&
    summary.schemaVersion === "lego.real-build-diagnostic-prefix/1" &&
    Number.isSafeInteger(summary.throughStepNumber) &&
    (summary.throughStepNumber as number) >= 1 &&
    summary.targetEquivalence === "unreconciled" &&
    typeof summary.structuralHash === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(summary.structuralHash) &&
    Number.isSafeInteger(summary.parts) &&
    (summary.parts as number) >= 1
  );
}

export function assertRealBuildDiagnosticPrefixDocument(
  bytes: Uint8Array,
  summary: RealBuildDiagnosticPrefixSummary,
): void {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new TypeError(
      `Retained diagnostic-prefix.json is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (!validateBrickDocumentV1(value)) {
    throw new TypeError("Retained diagnostic-prefix.json is not a valid BrickDocumentV1.");
  }
  const document = value as BrickDocumentV1;
  if (
    documentStructuralHash(document) !== summary.structuralHash ||
    document.parts.length !== summary.parts ||
    document.steps.length !== summary.throughStepNumber ||
    document.steps.some(({ index }, position) => index !== position)
  ) {
    throw new TypeError(
      `Retained diagnostic-prefix.json does not reproduce its exact hash, ${summary.parts} parts, and ` +
        `contiguous step prefix 1..${summary.throughStepNumber}.`,
    );
  }
}
