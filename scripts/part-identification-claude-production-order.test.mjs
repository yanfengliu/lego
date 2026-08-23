import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  events: [],
  request: null,
  root: null,
  ticket: Object.freeze(Object.create(null)),
}));

vi.mock("./part-identification-mcp-server.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createPartIdentificationMcpRequest(input) {
      const request = actual.createPartIdentificationMcpRequest(input);
      boundary.request = request;
      return request;
    },
  };
});

vi.mock("./part-identification-gate0-store.mjs", () => ({
  assertPartIdentificationGate0AdmissionCapability(value) {
    boundary.events.push("assert-admission");
    return value;
  },
  consumePartIdentificationGate0Admission() {
    boundary.events.push("consume");
    return boundary.ticket;
  },
  claimPartIdentificationGate0Launch() {
    boundary.events.push("claim");
    return { request: boundary.request };
  },
  revalidatePartIdentificationGate0Launch() {
    boundary.events.push("revalidate");
  },
  settlePartIdentificationGate0Launch(_ticket, settlement) {
    boundary.events.push(`settle:${settlement.evidence}`);
  },
}));

vi.mock("./part-identification-claude-runtime.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveClaudeBinary() {
      return {
        path: "C:/pinned/claude-test-double.exe",
        exactExecutablePin: {
          byteLength: 319_026_336,
          digest: "sha256:ec9e32479bc887809003c91384c6c3a26e7691856d1916f72f6f6d21800f3bd6",
        },
      };
    },
  };
});

vi.mock("./part-identification-io.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    async runBoundedChild(_command, args, options) {
      boundary.root = options.cwd;
      const entries = readdirSync(options.cwd).sort();
      if (args.length === 1 && args[0] === "--version") {
        boundary.events.push(`preflight:${entries.join("|")}`);
        return {
          code: 0,
          signal: null,
          stdout: "2.1.232 (Claude Code)\n",
          stderr: "",
          executableEvidence: {
            byteLength: 319_026_336,
            digest: "sha256:ec9e32479bc887809003c91384c6c3a26e7691856d1916f72f6f6d21800f3bd6",
          },
        };
      }
      boundary.events.push(`provider:${entries.join("|")}`);
      throw new Error("synthetic provider child stop");
    },
  };
});

import {
  createPartIdentificationProofBudget,
  runPartIdentificationClaudeTransport,
} from "./part-identification-claude-transport.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";

const image = Buffer.from("89504e470d0a1a0a0102", "hex");
const digest = `sha256:${createHash("sha256").update(image).digest("hex")}`;

beforeEach(() => {
  boundary.events.length = 0;
  boundary.request = null;
  boundary.root = null;
});

describe("native Gate-0 Claude launch order", () => {
  it("claims first, preflights in an empty root, then revalidates immediately before payload launch", async () => {
    const admission = Object.freeze(Object.create(null));
    await expect(
      runPartIdentificationClaudeTransport({
        cardIds: ["card-0000"],
        images: new Map([["card-0000", image]]),
        digests: new Map([["card-0000", digest]]),
        cardsDigest: `sha256:${"a".repeat(64)}`,
        model: PART_IDENTIFICATION_MODEL_ID,
        proofBudget: createPartIdentificationProofBudget(),
        gate0Admission: admission,
      }),
    ).rejects.toThrow(/synthetic provider child stop/u);

    expect(boundary.events).toEqual([
      "assert-admission",
      "consume",
      "claim",
      "preflight:",
      "revalidate",
      "provider:mcp.json|request.json",
      "settle:provider-launch",
    ]);
    expect(boundary.root).not.toBeNull();
    expect(existsSync(boundary.root)).toBe(false);
  });
});
