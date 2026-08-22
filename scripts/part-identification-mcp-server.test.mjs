import { describe, expect, it } from "vitest";

import {
  boundedPartIdentificationMcpLines,
  MAX_PART_IDENTIFICATION_MCP_LINE_BYTES,
} from "./part-identification-mcp-server.mjs";

async function* oneByteChunks(bytes) {
  for (let index = 0; index < bytes.length; index += 1) {
    yield bytes.subarray(index, index + 1);
  }
}

describe("bounded part-identification MCP stdin", () => {
  it("assembles one near-cap line from one-byte chunks without repeated whole-line copying", async () => {
    const expected = Buffer.alloc(MAX_PART_IDENTIFICATION_MCP_LINE_BYTES, 0x61);
    const input = Buffer.concat([expected, Buffer.from("\n")]);
    const observed = [];
    for await (const line of boundedPartIdentificationMcpLines(oneByteChunks(input))) {
      observed.push(line);
    }
    expect(observed).toHaveLength(1);
    expect(observed[0].equals(expected)).toBe(true);
  });
});
