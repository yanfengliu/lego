import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { describeTextDifference } from "./generated-file-staleness.mjs";
import {
  ANSWER_FIELDS,
  OPTIONAL_ANSWER_FIELDS,
  assertAnswerRecord,
  readJsonArtifact,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_PROMPT } from "./part-identification-prompt.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { claimsFor } from "./part-identification-score.mjs";
import { observationRecords, observationReport } from "./part-identification-observations.mjs";
import {
  DEFAULT_OUT,
  answersPathFor,
  loadObservationInputs,
  loadRecordedReasks,
  observationReportPath,
  reasksPathFor,
  renderObservationReport,
} from "./part-identification-observations-run.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";

/**
 * The gate for output that is collected and never read.
 *
 * This repository has already run the experiment. The booklet's rotate icon was
 * detected, measured, and correctly identified as a viewpoint change, and then
 * consumed by nothing for weeks while a lesson argued it was probably page
 * chrome; the face parity of every step after it was wrong as a result. Widening
 * the vision reply so the call can describe what it sees repeats that exactly
 * unless something reads the description, and "somebody will read it" is not a
 * property a repository can hold.
 *
 * Two edges, because there are two ways to collect and not read.
 *
 * The first is a field that no code consumes. It runs everywhere, against a
 * fixture, by mutation: change the field and see whether anything downstream
 * moves. `confidence` fails a strict version of this today and is known to —
 * inverting all 240 values in the last run changed 0 of 859 claims — so the
 * table below records the role each field actually plays and the gate holds it
 * to that, rather than pretending every field decides something. A field that
 * moves nothing at all is red; a field that quietly stops doing what it is
 * declared to do is also red, which is the case that catches a reader deleted by
 * accident.
 *
 * The second is a run whose answers carry observations with no report derived
 * from them. It only has teeth where a vision pass has actually been run,
 * because the answers live under an ignored path; on a fresh clone it passes and
 * says so rather than being red where it could tell nobody anything.
 */

const FIX_PROMPT = "scripts/part-identification-prompt.mjs";
const FIX_FIELDS = "scripts/part-identification-artifacts.mjs";

/**
 * Which reader each answer field has, and what that reader does with it.
 *
 * `decides` means changing the field changes what the pipeline believes about a
 * part — the element a callout is claimed to be, or the label that decides
 * whether the claim may be built on. `reported` means it changes only the
 * document a person reads.
 *
 * The distinction is here to stop this gate laundering the very finding that
 * motivated it. Once a report prints every field, every field trivially "has a
 * consumer", and `confidence` would go green while remaining exactly as inert as
 * it was measured to be. Declaring the weaker role instead keeps the honest
 * statement in the repository, and makes an upgrade visible: if someone gives
 * confidence a decision to make, this gate goes red until the table says so.
 */
export const ANSWER_FIELD_READERS = Object.freeze({
  pick: { role: "decides", reader: "part-identification-score.mjs#visionPick" },
  kind: { role: "decides", reader: "part-identification-score.mjs#describesSameThing" },
  studsLong: { role: "decides", reader: "part-identification-score.mjs#describesSameThing" },
  studsWide: { role: "decides", reader: "part-identification-score.mjs#describesSameThing" },
  colour: { role: "decides", reader: "part-identification-score.mjs#describesSameThing" },
  differsFromPick: { role: "decides", reader: "part-identification-score.mjs#visionPick" },
  alsoCouldBe: { role: "decides", reader: "part-assignment.mjs#pairCost" },
  note: {
    role: "reported",
    reader: "part-identification-observations.mjs#observationReport",
    known:
      "Demoted from decides on 2026-08-07. It used to earn a mirror-paired pick its claim by naming the twin's candidate number, and that check was refuted by execution: feeding the grader the swapped pick on card-0039 with the note \"candidate 1 is the mirror\" returned the same vision-kept and the same element as the correct answer, because the twin's number is the same number whichever hand was picked. The hand is now decided from the card's own pixels in part-identification-handedness.mjs, which no wording of a note can satisfy. The note is still printed in full and its mirror-pair mentions are still counted, under that name.",
  },
  confidence: {
    role: "reported",
    reader: "part-identification-observations.mjs#observationReport",
    known:
      "Measured inert as a decision input: inverting every value in the 240-answer run changed 0 of 859 claims. It is kept because the causes of doubt now travel in differsFromPick, alsoCouldBe and note, and reported so the doubt it does record is at least visible.",
  },
});

