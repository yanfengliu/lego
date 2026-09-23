import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

/**
 * Runs `tar` in the one form every tar this repository meets can read.
 *
 * Both traps below are hit on Windows under Git Bash, where Git for Windows puts
 * its GNU tar ahead of the tar Windows ships:
 *
 * - GNU tar reads an archive name with a colon before its first slash as
 *   `host:path` and tries to reach host `C` over rsh, so `tar -xf C:\...\x.tar`
 *   fails with "Cannot connect to C: resolve failed". The archive is therefore
 *   always named relative to a working directory set to its own folder.
 * - GNU tar cannot read a zip at all ("This does not look like a tar archive").
 *   The tar Windows ships (bsdtar, libarchive) reads zip and tar alike, so on
 *   Windows it is run by its absolute System32 path rather than by whichever
 *   `tar` a PATH lookup happens to find first.
 */
export function tarExecutable() {
  if (process.platform !== "win32") return "tar";
  const systemRoot = process.env.SystemRoot ?? process.env.windir;
  if (systemRoot !== undefined) {
    const bundled = join(systemRoot, "System32", "tar.exe");
    if (existsSync(bundled)) return bundled;
  }
  return "tar";
}

function runTar(executable, args, cwd, maxBuffer) {
  const result = spawnSync(executable, args, { cwd, maxBuffer, windowsHide: true });
  if (result.error !== undefined || result.status !== 0) {
    const stderr = result.stderr?.toString("utf8").trim() ?? "";
    const cause = result.error?.message ?? `exit ${String(result.status)}`;
    throw new Error(
      `${executable} ${args.join(" ")} (run in ${cwd}) failed with ${cause}` +
        `${stderr === "" ? "" : `:\n${stderr}`}\n` +
        `Check that the archive exists, is a tar or zip this tar can read, and contains the named member.`,
    );
  }
  return result.stdout;
}

/** Extracts every member of `archivePath` beneath `destination`, which must already exist. */
export function extractTarArchive(archivePath, destination, options = {}) {
  const archive = resolve(archivePath);
  const cwd = dirname(archive);
  const target = relative(cwd, resolve(destination)) || ".";
  runTar(
    options.executable ?? tarExecutable(),
    ["-xf", basename(archive), "-C", target],
    cwd,
    options.maxBuffer ?? 1024 * 1024,
  );
}

/** Returns the bytes of one member of a tar or zip archive without writing it anywhere. */
export function readArchiveMember(archivePath, memberPath, options = {}) {
  const archive = resolve(archivePath);
  return runTar(
    options.executable ?? tarExecutable(),
    ["-xOf", basename(archive), memberPath],
    dirname(archive),
    options.maxBuffer ?? 2 * 1024 * 1024,
  );
}
