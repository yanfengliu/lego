import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { documentStructuralHash } from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import {
  isAtomicStepComplete,
  type RealBuildOptions,
  type RealBuildResult,
} from "./real-build-safety";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import {
  finalizeExecutedRealBuildResult,
  isLocallyFinalizedRealBuildResult,
} from "./real-build-finalize";
import {
  assertRealBuildBrowserOutput,
  decodeRealBuildPngCapture,
} from "./real-build-browser-output";
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
import { createRealBuildScore, REAL_BUILD_SCORE_SCHEMA } from "./real-build-score";
export { createRealBuildScore, REAL_BUILD_SCORE_SCHEMA } from "./real-build-score";

export {
  beginAtomicRun,
  planAtomicRunDirectory,
  REAL_BUILD_RUN_ID_PATTERN,
  validateRealBuildOutputRoot,
} from "./real-build-artifact-publication";
import { REAL_BUILD_RUN_ID_PATTERN } from "./real-build-artifact-publication";
import type { RealBuildPublicationVerification } from "./real-build-artifact-publication";

export const REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA = "lego.real-build-artifact-manifest/2" as const;

const MAXIMUM_ARTIFACT_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_PRINTED_STEPS = 359;
export const MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_SCORE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SERVED_RESPONSE_CHUNKS = Math.ceil(
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES / MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
);
export const MAXIMUM_RETAINED_ARTIFACTS =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 + MAXIMUM_SERVED_RESPONSE_CHUNKS + 3;
export const MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 * MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES +
  MAXIMUM_SERVED_RESPONSE_CHUNKS * MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES +
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES +
  MAXIMUM_REAL_BUILD_DOCUMENT_BYTES +
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
  if (normalized === "document.json") return MAXIMUM_REAL_BUILD_DOCUMENT_BYTES;
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
    `Retained artifact ${normalized} is not one of the bounded step, document, score, or served-response evidence classes.`,
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
    ]) ||
    !Array.isArray(manifest.truthSnapshots.validationSnapshots) ||
    manifest.truthSnapshots.validationSnapshots.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    !isNullableDigest(manifest.truthSnapshots.finalStructuralHash) ||
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
  }
  if (scoreBytes === null) {
    throw new TypeError("Retained artifacts must include score.json as the truth-summary source.");
  }
  const score = parseFatalUtf8Json<Record<string, unknown>>(scoreBytes, "retained score artifact");
  if (
    !exactObjectKeys(score, [
      "schemaVersion",
      "authority",
      "runId",
      "status",
      "inputDigests",
      "accounting",
      "lastStep",
      "stepsAttempted",
      "stepsComplete",
      "piecesPlaced",
      "finalParts",
      "structuralHash",
      "inputFailures",
      "completionFailures",
      "failures",
      "totalElapsedMs",
      "steps",
    ]) ||
    score.schemaVersion !== REAL_BUILD_SCORE_SCHEMA ||
    score.runId !== manifest.runId ||
    JSON.stringify(score.authority) !== JSON.stringify(manifest.authority) ||
    JSON.stringify(score.inputDigests) !== JSON.stringify(retainedContract.inputDigests) ||
    JSON.stringify(score.accounting) !== JSON.stringify(preparedOptions.accounting) ||
    score.lastStep !== retainedContract.budgets.lastStep ||
    score.lastStep !== preparedOptions.lastStep ||
    !["completed", "prefix-complete", "incomplete", "input-rejected"].includes(
      String(score.status),
    ) ||
    !isNullableDigest(score.structuralHash) ||
    score.structuralHash !== manifest.truthSnapshots!.finalStructuralHash ||
    !Array.isArray(score.steps) ||
    score.steps.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    !Array.isArray(score.inputFailures) ||
    !Array.isArray(score.completionFailures) ||
    !Array.isArray(score.failures) ||
    !Number.isFinite(score.totalElapsedMs) ||
    (score.totalElapsedMs as number) < 0 ||
    (score.totalElapsedMs as number) > 4 * 60 * 60 * 1_000 ||
    !Number.isSafeInteger(score.finalParts) ||
    (score.finalParts as number) < 0 ||
    (score.finalParts as number) > preparedOptions.maxParts
  ) {
    throw new TypeError(
      "Retained score must bind the artifact run, authority, input digests, structural hash, and bounded step list.",
    );
  }
  if (closure.replayLevel === "downstream-only") {
    const browserOutput = parseFatalUtf8Json<unknown>(
      verifiedClosure.roleBytes.get("browser-output")!,
      "artifact browser-output role",
    );
    assertRealBuildBrowserOutput(browserOutput, preparedOptions);
    const reproducedResult = finalizeExecutedRealBuildResult({
      options: preparedOptions,
      browserOutput,
    });
    const reproducedScore = createRealBuildScore({
      runId: manifest.runId!,
      result: reproducedResult,
      accounting: preparedOptions.accounting,
      lastStep: preparedOptions.lastStep,
    });
    if (JSON.stringify(score) !== JSON.stringify(reproducedScore)) {
      throw new TypeError(
        "Retained score does not exactly reproduce from the independently finalized browser output and prepared options.",
      );
    }
    const reproducedDocument =
      reproducedResult.documentJson !== null && reproducedResult.structuralHash !== null
        ? Buffer.from(reproducedResult.documentJson)
        : null;
    if (
      (documentBytes === null) !== (reproducedDocument === null) ||
      (documentBytes !== null && !documentBytes.equals(reproducedDocument!))
    ) {
      throw new TypeError(
        "Retained document.json does not equal the exact document independently finalized from browser output.",
      );
    }
    for (const [index, step] of reproducedScore.steps.entries()) {
      const browserStep = browserOutput.reports[index]!;
      for (const [capture, retainedValue] of [
        [step.panelPng, browserStep.panelPng],
        [step.buildPng, browserStep.buildPng],
      ] as const) {
        if (capture !== null) {
          const entry = artifactEntries.get(capture);
          const expectedBytes = decodeRealBuildPngCapture(retainedValue!);
          if (
            entry === undefined ||
            entry.bytes !== expectedBytes.length ||
            entry.digest !== sha256Digest(expectedBytes)
          ) {
            throw new TypeError(
              `Retained step capture ${capture} does not equal its exact browser-output PNG bytes.`,
            );
          }
        }
      }
    }
  }
  let completedSteps = 0;
  let piecesPlaced = 0;
  const derivedFailures: unknown[] = [];
  for (let index = 0; index < score.steps.length; index += 1) {
    const step = score.steps[index];
    if (
      !isRecord(step) ||
      step.stepNumber !== index + 1 ||
      !Number.isSafeInteger(step.placedPieces) ||
      (step.placedPieces as number) < 0 ||
      !Number.isSafeInteger(step.expectedAssembledPieces) ||
      (step.expectedAssembledPieces as number) < 0 ||
      !isRecord(step.outcome) ||
      (step.canonicalStepId !== null && typeof step.canonicalStepId !== "string") ||
      !isNullableDigest(step.actionEvidenceDigest)
    ) {
      throw new TypeError(`Retained score step ${index} has an invalid completion shape.`);
    }
    if (
      isAtomicStepComplete({
        outcome: step.outcome as never,
        placedPieces: step.placedPieces as number,
        expectedAssembledPieces: step.expectedAssembledPieces as number,
        canonicalStepId: step.canonicalStepId as string | null,
        actionEvidenceDigest: step.actionEvidenceDigest,
      })
    ) {
      completedSteps += 1;
    }
    piecesPlaced += step.placedPieces as number;
    if (step.outcome.status === "failed") {
      derivedFailures.push({ stepNumber: step.stepNumber, failure: step.outcome.failure });
    }
  }
  const successfulPrefix =
    score.steps.length === preparedOptions.lastStep && completedSteps === score.steps.length;
  // One condition per cause, each naming what it saw. A single boolean over
  // every status covered seven different defects with one sentence, and the
  // sentence was the same whichever one fired.
  const totalsMismatch =
    score.stepsAttempted !== score.steps.length
      ? `stepsAttempted ${score.stepsAttempted} against ${score.steps.length} retained step row(s)`
      : score.stepsComplete !== completedSteps
        ? `stepsComplete ${score.stepsComplete} against ${completedSteps} row(s) that satisfy atomic completion`
        : score.piecesPlaced !== piecesPlaced
          ? `piecesPlaced ${score.piecesPlaced} against ${piecesPlaced} summed over the rows`
          : JSON.stringify(score.failures) !== JSON.stringify(derivedFailures)
            ? `${score.failures.length} retained failure(s) against ${derivedFailures.length} derived from rows whose outcome is failed`
            : null;
  if (totalsMismatch !== null) {
    throw new TypeError(`Retained score totals do not reproduce its step rows: ${totalsMismatch}.`);
  }
  if (score.status === "completed" || score.status === "prefix-complete") {
    if (!successfulPrefix) {
      throw new TypeError(
        `Retained score claims ${score.status} but only ${completedSteps} of ${score.steps.length} row(s) ` +
          `completed against a requested prefix of ${preparedOptions.lastStep}.`,
      );
    }
    // `completed` is the full booklet and nothing shorter; `prefix-complete` is
    // anything shorter and nothing longer. Written as two comparisons against
    // the ceiling rather than as one negation of the other, so a second
    // booklet's ceiling cannot quietly move which branch catches what.
    const claimTooShort =
      score.status === "completed" && preparedOptions.lastStep < MAXIMUM_REAL_BUILD_PRINTED_STEPS;
    const claimTooLong =
      score.status === "prefix-complete" &&
      preparedOptions.lastStep >= MAXIMUM_REAL_BUILD_PRINTED_STEPS;
    if (claimTooShort || claimTooLong) {
      throw new TypeError(
        `Retained score claims ${score.status} at requested last step ${preparedOptions.lastStep}; ` +
          `completed is reserved for the full ${MAXIMUM_REAL_BUILD_PRINTED_STEPS} printed steps and prefix-complete for anything shorter.`,
      );
    }
  }
  if (score.status === "input-rejected") {
    // A rejected run retains one typed refusal row per requested printed step
    // — that is what `inputRejectedRealBuildResult` exists to do, and what says
    // which step each cause lands on. Demanding zero rows made this branch
    // unsatisfiable, so every rejected run threw here whatever its cause.
    //
    // What the status forbids is a claim. Not only "no completion, no placement,
    // no document": a rejected run refused *before* execution, so no row may
    // claim it attempted a piece, reached a canonical build step, or validated
    // anything. Without that, one token input failure plus N rows of ordinary
    // execution failures verifies as an input rejection, and this artifact is
    // what the position-of-record document is written from.
    const executedRow = score.steps.findIndex(
      (step) =>
        isRecord(step) &&
        ((Number.isSafeInteger(step.attemptedPieces) && (step.attemptedPieces as number) > 0) ||
          step.canonicalStepId !== null ||
          (isRecord(step.validation) && step.validation.attempted === true)),
    );
    const rejectionMismatch =
      score.inputFailures.length === 0
        ? "no input failure was retained to justify the rejection"
        : score.structuralHash !== null
          ? `a structural hash ${String(score.structuralHash)} was claimed`
          : completedSteps !== 0
            ? `${completedSteps} row(s) claim atomic completion`
            : piecesPlaced !== 0
              ? `${piecesPlaced} piece(s) claim placement`
              : derivedFailures.length !== score.steps.length
                ? `${score.steps.length - derivedFailures.length} of ${score.steps.length} retained row(s) are not failures`
                : executedRow >= 0
                  ? `row ${executedRow + 1} claims it attempted pieces, reached a canonical step, or validated a document, ` +
                    `which a run refused before execution cannot have done`
                  : score.steps.length !== 0 && score.steps.length !== preparedOptions.lastStep
                    ? `${score.steps.length} refusal row(s) against a requested prefix of ${preparedOptions.lastStep}; ` +
                      `a rejected run retains one row per requested step, or none at all when it was refused before the panels were selected`
                    : null;
    if (rejectionMismatch !== null) {
      throw new TypeError(
        `Retained input-rejected score claims more than a refusal: ${rejectionMismatch}.`,
      );
    }
  }
  if (score.status === "incomplete" && successfulPrefix && score.completionFailures.length === 0) {
    throw new TypeError(
      `Retained score claims incomplete, yet all ${score.steps.length} requested row(s) completed and no completion failure was retained.`,
    );
  }
  if ((score.structuralHash === null) !== (documentBytes === null)) {
    throw new TypeError(
      "Retained document.json presence must exactly match the score structural-hash claim.",
    );
  }
  if (documentBytes !== null) {
    const document = parseFatalUtf8Json<unknown>(documentBytes, "retained document artifact");
    if (
      !validateBrickDocumentV1(document) ||
      documentStructuralHash(document as BrickDocumentV1) !== score.structuralHash ||
      (document as BrickDocumentV1).parts.length !== score.finalParts
    ) {
      throw new TypeError(
        "Retained document.json must be a valid BrickDocument with the score's exact structural hash and final part count.",
      );
    }
  }
  const scoreValidationSnapshots = [
    ...new Map(
      score.steps.flatMap((step) => {
        if (!isRecord(step) || !isRecord(step.validation)) {
          throw new TypeError("Retained score steps must contain validation records.");
        }
        if (step.validation.attempted !== true) return [];
        const snapshot = {
          truthSnapshotHash: step.validation.truthSnapshotHash,
          validatorSetHash: step.validation.validatorSetHash,
          targetDocumentHash: step.validation.targetDocumentHash,
        };
        if (
          !isNullableDigest(snapshot.truthSnapshotHash) ||
          !isNullableDigest(snapshot.validatorSetHash) ||
          !isNullableDigest(snapshot.targetDocumentHash)
        ) {
          throw new TypeError(
            "Retained score attempted validations must contain nullable canonical digest triples.",
          );
        }
        return [[JSON.stringify(Object.values(snapshot)), snapshot] as const];
      }),
    ).values(),
  ];
  if (JSON.stringify(scoreValidationSnapshots) !== JSON.stringify(declaredValidationSnapshots)) {
    throw new TypeError(
      "Artifact truthSnapshots differ from the retained score validation evidence.",
    );
  }
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
