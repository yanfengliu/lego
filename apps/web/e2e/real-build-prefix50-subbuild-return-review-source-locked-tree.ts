import { lstatSync, readdirSync, type BigIntStats } from "node:fs";
import { relative, resolve, sep } from "node:path";

import {
  readContainedBoundedRegularFile,
  type BoundedFileRaceTestHooks,
} from "./bounded-file-read.ts";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files.ts";
import {
  listRealBuildPrefix50Step44LockedInputRoot,
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockRepository,
  type RealBuildPrefix50Step44LockedInputRow,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

const MAXIMUM_TREE_ENTRIES = 25_000;
const verifiedRoots = new WeakMap<object, Set<string>>();

function sameDirectoryState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function enumerateRegularFiles(
  repositoryRoot: string,
  logicalRoot: string,
  label: string,
): string[] {
  const repository = resolve(repositoryRoot);
  const root = resolve(repository, logicalRoot);
  const containment = relative(repository, root);
  if (containment === ".." || containment.startsWith(`..${sep}`))
    throw new TypeError(`${label} escaped the source-locked repository.`);
  const files: string[] = [];
  let entries = 0;
  const visit = (logicalPath: string, depth: number): void => {
    if (depth > 64) throw new TypeError(`${label} exceeds the maximum directory depth of 64.`);
    entries += 1;
    if (entries > MAXIMUM_TREE_ENTRIES)
      throw new TypeError(`${label} exceeds ${MAXIMUM_TREE_ENTRIES} bounded entries.`);
    const absolute = resolve(repository, logicalPath);
    const before = lstatSync(absolute, { bigint: true });
    if (before.isSymbolicLink())
      throw new TypeError(`${label} contains a symlink or junction at ${logicalPath}.`);
    if (before.isFile()) {
      files.push(logicalPath.replaceAll("\\", "/"));
      return;
    }
    if (!before.isDirectory())
      throw new TypeError(`${label} contains a non-file entry at ${logicalPath}.`);
    const names = readdirSync(absolute).sort((left, right) => left.localeCompare(right));
    for (const name of names) visit(`${logicalPath}/${name}`, depth + 1);
    const after = lstatSync(absolute, { bigint: true });
    if (!after.isDirectory() || !sameDirectoryState(before, after))
      throw new TypeError(`${label} directory identity changed while enumerating ${logicalPath}.`);
  };
  visit(logicalRoot, 0);
  return files.sort((left, right) => left.localeCompare(right));
}

function requireExactRoster(
  observed: readonly string[],
  rows: readonly RealBuildPrefix50Step44LockedInputRow[],
  label: string,
): void {
  const expected = rows.map(({ path }) => path).sort((left, right) => left.localeCompare(right));
  if (
    observed.length !== expected.length ||
    observed.some((path, index) => path !== expected[index])
  )
    throw new TypeError(
      `${label} current file roster omitted, added, linked, or renamed an entry from its source-lock manifest.`,
    );
}

export function assertRealBuildPrefix50Step44CompleteLockedInputRoot(input: {
  readonly repositoryRoot: string;
  readonly logicalRoot: string;
  readonly label: string;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly __testHooks?: Readonly<Record<string, BoundedFileRaceTestHooks>>;
}): readonly RealBuildPrefix50Step44LockedInputRow[] {
  const logicalRoot = normalizeRealBuildRelativePath(
    input.logicalRoot,
    `${input.label} source-lock root`,
  );
  requireRealBuildPrefix50Step44SourceLockRepository(input.capability, input.repositoryRoot);
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  const rows = listRealBuildPrefix50Step44LockedInputRoot(input.capability, logicalRoot);
  const before = enumerateRegularFiles(input.repositoryRoot, logicalRoot, input.label);
  requireExactRoster(before, rows, input.label);
  const cached = verifiedRoots.get(input.capability)?.has(logicalRoot) === true;
  if (!cached) {
    for (const row of rows)
      readContainedBoundedRegularFile(input.repositoryRoot, row.path, {
        label: `${input.label} locked file`,
        minimumBytes: row.bytes,
        maximumBytes: row.bytes,
        exactBytes: row.bytes,
        expectedSha256: row.digest,
        ...(input.__testHooks?.[row.path] === undefined
          ? {}
          : { __testHooks: input.__testHooks[row.path] }),
      });
  }
  const after = enumerateRegularFiles(input.repositoryRoot, logicalRoot, input.label);
  requireExactRoster(after, rows, input.label);
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  if (!cached) {
    const roots = verifiedRoots.get(input.capability) ?? new Set<string>();
    roots.add(logicalRoot);
    verifiedRoots.set(input.capability, roots);
  }
  return rows;
}
