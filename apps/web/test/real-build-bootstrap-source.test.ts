import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertRealBuildBootstrapSourceLockHeld,
  createRealBuildBootstrapSourceManifest,
  readRequiredRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX,
  REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE,
  REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
  REAL_BUILD_BOOTSTRAP_MANIFEST_FILE,
  REAL_BUILD_BOOTSTRAP_READY_FILE,
  REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
  type RealBuildBootstrapSourceManifest,
} from "../e2e/real-build-bootstrap-source";
import type { RealBuildSourceSnapshot } from "../e2e/real-build-replay-files";

/**
 * Counts the whole-file reads the repaired bootstrap reader must never reach.
 *
 * `readFileSync` makes a file resident before any bound can fire, so an
 * oversized manifest that still reaches it proves the byte bound moved back
 * behind the read.
 */
const readObservation = vi.hoisted(() => ({ readFileSync: 0, readSync: 0 }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...arguments_: unknown[]) => {
      readObservation.readFileSync += 1;
      return Reflect.apply(actual.readFileSync, null, arguments_);
    },
    readSync: (...arguments_: unknown[]) => {
      readObservation.readSync += 1;
      return Reflect.apply(actual.readSync, null, arguments_);
    },
  };
});

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const POWERSHELL = join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const HOLD_HANDLES_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$streams = @()",
  "foreach ($path in ($env:LEGO_HOLD_PATHS -split '\\|')) {",
  "  $streams += [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)",
  "}",
  "[Console]::Out.WriteLine('HELD')",
  "[Console]::Out.Flush()",
  "[Console]::In.ReadLine() | Out-Null",
  "foreach ($stream in $streams) { $stream.Dispose() }",
].join("; ");

const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const temporaryRoots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

function writeSnapshotFile(root: string, path: string, contents: string): RealBuildSourceSnapshot {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  const bytes = Buffer.from(contents);
  writeFileSync(absolute, bytes);
  return { path, digest: sha256(bytes), bytes: bytes.length };
}

/** Builds the smallest manifest the lock check accepts: the three root anchors. */
function anchorManifest(
  files: readonly RealBuildSourceSnapshot[],
): RealBuildBootstrapSourceManifest {
  const policy = files.find(({ path }) => path === REAL_BUILD_SOURCE_ROOT_POLICY_PATH);
  if (policy === undefined) throw new Error("fixture manifest must contain the source-root policy");
  return createRealBuildBootstrapSourceManifest({
    files,
    sourceRootsPolicyDigest: policy.digest,
  });
}

async function realRepositoryAnchorManifest(): Promise<RealBuildBootstrapSourceManifest> {
  const files: RealBuildSourceSnapshot[] = [];
  for (const path of REAL_BUILD_BOOTSTRAP_ROOT_ANCHORS) {
    const bytes = await readFile(join(REPOSITORY_ROOT, path));
    files.push({ path, digest: sha256(bytes), bytes: bytes.length });
  }
  return anchorManifest(files);
}

function syntheticCheckout(): {
  readonly root: string;
  readonly manifest: RealBuildBootstrapSourceManifest;
} {
  const root = temporaryDirectory("lego-bootstrap-checkout-");
  const files = [
    writeSnapshotFile(root, "playwright.config.ts", "export default {};\n"),
    writeSnapshotFile(
      root,
      REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
      '{"schemaVersion":"lego.real-build-source-roots/1","roots":["playwright.config.ts"]}\n',
    ),
    writeSnapshotFile(root, "apps/web/e2e/real-build-bootstrap-source.ts", "export const a = 1;\n"),
    writeSnapshotFile(root, "packages/protocol/src/index.ts", "export const b = 2;\n"),
  ];
  return { root, manifest: anchorManifest(files) };
}

/** Writes exactly what playwright.config.ts publishes for a pre-discovery lock. */
function publishBootstrapEvidence(
  manifest: RealBuildBootstrapSourceManifest,
  options: { readonly lockPid: number; readonly ready: boolean },
): { readonly directory: string; readonly environment: NodeJS.ProcessEnv } {
  const directory = temporaryDirectory(REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX);
  const manifestPath = join(directory, REAL_BUILD_BOOTSTRAP_MANIFEST_FILE);
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  const lockManifestBytes = Buffer.from(
    `${JSON.stringify({ schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA, files: manifest.files })}\n`,
  );
  writeFileSync(join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE), lockManifestBytes);
  if (options.ready) {
    const lockedBytes = manifest.files.reduce((total, file) => total + file.bytes, 0);
    writeFileSync(
      join(directory, REAL_BUILD_BOOTSTRAP_READY_FILE),
      `READY ${sha256(lockManifestBytes)} ${manifest.files.length} ${lockedBytes}\n`,
    );
  }
  return {
    directory,
    environment: {
      LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY: directory,
      LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST: manifestPath,
      LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST: manifest.manifestDigest,
      LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(options.lockPid),
      LEGO_REAL_BUILD_BOOTSTRAP_RELEASE: join(directory, "release.txt"),
    },
  };
}

