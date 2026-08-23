import { describe, expect, it } from "vitest";

import { partIdentificationSafeJsonBytes } from "./part-identification-safe-json.mjs";

describe("safe JSON byte encoding", () => {
  it("preserves JSON field order and omission semantics without inherited toJSON", () => {
    const prior = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value: () => ({ poisoned: true }),
      });
      const value = { z: 0.25, omitted: undefined, a: [1, undefined, null] };
      expect(partIdentificationSafeJsonBytes(value).toString("utf8")).toBe(
        '{"z":0.25,"a":[1,null,null]}',
      );
    } finally {
      if (prior === undefined) delete Object.prototype.toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", prior);
    }
  });

  it("rejects accessors without invoking them", () => {
    let called = false;
    const value = {};
    Object.defineProperty(value, "secret", {
      enumerable: true,
      get() {
        called = true;
        return "leaked";
      },
    });
    expect(() => partIdentificationSafeJsonBytes(value)).toThrow(/accessor/u);
    expect(called).toBe(false);
  });
});
