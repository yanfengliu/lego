import { describe, expect, it } from "vitest";

import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
} from "./part-identification-artifacts.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;

function fixture() {
  const featuresArtifact = {
    digest: digest("a"),
    value: {
      schemaVersion: PART_FEATURES_SCHEMA,
      inputDigests: { pdf: digest("b"), calloutManifest: digest("c") },
      manifestCalloutCount: 1,
      calloutCount: 1,
      nonClusteredCalloutCount: 0,
      nonClusteredCallouts: [],
      callouts: [
        {
          identity: "p11|q1|x1.000|y1.000",
          file: "runs/run/p11-q1-x1d000-y1d000.png",
          quantity: 1,
          evidenceKind: "part-art",
          descriptor: { pixels: 1 },
        },
      ],
    },
  };
  const matchArtifact = {
    digest: digest("d"),
    value: {
      schemaVersion: PART_MATCH_SCHEMA,
      featuresDigest: featuresArtifact.digest,
      calloutCount: 1,
      clusterCount: 1,
      clusters: [
        {
          clusterIndex: 0,
          lead: featuresArtifact.value.callouts[0].file,
          members: [0],
          pieces: 1,
          candidates: [{ elementId: "300501", total: 0.1 }],
        },
      ],
    },
  };
  const distancesArtifact = {
    digest: digest("e"),
    value: {
      schemaVersion: PART_DISTANCES_SCHEMA,
      featuresDigest: featuresArtifact.digest,
      elementIds: ["300501"],
      rows: [[0.1]],
    },
  };
  return { featuresArtifact, matchArtifact, distancesArtifact };
}

describe("part-identification artifact bindings", () => {
  it("accepts one exact feature, match, and distance closure", () => {
    const artifacts = fixture();
    expect(assertBoundMatchArtifacts(artifacts)).toMatchObject({
      features: artifacts.featuresArtifact.value,
      match: artifacts.matchArtifact.value,
      distances: artifacts.distancesArtifact.value,
    });
  });

  it("rejects stale feature digests and non-partitioning cluster indexes", () => {
    const stale = fixture();
    stale.matchArtifact.value.featuresDigest = digest("f");
    expect(() => assertBoundMatchArtifacts(stale)).toThrow(/exact features digest/);

    const duplicated = fixture();
    duplicated.matchArtifact.value.clusters[0].members = [];
    expect(() => assertBoundMatchArtifacts(duplicated)).toThrow(
      /partition every physical part-art feature/,
    );

    const reranked = fixture();
    reranked.matchArtifact.value.clusters[0].candidates[0].elementId = "wrong";
    expect(() => assertBoundMatchArtifacts(reranked)).toThrow(/exact ranked prefix/);
  });

  it("requires semantic records to be explicit and impossible to cluster", () => {
    const artifacts = fixture();
    const semantic = {
      identity: "p33|q4|x274.854|y340.077",
      file: "runs/run/p33-q4-x274d854-y340d077.png",
      quantity: 4,
      evidenceKind: "subassembly-repeat",
    };
    artifacts.featuresArtifact.value.callouts.push(semantic);
    artifacts.featuresArtifact.value.manifestCalloutCount = 2;
    artifacts.featuresArtifact.value.nonClusteredCalloutCount = 1;
    artifacts.featuresArtifact.value.nonClusteredCallouts = [
      {
        index: 1,
        identity: semantic.identity,
        file: semantic.file,
        evidenceKind: semantic.evidenceKind,
      },
    ];

    expect(assertBoundMatchArtifacts(artifacts).features.nonClusteredCallouts).toEqual([
      expect.objectContaining({ index: 1, identity: semantic.identity }),
    ]);

    artifacts.matchArtifact.value.clusters[0].members.push(1);
    artifacts.matchArtifact.value.clusters[0].pieces += semantic.quantity;
    expect(() => assertBoundMatchArtifacts(artifacts)).toThrow(
      /exclude every explicit non-clustered semantic index/,
    );

    artifacts.matchArtifact.value.clusters[0].members.pop();
    artifacts.matchArtifact.value.clusters[0].pieces -= semantic.quantity;
    artifacts.featuresArtifact.value.nonClusteredCallouts = [];
    expect(() => assertBoundMatchArtifacts(artifacts)).toThrow(
      /explicitly exclude every non-part-art record/,
    );
  });

  it("rejects legacy or cross-match vision answers", () => {
    const matchDigest = digest("d");
    const cardsDigest = digest("c");
    const answers = { 0: { pick: 1 } };
    expect(
      boundAnswers(
        {
          value: {
            schemaVersion: PART_ANSWERS_SCHEMA,
            model: "sonnet",
            matchDigest,
            cardsDigest,
            answers,
          },
        },
        { model: "sonnet", matchDigest, cardsDigest, clusterIndexes: [0] },
      ),
    ).toBe(answers);
    expect(() =>
      boundAnswers(
        { value: answers },
        { model: "sonnet", matchDigest, cardsDigest, clusterIndexes: [0] },
      ),
    ).toThrow(/cluster indexes cannot cross a match change/);
    expect(() =>
      boundAnswers(
        {
          value: {
            schemaVersion: PART_ANSWERS_SCHEMA,
            model: "sonnet",
            matchDigest: digest("e"),
            cardsDigest,
            answers,
          },
        },
        { model: "sonnet", matchDigest, cardsDigest, clusterIndexes: [0] },
      ),
    ).toThrow(/cluster indexes cannot cross a match change/);
    expect(() =>
      boundAnswers(
        {
          value: {
            schemaVersion: PART_ANSWERS_SCHEMA,
            model: "sonnet",
            matchDigest,
            cardsDigest,
            answers: { 1: { pick: 1 } },
          },
        },
        { model: "sonnet", matchDigest, cardsDigest, clusterIndexes: [0] },
      ),
    ).toThrow(/cluster indexes cannot cross a match change/);
  });

  it("requires exactly one canonical card digest per match cluster", () => {
    const matchDigest = digest("d");
    const cardDigest = digest("c");
    const artifact = {
      value: {
        schemaVersion: PART_CARDS_SCHEMA,
        matchDigest,
        cards: { "card-0000": cardDigest },
      },
    };
    expect(assertCardsArtifact(artifact, { matchDigest, clusterIndexes: [0] })).toBe(
      artifact.value,
    );
    for (const cards of [
      {},
      { "card-0001": cardDigest },
      { "card-0000": cardDigest, "card-0001": cardDigest },
    ]) {
      expect(() =>
        assertCardsArtifact(
          { value: { ...artifact.value, cards } },
          { matchDigest, clusterIndexes: [0] },
        ),
      ).toThrow(/exactly one canonical card digest/);
    }
  });
});
