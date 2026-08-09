import { createHash } from "node:crypto";

/**
 * The vision call that proposes WHERE this step's already-identified pieces go.
 *
 * It is deliberately not the part-identification call one level over. That call
 * asks what a drawing is; this one is told what the drawings are — the action
 * ledger already names every piece of every printed step and its catalog id —
 * and asks only where each one lands. Narrowing the question is the whole point:
 * the enumerate-and-score search has to consider 240 x 334 places for two pieces
 * of printed step 4, and a person reading the same panel does not consider any
 * of them.
 *
 * Three rules shape every field below, and each one was paid for.
 *
 * 1. Ask in a vocabulary the model can answer. It cannot measure LDU and a field
 *    named `positionLdu` would collect confident fiction. It can say which way a
 *    plate points on the page, which piece it lies on, and which side of that
 *    piece it sits. Every field here is a relation between two things drawn in
 *    the same picture, and the arithmetic — projecting the model's lattice,
 *    turning "up and to the right" into a basis vector, turning "on top of" into
 *    one plate of height — belongs to the converter.
 *
 * 2. The schema offers an escape and the prompt says when to take it. The
 *    booklet's rotate-the-model icon went unconsumed for weeks partly because
 *    nothing ever asked about the viewpoint, so `viewpoint` is asked first and
 *    `cannot-tell` is a first-class answer everywhere. A refusal costs one
 *    candidate set; a confident wrong reading costs a wrong build.
 *
 * 3. The verifier stays the authority. Nothing said here places anything. The
 *    reading is converted to a bounded candidate set and the printed contour
 *    still ranks it, so a reading that cannot be verified is refused rather than
 *    believed.
 */

/**
 * The directions a thing can point on the page.
 *
 * A step panel is an axonometric drawing, so the model's two ground directions
 * always project into two of the four diagonal quadrants and never along the
 * page axes; stacking projects straight up the page. Naming the four diagonals
 * is therefore naming the answer set exactly, and it is a vocabulary anyone can
 * read off a picture without measuring anything. The converter maps each name
 * to whichever of the fitted basis vectors +a, -a, +b, -b projects nearest it,
 * which is why the names have to be about the page and never about the model.
 */
export const PANEL_PLACEMENT_DIRECTIONS = Object.freeze([
  "up-and-right",
  "down-and-right",
  "down-and-left",
  "up-and-left",
  "straight-up",
  "straight-down",
  "cannot-tell",
]);

/**
 * How a new piece meets the piece it is placed against.
 *
 * `on-top-of` and `underneath` are one plate of height apart and that single
 * plate is exactly the degeneracy the printed panel cannot resolve: printed step
 * 4's two best candidates are separated by 0.0011 and differ by one stud across
 * and one plate down. So this is the field that has to earn its place, and it is
 * the one a person answers instantly.
 *
 * `beside` is level with the anchor and touching it — two plates side by side on
 * the same surface. `bridges` is for a piece that spans a gap and rests on the
 * anchor at only one end; it exists because the alternative was the model
 * choosing `on-top-of` for a piece that mostly is not.
 */
export const PANEL_PLACEMENT_RELATIONS = Object.freeze([
  "on-top-of",
  "underneath",
  "beside",
  "bridges",
  "cannot-tell",
]);

/** How long a written observation may be, in characters. */
export const PANEL_PLACEMENT_MAX_NOTE_LENGTH = 300;

/** Most studs a reading may claim overlap between a piece and its anchor. */
export const PANEL_PLACEMENT_MAX_OVERLAP_STUDS = 64;

