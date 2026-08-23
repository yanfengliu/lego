import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runBoundedChild } from "./part-identification-io.mjs";

const windowsDescribe = process.platform === "win32" ? describe : describe.skip;
const powershell = resolve(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const modulePath = fileURLToPath(new URL("./part-identification-io.mjs", import.meta.url));
const launcherSourceNames = Object.freeze([
  "windows-bounded-child.ps1",
  "windows-bounded-child-native.cs",
  "windows-bounded-child.cs",
]);

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function compileFixture(root, name, source) {
  const sourcePath = join(root, `${name}.cs`);
  const outputPath = join(root, `${name}.exe`);
  writeFileSync(sourcePath, source);
  const result = spawnSync(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(root, "compile.ps1"),
      "-Source",
      sourcePath,
      "-Output",
      outputPath,
    ],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  if (result.status !== 0 || result.error !== undefined) {
    throw new Error(
      `Could not compile ${name} fixture: ${result.error?.message ?? result.stderr.trim()}.`,
    );
  }
  return outputPath;
}

function equalizeLengths(paths) {
  const maximum = Math.max(...paths.map((path) => readFileSync(path).length));
  for (const path of paths) {
    const missing = maximum - readFileSync(path).length;
    if (missing > 0) appendFileSync(path, Buffer.alloc(missing));
  }
}

windowsDescribe("exact Windows executable launch boundary", () => {
  let root;
  let goodPath;
  let wrongPath;
  let sleeperPath;
  let pin;
  let sleeperPin;

  beforeAll(() => {
    root = join(tmpdir(), `lego-pinned-launch-${process.pid}-${Date.now()}`);
    mkdirSync(root);
    writeFileSync(
      join(root, "compile.ps1"),
      [
        "param([string]$Source, [string]$Output)",
        '$ErrorActionPreference = "Stop"',
        "Add-Type -TypeDefinition ([IO.File]::ReadAllText($Source)) -Language CSharp -OutputAssembly $Output -OutputType ConsoleApplication",
      ].join("\r\n"),
    );
    goodPath = compileFixture(
      root,
      "good",
      'using System; public static class Entry { public static int Main(string[] args) { Console.Out.Write("GOOD"); return 0; } }',
    );
    wrongPath = compileFixture(
      root,
      "wrong",
      'using System; using System.IO; public static class Entry { public static int Main(string[] args) { File.WriteAllText(args[0], "WRONG"); Console.Out.Write("WRONG"); return 0; } }',
    );
    sleeperPath = compileFixture(
      root,
      "sleeper",
      'using System.IO; using System.Threading; public static class Entry { public static int Main(string[] args) { Thread.Sleep(30000); File.WriteAllText(args[0], "ORPHANED"); return 0; } }',
    );
    equalizeLengths([goodPath, wrongPath]);
    const goodBytes = readFileSync(goodPath);
    const wrongBytes = readFileSync(wrongPath);
    expect(wrongBytes.length).toBe(goodBytes.length);
    expect(digest(wrongBytes)).not.toBe(digest(goodBytes));
    pin = Object.freeze({ byteLength: goodBytes.length, digest: digest(goodBytes) });
    const sleeperBytes = readFileSync(sleeperPath);
    sleeperPin = Object.freeze({
      byteLength: sleeperBytes.length,
      digest: digest(sleeperBytes),
    });

    const directSentinel = join(root, "direct-wrong-sentinel.txt");
    const direct = spawnSync(wrongPath, [directSentinel], {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
    expect(direct.status).toBe(0);
    expect(existsSync(directSentinel)).toBe(true);
    unlinkSync(directSentinel);
  }, 60_000);

  afterAll(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("rejects same-length wrong bytes after hostile prototype mutation", () => {
    const sentinel = join(root, "poisoned-wrong-sentinel.txt");
    const scriptPath = join(root, "poisoned-launch.mjs");
    writeFileSync(
      scriptPath,
      [
        'import { createHash } from "node:crypto";',
        'import { existsSync } from "node:fs";',
        `import { runBoundedChild } from ${JSON.stringify(pathToFileURL(modulePath).href)};`,
        `const wrongPath = ${JSON.stringify(wrongPath)};`,
        `const sentinel = ${JSON.stringify(sentinel)};`,
        `const pin = Object.freeze({ byteLength: ${pin.byteLength}, digest: ${JSON.stringify(pin.digest)} });`,
        "const hashPrototype = Object.getPrototypeOf(createHash('sha256'));",
        "hashPrototype.update = function () { return this; };",
        "hashPrototype.digest = function () { return Buffer.alloc(32); };",
        "Buffer.prototype.slice = function () { return this; };",
        "Buffer.prototype.subarray = function () { return this; };",
        "Object.prototype.toJSON = function () { return { command: wrongPath, arguments: [sentinel] }; };",
        "Array.prototype.toJSON = function () { return [sentinel]; };",
        "let rejected = false;",
        "try {",
        "  await runBoundedChild(wrongPath, [sentinel], { exactExecutablePin: pin, timeoutMs: 10000, maxStdoutBytes: 4096, maxStderrBytes: 4096, label: 'poisoned wrong executable' });",
        "} catch (error) {",
        "  rejected = /exact-executable launch receipt/u.test(error.message);",
        "}",
        "if (!rejected || existsSync(sentinel)) process.exit(1);",
        "process.stdout.write('SAFE');",
      ].join("\n"),
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true,
    });
    expect(result).toMatchObject({ status: 0, signal: null, stdout: "SAFE", stderr: "" });
    expect(existsSync(sentinel)).toBe(false);
  }, 30_000);

  it("binds the Job Object as a CreateProcess attribute with no late-assignment window", () => {
    const source = launcherSourceNames
      .map((name) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8"))
      .join("\n");
    expect(source).toContain("PROC_THREAD_ATTRIBUTE_JOB_LIST");
    expect(source).toContain("EXTENDED_STARTUPINFO_PRESENT");
    expect(source).toContain("UpdateProcThreadAttribute");
    expect(source).not.toMatch(/\bAssignProcessToJobObject\b/u);
    expect(source).not.toMatch(/\bCREATE_SUSPENDED\b/u);
    expect(source).not.toMatch(/\bResumeThread\b/u);
  });

  it("loads the exact bounded launcher source closure and keeps every source below 500 lines", () => {
    const wrapper = readFileSync(
      fileURLToPath(new URL("./windows-bounded-child.ps1", import.meta.url)),
      "utf8",
    );
    const declaredCSharpSources = [
      ...wrapper.matchAll(/^\s+"(windows-bounded-child(?:-native)?\.cs)",?$/gmu),
    ].map((match) => match[1]);
    expect(declaredCSharpSources).toEqual(launcherSourceNames.slice(1));
    expect(wrapper).toContain("Add-Type -Path $launcherSourcePaths");
    expect(wrapper.match(/windows-bounded-child(?:-native)?\.cs/gu)).toHaveLength(2);
    for (const name of launcherSourceNames) {
      const source = readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");
      expect(source.split(/\r?\n/u).length, `${name} line count`).toBeLessThan(500);
    }
  });

  it("kills an already-created atomic-Job child when the wrapper dies", async () => {
    const sentinel = join(root, "atomic-job-orphan-sentinel.txt");
    const launcher = spawn(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        fileURLToPath(new URL("./windows-bounded-child.ps1", import.meta.url)),
        "-RequireExactPin",
        "-ExactByteLength",
        `${sleeperPin.byteLength}`,
        "-ExactDigest",
        sleeperPin.digest,
      ],
      {
        cwd: dirname(sleeperPath),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let attachedPid;
    let cleanupFailure = null;
    try {
      const marker = new Promise((resolveMarker, rejectMarker) => {
        let stderr = "";
        const timeout = setTimeout(
          () => rejectMarker(new Error(`Atomic Job marker timed out; stderr=${stderr}`)),
          15_000,
        );
        launcher.stderr.on("data", (chunk) => {
          stderr += chunk.toString("utf8");
          const match = /LEGO_ATOMIC_JOB_ATTACHED_V1 (\d+)/u.exec(stderr);
          if (match === null) return;
          clearTimeout(timeout);
          resolveMarker(Number(match[1]));
        });
        launcher.once("error", (error) => {
          clearTimeout(timeout);
          rejectMarker(error);
        });
        launcher.once("exit", (code) => {
          if (attachedPid !== undefined) return;
          clearTimeout(timeout);
          rejectMarker(
            new Error(
              `Atomic Job launcher exited with ${code} before its marker; stderr=${stderr}`,
            ),
          );
        });
      });
      launcher.stdin.end(
        JSON.stringify({
          command: sleeperPath,
          arguments: [sentinel],
          exactExecutablePin: sleeperPin,
          testPostAtomicCreationDelayMs: 5_000,
        }),
      );
      attachedPid = await marker;
      expect(Number.isSafeInteger(attachedPid) && attachedPid > 0).toBe(true);

      const wrapperExit = new Promise((resolveExit) => launcher.once("exit", resolveExit));
      expect(launcher.kill("SIGKILL")).toBe(true);
      await wrapperExit;

      const deadline = Date.now() + 3_000;
      let childAlive = true;
      while (childAlive && Date.now() < deadline) {
        try {
          process.kill(attachedPid, 0);
        } catch (error) {
          if (error?.code !== "ESRCH") throw error;
          childAlive = false;
          break;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      }
      expect(childAlive).toBe(false);
      expect(existsSync(sentinel)).toBe(false);
    } finally {
      if (launcher.exitCode === null) launcher.kill("SIGKILL");
      if (attachedPid !== undefined) {
        try {
          process.kill(attachedPid, "SIGKILL");
        } catch (error) {
          if (error?.code !== "ESRCH") cleanupFailure = error;
        }
      }
    }
    if (cleanupFailure !== null) throw cleanupFailure;
  }, 30_000);

  it("launches the resolved verified file after its original junction is redirected", async () => {
    const goodDirectory = join(root, "good-directory");
    const wrongDirectory = join(root, "wrong-directory");
    const link = join(root, "selected-directory");
    const sentinel = join(root, "junction-wrong-sentinel.txt");
    mkdirSync(goodDirectory);
    mkdirSync(wrongDirectory);
    const selectedName = "selected.exe";
    writeFileSync(join(goodDirectory, selectedName), readFileSync(goodPath));
    writeFileSync(join(wrongDirectory, selectedName), readFileSync(wrongPath));
    symlinkSync(goodDirectory, link, "junction");
    let redirected = false;

    const result = await runBoundedChild(join(link, selectedName), [sentinel], {
      exactExecutablePin: pin,
      timeoutMs: 15_000,
      maxStdoutBytes: 4_096,
      maxStderrBytes: 4_096,
      label: "junction-redirection exact executable",
      __testHooks: {
        postVerificationDelayMs: 2_000,
        onPinnedExecutableReady() {
          rmdirSync(link);
          symlinkSync(wrongDirectory, link, "junction");
          redirected = true;
        },
      },
    });

    expect(redirected).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(wrongDirectory));
    expect(result).toEqual({
      code: 0,
      signal: null,
      stdout: "GOOD",
      stderr: "",
      executableEvidence: pin,
    });
    expect(existsSync(sentinel)).toBe(false);
  }, 30_000);

  it("refuses a command-line exact mode whose JSON pin is absent", () => {
    const result = spawnSync(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        fileURLToPath(new URL("./windows-bounded-child.ps1", import.meta.url)),
        "-RequireExactPin",
        "-ExactByteLength",
        `${pin.byteLength}`,
        "-ExactDigest",
        pin.digest,
      ],
      {
        cwd: dirname(goodPath),
        input: JSON.stringify({ command: goodPath, arguments: [] }),
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("GOOD");
    expect(result.stderr).toMatch(/disagree/u);
  }, 20_000);

  it("creates no executable materialization or cleanup root", async () => {
    const before = readdirSync(root).filter((name) =>
      name.startsWith("lego-part-identification-claude-bin-"),
    );
    const externalSentinel = join(root, "external-sentinel.txt");
    writeFileSync(externalSentinel, "preserve");
    const result = await runBoundedChild(goodPath, [], {
      exactExecutablePin: pin,
      timeoutMs: 10_000,
      maxStdoutBytes: 4_096,
      maxStderrBytes: 4_096,
      label: "no-copy exact executable",
    });
    expect(result.stdout).toBe("GOOD");
    expect(readFileSync(externalSentinel, "utf8")).toBe("preserve");
    expect(
      readdirSync(root).filter((name) => name.startsWith("lego-part-identification-claude-bin-")),
    ).toEqual(before);
  }, 20_000);

  it("ignores a post-import SystemRoot redirect when selecting the trusted launcher", async () => {
    const originalSystemRoot = process.env.SystemRoot;
    const originalWindir = process.env.WINDIR;
    const attackerRoot = join(root, "attacker-system-root");
    mkdirSync(attackerRoot);
    process.env.SystemRoot = attackerRoot;
    try {
      const freshGoodPath = join(root, "fresh-trust-anchor-good.exe");
      copyFileSync(goodPath, freshGoodPath);
      const launchEnv = {};
      for (const [key, value] of Object.entries(process.env)) {
        const normalized = key.toLowerCase();
        if (normalized !== "systemroot" && normalized !== "windir") launchEnv[key] = value;
      }
      launchEnv.SystemRoot = originalSystemRoot ?? "C:\\Windows";
      launchEnv.WINDIR = originalWindir ?? launchEnv.SystemRoot;
      const result = await runBoundedChild(freshGoodPath, [], {
        exactExecutablePin: pin,
        timeoutMs: 10_000,
        maxStdoutBytes: 4_096,
        maxStderrBytes: 4_096,
        env: launchEnv,
        label: "trusted Windows launcher anchor",
      });
      expect(result.stdout).toBe("GOOD");
    } finally {
      if (originalSystemRoot === undefined) delete process.env.SystemRoot;
      else process.env.SystemRoot = originalSystemRoot;
    }
  }, 20_000);
});
