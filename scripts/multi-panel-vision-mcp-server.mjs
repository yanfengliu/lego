import { pathToFileURL } from "node:url";

import { readBoundedFile } from "./part-identification-io.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import {
  MultiPanelVisionError,
  MAX_MULTI_PANEL_REQUEST_BYTES,
  verifiedBytes,
  verifyMultiPanelRequest,
} from "./multi-panel-vision-contract.mjs";

export const BOUND_VISION_MCP_SERVER = "bound_vision";
export const BOUND_VISION_MCP_TOOL = "get_bound_visual_evidence";
export const BOUND_VISION_CLAUDE_TOOL = `mcp__${BOUND_VISION_MCP_SERVER}__${BOUND_VISION_MCP_TOOL}`;
export const MAX_BOUND_VISION_MCP_MESSAGES = 64;
export const MAX_BOUND_VISION_MCP_LINE_BYTES = 256 * 1024;
const MAX_BOUND_VISION_MCP_STDIN_BYTES =
  MAX_BOUND_VISION_MCP_MESSAGES * MAX_BOUND_VISION_MCP_LINE_BYTES;

const TOOL = Object.freeze({
  name: BOUND_VISION_MCP_TOOL,
  description:
    "Return the exact source-panel and candidate-prefix PNG pairs already bound by this immutable attempt. Call once. It exposes no paths, files, resources, prompts, or other tools.",
  inputSchema: Object.freeze({
    type: "object",
    properties: Object.freeze({}),
    additionalProperties: false,
  }),
});

const response = (id, result) => ({ jsonrpc: "2.0", id, result });
const errorResponse = (id, code, message) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

function exactNoArguments(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

export function boundVisionEvidenceContent(requestInput) {
  const request = verifyMultiPanelRequest(requestInput);
  return request.panels.flatMap((panel) => [
    {
      type: "text",
      text:
        `${panel.role} printed source, step ${panel.stepNumber}, deterministic face ${panel.candidateRender.panelFace}, ` +
        `digest ${panel.sourcePng.digest}`,
    },
    {
      type: "image",
      data: verifiedBytes(panel.sourcePng, `${panel.role} source`).toString("base64"),
      mimeType: "image/png",
    },
    {
      type: "text",
      text: `${panel.role} candidate prefix through step ${panel.candidateRender.prefixThroughStep}, digest ${panel.candidateRender.png.digest}`,
    },
    {
      type: "image",
      data: verifiedBytes(panel.candidateRender.png, `${panel.role} candidate render`).toString(
        "base64",
      ),
      mimeType: "image/png",
    },
  ]);
}

/** One-state MCP handler: one no-argument image tool and no ambient capability. */
export function createBoundVisionMcpHandler(requestInput) {
  const request = verifyMultiPanelRequest(requestInput);
  let called = false;
  return (message) => {
    const id = message?.id ?? null;
    if (message?.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return errorResponse(id, -32600, "Expected one JSON-RPC 2.0 request object.");
    }
    if (message.method.startsWith("notifications/")) return null;
    if (message.method === "initialize") {
      return response(id, {
        protocolVersion: message.params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "lego-bound-vision", version: "1" },
      });
    }
    if (message.method === "ping") return response(id, {});
    if (message.method === "tools/list") {
      return response(id, { tools: [TOOL] });
    }
    if (message.method !== "tools/call") {
      return errorResponse(id, -32601, `Method ${JSON.stringify(message.method)} is not exposed.`);
    }
    if (
      message.params?.name !== BOUND_VISION_MCP_TOOL ||
      !exactNoArguments(message.params?.arguments)
    ) {
      return errorResponse(
        id,
        -32602,
        `${BOUND_VISION_MCP_TOOL} is the only tool and requires exactly an empty object.`,
      );
    }
    if (called) {
      return errorResponse(
        id,
        -32000,
        "The bound visual evidence was already returned once; repeated reads are refused.",
      );
    }
    called = true;
    return response(id, { content: boundVisionEvidenceContent(request), isError: false });
  };
}

export function loadBoundVisionRequest(bundlePath) {
  const bytes = readBoundedFile(bundlePath, {
    label: "Bound multi-panel MCP request",
    maxBytes: MAX_MULTI_PANEL_REQUEST_BYTES,
  });
  let request;
  try {
    request = parseStrictJsonBytes(bytes);
  } catch (cause) {
    throw new MultiPanelVisionError(
      `Bound MCP request is not strict JSON: ${cause instanceof Error ? cause.message : String(cause)}.`,
    );
  }
  return verifyMultiPanelRequest(request);
}

function bundleArgument(argv) {
  if (argv.length !== 2 || argv[0] !== "--bundle" || typeof argv[1] !== "string") {
    throw new MultiPanelVisionError(
      "Bound vision MCP server requires exactly --bundle <prevalidated-request.json>.",
    );
  }
  return argv[1];
}

export async function* boundedMcpInputLines(input) {
  let pending = Buffer.alloc(0);
  let totalBytes = 0;
  for await (const chunk of input) {
    const held = Buffer.from(chunk);
    totalBytes += held.length;
    if (totalBytes > MAX_BOUND_VISION_MCP_STDIN_BYTES) {
      throw new MultiPanelVisionError(
        `Bound vision MCP stdin exceeded ${MAX_BOUND_VISION_MCP_STDIN_BYTES} bytes.`,
      );
    }
    pending = Buffer.concat([pending, held]);
    let newline;
    while ((newline = pending.indexOf(0x0a)) !== -1) {
      const line = pending.subarray(0, newline);
      if (line.length > MAX_BOUND_VISION_MCP_LINE_BYTES) {
        throw new MultiPanelVisionError(
          `Bound vision MCP JSON line exceeded ${MAX_BOUND_VISION_MCP_LINE_BYTES} bytes.`,
        );
      }
      yield line;
      pending = pending.subarray(newline + 1);
    }
    if (pending.length > MAX_BOUND_VISION_MCP_LINE_BYTES) {
      throw new MultiPanelVisionError(
        `Bound vision MCP JSON line exceeded ${MAX_BOUND_VISION_MCP_LINE_BYTES} bytes.`,
      );
    }
  }
  if (pending.length > 0) yield pending;
}

export async function main(argv = process.argv.slice(2)) {
  const handler = createBoundVisionMcpHandler(loadBoundVisionRequest(bundleArgument(argv)));
  let messageCount = 0;
  for await (const line of boundedMcpInputLines(process.stdin)) {
    if (line.toString("utf8").trim().length === 0) continue;
    messageCount += 1;
    if (messageCount > MAX_BOUND_VISION_MCP_MESSAGES) {
      throw new MultiPanelVisionError(
        `Bound vision MCP received more than ${MAX_BOUND_VISION_MCP_MESSAGES} messages.`,
      );
    }
    let message;
    try {
      message = parseStrictJsonBytes(line);
    } catch (cause) {
      process.stdout.write(
        `${JSON.stringify(errorResponse(null, -32700, `Invalid JSON: ${cause.message}.`))}\n`,
      );
      continue;
    }
    const held = handler(message);
    if (held !== null) process.stdout.write(`${JSON.stringify(held)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
