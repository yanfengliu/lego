import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import type { RealBuildInputDigests } from "./real-build-safety";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import {
  ensureContainedDirectoryTree,
  removeContainedDirectoryTree,
  renameContainedDirectoryAtomic,
} from "./contained-directory";
import { normalizeRealBuildRelativePath, resolveRealBuildPath } from "./real-build-replay-files";

const sha256Digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export function validateRealBuildOutputRoot(root: string): void {
  const normalized = root.replaceAll("\\", "/");
  if (!/^output(?:\/[a-z0-9][a-z0-9._-]*)+$/u.test(normalized)) {
    throw new TypeError(
      `Real-build output root must be a descendant of output/ without traversal; received ${JSON.stringify(root)}.`,
    );
  }
  resolveRealBuildPath(process.cwd(), normalized, { label: "real-build output root" });
}

export const REAL_BUILD_RUN_ID_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildPublicationVerification {
  readonly runId: string;
  readonly replayClosureDigest: string;
  readonly artifactManifestDigest: string;
}

type RealBuildPublicationVerifierResult = RealBuildPublicationVerification;

function normalizePublicationVerification(
  result: RealBuildPublicationVerifierResult,
  expectedRunId: string,
): RealBuildPublicationVerification {
  if (
    result.runId !== expectedRunId ||
    !SHA256_DIGEST_PATTERN.test(result.replayClosureDigest) ||
    !SHA256_DIGEST_PATTERN.test(result.artifactManifestDigest)
  ) {
    throw new TypeError(
      `Real-build publication verification must bind run ${expectedRunId} to canonical replay and artifact-manifest digests.`,
    );
  }
  return result;
}

export function planAtomicRunDirectory(input: {
  readonly outputRoot: string;
  readonly inputDigests: RealBuildInputDigests;
  readonly runContractDigest: string;
  readonly timestamp?: string;
  readonly nonce?: string;
}): {
  readonly runId: string;
  readonly temporaryDirectory: string;
  readonly finalDirectory: string;
  readonly pointerPath: string;
} {
  validateRealBuildOutputRoot(input.outputRoot);
  const rawTimestamp = input.timestamp ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(rawTimestamp)) {
    throw new TypeError(
      `Real-build timestamp must be canonical UTC ISO-8601; received ${rawTimestamp}.`,
    );
  }
  const timestamp = rawTimestamp.replaceAll(/[:.]/gu, "-");
  const nonce = input.nonce ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(nonce)) {
    throw new TypeError(`Real-build nonce must be a lowercase UUIDv4; received ${nonce}.`);
  }
  const binding = sha256Digest(
    JSON.stringify({
      inputDigests: input.inputDigests,
      runContractDigest: input.runContractDigest,
    }),
  ).slice("sha256:".length, "sha256:".length + 12);
  const runId = `${timestamp}-${binding}-${nonce}`;
  if (!REAL_BUILD_RUN_ID_PATTERN.test(runId)) {
    throw new TypeError(`Real-build run id failed its closed grammar: ${runId}.`);
  }
  const runs = join(input.outputRoot, "runs");
  return {
    runId,
    temporaryDirectory: join(runs, `.tmp-${runId}`),
    finalDirectory: join(runs, runId),
    pointerPath: join(runs, "current.json"),
  };
}

