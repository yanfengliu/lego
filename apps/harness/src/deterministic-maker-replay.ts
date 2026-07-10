import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  verifyAssemblyPatchAgainstCapability,
} from "@lego-studio/brick-kernel";
import {
  GENERATION_VERSION,
  RANKING_POLICY_HASH,
  type CapturedMakerPopulationResult,
} from "@lego-studio/generation";
import { PROTOCOL_VERSION } from "@lego-studio/protocol";

import {
  DOWNSTREAM_REPLAY_POLICY_HASH,
  MAX_CAPTURE_JSON_BYTES,
  candidateCheckpoints,
  hasBoundedJsonStructure,
  sha256Text,
  snapshotCapture,
  utf8ByteLength,
} from "./capture-codec.ts";
import { captureMakerRunFromCapturedOutput } from "./deterministic-maker-run.ts";
import {
  MAKER_REPLAY_REPORT_VERSION,
  type DeterministicMakerCapture,
  type DeterministicMakerReplayReport,
  type MakerReplayCheckpoint,
  type MakerReplayFailureCode,
  type Sha256Digest,
} from "./capture-types.ts";
import { BUILTIN_COMPILER_SNAPSHOT_HASH } from "@lego-studio/brick-kernel";

interface ReportState {
  readonly capture?: DeterministicMakerCapture;
  readonly requestHash?: Sha256Digest;
  readonly capturedProgramsHash?: Sha256Digest;
  readonly capturedPopulationHash?: Sha256Digest;
  readonly replayedPopulationHash?: Sha256Digest;
  readonly executedDownstreamReplay?: boolean;
  readonly executedCompiler?: boolean;
  readonly capturedResultOk?: boolean;
  readonly checkedCandidateCount?: number;
  readonly compiledCandidateCount?: number;
  readonly hardValidCandidateCount?: number;
  readonly patchVerifiedCandidateCount?: number;
  readonly checkpoints?: readonly MakerReplayCheckpoint[];
}

function failureReport(
  code: MakerReplayFailureCode,
  message: string,
  state: ReportState = {},
): DeterministicMakerReplayReport {
  return deepFreeze({
    schemaVersion: MAKER_REPLAY_REPORT_VERSION,
    status: "failed",
    failureCode: code,
    failureMessage: message,
    captureManifestHash: state.capture?.manifestHash ?? null,
    requestHash: state.requestHash ?? null,
    capturedProgramsHash: state.capturedProgramsHash ?? null,
    capturedPopulationHash: state.capturedPopulationHash ?? null,
    replayedPopulationHash: state.replayedPopulationHash ?? null,
    executedDownstreamReplay: state.executedDownstreamReplay ?? false,
    executedCompiler: state.executedCompiler ?? false,
    nonVacuous: false,
    capturedResultOk: state.capturedResultOk ?? null,
    checkedCandidateCount: state.checkedCandidateCount ?? 0,
    compiledCandidateCount: state.compiledCandidateCount ?? 0,
    hardValidCandidateCount: state.hardValidCandidateCount ?? 0,
    patchVerifiedCandidateCount: state.patchVerifiedCandidateCount ?? 0,
    checkpoints: state.checkpoints ?? [],
  });
}

