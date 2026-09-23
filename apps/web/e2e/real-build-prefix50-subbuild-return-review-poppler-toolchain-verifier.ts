import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  REAL_BUILD_PREFIX50_STEP44_POPPLER_DIRECTORIES,
  REAL_BUILD_PREFIX50_STEP44_POPPLER_LOADER_ENVIRONMENT,
  REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_FILES,
  REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT,
  REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_POPPLER_VERSION,
  realBuildPrefix50Step44PopplerToolchainBodyJson,
  realBuildPrefix50Step44PopplerToolchainCommitment,
  type RealBuildPrefix50Step44PopplerToolFile,
} from "./real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";

export interface RealBuildPrefix50Step44PopplerToolchainConfiguration {
  readonly root: string;
  readonly version: string;
  readonly directories: readonly string[];
  readonly files: readonly RealBuildPrefix50Step44PopplerToolFile[];
  readonly loaderEnvironment: Readonly<Record<string, string>>;
  readonly bodyJson: string;
  readonly commitment: `sha256:${string}`;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedNanoseconds: bigint;
  readonly changedNanoseconds: bigint;
  readonly links: bigint;
}

export interface VerifiedRealBuildPrefix50Step44PopplerToolchain {
  readonly root: string;
  readonly executablePath: string;
  readonly version: string;
  readonly loaderEnvironment: Readonly<Record<string, string>>;
  readonly bodyJson: string;
  readonly commitment: `sha256:${string}`;
}

function sha256(bytes: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function relativeName(root: string, path: string): string {
  const name = relative(root, path).replaceAll("\\", "/");
  if (name.length === 0 || name.startsWith("../") || name.includes("\0"))
    throw new TypeError("Step-44 reviewed Poppler tree contained an escaped entry.");
  return name;
}

function listTree(root: string): Readonly<{ directories: string[]; files: string[] }> {
  const directories: string[] = [];
  const files: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const parent = pending.pop()!;
    for (const name of readdirSync(parent).sort()) {
      const path = join(parent, name);
      const stats = lstatSync(path, { bigint: true });
      if (stats.isSymbolicLink())
        throw new TypeError("Step-44 reviewed Poppler tree may not contain symbolic links.");
      if (stats.isDirectory()) {
        directories.push(relativeName(root, path));
        pending.push(path);
      } else if (stats.isFile()) files.push(relativeName(root, path));
      else
        throw new TypeError(
          "Step-44 reviewed Poppler tree may contain only files and directories.",
        );
    }
  }
  return { directories: directories.sort(), files: files.sort() };
}

function requireExactNames(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((name, index) => name !== sortedExpected[index])
  )
    throw new TypeError(`Step-44 reviewed Poppler ${label} drifted from its exact roster.`);
}

function identity(stats: BigIntStats): FileIdentity {
  return {
    device: stats.dev,
    inode: stats.ino,
    size: stats.size,
    modifiedNanoseconds: stats.mtimeNs,
    changedNanoseconds: stats.ctimeNs,
    links: stats.nlink,
  };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.modifiedNanoseconds === right.modifiedNanoseconds &&
    left.changedNanoseconds === right.changedNanoseconds &&
    left.links === right.links
  );
}

function requireFile(
  root: string,
  file: RealBuildPrefix50Step44PopplerToolFile,
  identities: Set<string>,
): void {
  const path = resolve(root, file.relativePath.replaceAll("/", "\\"));
  if (relativeName(root, path) !== file.relativePath || realpathSync.native(path) !== path)
    throw new TypeError("Step-44 reviewed Poppler file escaped or aliased its exact root.");
  const descriptor = openSync(path, constants.O_RDONLY);
  try {
    const beforeStats = fstatSync(descriptor, { bigint: true });
    const before = identity(beforeStats);
    if (!beforeStats.isFile() || before.links !== 1n || before.size !== BigInt(file.bytes))
      throw new TypeError("Step-44 reviewed Poppler file must be one exact single-name file.");
    const identityKey = `${before.device}:${before.inode}`;
    if (identities.has(identityKey))
      throw new TypeError("Step-44 reviewed Poppler roster contained duplicate file identities.");
    identities.add(identityKey);
    const bytes = readFileSync(descriptor);
    const after = identity(fstatSync(descriptor, { bigint: true }));
    if (
      !sameIdentity(before, after) ||
      bytes.byteLength !== file.bytes ||
      sha256(bytes) !== file.digest
    )
      throw new TypeError("Step-44 reviewed Poppler file changed or failed its exact digest pin.");
  } finally {
    closeSync(descriptor);
  }
}

