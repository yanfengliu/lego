import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalDigest,
  canonicalStringify,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { DeterministicMakerPopulationInput } from "@lego-studio/generation";
import type { BuildBriefV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import {
  captureDeterministicMakerRun,
  captureMakerRunFromCapturedOutput,
  replayDeterministicMakerRun,
  type DeterministicMakerCapture,
  type MakerCaptureResult,
} from "./index.ts";

function fixture(prompt = "Build a red and yellow 16 piece tower") {
  const document = createEmptyBrickDocument({
    id: "harness-replay-test",
    name: "Harness replay test",
  });
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  const allowedColorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const brief = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt,
    referenceArtifactIds: [],
    baseRevision: document.revision,
    baseDocumentHash,
    allowedCatalogPartIds,
    allowedColorIds,
    pieceBudget: 24,
    semanticRequirements: ["one connected model"],
    styleTags: ["simple"],
    budgets: {
      maxCandidates: 4,
      maxRepairs: 0,
      maxProviderCalls: 0,
      maxTokens: 0,
      maxCostMicros: 0,
      maxWallTimeMs: 10_000,
      maxRenders: 28,
      maxStoredBytes: 16_777_216,
    },
    consent: {
      policyVersion: "local-model-agnostic-harness-1",
      providerTransmission: "none",
      retainRunArtifacts: true,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  } satisfies BuildBriefV1;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "harness-full-empty-scope",
    baseRevision: document.revision,
    baseDocumentHash,
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: {
      minLdu: [-400, -400, -400],
      maxLdu: [400, 400, 400],
    },
    allowedCatalogPartIds,
    allowedColorIds,
    budgets: { maxAddedParts: 24, maxRemovedParts: 0, maxOperations: 160 },
  } satisfies ScopeCapabilityV1;
  return {
    jobId: "harness-replay-job",
    document,
    brief,
    scope,
  } satisfies DeterministicMakerPopulationInput;
}

function withManifest(
  capture: DeterministicMakerCapture,
  manifest: DeterministicMakerCapture["manifest"],
  overrides: Partial<DeterministicMakerCapture> = {},
): DeterministicMakerCapture {
  return {
    ...capture,
    ...overrides,
    manifest,
    manifestHash: canonicalDigest(manifest),
  };
}

function capture(result: MakerCaptureResult): DeterministicMakerCapture {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.failure.message);
  return result.capture;
}

