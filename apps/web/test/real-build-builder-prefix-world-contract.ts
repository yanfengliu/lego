import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";

import type { BuilderCanonicalCalibration } from "../e2e/real-build-builder-calibration";
import type { OfficialModelIndex } from "../e2e/real-build-official";

interface PrefixRow {
  readonly stepNumber: number;
  readonly sourceBuilderIdentityOrdinal: number;
  readonly builderBrickRef: string;
  readonly designRevision: string;
}

const EXPECTED_WORLD_FAILURES = [
  [27, 149, "3904200e-c9cf-41cc-adcf-fc97dfdbb54f", "4162;O", "proper-m-00pp000p0"],
  [38, 258, "97adf751-0663-4d61-a4a2-6d6105294e7a", "35480;K", "proper-m-00pp000p0"],
  [38, 259, "cf561456-35f7-41e5-95f7-43390400760c", "60479;F", "proper-m-00pp000p0"],
  [39, 260, "64d86942-0464-4b68-a06b-6692837a85ef", "35480;K", "proper-m-00pp000p0"],
  [39, 262, "296e168c-c607-4676-babd-799dc24dc79e", "35480;K", "proper-m-00pp000p0"],
  [39, 263, "2ed95175-5620-47b7-bee5-af9ffb5b7f3a", "35480;K", "proper-m-00pp000p0"],
  [41, 270, "1260a44e-b125-411e-8552-596f22aa32e4", "35480;K", "proper-m-00pp000p0"],
  [41, 271, "a9aee720-9a6d-4d05-b1cb-2821d8101d03", "35480;K", "proper-m-00pp000p0"],
  [41, 272, "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06", "35480;K", "proper-m-00pp000p0"],
  [41, 273, "8a6a770f-a0b9-430a-8802-8f057fbd748a", "35480;K", "proper-m-00pp000p0"],
  [42, 274, "27fedc66-8b4f-4c03-87d7-27a53abd009e", "6636;N", "proper-m-00pp000p0"],
  [42, 276, "4ad443a5-76cf-4ceb-9d45-c07a8b542dea", "3710;L", "proper-m-00pp000p0"],
  [43, 277, "96119ba8-d86a-4489-aeda-1ce5b89c08fd", "3710;L", "proper-m-00pp000p0"],
  [43, 278, "2c383df5-a0bc-4062-b660-8374f6529f10", "3040;F", "proper-m-00nn000p0"],
  [43, 279, "ff6570cd-607c-4688-a1ad-a5cbaee772f9", "3040;F", "proper-m-00pp000p0"],
] as const;

const EXPECTED_60479 = [
  [6, 10, "26a880ea-c73f-465e-9583-1aa85f66839b", "usable-upright-world"],
  [11, 24, "33ed5d68-bee6-4b5d-887e-a010d9d3fd6c", "usable-upright-world"],
  [33, 202, "18345b00-07f9-4e28-b501-7e86f6511cc4", "usable-upright-world"],
  [38, 259, "cf561456-35f7-41e5-95f7-43390400760c", "non-upright-refusal"],
] as const;

const multiplyMatrices = (left: readonly number[], right: readonly number[]): readonly number[] =>
  Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset]! * right[offset * 3 + column]!,
      0,
    );
  });

function properComposedOrientationId(
  matrix: readonly number[],
  localOrientationId: string,
): string {
  const signs = [1, -1, -1] as const;
  const transformed = matrix.map((_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return matrix[column * 3 + row]! * signs[row]! * signs[column]!;
  });
  const world = PROPER_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((value, index) => Math.abs(value - transformed[index]!) <= 0.000001),
  );
  const local = PROPER_ORIENTATIONS.find(({ id }) => id === localOrientationId);
  if (world === undefined || local === undefined) {
    throw new TypeError(`Cannot derive proper composed orientation from ${localOrientationId}.`);
  }
  const composed = multiplyMatrices(world.matrix, local.matrix);
  const result = PROPER_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((value, index) => value === composed[index]),
  );
  if (result === undefined) throw new TypeError("Proper orientation vocabulary is not closed.");
  return result.id;
}

const exact = (actual: unknown, expected: unknown, label: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(
      `${label} is ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`,
    );
  }
};

/** Exact local-membership/world-usability census; it grants neither kind of authority. */
export function assertExactPrefixWorldCensus(input: {
  readonly rows: readonly PrefixRow[];
  readonly localRevisions: ReadonlySet<string>;
  readonly official: OfficialModelIndex;
  readonly calibrated: OfficialModelIndex;
  readonly calibration: BuilderCanonicalCalibration;
}): void {
  const { rows, localRevisions, official, calibrated, calibration } = input;
  const localRows = rows.filter(({ designRevision }) => localRevisions.has(designRevision));
  const failures = localRows.filter(
    ({ builderBrickRef }) => calibrated.bricks[builderBrickRef]!.canonicalTransform === null,
  );
  exact(
    [localRows.length, localRows.length - failures.length, failures.length],
    [192, 177, 15],
    "world census",
  );
  const frameByRevision = new Map(
    calibration.designFrames.map((frame) => [frame.designRevision, frame]),
  );
  const failureRows = failures.map((row) => {
    const source = official.bricks[row.builderBrickRef]!;
    const frame = frameByRevision.get(row.designRevision)!;
    if (
      !source.builderTransform ||
      !calibrated.bricks[row.builderBrickRef]!.canonicalTransformFailure?.includes(
        "cannot be expressed by the current canonical upright",
      )
    ) {
      throw new TypeError(
        `Local row ${row.builderBrickRef} did not fail specifically at the upright-world boundary.`,
      );
    }
    return [
      row.stepNumber,
      row.sourceBuilderIdentityOrdinal,
      row.builderBrickRef,
      row.designRevision,
      properComposedOrientationId(
        source.builderTransform.matrix,
        frame.catalogToBuilderLocalTransform.orientationId,
      ),
    ];
  });
  exact(failureRows, EXPECTED_WORLD_FAILURES, "exact local-but-world-refused rows");
  const all60479 = localRows
    .filter(({ designRevision }) => designRevision === "60479;F")
    .map((row) => [
      row.stepNumber,
      row.sourceBuilderIdentityOrdinal,
      row.builderBrickRef,
      calibrated.bricks[row.builderBrickRef]!.canonicalTransform === null
        ? "non-upright-refusal"
        : "usable-upright-world",
    ]);
  exact(all60479, EXPECTED_60479, "exact 60479 local/world occurrence rows");
  const allRefused = rows.filter(
    ({ builderBrickRef }) => calibrated.bricks[builderBrickRef]!.canonicalTransform === null,
  );
  exact(allRefused.length, 143, "all-prefix world refusals");
}
