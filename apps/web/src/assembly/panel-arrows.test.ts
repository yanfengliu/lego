import { describe, expect, it } from "vitest";

import { isArrowRed, PanelArrowError, readDisplacementArrows } from "./panel-arrows";

const PAGE = 0x899093;
const ARROW = 0xd0202a;

function panel(width: number, height: number, fill = PAGE): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    pixels[pixel * 4] = (fill >> 16) & 0xff;
    pixels[pixel * 4 + 1] = (fill >> 8) & 0xff;
    pixels[pixel * 4 + 2] = fill & 0xff;
    pixels[pixel * 4 + 3] = 255;
  }
  return pixels;
}

function put(pixels: Uint8ClampedArray, width: number, x: number, y: number, hex: number): void {
  const at = (y * width + x) * 4;
  pixels[at] = (hex >> 16) & 0xff;
  pixels[at + 1] = (hex >> 8) & 0xff;
  pixels[at + 2] = hex & 0xff;
  pixels[at + 3] = 255;
}

/** A shaft with a triangular head at the far end, pointing down the page. */
function paintArrow(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  top: number,
  length: number,
): void {
  for (let y = top; y < top + length - 12; y += 1) {
    for (let dx = -2; dx <= 2; dx += 1) put(pixels, width, x + dx, y, ARROW);
  }
  for (let row = 0; row < 12; row += 1) {
    const half = 8 - Math.floor((row * 8) / 12);
    for (let dx = -half; dx <= half; dx += 1) {
      put(pixels, width, x + dx, top + length - 12 + row, ARROW);
    }
  }
}

describe("isArrowRed", () => {
  it("takes the booklet's arrow ink and leaves its greys", () => {
    expect(isArrowRed(0xd0, 0x20, 0x2a)).toBe(true);
    expect(isArrowRed(0x89, 0x90, 0x93)).toBe(false);
    expect(isArrowRed(0x3a, 0x3a, 0x3a)).toBe(false);
    // A dark red brick face keys exactly the same, which is the whole reason
    // the reader goes on to test shape: colour cannot separate them.
    expect(isArrowRed(0x99, 0x18, 0x18)).toBe(true);
  });
});

