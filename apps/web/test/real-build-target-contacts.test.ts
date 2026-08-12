import { describe, expect, it } from "vitest";

import type { FrameTransform } from "../e2e/real-build-catalog-frame";
import {
  MAXIMUM_SEMANTIC_CONTACT_PAIR_COMPARISONS,
  inferSemanticContactKeys,
  type SemanticContactPlacement,
} from "../e2e/real-build-target-contacts";
import { MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS } from "./real-build-target-equivalence-fixture";

const IDENTITY_FRAME: FrameTransform = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  translationLdu: [0, 0, 0],
};
const X_REFLECTION: FrameTransform = {
  matrix: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
  translationLdu: [0, 0, 0],
};

const fixtureSide = (side: "expected" | "actual"): SemanticContactPlacement[] =>
  MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS.map((placement) => ({
    identityKey: placement.identityKey,
    stepNumber: placement.stepNumber,
    catalogPartId: placement.expected.catalogPartId,
    transform: placement[side].transform,
  }));

describe("real-build target semantic contact inference", () => {
  it("preserves the measured 30-contact reflection while comparing exact-position buckets", () => {
    const expected = inferSemanticContactKeys({
      placements: fixtureSide("expected"),
      globalFrame: X_REFLECTION,
    });
    const actual = inferSemanticContactKeys({
      placements: fixtureSide("actual"),
      globalFrame: IDENTITY_FRAME,
    });

    expect(expected.supported).toBe(true);
    expect(actual.supported).toBe(true);
    expect(expected.keys).toEqual(actual.keys);
    expect(actual.keys).toHaveLength(30);
    expect(actual.pairComparisons).toBeLessThan(
      (actual.connectorCount * (actual.connectorCount - 1)) / 2,
    );
  });

  it("fails before scanning a hostile coincident bucket at the 1,464-part cap", () => {
    const placements: SemanticContactPlacement[] = Array.from({ length: 1_464 }, (_, index) => ({
      identityKey: `coincident-${index}`,
      stepNumber: index + 1,
      catalogPartId: "builtin:brick-1x1",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    }));

    const result = inferSemanticContactKeys({ placements, globalFrame: IDENTITY_FRAME });

    expect(result).toMatchObject({ supported: false, keys: [] });
    expect(result.pairComparisons).toBeGreaterThan(MAXIMUM_SEMANTIC_CONTACT_PAIR_COMPARISONS);
    expect(result.witness).toContain("fail-closed budget");
  });

  it("handles 1,464 separated parts with zero pair comparisons", () => {
    const placements: SemanticContactPlacement[] = Array.from({ length: 1_464 }, (_, index) => ({
      identityKey: `separated-${index}`,
      stepNumber: index + 1,
      catalogPartId: "builtin:brick-1x1",
      transform: { positionLdu: [index * 40, 0, 0], orientationId: "upright-yaw-0" },
    }));

    expect(inferSemanticContactKeys({ placements, globalFrame: IDENTITY_FRAME })).toMatchObject({
      supported: true,
      keys: [],
      pairComparisons: 0,
    });
  });
});
