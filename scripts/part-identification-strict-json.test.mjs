import { describe, expect, it } from "vitest";

import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

describe("the strict JSON byte parser", () => {
  it("accepts Node Buffer callers while rejecting duplicate keys and malformed UTF-8", () => {
    expect(parseStrictJsonBytes(Buffer.from('{"answer":42}', "utf8"))).toEqual({ answer: 42 });
    expect(() => parseStrictJsonBytes(Buffer.from('{"answer":1,"answer":2}', "utf8"))).toThrow(
      /repeats key "answer"/u,
    );
    expect(() => parseStrictJsonBytes(Uint8Array.of(0xc3, 0x28))).toThrow();
  });

  it("uses byte and decoder intrinsics captured before post-import poisoning", () => {
    const originalBufferFrom = Buffer.from;
    const originalTextDecoder = globalThis.TextDecoder;
    const originalUint8Array = globalThis.Uint8Array;
    const originalDecode = originalTextDecoder.prototype.decode;
    const bytes = originalBufferFrom('{"answer":42}', "utf8");

    try {
      Buffer.from = () => {
        throw new Error("poisoned Buffer.from");
      };
      globalThis.TextDecoder = class PoisonedTextDecoder {
        constructor() {
          throw new Error("poisoned TextDecoder");
        }
      };
      globalThis.Uint8Array = class PoisonedUint8Array {
        constructor() {
          throw new Error("poisoned Uint8Array");
        }
      };
      originalTextDecoder.prototype.decode = () => {
        throw new Error("poisoned TextDecoder.prototype.decode");
      };

      expect(parseStrictJsonBytes(bytes)).toEqual({ answer: 42 });
    } finally {
      Buffer.from = originalBufferFrom;
      globalThis.TextDecoder = originalTextDecoder;
      globalThis.Uint8Array = originalUint8Array;
      originalTextDecoder.prototype.decode = originalDecode;
    }
  });
});
