import { describe, expect, it } from "vitest";

import { measurePdfSourceArtContribution } from "./part-identification-source-art-contribution.mjs";

const OPS = {
  constructPath: 91,
  endPath: 28,
  paintImageXObject: 85,
  setFillRGBColor: 59,
  setFont: 37,
  setLineWidth: 2,
  setMiterLimit: 5,
  setStrokeRGBColor: 58,
  setTextMatrix: 42,
  showText: 44,
  stroke: 20,
  transform: 12,
};

function translatedPath(mode, coordinates, bounds, dx, dy) {
  const values = coordinates.map((value, index) =>
    index % 3 === 0 ? value : value + (index % 3 === 1 ? dx : dy),
  );
  return [
    mode,
    [Float32Array.from(values)],
    Float32Array.from([bounds[0] + dx, bounds[1] + dy, bounds[2] + dx, bounds[3] + dy]),
  ];
}

function fixture(dx = 0, dy = 0) {
  const fnArray = [
    OPS.setStrokeRGBColor,
    OPS.setMiterLimit,
    OPS.transform,
    OPS.constructPath,
    OPS.paintImageXObject,
    OPS.setLineWidth,
    OPS.constructPath,
    OPS.constructPath,
    OPS.setFillRGBColor,
    OPS.setFont,
    OPS.setTextMatrix,
    OPS.showText,
  ];
  const argsArray = [
    ["#ffffff"],
    [4],
    [41.03437, 0, 0, 37.90777, 9.523 + dx, 26.99 + dy],
    translatedPath(
      OPS.endPath,
      [0, 10, 27, 1, 50, 27, 1, 50, 64, 1, 10, 64, 3],
      [10, 27, 50, 64],
      dx,
      dy,
    ),
    ["unstable-image-object"],
    [0.2],
    translatedPath(OPS.stroke, [0, 10.2, 20, 1, 12, 25, 3], [10.2, 20, 12, 25], dx, dy),
    translatedPath(OPS.stroke, [0, 14, 20, 1, 17, 24, 3], [14, 20, 17, 24], dx, dy),
    ["#ffffff"],
    ["unstable-font-object", 1],
    [Float32Array.from([8, 0, 0, 8, 10 + dx, 20 + dy])],
    [[{ unicode: "1", width: 370 }, -51, { unicode: "x", width: 480 }]],
  ];
  const recordedGroups = [
    { idx: 4, dependencies: [2, 3] },
    { idx: 6, dependencies: [0, 1, 5] },
    { idx: 7, dependencies: [0, 1, 5] },
    { idx: 11, dependencies: [8, 9, 10] },
  ];
  return {
    imageOperatorIndex: 4,
    label: "1x",
    labelTransformPt: [10 + dx, 20 + dy],
    operatorList: { argsArray, fnArray },
    pdfjs: { OPS },
    recordedGroups,
  };
}

describe("PDF source-art whole-contribution normalization", () => {
  it("normalizes translated image, clip, outlines, inherited state, font, and label", () => {
    const left = measurePdfSourceArtContribution(fixture());
    const translated = measurePdfSourceArtContribution(fixture(100, 200));

    expect(translated.normalizedProgramSha256).toBe(left.normalizedProgramSha256);
    expect(translated.normalizedProgram).toEqual(left.normalizedProgram);
    expect([...left.operationIndexes].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(left.normalizedProgram).toMatchObject({
      image: {
        linearTransformMilli: [41034, 0, 0, 37908],
        translationFromLabelMilliPt: [-477, 6990],
      },
      label: {
        fillRgb: "#ffffff",
        fontSizeMilliPt: 1000,
        text: "1x",
      },
    });
  });

  it("refuses a closure that omits inherited stroke authority", () => {
    const input = fixture();
    input.recordedGroups[1] = { idx: 6, dependencies: [1, 5] };
    expect(() => measurePdfSourceArtContribution(input)).toThrow(/setStrokeRGBColor state/u);
  });

  it("refuses a second image before the complete four-paint contribution", () => {
    const input = fixture();
    input.operatorList.fnArray[7] = OPS.paintImageXObject;
    expect(() => measurePdfSourceArtContribution(input)).toThrow(/exactly two vector outlines/u);
  });
});
