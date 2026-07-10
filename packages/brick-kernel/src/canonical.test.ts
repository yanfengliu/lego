import { describe, expect, it } from "vitest";

import {
  CanonicalizationError,
  canonicalDigest,
  canonicalSha256,
  canonicalStringify,
  sha256Hex,
} from "./canonical";

describe("canonicalStringify", () => {
  it("sorts object keys recursively while preserving array order", () => {
    const left = { z: [2, { beta: true, alpha: "x" }], a: null };
    const right = { a: null, z: [2, { alpha: "x", beta: true }] };

    expect(canonicalStringify(left)).toBe('{"a":null,"z":[2,{"alpha":"x","beta":true}]}');
    expect(canonicalStringify(left)).toBe(canonicalStringify(right));
  });

  it("normalizes negative zero without changing other finite numbers", () => {
    expect(canonicalStringify([-0, 0, 1.25])).toBe("[0,0,1.25]");
  });

  it("orders keys by Unicode code units without relying on the host locale", () => {
    expect(canonicalStringify({ é: 1, z: 2, A: 3 })).toBe('{"A":3,"z":2,"é":1}');
  });

  it.each([
    ["undefined", { value: undefined }],
    ["non-finite", Number.NaN],
    ["function", () => undefined],
    ["bigint", 1n],
    ["non-plain object", new Date(0)],
  ])("rejects %s input", (_label, value) => {
    expect(() => canonicalStringify(value)).toThrow(CanonicalizationError);
  });

  it("rejects cycles but permits the same object in separate branches", () => {
    const shared = { id: "shared" };
    expect(canonicalStringify([shared, shared])).toBe('[{"id":"shared"},{"id":"shared"}]');

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => canonicalStringify(circular)).toThrow(/Circular references/);
  });

  it("rejects sparse arrays instead of hashing holes as absent elements", () => {
    expect(() => canonicalStringify(new Array(1))).toThrowError(
      expect.objectContaining({ path: "$[0]" }),
    );
    expect(canonicalStringify([])).toBe("[]");
  });
});

describe("sha256", () => {
  it("matches the published empty-string SHA-256 vector", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("hashes canonical value bytes rather than insertion order", () => {
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(canonicalSha256({ a: 1, b: 2 }));
    expect(canonicalDigest({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
