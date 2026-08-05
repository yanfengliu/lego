import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { parseFatalUtf8Json } from "./strict-json";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";

export const REAL_BUILD_BOOTSTRAP_SOURCE_SCHEMA = "lego.real-build-bootstrap-source/1" as const;
export const REAL_BUILD_BOOTSTRAP_TRUST_BOUNDARY =
  "node-executable-and-playwright-config-loader" as const;
export const REAL_BUILD_SOURCE_ROOT_POLICY_PATH =
  "apps/web/e2e/real-build-source-roots.json" as const;
/** The fixed pre-discovery layout `playwright.config.ts` writes into its task-owned directory. */
export const REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX = "lego-real-build-bootstrap-" as const;
export const REAL_BUILD_BOOTSTRAP_MANIFEST_FILE = "bootstrap-source.json" as const;
export const REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE = "source-lock.json" as const;
export const REAL_BUILD_BOOTSTRAP_READY_FILE = "ready.txt" as const;
export const REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA = "lego.real-build-source-lock/1" as const;
const REAL_BUILD_CONFIG_MODULE_PATH = "playwright.config.ts";
const REAL_BUILD_BOOTSTRAP_MODULE_PATH = "apps/web/e2e/real-build-bootstrap-source.ts";
/** Repository files whose exact manifest bytes identify the checkout a lock covers. */
export const REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS = [
  REAL_BUILD_CONFIG_MODULE_PATH,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
  REAL_BUILD_BOOTSTRAP_MODULE_PATH,
] as const;
const MAXIMUM_BOOTSTRAP_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_BOOTSTRAP_LOCK_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAXIMUM_BOOTSTRAP_READY_BYTES = 4 * 1024;
const MAXIMUM_ROOT_ANCHOR_BYTES = 4 * 1024 * 1024;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_LOCKED_PATH_PATTERN = /^[A-Za-z0-9._@/-]+$/u;

const digest = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const samePath = (left: string, right: string): boolean =>
  process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;

const errorCode = (error: unknown): string => {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" ? code : "unknown";
};

export interface RealBuildBootstrapSourceManifest {
  readonly schemaVersion: typeof REAL_BUILD_BOOTSTRAP_SOURCE_SCHEMA;
  readonly trustedBootstrapBoundary: typeof REAL_BUILD_BOOTSTRAP_TRUST_BOUNDARY;
  readonly sourceRootsPolicyDigest: string;
  readonly files: readonly RealBuildSourceSnapshot[];
  readonly manifestDigest: string;
}

export function createRealBuildBootstrapSourceManifest(input: {
  readonly files: readonly RealBuildSourceSnapshot[];
  readonly sourceRootsPolicyDigest: string;
}): RealBuildBootstrapSourceManifest {
  const files = input.files.slice().sort((left, right) => left.path.localeCompare(right.path));
  if (
    !DIGEST_PATTERN.test(input.sourceRootsPolicyDigest) ||
    files.length === 0 ||
    new Set(files.map(({ path }) => path)).size !== files.length ||
    files.some(
      ({ path, digest: fileDigest, bytes }) =>
        path.length === 0 ||
        !DIGEST_PATTERN.test(fileDigest) ||
        !Number.isSafeInteger(bytes) ||
        bytes < 0,
    )
  ) {
    throw new TypeError("Bootstrap source manifest inputs are malformed or duplicated.");
  }
  const policy = files.find(({ path }) => path === REAL_BUILD_SOURCE_ROOT_POLICY_PATH);
  if (policy?.digest !== input.sourceRootsPolicyDigest) {
    throw new TypeError(
      "Bootstrap source manifest must bind the exact retained source-root policy bytes.",
    );
  }
  const base = {
    schemaVersion: REAL_BUILD_BOOTSTRAP_SOURCE_SCHEMA,
    trustedBootstrapBoundary: REAL_BUILD_BOOTSTRAP_TRUST_BOUNDARY,
    sourceRootsPolicyDigest: input.sourceRootsPolicyDigest,
    files,
  };
  return { ...base, manifestDigest: digest(JSON.stringify(base)) };
}

