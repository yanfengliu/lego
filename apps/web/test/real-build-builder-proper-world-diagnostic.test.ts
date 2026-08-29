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
  it("renders observed proper rotations while document legality stays part-scoped", () => {
    const observed = [
      ["proper-m-00pp000p0", "builtin:axle-1x3"],
      ["proper-m-00nn000p0", "builtin:plate-1x4"],
    ] as const;
    for (const [orientationId, grantedCatalogPartId] of observed) {
      expect(
        PART_DEFINITIONS.find(({ id }) => id === grantedCatalogPartId)?.legalOrientationIds,
      ).toContain(orientationId);
      expect(() => getUprightOrientation(orientationId)).toThrow(/Unknown upright orientation/u);
      expect(
        lduTransformToThreeMatrix({ positionLdu: [0, 0, 0], orientationId }).determinant(),
      ).toBeCloseTo(1, 12);

      const empty = createEmptyBrickDocument({ id: "proper-diagnostic", name: "Diagnostic" });
      const grantedPart = createPartInstance({
        id: `granted-${orientationId}`,
        catalogPartId: grantedCatalogPartId,
        transform: { positionLdu: [0, 0, 0], orientationId },
      });
      const grantedReport = validateBrickDocument({
        ...empty,
        parts: [grantedPart],
        submodels: [{ ...empty.submodels[0]!, partIds: [grantedPart.id] }],
        steps: [{ ...empty.steps[0]!, partIds: [grantedPart.id] }],
      });
      expect(grantedReport.issues.map(({ code }) => code)).not.toContain("ILLEGAL_ORIENTATION");

      const ungrantedPart = createPartInstance({
        id: `ungranted-${orientationId}`,
        catalogPartId: "builtin:brick-1x1",
        transform: { positionLdu: [0, 0, 0], orientationId },
      });
      const ungrantedReport = validateBrickDocument({
        ...empty,
        parts: [ungrantedPart],
        submodels: [{ ...empty.submodels[0]!, partIds: [ungrantedPart.id] }],
        steps: [{ ...empty.steps[0]!, partIds: [ungrantedPart.id] }],
      });
      expect(ungrantedReport.issues.map(({ code }) => code)).toContain("ILLEGAL_ORIENTATION");
      expect(ungrantedReport.issues.find(({ code }) => code === "ILLEGAL_ORIENTATION")?.path).toBe(
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
