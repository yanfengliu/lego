import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import { fileURLToPath } from "node:url";

import {
  reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration,
  verifyRealBuildPrefix50Step44PopplerToolchain,
  type RealBuildPrefix50Step44PopplerToolchainConfiguration,
} from "./real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts";

const MAXIMUM_SOURCE_BYTES = 96 * 1024 * 1024;
const MAXIMUM_HEADER_BYTES = 256 * 1024;
const HELPER_PATH = fileURLToPath(
  new URL("./real-build-prefix50-subbuild-return-review-poppler-lock.ps1", import.meta.url),
);
const HELPER_BYTES = 9_977;
const HELPER_DIGEST =
  "sha256:2949ddf53f0ec7b8480b9ae16acedebf33c70e8ed35431bd9b38e8dd7421ff52" as const;
const JOB_LAUNCHER_PATH = fileURLToPath(
  new URL("./real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll", import.meta.url),
);
const JOB_LAUNCHER_BYTES = 15_360;
const JOB_LAUNCHER_DIGEST =
  "sha256:10b825ba6ff6dff1866cb90927798ee9884ef2e3a351388ba31eb2fadff11c8b" as const;
const POWERSHELL_BYTES = 495_616;
const POWERSHELL_DIGEST =
  "sha256:8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e" as const;
export const REAL_BUILD_PREFIX50_STEP44_POPPLER_SYSTEM_POWERSHELL_PATH =
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" as const;
const RESULT_SCHEMA = "lego.real-build-prefix50-step44-poppler-result/1" as const;

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedNanoseconds: bigint;
  readonly changedNanoseconds: bigint;
  readonly links: bigint;
}

interface AuthenticatedFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly identity: FileIdentity;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
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

function authenticateFile(input: {
  readonly path: string;
  readonly expectedBytes: number;
  readonly expectedDigest: `sha256:${string}`;
  readonly label: string;
  readonly requireSingleName: boolean;
}): AuthenticatedFile {
  const canonical = realpathSync.native(input.path);
  if (canonical.toLocaleLowerCase("en-US") !== input.path.toLocaleLowerCase("en-US"))
    throw new TypeError(`${input.label} must be its exact canonical path.`);
  const descriptor = openSync(input.path, constants.O_RDONLY);
  try {
    const beforeStats = fstatSync(descriptor, { bigint: true });
    const before = identity(beforeStats);
    if (
      !beforeStats.isFile() ||
      (input.requireSingleName && before.links !== 1n) ||
      before.size !== BigInt(input.expectedBytes)
    )
      throw new TypeError(`${input.label} must be one exact reviewed regular file.`);
    const bytes = readFileSync(descriptor);
    const after = identity(fstatSync(descriptor, { bigint: true }));
    if (
      !sameIdentity(before, after) ||
      bytes.byteLength !== input.expectedBytes ||
      sha256(bytes) !== input.expectedDigest
    )
      throw new TypeError(`${input.label} changed or failed its exact digest pin.`);
    return Object.freeze({ path: input.path, bytes, identity: after });
  } finally {
    closeSync(descriptor);
  }
}

function requireUnchanged(
  file: AuthenticatedFile,
  expectedDigest: `sha256:${string}`,
  label: string,
): void {
  const reread = authenticateFile({
    path: file.path,
    expectedBytes: file.bytes.byteLength,
    expectedDigest,
    label,
    requireSingleName: file.identity.links === 1n,
  });
  if (!sameIdentity(file.identity, reread.identity))
    throw new TypeError(`${label} identity changed during invocation.`);
}

function systemPowerShell(): AuthenticatedFile {
  return authenticateFile({
    path: REAL_BUILD_PREFIX50_STEP44_POPPLER_SYSTEM_POWERSHELL_PATH,
    expectedBytes: POWERSHELL_BYTES,
    expectedDigest: POWERSHELL_DIGEST,
    label: "Step-44 system PowerShell",
    requireSingleName: false,
  });
}

function requireArguments(arguments_: readonly string[], sourceBytes: Uint8Array): void {
  if (
    sourceBytes.byteLength < 1 ||
    sourceBytes.byteLength > MAXIMUM_SOURCE_BYTES ||
    arguments_.length < 1 ||
    arguments_.length > 32 ||
    arguments_.some(
      (argument) => argument.length < 1 || argument.length > 4_096 || argument.includes("\0"),
    )
  )
    throw new RangeError("Step-44 Poppler received an unbounded argument vector or source.");
}

