import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { type RealBuildOptions, type RealBuildResult } from "./real-build-safety";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import { isLocallyFinalizedRealBuildResult } from "./real-build-finalize";
import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "./real-build-browser-output";
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
import {
  createRealBuildRunContract,
  parseRealBuildRunContract,
  verifyRealBuildRunContract,
  type RealBuildRunContract,
} from "./real-build-run-contract";
export { createRealBuildRunContract } from "./real-build-run-contract";
import {
  verifyRealBuildReplayClosureData,
  type RealBuildReplayClosureManifest,
} from "./real-build-replay";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files";
import { MAXIMUM_REPLAY_SOURCE_FILE_BYTES } from "./real-build-replay-policy";
import { verifyRealBuildServedResponseEvidence } from "./real-build-served-response-verification";
import {
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  servedResponseChunkName,
} from "./real-build-served-response-policy";
import { parseFatalUtf8Json } from "./strict-json";
import { assertRealBuildEnvironment, type RealBuildEnvironment } from "./real-build-environment";
import { verifyRealBuildArtifactScore } from "./real-build-artifact-score-verification";
export { createRealBuildScore, REAL_BUILD_SCORE_SCHEMA } from "./real-build-score";
import {
  isRealBuildDiagnosticPrefixSummary,
  realBuildDiagnosticPrefixSummary,
  REAL_BUILD_DIAGNOSTIC_PREFIX_FILE,
} from "./real-build-diagnostic-prefix";

export {
  beginAtomicRun,
  planAtomicRunDirectory,
  REAL_BUILD_RUN_ID_PATTERN,
  validateRealBuildOutputRoot,
} from "./real-build-artifact-publication";
import { REAL_BUILD_RUN_ID_PATTERN } from "./real-build-artifact-publication";
import type { RealBuildPublicationVerification } from "./real-build-artifact-publication";
import { assertNoUndeclaredRealBuildArtifacts } from "./real-build-artifact-file-set";

export const REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA = "lego.real-build-artifact-manifest/3" as const;

const MAXIMUM_ARTIFACT_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_PRINTED_STEPS = 359;
export const MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_SCORE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SERVED_RESPONSE_CHUNKS = Math.ceil(
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES / MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
);
export const MAXIMUM_RETAINED_ARTIFACTS =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 +
  (MAXIMUM_REAL_BUILD_PRINTED_STEPS - 1) * MAXIMUM_REAL_BUILD_FARTHER_CAPTURES +
  MAXIMUM_SERVED_RESPONSE_CHUNKS +
  4;
export const MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 * MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES +
  (MAXIMUM_REAL_BUILD_PRINTED_STEPS - 1) *
    MAXIMUM_REAL_BUILD_FARTHER_CAPTURES *
    MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES +
  MAXIMUM_SERVED_RESPONSE_CHUNKS * MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES +
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES +
  MAXIMUM_REAL_BUILD_DOCUMENT_BYTES * 2 +
  MAXIMUM_REAL_BUILD_SCORE_BYTES;
const MAXIMUM_CODE_SNAPSHOT_FILES = 10_000;
const MAXIMUM_CODE_SNAPSHOT_ENTRIES = 25_000;
const MAXIMUM_CODE_SNAPSHOT_DEPTH = 64;

export function sha256Digest(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactObjectKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)))
  );
}

function isNullableDigest(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value));
}

export function maximumRealBuildRetainedArtifactBytes(file: string): number {
  const normalized = normalizeRealBuildRelativePath(file, "retained artifact");
  const stepMatch = /^step-([0-9]{3})-(?:panel|build)\.png$/u.exec(normalized);
  if (stepMatch !== null) {
    const step = Number(stepMatch[1]);
    if (step >= 1 && step <= MAXIMUM_REAL_BUILD_PRINTED_STEPS) {
      return MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES;
    }
  }
  const fartherMatch =
    /^step-([0-9]{3})-farther-([0-9]{2})-(?:source-panel|candidate-render)-panel-([0-9]{3})\.png$/u.exec(
      normalized,
    );
  if (fartherMatch !== null) {
    const step = Number(fartherMatch[1]);
    const captureId = Number(fartherMatch[2]);
    const panelStep = Number(fartherMatch[3]);
    if (
      step >= 1 &&
      step <= MAXIMUM_REAL_BUILD_PRINTED_STEPS &&
      captureId >= 0 &&
      captureId < MAXIMUM_REAL_BUILD_FARTHER_CAPTURES &&
      panelStep > step &&
      panelStep <= MAXIMUM_REAL_BUILD_PRINTED_STEPS
    ) {
      return MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES;
    }
  }
  if (normalized === "document.json" || normalized === REAL_BUILD_DIAGNOSTIC_PREFIX_FILE) {
    return MAXIMUM_REAL_BUILD_DOCUMENT_BYTES;
  }
  if (normalized === "score.json") return MAXIMUM_REAL_BUILD_SCORE_BYTES;
  if (normalized === REAL_BUILD_SERVED_RESPONSE_MANIFEST) {
    return MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES;
  }
  for (let index = 0; index < MAXIMUM_SERVED_RESPONSE_CHUNKS; index += 1) {
    if (normalized === servedResponseChunkName(index)) {
      return MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES;
    }
  }
  throw new TypeError(
    `Retained artifact ${normalized} is not one of the bounded step, canonical/diagnostic document, score, or served-response evidence classes.`,
  );
}

