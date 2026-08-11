import { describe, expect, it } from "vitest";

import { modelAppearanceCatalogIds } from "./migration-notice.ts";

describe("model migration appearance notice", () => {
  it("intersects each report row with the model and deduplicates repeated appearances", () => {
    const changes = [
      {
        affectedCatalogPartIds: ["builtin:wedge-plate-2x4-left", "builtin:tile-1x2-cut-right-45"],
      },
      {
        affectedCatalogPartIds: ["builtin:wedge-plate-2x4-left", "builtin:arch-1x4"],
      },
    ];

    expect(
      modelAppearanceCatalogIds(["builtin:brick-2x4", "builtin:wedge-plate-2x4-left"], changes),
    ).toEqual(["builtin:wedge-plate-2x4-left"]);
  });

  it("does not describe catalog-wide changes as appearances used by an unaffected model", () => {
    expect(
      modelAppearanceCatalogIds(
        ["builtin:brick-2x4"],
        [{ affectedCatalogPartIds: ["builtin:arch-1x4", "builtin:curved-slope-1x2"] }],
      ),
    ).toEqual([]);
  });
});
