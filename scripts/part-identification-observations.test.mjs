import { describe, expect, it } from "vitest";

import {
  ANSWER_FIELD_READERS,
  checkFieldReaders,
  collectedObservations,
  observationProbeFixture,
  probeAnswerFieldRoles,
  promptReplyFields,
} from "./check-observation-consumers.mjs";
import {
  LOW_CONFIDENCE,
  clusterObservations,
  noteTerms,
  observationRecords,
  observationReport,
  statedCause,
  stemTerm,
} from "./part-identification-observations.mjs";
import {
  MAX_BECAUSE_LENGTH,
  MAX_QUOTED_REFUSAL,
  MAX_REASKS,
  PART_REASK_PROMPT,
  PART_REASK_PROMPT_DIGEST,
  REASK_REASONS,
  boundReasks,
  planReasks,
  reaskBundle,
  validReaskReply,
} from "./part-identification-reask.mjs";
import { ANSWER_FIELDS, OPTIONAL_ANSWER_FIELDS } from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_MAX_NOTE_LENGTH } from "./part-identification-prompt.mjs";
import { quoteLine } from "./generated-file-staleness.mjs";

const fixture = () => observationProbeFixture();
const recordsOf = (extra = {}) => observationRecords({ ...fixture(), ...extra });

describe("observation clustering", () => {
  it("groups notes by the terms they turn out to share, with no domain lexicon", () => {
    const records = [
      { clusterIndex: 1, note: "candidate 2 is the mirror, its stepped edge is on the left" },
      { clusterIndex: 2, note: "the mirror candidate 3 has its stepped taper reversed" },
      { clusterIndex: 3, note: "drawn from underneath so no studs show at all" },
      { clusterIndex: 4, note: "the binoculars sit at a pose no candidate shares" },
    ];
    const { clusters, oneOffs } = clusterObservations(records);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map(({ clusterIndex }) => clusterIndex)).toEqual([1, 2]);
    expect(clusters[0].terms).toContain("mirror");
    expect(clusters[0].terms).toContain("step");
    expect(oneOffs.map(({ clusterIndex }) => clusterIndex)).toEqual([3, 4]);
  });

  it("accounts for every written note exactly once, which is what the report's closure rests on", () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
      clusterIndex: index,
      note:
        index % 3 === 0
          ? `candidate ${index} is the mirror with a stepped edge`
          : index % 3 === 1
            ? `drawn from underneath so the rim gives the size`
            : `a wholly unrelated remark number ${index} about nothing in particular`,
    }));
    const { clusters, oneOffs } = clusterObservations(records);
    const seen = [...clusters.flatMap(({ members }) => members), ...oneOffs];
    expect(seen).toHaveLength(records.length);
    expect(new Set(seen.map(({ clusterIndex }) => clusterIndex)).size).toBe(records.length);
  });

  it("keeps a term that describes the whole corpus from becoming a theme", () => {
    const records = Array.from({ length: 6 }, (_, index) => ({
      clusterIndex: index,
      note: `the query drawing is a plate and index ${index} says nothing else`,
    }));
    // Every note shares every term, so nothing distinguishes anything: the right
    // answer is no themes, not one theme containing the entire run.
    expect(clusterObservations(records).clusters).toHaveLength(0);
    expect(clusterObservations(records).oneOffs).toHaveLength(6);
  });

  it("unifies inflections without a full stemmer and drops the structural word", () => {
    expect(stemTerm("mirrored")).toBe("mirror");
    expect(stemTerm("mirrors")).toBe("mirror");
    expect(stemTerm("studs")).toBe("stud");
    expect(noteTerms("candidate 4 is the same mould")).not.toContain("candidate");
    expect(noteTerms("candidate 4 is the same mould")).toContain("mould");
  });
});

describe("the observation report", () => {
  const report = () =>
    observationReport({ provenance: fixture().provenance, records: recordsOf(), reasks: [] });

  it("reproduces every written sentence in full", () => {
    const text = report();
    for (const record of recordsOf()) {
      if (record.note === null) continue;
      expect(text).toContain(record.note);
    }
  });

  it("names the grader's verdict beside the sentence, so a note on a discarded pick is visible", () => {
    // The fixture's third answer declares a colour difference, which the grader
    // refuses. A report that printed the sentence without the refusal would read
    // as a confirmed observation about a part nothing claims.
    expect(report()).toContain("differs-colour");
  });

  it("reports doubt with its stated cause, and says so when there is none", () => {
    const withCause = recordsOf().find(({ clusterIndex }) => clusterIndex === 2);
    expect(statedCause(withCause).length).toBeGreaterThan(0);
    const bare = { differsFromPick: "nothing", alsoCouldBe: 0, note: null };
    expect(statedCause(bare)).toEqual([]);
    const answers = { ...fixture().answers, 1: { ...fixture().answers[1], alsoCouldBe: 0 } };
    const text = observationReport({
      provenance: fixture().provenance,
      records: recordsOf({ answers }),
      reasks: [],
    });
    expect(text).toContain("no stated cause");
    expect(text).toContain(`Doubt below ${LOW_CONFIDENCE.toFixed(2)}`);
  });

  it("lists every pick whose mirror twin sits on the same card", () => {
    expect(report()).toMatch(/mirror twin is candidate 2/u);
  });

  it("is a pure function of its inputs, which is what lets the gate byte-compare it", () => {
    expect(report()).toBe(report());
  });
});

