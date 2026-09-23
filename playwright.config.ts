import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRealBuildPlaywrightConfig,
  selectRealBuildPlaywrightOperation,
} from "./apps/web/e2e/playwright-config-support.ts";
import { captureRealBuildStep44PreUnlockSourceSnapshots } from "./apps/web/e2e/real-build-step44-playwright-source-closure.ts";
import {
  assertRealBuildStep44CalibrationRawConfig,
  prepareRealBuildStep44CalibrationRunnerOutput,
} from "./apps/web/e2e/real-build-step44-calibration-runner-output.ts";

const BOOTSTRAP_SCHEMA = "lego.real-build-bootstrap-source/1";
const BOOTSTRAP_BOUNDARY = "node-executable-and-playwright-config-loader";
const SOURCE_ROOT_POLICY = "apps/web/e2e/real-build-source-roots.json";
const LOCK_HELPER = "scripts/windows-lock-real-build-snapshot.ps1";
const STEP44_CAMERA_ONLY_SOURCE_PDF = "recipes/6651557.pdf";
const STEP44_SOURCE_LOCKED_INPUTS_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_JSON";
const step44Operation = selectRealBuildPlaywrightOperation(process.env);
const step44SourceLockedOperation =
  step44Operation.mode === "source-locked-capture"
    ? "capture"
    : step44Operation.mode === "source-locked-finalize"
      ? "finalize"
      : undefined;
const STEP44_SOURCE_LOCKED_PRODUCTION_ROOTS = [
  STEP44_CAMERA_ONLY_SOURCE_PDF,
  "output/official-model/vx1087034_21066_a.xml",
  "output/part-identification/prefix50-semantic-closure.json",
  "output/real-build/action-preparation.json",
  "output/real-build/builder-shell-geometry.bin",
  "output/real-build/prefix50-ldraw-catalog-frames.json",
  "output/real-build/prefix50-official-ldraw-world-proposal.json",
  "output/real-build/prefix50-official-world-reconciliation.json",
  "output/real-build/prefix50-structural-events.json",
  // Lock the complete transitive dependency root. The production-materials module imports
  // current-evidence verifiers whose own imports must not remain mutable after discovery.
  "scripts",
] as const;
const MAXIMUM_SOURCE_FILES = 10_000;
const MAXIMUM_SOURCE_ENTRIES = 25_000;
const MAXIMUM_SOURCE_BYTES = 512 * 1024 * 1024;
const VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY =
  "LEGO_REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED" as const;
const VITE_SHUTDOWN_UNCONFIRMED_MARKER = "vite-shutdown-unconfirmed.marker" as const;

const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const sameStat = (
  left: ReturnType<typeof fstatSync>,
  right: ReturnType<typeof fstatSync>,
): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs;

function exactConfigRepoRoot(): string {
  const configPath = resolve(fileURLToPath(import.meta.url));
  const configStat = lstatSync(configPath);
  const canonicalConfigPath = realpathSync.native(configPath);
  if (
    configStat.isSymbolicLink() ||
    !configStat.isFile() ||
    canonicalConfigPath.toLocaleLowerCase("en-US") !== configPath.toLocaleLowerCase("en-US")
  ) {
    throw new TypeError(`Playwright config is not an ordinary canonical file: ${configPath}.`);
  }
  const repoRoot = dirname(canonicalConfigPath);
  const workingRoot = realpathSync.native(process.cwd());
  if (workingRoot.toLocaleLowerCase("en-US") !== repoRoot.toLocaleLowerCase("en-US")) {
    throw new TypeError(
      `Real-build Playwright runs require cwd ${repoRoot}; received ${workingRoot}.`,
    );
  }
  return repoRoot;
}

