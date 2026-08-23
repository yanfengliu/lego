import { createHash, randomUUID } from "node:crypto";

import {
  boundedStringWithoutLivePrototype,
  nativeErrorOwnData,
  normalizeThrownWithoutProbing,
} from "./non-probing-error";
import { snapshotStep7Gate3Json } from "./real-build-step7-gate3-diagnostic-json";
import { throwUnverifiedOwnershipCreationFailure } from "./real-build-step7-gate3-diagnostic-ownership-failure";
import {
  createStep7Gate3NoDeleteStagingDirectory,
  ensureStep7Gate3NoDeleteDirectoryTree,
  isStep7Gate3OwnershipCreationFailure,
  normalizeStep7Gate3NoDeleteRelativePath,
  renameStep7Gate3NoDeleteDirectory,
  writeStep7Gate3NoDeleteFile,
  type Step7Gate3NoDeleteDirectoryIdentity,
  type Step7Gate3NoDeleteWriteFailureStage,
  type Step7Gate3OwnershipFailureStage,
} from "./real-build-step7-gate3-no-delete-filesystem";
import {
  assertCompleteStep7Gate3BundleReadBack,
  readBackStep7Gate3Bundle,
  type Step7Gate3BundleReadBack,
  type Step7Gate3ExpectedReadBackArtifact,
} from "./real-build-step7-gate3-diagnostic-readback";

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

interface RetainedArtifact {
  readonly file: string;
  readonly bytes: number;
  readonly digest: string;
}

function writeAndVerify(input: {
  readonly directoryRelative: string;
  readonly file: string;
  readonly label: string;
  readonly bytes: Buffer;
  readonly maximumBytes: number;
  readonly __testFailureStage?: Step7Gate3NoDeleteWriteFailureStage;
}): RetainedArtifact {
  return writeStep7Gate3NoDeleteFile({
    root: process.cwd(),
    directoryRelative: input.directoryRelative,
    file: input.file,
    label: input.label,
    bytes: input.bytes,
    maximumBytes: input.maximumBytes,
    ...(input.__testFailureStage === undefined
      ? {}
      : { __testFailureStage: input.__testFailureStage }),
  });
}

export interface Step7Gate3DiagnosticOutputTestHooks {
  readonly beforeArtifactWrite?: (file: string) => void;
  readonly artifactWriteFailure?: {
    readonly file: string;
    readonly stage: Step7Gate3NoDeleteWriteFailureStage;
  };
  readonly beforeDirectoryPublish?: () => void;
  readonly directoryOwnershipFailureStage?: Step7Gate3OwnershipFailureStage;
  readonly beforeOwnershipFailureEnvelopeRetention?: (paths: {
    readonly stagingRelative: string;
    readonly runRelative: string;
  }) => void;
  readonly beforeFinalDirectoryRename?: (paths: {
    readonly stagingRelative: string;
    readonly runRelative: string;
  }) => void;
}

function throwRetainedPublicationFailure(input: {
  readonly outputRoot: string;
  readonly primary: unknown;
  readonly identity: Step7Gate3NoDeleteDirectoryIdentity;
  readonly stagingRelative: string;
  readonly runRelative: string;
  readonly finalRenameReturned: boolean;
  readonly stagingReadBackBeforeFailure: Step7Gate3BundleReadBack | null;
  readonly stagingReadBackAfterFailure: Step7Gate3BundleReadBack;
  readonly finalReadBack: Step7Gate3BundleReadBack;
}): never {
  const primary = normalizeThrownWithoutProbing(
    input.primary,
    "Gate-3 diagnostic publication failed without a readable error.",
  );
  let retained: ReturnType<typeof retainStep7Gate3UnverifiedFailureEnvelope>;
  try {
    retained = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot: input.outputRoot,
      stage: "publication",
      failure: primary,
      counterevidence: {
        schemaVersion: "lego.step7-gate3-publication-counterevidence/1",
        verification: "unverified-bounded-sequential-read-back",
        authority: "none",
        completeRun: false,
        publicationEligible: false,
        expectedDirectoryIdentity: {
          dev: input.identity.dev.toString(),
          ino: input.identity.ino.toString(),
        },
        stagingRelative: input.stagingRelative,
        runRelative: input.runRelative,
        finalRenameReturned: input.finalRenameReturned,
        stagingReadBackBeforeFailure: input.stagingReadBackBeforeFailure,
        stagingReadBackAfterFailure: input.stagingReadBackAfterFailure,
        finalReadBack: input.finalReadBack,
      },
    });
  } catch (retentionError) {
    throw new AggregateError(
      [
        primary,
        normalizeThrownWithoutProbing(
          retentionError,
          "Gate-3 publication counterevidence retention failed without a readable error.",
        ),
      ],
      "Gate-3 diagnostic publication failed and its authority-none filesystem counterevidence envelope could not be retained; no staging or final pathname was deleted.",
      { cause: retentionError },
    );
  }
  throw new Error(
    `Gate-3 diagnostic publication failed: ${primary.message} Authority-none counterevidence was retained at ${retained.fileRelative}; no staging or final pathname was deleted.`,
    { cause: primary },
  );
}