/**
 * A run in miniature, built so that every field has something to change.
 *
 * Four drawings and six elements, with the distances chosen so the global
 * assignment is genuinely contested: two drawings want the same Plate 1 x 2, and
 * which of them gets it turns on whether the second choice was declared. That
 * contest is the only way to prove `alsoCouldBe` decides anything, because its
 * whole effect is a discount inside an assignment that has to have an
 * alternative to prefer.
 */
export function observationProbeFixture() {
  const elementIds = ["100001", "100002", "100003", "100004", "100005", "100006"];
  const names = new Map([
    ["100001", { name: "Wedge Plate 6 x 2 Right", colorId: 15 }],
    ["100002", { name: "Wedge Plate 6 x 2 Left", colorId: 15 }],
    ["100003", { name: "Plate 1 x 2", colorId: 71 }],
    ["100004", { name: "Plate 1 x 2", colorId: 72 }],
    ["100005", { name: "Brick 1 x 1", colorId: 0 }],
    ["100006", { name: "Brick 1 x 1", colorId: 72 }],
  ]);
  const displayed = [
    ["100001", "100002", "100003"],
    ["100003", "100004"],
    ["100005", "100006"],
    ["100003", "100005"],
  ];
  const cards = Object.fromEntries(
    displayed.map((candidateElementIds, index) => [
      `card-${String(index).padStart(4, "0")}`,
      { candidateElementIds },
    ]),
  );
  const match = {
    clusters: displayed.map((candidates, clusterIndex) => ({
      clusterIndex,
      lead: `probe-${clusterIndex}.png`,
      members: [clusterIndex],
      pieces: 1,
      candidates: candidates.map((elementId) => ({ elementId, total: 0.5 })),
    })),
  };
  const distances = {
    elementIds,
    rows: [
      [0.05, 0.3, 0.9, 0.9, 0.9, 0.9],
      [0.9, 0.55, 0.4, 0.6, 0.9, 0.9],
      [0.9, 0.9, 0.9, 0.9, 0.4, 0.55],
      [0.9, 0.9, 0.1, 0.8, 0.9, 0.9],
    ],
  };
  const answers = {
    0: {
      kind: "wedge",
      studsLong: 6,
      studsWide: 2,
      colour: "White",
      pick: 1,
      alsoCouldBe: 0,
      differsFromPick: "nothing",
      confidence: 0.94,
      note: "candidate 2 is the mirror, its stepped edge is on the left",
    },
    1: {
      kind: "plate",
      studsLong: 2,
      studsWide: 1,
      colour: "Light Bluish Gray",
      pick: 1,
      alsoCouldBe: 2,
      differsFromPick: "nothing",
      confidence: 0.62,
    },
    2: {
      kind: "brick",
      studsLong: 1,
      studsWide: 1,
      colour: "Dark Bluish Gray",
      pick: 2,
      alsoCouldBe: 0,
      differsFromPick: "colour",
      confidence: 0.7,
      note: "the query reads black; candidate 2 is the same mould in dark bluish gray",
    },
  };
  return {
    match,
    distances,
    answers,
    names,
    cards,
    // Card-0000 shows both hands of one wedge plate, so its pick is only kept
    // when the card's own pixels say which hand the query is. The probe has no
    // card rasters, so the verdict a real run measures is supplied directly —
    // the pixel measurement itself is pinned against the sealed run's actual
    // PNGs in part-identification-handedness.test.mjs, which is where it
    // belongs. What this fixture has to keep true is that `pick` still decides
    // something, and it does: move it to 2 and the same verdict refutes it.
    handedness: new Map([
      [
        "card-0000",
        { decided: true, hand: 1, reason: null, queryAgainstPick: 0.9, queryAgainstTwin: 0.52 },
      ],
    ]),
    provenance: {
      model: "probe",
      answersDigest: "sha256:probe",
      cardsDigest: "sha256:probe",
      matchDigest: "sha256:probe",
      promptDigest: "sha256:probe",
      drawings: match.clusters.length,
    },
  };
}

