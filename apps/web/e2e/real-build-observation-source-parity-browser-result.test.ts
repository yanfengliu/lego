import { describe, expect, it } from "vitest";

import { realBuildSourceParityBrowserResultEvidence } from "./real-build-observation-source-parity-browser-result";
import type { RealBuildSourceParityBrowserResult } from "./real-build-observation-source-parity-types";

const asBrowserResult = (value: unknown): RealBuildSourceParityBrowserResult =>
  value as RealBuildSourceParityBrowserResult;

describe("source-parity browser-result canonical preflight", () => {
  it("snapshots ordinary data and preserves canonical key ordering", () => {
    const evidence = realBuildSourceParityBrowserResultEvidence(
      asBrowserResult({ z: [0, null], a: { value: true } }),
    );

    expect(evidence.canonicalBytes.toString()).toBe('{"a":{"value":true},"z":[0,null]}');
    expect(evidence.bytes).toBe(evidence.canonicalBytes.length);
  });

  it("rejects nested proxies before executing reflection traps", () => {
    let trapCount = 0;
    const proxy = new Proxy(
      { value: true },
      {
        getOwnPropertyDescriptor(target, key) {
          trapCount += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        getPrototypeOf(target) {
          trapCount += 1;
          return Reflect.getPrototypeOf(target);
        },
        ownKeys(target) {
          trapCount += 1;
          return Reflect.ownKeys(target);
        },
      },
    );

    expect(() =>
      realBuildSourceParityBrowserResultEvidence(asBrowserResult({ nested: proxy })),
    ).toThrowError("Source-parity browser result $.nested must be non-proxy data");
    expect(trapCount).toBe(0);
  });

  it("rejects accessors without invoking them", () => {
    let getterCount = 0;
    const nested = {} as Record<string, unknown>;
    Object.defineProperty(nested, "value", {
      enumerable: true,
      get() {
        getterCount += 1;
        return true;
      },
    });

    expect(() =>
      realBuildSourceParityBrowserResultEvidence(asBrowserResult({ nested })),
    ).toThrowError(/must contain only enumerable string-keyed data fields, not accessors/u);
    expect(getterCount).toBe(0);
  });

  it("rejects excessive depth iteratively instead of entering recursive canonicalization", () => {
    let nested: unknown = null;
    for (let depth = 0; depth < 40; depth += 1) nested = [nested];

    expect(() =>
      realBuildSourceParityBrowserResultEvidence(asBrowserResult({ nested })),
    ).toThrowError(/depth 33 .* exceeds 32/u);
  });

  it("rejects an oversized string during the bounded scan", () => {
    expect(() =>
      realBuildSourceParityBrowserResultEvidence(asBrowserResult({ capture: "x".repeat(128) }), 64),
    ).toThrowError(/string \$\.capture exceeds the remaining .* before canonicalization/u);
  });

  it("rejects hidden and symbol shape additions", () => {
    const hidden = { value: true } as Record<PropertyKey, unknown>;
    Object.defineProperty(hidden, "extra", { value: false });
    const symbol = { value: true } as Record<PropertyKey, unknown>;
    symbol[Symbol("extra")] = false;

    for (const nested of [hidden, symbol]) {
      expect(() =>
        realBuildSourceParityBrowserResultEvidence(asBrowserResult({ nested })),
      ).toThrowError(/accessors, symbols, or hidden fields/u);
    }
  });
});
