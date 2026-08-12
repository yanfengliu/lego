import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import { createOrthographicViewCamera } from "@lego-studio/rendering";

import { anchorStepCameraLatticeFrame } from "../e2e/real-build-step-camera";
import { viewForLatticeHand } from "../src/assembly/panel-face";
import { projectPoint } from "../src/assembly/project-bounds";
import { createPlacePartTransaction } from "../src/manual-commands";
import { bodyBoundsLdu } from "../src/placement";

const WIDTH = 500;
const HEIGHT = 420;
const FITTED = { azimuthDegrees: 55, elevationDegrees: 35, pixelsPerUnit: 20 };
const FRAME = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  target: [0, 0, 0] as [number, number, number],
  sceneRadius: 80,
};
const TARGET_SHIFT = [17, -23] as const;

type Document = ReturnType<typeof createEmptyBrickDocument>;

function documentFrom(
  pieces: readonly {
    readonly catalogPartId: string;
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  }[],
): Document {
  let document_ = createEmptyBrickDocument({
    id: "lattice-hand",
    name: "lattice hand",
    maxParts: 8,
  });
  for (const piece of pieces) {
    const definition = getPartDefinition(piece.catalogPartId);
    if (definition === undefined) throw new TypeError(`Missing test part ${piece.catalogPartId}.`);
    const transaction = createPlacePartTransaction(document_, {
      catalogPartId: piece.catalogPartId,
      colorId: definition.availableColorIds[0]!,
      transform: {
        positionLdu: piece.positionLdu,
        orientationId: piece.orientationId,
      },
    });
    document_ = applyBuildOperations(document_, transaction.operations);
  }
  return document_;
}

function rasterise(
  document_: Document,
  view: { readonly azimuthDegrees: number; readonly elevationDegrees: number },
  shiftPx: readonly [number, number] = [0, 0],
): Uint8Array {
  const camera = createOrthographicViewCamera(
    {
      ...view,
      pixelsPerUnit: FITTED.pixelsPerUnit,
      centerXPx: WIDTH / 2 + shiftPx[0],
      centerYPx: HEIGHT / 2 + shiftPx[1],
    },
    FRAME,
  );
  const mask = new Uint8Array(WIDTH * HEIGHT);
  const splat = (point: readonly [number, number, number]): void => {
    const projected = projectPoint(point, camera, WIDTH, HEIGHT);
    const centreX = Math.round(projected.xPx);
    const centreY = Math.round(projected.yPx);
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        if (dx * dx + dy * dy > 16) continue;
        const x = centreX + dx;
        const y = centreY + dy;
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) mask[y * WIDTH + x] = 1;
      }
    }
  };
  for (const part of document_.parts) {
    const definition = getPartDefinition(part.catalogPartId)!;
    for (const connector of definition.connectors) {
      splat(transformLduPoint(part.transform, connector.positionLdu));
    }
    const bounds = bodyBoundsLdu(part);
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) splat([x, y, z]);
      }
    }
  }
  return mask;
}

const CHIRAL_ASSEMBLY = documentFrom([
  {
    catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
    positionLdu: [0, 8, 0],
    orientationId: "upright-yaw-0",
  },
  {
    catalogPartId: "builtin:corner-plate-4x4-round",
    positionLdu: [40, 0, -40],
    orientationId: "upright-yaw-0",
  },
  {
    catalogPartId: "builtin:wedge-plate-3x6-right",
    positionLdu: [-60, 0, -90],
    orientationId: "upright-yaw-270",
  },
]);

function register(document_: Document) {
  const rendered = new Set<string>();
  const result = anchorStepCameraLatticeFrame({
    stepNumber: 2,
    renderModelMask: (hypothesis) => {
      rendered.add(`${hypothesis.latticeHand}:${hypothesis.turnDegrees}`);
      const turned = { ...FITTED, azimuthDegrees: FITTED.azimuthDegrees + hypothesis.turnDegrees };
      return rasterise(document_, viewForLatticeHand(turned, hypothesis.latticeHand));
    },
    // An independent explicit target, not one produced through the helper under test.
    builtMask: rasterise(document_, { azimuthDegrees: 35, elevationDegrees: -35 }, TARGET_SHIFT),
    widthPx: WIDTH,
    heightPx: HEIGHT,
  });
  return { rendered, result };
}

