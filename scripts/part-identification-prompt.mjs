import { createHash } from "node:crypto";

import { COLOR_DEFINITIONS } from "../packages/catalog/src/colors.ts";

/**
 * The LDraw colour codes the printed inventory of set 21066 uses, in code order.
 *
 * Naming them in the prompt is not a convenience. The grader in
 * `part-identification-score.mjs` compares the free-text colour against the
 * element's LDraw display name, so asking for a "plain colour name" and then
 * demanding "Light Bluish Gray" measured wording rather than sight: over 273
 * drawings, 65 of 136 self-contradictions were colour-only, and two thirds of
 * those were a synonym or a dropped shade — "light gray", "gray", "blue" — with
 * shape and stud size already agreeing. Lesson: grading a free-text answer
 * against a controlled vocabulary measures wording, not sight, unless the prompt
 * names the vocabulary.
 *
 * The remaining third are real: "dark gray" for a Black brick, "light blue" for
 * Sand Blue. Those must keep failing, so the grader is untouched — only the call
 * is told which names it is being graded in.
 *
 * Colour 47 (transparent) is in the set but has no catalog definition, so the
 * grader can never verify it either way and it is left out rather than invented.
 */
const BOOKLET_PALETTE_LDRAW_CODES = Object.freeze([
  0, 1, 2, 4, 14, 15, 25, 71, 72, 272, 321, 322, 379,
]);

const DISPLAY_NAME_BY_LDRAW_CODE = new Map(
  COLOR_DEFINITIONS.map(({ ldrawCode, displayName }) => [ldrawCode, displayName]),
);

/** Exactly the names the grader compares against, so the two cannot drift apart. */
export const PART_IDENTIFICATION_COLOUR_VOCABULARY = Object.freeze(
  BOOKLET_PALETTE_LDRAW_CODES.map((ldrawCode) => {
    const displayName = DISPLAY_NAME_BY_LDRAW_CODE.get(ldrawCode);
    if (displayName === undefined) {
      throw new Error(
        `The vision prompt names LDraw colour ${ldrawCode}, which the catalog palette does not define, so the grader could never verify an answer given in it. Add the colour to COLOR_DEFINITIONS as a catalog-truth change, or drop the code from BOOKLET_PALETTE_LDRAW_CODES.`,
      );
    }
    return displayName;
  }),
);

export const PART_IDENTIFICATION_PROMPT = [
  "Each image shows one LEGO part drawing from an instruction booklet (QUERY), and",
  "numbered CANDIDATE drawings taken from the same booklet's own parts list.",
  "Every drawing uses the same viewing angle and drawing style; only the printed size differs.",
  "The parts list contains every part in the set, so the query part is usually among the",
  "candidates — answer 0 only when none of them could be the same part.",
  "First describe the QUERY part on its own, then say which candidate is the same part.",
  "For curved, corner, L-shaped, wedge, or cutout parts, studsLong and studsWide are the maximum",
  "stud-grid bounding-box dimensions, not the number of occupied studs along one narrow arm.",
  `The set is built from exactly these ${PART_IDENTIFICATION_COLOUR_VOCABULARY.length} colours:`,
  `${PART_IDENTIFICATION_COLOUR_VOCABULARY.join(", ")}.`,
  "Give colour as one of those names, copied exactly, and pick the precise shade rather than the",
  "family: Light Bluish Gray and Dark Bluish Gray are different colours, so are Blue, Dark Blue,",
  "Sand Blue, Medium Azure and Dark Azure, and a grey-looking part is never Black.",
  'Reply with one line of JSON per image: {"kind":"<brick|plate|tile|slope|wedge|arch|round|technic|other>",',
  '"studsLong":<integer or 0>,"studsWide":<integer or 0>,"colour":"<one name from the list above>",',
  '"pick":<candidate number, or 0>,"confidence":<0..1>}',
  "Shape, bounding stud dimensions, and colour must all match for a candidate to be the same part.",
].join(" ");

export const PART_IDENTIFICATION_PROMPT_DIGEST = `sha256:${createHash("sha256").update(PART_IDENTIFICATION_PROMPT).digest("hex")}`;
