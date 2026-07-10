import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import {
  GENERATION_VERSION,
  cloneBoundedDataOnlyJson,
  generateDeterministicPrograms,
  normalizeRestrictedTextBrief,
  replayCapturedMakerPopulation,
  validateMakerJobId,
  type DeterministicMakerPopulationInput,
} from "@lego-studio/generation";
import {
  validateBrickDocumentV1,
  validateBuildBriefV1,
  validateDeterministicMakerOutputV1,
  validateScopeCapabilityV1,
  type DeterministicMakerOutputV1,
} from "@lego-studio/protocol";

import {
  MAX_CAPTURE_JSON_BYTES,
  canonicalJson,
  createCaptureManifest,
  makerOutputFromPrograms,
  programsFromMakerOutput,
  utf8ByteLength,
  type ValidatedMakerInput,
} from "./capture-codec.ts";
import {
  MAKER_CAPTURE_VERSION,
  type DeterministicMakerCapture,
  type MakerCaptureFailureCode,
  type MakerCaptureResult,
} from "./capture-types.ts";

function failure(code: MakerCaptureFailureCode, message: string): MakerCaptureResult {
  return { ok: false, failure: { code, message } };
}

function exactInput(value: unknown): ValidatedMakerInput | null {
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 24,
    maxNodes: 12_000,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: 256_000,
  });
  if (typeof detached !== "object" || detached === null || Array.isArray(detached)) return null;
  const prototype = Object.getPrototypeOf(detached) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Object.keys(detached).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== "brief" ||
    keys[1] !== "document" ||
    keys[2] !== "jobId" ||
    keys[3] !== "scope" ||
    typeof (detached as Record<string, unknown>).jobId !== "string" ||
    validateMakerJobId((detached as Record<string, unknown>).jobId as string) !== null ||
    !validateBrickDocumentV1((detached as Record<string, unknown>).document) ||
    !validateBuildBriefV1((detached as Record<string, unknown>).brief) ||
    !validateScopeCapabilityV1((detached as Record<string, unknown>).scope)
  ) {
    return null;
  }
  return detached as unknown as ValidatedMakerInput;
}

function snapshotMakerOutput(value: unknown): DeterministicMakerOutputV1 | null {
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 24,
    maxNodes: 8_000,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: 512_000,
  });
  return validateDeterministicMakerOutputV1(detached) &&
    (detached as DeterministicMakerOutputV1).makerVersion === GENERATION_VERSION
    ? (deepFreeze(detached) as DeterministicMakerOutputV1)
    : null;
}

function captureFromSnapshots(
  input: ValidatedMakerInput,
  output: DeterministicMakerOutputV1,
): MakerCaptureResult {
  const requestJson = canonicalJson(input);
  const capturedProgramsJson = canonicalJson(output);
  const population = replayCapturedMakerPopulation(input, programsFromMakerOutput(output));
  const populationJson = canonicalJson(population);
  if (
    [requestJson, capturedProgramsJson, populationJson].some(
      (json) => utf8ByteLength(json) > MAX_CAPTURE_JSON_BYTES,
    )
  ) {
    return failure(
      "CAPTURE_SIZE_EXCEEDED",
      "Canonical request, captured output, or replay population exceeds the harness byte cap",
    );
  }
  const manifest = createCaptureManifest(
    input,
    output,
    population,
    requestJson,
    capturedProgramsJson,
    populationJson,
  );
  const capture: DeterministicMakerCapture = {
    schemaVersion: MAKER_CAPTURE_VERSION,
    manifestHash: canonicalDigest(manifest),
    manifest,
    requestJson,
    capturedProgramsJson,
    populationJson,
  };
  return { ok: true, capture: deepFreeze(capture) };
}

export function captureMakerRunFromCapturedOutput(
  inputValue: DeterministicMakerPopulationInput,
  outputValue: unknown,
): MakerCaptureResult {
  const input = exactInput(inputValue);
  if (!input) {
    return failure(
      "INPUT_NOT_DATA_ONLY",
      "Maker capture input must be an exact bounded request with valid wire schemas",
    );
  }
  const output = snapshotMakerOutput(outputValue);
  if (!output) {
    return failure(
      "CAPTURED_OUTPUT_NOT_DATA_ONLY",
      "Captured maker output must satisfy the authority-free deterministic output schema",
    );
  }
  return captureFromSnapshots(input, output);
}

export function captureDeterministicMakerRun(
  inputValue: DeterministicMakerPopulationInput,
): MakerCaptureResult {
  const input = exactInput(inputValue);
  if (!input) {
    return failure(
      "INPUT_NOT_DATA_ONLY",
      "Maker capture input must be an exact bounded request with valid wire schemas",
    );
  }
  const normalized = normalizeRestrictedTextBrief(input);
  const generated = normalized.ok
    ? generateDeterministicPrograms(normalized.brief, normalized.scope.budgets.maxOperations)
    : [];
  return captureFromSnapshots(input, makerOutputFromPrograms(generated));
}