export function parseRealBuildBootstrapSourceManifest(
  bytes: Uint8Array,
): RealBuildBootstrapSourceManifest {
  if (bytes.byteLength > MAXIMUM_BOOTSTRAP_MANIFEST_BYTES) {
    throw new TypeError(
      `Bootstrap source manifest has ${bytes.byteLength} bytes; maximum is ${MAXIMUM_BOOTSTRAP_MANIFEST_BYTES}.`,
    );
  }
  const parsed = parseFatalUtf8Json<RealBuildBootstrapSourceManifest>(
    bytes,
    "bootstrap source manifest",
  );
  if (
    parsed.schemaVersion !== REAL_BUILD_BOOTSTRAP_SOURCE_SCHEMA ||
    parsed.trustedBootstrapBoundary !== REAL_BUILD_BOOTSTRAP_TRUST_BOUNDARY ||
    !Array.isArray(parsed.files) ||
    !DIGEST_PATTERN.test(parsed.manifestDigest)
  ) {
    throw new TypeError("Bootstrap source manifest schema is invalid.");
  }
  const reproduced = createRealBuildBootstrapSourceManifest({
    files: parsed.files,
    sourceRootsPolicyDigest: parsed.sourceRootsPolicyDigest,
  });
  if (JSON.stringify(reproduced) !== JSON.stringify(parsed)) {
    throw new TypeError("Bootstrap source manifest does not reproduce its exact digest and order.");
  }
  return parsed;
}

/** @internal Test-only seam. Production callers leave it absent and read `process.env`. */
export interface RealBuildBootstrapEnvironmentOptions {
  readonly environment?: NodeJS.ProcessEnv;
}

/** Validates the task-owned temporary directory `playwright.config.ts` created for this run. */
function requiredBootstrapDirectory(environment: NodeJS.ProcessEnv): string {
  const value = environment.LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY;
  if (value === undefined || value.length === 0 || !isAbsolute(value)) {
    throw new TypeError(
      `LEGO_REAL_BUILD_REQUIRED=1 requires LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY to be the absolute task-owned temporary directory playwright.config.ts creates for the pre-discovery source lock; received ${JSON.stringify(value ?? null)}. Nothing here is resolved against the working directory.`,
    );
  }
  const directory = resolve(value);
  const temporaryRoot = resolve(tmpdir());
  if (
    !samePath(dirname(directory), temporaryRoot) ||
    !basename(directory).startsWith(REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX)
  ) {
    throw new TypeError(
      `Pre-discovery bootstrap directory must be a ${REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX}* directory created directly inside ${temporaryRoot}; received ${directory}. Run the real build through playwright.config.ts instead of pointing LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY somewhere else.`,
    );
  }
  let stat;
  try {
    stat = lstatSync(directory);
  } catch (error) {
    throw new TypeError(
      `Pre-discovery bootstrap directory ${directory} could not be inspected (${errorCode(error)}); the pre-discovery lock evidence for this run is unreachable.`,
      { cause: error },
    );
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new TypeError(
      `Pre-discovery bootstrap directory ${directory} must be an ordinary directory, not a symlink, junction, or file.`,
    );
  }
  return directory;
}

/** Refuses any bootstrap control path that does not live inside the run's own directory. */
function containedBootstrapName(directory: string, value: string, label: string): string {
  if (!isAbsolute(value)) {
    throw new TypeError(
      `${label} must be an absolute path published by playwright.config.ts; received ${JSON.stringify(value)}, which would resolve against the working directory.`,
    );
  }
  const target = resolve(value);
  const name = relative(directory, target).replaceAll("\\", "/");
  if (name.length === 0 || name === ".." || name.startsWith("../") || isAbsolute(name)) {
    throw new TypeError(
      `${label} must live inside the pre-discovery bootstrap directory ${directory}; received ${target}.`,
    );
  }
  return name;
}

/**
 * Reads the pre-discovery manifest as a contained, bounded, ordinary file.
 *
 * The byte bound is enforced from the descriptor's own size before a single
 * byte is read, so an oversized or growing file in the temporary directory is
 * refused instead of being made resident and rejected afterwards.
 */
