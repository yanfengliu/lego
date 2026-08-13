import { describe, expect, it } from "vitest";

import {
  createRealBuildObservationSourceRasterCandidateMask,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate-mask";

function mutableMaskDescriptor(): Record<PropertyKey, unknown> {
  return {
    ...createRealBuildObservationSourceRasterCandidateMask(new Uint8Array([1]), 1, 1),
  };
}

describe("observation source candidate mask descriptor", () => {
  it("rejects a pass-through proxy before executing any reflection trap", () => {
    let trapCount = 0;
    const proxy = new Proxy(
      createRealBuildObservationSourceRasterCandidateMask(new Uint8Array([1]), 1, 1),
      {
        getOwnPropertyDescriptor(target, key) {
          trapCount += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        isExtensible(target) {
          trapCount += 1;
          return Reflect.isExtensible(target);
        },
        ownKeys(target) {
          trapCount += 1;
          return Reflect.ownKeys(target);
        },
      },
    );

    expect(() => unpackRealBuildObservationSourceRasterCandidateMask(proxy)).toThrowError(
      "Observation source candidate mask must be an exact descriptor created by the current candidate module, not a proxy or detached lookalike.",
    );
    expect(trapCount).toBe(0);
  });

  it.each([
    ["a hidden field", "hidden"],
    ["a symbol field", Symbol("hidden")],
  ])("rejects %s outside the exact descriptor map", (_label, key) => {
    const descriptor = mutableMaskDescriptor();
    Object.defineProperty(descriptor, key, { value: true });
    Object.freeze(descriptor);

    expect(() => unpackRealBuildObservationSourceRasterCandidateMask(descriptor)).toThrowError(
      /must be an exact descriptor created by the current candidate module/u,
    );
  });

  it("rejects an inherited-state surface even when all own fields are frozen", () => {
    const descriptor = mutableMaskDescriptor();
    Object.setPrototypeOf(descriptor, { inherited: true });
    Object.freeze(descriptor);

    expect(() => unpackRealBuildObservationSourceRasterCandidateMask(descriptor)).toThrowError(
      /must be an exact descriptor created by the current candidate module/u,
    );
  });

  it("creates one frozen exact own descriptor map", () => {
    const descriptor = createRealBuildObservationSourceRasterCandidateMask(
      new Uint8Array([1]),
      1,
      1,
    );
    expect(Reflect.ownKeys(descriptor).sort()).toEqual([
      "base64",
      "byteLength",
      "encoding",
      "lowPaddingBits",
      "packedDigest",
      "pixelCount",
      "unpackedDigest",
    ]);
    expect(
      Object.values(Object.getOwnPropertyDescriptors(descriptor)).every(
        (field) =>
          "value" in field &&
          field.enumerable === true &&
          field.configurable === false &&
          field.writable === false,
      ),
    ).toBe(true);
  });
});