export const PANEL_PLACEMENT_PROMPT = [
  "This image is one numbered step from a printed LEGO instruction booklet.",
  "The box at the top lists the new pieces this step adds, each with its own 1x or Nx count.",
  "The large drawing below is the model with those pieces already in place, and the pieces added",
  "at this step are outlined in yellow. Everything not inside a yellow outline was built earlier.",
  "The yellow line is often broken or open where a new piece disappears behind an older one; a",
  "broken outline is normal and is not a reason to refuse.",

  "You are NOT being asked what the pieces are. They are already known and they are listed below,",
  "each with an id, a colour and a stud size. You are being asked only WHERE each one goes,",
  "and every answer is a relation between two things drawn in this same picture.",
  "Do not give coordinates, millimetres, LDU, or any measurement. There is no scale in this picture",
  "you could measure against and a number of that kind would be invented. Count studs, name sides,",
  "and say what touches what.",

  "Answer first about the picture as a whole, then once about each listed piece.",
  'The first line is the panel line and its id is exactly "panel".',

  'Panel line: {"id":"panel","viewpoint":"<from-above|from-underneath|cannot-tell>",',
  '"newPieceOutlines":<how many separate yellow outlines you can count, or 0>}',

  "viewpoint is which side of the model you are looking at. From above you see round studs standing",
  "proud on the top faces. From underneath you see the hollow tubes and the ribbing of the plates'",
  "undersides, and no studs at all. Many steps in this booklet are drawn from underneath and a small",
  "round icon of a model with two curved arrows around it marks where the booklet turned it over.",
  "Answer what this picture shows, not what the icon says: the icon marks the turn, the drawing is",
  "the evidence. Say cannot-tell if the assembly shows neither studs nor tubes clearly.",

  'Piece line: {"id":"<the piece id given below>","visible":<true|false>,',
  `"longAxis":"<${PANEL_PLACEMENT_DIRECTIONS.join("|")}|square>",`,
  '"anchorId":"<another piece id from below, or an earlier-piece description, or null>",',
  `"relation":"<${PANEL_PLACEMENT_RELATIONS.join("|")}>",`,
  `"side":"<${PANEL_PLACEMENT_DIRECTIONS.join("|")}|centred>",`,
  '"overlapStuds":<whole number of studs of this piece that sit over the anchor, or null>,',
  '"confidence":<0..1>}',
  'and, only when a field above is "cannot-tell" or visible is false,',
  '"cannotTell":"<one sentence saying what stopped you>",',
  'and optionally "note":"<one short sentence>".',

  "visible is whether you can actually see this piece in the large drawing. A piece can be listed and",
  "then be entirely hidden behind an older part, or drawn so small at this angle that you cannot tell",
  "it from its neighbour. Answer false and say so in cannotTell rather than guessing where it went.",
  "false is a correct answer and it costs nothing; a guessed placement costs a wrong model.",

  "longAxis is the direction the piece's long side runs on the page, as you would point at it: a plate",
  "whose studs run in a line from the lower left of the picture toward the upper right is up-and-right.",
  "up-and-right and down-and-left are the same line, so pick the end that is furthest from the middle",
  "of the model — the direction the piece points away from the model's body. For a piece that is as",
  "wide as it is long, answer square. Ordinary LEGO drawings never run a plate's long side straight up",
  "or straight down the page, so straight-up and straight-down are almost always wrong here.",

  "anchorId is the one other piece this piece is placed against — the thing you would name if someone",
  "asked what it is sitting on. Prefer a piece from this same step's list and give its id, because",
  "those are the pieces you have been told about. If it sits on a piece that was already built, give a",
  "description instead of an id, in exactly this form and nothing else:",
  '"built:<colour> <long>x<wide>" — for example "built:Green 4x2" or "built:Black 6x6".',
  "Colour is one of the colours named in the piece list, or Black for the unnamed dark parts, and the",
  "two numbers are the stud counts of the piece you are naming, long side first. Count them off the",
  "drawing. If you cannot count them because the piece is mostly hidden, answer anchorId null and say",
  "so in cannotTell — a made-up size resolves to the wrong part of the model and is worse than nothing.",

  "relation is how this piece meets its anchor.",
  "on-top-of — this piece is one plate higher and covers part of the anchor's upper surface.",
  "underneath — this piece is one plate lower and the anchor covers part of it.",
  "beside — the two are at the same height, side by side, touching along an edge.",
  "bridges — this piece spans a gap and rests on the anchor at one end only.",
  "This is the field that matters most and it is the one the printed picture answers best, because a",
  "plate lying on top of another casts a visible step at its edge and a plate at the same height does",
  "not. Look at the edge where the two meet before answering.",
  "Remember which way up the picture is: when the panel is drawn from underneath, a piece that is",
  "higher in the finished model is the one drawn further away from you, not nearer.",

  "side is where this piece sits relative to the anchor, as a direction on the page from the middle of",
  "the anchor to the middle of this piece. Answer centred when this piece sits squarely over the",
  "anchor with no clear offset either way.",

  "overlapStuds is how many of this piece's studs sit over the anchor, counted off the drawing. Give",
  "it only when you can actually count them. null is the expected answer whenever the overlap runs",
  "behind something, and a counted 3 is worth more than a guessed 4.",

  "note is optional and on a typical piece you leave it out. Omitting it is the expected answer, not a",
  "failure to engage: most pieces in this booklet sit in the obvious place and there is nothing about",
  "them a reader needs told. Expect to write nothing on most pieces, and nothing at all across a whole",
  "panel when the whole panel is ordinary. Do not go looking for one piece to comment on because the",
  "others had nothing.",
  "Writing something merely true is worse than writing nothing. A note is read as a signal that this",
  "piece was unusual, so a true but unremarkable sentence spends that signal and teaches the reader to",
  "skip the notes that matter.",
  "The test is not whether you can say something about the piece. It is whether a careful reader,",
  "seeing your other fields, would place this piece wrongly without your sentence. If they would not,",
  "leave note out however accurate the sentence is.",
  "Things that pass that test: the piece is drawn exploded, floating away from its seat with an arrow;",
  "two pieces in the list look identical and you had to decide which is which; the yellow outline",
  "encloses more or fewer pieces than the list has; the piece is symmetric end to end so its longAxis",
  "could be read either way; you can see the piece but not what it rests on.",
  "Things that fail it: restating the fields; describing an ordinary plate; saying the drawing is",
  "clear; hedging about an answer you are confident in.",
  "cannotTell is different from note and is required rather than optional: whenever visible is false or",
  "any field is cannot-tell, say in one sentence what in the picture stopped you.",

  "Every id must be one from the list below, used exactly once, plus the panel line.",
  `Keep each line under ${PANEL_PLACEMENT_MAX_NOTE_LENGTH} characters of free text, on one line, with`,
  "no line breaks inside a string. Reply with one line of JSON per id and nothing else — no prose, no",
  "code fences, no commentary before or after.",
].join(" ");

export const PANEL_PLACEMENT_PROMPT_DIGEST = `sha256:${createHash("sha256")
  .update(PANEL_PLACEMENT_PROMPT)
  .digest("hex")}`;

/**
 * The per-panel half of the instruction: what this step adds and what is already
 * standing. Digested separately from the fixed prompt above, because it changes
 * every panel by construction and folding it into the prompt digest would make
 * that digest useless for saying which prompt was asked.
 */
export function panelPlacementPieceBrief(input) {
  const lines = [`This step adds ${input.pieces.length} piece(s):`];
  for (const piece of input.pieces) {
    lines.push(
      `  ${piece.id} — ${piece.colour} ${piece.studsLong}x${piece.studsWide} ${piece.shape}`,
    );
  }
  if (input.built.length > 0) {
    lines.push(
      `Already built and drawn without a yellow outline, for naming as an anchor (${input.built.length} piece(s)):`,
    );
    for (const piece of input.built) {
      lines.push(`  built:${piece.colour} ${piece.studsLong}x${piece.studsWide} — ${piece.shape}`);
    }
  }
  return lines.join("\n");
}
