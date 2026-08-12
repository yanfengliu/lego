import type { RigidTransform } from "@lego-studio/protocol";

export interface TargetEquivalenceFixtureSide {
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
}

export interface TargetEquivalenceFixturePlacement {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly expected: TargetEquivalenceFixtureSide;
  readonly actual: TargetEquivalenceFixtureSide & {
    readonly partId: string;
    readonly stepNumber: number;
  };
}

const placement = (input: {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly expectedTransform: RigidTransform;
  readonly actualTransform: RigidTransform;
}): TargetEquivalenceFixturePlacement => ({
  identityKey: input.identityKey,
  stepNumber: input.stepNumber,
  expected: {
    designId: input.designId,
    materialId: input.materialId,
    catalogPartId: input.catalogPartId,
    colorId: input.colorId,
    transform: input.expectedTransform,
  },
  actual: {
    partId: `fixture-part-${input.identityKey}`,
    stepNumber: input.stepNumber,
    designId: input.designId,
    materialId: input.materialId,
    catalogPartId: input.catalogPartId,
    colorId: input.colorId,
    transform: input.actualTransform,
  },
});

/**
 * Exact identity, step, metadata, and transform facts from the retained
 * five-step/eight-part diagnostic prefix. No booklet or run artifact bytes are
 * copied into the repository; the fixture retains only the semantic facts the
 * target-equivalence audit consumes.
 */
export const MEASURED_STEP_5_TARGET_EQUIVALENCE_PLACEMENTS = Object.freeze([
  placement({
    identityKey: "76092bf0-3d72-474a-baf3-06b837082f6a",
    stepNumber: 1,
    designId: "80015",
    materialId: "26",
    catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
    actualTransform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" },
  }),
  placement({
    identityKey: "21288f64-b9d5-4efb-92b9-427a17832a45",
    stepNumber: 1,
    designId: "30565",
    materialId: "26",
    catalogPartId: "builtin:corner-plate-4x4-round",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [40, 0, -40], orientationId: "upright-yaw-0" },
    actualTransform: { positionLdu: [-40, 0, -40], orientationId: "upright-yaw-90" },
  }),
  placement({
    identityKey: "9d453fd1-adbe-44b8-ae21-d499a2c01e46",
    stepNumber: 2,
    designId: "30503",
    materialId: "26",
    catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [20, 8, -20], orientationId: "upright-yaw-0" },
    actualTransform: { positionLdu: [-20, 8, -20], orientationId: "upright-yaw-90" },
  }),
  placement({
    identityKey: "64e38f7f-bdb7-4a8f-aa88-1ce47f08f322",
    stepNumber: 3,
    designId: "6106",
    materialId: "26",
    catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [20, 0, 60], orientationId: "upright-yaw-270" },
    actualTransform: { positionLdu: [-20, 0, 60], orientationId: "upright-yaw-180" },
  }),
  placement({
    identityKey: "30ae6ecf-1cd7-4fcd-bdf2-21669fcd1776",
    stepNumber: 4,
    designId: "3460",
    materialId: "26",
    catalogPartId: "builtin:plate-1x8",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [0, 8, 30], orientationId: "upright-yaw-270" },
    actualTransform: { positionLdu: [0, 8, 30], orientationId: "upright-yaw-270" },
  }),
  placement({
    identityKey: "e5cc0288-852d-4290-bbe3-92a49012c504",
    stepNumber: 4,
    designId: "30503",
    materialId: "26",
    catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [20, 8, 80], orientationId: "upright-yaw-270" },
    actualTransform: { positionLdu: [-20, 8, 80], orientationId: "upright-yaw-180" },
  }),
  placement({
    identityKey: "479c0207-fe42-447a-a66e-83584812bc95",
    stepNumber: 5,
    designId: "3020",
    materialId: "28",
    catalogPartId: "builtin:plate-2x4",
    colorId: "builtin:green",
    expectedTransform: { positionLdu: [-60, 8, 0], orientationId: "upright-yaw-90" },
    actualTransform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
  }),
  placement({
    identityKey: "b7a1a69c-a44c-47d3-af53-28eefe51acb2",
    stepNumber: 5,
    designId: "91988",
    materialId: "26",
    catalogPartId: "builtin:plate-2x14",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [-160, 8, 100], orientationId: "upright-yaw-270" },
    actualTransform: { positionLdu: [160, 8, 100], orientationId: "upright-yaw-270" },
  }),
] satisfies readonly TargetEquivalenceFixturePlacement[]);

export const MEASURED_STEP_5_TARGET_EQUIVALENCE_EXPECTATION = Object.freeze({
  properThroughStep: 2,
  properFrame: {
    positionLdu: [0, 0, 0] as const,
    orientationId: "upright-yaw-90",
  },
  firstMismatch: {
    identityKey: "64e38f7f-bdb7-4a8f-aa88-1ce47f08f322",
    stepNumber: 3,
    expectedTransform: {
      positionLdu: [60, 0, -20] as const,
      orientationId: "upright-yaw-0",
    },
    actualTransform: {
      positionLdu: [-20, 0, 60] as const,
      orientationId: "upright-yaw-180",
    },
  },
  improperFrame: {
    kind: "x-reflection",
    determinant: -1,
    positionLdu: [0, 0, 0] as const,
    matchedPlacements: 8,
    inferredCompatibleContacts: 30,
  },
  diagnosticStructuralHash:
    "sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
});

/** A proper yaw-90 fit whose rectangular plate is named through its half-turn symmetry. */
export const TARGET_EQUIVALENCE_SYMMETRY_PLACEMENTS = Object.freeze([
  placement({
    identityKey: "asymmetric-anchor",
    stepNumber: 1,
    designId: "30503",
    materialId: "26",
    catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    actualTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-90" },
  }),
  placement({
    identityKey: "half-turn-symmetric-plate",
    stepNumber: 1,
    designId: "3020",
    materialId: "26",
    catalogPartId: "builtin:plate-2x4",
    colorId: "builtin:black",
    expectedTransform: { positionLdu: [20, 8, 0], orientationId: "upright-yaw-0" },
    actualTransform: { positionLdu: [0, 8, -20], orientationId: "upright-yaw-270" },
  }),
] satisfies readonly TargetEquivalenceFixturePlacement[]);
