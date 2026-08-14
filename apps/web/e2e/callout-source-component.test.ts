import { describe, expect, it } from "vitest";

import { absoluteForegroundSha256 } from "./callout-source-component";

const input = (records: readonly number[]) => ({
  pageNumber: 22,
  rasterScale: 8,
  canvasWidth: 100,
  canvasHeight: 100,
  boundsPx: { left: 1, top: 1, right: 2, bottom: 1 },
  rawComponentCount: 1,
  records: Uint32Array.from(records),
});

describe("callout source-component digest", () => {
  it("is stable and changes for shifted geometry or source RGBA", async () => {
    const original = await absoluteForegroundSha256(input([101, 0xffffffff, 102, 0xff00ffff]));
    expect(await absoluteForegroundSha256(input([101, 0xffffffff, 102, 0xff00ffff]))).toBe(
      original,
    );
    expect(
      await absoluteForegroundSha256({
        ...input([101, 0xffffffff, 102, 0xff00ffff]),
        rawComponentCount: 2,
      }),
    ).not.toBe(original);
    expect(await absoluteForegroundSha256(input([101, 0xffffffff, 102, 0xff00fffe]))).not.toBe(
      original,
    );
    expect(
      await absoluteForegroundSha256({
        ...input([102, 0xffffffff, 103, 0xff00ffff]),
        boundsPx: { left: 2, top: 1, right: 3, bottom: 1 },
      }),
    ).not.toBe(original);
  });

  it("refuses insertion-order and loose-bounds ambiguity", async () => {
    await expect(
      absoluteForegroundSha256(input([102, 0xff00ffff, 101, 0xffffffff])),
    ).rejects.toThrow(/row-major/);
    await expect(
      absoluteForegroundSha256({
        ...input([101, 0xffffffff, 102, 0xff00ffff]),
        boundsPx: { left: 0, top: 1, right: 2, bottom: 1 },
      }),
    ).rejects.toThrow(/tightly enclose/);
  });

  it("refuses an unbounded raw-component count before hashing", async () => {
    await expect(
      absoluteForegroundSha256({
        ...input([101, 0xffffffff, 102, 0xff00ffff]),
        rawComponentCount: 65,
      }),
    ).rejects.toThrow(/1\.\.64 nonempty raw components/);
  });

  it("refuses more nonempty raw components than union foreground pixels", async () => {
    await expect(
      absoluteForegroundSha256({
        ...input([101, 0xffffffff]),
        boundsPx: { left: 1, top: 1, right: 1, bottom: 1 },
        rawComponentCount: 2,
      }),
    ).rejects.toThrow(/nonempty raw components/);
  });

  it("refuses zero or aliased uint32 header fields before hashing", async () => {
    await expect(
      absoluteForegroundSha256({
        ...input([101, 0xffffffff, 102, 0xff00ffff]),
        pageNumber: 0,
      }),
    ).rejects.toThrow(/positive uint32/);
    await expect(
      absoluteForegroundSha256({
        ...input([101, 0xffffffff, 102, 0xff00ffff]),
        canvasWidth: 0x1_0000_0000,
      }),
    ).rejects.toThrow(/positive uint32/);
  });
});
