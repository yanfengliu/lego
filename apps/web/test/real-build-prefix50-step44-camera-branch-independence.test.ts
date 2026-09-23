import { describe, expect, it } from "vitest";

import { independentlyDeriveRealBuildPrefix50Step44ExpectedCameraBranches } from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import { cameraBranches } from "../e2e/real-build-prefix50-subbuild-return-review-camera.ts";

describe("Step-44 camera branch independence", () => {
  it("reproduces all 16 production branches from the independent f/h/q law", () => {
    const solution = {
      azimuthDegrees: 33,
      elevationDegrees: 35,
      pixelsPerUnit: 20,
      residualPx: 0.1,
    };
    const independent = independentlyDeriveRealBuildPrefix50Step44ExpectedCameraBranches(solution);
    const production = cameraBranches(solution);

    expect(independent).toHaveLength(16);
    expect(new Set(independent.map(({ branchKey }) => branchKey)).size).toBe(16);
    expect(new Set(independent.map(({ parameters }) => JSON.stringify(parameters))).size).toBe(16);
    expect(independent.map(({ branchKey, parameters }) => ({ branchKey, parameters }))).toEqual(
      production,
    );
    expect(independent[0]!.parameters).toMatchObject({
      azimuthDegrees: 33,
      elevationDegrees: 35,
      upSign: 1,
    });
    expect(independent[4]!.parameters).toMatchObject({
      azimuthDegrees: 213,
      elevationDegrees: 35,
      upSign: -1,
    });
    expect(independent[8]!.parameters).toMatchObject({
      azimuthDegrees: -33,
      elevationDegrees: -35,
      upSign: -1,
    });
    expect(independent[12]!.parameters).toMatchObject({
      azimuthDegrees: 147,
      elevationDegrees: -35,
      upSign: 1,
    });
  });
});