describe("the targeted re-ask", () => {
  it("asks again only where exactly two candidates were left standing", () => {
    const targets = planReasks(fixture());
    // Cluster 0 named its mirror, so it is settled and costs no call. Cluster 1
    // declared a second choice it could not rule out, so it does.
    expect(targets.map(({ clusterIndex }) => clusterIndex)).toEqual([1]);
    expect(targets[0]).toMatchObject({ reason: "second-choice-offered", between: [1, 2] });
  });

  it("asks again where a mirror twin was displayed and the card could not separate the hands", () => {
    // Not "where the note was silent". A silent note is no longer a reason to
    // spend a call: the hand comes off the drawing, and the note never carried
    // it. What is worth asking again is a card whose two hands the silhouette
    // comparison could not tell apart.
    const base = fixture();
    const { note, ...silent } = base.answers[0];
    void note;
    expect(planReasks({ ...base, answers: { ...base.answers, 0: silent } })).toHaveLength(1);
    const targets = planReasks({
      ...base,
      handedness: new Map([
        ["card-0000", { decided: false, hand: null, reason: "query-is-its-own-mirror" }],
      ]),
    });
    expect(targets[0]).toMatchObject({
      clusterIndex: 0,
      reason: "handedness-unverified",
      between: [1, 2],
      firstPick: 1,
    });
  });

  it("is bounded, and refuses a budget outside the bound", () => {
    expect(planReasks({ ...fixture(), max: 0 })).toEqual([]);
    expect(() => planReasks({ ...fixture(), max: MAX_REASKS + 1 })).toThrow(/0 through 64/u);
  });

  it("accepts only one of the two numbers it offered, with a reason", () => {
    expect(validReaskReply({ pick: 1, because: "the left edge is straight" }, [1, 2])).toBe(true);
    expect(validReaskReply({ pick: 3, because: "the left edge is straight" }, [1, 2])).toBe(false);
    expect(validReaskReply({ pick: 0, because: "neither has the notch" }, [1, 2])).toBe(true);
    expect(validReaskReply({ pick: 1 }, [1, 2])).toBe(false);
    expect(validReaskReply({ pick: 1, because: "  " }, [1, 2])).toBe(false);
    expect(validReaskReply({ pick: 1, because: "has a {brace}" }, [1, 2])).toBe(false);
  });

  it("refuses a bundle derived from anything but a first pass", () => {
    const bound = {
      model: "m",
      matchDigest: "sha256:m",
      cardsDigest: "sha256:c",
      answersDigest: "sha256:a",
    };
    const bundle = reaskBundle({
      ...bound,
      modelIdentity: {},
      reasks: {
        7: {
          cardId: "card-0007",
          reason: "second-choice-offered",
          between: [1, 2],
          firstPick: 1,
          pick: 2,
          because: "the notch is on the near face",
        },
      },
    });
    expect(boundReasks(bundle, bound)[0]).toMatchObject({ clusterIndex: 7, agrees: false });
    expect(() => boundReasks({ ...bundle, generation: 2 }, bound)).toThrow(
      /never be derived from a re-ask/u,
    );
    expect(() => boundReasks({ ...bundle, answersDigest: "sha256:other" }, bound)).toThrow(
      /answersDigest observed/u,
    );
  });

  it("derives agreement rather than storing it, so no artifact can assert a confirmation", () => {
    const bound = { model: "m", matchDigest: "d", cardsDigest: "d", answersDigest: "d" };
    const record = {
      cardId: "card-0001",
      reason: "handedness-unverified",
      between: [1, 4],
      firstPick: 1,
      because: "the stepped edge is on the right",
    };
    const agreeing = reaskBundle({
      ...bound,
      modelIdentity: {},
      reasks: { 1: { ...record, pick: 1, agrees: false } },
    });
    // The stored `agrees: false` is ignored: the value is recomputed from the
    // question that was put and the answer that came back.
    expect(boundReasks(agreeing, bound)[0].agrees).toBe(true);
    const neither = reaskBundle({
      ...bound,
      modelIdentity: {},
      reasks: { 1: { ...record, pick: 0 } },
    });
    expect(boundReasks(neither, bound)[0].agrees).toBeNull();
  });

  it("hands back the text it refused, escaped, so diagnosing costs no second call", () => {
    // The first live re-ask this code ever made was refused, and the reason
    // alone did not say which rule; finding out cost another call, on a reply
    // that turned out to be correct and well-formed.
    expect(quoteLine('card-0079 {"pick":1,"card":"card-0079"}', MAX_QUOTED_REFUSAL)).toBe(
      '"card-0079 {\\"pick\\":1,\\"card\\":\\"card-0079\\"}"',
    );
    expect(quoteLine("\t ")).toBe('"\\t "');
    const long = quoteLine("x".repeat(500), MAX_QUOTED_REFUSAL);
    expect(long.length).toBeLessThanOrEqual(MAX_QUOTED_REFUSAL + 8);
    expect(long.endsWith('…"')).toBe(true);
    expect(quoteLine(undefined)).toBe("no such line");
  });

  it("bounds the reason at the same length as a first-pass note", () => {
    // One kind of sentence, one limit. A tighter bound here refused a correct
    // 179-character answer for length alone.
    expect(MAX_BECAUSE_LENGTH).toBe(PART_IDENTIFICATION_MAX_NOTE_LENGTH);
    expect(validReaskReply({ pick: 1, because: "e".repeat(MAX_BECAUSE_LENGTH) }, [1, 2])).toBe(
      true,
    );
    expect(validReaskReply({ pick: 1, because: "e".repeat(MAX_BECAUSE_LENGTH + 1) }, [1, 2])).toBe(
      false,
    );
  });

  it("pins its own prompt, distinct from the first pass", () => {
    expect(PART_REASK_PROMPT_DIGEST).toMatch(/^sha256:[0-9a-f]{64}$/u);
    for (const reason of Object.keys(REASK_REASONS)) {
      expect(REASK_REASONS[reason].hint.length).toBeGreaterThan(0);
      expect(REASK_REASONS[reason].why.length).toBeGreaterThan(0);
    }
    expect(PART_REASK_PROMPT).toContain("because is required");
  });
});