/**
 * One edit per field, each of which leaves a record the validator still accepts.
 *
 * That constraint is what makes the probe a consumption test rather than a
 * validation test: a mutation the schema would refuse proves only that the
 * schema refuses it. Each mutation is asserted valid before it is used.
 */
const MUTATIONS = {
  pick: (answers) => ({ ...answers, 0: { ...answers[0], pick: 2 } }),
  kind: (answers) => ({ ...answers, 0: { ...answers[0], kind: "technic" } }),
  studsLong: (answers) => ({ ...answers, 0: { ...answers[0], studsLong: 7 } }),
  studsWide: (answers) => ({ ...answers, 0: { ...answers[0], studsWide: 3 } }),
  colour: (answers) => ({ ...answers, 0: { ...answers[0], colour: "Black" } }),
  differsFromPick: (answers) => ({ ...answers, 2: { ...answers[2], differsFromPick: "view" } }),
  alsoCouldBe: (answers) => ({ ...answers, 1: { ...answers[1], alsoCouldBe: 0 } }),
  note: (answers) => {
    const { note, ...rest } = answers[0];
    void note;
    return { ...answers, 0: rest };
  },
  confidence: (answers) =>
    Object.fromEntries(
      Object.entries(answers).map(([key, answer]) => [
        key,
        { ...answer, confidence: Number((1 - answer.confidence).toFixed(2)) },
      ]),
    ),
};

const claimSignature = (fixture, answers) =>
  JSON.stringify(
    [
      ...claimsFor(fixture.match, fixture.distances, "adjudicated", answers, {
        assign: "one-to-one",
        held: new Map(),
        names: fixture.names,
        cards: fixture.cards,
        handedness: fixture.handedness,
      }),
    ].sort(([left], [right]) => left - right),
  );

const reportSignature = (fixture, answers) =>
  observationReport({
    provenance: fixture.provenance,
    records: observationRecords({ ...fixture, answers }),
    reasks: [],
  });

/** What each field is observed to do, as opposed to what the table says it does. */
export function probeAnswerFieldRoles(fixture = observationProbeFixture()) {
  const baseClaims = claimSignature(fixture, fixture.answers);
  const baseReport = reportSignature(fixture, fixture.answers);
  const observed = {};
  for (const [field, mutate] of Object.entries(MUTATIONS)) {
    const answers = mutate(fixture.answers);
    for (const [key, answer] of Object.entries(answers)) {
      assertAnswerRecord(answer, `Probe mutation of ${field} on cluster ${key}`);
    }
    observed[field] =
      claimSignature(fixture, answers) !== baseClaims
        ? "decides"
        : reportSignature(fixture, answers) !== baseReport
          ? "reported"
          : "inert";
  }
  return observed;
}

/** Field names the prompt actually asks the call to fill. */
export function promptReplyFields(prompt = PART_IDENTIFICATION_PROMPT) {
  return new Set([...prompt.matchAll(/"(\w+)"\s*:/gu)].map(([, name]) => name));
}