describe("anchorStepCameraLatticeFrame", () => {
  it("recovers the reflected hand and retains all eight measured hypotheses", () => {
    const { rendered, result } = register(CHIRAL_ASSEMBLY);

    expect(rendered).toEqual(
      new Set([
        "as-fitted:0",
        "as-fitted:90",
        "as-fitted:180",
        "as-fitted:270",
        "x-reflected:0",
        "x-reflected:90",
        "x-reflected:180",
        "x-reflected:270",
      ]),
    );
    expect(result.failure).toBeNull();
    expect(result.selected).toMatchObject({
      latticeHand: "x-reflected",
      latticeDeterminant: -1,
      turnDegrees: 90,
      status: "scored",
      shiftPx: TARGET_SHIFT,
    });
    expect(result.selected?.iou).toBeGreaterThan(0.99);
    expect(result.rankedHypotheses).toHaveLength(8);
    expect(result.rankedHypotheses.every(({ status }) => status === "scored")).toBe(true);
    const expectedScores = new Map([
      ["as-fitted:0", 0.4760536398467433],
      ["as-fitted:90", 0.26993490642799023],
      ["as-fitted:180", 0.23836978131212724],
      ["as-fitted:270", 0.269773145309626],
      ["x-reflected:0", 0.2622817701989444],
      ["x-reflected:90", 1],
      ["x-reflected:180", 0.2806153846153846],
      ["x-reflected:270", 0.2632440171814277],
    ]);
    for (const attempt of result.rankedHypotheses) {
      expect(attempt.iou).toBeCloseTo(
        expectedScores.get(`${attempt.latticeHand}:${attempt.turnDegrees}`)!,
        12,
      );
    }
    expect(
      Math.max(
        ...result.rankedHypotheses
          .filter(({ latticeHand }) => latticeHand === "as-fitted")
          .map(({ iou }) => iou ?? -1),
      ),
    ).toBeLessThan(0.5);
    expect(
      result.selected!.iou -
        Math.max(
          ...result.rankedHypotheses
            .filter(({ latticeHand }) => latticeHand === "as-fitted")
            .map(({ iou }) => iou ?? -1),
        ),
    ).toBeGreaterThan(0.5);
    for (const attempt of result.rankedHypotheses) {
      expect(attempt.shiftPx).not.toBeNull();
      expect(Object.isFrozen(attempt)).toBe(true);
      expect(Object.isFrozen(attempt.shiftPx)).toBe(true);
    }
  });

  it("refuses a symmetric cross-hand tie and preserves its counterevidence", () => {
    const plate = documentFrom([
      {
        catalogPartId: "builtin:plate-2x4",
        positionLdu: [0, 8, 0],
        orientationId: "upright-yaw-0",
      },
    ]);
    const { result } = register(plate);
    const leaders = result.rankedHypotheses.filter(({ iou }) => iou === 1);

    expect(result.selected).toBeNull();
    expect(result.failure).toMatchObject({
      code: "camera-handedness-unresolved",
      stage: "camera-registration",
      stepNumber: 2,
    });
    expect(result.failure?.message).toMatch(/as-fitted.*x-reflected.*Retain all eight/su);
    expect(result.rankedHypotheses).toHaveLength(8);
    expect(new Set(leaders.map(({ latticeHand }) => latticeHand))).toEqual(
      new Set(["as-fitted", "x-reflected"]),
    );
    expect(new Set(leaders.map(({ turnDegrees }) => turnDegrees))).toEqual(new Set([90, 270]));
  });

  it("refuses a same-hand turn tie without mislabelling it as handedness", () => {
    const builtMask = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0]);
    const result = anchorStepCameraLatticeFrame({
      stepNumber: 3,
      renderModelMask: ({ latticeHand, turnDegrees }) =>
        latticeHand === "as-fitted" && (turnDegrees === 0 || turnDegrees === 90)
          ? builtMask
          : new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0]),
      builtMask,
      widthPx: 3,
      heightPx: 3,
    });

    expect(result.selected).toBeNull();
    expect(result.failure?.code).toBe("camera-anchor-failed");
    expect(result.failure?.message).toMatch(/as-fitted turn 0.*as-fitted turn 90/su);
    expect(result.rankedHypotheses).toHaveLength(8);
  });

  it("does not let an untrusted renderer mutate this or later enumerations", () => {
    const builtMask = new Uint8Array([1, 1, 0, 0]);
    const enumerate = (): readonly string[] => {
      const seen: string[] = [];
      anchorStepCameraLatticeFrame({
        stepNumber: 4,
        renderModelMask: (hypothesis) => {
          seen.push(
            `${hypothesis.latticeHand}:${hypothesis.latticeDeterminant}:${hypothesis.turnDegrees}`,
          );
          try {
            (hypothesis as { turnDegrees: number }).turnDegrees = 13;
          } catch {
            // Frozen runtime input is the boundary being proved.
          }
          return builtMask;
        },
        builtMask,
        widthPx: 2,
        heightPx: 2,
      });
      return seen;
    };
    const expected = [
      "as-fitted:1:0",
      "as-fitted:1:90",
      "as-fitted:1:180",
      "as-fitted:1:270",
      "x-reflected:-1:0",
      "x-reflected:-1:90",
      "x-reflected:-1:180",
      "x-reflected:-1:270",
    ];

    expect(enumerate()).toEqual(expected);
    expect(enumerate()).toEqual(expected);
  });

  it("scores every row against one immutable evidence and callback snapshot", () => {
    const builtMask = new Uint8Array([1, 1, 0, 0]);
    const excludedMask = new Uint8Array(4);
    const stableRenderer = () => new Uint8Array([1, 1, 0, 0]);
    const mutableInput = {
      stepNumber: 5,
      renderModelMask: stableRenderer,
      builtMask,
      excludedMask,
      widthPx: 2,
      heightPx: 2,
    };
    let calls = 0;
    mutableInput.renderModelMask = () => {
      calls += 1;
      if (calls === 1) {
        builtMask.fill(0);
        excludedMask.fill(1);
        mutableInput.stepNumber = 99;
        mutableInput.renderModelMask = () => new Uint8Array(4);
      }
      return stableRenderer();
    };
    const result = anchorStepCameraLatticeFrame(mutableInput);

    expect(calls).toBe(8);
    expect(result.rankedHypotheses).toHaveLength(8);
    expect(result.rankedHypotheses.every(({ iou }) => iou === 1)).toBe(true);
    expect(result.failure).toMatchObject({
      code: "camera-handedness-unresolved",
      stepNumber: 5,
    });
    expect(result.failure?.message).toMatch(/^Step 5 /u);
  });

  it("reads each caller-supplied evidence property exactly once", () => {
    let builtReads = 0;
    let excludedReads = 0;
    const input = {
      stepNumber: 6,
      renderModelMask: () => new Uint8Array([1, 1, 0, 0]),
      get builtMask() {
        builtReads += 1;
        return builtReads === 1 ? new Uint8Array([1, 1, 0, 0]) : new Uint8Array(0);
      },
      get excludedMask() {
        excludedReads += 1;
        return excludedReads === 1 ? new Uint8Array(4) : new Uint8Array(0);
      },
      widthPx: 2,
      heightPx: 2,
    };

    const result = anchorStepCameraLatticeFrame(input);
    expect(builtReads).toBe(1);
    expect(excludedReads).toBe(1);
    expect(result.rankedHypotheses).toHaveLength(8);
    expect(result.rankedHypotheses.every(({ iou }) => iou === 1)).toBe(true);
  });

  it("rejects malformed frame and mask dimensions before admitting evidence", () => {
    expect(() =>
      anchorStepCameraLatticeFrame({
        stepNumber: 1,
        renderModelMask: () => new Uint8Array(1),
        builtMask: new Uint8Array(1),
        widthPx: 0,
        heightPx: 1,
      }),
    ).toThrow(/positive safe integers.*0x1/su);
    expect(() =>
      anchorStepCameraLatticeFrame({
        stepNumber: 1,
        renderModelMask: () => new Uint8Array(4),
        builtMask: new Uint8Array(3),
        widthPx: 2,
        heightPx: 2,
      }),
    ).toThrow(/already-built mask contains 3.*requires exactly 4/su);
    expect(() =>
      anchorStepCameraLatticeFrame({
        stepNumber: 1,
        renderModelMask: () => new Uint8Array(3),
        builtMask: new Uint8Array([1, 0, 0, 0]),
        widthPx: 2,
        heightPx: 2,
      }),
    ).toThrow(/as-fitted turn-0 model mask contains 3.*requires exactly 4/su);
  });
});
