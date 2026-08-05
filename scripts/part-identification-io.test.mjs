import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  MAX_NODE_TIMER_MS,
  readBoundedFile,
  readContainedFile,
  runBoundedChild,
  sameFileIdentity,
  writeContainedFile,
} from "./part-identification-io.mjs";
import { writeNestedArtifact } from "./part-identification.mjs";
import { processExists } from "./part-identification-test-fixture.mjs";

describe("part-identification contained filesystem and child boundary", () => {
  it("publishes nested artifacts atomically and refuses traversal or oversized reads", () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-contained-artifact-"));
    try {
      writeNestedArtifact(directory, "tiles/callout/crop.png", Buffer.from("first"));
      writeNestedArtifact(directory, "tiles/callout/crop.png", Buffer.from("bound tile"));
      expect(readContainedFile(directory, "tiles/callout/crop.png").toString("utf8")).toBe(
        "bound tile",
      );
      expect(readdirSync(join(directory, "tiles", "callout"))).toEqual(["crop.png"]);
      expect(() => writeContainedFile(directory, "../escaped.txt", "no")).toThrow(
        /parent-directory segment/,
      );
      expect(() => readContainedFile(directory, "..\\escaped.txt")).toThrow(
        /canonical forward-slash relative path/,
      );
      expect(() =>
        readBoundedFile(join(directory, "tiles", "callout", "crop.png"), { maxBytes: 4 }),
      ).toThrow(/above the 4-byte input limit/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("treats a zero device id as unavailable while retaining inode identity", () => {
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44, ino: 123 })).toBe(true);
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44n, ino: 123n })).toBe(true);
    expect(sameFileIdentity({ dev: 44, ino: 123 }, { dev: 0, ino: 123 })).toBe(true);
    expect(sameFileIdentity({ dev: 44, ino: 123 }, { dev: 55, ino: 123 })).toBe(false);
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44, ino: 124 })).toBe(false);
    expect(sameFileIdentity({ dev: 0, ino: 0 }, { dev: 0, ino: 0 })).toBe(false);
  });

  it("rejects timer-overflow deadlines before spawning a child", async () => {
    const spawnImpl = vi.fn();
    await expect(
      runBoundedChild("never-spawned", [], {
        timeoutMs: MAX_NODE_TIMER_MS + 1,
        spawnImpl,
        label: "overflow-deadline child",
      }),
    ).rejects.toThrow(/no larger than 2147483647/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("rejects a pre-existing linked input or output component", () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-contained-link-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-contained-outside-"));
    try {
      writeFileSync(join(outside, "crop.png"), "outside");
      let linked = false;
      try {
        symlinkSync(outside, join(directory, "linked"), "junction");
        linked = true;
      } catch {
        // Some Windows policies forbid junction creation. Other containment tests still run.
      }
      if (linked) {
        expect(() => readContainedFile(directory, "linked/crop.png")).toThrow(
          /resolves outside declared root|crosses symbolic-link or junction/,
        );
        expect(() => writeContainedFile(directory, "linked/new.png", "no")).toThrow(
          /ordinary directory|symbolic-link or junction|linked, junction/,
        );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects a linked declared root instead of redefining containment through it", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-linked-root-parent-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-linked-root-outside-"));
    const linkedRoot = join(parent, "declared-root");
    try {
      try {
        symlinkSync(outside, linkedRoot, "junction");
      } catch {
        return;
      }
      expect(() => writeContainedFile(linkedRoot, "escaped.txt", "no")).toThrow(
        /Linked and junction-backed roots|crosses linked, junction/,
      );
      expect(existsSync(join(outside, "escaped.txt"))).toBe(false);
      expect(() => readContainedFile(linkedRoot, "anything.txt")).toThrow(
        /Linked and junction-backed roots|crosses linked, junction/,
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects an ordinary replacement root installed after contained-read preflight", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-contained-read-swap-"));
    const root = join(parent, "root");
    const moved = join(parent, "original-root");
    mkdirSync(root);
    writeFileSync(join(root, "crop.png"), "authenticated-original");
    let swapped = false;
    try {
      expect(() =>
        readContainedFile(root, "crop.png", {
          __testHooks: {
            afterPreflight: () => {
              renameSync(root, moved);
              mkdirSync(root);
              writeFileSync(join(root, "crop.png"), "attacker-replacement");
              swapped = true;
            },
          },
        }),
      ).toThrow(/ancestor.*changed identity|changed identity.*containment preflight/);
      expect(swapped).toBe(true);
      expect(readFileSync(join(root, "crop.png"), "utf8")).toBe("attacker-replacement");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects an ordinary replacement candidate installed after contained-read preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-contained-file-swap-"));
    const candidate = join(root, "crop.png");
    const moved = join(root, "authenticated-original.png");
    writeFileSync(candidate, "authenticated-original");
    try {
      expect(() =>
        readContainedFile(root, "crop.png", {
          __testHooks: {
            afterPreflight: () => {
              renameSync(candidate, moved);
              writeFileSync(candidate, "attacker-replacement");
            },
          },
        }),
      ).toThrow(/changed identity or content metadata after containment preflight/);
      expect(readFileSync(candidate, "utf8")).toBe("attacker-replacement");
      expect(readFileSync(moved, "utf8")).toBe("authenticated-original");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never path-unlinks an attacker replacement during failed publication cleanup", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-exact-cleanup-race-"));
    const moved = join(root, "publisher-file-zeroed.tmp");
    let replacementPath = null;
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterTemporaryWrite: () => {
              throw new Error("forced publication failure");
            },
            beforeExactCleanup: ({ path }) => {
              replacementPath = path;
              renameSync(path, moved);
              writeFileSync(path, "attacker-owned");
            },
          },
        }),
      ).toThrow(/forced publication failure/);
      expect(readFileSync(replacementPath, "utf8")).toBe("attacker-owned");
      expect(readFileSync(moved)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("deletes the exact scrubbed publisher file through its Windows handle", () => {
    if (process.platform !== "win32") return;
    const root = mkdtempSync(join(tmpdir(), "lego-exact-cleanup-success-"));
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterTemporaryWrite: () => {
              throw new Error("forced exact cleanup");
            },
          },
        }),
      ).toThrow(/forced exact cleanup/);
      expect(readdirSync(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves an attacker replacement installed after publication rename", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-published-cleanup-race-"));
    const candidate = join(root, "result.bin");
    const moved = join(root, "publisher-file-zeroed.bin");
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterRename: () => {
              renameSync(candidate, moved);
              writeFileSync(candidate, "attacker-owned");
            },
          },
        }),
      ).toThrow(/published path does not retain|ancestor.*changed|could not remove/s);
      expect(readFileSync(candidate, "utf8")).toBe("attacker-owned");
      expect(readFileSync(moved)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never unlinks an attacker path or leaves task bytes after a real post-rename root swap", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-contained-after-rename-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-contained-attacker-"));
    const root = join(parent, "root");
    const moved = join(parent, "moved-root");
    mkdirSync(root);
    writeFileSync(join(outside, "published.txt"), "attacker-owned");
    let rootMoved = false;
    let failure = null;
    try {
      try {
        writeContainedFile(root, "published.txt", "task-secret", {
          __testHooks: {
            afterRename: () => {
              try {
                renameSync(root, moved);
                rootMoved = true;
                symlinkSync(outside, root, "junction");
              } catch {
                // Windows may refuse the directory rename while the exact file handle is open.
              }
            },
          },
        });
      } catch (error) {
        failure = error;
      }
      expect(readFileSync(join(outside, "published.txt"), "utf8")).toBe("attacker-owned");
      if (rootMoved) {
        expect(failure).toBeInstanceOf(Error);
        expect(readFileSync(join(moved, "published.txt"))).toHaveLength(0);
      } else {
        expect(failure).toBeNull();
        expect(readFileSync(join(root, "published.txt"), "utf8")).toBe("task-secret");
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it(
    "terminates output-flooding children and their exact descendant tree",
    { timeout: 30_000 },
    async () => {
      await expect(
        runBoundedChild(process.execPath, ["-e", "process.stdout.write(Buffer.from([0xff]))"], {
          timeoutMs: 5_000,
          maxStdoutBytes: 64,
          maxStderrBytes: 64,
          label: "malformed-output child",
        }),
      ).rejects.toThrow(/malformed UTF-8 on stdout/);

      await expect(
        runBoundedChild(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"], {
          timeoutMs: 5_000,
          maxStdoutBytes: 64,
          maxStderrBytes: 64,
          label: "output-flood child",
        }),
      ).rejects.toThrow(/64-byte stdout limit.*terminated/);

      const directory = mkdtempSync(join(tmpdir(), "lego-child-tree-"));
      const pidPath = join(directory, "descendant.pid");
      const parentProgram = [
        "const {spawn}=require('node:child_process');",
        "const {writeFileSync}=require('node:fs');",
        "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});",
        "writeFileSync(process.argv[1],String(child.pid));",
        "setInterval(()=>{},1000);",
      ].join("");
      try {
        await expect(
          runBoundedChild(process.execPath, ["-e", parentProgram, pidPath], {
            timeoutMs: 2_000,
            maxStdoutBytes: 1_024,
            maxStderrBytes: 1_024,
            label: "descendant-owning child",
          }),
        ).rejects.toThrow(/2000 ms execution limit.*terminated/);
        expect(existsSync(pidPath)).toBe(true);
        const descendantPid = Number(readFileSync(pidPath, "utf8"));
        for (let attempt = 0; attempt < 20 && processExists(descendantPid); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(processExists(descendantPid)).toBe(false);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it(
    "closes a Windows Job Object around a detached grandchild after its intermediary exits",
    { timeout: 30_000 },
    async () => {
      if (process.platform !== "win32") return;
      const directory = mkdtempSync(join(tmpdir(), "lego-detached-grandchild-"));
      const pidPath = join(directory, "grandchild.pid");
      const intermediary = [
        "const {spawn}=require('node:child_process');",
        "const {writeFileSync}=require('node:fs');",
        "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});",
        "writeFileSync(process.argv[1],String(child.pid));",
        "child.unref();",
      ].join("");
      try {
        const result = await runBoundedChild(process.execPath, ["-e", intermediary, pidPath], {
          timeoutMs: 5_000,
          maxStdoutBytes: 1_024,
          maxStderrBytes: 4_096,
          label: "short-lived descendant intermediary",
        });
        expect(result.code).toBe(0);
        expect(existsSync(pidPath)).toBe(true);
        const descendantPid = Number(readFileSync(pidPath, "utf8"));
        for (let attempt = 0; attempt < 40 && processExists(descendantPid); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(processExists(descendantPid)).toBe(false);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