function requireConfiguration(config: RealBuildPrefix50Step44PopplerToolchainConfiguration): void {
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(config.commitment) ||
    sha256(config.bodyJson) !== config.commitment ||
    config.version.length === 0 ||
    config.version.length > 64 ||
    config.directories.length === 0 ||
    config.files.length === 0 ||
    Object.entries(config.loaderEnvironment).some(
      ([name, value]) =>
        !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) ||
        value.length === 0 ||
        value.length > 4_096 ||
        value.includes("\0"),
    )
  )
    throw new TypeError("Step-44 reviewed Poppler toolchain configuration is malformed.");
  const parsed = JSON.parse(config.bodyJson) as unknown;
  if (
    JSON.stringify(parsed) !== config.bodyJson ||
    config.bodyJson !==
      JSON.stringify({
        root: config.root,
        version: config.version,
        directories: config.directories,
        files: config.files,
        loaderEnvironment: config.loaderEnvironment,
      })
  )
    throw new TypeError("Step-44 reviewed Poppler toolchain body is not canonical.");
}

export function reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration(): RealBuildPrefix50Step44PopplerToolchainConfiguration {
  if (
    realBuildPrefix50Step44PopplerToolchainCommitment() !==
    REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT
  )
    throw new TypeError("Step-44 reviewed Poppler toolchain changed without a repin.");
  return Object.freeze({
    root: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT,
    version: REAL_BUILD_PREFIX50_STEP44_POPPLER_VERSION,
    directories: REAL_BUILD_PREFIX50_STEP44_POPPLER_DIRECTORIES,
    files: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_FILES,
    loaderEnvironment: REAL_BUILD_PREFIX50_STEP44_POPPLER_LOADER_ENVIRONMENT,
    bodyJson: realBuildPrefix50Step44PopplerToolchainBodyJson(),
    commitment: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
  });
}

export function verifyRealBuildPrefix50Step44PopplerToolchain(
  config = reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration(),
): VerifiedRealBuildPrefix50Step44PopplerToolchain {
  if (process.platform !== "win32")
    throw new TypeError("Step-44 reviewed Poppler execution is qualified only on Windows.");
  requireConfiguration(config);
  const requestedRoot = resolve(config.root);
  const rootStats = lstatSync(requestedRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink())
    throw new TypeError("Step-44 reviewed Poppler root must be one real directory.");
  const root = realpathSync.native(requestedRoot);
  if (root !== requestedRoot)
    throw new TypeError("Step-44 reviewed Poppler root must already be its canonical realpath.");
  const tree = listTree(root);
  requireExactNames(tree.directories, config.directories, "directory set");
  requireExactNames(
    tree.files,
    config.files.map(({ relativePath }) => relativePath),
    "file set",
  );
  const identities = new Set<string>();
  for (const file of config.files) requireFile(root, file, identities);
  const executablePath = join(root, "bin", "pdftoppm.exe");
  if (!config.files.some(({ relativePath }) => relativePath === "bin/pdftoppm.exe"))
    throw new TypeError("Step-44 reviewed Poppler roster omitted pdftoppm.exe.");
  return Object.freeze({
    root,
    executablePath,
    version: config.version,
    loaderEnvironment: config.loaderEnvironment,
    bodyJson: config.bodyJson,
    commitment: config.commitment,
  });
}

export const __testOnlyRealBuildPrefix50Step44PopplerToolchain = Object.freeze({
  configuration(input: {
    readonly root: string;
    readonly version: string;
    readonly directories: readonly string[];
    readonly files: readonly RealBuildPrefix50Step44PopplerToolFile[];
    readonly loaderEnvironment: Readonly<Record<string, string>>;
  }): RealBuildPrefix50Step44PopplerToolchainConfiguration {
    const body = {
      root: input.root,
      version: input.version,
      directories: input.directories,
      files: input.files,
      loaderEnvironment: input.loaderEnvironment,
    };
    const bodyJson = JSON.stringify(body);
    return Object.freeze({ ...body, bodyJson, commitment: sha256(bodyJson) });
  },
});
