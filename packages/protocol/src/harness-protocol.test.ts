import { describe, expect, it } from "vitest";

import {
  validateDeterministicMakerCaptureManifestV1,
  validateDeterministicMakerOutputV1,
  validateTestRunBundleHandleV1,
  validateTestRunBundleManifestV1,
  type DeterministicMakerCaptureManifestV1,
  type DeterministicMakerOutputV1,
  type TestRunBundleHandleV1,
  type TestRunBundleManifestV1,
} from "./index.ts";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const HASH_D = `sha256:${"d".repeat(64)}`;
const HASH_E = `sha256:${"e".repeat(64)}`;

const output = {
  schemaVersion: "lego.deterministic-maker-output/1",
  makerVersion: "lego.generation/1",
  slots: [
    {
      index: 0,
      strategyId: "deterministic.compact-tower/1",
      shape: "tower",
      outcome: {
        kind: "program",
        program: {
          schemaVersion: "lego.build-program/1",
          operations: [
            {
              kind: "placePart",
              operationId: "place-1",
              localPartId: "part-1",
              catalogPartId: "builtin:brick-1x1",
              colorId: "builtin:red",
              transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
              submodelId: "root",
              stepId: "step-1",
              semanticTags: ["generated"],
            },
          ],
        },
        normalizedProgramHash: HASH_A,
      },
    },
  ],
} satisfies DeterministicMakerOutputV1;

const capture = {
  schemaVersion: "lego.deterministic-maker-capture-manifest/1",
  harnessVersion: "lego.harness/1",
  namespace: "test",
  integrity: "unsealed",
  authenticated: false,
  boundary: "deterministic-recipe-results",
  jobId: "protocol-harness-job",
  protocolVersion: "lego.protocol/1",
  generationVersion: "lego.generation/1",
  compilerSnapshotHash: HASH_A,
  rankingPolicyHash: HASH_B,
  replayPolicyHash: HASH_C,
  baseDocumentHash: HASH_D,
  truthSnapshotHash: HASH_E,
  briefHash: HASH_A,
  normalizedBriefHash: HASH_B,
  scopeDigest: HASH_C,
  requestHash: HASH_D,
  requestByteLength: 128,
  capturedProgramsHash: HASH_E,
  capturedProgramsByteLength: 256,
  populationHash: HASH_A,
  populationByteLength: 512,
  resultOk: true,
  candidates: [
    {
      attemptIndex: 0,
      candidateId: "candidate-1",
      strategyId: "deterministic.compact-tower/1",
      status: "hard-valid",
      programHash: HASH_A,
      structuralHash: HASH_B,
      compilerSnapshotHash: HASH_C,
      patchHash: HASH_D,
      documentHash: HASH_E,
      validationReportHash: HASH_A,
      metricsHash: HASH_B,
      rank: 1,
      candidateDigest: HASH_C,
    },
  ],
} satisfies DeterministicMakerCaptureManifestV1;

const bundle = {
  schemaVersion: "lego.test-run-bundle-manifest/1",
  namespace: "test",
  integrity: "unsealed",
  authenticated: false,
  runId: "test-run-1",
  jobId: capture.jobId,
  coveredEventCount: 6,
  coveredEventRoot: HASH_A,
  replayBoundary: "deterministic-recipe-results",
  roles: [
    {
      role: "request",
      subjectId: capture.jobId,
      artifact: {
        artifactId: "request-artifact",
        kind: "input",
        mediaType: "application/json",
        sha256: capture.requestHash,
        byteLength: capture.requestByteLength,
        casKey: capture.requestHash,
      },
      sourceEvent: {
        sequence: 0,
        eventHash: HASH_B,
        transition: "run.none.created",
        cancellationGeneration: 0,
      },
    },
    {
      role: "maker-output",
      subjectId: "maker-attempt-1",
      artifact: {
        artifactId: "maker-output-artifact",
        kind: "transcript",
        mediaType: "application/json",
        sha256: capture.capturedProgramsHash,
        byteLength: capture.capturedProgramsByteLength,
        casKey: capture.capturedProgramsHash,
      },
      sourceEvent: {
        sequence: 5,
        eventHash: HASH_C,
        transition: "providerAttempt.running.succeeded",
        cancellationGeneration: 0,
      },
    },
  ],
  capture,
  terminalIntent: "exhausted",
} satisfies TestRunBundleManifestV1;

