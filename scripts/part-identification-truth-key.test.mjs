import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PART_TRUTH_PATH,
  PART_TRUTH_SCHEMA,
  judgedPairs,
  truthVerdictKey,
  verdictsByCropDigest,
} from "./part-identification-truth-key.mjs";

const CROP_A = `sha256:${"a".repeat(64)}`;
const CROP_B = `sha256:${"b".repeat(64)}`;

function callout(overrides) {
  return {
    identity: "p11|q1|x43.074|y486.271",
    file: "runs/r0/p11-q1-x43d074-y486d271.png",
    sha256: CROP_A,
    stepNumber: 1,
    quantity: 1,
    evidenceKind: "part-art",
    ...overrides,
  };
}

describe("first-fifty truth keys", () => {
  it("binds a verdict through a cluster renumbering", () => {
    // The defect this schema exists to prevent: `match` renumbers clusters on
    // every re-cut, so 87 intact verdicts scored calloutsJudged 0 against the
    // live closure purely because the key was a list position.
    const features = { callouts: [callout({})] };
    const before = judgedPairs(
      features,
      new Map([[0, { clusterIndex: 42, elementId: "6101857" }]]),
      50,
    );
    const after = judgedPairs(
      features,
      new Map([[0, { clusterIndex: 207, elementId: "6101857" }]]),
      50,
    );

    const [beforePair] = [...before.values()];
    const [afterPair] = [...after.values()];
    expect(beforePair.clusterIndex).not.toBe(afterPair.clusterIndex);
    expect(truthVerdictKey(beforePair.leadSha256, beforePair.elementId)).toBe(
      truthVerdictKey(afterPair.leadSha256, afterPair.elementId),
    );
  });

  it("stops binding when the judged picture changes", () => {
    // The intended invalidation: nobody judged the new picture.
    expect(truthVerdictKey(CROP_A, "6101857")).not.toBe(truthVerdictKey(CROP_B, "6101857"));
  });

  it("refuses a stored truncation rather than treating a prefix as byte identity", () => {
    const stored = CROP_A.slice(0, "sha256:".length + 16);
    expect(() => truthVerdictKey(stored, "6101857")).toThrow(/exactly 64 lowercase hex/u);
  });

  it("refuses a digest too short to be a key rather than padding it", () => {
    expect(() => truthVerdictKey(`sha256:${"a".repeat(8)}`, "6101857")).toThrow(
      /exactly 64 lowercase hex/u,
    );
  });

  it("leaves a changed claim unjudged rather than inheriting the verdict", () => {
    // This property survived from the first schema and must not be lost.
    expect(truthVerdictKey(CROP_A, "6101857")).not.toBe(truthVerdictKey(CROP_A, "4160025"));
  });

  it("counts a verdict that names no crop as unbindable rather than absent", () => {
    // A dead key previously read as a plausible "0/0", which is indistinguishable
    // from "nobody ever labelled this".
    const { bound, unbindable } = verdictsByCropDigest({
      verdicts: [
        { clusterIndex: 42, elementId: "6101857", same: true },
        { judgedCropSha256: CROP_A, elementId: "6101857", same: true },
      ],
    });
    expect(unbindable).toBe(1);
    expect(bound.size).toBe(1);
  });

  it("groups only byte-identical crops with the same element into one judged pair", () => {
    const features = {
      callouts: [
        callout({ sha256: CROP_A, quantity: 2 }),
        callout({ sha256: CROP_B, quantity: 3, file: "runs/r0/p12-q1-x10-y20.png", stepNumber: 4 }),
      ],
    };
    const claims = new Map([
      [0, { clusterIndex: 7, elementId: "6101857" }],
      [1, { clusterIndex: 7, elementId: "6101857" }],
    ]);
    const pairs = judgedPairs(features, claims, 50);
    expect(pairs.size).toBe(2);
    expect([...pairs.values()].map(({ leadSha256 }) => leadSha256)).toEqual([CROP_A, CROP_B]);

    const duplicate = judgedPairs(
      {
        callouts: [
          callout({ sha256: CROP_A, quantity: 2 }),
          callout({ sha256: CROP_A, quantity: 3, file: "duplicate.png", stepNumber: 4 }),
        ],
      },
      claims,
      50,
    );
    expect(duplicate.size).toBe(1);
    expect([...duplicate.values()][0]).toMatchObject({
      leadSha256: CROP_A,
      callouts: 2,
      pieces: 5,
      firstStep: 1,
    });
  });

  it("keeps a drawing that was claimed as nothing out of the key space entirely", () => {
    // Found by running the scorer, not by a unit test: the assignment can leave
    // a drawing unclaimed, and the old string key quietly became "null:null" and
    // never matched. A strict key throws instead, so the caller has to say what
    // an unclaimed drawing means - it is unjudged, because its pair had no
    // right-hand side to look at.
    const features = { callouts: [callout({})] };
    const pairs = judgedPairs(features, new Map([[0, { clusterIndex: 3, elementId: null }]]), 50);
    const [pair] = [...pairs.values()];
    expect(pair.elementId).toBeNull();
    expect(() => truthVerdictKey(pair.leadSha256, pair.elementId)).toThrow(/non-empty element id/u);
  });

  it("keeps the shipped label set present and bindable", () => {
    // These labels cost two full blind judging passes, nothing regenerates
    // them, and they previously lived under an ignored output root where a
    // gallery re-cut left all 87 of them unbound and nobody noticed, because a
    // dead key reports a plausible 0/0. Tracking them is only half the fix; a
    // gate that fails when they go missing or stop being keyable is the rest.
    const truth = JSON.parse(readFileSync(PART_TRUTH_PATH, "utf8"));
    expect(truth.schemaVersion).toBe(PART_TRUTH_SCHEMA);
    expect(truth.verdicts.length).toBeGreaterThan(0);
    expect(truth.verdicts).toHaveLength(truth.pairsJudged);

    const { bound, unbindable } = verdictsByCropDigest(truth);
    expect(unbindable).toBe(0);
    expect(bound.size).toBe(truth.verdicts.length);

    // Every unjudgeable pair must say why rather than merely be absent.
    for (const pair of truth.unjudgeable) {
      expect(pair.elementId).toBeNull();
      expect(pair.reason).toMatch(/\S/u);
    }
  });

  it("refuses a malformed key rather than producing one that silently never matches", () => {
    expect(() => truthVerdictKey("not-a-digest", "6101857")).toThrow(
      /sha256:.*exactly 64 lowercase hex/su,
    );
    expect(() => truthVerdictKey(CROP_A, "")).toThrow(/non-empty element id/u);
  });
});
