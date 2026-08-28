import { PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  createEmptyBrickDocument,
  createPartInstance,
  getUprightOrientation,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { lduTransformToThreeMatrix } from "@lego-studio/rendering";
import { describe, expect, it } from "vitest";

import {
  composeBuilderProperTransforms,
  resolveBuilderBoneProperTransform,
} from "../e2e/real-build-builder-calibration";

describe("Builder diagnostic proper-world transforms", () => {
  it("renders the two observed proper rotations while document policy stays upright-only", () => {
    const diagnosticOnlyIds = ["proper-m-00pp000p0", "proper-m-00nn000p0"] as const;
    for (const orientationId of diagnosticOnlyIds) {
      expect(
        PART_DEFINITIONS.some(({ legalOrientationIds }) =>
          legalOrientationIds.includes(orientationId),
        ),
      ).toBe(false);
      expect(() => getUprightOrientation(orientationId)).toThrow(/Unknown upright orientation/u);
      expect(
        lduTransformToThreeMatrix({ positionLdu: [0, 0, 0], orientationId }).determinant(),
      ).toBeCloseTo(1, 12);

      const empty = createEmptyBrickDocument({ id: "proper-diagnostic", name: "Diagnostic" });
      const diagnosticPart = createPartInstance({
        id: `diagnostic-${orientationId}`,
        transform: { positionLdu: [0, 0, 0], orientationId },
      });
      const report = validateBrickDocument({
        ...empty,
        parts: [diagnosticPart],
        submodels: [{ ...empty.submodels[0]!, partIds: [diagnosticPart.id] }],
        steps: [{ ...empty.steps[0]!, partIds: [diagnosticPart.id] }],
      });
      expect(report.issues.map(({ code }) => code)).toContain("ILLEGAL_ORIENTATION");
      expect(report.issues.find(({ code }) => code === "ILLEGAL_ORIENTATION")?.path).toBe(
        "/parts/0/transform/orientationId",
      );
    }

    expect(() =>
      lduTransformToThreeMatrix({
        positionLdu: [0, 0, 0],
        orientationId: "caller-shaped-unknown-orientation",
      }),
    ).toThrow(/Unknown proper orientation/u);
  });

  it("refuses a reflected Bone and a caller-shaped unsupported orientation", () => {
    const reflected = resolveBuilderBoneProperTransform({
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, -1],
      position: [0, 0, 0],
      sourceDigest: `sha256:${"0".repeat(64)}`,
    });
    expect(reflected.transform).toBeNull();
    expect(reflected.failure).toMatch(/determinant-positive.*reflection/u);
    expect(
      composeBuilderProperTransforms(
        { positionLdu: [0, 0, 0], orientationId: "proper-m-p000p000n" },
        { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      ),
    ).toBeNull();
  });
});
