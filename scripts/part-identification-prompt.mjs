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

/**
 * The relations the call may declare between the query drawing and the candidate it picked.
 *
 * These are relations, not properties. "This part is a wedge" is a property and
 * already has a field; "the query is this candidate's mirror image" is a
 * relation, and it is the thing the six-field schema could not say. Naming
 * relations is what stops the list becoming a register of yesterday's bugs: a
 * new failure mode arrives as `other` plus a sentence, and only earns a value of
 * its own once a run shows the `other` notes clustering.
 *
 * Values the grounding pass measured as absent from these cards are deliberately
 * not here. Every query drawing is cut from the parts-list callout strip and is
 * isolated by construction — ink touches the panel border on 0 of 269 queries —
 * so an `occluded` value would have had no true instance to fire on and 269
 * chances to fire wrongly. Occlusion remains sayable through `other`.
 *
 * `size` and `colour` are corrections, not doubts: they say the picked candidate
 * is visibly a different length or shade from the query, which for LEGO means it
 * is a different element. Doubt about which candidate to choose belongs in
 * `alsoCouldBe`, and the prompt says so, because 192 of 269 cards carry two
 * candidates of the same family and colour differing only in stud count — a
 * vocabulary value that fired on doubt would fire on most of the book.
 */
export const PART_IDENTIFICATION_DIFFERENCES = Object.freeze([
  "nothing",
  "mirrored",
  "size",
  "colour",
  "view",
  "detail",
  "not-on-card",
  "other",
]);

/** How long a written observation may be, in characters. */
export const PART_IDENTIFICATION_MAX_NOTE_LENGTH = 300;

export const PART_IDENTIFICATION_PROMPT = [
  "Each image shows one LEGO part drawing from an instruction booklet (QUERY), and",
  "numbered CANDIDATE drawings taken from the same booklet's own parts list.",
  "Nearly every drawing uses the same viewing angle and drawing style and differs only in printed",
  "size, but a few parts are drawn from underneath or at another attitude, so look rather than assume.",
  "The parts list contains every part in the set, so the query part is usually among the",
  "candidates — answer pick 0 only when none of them could be the same part.",
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
  '"pick":<candidate number, or 0>,"alsoCouldBe":<candidate number, or 0>,',
  `"differsFromPick":"<${PART_IDENTIFICATION_DIFFERENCES.join("|")}>","confidence":<0..1>`,
  'and optionally "note":"<one short sentence>"}',
  "Shape, bounding stud dimensions, and colour must all match for a candidate to be the same part.",

  "differsFromPick says how the QUERY differs from the candidate you picked. It is a difference you",
  "can see between the two drawings, never a doubt about which candidate to choose.",
  "nothing — the query is that candidate. This is the usual answer.",
  "mirrored — the query is that candidate's mirror image, so the opposite hand is the right part.",
  "size — the same shape, a different stud count or length.",
  "colour — the same mould, a different printed shade.",
  "view — the two drawings are from different sides or attitudes, one from underneath or turned over,",
  "so their outlines differ without the part differing.",
  "detail — the outlines agree but one small feature differs: a stud on a side face, a centre stud,",
  "a clip, a notch, a hole.",
  "other — something else; say what in note.",
  "not-on-card — no candidate is this part. Use exactly this value when pick is 0, and only then.",
  "Being unsure which candidate to pick is not a difference: answer nothing and use alsoCouldBe.",

  "alsoCouldBe is a second candidate number that would be an equally good answer, or 0 when there is",
  "no real second choice. It must differ from pick. Use it when two candidates are genuinely hard to",
  "separate — two drawings of the same shape in nearly the same shade, or two lengths you cannot",
  "count apart — and leave it 0 when one candidate is clearly right.",

  // Three wordings of this block were run against the same fixed 24 cards, and
  // the difference between them is entirely in what the model wrote when it had
  // nothing to say. Leaning on silence — saying outright that an empty note is
  // the expected answer and that a merely-true sentence is worse than none —
  // wrote on 6 of 24 with every sentence checkable and correct. A wording that
  // only listed what qualifies wrote on 13 of 24 and produced the run's one
  // false note, on card-0029: "candidate 4 is the mirror ... drawn from
  // underneath" when candidate 4 plainly shows its studs and mirrors candidate 2
  // rather than the pick. A wording that named the cases up front wrote on 9 and
  // twice called a Black candidate "dark bluish gray" inside the prose, which
  // the colour field would have caught but note text is not graded on.
  //
  // A specific claim that is false costs more than an absent one, because the
  // whole point of the field is that a reader can act on it. Fewer notes with
  // everything real is the better outcome, and silence lost nothing: it still
  // named the mirror candidate on the chirality card, still reported the
  // underside view, and still separated the two bar lengths in both directions.
  "note is optional, and on a typical card you leave it out. Omitting it is the expected answer,",
  "not a failure to engage: most drawings in this booklet are ordinary, the pick speaks for itself,",
  "and there is nothing about them a reader needs told. Expect to write nothing on most images, and",
  "nothing at all across a whole batch when the whole batch is ordinary — do not go looking for one",
  "image to comment on because the others had nothing.",
  "Writing something merely true is worse than writing nothing. A note is read as a signal that this",
  "image was unusual, so a true but unremarkable sentence spends that signal and teaches the reader",
  "to skip the notes that matter.",
  "The test is not whether you can say something about the image. It is whether a careful reader,",
  "seeing your pick and your other fields, would misread this image without your sentence. If they",
  "would not, leave note out however accurate the sentence is.",
  "Things that pass that test, every one of them seen on real cards from this booklet:",
  "two candidates are mirror images of each other and you had to choose a hand;",
  "the query is drawn from underneath, so no studs are visible and your stud numbers are read off the",
  "rim rather than counted;",
  "two candidates are the same part at different printed sizes, or the same mould in two shades;",
  "you could not separate two candidates and picked the more likely;",
  "the query shows a feature that no candidate has.",
  "Things that fail it: restating kind, size or colour, which already have their own fields;",
  "describing an unremarkable part; saying the drawing is clear or the match obvious;",
  "hedging about a pick you are confident in.",
  'When one does pass, name the specific thing you saw — "candidate 3 is the mirror of the query,',
  'its stepped edge is on the left" — not a feeling — "something looks off".',
  "Two cases do require a note, because there the note is the only place the reason can exist:",
  "when differsFromPick is anything other than nothing, and when pick is 0.",
  "One more is required and is checked: if two candidates are mirror images of each other and you",
  "pick one of them, the note must name the mirror candidate by its number, as in",
  '"candidate 2 is the mirror".',
  `Keep note on the one line, under ${PART_IDENTIFICATION_MAX_NOTE_LENGTH} characters, with no braces and no line breaks.`,
].join(" ");

export const PART_IDENTIFICATION_PROMPT_DIGEST = `sha256:${createHash("sha256").update(PART_IDENTIFICATION_PROMPT).digest("hex")}`;
