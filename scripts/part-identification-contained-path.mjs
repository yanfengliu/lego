import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";

const comparablePath = (path) =>
  process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);

function within(root, candidate) {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))
  );
}

function identity(stats, label) {
  const valid = (value) =>
    typeof value === "bigint" ? value >= 0n : Number.isInteger(value) && value >= 0;
  if (!valid(stats.dev) || !valid(stats.ino) || stats.ino === 0 || stats.ino === 0n) {
    throw new Error(
      `${label} does not expose a positive comparable inode identity. Refusing a contained read whose path replacement could not be detected.`,
    );
  }
  return { dev: stats.dev, ino: stats.ino };
}

function sameIdentity(left, right) {
  return (
    left.ino === right.ino &&
    (left.dev === 0 ||
      left.dev === 0n ||
      right.dev === 0 ||
      right.dev === 0n ||
      left.dev === right.dev)
  );
}

function fileState(stats, label) {
  const fileIdentity = identity(stats, label);
  if (stats.size < 0n || stats.mtimeNs < 0n || stats.ctimeNs < 0n) {
    throw new Error(`${label} does not expose comparable size and timestamp metadata.`);
  }
  return {
    ...fileIdentity,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  };
}

export function sameContainedFileState(stats, expected) {
  return (
    sameIdentity(stats, expected) &&
    stats.size === expected.size &&
    stats.mtimeNs === expected.mtimeNs &&
    stats.ctimeNs === expected.ctimeNs
  );
}

export function assertOrdinaryDirectoryPath(
  path,
  { create = false, label = "Declared root" } = {},
) {
  const absolute = resolve(path);
  const parsed = parse(absolute);
  let current = parsed.root;
  for (const segment of relative(parsed.root, absolute).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (!existsSync(current)) {
      if (!create) throw new Error(`${label} ${JSON.stringify(absolute)} does not exist.`);
      mkdirSync(current);
    }
    const stats = lstatSync(current, { bigint: true });
    const resolved = realpathSync(current);
    if (
      !stats.isDirectory() ||
      stats.isSymbolicLink() ||
      comparablePath(resolved) !== comparablePath(current)
    ) {
      throw new Error(
        `${label} ${JSON.stringify(absolute)} crosses linked, junction, or non-directory component ${JSON.stringify(current)}. Use an ordinary directory tree as the declared containment root.`,
      );
    }
  }
  return absolute;
}

function snapshotDirectories(root, parent, label) {
  const displayLabel = label ?? "Contained input";
  const snapshots = [];
  let current = root;
  for (const segment of ["", ...relative(root, parent).split(sep).filter(Boolean)]) {
    if (segment !== "") current = resolve(current, segment);
    const stats = lstatSync(current, { bigint: true });
    const resolved = realpathSync(current);
    if (
      !stats.isDirectory() ||
      stats.isSymbolicLink() ||
      comparablePath(resolved) !== comparablePath(current)
    ) {
      throw new Error(
        `${displayLabel} crosses symbolic-link or junction-backed non-directory ancestor ${JSON.stringify(current)}. Copy the retained input beneath an ordinary declared root.`,
      );
    }
    snapshots.push({
      path: current,
      realpath: resolved,
      ...identity(stats, `${displayLabel} ancestor`),
    });
  }
  return snapshots;
}

export function assertContainedReadBoundaryStable(boundary, label = "Contained input") {
  for (const expected of boundary.directories) {
    const stats = lstatSync(expected.path, { bigint: true });
    const resolved = realpathSync(expected.path);
    if (
      !stats.isDirectory() ||
      stats.isSymbolicLink() ||
      !sameIdentity(identity(stats, `${label} ancestor`), expected) ||
      comparablePath(resolved) !== comparablePath(expected.realpath)
    ) {
      throw new Error(
        `${label} ancestor ${JSON.stringify(expected.path)} changed identity or resolution during its contained read. Retry from an immutable retained input tree.`,
      );
    }
  }
}

export function preflightContainedRead(root, canonical, options = {}) {
  const rootPath = assertOrdinaryDirectoryPath(root, {
    label: options.rootLabel ?? "Declared input root",
  });
  const rootRealpath = realpathSync(rootPath);
  const candidate = resolve(rootPath, ...canonical.split("/"));
  if (!within(rootRealpath, candidate)) {
    throw new Error(
      `${options.pathLabel ?? "artifact path"} ${JSON.stringify(canonical)} escapes declared root ${JSON.stringify(rootRealpath)}.`,
    );
  }
  const directories = snapshotDirectories(rootPath, dirname(candidate), options.label);
  const candidateBefore = lstatSync(candidate, { bigint: true });
  if (!candidateBefore.isFile() || candidateBefore.isSymbolicLink()) {
    throw new Error(`${options.label ?? "Contained input"} is not an ordinary regular file.`);
  }
  const candidateState = fileState(candidateBefore, options.label ?? "Contained input");
  const resolved = realpathSync(candidate);
  if (!within(rootRealpath, resolved)) {
    throw new Error(
      `${options.pathLabel ?? "artifact path"} ${JSON.stringify(canonical)} resolves outside declared root ${JSON.stringify(rootRealpath)}.`,
    );
  }
  const boundary = { candidate, candidateState, directories, resolved };
  assertContainedReadBoundaryStable(boundary, options.label);
  const candidateAfter = lstatSync(candidate, { bigint: true });
  if (!sameContainedFileState(candidateAfter, candidateState)) {
    throw new Error(
      `${options.label ?? "Contained input"} changed identity or content metadata during containment preflight. Retry from an immutable retained artifact.`,
    );
  }
  return boundary;
}
