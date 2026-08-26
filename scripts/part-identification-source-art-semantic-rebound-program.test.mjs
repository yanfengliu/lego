import { describe, expect, it } from "vitest";

import { measurePdfSourceArtImageContribution } from "./part-identification-source-art-semantic-rebound-program.mjs";

function fakePdfProgram() {
  const OPS = {
    clip: 9,
    constructPath: 2,
    dependency: 10,
    endPath: 90,
    paintImageMaskXObject: 6,
    paintImageXObject: 3,
    restore: 8,
    save: 7,
    setGState: 11,
    transform: 1,
  };
  return {
    pdfjs: { OPS },
    operatorList: {
      argsArray: [
        null,
        null,
        null,
        [OPS.endPath, [[0, 100, 200, 1, 112, 209]], [100, 200, 112, 209]],
        null,
        [12, 0, 0, 9, 100, 200],
        ["img"],
        ["img", 12, 9],
        null,
        null,
        null,
      ],
      fnArray: [
        OPS.save,
        OPS.save,
        OPS.clip,
        OPS.constructPath,
        OPS.save,
        OPS.transform,
        OPS.dependency,
        OPS.paintImageXObject,
        OPS.restore,
        OPS.restore,
        OPS.restore,
      ],
    },
    recordedGroups: [{ dependencies: [0, 1, 2, 3, 4, 5, 6, 8, 9, 10], idx: 7 }],
  };
}

function translatedPathProgram(originX, originY, relativeOffset) {
  const program = fakePdfProgram();
  program.operatorList.argsArray[5][4] = originX;
  program.operatorList.argsArray[5][5] = originY;
  program.operatorList.argsArray[3][1][0] = [
    0,
    originX + relativeOffset,
    originY,
    1,
    originX + 12 + relativeOffset,
    originY + 9,
  ];
  program.operatorList.argsArray[3][2] = [
    originX + relativeOffset,
    originY,
    originX + 12 + relativeOffset,
    originY + 9,
  ];
  return program;
}

describe("source-art full ordered PDF image closure", () => {
  it("normalizes page position and refuses earlier transforms or graphics state", () => {
    const base = fakePdfProgram();
    const measured = measurePdfSourceArtImageContribution({ ...base, imageOperatorIndex: 7 });
    const clipMutation = structuredClone(base);
    clipMutation.operatorList.argsArray[3][1][0][2] += 0.001;
    expect(
      measurePdfSourceArtImageContribution({ ...clipMutation, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).not.toBe(measured.normalizedProgramSha256);

    const translated = structuredClone(base);
    translated.operatorList.argsArray[5][4] += 10;
    translated.operatorList.argsArray[5][5] += 20;
    for (const index of [1, 4]) translated.operatorList.argsArray[3][1][0][index] += 10;
    for (const index of [2, 5]) translated.operatorList.argsArray[3][1][0][index] += 20;
    for (const index of [0, 2]) translated.operatorList.argsArray[3][2][index] += 10;
    for (const index of [1, 3]) translated.operatorList.argsArray[3][2][index] += 20;
    expect(
      measurePdfSourceArtImageContribution({ ...translated, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).toBe(measured.normalizedProgramSha256);

    const earlierTransform = fakePdfProgram();
    earlierTransform.operatorList.fnArray[1] = earlierTransform.pdfjs.OPS.transform;
    earlierTransform.operatorList.argsArray[1] = [1, 0, 0, 1, 5, 6];
    expect(() =>
      measurePdfSourceArtImageContribution({ ...earlierTransform, imageOperatorIndex: 7 }),
    ).toThrow(/exactly one transform/u);

    const graphicsState = fakePdfProgram();
    graphicsState.operatorList.fnArray[1] = graphicsState.pdfjs.OPS.setGState;
    graphicsState.operatorList.argsArray[1] = ["GS1"];
    expect(() =>
      measurePdfSourceArtImageContribution({ ...graphicsState, imageOperatorIndex: 7 }),
    ).toThrow(/unsupported operation setGState/u);
  });

  it("commits closure order and rejects duplicate or non-image terminal operations", () => {
    const base = fakePdfProgram();
    const measured = measurePdfSourceArtImageContribution({ ...base, imageOperatorIndex: 7 });
    const reordered = structuredClone(base);
    [reordered.operatorList.fnArray[1], reordered.operatorList.fnArray[6]] = [
      reordered.operatorList.fnArray[6],
      reordered.operatorList.fnArray[1],
    ];
    [reordered.operatorList.argsArray[1], reordered.operatorList.argsArray[6]] = [
      reordered.operatorList.argsArray[6],
      reordered.operatorList.argsArray[1],
    ];
    expect(
      measurePdfSourceArtImageContribution({ ...reordered, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).not.toBe(measured.normalizedProgramSha256);

    const duplicate = fakePdfProgram();
    duplicate.recordedGroups[0].dependencies[1] = 0;
    expect(() =>
      measurePdfSourceArtImageContribution({ ...duplicate, imageOperatorIndex: 7 }),
    ).toThrow(/duplicate operations/u);
    const terminalMutation = fakePdfProgram();
    terminalMutation.operatorList.fnArray[7] = terminalMutation.pdfjs.OPS.paintImageMaskXObject;
    expect(() =>
      measurePdfSourceArtImageContribution({ ...terminalMutation, imageOperatorIndex: 7 }),
    ).toThrow(/requires one bounded PDF image paint/u);
  });

  it("alpha-renames a bound image resource and milli-quantizes retained numbers", () => {
    const base = fakePdfProgram();
    const measured = measurePdfSourceArtImageContribution({ ...base, imageOperatorIndex: 7 });
    const renamed = structuredClone(base);
    renamed.operatorList.argsArray[6][0] = "another-image-resource";
    renamed.operatorList.argsArray[7][0] = "another-image-resource";
    expect(
      measurePdfSourceArtImageContribution({ ...renamed, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).toBe(measured.normalizedProgramSha256);
    const mismatched = structuredClone(base);
    mismatched.operatorList.argsArray[6][0] = "another-image-resource";
    expect(() =>
      measurePdfSourceArtImageContribution({ ...mismatched, imageOperatorIndex: 7 }),
    ).toThrow(/does not bind its terminal image paint/u);

    const subMilli = structuredClone(base);
    subMilli.operatorList.argsArray[5][0] += 0.0004;
    expect(
      measurePdfSourceArtImageContribution({ ...subMilli, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).toBe(measured.normalizedProgramSha256);
    const aboveMilliThreshold = structuredClone(base);
    aboveMilliThreshold.operatorList.argsArray[5][0] += 0.0006;
    expect(
      measurePdfSourceArtImageContribution({ ...aboveMilliThreshold, imageOperatorIndex: 7 })
        .normalizedProgramSha256,
    ).not.toBe(measured.normalizedProgramSha256);
  });

  it("uses one translation-invariant milli rule around both rounding boundaries", () => {
    for (const relativeOffset of [0.0004, 0.0006, -0.0004, -0.0006]) {
      const atOrigin = translatedPathProgram(0, 0, relativeOffset);
      const translated = translatedPathProgram(100, 200, relativeOffset);
      expect(
        measurePdfSourceArtImageContribution({ ...translated, imageOperatorIndex: 7 })
          .normalizedProgramSha256,
      ).toBe(
        measurePdfSourceArtImageContribution({ ...atOrigin, imageOperatorIndex: 7 })
          .normalizedProgramSha256,
      );
    }
  });
});
