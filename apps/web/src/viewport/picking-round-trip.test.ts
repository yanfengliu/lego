/**
 * Gate: a pick through the canonical `front` camera lands on the LDraw front
 * of the part that was drawn, with LDraw +X to the viewer's right.
 *
 * Bound: one part, `builtin:corner-plate-2x2-round` (LDraw 79491, catalog
 * bounds off-centre in x and z), at one non-origin position with orientation
 * `upright-yaw-0`; one view, `front`, orthographic at aspect 1; two rays, the
 * image centre and a quarter of the half-width right of it, cast the way
 * `install-selection.ts` casts them and mapped back through `threePointToLdu`.
 * Properties: both hits land on the picked part at its minimum LDU z; the
 * centre hit is at the centre of its catalog bounds in x and y; the right-hand
 * hit has the same y and a larger x. Other views, perspective cameras,
 * rotated parts and the build-plate fallback are outside it.
 *
 * Expected numbers come from the part's catalog bounds plus its position and
 * from LDraw's convention: a front view looks at the -Z face, with +X to the
 * right and -Y up. None goes through `lduToThreeVector`, so a mapping that
 * mirrored the scene and inverted the mirror on the way back would still fail.
 */
import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import {
  createCameraForView,
  createCanonicalViewPacket,
  deriveBrickScene,
} from "@lego-studio/rendering";
import { Raycaster, Vector2 } from "three";
import { afterEach, describe, expect, it } from "vitest";

import { threePointToLdu } from "./drop-target";
import { partIdFromObject } from "./install-selection";

const PART_ID = "builtin:corner-plate-2x2-round";
const POSITION_LDU: LduVector3 = [60, -24, 100];
/** Scene geometry is Float32; three decimal places of LDU sit well inside its error here. */
const HIT_PRECISION_DIGITS = 3;

function documentWithOnePart(): BrickDocumentV1 {
  const empty = createEmptyBrickDocument({ id: "picking-round-trip", name: "Picking round trip" });
  const part = createPartInstance({
    id: "picked",
    catalogPartId: PART_ID,
    transform: { positionLdu: POSITION_LDU, orientationId: "upright-yaw-0" },
  });
  return {
    ...empty,
    parts: [part],
    submodels: empty.submodels.map((submodel) => ({ ...submodel, partIds: [part.id] })),
    steps: empty.steps.map((step) => ({ ...step, partIds: [part.id] })),
  };
}

const scenes: { dispose(): void }[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.dispose();
});

describe("picking round trip", () => {
  it("lands a front-view pick on the LDraw front face, with +X to the right", () => {
    const definition = getPartDefinition(PART_ID);
    if (definition === undefined) throw new Error(`The catalog has no part ${PART_ID}.`);
    const scene = deriveBrickScene(documentWithOnePart());
    scenes.push(scene);
    scene.root.updateMatrixWorld(true);
    const view = createCanonicalViewPacket(scene).views.find(({ name }) => name === "front");
    if (view === undefined) throw new Error("The canonical view packet has no front view.");
    const camera = createCameraForView(view, 1);
    const raycaster = new Raycaster();
    const pick = (ndcX: number, ndcY: number): LduVector3 => {
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      const hit = raycaster.intersectObjects([...scene.partObjects.values()], true)[0];
      if (hit === undefined) {
        throw new Error(
          `The front-view ray at (${ndcX}, ${ndcY}) hit nothing; it should hit ${PART_ID}.`,
        );
      }
      expect(partIdFromObject(hit.object)).toBe("picked");
      return threePointToLdu(hit.point);
    };

    const { min, max } = definition.boundsLdu;
    const centreX = POSITION_LDU[0] + (min[0] + max[0]) / 2;
    const centreY = POSITION_LDU[1] + (min[1] + max[1]) / 2;
    const frontZ = POSITION_LDU[2] + min[2];
    // The bounds are off-centre, so a pick that ignored them could not pass.
    expect([centreX, centreY, frontZ]).toEqual([70, -26, 90]);

    const centre = pick(0, 0);
    expect(centre[0]).toBeCloseTo(centreX, HIT_PRECISION_DIGITS);
    expect(centre[1]).toBeCloseTo(centreY, HIT_PRECISION_DIGITS);
    expect(centre[2]).toBeCloseTo(frontZ, HIT_PRECISION_DIGITS);

    const right = pick(0.25, 0);
    expect(right[0]).toBeGreaterThan(centre[0] + 1);
    expect(right[1]).toBeCloseTo(centreY, HIT_PRECISION_DIGITS);
    expect(right[2]).toBeCloseTo(frontZ, HIT_PRECISION_DIGITS);
  });
});
