import { describe, expect, it } from "vitest";

import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  PartIdentificationArtifactBindingError,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  assertFeaturesArtifact,
  authenticateJsonArtifact,
  boundAnswers,
  deriveCardRunId,
  jsonArtifactFromBytes,
} from "./part-identification-artifacts.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
} from "./part-identification-model.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;
const run = "0123456789abcdef01234567";

const artifact = (value) =>
  jsonArtifactFromBytes(Buffer.from(JSON.stringify(value)), "test JSON artifact");

const answer = (overrides = {}) => ({
  kind: "brick",
  studsLong: 1,
  studsWide: 1,
  colour: "black",
  pick: 1,
  alsoCouldBe: 0,
  differsFromPick: "nothing",
  confidence: 0.9,
  ...overrides,
});

const descriptor = (value = 0) => ({
  grid: Array(28 * 28).fill(value),
  detail: Array(28 * 28).fill(value),
  aspect: 1,
  ink: 1,
  pixels: 1,
  boxWidth: 1,
  boxHeight: 1,
  mean: [value, value, value],
  lightFace: value,
  colours: [{ rgb: [value, value, value], share: 1 }],
});

const clusters = [{ clusterIndex: 0, candidates: [{ elementId: "300501" }] }];
const cards = {
  "card-0000": { sha256: digest("c"), candidateElementIds: ["300501"] },
};

function callout(overrides = {}) {
  return {
    identity: "p11|q1|x1.000|y1.000",
    file: `runs/${run}/p11-q1-x1d000-y1d000.png`,
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 1,
    yPt: 1,
    evidenceKind: "part-art",
    sha256: digest("1"),
    descriptor: descriptor(),
    ...overrides,
  };
}

function fixture(featureOverrides = {}) {
  const features = {
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: digest("b"), calloutManifest: digest("c") },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    inventory: { 300501: descriptor() },
    inventorySourceDigests: { 300501: digest("a") },
    callouts: [callout()],
    ...featureOverrides,
  };
  const featuresArtifact = artifact(features);
  const match = {
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    calloutCount: 1,
    clusterCount: 1,
    clusters: [
      {
        clusterIndex: 0,
        lead: features.callouts[0].file,
        members: [0],
        pieces: 1,
        candidates: [{ elementId: "300501", total: 0.1 }],
      },
    ],
  };
  const distances = {
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    elementIds: ["300501"],
    rows: [[0.1]],
  };
  return {
    featuresArtifact,
    matchArtifact: artifact(match),
    distancesArtifact: artifact(distances),
  };
}

function answersArtifact({ matchDigest, cardsDigest, promptDigest, answers }) {
  return artifact({
    schemaVersion: PART_ANSWERS_SCHEMA,
    model: PART_IDENTIFICATION_MODEL_ID,
    modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    matchDigest,
    cardsDigest,
    promptDigest,
    answers,
  });
}

