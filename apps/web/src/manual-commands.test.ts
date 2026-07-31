import { BRICK_HEIGHT_LDU } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import {
  ManualCommandError,
  createMovePartTransaction,
  createPlacePartTransaction,
} from "./manual-commands";
import { GROUND_UNDERSIDE_LDU, snapPlacementOrigin } from "./placement";

const BRICK_2X2 = "builtin:brick-2x2";
const BRICK_2X4 = "builtin:brick-2x4";

function emptyDocument(): BrickDocumentV1 {
  return createEmptyBrickDocument({ id: "document-1", name: "Placement fixture" });
}

function place(
  document: BrickDocumentV1,
  catalogPartId: string,
  positionLdu: [number, number, number],
  orientationId = "upright-yaw-0",
): { document: BrickDocumentV1; partId: string } {
  const transaction = createPlacePartTransaction(document, {
    catalogPartId,
    colorId: "builtin:red",
    transform: { positionLdu, orientationId },
  });
  return {
    document: applyBuildOperations(document, transaction.operations),
    partId: transaction.partId,
  };
}

function groundOrigin(catalogPartId: string, x: number, z: number): [number, number, number] {
  return [
    ...snapPlacementOrigin({ catalogPartId, orientationId: "upright-yaw-0", rawLdu: [x, 0, z] }),
  ];
}

describe("createPlacePartTransaction", () => {
  it("places a first part anywhere on the plate and keeps the document valid", () => {
    const { document } = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 137, -84));
    const report = validateBrickDocument(document);

    expect(document.parts).toHaveLength(1);
    expect(document.parts[0]!.transform.positionLdu).toEqual([140, 0, -80]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("auto-attaches every stud a dropped part lands on", () => {
    const first = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));
    const second = place(first.document, BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);
    const report = validateBrickDocument(second.document);

    expect(second.document.connections).toHaveLength(4);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("leaves a disconnected placement draft-invalid rather than refusing it", () => {
    const first = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));
    const apart = place(first.document, BRICK_2X2, groundOrigin(BRICK_2X2, 400, 400));
    const report = validateBrickDocument(apart.document);

    expect(apart.document.parts).toHaveLength(2);
    expect(apart.document.connections).toHaveLength(0);
    expect(report.documentGloballyValid).toBe(false);
    expect(report.issues.map(({ code }) => code)).toContain("DISCONNECTED_ASSEMBLY");
  });

  it("never proposes an edge on a port an existing connection already holds", () => {
    const first = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));
    const second = place(first.document, BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);
    // A third brick on the same studs would double-book them; none stay free.
    const third = createPlacePartTransaction(second.document, {
      catalogPartId: BRICK_2X2,
      colorId: "builtin:red",
      transform: { positionLdu: [0, -BRICK_HEIGHT_LDU, 0], orientationId: "upright-yaw-0" },
    });

    expect(third.operations.filter(({ kind }) => kind === "addConnection")).toHaveLength(0);
  });

  it("produces identical operations for identical input", () => {
    const document = emptyDocument();
    const options = {
      catalogPartId: BRICK_2X2,
      colorId: "builtin:red",
      transform: {
        positionLdu: [0, 0, 0] as [number, number, number],
        orientationId: "upright-yaw-0",
      },
    };

    expect(createPlacePartTransaction(document, options)).toEqual(
      createPlacePartTransaction(document, options),
    );
  });

  it("names the budget it refuses to exceed", () => {
    const document = {
      ...emptyDocument(),
      constraints: { ...emptyDocument().constraints, maxParts: 0 },
    };

    expect(() =>
      createPlacePartTransaction(document, {
        catalogPartId: BRICK_2X2,
        colorId: "builtin:red",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ).toThrow(/part budget is exhausted: 0 of 0 parts are placed/);
  });

  it("rejects a colour the part cannot be made in, naming both", () => {
    expect(() =>
      createPlacePartTransaction(emptyDocument(), {
        catalogPartId: BRICK_2X2,
        colorId: "builtin:chartreuse",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ).toThrow(/Color builtin:chartreuse is unavailable for builtin:brick-2x2/);
  });
});

describe("createMovePartTransaction", () => {
  it("detaches at the source and reattaches at the destination", () => {
    const base = place(emptyDocument(), BRICK_2X4, groundOrigin(BRICK_2X4, 0, 0));
    const stacked = place(base.document, BRICK_2X2, [0, -BRICK_HEIGHT_LDU, -20]);
    expect(stacked.document.connections).toHaveLength(4);

    const moved = applyBuildOperations(
      stacked.document,
      createMovePartTransaction(stacked.document, stacked.partId, {
        positionLdu: [0, -BRICK_HEIGHT_LDU, 20],
        orientationId: "upright-yaw-0",
      }).operations,
    );
    const report = validateBrickDocument(moved);

    expect(moved.parts.find(({ id }) => id === stacked.partId)!.transform.positionLdu).toEqual([
      0,
      -BRICK_HEIGHT_LDU,
      20,
    ]);
    expect(moved.connections).toHaveLength(4);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("drops every incident edge when a part is dragged into open space", () => {
    const base = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));
    const stacked = place(base.document, BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);

    const moved = applyBuildOperations(
      stacked.document,
      createMovePartTransaction(stacked.document, stacked.partId, {
        positionLdu: groundOrigin(BRICK_2X2, 400, 400),
        orientationId: "upright-yaw-0",
      }).operations,
    );

    expect(moved.connections).toHaveLength(0);
    expect(validateBrickDocument(moved).documentGloballyValid).toBe(false);
  });

  it("keeps the moved part's stable identity", () => {
    const base = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));
    const moved = applyBuildOperations(
      base.document,
      createMovePartTransaction(base.document, base.partId, {
        positionLdu: groundOrigin(BRICK_2X2, 60, 60),
        orientationId: "upright-yaw-90",
      }).operations,
    );

    expect(moved.parts).toHaveLength(1);
    expect(moved.parts[0]!.id).toBe(base.partId);
    expect(moved.parts[0]!.transform.orientationId).toBe("upright-yaw-90");
  });

  it("refuses an orientation the catalog does not allow for the part", () => {
    const base = place(emptyDocument(), BRICK_2X2, groundOrigin(BRICK_2X2, 0, 0));

    expect(() =>
      createMovePartTransaction(base.document, base.partId, {
        positionLdu: [0, 0, 0],
        orientationId: "upside-down",
      }),
    ).toThrow(/Orientation upside-down is illegal for builtin:brick-2x2/);
  });

  it("reports a part it cannot find", () => {
    expect(() =>
      createMovePartTransaction(emptyDocument(), "missing-part", {
        positionLdu: [0, 0, 0],
        orientationId: "upright-yaw-0",
      }),
    ).toThrow(ManualCommandError);
  });
});

describe("ground placement convention", () => {
  it("rests a brick dropped on empty plate at the document origin", () => {
    expect(groundOrigin(BRICK_2X2, 0, 0)).toEqual([0, 0, 0]);
    expect(GROUND_UNDERSIDE_LDU).toBe(BRICK_HEIGHT_LDU / 2);
  });
});