export function checkFieldReaders() {
  const failures = [];
  const declared = Object.keys(ANSWER_FIELD_READERS).sort();
  const schema = [...ANSWER_FIELDS, ...OPTIONAL_ANSWER_FIELDS].sort();
  if (declared.join(",") !== schema.join(",")) {
    failures.push(
      `The declared reader table and the answer schema name different fields.\n` +
        `  table: ${declared.join(", ")}\n  schema: ${schema.join(", ")}\n` +
        `  Satisfy it by editing ANSWER_FIELD_READERS in scripts/check-observation-consumers.mjs and ANSWER_FIELDS in ${FIX_FIELDS} in the same commit; a field in one and not the other is a field nobody has decided who reads.`,
    );
  }
  const asked = promptReplyFields();
  const unasked = [...asked].filter((field) => !schema.includes(field)).sort();
  const unwritten = schema.filter((field) => !asked.has(field));
  if (unasked.length > 0) {
    failures.push(
      `The prompt asks the call to fill ${unasked.join(", ")}, which the answer schema does not accept, so every reply carrying it is refused whole.\n` +
        `  Satisfy it by adding the field to ANSWER_FIELDS in ${FIX_FIELDS}, or removing it from the reply schema in ${FIX_PROMPT}.`,
    );
  }
  if (unwritten.length > 0) {
    failures.push(
      `The answer schema requires ${unwritten.join(", ")}, which the prompt never asks for, so no reply can ever be valid.\n` +
        `  Satisfy it by naming the field in the reply schema in ${FIX_PROMPT}.`,
    );
  }

  const observed = probeAnswerFieldRoles();
  for (const [field, { role, reader, known }] of Object.entries(ANSWER_FIELD_READERS)) {
    const actual = observed[field];
    if (actual === undefined) {
      failures.push(
        `${field} has a declared reader but no probe mutation, so nothing checked that the reader reads it.\n` +
          `  Satisfy it by adding a schema-valid mutation for ${field} to MUTATIONS in scripts/check-observation-consumers.mjs.`,
      );
      continue;
    }
    if (actual === "inert") {
      failures.push(
        `${field} is collected on every answer and nothing reads it.\n` +
          `  declared: ${role}, by ${reader}${known ? `\n  known: ${known}` : ""}\n` +
          `  observed: changing it across the probe fixture moved neither the claim set from part-identification-score.mjs#claimsFor nor the observation report.\n` +
          `  This is the failure the gate exists for: the booklet's rotate icon was measured, named, and read by nothing for weeks, and that inverted the face parity of every step after it.\n` +
          `  Satisfy it by giving ${field} a reader, or by removing it from the reply schema in ${FIX_PROMPT} and from ANSWER_FIELDS in ${FIX_FIELDS} in the same commit.`,
      );
      continue;
    }
    if (actual !== role) {
      failures.push(
        actual === "reported"
          ? `${field} is declared to decide something and no longer does.\n` +
              `  declared: ${role}, by ${reader}\n` +
              `  observed: changing it moved the observation report but left the claim set from part-identification-score.mjs#claimsFor identical.\n` +
              `  A reader was probably deleted or short-circuited. Satisfy it by restoring the decision, or by demoting the entry to "reported" in scripts/check-observation-consumers.mjs and saying in the commit why the field stopped mattering.`
          : `${field} decides more than its declared reader claims.\n` +
              `  declared: ${role}, by ${reader}\n` +
              `  observed: changing it changed the claim set, so something now acts on it.\n` +
              `  Satisfy it by promoting the entry to "decides" in scripts/check-observation-consumers.mjs and naming the reader that acts on it.`,
      );
    }
  }
  return failures;
}

/**
 * What one real run collected, counted without binding anything.
 *
 * Read leniently on purpose. Whether the answers still bind to the current
 * prompt is a different question from whether anybody read them, and a gate that
 * could not tell those apart would report a prompt edit as an unread
 * observation.
 */
export function collectedObservations(bundle) {
  const answers = Object.values(bundle?.answers ?? {}).filter(
    (answer) => typeof answer === "object" && answer !== null,
  );
  return {
    schemaVersion: bundle?.schemaVersion ?? null,
    answers: answers.length,
    notes: answers.filter(({ note }) => typeof note === "string" && note.length > 0).length,
    differences: answers.filter(
      ({ differsFromPick }) => typeof differsFromPick === "string" && differsFromPick !== "nothing",
    ).length,
    secondChoices: answers.filter(({ alsoCouldBe }) => Number(alsoCouldBe ?? 0) !== 0).length,
  };
}

const describeCollected = (collected) =>
  [
    `${collected.notes} written note${collected.notes === 1 ? "" : "s"}`,
    `${collected.differences} declared difference${collected.differences === 1 ? "" : "s"} other than "nothing"`,
    `${collected.secondChoices} second choice${collected.secondChoices === 1 ? "" : "s"} offered`,
  ].join(", ");