export function readRequiredRealBuildBootstrapSourceManifest(
  options: RealBuildBootstrapEnvironmentOptions = {},
): RealBuildBootstrapSourceManifest {
  const environment = options.environment ?? process.env;
  const directory = requiredBootstrapDirectory(environment);
  const manifestPath = environment.LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST;
  const expectedDigest = environment.LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST;
  if (manifestPath === undefined || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new TypeError(
      `LEGO_REAL_BUILD_REQUIRED=1 requires the pre-discovery source-lock manifest from playwright.config.ts: LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST was ${JSON.stringify(manifestPath ?? null)} and LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST was ${JSON.stringify(expectedDigest ?? null)}, which must be a sha256:<64 hex> digest.`,
    );
  }
  const bytes = readContainedBoundedRegularFile(
    directory,
    containedBootstrapName(directory, manifestPath, "Pre-discovery bootstrap source manifest"),
    {
      label: "pre-discovery bootstrap source manifest",
      maximumBytes: MAXIMUM_BOOTSTRAP_MANIFEST_BYTES,
    },
  );
  const parsed = parseRealBuildBootstrapSourceManifest(bytes);
  if (parsed.manifestDigest !== expectedDigest) {
    throw new TypeError(
      `Pre-discovery bootstrap source manifest at ${manifestPath} carries digest ${parsed.manifestDigest}; its config-time binding is ${expectedDigest}. The manifest changed after playwright.config.ts published it.`,
    );
  }
  return parsed;
}

type LockObservation = { readonly held: true } | { readonly held: false; readonly reason: string };

/**
 * Opens one path for writing without changing it.
 *
 * A Windows sharing violation is the only observation that proves another
 * process holds a no-write handle: libuv maps ERROR_SHARING_VIOLATION and
 * ERROR_LOCK_VIOLATION to `UV_EBUSY`, and ERROR_ACCESS_DENIED to `UV_EPERM`
 * (libuv `src/win/error.c`). A missing file, a read-only attribute, a denied
 * ACL, or any other failure is "could not determine" and must never be read as
 * "the lock is held".
 */
function observeNoWriteHandle(path: string, label: string): LockObservation {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, "r+");
  } catch (error) {
    const code = errorCode(error);
    if (code === "EBUSY") return { held: true };
    return {
      held: false,
      reason: `${label} at ${path} could not be probed for a no-write handle: ${code}. Only a Windows sharing violation (EBUSY) proves the pre-discovery lock is held; ${code} leaves it undetermined, so this run fails closed.`,
    };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
  return {
    held: false,
    reason: `${label} at ${path} opened for writing, so no process is holding the pre-discovery no-write handle on it.`,
  };
}

/**
 * Derives the repository root from this module's own location, never `process.cwd()`.
 *
 * `playwright.config.ts` computes the same canonical root from its own module
 * URL before it captures the manifest, so a run started from anywhere resolves
 * the checkout the manifest actually describes.
 */
function configModuleRepoRoot(): string {
  const moduleFile = resolve(fileURLToPath(import.meta.url));
  const repoRoot = resolve(dirname(moduleFile), "..", "..", "..");
  if (!samePath(join(repoRoot, REAL_BUILD_BOOTSTRAP_MODULE_PATH), moduleFile)) {
    throw new TypeError(
      `Pre-discovery bootstrap module must load from ${REAL_BUILD_BOOTSTRAP_MODULE_PATH} inside its checkout; it loaded from ${moduleFile}, so the repository root cannot be derived from it.`,
    );
  }
  const configPath = join(repoRoot, REAL_BUILD_CONFIG_MODULE_PATH);
  let stat;
  try {
    stat = lstatSync(configPath);
  } catch (error) {
    throw new TypeError(
      `Real-build repository root ${repoRoot} has no readable ${REAL_BUILD_CONFIG_MODULE_PATH} (${errorCode(error)}); the pre-discovery lock cannot be bound to a checkout.`,
      { cause: error },
    );
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    !samePath(realpathSync.native(configPath), configPath)
  ) {
    throw new TypeError(
      `Real-build ${REAL_BUILD_CONFIG_MODULE_PATH} at ${configPath} is not an ordinary canonical file; refuse to treat its directory as the locked repository root.`,
    );
  }
  return repoRoot;
}

