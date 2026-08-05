import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { ensureContainedDirectoryTree } from "./contained-directory";
import {
  MAXIMUM_REPLAY_SOURCE_BYTES,
  MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
  MAXIMUM_REPLAY_SOURCE_FILES,
  MAXIMUM_REPLAY_WORK_ITEMS,
} from "./real-build-replay-policy";

const SAFE_RELATIVE_PATH_PATTERN = /^[A-Za-z0-9._@/-]+$/u;
const MAXIMUM_MIRROR_BYTES = 512 * 1024 * 1024;

const digest = (value: Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export interface RealBuildSourceSnapshot {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}

export interface RealBuildSourceMirror {
  readonly root: string;
  readonly files: readonly RealBuildSourceSnapshot[];
}

export function realBuildSourceMirrorDestinations(sourcePath: string): readonly string[] {
  const normalized = normalizeRealBuildRelativePath(sourcePath, "source mirror input");
  const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(normalized);
  return packageMatch === null
    ? [normalized]
    : [normalized, `node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`];
}

export function planRealBuildSourceMirrorBundle(input: {
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly fixedInputs?: readonly RealBuildSourceSnapshot[];
}): readonly RealBuildSourceSnapshot[] {
  if (input.sourceFiles.length > MAXIMUM_REPLAY_SOURCE_FILES) {
    throw new TypeError(
      `Source mirror bundle has ${input.sourceFiles.length} source files; maximum is ${MAXIMUM_REPLAY_SOURCE_FILES}.`,
    );
  }
  const fixedInputs = input.fixedInputs ?? [];
  if (fixedInputs.length > MAXIMUM_REPLAY_WORK_ITEMS) {
    throw new TypeError(
      `Source mirror bundle has ${fixedInputs.length} fixed files; maximum is ${MAXIMUM_REPLAY_WORK_ITEMS}.`,
    );
  }
  let outputCount = fixedInputs.length;
  for (const source of input.sourceFiles) {
    outputCount += realBuildSourceMirrorDestinations(source.path).length;
    if (outputCount > MAXIMUM_REPLAY_WORK_ITEMS) {
      throw new TypeError(
        `Source mirror bundle would exceed the ${MAXIMUM_REPLAY_WORK_ITEMS}-file work bound.`,
      );
    }
  }
  const planned = input.sourceFiles.flatMap((source) =>
    realBuildSourceMirrorDestinations(source.path).map((path) => ({ ...source, path })),
  );
  planned.push(
    ...fixedInputs.map((fixed) => ({
      ...fixed,
      path: normalizeRealBuildRelativePath(fixed.path, "fixed source mirror input"),
    })),
  );
  if (
    planned.length > MAXIMUM_REPLAY_WORK_ITEMS ||
    new Set(planned.map(({ path }) => path)).size !== planned.length
  ) {
    throw new TypeError(
      `Source mirror bundle must have unique destinations and at most ${MAXIMUM_REPLAY_WORK_ITEMS} files; received ${planned.length}.`,
    );
  }
  return planned.sort((left, right) => left.path.localeCompare(right.path));
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

export function normalizeRealBuildRelativePath(candidate: string, label: string): string {
  const normalized = candidate.replaceAll("\\", "/");
  if (
    candidate.length === 0 ||
    isAbsolute(candidate) ||
    !SAFE_RELATIVE_PATH_PATTERN.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(
      `${label} must be a strict relative path without traversal, dot segments, or special characters; received ${JSON.stringify(candidate)}.`,
    );
  }
  return normalized;
}

/** Compatibility resolver for path planning only; reads and writes use contained descriptors. */
export function resolveRealBuildPath(
  root: string,
  candidate: string,
  options: { readonly mustExist?: boolean; readonly label?: string } = {},
): string {
  const label = options.label ?? "real-build path";
  const normalized = normalizeRealBuildRelativePath(candidate, label);
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(resolvedRoot, normalized);
  if (!inside(resolvedRoot, resolvedCandidate)) {
    throw new TypeError(`${label} resolves outside ${resolvedRoot}: ${resolvedCandidate}.`);
  }
  const rootStat = lstatSync(resolvedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new TypeError(`${label} root must be a real directory: ${resolvedRoot}.`);
  }
  let cursor = resolvedRoot;
  for (const segment of normalized.split("/").slice(0, -1)) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) break;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new TypeError(`${label} may not traverse symlink or non-directory ${cursor}.`);
    }
  }
  let existingParent = dirname(resolvedCandidate);
  while (!existsSync(existingParent) && existingParent !== resolvedRoot) {
    existingParent = dirname(existingParent);
  }
  if (!inside(realpathSync.native(resolvedRoot), realpathSync.native(existingParent))) {
    throw new TypeError(`${label} parent resolves outside its real root: ${resolvedCandidate}.`);
  }
  if (options.mustExist === true && !existsSync(resolvedCandidate)) {
    throw new TypeError(`${label} does not exist: ${resolvedCandidate}.`);
  }
  return resolvedCandidate;
}

