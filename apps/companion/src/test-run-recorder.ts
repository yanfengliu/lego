import {
  validateTestRunBundleHandleV1,
  validateTestRunBundleManifestV1,
  type ArtifactRefV1,
  type DeterministicMakerOutputV1,
  type TestRunBundleHandleV1,
  type TestRunBundleManifestV1,
} from "@lego-studio/protocol";

import type { ArtifactStore } from "./artifact-policy.ts";
import { canonicalJson } from "./run-ledger-codec.ts";
import type {
  AppendRunEventInput,
  AppendRunEventResult,
  NativeRunTransition,
  StoredNativeRunEvent,
  TestRunLedger,
} from "./run-ledger-types.ts";
import {
  assertCaptureBindings,
  assertRecorderRetentionBudget,
  derivedRecorderId,
  normalizeRecorderOptions,
  parseCaptureManifest,
  parseDeterministicMakerOutput,
  recorderArtifactReference,
  recorderSourceEvent,
  sameArtifactReference,
  TestRunRecorderError,
  type NormalizedRecorderOptions,
  type TestMakerRunRequest,
} from "./test-run-recorder-codec.ts";
import {
  candidateTransitionSteps,
  RECORDER_EVENT_KEYS as KEYS,
} from "./test-run-recorder-transitions.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface TestRunRecorder {
  readonly namespace: "test";
  readonly runId: string;
  readonly jobId: string;
  recordMakerOutput(outputJson: string): Promise<ArtifactRefV1>;
  finalizeCapture(capture: unknown): Promise<TestRunBundleHandleV1>;
}

class NativeTestRunRecorder implements TestRunRecorder {
  readonly namespace = "test" as const;
  readonly runId: string;
  readonly jobId: string;
  readonly #actorId: string;
  readonly #attemptId: string;
  readonly #artifactStore: ArtifactStore;
  readonly #ledger: TestRunLedger;
  readonly #request: TestMakerRunRequest;
  readonly #requestJson: string;
  readonly #requestRef: ArtifactRefV1;
  readonly #requestEvent: StoredNativeRunEvent;
  #output: DeterministicMakerOutputV1 | null = null;
  #outputJson: string | null = null;
  #outputRef: ArtifactRefV1 | null = null;
  #captureJson: string | null = null;

  private constructor(
    options: NormalizedRecorderOptions,
    requestRef: ArtifactRefV1,
    requestEvent: StoredNativeRunEvent,
  ) {
    this.runId = options.runId;
    this.jobId = options.request.jobId;
    this.#actorId = options.actorId;
    this.#attemptId = derivedRecorderId("local-maker-attempt", options.runId);
    this.#artifactStore = options.artifactStore;
    this.#ledger = options.ledger;
    this.#request = options.request;
    this.#requestJson = options.requestJson;
    this.#requestRef = requestRef;
    this.#requestEvent = requestEvent;
  }

  static async open(options: NormalizedRecorderOptions): Promise<NativeTestRunRecorder> {
    const requestRef = recorderArtifactReference(
      derivedRecorderId("retained-request", options.runId),
      "input",
      options.requestJson,
    );
    assertRecorderRetentionBudget(options.request, [requestRef]);
    NativeTestRunRecorder.assertExistingReference(options.ledger, KEYS.runCreated, requestRef);
    const storedRef = await options.artifactStore.put({
      artifactId: requestRef.artifactId,
      kind: requestRef.kind,
      mediaType: requestRef.mediaType,
      bytes: encoder.encode(options.requestJson),
    });
    if (!sameArtifactReference(storedRef, requestRef)) {
      throw new TestRunRecorderError("INVALID_STATE", "Artifact store changed the request binding");
    }
    const attemptId = derivedRecorderId("local-maker-attempt", options.runId);
    const append = (
      key: string,
      transition: NativeRunTransition,
      refs: readonly ArtifactRefV1[] = [],
    ) => NativeTestRunRecorder.append(options, key, transition, refs);
    const created = await append(
      KEYS.runCreated,
      {
        subject: "run",
        subjectId: options.runId,
        from: null,
        to: "created",
      },
      [requestRef],
    );
    await append(KEYS.runQueued, {
      subject: "run",
      subjectId: options.runId,
      from: "created",
      to: "queued",
    });
    await append(KEYS.runRunning, {
      subject: "run",
      subjectId: options.runId,
      from: "queued",
      to: "running",
    });
    await append(KEYS.attemptCreated, {
      subject: "providerAttempt",
      subjectId: attemptId,
      from: null,
      to: "created",
    });
    await append(KEYS.attemptRunning, {
      subject: "providerAttempt",
      subjectId: attemptId,
      from: "created",
      to: "running",
    });
    return new NativeTestRunRecorder(options, requestRef, created.event);
  }

