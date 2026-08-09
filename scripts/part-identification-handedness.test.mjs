import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CARD_LAYOUT,
  MIN_HANDEDNESS_MARGIN,
  MIN_QUERY_ASYMMETRY,
  cardHeightForLayout,
  cardWidthFor,
  handednessFromCard,
  handednessVerdicts,
  panelBox,
} from "./part-identification-handedness.mjs";
import { chiralCard } from "./part-identification-card-test-fixture.mjs";
import { mirrorPairedPicks } from "./part-identification-mirror-pairs.mjs";
import { visionPick } from "./part-identification-score.mjs";

/**
 * The check that decides which hand a booklet drawing is, from the drawing.
 *
 * Its predecessor asked the model to name the mirror twin's candidate number in
 * its note and promoted the pick when it did, and that has no discriminating
 * power at all against a swapped hand: the twin's number is the same number
 * whichever hand was picked. It was refuted by execution rather than by
 * argument — the swapped pick on card-0039 with the note "candidate 1 is the
 * mirror" came back `vision-kept` carrying element 6392747, the *left* wedge
 * plate, exactly as the correct answer did.
 *
 * So the first thing these tests do is repeat that refutation and require the
 * opposite outcome. A check that cannot fail on a swapped hand is not a check,
 * and the way to know this one can is to feed it the swap.
 */

const CARD_ID = "card-0000";
const CLUSTER = {
  clusterIndex: 0,
  lead: "wedge.png",
  members: [0],
  pieces: 1,
  candidates: [
    { elementId: "6392746", total: 0.07 },
    { elementId: "6392747", total: 0.21 },
  ],
};
const NAMES = new Map([
  ["6392746", { name: "Wedge Plate 6 x 2 Right", colorId: 15 }],
  ["6392747", { name: "Wedge Plate 6 x 2 Left", colorId: 15 }],
]);
const CARDS = { [CARD_ID]: { candidateElementIds: ["6392746", "6392747"] } };
const answerWith = (extra) => ({
  0: {
    kind: "wedge",
    studsLong: 6,
    studsWide: 2,
    colour: "White",
    pick: 1,
    alsoCouldBe: 0,
    differsFromPick: "nothing",
    confidence: 0.9,
    ...extra,
  },
});

const verdictsFor = (bytes, answers) =>
  handednessVerdicts(
    mirrorPairedPicks({ clusters: [CLUSTER] }, answers, NAMES, CARDS),
    new Map([[CARD_ID, bytes]]),
  );

describe("the card layout the reader and the renderer share", () => {
  // Pinned against the literals `drawCard` used before the two were given one
  // declaration. A drift here does not throw: it reads an empty rectangle and
  // reports the hand as unreadable, which looks like a hard card rather than a
  // broken one.
  it("reproduces the exact panel rectangles the cards were drawn with", () => {
    expect(cardWidthFor(6)).toBe(1920);
    expect(cardWidthFor(2)).toBe(900);
    expect(cardHeightForLayout()).toBe(756);
    expect(panelBox(0, 6)).toEqual({ left: 0, top: 34, width: 1920, height: 296 });
    expect(panelBox(1, 6)).toEqual({ left: 6, top: 440, width: 308, height: 284 });
    expect(panelBox(6, 6)).toEqual({ left: 1606, top: 440, width: 308, height: 284 });
    expect(CARD_LAYOUT.cell).toBe(320);
  });
});

describe("reading the hand off a card", () => {
  it("separates the two hands of one drawing across a change of print scale", () => {
    const verdict = handednessFromCard({
      bytes: chiralCard(),
      candidateCount: 2,
      pick: 1,
      twin: 2,
    });
    expect(verdict.decided).toBe(true);
    expect(verdict.hand).toBe(1);
    expect(verdict.queryAgainstPick).toBeGreaterThan(0.9);
    expect(verdict.queryAgainstTwin).toBeLessThan(0.6);
    expect(verdict.margin).toBeGreaterThan(MIN_HANDEDNESS_MARGIN);
    // The corroborating half: flipping the query is what makes it match the
    // twin, which is the statement "these two are drawn as reflections".
    expect(verdict.mirroringImprovesTwinMatch).toBe(true);
  });

  it("names the other hand when the query is the other hand", () => {
    const verdict = handednessFromCard({
      bytes: chiralCard({ query: "left" }),
      candidateCount: 2,
      pick: 1,
      twin: 2,
    });
    expect(verdict.decided).toBe(true);
    expect(verdict.hand).toBe(2);
  });

  it("refuses to decide a drawing that is its own mirror", () => {
    const verdict = handednessFromCard({
      bytes: chiralCard({ symmetric: true }),
      candidateCount: 2,
      pick: 1,
      twin: 2,
    });
    expect(verdict.decided).toBe(false);
    expect(verdict.hand).toBeNull();
    expect(verdict.reason).toBe("query-is-its-own-mirror");
    expect(verdict.queryAsymmetry).toBeLessThan(MIN_QUERY_ASYMMETRY);
  });

  it("refuses a panel it cannot read, and a card whose layout is not the renderer's", () => {
    expect(
      handednessFromCard({
        bytes: chiralCard({ blank: true }),
        candidateCount: 2,
        pick: 1,
        twin: 2,
      }),
    ).toMatchObject({ decided: false, reason: "query-unreadable" });
    expect(
      handednessFromCard({ bytes: chiralCard(), candidateCount: 4, pick: 1, twin: 2 }),
    ).toMatchObject({ decided: false, reason: "unexpected-card-layout" });
    expect(
      handednessFromCard({ bytes: Buffer.from("not a png"), candidateCount: 2, pick: 1, twin: 2 }),
    ).toMatchObject({ decided: false, reason: "undecodable-card" });
  });
});