export function readRealBuildSourceFile(root: string, path: string, label: string): Buffer {
  const normalized = normalizeRealBuildRelativePath(path, label);
  return readContainedBoundedRegularFile(root, normalized, {
    label,
    minimumBytes: 0,
    maximumBytes: MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
  });
}

export function captureRealBuildSourceBundle(
  repoRoot: string,
  relativeFiles: readonly string[],
): readonly RealBuildSourceSnapshot[] {
  if (relativeFiles.length > MAXIMUM_REPLAY_SOURCE_FILES) {
    throw new TypeError(
      `Source snapshot has ${relativeFiles.length} declared files; the bounded maximum is ${MAXIMUM_REPLAY_SOURCE_FILES}.`,
    );
  }
  const unique = [
    ...new Set(
      relativeFiles.map((path) => normalizeRealBuildRelativePath(path, "source snapshot")),
    ),
  ].sort();
  let aggregateBytes = 0;
  return unique.map((path) => {
    const bytes = readRealBuildSourceFile(repoRoot, path, "source snapshot");
    aggregateBytes += bytes.length;
    if (aggregateBytes > MAXIMUM_REPLAY_SOURCE_BYTES) {
      throw new TypeError(
        `Source snapshot exceeds the ${MAXIMUM_REPLAY_SOURCE_BYTES}-byte aggregate bound at ${path}.`,
      );
    }
    return { path, digest: digest(bytes), bytes: bytes.length };
  });
}