export function retainStep7Gate3DiagnosticOutput(input: {
  readonly outputRoot: string;
  readonly trace: Readonly<Record<string, unknown>> & { readonly traceDigest: string };
  readonly panelPngBytes: Buffer;
  readonly summary: Record<string, unknown>;
  /** @internal Synchronous fault-injection seam. Production callers omit it. */
  readonly __testHooks?: Step7Gate3DiagnosticOutputTestHooks;
}) {
  const panelPngBytes = Buffer.from(input.panelPngBytes);
  const traceSnapshot = snapshotStep7Gate3Json(input.trace, "Gate-3 diagnostic trace input");
  const summaryInputSnapshot = snapshotStep7Gate3Json(
    input.summary,
    "Gate-3 diagnostic summary input",
  );
  if (
    typeof traceSnapshot.value !== "object" ||
    traceSnapshot.value === null ||
    Array.isArray(traceSnapshot.value) ||
    typeof summaryInputSnapshot.value !== "object" ||
    summaryInputSnapshot.value === null ||
    Array.isArray(summaryInputSnapshot.value)
  ) {
    throw new TypeError("Gate-3 diagnostic trace and summary inputs must be JSON objects.");
  }
  const { traceDigest, ...traceBase } = traceSnapshot.value;
  const traceBaseSnapshot = snapshotStep7Gate3Json(traceBase, "Gate-3 diagnostic trace body");
  const recomputedTraceDigest = digest(Buffer.from(traceBaseSnapshot.json));
  if (traceDigest !== recomputedTraceDigest) {
    throw new TypeError(
      `Gate-3 diagnostic trace declares ${traceDigest}; its exact trace body hashes to ${recomputedTraceDigest}.`,
    );
  }
  const outputPanel = traceBase.outputPanel;
  if (
    typeof outputPanel !== "object" ||
    outputPanel === null ||
    (outputPanel as Record<string, unknown>).file !== "step-007-panel.png" ||
    (outputPanel as Record<string, unknown>).bytes !== panelPngBytes.length ||
    (outputPanel as Record<string, unknown>).digest !== digest(panelPngBytes)
  ) {
    throw new TypeError(
      "Gate-3 diagnostic trace outputPanel does not bind the exact supplied step-007-panel.png bytes.",
    );
  }
  const safeOutputRoot = normalizeStep7Gate3NoDeleteRelativePath(
    input.outputRoot,
    "Gate-3 diagnostic output",
  );
  const runTag = `${new Date().toISOString().replaceAll(":", "-")}-${traceDigest.slice(7, 19)}`;
  const runsRelative = `${safeOutputRoot}/runs`;
  const runRelative = `${safeOutputRoot}/runs/${runTag}`;
  const stagingName = `.tmp-${runTag}-${randomUUID()}`;
  const stagingRelative = `${runsRelative}/${stagingName}`;
  let bundleIdentity: Step7Gate3NoDeleteDirectoryIdentity | null = null;
  let expectedArtifacts: readonly Step7Gate3ExpectedReadBackArtifact[] = [];
  let stagingReadBack: Step7Gate3BundleReadBack | null = null;
  let finalReadBack: Step7Gate3BundleReadBack | null = null;
  let finalRenameReturned = false;

  try {
    bundleIdentity = createStep7Gate3NoDeleteStagingDirectory({
      root: process.cwd(),
      relativePath: stagingRelative,
      label: "Gate-3 diagnostic staging bundle",
      ...(input.__testHooks?.directoryOwnershipFailureStage === undefined
        ? {}
        : { failureStage: input.__testHooks.directoryOwnershipFailureStage }),
    });
    const write = (
      file: string,
      label: string,
      bytes: Buffer,
      maximumBytes: number,
    ): RetainedArtifact => {
      input.__testHooks?.beforeArtifactWrite?.(file);
      const injectedFailure = input.__testHooks?.artifactWriteFailure;
      return writeAndVerify({
        directoryRelative: stagingRelative,
        file,
        label,
        bytes,
        maximumBytes,
        ...(injectedFailure?.file === file ? { __testFailureStage: injectedFailure.stage } : {}),
      });
    };
    const traceBytes = traceSnapshot.lineBytes;
    const traceArtifact = write(
      "trace.json",
      "Gate-3 diagnostic trace",
      traceBytes,
      64 * 1024 * 1024,
    );
    const panelArtifact = write(
      "step-007-panel.png",
      "Gate-3 step-7 panel",
      panelPngBytes,
      8 * 1024 * 1024,
    );
    const summarySnapshot = snapshotStep7Gate3Json(
      {
        ...summaryInputSnapshot.value,
        traceDigest,
        traceBytes: traceArtifact.bytes,
        traceFileDigest: traceArtifact.digest,
        panelPngBytes: panelArtifact.bytes,
        panelPngDigest: panelArtifact.digest,
      },
      "Gate-3 diagnostic retained summary",
    );
    const summary = summarySnapshot.value;
    const summaryBytes = summarySnapshot.lineBytes;
    const summaryArtifact = write(
      "summary.json",
      "Gate-3 diagnostic summary",
      summaryBytes,
      1024 * 1024,
    );
    const manifestSnapshot = snapshotStep7Gate3Json(
      {
        schemaVersion: "lego.step7-gate3-diagnostic-artifact-manifest/1" as const,
        runRelative,
        traceDigest,
        artifacts: [traceArtifact, summaryArtifact, panelArtifact],
      },
      "Gate-3 diagnostic artifact manifest",
    );
    const manifest = manifestSnapshot.value;
    const manifestBytes = manifestSnapshot.lineBytes;
    const manifestArtifact = write(
      "artifact-manifest.json",
      "Gate-3 diagnostic artifact manifest",
      manifestBytes,
      64 * 1024,
    );
    expectedArtifacts = [
      { file: traceArtifact.file, exactBytes: traceBytes, digest: traceArtifact.digest },
      { file: summaryArtifact.file, exactBytes: summaryBytes, digest: summaryArtifact.digest },
      { file: panelArtifact.file, exactBytes: panelPngBytes, digest: panelArtifact.digest },
      {
        file: manifestArtifact.file,
        exactBytes: manifestBytes,
        digest: manifestArtifact.digest,
      },
    ];
    input.__testHooks?.beforeDirectoryPublish?.();
    stagingReadBack = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: stagingRelative,
      expectedIdentity: bundleIdentity,
      artifacts: expectedArtifacts,
      label: "staged Gate-3 diagnostic complete bundle",
    });
    assertCompleteStep7Gate3BundleReadBack(stagingReadBack, "Staged Gate-3 diagnostic bundle");
    renameStep7Gate3NoDeleteDirectory({
      root: process.cwd(),
      sourceRelative: stagingRelative,
      targetRelative: runRelative,
      expectedIdentity: bundleIdentity,
      label: "Gate-3 diagnostic complete-bundle publication",
      ...(input.__testHooks?.beforeFinalDirectoryRename === undefined
        ? {}
        : {
            beforeRename: () => {
              input.__testHooks?.beforeFinalDirectoryRename?.({
                stagingRelative,
                runRelative,
              });
            },
          }),
    });
    finalRenameReturned = true;
    finalReadBack = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: runRelative,
      expectedIdentity: bundleIdentity,
      artifacts: expectedArtifacts,
      label: "published Gate-3 diagnostic complete bundle",
    });
    assertCompleteStep7Gate3BundleReadBack(finalReadBack, "Published Gate-3 diagnostic bundle");
    return Object.freeze({
      runRelative,
      summary,
      manifest,
      manifestDigest: manifestArtifact.digest,
      manifestBytes: manifestArtifact.bytes,
      publicationReadBack: finalReadBack,
    });
  } catch (error) {
    if (bundleIdentity === null) {
      if (isStep7Gate3OwnershipCreationFailure(error)) {
        throwUnverifiedOwnershipCreationFailure({
          outputRoot: safeOutputRoot,
          primary: error,
          stagingRelative,
          runRelative,
          ...(input.__testHooks?.beforeOwnershipFailureEnvelopeRetention === undefined
            ? {}
            : {
                beforeEnvelopeRetention: input.__testHooks.beforeOwnershipFailureEnvelopeRetention,
              }),
          retainEnvelope: retainStep7Gate3UnverifiedFailureEnvelope,
        });
      }
      throw normalizeThrownWithoutProbing(
        error,
        "Gate-3 diagnostic publication failed before an owned staging directory existed.",
      );
    }
    const stagingReadBackAfterFailure = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: stagingRelative,
      expectedIdentity: bundleIdentity,
      artifacts: expectedArtifacts,
      label: "failed Gate-3 diagnostic staging counterevidence",
    });
    finalReadBack ??= readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: runRelative,
      expectedIdentity: bundleIdentity,
      artifacts: expectedArtifacts,
      label: "failed Gate-3 diagnostic final counterevidence",
    });
    throwRetainedPublicationFailure({
      outputRoot: safeOutputRoot,
      primary: error,
      identity: bundleIdentity,
      stagingRelative,
      runRelative,
      finalRenameReturned,
      stagingReadBackBeforeFailure: stagingReadBack,
      stagingReadBackAfterFailure,
      finalReadBack,
    });
  }
}

