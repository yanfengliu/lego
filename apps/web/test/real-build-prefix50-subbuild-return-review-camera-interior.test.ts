import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  deriveRealBuildPrefix50Step44InteriorFeatureSource,
  deriveRealBuildPrefix50Step44SemanticBlueCyanMask,
  measureRealBuildPrefix50Step44InteriorFeatures,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-interior.ts";

const WIDTH = 96;
const HEIGHT = 72;
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const BODY = [0x2f, 0x31, 0x32, 0xff] as const;
const BLUE = [0x20, 0x82, 0xdc, 0xff] as const;
const SEMANTIC_POLICY_COMMITMENT = canonicalDigest({
  schemaVersion: "lego.test-step44-semantic-color-policy/1",
  blueCyanColorIds: ["blue", "cyan"],
});

type Rgba = readonly [number, number, number, number];

function raster(color: Rgba = BACKGROUND): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(color, index * 4);
  return rgba;
}

function eligible(value = 1): Uint8Array {
  return new Uint8Array(WIDTH * HEIGHT).fill(value);
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
  mask: Uint8Array,
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
): void {
  for (let y = minimumY; y <= maximumY; y += 1)
    for (let x = minimumX; x <= maximumX; x += 1) mask[y * WIDTH + x] = 1;
}

function sourceRaster(): Uint8Array {
  const rgba = raster();
  rectangle(rgba, 8, 8, 87, 63, BODY);
  rectangle(rgba, 26, 22, 37, 48, BLUE);
  rectangle(rgba, 38, 38, 55, 48, BLUE);
  return rgba;
}

function renderWithFeature(
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
  color: Rgba = BLUE,
): Uint8Array {
  const rgba = raster();
  rectangle(rgba, 8, 8, 87, 63, BODY);
  rectangle(rgba, minimumX, minimumY, maximumX, maximumY, color);
  return rgba;
}

function semanticFeatureMask(): Uint8Array {
  const mask = eligible(0);
  maskRectangle(mask, 26, 22, 37, 48);
  maskRectangle(mask, 38, 38, 55, 48);
  return mask;
}

function semanticRectangleMask(
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
): Uint8Array {
  const mask = eligible(0);
  maskRectangle(mask, minimumX, minimumY, maximumX, maximumY);
  return mask;
}

function measure(input: {
  readonly source: ReturnType<typeof source>;
  readonly beautyRenderRgba: Uint8Array;
  readonly semanticBlueCyanMask?: Uint8Array;
}) {
  return measureRealBuildPrefix50Step44InteriorFeatures({
    source: input.source,
    beautyRenderRgba: input.beautyRenderRgba,
    semanticBlueCyanMask: input.semanticBlueCyanMask ?? semanticFeatureMask(),
    semanticPolicyCommitment: SEMANTIC_POLICY_COMMITMENT,
  });
}

function source() {
  return deriveRealBuildPrefix50Step44InteriorFeatureSource({
    width: WIDTH,
    height: HEIGHT,
    sourceRgba: sourceRaster(),
    eligibleMask: eligible(),
  });
}

