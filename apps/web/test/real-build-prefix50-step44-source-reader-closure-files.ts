import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export type Step44ClosureFileKind =
  "external-immutable-binary" | "external-immutable-helper" | "typescript-source";

export interface Step44ClosureFileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedNanoseconds: bigint;
  readonly changedNanoseconds: bigint;
}

export interface Step44ClosureFileSnapshot {
  readonly file: string;
  readonly repositoryPath: string;
  readonly kind: Step44ClosureFileKind;
  readonly bytes: Buffer;
  readonly text: string;
  readonly digest: `sha256:${string}`;
  readonly identity: Step44ClosureFileIdentity;
}

const MAXIMUM_CLOSURE_FILE_BYTES = 4 * 1024 * 1024;

function identity(path: string): Step44ClosureFileIdentity {
  const stats = lstatSync(path, { bigint: true });
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n)
    throw new TypeError(`Step-44 closure requires a regular, non-link, single-name file: ${path}.`);
  return {
    device: stats.dev,
    inode: stats.ino,
    size: stats.size,
    modifiedNanoseconds: stats.mtimeNs,
    changedNanoseconds: stats.ctimeNs,
  };
}

function sameIdentity(left: Step44ClosureFileIdentity, right: Step44ClosureFileIdentity): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.modifiedNanoseconds === right.modifiedNanoseconds &&
    left.changedNanoseconds === right.changedNanoseconds
  );
}

function requireNoLinkedPathComponents(repositoryRoot: string, file: string): void {
  const local = relative(repositoryRoot, file);
  if (local.length === 0 || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local))
    throw new TypeError(`Step-44 closure file escaped the canonical repository root: ${file}.`);
  let cursor = repositoryRoot;
  for (const component of local.split(sep)) {
    cursor = resolve(cursor, component);
    if (lstatSync(cursor).isSymbolicLink())
      throw new TypeError(`Step-44 closure rejects symlink, junction, or reparse path ${cursor}.`);
  }
}

function decodeUtf8(bytes: Buffer, file: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new TypeError(`Step-44 closure file is not canonical UTF-8 text: ${file}.`, {
      cause: error,
    });
  }
}

export function snapshotStep44ClosureFile(input: {
  readonly candidate: string;
  readonly repositoryRoot: string;
  readonly kind: Step44ClosureFileKind;
}): Step44ClosureFileSnapshot {
  const repositoryRoot = realpathSync.native(resolve(input.repositoryRoot));
  if (repositoryRoot !== resolve(input.repositoryRoot))
    throw new TypeError("Step-44 repository root must already be its exact canonical realpath.");
  const requested = resolve(input.candidate);
  const canonical = realpathSync.native(requested);
  if (canonical !== requested)
    throw new TypeError(
      `Step-44 closure rejects path aliases, case drift, links, or reparses: ${requested} != ${canonical}.`,
    );
  requireNoLinkedPathComponents(repositoryRoot, canonical);
  const before = identity(canonical);
  if (before.size < 1n || before.size > BigInt(MAXIMUM_CLOSURE_FILE_BYTES))
    throw new RangeError(
      `Step-44 closure file must contain 1..${MAXIMUM_CLOSURE_FILE_BYTES} bytes: ${canonical}.`,
    );
  const bytes = readFileSync(canonical);
  const after = identity(canonical);
  if (
    !sameIdentity(before, after) ||
    realpathSync.native(canonical) !== canonical ||
    BigInt(bytes.byteLength) !== after.size
  )
    throw new TypeError(
      `Step-44 closure file identity changed while it was snapshotted: ${canonical}.`,
    );
  const text = input.kind === "external-immutable-binary" ? "" : decodeUtf8(bytes, canonical);
  if (input.kind !== "external-immutable-binary" && text.includes("\0"))
    throw new TypeError(`Step-44 closure file contains NUL bytes: ${canonical}.`);
  return {
    file: canonical,
    repositoryPath: relative(repositoryRoot, canonical).replaceAll("\\", "/"),
    kind: input.kind,
    bytes,
    text,
    digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    identity: after,
  };
}

export function sameStep44ClosureFileIdentity(
  left: Step44ClosureFileIdentity,
  right: Step44ClosureFileIdentity,
): boolean {
  return sameIdentity(left, right);
}