function firstLine(child: ChildProcessWithoutNullStreams, expected: string): Promise<void> {
  return new Promise((resolveReady, rejectReady) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => rejectReady(new Error(`no ${expected}: ${stderr}`)), 60_000);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`helper exited (${String(code)}) before ${expected}: ${stderr}`));
    });
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (!stdout.includes("\n")) return;
      clearTimeout(timer);
      if (stdout.trim() === expected) resolveReady();
      else rejectReady(new Error(`unexpected readiness ${stdout}: ${stderr}`));
    });
  });
}

/** Spawns the attacker of the finding: an ordinary user process with FileShare.Read handles. */
async function holdNoWriteHandles(paths: readonly string[]): Promise<number> {
  const child = spawn(
    POWERSHELL,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      HOLD_HANDLES_SCRIPT,
    ],
    {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, LEGO_HOLD_PATHS: paths.join("|") },
    },
  );
  children.push(child);
  await firstLine(child, "HELD");
  if (child.pid === undefined) throw new Error("handle holder has no pid");
  return child.pid;
}

/** Drops every handle a test opened, so a failing assertion cannot leave a locked directory. */
async function stopChildren(): Promise<void> {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    child.stdin.end("STOP\n");
    const timer = setTimeout(() => child.kill(), 5_000);
    await exited;
    clearTimeout(timer);
  }
}

afterEach(async () => {
  await stopChildren();
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  readObservation.readFileSync = 0;
  readObservation.readSync = 0;
});

describe("pre-discovery bootstrap source manifest reads", () => {
  it("refuses an oversized manifest before any of it is read or made resident", () => {
    const { manifest } = syntheticCheckout();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const manifestPath = join(directory, REAL_BUILD_BOOTSTRAP_MANIFEST_FILE);
    truncateSync(manifestPath, 4 * 1024 * 1024 + 1);
    readObservation.readFileSync = 0;
    readObservation.readSync = 0;

    expect(() => readRequiredRealBuildBootstrapSourceManifest({ environment })).toThrow(
      /pre-discovery bootstrap source manifest.*is 4194305 bytes; required 1\.\.4194304 bytes\. It was rejected before any contents were read/u,
    );
    expect(readObservation).toEqual({ readFileSync: 0, readSync: 0 });
  });

  it("reads an in-bounds manifest through the bounded reader rather than a whole-file read", () => {
    const { manifest } = syntheticCheckout();
    const { environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    readObservation.readFileSync = 0;
    readObservation.readSync = 0;

    expect(readRequiredRealBuildBootstrapSourceManifest({ environment })).toEqual(manifest);
    expect(readObservation.readFileSync).toBe(0);
    expect(readObservation.readSync).toBeGreaterThan(0);
  });

  it("refuses a manifest path outside the run's own bootstrap directory", () => {
    const { manifest } = syntheticCheckout();
    const { environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const outside = temporaryDirectory("lego-bootstrap-outside-");
    const strayPath = join(outside, "bootstrap-source.json");
    writeFileSync(strayPath, `${JSON.stringify(manifest)}\n`);

    expect(() =>
      readRequiredRealBuildBootstrapSourceManifest({
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST: strayPath },
      }),
    ).toThrow(/must live inside the pre-discovery bootstrap directory/u);
    expect(readObservation).toEqual({ readFileSync: 0, readSync: 0 });
  });

  it("refuses a bootstrap directory outside the task-owned temporary root", () => {
    const { manifest } = syntheticCheckout();
    const { environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });

    expect(() =>
      readRequiredRealBuildBootstrapSourceManifest({
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY: REPOSITORY_ROOT },
      }),
    ).toThrow(/must be a lego-real-build-bootstrap-\* directory created directly inside/u);
  });
});

