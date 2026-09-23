import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeOrResumeRealBuildPrefix50Step44ExactArtifact } from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-files";

const roots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];
const POWERSHELL = join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function artifact(root: string, path = "receipt.json") {
  return { root, path, bytes: Buffer.from("AAAA"), label: "atomic adversarial receipt" };
}

function temporaryName(path: string, bytes: Uint8Array): string {
  return `.${path}.tmp-${sha256(bytes)}`;
}

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (!existsSync(path) && Date.now() < deadline)
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  if (!existsSync(path)) throw new Error(`child did not publish readiness file ${path}`);
}

function waitForFileSync(path: string): void {
  const deadline = Date.now() + 30_000;
  const waitState = new Int32Array(new SharedArrayBuffer(4));
  while (!existsSync(path) && Date.now() < deadline) Atomics.wait(waitState, 0, 0, 10);
  if (!existsSync(path)) throw new Error(`child did not publish readiness file ${path}`);
}

async function killAfterFilesystemPhase(root: string, phase: "fsync" | "link"): Promise<void> {
  const value = artifact(root);
  const temporary = resolve(root, temporaryName(value.path, value.bytes));
  const final = resolve(root, value.path);
  const ready = resolve(root, `${phase}.ready`);
  const script = [
    "const fs=require('node:fs')",
    "const fd=fs.openSync(process.env.TEMPORARY,'wx+')",
    "const bytes=Buffer.from('AAAA')",
    "fs.writeSync(fd,bytes,0,bytes.length,0)",
    "fs.fsyncSync(fd)",
    "if(process.env.PHASE==='link')fs.linkSync(process.env.TEMPORARY,process.env.FINAL)",
    "fs.writeFileSync(process.env.READY,'READY')",
    "setInterval(()=>{},1000)",
  ].join(";");
  const child = spawn(process.execPath, ["-e", script], {
    env: { ...process.env, TEMPORARY: temporary, FINAL: final, READY: ready, PHASE: phase },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  await waitForFile(ready);
  child.kill("SIGKILL");
  await once(child, "exit");
  rmSync(ready);
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.stdin.end("STOP\n");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
      ]);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("contained atomic publication adversaries", () => {
  it("never accepts an equal-length post-publication mutation and runs descriptor hashing", async () => {
    const root = await temporaryRoot("lego-atomic-content-stress-");
    let contentPhases = 0;
    let acceptedCorruptFinals = 0;
    let blockedMutations = 0;
    for (let index = 0; index < 200; index += 1) {
      const value = artifact(root, `receipt-${index}.json`);
      try {
        writeOrResumeRealBuildPrefix50Step44ExactArtifact(value, {
          hooks: {
            write: {
              afterRename: () => {
                try {
                  writeFileSync(resolve(root, value.path), "BBBB");
                } catch (error) {
                  if ((error as NodeJS.ErrnoException).code === "EBUSY") blockedMutations += 1;
                  else throw error;
                }
              },
              beforeFinalDescriptorDigest: () => {
                contentPhases += 1;
              },
            },
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      const final = resolve(root, value.path);
      if (existsSync(final)) {
        if (readFileSync(final, "utf8") === "BBBB") acceptedCorruptFinals += 1;
        rmSync(final);
      }
    }
    expect(acceptedCorruptFinals).toBe(0);
    expect(contentPhases).toBeGreaterThanOrEqual(200);
    if (process.platform === "win32") expect(blockedMutations).toBe(200);
    expect(await readdir(root)).toEqual([]);
  });

  it("rolls back a link-to-unlink failure, preserves the exact temp, and resumes", async () => {
    const root = await temporaryRoot("lego-atomic-link-unlink-");
    const value = artifact(root);
    expect(() =>
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(value, {
        hooks: {
          write: {
            beforeTemporaryUnlink: () => {
              throw new Error("unlink seam");
            },
          },
        },
      }),
    ).toThrow(/unlink seam/u);
    expect(existsSync(resolve(root, value.path))).toBe(false);
    expect(readFileSync(resolve(root, temporaryName(value.path, value.bytes)))).toEqual(
      value.bytes,
    );
    writeOrResumeRealBuildPrefix50Step44ExactArtifact(value);
    expect(await readdir(root)).toEqual([value.path]);
  });

  it("recovers after real child termination following temp fsync and hard-link publication", async () => {
    for (const phase of ["fsync", "link"] as const) {
      const root = await temporaryRoot(`lego-atomic-kill-${phase}-`);
      const value = artifact(root);
      await killAfterFilesystemPhase(root, phase);
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(value);
      expect(await readdir(root)).toEqual([value.path]);
      expect(readFileSync(resolve(root, value.path))).toEqual(value.bytes);
    }
  });

  it("rejects wrong exact-name bytes, another digest temp, and a raced foreign final", async () => {
    const root = await temporaryRoot("lego-atomic-conflicts-");
    const value = artifact(root);
    const expectedTemporary = resolve(root, temporaryName(value.path, value.bytes));
    await writeFile(expectedTemporary, "BBBB");
    expect(() => writeOrResumeRealBuildPrefix50Step44ExactArtifact(value)).toThrow(
      /conflicts with the exact expected bytes/u,
    );
    await rm(expectedTemporary);
    const foreignTemporary = resolve(root, temporaryName(value.path, Buffer.from("BBBB")));
    await writeFile(foreignTemporary, "BBBB");
    expect(() => writeOrResumeRealBuildPrefix50Step44ExactArtifact(value)).toThrow(
      /conflicting deterministic temporary/u,
    );
    await rm(foreignTemporary);
    expect(() =>
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(value, {
        beforePublish: () => writeFileSync(resolve(root, value.path), "BBBB", { flag: "wx" }),
      }),
    ).toThrow(/target appeared concurrently|file already exists/u);
    expect(readFileSync(resolve(root, value.path), "utf8")).toBe("BBBB");
  });
});

describe.runIf(process.platform === "win32")("contained atomic Windows sharing", () => {
  it("rolls back the final and retains only the resumable temp under post-close delete denial", async () => {
    const root = await temporaryRoot("lego-atomic-post-close-delete-denial-");
    const control = await temporaryRoot("lego-atomic-post-close-control-");
    const value = artifact(root);
    const temporary = resolve(root, temporaryName(value.path, value.bytes));
    const final = resolve(root, value.path);
    const trigger = resolve(control, "trigger.txt");
    const ready = resolve(control, "ready.txt");
    const holder = spawn(
      POWERSHELL,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        [
          "$deadline=(Get-Date).AddSeconds(30)",
          "while(!(Test-Path -LiteralPath $env:TRIGGER)){if((Get-Date)-gt $deadline){exit 42};Start-Sleep -Milliseconds 5}",
          "$s=[IO.File]::Open($env:TARGET,'Open','Read','ReadWrite')",
          "[IO.File]::WriteAllText($env:READY,'READY')",
          "[Console]::In.ReadLine()|Out-Null",
          "$s.Dispose()",
        ].join(";"),
      ],
      {
        env: { ...process.env, TARGET: temporary, TRIGGER: trigger, READY: ready },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    children.push(holder);
    expect(() =>
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(value, {
        hooks: {
          write: {
            afterFinalDescriptorCloseBeforeTemporaryUnlink: () => {
              writeFileSync(trigger, "OPEN");
              waitForFileSync(ready);
            },
          },
        },
      }),
    ).toThrow(/EBUSY|could not roll back|could not safely remove/u);
    expect(existsSync(final)).toBe(false);
    expect(readFileSync(temporary)).toEqual(value.bytes);
    expect(await readdir(root)).toEqual([temporaryName(value.path, value.bytes)]);

    holder.stdin.end("RELEASE\n");
    await once(holder, "exit");
    writeOrResumeRealBuildPrefix50Step44ExactArtifact(value);
    expect(await readdir(root)).toEqual([value.path]);
    expect(readFileSync(final)).toEqual(value.bytes);
  });

  it("fails closed under a real delete-denying handle, then resumes after release", async () => {
    const root = await temporaryRoot("lego-atomic-delete-denial-");
    const value = artifact(root);
    const temporary = resolve(root, temporaryName(value.path, value.bytes));
    await writeFile(temporary, value.bytes);
    const holder = spawn(
      POWERSHELL,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        [
          "$s=[IO.File]::Open($env:TARGET,'Open','Read','ReadWrite')",
          "[Console]::Out.WriteLine('HELD');[Console]::Out.Flush()",
          "[Console]::In.ReadLine()|Out-Null;$s.Dispose()",
        ].join(";"),
      ],
      {
        env: { ...process.env, TARGET: temporary },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    children.push(holder);
    let ready = "";
    while (!ready.includes("HELD")) {
      const chunk = holder.stdout.read() as Buffer | null;
      if (chunk !== null) ready += chunk.toString("utf8");
      else await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
    expect(() => writeOrResumeRealBuildPrefix50Step44ExactArtifact(value)).toThrow(/EBUSY/u);
    expect(existsSync(resolve(root, value.path))).toBe(false);
    holder.stdin.end("RELEASE\n");
    await once(holder, "exit");
    writeOrResumeRealBuildPrefix50Step44ExactArtifact(value);
    expect(await readdir(root)).toEqual([value.path]);
  });
});