function sha256Text(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

describe("deterministic maker capture and replay", () => {
  it("captures identical canonical evidence and four explicit candidate checkpoints", () => {
    const first = capture(captureDeterministicMakerRun(fixture()));
    const second = capture(captureDeterministicMakerRun(fixture()));

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe("lego.deterministic-maker-capture/1");
    expect(first.manifest).toMatchObject({
      namespace: "test",
      integrity: "unsealed",
      authenticated: false,
    });
    expect(first.manifest.boundary).toBe("deterministic-recipe-results");
    expect(first.manifest.resultOk).toBe(true);
    expect(first.manifest.candidates).toHaveLength(4);
    expect(first.manifest.candidates.map(({ rank }) => rank).sort()).toEqual([1, 2, 3, 4]);
    expect(
      first.manifest.candidates.every(({ validationReportHash }) => validationReportHash),
    ).toBe(true);
    expect(first.requestJson).toBe(canonicalStringify(fixture()));
    expect(first.manifest.requestHash).toBe(canonicalDigest(fixture()));
    expect(first.manifestHash).toBe(canonicalDigest(first.manifest));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.manifest)).toBe(true);
    expect(Object.isFrozen(first.manifest.candidates)).toBe(true);
  });

  it("reexecutes the released compiler and proves every captured checkpoint", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const report = replayDeterministicMakerRun(runCapture);

    expect(report).toMatchObject({
      schemaVersion: "lego.deterministic-maker-replay-report/1",
      status: "passed",
      failureCode: null,
      executedCompiler: true,
      executedDownstreamReplay: true,
      nonVacuous: true,
      capturedResultOk: true,
      checkedCandidateCount: 4,
      requestHash: runCapture.manifest.requestHash,
      capturedProgramsHash: runCapture.manifest.capturedProgramsHash,
      capturedPopulationHash: runCapture.manifest.populationHash,
      replayedPopulationHash: runCapture.manifest.populationHash,
      patchVerifiedCandidateCount: 4,
    });
    expect(report.checkpoints).toHaveLength(7);
    expect(report.checkpoints.every(({ passed }) => passed)).toBe(true);
    expect(report.checkpoints.map(({ kind }) => kind)).toEqual([
      "request",
      "captured-output",
      "population",
      "candidate",
      "candidate",
      "candidate",
      "candidate",
    ]);
  });

  it("rejects changed response bytes before treating them as replay evidence", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const report = replayDeterministicMakerRun({
      ...runCapture,
      populationJson: `${runCapture.populationJson} `,
    });

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("POPULATION_HASH_MISMATCH");
    expect(report.executedCompiler).toBe(false);
  });

  it("rejects a rewritten checkpoint manifest even when the payload bytes are unchanged", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const changedManifest = {
      ...runCapture.manifest,
      candidates: runCapture.manifest.candidates.map((candidate, index) =>
        index === 0 ? { ...candidate, rank: 4 } : candidate,
      ),
    };
    const report = replayDeterministicMakerRun({ ...runCapture, manifest: changedManifest });

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("MANIFEST_HASH_MISMATCH");
    expect(report.executedCompiler).toBe(false);
  });

  it("rejects a self-consistently rehashed policy pin before downstream execution", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const manifest = {
      ...runCapture.manifest,
      rankingPolicyHash: `sha256:${"e".repeat(64)}` as const,
    };
    const report = replayDeterministicMakerRun(withManifest(runCapture, manifest));

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("MANIFEST_MISMATCH");
    expect(report.executedDownstreamReplay).toBe(false);
  });

  it("rejects authority-bearing seal or replay-level fields on an unsealed capture", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const forged = {
      ...runCapture,
      manifest: {
        ...runCapture.manifest,
        sealedReplayLevel: "full",
        seal: { algorithm: "Ed25519", signature: "forged" },
      },
    };
    const report = replayDeterministicMakerRun(forged);

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("CAPTURE_SHAPE_INVALID");
    expect(report.executedDownstreamReplay).toBe(false);
  });

  it("replays a changed valid captured program without regenerating the recipe", () => {
    const input = fixture();
    const generated = capture(captureDeterministicMakerRun(input));
    const capturedOutput = JSON.parse(generated.capturedProgramsJson) as {
      slots: Array<{ outcome: Record<string, unknown> }>;
    };
    const first = capturedOutput.slots[0]!.outcome;
    const program = structuredClone(first.program) as {
      operations: Array<Record<string, unknown>>;
    };
    const placement = program.operations.find(
      (operation) => operation.kind === "placePart" && operation.operationId === "place-1",
    )!;
    placement.colorId = "builtin:blue";
    first.program = program;
    first.normalizedProgramHash = canonicalDigest(program);
    const changed = capture(captureMakerRunFromCapturedOutput(input, capturedOutput));
    const report = replayDeterministicMakerRun(changed);

    expect(changed.manifest.capturedProgramsHash).not.toBe(generated.manifest.capturedProgramsHash);
    expect(changed.manifest.populationHash).not.toBe(generated.manifest.populationHash);
    expect(report.status).toBe("passed");
    expect(report.nonVacuous).toBe(true);
    expect(report.replayedPopulationHash).toBe(changed.manifest.populationHash);
  });

  it("requires exact canonical JSON rather than semantically equivalent request text", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture()));
    const requestJson = ` ${runCapture.requestJson}`;
    const manifest = {
      ...runCapture.manifest,
      requestHash: sha256Text(requestJson),
      requestByteLength: new TextEncoder().encode(requestJson).byteLength,
    };
    const report = replayDeterministicMakerRun(withManifest(runCapture, manifest, { requestJson }));

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("REQUEST_NOT_CANONICAL");
    expect(report.executedCompiler).toBe(false);
  });

  it("fails closed for cyclic capture wrappers without executing generation", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.capture = cyclic;

    const report = replayDeterministicMakerRun(cyclic);

    expect(report.status).toBe("failed");
    expect(report.failureCode).toBe("CAPTURE_NOT_DATA_ONLY");
    expect(report.executedCompiler).toBe(false);
  });

  it("retains and replays a deterministic rejected input as failure evidence", () => {
    const runCapture = capture(captureDeterministicMakerRun(fixture("Build a 16 piece dragon")));
    const report = replayDeterministicMakerRun(runCapture);

    expect(runCapture.manifest.resultOk).toBe(false);
    expect(runCapture.manifest.candidates).toEqual([]);
    expect(report).toMatchObject({
      status: "audit-only",
      failureCode: null,
      executedCompiler: false,
      executedDownstreamReplay: true,
      nonVacuous: false,
      capturedResultOk: false,
      checkedCandidateCount: 0,
    });
    expect(report.checkpoints).toHaveLength(3);
  });
});
