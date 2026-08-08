import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import { createOrthographicViewCamera } from "@lego-studio/rendering";

import { projectPoint } from "../src/assembly/project-bounds";
import { bodyBoundsLdu } from "../src/placement";
import { createPlacePartTransaction } from "../src/manual-commands";
import { anchorStepCamera } from "../e2e/real-build-step-camera";

/**
 * The step camera's registration, driven over real geometry.
 *
 * The masks are projections of parts the catalog actually defines, through the
 * repository's own camera and point projection, so which quarter turn registers
 * best is decided by where the bricks are and not by a number this file also
 * supplies. What is checked is the outcome: the turn the panel was drawn at is
 * the turn that comes back, the drawing's position on the page comes back with
 * it, and a panel with nothing built on it is refused rather than registered.
 *
 * The defect this pins is that the turn used to be assumed zero. A panel's stud
 * lattice cannot supply it — a quarter turn permutes the projected basis and
 * spans the same lattice — so assuming it is a guess that happens to be right
 * while the booklet keeps the model the same way up, and wrong from the first
 * panel it turns over.
 */

const WIDTH = 360;
const HEIGHT = 300;
/** One three-unit is one stud pitch, so this is the run's own working scale. */
const FITTED = { azimuthDegrees: 55, elevationDegrees: 35, pixelsPerUnit: 20 };
const FRAME = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  target: [0, 0, 0] as [number, number, number],
  sceneRadius: 60,
};

type Document = ReturnType<typeof createEmptyBrickDocument>;

/**
 * A model whose four quarter turns are four different pictures.
 *
 * A quarter ring off centre, with a round plate on one side of it: rotationally
 * asymmetric, so a registration that returns the wrong turn is visible rather
 * than a tie. These are printed step 1's own two pieces at the transforms the
 * run settles them into.
 */
function drawnAssembly(): Document {
  let document_ = createEmptyBrickDocument({
    id: "step-camera-test",
    name: "step camera",
    maxParts: 16,
  });
  for (const piece of [
    {
      catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
      transform: { positionLdu: [0, 8, 0] as const, orientationId: "upright-yaw-90" },
    },
    {
      catalogPartId: "builtin:corner-plate-4x4-round",
      transform: { positionLdu: [-40, 0, -40] as const, orientationId: "upright-yaw-90" },
    },
  ]) {
    const definition = getPartDefinition(piece.catalogPartId)!;
    const transaction = createPlacePartTransaction(document_, {
      catalogPartId: piece.catalogPartId,
      colorId: definition.availableColorIds[0]!,
      transform: piece.transform,
    });
    document_ = applyBuildOperations(document_, transaction.operations);
  }
  return document_;
}

/** Every connector and body corner, projected through the real camera. */
function rasterise(
  document_: Document,
  view: { azimuthDegrees?: number; elevationDegrees?: number; upSign?: 1 | -1 },
  shiftPx: readonly [number, number] = [0, 0],
): Uint8Array {
  const camera = createOrthographicViewCamera(
    {
      ...FITTED,
      ...view,
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
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
        mask[y * WIDTH + x] = 1;
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
        for (const z of [bounds.min[2], bounds.max[2]]) {
          splat([x, y, z]);
        }
      }
    }
  }
  return mask;
}

const iouOf = (anchor: ReturnType<typeof anchorStepCamera>, turnDegrees: number): number =>
  anchor.anchorTurnIous.find((entry) => entry.turnDegrees === turnDegrees)?.iou ?? -1;

