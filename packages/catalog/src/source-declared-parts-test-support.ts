import { getPartDefinition, type CollisionPrimitive, type PartDefinition } from "./index.js";
import { ADMITTED_SOURCE_PART_ROWS_A } from "./source-declared-parts-test-rows-a.ts";
import { ADMITTED_SOURCE_PART_ROWS_B } from "./source-declared-parts-test-rows-b.ts";

/**
 * What the thirty fully measured catalog parts are, written out rather than recomputed.
 *
 * These are facts about real parts: the extents come from the exact expanded
 * LDraw closure, the collision column count from its per-column height field at
 * 1 LDU, and the connector counts from an authored connector source
 * carried through the per-part frame — Builder-derived records for eight parts
 * and the LDCad shadow library's snap metas for twenty-two. Four of the LDCad-sourced
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
export const ADMITTED_SOURCE_PART_ROWS = [
  ...ADMITTED_SOURCE_PART_ROWS_A,
  ...ADMITTED_SOURCE_PART_ROWS_B,
] as const;

/** The three plate-lattice parts whose clutch cells Builder could not supply. */
export const BUILDER_MISSING_PLATE_LATTICE_PART_IDS = [
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
] as const;

export function requireAdmittedPart(id: string): PartDefinition {
  const part = getPartDefinition(id);
  if (part === undefined) throw new Error(`the catalog is missing admitted part ${id}`);
  return part;
}

export const bodyBoxes = (
  part: PartDefinition,
): readonly Extract<CollisionPrimitive, { kind: "box" }>[] =>
  part.collision.primitives.filter(
    (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
      primitive.kind === "box" && primitive.tag === "body",
  );