export function checkRunClosure(model = PART_IDENTIFICATION_MODEL_ID, out = DEFAULT_OUT) {
  const answersPath = answersPathFor(model, out);
  const reportPath = observationReportPath(out);
  if (!existsSync(answersPath)) {
    return {
      failures: [],
      note: `no vision answers at ${answersPath}, so nothing was collected to read`,
    };
  }
  const artifact = readJsonArtifact(answersPath, `vision answers for ${model}`);
  const collected = collectedObservations(artifact.value);
  const total = collected.notes + collected.differences + collected.secondChoices;
  if (total === 0) {
    return {
      failures: [],
      note:
        `${answersPath} holds ${collected.answers} answers under ${collected.schemaVersion} and carries no observation ` +
        `(no note, no declared difference, no second choice), so there is nothing unread`,
    };
  }

  let inputs;
  try {
    inputs = loadObservationInputs(model, out);
  } catch (error) {
    return {
      failures: [
        `${answersPath} (${artifact.digest}) collected ${describeCollected(collected)}, and nothing can read them.\n` +
          `  not read by: the answers no longer bind to the current run — ${error instanceof Error ? error.message : String(error)}\n` +
          `  satisfy it with: node scripts/part-identification.mjs ask --model ${model} against the current cards and prompt, then node scripts/part-identification.mjs observations --model ${model}.`,
      ],
    };
  }
  // Re-asks are collected output too, and a bundle left behind by a superseded
  // first pass is precisely the unread-collected-thing this gate is about. It
  // has to be reported as one rather than thrown as an unhandled error, or a
  // stale follow-up would take the gate down instead of appearing in it.
  let reasks;
  try {
    reasks = loadRecordedReasks(inputs, out);
  } catch (error) {
    return {
      failures: [
        `Re-asks were recorded against a different answer set, so nothing reads them.\n` +
          `  not read by: ${error instanceof Error ? error.message : String(error)}\n` +
          `  satisfy it with: node scripts/part-identification.mjs reask --model ${model}, or delete ${reasksPathFor(model, out)} if the questions are no longer worth putting.`,
      ],
    };
  }
  const expected = renderObservationReport(inputs, reasks);
  if (!existsSync(reportPath)) {
    return {
      failures: [
        `${answersPath} (${artifact.digest}) collected ${describeCollected(collected)}, and no report was produced from them.\n` +
          `  not read by: ${reportPath} does not exist\n` +
          `  satisfy it with: node scripts/part-identification.mjs observations --model ${model}`,
      ],
    };
  }
  const held = readBoundedFile(reportPath, {
    label: "part-identification observation report",
  }).toString("utf8");
  const difference = describeTextDifference(held, expected);
  if (difference !== null) {
    return {
      failures: [
        `${answersPath} (${artifact.digest}) collected ${describeCollected(collected)}, and the report that reads them is stale.\n` +
          `  not read by: ${reportPath} — ${difference}\n` +
          `  satisfy it with: node scripts/part-identification.mjs observations --model ${model}`,
      ],
    };
  }
  return {
    failures: [],
    note: `${reportPath} reads all of ${describeCollected(collected)} from ${answersPath}`,
  };
}

export function main(model = PART_IDENTIFICATION_MODEL_ID) {
  const failures = [...checkFieldReaders()];
  const run = checkRunClosure(model);
  failures.push(...run.failures);
  if (failures.length > 0) {
    console.error(
      `Observation consumer check failed: ${failures.length} collected thing${failures.length === 1 ? " is" : "s are"} not read.\n\n` +
        failures.map((failure) => `  ${failure.replaceAll("\n", "\n  ")}`).join("\n\n"),
    );
    return 1;
  }
  // The split is stated rather than summed. "9 fields have readers" would hide
  // that one of them only reaches a document, which is exactly the distinction
  // this gate exists to keep visible.
  const roles = Object.values(ANSWER_FIELD_READERS);
  const decides = roles.filter(({ role }) => role === "decides").length;
  console.log(
    `Observation consumer check passed: of ${roles.length} answer fields a mutation proves ${decides} change what the pipeline claims ` +
      `and ${roles.length - decides} change only the report; ${run.note}.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
