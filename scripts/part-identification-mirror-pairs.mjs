/**
 * Which candidates on a card are the two hands of one part, and what a note said about them.
 *
 * Everything here is derived from the published part names and the answer text,
 * which is deliberately all it can do. Finding that a card shows both hands is a
 * fact about the card; deciding which hand the drawing is takes pixels, and
 * lives in `part-identification-handedness.mjs`. Keeping the two apart is the
 * whole correction: this file was once treated as if it settled the second
 * question, and it cannot.
 */

/**
 * Which numbered candidate on this card, if any, is the mirror twin of another.
 *
 * A left and a right wedge plate are two different elements whose published
 * names differ by one word, so the twin is found by swapping that word and
 * looking for the result among the same card's other candidates. Nothing the
 * model wrote enters this: it is a fact about the card, computable before any
 * answer exists, which is what makes it a check rather than a second opinion.
 *
 * The twin has to carry the same colour code as well as the mirrored name,
 * because that is the exact condition under which the description check cannot
 * discriminate. Two hands printed in different shades are already separated by
 * the colour comparison, and demanding a mirror note there would refuse picks
 * over an ambiguity that does not exist.
 */
const normalizePartName = (name) =>
  typeof name === "string"
    ? name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()
    : null;

const swapHandWord = (name) =>
  name.replace(/\b(?:left|right)\b/giu, (word) =>
    word.toLowerCase() === "left" ? "right" : "left",
  );

export function mirrorTwinCandidate(displayed, names, candidateNumber) {
  if (!Array.isArray(displayed) || !(names instanceof Map)) return 0;
  const self = names.get(displayed[candidateNumber - 1]);
  if (typeof self?.name !== "string" || !/\b(?:left|right)\b/iu.test(self.name)) return 0;
  const wanted = normalizePartName(swapHandWord(self.name));
  for (const [index, elementId] of displayed.entries()) {
    if (index === candidateNumber - 1) continue;
    const other = names.get(elementId);
    if (normalizePartName(other?.name) !== wanted) continue;
    if (String(other?.colorId ?? "") !== String(self.colorId ?? "")) continue;
    return index + 1;
  }
  return 0;
}

/**
 * Every card where the answer's pick has its own mirror twin displayed beside it.
 *
 * Computed before any pixel is read, so the expensive half — inflating a card
 * raster — is only paid where there is a mirror question to answer. It is also
 * the exact population the handedness numbers are reported over, which keeps the
 * denominator of "how many hands were checked" from drifting away from the set
 * of hands that needed checking.
 */
export function mirrorPairedPicks(match, answers, names, cards) {
  const pairs = [];
  for (const cluster of match.clusters) {
    const answer = answers?.[cluster.clusterIndex] ?? null;
    if (answer === null || answer === undefined) continue;
    const cardId = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
    const displayed = cards?.[cardId]?.candidateElementIds;
    if (!Array.isArray(displayed)) continue;
    const pick = Number(answer.pick ?? 0);
    if (!Number.isInteger(pick) || pick < 1 || pick > displayed.length) continue;
    const twin = mirrorTwinCandidate(displayed, names, pick);
    if (twin === 0) continue;
    pairs.push({
      cardId,
      clusterIndex: cluster.clusterIndex,
      candidateCount: displayed.length,
      pick,
      twin,
    });
  }
  return pairs;
}

/**
 * The candidate numbers a written note points at, as numbers and not as prose.
 *
 * Only digits introduced by the word "candidate" count, because a note is full
 * of other numbers — "6 x 2", "1 x 1" — and a bare integer scan would let a
 * stud size stand in for a candidate reference. The prompt asks for exactly this
 * form, so the check reads the sentence the call was told to write.
 *
 * What this measures is mirror-pair awareness: that the answer noticed the two
 * hands are both on the card and said so. It is not a handedness check and was
 * proved not to be one — the twin's number is the same number whichever hand was
 * picked, so a swapped pick with the note "candidate 1 is the mirror" satisfies
 * it exactly as well as the correct answer does. It is reported under its own
 * name and decides nothing; `handednessFromCard` decides the hand.
 */
const JOINERS = new Set([",", "and", "or", "&", "/", "#", "+"]);

export function candidatesNamedInNote(note) {
  if (typeof note !== "string") return new Set();
  const tokens = note.toLowerCase().match(/\d+|[a-z]+|[^\sa-z\d]/gu) ?? [];
  const named = new Set();
  for (const [index, token] of tokens.entries()) {
    if (token !== "candidate" && token !== "candidates") continue;
    for (let at = index + 1; at < tokens.length; at += 1) {
      const next = tokens[at];
      if (/^\d+$/u.test(next)) {
        named.add(Number(next));
        continue;
      }
      if (JOINERS.has(next)) continue;
      break;
    }
  }
  return named;
}
