import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS, PROPER_ORIENTATIONS } from "../packages/catalog/src/index.ts";
import { catalogFrame } from "./part-identification-prefix50-official-ldraw-world-proposal-catalog.mjs";

/**
 * The world proposal projects LDraw placements through each catalog part's
 * LDraw frame. A parametric part's frame is a measured turn and offset; the
 * turn alone, with a zero offset, put every plate 4 LDU off its top face.
 *
 * Bound: three live parametric parts and one synthetic part with no frame;
 * mesh frames are the asset frame and are not exercised here.
 */
const orientationById = new Map(
  PROPER_ORIENTATIONS.map((orientation) => [orientation.id, orientation]),
);
const part = (id) => PART_DEFINITIONS.find((definition) => definition.id === id);

describe("world-proposal catalog frame", () => {
  for (const id of ["builtin:plate-2x4", "builtin:brick-1x1", "builtin:plate-2x14"]) {
    it(`uses ${id}'s measured turn and offset together`, () => {
      const definition = part(id);
      expect(catalogFrame(definition, orientationById)).toMatchObject({
        kind: "ldraw-interchange-frame",
        orientationId: definition.ldrawFrame.ldrawToCatalogOrientationId,
        translationLdu: [...definition.ldrawFrame.translationLdu],
      });
      // Not the identity offset: each of these has its LDraw origin off its catalog origin.
      expect(definition.ldrawFrame.translationLdu).not.toEqual([0, 0, 0]);
    });
  }

  it("refuses a parametric part that declares no frame, naming it", () => {
    const unmeasured = Object.fromEntries(
      Object.entries(part("builtin:plate-2x4")).filter(([name]) => name !== "ldrawFrame"),
    );
    expect(() => catalogFrame(unmeasured, orientationById)).toThrow(
      "Catalog builtin:plate-2x4 declares no LDraw-to-catalog frame, so its LDraw placements cannot be projected; derive one with scripts/derive-ldraw-catalog-frames.mjs.",
    );
  });
});
