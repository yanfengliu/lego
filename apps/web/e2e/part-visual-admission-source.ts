import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const MATERIALIZED_SCHEMA = "lego.ldraw-materialized-visual-admission-closure/1";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_LDRAW_PATH = /^(?:parts|p)\/[a-z0-9][a-z0-9._/-]{0,255}$/u;
const MAXIMUM_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_CLOSURE_FILES = 4_096;
const MAXIMUM_CLOSURE_BYTES = 64 * 1024 * 1024;

interface MaterializedArchiveRecord {
  readonly archiveId: string;
  readonly logicalName: string;
  readonly source: string;
  readonly bytes: number;
  readonly sha256: Sha256Digest;
  readonly entryCount: number;
}

interface MaterializedClosureRecord {
  readonly archiveId: string;
  readonly path: string;
  readonly bytes: number;
  readonly sha256: Sha256Digest;
  readonly materializedPath: string;
  readonly fileId: string;
  readonly directReferences: readonly string[];
  readonly title: string;
  readonly declaredName: string;
  readonly author: string;
  readonly ldrawOrg: string;
  readonly licenseExpression: string;
}

export interface VerifiedMaterializedLDrawClosure {
  readonly schemaVersion: typeof MATERIALIZED_SCHEMA;
  readonly archives: readonly MaterializedArchiveRecord[];
  readonly root: {
    readonly archiveId: string;
    readonly path: string;
    readonly fileId: string;
    readonly bytes: number;
    readonly sha256: Sha256Digest;
  };
  readonly closure: readonly MaterializedClosureRecord[];
  readonly closureDigest: Sha256Digest;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly manifestDigest: Sha256Digest;
  readonly manifestPath: string;
  readonly libraryPath: string;
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function sameFile(
  left: ReturnType<typeof fstatSync>,
  right: ReturnType<typeof fstatSync>,
): boolean {
  return (
    left.ino === right.ino &&
    (left.dev === 0 || right.dev === 0 || left.dev === right.dev) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

function exactFile(path: string, maximumBytes: number, label: string): Buffer {
  const beforePath = lstatSync(path);
  if (beforePath.isSymbolicLink() || !beforePath.isFile()) {
    throw new TypeError(`${label} is not an ordinary regular file: ${path}.`);
  }
  if (beforePath.size <= 0 || beforePath.size > maximumBytes) {
    throw new RangeError(
      `${label} is ${beforePath.size} bytes; allowed range is 1..${maximumBytes}: ${path}.`,
    );
  }
  const descriptor = openSync(path, "r");
  try {
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const afterPath = lstatSync(path);
    if (!sameFile(before, after) || !sameFile(after, afterPath)) {
      throw new Error(`${label} changed during its exact read: ${path}.`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireDigest(value: unknown, label: string): asserts value is Sha256Digest {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be lowercase SHA-256; received ${JSON.stringify(value)}.`);
  }
}

function exactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TypeError(
      `${label} keys are ${JSON.stringify(actual)}; expected ${JSON.stringify(wanted)}.`,
    );
  }
}

function walkLibrary(directory: string, root: string, found: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new TypeError(`Materialized LDraw closure contains a link: ${absolute}.`);
    }
    if (entry.isDirectory()) {
      walkLibrary(absolute, root, found);
    } else if (entry.isFile()) {
      found.push(relative(root, absolute).replaceAll("\\", "/"));
    } else {
      throw new TypeError(`Materialized LDraw closure contains a non-file entry: ${absolute}.`);
    }
    if (found.length > MAXIMUM_CLOSURE_FILES) {
      throw new RangeError(
        `Materialized LDraw closure exceeds ${MAXIMUM_CLOSURE_FILES} files at ${absolute}.`,
      );
    }
  }
}

export function readVerifiedMaterializedLDrawClosure(
  manifestPath: string,
): VerifiedMaterializedLDrawClosure {
  const repository = realpathSync.native(process.cwd());
  const absoluteManifest = resolve(manifestPath);
  if (!inside(repository, absoluteManifest)) {
    throw new TypeError(
      `Materialized LDraw closure must stay below repository ${repository}; received ${absoluteManifest}.`,
    );
  }
  const raw = exactFile(absoluteManifest, MAXIMUM_MANIFEST_BYTES, "LDraw closure manifest");
  const parsed = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(raw)) as unknown;
  if (!isRecord(parsed)) throw new TypeError("LDraw closure manifest must be a JSON object.");
  exactObjectKeys(
    parsed,
    [
      "schemaVersion",
      "archives",
      "root",
      "closure",
      "closureDigest",
      "fileCount",
      "totalBytes",
      "manifestDigest",
    ],
    "LDraw closure manifest",
  );
  if (parsed.schemaVersion !== MATERIALIZED_SCHEMA) {
    throw new TypeError(
      `LDraw closure schema is ${JSON.stringify(parsed.schemaVersion)}; expected ${MATERIALIZED_SCHEMA}.`,
    );
  }
  requireDigest(parsed.closureDigest, "LDraw closure digest");
  requireDigest(parsed.manifestDigest, "LDraw closure manifest digest");
  if (!Array.isArray(parsed.archives) || parsed.archives.length !== 2) {
    throw new TypeError("LDraw closure must bind exactly official and unofficial archive records.");
  }
  const archives = parsed.archives as unknown as MaterializedArchiveRecord[];
  for (const archive of archives) {
    if (!isRecord(archive)) throw new TypeError("LDraw archive record must be an object.");
    exactObjectKeys(
      archive,
      ["archiveId", "logicalName", "source", "bytes", "sha256", "entryCount"],
      "LDraw archive record",
    );
    requireDigest(archive.sha256, `LDraw ${String(archive.archiveId)} archive digest`);
    if (
      !["official", "unofficial"].includes(archive.archiveId) ||
      typeof archive.logicalName !== "string" ||
      typeof archive.source !== "string" ||
      !Number.isSafeInteger(archive.bytes) ||
      archive.bytes <= 0 ||
      !Number.isSafeInteger(archive.entryCount) ||
      archive.entryCount <= 0
    ) {
      throw new TypeError(`LDraw archive record is malformed: ${JSON.stringify(archive)}.`);
    }
  }
  if (new Set(archives.map(({ archiveId }) => archiveId)).size !== 2) {
    throw new TypeError(
      "LDraw closure archive ids must be unique official and unofficial records.",
    );
  }
  if (
    !Array.isArray(parsed.closure) ||
    parsed.closure.length === 0 ||
    parsed.closure.length > MAXIMUM_CLOSURE_FILES
  ) {
    throw new RangeError(
      `LDraw closure has ${Array.isArray(parsed.closure) ? parsed.closure.length : "non-array"} files; allowed range is 1..${MAXIMUM_CLOSURE_FILES}.`,
    );
  }
  const closure = parsed.closure as unknown as MaterializedClosureRecord[];
  const materializedPaths = new Set<string>();
  let totalBytes = 0;
  for (const file of closure) {
    if (!isRecord(file)) throw new TypeError("LDraw closure file record must be an object.");
    requireDigest(file.sha256, `LDraw closure ${String(file.fileId)} digest`);
    if (
      !["official", "unofficial"].includes(file.archiveId) ||
      !SAFE_LDRAW_PATH.test(file.path) ||
      file.path.includes("..") ||
      file.fileId !== `${file.archiveId}:${file.path}` ||
      file.materializedPath !== `library/${file.path}` ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !Array.isArray(file.directReferences) ||
      file.directReferences.some((reference) => typeof reference !== "string")
    ) {
      throw new TypeError(`LDraw closure file record is malformed: ${JSON.stringify(file)}.`);
    }
    if (materializedPaths.has(file.materializedPath)) {
      throw new TypeError(`LDraw closure repeats ${file.materializedPath}.`);
    }
    materializedPaths.add(file.materializedPath);
    totalBytes += file.bytes;
    if (totalBytes > MAXIMUM_CLOSURE_BYTES) {
      throw new RangeError(
        `LDraw closure exceeds ${MAXIMUM_CLOSURE_BYTES} bytes at ${file.fileId}.`,
      );
    }
    const bytes = exactFile(
      join(dirname(absoluteManifest), ...file.materializedPath.split("/")),
      Math.min(MAXIMUM_CLOSURE_BYTES, file.bytes),
      `LDraw closure file ${file.fileId}`,
    );
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(
        `LDraw closure file ${file.fileId} is ${bytes.length} bytes/${sha256(bytes)}, not ${file.bytes} bytes/${file.sha256}.`,
      );
    }
  }
  if (
    parsed.fileCount !== closure.length ||
    parsed.totalBytes !== totalBytes ||
    parsed.closureDigest !== canonicalDigest(closure)
  ) {
    throw new Error(
      `LDraw closure summary does not bind ${closure.length} files/${totalBytes} bytes/${canonicalDigest(closure)}.`,
    );
  }
  if (!isRecord(parsed.root)) throw new TypeError("LDraw closure root must be an object.");
  const root = parsed.root as unknown as VerifiedMaterializedLDrawClosure["root"];
  requireDigest(root.sha256, "LDraw closure root digest");
  const rootFile = closure.find(({ fileId }) => fileId === root.fileId);
  if (
    root.fileId !== `${root.archiveId}:${root.path}` ||
    rootFile === undefined ||
    rootFile.bytes !== root.bytes ||
    rootFile.sha256 !== root.sha256
  ) {
    throw new Error(`LDraw closure root is not its exact retained file: ${JSON.stringify(root)}.`);
  }
  const base = { ...parsed };
  delete base.manifestDigest;
  if (parsed.manifestDigest !== canonicalDigest(base)) {
    throw new Error(
      `LDraw closure manifest hashes to ${canonicalDigest(base)}, not ${parsed.manifestDigest}.`,
    );
  }
  const libraryPath = join(dirname(absoluteManifest), "library");
  const found: string[] = [];
  walkLibrary(libraryPath, dirname(absoluteManifest), found);
  const expected = [...materializedPaths].sort();
  found.sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error(
      `Materialized LDraw directory is not the exact closure: expected ${JSON.stringify(expected)}, found ${JSON.stringify(found)}.`,
    );
  }
  return deepFreeze({
    schemaVersion: MATERIALIZED_SCHEMA,
    archives,
    root,
    closure,
    closureDigest: parsed.closureDigest,
    fileCount: closure.length,
    totalBytes,
    manifestDigest: parsed.manifestDigest,
    manifestPath: absoluteManifest,
    libraryPath,
  });
}
