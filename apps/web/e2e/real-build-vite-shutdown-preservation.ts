import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX } from "./real-build-bootstrap-source.ts";

export const REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY =
  "LEGO_REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED" as const;
export const REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER =
  "vite-shutdown-unconfirmed.marker" as const;
const MARKER_BYTES = Buffer.from("lego.real-build-vite-shutdown-unconfirmed/1\n");

const samePath = (left: string, right: string): boolean =>
  process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;

function exactBootstrapDirectory(value: string | undefined): string {
  if (value === undefined || value.length === 0 || !isAbsolute(value)) {
    throw new TypeError(
      `Unconfirmed Vite shutdown evidence requires an absolute LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY; received ${JSON.stringify(value ?? null)}.`,
    );
  }
  const directory = resolve(value);
  const canonicalTemporaryRoot = realpathSync.native(resolve(tmpdir()));
  const stat = lstatSync(directory);
  const canonicalDirectory = realpathSync.native(directory);
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    !samePath(directory, canonicalDirectory) ||
    !samePath(dirname(canonicalDirectory), canonicalTemporaryRoot) ||
    !basename(canonicalDirectory).startsWith(REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX)
  ) {
    throw new TypeError(
      `Unconfirmed Vite shutdown evidence requires an ordinary canonical ${REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX}* directory created directly inside ${canonicalTemporaryRoot}; received ${directory}.`,
    );
  }
  return canonicalDirectory;
}

function markerInspection(
  directory: string,
):
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "valid" }>
  | Readonly<{ status: "malformed"; reason: string }> {
  const marker = join(directory, REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER);
  let descriptor: number | null = null;
  try {
    const beforePath = lstatSync(marker);
    const canonicalMarker = realpathSync.native(marker);
    if (
      beforePath.isSymbolicLink() ||
      !beforePath.isFile() ||
      !samePath(canonicalMarker, marker) ||
      beforePath.size !== MARKER_BYTES.length
    ) {
      return { status: "malformed", reason: `marker ${marker} is not the fixed ordinary file` };
    }
    descriptor = openSync(marker, "r");
    const before = fstatSync(descriptor);
    if (
      before.dev !== beforePath.dev ||
      before.ino !== beforePath.ino ||
      before.size !== MARKER_BYTES.length
    ) {
      return { status: "malformed", reason: `marker ${marker} changed before its bounded read` };
    }
    const bytes = Buffer.alloc(MARKER_BYTES.length);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fstatSync(descriptor);
    const afterPath = lstatSync(marker);
    if (
      offset !== MARKER_BYTES.length ||
      !bytes.equals(MARKER_BYTES) ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      after.dev !== afterPath.dev ||
      after.ino !== afterPath.ino ||
      after.size !== afterPath.size
    ) {
      return { status: "malformed", reason: `marker ${marker} changed during its bounded read` };
    }
    return { status: "valid" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return code === "ENOENT"
      ? { status: "absent" }
      : {
          status: "malformed",
          reason: `marker ${marker} could not be inspected (${code ?? "unknown"})`,
        };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export interface RealBuildViteShutdownPreservationDecision {
  readonly preserve: boolean;
  readonly reason: string | null;
}

/** Synchronous because `playwright.config.ts` also calls it from `process.on('exit')`. */
export function realBuildViteShutdownPreservationDecision(input: {
  readonly directory: string;
  readonly environment?: NodeJS.ProcessEnv;
}): RealBuildViteShutdownPreservationDecision {
  const environment = input.environment ?? process.env;
  try {
    const directory = exactBootstrapDirectory(input.directory);
    const signal = environment[REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY];
    const marker = markerInspection(directory);
    if (marker.status === "malformed") return { preserve: true, reason: marker.reason };
    if (signal !== undefined && signal !== "1") {
      return {
        preserve: true,
        reason: `${REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY} is malformed (${JSON.stringify(signal)})`,
      };
    }
    if (marker.status === "valid" || signal === "1") {
      return {
        preserve: true,
        reason:
          marker.status === "valid" && signal === "1"
            ? "the fixed environment signal and marker report an unconfirmed Vite shutdown"
            : "the unconfirmed Vite shutdown signal is incomplete",
      };
    }
    return { preserve: false, reason: null };
  } catch (error) {
    return {
      preserve: true,
      reason: `the bootstrap shutdown boundary could not be validated: ${String(error)}`,
    };
  }
}

/** Publishes without replacement; any pre-existing signal or marker remains counterevidence. */
export function publishRealBuildViteShutdownUnconfirmed(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.LEGO_REAL_BUILD_REQUIRED !== "1") return false;
  const directory = exactBootstrapDirectory(environment.LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY);
  const before = realBuildViteShutdownPreservationDecision({ directory, environment });
  if (before.preserve) {
    throw new Error(`Refusing to replace existing Vite shutdown evidence: ${before.reason}.`);
  }
  const marker = join(directory, REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER);
  environment[REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY] = "1";
  try {
    writeFileSync(marker, MARKER_BYTES, { flag: "wx" });
  } catch (error) {
    throw new Error(`Could not publish fixed unconfirmed Vite shutdown marker ${marker}.`, {
      cause: error,
    });
  }
  const after = markerInspection(directory);
  if (after.status !== "valid") {
    throw new Error(
      `Published unconfirmed Vite shutdown marker ${marker} did not remain an exact ordinary file: ${after.status === "malformed" ? after.reason : "it disappeared"}.`,
    );
  }
  return true;
}
