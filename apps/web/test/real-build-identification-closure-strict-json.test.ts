import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  identifyRealBuildIdentificationMode,
  rawJsonArtifactFromBytes,
  type RawJsonArtifact,
  type RealBuildIdentificationClosureInput,
  verifyRealBuildIdentificationClosure,
} from "../e2e/real-build-identification-closure";

const invalidJsonCases = [
  {
    name: "a UTF-8 BOM",
    bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"x":1}')]),
    detail: /Expected a JSON value/u,
  },
  {
    name: "a duplicate decoded key",
    bytes: Buffer.from('{"same":1,"s\\u0061me":2}'),
    detail: /JSON object repeats key "same"/u,
  },
  {
    name: "positive numeric overflow",
    bytes: Buffer.from("1e9999"),
    detail: /JSON number is outside the finite JavaScript range/u,
  },
  {
    name: "negative numeric overflow",
    bytes: Buffer.from("-1e9999"),
    detail: /JSON number is outside the finite JavaScript range/u,
  },
  {
    name: "excessive nesting",
    bytes: Buffer.from(`${"[".repeat(129)}0${"]".repeat(129)}`),
    detail: /JSON nesting exceeds 128 levels/u,
  },
  {
    name: "excessive values in one container",
    bytes: Buffer.from(`[${"0,".repeat(3_999_999)}0]`),
    detail: /JSON contains more than 4000000 values/u,
  },
] as const;

function captureTypeError(action: () => unknown): TypeError {
  let failure: unknown;
  try {
    action();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(TypeError);
  return failure as TypeError;
}

describe("real-build identification strict JSON boundary", () => {
  it.each(invalidJsonCases)(
    "rejects $name before declared fields are consulted",
    ({ bytes, detail }) => {
      const constructionFailure = captureTypeError(() =>
        rawJsonArtifactFromBytes(bytes, "Strict boundary"),
      );
      expect(constructionFailure.message).toMatch(
        /^Strict boundary retained bytes must be strict UTF-8 JSON:/u,
      );
      expect(constructionFailure.message).toMatch(detail);

      let declaredFieldReads = 0;
      const retained = {
        bytes,
        get digest() {
          declaredFieldReads += 1;
          return sha256Digest(bytes);
        },
        get value() {
          declaredFieldReads += 1;
          return {};
        },
      } satisfies RawJsonArtifact;
      const bindingFailure = captureTypeError(() =>
        identifyRealBuildIdentificationMode(retained, 1),
      );
      expect(bindingFailure.message).toMatch(/^Catalog coverage bytes must be strict UTF-8 JSON:/u);
      expect(bindingFailure.message).toMatch(detail);
      expect(declaredFieldReads).toBe(0);
    },
  );

  it("rejects strict JSON defects through the verifier before reading compiler inputs", () => {
    const bytes = Buffer.from('{"same":1,"s\\u0061me":2}');
    const coverage = { bytes, digest: sha256Digest(bytes), value: { same: 2 } };
    let laterInputReads = 0;
    const input = new Proxy({ coverage } as unknown as RealBuildIdentificationClosureInput, {
      get(target, property, receiver) {
        if (property === "coverage") return Reflect.get(target, property, receiver);
        laterInputReads += 1;
        throw new Error(`Verifier read later input ${String(property)} before refusing coverage.`);
      },
    });

    expect(() => verifyRealBuildIdentificationClosure(input)).toThrow(
      /^Catalog coverage bytes must be strict UTF-8 JSON: JSON object repeats key "same"/u,
    );
    expect(laterInputReads).toBe(0);
  });

  it("preserves valid retained bytes, digest, value, and closure mode", () => {
    const bytes = Buffer.from(
      '{"identification":{"source":"deterministic","model":null,"assignment":"nearest"},"lastStep":1}\n',
    );
    const retained = rawJsonArtifactFromBytes(bytes, "Catalog coverage");

    expect(retained.bytes).toBe(bytes);
    expect(retained.digest).toBe(sha256Digest(bytes));
    expect(retained.value).toEqual({
      identification: { source: "deterministic", model: null, assignment: "nearest" },
      lastStep: 1,
    });
    expect(identifyRealBuildIdentificationMode(retained, 1)).toEqual({
      source: "deterministic",
      model: null,
      assignment: "nearest",
      lastStep: 1,
    });
  });
});