describe("anchorStepCamera", () => {
  const document_ = drawnAssembly();

  it.each([0, 90, 180, 270])(
    "recovers the quarter turn the panel was drawn at (%i degrees)",
    (drawnTurn) => {
      const shiftPx: [number, number] = [17, -23];
      const anchor = anchorStepCamera({
        stepNumber: 4,
        renderModelMask: (turnDegrees) =>
          rasterise(document_, { azimuthDegrees: FITTED.azimuthDegrees + turnDegrees }),
        builtMask: rasterise(
          document_,
          { azimuthDegrees: FITTED.azimuthDegrees + drawnTurn },
          shiftPx,
        ),
        widthPx: WIDTH,
        heightPx: HEIGHT,
      });

      expect(anchor.failure).toBeNull();
      expect(anchor.anchorTurnDegrees).toBe(drawnTurn);
      expect(anchor.anchorShiftPx).toEqual(shiftPx);
      expect(anchor.anchorIou).toBeGreaterThan(0.99);
      expect(anchor.centrePx).toEqual([WIDTH / 2 + shiftPx[0], HEIGHT / 2 + shiftPx[1]]);
    },
  );

  /**
   * The defect, stated as a measurement rather than as a story: on a panel drawn
   * at a quarter turn, the turn the code used to assume registers far worse than
   * the one that is actually there, and every turn's agreement is published so
   * the gap is inspectable rather than inferred.
   */
  it("separates the drawn turn from the assumed one", () => {
    const anchor = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: (turnDegrees) =>
        rasterise(document_, { azimuthDegrees: FITTED.azimuthDegrees + turnDegrees }),
      builtMask: rasterise(document_, { azimuthDegrees: FITTED.azimuthDegrees + 90 }),
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(anchor.anchorTurnIous).toHaveLength(4);
    expect(iouOf(anchor, 90)).toBeGreaterThan(0.99);
    expect(iouOf(anchor, 0)).toBeLessThan(0.8);
    expect(iouOf(anchor, 0)).toBeLessThan(iouOf(anchor, 90));
  });

  /**
   * And the half-turn a booklet takes when it turns the model over is outside
   * the family the turns sweep, which is why the sweep alone cannot repair a
   * panel drawn from underneath. Registering the upright renders against an
   * inverted panel reaches no turn worth having; rendering inverted recovers it
   * exactly.
   */
  it("cannot register an inverted panel from upright renders, and can from inverted ones", () => {
    const inverted = rasterise(document_, {
      azimuthDegrees: -FITTED.azimuthDegrees + 90,
      elevationDegrees: -FITTED.elevationDegrees,
      upSign: -1,
    });

    const upright = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: (turnDegrees) =>
        rasterise(document_, {
          azimuthDegrees: -FITTED.azimuthDegrees + turnDegrees,
          elevationDegrees: -FITTED.elevationDegrees,
        }),
      builtMask: inverted,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });
    const rolled = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: (turnDegrees) =>
        rasterise(document_, {
          azimuthDegrees: -FITTED.azimuthDegrees + turnDegrees,
          elevationDegrees: -FITTED.elevationDegrees,
          upSign: -1,
        }),
      builtMask: inverted,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(rolled.anchorTurnDegrees).toBe(90);
    expect(rolled.anchorIou).toBeGreaterThan(0.99);
    expect(upright.anchorIou).toBeLessThan(0.8);
    expect(upright.anchorIou! + 0.2).toBeLessThan(rolled.anchorIou!);
  });

  /**
   * The third thing that has to be right, and the one the run shipped wrong for
   * a different reason than it looks: a panel draws the part this step adds over
   * the model that was already there, so its already-built art has a bite out of
   * it exactly where the new part is drawn. Charging the model for that bite
   * measures the drawing's occlusion. Here the bite costs the true turn a third
   * of its agreement; declining to score inside it restores the whole of it.
   */
  it("does not charge the model for the bite the panel's own highlight takes", () => {
    const whole = rasterise(document_, {});
    // A compact region over the middle of the drawing, the shape a printed
    // highlight actually takes: the part this step adds, drawn on top of what
    // was there. It costs the true turn about a third of its area.
    let minX = WIDTH;
    let maxX = 0;
    let minY = HEIGHT;
    let maxY = 0;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        if (whole[y * WIDTH + x] !== 1) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const biteX0 = Math.round(minX + (maxX - minX) * 0.35);
    const biteX1 = Math.round(minX + (maxX - minX) * 0.75);
    const excludedMask = new Uint8Array(WIDTH * HEIGHT);
    const bitten = new Uint8Array(whole);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = biteX0; x <= biteX1; x += 1) {
        excludedMask[y * WIDTH + x] = 1;
        bitten[y * WIDTH + x] = 0;
      }
    }

    const charged = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: (turnDegrees) =>
        rasterise(document_, { azimuthDegrees: FITTED.azimuthDegrees + turnDegrees }),
      builtMask: bitten,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });
    const declined = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: (turnDegrees) =>
        rasterise(document_, { azimuthDegrees: FITTED.azimuthDegrees + turnDegrees }),
      builtMask: bitten,
      excludedMask,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(iouOf(charged, 0)).toBeLessThan(0.7);
    expect(iouOf(declined, 0)).toBeGreaterThan(0.99);
    expect(declined.anchorTurnDegrees).toBe(0);
    expect(declined.anchorShiftPx).toEqual([0, 0]);
  });

  it("refuses a panel with no already-built art rather than registering against nothing", () => {
    const anchor = anchorStepCamera({
      stepNumber: 4,
      renderModelMask: () => rasterise(document_, {}),
      builtMask: new Uint8Array(WIDTH * HEIGHT),
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(anchor.anchorIou).toBeNull();
    expect(anchor.anchorTurnDegrees).toBeNull();
    expect(anchor.failure?.code).toBe("camera-anchor-failed");
    expect(anchor.failure?.message).toMatch(/already-built art is empty/u);
  });

  it("refuses when nothing is built yet, at every turn", () => {
    const empty = createEmptyBrickDocument({ id: "empty", name: "empty", maxParts: 1 });
    const anchor = anchorStepCamera({
      stepNumber: 2,
      renderModelMask: () => rasterise(empty, {}),
      builtMask: rasterise(document_, {}),
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(anchor.anchorIou).toBeNull();
    expect(anchor.failure?.code).toBe("camera-anchor-failed");
    expect(anchor.failure?.message).toMatch(/rendered nothing at any quarter turn/u);
  });
});