function framedRequest(input: {
  readonly arguments: readonly string[];
  readonly sourceBytes: Uint8Array;
  readonly toolchain: RealBuildPrefix50Step44PopplerToolchainConfiguration;
  readonly launcherBytes: Uint8Array;
}): Buffer {
  const headerBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: "lego.real-build-prefix50-step44-poppler-request/1",
      arguments: input.arguments,
      sourceBytes: input.sourceBytes.byteLength,
      timeoutMilliseconds: 60_000,
      toolchainBodyBase64: Buffer.from(input.toolchain.bodyJson, "utf8").toString("base64"),
      toolchainCommitment: input.toolchain.commitment,
      launcherAssemblyBase64: Buffer.from(input.launcherBytes).toString("base64"),
    }),
    "utf8",
  );
  if (headerBytes.byteLength < 1 || headerBytes.byteLength > MAXIMUM_HEADER_BYTES)
    throw new RangeError("Step-44 Poppler framed header exceeded 256 KiB.");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32LE(headerBytes.byteLength);
  return Buffer.concat([length, headerBytes, Buffer.from(input.sourceBytes)]);
}

function stderrBytes(run: SpawnSyncReturns<string>): number {
  return Buffer.byteLength(run.stderr ?? "", "utf8");
}

function parseResult(run: SpawnSyncReturns<string>, label: string): number {
  if (run.error !== undefined || run.status !== 0)
    throw new TypeError(
      `${label} failed with status ${String(run.status)}; ${String(stderrBytes(run))} stderr bytes were withheld.`,
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    throw new TypeError(`${label} returned no exact quiescence receipt.`);
  }
  const result = parsed as Partial<{
    schemaVersion: string;
    totalProcesses: number;
    activeProcesses: number;
  }>;
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    result.schemaVersion !== RESULT_SCHEMA ||
    !Number.isSafeInteger(result.totalProcesses) ||
    result.totalProcesses! < 1 ||
    result.totalProcesses! > 4 ||
    result.activeProcesses !== 0 ||
    JSON.stringify(parsed) !== JSON.stringify(result)
  )
    throw new TypeError(`${label} returned an invalid quiescence receipt.`);
  return result.totalProcesses!;
}

function runWithToolchain(input: {
  readonly arguments: readonly string[];
  readonly sourceBytes: Uint8Array;
  readonly label: string;
  readonly toolchain: RealBuildPrefix50Step44PopplerToolchainConfiguration;
}): Readonly<{
  version: string;
  toolchainCommitment: `sha256:${string}`;
  totalProcesses: number;
  activeProcesses: 0;
}> {
  requireArguments(input.arguments, input.sourceBytes);
  const verified = verifyRealBuildPrefix50Step44PopplerToolchain(input.toolchain);
  const helper = authenticateFile({
    path: HELPER_PATH,
    expectedBytes: HELPER_BYTES,
    expectedDigest: HELPER_DIGEST,
    label: "Step-44 Poppler lock helper",
    requireSingleName: true,
  });
  const launcher = authenticateFile({
    path: JOB_LAUNCHER_PATH,
    expectedBytes: JOB_LAUNCHER_BYTES,
    expectedDigest: JOB_LAUNCHER_DIGEST,
    label: "Step-44 Poppler job launcher",
    requireSingleName: true,
  });
  const powershell = systemPowerShell();
  const encodedCommand = Buffer.from(helper.bytes.toString("utf8"), "utf16le").toString("base64");
  let run: SpawnSyncReturns<string>;
  try {
    run = spawnSync(
      powershell.path,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
      {
        input: framedRequest({
          arguments: input.arguments,
          sourceBytes: input.sourceBytes,
          toolchain: input.toolchain,
          launcherBytes: launcher.bytes,
        }),
        encoding: "utf8",
        windowsHide: true,
        timeout: 70_000,
        maxBuffer: 64 * 1024,
        env: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" },
      },
    );
  } finally {
    requireUnchanged(helper, HELPER_DIGEST, "Step-44 Poppler lock helper");
    requireUnchanged(launcher, JOB_LAUNCHER_DIGEST, "Step-44 Poppler job launcher");
    requireUnchanged(powershell, POWERSHELL_DIGEST, "Step-44 system PowerShell");
    verifyRealBuildPrefix50Step44PopplerToolchain(input.toolchain);
  }
  const totalProcesses = parseResult(run, input.label);
  return Object.freeze({
    version: verified.version,
    toolchainCommitment: verified.commitment,
    totalProcesses,
    activeProcesses: 0,
  });
}

export function runRealBuildPrefix50Step44Poppler(input: {
  readonly arguments: readonly string[];
  readonly sourceBytes: Uint8Array;
  readonly label: string;
}) {
  return runWithToolchain({
    ...input,
    toolchain: reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration(),
  });
}