function readExactFile(path: string): Buffer {
  const beforePath = lstatSync(path);
  if (beforePath.isSymbolicLink() || !beforePath.isFile()) {
    throw new TypeError(`Real-build bootstrap source is not an ordinary file: ${path}.`);
  }
  const descriptor = openSync(path, "r");
  try {
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const afterPath = lstatSync(path);
    if (!sameStat(before, after) || !sameStat(after, afterPath)) {
      throw new TypeError(`Real-build bootstrap source changed during exact read: ${path}.`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function bootstrapSourceSnapshots(repoRoot: string): readonly {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}[] {
  if (step44Operation.mode === "camera-only" || step44Operation.mode === "real-domain-calibration")
    return captureRealBuildStep44PreUnlockSourceSnapshots({
      repositoryRoot: repoRoot,
      operation: step44Operation,
    });
  const policyBytes = readExactFile(join(repoRoot, SOURCE_ROOT_POLICY));
  const policy = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(policyBytes)) as {
    readonly schemaVersion?: unknown;
    readonly roots?: unknown;
  };
  if (
    policy.schemaVersion !== "lego.real-build-source-roots/1" ||
    !Array.isArray(policy.roots) ||
    policy.roots.length === 0 ||
    new Set(policy.roots).size !== policy.roots.length ||
    policy.roots.some(
      (root) =>
        typeof root !== "string" ||
        !/^[A-Za-z0-9._@/-]+$/u.test(root) ||
        root.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
    )
  ) {
    throw new TypeError("Real-build source-root policy is malformed or duplicated.");
  }
  const files: string[] = [];
  let entries = 0;
  const visit = (relativePath: string, depth: number): void => {
    if (depth > 64) throw new TypeError(`Real-build bootstrap source depth exceeds 64.`);
    entries += 1;
    if (entries > MAXIMUM_SOURCE_ENTRIES) {
      throw new TypeError(`Real-build bootstrap source exceeds ${MAXIMUM_SOURCE_ENTRIES} entries.`);
    }
    const absolute = resolve(repoRoot, relativePath);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      throw new TypeError(`Real-build bootstrap source may not traverse a link: ${relativePath}.`);
    }
    if (stat.isFile()) {
      files.push(relativePath.replaceAll("\\", "/"));
      if (files.length > MAXIMUM_SOURCE_FILES) {
        throw new TypeError(`Real-build bootstrap source exceeds ${MAXIMUM_SOURCE_FILES} files.`);
      }
      return;
    }
    if (!stat.isDirectory()) {
      throw new TypeError(
        `Real-build bootstrap source is not a file or directory: ${relativePath}.`,
      );
    }
    const names = readdirSync(absolute).sort((left, right) => left.localeCompare(right));
    const after = lstatSync(absolute);
    if (!sameStat(stat, after)) {
      throw new TypeError(
        `Real-build bootstrap directory changed during enumeration: ${relativePath}.`,
      );
    }
    for (const name of names) {
      if ([".git", "node_modules", "output", "var"].includes(name)) continue;
      visit(`${relativePath}/${name}`, depth + 1);
    }
  };
  const roots = [...(policy.roots as string[])];
  if (step44SourceLockedOperation !== undefined) {
    const encodedInputs = process.env[STEP44_SOURCE_LOCKED_INPUTS_ENV];
    let lockedInputs: unknown;
    try {
      lockedInputs = JSON.parse(encodedInputs ?? "");
    } catch (error) {
      throw new TypeError(
        `${STEP44_SOURCE_LOCKED_INPUTS_ENV} must be a JSON array of exact repository-relative input roots.`,
        { cause: error },
      );
    }
    if (
      !Array.isArray(lockedInputs) ||
      lockedInputs.length < 1 ||
      lockedInputs.length > 16 ||
      new Set(lockedInputs).size !== lockedInputs.length ||
      lockedInputs.some(
        (input) =>
          typeof input !== "string" ||
          !/^[A-Za-z0-9._@/-]+$/u.test(input) ||
          input.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
      )
    )
      throw new TypeError(
        `${STEP44_SOURCE_LOCKED_INPUTS_ENV} must contain 1..16 unique strict repository-relative input roots.`,
      );
    roots.push(...STEP44_SOURCE_LOCKED_PRODUCTION_ROOTS, ...(lockedInputs as string[]));
  }
  for (const root of new Set(roots)) visit(root, 0);
  const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));
  let aggregateBytes = 0;
  return uniqueFiles.map((path) => {
    const bytes = readExactFile(join(repoRoot, path));
    aggregateBytes += bytes.length;
    if (aggregateBytes > MAXIMUM_SOURCE_BYTES) {
      throw new TypeError(
        `Real-build bootstrap source exceeds ${MAXIMUM_SOURCE_BYTES} bytes at ${path}.`,
      );
    }
    return { path, digest: sha256(bytes), bytes: bytes.length };
  });
}