function boundedFailure(value: unknown): Readonly<Record<string, string>> {
  const native = nativeErrorOwnData(value);
  if (native !== null) {
    return Object.freeze({
      kind: "error",
      name: native.name,
      message: native.message,
    });
  }
  if (typeof value === "string") {
    return Object.freeze({
      kind: "string",
      name: "non-Error",
      message: boundedStringWithoutLivePrototype(value, 2_048),
    });
  }
  if (value === null) {
    return Object.freeze({ kind: "object", name: "non-Error", message: "null" });
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return Object.freeze({ kind: typeof value, name: "non-Error", message: `${value}` });
  }
  return Object.freeze({
    kind: typeof value,
    name: "non-Error",
    message: `A thrown ${typeof value} was retained without accessing attacker-controlled properties.`,
  });
}

export function retainStep7Gate3UnverifiedFailureEnvelope(input: {
  readonly outputRoot: string;
  readonly stage:
    "preparation" | "execution" | "terminal-admission" | "verification" | "publication";
  readonly failure: unknown;
  readonly counterevidence: Readonly<Record<string, unknown>> | null;
  readonly capturedAt?: string;
  /** @internal Synchronous no-delete file fault injection. */
  readonly __testWriteFailureStage?: Step7Gate3NoDeleteWriteFailureStage;
}) {
  const safeOutputRoot = normalizeStep7Gate3NoDeleteRelativePath(
    input.outputRoot,
    "Gate-3 unverified failure output",
  );
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const capturedDate = new Date(capturedAt);
  if (!Number.isFinite(capturedDate.getTime()) || capturedDate.toISOString() !== capturedAt) {
    throw new TypeError(
      `Gate-3 unverified failure capturedAt must be a canonical UTC ISO timestamp; received ${JSON.stringify(capturedAt)}.`,
    );
  }
  const counterevidence =
    input.counterevidence === null
      ? null
      : snapshotStep7Gate3Json(input.counterevidence, "Gate-3 unverified failure counterevidence")
          .value;
  const baseSnapshot = snapshotStep7Gate3Json(
    {
      schemaVersion: "lego.step7-gate3-unverified-raw-envelope/1" as const,
      verification: "unverified-raw-counterevidence" as const,
      completeRun: false as const,
      publicationEligible: false as const,
      authority: "none" as const,
      capturedAt,
      stage: input.stage,
      failure: boundedFailure(input.failure),
      counterevidence,
    },
    "Gate-3 unverified failure envelope body",
  );
  const envelopeSnapshot = snapshotStep7Gate3Json(
    {
      ...baseSnapshot.value,
      envelopeDigest: digest(Buffer.from(baseSnapshot.json)),
    },
    "Gate-3 unverified failure envelope",
  );
  const envelope = envelopeSnapshot.value;
  const bytes = envelopeSnapshot.lineBytes;
  if (bytes.length > 64 * 1024 * 1024) {
    throw new RangeError(
      `Gate-3 unverified raw envelope has ${bytes.length} bytes; maximum is 64 MiB.`,
    );
  }
  const directoryRelative = `${safeOutputRoot}/unverified`;
  ensureStep7Gate3NoDeleteDirectoryTree(
    process.cwd(),
    directoryRelative,
    "Gate-3 unverified envelope root",
  );
  const file = `${capturedAt.replaceAll(/[:.]/gu, "-")}-${envelope.envelopeDigest.slice(7, 19)}-${randomUUID()}.json`;
  const artifact = writeAndVerify({
    directoryRelative,
    file,
    label: "Gate-3 unverified raw failure envelope",
    bytes,
    maximumBytes: 64 * 1024 * 1024,
    ...(input.__testWriteFailureStage === undefined
      ? {}
      : { __testFailureStage: input.__testWriteFailureStage }),
  });
  return Object.freeze({
    fileRelative: `${directoryRelative}/${file}`,
    envelope,
    digest: artifact.digest,
    bytes: artifact.bytes,
  });
}