describe("readDisplacementArrows", () => {
  it("reads a single arrow tail to head, head at the fat end", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 100, 40, 80);
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(1);
    const arrow = reading.arrows[0]!;
    expect(arrow.tailYPx).toBeLessThan(arrow.headYPx);
    expect(arrow.headWidthPx).toBeGreaterThan(arrow.tailWidthPx);
    expect(arrow.lengthPx).toBeGreaterThan(70);
    expect(reading.displacementYPx).toBeGreaterThan(70);
    expect(Math.abs(reading.displacementXPx!)).toBeLessThan(2);
    expect(reading.displacementSpreadPx).toBeLessThan(1);
  });

  it("averages two arrows that agree and reports their spread", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 200, 40, 80);
    paintArrow(pixels, width, 400, 40, 80);
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(2);
    expect(reading.displacementYPx).toBeGreaterThan(70);
    expect(reading.displacementSpreadPx).toBeLessThan(2);
  });

  it("returns the larger group when two arrows disagree, and says how many", () => {
    // Two arrows pointing different ways are two statements, not one. The
    // reader returns the larger group; with one each it returns one of them,
    // and `agreedArrows` is the only thing that says the answer is
    // uncorroborated — the spread is zero either way.
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 200, 100, 80);
    // The same arrow rotated a quarter turn: a horizontal shaft with its head
    // at the right-hand end.
    for (let x = 500; x < 568; x += 1) {
      for (let dy = -2; dy <= 2; dy += 1) put(pixels, width, x, 300 + dy, ARROW);
    }
    for (let column = 0; column < 12; column += 1) {
      const half = 8 - Math.floor((column * 8) / 12);
      for (let dy = -half; dy <= half; dy += 1) put(pixels, width, 568 + column, 300 + dy, ARROW);
    }
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(2);
    expect(reading.agreedArrows).toBe(1);
    expect(reading.displacementSpreadPx).toBe(0);
  });

  it("counts the arrows a consensus is over", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 200, 40, 80);
    paintArrow(pixels, width, 400, 40, 80);
    expect(readDisplacementArrows({ width, height, pixels }).agreedArrows).toBe(2);
  });

  it("refuses a red part for being too big, and says so", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    for (let y = 40; y < 200; y += 1) {
      for (let x = 40; x < 240; x += 1) put(pixels, width, x, y, ARROW);
    }
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(0);
    expect(reading.rejected[0]!.reason).toMatch(/red part rather than an arrow/);
  });

  it("refuses a round red blob for being too round", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    for (let y = 90; y < 120; y += 1) {
      for (let x = 90; x < 122; x += 1) put(pixels, width, x, y, ARROW);
    }
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(0);
    expect(reading.rejected[0]!.reason).toMatch(/times longer than it is wide/);
  });

  it("refuses an arrow drawn inside a printed sub-assembly box", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    for (let y = 20; y < 180; y += 1) {
      for (let x = 40; x < 200; x += 1) put(pixels, width, x, y, 0xffffff);
    }
    paintArrow(pixels, width, 100, 40, 80);
    const reading = readDisplacementArrows({ width, height, pixels });
    expect(reading.arrows).toHaveLength(0);
    expect(reading.rejected[0]!.reason).toMatch(/inside a printed sub-assembly box/);
  });

  it("refuses an arrow that starts nowhere near what the step highlighted", () => {
    // The shape of step 47: a sub-build drawn on the open page above the model,
    // with an arrow of its own that belongs to the sub-build.
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 200, 60, 80);
    const origin = new Uint8Array(width * height);
    for (let y = 500; y < 520; y += 1) {
      for (let x = 600; x < 700; x += 1) origin[y * width + x] = 1;
    }
    const reading = readDisplacementArrows(
      { width, height, pixels },
      { originMask: origin, originMarginPx: 60 },
    );
    expect(reading.arrows).toHaveLength(0);
    expect(reading.rejected[0]!.reason).toMatch(/belongs to a sub-build drawn in the same panel/);
    expect(reading.displacementXPx).toBeNull();
  });

  it("keeps an arrow that leaves the highlight", () => {
    const width = 1000;
    const height = 700;
    const pixels = panel(width, height);
    paintArrow(pixels, width, 200, 60, 80);
    const origin = new Uint8Array(width * height);
    for (let y = 40; y < 60; y += 1) {
      for (let x = 180; x < 220; x += 1) origin[y * width + x] = 1;
    }
    const reading = readDisplacementArrows(
      { width, height, pixels },
      { originMask: origin, originMarginPx: 60 },
    );
    expect(reading.arrows).toHaveLength(1);
  });

  it("names the mismatch when the origin mask is not the panel's raster", () => {
    expect(() =>
      readDisplacementArrows(
        { width: 40, height: 40, pixels: panel(40, 40) },
        { originMask: new Uint8Array(10) },
      ),
    ).toThrow(/origin mask holds 10 pixels but the panel is 40x40, needing 1600/);
  });

  it("reports nothing at all when the panel prints no red", () => {
    const reading = readDisplacementArrows({ width: 40, height: 40, pixels: panel(40, 40) });
    expect(reading.redPx).toBe(0);
    expect(reading.arrows).toHaveLength(0);
    expect(reading.displacementXPx).toBeNull();
  });

  it("names the raster when the buffer does not match", () => {
    expect(() =>
      readDisplacementArrows({ width: 10, height: 10, pixels: new Uint8ClampedArray(8) }),
    ).toThrow(/holds 8 bytes but 10x10 RGBA needs 400/);
    expect(new PanelArrowError("x").name).toBe("PanelArrowError");
  });
});