/** Materializes a bounded execution mirror with guarded ancestors and atomic exact-file writes. */
export function materializeRealBuildSourceMirror(input: {
  readonly directory: string;
  readonly repoRoot: string;
  readonly sourceFiles: readonly string[];
  readonly fixedInputs?: readonly { readonly path: string; readonly bytes: Uint8Array }[];
}): RealBuildSourceMirror {
  if (input.sourceFiles.length > MAXIMUM_REPLAY_SOURCE_FILES) {
    throw new TypeError(
      `Source mirror has ${input.sourceFiles.length} declared inputs; the bounded maximum is ${MAXIMUM_REPLAY_SOURCE_FILES}.`,
    );
  }
  const fixedInputs = input.fixedInputs ?? [];
  if (fixedInputs.length > MAXIMUM_REPLAY_WORK_ITEMS) {
    throw new TypeError(
      `Source mirror has ${fixedInputs.length} fixed inputs; the bounded work maximum is ${MAXIMUM_REPLAY_WORK_ITEMS}.`,
    );
  }
  const sources = [
    ...new Set(
      input.sourceFiles.map((path) => normalizeRealBuildRelativePath(path, "source mirror input")),
    ),
  ].sort();
  const normalizedFixedInputs = fixedInputs.map((fixed) => ({
    path: normalizeRealBuildRelativePath(fixed.path, "fixed source mirror input"),
    bytes: fixed.bytes,
  }));
  const plannedDestinations = sources.flatMap(realBuildSourceMirrorDestinations);
  plannedDestinations.push(...normalizedFixedInputs.map(({ path }) => path));
  if (plannedDestinations.length > MAXIMUM_REPLAY_WORK_ITEMS) {
    throw new TypeError(
      `Source mirror would materialize ${plannedDestinations.length} files; the bounded work maximum is ${MAXIMUM_REPLAY_WORK_ITEMS}.`,
    );
  }
  if (new Set(plannedDestinations).size !== plannedDestinations.length) {
    throw new TypeError(
      "Source mirror destinations must be unique across source files, package aliases, and fixed inputs.",
    );
  }
  let declaredFixedBytes = 0;
  for (const fixed of normalizedFixedInputs) {
    if (fixed.bytes.byteLength > MAXIMUM_REPLAY_SOURCE_FILE_BYTES) {
      throw new TypeError(
        `Source mirror fixed input ${fixed.path} has ${fixed.bytes.byteLength} bytes; the per-file maximum is ${MAXIMUM_REPLAY_SOURCE_FILE_BYTES}.`,
      );
    }
    declaredFixedBytes += fixed.bytes.byteLength;
    if (declaredFixedBytes > MAXIMUM_MIRROR_BYTES) {
      throw new TypeError(
        `Source mirror fixed inputs exceed the ${MAXIMUM_MIRROR_BYTES}-byte aggregate bound at ${fixed.path}.`,
      );
    }
  }
  const mirrorCandidate = "source-snapshot";
  const mirrorRoot = ensureContainedDirectoryTree(
    input.directory,
    mirrorCandidate,
    "source execution mirror",
  );
  const written = new Set<string>();
  const snapshots: RealBuildSourceSnapshot[] = [];
  const preparedParents = new Set<string>();
  let aggregateBytes = 0;
  const writeMirrorFile = (path: string, bytes: Uint8Array): void => {
    const normalized = normalizeRealBuildRelativePath(path, "source mirror file");
    if (written.has(normalized)) {
      throw new TypeError(`Source mirror destination is duplicated: ${normalized}.`);
    }
    if (bytes.byteLength > MAXIMUM_REPLAY_SOURCE_FILE_BYTES) {
      throw new TypeError(
        `Source mirror file ${normalized} has ${bytes.byteLength} bytes; the per-file maximum is ${MAXIMUM_REPLAY_SOURCE_FILE_BYTES}.`,
      );
    }
    aggregateBytes += bytes.byteLength;
    if (aggregateBytes > MAXIMUM_MIRROR_BYTES) {
      throw new TypeError(
        `Source mirror exceeds its ${MAXIMUM_MIRROR_BYTES}-byte aggregate work bound at ${normalized}.`,
      );
    }
    const candidate = `${mirrorCandidate}/${normalized}`;
    const parent = dirname(candidate).replaceAll("\\", "/");
    if (!preparedParents.has(parent)) {
      ensureContainedDirectoryTree(input.directory, parent, "source mirror parent");
      preparedParents.add(parent);
    }
    writeContainedRegularFileAtomic(input.directory, candidate, bytes, {
      label: `source mirror file ${normalized}`,
    });
    written.add(normalized);
    snapshots.push({ path: normalized, digest: digest(bytes), bytes: bytes.byteLength });
  };
  for (const source of sources) {
    const bytes = readRealBuildSourceFile(input.repoRoot, source, "source mirror input");
    writeMirrorFile(source, bytes);
    const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(source);
    if (packageMatch !== null) {
      writeMirrorFile(`node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`, bytes);
    }
  }
  for (const fixed of normalizedFixedInputs) writeMirrorFile(fixed.path, fixed.bytes);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { root: mirrorRoot, files: snapshots };
}

export function sourceDriftFailures(
  expected: readonly RealBuildSourceSnapshot[],
  actual: readonly RealBuildSourceSnapshot[],
): readonly string[] {
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]));
  const failures = expected.flatMap((entry) => {
    const observed = actualByPath.get(entry.path);
    return observed?.digest === entry.digest && observed.bytes === entry.bytes
      ? []
      : [
          `${entry.path}: expected ${entry.digest}/${entry.bytes}, observed ` +
            `${observed?.digest ?? "missing"}/${observed?.bytes ?? "missing"}`,
        ];
  });
  for (const entry of actual) {
    if (!expected.some(({ path }) => path === entry.path))
      failures.push(`${entry.path}: unexpected`);
  }
  return failures;
}
