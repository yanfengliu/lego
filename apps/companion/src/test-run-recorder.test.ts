import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  canonicalStringify,
  createEmptyBrickDocument,
  documentStructuralHash,
  normalizeScopeCapability,
} from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  PROTOCOL_VERSION,
  validateDeterministicMakerCaptureManifestV1,
  validateDeterministicMakerOutputV1,
  validateTestRunBundleHandleV1,
  validateTestRunBundleManifestV1,
  type BuildBriefV1,
  type DeterministicMakerCaptureManifestV1,
  type DeterministicMakerOutputV1,
  type ScopeCapabilityV1,
  type TestRunBundleManifestV1,
} from "@lego-studio/protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  openArtifactStore,
  openTestRunLedger,
  openTestRunRecorder,
  type ArtifactStore,
  type TestMakerRunRequest,
  type TestRunLedger,
} from "./index.ts";
import { canonicalJson, sha256 } from "./run-ledger-codec.ts";

const encoder = new TextEncoder();
const sandboxes: string[] = [];

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lego-test-run-recorder-"));
  sandboxes.push(path);
  return path;
}

function fixture(retainRunArtifacts = true, maxStoredBytes = 16_777_216): TestMakerRunRequest {
  const document = createEmptyBrickDocument({
    id: "test-recorder-document",
    name: "Test recorder document",
  });
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  const allowedColorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const brief = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt: "Build a red and yellow 16 piece tower",
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
      maxStoredBytes,
    },
    consent: {
      policyVersion: "local-test-run-recorder-1",
      providerTransmission: "none",
      retainRunArtifacts,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  } satisfies BuildBriefV1;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "test-recorder-full-empty-scope",
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
  return { jobId: "test-recorder-job", document, brief, scope };
}

