import { describe, expect, it } from "vitest";

import {
  packRealBuildCompiledBinaryMaskMsb,
  unpackRealBuildCompiledBinaryMaskMsb,
  createRealBuildCompiledObservationRegistrationVerifier,
} from "../e2e/real-build-compiled-observation-registration";

describe("compiled observation MSB mask encoding", () => {
  it("packs the first pixel into the high bit and requires zero low padding", () => {
    const mask = Uint8Array.of(1, 0, 1, 0, 0, 0, 0, 1, 1);
    const packed = packRealBuildCompiledBinaryMaskMsb(mask, 9, 1);
    expect([...packed]).toEqual([0xa1, 0x80]);
    expect(unpackRealBuildCompiledBinaryMaskMsb(packed, 9, 1)).toEqual(mask);
    expect(() => unpackRealBuildCompiledBinaryMaskMsb(Uint8Array.of(0xa1, 0x81), 9, 1)).toThrow(
      /padding bits/iu,
    );
    expect(() => packRealBuildCompiledBinaryMaskMsb(Uint8Array.of(2), 1, 1)).toThrow(
      /exactly 0 or 1/iu,
    );
  });

  it("replays target-space exclusion and the empty-candidate sentinel deterministically", () => {
    const register = createRealBuildCompiledObservationRegistrationVerifier(10_000).register;
    const comparison = {
      source: Uint8Array.of(0x70),
      excluded: Uint8Array.of(0x10),
      width: 8,
      height: 1,
      measure: "iou" as const,
      path: "registration-test",
    };
    expect(register({ ...comparison, candidate: Uint8Array.of(0xf0) })).toMatchObject({
      shiftPx: [1, 0],
      score: 2 / 3,
    });
    expect(register({ ...comparison, candidate: Uint8Array.of(0x00) })).toMatchObject({
      shiftPx: [0, 0],
      score: 0,
    });
  });

  it("rejects invalid visit budgets and packed mask lengths", () => {
    expect(() => createRealBuildCompiledObservationRegistrationVerifier(0)).toThrow(
      /positive safe-integer visit budget/u,
    );
    const verifier = createRealBuildCompiledObservationRegistrationVerifier(10_000);
    expect(() =>
      verifier.register({
        source: new Uint8Array(),
        candidate: Uint8Array.of(0),
        excluded: Uint8Array.of(0),
        width: 8,
        height: 1,
        measure: "iou",
        path: "invalid packed mask",
      }),
    ).toThrow(/exactly 1 bytes/u);
  });
});
