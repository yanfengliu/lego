import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG,
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  COLOR_DEFINITIONS,
  CONNECTOR_TAXONOMY_VERSION,
  getCatalogSnapshotDigestInput,
  getColorDefinition,
  getPartDefinition,
  PART_DEFINITIONS,
  resolvePartId,
  STUD_PITCH_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./index.js";

const determinant = (matrix: readonly number[]): number =>
  matrix[0]! * (matrix[4]! * matrix[8]! - matrix[5]! * matrix[7]!) -
  matrix[1]! * (matrix[3]! * matrix[8]! - matrix[5]! * matrix[6]!) +
  matrix[2]! * (matrix[3]! * matrix[7]! - matrix[4]! * matrix[6]!);

describe("catalog provenance and transforms", () => {
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

  it("resolves canonical, human, and LDraw aliases and states each geometry layer's rights", () => {
    expect(resolvePartId("builtin:brick-2x4")).toBe("builtin:brick-2x4");
    expect(resolvePartId("  Brick 2 x 4 ")).toBe("builtin:brick-2x4");
    expect(resolvePartId("ldraw:3001.dat")).toBe("builtin:brick-2x4");
    expect(resolvePartId("3001.dat")).toBe("builtin:brick-2x4");
    expect(resolvePartId("not-a-part")).toBeUndefined();
    expect(getPartDefinition("ldraw:3024.dat")).toBe(getPartDefinition("builtin:plate-1x1"));

    for (const part of PART_DEFINITIONS) {
      // A generated recipe is ours; a bundled LDraw mesh is not, and says so
      // with the licence and attribution CC BY 4.0 requires.
      const bundled = part.geometry.generatorId === "builtin:preloaded-mesh-reference/1";
      expect(part.geometry.provenance.sourceType).toBe(
        bundled ? "external-bundled-geometry" : "project-authored",
      );
      expect(part.geometry.provenance.licenseExpression).toBe(bundled ? "CC-BY-4.0" : "MIT");
      expect(part.geometry.provenance.externalGeometryBundled).toBe(bundled);
      expect(part.geometry.provenance.trainingUseAllowed).toBe(false);
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
      // A bundled mesh is hashed from its own bytes rather than from a
      // generator input, and mesh-assets.ts already refuses a mismatch.
      if (part.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
        hashes.add(part.geometry.contentHash);
        continue;
      }
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
