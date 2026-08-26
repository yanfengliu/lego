import { describe, expect, it } from "vitest";

import {
  encodeCanonicalRealBuildJson,
  parseCanonicalRealBuildJson,
} from "../e2e/real-build-json-admission";

describe("current real-build canonical JSON admission", () => {
  it("round-trips the one compact and one pretty byte representation", () => {
    const value = { zebra: [3, { beta: true, alpha: null }], alpha: 1 };

    expect(
      parseCanonicalRealBuildJson(encodeCanonicalRealBuildJson(value), "compact role"),
    ).toEqual(value);
    expect(
      parseCanonicalRealBuildJson(
        encodeCanonicalRealBuildJson(value, "pretty-one-space-line"),
        "pretty role",
        "pretty-one-space-line",
      ),
    ).toEqual(value);
  });

  it("rejects duplicate keys and alternate spellings that ordinary JSON.parse accepts", () => {
    for (const bytes of [
      Buffer.from('{"actionLedger":[],"actionLedger":[{"hidden":true}]}'),
      Buffer.from('{"outer":{"schemaVersion":"hidden","schemaVersion":"current"}}'),
    ]) {
      expect(() => parseCanonicalRealBuildJson(bytes, "duplicate role")).toThrow(
        /duplicate-free finite UTF-8/u,
      );
    }

    for (const bytes of [
      Buffer.from('{"count":1e0}'),
      Buffer.from(' {"count":1}'),
      Buffer.from('{"count":1}\n'),
      Buffer.from('{"zebra":0,"alpha":1}'),
    ]) {
      expect(() => parseCanonicalRealBuildJson(bytes, "alternate role")).toThrow(
        /exact canonical compact encoding/u,
      );
    }
  });
});
