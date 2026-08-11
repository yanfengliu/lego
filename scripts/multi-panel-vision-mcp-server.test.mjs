import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MAX_MULTI_PANEL_REQUEST_BYTES,
  canonicalJsonBytes,
  createMultiPanelRequest,
} from "./multi-panel-vision-contract.mjs";
import {
  BOUND_VISION_MCP_TOOL,
  MAX_BOUND_VISION_MCP_LINE_BYTES,
  boundedMcpInputLines,
  createBoundVisionMcpHandler,
  loadBoundVisionRequest,
} from "./multi-panel-vision-mcp-server.mjs";
import { panel, png, step4Input, step5Input } from "./multi-panel-vision-test-fixture.mjs";

const SERVER_PATH = fileURLToPath(new URL("./multi-panel-vision-mcp-server.mjs", import.meta.url));

const request4 = () =>
  createMultiPanelRequest({
    ...step4Input(),
    attemptId: "attempt:mcp:step-4",
  });

const request7 = () =>
  createMultiPanelRequest({
    ...step5Input(),
    attemptId: "attempt:mcp:step-5-through-7",
    panelK: panel(7),
  });

const rpc = (id, method, params = {}) => ({ jsonrpc: "2.0", id, method, params });

async function runServer(request, messages) {
  const root = mkdtempSync(join(tmpdir(), "lego-mcp-protocol-test-"));
  const bundlePath = join(root, "request.json");
  writeFileSync(bundlePath, canonicalJsonBytes(request), { flag: "wx" });
  const child = spawn(process.execPath, [SERVER_PATH, "--bundle", bundlePath], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  try {
    child.stdin.end(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("MCP subprocess did not close after stdin ended."));
      }, 5_000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (status) => {
        clearTimeout(timer);
        resolve(status);
      });
    });
    return {
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    };
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(root, { recursive: true, force: true });
  }
}

describe("the one-tool bound-image MCP handler", () => {
  it.each([
    [request4, ["source-4", "candidate-4", "source-5", "candidate-5"]],
    [request7, ["source-5", "candidate-5", "source-6", "candidate-6", "source-7", "candidate-7"]],
  ])("returns exact source/render images in panel order", (makeRequest, labels) => {
    const handler = createBoundVisionMcpHandler(makeRequest());
    const held = handler(rpc(1, "tools/call", { name: BOUND_VISION_MCP_TOOL, arguments: {} }));
    const images = held.result.content.filter(({ type }) => type === "image");
    expect(images.map(({ data }) => data)).toEqual(
      labels.map((label) => png(label).toString("base64")),
    );
    expect(images.every(({ mimeType }) => mimeType === "image/png")).toBe(true);
    const text = held.result.content
      .filter(({ type }) => type === "text")
      .map(({ text: line }) => line)
      .join("\n");
    expect(text).toContain("digest sha256:");
    expect(text).not.toMatch(/(?:[A-Za-z]:\\|(?:^|\s)\/[^/\s])/u);
    for (const panel of makeRequest().panels) {
      expect(text).not.toContain(panel.candidateRender.viewId);
      expect(text).not.toContain(panel.candidateRender.cameraId);
    }
  });

  it("lists one no-argument tool and exposes no resource method", () => {
    const handler = createBoundVisionMcpHandler(request4());
    const initialized = handler(rpc(1, "initialize", { protocolVersion: "2025-03-26" }));
    expect(initialized.result.capabilities).toEqual({ tools: { listChanged: false } });
    const listed = handler(rpc(2, "tools/list"));
    expect(listed.result.tools).toHaveLength(1);
    expect(listed.result.tools[0]).toMatchObject({
      name: BOUND_VISION_MCP_TOOL,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    });
    expect(handler(rpc(3, "resources/list")).error.code).toBe(-32601);
  });

  it("requires empty args, refuses the second read, and rejects every unknown method", () => {
    const handler = createBoundVisionMcpHandler(request4());
    expect(
      handler(rpc(1, "tools/call", { name: BOUND_VISION_MCP_TOOL, arguments: { path: "x" } })).error
        .code,
    ).toBe(-32602);
    expect(handler(rpc(2, "tools/call", { name: "Read", arguments: {} })).error.code).toBe(-32602);
    expect(
      handler(rpc(3, "tools/call", { name: BOUND_VISION_MCP_TOOL, arguments: {} })).result.isError,
    ).toBe(false);
    expect(
      handler(rpc(4, "tools/call", { name: BOUND_VISION_MCP_TOOL, arguments: {} })).error.code,
    ).toBe(-32000);
    expect(handler(rpc(5, "prompts/list")).error.code).toBe(-32601);
  });
});

describe("the stdio MCP boundary", () => {
  it("refuses an oversized JSON-RPC line before parsing or replying", async () => {
    const lines = boundedMcpInputLines(
      Readable.from([Buffer.alloc(MAX_BOUND_VISION_MCP_LINE_BYTES + 1, 0x20)]),
    );
    await expect(Array.fromAsync(lines)).rejects.toThrow(/JSON line exceeded/u);
  });

  it("serves the same one-tool protocol in a child process and exits on stdin close", async () => {
    const held = await runServer(request4(), [
      rpc(1, "initialize", { protocolVersion: "2025-03-26" }),
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      rpc(2, "tools/list"),
      rpc(3, "tools/call", { name: BOUND_VISION_MCP_TOOL, arguments: {} }),
    ]);
    expect(held.code).toBe(0);
    expect(held.stderr).toBe("");
    const replies = held.stdout
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    expect(replies.map(({ id }) => id)).toEqual([1, 2, 3]);
    const images = replies[2].result.content.filter(({ type }) => type === "image");
    expect(images.map(({ data }) => data)).toEqual(
      ["source-4", "candidate-4", "source-5", "candidate-5"].map((label) =>
        png(label).toString("base64"),
      ),
    );
  });

  it("refuses tampered and oversized bundles before exposing a tool", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-mcp-bundle-test-"));
    try {
      const tampered = JSON.parse(JSON.stringify(request4()));
      tampered.panels[0].sourcePng.base64 = png("tampered").toString("base64");
      const tamperedPath = join(root, "tampered.json");
      writeFileSync(tamperedPath, JSON.stringify(tampered));
      expect(() => loadBoundVisionRequest(tamperedPath)).toThrow(/content digest/u);

      const oversizedPath = join(root, "oversized.json");
      writeFileSync(oversizedPath, Buffer.alloc(MAX_MULTI_PANEL_REQUEST_BYTES + 1, 0x20));
      expect(() => loadBoundVisionRequest(oversizedPath)).toThrow(/input limit/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
