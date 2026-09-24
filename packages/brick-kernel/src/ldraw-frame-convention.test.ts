import { PART_DEFINITIONS, getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { exportBrickDocumentToLDraw, importBrickDocumentFromLDraw } from "./ldraw.ts";
import { ldrawToCatalogFrame } from "./ldraw-frame-conversion.ts";

/**
 * The LDraw-to-catalog frame convention, pinned for a parametric part and a
 * measured one: catalog = O * ldraw + t, t the catalog point the LDraw origin
 * lands on. Before catalog /30 the kernel gave every parametric part a zero
 * offset and, except the 2 x 14 plate, no turn, so a 2 x 4 plate was exported
 * 4 LDU low and a quarter turn off, and booklet playback needed an ignored
 * frame registry. Bound: these cases pin three parametric parts and two mesh
 * parts; the catalog test pins that every parametric part has a measured row.
 */
const frameOf = (catalogPartId: string) => {
  const frame = ldrawToCatalogFrame(catalogPartId);
  return { orientationId: frame.orientation.id, translationLdu: [...frame.translationLdu] };
};

function onePartDocument(catalogPartId: string): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "frame-convention", name: "Frame convention" });
  const part = createPartInstance({
    id: "only-part",
    catalogPartId,
    transform: { positionLdu: [20, 0, -40], orientationId: "upright-yaw-0" },
  });
  return {
    ...base,
    parts: [part],
    submodels: [{ ...base.submodels[0]!, partIds: [part.id] }],
    steps: [{ ...base.steps[0]!, partIds: [part.id] }],
  };
}

describe("LDraw-to-catalog frame convention", () => {
  it("gives a parametric part its measured turn and top-face offset", () => {
    // LDraw runs a 2 x 4 plate's long side along x with the origin on the top
    // face; the catalog runs it along z with the origin at the body centre.
    expect(frameOf("builtin:plate-2x4")).toEqual({
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
    });
    expect(frameOf("builtin:brick-1x1")).toEqual({
      orientationId: "upright-yaw-0",
      translationLdu: [0, -12, 0],
    });
    // 2420.dat's origin is its corner stud, not the centre of its bounds.
    expect(frameOf("builtin:corner-plate-2x2")).toEqual({
      orientationId: "upright-yaw-0",
      translationLdu: [-10, -4, -10],
    });
  });

  it("gives a measured part its mesh asset frame", () => {
    expect(frameOf("builtin:tile-1x2-chamfered-indented")).toEqual({
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
    });
    expect(frameOf("builtin:slope-1x2-45")).toEqual({
      orientationId: "upright-yaw-0",
      translationLdu: [0, -12, 10],
    });
  });

  it("has a frame for every catalog part, measured from the official file for parametric ones", () => {
    for (const definition of PART_DEFINITIONS) {
      expect(() => ldrawToCatalogFrame(definition.id)).not.toThrow();
      if (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1") continue;
      expect(definition.ldrawFrame?.provenance).toMatchObject({
        sourceType: "interoperability-mapping",
        runtimeRole: "interchange-frame-measurement",
        externalGeometryBundled: false,
        trainingUseAllowed: false,
      });
      expect(definition.ldrawFrame?.provenance.sourceId).toBe(
        `ldraw:official:${definition.aliases.find(({ namespace }) => namespace === "ldraw")!.value}`,
      );
    }
  });

  it("exports a parametric part where LDraw puts it and reads it back unchanged", () => {
    const document = onePartDocument("builtin:plate-2x4");
    const text = exportBrickDocumentToLDraw(document);
    expect(text).toContain("0 !BRICK-STUDIO FORMAT lego.ldraw-subset/2");
    // Catalog origin [20, 0, -40]; the top face is 4 LDU up, turned a quarter.
    expect(text).toContain("1 4 20 -4 -40 0 0 1 0 1 0 -1 0 0 3020.dat");
    expect(importBrickDocumentFromLDraw(text).parts[0]!.transform).toEqual(
      document.parts[0]!.transform,
    );
  });

  it("reads a lego.ldraw-subset/1 file through the frame it was written with", () => {
    const document = onePartDocument("builtin:plate-2x4");
    // What /1 wrote for the same part: the catalog origin, with no turn.
    const legacy = exportBrickDocumentToLDraw(document)
      .replace("FORMAT lego.ldraw-subset/2", "FORMAT lego.ldraw-subset/1")
      .replace(
        "1 4 20 -4 -40 0 0 1 0 1 0 -1 0 0 3020.dat",
        "1 4 20 0 -40 1 0 0 0 1 0 0 0 1 3020.dat",
      );
    expect(importBrickDocumentFromLDraw(legacy).parts[0]!.transform).toEqual(
      document.parts[0]!.transform,
    );
    expect(getPartDefinition("builtin:plate-2x4")?.ldrawFrame?.ldrawToCatalogOrientationId).toBe(
      "upright-yaw-90",
    );
  });

  it("refuses an unknown subset format by name", () => {
    const text = exportBrickDocumentToLDraw(onePartDocument("builtin:plate-2x4")).replace(
      "FORMAT lego.ldraw-subset/2",
      "FORMAT lego.ldraw-subset/9",
    );
    expect(() => importBrickDocumentFromLDraw(text)).toThrow(
      /lego\.ldraw-subset\/1 or lego\.ldraw-subset\/2; found '0 !BRICK-STUDIO FORMAT lego\.ldraw-subset\/9'/u,
    );
  });
});