const AUTHENTICATED_LOCK_BOOTSTRAP = String.raw`
$ErrorActionPreference = "Stop"
$stream = $null
$reader = $null
$sha = $null
try {
  $scriptPath = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT")
  $expectedDigest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT_DIGEST")
  [long]$expectedBytes = [long]::Parse(
    [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_SCRIPT_BYTES"),
    [Globalization.CultureInfo]::InvariantCulture
  )
  $stream = [IO.File]::Open($scriptPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  if ($stream.Length -ne $expectedBytes) { throw "Authenticated lock helper length changed." }
  $sha = [Security.Cryptography.SHA256]::Create()
  $observed = "sha256:" + ([BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant())
  if ($observed -cne $expectedDigest) { throw "Authenticated lock helper digest changed." }
  $stream.Position = 0
  $strictUtf8 = New-Object Text.UTF8Encoding($false, $true)
  $reader = New-Object IO.StreamReader($stream, $strictUtf8, $false, 65536, $true)
  $source = $reader.ReadToEnd()
  $reader.Dispose()
  $reader = $null
  $arguments = @{
    Root = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_ROOT")
    Manifest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_MANIFEST")
    ExpectedDigest = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_MANIFEST_DIGEST")
    ReadyFile = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_READY")
    ReleaseFile = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_RELEASE")
    ErrorFile = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_ERROR")
    CleanupDirectory = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_CLEANUP")
    ParentPid = [int]::Parse([Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_PARENT_PID"))
  }
  & ([ScriptBlock]::Create($source)) @arguments
  if (-not $?) { throw "Authenticated lock helper returned failure." }
} catch {
  $message = $_.Exception.ToString()
  [Console]::Error.WriteLine($message)
  $errorPath = [Environment]::GetEnvironmentVariable("LEGO_SOURCE_LOCK_ERROR")
  if (-not [String]::IsNullOrEmpty($errorPath)) {
    try {
      $errorUtf8 = New-Object Text.UTF8Encoding($false, $true)
      [IO.File]::WriteAllText($errorPath, $message, $errorUtf8)
    } catch {
      [Console]::Error.WriteLine($_.Exception.ToString())
    }
  }
  exit 1
} finally {
  if ($null -ne $reader) { $reader.Dispose() }
  if ($null -ne $sha) { $sha.Dispose() }
  if ($null -ne $stream) { $stream.Dispose() }
}
`;

function waitForBootstrapReady(path: string, expected: string, errorPath: string): void {
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      const observed = readFileSync(path, "utf8").trim();
      if (observed !== expected) {
        throw new Error(`Pre-discovery source lock returned invalid readiness: ${observed}.`);
      }
      return;
    }
    if (existsSync(errorPath)) {
      const error = readFileSync(errorPath, "utf8").slice(-65_536);
      throw new Error(`Pre-discovery source lock failed before readiness: ${error}`);
    }
    Atomics.wait(sleeper, 0, 0, 50);
  }
  const stderr = existsSync(errorPath) ? readFileSync(errorPath, "utf8").slice(-65_536) : "";
  throw new Error(`Pre-discovery source lock did not become ready in 60 seconds: ${stderr}`);
}

