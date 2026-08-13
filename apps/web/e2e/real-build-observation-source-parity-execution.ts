import { Buffer } from "node:buffer";
import { basename, dirname, join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import type { Page } from "@playwright/test";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import {
  assertRealBuildBootstrapSourceLockHeld,
  parseRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_MANIFEST_FILE,
  type RealBuildBootstrapSourceLockEvidence,
  type RealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import { sha256Digest } from "./real-build-artifacts";
import type { RealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-run";
import type {
  RealBuildSourceParityProvenanceRole,
  RealBuildSourceParitySourceSnapshot,
} from "./real-build-observation-source-parity-types";
import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES } from "./real-build-observation-source-parity-browser-result";
import { createRealBuildSourceParitySourceBundle } from "./real-build-observation-source-parity-source-bundle";
import {
  materializeRealBuildSourceMirror,
  resolveRealBuildPath,
  type RealBuildSourceMirror,
} from "./real-build-replay";
import { acquireRealBuildSourceLock, type RealBuildSourceLock } from "./real-build-source-lock";
import {
  createRealBuildServedResponseRecorder,
  type RealBuildServedResponseRecorder,
} from "./real-build-served-responses";
import {
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
} from "./real-build-served-response-policy";
import { verifyRealBuildServedResponseEvidence } from "./real-build-served-response-verification";

const TEMPORARY_PREFIX = "lego-source-parity-execution-";
const MAXIMUM_BOOTSTRAP_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_MIRROR_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_ENVIRONMENT_BYTES = 1024 * 1024;

export interface RealBuildSourceParityExecutionClosure {
  readonly urls: RealBuildSourceParityBrowserInput["urls"];
  readonly runnerUrl: string;
  readonly calibrationRunnerUrl: string;
  assertHeld(): void;
  finish(binding: {
    readonly browserResultDigest: string;
    readonly browserResultBytes: number;
  }): Promise<{
    readonly sourceSnapshot: RealBuildSourceParitySourceSnapshot;
    readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
  }>;
  dispose(): Promise<void>;
}

function sameLock(
  left: RealBuildBootstrapSourceLockEvidence,
  right: RealBuildBootstrapSourceLockEvidence,
): boolean {
  return (
    left.repoRoot === right.repoRoot &&
    left.directory === right.directory &&
    left.helperPid === right.helperPid &&
    left.lockManifestDigest === right.lockManifestDigest &&
    left.lockedFiles === right.lockedFiles &&
    left.lockedBytes === right.lockedBytes
  );
}

function assertBootstrapHeld(expected: RealBuildBootstrapSourceLockEvidence): void {
  const observed = assertRealBuildBootstrapSourceLockHeld();
  if (!sameLock(observed, expected)) {
    throw new Error("Pre-discovery source-lock evidence changed during the parity measurement.");
  }
}

function exactBootstrapBytes(
  lock: RealBuildBootstrapSourceLockEvidence,
  expected: RealBuildBootstrapSourceManifest,
): Buffer {
  const bytes = readContainedBoundedRegularFile(
    lock.directory,
    REAL_BUILD_BOOTSTRAP_MANIFEST_FILE,
    {
      label: "source-parity bootstrap manifest evidence",
      minimumBytes: 2,
      maximumBytes: MAXIMUM_BOOTSTRAP_MANIFEST_BYTES,
    },
  );
  const parsed = parseRealBuildBootstrapSourceManifest(bytes);
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
    throw new Error("Retained bootstrap manifest bytes changed after their authenticated read.");
  }
  return bytes;
}

function mirrorManifestBytes(mirror: RealBuildSourceMirror): Buffer {
  const bytes = Buffer.from(
    `${JSON.stringify({
      schemaVersion: "lego.real-build-source-parity-execution-mirror/1",
      files: mirror.files,
    })}\n`,
  );
  if (bytes.length > MAXIMUM_MIRROR_MANIFEST_BYTES) {
    throw new RangeError(
      `Source-parity execution mirror manifest has ${bytes.length} bytes; maximum is ${MAXIMUM_MIRROR_MANIFEST_BYTES}.`,
    );
  }
  return bytes;
}

function assertMirrorMatchesBootstrap(
  mirror: RealBuildSourceMirror,
  bootstrap: RealBuildBootstrapSourceManifest,
): void {
  const mirrored = new Map(mirror.files.map((file) => [file.path, file]));
  for (const expected of bootstrap.files) {
    const actual = mirrored.get(expected.path);
    if (actual?.digest !== expected.digest || actual.bytes !== expected.bytes) {
      throw new Error(`Execution mirror does not reproduce locked source ${expected.path}.`);
    }
  }
}

function safeRemoveTemporaryDirectory(directory: string): void {
  const resolved = resolve(directory);
  if (dirname(resolved) !== resolve(tmpdir()) || !basename(resolved).startsWith(TEMPORARY_PREFIX)) {
    throw new Error(`Refusing to remove non-task source-parity directory ${resolved}.`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

async function cleanupExecution(
  directory: string,
  recorder: RealBuildServedResponseRecorder | null,
  lock: RealBuildSourceLock | null,
): Promise<void> {
  const failures: unknown[] = [];
  if (recorder !== null) {
    try {
      await recorder.dispose();
    } catch (error) {
      failures.push(error);
    }
  }
  if (lock !== null) {
    try {
      await lock.release();
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    safeRemoveTemporaryDirectory(directory);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Source-parity execution closure cleanup failed.");
  }
}

export async function beginRealBuildSourceParityExecutionClosure(input: {
  readonly page: Page;
  readonly browserName: string;
  readonly repoRoot: string;
  readonly bootstrap: RealBuildBootstrapSourceManifest;
  readonly bootstrapLock: RealBuildBootstrapSourceLockEvidence;
  readonly pdfBytes: Uint8Array;
  readonly expectedPreparedPanelsDigest: string;
}): Promise<RealBuildSourceParityExecutionClosure> {
  const expectedPreparedPanelsDigest = input.expectedPreparedPanelsDigest;
  if (!/^sha256:[0-9a-f]{64}$/u.test(expectedPreparedPanelsDigest)) {
    throw new TypeError(
      `Source-parity execution expectedPreparedPanelsDigest must be one lowercase SHA-256 digest; observed ${JSON.stringify(expectedPreparedPanelsDigest)}.`,
    );
  }
  assertBootstrapHeld(input.bootstrapLock);
  const directory = mkdtempSync(join(tmpdir(), TEMPORARY_PREFIX));
  let mirrorLock: RealBuildSourceLock | null = null;
  let recorder: RealBuildServedResponseRecorder | null = null;
  try {
    const bootstrapBytes = exactBootstrapBytes(input.bootstrapLock, input.bootstrap);
    const mirror = materializeRealBuildSourceMirror({
      directory,
      repoRoot: input.repoRoot,
      sourceFiles: input.bootstrap.files.map(({ path }) => path),
      fixedInputs: [{ path: "inputs/booklet.pdf", bytes: input.pdfBytes }],
    });
    assertMirrorMatchesBootstrap(mirror, input.bootstrap);
    const mirrorBytes = mirrorManifestBytes(mirror);
    mirrorLock = await acquireRealBuildSourceLock(mirror);
    recorder = createRealBuildServedResponseRecorder({
      page: input.page,
      mirror,
      sourceLock: mirrorLock,
      repoRoot: input.repoRoot,
    });
    await recorder.install();
    mirrorLock.assertHeld();
    const mirrorUrl = (path: string): string => {
      const absolute = resolveRealBuildPath(mirror.root, path, {
        mustExist: true,
        label: "source-parity execution source",
      });
      return `/@fs/${absolute.replaceAll("\\", "/")}`;
    };
    const urls = {
      pdfjsUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.mjs"),
      workerUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.worker.mjs"),
      pdfUrl: mirrorUrl("inputs/booklet.pdf"),
      latticeUrl: mirrorUrl("packages/rendering/src/camera-fit-lattice.ts"),
      assemblyUrl: mirrorUrl("apps/web/src/assembly/index.ts"),
      panelRasterUrl: mirrorUrl("apps/web/e2e/real-build-panel-raster.ts"),
      candidateUrl: mirrorUrl("apps/web/e2e/real-build-observation-source-raster-candidate.ts"),
    };
    const runnerUrl = mirrorUrl("apps/web/e2e/real-build-observation-source-parity-browser-run.ts");
    const calibrationRunnerUrl = mirrorUrl(
      "apps/web/e2e/real-build-observation-source-parity-calibration-browser-run.ts",
    );
    let finished = false;
    let disposed = false;
    return {
      urls,
      runnerUrl,
      calibrationRunnerUrl,
      assertHeld: () => {
        assertBootstrapHeld(input.bootstrapLock);
        mirrorLock!.assertHeld();
      },
      finish: async (binding) => {
        if (finished || disposed) {
          throw new TypeError("Source-parity execution closure may be finalized exactly once.");
        }
        if (!/^sha256:[0-9a-f]{64}$/u.test(binding.browserResultDigest)) {
          throw new TypeError(
            `Source-parity execution browserResultDigest must be one lowercase SHA-256 digest; observed ${JSON.stringify(binding.browserResultDigest)}.`,
          );
        }
        if (
          !Number.isSafeInteger(binding.browserResultBytes) ||
          binding.browserResultBytes < 2 ||
          binding.browserResultBytes >
            REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES
        ) {
          throw new RangeError(
            `Source-parity execution browserResultBytes must be a safe integer from 2 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES}; observed ${String(binding.browserResultBytes)}.`,
          );
        }
        finished = true;
        assertBootstrapHeld(input.bootstrapLock);
        mirrorLock!.assertHeld();
        const evidence = await recorder!.writeEvidence(directory);
        mirrorLock!.assertHeld();
        assertBootstrapHeld(input.bootstrapLock);
        const verifiedFiles = verifyRealBuildServedResponseEvidence({
          directory,
          expectedManifestDigest: evidence.manifestDigest,
          sourceFiles: mirror.files,
          requireRunner: true,
          expectedCheckoutRoot: input.repoRoot,
        });
        if (JSON.stringify(verifiedFiles) !== JSON.stringify(evidence.files)) {
          throw new Error("Served-response recorder and verifier disagree on retained files.");
        }
        const servedRoles = evidence.files.map((file) => {
          const maximum =
            file === REAL_BUILD_SERVED_RESPONSE_MANIFEST
              ? MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES
              : MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES;
          const bytes = readContainedBoundedRegularFile(directory, file, {
            label: `source-parity served-response evidence ${file}`,
            minimumBytes: 1,
            maximumBytes: maximum,
          });
          return { role: `served-response/${file}`, digest: sha256Digest(bytes), bytes };
        });
        const servedManifest = servedRoles.find(
          ({ role }) => role === `served-response/${REAL_BUILD_SERVED_RESPONSE_MANIFEST}`,
        );
        if (servedManifest === undefined) {
          throw new Error("Served-response evidence omitted its exact manifest bytes.");
        }
        const sourceBundle = createRealBuildSourceParitySourceBundle({
          servedManifestBytes: servedManifest.bytes,
          mirror,
        });
        const environmentBytes = Buffer.from(
          `${JSON.stringify({
            schemaVersion: "lego.real-build-source-parity-environment/1",
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            versions: process.versions,
            browser: {
              name: input.browserName,
              version: input.page.context().browser()?.version() ?? "unavailable",
            },
            playwright:
              "@playwright/test (bootstrap and execution-mirror manifests bind package paths/digests)",
            bootstrapSourceManifestDigest: input.bootstrap.manifestDigest,
            executionSourceMirrorManifestDigest: sha256Digest(mirrorBytes),
            servedResponseManifestDigest: evidence.manifestDigest,
            servedSourceBundleManifestDigest: sourceBundle.manifestDigest,
            servedSourceBundleDigest: sourceBundle.bundleDigest,
            checkoutRoot: input.repoRoot,
            browserResultDigest: binding.browserResultDigest,
            browserResultBytes: binding.browserResultBytes,
            preparedPanelsDigest: expectedPreparedPanelsDigest,
          })}\n`,
        );
        if (environmentBytes.length > MAXIMUM_ENVIRONMENT_BYTES) {
          throw new RangeError("Source-parity environment evidence exceeds its byte bound.");
        }
        const provenance: RealBuildSourceParityProvenanceRole[] = [
          {
            role: "bootstrap-source-manifest",
            digest: sha256Digest(bootstrapBytes),
            bytes: bootstrapBytes,
          },
          {
            role: "execution-source-mirror-manifest",
            digest: sha256Digest(mirrorBytes),
            bytes: mirrorBytes,
          },
          {
            role: "execution-environment",
            digest: sha256Digest(environmentBytes),
            bytes: environmentBytes,
          },
          ...servedRoles,
          ...sourceBundle.roles,
        ];
        const sourceSnapshot: RealBuildSourceParitySourceSnapshot = {
          state:
            "authenticated-bootstrap-and-execution-mirror-locks-held-before-and-after-measurement",
          bootstrapManifestDigest: input.bootstrap.manifestDigest,
          bootstrapManifestEvidenceDigest: sha256Digest(bootstrapBytes),
          sourceRootsPolicyDigest: input.bootstrap.sourceRootsPolicyDigest,
          bootstrapLockManifestDigest: input.bootstrapLock.lockManifestDigest,
          bootstrapLockedFiles: input.bootstrapLock.lockedFiles,
          bootstrapLockedBytes: input.bootstrapLock.lockedBytes,
          bootstrapLockCoversInstructionPdf: false,
          executionMirrorManifestDigest: sha256Digest(mirrorBytes),
          executionMirrorFiles: mirror.files.length,
          executionMirrorBytes: mirror.files.reduce((sum, file) => sum + file.bytes, 0),
          executionMirrorCoversInstructionPdf: true,
          servedResponseManifestDigest: evidence.manifestDigest,
          servedResponseFiles: servedRoles.length,
          servedResponseBytes: servedRoles.reduce((sum, role) => sum + role.bytes.length, 0),
          servedSourceBundleManifestDigest: sourceBundle.manifestDigest,
          servedSourceBundleDigest: sourceBundle.bundleDigest,
          servedSourceFiles: sourceBundle.sourceFiles,
          servedSourceUniqueBytes: sourceBundle.uniqueBytes,
          browserResultDigest: binding.browserResultDigest,
          browserResultBytes: binding.browserResultBytes,
          preparedPanelsDigest: expectedPreparedPanelsDigest,
          environmentDigest: sha256Digest(environmentBytes),
        };
        return { sourceSnapshot, provenance };
      },
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        await cleanupExecution(directory, recorder, mirrorLock);
      },
    };
  } catch (error) {
    try {
      await cleanupExecution(directory, recorder, mirrorLock);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Source-parity execution setup and cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}
