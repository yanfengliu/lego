import { existsSync, readFileSync, rmSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import {
  ClaudeBoundVisionError,
  BOUND_VISION_SYSTEM_PROMPT,
  createClaudeBoundVisionAdapter,
  parseClaudeBoundVisionStream,
  readTransportTraceBytes,
} from "./multi-panel-vision-claude-adapter.mjs";
import { createMultiPanelRequest } from "./multi-panel-vision-contract.mjs";
import {
  BOUND_VISION_CLAUDE_TOOL,
  BOUND_VISION_MCP_SERVER,
  boundVisionEvidenceContent,
  loadBoundVisionRequest,
} from "./multi-panel-vision-mcp-server.mjs";
import {
  modelCallForMultiPanelRequest,
  runMultiPanelVisionCheck,
  verifyMultiPanelVisionResult,
} from "./multi-panel-vision-checker.mjs";
import { step4Input } from "./multi-panel-vision-test-fixture.mjs";

function stream(request, overrides = {}) {
  const toolName = overrides.toolName ?? BOUND_VISION_CLAUDE_TOOL;
  const toolUseId = overrides.toolUseId ?? "tool-use-1";
  const events = [
    {
      type: "assistant",
      message: { content: [{ type: "tool_use", id: toolUseId, name: toolName, input: {} }] },
    },
    ...(!overrides.omitToolResult
      ? [
          {
            type: "user",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUseId,
                  is_error: false,
                  content: overrides.toolContent ?? boundVisionEvidenceContent(request),
                },
              ],
            },
          },
        ]
      : []),
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result: overrides.result ?? '{"verdict":"same","reason":"layer"}',
      modelUsage: {
        [PART_IDENTIFICATION_MODEL_ID]: {
          canonicalModel: "claude-opus-5",
          provider: "firstParty",
        },
      },
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30,
        output_tokens: 12,
      },
      total_cost_usd: 0.012345,
    },
  ];
  if (overrides.duplicateToolUse) events.splice(1, 0, events[0]);
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

describe("Claude stream-json evidence parsing", () => {
  it("retains the one MCP tool boundary, pinned model, strict answer, and complete usage", () => {
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:stream-parser",
    });
    const parsed = parseClaudeBoundVisionStream(Buffer.from(stream(request), "utf8"), request, 456);
    expect(parsed.modelIdentity.requestedModelId).toBe(PART_IDENTIFICATION_MODEL_ID);
    expect(parsed.rawResponseBytes.toString("utf8")).toBe('{"verdict":"same","reason":"layer"}');
    expect(parsed.usage).toEqual({
      inputTokens: 150,
      outputTokens: 12,
      costMicrousd: 12_345,
      elapsedMs: 456,
    });
  });

  it("refuses an unbound tool, duplicate call, missing tool result, or non-schema answer", () => {
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:stream-refusal",
    });
    for (const held of [
      stream(request, { toolName: "Read" }),
      stream(request, { duplicateToolUse: true }),
      stream(request, { omitToolResult: true }),
      stream(request, { result: '{"verdict":"yes","reason":"layer"}' }),
    ]) {
      expect(() => parseClaudeBoundVisionStream(Buffer.from(held), request, 1)).toThrow(
        ClaudeBoundVisionError,
      );
    }
  });

  it("refuses a successful tool result carrying pixels from another bound request", () => {
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:stream-right-images",
    });
    const other = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:stream-wrong-images",
      panelN: {
        ...step4Input().panelN,
        sourcePngBytes: Buffer.from(request.panels[1].sourcePng.base64, "base64"),
      },
    });
    expect(() =>
      parseClaudeBoundVisionStream(
        Buffer.from(stream(request, { toolContent: boundVisionEvidenceContent(other) }), "utf8"),
        request,
        1,
      ),
    ).toThrow(/does not reproduce the exact bound/u);
  });
});

