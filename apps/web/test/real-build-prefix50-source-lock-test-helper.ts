import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX,
  REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE,
  REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
  REAL_BUILD_BOOTSTRAP_MANIFEST_FILE,
  REAL_BUILD_BOOTSTRAP_READY_FILE,
  REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "../e2e/real-build-bootstrap-source";
import {
  acquireRealBuildPrefix50Step44SourceLockCapability,
  REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "../e2e/real-build-prefix50-subbuild-return-review-source-lock";

const POWERSHELL = join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const LOCK_SCRIPT = "scripts/windows-lock-real-build-snapshot.ps1";
const ENVIRONMENT_KEYS = [
  "LEGO_REAL_BUILD_REQUIRED",
  "LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY",
  "LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST",
  "LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST",
  "LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID",
  "LEGO_REAL_BUILD_BOOTSTRAP_RELEASE",
] as const;

const sha256 = (bytes: Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function logicalPath(repositoryRoot: string, path: string): string {
  const value = relative(resolve(repositoryRoot), resolve(path)).replaceAll("\\", "/");
  if (value.length === 0 || value.startsWith("../"))
    throw new TypeError(`Step-44 test lock input escaped its repository: ${path}.`);
  return value;
}

function enumerateFiles(repositoryRoot: string, root: string): string[] {
  const logicalRoot = logicalPath(repositoryRoot, resolve(repositoryRoot, root));
  const files: string[] = [];
  const visit = (path: string): void => {
    const stat = lstatSync(resolve(repositoryRoot, path));
    if (stat.isSymbolicLink()) throw new TypeError(`Step-44 test lock found a link at ${path}.`);
    if (stat.isFile()) {
      files.push(path.replaceAll("\\", "/"));
      return;
    }
    if (!stat.isDirectory()) throw new TypeError(`Step-44 test lock found a non-file at ${path}.`);
    for (const name of readdirSync(resolve(repositoryRoot, path)).sort()) visit(`${path}/${name}`);
  };
  visit(logicalRoot);
  return files;
}

function waitForReady(child: ChildProcessWithoutNullStreams, readyPath: string, errorPath: string) {
  return new Promise<void>((resolveReady, rejectReady) => {
    const deadline = Date.now() + 60_000;
    const check = (): void => {
      if (existsSync(readyPath)) return resolveReady();
      if (child.exitCode !== null)
        return rejectReady(
          new Error(
            `Step-44 test lock helper exited ${child.exitCode}: ${existsSync(errorPath) ? readFileSync(errorPath, "utf8") : "no error artifact"}`,
          ),
        );
      if (Date.now() >= deadline)
        return rejectReady(new Error("Step-44 test lock helper did not become ready in 60s."));
      setTimeout(check, 25);
    };
    check();
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(
      () => rejectExit(new Error("Step-44 test lock helper did not exit.")),
      10_000,
    );
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

export async function withRealStep44SourceLock<T>(input: {
  readonly repositoryRoot: string;
  readonly operationInputRoots: readonly string[];
  readonly batchInputPath: string;
  readonly action: (capability: RealBuildPrefix50Step44SourceLockCapability) => Promise<T> | T;
}): Promise<T> {
  if (process.platform !== "win32")
    throw new TypeError(
      "The real Step-44 source-lock test helper requires Windows handle semantics.",
    );
  const files = new Set<string>();
  for (const root of [
    ...REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS,
    ...REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS,
    ...input.operationInputRoots,
  ])
    for (const path of enumerateFiles(input.repositoryRoot, root)) files.add(path);
  const snapshots = [...files]
    .sort((left, right) => left.localeCompare(right))
    .map((path) => {
      const bytes = readFileSync(resolve(input.repositoryRoot, path));
      return { path, digest: sha256(bytes), bytes: bytes.byteLength };
    });
  const policy = snapshots.find(({ path }) => path === REAL_BUILD_SOURCE_ROOT_POLICY_PATH);
  if (policy === undefined) throw new Error("Step-44 test lock omitted its source-root policy.");
  const manifest = createRealBuildBootstrapSourceManifest({
    files: snapshots,
    sourceRootsPolicyDigest: policy.digest,
  });
  const directory = mkdtempSync(join(tmpdir(), REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX));
  const manifestPath = join(directory, REAL_BUILD_BOOTSTRAP_MANIFEST_FILE);
  const lockManifestPath = join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE);
  const readyPath = join(directory, REAL_BUILD_BOOTSTRAP_READY_FILE);
  const releasePath = join(directory, "release.txt");
  const errorPath = join(directory, "error.txt");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  const lockBytes = Buffer.from(
    `${JSON.stringify({ schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA, files: manifest.files })}\n`,
  );
  writeFileSync(lockManifestPath, lockBytes);
  const child = spawn(
    POWERSHELL,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(input.repositoryRoot, LOCK_SCRIPT),
      "-Root",
      resolve(input.repositoryRoot),
      "-Manifest",
      lockManifestPath,
      "-ExpectedDigest",
      sha256(lockBytes),
      "-ReadyFile",
      readyPath,
      "-ReleaseFile",
      releasePath,
      "-ErrorFile",
      errorPath,
      "-ParentPid",
      String(process.pid),
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  const previous = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
  try {
    await waitForReady(child, readyPath, errorPath);
    Object.assign(process.env, {
      LEGO_REAL_BUILD_REQUIRED: "1",
      LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY: directory,
      LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST: manifestPath,
      LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST: manifest.manifestDigest,
      LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(child.pid),
      LEGO_REAL_BUILD_BOOTSTRAP_RELEASE: releasePath,
    });
    const capability = acquireRealBuildPrefix50Step44SourceLockCapability({
      repositoryRoot: resolve(input.repositoryRoot),
      operationInputRoots: input.operationInputRoots,
      batchInputPath: input.batchInputPath,
    });
    return await input.action(capability);
  } finally {
    if (!existsSync(releasePath)) writeFileSync(releasePath, "RELEASE\n", { flag: "wx" });
    await waitForExit(child).catch(() => child.kill());
    for (const key of ENVIRONMENT_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
