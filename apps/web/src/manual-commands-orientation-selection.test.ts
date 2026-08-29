import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { createAddPartTransaction } from "./manual-commands";

function emptyDocument() {
  return createEmptyBrickDocument({ id: "orientation-document", name: "Orientation fixture" });
}

describe("catalog orientation selection command boundary", () => {
  it("authors the palette's explicit part-scoped orientation at the empty-document origin", () => {
    const transaction = createAddPartTransaction(emptyDocument(), {
      catalogPartId: "builtin:axle-1x3",
      colorId: "builtin:red",
      selectedPartId: null,
      orientationId: "proper-m-00pp000p0",
    });
    const add = transaction.operations.find(({ kind }) => kind === "addPart");
    expect(add?.kind).toBe("addPart");
    if (add?.kind !== "addPart") throw new Error("Expected one authored part");
    expect(add.part.transform).toEqual({
      positionLdu: [0, -18, 0],
      orientationId: "proper-m-00pp000p0",
    });

    expect(() =>
      createAddPartTransaction(emptyDocument(), {
        catalogPartId: "builtin:brick-2x2",
        colorId: "builtin:red",
        selectedPartId: null,
        orientationId: "proper-m-00pp000p0",
      }),
    ).toThrow(/Orientation proper-m-00pp000p0 is illegal for builtin:brick-2x2/);
  });

  it("forwards an explicit upright palette orientation through selected-target attachment", () => {
    const first = createAddPartTransaction(emptyDocument(), {
      catalogPartId: "builtin:brick-2x2",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const onePart = applyBuildOperations(emptyDocument(), first.operations);
    const attached = createAddPartTransaction(onePart, {
      catalogPartId: "builtin:plate-1x2",
      colorId: "builtin:red",
      selectedPartId: first.partId,
      orientationId: "upright-yaw-90",
    });
    const add = attached.operations.find(({ kind }) => kind === "addPart");
    expect(add?.kind === "addPart" ? add.part.transform.orientationId : undefined).toBe(
      "upright-yaw-90",
    );
  });
});
