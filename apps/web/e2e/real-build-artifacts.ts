import { closeSync, fstatSync, lstatSync, openSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { type RealBuildResult } from "./real-build-safety";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import { isLocallyFinalizedRealBuildResult } from "./real-build-finalize";
import {
  assertAncestorSnapshotsStable,
  comparableFileState,
  inside,
  preflightContainedPath,
  readBoundedRegularFile,
  readContainedBoundedRegularFile,
  sameFileState,
} from "./bounded-file-read";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { createRealBuildRunContract } from "./real-build-run-contract";
export { createRealBuildRunContract } from "./real-build-run-contract";
import { type RealBuildReplayClosureManifest } from "./real-build-replay";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files";
import { MAXIMUM_REPLAY_SOURCE_FILE_BYTES } from "./real-build-replay-policy";
import {
  maximumRealBuildRetainedArtifactBytes,
  MAXIMUM_ARTIFACT_MANIFEST_BYTES,
  MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES,
  REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA,
  sha256Digest,
  validateRealBuildArtifactFilePlan,
} from "./real-build-artifact-policy";
import { assertCurrentArtifactReplayBoundaryVerifiable } from "./real-build-artifact-input-rejection-policy";
export {
  maximumRealBuildRetainedArtifactBytes,
  MAXIMUM_REAL_BUILD_PRINTED_STEPS,
  MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES,
  MAXIMUM_RETAINED_ARTIFACTS,
  MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES,
  REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA,
  sha256Digest,
  validateRealBuildArtifactFilePlan,
} from "./real-build-artifact-policy";
export {
  prepareRealBuildArtifactManifestVerification,
  verifyPreparedRealBuildArtifactManifest,
  verifyRealBuildArtifactManifest,
  type PreparedRealBuildArtifactVerification,
} from "./real-build-artifact-current-verification";
export {
  inspectLegacyRealBuildArtifactManifestV3,
  type LegacyRealBuildArtifactInspectionV3,
} from "./real-build-artifact-legacy-v3";
export { createRealBuildScore, REAL_BUILD_SCORE_SCHEMA } from "./real-build-score";
import { realBuildDiagnosticPrefixSummary } from "./real-build-diagnostic-prefix";
import { encodeCanonicalRealBuildJson } from "./real-build-json-admission";

export {
  beginAtomicRun,
  planAtomicRunDirectory,
  REAL_BUILD_RUN_ID_PATTERN,
  validateRealBuildOutputRoot,
} from "./real-build-artifact-publication";
const MAXIMUM_CODE_SNAPSHOT_FILES = 10_000;
const MAXIMUM_CODE_SNAPSHOT_ENTRIES = 25_000;
const MAXIMUM_CODE_SNAPSHOT_DEPTH = 64;

export function snapshotRealBuildCode(paths: readonly string[]): Readonly<Record<string, string>> {
  if (paths.length > MAXIMUM_CODE_SNAPSHOT_FILES) {
    throw new TypeError(
      `Real-build code snapshot has ${paths.length} files; the bounded maximum is ${MAXIMUM_CODE_SNAPSHOT_FILES}.`,
    );
  }
  return Object.fromEntries(
    paths.map((path) => [
      path,
      sha256Digest(
        readBoundedRegularFile(resolve(path), {
          label: "real-build code snapshot",
          minimumBytes: 0,
          maximumBytes: MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
        }),
      ),
    ]),
  );
}

/** Enumerates only regular, non-symlink source files below deliberately scoped repository roots. */
export function enumerateRealBuildCodeRoots(
  roots: readonly string[],
  repoRoot = process.cwd(),
): readonly string[] {
  const files: string[] = [];
  let entries = 0;
  const visit = (candidate: string, depth: number): void => {
    if (depth > MAXIMUM_CODE_SNAPSHOT_DEPTH) {
      throw new TypeError(
        `Real-build code roots exceed the ${MAXIMUM_CODE_SNAPSHOT_DEPTH}-directory depth bound at ${candidate}.`,
      );
    }
    entries += 1;
    if (entries > MAXIMUM_CODE_SNAPSHOT_ENTRIES) {
      throw new TypeError(
        `Real-build code roots contain more than ${MAXIMUM_CODE_SNAPSHOT_ENTRIES} entries; narrow the declared roots.`,
      );
    }
    const normalized = normalizeRealBuildRelativePath(candidate, "real-build source root entry");
    const preflight = preflightContainedPath(repoRoot, normalized, "real-build source root entry");
    const stat = lstatSync(preflight.target, { bigint: true });
    if (stat.isSymbolicLink()) {
      throw new TypeError(
        `Real-build code snapshot root may not traverse symlink ${preflight.target}.`,
      );
    }
    if (stat.isDirectory()) {
      const before = comparableFileState(stat, `real-build source directory ${normalized}`);
      if (!inside(preflight.rootRealpath, realpathSync.native(preflight.target))) {
        throw new TypeError(`Real-build source directory escaped its real root: ${normalized}.`);
      }
      let descriptor: number | null = null;
      let names: string[];
      try {
        descriptor = openSync(preflight.target, "r");
        const opened = comparableFileState(
          fstatSync(descriptor, { bigint: true }),
          `real-build source directory descriptor ${normalized}`,
        );
        if (!sameFileState(before, opened)) {
          throw new TypeError(
            `Real-build source directory changed before enumeration: ${normalized}.`,
          );
        }
        names = readdirSync(preflight.target).sort((left, right) => left.localeCompare(right));
        assertAncestorSnapshotsStable(preflight, `real-build source directory ${normalized}`);
        const after = comparableFileState(
          lstatSync(preflight.target, { bigint: true }),
          `real-build source directory after enumeration ${normalized}`,
        );
        const openedAfter = comparableFileState(
          fstatSync(descriptor, { bigint: true }),
          `real-build source directory descriptor after enumeration ${normalized}`,
        );
        if (!sameFileState(before, after) || !sameFileState(after, openedAfter)) {
          throw new TypeError(
            `Real-build source directory changed during enumeration: ${normalized}.`,
          );
        }
      } finally {
        if (descriptor !== null) closeSync(descriptor);
      }
      for (const name of names) {
        if ([".git", "node_modules", "output", "var"].includes(name)) continue;
        visit(`${normalized}/${name}`, depth + 1);
      }
      return;
    }
    if (stat.isFile()) {
      if (files.length >= MAXIMUM_CODE_SNAPSHOT_FILES) {
        throw new TypeError(
          `Real-build code roots contain more than ${MAXIMUM_CODE_SNAPSHOT_FILES} files; narrow the declared source roots.`,
        );
      }
      assertAncestorSnapshotsStable(preflight, `real-build source file ${normalized}`);
      files.push(normalized);
      return;
    }
    throw new TypeError(`Real-build source entry is neither a file nor directory: ${normalized}.`);
  };
  for (const root of roots) {
    visit(root, 0);
  }
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

/** Recursively binds every result-determining source under deliberately scoped roots. */
export function snapshotRealBuildCodeRoots(
  roots: readonly string[],
  repoRoot = process.cwd(),
): Readonly<Record<string, string>> {
  const files = enumerateRealBuildCodeRoots(roots, repoRoot);
  return Object.fromEntries(
    files.map((path) => [
      path,
      sha256Digest(
        readContainedBoundedRegularFile(repoRoot, path, {
          label: "real-build source snapshot",
          minimumBytes: 0,
          maximumBytes: MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
        }),
      ),
    ]),
  );
}

export function writeRealBuildArtifactManifest(input: {
  readonly directory: string;
  readonly runId: string;
  readonly runContract: ReturnType<typeof createRealBuildRunContract>;
  readonly result: RealBuildResult;
  readonly artifactFiles: readonly string[];
  readonly replayClosure: RealBuildReplayClosureManifest;
}): string {
  if (
    input.runContract.schemaVersion !== "lego.real-build-run-contract/5" ||
    input.replayClosure.schemaVersion !== "lego.real-build-replay-closure/3"
  ) {
    throw new TypeError(
      "Current artifact-manifest /4 publication requires exact run-contract /5 and replay-closure /3 inputs; legacy generations are inspection-only.",
    );
  }
  assertCurrentArtifactReplayBoundaryVerifiable(input.replayClosure, "publish");
  if (!isLocalRealBuildAuthority(input.result.authority)) {
    throw new TypeError(
      "Artifact result authority is malformed; this local driver may publish only explicitly unauthenticated diagnostic evidence.",
    );
  }
  if (!isLocallyFinalizedRealBuildResult(input.result)) {
    throw new TypeError(
      "Artifact result was not produced by the local Node finalizer in this process; deserialized or browser-authored completion cannot be published.",
    );
  }
  const artifactFiles = validateRealBuildArtifactFilePlan(input.artifactFiles);
  let retainedArtifactBytes = 0;
  const artifacts = artifactFiles
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .map((file) => {
      const bytes = readContainedBoundedRegularFile(input.directory, file, {
        label: `retained artifact ${file}`,
        minimumBytes: 0,
        maximumBytes: maximumRealBuildRetainedArtifactBytes(file),
      });
      retainedArtifactBytes += bytes.length;
      if (retainedArtifactBytes > MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES) {
        throw new TypeError(
          `Retained artifacts exceed the ${MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES}-byte aggregate bound at ${file}.`,
        );
      }
      return { file, bytes: bytes.length, digest: sha256Digest(bytes) };
    });
  const validationSnapshots = [
    ...new Map(
      input.result.steps
        .filter(({ validation }) => validation.attempted)
        .map(({ validation }) => [
          JSON.stringify([
            validation.truthSnapshotHash,
            validation.validatorSetHash,
            validation.targetDocumentHash,
          ]),
          {
            truthSnapshotHash: validation.truthSnapshotHash,
            validatorSetHash: validation.validatorSetHash,
            targetDocumentHash: validation.targetDocumentHash,
          },
        ]),
    ).values(),
  ];
  const manifest = {
    schemaVersion: REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA,
    authority: input.result.authority,
    runId: input.runId,
    runContract: input.runContract,
    truthSnapshots: {
      availability:
        validationSnapshots.length > 0 ? ("captured" as const) : ("unavailable" as const),
      validationSnapshots,
      finalStructuralHash: input.result.structuralHash,
      diagnosticPrefix: realBuildDiagnosticPrefixSummary(input.result.diagnosticPrefix),
    },
    replayClosure: {
      manifestDigest: input.replayClosure.manifestDigest,
      replayLevel: input.replayClosure.replayLevel,
      earliestBoundary: input.replayClosure.earliestBoundary,
      sourceBundleDigest: input.replayClosure.sourceBundle.digest,
      environmentDigest: input.replayClosure.environmentDigest,
    },
    artifacts,
  };
  const manifestBytes = encodeCanonicalRealBuildJson(manifest, "pretty-one-space-line");
  if (manifestBytes.length > MAXIMUM_ARTIFACT_MANIFEST_BYTES) {
    throw new TypeError(
      `Real-build artifact manifest is ${manifestBytes.length} bytes; maximum is ${MAXIMUM_ARTIFACT_MANIFEST_BYTES}.`,
    );
  }
  return writeContainedRegularFileAtomic(input.directory, "artifact-manifest.json", manifestBytes, {
    label: "real-build artifact manifest",
  });
}
