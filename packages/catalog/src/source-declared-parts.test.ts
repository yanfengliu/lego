import { describe, expect, it } from "vitest";

import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import {
  formatExactLdu,
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
 * What the eight set 6651557 parts are, written out rather than recomputed.
 *
 * These are facts about real parts: the extents come from the exact expanded
 * LDraw closure, the collision column count from its per-column height field at
 * 1 LDU, and the connector counts from an authored female-connector source
 * carried through the per-part frame — LEGO Builder's field for the five it has
 * a record for, the LDCad shadow library's snap metas for the three it does not.
 * A change here is a change to a measurement, not a refactor.
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
    vertices: 48,
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
    vertices: 309,
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
    vertices: 266,
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
    vertices: 334,
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
    vertices: 207,
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
    vertices: 598,
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
    vertices: 452,
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
    vertices: 199,
    closureFiles: 24,
  },
] as const;

/** The three whose clutch cells no LEGO Builder record could have supplied. */
const LDCAD_CONNECTOR_PART_IDS = [
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
  it("admits all eight through the production mesh gate", () => {
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

  it("states 93273's height exactly, because float64 cannot carry it", () => {
    const part = require("builtin:curved-slope-1x4-double");

    // -16.00016098 in the raw LDraw frame, carried to the catalog frame by the
    // whole-LDU translation the declaration states. The nearest double sits
    // 4.2e-16 LDU outside it, which is the safe direction for a minimum.
    expect(formatExactLdu(part.exactBodyBoundsLdu!.min[1])).toBe("-8.00016098");
    expect(formatExactLdu(part.exactBodyBoundsLdu!.max[1])).toBe("8");
    expect(part.bodyBoundsLdu.min[1]).toBeLessThanOrEqual(-8.00016098);
    // The nominal lattice height is two plates; the measured curve stands
    // 0.00016098 LDU proud of it and the underside plane is exact.
    expect(part.dimensions.heightLdu).toBe(16);
    expect(part.bodyBoundsLdu.max[1]).toBe(8);
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
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(84);
    for (const file of BUNDLED_LDRAW_SOURCE_FILES) {
      expect(file.licenseExpression).toBe("CC-BY-4.0");
      expect(file.author.trim().length).toBeGreaterThan(0);
      expect(file.title.trim().length).toBeGreaterThan(0);
      expect(file.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    // 22 named authors across 84 files: attribution is per file, never flattened.
    expect(new Set(BUNDLED_LDRAW_SOURCE_FILES.map(({ author }) => author)).size).toBe(22);

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

  it("says on the part itself which authored source made its clutch cells", () => {
    // A clutch is never measured from geometry, so the part has to name who
    // claimed it. The catalog provenance is what carries that outwards: a
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

  it("gives every one of the three a clutch cell under every stud it carries", () => {
    // This is the whole point of admitting them. Under LDraw alone each has
    // studs and zero clutch cells, which is a part that can be built on and can
    // never be placed on anything.
    for (const id of LDCAD_CONNECTOR_PART_IDS) {
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
    ).toThrow(/declares both a Builder record .* and an LDCad shadow walk/u);
    expect(() => makeMeasuredPartDefinition(sourceless)).toThrow(
      /8 clutch cells and no authored connector source/u,
    );
  });
});
