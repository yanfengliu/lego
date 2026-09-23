import { lstatSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";

export const STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY =
  "LEGO_STEP44_TASK_OWNED_VITE_CACHE_DIRECTORY" as const;
export const STEP44_TASK_OWNED_VITE_CACHE_PREFIX = "lego-step44-vite-cache-" as const;

const samePath = (left: string, right: string): boolean =>
  process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;

/** Admits only an already-created, canonical cache owned directly by the OS temporary root. */
export function taskOwnedViteCacheDirectory(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = environment[STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY];
  if (value === undefined) return undefined;
  if (value.length === 0 || !isAbsolute(value)) {
    throw new TypeError(
      `${STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY} must be an absolute task-owned temporary directory; received ${JSON.stringify(value)}.`,
    );
  }
  const directory = resolve(value);
  const canonicalTemporaryRoot = realpathSync.native(resolve(tmpdir()));
  let stat;
  let canonicalDirectory: string;
  try {
    stat = lstatSync(directory);
    canonicalDirectory = realpathSync.native(directory);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code ?? "unknown";
    throw new TypeError(
      `Task-owned Vite cache ${directory} could not be inspected (${code}); create it with the Step-44 browser lifecycle before launching Vite.`,
      { cause: error },
    );
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    !samePath(directory, canonicalDirectory) ||
    !samePath(dirname(canonicalDirectory), canonicalTemporaryRoot) ||
    !basename(canonicalDirectory).startsWith(STEP44_TASK_OWNED_VITE_CACHE_PREFIX)
  ) {
    throw new TypeError(
      `Task-owned Vite cache must be an ordinary canonical ${STEP44_TASK_OWNED_VITE_CACHE_PREFIX}* directory created directly inside ${canonicalTemporaryRoot}; received ${directory}.`,
    );
  }
  return canonicalDirectory;
}

/** Leaves ordinary Vite invocations byte-for-byte on Vite's default cache policy. */
export function taskOwnedViteCacheConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Readonly<{ cacheDir?: string }> {
  const cacheDir = taskOwnedViteCacheDirectory(environment);
  return cacheDir === undefined ? {} : { cacheDir };
}

/** Publishes one validated cache only to the child Vite process that owns it. */
export function environmentWithTaskOwnedViteCache(
  directory: string,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const childEnvironment = {
    ...environment,
    [STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY]: directory,
  };
  const cacheDirectory = taskOwnedViteCacheDirectory(childEnvironment);
  if (cacheDirectory === undefined)
    throw new TypeError("Task-owned Vite cache environment did not publish its cache directory.");
  return {
    ...childEnvironment,
    [STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY]: cacheDirectory,
  };
}
