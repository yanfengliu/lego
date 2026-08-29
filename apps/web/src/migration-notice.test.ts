import { describe, expect, it } from "vitest";

import { summarizeModelCatalogInterpretations } from "./migration-notice.ts";

describe("model migration interpretation notice", () => {
  it("intersects each report row with the model and deduplicates parts and changed fields", () => {
    const changes = [
      {
        affectedCatalogPartIds: ["builtin:wedge-plate-2x4-left", "builtin:tile-1x2-cut-right-45"],
        changedFields: ["render-geometry", "surface-normals"],
      },
      {
        affectedCatalogPartIds: ["builtin:wedge-plate-2x4-left", "builtin:arch-1x4"],
        changedFields: ["render-geometry", "visual-bounds"],
      },
    ];

    expect(
      summarizeModelCatalogInterpretations(
        ["builtin:brick-2x4", "builtin:wedge-plate-2x4-left"],
        changes,
      ),
    ).toEqual({
      catalogPartIds: ["builtin:wedge-plate-2x4-left"],
      changedFields: ["render-geometry", "surface-normals", "visual-bounds"],
    });
  });

  it("does not describe catalog-wide changes as interpretations used by an unaffected model", () => {
    expect(
      summarizeModelCatalogInterpretations(
        ["builtin:brick-2x4"],
        [
          {
            affectedCatalogPartIds: ["builtin:arch-1x4", "builtin:curved-slope-1x2"],
            changedFields: ["collision-semantics"],
          },
        ],
      ),
    ).toEqual({ catalogPartIds: [], changedFields: [] });
  });
});
