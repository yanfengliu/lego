import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { BUILTIN_CATALOG, BUILTIN_TRANSFORM_POLICY_MANIFEST, PART_DEFINITIONS } from "./catalog.ts";
import {
  PROJECT_TRANSFORM_POLICY_PROVENANCE,
  PROPER_ORIENTATIONS,
  TRANSFORM_POLICY_ID,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import { makePartDefinition } from "./part-factory.ts";
import { PART_SCOPED_NON_UPRIGHT_LEGAL_ORIENTATION_IDS } from "./part-factory-support.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { PART_BLUEPRINTS } from "./part-blueprints.ts";
import type { OrientationMatrix } from "./types.ts";

const LEGACY_UPRIGHT_ROWS = [
  {
    id: "upright-yaw-0",
    quarterTurns: 0,
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    upAxis: [0, -1, 0],
  },
  {
    id: "upright-yaw-90",
    quarterTurns: 1,
    matrix: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    upAxis: [0, -1, 0],
  },
  {
    id: "upright-yaw-180",
    quarterTurns: 2,
    matrix: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    upAxis: [0, -1, 0],
  },
  {
    id: "upright-yaw-270",
    quarterTurns: 3,
    matrix: [0, 0, -1, 0, 1, 0, 1, 0, 0],
    upAxis: [0, -1, 0],
  },
] as const;

const matrixKey = (matrix: OrientationMatrix): string => matrix.join(",");

function determinant(matrix: OrientationMatrix): number {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

function multiply(left: OrientationMatrix, right: OrientationMatrix): OrientationMatrix {
  return [
    left[0] * right[0] + left[1] * right[3] + left[2] * right[6],
    left[0] * right[1] + left[1] * right[4] + left[2] * right[7],
    left[0] * right[2] + left[1] * right[5] + left[2] * right[8],
    left[3] * right[0] + left[4] * right[3] + left[5] * right[6],
    left[3] * right[1] + left[4] * right[4] + left[5] * right[7],
    left[3] * right[2] + left[4] * right[5] + left[5] * right[8],
    left[6] * right[0] + left[7] * right[3] + left[8] * right[6],
    left[6] * right[1] + left[7] * right[4] + left[8] * right[7],
    left[6] * right[2] + left[7] * right[5] + left[8] * right[8],
  ];
}

const inverse = (matrix: OrientationMatrix): OrientationMatrix => [
  matrix[0],
  matrix[3],
  matrix[6],
  matrix[1],
  matrix[4],
  matrix[7],
  matrix[2],
  matrix[5],
  matrix[8],
];

describe("proper source/catalog orientations", () => {
  it("preserves the four legacy rows first and admits only the project-authored part pairs", () => {
    expect(UPRIGHT_ORIENTATIONS).toEqual(LEGACY_UPRIGHT_ROWS);
    const uprightIds = LEGACY_UPRIGHT_ROWS.map(({ id }) => id);
    expect(PROPER_ORIENTATIONS.slice(0, 4)).toEqual(LEGACY_UPRIGHT_ROWS);

    const widened = Object.fromEntries(
      PART_DEFINITIONS.filter(({ legalOrientationIds }) => legalOrientationIds.length > 4).map(
        ({ id, legalOrientationIds }) => [id, legalOrientationIds.slice(4)],
      ),
    );
    const expectedNonUprightRoster = {
      "builtin:plate-1x4": ["proper-m-00nn000p0"],
      "builtin:tile-1x2": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
      "builtin:tile-1x6": ["proper-m-00nn000p0"],
      "builtin:plate-1x12": ["proper-m-00nn000p0"],
      "builtin:tile-1x8": ["proper-m-00nn000p0"],
      "builtin:plate-1x2-round-end": ["proper-m-00nn000p0"],
      "builtin:bracket-2x2-1x2-vertical-studs": ["proper-m-p0000n0p0"],
      "builtin:slope-1x2-45": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
      "builtin:axle-1x3": ["proper-m-00pp000p0"],
      "builtin:technic-brick-1x2-axle-hole": ["proper-m-00pp000p0"],
      "builtin:technic-brick-1x1-axle-hole": ["proper-m-00nn000p0"],
    };
    expect(widened).toEqual(expectedNonUprightRoster);
    expect(PART_SCOPED_NON_UPRIGHT_LEGAL_ORIENTATION_IDS).toEqual(expectedNonUprightRoster);
    const properIds = new Set(PROPER_ORIENTATIONS.map(({ id }) => id));
    for (const part of PART_DEFINITIONS) {
      expect(part.legalOrientationIds.slice(0, 4), part.id).toEqual(uprightIds);
      expect(new Set(part.legalOrientationIds).size, part.id).toBe(part.legalOrientationIds.length);
      expect(
        part.legalOrientationIds.every((orientationId) => properIds.has(orientationId)),
        part.id,
      ).toBe(true);
    }
    expect(TRANSFORM_POLICY_ID).toBe("part-scoped-proper-orientations-negative-y-up");
    expect(TRANSFORM_POLICY_VERSION).toBe("part-scoped-proper-orientations-negative-y-up/1");
  });

  it("binds the exact project-authored placement roster in one versioned manifest", () => {
    expect(BUILTIN_TRANSFORM_POLICY_MANIFEST).toMatchObject({
      schemaVersion: "lego.transform-policy-manifest/1",
      id: TRANSFORM_POLICY_ID,
      version: TRANSFORM_POLICY_VERSION,
      authority: "project-authored-catalog-truth",
      sourceAndProposalArtifactRole: "corroboration-only",
      provenance: PROJECT_TRANSFORM_POLICY_PROVENANCE,
    });
    expect(BUILTIN_TRANSFORM_POLICY_MANIFEST.orientations).toBe(PROPER_ORIENTATIONS);
    expect(BUILTIN_TRANSFORM_POLICY_MANIFEST.orientations.slice(0, 4)).toEqual(LEGACY_UPRIGHT_ROWS);
    expect(BUILTIN_TRANSFORM_POLICY_MANIFEST.parts).toEqual(
      PART_DEFINITIONS.map(({ id, legalOrientationIds }) => ({ id, legalOrientationIds })),
    );
    expect(BUILTIN_CATALOG.transformPolicy).toBe(BUILTIN_TRANSFORM_POLICY_MANIFEST);
    expect(Object.isFrozen(BUILTIN_TRANSFORM_POLICY_MANIFEST)).toBe(true);
    expect(Object.isFrozen(BUILTIN_TRANSFORM_POLICY_MANIFEST.parts)).toBe(true);
    expect(
      createHash("sha256").update(JSON.stringify(BUILTIN_TRANSFORM_POLICY_MANIFEST)).digest("hex"),
    ).toBe("b6a03f9bfa1a097991aea3fe3ea668c37952111f2b57b8b42ec47996ad152c59");
  });

  it("pins the exact ordered 24-row roster", () => {
    const roster = PROPER_ORIENTATIONS.map(({ id, matrix }) => ({ id, matrix }));
    expect(new Set(roster.map(({ id }) => id)).size).toBe(24);
    expect(new Set(roster.map(({ matrix }) => matrixKey(matrix))).size).toBe(24);
    expect(createHash("sha256").update(JSON.stringify(roster)).digest("hex")).toBe(
      "57446894cd2b917eb5463672655baa012d7c03539ba4147cd89e9c774a309201",
    );
    expect(BUILTIN_CATALOG.orientations).toBe(PROPER_ORIENTATIONS);
  });

  it("proves signed-permutation form and excludes every reflection", () => {
    for (const { id, matrix } of PROPER_ORIENTATIONS) {
      expect(matrix, id).toHaveLength(9);
      expect(
        matrix.every((entry) => entry === -1 || entry === 0 || entry === 1),
        id,
      ).toBe(true);
      for (let row = 0; row < 3; row += 1) {
        expect(matrix.slice(row * 3, row * 3 + 3).filter(Boolean), `${id} row ${row}`).toHaveLength(
          1,
        );
      }
      for (let column = 0; column < 3; column += 1) {
        expect(
          [matrix[column], matrix[3 + column], matrix[6 + column]].filter(Boolean),
          `${id} column ${column}`,
        ).toHaveLength(1);
      }
      expect(determinant(matrix), id).toBe(1);
    }
  });

  it("contains all 576 products and all 24 inverses", () => {
    const keys = new Set(PROPER_ORIENTATIONS.map(({ matrix }) => matrixKey(matrix)));
    let products = 0;
    for (const left of PROPER_ORIENTATIONS) {
      expect(keys.has(matrixKey(inverse(left.matrix))), `inverse ${left.id}`).toBe(true);
      for (const right of PROPER_ORIENTATIONS) {
        expect(
          keys.has(matrixKey(multiply(left.matrix, right.matrix))),
          `${left.id} * ${right.id}`,
        ).toBe(true);
        products += 1;
      }
    }
    expect(products).toBe(576);
  });

  it("accepts proper rotations only for an interchange frame", () => {
    const blueprints: readonly PartBlueprint[] = PART_BLUEPRINTS;
    const blueprint = blueprints.find(({ ldrawFrame }) => ldrawFrame !== undefined);
    expect(blueprint).toBeDefined();
    if (blueprint === undefined || blueprint.ldrawFrame === undefined) return;
    const ldrawFrame = blueprint.ldrawFrame;
    const sourceFramed = makePartDefinition({
      ...blueprint,
      ldrawFrame: {
        ...ldrawFrame,
        ldrawToCatalogOrientationId: "proper-m-p000n000n",
      },
    });

    expect(sourceFramed.ldrawFrame?.ldrawToCatalogOrientationId).toBe("proper-m-p000n000n");
    expect(sourceFramed.legalOrientationIds).toEqual(UPRIGHT_ORIENTATIONS.map(({ id }) => id));
    expect(() =>
      makePartDefinition({
        ...blueprint,
        ldrawFrame: {
          ...ldrawFrame,
          ldrawToCatalogOrientationId: "proper-m-p000p000n",
        },
      }),
    ).toThrow(/unknown LDraw-to-catalog orientation/);
  });
});