const handle = {
  schemaVersion: "lego.test-run-bundle-handle/1",
  namespace: "test",
  integrity: "unsealed",
  authenticated: false,
  runId: bundle.runId,
  manifestRef: {
    artifactId: "bundle-artifact",
    kind: "bundle",
    mediaType: "application/json",
    sha256: HASH_D,
    byteLength: 1024,
    casKey: HASH_D,
  },
  terminalEventHash: HASH_E,
  terminalSequence: 12,
} satisfies TestRunBundleHandleV1;

describe("deterministic maker output protocol", () => {
  it("accepts only the closed authority-free maker boundary", () => {
    expect(validateDeterministicMakerOutputV1(output)).toBe(true);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            ...output.slots[0],
            candidateId: "forged-candidate",
          },
        ],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            ...output.slots[0],
            outcome: { ...output.slots[0]!.outcome, valid: true },
          },
        ],
      }),
    ).toBe(false);
  });

  it("bounds slots and rejects malformed failure alternatives", () => {
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: Array.from({ length: 5 }, (_, index) => ({
          ...output.slots[0],
          index,
        })),
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [output.slots[0], { ...output.slots[0], index: 1 }],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [{ ...output.slots[0], index: 1 }],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            index: 0,
            strategyId: "deterministic.failed/1",
            shape: "tower",
            outcome: {
              kind: "generationFailure",
              failure: { stage: "generation", code: "SELF_APPROVED", message: "forged" },
            },
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("unsealed test run bundle protocol", () => {
  it("accepts exact capture, role-bound manifest, and non-authoritative handle contracts", () => {
    expect(validateDeterministicMakerCaptureManifestV1(capture)).toBe(true);
    expect(validateTestRunBundleManifestV1(bundle)).toBe(true);
    expect(validateTestRunBundleHandleV1(handle)).toBe(true);
  });

  it("rejects seals, replay levels, production authority, and incomplete hard-valid evidence", () => {
    expect(validateTestRunBundleManifestV1({ ...bundle, seal: {} })).toBe(false);
    expect(validateTestRunBundleManifestV1({ ...bundle, sealedReplayLevel: "full" })).toBe(false);
    expect(validateTestRunBundleManifestV1({ ...bundle, namespace: "production" })).toBe(false);
    expect(
      validateDeterministicMakerCaptureManifestV1({
        ...capture,
        candidates: [{ ...capture.candidates[0], rank: null }],
      }),
    ).toBe(false);
  });

  it("rejects relabelled, cross-hash, diagnostic-only, and wrong-stage artifact roles", () => {
    const requestRole = bundle.roles[0]!;
    const outputRole = bundle.roles[1]!;
    for (const roles of [
      [{ ...requestRole, role: "maker-output" }, outputRole],
      [
        {
          ...requestRole,
          artifact: { ...requestRole.artifact, sha256: HASH_A, casKey: HASH_A },
        },
        outputRole,
      ],
      [
        { ...requestRole, sourceEvent: { ...requestRole.sourceEvent, cancellationGeneration: 1 } },
        outputRole,
      ],
      [
        requestRole,
        {
          ...outputRole,
          sourceEvent: { ...outputRole.sourceEvent, transition: "candidate.rendered.critiqued" },
        },
      ],
    ]) {
      expect(validateTestRunBundleManifestV1({ ...bundle, roles })).toBe(false);
    }
  });

  it("rejects a handle that relabels a transcript as a bundle manifest", () => {
    expect(
      validateTestRunBundleHandleV1({
        ...handle,
        manifestRef: { ...handle.manifestRef, kind: "transcript" },
      }),
    ).toBe(false);
  });
});
