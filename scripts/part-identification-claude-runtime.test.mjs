import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  auditPartIdentificationTaskRoot,
  assertClaudeBinaryStable,
  assertPinnedClaudeVersionResult,
  createPartIdentificationTaskRoot,
  resolveClaudeBinary,
} from "./part-identification-claude-runtime.mjs";
import { PART_IDENTIFICATION_CLAUDE_CLI_VERSION } from "./part-identification-transport-contract.mjs";

const roots = [];
afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});
function root() {
  const value = join(tmpdir(), `lego-claude-runtime-${process.pid}-${Date.now()}-${roots.length}`);
  mkdirSync(value);
  roots.push(value);
  return value;
}
const executableName = process.platform === "win32" ? "claude.exe" : "claude";

describe("pinned Claude runtime identity", () => {
  it("refuses an oversized rewritten task file before reading it and stops at one extra entry", () => {
    const oversized = createPartIdentificationTaskRoot();
    roots.push(oversized.root);
    const requestBytes = Buffer.from("bound request");
    const configBytes = Buffer.from("bound config");
    writeFileSync(join(oversized.root, "request.json"), Buffer.alloc(1024 * 1024, 0x78));
    writeFileSync(join(oversized.root, "mcp.json"), configBytes);
    expect(() =>
      auditPartIdentificationTaskRoot(oversized.root, oversized.identity, [
        { name: "request.json", bytes: requestBytes },
        { name: "mcp.json", bytes: configBytes },
      ]),
    ).toThrow(/changed type or size/u);

    const extra = createPartIdentificationTaskRoot();
    roots.push(extra.root);
    writeFileSync(join(extra.root, "request.json"), requestBytes);
    writeFileSync(join(extra.root, "mcp.json"), configBytes);
    writeFileSync(join(extra.root, "child-created.py"), "unexpected");
    expect(() =>
      auditPartIdentificationTaskRoot(extra.root, extra.identity, [
        { name: "request.json", bytes: requestBytes },
        { name: "mcp.json", bytes: configBytes },
      ]),
    ).toThrow(/more than 2 entries/u);
  });

  it("requires the exact version output and empty stderr", () => {
    expect(
      assertPinnedClaudeVersionResult({
        code: 0,
        signal: null,
        stdout: `${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\n`,
        stderr: "",
      }),
    ).toBe(PART_IDENTIFICATION_CLAUDE_CLI_VERSION);
    for (const result of [
      { code: 0, signal: null, stdout: "2.1.231 (Claude Code)\n", stderr: "" },
      { code: 0, signal: null, stdout: ` ${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\n`, stderr: "" },
      { code: 0, signal: null, stdout: `${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\n`, stderr: "x" },
      { code: 1, signal: null, stdout: `${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\n`, stderr: "" },
    ]) {
      expect(() => assertPinnedClaudeVersionResult(result)).toThrow(/exactly/u);
    }
  });

  it("rejects a wrong ordinary binary, command shim, and symlink candidate", () => {
    const wrongRoot = root();
    writeFileSync(join(wrongRoot, executableName), "not the pinned binary");
    expect(() => resolveClaudeBinary({ PATH: wrongRoot })).toThrow(/Could not resolve/u);
    if (process.platform === "win32") {
      const shimRoot = root();
      writeFileSync(join(shimRoot, "claude.cmd"), "@echo wrong");
      expect(() => resolveClaudeBinary({ PATH: shimRoot })).toThrow(/Could not resolve/u);
    }
    const linkRoot = root();
    const target = join(linkRoot, "target.bin");
    writeFileSync(target, "target");
    try {
      symlinkSync(target, join(linkRoot, executableName), "file");
      expect(() => resolveClaudeBinary({ PATH: linkRoot })).toThrow(/Could not resolve/u);
    } catch (error) {
      if (error.code !== "EPERM" || process.platform !== "win32") throw error;
      const actual = join(linkRoot, "actual-bin");
      const linked = join(linkRoot, "linked-bin");
      mkdirSync(actual);
      writeFileSync(join(actual, executableName), "target");
      symlinkSync(actual, linked, "junction");
      expect(() => resolveClaudeBinary({ PATH: linked })).toThrow(/Could not resolve/u);
    }
  });

  it("detects path metadata replacement around a held descriptor", () => {
    const out = root();
    const path = join(out, "held.bin");
    writeFileSync(path, "held bytes");
    const descriptor = openSync(path, "r");
    try {
      const stats = fstatSync(descriptor, { bigint: true });
      const binary = {
        path,
        descriptor,
        identity: {
          dev: stats.dev,
          ino: stats.ino,
          size: stats.size,
          mtimeNs: stats.mtimeNs,
          ctimeNs: stats.ctimeNs,
        },
      };
      expect(() => assertClaudeBinaryStable(binary)).not.toThrow();
      const changed = new Date(Date.now() + 10_000);
      utimesSync(path, changed, changed);
      expect(() => assertClaudeBinaryStable(binary)).toThrow(
        /changed identity or content metadata/u,
      );
    } finally {
      closeSync(descriptor);
    }
  });
});
