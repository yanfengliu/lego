import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { assertNoUndeclaredRealBuildArtifacts } from "./real-build-artifact-file-set";
import {
  maximumRealBuildRetainedArtifactBytes,
  MAXIMUM_RETAINED_ARTIFACTS,
  MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES,
  sha256Digest,
} from "./real-build-artifact-policy";
import { REAL_BUILD_DIAGNOSTIC_PREFIX_FILE } from "./real-build-diagnostic-prefix";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files";

export interface DeclaredRealBuildArtifactEntry {
  readonly file: string;
  readonly bytes: number;
  readonly digest: string;
}

export interface VerifiedRealBuildArtifactEntries {
  readonly artifactPaths: ReadonlySet<string>;
  readonly artifactEntries: ReadonlyMap<
    string,
    { readonly bytes: number; readonly digest: string }
  >;
  readonly scoreBytes: Buffer;
  readonly documentBytes: Buffer | null;
  readonly diagnosticPrefixBytes: Buffer | null;
}

export function assertExactRealBuildArtifactPaths(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
  generation: "current" | "legacy",
): void {
  const missing = [...expected].filter((path) => !actual.has(path));
  const extra = [...actual].filter((path) => !expected.has(path));
  if (missing.length > 0 || extra.length > 0 || actual.size !== expected.size) {
    throw new TypeError(
      `${generation === "legacy" ? "Legacy" : "Current"} artifact manifest file set is not the exact browser/score/served-response projection: ` +
        `missing [${missing.sort().join(", ")}], unexpected [${extra.sort().join(", ")}].`,
    );
  }
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    value !== null &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export function verifyRealBuildRetainedArtifacts(
  directory: string,
  artifacts: unknown,
): VerifiedRealBuildArtifactEntries {
  if (!Array.isArray(artifacts)) {
    throw new TypeError("Artifact manifest artifacts must be a bounded array.");
  }
  if (artifacts.length > MAXIMUM_RETAINED_ARTIFACTS) {
    throw new TypeError(
      `Artifact manifest declares ${artifacts.length} files; the maximum is ${MAXIMUM_RETAINED_ARTIFACTS}.`,
    );
  }
  const entries: DeclaredRealBuildArtifactEntry[] = [];
  for (const [index, artifact] of artifacts.entries()) {
    if (
      !isRecord(artifact) ||
      !hasExactKeys(artifact, ["file", "bytes", "digest"]) ||
      typeof artifact.file !== "string" ||
      !Number.isSafeInteger(artifact.bytes) ||
      typeof artifact.digest !== "string"
    ) {
      throw new TypeError(
        `Retained artifact entry ${index} must have exact file/bytes/digest fields.`,
      );
    }
    entries.push(artifact as unknown as DeclaredRealBuildArtifactEntry);
  }
  if (
    entries.some((entry, index) =>
      index > 0 ? entries[index - 1]!.file.localeCompare(entry.file) >= 0 : false,
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
  for (const artifact of entries) {
    const normalized = normalizeRealBuildRelativePath(artifact.file, "retained artifact");
    if (
      artifactPaths.has(normalized) ||
      normalized !== artifact.file ||
      artifact.bytes < 0 ||
      artifact.bytes > maximumRealBuildRetainedArtifactBytes(normalized) ||
      !DIGEST_PATTERN.test(artifact.digest)
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
  return {
    artifactPaths,
    artifactEntries,
    scoreBytes,
    documentBytes,
    diagnosticPrefixBytes,
  };
}
