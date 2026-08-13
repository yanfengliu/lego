import { describe, expect, it } from "vitest";

import {
  pooledSourceParityMaskCell,
  pooledSourceParityMismatchCell,
} from "./real-build-observation-source-parity-diagnostic";

describe("source-parity diagnostic reduction", () => {
  it("preserves sparse occupancy and XOR anywhere inside a reduced cell", () => {
    const production = new Uint8Array(64);
    const candidate = new Uint8Array(64);
    production[7 * 8 + 7] = 1;

    expect(
      pooledSourceParityMaskCell({
        mask: production,
        sourceWidth: 8,
        sourceHeight: 8,
        cellWidth: 2,
        cellHeight: 2,
        cellX: 1,
        cellY: 1,
      }),
    ).toBe(1);
    expect(
      pooledSourceParityMismatchCell({
        production,
        candidate,
        sourceWidth: 8,
        sourceHeight: 8,
        cellWidth: 2,
        cellHeight: 2,
        cellX: 1,
        cellY: 1,
      }),
    ).toBe(1);
  });

  it("does not leak occupancy into a different source footprint", () => {
    const mask = new Uint8Array(35);
    mask[4 * 7 + 6] = 1;
    expect(
      pooledSourceParityMaskCell({
        mask,
        sourceWidth: 7,
        sourceHeight: 5,
        cellWidth: 3,
        cellHeight: 2,
        cellX: 1,
        cellY: 1,
      }),
    ).toBe(0);
    expect(
      pooledSourceParityMaskCell({
        mask,
        sourceWidth: 7,
        sourceHeight: 5,
        cellWidth: 3,
        cellHeight: 2,
        cellX: 2,
        cellY: 1,
      }),
    ).toBe(1);
  });
});
