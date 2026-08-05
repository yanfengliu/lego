import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import {
  resolveRealBuildPath,
  type RealBuildSourceMirror,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";

const LOCK_MANIFEST = ".real-build-source-lock.json";
const LOCK_ANCHOR = ".real-build-source-lock-anchor";
const MAXIMUM_LOCK_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAXIMUM_LOCK_STDERR_BYTES = 64 * 1024;
export const REAL_BUILD_SOURCE_LOCK_SCRIPT =
  "scripts/windows-lock-real-build-snapshot.ps1" as const;

const AUTHENTICATED_HELPER_BOOTSTRAP = String.raw`
$ErrorActionPreference = "Stop"
$stream = $null
$reader = $null
$sha = $null
try {
  $scriptPath = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT")
  $expectedDigest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT_DIGEST")
  $expectedBytesText = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT_BYTES")
  if (
    [String]::IsNullOrEmpty($scriptPath) -or
    $expectedDigest -notmatch '^sha256:[0-9a-f]{64}$' -or
    $expectedBytesText -notmatch '^(?:0|[1-9][0-9]*)$'
  ) {
    throw "Authenticated source-lock helper bootstrap inputs are malformed."
  }
  [long]$expectedBytes = [long]::Parse(
    $expectedBytesText,
    [Globalization.CultureInfo]::InvariantCulture
  )
  $stream = [IO.File]::Open(
    $scriptPath,
    [IO.FileMode]::Open,
    [IO.FileAccess]::Read,
    [IO.FileShare]::Read
  )
  if ($stream.Length -ne $expectedBytes) {
    throw "Authenticated source-lock helper length differs from its source snapshot."
  }
  $sha = [Security.Cryptography.SHA256]::Create()
  $observedDigest = "sha256:" + (
    [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant()
  )
  if ($observedDigest -cne $expectedDigest) {
    throw "Authenticated source-lock helper digest differs from its source snapshot."
  }
  $stream.Position = 0
  $strictUtf8 = New-Object Text.UTF8Encoding($false, $true)
  $reader = New-Object IO.StreamReader($stream, $strictUtf8, $false, 65536, $true)
  $source = $reader.ReadToEnd()
  $reader.Dispose()
  $reader = $null
  $scriptBlock = [ScriptBlock]::Create($source)
  $helperArguments = @{
    Root = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_ROOT")
    Manifest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_MANIFEST")
    ExpectedDigest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_MANIFEST_DIGEST")
  }
  & $scriptBlock @helperArguments
  if (-not $?) {
    throw "Authenticated source-lock helper returned failure."
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
} finally {
  if ($null -ne $reader) { $reader.Dispose() }
  if ($null -ne $sha) { $sha.Dispose() }
  if ($null -ne $stream) { $stream.Dispose() }
}
`;

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export interface RealBuildSourceLock {
  assertHeld(): void;
  release(): Promise<void>;
}

function readyLine(child: ChildProcessWithoutNullStreams, expectedLine: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(
      () => reject(new Error("Source snapshot lock did not become ready in 60 seconds.")),
      60_000,
    );
    const finish = (error?: Error): void => {
      clearTimeout(timeout);
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeListener("exit", onExit);
      child.removeListener("error", onError);
      if (error === undefined) resolve();
      else reject(error);
    };
    const onExit = (code: number | null): void =>
      finish(new Error(`Source snapshot lock exited before READY (${String(code)}): ${stderr}`));
    const onError = (error: Error): void =>
      finish(new Error(`Source snapshot lock could not start: ${error.message}`, { cause: error }));
    child.once("exit", onExit);
    child.once("error", onError);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-MAXIMUM_LOCK_STDERR_BYTES);
    });
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 4_096) {
        finish(new Error("Source snapshot lock emitted an oversized readiness response."));
        return;
      }
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      const line = stdout.slice(0, newline).trim();
      if (line !== expectedLine) {
        finish(new Error(`Source snapshot lock returned an invalid readiness line: ${line}`));
        return;
      }
      finish();
    });
  });
}

