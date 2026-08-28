import type { BuilderCanonicalCalibration } from "../e2e/real-build-builder-calibration";
import { createBuilderProperWorldDiagnostic } from "../e2e/real-build-builder-proper-world-diagnostic";
import type { OfficialModelIndex } from "../e2e/real-build-official";

interface PrefixRow {
  readonly stepNumber: number;
  readonly sourceBuilderIdentityOrdinal: number;
  readonly builderBrickRef: string;
  readonly designRevision: string;
}

const EXPECTED_WORLD_FAILURES = [
  [
    27,
    149,
    "3904200e-c9cf-41cc-adcf-fc97dfdbb54f",
    "4162;O",
    [-480, -2, -168],
    "proper-m-00pp000p0",
  ],
  [
    38,
    258,
    "97adf751-0663-4d61-a4a2-6d6105294e7a",
    "35480;K",
    [-120, -86, 108],
    "proper-m-00pp000p0",
  ],
  [
    38,
    259,
    "cf561456-35f7-41e5-95f7-43390400760c",
    "60479;F",
    [-220, -86, 116],
    "proper-m-00pp000p0",
  ],
  [
    39,
    260,
    "64d86942-0464-4b68-a06b-6692837a85ef",
    "35480;K",
    [-320, -86, 108],
    "proper-m-00pp000p0",
  ],
  [
    39,
    262,
    "296e168c-c607-4676-babd-799dc24dc79e",
    "35480;K",
    [-180, -86, 108],
    "proper-m-00pp000p0",
  ],
  [
    39,
    263,
    "2ed95175-5620-47b7-bee5-af9ffb5b7f3a",
    "35480;K",
    [-260, -86, 108],
    "proper-m-00pp000p0",
  ],
  [
    41,
    270,
    "1260a44e-b125-411e-8552-596f22aa32e4",
    "35480;K",
    [-120, -86, 92],
    "proper-m-00pp000p0",
  ],
  [
    41,
    271,
    "a9aee720-9a6d-4d05-b1cb-2821d8101d03",
    "35480;K",
    [-320, -86, 92],
    "proper-m-00pp000p0",
  ],
  [
    41,
    272,
    "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06",
    "35480;K",
    [-260, -86, 92],
    "proper-m-00pp000p0",
  ],
  [
    41,
    273,
    "8a6a770f-a0b9-430a-8802-8f057fbd748a",
    "35480;K",
    [-180, -86, 92],
    "proper-m-00pp000p0",
  ],
  [
    42,
    274,
    "27fedc66-8b4f-4c03-87d7-27a53abd009e",
    "6636;N",
    [-160, -86, 84],
    "proper-m-00pp000p0",
  ],
  [
    42,
    276,
    "4ad443a5-76cf-4ceb-9d45-c07a8b542dea",
    "3710;L",
    [-260, -86, 84],
    "proper-m-00pp000p0",
  ],
  [
    43,
    277,
    "96119ba8-d86a-4489-aeda-1ce5b89c08fd",
    "3710;L",
    [-260, -86, 76],
    "proper-m-00pp000p0",
  ],
  [
    43,
    278,
    "2c383df5-a0bc-4062-b660-8374f6529f10",
    "3040;F",
    [-240, -86, 60],
    "proper-m-00nn000p0",
  ],
  [
    43,
    279,
    "ff6570cd-607c-4688-a1ad-a5cbaee772f9",
    "3040;F",
    [-280, -86, 60],
    "proper-m-00pp000p0",
  ],
] as const;

const EXPECTED_60479 = [
  [6, 10, "26a880ea-c73f-465e-9583-1aa85f66839b", "usable-upright-world"],
  [11, 24, "33ed5d68-bee6-4b5d-887e-a010d9d3fd6c", "usable-upright-world"],
  [33, 202, "18345b00-07f9-4e28-b501-7e86f6511cc4", "usable-upright-world"],
  [38, 259, "cf561456-35f7-41e5-95f7-43390400760c", "non-upright-refusal"],
] as const;

const EXPECTED_2453 = [
  [49, 302, "0696eec0-5ee4-4f0a-952b-e49796d7ce91", "usable-upright-world"],
  [49, 303, "d413dd99-d11a-454e-ad6e-20e03b7a1a2a", "usable-upright-world"],
  [49, 304, "cf359e97-0527-4524-84a3-3df5f65a049c", "usable-upright-world"],
  [50, 315, "8c0bff46-045f-47bc-b09b-e77b208dee1f", "usable-upright-world"],
  [50, 316, "4d39f87c-2c3c-4669-91cf-7f8b086901fe", "usable-upright-world"],
] as const;

const exact = (actual: unknown, expected: unknown, label: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(
      `${label} is ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`,
    );
  }
};