export function validateRealBuildArtifactFilePlan(files: readonly string[]): readonly string[] {
  if (files.length > MAXIMUM_RETAINED_ARTIFACTS) {
    throw new TypeError(
      `Artifact manifest has ${files.length} declared files; the 359-step live-shape maximum is ${MAXIMUM_RETAINED_ARTIFACTS}.`,
    );
  }
  const normalized = files.map((file) => {
    const path = normalizeRealBuildRelativePath(file, "retained artifact");
    maximumRealBuildRetainedArtifactBytes(path);
    return path;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError("Artifact manifest files must be unique within the bounded live shape.");
  }
  const fartherOrdinalsByStep = new Map<number, Set<number>>();
  for (const file of normalized) {
    const match = /^step-([0-9]{3})-farther-([0-9]{2})-/u.exec(file);
    if (match === null) continue;
    const step = Number(match[1]);
    const ordinal = Number(match[2]);
    const ordinals = fartherOrdinalsByStep.get(step) ?? new Set<number>();
    if (ordinals.has(ordinal)) {
      throw new TypeError(
        `Printed step ${step} repeats farther capture ordinal ${ordinal}; required one deterministic path per captureId.`,
      );
    }
    ordinals.add(ordinal);
    fartherOrdinalsByStep.set(step, ordinals);
  }
  return normalized;
}

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
  if (!isLocalRealBuildAuthority(input.result.authority)) {
    throw new TypeError(
      "Artifact result authority is malformed; this local driver may publish only explicitly unauthenticated diagnostic evidence.",
    );
  }
  if (
    input.result.status !== "input-rejected" &&
    !isLocallyFinalizedRealBuildResult(input.result)
  ) {
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
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  if (manifestBytes.length > MAXIMUM_ARTIFACT_MANIFEST_BYTES) {
    throw new TypeError(
      `Real-build artifact manifest is ${manifestBytes.length} bytes; maximum is ${MAXIMUM_ARTIFACT_MANIFEST_BYTES}.`,
    );
  }
  return writeContainedRegularFileAtomic(input.directory, "artifact-manifest.json", manifestBytes, {
    label: "real-build artifact manifest",
  });
}

export function verifyRealBuildArtifactManifest(
  directory: string,
  expectedRunId?: string,
): RealBuildPublicationVerification {
  const artifactManifestBytes = readContainedBoundedRegularFile(
    directory,
    "artifact-manifest.json",
    {
      label: "artifact manifest",
      maximumBytes: MAXIMUM_ARTIFACT_MANIFEST_BYTES,
    },
  );
  const manifest = parseFatalUtf8Json<{
    readonly schemaVersion?: string;
    readonly authority?: RealBuildResult["authority"];
    readonly runId?: string;
    readonly runContract?: RealBuildRunContract;
    readonly truthSnapshots?: {
      readonly availability?: string;
      readonly validationSnapshots?: readonly {
        readonly truthSnapshotHash?: string | null;
        readonly validatorSetHash?: string | null;
        readonly targetDocumentHash?: string | null;
      }[];
      readonly finalStructuralHash?: string | null;
      readonly diagnosticPrefix?: unknown;
    };
    readonly replayClosure?: {
      readonly manifestDigest?: string;
      readonly replayLevel?: string;
      readonly earliestBoundary?: string;
      readonly sourceBundleDigest?: string;
      readonly environmentDigest?: string;
    };
    readonly artifacts?: readonly {
      readonly file: string;
      readonly bytes: number;
      readonly digest: string;
    }[];
  }>(artifactManifestBytes, "artifact manifest");
  if (
    manifest.schemaVersion !== REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA ||
    manifest.authority?.kind !== "local-diagnostic" ||
    manifest.authority.authenticated !== false ||
    manifest.authority.trustSealDigest !== null ||
    manifest.authority.reason !== "released-companion-broker-unavailable" ||
    typeof manifest.runId !== "string" ||
    !REAL_BUILD_RUN_ID_PATTERN.test(manifest.runId) ||
    (expectedRunId !== undefined && manifest.runId !== expectedRunId) ||
    manifest.runContract?.schemaVersion !== "lego.real-build-run-contract/2" ||
    !isRecord(manifest.truthSnapshots) ||
    !exactObjectKeys(manifest.truthSnapshots, [
      "availability",
      "validationSnapshots",
      "finalStructuralHash",
      "diagnosticPrefix",
    ]) ||
    !Array.isArray(manifest.truthSnapshots.validationSnapshots) ||
    manifest.truthSnapshots.validationSnapshots.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    !isNullableDigest(manifest.truthSnapshots.finalStructuralHash) ||
    (manifest.truthSnapshots.diagnosticPrefix !== null &&
      !isRealBuildDiagnosticPrefixSummary(manifest.truthSnapshots.diagnosticPrefix)) ||
    !Array.isArray(manifest.artifacts) ||
    !/^sha256:[0-9a-f]{64}$/u.test(manifest.replayClosure?.manifestDigest ?? "") ||
    !["downstream-only", "metadata-only"].includes(manifest.replayClosure?.replayLevel ?? "") ||
    !["browser-output", "input-rejection"].includes(
      manifest.replayClosure?.earliestBoundary ?? "",
    ) ||
    !/^sha256:[0-9a-f]{64}$/u.test(manifest.replayClosure?.sourceBundleDigest ?? "") ||
    !/^sha256:[0-9a-f]{64}$/u.test(manifest.replayClosure?.environmentDigest ?? "")
  ) {
    throw new TypeError("Real-build artifact manifest schema or replay binding is invalid.");
  }
  const declaredValidationSnapshots = manifest.truthSnapshots!.validationSnapshots!;
  if (
    declaredValidationSnapshots.some(
      (snapshot) =>
        !isRecord(snapshot) ||
        !exactObjectKeys(snapshot, [
          "truthSnapshotHash",
          "validatorSetHash",
          "targetDocumentHash",
        ]) ||
        !isNullableDigest(snapshot.truthSnapshotHash) ||
        !isNullableDigest(snapshot.validatorSetHash) ||
        !isNullableDigest(snapshot.targetDocumentHash),
    ) ||
    manifest.truthSnapshots!.availability !==
      (declaredValidationSnapshots.length > 0 ? "captured" : "unavailable")
  ) {
    throw new TypeError(
      "Artifact truthSnapshots must be an exact bounded set of captured validation digests with matching availability.",
    );
  }
  if (manifest.artifacts.length > MAXIMUM_RETAINED_ARTIFACTS) {
    throw new TypeError(
      `Artifact manifest declares ${manifest.artifacts.length} files; the maximum is ${MAXIMUM_RETAINED_ARTIFACTS}.`,
    );
  }
  const verifiedClosure = verifyRealBuildReplayClosureData(directory);
  const closure = verifiedClosure.manifest;
  if (
    closure.manifestDigest !== manifest.replayClosure!.manifestDigest ||
    closure.replayLevel !== manifest.replayClosure!.replayLevel ||
    closure.earliestBoundary !== manifest.replayClosure!.earliestBoundary ||
    closure.sourceBundle.digest !== manifest.replayClosure!.sourceBundleDigest ||
    closure.environmentDigest !== manifest.replayClosure!.environmentDigest ||
    closure.authority !== manifest.authority!.kind ||
    closure.authenticated !== manifest.authority!.authenticated
  ) {
    throw new TypeError("Artifact manifest does not bind the verified replay closure.");
  }
  const retainedContract = parseRealBuildRunContract(
    verifiedClosure.roleBytes.get("run-contract")!,
  );
  if (JSON.stringify(retainedContract) !== JSON.stringify(manifest.runContract)) {
    throw new TypeError(
      "Artifact manifest run contract differs from the retained run-contract role.",
    );
  }
  const preparedOptions = parseFatalUtf8Json<RealBuildOptions>(
    verifiedClosure.roleBytes.get("prepared-options")!,
    "artifact prepared-options role",
  );
  const environment = parseFatalUtf8Json<RealBuildEnvironment>(
    verifiedClosure.roleBytes.get("environment")!,
    "artifact environment role",
  );
  assertRealBuildEnvironment(environment, retainedContract.contractDigest);
  verifyRealBuildRunContract({
    contract: retainedContract,
    options: preparedOptions,
    roleDigests: Object.fromEntries(closure.roles.map(({ role, digest }) => [role, digest])),
    sourceFiles: closure.sourceBundle.files,
  });
  if (
    manifest.artifacts.some(
      (artifact) =>
        artifact === null || typeof artifact !== "object" || typeof artifact.file !== "string",
    )
  ) {
    throw new TypeError("Retained artifact entries must be objects with canonical string paths.");
  }
  if (
    manifest.artifacts.some((artifact, index) =>
      index > 0 ? manifest.artifacts![index - 1]!.file.localeCompare(artifact.file) >= 0 : false,
    )
  ) {
    throw new TypeError("Retained artifact entries must be uniquely sorted by canonical path.");
  }
  const artifactPaths = new Set<string>();
  const artifactEntries = new Map<string, { readonly bytes: number; readonly digest: string }>();
  let aggregateBytes = 0;
  let scoreBytes: Buffer | null = null;
  let documentBytes: Buffer | null = null;
  let diagnosticPrefixBytes: Buffer | null = null;
  for (const artifact of manifest.artifacts) {
    const normalized = normalizeRealBuildRelativePath(artifact.file, "retained artifact");
    if (
      artifactPaths.has(normalized) ||
      normalized !== artifact.file ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0 ||
      artifact.bytes > maximumRealBuildRetainedArtifactBytes(normalized) ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifact.digest)
    ) {
      throw new TypeError(`Retained artifact entry is malformed or duplicated: ${artifact.file}.`);
    }
    artifactPaths.add(normalized);
    artifactEntries.set(normalized, { bytes: artifact.bytes, digest: artifact.digest });
    aggregateBytes += artifact.bytes;
    if (aggregateBytes > MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES) {
      throw new TypeError(
        `Retained artifacts exceed the ${MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES}-byte aggregate bound at ${artifact.file}.`,
      );
    }
    const bytes = readContainedBoundedRegularFile(directory, normalized, {
      label: `retained artifact ${normalized}`,
      minimumBytes: 0,
      maximumBytes: maximumRealBuildRetainedArtifactBytes(normalized),
      exactBytes: artifact.bytes,
      expectedSha256: artifact.digest,
    });
    if (sha256Digest(bytes) !== artifact.digest) {
      throw new TypeError(`Retained artifact ${artifact.file} failed pre-publication hash check.`);
    }
    if (normalized === "score.json") scoreBytes = bytes;
    if (normalized === "document.json") documentBytes = bytes;
    if (normalized === REAL_BUILD_DIAGNOSTIC_PREFIX_FILE) diagnosticPrefixBytes = bytes;
  }
  assertNoUndeclaredRealBuildArtifacts(directory, artifactPaths);
  if (scoreBytes === null) {
    throw new TypeError("Retained artifacts must include score.json as the truth-summary source.");
  }
  verifyRealBuildArtifactScore({
    scoreBytes,
    documentBytes,
    diagnosticPrefixBytes,
    artifactEntries,
    declaredValidationSnapshots,
    declaredFinalStructuralHash: manifest.truthSnapshots!.finalStructuralHash!,
    declaredDiagnosticPrefix: manifest.truthSnapshots!.diagnosticPrefix,
    runId: manifest.runId!,
    authority: manifest.authority!,
    retainedContract,
    preparedOptions,
    replayLevel: closure.replayLevel,
    earliestBoundary: closure.earliestBoundary,
    browserOutputBytes: verifiedClosure.roleBytes.get("browser-output"),
    maximumPrintedSteps: MAXIMUM_REAL_BUILD_PRINTED_STEPS,
    sha256Digest,
  });
  const servedResponseFiles = verifyRealBuildServedResponseEvidence({
    directory,
    expectedManifestDigest: environment.servedResponseManifestDigest!,
    sourceFiles: closure.sourceBundle.files,
    requireRunner: closure.replayLevel === "downstream-only",
  });
  for (const file of servedResponseFiles) {
    if (!artifactPaths.has(file)) {
      throw new TypeError(`Served-response evidence ${file} is missing from retained artifacts.`);
    }
  }
  return {
    runId: manifest.runId!,
    replayClosureDigest: closure.manifestDigest,
    artifactManifestDigest: sha256Digest(artifactManifestBytes),
  };
}
