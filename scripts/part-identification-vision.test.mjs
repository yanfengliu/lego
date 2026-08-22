import { describe, expect, it, vi } from "vitest";

import { askBatch, settleVisionWorkers } from "./part-identification-ask.mjs";
import { assertAnswerRecord, canonicalAnswerRecord } from "./part-identification-artifacts.mjs";
import { pairCost } from "./part-assignment.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
  responseModelIdentity,
} from "./part-identification-model.mjs";
import {
  PART_IDENTIFICATION_COLOUR_VOCABULARY,
  PART_IDENTIFICATION_DIFFERENCES,
  PART_IDENTIFICATION_PROMPT,
} from "./part-identification-prompt.mjs";
import { candidatesNamedInNote, mirrorTwinCandidate } from "./part-identification-mirror-pairs.mjs";
import {
  claimsFor,
  describesSameThing,
  readWhatTheCallObserved,
} from "./part-identification-score.mjs";
import { COLOR_DEFINITIONS } from "../packages/catalog/src/colors.ts";

describe("part-identification vision call boundary", () => {
  it("rejects removed local-path provider hooks before they can launch", async () => {
    const spawnImpl = vi.fn();
    await expect(
      askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, "unused", { spawnImpl }),
    ).rejects.toThrow(/removed local-path provider hook/u);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("waits for sibling vision workers to finish before reporting one failure", async () => {
    let siblingFinished = false;
    const sibling = new Promise((resolve) => {
      setTimeout(() => {
        siblingFinished = true;
        resolve();
      }, 25);
    });
    await expect(
      settleVisionWorkers([Promise.reject(new Error("first worker failed")), sibling]),
    ).rejects.toThrow(/every sibling worker and owned child process finished/);
    expect(siblingFinished).toBe(true);
  });

  it("fails closed on incomplete descriptions, mutable model aliases, and extra model usage", async () => {
    const cluster = {
      clusterIndex: 0,
      members: [0],
      candidates: [{ elementId: "300501", total: 0.1 }],
    };
    const names = new Map([["300501", { name: "Brick 1 x 1", colorId: 0 }]]);
    const cards = {
      "card-0000": { candidateElementIds: ["300501"] },
    };
    for (const proposed of [
      {
        kind: "other",
        studsLong: 0,
        studsWide: 0,
        pick: 1,
        alsoCouldBe: 0,
        differsFromPick: "nothing",
      },
      {
        kind: "brick",
        studsLong: "1",
        studsWide: 1,
        pick: 1,
        alsoCouldBe: 0,
        differsFromPick: "nothing",
      },
    ]) {
      const claims = claimsFor(
        { clusters: [cluster] },
        { elementIds: ["300501"], rows: [[0.1]] },
        "adjudicated",
        { 0: proposed },
        { assign: "nearest", names, cards },
      );
      expect(claims.get(0)).toMatchObject({
        elementId: "300501",
        picked: "description-unverifiable",
      });
    }
    expect(
      describesSameThing(
        { kind: "brick", studsLong: 1, studsWide: 1, colour: "black" },
        { name: "Brick 1 x 1", colorId: 0 },
      ),
    ).toEqual({
      kindAgrees: true,
      sizeAgrees: true,
      colourAgrees: true,
    });
    expect(
      describesSameThing(
        { kind: "brick", studsLong: 1, studsWide: 1, colour: "ultraviolet" },
        { name: "Brick 1 x 1", colorId: 0 },
      ),
    ).toMatchObject({ colourAgrees: false });
    const accepted = claimsFor(
      { clusters: [cluster] },
      { elementIds: ["300501"], rows: [[0.1]] },
      "adjudicated",
      {
        0: {
          kind: "brick",
          studsLong: 1,
          studsWide: 1,
          colour: "black",
          pick: 1,
          alsoCouldBe: 0,
          differsFromPick: "nothing",
          confidence: 0.9,
        },
      },
      { assign: "nearest", names, cards },
    );
    expect(accepted.get(0)).toMatchObject({ elementId: "300501", picked: "vision-kept" });
    const impossibleColour = claimsFor(
      { clusters: [cluster] },
      { elementIds: ["300501"], rows: [[0.1]] },
      "adjudicated",
      {
        0: {
          kind: "brick",
          studsLong: 1,
          studsWide: 1,
          colour: "ultraviolet",
          pick: 1,
          alsoCouldBe: 0,
          differsFromPick: "nothing",
          confidence: 0.9,
        },
      },
      { assign: "nearest", names, cards },
    );
    expect(impossibleColour.get(0)).toMatchObject({ picked: "self-contradicted" });
    expect(() => responseModelIdentity({}, "opus")).toThrow(/pinned to/);
    expect(() =>
      responseModelIdentity(
        {
          is_error: false,
          result: "card-0000 {}",
          modelUsage: {
            [PART_IDENTIFICATION_MODEL_ID]: {
              canonicalModel: PART_IDENTIFICATION_MODEL_ID,
              provider: "firstParty",
            },
            fallback: { canonicalModel: "fallback", provider: "firstParty" },
          },
        },
        PART_IDENTIFICATION_MODEL_ID,
      ),
    ).toThrow(/did not prove pinned model/);
    await expect(askBatch(["../../card-0000"], PART_IDENTIFICATION_MODEL_ID)).rejects.toThrow(
      /unique canonical card-NNNN ids/,
    );
  });
});

describe("part-identification colour vocabulary", () => {
  // The prompt and the grader have to name colours in one language. Asking for a
  // "plain colour name" and grading against the LDraw display name scored wording,
  // not sight: 65 of 136 self-contradictions over 273 drawings were colour-only,
  // most of them "light gray" for Light Bluish Gray or a dropped shade. Naming the
  // vocabulary in the prompt is the fix; loosening the grader is not.
  it("offers the call only names the grader can accept", () => {
    expect(PART_IDENTIFICATION_COLOUR_VOCABULARY.length).toBeGreaterThan(0);
    expect(new Set(PART_IDENTIFICATION_COLOUR_VOCABULARY).size).toBe(
      PART_IDENTIFICATION_COLOUR_VOCABULARY.length,
    );
    for (const colour of PART_IDENTIFICATION_COLOUR_VOCABULARY) {
      const definition = COLOR_DEFINITIONS.find(({ displayName }) => displayName === colour);
      expect(definition, `${colour} must be a catalog colour the grader can resolve`).toBeDefined();
      expect(
        describesSameThing(
          { kind: "brick", studsLong: 1, studsWide: 1, colour },
          { name: "Brick 1 x 1", colorId: definition.ldrawCode },
        ),
      ).toMatchObject({ colourAgrees: true });
      expect(PART_IDENTIFICATION_PROMPT).toContain(colour);
    }
  });

  it("still fails the near misses that are real sight errors", () => {
    // Black graded against "dark gray", and Sand Blue against "light blue", are
    // the third of the colour-only contradictions that were never a synonym.
    for (const [colour, ldrawCode] of [
      ["dark gray", 0],
      ["light grey", 72],
      ["light blue", 379],
      ["blue", 272],
    ]) {
      expect(
        describesSameThing(
          { kind: "brick", studsLong: 1, studsWide: 1, colour },
          { name: "Brick 1 x 1", colorId: ldrawCode },
        ),
      ).toMatchObject({ colourAgrees: false });
    }
  });
});

/** One chiral card: both hands of a 6 x 2 wedge plate, White, in one candidate list. */
const WEDGE_NAMES = new Map([
  ["6392746", { name: "Wedge Plate 6 x 2 Right", colorId: 15 }],
  ["6392747", { name: "Wedge Plate 6 x 2 Left", colorId: 15 }],
]);
const WEDGE_CARDS = { "card-0000": { candidateElementIds: ["6392746", "6392747"] } };
const WEDGE_CLUSTER = {
  clusterIndex: 0,
  members: [0],
  lead: "p159|q1|x528.900|y214.000",
  candidates: [{ elementId: "6392746", total: 0.07 }],
};
const wedgeAnswer = (overrides = {}) => ({
  kind: "wedge",
  studsLong: 6,
  studsWide: 2,
  colour: "White",
  pick: 1,
  alsoCouldBe: 0,
  differsFromPick: "nothing",
  confidence: 0.86,
  ...overrides,
});
/**
 * The card's own verdict on which hand the query is, as a real run measures it.
 *
 * Passed in rather than assumed, because that is the shape of the correction: a
 * mirror-paired pick is kept only where something looked at the drawing. The
 * pixel measurement that produces this is pinned against the sealed run's actual
 * PNGs in `part-identification-handedness.test.mjs`.
 */
const WEDGE_HAND = new Map([["card-0000", { decided: true, hand: 1, reason: null }]]);
const wedgeClaim = (answer, handedness = null) =>
  claimsFor(
    { clusters: [WEDGE_CLUSTER] },
    { elementIds: ["6392746", "6392747"], rows: [[0.07, 0.21]] },
    "adjudicated",
    { 0: answer },
    { assign: "nearest", names: WEDGE_NAMES, cards: WEDGE_CARDS, handedness },
  ).get(0);

describe("part-identification reply boundary with free text", () => {
  const ask = (result, cardIds = ["card-0000"]) =>
    askBatch(cardIds, PART_IDENTIFICATION_MODEL_ID, "unused", {
      transport: vi.fn(async () => ({
        terminalResult: result,
        modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
      })),
    });
  const line = (cardId, note) =>
    `${cardId} {"kind":"wedge","studsLong":6,"studsWide":2,"colour":"White","pick":1,"alsoCouldBe":0,` +
    `"differsFromPick":"nothing","confidence":0.86${note === null ? "" : `,"note":${JSON.stringify(note)}`}}`;

  it("keeps a written observation, drops a blank one, and refuses one it cannot carry", async () => {
    const written = await ask(
      line("card-0000", "candidate 2 is the mirror; the query's taper runs right"),
    );
    expect(written.answers.get("card-0000")?.note).toBe(
      "candidate 2 is the mirror; the query's taper runs right",
    );
    const blank = await ask(line("card-0000", "   "));
    expect(blank.answers.get("card-0000")).not.toHaveProperty("note");
    // A brace cannot travel in a note: the reply is carved per line before it is
    // parsed. The answer is lost, but the run says which schema rule lost it
    // instead of reporting a model that would not answer.
    const braced = await ask(line("card-0000", "the { in this note"));
    expect(braced.answers.has("card-0000")).toBe(false);
    expect(braced.rejected.get("card-0000")).toMatch(/braces/);
  });

  it("reads the card id from before the JSON, so a note naming another card cannot retag it", async () => {
    const misplaced = `${line("", "see card-0000 for the mirror").trim()} — card-0001`;
    await expect(ask(misplaced, ["card-0000", "card-0001"])).rejects.toThrow(
      /not exactly one requested card id followed by one JSON object/u,
    );
  });
});

describe("part-identification difference vocabulary", () => {
  // The prompt and the validator have to name the same relations. A value the
  // prompt offers and the schema rejects loses the whole answer at the parse
  // boundary; a value the schema accepts and the prompt never mentions is one the
  // call will never write. This is the same closure the colour vocabulary keeps,
  // for the field that carries what the six description fields cannot say.
  it("offers the call only relations the schema accepts, and no others", () => {
    expect(PART_IDENTIFICATION_DIFFERENCES).toContain("other");
    expect(PART_IDENTIFICATION_DIFFERENCES).toContain("nothing");
    for (const value of PART_IDENTIFICATION_DIFFERENCES) {
      expect(PART_IDENTIFICATION_PROMPT).toContain(value);
      const answer =
        value === "not-on-card"
          ? wedgeAnswer({ pick: 0, differsFromPick: value, note: "no candidate is this part" })
          : wedgeAnswer({
              differsFromPick: value,
              ...(value === "nothing" ? {} : { note: `candidate 2 differs by ${value}` }),
            });
      expect(() => assertAnswerRecord(answer)).not.toThrow();
    }
    expect(() =>
      assertAnswerRecord(wedgeAnswer({ differsFromPick: "handedness", note: "invented value" })),
    ).toThrow(/differsFromPick must be one of/);
  });

  it("keeps the claim only when the call says the query is that candidate", () => {
    // `view` is the one declared difference that leaves identity alone: two
    // drawings of one part from different sides are still one part.
    expect(
      wedgeClaim(
        wedgeAnswer({
          differsFromPick: "view",
          note: "the query is drawn from underneath so the studs are not countable",
        }),
      ),
    ).toMatchObject({ picked: "handedness-unverified" });
    for (const value of ["mirrored", "size", "colour", "detail", "other"]) {
      expect(
        wedgeClaim(
          wedgeAnswer({ differsFromPick: value, note: `candidate 2 differs by ${value}` }),
        ),
      ).toMatchObject({ picked: `differs-${value}` });
    }
  });

  it("requires the reason a declared difference exists for, and forbids an empty one", () => {
    expect(() => assertAnswerRecord(wedgeAnswer({ differsFromPick: "mirrored" }))).toThrow(
      /must carry a note whenever it is not/,
    );
    expect(() => assertAnswerRecord(wedgeAnswer({ pick: 0, differsFromPick: "nothing" }))).toThrow(
      /"not-on-card" exactly/,
    );
    expect(() => assertAnswerRecord(wedgeAnswer({ note: "   " }))).toThrow(/non-empty/);
    expect(() => assertAnswerRecord(wedgeAnswer({ note: "a } in the text" }))).toThrow(/braces/);
    expect(() => assertAnswerRecord(wedgeAnswer({ alsoCouldBe: 1 }))).toThrow(
      /different candidate/,
    );
    // A blank note is the call declining to write, so it is dropped rather than
    // retained as a key that means nothing or rejected as a malformed answer.
    expect(canonicalAnswerRecord(wedgeAnswer({ note: "  " }))).not.toHaveProperty("note");
    expect(canonicalAnswerRecord(wedgeAnswer({ note: " seen " })).note).toBe("seen");
  });
});

describe("part-identification observations report", () => {
  // The observation field is optional so that a written note means the call had
  // something to say, and that only holds while the ones written are printed. A
  // report that counted them and dropped the sentences would be the failure this
  // repository already had once, when a detected, measured, correctly named
  // rotate icon was consumed by nothing for weeks.
  it("prints every written note beside the pick it belongs to, and counts the mirror question", () => {
    const answers = {
      0: wedgeAnswer({ note: "candidate 2 is the mirror; the query's taper runs right" }),
    };
    const claims = claimsFor(
      { clusters: [WEDGE_CLUSTER] },
      { elementIds: ["6392746", "6392747"], rows: [[0.07, 0.21]] },
      "adjudicated",
      answers,
      { assign: "nearest", names: WEDGE_NAMES, cards: WEDGE_CARDS, handedness: WEDGE_HAND },
    );
    const observed = readWhatTheCallObserved(
      { clusters: [WEDGE_CLUSTER] },
      answers,
      claims,
      WEDGE_NAMES,
      WEDGE_CARDS,
      WEDGE_HAND,
    );
    expect(observed).toMatchObject({
      answered: 1,
      notesWritten: 1,
      byDifference: { nothing: 1 },
      secondChoicesOffered: 0,
    });
    expect(observed.notes[0]).toMatchObject({
      clusterIndex: 0,
      pick: 1,
      pickedName: "Wedge Plate 6 x 2 Right",
      picked: "vision-kept",
      note: "candidate 2 is the mirror; the query's taper runs right",
    });
    // The hand and the mention of the pair are two different measurements and
    // are counted under two names. The one on the left is what the card says;
    // the one on the right is only that the answer mentioned the twin's number,
    // which a swapped pick satisfies word for word.
    expect(observed.handedness).toMatchObject({
      picksWhoseMirrorWasDisplayed: 1,
      picksWhoseHandWasRead: 1,
      picksTheHandUpheld: 1,
      picksTheHandRefuted: 0,
      picksTheCardCouldNotSeparate: 0,
    });
    expect(observed.mirrorPairAwareness).toMatchObject({
      picksWhoseMirrorWasDisplayed: 1,
      picksThatNamedTheMirror: 1,
    });
    expect(observed.handedness.rows[0]).toMatchObject({
      mirrorCandidate: 2,
      mirrorName: "Wedge Plate 6 x 2 Left",
      namedTheMirror: true,
      handRead: 1,
      handAgreesWithPick: true,
    });

    // The same card with the same six description fields and no note. The hand
    // is still read, because it never depended on the sentence; what falls to
    // zero is the awareness count, which is the number that used to stand in for
    // this one.
    const silent = { 0: wedgeAnswer() };
    const silentObserved = readWhatTheCallObserved(
      { clusters: [WEDGE_CLUSTER] },
      silent,
      claimsFor(
        { clusters: [WEDGE_CLUSTER] },
        { elementIds: ["6392746", "6392747"], rows: [[0.07, 0.21]] },
        "adjudicated",
        silent,
        { assign: "nearest", names: WEDGE_NAMES, cards: WEDGE_CARDS, handedness: WEDGE_HAND },
      ),
      WEDGE_NAMES,
      WEDGE_CARDS,
      WEDGE_HAND,
    );
    expect(silentObserved).toMatchObject({ notesWritten: 0 });
    expect(silentObserved.handedness).toMatchObject({
      picksWhoseMirrorWasDisplayed: 1,
      picksWhoseHandWasRead: 1,
      picksTheHandUpheld: 1,
    });
    expect(silentObserved.mirrorPairAwareness).toMatchObject({
      picksWhoseMirrorWasDisplayed: 1,
      picksThatNamedTheMirror: 0,
    });
    expect(silentObserved.handedness.rows[0].picked).toBe("vision-kept");

    // And with no verdict at all, the pick is unpromoted whatever the note says.
    const unread = readWhatTheCallObserved(
      { clusters: [WEDGE_CLUSTER] },
      answers,
      claimsFor(
        { clusters: [WEDGE_CLUSTER] },
        { elementIds: ["6392746", "6392747"], rows: [[0.07, 0.21]] },
        "adjudicated",
        answers,
        { assign: "nearest", names: WEDGE_NAMES, cards: WEDGE_CARDS },
      ),
      WEDGE_NAMES,
      WEDGE_CARDS,
    );
    expect(unread.handedness).toMatchObject({
      picksWhoseHandWasRead: 0,
      picksTheCardCouldNotSeparate: 1,
    });
    expect(unread.mirrorPairAwareness.picksThatNamedTheMirror).toBe(1);
    expect(unread.handedness.rows[0].picked).toBe("handedness-unverified");
  });
});

describe("part-identification handedness", () => {
  // Cards 39, 41, 76 and 79 of the last run each displayed both hands of one
  // wedge plate. Their answers were byte-identical in kind, stud size and colour
  // and differed only in a pick index, so a swapped pick passed every
  // deterministic check and was stamped trusted. The mirror twin is a fact about
  // the card, so it is computed from the card.
  it("finds the mirror twin among the candidates the card displayed", () => {
    expect(mirrorTwinCandidate(["6392746", "6392747"], WEDGE_NAMES, 1)).toBe(2);
    expect(mirrorTwinCandidate(["6392746", "6392747"], WEDGE_NAMES, 2)).toBe(1);
    expect(
      mirrorTwinCandidate(
        ["6392746", "300501"],
        new Map([...WEDGE_NAMES, ["300501", { name: "Brick 1 x 1", colorId: 0 }]]),
        1,
      ),
    ).toBe(0);
    // A twin printed in another shade is already separated by the colour check,
    // so the mirror question is not asked there.
    expect(
      mirrorTwinCandidate(
        ["6392746", "4283046"],
        new Map([...WEDGE_NAMES, ["4283046", { name: "Wedge Plate 6 x 2 Left", colorId: 0 }]]),
        1,
      ),
    ).toBe(0);
  });

  it("reads candidate numbers out of a note without mistaking a stud size for one", () => {
    expect([...candidatesNamedInNote("candidate 2 is the mirror")]).toEqual([2]);
    expect([...candidatesNamedInNote("candidates 2 and 4 are the same mould")]).toEqual([2, 4]);
    expect([...candidatesNamedInNote("candidates 2, 4 are one part")]).toEqual([2, 4]);
    // The whole reason only "candidate"-introduced digits count: a wedge note is
    // full of other numbers, and a bare integer scan would let "6 x 2" stand in
    // for a reference to candidate 2.
    expect(candidatesNamedInNote("a wedge 6 x 2 in White").has(2)).toBe(false);
    expect(candidatesNamedInNote(undefined).size).toBe(0);
  });

  it("refuses a mirror-paired pick until the card itself says which hand it is", () => {
    // No verdict reached this pick, so nothing looked at the drawing.
    expect(wedgeClaim(wedgeAnswer())).toMatchObject({ picked: "handedness-unverified" });
    // A sentence naming the twin is not a verdict about the hand and never was.
    // The twin's number is the same number whichever hand was picked, so this
    // note reads identically on the swapped answer below.
    // Under `nearest` the claim falls back to the geometric first choice, so the
    // thing that changes is the label the placement path is allowed to trust,
    // and `handedness-unverified` is not one of those.
    expect(
      wedgeClaim(
        wedgeAnswer({
          note: "the query's stepped edge is on the left, so candidate 2 is the mirror",
        }),
      ),
    ).toMatchObject({ picked: "handedness-unverified" });
    // The card's own pixels decide it, and they decide against the swap.
    expect(wedgeClaim(wedgeAnswer(), WEDGE_HAND)).toMatchObject({
      elementId: "6392746",
      picked: "vision-kept",
    });
    expect(
      wedgeClaim(wedgeAnswer({ pick: 2, note: "candidate 1 is the mirror" }), WEDGE_HAND),
    ).toMatchObject({ picked: "handedness-refuted" });
    // The description check cannot tell the two hands apart, which is exactly why
    // the mirror question has to be settled from the drawing.
    for (const elementId of ["6392746", "6392747"]) {
      expect(describesSameThing(wedgeAnswer(), WEDGE_NAMES.get(elementId))).toEqual({
        kindAgrees: true,
        sizeAgrees: true,
        colourAgrees: true,
      });
    }
  });
});

describe("part-identification second choice", () => {
  // A forced single pick threw the tie away: the runner-up was indexed nowhere,
  // so a drawing whose first choice a stronger drawing had already taken fell
  // back on raw geometry rather than on the alternative the call named.
  it("lets a declared second choice carry the drawing when the first is taken", () => {
    const names = new Map([
      ["300501", { name: "Brick 1 x 1", colorId: 0 }],
      ["300502", { name: "Brick 1 x 2", colorId: 0 }],
    ]);
    const cards = {
      "card-0000": { candidateElementIds: ["300501", "300502"] },
      "card-0001": { candidateElementIds: ["300501", "300502"] },
    };
    const clusters = [
      { clusterIndex: 0, members: [0], candidates: [{ elementId: "300501", total: 0.05 }] },
      { clusterIndex: 1, members: [1], candidates: [{ elementId: "300501", total: 0.4 }] },
    ];
    const distances = {
      elementIds: ["300501", "300502"],
      rows: [
        [0.05, 0.9],
        [0.4, 0.5],
      ],
    };
    const answers = {
      0: {
        kind: "brick",
        studsLong: 1,
        studsWide: 1,
        colour: "black",
        pick: 1,
        alsoCouldBe: 0,
        differsFromPick: "nothing",
        confidence: 0.95,
      },
      1: {
        kind: "brick",
        studsLong: 1,
        studsWide: 1,
        colour: "black",
        pick: 1,
        alsoCouldBe: 2,
        differsFromPick: "nothing",
        confidence: 0.55,
      },
    };
    const claims = claimsFor({ clusters }, distances, "adjudicated", answers, {
      assign: "one-to-one",
      held: new Map([
        ["300501", 1],
        ["300502", 1],
      ]),
      names,
      cards,
    });
    expect(claims.get(0)).toMatchObject({ elementId: "300501" });
    expect(claims.get(1)).toMatchObject({ elementId: "300502" });
    // Without the declared alternative the same contest still resolves, but the
    // second drawing lands there on geometry alone rather than on what it said.
    const withoutSecondChoice = claimsFor(
      { clusters },
      distances,
      "adjudicated",
      { ...answers, 1: { ...answers[1], alsoCouldBe: 0 } },
      {
        assign: "one-to-one",
        held: new Map([
          ["300501", 1],
          ["300502", 1],
        ]),
        names,
        cards,
      },
    );
    expect(withoutSecondChoice.get(1)).toMatchObject({ elementId: "300502" });
    expect(pairCost(0.5, { picked: false, alsoCouldBe: true })).toBeCloseTo(0.39, 10);
    expect(pairCost(0.5, { picked: true, alsoCouldBe: false })).toBeCloseTo(0.28, 10);
    expect(pairCost(0.5, { picked: false, alsoCouldBe: false })).toBeCloseTo(0.5, 10);
  });
});
