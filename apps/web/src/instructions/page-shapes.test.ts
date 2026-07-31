import { describe, expect, it } from "vitest";

import { extractPageShapes, type OperatorList, type ShapeOperatorCodes } from "./page-shapes";

/** Stand-ins for pdfjs OPS codes; only their distinctness matters. */
const CODES: ShapeOperatorCodes = {
  setFillRGBColor: 1,
  constructPath: 2,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  save: 5,
  restore: 6,
  transform: 7,
};

/** A constructPath operand triple: paint op, commands, precomputed box. */
function path(drawKind: number, box: readonly number[]) {
  return [drawKind, [], Float32Array.from(box)];
}

function listOf(entries: readonly (readonly [number, unknown])[]): OperatorList {
  return {
    fnArray: entries.map(([code]) => code),
    argsArray: entries.map(([, args]) => args),
  };
}

describe("extractPageShapes", () => {
  it("reads a filled path's colour and page-space bounds", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#c91a09"]],
        [CODES.constructPath, path(CODES.fill, [10, 20, 30, 50])],
      ]),
      CODES,
    );

    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatchObject({
      fillHex: "#c91a09",
      bounds: { minXPt: 10, minYPt: 20, maxXPt: 30, maxYPt: 50 },
    });
  });

  it("accepts a fill given as channels as well as a hex string", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, [201, 26, 9]],
        [CODES.constructPath, path(CODES.fill, [0, 0, 1, 1])],
      ]),
      CODES,
    );

    expect(shapes[0]!.fillHex).toBe("#c91a09");
  });

  it("ignores an outline, since a stroked path is not a piece of art", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#ffffff"]],
        [CODES.constructPath, path(20, [0, 0, 10, 10])],
        [CODES.constructPath, path(28, [0, 0, 10, 10])],
      ]),
      CODES,
    );

    expect(shapes).toEqual([]);
  });

  it("places a shape where its transform actually puts it", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#ffffff"]],
        [CODES.transform, [2, 0, 0, 2, 100, 50]],
        [CODES.constructPath, path(CODES.fill, [0, 0, 10, 10])],
      ]),
      CODES,
    );

    expect(shapes[0]!.bounds).toEqual({ minXPt: 100, minYPt: 50, maxXPt: 120, maxYPt: 70 });
  });

  it("restores the transform a save had captured", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#ffffff"]],
        [CODES.save, null],
        [CODES.transform, [1, 0, 0, 1, 500, 500]],
        [CODES.restore, null],
        [CODES.constructPath, path(CODES.fill, [0, 0, 10, 10])],
      ]),
      CODES,
    );

    expect(shapes[0]!.bounds).toMatchObject({ minXPt: 0, minYPt: 0 });
  });

  it("keeps a rotated shape's bounds honest by using all four corners", () => {
    // A quarter turn: the box's corners, not its min and max, define the extent.
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#ffffff"]],
        [CODES.transform, [0, 1, -1, 0, 0, 0]],
        [CODES.constructPath, path(CODES.fill, [0, 0, 10, 4])],
      ]),
      CODES,
    );

    expect(shapes[0]!.bounds).toEqual({ minXPt: -4, minYPt: 0, maxXPt: 0, maxYPt: 10 });
  });

  it("skips a malformed path rather than trusting it", () => {
    const shapes = extractPageShapes(
      listOf([
        [CODES.setFillRGBColor, ["#ffffff"]],
        [CODES.constructPath, [CODES.fill]],
        [CODES.constructPath, [CODES.fill, [], Float32Array.from([Number.NaN, 0, 1, 1])]],
        [CODES.constructPath, "not operands"],
      ]),
      CODES,
    );

    expect(shapes).toEqual([]);
  });

  it("bounds how many shapes one page may contribute", () => {
    const many = Array.from(
      { length: 50 },
      () => [CODES.constructPath, path(CODES.fill, [0, 0, 1, 1])] as const,
    );
    const shapes = extractPageShapes(listOf(many), CODES, {
      limits: { maxShapesPerPage: 10, maxOperatorsPerPage: 200_000 },
    });

    expect(shapes).toHaveLength(10);
  });
});
