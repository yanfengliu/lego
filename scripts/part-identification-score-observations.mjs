import { candidatesNamedInNote, mirrorTwinCandidate } from "./part-identification-mirror-pairs.mjs";

function countBy(values) {
  const tally = {};
  for (const value of values) tally[value] = (tally[value] ?? 0) + 1;
  return tally;
}

/** How many rows of written observation the score file will carry. */
const MAX_REPORTED_NOTES = 200;

/**
 * Everything the call said beyond the six description fields, printed.
 *
 * `notes` is the point of it. The observation field is optional so that a
 * written note means the call had something to say, and that only holds if the
 * ones written are read — a report that counted them and threw the sentences
 * away would be the collect-and-ignore failure again, one indirection further
 * out. `notesWritten` sits beside the array so truncation can never masquerade
 * as silence.
 *
 * Two mirror numbers, kept apart because they measure different things and one
 * of them was being read as the other.
 *
 * `handedness` is the hand, decided from the card's own pixels. Four picks in
 * the previous run sat on a card that displayed both hands of a mirror pair,
 * where the description check accepts either twin, so a swap was invisible end
 * to end.
 *
 * `mirrorPairAwareness` is only that the answer named the twin's candidate
 * number in its note. That was once treated as verifying the hand and it does
 * not: the twin's number is the same number whichever hand was picked, so the
 * swapped pick satisfies it word for word. The count is kept because noticing
 * the pair is worth knowing about, under a name that says what it is.
 */
export function readWhatTheCallObserved(match, answers, claims, names, cards, handedness = null) {
  const notes = [];
  const handedRows = [];
  const differences = [];
  let answered = 0;
  let secondChoicesOffered = 0;
  let secondChoicesTaken = 0;

  for (const cluster of match.clusters) {
    const answer = answers?.[cluster.clusterIndex] ?? null;
    if (answer === null || answer === undefined) continue;
    answered += 1;
    differences.push(answer.differsFromPick ?? "absent");
    const claim = claims.get(cluster.members[0]) ?? null;
    const cardId = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
    const displayed = cards?.[cardId]?.candidateElementIds ?? null;
    const pickedElement =
      Array.isArray(displayed) && answer.pick >= 1 && answer.pick <= displayed.length
        ? displayed[answer.pick - 1]
        : null;
    const secondElement =
      Array.isArray(displayed) && answer.alsoCouldBe >= 1 && answer.alsoCouldBe <= displayed.length
        ? displayed[answer.alsoCouldBe - 1]
        : null;
    if (secondElement !== null) {
      secondChoicesOffered += 1;
      if (claim?.elementId === secondElement && claim.elementId !== pickedElement) {
        secondChoicesTaken += 1;
      }
    }

    const twin = mirrorTwinCandidate(displayed, names, answer.pick);
    if (twin !== 0) {
      const verdict =
        (handedness instanceof Map ? handedness.get(cardId) : handedness?.[cardId]) ?? null;
      handedRows.push({
        clusterIndex: cluster.clusterIndex,
        lead: cluster.lead,
        pick: answer.pick,
        pickedName: pickedElement === null ? null : (names.get(pickedElement)?.name ?? null),
        mirrorCandidate: twin,
        mirrorName: names.get(displayed[twin - 1])?.name ?? null,
        namedTheMirror: candidatesNamedInNote(answer.note).has(twin),
        handRead: verdict?.decided === true ? verdict.hand : null,
        handAgreesWithPick: verdict?.decided === true ? verdict.hand === answer.pick : null,
        handReason: verdict?.decided === true ? null : (verdict?.reason ?? "no-verdict"),
        queryAgainstPick: verdict?.queryAgainstPick ?? null,
        queryAgainstTwin: verdict?.queryAgainstTwin ?? null,
        mirroredAgainstTwin: verdict?.mirroredAgainstTwin ?? null,
        queryAsymmetry: verdict?.queryAsymmetry ?? null,
        margin: verdict?.margin ?? null,
        picked: claim?.picked ?? null,
      });
    }

    if (typeof answer.note === "string" && answer.note.length > 0) {
      notes.push({
        clusterIndex: cluster.clusterIndex,
        lead: cluster.lead,
        pick: answer.pick,
        alsoCouldBe: answer.alsoCouldBe,
        differsFromPick: answer.differsFromPick,
        confidence: answer.confidence,
        picked: claim?.picked ?? null,
        pickedName: pickedElement === null ? null : (names.get(pickedElement)?.name ?? null),
        note: answer.note,
      });
    }
  }

  return {
    answered,
    notesWritten: notes.length,
    byDifference: countBy(differences),
    secondChoicesOffered,
    secondChoicesTaken,
    handedness: {
      picksWhoseMirrorWasDisplayed: handedRows.length,
      picksWhoseHandWasRead: handedRows.filter(({ handRead }) => handRead !== null).length,
      picksTheHandUpheld: handedRows.filter(({ handAgreesWithPick }) => handAgreesWithPick === true)
        .length,
      picksTheHandRefuted: handedRows.filter(
        ({ handAgreesWithPick }) => handAgreesWithPick === false,
      ).length,
      picksTheCardCouldNotSeparate: handedRows.filter(({ handRead }) => handRead === null).length,
      note: "A pick whose mirror twin sits on the same card cannot be separated from that twin by kind, stud size and colour. The hand is decided from the card's own pixels — the query silhouette against each hand, and against each hand mirrored — and a pick the card cannot separate stays unpromoted rather than being guessed.",
      rows: handedRows,
    },
    mirrorPairAwareness: {
      picksWhoseMirrorWasDisplayed: handedRows.length,
      picksThatNamedTheMirror: handedRows.filter(({ namedTheMirror }) => namedTheMirror).length,
      note: "Only that the answer named the twin's candidate number in its note. This is mirror-pair awareness and not a handedness check: the twin's number is the same number whichever hand was picked, so a swapped pick with the note \"candidate 1 is the mirror\" satisfies it exactly as well as the correct answer. It decides nothing.",
    },
    notes: notes.slice(0, MAX_REPORTED_NOTES),
  };
}
