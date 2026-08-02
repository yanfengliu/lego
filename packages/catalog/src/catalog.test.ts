import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BRICK_HEIGHT_LDU,
  BUILTIN_CATALOG,
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  COLOR_DEFINITIONS,
  CONNECTOR_TAXONOMY_VERSION,
  getCatalogSnapshotDigestInput,
  getColorDefinition,
  getPartDefinition,
  type PartDefinition,
  type PartFamily,
  PART_DEFINITIONS,
  PLATE_HEIGHT_LDU,
  resolvePartId,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./index.js";

/** Every family the catalog defines; a new one must be added here deliberately. */
const PART_FAMILY_NAMES = [
  "brick",
  "plate",
  "tile",
  "jumper-plate",
  "grille-tile",
  "wedge-plate",
  "technic-brick",
  "axle",
  "wheel",
] as const satisfies readonly PartFamily[];

/**
 * Grid cells the part's body actually fills. A wedge's tapered corner is empty,
 * so it carries no underside clutch there.
 */
const cellIsSolid = (part: PartDefinition, x: number, z: number): boolean => {
  const wedge = part.collision.primitives.find((primitive) => primitive.kind === "wedge");
  if (!wedge) return true;
  return wedge.cutNormalXZ[0] * x + wedge.cutNormalXZ[1] * z <= wedge.cutOffsetLdu;
};

const solidCellCount = (part: PartDefinition): number => {
  if (NO_CLUTCH_FAMILIES.has(part.family)) return 0;
  const { widthStuds, lengthStuds } = part.dimensions;
  const wedge = part.collision.primitives.find((primitive) => primitive.kind === "wedge");
  if (!wedge) return widthStuds * lengthStuds;
  let count = 0;
  for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
      const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
      const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;
      if (wedge.cutNormalXZ[0] * x + wedge.cutNormalXZ[1] * z <= wedge.cutOffsetLdu) count += 1;
    }
  }
  return count;
};
/** Families that present a smooth top, so they carry no studs at all. */
const SMOOTH_TOP_FAMILIES = new Set<string>(["tile", "grille-tile", "axle", "wheel"]);
/** Families with no underside tubes, so no clutch grid. */
const NO_CLUTCH_FAMILIES = new Set<string>(["axle", "wheel"]);
const EXPECTED_PART_IDS = [
  "builtin:brick-1x1",
  "builtin:brick-1x2",
  "builtin:brick-1x3",
  "builtin:brick-1x4",
  "builtin:brick-2x2",
  "builtin:brick-2x3",
  "builtin:brick-2x4",
  "builtin:plate-1x1",
  "builtin:plate-1x2",
  "builtin:plate-1x3",
  "builtin:plate-1x4",
  "builtin:plate-2x2",
  "builtin:plate-2x3",
  "builtin:plate-2x4",
  "builtin:brick-1x6",
  "builtin:brick-1x8",
  "builtin:brick-2x6",
  "builtin:brick-2x8",
  "builtin:plate-1x6",
  "builtin:plate-1x8",
  "builtin:plate-2x6",
  "builtin:plate-2x8",
  "builtin:plate-4x4",
  "builtin:plate-4x6",
  "builtin:plate-4x8",
  "builtin:plate-6x6",
  "builtin:tile-1x1",
  "builtin:tile-1x2",
  "builtin:tile-1x4",
  "builtin:tile-1x6",
  "builtin:tile-2x2",
  "builtin:tile-2x4",
  "builtin:plate-1x10",
  "builtin:plate-1x12",
  "builtin:plate-2x10",
  "builtin:plate-2x12",
  "builtin:plate-4x10",
  "builtin:plate-4x12",
  "builtin:plate-6x8",
  "builtin:plate-6x10",
  "builtin:plate-6x12",
  "builtin:plate-6x16",
  "builtin:plate-8x8",
  "builtin:plate-8x16",
  "builtin:brick-1x10",
  "builtin:brick-1x12",
  "builtin:brick-1x16",
  "builtin:brick-2x10",
  "builtin:tile-1x3",
  "builtin:tile-1x8",
  "builtin:tile-2x6",
  "builtin:grille-tile-1x2",
  "builtin:jumper-plate-1x2",
  "builtin:jumper-plate-2x2",
  "builtin:jumper-plate-1x3",
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
  "builtin:technic-brick-1x2",
  "builtin:axle-1x2",
  "builtin:axle-1x4",
  "builtin:wheel-1x2",
] as const;

