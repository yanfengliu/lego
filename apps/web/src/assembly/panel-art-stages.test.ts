import { describe, expect, it } from "vitest";

import { downsampleMask, isolateAssembly, keyPanelArt, keyPrintedBoxes } from "./panel-art";
import { derivePanelArtStages } from "./panel-art-stages";

const PAGE = 0x899093;

function raster(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = 0x89;
    pixels[index * 4 + 1] = 0x90;
    pixels[index * 4 + 2] = 0x93;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function paint(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  value = 0x20,
): void {
  for (let row = y; row < y + boxHeight; row += 1) {
    for (let column = x; column < x + boxWidth; column += 1) {
      const at = (row * width + column) * 4;
      pixels[at] = value;
      pixels[at + 1] = value;
      pixels[at + 2] = value;
    }
  }
}

function pixelsForMask(mask: Uint8Array, width: number): Uint8ClampedArray {
  const pixels = raster(width, mask.length / width);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 1) paint(pixels, width, pixel % width, Math.floor(pixel / width), 1, 1);
  }
  return pixels;
}

describe("derivePanelArtStages", () => {
  it("preserves the historical high-first production mask byte for byte", () => {
    const width = 80;
    const height = 60;
    const pixels = raster(width, height);
    paint(pixels, width, 4, 8, 24, 20);
    paint(pixels, width, 42, 5, 26, 20, 0xff);
    paint(pixels, width, 48, 10, 8, 6);
    paint(pixels, width, 34, 38, 12, 10);
    const callout = { minX: 31, maxX: 48, minY: 35, maxY: 51 } as const;

    const art = keyPanelArt(
      { width, height, pixels },
      { backgroundHex: PAGE, toleranceLevels: 10 },
    );
    const furniture = keyPrintedBoxes({ width, height, pixels });
    for (let index = 0; index < art.length; index += 1) {
      if (furniture[index] === 1) art[index] = 0;
    }
    for (let y = callout.minY; y <= callout.maxY; y += 1) {
      art.fill(0, y * width + callout.minX, y * width + callout.maxX + 1);
    }
    const historical = isolateAssembly({ width, height, mask: art }).mask;
    const historicalWork = downsampleMask({ width, height, mask: historical }, 2).mask;

    const stages = derivePanelArtStages({
      raster: { width, height, pixels },
      workFactor: 2,
      calloutRectangles: [callout],
      backgroundHex: PAGE,
    });

    expect(stages.highCleanedArtMask).toEqual(art);
    expect(stages.highLegacySelectedMask).toEqual(historical);
    expect(stages.isolateThenDownsampleMask).toEqual(historicalWork);
    expect(stages.authority).toBe("absent");
    expect(stages.workOnlyStage.status).toBe("missing");
  });

  it("retains isolate-before and isolate-after downsampling when topology changes", () => {
    const width = 8;
    const height = 4;
    const pixels = raster(width, height);
    paint(pixels, width, 0, 1, 5, 1);
    paint(pixels, width, 6, 0, 1, 3);

    const stages = derivePanelArtStages({
      raster: { width, height, pixels },
      workFactor: 2,
      backgroundHex: PAGE,
    });

    expect([...stages.isolateThenDownsampleMask]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...stages.downsampleThenIsolateMask]).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
    expect(stages.highComponents.legacySelected?.areaPx).toBe(5);
    expect(stages.downsampledComponents.legacySelected?.areaPx).toBe(2);
  });

  it("retains a legacy progress-line winner but refuses to call it source truth", () => {
    const width = 100;
    const height = 60;
    const pixels = raster(width, height);
    paint(pixels, width, 0, 50, 100, 1);
    paint(pixels, width, 30, 20, 9, 9);

    const stages = derivePanelArtStages({
      raster: { width, height, pixels },
      workFactor: 1,
      backgroundHex: PAGE,
    });

    expect(stages.highComponents.legacySelected?.areaPx).toBe(100);
    expect(stages.highComponents.unambiguousLargestSelection).toBeNull();
    expect(stages.highComponents.selectionRefusal).toBe("frame-spanning-thin-component");
    expect(stages.highComponents.retainedTopComponents.map(({ areaPx }) => areaPx)).toEqual([
      100, 81,
    ]);
  });

  it("keeps scan-order compatibility while refusing an equal-largest tie", () => {
    const width = 30;
    const height = 20;
    const pixels = raster(width, height);
    paint(pixels, width, 2, 3, 4, 4);
    paint(pixels, width, 20, 10, 4, 4);

    const stages = derivePanelArtStages({
      raster: { width, height, pixels },
      workFactor: 1,
      backgroundHex: PAGE,
    });

    expect(stages.highComponents.legacySelected?.seedPixel).toBe(3 * width + 2);
    expect(stages.highComponents.largestComponentCount).toBe(2);
    expect(stages.highComponents.unambiguousLargestSelection).toBeNull();
    expect(stages.highComponents.selectionRefusal).toBe("equal-largest-components");
  });

  it("refuses a vertical frame-spanning thin component without changing legacy bytes", () => {
    const width = 60;
    const height = 100;
    const pixels = raster(width, height);
    paint(pixels, width, 50, 0, 1, 100);
    paint(pixels, width, 20, 30, 9, 9);

    const stages = derivePanelArtStages({
      raster: { width, height, pixels },
      workFactor: 1,
      backgroundHex: PAGE,
    });

    expect(stages.highComponents.legacySelected?.areaPx).toBe(100);
    expect(stages.highComponents.unambiguousLargestSelection).toBeNull();
    expect(stages.highComponents.selectionRefusal).toBe("frame-spanning-thin-component");
  });

  it("matches legacy isolation across a deterministic bounded mask corpus", () => {
    let state = 0x6651557;
    const next = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };
    const dimensions = [
      [1, 1],
      [2, 3],
      [7, 5],
      [16, 9],
      [31, 17],
    ] as const;
    for (const [width, height] of dimensions) {
      const cases: Uint8Array[] = [
        new Uint8Array(width * height),
        new Uint8Array(width * height).fill(1),
      ];
      for (let sample = 0; sample < 32; sample += 1) {
        const mask = new Uint8Array(width * height);
        for (let pixel = 0; pixel < mask.length; pixel += 1) {
          mask[pixel] = next() >>> 29 === 0 ? 1 : 0;
        }
        cases.push(mask);
      }
      for (const mask of cases) {
        const stages = derivePanelArtStages({
          raster: { width, height, pixels: pixelsForMask(mask, width) },
          workFactor: 1,
          backgroundHex: PAGE,
          printedBoxMinimumAreaPx: width * height + 1,
        });
        expect(stages.highLegacySelectedMask).toEqual(
          isolateAssembly({ width, height, mask }).mask,
        );
      }
    }
  });
});
