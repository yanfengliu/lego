import { describe, expect, it } from "vitest";

import { snapshotRealBuildSourceParityPublishInput } from "./real-build-observation-source-parity-output-input";

describe("source-parity publish input snapshot", () => {
  it("rejects an outer proxy before executing any reflection trap", () => {
    let trapCount = 0;
    const proxy = new Proxy(
      { repoRoot: "C:/unused", result: {}, provenance: [] },
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

    expect(() => snapshotRealBuildSourceParityPublishInput(proxy as never)).toThrowError(
      "Source-parity publish input must be a non-proxy plain data record.",
    );
    expect(trapCount).toBe(0);
  });

  it("rejects a custom outer prototype before inspecting fields", () => {
    const input = Object.assign(Object.create({ inherited: true }), {
      repoRoot: "C:/unused",
      result: {},
      provenance: [],
    });

    expect(() => snapshotRealBuildSourceParityPublishInput(input as never)).toThrowError(
      "Source-parity publish input must use Object.prototype.",
    );
  });
});
