import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { lstatSync, realpathSync } from "node:fs";
import { join, parse } from "node:path";
import { createInterface } from "node:readline";

import { REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_HELPER } from "./real-build-prefix50-step44-calibration-directory-helper.ts";

const HELPER_TIMEOUT_MS = 15_000;
const MAXIMUM_HELPER_ERROR_BYTES = 16_384;

export interface RealBuildPrefix50Step44CalibrationDirectoryHelperSession {
  readonly child: ChildProcess;
  readonly lines: AsyncIterator<string>;
  readonly stderr: () => string;
  readonly spawnError: Promise<Error>;
}

function powershellPath(): string {
  const drive = parse(process.execPath).root;
  const path = join(drive, "Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const stat = lstatSync(path);
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    realpathSync.native(path).toLocaleLowerCase("en-US") !== path.toLocaleLowerCase("en-US")
  )
    throw new TypeError(`Calibration publication requires system PowerShell at ${path}.`);
  return path;
}

function collectStderr(child: ChildProcess): () => string {
  let stderr = "";
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-MAXIMUM_HELPER_ERROR_BYTES);
  });
  return () => stderr.trim();
}

function startHelper(spec: string, temporaryRoot: string, executable: string) {
  const systemRoot = join(parse(executable).root, "Windows");
  const child = spawn(
    executable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& ([ScriptBlock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:LEGO_CALIBRATION_DIRECTORY_HELPER))))",
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        SystemRoot: systemRoot,
        WINDIR: systemRoot,
        TEMP: temporaryRoot,
        TMP: temporaryRoot,
        PSModulePath: join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules"),
        LEGO_CALIBRATION_DIRECTORY_HELPER: Buffer.from(
          REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_HELPER,
          "utf8",
        ).toString("base64"),
        LEGO_CALIBRATION_DIRECTORY_SPEC: spec,
      },
    },
  );
  let captureSpawnError!: (error: Error) => void;
  const spawnError = new Promise<Error>((resolveError) => {
    captureSpawnError = resolveError;
  });
  child.once("error", captureSpawnError);
  child.stdin!.on("error", () => undefined);
  return {
    child,
    lines: createInterface({ input: child.stdout! })[Symbol.asyncIterator](),
    stderr: collectStderr(child),
    spawnError,
  } satisfies RealBuildPrefix50Step44CalibrationDirectoryHelperSession;
}

export function startRealBuildPrefix50Step44CalibrationDirectoryHelper(
  spec: string,
  temporaryRoot: string,
) {
  return startHelper(spec, temporaryRoot, powershellPath());
}

function rejectSpawnError(
  session: RealBuildPrefix50Step44CalibrationDirectoryHelperSession,
): Promise<never> {
  return session.spawnError.then((error) => {
    throw new Error("Calibration directory helper could not start system PowerShell.", {
      cause: error,
    });
  });
}

export async function nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(
  session: RealBuildPrefix50Step44CalibrationDirectoryHelperSession,
): Promise<string> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      session.lines.next(),
      rejectSpawnError(session),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Calibration directory helper timed out.")),
          HELPER_TIMEOUT_MS,
        );
        timer.unref();
      }),
    ]);
    if (result.done)
      throw new Error(`Calibration directory helper exited early: ${session.stderr()}.`);
    return result.value;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(
  session: RealBuildPrefix50Step44CalibrationDirectoryHelperSession,
): Promise<void> {
  if (session.child.exitCode === null && session.child.signalCode === null)
    await Promise.race([once(session.child, "exit"), rejectSpawnError(session)]);
  if (session.child.exitCode !== 0)
    throw new Error(
      `Calibration directory helper exited with ${String(session.child.exitCode)}: ${session.stderr()}.`,
    );
}

export async function stopRealBuildPrefix50Step44CalibrationDirectoryHelper(
  session: RealBuildPrefix50Step44CalibrationDirectoryHelperSession,
): Promise<void> {
  const child = session.child;
  if (child.pid === undefined) await rejectSpawnError(session);
  child.kill();
  if (child.exitCode === null && child.signalCode === null)
    await Promise.race([once(child, "exit"), rejectSpawnError(session)]);
}

export const realBuildPrefix50Step44CalibrationDirectoryProcessTestOnly =
  import.meta.env?.MODE === "test"
    ? Object.freeze({
        startWithMissingExecutable(spec: string, temporaryRoot: string) {
          return startHelper(spec, temporaryRoot, join(temporaryRoot, ".missing-helper.exe"));
        },
      })
    : undefined;