describe("part-identification artifact bindings", () => {
  it("accepts one raw-byte-derived feature, match, and distance closure", () => {
    const artifacts = fixture();
    const closure = assertBoundMatchArtifacts(artifacts);
    expect(closure).toMatchObject({
      features: artifacts.featuresArtifact.value,
      match: artifacts.matchArtifact.value,
      distances: artifacts.distancesArtifact.value,
    });
    expect(closure.artifacts.features.digest).toBe(artifacts.featuresArtifact.digest);
  });

  it("rejects detached, stale, or caller-forged digest/value views", () => {
    const exact = artifact({ trusted: true });
    expect(() => authenticateJsonArtifact({ value: exact.value, digest: exact.digest })).toThrow(
      /must carry its raw bytes/,
    );
    expect(() => authenticateJsonArtifact({ ...exact, digest: digest("f") })).toThrow(
      /raw bytes derive/,
    );
    expect(() => authenticateJsonArtifact({ ...exact, value: { trusted: false } })).toThrow(
      /does not derive from its raw bytes/,
    );
  });

  it("snapshots each caller-supplied artifact field exactly once before authentication", () => {
    const exact = artifact({ trusted: true });
    const reads = { bytes: 0, digest: 0, value: 0 };
    const accessorArtifact = {
      get bytes() {
        reads.bytes += 1;
        return exact.bytes;
      },
      get digest() {
        reads.digest += 1;
        return exact.digest;
      },
      get value() {
        reads.value += 1;
        return exact.value;
      },
    };

    const authenticated = authenticateJsonArtifact(accessorArtifact, "accessor artifact");

    expect(authenticated).toEqual(exact);
    expect(reads).toEqual({ bytes: 1, digest: 1, value: 1 });
  });

  it("rejects malformed UTF-8 and duplicate keys at every nesting level", () => {
    expect(() =>
      jsonArtifactFromBytes(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])),
    ).toThrow(/not valid JSON/);
    expect(() => jsonArtifactFromBytes(Buffer.from('{"outer":{"same":1,"s\\u0061me":2}}'))).toThrow(
      /repeats key "same"/,
    );
  });

  it("rejects stale feature digests, invalid partitions, and reranked candidates", () => {
    const stale = fixture();
    stale.matchArtifact = artifact({
      ...stale.matchArtifact.value,
      featuresDigest: digest("f"),
    });
    expect(() => assertBoundMatchArtifacts(stale)).toThrow(/exact features digest/);

    const duplicated = fixture();
    duplicated.matchArtifact = artifact({
      ...duplicated.matchArtifact.value,
      clusters: [{ ...duplicated.matchArtifact.value.clusters[0], members: [] }],
    });
    expect(() => assertBoundMatchArtifacts(duplicated)).toThrow(
      /partition every physical part-art feature/,
    );

    const reranked = fixture();
    reranked.matchArtifact = artifact({
      ...reranked.matchArtifact.value,
      clusters: [
        {
          ...reranked.matchArtifact.value.clusters[0],
          candidates: [{ elementId: "300502", total: 0.1 }],
        },
      ],
    });
    expect(() => assertBoundMatchArtifacts(reranked)).toThrow(/exact ranked prefix/);
  });

  it("rejects a descriptor population whose bounded shapes still imply excessive total work", () => {
    const shared = descriptor();
    const callouts = Array.from({ length: 700 }, (_, index) => {
      const pageNumber = index + 1;
      return callout({
        identity: `p${pageNumber}|q1|x1.000|y1.000`,
        file: `runs/${run}/p${pageNumber}-q1-x1d000-y1d000.png`,
        pageNumber,
        stepNumber: pageNumber,
        descriptor: shared,
      });
    });
    const inventory = Object.fromEntries(
      Array.from({ length: 700 }, (_, index) => [String(300_000 + index), shared]),
    );
    const inventorySourceDigests = Object.fromEntries(
      Object.keys(inventory).map((elementId) => [elementId, digest("a")]),
    );
    const features = artifact({
      schemaVersion: PART_FEATURES_SCHEMA,
      inputDigests: { pdf: digest("b"), calloutManifest: digest("c") },
      manifestCalloutCount: callouts.length,
      calloutCount: callouts.length,
      nonClusteredCalloutCount: 0,
      nonClusteredCallouts: [],
      inventory,
      inventorySourceDigests,
      callouts,
    });
    expect(() => assertFeaturesArtifact(features)).toThrow(
      /no more than 536870912 worst-case descriptor-cell comparisons.*Observed worst-case work 575965600/s,
    );
  });

  it("requires one exact inventory source-image digest for every descriptor and no extras", () => {
    for (const inventorySourceDigests of [
      {},
      { 300501: digest("a"), 300502: digest("b") },
      { 300501: "sha256:not-a-digest" },
    ]) {
      const artifacts = fixture({ inventorySourceDigests });
      expect(() => assertBoundMatchArtifacts(artifacts)).toThrow(
        /every inventory source-image digest/,
      );
    }
  });

  it("requires semantic records to be explicit and impossible to cluster", () => {
    const semantic = callout({
      identity: "p33|q4|x274.854|y340.077",
      file: `runs/${run}/p33-q4-x274d854-y340d077.png`,
      pageNumber: 33,
      stepNumber: 29,
      quantity: 4,
      xPt: 274.854,
      yPt: 340.077,
      evidenceKind: "subassembly-repeat",
      sha256: digest("2"),
      descriptor: undefined,
    });
    delete semantic.descriptor;
    const artifacts = fixture({
      manifestCalloutCount: 2,
      nonClusteredCalloutCount: 1,
      nonClusteredCallouts: [
        {
          index: 1,
          identity: semantic.identity,
          file: semantic.file,
          evidenceKind: semantic.evidenceKind,
        },
      ],
      callouts: [callout(), semantic],
    });
    expect(assertBoundMatchArtifacts(artifacts).features.nonClusteredCallouts).toEqual([
      expect.objectContaining({ index: 1, identity: semantic.identity }),
    ]);

    artifacts.matchArtifact = artifact({
      ...artifacts.matchArtifact.value,
      clusters: [
        {
          ...artifacts.matchArtifact.value.clusters[0],
          members: [0, 1],
          pieces: 5,
        },
      ],
    });
    expect(() => assertBoundMatchArtifacts(artifacts)).toThrow(
      /exclude every explicit non-clustered semantic index/,
    );
  });

  it("binds answers to model, match, cards, prompt, indexes, and exact schema", () => {
    const matchDigest = digest("d");
    const cardsDigest = digest("c");
    const promptDigest = digest("1");
    const answers = { 0: answer() };
    expect(
      boundAnswers(answersArtifact({ matchDigest, cardsDigest, promptDigest, answers }), {
        model: PART_IDENTIFICATION_MODEL_ID,
        matchDigest,
        cardsDigest,
        promptDigest,
        clusters,
        cards,
      }),
    ).toEqual(answers);

    for (const changed of [
      { matchDigest: digest("e") },
      { promptDigest: digest("2") },
      { answers: { 1: answer() } },
      { answers: { 0: { pick: 1 } } },
      {
        modelIdentity: {
          ...PART_IDENTIFICATION_MODEL_IDENTITY,
          responseModelId: "moving-alias",
        },
      },
    ]) {
      const value = {
        schemaVersion: PART_ANSWERS_SCHEMA,
        model: PART_IDENTIFICATION_MODEL_ID,
        modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
        matchDigest,
        cardsDigest,
        promptDigest,
        answers,
        ...changed,
      };
      let observed;
      try {
        boundAnswers(artifact(value), {
          model: PART_IDENTIFICATION_MODEL_ID,
          matchDigest,
          cardsDigest,
          promptDigest,
          clusters,
          cards,
        });
      } catch (error) {
        observed = error;
      }
      expect(observed).toBeInstanceOf(PartIdentificationArtifactBindingError);
      expect(observed).toMatchObject({ artifactRole: "identification-answers" });
    }
  });

  it("requires exactly one canonical card digest per match cluster", () => {
    const featuresDigest = digest("f");
    const matchDigest = digest("d");
    const cardDigest = digest("c");
    const cardClusters = [
      {
        clusterIndex: 0,
        candidates: [{ elementId: "300501" }, { elementId: "300502" }],
      },
    ];
    const cardEntries = {
      "card-0000": { sha256: cardDigest, candidateElementIds: ["300501"] },
    };
    const runId = deriveCardRunId(featuresDigest, matchDigest, cardEntries);
    const value = {
      schemaVersion: PART_CARDS_SCHEMA,
      featuresDigest,
      matchDigest,
      runId,
      imagesFile: `runs/${runId}/images.bin`,
      cards: {
        "card-0000": {
          ...cardEntries["card-0000"],
          file: `runs/${runId}/card-0000.png`,
        },
      },
    };
    expect(
      assertCardsArtifact(artifact(value), {
        featuresDigest,
        matchDigest,
        clusters: cardClusters,
      }),
    ).toEqual(value);
    expect(() =>
      assertCardsArtifact(artifact(value), {
        featuresDigest: digest("e"),
        matchDigest,
        clusters: cardClusters,
      }),
    ).toThrow(/exact features\/match digests/);
    for (const cards of [
      {},
      { "card-0001": { sha256: cardDigest, candidateElementIds: ["300501"] } },
      {
        "card-0000": { sha256: cardDigest, candidateElementIds: ["300501"] },
        "card-0001": { sha256: cardDigest, candidateElementIds: ["300501"] },
      },
      { "card-0000": { sha256: cardDigest, candidateElementIds: ["300502"] } },
      {
        "card-0000": {
          sha256: cardDigest,
          candidateElementIds: ["300502", "300501"],
        },
      },
    ]) {
      expect(() =>
        assertCardsArtifact(artifact({ ...value, cards }), {
          featuresDigest,
          matchDigest,
          clusters: cardClusters,
        }),
      ).toThrow(
        /exactly one run-contained card digest\/file plus the exact displayed ordered candidate prefix/,
      );
    }
  });

  it("rejects a pick beyond the exact candidates displayed on its bound card", () => {
    const matchDigest = digest("d");
    const cardsDigest = digest("c");
    const promptDigest = digest("1");
    expect(() =>
      boundAnswers(
        answersArtifact({
          matchDigest,
          cardsDigest,
          promptDigest,
          answers: { 0: answer({ pick: 2 }) },
        }),
        {
          model: PART_IDENTIFICATION_MODEL_ID,
          matchDigest,
          cardsDigest,
          promptDigest,
          clusters,
          cards,
        },
      ),
    ).toThrow(/did not display/);
  });
});
