import { describe, expect, it } from "vitest";

import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";

function rotate(
  matrix: readonly number[],
  [x, y, z]: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    matrix[0]! * x + matrix[1]! * y + matrix[2]! * z,
    matrix[3]! * x + matrix[4]! * y + matrix[5]! * z,
    matrix[6]! * x + matrix[7]! * y + matrix[8]! * z,
  ];
}

describe("prefix-50 integral protocol gauge", () => {
  it("exhausts all proper orientations and half-LDU translation classes modulo integral LDU", () => {
    const pinnedSourcePositions = [
      { ordinal: 1, positionLdu: [500, -4, -234] },
      { ordinal: 281, positionLdu: [410, -118, -96.5] },
      { ordinal: 282, positionLdu: [270, -118, -96.5] },
      { ordinal: 283, positionLdu: [340, -118, -96.5] },
    ] as const;
    const translationClasses = [0, 0.5].flatMap((x) =>
      [0, 0.5].flatMap((y) => [0, 0.5].map((z) => [x, y, z] as const)),
    );
    const exactGauges = PROPER_ORIENTATIONS.flatMap(({ id, matrix }) =>
      translationClasses
        .filter((translation) =>
          pinnedSourcePositions.every(({ positionLdu }) =>
            rotate(matrix, positionLdu).every((value, index) =>
              Number.isSafeInteger(value + translation[index]!),
            ),
          ),
        )
        .map((translation) => ({ id, translation })),
    );

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(translationClasses).toHaveLength(8);
    expect(
      pinnedSourcePositions
        .filter(({ positionLdu }) =>
          positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
        )
        .map(({ ordinal }) => ordinal),
    ).toEqual([281, 282, 283]);
    expect(exactGauges).toEqual([]);
  });
});