describe("the unread-output gate", () => {
  it("passes today, and says which fields decide and which only get printed", () => {
    expect(checkFieldReaders()).toEqual([]);
    const observed = probeAnswerFieldRoles();
    for (const [field, { role }] of Object.entries(ANSWER_FIELD_READERS)) {
      expect(observed[field], `${field} plays its declared role`).toBe(role);
    }
  });

  it("declares a reader for exactly the fields the schema and the prompt agree on", () => {
    expect(Object.keys(ANSWER_FIELD_READERS).sort()).toEqual(
      [...ANSWER_FIELDS, ...OPTIONAL_ANSWER_FIELDS].sort(),
    );
    expect([...promptReplyFields()].sort()).toEqual(
      [...ANSWER_FIELDS, ...OPTIONAL_ANSWER_FIELDS].sort(),
    );
  });

  it("measures consumption rather than presence: a field with nothing to change reads as inert", () => {
    // Flatten the distances so the global assignment has no contest to resolve.
    // `alsoCouldBe` is a discount inside that contest and nothing else, so with
    // no contest it stops deciding — and the probe must notice, or it would be
    // checking that the field exists rather than that anything reads it.
    const base = fixture();
    const flat = {
      ...base,
      distances: { ...base.distances, rows: base.distances.rows.map((row) => row.map(() => 0.5)) },
    };
    expect(probeAnswerFieldRoles(flat).alsoCouldBe).toBe("reported");
    expect(probeAnswerFieldRoles(base).alsoCouldBe).toBe("decides");
  });

  it("counts what a run collected without binding it, so a prompt edit is not reported as unread", () => {
    expect(collectedObservations({ schemaVersion: "x", answers: {} })).toMatchObject({
      notes: 0,
      differences: 0,
      secondChoices: 0,
    });
    expect(
      collectedObservations({
        schemaVersion: "lego.part-identification-answers/4",
        answers: {
          0: { differsFromPick: "nothing", alsoCouldBe: 0 },
          1: { differsFromPick: "mirrored", alsoCouldBe: 0, note: "candidate 2 is the mirror" },
          2: { differsFromPick: "nothing", alsoCouldBe: 3 },
          3: null,
        },
      }),
    ).toMatchObject({ answers: 3, notes: 1, differences: 1, secondChoices: 1 });
  });
});