/** Node-built-in-only exit decision: repository imports here would execute before source locking. */
function realBuildBootstrapExitPreservationReason(
  directoryValue: string,
  environment: NodeJS.ProcessEnv,
): string | null {
  try {
    const directory = resolve(directoryValue);
    const temporaryRoot = realpathSync.native(resolve(tmpdir()));
    const stat = lstatSync(directory);
    const canonicalDirectory = realpathSync.native(directory);
    if (
      stat.isSymbolicLink() ||
      !stat.isDirectory() ||
      canonicalDirectory.toLocaleLowerCase("en-US") !== directory.toLocaleLowerCase("en-US") ||
      dirname(canonicalDirectory).toLocaleLowerCase("en-US") !==
        temporaryRoot.toLocaleLowerCase("en-US") ||
      !basename(canonicalDirectory).startsWith("lego-real-build-bootstrap-")
    ) {
      return `bootstrap directory ${directory} no longer has its exact task-owned identity`;
    }
    const signal = environment[VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY];
    if (signal !== undefined) {
      return signal === "1"
        ? "the Vite shutdown environment signal is unconfirmed"
        : `the Vite shutdown environment signal is malformed (${JSON.stringify(signal)})`;
    }
    const marker = join(canonicalDirectory, VITE_SHUTDOWN_UNCONFIRMED_MARKER);
    try {
      lstatSync(marker);
      return `the fixed Vite shutdown marker exists at ${marker}`;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      return code === "ENOENT"
        ? null
        : `the fixed Vite shutdown marker could not be inspected (${code ?? "unknown"})`;
    }
  } catch (error) {
    return `the bootstrap shutdown boundary could not be validated: ${String(error)}`;
  }
}

function releaseBootstrapOnExit(directory: string, releasePath: string, pid: number): void {
  process.once("exit", () => {
    if (!existsSync(directory)) return;
    const preservationReason = realBuildBootstrapExitPreservationReason(directory, process.env);
    if (preservationReason !== null) {
      process.stderr.write(
        `Preserving the pre-discovery source lock until parent exit after an unconfirmed Vite shutdown: ${preservationReason}.\n`,
      );
      return;
    }
    try {
      if (!existsSync(releasePath)) writeFileSync(releasePath, "RELEASE\n", { flag: "wx" });
    } catch (error) {
      process.stderr.write(
        `Failed to release pre-discovery source lock during exit: ${String(error)}\n`,
      );
      return;
    }
    const sleeper = new Int32Array(new SharedArrayBuffer(4));
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
        Atomics.wait(sleeper, 0, 0, 50);
      } catch {
        return;
      }
    }
    process.stderr.write(
      `Pre-discovery source-lock process ${pid} did not finish cleanup during parent exit.\n`,
    );
  });
}

