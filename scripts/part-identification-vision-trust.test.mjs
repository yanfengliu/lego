import { describe, expect, it } from "vitest";

import { sha256Digest } from "./part-identification-artifacts.mjs";
import {
  claimsFor,
  scoreAgainstTruth,
  snapshotScoreSummaryInputDigests,
} from "./part-identification-score.mjs";
import { cropDigestKey } from "./part-identification-truth-key.mjs";

describe("part-identification vision trust closure", () => {
  it("binds every summary variant to one shared generation while retaining variant roles", () => {
    const digestFor = (label) => sha256Digest(Buffer.from(label));
    const first = snapshotScoreSummaryInputDigests(
      {
        features: digestFor("features"),
        match: digestFor("match"),
        distances: digestFor("distances"),
        inventoryLabels: digestFor("inventory"),
        elementResolution: digestFor("resolution"),
        truthFirstFifty: digestFor("truth"),
        cards: digestFor("cards-a"),
        answers: digestFor("answers-a"),
      },
      "first",
    );
    const second = snapshotScoreSummaryInputDigests(
      {
        ...first.shared,
        cards: digestFor("cards-b"),
        cardImages: digestFor("images-b"),
        answers: digestFor("answers-b"),
      },
      "second",
      first.shared,
    );

    expect(second.all).toEqual({
      ...first.shared,
      cards: digestFor("cards-b"),
      cardImages: digestFor("images-b"),
      answers: digestFor("answers-b"),
    });
    expect(() =>
      snapshotScoreSummaryInputDigests(
        { ...second.all, distances: digestFor("mutated-between-variants") },
        "mutated",
        first.shared,
      ),
    ).toThrow(/changed shared input digest distances/u);
  });

  it("does not score a nonidentical cluster member from its lead's crop verdict", () => {
    const prefix = "b".repeat(16);
    const leadSha256 = `sha256:${prefix}${"1".repeat(48)}`;
    const memberSha256 = `sha256:${prefix}${"2".repeat(48)}`;
    const features = {
      callouts: [
        {
          evidenceKind: "part-art",
          file: "lead.png",
          stepNumber: 1,
          quantity: 1,
          identity: "lead",
          sha256: leadSha256,
        },
        {
          evidenceKind: "part-art",
          file: "member.png",
          stepNumber: 1,
          quantity: 1,
          identity: "member",
          sha256: memberSha256,
        },
      ],
    };
    const claims = new Map([
      [0, { clusterIndex: 0, elementId: "300501" }],
      [1, { clusterIndex: 0, elementId: "300501" }],
    ]);
    const truth = {
      schemaVersion: "lego.part-identification-truth/3",
      method: "pair-verification",
      note: "synthetic",
      lastStep: 1,
      pairsJudged: 1,
      pairsUnjudgeable: 0,
      verdicts: [
        {
          n: 1,
          judgedCropSha256: cropDigestKey(leadSha256),
          elementId: "300501",
          same: true,
        },
      ],
      unjudgeable: [],
    };
    const score = scoreAgainstTruth(truth, features, { clusters: [] }, claims, new Map());

    expect(score).toMatchObject({ calloutsJudged: 1, calloutsUnjudged: 1 });
    expect(score.rows.map(({ verdict }) => verdict)).toEqual(["same", "unjudged"]);
    expect(score.rows[1].judgedCropSha256).toBeNull();

    const claimInvalidated = scoreAgainstTruth(
      {
        ...truth,
        verdicts: [{ ...truth.verdicts[0], elementId: "999999" }],
      },
      features,
      { clusters: [] },
      claims,
      new Map(),
    );
    expect(claimInvalidated).toMatchObject({
      calloutsJudged: 0,
      verdictsUnboundToCurrentClaims: 1,
      unboundVerdictsTruncated: 0,
    });
    expect(claimInvalidated.unboundVerdicts).toEqual([
      expect.objectContaining({ n: 1, judgedElementId: "999999" }),
    ]);
  });

  it("scores a nonlead only from its own exact crop-and-element verdict", () => {
    const leadSha256 = sha256Digest(Buffer.from("score-lead"));
    const memberSha256 = sha256Digest(Buffer.from("score-member"));
    const features = {
      callouts: [
        {
          evidenceKind: "part-art",
          file: "lead.png",
          stepNumber: 1,
          quantity: 1,
          identity: "lead",
          sha256: leadSha256,
        },
        {
          evidenceKind: "part-art",
          file: "member.png",
          stepNumber: 1,
          quantity: 2,
          identity: "member",
          sha256: memberSha256,
        },
      ],
    };
    const claims = new Map([
      [0, { clusterIndex: 0, elementId: "300501" }],
      [1, { clusterIndex: 0, elementId: "300501" }],
    ]);
    const truth = {
      schemaVersion: "lego.part-identification-truth/3",
      method: "pair-verification",
      note: "synthetic",
      lastStep: 1,
      pairsJudged: 2,
      pairsUnjudgeable: 0,
      verdicts: [
        { n: 1, judgedCropSha256: leadSha256, elementId: "300501", same: true },
        { n: 2, judgedCropSha256: memberSha256, elementId: "300501", same: false },
      ],
      unjudgeable: [],
    };
    const score = scoreAgainstTruth(truth, features, { clusters: [] }, claims, new Map());

    expect(score).toMatchObject({
      calloutsJudged: 2,
      drawingsJudged: 2,
      correct: 1,
      piecesJudged: 3,
      piecesCorrect: 1,
    });
    expect(score.rows.map(({ verdict }) => verdict)).toEqual(["same", "different"]);
    expect(score.rows.map(({ judgedCropSha256 }) => judgedCropSha256)).toEqual([
      leadSha256,
      memberSha256,
    ]);
  });

  it("keeps vision trust on the reviewed lead crop and marks every member unreviewed", () => {
    const cluster = {
      clusterIndex: 0,
      members: [0, 1, 2],
      memberTopElementIds: ["300502", "300501", null],
      candidates: [{ elementId: "300501", total: 0.1 }],
    };
    const answer = {
      kind: "brick",
      studsLong: 1,
      studsWide: 1,
      colour: "black",
      pick: 1,
      alsoCouldBe: 0,
      differsFromPick: "nothing",
      confidence: 0.9,
    };
    const claims = claimsFor(
      { clusters: [cluster] },
      { elementIds: ["300501"], rows: [[0.1]] },
      "adjudicated",
      { 0: answer },
      {
        assign: "nearest",
        names: new Map([["300501", { name: "Brick 1 x 1", colorId: 0 }]]),
        cards: { "card-0000": { candidateElementIds: ["300501"] } },
      },
    );

    expect(claims.get(0)?.picked).toBe("vision-kept");
    expect(claims.get(1)?.picked).toBe("vision-member-unreviewed");
    expect(claims.get(2)?.picked).toBe("vision-member-unreviewed");
  });
});