const determinant = (matrix: readonly number[]): number =>
  matrix[0]! * (matrix[4]! * matrix[8]! - matrix[5]! * matrix[7]!) -
  matrix[1]! * (matrix[3]! * matrix[8]! - matrix[5]! * matrix[6]!) +
  matrix[2]! * (matrix[3]! * matrix[7]! - matrix[4]! * matrix[6]!);

describe("starter catalog", () => {
  it("does not expose inherited object properties as catalog entries", () => {
    expect(resolvePartId("constructor")).toBeUndefined();
    expect(resolvePartId("toString")).toBeUndefined();
    expect(getPartDefinition("constructor")).toBeUndefined();
    expect(getColorDefinition("constructor")).toBeUndefined();
  });
  it("contains exactly the approved parts, every family accounted for", () => {
    expect(PART_DEFINITIONS.map(({ id }) => id)).toEqual(EXPECTED_PART_IDS);
    expect(new Set(PART_DEFINITIONS.map(({ id }) => id))).toHaveLength(EXPECTED_PART_IDS.length);
    const perFamily = Object.fromEntries(
      PART_FAMILY_NAMES.map((family) => [
        family,
        PART_DEFINITIONS.filter((part) => part.family === family).length,
      ]),
    );
    expect(perFamily).toEqual({
      brick: 15,
      plate: 27,
      tile: 9,
      "jumper-plate": 3,
      "grille-tile": 1,
      "wedge-plate": 4,
      "technic-brick": 1,
      axle: 2,
      wheel: 1,
    });
    // Every part belongs to a family the palette knows how to show.
    expect(
      PART_DEFINITIONS.filter(({ family }) => !PART_FAMILY_NAMES.includes(family)),
    ).toHaveLength(0);
  });

  it("uses integer LDU dimensions and centered bounds", () => {
    for (const part of PART_DEFINITIONS) {
      const expectedHeight =
        part.family === "brick" || part.family === "technic-brick"
          ? BRICK_HEIGHT_LDU
          : part.family === "axle"
            ? 12
            : part.family === "wheel"
              ? 62
              : PLATE_HEIGHT_LDU;
      const { dimensions } = part;

      expect(dimensions.widthLdu).toBe(dimensions.widthStuds * STUD_PITCH_LDU);
      expect(dimensions.lengthLdu).toBe(dimensions.lengthStuds * STUD_PITCH_LDU);
      expect(dimensions.heightLdu).toBe(expectedHeight);
      expect(Object.values(dimensions).every(Number.isInteger)).toBe(true);
      // Bounds are centred on the part's own origin, so a quarter turn is a
      // rotation and never also a translation. A part whose solid the stud
      // footprint does not describe declares its own — a 2L axle really is 39
      // LDU long, half a unit of moulding clearance short of the 40 the lattice
      // gives it — but it must still be centred, and its size still integral in
      // halves so repeated rotation cannot drift.
      const declared = part.geometry.bodyBoundsLdu;
      const expectedBody = declared ?? {
        min: [-dimensions.widthLdu / 2, -expectedHeight / 2, -dimensions.lengthLdu / 2],
        max: [dimensions.widthLdu / 2, expectedHeight / 2, dimensions.lengthLdu / 2],
      };
      expect(part.bodyBoundsLdu).toEqual(expectedBody);
      for (const axis of [0, 1, 2]) {
        expect(part.bodyBoundsLdu.min[axis]).toBe(-part.bodyBoundsLdu.max[axis]!);
        expect(Number.isInteger(part.bodyBoundsLdu.max[axis]! * 2)).toBe(true);
      }

      const studOverhang = SMOOTH_TOP_FAMILIES.has(part.family) ? 0 : STUD_HEIGHT_LDU;
      expect(part.boundsLdu).toEqual({
        min: [expectedBody.min[0], expectedBody.min[1]! - studOverhang, expectedBody.min[2]],
        max: expectedBody.max,
      });
    }
  });

  it("places one semantic stud and one underside tube seat at every grid point", () => {
    for (const part of PART_DEFINITIONS) {
      const { widthStuds, lengthStuds, heightLdu } = part.dimensions;
      const expectedPortCount = solidCellCount(part);
      // A jumper plate names its studs, so its count is what it declared, not
      // one per grid point.
      const expectedStudCount = SMOOTH_TOP_FAMILIES.has(part.family)
        ? 0
        : (part.geometry.studOffsetsLdu?.length ?? expectedPortCount);
      const studs = part.connectors.filter(({ kind }) => kind === "stud");
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

      expect(studs).toHaveLength(expectedStudCount);
      expect(clutches).toHaveLength(expectedPortCount);

      for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
        for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
          const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
          const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;
          const stud = studs.find(({ id }) => id === `stud:${xIndex}:${zIndex}`);
          const clutch = clutches.find(({ id }) => id === `undersideClutch:${xIndex}:${zIndex}`);
          // An axle has no underside and no top, so no cell holds either.
          if (NO_CLUTCH_FAMILIES.has(part.family)) {
            expect(stud).toBeUndefined();
            expect(clutch).toBeUndefined();
            continue;
          }
          // A wedge's tapered corner is empty, so it holds neither.
          if (!cellIsSolid(part, x, z)) {
            expect(stud).toBeUndefined();
            expect(clutch).toBeUndefined();
            continue;
          }

          if (!SMOOTH_TOP_FAMILIES.has(part.family) && part.geometry.studOffsetsLdu === undefined)
            expect(stud).toMatchObject({
              geometryRole: "stud",
              positionLdu: [x, -heightLdu / 2, z],
              normal: [0, -1, 0],
              capacity: 1,
              compatibleKinds: ["undersideClutch"],
            });
          expect(clutch).toMatchObject({
            geometryRole: "tubeSeat",
            positionLdu: [x, heightLdu / 2, z],
            normal: [0, 1, 0],
            capacity: 1,
            compatibleKinds: ["stud"],
          });
        }
      }
    }
  });

  it("provides body and stud collision primitives with connection-gated clearances", () => {
    for (const part of PART_DEFINITIONS) {
      const expectedStudCount = SMOOTH_TOP_FAMILIES.has(part.family)
        ? 0
        : (part.geometry.studOffsetsLdu?.length ?? solidCellCount(part));
      const body = part.collision.primitives.find(({ id }) => id === "body");
      // Tagged, not merely round: a wheel's body is a cylinder and not a stud.
      const studs = part.collision.primitives.filter(
        (primitive) => primitive.kind === "cylinder" && primitive.tag === "stud",
      );

      // A wedge is the same bounding box with one face sloped away, so its
      // bounds still have to match; only its kind differs.
      // A wheel is round so it can roll; everything else is a box or a wedge.
      const expectedBodyKind =
        part.family === "wheel"
          ? "cylinder"
          : part.geometry.bodyMode === "compound"
            ? "wedge"
            : "box";
      expect(body).toMatchObject(
        expectedBodyKind === "cylinder"
          ? { kind: "cylinder", tag: "body" }
          : {
              kind: expectedBodyKind,
              minLdu: part.bodyBoundsLdu.min,
              maxLdu: part.bodyBoundsLdu.max,
            },
      );
      expect(studs).toHaveLength(expectedStudCount);
      // One per cell the body fills: a wedge has no clutch over its empty corner.
      expect(part.collision.allowances).toHaveLength(solidCellCount(part));

      for (const allowance of part.collision.allowances) {
        expect(allowance).toMatchObject({
          portKind: "undersideClutch",
          incomingPrimitiveTag: "stud",
          requiresValidatedConnection: true,
          maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        });
        expect(
          part.connectors.some(
            (port) => port.id === allowance.portId && port.kind === "undersideClutch",
          ),
        ).toBe(true);
      }
    }
  });

  it("defines four proper upright yaw matrices under the -Y-up transform policy", () => {
    expect(UPRIGHT_ORIENTATIONS.map(({ id }) => id)).toEqual([
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ]);
    expect(UPRIGHT_ORIENTATIONS.map(({ quarterTurns }) => quarterTurns)).toEqual([0, 1, 2, 3]);

    for (const orientation of UPRIGHT_ORIENTATIONS) {
      expect(orientation.matrix.every(Number.isInteger)).toBe(true);
      expect(determinant(orientation.matrix)).toBe(1);
      expect(orientation.upAxis).toEqual([0, -1, 0]);
    }

    for (const part of PART_DEFINITIONS) {
      expect(part.legalOrientationIds).toEqual(UPRIGHT_ORIENTATIONS.map(({ id }) => id));
    }
  });

  it("resolves canonical, human, and LDraw aliases without importing LDraw geometry", () => {
    expect(resolvePartId("builtin:brick-2x4")).toBe("builtin:brick-2x4");
    expect(resolvePartId("  Brick 2 x 4 ")).toBe("builtin:brick-2x4");
    expect(resolvePartId("ldraw:3001.dat")).toBe("builtin:brick-2x4");
    expect(resolvePartId("3001.dat")).toBe("builtin:brick-2x4");
    expect(resolvePartId("not-a-part")).toBeUndefined();
    expect(getPartDefinition("ldraw:3024.dat")).toBe(getPartDefinition("builtin:plate-1x1"));

    for (const part of PART_DEFINITIONS) {
      expect(part.geometry.provenance.sourceType).toBe("project-authored");
      expect(part.geometry.provenance.licenseExpression).toBe("MIT");
      expect(part.geometry.provenance.externalGeometryBundled).toBe(false);
      expect(part.aliases.some(({ namespace }) => namespace === "ldraw")).toBe(true);
      expect(part.aliases.some(({ namespace }) => namespace === "human")).toBe(true);
      expect(
        part.aliases
          .filter(({ namespace }) => namespace === "ldraw")
          .every(({ provenance }) => provenance.runtimeRole === "interchange-identifier-only"),
      ).toBe(true);
    }
  });

  it("binds each project-authored geometry recipe to its declared SHA-256 digest", () => {
    const hashes = new Set<string>();

    for (const part of PART_DEFINITIONS) {
      const digest = `sha256:${createHash("sha256").update(part.geometry.digestInput).digest("hex")}`;
      expect(part.geometry.contentHash).toBe(digest);
      hashes.add(digest);
    }

    expect(hashes).toHaveLength(PART_DEFINITIONS.length);
  });

  it("exposes a curated color layer with traceable display and interoperability metadata", () => {
    expect(COLOR_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
    expect(getColorDefinition("builtin:red")?.displayHex).toBe("#C91A09");
    expect(getColorDefinition("missing")).toBeUndefined();

    for (const color of COLOR_DEFINITIONS) {
      expect(color.provenance.sourceType).toBe("project-authored");
      expect(color.provenance.licenseExpression).toBe("MIT");
      expect(Number.isInteger(color.ldrawCode)).toBe(true);
    }
    for (const part of PART_DEFINITIONS) {
      expect(part.availableColorIds).toEqual(COLOR_DEFINITIONS.map(({ id }) => id));
    }
  });

  it("returns a deeply frozen, deterministic truth-snapshot digest input", () => {
    const input = getCatalogSnapshotDigestInput();

    expect(input).toMatchObject({
      schemaVersion: "catalog-digest-input/1",
      catalogVersion: BUILTIN_CATALOG_VERSION,
      connectorTaxonomyVersion: CONNECTOR_TAXONOMY_VERSION,
      collisionModelVersion: COLLISION_MODEL_VERSION,
      transformPolicyVersion: TRANSFORM_POLICY_VERSION,
      coordinateSystem: { upAxis: "-Y", unit: "LDU", studPitchLdu: STUD_PITCH_LDU },
    });
    expect(input.parts).toBe(PART_DEFINITIONS);
    expect(input).toBe(BUILTIN_CATALOG);
    expect(input.colors).toBe(COLOR_DEFINITIONS);
    expect(input.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(JSON.stringify(getCatalogSnapshotDigestInput())).toBe(JSON.stringify(input));
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.parts)).toBe(true);
    expect(Object.isFrozen(input.parts[0]?.connectors)).toBe(true);
    expect(Object.isFrozen(input.parts[0]?.connectors[0]?.positionLdu)).toBe(true);
    expect(() => {
      (input.parts as unknown[]).push({});
    }).toThrow(TypeError);
  });
});