/** Exact local-membership/world-usability census; it grants neither kind of authority. */
export async function assertExactPrefixWorldCensus(input: {
  readonly rows: readonly PrefixRow[];
  readonly localRevisions: ReadonlySet<string>;
  readonly official: OfficialModelIndex;
  readonly calibrated: OfficialModelIndex;
  readonly calibration: BuilderCanonicalCalibration;
  readonly officialXmlBytes: Uint8Array;
  readonly calibrationBytes: Uint8Array;
  readonly builderGeometryBundleBytes: Uint8Array;
  readonly builder2453IdentityToken: unknown;
}) {
  const {
    rows,
    localRevisions,
    official,
    calibrated,
    calibration,
    officialXmlBytes,
    calibrationBytes,
    builderGeometryBundleBytes,
  } = input;
  const diagnostic = await createBuilderProperWorldDiagnostic({
    rows,
    official,
    calibrated,
    calibration,
    officialXmlBytes,
    calibrationBytes,
    builderGeometryBundleBytes,
    builder2453IdentityToken: input.builder2453IdentityToken,
  });
  const localRows = rows.filter(({ designRevision }) => localRevisions.has(designRevision));
  const failures = localRows.filter(
    ({ builderBrickRef }) => calibrated.bricks[builderBrickRef]!.canonicalTransform === null,
  );
  exact(
    [localRows.length, localRows.length - failures.length, failures.length],
    [197, 182, 15],
    "world census",
  );
  const frameByRevision = new Map(
    calibration.designFrames.map((frame) => [frame.designRevision, frame]),
  );
  exact(frameByRevision.size, calibration.designFrames.length, "unique local frames");
  exact(
    diagnostic.counts,
    {
      requestedRows: 320,
      localFrameRows: 197,
      authorableUprightRows: 182,
      diagnosticProperOnlyRows: 15,
      missingLocalFrameRows: 123,
    },
    "proper-world diagnostic census",
  );
  exact(
    diagnostic.diagnosticOnlyOrientationCounts,
    { "proper-m-00nn000p0": 1, "proper-m-00pp000p0": 14 },
    "proper-world diagnostic orientation census",
  );
  exact(diagnostic.documentOrientationPolicy, "unchanged-four-upright", "document policy");
  exact(Object.values(diagnostic.authority), Array(9).fill(false), "diagnostic authority");
  const failureRows = diagnostic.rows
    .filter(({ classification }) => classification === "diagnostic-proper-only")
    .map((row) => {
      const source = official.bricks[row.builderBrickRef]!;
      if (
        !source.builderTransform ||
        calibrated.bricks[row.builderBrickRef]!.canonicalTransform !== null ||
        !calibrated.bricks[row.builderBrickRef]!.canonicalTransformFailure?.includes(
          "cannot be expressed by the current canonical upright",
        )
      ) {
        throw new TypeError(
          `Local row ${row.builderBrickRef} did not remain refused specifically at the canonical ` +
            `upright boundary.`,
        );
      }
      return [
        row.stepNumber,
        row.sourceBuilderIdentityOrdinal,
        row.builderBrickRef,
        row.designRevision,
        row.diagnosticProperTransform.positionLdu,
        row.diagnosticProperTransform.orientationId,
      ];
    });
  exact(failureRows, EXPECTED_WORLD_FAILURES, "exact local-but-world-refused rows");
  const all60479 = localRows
    .filter(({ designRevision }) => designRevision === "60479;F")
    .map((row) => [
      row.stepNumber,
      row.sourceBuilderIdentityOrdinal,
      row.builderBrickRef,
      diagnostic.rows.find(({ builderBrickRef }) => builderBrickRef === row.builderBrickRef)!
        .classification === "diagnostic-proper-only"
        ? "non-upright-refusal"
        : "usable-upright-world",
    ]);
  exact(all60479, EXPECTED_60479, "exact 60479 local/world occurrence rows");
  const all2453 = localRows
    .filter(({ designRevision }) => designRevision === "2453;I")
    .map((row) => [
      row.stepNumber,
      row.sourceBuilderIdentityOrdinal,
      row.builderBrickRef,
      diagnostic.rows.find(({ builderBrickRef }) => builderBrickRef === row.builderBrickRef)!
        .classification === "diagnostic-proper-only"
        ? "non-upright-refusal"
        : "usable-upright-world",
    ]);
  exact(all2453, EXPECTED_2453, "exact 2453;I local/world occurrence rows");
  const allRefused = rows.filter(
    ({ builderBrickRef }) => calibrated.bricks[builderBrickRef]!.canonicalTransform === null,
  );
  exact(allRefused.length, 138, "all-prefix world refusals");
  return diagnostic;
}