const PROGRAM = {
  schemaVersion: "lego.build-program/1",
  operations: [
    {
      kind: "placePart",
      operationId: "place-1",
      localPartId: "tower-base",
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:red",
      transform: { positionLdu: [0, 12, 0], orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: [],
    },
  ],
} as const;

const PROGRAM_HASH = canonicalDigest(PROGRAM);

/**
 * Captured maker output, stated rather than generated.
 *
 * The deterministic maker that produced bytes in this shape was deleted with the
 * AI copilot. The recorder under test never ran it — it only ever received the
 * output as untrusted wire data and re-validated it — so a literal fixture
 * exercises exactly the boundary that survives, and one slot of each outcome
 * kind covers both branches of `assertCaptureBindings`.
 */
function makerOutput(): DeterministicMakerOutputV1 {
  const output = {
    schemaVersion: "lego.deterministic-maker-output/1",
    makerVersion: "lego.test-recorder-maker/1",
    slots: [
      {
        index: 0,
        strategyId: "tower-stack",
        shape: "tower",
        outcome: { kind: "program", program: PROGRAM, normalizedProgramHash: PROGRAM_HASH },
      },
      {
        index: 1,
        strategyId: "spire-taper",
        shape: "spire",
        outcome: {
          kind: "generationFailure",
          failure: {
            stage: "generation",
            code: "OPERATION_BUDGET_TOO_SMALL",
            message: "The operation budget cannot reach the requested height",
          },
        },
      },
    ],
  };
  if (!validateDeterministicMakerOutputV1(output)) {
    throw new Error("Test recorder fixture is not a valid deterministic maker output");
  }
  return output as unknown as DeterministicMakerOutputV1;
}

/** A manifest bound to the exact request and output bytes the recorder retains. */
function captureManifest(
  input: TestMakerRunRequest,
  output: DeterministicMakerOutputV1,
): DeterministicMakerCaptureManifestV1 {
  const requestJson = canonicalStringify(input);
  const outputJson = canonicalJson(output);
  const manifest = {
    schemaVersion: "lego.deterministic-maker-capture-manifest/1",
    harnessVersion: "lego.harness/1",
    namespace: "test",
    integrity: "unsealed",
    authenticated: false,
    boundary: "deterministic-recipe-results",
    jobId: input.jobId,
    protocolVersion: PROTOCOL_VERSION,
    generationVersion: output.makerVersion,
    compilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
    rankingPolicyHash: canonicalDigest({ policy: "test-recorder-ranking" }),
    replayPolicyHash: canonicalDigest({ policy: "test-recorder-replay" }),
    baseDocumentHash: documentStructuralHash(input.document),
    truthSnapshotHash: canonicalDigest(input.document.truth),
    briefHash: canonicalDigest(input.brief),
    normalizedBriefHash: canonicalDigest(input.brief),
    scopeDigest: canonicalDigest(normalizeScopeCapability(input.scope)),
    requestHash: sha256(requestJson),
    requestByteLength: Buffer.byteLength(requestJson, "utf8"),
    capturedProgramsHash: sha256(outputJson),
    capturedProgramsByteLength: Buffer.byteLength(outputJson, "utf8"),
    populationHash: canonicalDigest({ population: outputJson }),
    populationByteLength: outputJson.length,
    resultOk: true,
    candidates: [
      {
        attemptIndex: 0,
        candidateId: "candidate-0",
        strategyId: "tower-stack",
        status: "hard-valid",
        failureStage: null,
        failureCode: null,
        programHash: PROGRAM_HASH,
        structuralHash: canonicalDigest({ candidate: 0 }),
        compilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
        patchHash: canonicalDigest({ patch: 0 }),
        documentHash: canonicalDigest({ document: 0 }),
        validationReportHash: canonicalDigest({ report: 0 }),
        metricsHash: canonicalDigest({ metrics: 0 }),
        rank: 1,
        candidateDigest: canonicalDigest({ digest: 0 }),
      },
      {
        attemptIndex: 1,
        candidateId: "candidate-1",
        strategyId: "spire-taper",
        status: "failed",
        failureStage: "generation",
        failureCode: "OPERATION_BUDGET_TOO_SMALL",
        programHash: null,
        structuralHash: null,
        compilerSnapshotHash: null,
        patchHash: null,
        documentHash: null,
        validationReportHash: null,
        metricsHash: null,
        rank: null,
        candidateDigest: canonicalDigest({ digest: 1 }),
      },
    ],
  };
  if (!validateDeterministicMakerCaptureManifestV1(manifest)) {
    throw new Error("Test recorder fixture is not a valid capture manifest");
  }
  return manifest as unknown as DeterministicMakerCaptureManifestV1;
}

async function openRun(
  input: TestMakerRunRequest,
  decorateStore?: (store: ArtifactStore) => ArtifactStore,
) {
  const root = await sandbox();
  const store = await openArtifactStore({ root: join(root, "artifacts") });
  const recorderStore = decorateStore?.(store) ?? store;
  const ledger = await openTestRunLedger({
    root: join(root, "ledger"),
    namespace: "test",
    expectedRunId: "test-recorder-run",
    artifactResolver: store,
  });
  const recorder = await openTestRunRecorder({
    schemaVersion: "lego.test-run-recorder-options/1",
    namespace: "test",
    runId: "test-recorder-run",
    actorId: "test-recorder",
    requestJson: canonicalStringify(input),
    artifactStore: recorderStore,
    ledger,
  });
  return { ledger, recorder, recorderStore, store };
}

afterEach(async () => {
  for (const path of sandboxes.splice(0)) await rm(path, { recursive: true, force: true });
});

describe("unsealed test-run recorder", () => {
  it("anchors retained request and maker output to an atomic exhausted bundle", async () => {
    const input = fixture();
    const output = makerOutput();
    const capture = captureManifest(input, output);
    const { ledger, recorder, store } = await openRun(input);

    const outputRef = await recorder.recordMakerOutput(canonicalJson(output));
    const handle = await recorder.finalizeCapture(capture);
    const retryHandle = await recorder.finalizeCapture(capture);

    expect(handle).toEqual(retryHandle);
    expect(validateTestRunBundleHandleV1(handle)).toBe(true);
    expect(handle).toMatchObject({
      namespace: "test",
      integrity: "unsealed",
      authenticated: false,
      runId: "test-recorder-run",
    });
    const manifest = JSON.parse(
      new TextDecoder().decode(await store.read(handle.manifestRef)),
    ) as TestRunBundleManifestV1;
    expect(validateTestRunBundleManifestV1(manifest)).toBe(true);
    expect(manifest.capture).toEqual(capture);
    expect(manifest.roles.map(({ role }) => role)).toEqual(["request", "maker-output"]);
    expect(manifest.roles[1]?.artifact).toEqual(outputRef);
    expect(manifest.roles.map(({ sourceEvent }) => sourceEvent.transition)).toEqual([
      "run.none.created",
      "providerAttempt.running.succeeded",
    ]);
    expect(manifest.coveredEventCount).toBe(handle.terminalSequence);
    expect(manifest.coveredEventRoot).toBe(
      ledger.events()[handle.terminalSequence]?.event.previousEventHash,
    );
    expect(ledger.snapshot()).toMatchObject({
      runState: "exhausted",
      providerAttempts: [{ state: "succeeded" }],
      candidates: capture.candidates.map(({ candidateId }) => ({
        id: candidateId,
        state: "archived",
      })),
    });
    expect(
      ledger
        .events()
        .filter(({ transition }) => transition.subject === "candidate")
        .map(({ transition }) => transition.to),
    ).toEqual(capture.candidates.flatMap(() => ["received", "archived"]));
    expect(ledger.events().at(-1)?.artifactRefs).toEqual([handle.manifestRef]);
    await ledger.close();
  });

  it("resumes the same run without duplicating events after caller state is lost", async () => {
    const input = fixture();
    const output = makerOutput();
    const capture = captureManifest(input, output);
    const { ledger, recorder, store } = await openRun(input);
    await recorder.recordMakerOutput(canonicalJson(output));
    const first = await recorder.finalizeCapture(capture);
    const count = ledger.snapshot().eventCount;

    const resumed = await openTestRunRecorder({
      schemaVersion: "lego.test-run-recorder-options/1",
      namespace: "test",
      runId: "test-recorder-run",
      actorId: "test-recorder",
      requestJson: canonicalStringify(input),
      artifactStore: store,
      ledger,
    });
    await resumed.recordMakerOutput(canonicalJson(output));
    const second = await resumed.finalizeCapture(capture);

    expect(second).toEqual(first);
    expect(ledger.snapshot().eventCount).toBe(count);
    await ledger.close();
  });

  it("rejects capture relabeling before writing candidate or bundle evidence", async () => {
    const input = fixture();
    const output = makerOutput();
    const capture = captureManifest(input, output);
    const { ledger, recorder } = await openRun(input);
    await recorder.recordMakerOutput(canonicalJson(output));
    const before = ledger.snapshot();
    const relabeled = {
      ...capture,
      requestHash: `sha256:${"e".repeat(64)}` as const,
    };

    await expect(recorder.finalizeCapture(relabeled)).rejects.toMatchObject({
      code: "INVALID_CAPTURE",
    });
    expect(ledger.snapshot()).toEqual(before);
    await ledger.close();
  });

  it("rejects accessor-bearing capture data without executing it or changing the ledger", async () => {
    const input = fixture();
    const output = makerOutput();
    const capture = captureManifest(input, output);
    const { ledger, recorder } = await openRun(input);
    await recorder.recordMakerOutput(canonicalJson(output));
    const before = ledger.snapshot();
    let reads = 0;
    const hostile = { ...capture } as Record<string, unknown>;
    Object.defineProperty(hostile, "jobId", {
      enumerable: true,
      get() {
        reads += 1;
        return capture.jobId;
      },
    });

    await expect(recorder.finalizeCapture(hostile)).rejects.toMatchObject({
      code: "INVALID_CAPTURE",
    });
    expect(reads).toBe(0);
    expect(ledger.snapshot()).toEqual(before);
    await ledger.close();
  });

  it("binds capture bytes before candidate events so a crash retry cannot replace them", async () => {
    const input = fixture();
    const output = makerOutput();
    const capture = captureManifest(input, output);
    let failBundlePut = true;
    const { ledger, recorder, recorderStore, store } = await openRun(input, (base) => ({
      async put(value) {
        if (failBundlePut && value.kind === "bundle") throw new Error("injected bundle failure");
        return base.put(value);
      },
      read: (reference) => base.read(reference),
    }));
    await recorder.recordMakerOutput(canonicalJson(output));
    await expect(recorder.finalizeCapture(capture)).rejects.toThrow("injected bundle failure");
    expect(ledger.snapshot().runState).toBe("draining");
    failBundlePut = false;

    const resumed = await openTestRunRecorder({
      schemaVersion: "lego.test-run-recorder-options/1",
      namespace: "test",
      runId: "test-recorder-run",
      actorId: "test-recorder",
      requestJson: canonicalStringify(input),
      artifactStore: recorderStore,
      ledger,
    });
    await resumed.recordMakerOutput(canonicalJson(output));
    const before = ledger.snapshot();
    await expect(
      resumed.finalizeCapture({
        ...capture,
        populationHash: `sha256:${"f".repeat(64)}`,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(ledger.snapshot()).toEqual(before);
    expect(await store.read(ledger.events()[5]!.artifactRefs[0]!)).toEqual(
      encoder.encode(canonicalJson(output)),
    );
    await ledger.close();
  });

  it("fails closed on missing retention consent before invoking storage or ledger capabilities", async () => {
    let calls = 0;
    const store = {
      async put() {
        calls += 1;
        throw new Error("must not write");
      },
      async read() {
        calls += 1;
        throw new Error("must not read");
      },
    } satisfies ArtifactStore;
    const ledger = {
      namespace: "test",
      runId: "test-recorder-run",
      async append() {
        calls += 1;
        throw new Error("must not append");
      },
      async finalizeBundle() {
        calls += 1;
        throw new Error("must not finalize");
      },
      events: () => [],
      snapshot: () => {
        calls += 1;
        throw new Error("must not snapshot");
      },
      async close() {
        calls += 1;
      },
    } satisfies TestRunLedger;

    await expect(
      openTestRunRecorder({
        schemaVersion: "lego.test-run-recorder-options/1",
        namespace: "test",
        runId: "test-recorder-run",
        actorId: "test-recorder",
        requestJson: canonicalStringify(fixture(false)),
        artifactStore: store,
        ledger,
      }),
    ).rejects.toMatchObject({ code: "RETENTION_NOT_AUTHORIZED" });
    expect(calls).toBe(0);
  });

  it("rejects a request outside its retained-byte budget before capability I/O", async () => {
    let calls = 0;
    const store = {
      async put() {
        calls += 1;
        throw new Error("must not write");
      },
      async read() {
        calls += 1;
        throw new Error("must not read");
      },
    } satisfies ArtifactStore;
    const ledger = {
      namespace: "test",
      runId: "test-recorder-run",
      async append() {
        calls += 1;
        throw new Error("must not append");
      },
      async finalizeBundle() {
        calls += 1;
        throw new Error("must not finalize");
      },
      events: () => [],
      snapshot: () => {
        calls += 1;
        throw new Error("must not snapshot");
      },
      async close() {
        calls += 1;
      },
    } satisfies TestRunLedger;

    await expect(
      openTestRunRecorder({
        schemaVersion: "lego.test-run-recorder-options/1",
        namespace: "test",
        runId: "test-recorder-run",
        actorId: "test-recorder",
        requestJson: canonicalStringify(fixture(true, 1)),
        artifactStore: store,
        ledger,
      }),
    ).rejects.toMatchObject({ code: "RETENTION_BUDGET_EXCEEDED" });
    expect(calls).toBe(0);
  });

  it("rejects maker output that would exceed the retained-byte budget before its CAS put", async () => {
    const roomy = fixture();
    const roomyOutput = makerOutput();
    const limit =
      Buffer.byteLength(canonicalStringify(roomy), "utf8") +
      Math.floor(Buffer.byteLength(canonicalJson(roomyOutput), "utf8") / 2);
    const input = fixture(true, limit);
    const output = makerOutput();
    expect(Buffer.byteLength(canonicalStringify(input), "utf8")).toBeLessThan(limit);
    expect(
      Buffer.byteLength(canonicalStringify(input), "utf8") +
        Buffer.byteLength(canonicalJson(output), "utf8"),
    ).toBeGreaterThan(limit);
    let puts = 0;
    const { ledger, recorder } = await openRun(input, (base) => ({
      async put(value) {
        puts += 1;
        return base.put(value);
      },
      read: (reference) => base.read(reference),
    }));

    await expect(recorder.recordMakerOutput(canonicalJson(output))).rejects.toMatchObject({
      code: "RETENTION_BUDGET_EXCEEDED",
    });
    expect(puts).toBe(1);
    expect(ledger.snapshot()).toMatchObject({
      runState: "running",
      providerAttempts: [{ state: "running" }],
    });
    await ledger.close();
  });
});
