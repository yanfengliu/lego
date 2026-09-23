import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  deriveRealBuildPrefix50Step44InteriorFeatureSource,
  measureRealBuildPrefix50Step44InteriorFeatures,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS,
} from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";

const WIDTH = 96 as const;
const HEIGHT = 72 as const;
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const BODY = [0x2f, 0x31, 0x32, 0xff] as const;
const BLUE = [0x20, 0x82, 0xdc, 0xff] as const;
const FALSE_BEAUTY_BLUE = [0x3b, 0x49, 0x59, 0xff] as const;
const SYNTHETIC_POLICY_COMMITMENT = canonicalDigest({
  schemaVersion: "lego.test-step44-semantic-color-policy/1",
  blueCyanColorIds: ["blue", "cyan"],
});

type Rgba = readonly [number, number, number, number];

export type RealBuildPrefix50Step44InteriorFeatureCalibrationControlId =
  "exact-positive" | "shift-beyond-radius" | "semantic-flood" | "gray-negative";

export interface RealBuildPrefix50Step44InteriorFeatureCalibrationControl {
  readonly id: RealBuildPrefix50Step44InteriorFeatureCalibrationControlId;
  readonly sourceCommitment: Sha256Digest;
  readonly beautyPixelDigest: Sha256Digest;
  readonly semanticMaskPixelDigest: Sha256Digest;
  readonly measurementCommitment: Sha256Digest;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly hogSimilarity: number;
}

export interface RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-interior-feature-calibration/1";
  readonly authority: "none";
  readonly dataExclusionPolicy: "fixed-synthetic-controls-only-no-pdf-no-parent-no-camera-branches-no-v3";
  readonly metricSchemaVersion: "lego.real-build-prefix50-step44-interior-feature-measurement/2";
  readonly width: 96;
  readonly height: 72;
  readonly parametersCommitment: Sha256Digest;
  readonly fixtureCommitment: Sha256Digest;
  readonly syntheticPolicyCommitment: Sha256Digest;
  readonly controls: readonly RealBuildPrefix50Step44InteriorFeatureCalibrationControl[];
  readonly strongestNegativeF1: number;
  readonly positiveNegativeSeparation: number;
  readonly thresholdDerivation: "midpoint-positive-vs-strongest-fixed-negative";
  readonly derivedThresholds: {
    readonly minimumBlueCyanF1: number;
    readonly minimumExpectedFaceBlueCyanF1Margin: number;
  };
  readonly commitment: Sha256Digest;
}

export const REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_EXPECTED_COMMITMENT =
  "sha256:6cb2af38155611540f4820cb424a0416fdb1a59b93a769e31a09beaa4ec4027d" as const;

function raster(color: Rgba = BACKGROUND): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(color, index * 4);
  return rgba;
}

function mask(fill = 0): Uint8Array {
  return new Uint8Array(WIDTH * HEIGHT).fill(fill);
}

function rectangle(
  rgba: Uint8Array,
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
  color: Rgba,
): void {
  for (let y = minimumY; y <= maximumY; y += 1)
    for (let x = minimumX; x <= maximumX; x += 1) rgba.set(color, (y * WIDTH + x) * 4);
}

function maskRectangle(
  value: Uint8Array,
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
): void {
  for (let y = minimumY; y <= maximumY; y += 1)
    for (let x = minimumX; x <= maximumX; x += 1) value[y * WIDTH + x] = 1;
}

function sourceRaster(): Uint8Array {
  const rgba = raster();
  rectangle(rgba, 8, 8, 87, 63, BODY);
  rectangle(rgba, 26, 22, 37, 48, BLUE);
  rectangle(rgba, 38, 38, 55, 48, BLUE);
  return rgba;
}

function exactSemanticMask(): Uint8Array {
  const value = mask();
  maskRectangle(value, 26, 22, 37, 48);
  maskRectangle(value, 38, 38, 55, 48);
  return value;
}

function shiftedBeauty(): Uint8Array {
  const rgba = raster();
  rectangle(rgba, 8, 8, 87, 63, BODY);
  rectangle(rgba, 48, 22, 59, 48, BLUE);
  return rgba;
}

function shiftedSemanticMask(): Uint8Array {
  const value = mask();
  maskRectangle(value, 48, 22, 59, 48);
  return value;
}

function floodSemanticMask(): Uint8Array {
  const value = mask();
  maskRectangle(value, 8, 8, 87, 63);
  return value;
}

