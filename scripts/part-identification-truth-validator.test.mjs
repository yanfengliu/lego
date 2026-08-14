import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { digest } from "./booklet-catalog-coverage-test-fixture.mjs";
import { assertPairJudgedTruthFromParsedJson } from "./part-identification-pair-judged.mjs";
import {
  PART_TRUTH_PATH,
  PART_TRUTH_SCHEMA,
  cropDigestKey,
} from "./part-identification-truth-key.mjs";

const ELEMENT_ID = "300501";
const LEAD_CROP = digest("crop-one");

const verdict = (same, overrides = {}) => ({
  n: 1,
  judgedCropSha256: cropDigestKey(LEAD_CROP),
  elementId: ELEMENT_ID,
  same,
  note: "synthetic",
  ...overrides,
});

const truth = (overrides) => ({
  schemaVersion: PART_TRUTH_SCHEMA,
  lastStep: 50,
  pairsJudged: 1,
  pairsUnjudgeable: 0,
  verdicts: [verdict(true)],
  unjudgeable: [],
  ...overrides,
});

describe("bounded pair-judged truth/3 input", () => {
  it("accepts a bounded synthetic verdict file", () => {
    expect(assertPairJudgedTruthFromParsedJson(truth({}))).toEqual({
      lastStep: 50,
      verdictCount: 1,
    });
  });

  it("validates the complete tracked truth/3 verdict and unjudgeable row accounting", () => {
    const tracked = JSON.parse(readFileSync(PART_TRUTH_PATH, "utf8"));
    expect(
      assertPairJudgedTruthFromParsedJson(tracked, `Tracked truth (${PART_TRUTH_PATH})`),
    ).toEqual({ lastStep: 50, verdictCount: 82 });
    expect(tracked.pairsUnjudgeable).toBe(2);
    expect(tracked.unjudgeable).toHaveLength(2);
    expect(tracked.source).toBe("deterministic");
    expect(tracked.assignment).toBe("one-to-one");
    expect(tracked.raters).toEqual({
      agreement: "84/84",
      primary: "claude-opus-5",
      secondary: "claude-fable-5 at max reasoning effort",
      descriptionDivergenceAdjudicated: [34, 38],
      adjudicationNote:
        "Both pairs were called same by both raters, so no label changed. On 38 the secondary was correct that both sides are a 1x1 plate and the arc under the callout is a booklet leader line rather than part geometry; on 34 the secondary was correct that both sides are a flat 2x2 tile. The primary reached the right verdict from a wrong description in both.",
    });
    expect(
      tracked.verdicts
        .filter(({ raterConfidence }) => raterConfidence !== undefined)
        .map(({ n, raterConfidence }) => ({ n, raterConfidence })),
    ).toEqual([
      { n: 33, raterConfidence: { primary: "medium", secondary: "medium" } },
      { n: 34, raterConfidence: { primary: "medium", secondary: "high" } },
      { n: 38, raterConfidence: { primary: "high", secondary: "medium" } },
      { n: 41, raterConfidence: { primary: "high", secondary: "medium" } },
      { n: 47, raterConfidence: { primary: "medium", secondary: "high" } },
      { n: 48, raterConfidence: { primary: "medium", secondary: "medium" } },
      { n: 78, raterConfidence: { primary: "high", secondary: "medium" } },
      { n: 79, raterConfidence: { primary: "medium", secondary: "medium" } },
    ]);
    expect(
      [...tracked.verdicts, ...tracked.unjudgeable]
        .map(({ n }) => n)
        .sort((left, right) => left - right),
    ).toEqual(Array.from({ length: 84 }, (_, index) => index + 1));
  });

  it("rejects a verdict whose outcome is not exactly true or false", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(truth({ verdicts: [verdict("yes")] })),
    ).toThrow(/must be exactly true or false/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({ verdicts: [{ ...verdict(true), same: undefined }] }),
      ),
    ).toThrow(/must be exactly true or false/u);
  });

  it("rejects detached top-level and row fields outside truth/3", () => {
    expect(() => assertPairJudgedTruthFromParsedJson(truth({ detached: true }))).toThrow(
      /unsupported top-level fields \["detached"\]/u,
    );
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({ verdicts: [{ ...verdict(true), detached: "not evidence" }] }),
      ),
    ).toThrow(/verdict.*unsupported fields \["detached"\]/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 0,
          pairsUnjudgeable: 1,
          verdicts: [],
          unjudgeable: [
            {
              n: 1,
              judgedCropSha256: digest("unjudgeable-exact-shape"),
              elementId: null,
              reason: "synthetic",
              callouts: 1,
              pieces: 1,
              detached: true,
            },
          ],
        }),
      ),
    ).toThrow(/must retain an integer n, exact full crop digest/u);
  });

  it("bounds and authenticates the retained assignment and rater metadata", () => {
    const raters = {
      agreement: "1/1",
      primary: "primary-model",
      secondary: "secondary-model",
      descriptionDivergenceAdjudicated: [],
      adjudicationNote: "No description divergence needed adjudication.",
    };
    expect(
      assertPairJudgedTruthFromParsedJson(
        truth({ source: "deterministic", assignment: "one-to-one", raters }),
      ),
    ).toEqual({ lastStep: 50, verdictCount: 1 });
    expect(() => assertPairJudgedTruthFromParsedJson(truth({ source: "vision" }))).toThrow(
      /source must be deterministic or adjudicated/u,
    );
    expect(() =>
      assertPairJudgedTruthFromParsedJson(truth({ assignment: "cluster-greedy" })),
    ).toThrow(/assignment must be nearest, one-to-one, or quantity-informed/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(truth({ raters: { ...raters, detached: true } })),
    ).toThrow(/raters must contain exactly/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(truth({ raters: { ...raters, agreement: "0/2" } })),
    ).toThrow(/reviewed count equals all 1 pair-sheet rows/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 2,
          verdicts: [
            verdict(true, { n: 1 }),
            verdict(true, { n: 2, judgedCropSha256: digest("second-rater-row") }),
          ],
          raters: {
            ...raters,
            agreement: "2/2",
            descriptionDivergenceAdjudicated: [1, 1],
          },
        }),
      ),
    ).toThrow(/unique pair-sheet ordinals in strictly increasing order/u);
  });

  it("rejects malformed optional per-rater confidence instead of ignoring it", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          verdicts: [
            verdict(true, {
              raterConfidence: { primary: "medium", secondary: "certain" },
            }),
          ],
        }),
      ),
    ).toThrow(/raterConfidence.*exactly primary and secondary.*low, medium, or high/u);
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          verdicts: [
            verdict(true, {
              raterConfidence: { primary: "medium", secondary: "high", detached: true },
            }),
          ],
        }),
      ),
    ).toThrow(/raterConfidence.*exactly primary and secondary/u);
  });

  it("rejects the same pair judged twice rather than letting file order decide", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 2,
          verdicts: [verdict(true), verdict(false, { n: 2 })],
        }),
      ),
    ).toThrow(/judges the same pair twice/u);
  });

  it("rejects a superseded schema instead of guessing at its keys", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({ schemaVersion: "lego.part-identification-truth/2" }),
      ),
    ).toThrow(/only lego\.part-identification-truth\/3.*Schema \/2 stores only a crop prefix/u);
  });

  it("rejects a judged range that is not a printed step", () => {
    expect(() => assertPairJudgedTruthFromParsedJson(truth({ lastStep: 0 }))).toThrow(
      /from 1 through 359/u,
    );
    expect(() => assertPairJudgedTruthFromParsedJson(truth({ lastStep: 360 }))).toThrow(
      /from 1 through 359/u,
    );
  });

  it("rejects an unbounded verdict list", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 4_001,
          verdicts: Array.from({ length: 4_001 }, (_, index) => verdict(true, { n: index })),
        }),
      ),
    ).toThrow(/bounded maximum is 4000/u);
  });

  it("bounds the combined judged and unjudgeable rows before ordinal sorting", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 0,
          pairsUnjudgeable: 4_001,
          verdicts: [],
          unjudgeable: Array.from({ length: 4_001 }, (_, index) => ({
            n: index + 1,
            judgedCropSha256: digest(`unjudgeable-${index}`),
            elementId: null,
            reason: "synthetic",
            callouts: 1,
            pieces: 1,
          })),
        }),
      ),
    ).toThrow(/4001 total judged and unjudgeable.*bounded maximum is 4000/u);
  });

  it("requires pair-sheet ordinals to cover the complete contiguous row range", () => {
    expect(() =>
      assertPairJudgedTruthFromParsedJson(
        truth({
          pairsJudged: 1,
          pairsUnjudgeable: 1,
          verdicts: [verdict(true, { n: 1 })],
          unjudgeable: [
            {
              n: 84,
              judgedCropSha256: digest("unjudgeable-gap"),
              elementId: null,
              reason: "synthetic",
              callouts: 1,
              pieces: 1,
            },
          ],
        }),
      ),
    ).toThrow(/cover every row from 1 through 2 exactly once/u);
  });
});