/** Holds no-write/no-delete Windows handles for every exact browser-execution file. */
export async function acquireRealBuildSourceLock(
  mirror: RealBuildSourceMirror,
): Promise<RealBuildSourceLock> {
  if (process.platform !== "win32") {
    throw new TypeError(
      `Real-build source locking requires Windows FileShare.Read handles and fails closed on ${process.platform}.`,
    );
  }
  const anchorBytes = randomBytes(32);
  writeContainedRegularFileAtomic(mirror.root, LOCK_ANCHOR, anchorBytes, {
    label: "real-build source-lock anchor",
  });
  const anchor: RealBuildSourceSnapshot = {
    path: LOCK_ANCHOR,
    digest: digest(anchorBytes),
    bytes: anchorBytes.length,
  };
  const manifest = {
    schemaVersion: "lego.real-build-source-lock/1",
    files: [anchor, ...mirror.files],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  if (manifestBytes.length > MAXIMUM_LOCK_MANIFEST_BYTES) {
    throw new TypeError(
      `Real-build source-lock manifest is ${manifestBytes.length} bytes; maximum is ${MAXIMUM_LOCK_MANIFEST_BYTES}.`,
    );
  }
  writeContainedRegularFileAtomic(mirror.root, LOCK_MANIFEST, manifestBytes, {
    label: "real-build source-lock manifest",
  });
  const manifestDigest = digest(manifestBytes);
  const expectedReadyLine = `READY ${manifestDigest} ${manifest.files.length} ${manifest.files.reduce((total, file) => total + file.bytes, 0)}`;
  const scriptSnapshot = mirror.files.find(({ path }) => path === REAL_BUILD_SOURCE_LOCK_SCRIPT);
  if (scriptSnapshot === undefined) {
    throw new TypeError(
      `Real-build source mirror must contain the authenticated lock helper ${REAL_BUILD_SOURCE_LOCK_SCRIPT}.`,
    );
  }
  const script = resolveRealBuildPath(mirror.root, REAL_BUILD_SOURCE_LOCK_SCRIPT, {
    mustExist: true,
    label: "authenticated real-build source-lock helper",
  });
  const executableRoot = parse(process.execPath).root;
  if (!/^[A-Za-z]:\\$/u.test(executableRoot)) {
    throw new TypeError(
      `Real-build source locking cannot derive a trusted Windows drive from Node executable ${process.execPath}.`,
    );
  }
  const systemRoot = join(executableRoot, "Windows");
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const powershellStat = lstatSync(powershell);
  if (
    powershellStat.isSymbolicLink() ||
    !powershellStat.isFile() ||
    realpathSync.native(powershell).toLocaleLowerCase("en-US") !==
      powershell.toLocaleLowerCase("en-US")
  ) {
    throw new TypeError(
      `Real-build source locking requires the ordinary system PowerShell executable at ${powershell}.`,
    );
  }
  const child = spawn(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      Buffer.from(AUTHENTICATED_HELPER_BOOTSTRAP, "utf16le").toString("base64"),
    ],
    {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: {
        SystemRoot: systemRoot,
        WINDIR: systemRoot,
        TEMP: dirname(mirror.root),
        TMP: dirname(mirror.root),
        PSModulePath: join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules"),
        LEGO_SOURCE_LOCK_SCRIPT: script,
        LEGO_SOURCE_LOCK_SCRIPT_DIGEST: scriptSnapshot.digest,
        LEGO_SOURCE_LOCK_SCRIPT_BYTES: String(scriptSnapshot.bytes),
        LEGO_SOURCE_LOCK_ROOT: mirror.root,
        LEGO_SOURCE_LOCK_MANIFEST: join(mirror.root, LOCK_MANIFEST),
        LEGO_SOURCE_LOCK_MANIFEST_DIGEST: manifestDigest,
      },
    },
  );
  try {
    await readyLine(child, expectedReadyLine);
  } catch (error) {
    child.kill();
    throw error;
  }
  let releasing = false;
  let unexpectedExit: {
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
  } | null = null;
  child.once("exit", (code, signal) => {
    if (!releasing) unexpectedExit = { code, signal };
  });
  return {
    assertHeld: () => {
      if (unexpectedExit !== null || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `Real-build source-lock process exited before browser evidence closed: ${JSON.stringify(unexpectedExit)}.`,
        );
      }
    },
    release: async () => {
      if (releasing) return;
      releasing = true;
      if (child.exitCode !== null || child.signalCode !== null) {
        if (child.exitCode !== 0) {
          throw new Error(
            `Real-build source-lock process exited early with code ${String(child.exitCode)} and signal ${String(child.signalCode)}.`,
          );
        }
        return;
      }
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.stdin.end("STOP\n");
      const timer = setTimeout(() => child.kill(), 5_000);
      await exited;
      clearTimeout(timer);
      if (child.exitCode !== 0) {
        throw new Error(
          `Real-build source-lock process exited with code ${String(child.exitCode)}.`,
        );
      }
    },
  };
}
