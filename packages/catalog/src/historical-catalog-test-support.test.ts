import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS } from "./index.ts";
import {
  VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS,
  restorePreV30NominalStudProfileAbsence,
  restorePreV30OrientationGrantAbsence,
} from "./historical-catalog-test-support.ts";

describe("historical catalog test projections", () => {
  // Bound: the six /30 additions and all thirteen older /29 grants across eleven parts.
  // Expected literals are independently transcribed from source commit
  // 6b02e50732d7908374b168ce0582476ac0422769, not imported from current policy.
  it("removes exactly six /30 grants and preserves the complete /29 orientation map", () => {
    const before = JSON.stringify(PART_DEFINITIONS);
    const projected = restorePreV30OrientationGrantAbsence(PART_DEFINITIONS);
    const upright = ["upright-yaw-0", "upright-yaw-90", "upright-yaw-180", "upright-yaw-270"];
    const expectedHistorical: Record<string, readonly string[]> = {
      "builtin:tile-1x8": ["proper-m-00nn000p0"],
      "builtin:plate-1x2-round-end": ["proper-m-00nn000p0"],
      "builtin:plate-1x12": ["proper-m-00nn000p0"],
      "builtin:technic-brick-1x1-axle-hole": ["proper-m-00nn000p0"],
      "builtin:technic-brick-1x2-axle-hole": ["proper-m-00pp000p0"],
      "builtin:bracket-2x2-1x2-vertical-studs": ["proper-m-p0000n0p0"],
      "builtin:tile-1x6": ["proper-m-00nn000p0"],
      "builtin:tile-1x2": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
      "builtin:plate-1x4": ["proper-m-00nn000p0"],
      "builtin:slope-1x2-45": ["proper-m-00nn000p0", "proper-m-00pp000p0"],
      "builtin:axle-1x3": ["proper-m-00pp000p0"],
    };
    const removed = projected.flatMap((historical, index) => {
      const current = PART_DEFINITIONS[index]!;
      expect(historical).toEqual({
        ...current,
        legalOrientationIds: historical.legalOrientationIds,
      });
      expect(historical.connectors).toBe(current.connectors);
      expect(historical.collision).toBe(current.collision);
      expect(historical.legalOrientationIds).toEqual([
        ...upright,
        ...(expectedHistorical[historical.id] ?? []),
      ]);
      const missing = current.legalOrientationIds.filter(
        (id) => !historical.legalOrientationIds.includes(id),
      );
      if (missing.length === 0) expect(historical).toBe(current);
      return missing.map((grant) => [historical.id, grant]);
    });
    expect(removed).toEqual([
      ["builtin:plate-1x4", "proper-m-00n0n0n00"],
      ["builtin:tile-1x2", "proper-m-00n0n0n00"],
      ["builtin:tile-1x6", "proper-m-00n0n0n00"],
      ["builtin:plate-1x2-round-end", "proper-m-00n0n0n00"],
      ["builtin:slope-1x2-45", "proper-m-00n0n0n00"],
      ["builtin:slope-1x2-45", "proper-m-00p0n0p00"],
    ]);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(projected.every((part) => Object.isFrozen(part.legalOrientationIds))).toBe(true);
    expect(JSON.stringify(PART_DEFINITIONS)).toBe(before);
  });

  it.each([
    ["builtin:plate-1x4", "proper-m-00n0n0n00"],
    ["builtin:tile-1x2", "proper-m-00n0n0n00"],
    ["builtin:tile-1x6", "proper-m-00n0n0n00"],
    ["builtin:plate-1x2-round-end", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00p0n0p00"],
  ])("refuses present %s without its expected /30 grant %s", (partId, grant) => {
    const current = PART_DEFINITIONS.find(({ id }) => id === partId)!;
    const missingGrant = {
      ...current,
      legalOrientationIds: current.legalOrientationIds.filter((id) => id !== grant),
    };
    expect(() => restorePreV30OrientationGrantAbsence([missingGrant])).toThrow(
      `expected ${partId} to carry exactly one /30 orientation grant ${grant}`,
    );
  });

  it.each([
    ["builtin:plate-1x4", "proper-m-00n0n0n00"],
    ["builtin:tile-1x2", "proper-m-00n0n0n00"],
    ["builtin:tile-1x6", "proper-m-00n0n0n00"],
    ["builtin:plate-1x2-round-end", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00n0n0n00"],
    ["builtin:slope-1x2-45", "proper-m-00p0n0p00"],
  ])("refuses present %s with a duplicate /30 grant %s", (partId, grant) => {
    const current = PART_DEFINITIONS.find(({ id }) => id === partId)!;
    const duplicateGrant = {
      ...current,
      legalOrientationIds: [...current.legalOrientationIds, grant],
    };
    expect(() => restorePreV30OrientationGrantAbsence([duplicateGrant])).toThrow(
      `expected ${partId} to carry exactly one /30 orientation grant ${grant}`,
    );
  });

  it("allows absent out-of-prefix targets without hiding unreviewed grants", () => {
    const prefix = PART_DEFINITIONS.slice(0, 78);
    expect(restorePreV30OrientationGrantAbsence(prefix)).toHaveLength(78);
    expect(restorePreV30OrientationGrantAbsence([])).toEqual([]);
    const current = PART_DEFINITIONS.find(({ id }) => id === "builtin:plate-1x4")!;
    const additional = {
      ...current,
      legalOrientationIds: [...current.legalOrientationIds, "proper-m-00p0n0p00"],
    };
    expect(restorePreV30OrientationGrantAbsence([additional])[0]!.legalOrientationIds).toEqual([
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
      "proper-m-00nn000p0",
      "proper-m-00p0n0p00",
    ]);
  });

  it("restores the exact seven-definition, 26-cylinder pre-/30 profile absence", () => {
    const projected = restorePreV30NominalStudProfileAbsence(PART_DEFINITIONS);
    const changedPartIds = projected.flatMap((definition, index) =>
      definition === PART_DEFINITIONS[index] ? [] : [definition.id],
    );

    expect(VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS).toEqual([
      "builtin:wedge-plate-3x3-cut-corner",
      "builtin:corner-plate-2x2-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:arch-1x6-thin-top",
      "builtin:bracket-2x2-1x2-vertical-studs",
      "builtin:brick-1x2-grille",
      "builtin:technic-brick-1x2-axle-hole",
    ]);
    expect(Object.isFrozen(VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS)).toBe(true);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(changedPartIds).toEqual(VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS);

    let strippedStudCylinderCount = 0;
    for (const partId of VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS) {
      const current = PART_DEFINITIONS.find(({ id }) => id === partId);
      const historical = projected.find(({ id }) => id === partId);
      expect(current, partId).toBeDefined();
      expect(historical, partId).toBeDefined();
      expect(current!.collision.validatedConnectionStudProfile, partId).toBe("nominal-stud-tube/1");
      expect("validatedConnectionStudProfile" in historical!.collision, partId).toBe(false);
      for (const primitive of historical!.collision.primitives) {
        if (primitive.kind !== "cylinder" || primitive.tag !== "stud") continue;
        strippedStudCylinderCount += 1;
        expect("validatedConnectionProfileRadiusLdu" in primitive, partId).toBe(false);
      }
    }
    expect(strippedStudCylinderCount).toBe(26);

    const preexistingProfile = "builtin:plate-3x3";
    expect(projected.find(({ id }) => id === preexistingProfile)).toBe(
      PART_DEFINITIONS.find(({ id }) => id === preexistingProfile),
    );
  });
});
