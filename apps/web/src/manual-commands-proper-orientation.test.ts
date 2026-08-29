import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "./manual-commands";

describe("proper-orientation manual placement", () => {
  it("refuses a globally proper orientation that the selected part does not allow", () => {
    const document = createEmptyBrickDocument({ id: "document-1", name: "Illegal frame fixture" });
    const brick = getPartDefinition("builtin:brick-1x1");
    if (brick?.availableColorIds[0] === undefined) throw new Error("Brick fixture is unavailable.");
    const colorId = brick.availableColorIds[0];

    expect(() =>
      createPlacePartTransaction(document, {
        catalogPartId: brick.id,
        colorId,
        transform: {
          positionLdu: [0, 2, 0],
          orientationId: "proper-m-p0000p0n0",
        },
      }),
    ).toThrow(
      `Orientation proper-m-p0000p0n0 is illegal for builtin:brick-1x1; the catalog allows upright-yaw-0, upright-yaw-90, upright-yaw-180, upright-yaw-270`,
    );
  });

  it("authors a newly legal non-upright axle connection instead of rejecting its frame", () => {
    const empty = createEmptyBrickDocument({ id: "document-1", name: "Axle fixture" });
    const holder = createPartInstance({
      id: "holder",
      catalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
    });
    const document: BrickDocumentV1 = {
      ...empty,
      parts: [holder],
      submodels: [{ ...empty.submodels[0]!, partIds: [holder.id] }],
      steps: [{ ...empty.steps[0]!, partIds: [holder.id] }],
    };
    const axle = getPartDefinition("builtin:axle-1x3");
    if (axle?.availableColorIds[0] === undefined) throw new Error("Axle fixture is unavailable.");

    const transaction = createPlacePartTransaction(document, {
      catalogPartId: axle.id,
      colorId: axle.availableColorIds[0],
      transform: {
        positionLdu: [0, 22, 0],
        orientationId: "proper-m-00pp000p0",
      },
    });
    const connection = transaction.operations.find(({ kind }) => kind === "addConnection");

    expect(connection).toMatchObject({
      kind: "addConnection",
      connection: {
        a: { partId: holder.id, portId: "blindAxleHole:0" },
        b: { partId: transaction.partId, portId: "axle:0" },
      },
    });
    const placed = applyBuildOperations(document, transaction.operations);
    expect(placed.parts.find(({ id }) => id === transaction.partId)?.transform).toEqual({
      positionLdu: [0, 22, 0],
      orientationId: "proper-m-00pp000p0",
    });
    expect(placed.connections).toHaveLength(1);
  });
});