function parseCanonicalJson(value: string): unknown | null {
  if (utf8ByteLength(value) > MAX_CAPTURE_JSON_BYTES || !hasBoundedJsonStructure(value)) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return canonicalStringify(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}

function pinsMatch(capture: DeterministicMakerCapture): boolean {
  const manifest = capture.manifest;
  return (
    manifest.protocolVersion === PROTOCOL_VERSION &&
    manifest.generationVersion === GENERATION_VERSION &&
    manifest.compilerSnapshotHash === BUILTIN_COMPILER_SNAPSHOT_HASH &&
    manifest.rankingPolicyHash === RANKING_POLICY_HASH &&
    manifest.replayPolicyHash === DOWNSTREAM_REPLAY_POLICY_HASH
  );
}

function exactArtifactBinding(capture: DeterministicMakerCapture):
  | {
      readonly ok: true;
      readonly requestHash: Sha256Digest;
      readonly capturedProgramsHash: Sha256Digest;
      readonly populationHash: Sha256Digest;
    }
  | { readonly ok: false; readonly code: MakerReplayFailureCode; readonly message: string } {
  const manifest = capture.manifest;
  const entries = [
    {
      value: capture.requestJson,
      expectedLength: manifest.requestByteLength,
      expectedHash: manifest.requestHash,
      code: "REQUEST_HASH_MISMATCH" as const,
      label: "request",
    },
    {
      value: capture.capturedProgramsJson,
      expectedLength: manifest.capturedProgramsByteLength,
      expectedHash: manifest.capturedProgramsHash,
      code: "CAPTURED_PROGRAMS_HASH_MISMATCH" as const,
      label: "captured maker output",
    },
    {
      value: capture.populationJson,
      expectedLength: manifest.populationByteLength,
      expectedHash: manifest.populationHash,
      code: "POPULATION_HASH_MISMATCH" as const,
      label: "captured population",
    },
  ];
  for (const entry of entries) {
    if (
      utf8ByteLength(entry.value) !== entry.expectedLength ||
      sha256Text(entry.value) !== entry.expectedHash
    ) {
      return {
        ok: false,
        code: entry.code,
        message: `Canonical ${entry.label} bytes do not match the capture manifest`,
      };
    }
  }
  return {
    ok: true,
    requestHash: manifest.requestHash,
    capturedProgramsHash: manifest.capturedProgramsHash,
    populationHash: manifest.populationHash,
  };
}

function verifyPatches(
  request: Record<string, unknown>,
  population: CapturedMakerPopulationResult,
): { readonly ok: true; readonly count: number } | { readonly ok: false; readonly count: number } {
  if (!population.ok) return { ok: true, count: 0 };
  let count = 0;
  for (const candidate of population.rankedCandidates) {
    const verification = verifyAssemblyPatchAgainstCapability(
      request.document,
      candidate.patch,
      request.scope,
    );
    if (
      !verification.ok ||
      canonicalDigest(verification.document) !== canonicalDigest(candidate.document) ||
      canonicalDigest(verification.validationReport) !== canonicalDigest(candidate.validationReport)
    ) {
      return { ok: false, count };
    }
    count += 1;
  }
  return { ok: true, count };
}

export function replayDeterministicMakerRun(value: unknown): DeterministicMakerReplayReport {
  const snapshot = snapshotCapture(value);
  if (!snapshot.ok) {
    return failureReport(
      snapshot.reason === "not-data-only" ? "CAPTURE_NOT_DATA_ONLY" : "CAPTURE_SHAPE_INVALID",
      snapshot.reason === "not-data-only"
        ? "Replay capture must be acyclic bounded data-only JSON"
        : "Replay capture violates the closed unsealed test-capture contract",
    );
  }
  const { capture } = snapshot;
  if (canonicalDigest(capture.manifest) !== capture.manifestHash) {
    return failureReport(
      "MANIFEST_HASH_MISMATCH",
      "Capture manifest hash does not match its canonical fields",
      { capture },
    );
  }
  if (!pinsMatch(capture)) {
    return failureReport(
      "MANIFEST_MISMATCH",
      "Capture policy, protocol, generation, compiler, or ranking pin is incompatible",
      { capture },
    );
  }
  const binding = exactArtifactBinding(capture);
  if (!binding.ok) return failureReport(binding.code, binding.message, { capture });

  const request = parseCanonicalJson(capture.requestJson);
  if (request === null) {
    return failureReport(
      "REQUEST_NOT_CANONICAL",
      "Captured request is not bounded canonical JSON",
      {
        capture,
        requestHash: binding.requestHash,
      },
    );
  }
  const output = parseCanonicalJson(capture.capturedProgramsJson);
  if (output === null) {
    return failureReport(
      "CAPTURED_PROGRAMS_NOT_CANONICAL",
      "Captured maker output is not bounded canonical JSON",
      { capture, requestHash: binding.requestHash },
    );
  }
  if (parseCanonicalJson(capture.populationJson) === null) {
    return failureReport(
      "POPULATION_NOT_CANONICAL",
      "Captured population is not bounded canonical JSON",
      { capture, requestHash: binding.requestHash },
    );
  }

  const recreated = captureMakerRunFromCapturedOutput(
    request as Parameters<typeof captureMakerRunFromCapturedOutput>[0],
    output,
  );
  if (!recreated.ok) {
    return failureReport(
      "MANIFEST_MISMATCH",
      `Captured request or maker output is incompatible: ${recreated.failure.code}`,
      {
        capture,
        requestHash: binding.requestHash,
        capturedProgramsHash: binding.capturedProgramsHash,
      },
    );
  }
  const replayed = recreated.capture;
  const replayedPopulationHash = replayed.manifest.populationHash;
  if (replayed.populationJson !== capture.populationJson) {
    return failureReport(
      "REPLAY_DIVERGED",
      "Downstream compiler, validation, deduplication, metrics, or ranking diverged",
      {
        capture,
        requestHash: binding.requestHash,
        capturedProgramsHash: binding.capturedProgramsHash,
        capturedPopulationHash: binding.populationHash,
        replayedPopulationHash,
        executedDownstreamReplay: true,
        executedCompiler: recreated.capture.manifest.candidates.some(
          ({ programHash }) => programHash !== null,
        ),
      },
    );
  }
  if (canonicalStringify(replayed.manifest) !== canonicalStringify(capture.manifest)) {
    return failureReport(
      "MANIFEST_MISMATCH",
      "Trusted replay-derived pins or candidate checkpoints do not match the manifest",
      {
        capture,
        requestHash: binding.requestHash,
        capturedProgramsHash: binding.capturedProgramsHash,
        capturedPopulationHash: binding.populationHash,
        replayedPopulationHash,
        executedDownstreamReplay: true,
      },
    );
  }

  const population = JSON.parse(replayed.populationJson) as CapturedMakerPopulationResult;
  const candidates = candidateCheckpoints(population);
  const compiledCandidateCount = population.ok
    ? population.attempts.filter(({ program }) => program !== null).length
    : 0;
  const hardValidCandidateCount = population.ok ? population.rankedCandidates.length : 0;
  const patchVerification = verifyPatches(request as Record<string, unknown>, population);
  const candidateChecks: MakerReplayCheckpoint[] = candidates.map((candidate, index) => ({
    kind: "candidate",
    id: candidate.candidateId,
    expectedHash: capture.manifest.candidates[index]!.candidateDigest,
    actualHash: candidate.candidateDigest,
    passed: capture.manifest.candidates[index]!.candidateDigest === candidate.candidateDigest,
  }));
  const checkpoints: MakerReplayCheckpoint[] = [
    {
      kind: "request",
      id: "request",
      expectedHash: capture.manifest.requestHash,
      actualHash: binding.requestHash,
      passed: capture.manifest.requestHash === binding.requestHash,
    },
    {
      kind: "captured-output",
      id: "deterministic-recipe-results",
      expectedHash: capture.manifest.capturedProgramsHash,
      actualHash: binding.capturedProgramsHash,
      passed: capture.manifest.capturedProgramsHash === binding.capturedProgramsHash,
    },
    {
      kind: "population",
      id: "trusted-downstream-population",
      expectedHash: capture.manifest.populationHash,
      actualHash: replayedPopulationHash,
      passed: capture.manifest.populationHash === replayedPopulationHash,
    },
    ...candidateChecks,
  ];
  if (!patchVerification.ok) {
    return failureReport(
      "PATCH_VERIFICATION_FAILED",
      "Independent patch reapplication did not reproduce a hard-valid candidate",
      {
        capture,
        requestHash: binding.requestHash,
        capturedProgramsHash: binding.capturedProgramsHash,
        capturedPopulationHash: binding.populationHash,
        replayedPopulationHash,
        executedDownstreamReplay: true,
        executedCompiler: compiledCandidateCount > 0,
        capturedResultOk: capture.manifest.resultOk,
        checkedCandidateCount: candidates.length,
        compiledCandidateCount,
        hardValidCandidateCount,
        patchVerifiedCandidateCount: patchVerification.count,
        checkpoints,
      },
    );
  }
  const nonVacuous =
    compiledCandidateCount > 0 &&
    hardValidCandidateCount > 0 &&
    patchVerification.count === hardValidCandidateCount &&
    checkpoints.every(({ passed }) => passed);
  return deepFreeze({
    schemaVersion: MAKER_REPLAY_REPORT_VERSION,
    status: nonVacuous ? "passed" : "audit-only",
    failureCode: null,
    failureMessage: null,
    captureManifestHash: capture.manifestHash,
    requestHash: binding.requestHash,
    capturedProgramsHash: binding.capturedProgramsHash,
    capturedPopulationHash: binding.populationHash,
    replayedPopulationHash,
    executedDownstreamReplay: true,
    executedCompiler: compiledCandidateCount > 0,
    nonVacuous,
    capturedResultOk: capture.manifest.resultOk,
    checkedCandidateCount: candidates.length,
    compiledCandidateCount,
    hardValidCandidateCount,
    patchVerifiedCandidateCount: patchVerification.count,
    checkpoints,
  });
}
