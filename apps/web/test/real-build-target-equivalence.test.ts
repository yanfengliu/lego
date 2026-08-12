import { describe, expect, it } from "vitest";

import { auditRealBuildTargetEquivalence } from "../e2e/real-build-target-equivalence";
import {
  MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION,
  MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS,
  TARGET_EQUIVALENCE_SYMMETRY_PLACEMENTS,
  type TargetEquivalenceFixturePlacement,
} from "./real-build-target-equivalence-fixture";

type Placement = TargetEquivalenceFixturePlacement;

const updateActual = (
  placements: readonly Placement[],
  identityKey: string,
  update: (actual: Placement["actual"]) => Placement["actual"],
): Placement[] =>
  placements.map((entry) =>
    entry.identityKey === identityKey ? { ...entry, actual: update(entry.actual) } : entry,
  );

const translateActual = (
  placements: readonly Placement[],
  offset: readonly [number, number, number],
): Placement[] =>
  placements.map((entry) => ({
    ...entry,
    actual: {
      ...entry.actual,
      transform: {
        ...entry.actual.transform,
        positionLdu: entry.actual.transform.positionLdu.map(
          (coordinate, axis) => coordinate + offset[axis]!,
        ) as [number, number, number],
      },
    },
  }));

describe("real-build target equivalence", () => {
  it("retains every proper frame for a lone fully symmetric 1x1 and canonicalizes only diagnostically", () => {
    const symmetric: Placement = {
      identityKey: "fully-symmetric-1x1",
      stepNumber: 1,
      expected: {
        designId: "3005",
        materialId: "26",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      },
      actual: {
        partId: "fixture-part-fully-symmetric-1x1",
        stepNumber: 1,
        designId: "3005",
        materialId: "26",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      },
    };

    const result = auditRealBuildTargetEquivalence({ placements: [symmetric] });

    expect(result.status).toBe("proper");
    expect(result.properFrames.length).toBeGreaterThan(1);
    expect(new Set(result.properFrames.map(({ orientationId }) => orientationId)).size).toBe(
      result.properFrames.length,
    );
    expect(result.properFrame).toBe(result.properFrames[0]);
  });

  it("finds the unique proper yaw-90 frame through retained step 2", () => {
    const result = auditRealBuildTargetEquivalence({
      placements: MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS.filter(
        ({ stepNumber }) => stepNumber <= 2,
      ),
    });

    expect(result).toMatchObject({
      status: "proper",
      properFrame: MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION.properFrame,
      firstMismatch: null,
      improperFrame: null,
    });
  });

  it("quotients a rectangular plate by its proven half-turn self-symmetry", () => {
    expect(
      auditRealBuildTargetEquivalence({ placements: TARGET_EQUIVALENCE_SYMMETRY_PLACEMENTS }),
    ).toMatchObject({
      status: "proper",
      properFrame: {
        positionLdu: [0, 0, 0],
        orientationId: "upright-yaw-90",
      },
      firstMismatch: null,
      improperFrame: null,
    });
  });

  it("refuses a hybrid searched/raw-fixed world until both asymmetric placements share one proper frame", () => {
    const anchor: Placement = {
      identityKey: "searched-asymmetric-anchor",
      stepNumber: 1,
      expected: {
        designId: "30503",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      },
      actual: {
        partId: "fixture-part-searched-asymmetric-anchor",
        stepNumber: 1,
        designId: "30503",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-90" },
      },
    };
    const rawFixed: Placement = {
      identityKey: "raw-fixed-asymmetric-placement",
      stepNumber: 2,
      expected: {
        designId: "6106",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [40, 0, 20], orientationId: "upright-yaw-270" },
      },
      actual: {
        partId: "fixture-part-raw-fixed-asymmetric-placement",
        stepNumber: 2,
        designId: "6106",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [40, 0, 20], orientationId: "upright-yaw-270" },
      },
    };

    expect(auditRealBuildTargetEquivalence({ placements: [anchor, rawFixed] })).toMatchObject({
      status: "mismatch",
      properFrames: [],
      properFrame: null,
      firstMismatch: { identityKey: "raw-fixed-asymmetric-placement", stepNumber: 2 },
    });

    const mappedFixed: Placement = {
      ...rawFixed,
      actual: {
        ...rawFixed.actual,
        // yaw-90 maps [40,0,20] -> [20,0,-40] and yaw-270 -> yaw-0.
        transform: { positionLdu: [20, 0, -40], orientationId: "upright-yaw-0" },
      },
    };
    expect(auditRealBuildTargetEquivalence({ placements: [anchor, mappedFixed] })).toMatchObject({
      status: "proper",
      properFrame: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-90" },
      firstMismatch: null,
    });
  });

  it("names the stable surplus actual in a hostile shuffled unordered group", () => {
    const unordered = (expectedX: number, actualX: number, identityKey: string): Placement => ({
      identityKey,
      stepNumber: 1,
      expected: {
        designId: "3020",
        materialId: "26",
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:black",
        transform: { positionLdu: [expectedX, 0, 0], orientationId: "upright-yaw-0" },
      },
      actual: {
        partId: `fixture-part-${identityKey}`,
        stepNumber: 1,
        designId: "3020",
        materialId: "26",
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:black",
        transform: { positionLdu: [actualX, 0, 0], orientationId: "upright-yaw-0" },
      },
    });
    const anchor: Placement = {
      identityKey: "anchor",
      stepNumber: 1,
      expected: {
        designId: "30503",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [-100, 0, 0], orientationId: "upright-yaw-0" },
      },
      actual: {
        partId: "fixture-part-anchor",
        stepNumber: 1,
        designId: "30503",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
        colorId: "builtin:black",
        transform: { positionLdu: [-100, 0, 0], orientationId: "upright-yaw-0" },
      },
    };
    const first = unordered(0, 80, "unordered-a");
    const second = unordered(40, 0, "unordered-b");
    const forward = auditRealBuildTargetEquivalence({ placements: [anchor, first, second] });
    const reversed = auditRealBuildTargetEquivalence({ placements: [second, first, anchor] });

    expect(JSON.stringify(forward.firstMismatch)).toBe(JSON.stringify(reversed.firstMismatch));
    expect(forward.firstMismatch).toMatchObject({
      identityKey: "unordered-a",
      stepNumber: 1,
      actualTransform: { positionLdu: [80, 0, 0], orientationId: "upright-yaw-0" },
      witness: expect.stringContaining("surplus at"),
    });
  });

  it("names step 3 as the first proper-frame mismatch and keeps the full prefix improper", () => {
    const result = auditRealBuildTargetEquivalence({
      placements: MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS,
    });

    expect(result).toMatchObject({
      status: "improper",
      properFrame: null,
      firstMismatch: MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION.firstMismatch,
      improperFrame: MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION.improperFrame,
    });
    expect(result.improperFrame).toMatchObject({
      exactRenderTriangleMatchedPlacements: 0,
      firstExactRenderTriangleMismatch: expect.stringContaining("printed step 1"),
    });
  });

  it("accepts one uniform translation as part of the proper world frame", () => {
    const offset = [100, -24, 40] as const;
    const throughStep2 = MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS.filter(
      ({ stepNumber }) => stepNumber <= 2,
    );

    expect(
      auditRealBuildTargetEquivalence({ placements: translateActual(throughStep2, offset) }),
    ).toMatchObject({
      status: "proper",
      properFrame: {
        positionLdu: offset,
        orientationId: "upright-yaw-90",
      },
    });
  });

  it("refuses forged metadata, canonical step ownership, and identity permutation before framing", () => {
    const source = MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS;
    const step3Identity = MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION.firstMismatch.identityKey;
    const forgedMetadata = updateActual(source, step3Identity, (actual) => ({
      ...actual,
      designId: "30503",
    }));
    const forgedStep = updateActual(source, step3Identity, (actual) => ({
      ...actual,
      stepNumber: 4,
    }));
    const [first, second] = source;
    const permuted = source.map((entry) =>
      entry.identityKey === first!.identityKey
        ? { ...entry, actual: second!.actual }
        : entry.identityKey === second!.identityKey
          ? { ...entry, actual: first!.actual }
          : entry,
    );

    for (const placements of [forgedMetadata, forgedStep, permuted]) {
      expect(auditRealBuildTargetEquivalence({ placements })).toMatchObject({
        status: "binding-invalid",
        properFrame: null,
        improperFrame: null,
      });
    }
  });

  it("refuses a one-part translation and an asymmetric-part yaw change", () => {
    const throughStep2 = MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS.filter(
      ({ stepNumber }) => stepNumber <= 2,
    );
    const wedgeIdentity = throughStep2.find(({ stepNumber }) => stepNumber === 2)!.identityKey;
    const translated = updateActual(throughStep2, wedgeIdentity, (actual) => ({
      ...actual,
      transform: { ...actual.transform, positionLdu: [-19, 8, -20] },
    }));
    const turned = updateActual(throughStep2, wedgeIdentity, (actual) => ({
      ...actual,
      transform: { ...actual.transform, orientationId: "upright-yaw-180" },
    }));

    for (const placements of [translated, turned]) {
      expect(auditRealBuildTargetEquivalence({ placements })).toMatchObject({
        status: "mismatch",
        properFrame: null,
        firstMismatch: { identityKey: wedgeIdentity, stepNumber: 2 },
        improperFrame: null,
      });
    }
  });

  it("does not call reflected origins equivalent when their exact contact semantics disagree", () => {
    const step3Identity = MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION.firstMismatch.identityKey;
    const forgedContactFrame = updateActual(
      MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS,
      step3Identity,
      (actual) => ({
        ...actual,
        transform: { ...actual.transform, orientationId: "upright-yaw-90" },
      }),
    );

    expect(auditRealBuildTargetEquivalence({ placements: forgedContactFrame })).toMatchObject({
      status: "mismatch",
      properFrame: null,
      improperFrame: null,
    });
  });

  it.each(["mismatch", "improper"] as const)(
    "deep-freezes detached %s output without freezing or mutating caller transforms",
    (outcome) => {
      const source = MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS.map((placement) => ({
        ...placement,
        expected: {
          ...placement.expected,
          transform: {
            ...placement.expected.transform,
            positionLdu: [...placement.expected.transform.positionLdu] as [number, number, number],
          },
        },
        actual: {
          ...placement.actual,
          transform: {
            ...placement.actual.transform,
            positionLdu: [...placement.actual.transform.positionLdu] as [number, number, number],
          },
        },
      }));
      if (outcome === "mismatch") {
        source[3]!.actual.transform.orientationId = "upright-yaw-90";
      }
      const callerTransform = source[3]!.actual.transform;
      const callerPosition = callerTransform.positionLdu;

      const result = auditRealBuildTargetEquivalence({ placements: source });

      expect(result.status).toBe(outcome);
      expect(Object.isFrozen(callerTransform)).toBe(false);
      expect(Object.isFrozen(callerPosition)).toBe(false);
      callerPosition[0] += 1;
      callerTransform.orientationId = "upright-yaw-0";
      expect(callerPosition[0]).toBe(source[3]!.actual.transform.positionLdu[0]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.firstMismatch)).toBe(true);
      expect(Object.isFrozen(result.firstMismatch!.actualTransform)).toBe(true);
      expect(Object.isFrozen(result.firstMismatch!.actualTransform.positionLdu)).toBe(true);
    },
  );

  it("audits the exact 1,464-placement boundary and rejects only the next row", () => {
    const placements: Placement[] = Array.from({ length: 1_464 }, (_, index) => ({
      identityKey: `cap-boundary-${String(index).padStart(4, "0")}`,
      stepNumber: index + 1,
      expected: {
        designId: "3005",
        materialId: "26",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        transform: {
          positionLdu: [index * 40, 0, 0],
          orientationId: "upright-yaw-0",
        },
      },
      actual: {
        partId: `cap-boundary-part-${String(index).padStart(4, "0")}`,
        stepNumber: index + 1,
        designId: "3005",
        materialId: "26",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        transform: {
          positionLdu: [index * 40, 0, 0],
          orientationId: "upright-yaw-0",
        },
      },
    }));

    expect(auditRealBuildTargetEquivalence({ placements })).toMatchObject({
      status: "proper",
      properFrame: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    });
    expect(
      auditRealBuildTargetEquivalence({
        placements: [
          ...placements,
          {
            ...placements[0]!,
            identityKey: "cap-boundary-overflow",
            stepNumber: 1_465,
            actual: {
              ...placements[0]!.actual,
              partId: "cap-boundary-part-overflow",
              stepNumber: 1_465,
            },
          },
        ],
      }),
    ).toMatchObject({ status: "binding-invalid", properFrame: null, improperFrame: null });
  });
});