/** Proves the root holds the exact anchor bytes the manifest recorded for this run. */
function manifestBoundRepoRoot(
  manifest: RealBuildBootstrapSourceManifest,
  claimedRoot: string | undefined,
): string {
  if (claimedRoot !== undefined && !isAbsolute(claimedRoot)) {
    throw new TypeError(
      `Claimed real-build repository root must be absolute; received ${JSON.stringify(claimedRoot)}, which would resolve against the working directory.`,
    );
  }
  const repoRoot = claimedRoot === undefined ? configModuleRepoRoot() : resolve(claimedRoot);
  for (const anchor of REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS) {
    const entry = manifest.files.find(({ path }) => path === anchor);
    if (entry === undefined) {
      throw new TypeError(
        `Pre-discovery bootstrap manifest records no ${anchor}, so it cannot identify the repository root its ${manifest.files.length}-file set belongs to. Recapture the manifest from playwright.config.ts.`,
      );
    }
    const bytes = readContainedBoundedRegularFile(repoRoot, anchor, {
      label: `pre-discovery repository-root anchor ${anchor}`,
      maximumBytes: MAXIMUM_ROOT_ANCHOR_BYTES,
      exactBytes: entry.bytes,
    });
    const observed = digest(bytes);
    if (observed !== entry.digest) {
      throw new Error(
        `Pre-discovery repository-root anchor ${anchor} under ${repoRoot} hashes to ${observed}; the manifest binds ${entry.digest}. Point the source-lock check at the checkout playwright.config.ts captured.`,
      );
    }
  }
  return repoRoot;
}