function grayNegativeBeauty(): Uint8Array {
  const rgba = raster();
  rectangle(rgba, 8, 8, 87, 63, FALSE_BEAUTY_BLUE);
  return rgba;
}

function calibrationControl(input: {
  readonly id: RealBuildPrefix50Step44InteriorFeatureCalibrationControlId;
  readonly source: ReturnType<typeof deriveRealBuildPrefix50Step44InteriorFeatureSource>;
  readonly beauty: Uint8Array;
  readonly semantic: Uint8Array;
}): RealBuildPrefix50Step44InteriorFeatureCalibrationControl {
  const measurement = measureRealBuildPrefix50Step44InteriorFeatures({
    source: input.source,
    beautyRenderRgba: input.beauty,
    semanticBlueCyanMask: input.semantic,
    semanticPolicyCommitment: SYNTHETIC_POLICY_COMMITMENT,
  });
  return deepFreeze({
    id: input.id,
    sourceCommitment: input.source.evidence.commitment,
    beautyPixelDigest: measurement.beautyRenderPixelDigest,
    semanticMaskPixelDigest: measurement.semanticMaskPixelDigest,
    measurementCommitment: measurement.commitment,
    precision: measurement.precision,
    recall: measurement.recall,
    f1: measurement.f1,
    hogSimilarity: measurement.hogSimilarity,
  });
}

export function deriveRealBuildPrefix50Step44InteriorFeatureCalibration(): RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt {
  const sourceRgba = sourceRaster();
  const eligibleMask = mask(1);
  const source = deriveRealBuildPrefix50Step44InteriorFeatureSource({
    width: WIDTH,
    height: HEIGHT,
    sourceRgba,
    eligibleMask,
  });
  const controlInputs = [
    {
      id: "exact-positive" as const,
      beauty: sourceRgba,
      semantic: exactSemanticMask(),
    },
    {
      id: "shift-beyond-radius" as const,
      beauty: shiftedBeauty(),
      semantic: shiftedSemanticMask(),
    },
    {
      id: "semantic-flood" as const,
      beauty: sourceRgba,
      semantic: floodSemanticMask(),
    },
    {
      id: "gray-negative" as const,
      beauty: grayNegativeBeauty(),
      semantic: mask(),
    },
  ];
  const controls = controlInputs.map((control) => calibrationControl({ ...control, source }));
  const positive = controls[0]!;
  const strongestNegativeF1 = Math.max(...controls.slice(1).map(({ f1 }) => f1));
  const positiveNegativeSeparation = positive.f1 - strongestNegativeF1;
  if (
    positive.f1 !== 1 ||
    controls[3]!.f1 !== 0 ||
    controls.slice(1).some(({ f1 }) => !Number.isFinite(f1) || f1 >= positive.f1) ||
    !(positiveNegativeSeparation > 0)
  )
    throw new TypeError(
      "Step-44 semantic metric calibration controls did not retain an exact positive, zero gray control, and separated fixed negatives.",
    );
  const derivedThresholds = deepFreeze({
    minimumBlueCyanF1: (positive.f1 + strongestNegativeF1) / 2,
    minimumExpectedFaceBlueCyanF1Margin: positiveNegativeSeparation / 2,
  });
  const fixtureCommitment = canonicalDigest({
    sourcePixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(sourceRgba),
    eligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(eligibleMask),
    controls: controlInputs.map(({ id, beauty, semantic }) => ({
      id,
      beautyPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(beauty),
      semanticMaskPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(semantic),
    })),
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-interior-feature-calibration/1" as const,
    authority: "none" as const,
    dataExclusionPolicy:
      "fixed-synthetic-controls-only-no-pdf-no-parent-no-camera-branches-no-v3" as const,
    metricSchemaVersion: "lego.real-build-prefix50-step44-interior-feature-measurement/2" as const,
    width: WIDTH,
    height: HEIGHT,
    parametersCommitment: canonicalDigest(REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS),
    fixtureCommitment,
    syntheticPolicyCommitment: SYNTHETIC_POLICY_COMMITMENT,
    controls,
    strongestNegativeF1,
    positiveNegativeSeparation,
    thresholdDerivation: "midpoint-positive-vs-strongest-fixed-negative" as const,
    derivedThresholds,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export const REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION =
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration();

if (
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION.commitment !==
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_EXPECTED_COMMITMENT
)
  throw new TypeError(
    "Step-44 semantic metric-v2 calibration drifted from its preregistered fixed-control commitment.",
  );

export const REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT =
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_EXPECTED_COMMITMENT;
