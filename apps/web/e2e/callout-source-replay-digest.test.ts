import { describe, expect, it } from "vitest";

import { replayComponentGroupDigest } from "./callout-source-replay-digest";

describe("independent source replay digest bounds", () => {
  it("rejects an over-limit record count before reading or allocating for its records", async () => {
    const oversizedWithoutStorage = { length: 8_000_002 } as Uint32Array;
    await expect(
      replayComponentGroupDigest(
        1,
        8,
        100,
        100,
        { left: 0, top: 0, right: 0, bottom: 0 },
        1,
        oversizedWithoutStorage,
      ),
    ).rejects.toThrow(/1\.\.4000000 union foreground pixels/u);
  });

  it.each([0, 65])("rejects raw component group size %i before allocation", async (rawCount) => {
    await expect(
      replayComponentGroupDigest(
        1,
        8,
        10,
        10,
        { left: 0, top: 0, right: 0, bottom: 0 },
        rawCount,
        new Uint32Array([0, 0]),
      ),
    ).rejects.toThrow(/1\.\.64 nonempty raw components/u);
  });

  it("rejects more nonempty raw components than union foreground pixels", async () => {
    await expect(
      replayComponentGroupDigest(
        1,
        8,
        10,
        10,
        { left: 0, top: 0, right: 0, bottom: 0 },
        2,
        new Uint32Array([0, 0]),
      ),
    ).rejects.toThrow(/no greater than the union pixel count/u);
  });

  it("rejects an integer that DataView would otherwise truncate to uint32", async () => {
    await expect(
      replayComponentGroupDigest(
        1,
        0x1_0000_0001,
        10,
        10,
        { left: 0, top: 0, right: 0, bottom: 0 },
        1,
        new Uint32Array([0, 0]),
      ),
    ).rejects.toThrow(/unsigned 32-bit fields/u);
  });

  it("rejects an over-limit full-page canvas before digest allocation", async () => {
    await expect(
      replayComponentGroupDigest(
        1,
        8,
        6_000,
        6_000,
        { left: 0, top: 0, right: 0, bottom: 0 },
        1,
        new Uint32Array([0, 0]),
      ),
    ).rejects.toThrow(/canvas of at most 32000000 pixels/u);
  });

  it("rejects a record outside its declared tight bounds", async () => {
    await expect(
      replayComponentGroupDigest(
        1,
        8,
        10,
        10,
        { left: 1, top: 1, right: 1, bottom: 1 },
        1,
        new Uint32Array([0, 0]),
      ),
    ).rejects.toThrow(/inside their declared bounds/u);
  });
});
