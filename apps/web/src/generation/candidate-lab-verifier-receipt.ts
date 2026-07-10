import { canonicalDigest } from "@lego-studio/brick-kernel";
import { cloneBoundedDataOnlyJson } from "@lego-studio/generation";

import type { CandidateLabRequest } from "./candidate-lab-request";
import { CANDIDATE_LAB_VERIFIER_VERSION } from "./candidate-lab-verifier";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_DIAGNOSTIC_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1_000;

export interface ParsedTrustedPopulationDigest {
  readonly expectedCanonicalDigest: `sha256:${string}`;
  readonly expectedOk: boolean;
  readonly verificationDurationMs: number;
}

export type TrustedPopulationDigestParseResult =
  | { readonly ok: true; readonly digest: ParsedTrustedPopulationDigest }
  | {
      readonly ok: false;
      readonly code: "MALFORMED_WORKER_RESPONSE" | "WORKER_ERROR";
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseTrustedPopulationDigest(
  value: unknown,
  requestId: string,
  request: CandidateLabRequest,
): TrustedPopulationDigestParseResult {
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 4,
    maxNodes: 32,
    maxStringChars: 1_024,
    maxKeyChars: 128,
    maxTotalChars: 8_192,
  });
  if (!isRecord(detached) || detached.requestId !== requestId) {
    return {
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
      message: "Verifier response was not bound to the active request",
    };
  }
  if (detached.kind === "population-verification-error") {
    return hasExactKeys(detached, ["kind", "message", "requestId"]) &&
      typeof detached.message === "string" &&
      detached.message.length > 0 &&
      detached.message.length <= 1_024
      ? { ok: false, code: "WORKER_ERROR", message: detached.message }
      : {
          ok: false,
          code: "MALFORMED_WORKER_RESPONSE",
          message: "Verifier returned a malformed execution error",
        };
  }
  if (
    detached.kind !== "trusted-population-digest" ||
    !hasExactKeys(detached, [
      "expectedCanonicalDigest",
      "expectedOk",
      "kind",
      "requestHash",
      "requestId",
      "verificationDurationMs",
      "verifierVersion",
    ]) ||
    detached.verifierVersion !== CANDIDATE_LAB_VERIFIER_VERSION ||
    detached.requestHash !== canonicalDigest(request) ||
    typeof detached.expectedCanonicalDigest !== "string" ||
    !DIGEST.test(detached.expectedCanonicalDigest) ||
    typeof detached.expectedOk !== "boolean" ||
    typeof detached.verificationDurationMs !== "number" ||
    !Number.isFinite(detached.verificationDurationMs) ||
    detached.verificationDurationMs < 0 ||
    detached.verificationDurationMs > MAX_DIAGNOSTIC_VERIFICATION_DURATION_MS
  ) {
    return {
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
      message: "Verifier returned an invalid trusted population digest",
    };
  }
  return {
    ok: true,
    digest: {
      expectedCanonicalDigest: detached.expectedCanonicalDigest as `sha256:${string}`,
      expectedOk: detached.expectedOk,
      verificationDurationMs: detached.verificationDurationMs,
    },
  };
}
