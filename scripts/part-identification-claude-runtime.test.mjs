import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertPinnedClaudeVersionResult,
  auditPartIdentificationTaskRoot,
  cleanupPartIdentificationTaskRoot,
  createPartIdentificationTaskRoot,
  __testOnly,
} from "./part-identification-claude-runtime.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
} from "./part-identification-transport-contract.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function temporaryRoot() {
  const value = join(tmpdir(), `lego-claude-runtime-${process.pid}-${Date.now()}-${roots.length}`);
  mkdirSync(value);
  roots.push(value);
  return value;
}

describe("pinned Claude runtime contract", () => {
  it("refuses an oversized rewritten task file and stops at one extra entry", () => {
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

  it("requires exact version output, success, and empty stderr", () => {
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

  it("derives only the pinned version-store path and ignores ambient PATH", () => {
    const profile = temporaryRoot();
    const binary = __testOnly.resolveClaudeBinaryWithPin(
      {
        USERPROFILE: profile,
        PATH: [join(profile, "hostile-a"), join(profile, "hostile-b")].join(";"),
      },
      {
        byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
        digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
      },
    );
    expect(binary).toEqual({
      path: join(profile, ".local", "share", "claude", "versions", "2.1.232"),
      exactExecutablePin: {
        byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
        digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
      },
      evidence: {
        byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
        digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
      },
    });
    expect(existsSync(join(profile, "hostile-a"))).toBe(false);
    expect(existsSync(join(profile, "hostile-b"))).toBe(false);
  });

  it("rejects inherited, accessor, malformed, and relative launch inputs", () => {
    const profile = temporaryRoot();
    const valid = {
      byteLength: 10,
      digest: `sha256:${"1".repeat(64)}`,
    };
    expect(() => __testOnly.resolveClaudeBinaryWithPin({ USERPROFILE: "relative" }, valid)).toThrow(
      /absolute/u,
    );
    expect(() =>
      __testOnly.resolveClaudeBinaryWithPin({ USERPROFILE: profile }, Object.create(valid)),
    ).toThrow(/exact SHA-256/u);
    const accessor = {};
    Object.defineProperty(accessor, "byteLength", { get: () => 10 });
    Object.defineProperty(accessor, "digest", { get: () => valid.digest });
    expect(() => __testOnly.resolveClaudeBinaryWithPin({ USERPROFILE: profile }, accessor)).toThrow(
      /exact SHA-256/u,
    );
  });

  it("cleans an exact ordinary task root after its files are removed", () => {
    const task = createPartIdentificationTaskRoot();
    roots.push(task.root);
    cleanupPartIdentificationTaskRoot(task.root, task.identity);
    expect(existsSync(task.root)).toBe(false);
    roots.pop();
  });

  it("serializes every cleanup file after ambient Array.join poisoning", () => {
    const code = `
      const runtime = await import(${JSON.stringify(new URL("./part-identification-claude-runtime.mjs", import.meta.url).href)});
      Array.prototype.join = () => "";
      const value = JSON.parse(runtime.__testOnly.windowsCleanupSpecification(
        "C:/task-root",
        { ino: 11n, dev: 22n },
        [
          { name: "request.json", bytes: Buffer.from("request") },
          { name: "mcp.json", bytes: Buffer.from("config") },
        ],
      ));
      if (value.files.length !== 2 || value.files[0].name !== "request.json" || value.files[1].name !== "mcp.json") process.exit(7);
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      windowsHide: true,
    });
    expect(child.status, child.stderr).toBe(0);
  });
});