describe("prefix-50 Step-44 source-localized interior feature instrument", () => {
  it("derives an exact binary target mask from a categorical color-ID raster", () => {
    const categorical = raster([0x20, 0x20, 0x20, 0xff]);
    rectangle(categorical, 26, 22, 37, 48, [0x00, 0xff, 0xff, 0xff]);
    rectangle(categorical, 38, 38, 55, 48, [0x00, 0xff, 0xff, 0xff]);

    const mask = deriveRealBuildPrefix50Step44SemanticBlueCyanMask(categorical, WIDTH, HEIGHT);

    expect(mask).toEqual(semanticFeatureMask());
    expect(mask[10 * WIDTH + 10]).toBe(0);
    expect(mask[22 * WIDTH + 26]).toBe(1);
    expect(() =>
      deriveRealBuildPrefix50Step44SemanticBlueCyanMask(new Uint8Array(4), WIDTH, HEIGHT),
    ).toThrow(/four RGBA bytes/u);
  });

  it("derives only source support and makes the same silhouette with a wrong interior lose", () => {
    const exactSource = source();
    const correct = measure({
      source: exactSource,
      beautyRenderRgba: sourceRaster(),
    });
    const wrong = measure({
      source: exactSource,
      beautyRenderRgba: renderWithFeature(58, 22, 69, 48),
      semanticBlueCyanMask: semanticRectangleMask(58, 22, 69, 48),
    });

    expect(exactSource.evidence).toMatchObject({
      authority: "none",
      supportDependency: "source-rgba-and-exact-eligible-mask-only",
      eligiblePixelCount: WIDTH * HEIGHT,
      selectionAuthority: false,
      tieBreakAuthority: false,
      parameters: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS,
    });
    expect(correct).toMatchObject({
      precision: 1,
      recall: 1,
      f1: 1,
      authority: "none",
      selectionAuthority: false,
      tieBreakAuthority: false,
    });
    expect(correct.f1).toBeGreaterThan(wrong.f1);
    expect(correct.hogSimilarity).toBeGreaterThan(wrong.hogSimilarity);
    expect(correct.supportPixelCount).toBe(wrong.supportPixelCount);
    expect(correct.sourceFeaturePixelCount).toBe(wrong.sourceFeaturePixelCount);
    expect("candidateKey" in correct).toBe(false);
    expect("winner" in correct).toBe(false);
  });

  it("penalizes a semantic blue/cyan flood through precision even though recall is complete", () => {
    const exactSource = source();
    const semanticFlood = eligible(0);
    maskRectangle(semanticFlood, 8, 8, 87, 63);
    const correct = measure({
      source: exactSource,
      beautyRenderRgba: sourceRaster(),
    });
    const flooded = measure({
      source: exactSource,
      beautyRenderRgba: sourceRaster(),
      semanticBlueCyanMask: semanticFlood,
    });

    expect(flooded.recall).toBe(1);
    expect(flooded.precision).toBeLessThan(correct.precision);
    expect(flooded.f1).toBeLessThan(correct.f1);
    expect(flooded.renderFeaturePixelCount).toBeGreaterThan(correct.renderFeaturePixelCount);
  });

  it("keeps a dark-blue beauty flood out of F1 while the semantic mask remains correct", () => {
    const exactSource = source();
    const correct = measure({
      source: exactSource,
      beautyRenderRgba: sourceRaster(),
    });
    const beautyFlood = raster();
    rectangle(beautyFlood, 8, 8, 87, 63, [0x3b, 0x49, 0x59, 0xff]);
    const floodedBeauty = measure({
      source: exactSource,
      beautyRenderRgba: beautyFlood,
    });

    expect(floodedBeauty.f1).toBe(1);
    expect(floodedBeauty.f1).toBe(correct.f1);
    expect(floodedBeauty.semanticMaskPixelDigest).toBe(correct.semanticMaskPixelDigest);
    expect(floodedBeauty.beautyRenderPixelDigest).not.toBe(correct.beautyRenderPixelDigest);
    expect(floodedBeauty.hogSimilarity).toBeLessThan(correct.hogSimilarity);
  });

  it("penalizes a blue feature shifted beyond the fixed tolerant radius", () => {
    const exactSource = source();
    const shifted = measure({
      source: exactSource,
      beautyRenderRgba: renderWithFeature(48, 22, 59, 48),
      semanticBlueCyanMask: semanticRectangleMask(48, 22, 59, 48),
    });
    const correct = measure({
      source: exactSource,
      beautyRenderRgba: sourceRaster(),
    });

    expect(REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS.tolerantMatchRadiusPx).toBe(4);
    expect(shifted.precision).toBeLessThan(correct.precision);
    expect(shifted.recall).toBeLessThan(correct.recall);
    expect(shifted.f1).toBeLessThan(correct.f1);
  });

  it("refuses empty, degenerate, featureless, and malformed source rasters", () => {
    expect(() =>
      deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: WIDTH,
        height: HEIGHT,
        sourceRgba: raster(),
        eligibleMask: eligible(),
      }),
    ).toThrow(/no support/u);

    const narrowEligible = eligible(0);
    for (let y = 10; y < 12; y += 1)
      for (let x = 10; x < 86; x += 1) narrowEligible[y * WIDTH + x] = 1;
    expect(() =>
      deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: WIDTH,
        height: HEIGHT,
        sourceRgba: sourceRaster(),
        eligibleMask: narrowEligible,
      }),
    ).toThrow(/no support/u);

    const featureless = raster();
    rectangle(featureless, 8, 8, 87, 63, BODY);
    expect(() =>
      deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: WIDTH,
        height: HEIGHT,
        sourceRgba: featureless,
        eligibleMask: eligible(),
      }),
    ).toThrow(/no blue\/cyan feature/u);

    const nonbinary = eligible();
    nonbinary[0] = 2;
    expect(() =>
      deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: WIDTH,
        height: HEIGHT,
        sourceRgba: sourceRaster(),
        eligibleMask: nonbinary,
      }),
    ).toThrow(/exact binary/u);
    expect(() =>
      deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: Number.POSITIVE_INFINITY,
        height: HEIGHT,
        sourceRgba: sourceRaster(),
        eligibleMask: eligible(),
      }),
    ).toThrow(/positive safe-integer dimensions/u);
    expect(() =>
      measureRealBuildPrefix50Step44InteriorFeatures({
        source: source(),
        beautyRenderRgba: new Uint8Array(4),
        semanticBlueCyanMask: semanticFeatureMask(),
        semanticPolicyCommitment: SEMANTIC_POLICY_COMMITMENT,
      }),
    ).toThrow(/four RGBA bytes/u);

    const malformedSemanticMask = semanticFeatureMask();
    malformedSemanticMask[0] = 2;
    expect(() =>
      measureRealBuildPrefix50Step44InteriorFeatures({
        source: source(),
        beautyRenderRgba: sourceRaster(),
        semanticBlueCyanMask: malformedSemanticMask,
        semanticPolicyCommitment: SEMANTIC_POLICY_COMMITMENT,
      }),
    ).toThrow(/exact binary/u);
    expect(() =>
      measureRealBuildPrefix50Step44InteriorFeatures({
        source: source(),
        beautyRenderRgba: sourceRaster(),
        semanticBlueCyanMask: new Uint8Array(1),
        semanticPolicyCommitment: SEMANTIC_POLICY_COMMITMENT,
      }),
    ).toThrow(/one byte per raster pixel/u);
    expect(() =>
      measureRealBuildPrefix50Step44InteriorFeatures({
        source: source(),
        beautyRenderRgba: sourceRaster(),
        semanticBlueCyanMask: semanticFeatureMask(),
        semanticPolicyCommitment: "sha256:not-a-digest" as typeof SEMANTIC_POLICY_COMMITMENT,
      }),
    ).toThrow(/lowercase sha256 digest/u);
  });

  it("records style and luma changes as evidence without minting branch authority", () => {
    const exactSource = source();
    const styled = raster([0x75, 0x78, 0x79, 0xff]);
    rectangle(styled, 8, 8, 87, 63, [0x57, 0x59, 0x5a, 0xff]);
    rectangle(styled, 26, 22, 37, 48, [0x12, 0x49, 0x7c, 0xff]);
    rectangle(styled, 38, 38, 55, 48, [0x12, 0x49, 0x7c, 0xff]);
    const measurement = measure({
      source: exactSource,
      beautyRenderRgba: styled,
    });

    expect(measurement.beautyRenderPixelDigest).not.toBe(exactSource.evidence.sourcePixelDigest);
    expect(measurement.f1).toBe(1);
    expect(measurement.hogSimilarity).toBeGreaterThan(0.99);
    expect(measurement).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step44-interior-feature-measurement/2",
      authority: "none",
      intendedUse: "diagnostic-and-refusal-evidence-only",
      selectionAuthority: false,
      tieBreakAuthority: false,
    });
  });

  it("replays byte-identically and leaves equal scores as an unresolved tie", () => {
    const firstSource = source();
    const secondSource = source();
    const first = measure({
      source: firstSource,
      beautyRenderRgba: sourceRaster(),
    });
    const second = measure({
      source: secondSource,
      beautyRenderRgba: sourceRaster(),
    });
    const sameGeometryDifferentColor = sourceRaster();
    // This cyan is byte-distinct but has the exact same integer-weighted luma as BLUE:
    // 2126R + 7152G + 722B is equal for [15,140,171] and [32,130,220].
    rectangle(sameGeometryDifferentColor, 26, 22, 37, 48, [0x0f, 0x8c, 0xab, 0xff]);
    rectangle(sameGeometryDifferentColor, 38, 38, 55, 48, [0x0f, 0x8c, 0xab, 0xff]);
    const tied = measure({
      source: firstSource,
      beautyRenderRgba: sameGeometryDifferentColor,
    });
    const differentPolicyCommitment = canonicalDigest({
      schemaVersion: "lego.test-step44-semantic-color-policy/2",
      blueCyanColorIds: ["blue", "cyan"],
    });
    const differentPolicy = measureRealBuildPrefix50Step44InteriorFeatures({
      source: firstSource,
      beautyRenderRgba: sourceRaster(),
      semanticBlueCyanMask: semanticFeatureMask(),
      semanticPolicyCommitment: differentPolicyCommitment,
    });

    expect(canonicalStringify(firstSource.evidence)).toBe(
      canonicalStringify(secondSource.evidence),
    );
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(tied.f1).toBe(first.f1);
    expect(tied.hogSimilarity).toBeCloseTo(first.hogSimilarity, 12);
    expect(tied.beautyRenderPixelDigest).not.toBe(first.beautyRenderPixelDigest);
    expect(tied.semanticMaskPixelDigest).toBe(first.semanticMaskPixelDigest);
    expect(tied.semanticPolicyCommitment).toBe(SEMANTIC_POLICY_COMMITMENT);
    expect(tied.commitment).not.toBe(first.commitment);
    expect(differentPolicy.f1).toBe(first.f1);
    expect(differentPolicy.semanticPolicyCommitment).toBe(differentPolicyCommitment);
    expect(differentPolicy.commitment).not.toBe(first.commitment);
    expect(tied.tieBreakAuthority).toBe(false);
  });
});