describe("the swapped pick a note cannot catch", () => {
  // The refutation, repeated. The note names the twin by number exactly as the
  // prompt asks, which is everything the old check looked at, and the pick is
  // the wrong hand.
  const SWAPPED_NOTE = "candidate 1 is the mirror";

  it("rejects the swapped hand even when the note names the twin by number", () => {
    const bytes = chiralCard();
    const swapped = answerWith({ pick: 2, note: SWAPPED_NOTE });
    expect(visionPick({ ...CLUSTER }, swapped, NAMES, CARDS, verdictsFor(bytes, swapped))).toEqual({
      elementId: null,
      picked: "handedness-refuted",
    });
  });

  it("keeps the hand the card actually shows, with no note at all", () => {
    const bytes = chiralCard();
    const correct = answerWith({});
    expect(
      visionPick({ ...CLUSTER }, correct, NAMES, CARDS, verdictsFor(bytes, correct)),
    ).toMatchObject({ elementId: "6392746", picked: "vision-kept" });
  });

  it("leaves the pick unpromoted where no verdict reached it, note or no note", () => {
    const named = answerWith({ note: "candidate 2 is the mirror" });
    // No verdict map at all: absence of evidence is not evidence.
    expect(visionPick({ ...CLUSTER }, named, NAMES, CARDS, null)).toEqual({
      elementId: null,
      picked: "handedness-unverified",
    });
    // A verdict that could not decide is not permission either.
    expect(
      visionPick(
        { ...CLUSTER },
        named,
        NAMES,
        CARDS,
        verdictsFor(chiralCard({ symmetric: true }), named),
      ),
    ).toEqual({ elementId: null, picked: "handedness-unverified" });
  });
});

/**
 * The four chiral cards of the sealed run, with the separation each one gives.
 *
 * These live under an ignored path, so the numbers are pinned here and stated in
 * `docs/design/building-system.md`; a checkout without the run says so rather
 * than passing quietly, and the run is identified by its own manifest so a
 * different generation cannot slide underneath these values.
 */
const SEALED_RUN_ID = "0cc4c92ccd775dbeee360dc1";
const SEALED_CARDS = join("output", "part-identification", "cards");
const SEALED_MARGINS = {
  "card-0039": { pick: 1, twin: 2, hand: 1, margin: 0.385212 },
  "card-0041": { pick: 1, twin: 2, hand: 1, margin: 0.374898 },
  "card-0076": { pick: 1, twin: 2, hand: 1, margin: 0.381499 },
  "card-0079": { pick: 1, twin: 4, hand: 1, margin: 0.398095 },
};

const sealedManifest = () => {
  const path = join(SEALED_CARDS, "manifest.json");
  if (!existsSync(path)) return null;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  return manifest.runId === SEALED_RUN_ID ? manifest : null;
};

describe.runIf(sealedManifest() !== null)("the sealed run's four chiral cards", () => {
  it("separates every one of them, and by how much", () => {
    const manifest = sealedManifest();
    for (const [cardId, expected] of Object.entries(SEALED_MARGINS)) {
      const entry = manifest.cards[cardId];
      const verdict = handednessFromCard({
        bytes: readFileSync(join(SEALED_CARDS, ...entry.file.split("/"))),
        candidateCount: entry.candidateElementIds.length,
        pick: expected.pick,
        twin: expected.twin,
        label: cardId,
      });
      expect(verdict, cardId).toMatchObject({ decided: true, hand: expected.hand });
      expect(verdict.margin, `${cardId} margin`).toBeCloseTo(expected.margin, 5);
      expect(verdict.mirroringImprovesTwinMatch, `${cardId} mirrored`).toBe(true);
    }
  });

  it("calls the swap on card-0039 the other way, which is what the note check could not", () => {
    const manifest = sealedManifest();
    const entry = manifest.cards["card-0039"];
    const swapped = handednessFromCard({
      bytes: readFileSync(join(SEALED_CARDS, ...entry.file.split("/"))),
      candidateCount: entry.candidateElementIds.length,
      pick: 2,
      twin: 1,
      label: "card-0039",
    });
    // Candidate 2 is 6392747, Wedge Plate 6 x 2 Left. The card says the query is
    // candidate 1, so a pick of 2 is refuted rather than kept.
    expect(entry.candidateElementIds[1]).toBe("6392747");
    expect(swapped).toMatchObject({ decided: true, hand: 1 });
  });
});
