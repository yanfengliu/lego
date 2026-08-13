import { describe, expect, it } from "vitest";

import {
  MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS,
  MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_HIGHLIGHT_FILL_PIXELS,
  deriveRealBuildObservationSourceRasterCandidate,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate";
import { createRealBuildObservationSourceRasterCandidateMask } from "./real-build-observation-source-raster-candidate-mask";

const BACKGROUND = [0x89, 0x90, 0x93, 255] as const;
const BLACK = [20, 20, 20, 255] as const;
const HIGHLIGHT = [0xff, 0xcc, 0, 255] as const;

function raster(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(BACKGROUND, index * 4);
  }
  return pixels;
}

function paint(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void {
  pixels.set(colour, (y * width + x) * 4);
}

function fill(
  pixels: Uint8ClampedArray,
  width: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  colour = BLACK,
): void {
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) paint(pixels, width, x, y, colour);
  }
}

function stroke(
  pixels: Uint8ClampedArray,
  width: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  for (let x = minX; x <= maxX; x += 1) {
    paint(pixels, width, x, minY, HIGHLIGHT);
    paint(pixels, width, x, maxY, HIGHLIGHT);
  }
  for (let y = minY; y <= maxY; y += 1) {
    paint(pixels, width, minX, y, HIGHLIGHT);
    paint(pixels, width, maxX, y, HIGHLIGHT);
  }
}