describe("the subscription-CLI adapter", () => {
  it("disables ambient tools, serves one validated bundle, retains the raw trace, and cleans up", async () => {
    let taskRoot;
    const runChild = vi.fn(async (_command, args, options) => {
      taskRoot = options.cwd;
      expect(args).toContain("--tools=");
      expect(args).toContain("--setting-sources=");
      expect(args).toContain("--strict-mcp-config");
      expect(args.slice(args.indexOf("--max-turns"), args.indexOf("--max-turns") + 2)).toEqual([
        "--max-turns",
        "2",
      ]);
      expect(args).toContain("--no-session-persistence");
      expect(args).toContain("--disable-slash-commands");
      expect(args).toContain("--safe-mode");
      expect(args).toContain(BOUND_VISION_CLAUDE_TOOL);
      expect(args.join(" ")).not.toMatch(/--allowedTools\s+(?:Read|Bash|Edit|WebFetch)/u);
      expect(args[args.indexOf("--system-prompt") + 1]).toBe(BOUND_VISION_SYSTEM_PROMPT);
      expect(options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
      expect(options.env.UNRELATED_REPOSITORY_SECRET).toBeUndefined();

      const configPath = args[args.indexOf("--mcp-config") + 1];
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(Object.keys(config.mcpServers)).toEqual([BOUND_VISION_MCP_SERVER]);
      expect(config.mcpServers[BOUND_VISION_MCP_SERVER].args.slice(-2, -1)).toEqual(["--bundle"]);
      const bundlePath = config.mcpServers[BOUND_VISION_MCP_SERVER].args.at(-1);
      const request = loadBoundVisionRequest(bundlePath);
      return { code: 0, stdout: stream(request), stderr: "" };
    });
    const result = await runMultiPanelVisionCheck(
      step4Input(),
      createClaudeBoundVisionAdapter({
        runChild,
        command: "claude-test-double",
        environment: { ...process.env, UNRELATED_REPOSITORY_SECRET: "must-not-cross" },
      }),
    );
    expect(result.outcome).toBe("corroborated");
    expect(() => verifyMultiPanelVisionResult(result)).not.toThrow();
    const trace = JSON.parse(readTransportTraceBytes(result.attempts[0]).toString("utf8"));
    expect(trace.schemaVersion).toBe("lego.multi-panel-claude-transport/1");
    expect(Buffer.from(trace.stdout.base64, "base64").toString("utf8")).toBe(
      stream(result.attempts[0].request),
    );
    expect(trace.cliContract).toMatchObject({
      builtInTools: "disabled",
      settingSources: "disabled",
      strictMcpConfig: true,
      allowedTool: BOUND_VISION_CLAUDE_TOOL,
      safeMode: true,
      cwd: "task-owned-temporary-root",
    });
    expect(trace.cliContract.environmentKeys).not.toContain("UNRELATED_REPOSITORY_SECRET");
    expect(runChild).toHaveBeenCalledOnce();
    expect(taskRoot).toBeDefined();
    expect(existsSync(taskRoot)).toBe(false);
  });

  it("binds the same request passed to the model call", () => {
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:adapter-contract",
    });
    const call = modelCallForMultiPanelRequest(request);
    expect(call.request).toBe(request);
    expect(call.instructionBytes.toString("utf8")).toBe(
      `${call.promptBytes.toString("utf8")}\n\n${call.briefBytes.toString("utf8")}`,
    );
  });

  it.each([
    ["attempt id", (call) => ({ ...call, attemptId: "attempt:mutated" })],
    ["request digest", (call) => ({ ...call, requestDigest: `sha256:${"0".repeat(64)}` })],
    [
      "model identity",
      (call) => ({ ...call, modelIdentity: { ...call.modelIdentity, provider: "fallback" } }),
    ],
  ])("refuses a mutated redundant %s before launching a child", async (_label, mutate) => {
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:adapter-mutation",
    });
    const runChild = vi.fn();
    const adapter = createClaudeBoundVisionAdapter({ runChild });
    await expect(adapter(mutate(modelCallForMultiPanelRequest(request)))).rejects.toThrow(
      /does not reproduce its verified request/u,
    );
    expect(runChild).not.toHaveBeenCalled();
  });

  it("attaches a cleanup fault to a primary call error and leaves no exact temp root", async () => {
    let taskRoot;
    const runChild = vi.fn(async (_command, _args, options) => {
      taskRoot = options.cwd;
      return { code: 17, stdout: "", stderr: "provider unavailable" };
    });
    const cleanup = vi.fn((root) => {
      rmSync(root, { recursive: true, force: true });
      throw new Error("cleanup sentinel after removal");
    });
    const request = createMultiPanelRequest({
      ...step4Input(),
      attemptId: "attempt:adapter-cleanup-fault",
    });
    await expect(
      createClaudeBoundVisionAdapter({ runChild, cleanup })(modelCallForMultiPanelRequest(request)),
    ).rejects.toThrow(/call failed and its exact task-root cleanup also failed/u);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(taskRoot).toBeDefined();
    expect(existsSync(taskRoot)).toBe(false);
  });
});