function ensureRealBuildBootstrapLock(): void {
  if (process.env.LEGO_REAL_BUILD_REQUIRED !== "1") return;
  if (process.platform !== "win32") {
    throw new Error(
      `Real-build pre-discovery source locking requires Windows, not ${process.platform}.`,
    );
  }
  const repoRoot = exactConfigRepoRoot();
  const files = bootstrapSourceSnapshots(repoRoot);
  const sourcePolicy = files.find(({ path }) => path === SOURCE_ROOT_POLICY);
  const helper = files.find(({ path }) => path === LOCK_HELPER);
  if (sourcePolicy === undefined || helper === undefined) {
    throw new Error("Bootstrap source snapshot is missing its root policy or lock helper.");
  }
  const base = {
    schemaVersion: BOOTSTRAP_SCHEMA,
    trustedBootstrapBoundary: BOOTSTRAP_BOUNDARY,
    sourceRootsPolicyDigest: sourcePolicy.digest,
    files,
  };
  const bootstrapManifest = { ...base, manifestDigest: sha256(JSON.stringify(base)) };
  const directory = mkdtempSync(join(tmpdir(), "lego-real-build-bootstrap-"));
  const bootstrapManifestPath = join(directory, "bootstrap-source.json");
  const lockManifestPath = join(directory, "source-lock.json");
  const readyPath = join(directory, "ready.txt");
  const releasePath = join(directory, "release.txt");
  const errorPath = join(directory, "stderr.txt");
  writeFileSync(bootstrapManifestPath, `${JSON.stringify(bootstrapManifest)}\n`, { flag: "wx" });
  const lockManifestBytes = Buffer.from(
    `${JSON.stringify({ schemaVersion: "lego.real-build-source-lock/1", files })}\n`,
  );
  writeFileSync(lockManifestPath, lockManifestBytes, { flag: "wx" });
  const lockManifestDigest = sha256(lockManifestBytes);
  const expectedReady = `READY ${lockManifestDigest} ${files.length} ${files.reduce((total, file) => total + file.bytes, 0)}`;
  const driveRoot = parse(process.execPath).root;
  if (!/^[A-Za-z]:\\$/u.test(driveRoot)) {
    throw new Error(`Cannot derive trusted Windows drive from ${process.execPath}.`);
  }
  const systemRoot = join(driveRoot, "Windows");
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  if (
    lstatSync(powershell).isSymbolicLink() ||
    realpathSync.native(powershell).toLocaleLowerCase("en-US") !==
      powershell.toLocaleLowerCase("en-US")
  ) {
    throw new Error(`System PowerShell path is not an ordinary exact executable: ${powershell}.`);
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
      Buffer.from(AUTHENTICATED_LOCK_BOOTSTRAP, "utf16le").toString("base64"),
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
      env: {
        SystemRoot: systemRoot,
        WINDIR: systemRoot,
        TEMP: parse(directory).dir,
        TMP: parse(directory).dir,
        PSModulePath: join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules"),
        LEGO_SOURCE_LOCK_SCRIPT: join(repoRoot, LOCK_HELPER),
        LEGO_SOURCE_LOCK_SCRIPT_DIGEST: helper.digest,
        LEGO_SOURCE_LOCK_SCRIPT_BYTES: String(helper.bytes),
        LEGO_SOURCE_LOCK_ROOT: repoRoot,
        LEGO_SOURCE_LOCK_MANIFEST: lockManifestPath,
        LEGO_SOURCE_LOCK_MANIFEST_DIGEST: lockManifestDigest,
        LEGO_SOURCE_LOCK_READY: readyPath,
        LEGO_SOURCE_LOCK_RELEASE: releasePath,
        LEGO_SOURCE_LOCK_ERROR: errorPath,
        LEGO_SOURCE_LOCK_CLEANUP: directory,
        LEGO_SOURCE_LOCK_PARENT_PID: String(process.pid),
      },
    },
  );
  try {
    waitForBootstrapReady(readyPath, expectedReady, errorPath);
  } catch (error) {
    child.kill();
    throw error;
  }
  if (child.pid === undefined) throw new Error("Pre-discovery source-lock process has no PID.");
  releaseBootstrapOnExit(directory, releasePath, child.pid);
  process.env.LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY = directory;
  process.env.LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST = bootstrapManifestPath;
  process.env.LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST = bootstrapManifest.manifestDigest;
  process.env.LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID = String(child.pid);
  process.env.LEGO_REAL_BUILD_BOOTSTRAP_RELEASE = releasePath;
  child.unref();
}

const calibrationConfig =
  step44Operation.mode === "real-domain-calibration"
    ? createRealBuildPlaywrightConfig({
        port: Number(process.env.LEGO_E2E_PORT ?? 5267 + (process.pid % 900)),
        operation: step44Operation,
        calibrationOutputDir: prepareRealBuildStep44CalibrationRunnerOutput(exactConfigRepoRoot()),
      })
    : undefined;
if (calibrationConfig !== undefined) assertRealBuildStep44CalibrationRawConfig(calibrationConfig);

ensureRealBuildBootstrapLock();

if (calibrationConfig !== undefined) assertRealBuildStep44CalibrationRawConfig(calibrationConfig);

// Playwright reads this before global setup, so the server and baseURL share one run-owned port.
const port = Number(process.env.LEGO_E2E_PORT ?? 5267 + (process.pid % 900));
process.env.LEGO_E2E_PORT = String(port);

export default calibrationConfig ??
  createRealBuildPlaywrightConfig({
    port,
    operation: step44Operation,
  });