describe("the non-authoritative work-raster observation source candidate", () => {
  it("derives distinct lookahead and own-panel sources under explicit scaled policy", () => {
    const width = 60;
    const height = 40;
    const pixels = raster(width, height);
    fill(pixels, width, 5, 5, 54, 34);
    stroke(pixels, width, 20, 12, 39, 27);

    const result = deriveRealBuildObservationSourceRasterCandidate(
      width,
      height,
      4,
      pixels,
      10,
      70,
      20,
      60,
      new Float64Array(0),
    );

    expect(result.authority).toBe("absent");
    expect(result.policyDescriptorInputs).toMatchObject({
      backgroundHex: 0x899093,
      backgroundToleranceLevels: 10,
      printedBoxWhiteLevel: 246,
      printedBoxMinimumAreaPx: 25,
      printedBoxMarginPx: 2,
      highlightMinimumOutlinePx: 10,
      highlightCloseRadiusPx: 2,
      isolationConnectivity: 4,
      isolationSelection: "largest-component",
      isolationOpeningRadiusPx: 0,
    });
    const insideHighlight = 20 * width + 30;
    const oldAssembly = 8 * width + 8;
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.assemblyMask)[insideHighlight],
    ).toBe(1);
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.ownPanel.builtMask)[
        insideHighlight
      ],
    ).toBe(1);
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.lookahead.builtMask)[
        insideHighlight
      ],
    ).toBe(0);
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.lookahead.excludedMask)[
        insideHighlight
      ],
    ).toBe(1);
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.lookahead.builtMask)[oldAssembly],
    ).toBe(1);
    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.ownPanel.excludedMask).every(
        (value) => value === 0,
      ),
    ).toBe(true);
    expect(result.lookahead.builtMaskDigest).not.toBe(result.ownPanel.builtMaskDigest);
    expect(result.lookahead.excludedMaskDigest).not.toBe(result.ownPanel.excludedMaskDigest);
    expect(result.lookahead.sourceDescriptorDigest).not.toBe(
      result.ownPanel.sourceDescriptorDigest,
    );
    expect(result.lookahead.sourceDescriptorInputs).toMatchObject({
      observationTarget: "lookahead-built-prefix/1",
      highlightTreatment: "removed-from-source-and-excluded/1",
      measure: "iou",
      measureRecommendation: "iou",
      measureClassifierInputs: {
        measure: "iou",
        hasHighlightEvidence: true,
        fillPx: expect.any(Number),
      },
    });
    expect(result.ownPanel.sourceDescriptorInputs).toMatchObject({
      observationTarget: "own-panel-isolated-printed-assembly-art/1",
      highlightTreatment: "retained-as-printed/1",
      measureRecommendation: "iou",
    });
    expect(result.ownPanel.exclusionDescriptorInputs).toMatchObject({
      exclusionMaskSemantics: "zero-mask/1",
    });
    expect(result.ownPanel.builtMask).toBe(result.assemblyMask);
  });

  it("binds containment when the live lookahead classifier sees only open highlight", () => {
    const width = 40;
    const height = 30;
    const pixels = raster(width, height);
    fill(pixels, width, 3, 3, 36, 26);
    for (let x = 10; x < 30; x += 1) paint(pixels, width, x, 12, HIGHLIGHT);

    const result = deriveRealBuildObservationSourceRasterCandidate(
      width,
      height,
      4,
      pixels,
      0,
      width,
      0,
      height,
      new Float64Array(0),
    );

    expect(result.lookahead.sourceDescriptorInputs).toMatchObject({
      measure: "containment",
      measureRecommendation: "containment",
      measureClassifierInputs: {
        measure: "containment",
        hasHighlightEvidence: true,
        keyedPx: 20,
        regionCount: 1,
        strokePx: 20,
        fillPx: 0,
      },
    });
    expect(result.ownPanel.sourceDescriptorInputs).toMatchObject({
      measure: "iou",
      measureRecommendation: "iou",
    });
  });

  it("maps bottom-origin PDF callouts onto the top-origin work raster without a page height", () => {
    const width = 12;
    const height = 12;
    const pixels = raster(width, height);
    fill(pixels, width, 1, 0, 4, 2);
    fill(pixels, width, 1, 9, 4, 11);

    const withoutCallout = deriveRealBuildObservationSourceRasterCandidate(
      width,
      height,
      10,
      pixels,
      0,
      12,
      0,
      12,
      new Float64Array(0),
    );
    const topCallout = deriveRealBuildObservationSourceRasterCandidate(
      width,
      height,
      10,
      pixels,
      0,
      12,
      0,
      12,
      new Float64Array([1, 5, 9, 12]),
    );

    const withoutMask = unpackRealBuildObservationSourceRasterCandidateMask(
      withoutCallout.assemblyMask,
    );
    const topMask = unpackRealBuildObservationSourceRasterCandidateMask(topCallout.assemblyMask);
    expect(withoutMask[1]).toBe(1);
    expect(withoutMask[10 * width + 2]).toBe(0);
    expect(topMask[1]).toBe(0);
    expect(topMask[10 * width + 2]).toBe(1);
    expect(topCallout.derivationDescriptorDigest).not.toBe(
      withoutCallout.derivationDescriptorDigest,
    );
  });

  it("detaches inputs and freezes every returned mask and descriptor", () => {
    const pixels = raster(20, 20);
    fill(pixels, 20, 2, 2, 17, 17);
    const callouts = new Float64Array(0);
    const result = deriveRealBuildObservationSourceRasterCandidate(
      20,
      20,
      4,
      pixels,
      0,
      20,
      0,
      20,
      callouts,
    );
    const descriptorBefore = JSON.stringify(result.assemblyMask);
    const unpacked = unpackRealBuildObservationSourceRasterCandidateMask(result.assemblyMask);
    const before = unpacked[2 * 20 + 2];
    pixels.fill(0);
    unpacked.fill(0);

    expect(
      unpackRealBuildObservationSourceRasterCandidateMask(result.assemblyMask)[2 * 20 + 2],
    ).toBe(before);
    expect(JSON.stringify(result.assemblyMask)).toBe(descriptorBefore);
    expect(result.assemblyMask.unpackedDigest).toBe(result.assemblyMaskDigest);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.assemblyMask)).toBe(true);
    expect(Object.isFrozen(result.lookahead)).toBe(true);
    expect(Object.isFrozen(result.lookahead.builtMask)).toBe(true);
    expect(Object.isFrozen(result.lookahead.sourceDescriptorInputs)).toBe(true);
    expect(() => {
      (result.assemblyMask as { base64: string }).base64 = "AAAA";
    }).toThrow(TypeError);
  });

  it("snapshots mask bytes once and rejects proxy or shared mutation surfaces", () => {
    const source = new Uint8Array([1, 0, 1, 0]);
    const retained = createRealBuildObservationSourceRasterCandidateMask(source, 2, 2);
    source.fill(0);

    expect(unpackRealBuildObservationSourceRasterCandidateMask(retained)).toEqual(
      new Uint8Array([1, 0, 1, 0]),
    );
    expect(() =>
      createRealBuildObservationSourceRasterCandidateMask(new Proxy(new Uint8Array([1]), {}), 1, 1),
    ).toThrowError(
      "Observation source candidate mask must be one exact Uint8Array. Pass intrinsic non-shared binary-mask storage, not a proxy, clamped array, or array-like wrapper.",
    );
    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        createRealBuildObservationSourceRasterCandidateMask(
          new Uint8Array(new SharedArrayBuffer(1)),
          1,
          1,
        ),
      ).toThrowError(
        "Observation source candidate mask must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the packed bytes or either digest.",
      );
    }
  });

  it("refuses hostile raster sizes, byte lengths, wrappers, and callout collections", () => {
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        1_025,
        1_024,
        4,
        new Uint8Array(0),
        0,
        1,
        0,
        1,
        new Float64Array(0),
      ),
    ).toThrowError(
      "Observation source candidate raster 1025x1024 exceeds the 1048576-pixel bound. Reject or resample the retained panel before deriving observation masks.",
    );
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        2,
        2,
        1,
        new Uint8ClampedArray(15),
        0,
        1,
        0,
        1,
        new Float64Array(0),
      ),
    ).toThrowError(
      "Observation source candidate RGBA holds 15 bytes but the raster needs 16. Pass all four channels for every pixel, with row zero at the top.",
    );
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        1,
        1,
        1,
        new Proxy(new Uint8ClampedArray(4), {}),
        0,
        1,
        0,
        1,
        new Float64Array(0),
      ),
    ).toThrowError(
      "Observation source candidate RGBA must be an exact Uint8Array or Uint8ClampedArray. Pass the retained work-raster bytes, not an array-like object or accessor wrapper.",
    );
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        1,
        1,
        1,
        new Uint8ClampedArray(4),
        0,
        1,
        0,
        1,
        new Float64Array(5),
      ),
    ).toThrowError(
      "Observation source candidate callouts hold 5 coordinates, which is not a whole minX,maxX,minY,maxY group. Pass four PDF-point coordinates per callout box.",
    );
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        1,
        1,
        1,
        new Uint8ClampedArray(4),
        0,
        1,
        0,
        1,
        new Float64Array((MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUTS + 1) * 4),
      ),
    ).toThrowError(
      "Observation source candidate has 1025 callouts, exceeding the 1024-box bound. Reject the panel preparation instead of traversing an unbounded callout list.",
    );
    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        1,
        1,
        1,
        new Uint8ClampedArray(4),
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        0,
        1,
        new Float64Array(0),
      ),
    ).toThrowError(
      "Observation source candidate panel spans are Infinity by 1 PDF points after subtracting bounds. Pass finite bounds whose positive width and height do not overflow.",
    );
    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        deriveRealBuildObservationSourceRasterCandidate(
          1,
          1,
          1,
          new Uint8ClampedArray(new SharedArrayBuffer(4)),
          0,
          1,
          0,
          1,
          new Float64Array(0),
        ),
      ).toThrowError(
        "Observation source candidate RGBA must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the derived masks.",
      );
      expect(() =>
        deriveRealBuildObservationSourceRasterCandidate(
          1,
          1,
          1,
          new Uint8ClampedArray(4),
          0,
          1,
          0,
          1,
          new Float64Array(new SharedArrayBuffer(0)),
        ),
      ).toThrowError(
        "Observation source candidate callouts must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the cleared regions.",
      );
    }
  });

  it("refuses a legal many-stripe highlight before full-raster component allocation explodes", () => {
    const width = 1_024;
    const height = 1_024;
    const pixels = raster(width, height);
    for (let component = 0; component < 65; component += 1) {
      const y = 10 + component * 15;
      for (let x = 10; x < 20; x += 1) paint(pixels, width, x, y, HIGHLIGHT);
    }

    expect(() =>
      deriveRealBuildObservationSourceRasterCandidate(
        width,
        height,
        4,
        pixels,
        0,
        width,
        0,
        height,
        new Float64Array(0),
      ),
    ).toThrowError(
      `Highlight extraction found 65 significant components at 1024x1024; one full-raster fill mask per component would exceed the ${MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_HIGHLIGHT_FILL_PIXELS}-pixel aggregate bound. Reject or simplify the hostile panel instead of allocating a full raster for every highlight stripe.`,
    );
  });

  it("retains the legal maximum as shared packed descriptors rather than number arrays", () => {
    const width = 1_024;
    const height = 1_024;
    const result = deriveRealBuildObservationSourceRasterCandidate(
      width,
      height,
      4,
      raster(width, height),
      0,
      width,
      0,
      height,
      new Float64Array(0),
    );

    expect(result.assemblyMask).toMatchObject({
      encoding: "packed-msb-base64/1",
      pixelCount: 1_048_576,
      byteLength: 131_072,
      lowPaddingBits: 0,
    });
    expect(Array.isArray(result.assemblyMask)).toBe(false);
    expect(typeof result.assemblyMask.base64).toBe("string");
    expect(result.lookahead.builtMask).toBe(result.assemblyMask);
    expect(result.lookahead.excludedMask).toBe(result.assemblyMask);
    expect(result.ownPanel.builtMask).toBe(result.assemblyMask);
    expect(result.ownPanel.excludedMask).toBe(result.assemblyMask);
  });
});
