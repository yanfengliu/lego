import type { PartDefinition } from "./types.ts";
import { deepFreeze } from "./freeze.ts";
import { getMeasuredPhysicalPromotionBaseDefinition } from "./part-factory.ts";

/**
 * These six grants are absent from immutable /29 source commit
 * 6b02e50732d7908374b168ce0582476ac0422769, part-factory-support.ts:30-42.
 * Keep the rollback closed: future grants must fail historical digest tests,
 * not silently disappear under a generic non-upright filter.
 */
const VERSION_30_ADDED_ORIENTATION_GRANTS: Readonly<Record<string, readonly string[]>> = deepFreeze(
  {
    "builtin:plate-1x4": ["proper-m-00n0n0n00"],
    "builtin:tile-1x2": ["proper-m-00n0n0n00"],
    "builtin:tile-1x6": ["proper-m-00n0n0n00"],
    "builtin:plate-1x2-round-end": ["proper-m-00n0n0n00"],
    "builtin:slope-1x2-45": ["proper-m-00n0n0n00", "proper-m-00p0n0p00"],
  },
);

/** Restore only the six /30 additions while retaining every older /29 grant. */
export function restorePreV30OrientationGrantAbsence(
  definitions: readonly PartDefinition[],
): readonly PartDefinition[] {
  return deepFreeze(
    definitions.map((definition) => {
      const introduced = VERSION_30_ADDED_ORIENTATION_GRANTS[definition.id];
      if (introduced === undefined) return definition;
      for (const grant of introduced) {
        if (definition.legalOrientationIds.filter((id) => id === grant).length !== 1) {
          throw new Error(
            `Historical catalog projection expected ${definition.id} to carry exactly one /30 orientation grant ${grant} before restoring its absence.`,
          );
        }
      }
      return {
        ...definition,
        legalOrientationIds: definition.legalOrientationIds.filter(
          (id) => !introduced.includes(id),
        ),
      };
    }),
  );
}

/**
 * Existing definitions whose source-rounded R6x4 stud cylinders first gained
 * the reviewed nominal connection-only profile in catalog /30. Keep this list
 * closed and literal: historical projections must remove only this reviewed
 * reinterpretation, never every profile the current catalog happens to carry.
 */
export const VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS = Object.freeze([
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
  "builtin:technic-brick-1x2-axle-hole",
] as const);

const VERSION_30_NOMINAL_STUD_PROFILE_PART_ID_SET: ReadonlySet<string> = new Set(
  VERSION_30_NOMINAL_STUD_PROFILE_PART_IDS,
);

/**
 * Project the seven /30 profile-class reinterpretations back to their exact
 * pre-/30 absence. This intentionally strips both the definition-level profile
 * and every matching stud-cylinder radius while retaining all other current
 * fields for the older focused catalog-prefix tests.
 */
export function restorePreV30NominalStudProfileAbsence(
  definitions: readonly PartDefinition[],
): readonly PartDefinition[] {
  return deepFreeze(
    definitions.map((definition) => {
      if (!VERSION_30_NOMINAL_STUD_PROFILE_PART_ID_SET.has(definition.id)) {
        return definition;
      }
      if (definition.collision.validatedConnectionStudProfile !== "nominal-stud-tube/1") {
        throw new Error(
          `Historical catalog projection expected ${definition.id} to carry the /30 nominal stud profile before restoring its absence.`,
        );
      }

      let strippedStudCylinderCount = 0;
      const primitives = definition.collision.primitives.map((primitive) => {
        if (primitive.kind !== "cylinder" || primitive.tag !== "stud") return primitive;
        if (primitive.validatedConnectionProfileRadiusLdu === undefined) {
          throw new Error(
            `Historical catalog projection expected every stud cylinder on ${definition.id} to carry the /30 connection-only radius.`,
          );
        }
        const historicalPrimitive = { ...primitive };
        Reflect.deleteProperty(historicalPrimitive, "validatedConnectionProfileRadiusLdu");
        strippedStudCylinderCount += 1;
        return historicalPrimitive;
      });
      if (strippedStudCylinderCount === 0) {
        throw new Error(
          `Historical catalog projection found no /30 nominal-profile stud cylinders on ${definition.id}.`,
        );
      }

      const historicalCollision = { ...definition.collision };
      Reflect.deleteProperty(historicalCollision, "validatedConnectionStudProfile");
      return {
        ...definition,
        collision: { ...historicalCollision, primitives },
      } as PartDefinition;
    }),
  );
}

/**
 * Restore exact same-id bases when a historical digest predates their physical
 * promotions. Array slicing alone is insufficient because it removes appended
 * identities but cannot undo a replacement in an existing catalog slot.
 */
export function restorePhysicalPromotionBases(
  definitions: readonly PartDefinition[],
  promotedPartIds: readonly string[],
): readonly PartDefinition[] {
  const requested = new Set(promotedPartIds);
  const restored = new Set<string>();
  const projection = definitions.map((definition) => {
    if (!requested.has(definition.id)) return definition;
    const base = getMeasuredPhysicalPromotionBaseDefinition(definition.id);
    if (base === undefined) {
      throw new Error(
        `Historical catalog projection requested pre-promotion truth for ${definition.id}, but no exact physical-promotion base is retained.`,
      );
    }
    restored.add(definition.id);
    return base;
  });
  const missing = promotedPartIds.filter((id) => !restored.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Historical catalog projection did not contain requested promoted part ids: ${missing.join(", ")}.`,
    );
  }
  return projection;
}
