import { describe, expect, it } from "vitest";

import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import {
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
  type PartDefinition,
} from "./index.js";
import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";

/**
 * What the twenty-one fully measured catalog parts are, written out rather than recomputed.
 *
 * These are facts about real parts: the extents come from the exact expanded
 * LDraw closure, the collision column count from its per-column height field at
 * 1 LDU, and the connector counts from an authored connector source
 * carried through the per-part frame — Builder-derived records for eight parts
 * and the LDCad shadow library's snap metas for thirteen. Four of the LDCad-sourced
 * designs have no Builder record; 25269 deliberately selects the independently
 * authored shadow route instead of treating record presence as connector truth,
 * while 28802 refuses a contradictory Builder identity and retains the exact
 * shadow route for its six stud frames and two clutches. 35787 retains its
 * unframed native field as counterevidence and admits only the exact shadow
 * subpart's three clutch cells. 11253 likewise keeps its native record as
 * count-only counterevidence while the exact shadow walk authors one clutch.
 * Vertex counts include coincident rows split across source-authored normal
 * islands, so they pin the exact render representation rather than only unique
 * positions. A change here is a change to measured render or physical evidence,
 * not a refactor.
 */
const ADMITTED = [
  {
    id: "builtin:tile-1x2-cut-right-45",
    ldrawId: "5092.dat",
    family: "tile",
    widthStuds: 1,
    lengthStuds: 2,
    heightLdu: 8,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -4, -17], max: [10, 4, 20] },
    boundsLdu: { min: [-10, -4, -17], max: [10, 4, 20] },
    studs: 0,
    clutches: 1,
    bodyBoxes: 44,
    triangles: 84,
    vertices: 132,
    closureFiles: 7,
  },
  {
    id: "builtin:plate-1x2-round-end",
    ldrawId: "35480.dat",
    family: "plate",
    widthStuds: 1,
    lengthStuds: 2,
    heightLdu: 8,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -4, -20], max: [10, 4, 20] },
    boundsLdu: { min: [-10, -8, -20], max: [10, 4, 20] },
    studs: 2,
    clutches: 2,
    bodyBoxes: 72,
    triangles: 604,
    vertices: 525,
    closureFiles: 16,
  },
  {
    id: "builtin:wedge-plate-2x4-wing",
    ldrawId: "51739.dat",
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 4,
    heightLdu: 8,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-20, -4, -38.5], max: [20, 4, 38.5] },
    boundsLdu: { min: [-20, -8, -38.5], max: [20, 4, 38.5] },
    studs: 4,
    clutches: 4,
    bodyBoxes: 115,
    triangles: 424,
    vertices: 482,
    closureFiles: 20,
  },
  {
    id: "builtin:corner-plate-3x3",
    ldrawId: "77844.dat",
    family: "corner-plate",
    widthStuds: 3,
    lengthStuds: 3,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [20, 20],
    bodyBoundsLdu: { min: [-10, -4, -10], max: [50, 4, 50] },
    boundsLdu: { min: [-10, -8, -10], max: [50, 4, 50] },
    studs: 5,
    clutches: 5,
    bodyBoxes: 50,
    triangles: 485,
    vertices: 530,
    closureFiles: 11,
  },
  {
    id: "builtin:curved-slope-1x4-double",
    ldrawId: "93273.dat",
    family: "curved-slope",
    widthStuds: 1,
    lengthStuds: 4,
    heightLdu: 16,
    orientationId: "upright-yaw-0",
    translationLdu: [0, 8, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -8.00016098, -40], max: [10, 8, 40] },
    boundsLdu: { min: [-10, -8.00016098, -40], max: [10, 8, 40] },
    studs: 0,
    clutches: 4,
    bodyBoxes: 275,
    triangles: 328,
    vertices: 427,
    closureFiles: 21,
  },
  // builtin.basic-parts/8. LEGO Builder's 107-record pack has no record of any
  // of these three, so LDraw alone leaves each with studs and zero clutch cells
  // — a part that can be built on and never placed on anything. Their clutch
  // cells are the LDCad shadow library's, composed through the part's own LDraw
  // reference tree and driven through the same clutch-room probe.
  {
    id: "builtin:plate-3x3-corner-round",
    ldrawId: "30357.dat",
    family: "plate",
    widthStuds: 3,
    lengthStuds: 3,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [20, 20],
    bodyBoundsLdu: { min: [-10, -4, -10], max: [50, 4, 50] },
    boundsLdu: { min: [-10, -8, -10], max: [50, 4, 50] },
    studs: 8,
    clutches: 8,
    bodyBoxes: 157,
    triangles: 904,
    vertices: 946,
    closureFiles: 27,
  },
  {
    id: "builtin:wedge-plate-3x3-cut-corner",
    ldrawId: "2450.dat",
    family: "wedge-plate",
    widthStuds: 3,
    lengthStuds: 3,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-30, -4, -30], max: [30, 4, 30] },
    boundsLdu: { min: [-30, -8, -30], max: [30, 4, 30] },
    studs: 6,
    clutches: 6,
    bodyBoxes: 168,
    triangles: 650,
    vertices: 712,
    closureFiles: 15,
  },
  {
    id: "builtin:corner-plate-2x2-round",
    ldrawId: "79491.dat",
    family: "corner-plate",
    widthStuds: 2,
    lengthStuds: 2,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [10, 10],
    bodyBoundsLdu: { min: [-10, -4, -10], max: [30, 4, 30] },
    boundsLdu: { min: [-10, -8, -10], max: [30, 4, 30] },
    studs: 2,
    clutches: 2,
    bodyBoxes: 53,
    triangles: 302,
    vertices: 354,
    closureFiles: 24,
  },
  // builtin.basic-parts/14. LDraw owns surface/frame/collision; LDCad owns clutch.
  {
    id: "builtin:tile-1x1-quarter-round",
    ldrawId: "25269.dat",
    family: "tile",
    widthStuds: 1,
    lengthStuds: 1,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -4, -10], max: [10, 4, 10] },
    boundsLdu: { min: [-10, -4, -10], max: [10, 4, 10] },
    studs: 0,
    clutches: 1,
    bodyBoxes: 26,
    triangles: 96,
    vertices: 146,
    closureFiles: 13,
  },
  // builtin.basic-parts/15. The horizontal stud frames are source truth even
  // though the unchanged upright transform policy cannot yet mate to them.
  {
    id: "builtin:bracket-1x2-1x4-rounded-bottom",
    ldrawId: "28802.dat",
    family: "bracket",
    widthStuds: 4,
    lengthStuds: 1,
    heightLdu: 20,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -10, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-40, -10, -14], max: [40, 10, 10] },
    boundsLdu: { min: [-40, -14, -18], max: [40, 10, 10] },
    studs: 6,
    clutches: 2,
    bodyBoxes: 23,
    triangles: 618,
    vertices: 663,
    closureFiles: 19,
  },
  // builtin.basic-parts/16. The official and shadow subparts share the exact
  // upright frame; the unframed Builder native field is retained but unused.
  {
    id: "builtin:tile-2x2-triangular",
    ldrawId: "35787.dat",
    family: "tile",
    widthStuds: 2,
    lengthStuds: 2,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-20, -4, -20], max: [17, 4, 17] },
    boundsLdu: { min: [-20, -4, -20], max: [17, 4, 17] },
    studs: 0,
    clutches: 3,
    bodyBoxes: 66,
    triangles: 128,
    vertices: 161,
    closureFiles: 22,
  },
  // builtin.basic-parts/17. The roller is above the local stud-bearing shoe
  // deck, so the measured envelope is deliberately not plate-shaped.
  {
    id: "builtin:roller-skate",
    ldrawId: "11253.dat",
    family: "minifig-accessory",
    widthStuds: 1,
    lengthStuds: 1,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -7, -14], max: [10, 4, 14] },
    boundsLdu: { min: [-10, -8, -14], max: [10, 4, 14] },
    studs: 1,
    clutches: 1,
    bodyBoxes: 78,
    triangles: 690,
    vertices: 705,
    closureFiles: 17,
  },
  // builtin.basic-parts/18. The source-derived arch surface supplies six studs;
  // the exact pinned Builder frame supplies only its two end clutch cells.
  {
    id: "builtin:arch-1x6-thin-top",
    ldrawId: "15254.dat",
    family: "arch",
    widthStuds: 1,
    lengthStuds: 6,
    heightLdu: 48,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -24, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -24, -60], max: [10, 24, 60] },
    boundsLdu: { min: [-10, -28, -60], max: [10, 24, 60] },
    studs: 6,
    clutches: 2,
    bodyBoxes: 167,
    triangles: 548,
    vertices: 594,
    closureFiles: 15,
  },
  // builtin.basic-parts/19. The source and shadow closure agree on two
  // side-facing studs; the same shadow root authors four underside clutches.
  {
    id: "builtin:bracket-2x2-1x2-vertical-studs",
    ldrawId: "41682.dat",
    family: "bracket",
    widthStuds: 2,
    lengthStuds: 2,
    heightLdu: 28,
    orientationId: "upright-yaw-0",
    translationLdu: [0, 6, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-20, -14, -20], max: [20, 14, 20] },
    boundsLdu: { min: [-20, -14, -20], max: [20, 14, 20] },
    studs: 2,
    clutches: 4,
    bodyBoxes: 54,
    triangles: 336,
    vertices: 399,
    closureFiles: 14,
  },
  // builtin.basic-parts/20. The source supplies two top studs; the exact pinned
  // Builder frame exclusively authors the two underside clutches.
  {
    id: "builtin:brick-1x2-grille",
    ldrawId: "2877.dat",
    family: "brick",
    widthStuds: 1,
    lengthStuds: 2,
    heightLdu: 24,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -12, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
    boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
    studs: 2,
    clutches: 2,
    bodyBoxes: 26,
    triangles: 264,
    vertices: 375,
    closureFiles: 7,
  },
  // builtin.basic-parts/21. The moved-to official root supplies one top stud;
  // its checksum-pinned underside tube and the stud establish the exact Builder
  // frame that exclusively authors the two underside clutches.
  {
    id: "builtin:slope-1x2-45",
    ldrawId: "3040.dat",
    family: "slope",
    widthStuds: 1,
    lengthStuds: 2,
    heightLdu: 24,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -12, 10],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
    boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
    studs: 1,
    clutches: 2,
    bodyBoxes: 67,
    triangles: 178,
    vertices: 184,
    closureFiles: 11,
  },
  // builtin.basic-parts/22. The exact official shaft supplies render and
  // collision truth; one pinned LDCad A6x60 segment supplies three discrete
  // axle ports through the established 20 LDU station projection.
  {
    id: "builtin:axle-1x3",
    ldrawId: "4519.dat",
    family: "axle",
    widthStuds: 1,
    lengthStuds: 3,
    heightLdu: 12,
    orientationId: "upright-yaw-0",
    translationLdu: [0, 0, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-29.5, -6, -6], max: [29.5, 6, 6] },
    boundsLdu: { min: [-29.5, -6, -6], max: [29.5, 6, 6] },
    studs: 0,
    clutches: 0,
    axles: 3,
    bodyBoxes: 41,
    triangles: 176,
    vertices: 162,
    closureFiles: 4,
  },
  // builtin.basic-parts/23. The moved-to official closure supplies the open
  // Technic-brick shell; one pinned LDCad A6x1 segment supplies its transverse
  // female axle-hole endpoint without claiming collision clearance through it.
  {
    id: "builtin:technic-brick-1x2-axle-hole",
    ldrawId: "32064.dat",
    family: "technic-brick",
    widthStuds: 1,
    lengthStuds: 2,
    heightLdu: 24,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -12, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
    boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
    studs: 2,
    clutches: 2,
    axleHoles: 1,
    bodyBoxes: 23,
    triangles: 458,
    vertices: 576,
    closureFiles: 23,
  },
  // builtin.basic-parts/24. The regular square source and connector lattice are
  // quarter-turn symmetric, with yaw zero selected as the canonical declared
  // frame. Its exact LDCad shadow route authors all nine underside clutches; the
  // nominal stud profile applies only to validated stud/clutch edges, while
  // ordinary collision keeps the measured stud radius.
  {
    id: "builtin:plate-3x3",
    ldrawId: "11212.dat",
    family: "plate",
    widthStuds: 3,
    lengthStuds: 3,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-30, -4, -30], max: [30, 4, 30] },
    boundsLdu: { min: [-30, -8, -30], max: [30, 4, 30] },
    studs: 9,
    clutches: 9,
    bodyBoxes: 129,
    triangles: 844,
    vertices: 873,
    closureFiles: 10,
  },
  // builtin.basic-parts/25. The regular 2 x 2 plate shell keeps only the two
  // visible studs on one edge; the exact LDCad route independently authors
  // those two frames and all four regular underside clutches.
  {
    id: "builtin:plate-2x2-two-studs",
    ldrawId: "33909.dat",
    family: "plate",
    widthStuds: 2,
    lengthStuds: 2,
    heightLdu: 8,
    orientationId: "upright-yaw-0",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-20, -4, -20], max: [20, 4, 20] },
    boundsLdu: { min: [-20, -8, -20], max: [20, 4, 20] },
    studs: 2,
    clutches: 4,
    bodyBoxes: 41,
    triangles: 220,
    vertices: 242,
    closureFiles: 9,
  },
  // builtin.basic-parts/26. The width-first catalog frame rotates the regular
  // 1 x 5 source shell by one quarter turn. The exact LDCad route independently
  // authors its five visible stud frames and five underside clutch cells.
  {
    id: "builtin:plate-1x5",
    ldrawId: "78329.dat",
    family: "plate",
    widthStuds: 1,
    lengthStuds: 5,
    heightLdu: 8,
    orientationId: "upright-yaw-90",
    translationLdu: [0, -4, 0],
    connectorGridCenterLdu: [0, 0],
    bodyBoundsLdu: { min: [-10, -4, -50], max: [10, 4, 50] },
    boundsLdu: { min: [-10, -8, -50], max: [10, 4, 50] },
    studs: 5,
    clutches: 5,
    bodyBoxes: 39,
    triangles: 460,
    vertices: 489,
    closureFiles: 9,
  },
] as const;

