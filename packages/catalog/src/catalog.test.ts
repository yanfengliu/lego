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
  PART_DEFINITIONS,
  PLATE_HEIGHT_LDU,
  resolvePartId,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./index.js";

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
  it("contains exactly the fourteen approved basic bricks and plates", () => {
    expect(PART_DEFINITIONS.map(({ id }) => id)).toEqual(EXPECTED_PART_IDS);
    expect(new Set(PART_DEFINITIONS.map(({ id }) => id))).toHaveLength(14);
    expect(PART_DEFINITIONS.filter(({ family }) => family === "brick")).toHaveLength(7);
    expect(PART_DEFINITIONS.filter(({ family }) => family === "plate")).toHaveLength(7);
  });

  it("uses integer LDU dimensions and centered bounds", () => {
    for (const part of PART_DEFINITIONS) {
      const expectedHeight = part.family === "brick" ? BRICK_HEIGHT_LDU : PLATE_HEIGHT_LDU;
      const { dimensions } = part;

      expect(dimensions.widthLdu).toBe(dimensions.widthStuds * STUD_PITCH_LDU);
      expect(dimensions.lengthLdu).toBe(dimensions.lengthStuds * STUD_PITCH_LDU);
      expect(dimensions.heightLdu).toBe(expectedHeight);
      expect(Object.values(dimensions).every(Number.isInteger)).toBe(true);
      expect(part.bodyBoundsLdu).toEqual({
        min: [-dimensions.widthLdu / 2, -expectedHeight / 2, -dimensions.lengthLdu / 2],
        max: [dimensions.widthLdu / 2, expectedHeight / 2, dimensions.lengthLdu / 2],
      });
      expect(part.boundsLdu).toEqual({
        min: [
          -dimensions.widthLdu / 2,
          -expectedHeight / 2 - STUD_HEIGHT_LDU,
          -dimensions.lengthLdu / 2,
        ],
        max: [dimensions.widthLdu / 2, expectedHeight / 2, dimensions.lengthLdu / 2],
      });
    }
  });

  it("places one semantic stud and one underside tube seat at every grid point", () => {
    for (const part of PART_DEFINITIONS) {
      const { widthStuds, lengthStuds, heightLdu } = part.dimensions;
      const expectedPortCount = widthStuds * lengthStuds;
      const studs = part.connectors.filter(({ kind }) => kind === "stud");
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

      expect(studs).toHaveLength(expectedPortCount);
      expect(clutches).toHaveLength(expectedPortCount);

      for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
        for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
          const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
          const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;
          const stud = studs.find(({ id }) => id === `stud:${xIndex}:${zIndex}`);
          const clutch = clutches.find(({ id }) => id === `undersideClutch:${xIndex}:${zIndex}`);

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
      const expectedStudCount = part.dimensions.widthStuds * part.dimensions.lengthStuds;
      const body = part.collision.primitives.find(({ id }) => id === "body");
      const studs = part.collision.primitives.filter(({ kind }) => kind === "cylinder");

      expect(body).toMatchObject({
        kind: "box",
        minLdu: part.bodyBoundsLdu.min,
        maxLdu: part.bodyBoundsLdu.max,
      });
      expect(studs).toHaveLength(expectedStudCount);
      expect(part.collision.allowances).toHaveLength(expectedStudCount);

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

    expect(hashes).toHaveLength(14);
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