describe.runIf(process.platform === "win32")("pre-discovery bootstrap source lock", () => {
  it("rejects a forged PID holding an ordinary FileShare.Read handle on playwright.config.ts", async () => {
    const { root, manifest } = syntheticCheckout();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const forgedPid = await holdNoWriteHandles([join(root, "playwright.config.ts")]);

    expect(() =>
      assertRealBuildBootstrapSourceLockHeld({
        repoRoot: root,
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(forgedPid) },
      }),
    ).toThrow(
      /Pre-discovery source-lock manifest at .*source-lock\.json opened for writing.*is not the helper/su,
    );
    expect(existsSync(join(directory, REAL_BUILD_BOOTSTRAP_READY_FILE))).toBe(true);
  });

  it("rejects a forged PID that also holds the run's lock manifest but not the source set", async () => {
    const { root, manifest } = syntheticCheckout();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const forgedPid = await holdNoWriteHandles([
      join(root, "playwright.config.ts"),
      join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE),
    ]);

    expect(() =>
      assertRealBuildBootstrapSourceLockHeld({
        repoRoot: root,
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(forgedPid) },
      }),
    ).toThrow(
      /Locked real-build source apps\/web\/e2e\/real-build-bootstrap-source\.ts.*opened for writing.*must cover every one of the manifest's 4 files/su,
    );
  });

  it("binds the probed root to this module's checkout instead of the working directory", async () => {
    const manifest = await realRepositoryAnchorManifest();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const forgedPid = await holdNoWriteHandles([
      join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE),
    ]);
    const elsewhere = temporaryDirectory("lego-bootstrap-wrong-cwd-");
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(elsewhere);

    let thrown: unknown = null;
    try {
      assertRealBuildBootstrapSourceLockHeld({
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(forgedPid) },
      });
    } catch (error) {
      thrown = error;
    }
    cwd.mockRestore();

    expect(thrown).toBeInstanceOf(Error);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).toContain(join(REPOSITORY_ROOT, "apps"));
    expect(message).not.toContain(elsewhere);
    expect(message).toMatch(/opened for writing.*must cover every one of the manifest's 3 files/su);
  });

  it("refuses a claimed root that does not hold the manifest's anchor bytes", async () => {
    const manifest = await realRepositoryAnchorManifest();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: process.pid,
      ready: true,
    });
    const forgedPid = await holdNoWriteHandles([
      join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE),
    ]);
    const elsewhere = temporaryDirectory("lego-bootstrap-empty-root-");

    expect(() =>
      assertRealBuildBootstrapSourceLockHeld({
        repoRoot: elsewhere,
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(forgedPid) },
      }),
    ).toThrow(/pre-discovery repository-root anchor playwright\.config\.ts/u);
  });

  it("accepts the helper's real lock and refuses it again once release is requested", async () => {
    const { root, manifest } = syntheticCheckout();
    const { directory, environment } = publishBootstrapEvidence(manifest, {
      lockPid: 1,
      ready: false,
    });
    const lockManifestPath = join(directory, REAL_BUILD_BOOTSTRAP_LOCK_MANIFEST_FILE);
    const lockManifestBytes = Buffer.from(
      `${JSON.stringify({ schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA, files: manifest.files })}\n`,
    );
    const readyPath = join(directory, REAL_BUILD_BOOTSTRAP_READY_FILE);
    const releasePath = join(directory, "release.txt");
    const helper = spawn(
      POWERSHELL,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(REPOSITORY_ROOT, "scripts", "windows-lock-real-build-snapshot.ps1"),
        "-Root",
        root,
        "-Manifest",
        lockManifestPath,
        "-ExpectedDigest",
        sha256(lockManifestBytes),
        "-ReadyFile",
        readyPath,
        "-ReleaseFile",
        releasePath,
        "-ErrorFile",
        join(directory, "stderr.txt"),
        "-ParentPid",
        String(process.pid),
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    children.push(helper);
    const exited = new Promise<number | null>((resolveExit) =>
      helper.once("exit", (code) => resolveExit(code)),
    );
    let stderr = "";
    helper.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    const deadline = Date.now() + 60_000;
    while (!existsSync(readyPath) && Date.now() < deadline) {
      await new Promise((wait) => setTimeout(wait, 50));
    }
    expect(existsSync(readyPath), `helper never became ready: ${stderr}`).toBe(true);

    const evidence = assertRealBuildBootstrapSourceLockHeld({
      repoRoot: root,
      environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(helper.pid) },
    });
    expect(evidence).toEqual({
      repoRoot: root,
      directory,
      helperPid: helper.pid,
      lockManifestDigest: sha256(lockManifestBytes),
      lockedFiles: manifest.files.length,
      lockedBytes: manifest.files.reduce((total, file) => total + file.bytes, 0),
    });

    writeFileSync(releasePath, "RELEASE\n", { flag: "wx" });
    expect(() =>
      assertRealBuildBootstrapSourceLockHeld({
        repoRoot: root,
        environment: { ...environment, LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: String(helper.pid) },
      }),
    ).toThrow(/was already asked to release/u);
    expect(await exited).toBe(0);
  });
});