/** Every part whose connector rows the LDCad shadow library authors. */
const LDCAD_CONNECTOR_PART_IDS = [
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:plate-3x3",
  "builtin:plate-2x2-two-studs",
  "builtin:plate-1x5",
] as const;

/** The three plate-lattice parts whose clutch cells Builder could not supply. */
const BUILDER_MISSING_PLATE_LATTICE_PART_IDS = [
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
] as const;

function require(id: string): PartDefinition {
  const part = getPartDefinition(id);
  if (part === undefined) throw new Error(`the catalog is missing admitted part ${id}`);
  return part;
}

const bodyBoxes = (part: PartDefinition): readonly Extract<CollisionPrimitive, { kind: "box" }>[] =>
  part.collision.primitives.filter(
    (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
      primitive.kind === "box" && primitive.tag === "body",
  );

describe("set 6651557 parts declared from measured source", () => {
  it("admits all twenty-one through the production mesh gate", () => {
    for (const expected of ADMITTED) {
      expect([expected.id, validateMeshPartDefinitionAdmission(require(expected.id))]).toEqual([
        expected.id,
        { accepted: true, issues: [] },
      ]);
    }
  });

  it("carries the measured extents, frame, connectors and collision each part actually has", () => {
    for (const expected of ADMITTED) {
      const part = require(expected.id);
      const geometry = part.geometry;
      if (geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
        throw new Error(`${expected.id} is not mesh-backed`);
      }
      const asset = SET_6651557_MESH_ASSETS[geometry.assetId]!;

      expect({
        id: part.id,
        family: part.family,
        widthStuds: part.dimensions.widthStuds,
        lengthStuds: part.dimensions.lengthStuds,
        heightLdu: part.dimensions.heightLdu,
        orientationId: geometry.assetToCatalogFrame.orientationId,
        translationLdu: geometry.assetToCatalogFrame.translationLdu,
        connectorGridCenterLdu: part.connectorGridCenterLdu,
        bodyBoundsLdu: part.bodyBoundsLdu,
        boundsLdu: part.boundsLdu,
        studs: part.connectors.filter(({ kind }) => kind === "stud").length,
        clutches: part.connectors.filter(({ kind }) => kind === "undersideClutch").length,
        axles: part.connectors.filter(({ kind }) => kind === "axle").length,
        axleHoles: part.connectors.filter(({ kind }) => kind === "axleHole").length,
        bodyBoxes: bodyBoxes(part).length,
        triangles: (asset.indices?.length ?? asset.positionsLdu.length) / 3,
        vertices: asset.positionsLdu.length / 3,
        assetId: `ldraw:official:${expected.ldrawId}`,
      }).toEqual({
        id: expected.id,
        family: expected.family,
        widthStuds: expected.widthStuds,
        lengthStuds: expected.lengthStuds,
        heightLdu: expected.heightLdu,
        orientationId: expected.orientationId,
        translationLdu: expected.translationLdu,
        connectorGridCenterLdu: expected.connectorGridCenterLdu,
        bodyBoundsLdu: expected.bodyBoundsLdu,
        boundsLdu: expected.boundsLdu,
        studs: expected.studs,
        clutches: expected.clutches,
        axles: "axles" in expected ? expected.axles : 0,
        axleHoles: "axleHoles" in expected ? expected.axleHoles : 0,
        bodyBoxes: expected.bodyBoxes,
        triangles: expected.triangles,
        vertices: expected.vertices,
        assetId: `ldraw:official:${expected.ldrawId}`,
      });
      // One collision allowance per seat, and one stud cylinder per stud.
      expect(part.collision.allowances).toHaveLength(expected.clutches);
      expect(
        part.collision.primitives.filter(({ kind, tag }) => kind === "cylinder" && tag === "stud"),
      ).toHaveLength(expected.studs);
      expect(resolvePartId(expected.ldrawId)).toBe(expected.id);
      expect(resolvePartId(part.displayName)).toBe(expected.id);
    }
  });

  it("seats 93273's middle clutches on its recessed underside, not on its lowest plane", () => {
    const part = require("builtin:curved-slope-1x4-double");
    const seats = part.connectors
      .filter(({ kind }) => kind === "undersideClutch")
      .map(({ positionLdu }) => positionLdu);

    expect(seats).toEqual([
      [0, 0, -10],
      [0, 0, 10],
      [0, 8, -30],
      [0, 8, 30],
    ]);
    // Each seat is a plane the represented solid presents downward, with none
    // of that solid inside the stud footprint below it.
    const boxes = bodyBoxes(part);
    for (const [x, y, z] of seats) {
      expect(boxes.some((box) => box.maxLdu[1] === y)).toBe(true);
      expect(
        boxes.filter(
          (box) =>
            box.maxLdu[1] > y &&
            box.minLdu[0] < x + 6 &&
            box.maxLdu[0] > x - 6 &&
            box.minLdu[2] < z + 6 &&
            box.maxLdu[2] > z - 6,
        ),
      ).toEqual([]);
    }
  });

  it("refuses a seat the part's own solid stands below", () => {
    const part = require("builtin:corner-plate-3x3");
    const seat = part.connectors.find(({ kind }) => kind === "undersideClutch")!;
    const raised: PartDefinition = {
      ...part,
      connectors: part.connectors.map((connector) =>
        connector.id === seat.id
          ? { ...connector, positionLdu: [seat.positionLdu[0], 0, seat.positionLdu[2]] }
          : connector,
      ),
      collision: {
        ...part.collision,
        allowances: part.collision.allowances.map((allowance) =>
          allowance.portId === seat.id
            ? { ...allowance, centerLdu: [allowance.centerLdu[0], -2, allowance.centerLdu[2]] }
            : allowance,
        ),
      },
    };

    const result = validateMeshPartDefinitionAdmission(raised);
    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain(
      "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
    );
    expect(result.issues.map(({ message }) => message).join(" ")).toMatch(
      /cannot pass through the part's own solid to reach that seat/u,
    );
  });

  it("preserves per-file LDraw authorship and licence for every bundled closure", () => {
    expect(BUNDLED_LDRAW_ARCHIVE.sha256).toBe(
      "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
    );
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(211);
    for (const file of BUNDLED_LDRAW_SOURCE_FILES) {
      expect(file.author.trim().length).toBeGreaterThan(0);
      expect(file.title.trim().length).toBeGreaterThan(0);
      expect(file.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(
      BUNDLED_LDRAW_SOURCE_FILES.filter(({ licenseExpression }) =>
        licenseExpression.includes("CC-BY-2.0"),
      ).map(({ path, licenseExpression }) => [path, licenseExpression]),
    ).toEqual([
      ["parts/30503.dat", "CC-BY-2.0 OR CC-BY-4.0"],
      ["parts/32064a.dat", "CC-BY-2.0 OR CC-BY-4.0"],
    ]);
    expect(
      BUNDLED_LDRAW_SOURCE_FILES.filter(
        ({ licenseExpression }) => licenseExpression === "CC-BY-4.0",
      ),
    ).toHaveLength(209);
    // 30 named authors across 211 files: attribution is retained per file, never flattened.
    expect(new Set(BUNDLED_LDRAW_SOURCE_FILES.map(({ author }) => author)).size).toBe(30);

    for (const expected of ADMITTED) {
      const closure = BUNDLED_LDRAW_CLOSURES[expected.ldrawId.replace(".dat", "")]!;
      expect(closure).toHaveLength(expected.closureFiles);
      expect(
        closure.map((index) => BUNDLED_LDRAW_SOURCE_FILES[index]?.path).filter(Boolean),
      ).toHaveLength(expected.closureFiles);
      expect(
        closure.some(
          (index) => BUNDLED_LDRAW_SOURCE_FILES[index]?.path === `parts/${expected.ldrawId}`,
        ),
      ).toBe(true);
    }
  });

  it("records bundled geometry as reusable and never as training material", () => {
    for (const expected of ADMITTED) {
      const { provenance } = require(expected.id).geometry;

      expect(provenance.sourceType).toBe("external-bundled-geometry");
      expect(provenance.externalGeometryBundled).toBe(true);
      expect(provenance.licenseExpression).toBe("CC-BY-4.0");
      expect(provenance.redistributionAllowed).toBe(true);
      expect(provenance.trainingUseAllowed).toBe(false);
      expect(provenance.attribution).toMatch(/reuse is not permission to train/u);
      expect(provenance.attribution).toContain(expected.ldrawId);
    }
  });

  it("says on the part itself which authored source made its connector claims", () => {
    // A semantic connector is never inferred from geometry, so the part has to
    // name who claimed it. The catalog provenance is what carries that outwards: a
    // Builder-sourced part and an LDCad-sourced part are not interchangeable
    // records, because they carry different licences and different attribution.
    for (const expected of ADMITTED) {
      const part = require(expected.id);
      const ldcad = (LDCAD_CONNECTOR_PART_IDS as readonly string[]).includes(expected.id);

      expect([expected.id, part.provenance.sourceId]).toEqual([
        expected.id,
        ldcad
          ? "lego-studio:ldcad-shadow-measured-part-admission"
          : "lego-studio:measured-part-admission",
      ]);
    }
  });

  it("carries the shadow library's attribution and share-alike position with the data", () => {
    for (const id of LDCAD_CONNECTOR_PART_IDS) {
      const { provenance } = require(id);

      expect(provenance.sourceType).toBe("external-connector-metadata");
      // The connectors are metadata, not geometry: nothing of the library's own
      // files is bundled, and the render mesh stays the LDraw closure's.
      expect(provenance.externalGeometryBundled).toBe(false);
      expect(provenance.licenseExpression).toBe("MIT AND CC-BY-SA-4.0");
      expect(provenance.attribution).toContain("Roland Melkert");
      expect(provenance.attribution).toMatch(/ShareAlike attaches to this derived connector data/u);
      expect(provenance.sourceVersion).toContain("15aa1e718b6a8da37d24fc7af5e52e262c041bfb");
      expect(provenance.sourceVersion).toContain(
        "668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      );
      // Reading and sharing under CC BY-SA is still not permission to train.
      expect(provenance.trainingUseAllowed).toBe(false);
    }
  });

  it("gives every Builder-missing plate-lattice part a clutch under every top stud", () => {
    // This is the whole point of admitting them. Under LDraw alone each has
    // studs and zero clutch cells, which is a part that can be built on and can
    // never be placed on anything.
    for (const id of BUILDER_MISSING_PLATE_LATTICE_PART_IDS) {
      const part = require(id);
      const studs = part.connectors
        .filter(({ kind }) => kind === "stud")
        .map(({ positionLdu }) => `${positionLdu[0]},${positionLdu[2]}`);
      const clutches = part.connectors
        .filter(({ kind }) => kind === "undersideClutch")
        .map(({ positionLdu }) => `${positionLdu[0]},${positionLdu[2]}`);

      expect(studs.length).toBeGreaterThan(0);
      expect([...clutches].sort()).toEqual([...studs].sort());
    }
  });

  it("refuses a declaration that names two connector sources, or none", () => {
    const declared: readonly MeasuredPartBlueprint[] = SET_6651557_MEASURED_BLUEPRINTS;
    const builderBlueprint = declared.find(({ designId }) => designId === "77844")!;
    const shadowBlueprint = declared.find(({ designId }) => designId === "30357")!;

    // The key is dropped rather than set to undefined: under
    // exactOptionalPropertyTypes an absent source and a present undefined one
    // are different declarations, and the factory's rule is about absence.
    const { ldcadShadowSource: shadowSource, ...sourceless } = shadowBlueprint;
    expect(shadowSource).toBeDefined();
    expect(builderBlueprint.ldcadShadowSource).toBeUndefined();

    expect(() =>
      makeMeasuredPartDefinition({ ...builderBlueprint, ldcadShadowSource: shadowSource! }),
    ).toThrow(
      /declares 2 authored connector sources.*exactly one Builder frame, pinned Builder connectivity fact, or LDCad shadow walk/u,
    );
    expect(() => makeMeasuredPartDefinition(sourceless)).toThrow(
      /declares 0 authored connector sources for its 8 clutch cells.*exactly one Builder frame, pinned Builder connectivity fact, or LDCad shadow walk/u,
    );
  });

  it("compiles only exact axis-aligned LDCad shaft or bore rows through the shared taxonomy", () => {
    const declared: readonly MeasuredPartBlueprint[] = SET_6651557_MEASURED_BLUEPRINTS;
    const shadowBlueprint = declared.find(({ designId }) => designId === "30357")!;
    const builderBlueprint = declared.find(({ designId }) => designId === "77844")!;
    const sourceConnectorsLdu = [
      { kind: "axle", positionLdu: [-20, 0, 0], normal: [-1, 0, 0] },
    ] as const;

    const definition = makeMeasuredPartDefinition({ ...shadowBlueprint, sourceConnectorsLdu });

    expect(definition.connectors.find(({ id }) => id === "axle:0")).toEqual({
      id: "axle:0",
      kind: "axle",
      geometryRole: "axleShaft",
      profileId: "axle-cross/1",
      gender: "male",
      positionLdu: [-20, 0, 0],
      normal: [-1, 0, 0],
      orientationId: "connector-up",
      capacity: 1,
      compatibleKinds: ["axleHole", "pinHole"],
    });
    expect(() => makeMeasuredPartDefinition({ ...builderBlueprint, sourceConnectorsLdu })).toThrow(
      /source connector rows without an LDCad shadow walk/u,
    );
    expect(() =>
      makeMeasuredPartDefinition({
        ...shadowBlueprint,
        sourceConnectorsLdu: [{ kind: "axle", positionLdu: [-20, 0, 0], normal: [1, 1, 0] }],
      }),
    ).toThrow(/exact shaft or bore gate emits one signed unit axis/u);
  });
});