  async recordMakerOutput(outputJson: string): Promise<ArtifactRefV1> {
    const output = parseDeterministicMakerOutput(outputJson);
    if (this.#outputJson !== null && this.#outputJson !== outputJson) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        "A recorder instance cannot replace its captured maker output",
      );
    }
    const expected = recorderArtifactReference(
      derivedRecorderId("maker-output", this.runId),
      "transcript",
      outputJson,
    );
    assertRecorderRetentionBudget(this.#request, [this.#requestRef, expected]);
    const existing = this.#eventByKey(KEYS.attemptSucceeded);
    if (
      existing &&
      (existing.artifactRefs.length !== 2 ||
        !sameArtifactReference(existing.artifactRefs[0]!, expected))
    ) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        "Existing maker terminal event is not bound to the retained output bytes",
      );
    }
    const stored = await this.#artifactStore.put({
      artifactId: expected.artifactId,
      kind: expected.kind,
      mediaType: expected.mediaType,
      bytes: encoder.encode(outputJson),
    });
    if (!sameArtifactReference(stored, expected)) {
      throw new TestRunRecorderError("INVALID_STATE", "Artifact store changed the output binding");
    }
    this.#output = output;
    this.#outputJson = outputJson;
    this.#outputRef = stored;
    return stored;
  }

  async finalizeCapture(value: unknown): Promise<TestRunBundleHandleV1> {
    if (!this.#output || !this.#outputJson || !this.#outputRef) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        "Maker output must be retained before capture finalization",
      );
    }
    const capture = parseCaptureManifest(value);
    assertCaptureBindings(
      this.#requestJson,
      this.#request,
      this.#outputJson,
      this.#output,
      capture,
    );
    const captureJson = canonicalJson(capture);
    if (this.#captureJson !== null && this.#captureJson !== captureJson) {
      throw new TestRunRecorderError("INVALID_STATE", "A recorder cannot replace its capture");
    }
    this.#captureJson = captureJson;
    const captureRef = recorderArtifactReference(
      derivedRecorderId("capture-checkpoints", this.runId),
      "report",
      captureJson,
    );
    assertRecorderRetentionBudget(this.#request, [this.#requestRef, this.#outputRef, captureRef]);
    const attemptRefs = [this.#outputRef, captureRef] as const;
    NativeTestRunRecorder.assertExistingReferences(
      this.#ledger,
      KEYS.attemptSucceeded,
      attemptRefs,
    );
    const storedCapture = await this.#artifactStore.put({
      artifactId: captureRef.artifactId,
      kind: captureRef.kind,
      mediaType: captureRef.mediaType,
      bytes: encoder.encode(captureJson),
    });
    if (!sameArtifactReference(storedCapture, captureRef)) {
      throw new TestRunRecorderError("INVALID_STATE", "Artifact store changed the capture binding");
    }
    const outputTerminal = await this.#append(
      KEYS.attemptSucceeded,
      {
        subject: "providerAttempt",
        subjectId: this.#attemptId,
        from: "running",
        to: "succeeded",
      },
      attemptRefs,
    );

    for (const candidate of capture.candidates) {
      for (const step of candidateTransitionSteps(candidate)) {
        await this.#append(step.idempotencyKey, step.transition);
      }
    }
    await this.#append(KEYS.runDraining, {
      subject: "run",
      subjectId: this.runId,
      from: "running",
      to: "draining",
    });

    const existingTerminal = this.#eventByKey(KEYS.finalize);
    const snapshot = this.#ledger.snapshot();
    const coveredEventCount = existingTerminal?.event.sequence ?? snapshot.eventCount;
    const coveredEventRoot = (existingTerminal?.event.previousEventHash ??
      snapshot.eventRoot) as `sha256:${string}`;
    const manifest: TestRunBundleManifestV1 = {
      schemaVersion: "lego.test-run-bundle-manifest/1",
      namespace: "test",
      integrity: "unsealed",
      authenticated: false,
      runId: this.runId,
      jobId: this.jobId,
      coveredEventCount,
      coveredEventRoot,
      replayBoundary: "deterministic-recipe-results",
      roles: [
        {
          role: "request",
          subjectId: this.jobId,
          artifact: this.#requestRef,
          sourceEvent: recorderSourceEvent(this.#requestEvent),
        },
        {
          role: "maker-output",
          subjectId: this.#attemptId,
          artifact: this.#outputRef,
          sourceEvent: recorderSourceEvent(outputTerminal.event),
        },
      ],
      capture,
      terminalIntent: "exhausted",
    };
    if (!validateTestRunBundleManifestV1(manifest)) {
      throw new TestRunRecorderError(
        "INVALID_CAPTURE",
        "Constructed bundle manifest violates the test replay contract",
      );
    }
    const manifestJson = canonicalJson(manifest);
    const manifestRef = await this.#retainOrMatchManifest(
      manifestJson,
      existingTerminal,
      captureRef,
    );
    const terminal = await this.#ledger.finalizeBundle({
      schemaVersion: "lego.test-run-finalize/1",
      namespace: "test",
      expectedRunId: this.runId,
      expectedEventCount: coveredEventCount,
      expectedEventRoot: coveredEventRoot,
      append: this.#appendInput(
        KEYS.finalize,
        {
          subject: "run",
          subjectId: this.runId,
          from: "draining",
          to: "exhausted",
        },
        [manifestRef],
      ),
    });
    const handle: TestRunBundleHandleV1 = {
      schemaVersion: "lego.test-run-bundle-handle/1",
      namespace: "test",
      integrity: "unsealed",
      authenticated: false,
      runId: this.runId,
      manifestRef,
      terminalEventHash: terminal.event.event.eventHash,
      terminalSequence: terminal.event.event.sequence,
    };
    if (!validateTestRunBundleHandleV1(handle)) {
      throw new TestRunRecorderError("INVALID_STATE", "Constructed bundle handle is invalid");
    }
    return Object.freeze(handle);
  }

  async #retainOrMatchManifest(
    manifestJson: string,
    existingTerminal: StoredNativeRunEvent | undefined,
    captureRef: ArtifactRefV1,
  ): Promise<ArtifactRefV1> {
    const expected = recorderArtifactReference(
      derivedRecorderId("test-run-bundle", this.runId),
      "bundle",
      manifestJson,
    );
    assertRecorderRetentionBudget(this.#request, [
      this.#requestRef,
      this.#outputRef!,
      captureRef,
      expected,
    ]);
    const existingRef = existingTerminal?.artifactRefs[0];
    if (existingRef) {
      if (!sameArtifactReference(existingRef, expected)) {
        throw new TestRunRecorderError(
          "INVALID_STATE",
          "Existing terminal bundle does not match the requested capture",
        );
      }
      let retained: string;
      try {
        retained = decoder.decode(await this.#artifactStore.read(existingRef));
      } catch (error) {
        throw new TestRunRecorderError(
          "INVALID_STATE",
          "Existing terminal bundle could not be read and verified",
          { cause: error },
        );
      }
      if (retained !== manifestJson) {
        throw new TestRunRecorderError(
          "INVALID_STATE",
          "Existing terminal bundle bytes do not match the reconstructed manifest",
        );
      }
      return existingRef;
    }
    const stored = await this.#artifactStore.put({
      artifactId: expected.artifactId,
      kind: expected.kind,
      mediaType: expected.mediaType,
      bytes: encoder.encode(manifestJson),
    });
    if (!sameArtifactReference(stored, expected)) {
      throw new TestRunRecorderError("INVALID_STATE", "Artifact store changed the bundle binding");
    }
    return stored;
  }

  #append(
    key: string,
    transition: NativeRunTransition,
    refs: readonly ArtifactRefV1[] = [],
  ): Promise<AppendRunEventResult> {
    return NativeTestRunRecorder.append(
      {
        runId: this.runId,
        actorId: this.#actorId,
        ledger: this.#ledger,
      },
      key,
      transition,
      refs,
    );
  }

  #appendInput(
    key: string,
    transition: NativeRunTransition,
    refs: readonly ArtifactRefV1[] = [],
  ): AppendRunEventInput {
    return {
      schemaVersion: "lego.test-run-append/1",
      namespace: "test",
      expectedRunId: this.runId,
      actorId: this.#actorId,
      idempotencyKey: key,
      cancellationGeneration: 0,
      transition,
      artifactRefs: refs,
    };
  }

  #eventByKey(key: string): StoredNativeRunEvent | undefined {
    return this.#ledger.events().find(({ event }) => event.idempotencyKey === key);
  }

  static async append(
    options: Pick<NormalizedRecorderOptions, "runId" | "actorId" | "ledger">,
    key: string,
    transition: NativeRunTransition,
    refs: readonly ArtifactRefV1[] = [],
  ): Promise<AppendRunEventResult> {
    const result = await options.ledger.append({
      schemaVersion: "lego.test-run-append/1",
      namespace: "test",
      expectedRunId: options.runId,
      actorId: options.actorId,
      idempotencyKey: key,
      cancellationGeneration: 0,
      transition,
      artifactRefs: refs,
    });
    if (result.event.diagnostic) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        `Recorder transition became diagnostic: ${result.event.event.transition}`,
      );
    }
    return result;
  }

  static assertExistingReference(
    ledger: TestRunLedger,
    key: string,
    expected: ArtifactRefV1,
  ): void {
    const event = ledger
      .events()
      .find(({ event: protocolEvent }) => protocolEvent.idempotencyKey === key);
    if (
      event &&
      (event.artifactRefs.length !== 1 || !sameArtifactReference(event.artifactRefs[0]!, expected))
    ) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        "Existing recorder event is bound to different retained bytes",
      );
    }
  }

  static assertExistingReferences(
    ledger: TestRunLedger,
    key: string,
    expected: readonly ArtifactRefV1[],
  ): void {
    const event = ledger
      .events()
      .find(({ event: protocolEvent }) => protocolEvent.idempotencyKey === key);
    if (
      event &&
      (event.artifactRefs.length !== expected.length ||
        event.artifactRefs.some(
          (reference, index) => !sameArtifactReference(reference, expected[index]!),
        ))
    ) {
      throw new TestRunRecorderError(
        "INVALID_STATE",
        "Existing recorder event is bound to different retained bytes",
      );
    }
  }
}

export async function openTestRunRecorder(value: unknown): Promise<TestRunRecorder> {
  const options = normalizeRecorderOptions(value);
  return NativeTestRunRecorder.open(options);
}

export type { TestRunRecorderOptions } from "./test-run-recorder-codec.ts";