/** Refuses to treat a released or releasing lock as held. */
function assertReleaseNotRequested(directory: string, environment: NodeJS.ProcessEnv): void {
  const releaseValue = environment.LEGO_REAL_BUILD_BOOTSTRAP_RELEASE;
  if (releaseValue === undefined || releaseValue.length === 0) {
    throw new TypeError(
      "LEGO_REAL_BUILD_REQUIRED=1 requires LEGO_REAL_BUILD_BOOTSTRAP_RELEASE, the release path playwright.config.ts exports with the lock; it was empty or unset.",
    );
  }
  const releasePath = join(
    directory,
    containedBootstrapName(directory, releaseValue, "Pre-discovery bootstrap release path"),
  );
  try {
    lstatSync(releasePath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw new Error(
      `Pre-discovery bootstrap release path ${releasePath} could not be inspected (${errorCode(error)}); the lock state for this run is undetermined.`,
      { cause: error },
    );
  }
  throw new Error(
    `Pre-discovery real-build source lock was already asked to release at ${releasePath}; its no-write handles are being dropped, so the immutable-source guarantee no longer covers this run.`,
  );
}

export interface RealBuildBootstrapSourceLockEvidence {
  readonly repoRoot: string;
  readonly directory: string;
  readonly helperPid: number;
  readonly lockManifestDigest: string;
  readonly lockedFiles: number;
  readonly lockedBytes: number;
}

export interface RealBuildBootstrapSourceLockOptions extends RealBuildBootstrapEnvironmentOptions {
  /**
   * @internal Test-only seam. The claimed root is verified against the
   * manifest's anchor bytes, never trusted; production callers omit it so the
   * root comes from the config module's own location.
   */
  readonly repoRoot?: string;
}

/**
 * Proves the pre-discovery lock still covers the exact manifest-bound file set.
 *
 * A live PID proves only that some process exists, so it is necessary and never
 * sufficient. The evidence that decides the run is the helper's published READY
 * attestation over this manifest's reconstructed lock manifest, its still-held
 * handle on this run's unique lock manifest, and an observed sharing violation
 * on every file the manifest lists under the config-bound repository root. Any
 * probe that cannot make that observation fails closed. Nothing here speaks to
 * the instruction PDF, the checkout's provenance, or what the run renders.
 */
export function assertRealBuildBootstrapSourceLockHeld(
  options: RealBuildBootstrapSourceLockOptions = {},
): RealBuildBootstrapSourceLockEvidence {
  const environment = options.environment ?? process.env;
  const directory = requiredBootstrapDirectory(environment);
  const manifest = readRequiredRealBuildBootstrapSourceManifest({ environment });
  const helperPid = Number(environment.LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID);
  if (!Number.isSafeInteger(helperPid) || helperPid <= 0) {
    throw new TypeError(
      `Pre-discovery real-build source-lock PID must be a positive integer from playwright.config.ts; received ${JSON.stringify(environment.LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID ?? null)}.`,
    );
  }
  try {
    process.kill(helperPid, 0);
  } catch (error) {
    throw new Error(
      `Pre-discovery real-build source-lock process ${helperPid} is no longer running (${errorCode(error)}); its no-write handles are gone.`,
      { cause: error },
    );
  }
  assertReleaseNotRequested(directory, environment);

  const lockManifestBytes = Buffer.from(
    `${JSON.stringify({ schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA, files: manifest.files })}\n`,
  );
  const observedLockManifest = readContainedBoundedRegularFile(
    directory,
    REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE,
    {
      label: "pre-discovery source-lock manifest",
      maximumBytes: MAXIMUM_BOOTSTRAP_LOCK_MANIFEST_BYTES,
      exactBytes: lockManifestBytes.length,
    },
  );
  if (!observedLockManifest.equals(lockManifestBytes)) {
    throw new Error(
      `Pre-discovery source-lock manifest in ${directory} is not the file set the bootstrap manifest binds; the helper locked different bytes than this run verifies.`,
    );
  }
  const lockManifestDigest = digest(lockManifestBytes);
  const lockedBytes = manifest.files.reduce((total, file) => total + file.bytes, 0);
  const expectedReady = `READY ${lockManifestDigest} ${manifest.files.length} ${lockedBytes}\n`;
  const observedReady = readContainedBoundedRegularFile(
    directory,
    REAL_BUILD_BOOTSTRAP_READY_FILE,
    {
      label: "pre-discovery source-lock readiness attestation",
      maximumBytes: MAXIMUM_BOOTSTRAP_READY_BYTES,
      exactBytes: Buffer.byteLength(expectedReady),
    },
  ).toString("utf8");
  if (observedReady !== expectedReady) {
    throw new Error(
      `Pre-discovery source-lock readiness in ${directory} is ${JSON.stringify(observedReady)}; this run's manifest requires ${JSON.stringify(expectedReady)}. The helper never attested to this exact file set.`,
    );
  }
  const helperHandle = observeNoWriteHandle(
    join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE),
    "Pre-discovery source-lock manifest",
  );
  if (!helperHandle.held) {
    throw new Error(
      `${helperHandle.reason} The helper this run spawned holds that handle for as long as it holds the source locks, so its READY attestation is stale and PID ${helperPid} is not the helper.`,
    );
  }

  const repoRoot = manifestBoundRepoRoot(manifest, options.repoRoot);
  for (const file of manifest.files) {
    if (
      !SAFE_LOCKED_PATH_PATTERN.test(file.path) ||
      file.path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      throw new TypeError(
        `Pre-discovery bootstrap manifest entry ${JSON.stringify(file.path)} is not a strict relative repository path; recapture the manifest instead of probing it.`,
      );
    }
    const absolute = join(repoRoot, file.path);
    let stat;
    try {
      stat = lstatSync(absolute, { bigint: true });
    } catch (error) {
      throw new Error(
        `Locked real-build source ${file.path} could not be inspected under ${repoRoot} (${errorCode(error)}); the pre-discovery lock cannot be shown to cover it.`,
        { cause: error },
      );
    }
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size !== BigInt(file.bytes)) {
      throw new Error(
        `Locked real-build source ${file.path} under ${repoRoot} is not the ordinary ${file.bytes}-byte file the manifest records; restore the captured checkout before trusting the lock.`,
      );
    }
    const observation = observeNoWriteHandle(absolute, `Locked real-build source ${file.path}`);
    if (!observation.held) {
      throw new Error(
        `${observation.reason} The pre-discovery lock must cover every one of the manifest's ${manifest.files.length} files; a handle on ${REAL_BUILD_CONFIG_MODULE_PATH} alone proves nothing about the rest of the executed source.`,
      );
    }
  }
  return {
    repoRoot,
    directory,
    helperPid,
    lockManifestDigest,
    lockedFiles: manifest.files.length,
    lockedBytes,
  };
}
