import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  partIdentificationGate0CanonicalJsonBytes,
  samePartIdentificationGate0CanonicalValue,
} from "./part-identification-gate0-json.mjs";

describe("unmocked Gate-0 adversarial boundaries", () => {
  it("canonicalizes ordinary object keys independently of insertion order", () => {
    const left = { z: 1, a: { second: 2, first: 1 } };
    const right = { a: { first: 1, second: 2 }, z: 1 };
    expect(samePartIdentificationGate0CanonicalValue(left, right)).toBe(true);
    expect(partIdentificationGate0CanonicalJsonBytes(left).toString("utf8")).toBe(
      '{"a":{"first":1,"second":2},"z":1}',
    );
  });

  it("rejects same-size substituted PNGs after ambient hash and toJSON poisoning", () => {
    const gate0Url = new URL("./part-identification-gate0.mjs", import.meta.url).href;
    const mcpUrl = new URL("./part-identification-mcp-server.mjs", import.meta.url).href;
    const modelUrl = new URL("./part-identification-model.mjs", import.meta.url).href;
    const transportUrl = new URL("./part-identification-transport-contract.mjs", import.meta.url)
      .href;
    const script = String.raw`
      const gate0 = await import(process.argv[1]);
      const mcp = await import(process.argv[2]);
      const model = await import(process.argv[3]);
      const transport = await import(process.argv[4]);
      const { createHash } = await import("node:crypto");
      const prototype = Object.getPrototypeOf(createHash("sha256"));
      Object.defineProperty(prototype, "digest", {
        configurable: true,
        value(encoding) {
          const fake = "0".repeat(64);
          return encoding === "hex" ? fake : Buffer.from(fake, "hex");
        },
      });
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value() { return { substituted: true }; },
      });
      const signature = Buffer.from("89504e470d0a1a0a", "hex");
      const cards = gate0.PART_IDENTIFICATION_GATE0_PILOT_CARDS.map((expected, index) => {
        const bytes = Buffer.alloc(expected.byteLength, 0xa0 + index);
        signature.copy(bytes);
        return { ...expected, base64: bytes.toString("base64") };
      });
      const request = {
        schemaVersion: mcp.PART_IDENTIFICATION_MCP_SCHEMA,
        model: model.PART_IDENTIFICATION_MODEL_ID,
        cardsDigest: gate0.PART_IDENTIFICATION_GATE0_CARDS_DIGEST,
        promptDigest: gate0.PART_IDENTIFICATION_GATE0_PROMPT_DIGEST,
        transportContractDigest: transport.PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
        instruction: { ...gate0.PART_IDENTIFICATION_GATE0_INSTRUCTION },
        cards,
        requestDigest: gate0.PART_IDENTIFICATION_GATE0_REQUEST_DIGEST,
      };
      const now = 1_800_000_000_000;
      try {
        gate0.createPartIdentificationGate0PilotProposal({
          request,
          purpose: gate0.PART_IDENTIFICATION_GATE0_PURPOSE,
          proposedAtMs: now,
          policyReview: {
            schemaVersion: gate0.PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
            evidenceBasis: "official-provider-published-consumer-policy",
            sourceAuthentication: "url-and-content-digest/not-authenticated-by-contract",
            reviewedAtMs: now,
            sources: gate0.PART_IDENTIFICATION_GATE0_POLICY_SOURCES.map((source, index) => ({
              ...source,
              contentDigest: "sha256:" + String(index).repeat(64),
              retrievedAtMs: now,
            })),
          },
          budgets: {
            maxModelLaunches: 1,
            maxExecutablePreflights: 1,
            maxCards: 6,
            maxProviderTurns: 2,
            maxInputTokens: 1_000_000,
            maxOutputTokens: 128_000,
            maxCostMicrousd: 2_000_000,
            maxElapsedMs: 300_000,
            maxProofBytes: 2_088_511,
          },
        });
        process.exitCode = 2;
      } catch (error) {
        if (!/base64|digest|artifact|exact/i.test(String(error?.message))) {
          console.error(error);
          process.exitCode = 3;
        }
      }
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, gate0Url, mcpUrl, modelUrl, transportUrl],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    expect(child.status, child.stderr).toBe(0);
  }, 20_000);
});