/** Publishes synchronously so no caller-visible await gap can interleave with guarded renames. */
export function beginAtomicRun(
  plan: ReturnType<typeof planAtomicRunDirectory>,
  __testHooks?: { readonly afterDirectoryRename?: () => void },
): {
  readonly directory: string;
  publish: (
    verify?: (directory: string, expectedRunId: string) => RealBuildPublicationVerifierResult,
  ) => string;
} {
  const runsCandidate = normalizeRealBuildRelativePath(
    relative(process.cwd(), resolve(dirname(plan.temporaryDirectory))).replaceAll("\\", "/"),
    "real-build runs root",
  );
  const temporaryCandidate = normalizeRealBuildRelativePath(
    relative(process.cwd(), resolve(plan.temporaryDirectory)).replaceAll("\\", "/"),
    "real-build temporary run",
  );
  ensureContainedDirectoryTree(process.cwd(), runsCandidate, "real-build runs root");
  ensureContainedDirectoryTree(process.cwd(), temporaryCandidate, "real-build temporary run");
  let directoryPublished = false;
  let pointerWritten = false;
  let publicationVerification: RealBuildPublicationVerification | null = null;
  let finalVerifier:
    ((directory: string, expectedRunId: string) => RealBuildPublicationVerifierResult) | null =
    null;
  let verifierLatched = false;
  let sourceMirrorRemoved = false;
  return {
    directory: plan.temporaryDirectory,
    publish: (verify) => {
      if (pointerWritten) throw new Error(`Real-build run ${plan.runId} was already published.`);
      if (!verifierLatched) {
        if (verify === undefined) {
          throw new Error(
            `Real-build run ${plan.runId} requires an artifact-manifest verifier before publication.`,
          );
        }
        finalVerifier = verify;
        verifierLatched = true;
      } else if (verify !== undefined && verify !== finalVerifier) {
        throw new Error(
          `Real-build run ${plan.runId} publication verifier was already latched and cannot be replaced.`,
        );
      }
      const verifier = finalVerifier;
      if (verifier === null) {
        throw new Error(`Real-build run ${plan.runId} has no latched publication verifier.`);
      }
      if (!directoryPublished) {
        if (!sourceMirrorRemoved) {
          try {
            removeContainedDirectoryTree(
              plan.temporaryDirectory,
              "source-snapshot",
              "transient real-build source execution mirror",
            );
            sourceMirrorRemoved = true;
          } catch (error) {
            throw new Error(
              `Real-build run ${plan.runId} cannot publish until its bounded transient source execution mirror is safely removed. Close task-owned readers and retry: ${error instanceof Error ? error.message : String(error)}.`,
              { cause: error },
            );
          }
        }
        publicationVerification = normalizePublicationVerification(
          verifier(plan.temporaryDirectory, plan.runId),
          plan.runId,
        );
        try {
          renameContainedDirectoryAtomic(
            dirname(plan.temporaryDirectory),
            basename(plan.temporaryDirectory),
            basename(plan.finalDirectory),
            "real-build run publication",
            __testHooks?.afterDirectoryRename === undefined
              ? undefined
              : { afterMutation: __testHooks.afterDirectoryRename },
          );
          directoryPublished = true;
        } catch (error) {
          if (!existsSync(plan.temporaryDirectory)) {
            const retainedVerification = normalizePublicationVerification(
              verifier(plan.finalDirectory, plan.runId),
              plan.runId,
            );
            if (JSON.stringify(retainedVerification) === JSON.stringify(publicationVerification)) {
              directoryPublished = true;
              throw new Error(
                `Real-build run ${plan.runId} directory committed but its guarded post-rename check failed; the current pointer was not written. Retry this publish handle to verify the final closure and repair only the pointer.`,
                { cause: error },
              );
            }
          }
          throw error;
        }
      }
      const retainedVerification = normalizePublicationVerification(
        verifier(plan.finalDirectory, plan.runId),
        plan.runId,
      );
      if (JSON.stringify(retainedVerification) !== JSON.stringify(publicationVerification)) {
        throw new Error(
          `Real-build run ${plan.runId} final closure changed before current-pointer publication.`,
        );
      }
      const pointer = {
        schemaVersion: "lego.real-build-run-pointer/2",
        runId: plan.runId,
        replayClosureDigest: retainedVerification.replayClosureDigest,
        artifactManifestDigest: retainedVerification.artifactManifestDigest,
      };
      writeContainedRegularFileAtomic(
        dirname(plan.pointerPath),
        basename(plan.pointerPath),
        `${JSON.stringify(pointer)}\n`,
        { label: "real-build current-run pointer", replace: true },
      );
      pointerWritten = true;
      return plan.finalDirectory;
    },
  };
}
