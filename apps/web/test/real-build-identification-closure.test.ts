import { crc32, deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { __testOnly as coverageTestOnly } from "../../../scripts/booklet-catalog-coverage.mjs";
import {
  cardImageBundleArtifact,
  encodeCardImageBundle,
} from "../../../scripts/part-identification-card-images.mjs";
import {
  PART_CARDS_SCHEMA,
  PART_FEATURES_SCHEMA,
} from "../../../scripts/part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "../../../scripts/part-identification-model.mjs";
import { syntheticPartIdentificationAnswerClosure } from "../../../scripts/part-identification-synthetic-proof-fixture.mjs";
import { deriveCalloutManifestRunId } from "../e2e/callout-run-id";
import type { CalloutManifest } from "../e2e/callout-types";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "../../../scripts/part-identification-prompt.mjs";
import {
  derivePartIdentificationMatch,
  partIdentificationDistancesValue,
  partIdentificationMatchValue,
} from "../../../scripts/part-identification-derivation.mjs";
import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  RealBuildIdentificationClosureError,
  attributeRealBuildIdentificationClosureError,
  prepareRealBuildIdentificationClosure,
  verifyRealBuildIdentificationClosure,
  type RawJsonArtifact,
  type RealBuildIdentificationClosureInput,
} from "../e2e/real-build-identification-closure";
import {
  SYNTHETIC_IDENTIFICATION_GOLDEN,
  syntheticIdentificationGoldenBytes,
} from "./real-build-identification-golden";

type JsonArtifact<T> = RawJsonArtifact & { readonly value: T };

function artifact<T>(value: T): JsonArtifact<T> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  return { value: JSON.parse(bytes.toString("utf8")) as T, bytes, digest: sha256Digest(bytes) };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 8 + data.length);
  return chunk;
}

function canonicalCardPng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function syntheticDescriptor() {
  return {
    grid: Array<number>(28 * 28).fill(0),
    detail: Array<number>(28 * 28).fill(0),
    boxWidth: 28,
    boxHeight: 28,
    pixels: 1,
    aspect: 1,
    ink: 1 / (28 * 28),
    mean: [0, 0, 0],
    lightFace: 0,
    colours: [{ rgb: [0, 0, 0], share: 1 }],
  };
}

/** Independently encode the public card-run contract instead of trusting the production helper. */
function independentCardRunId(
  featuresDigest: string,
  matchDigest: string,
  cards: Readonly<
    Record<string, { readonly sha256: string; readonly candidateElementIds: readonly string[] }>
  >,
): string {
  const canonicalCards = Object.fromEntries(
    Object.entries(cards)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([cardId, entry]) => [
        cardId,
        { sha256: entry.sha256, candidateElementIds: [...entry.candidateElementIds] },
      ]),
  );
  return sha256Digest(JSON.stringify({ featuresDigest, matchDigest, cards: canonicalCards })).slice(
    "sha256:".length,
    "sha256:".length + 24,
  );
}

function goldenArtifact(role: keyof typeof SYNTHETIC_IDENTIFICATION_GOLDEN): RawJsonArtifact {
  const bytes = syntheticIdentificationGoldenBytes(role);
  return {
    bytes,
    digest: SYNTHETIC_IDENTIFICATION_GOLDEN[role].digest,
    value: JSON.parse(bytes.toString("utf8")) as unknown,
  };
}

function closureFixture(): {
  readonly input: RealBuildIdentificationClosureInput;
  readonly manifestExpectation: unknown;
} {
  const identity = "p11|q1|x43.074|y486.271";
  const pdfDigest = sha256Digest("synthetic-booklet");
  const identitySetDigest = sha256Digest(identity);
  const accounting = {
    rawNxIdentityCount: 1,
    rawNxQuantityTotal: 1,
    physicalPartArtIdentityCount: 1,
    physicalPartArtQuantityTotal: 1,
    semanticIdentityCount: 0,
    semanticQuantityTotal: 0,
  };
  const manifestExpectation = {
    sourceHash: pdfDigest,
    pagesCropped: 1,
    identityCount: 1,
    rawQuantity: 1,
    identitySetDigest,
    accounting,
    recoveryFailureIdentities: [identity],
  };
  const callout = {
    identity,
    file: "runs/0123456789abcdef01234567/p11-q1-x43d074-y486d271.png",
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 43.074,
    yPt: 486.271,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: { minXPt: 40, minYPt: 480, maxXPt: 80, maxYPt: 510 },
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    cropStrategy: "ranked-component",
    masksApplied: ["all-pdf-text"],
    contamination: [],
    widthPx: 1,
    heightPx: 1,
    foregroundPixels: 1,
    sourceTextGlyphPixels: 0,
    sourceQuantityGlyphPixels: 0,
    textGlyphOverlapPixels: 0,
    quantityGlyphOverlapPixels: 0,
    quantityGlyphPixelsMasked: 0,
    cropRectPx: { left: 0, top: 0, right: 0, bottom: 0 },
    boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 0, top: 0, right: 0, bottom: 0 },
      foregroundPixels: 1,
      rawComponentCount: 1,
      absoluteForegroundSha256: sha256Digest("synthetic-source-component-group"),
    },
    sha256: sha256Digest("synthetic-crop"),
    byteLength: 1,
  };
  const elements = {
    300501: { quantity: 1, partNum: "3005", name: "Brick 1 x 1", colorId: 0 },
  };
  const manifestValue = {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: pdfDigest,
    pageSelection: "full booklet",
    pagesCropped: 1,
    calloutCount: 1,
    accounting,
    recoveryBenchmark: {
      schemaVersion: "lego.callout-recovery-benchmark-result/2",
      fixtureSourceHash: pdfDigest,
      fixedFailureClassSize: 1,
      observedLegacyFailureIdentities: [identity],
      scores: [
        {
          strategy: "evidence-aware",
          valid: 1,
          recovered: 1,
          kindCorrect: 1,
          regionCorrect: 1,
          masksCorrect: 1,
          uncontaminated: 1,
          invalidIdentities: [],
          points: 1_011_111,
        },
        {
          strategy: "legacy-seed",
          valid: 0,
          recovered: 0,
          kindCorrect: 0,
          regionCorrect: 0,
          masksCorrect: 0,
          uncontaminated: 0,
          invalidIdentities: [identity],
          points: 0,
        },
      ],
      selected: "evidence-aware",
      winner: "evidence-aware",
      winningMargin: 1_011_111,
    },
    conservation: {
      expectedIdentityCount: 1,
      expectedRawNxQuantityTotal: 1,
      expectedIdentitySetSha256: identitySetDigest,
      publishedIdentityCount: 1,
      publishedRawNxQuantityTotal: 1,
      publishedIdentitySetSha256: identitySetDigest,
    },
    failures: [],
    callouts: [callout],
  };
  const calloutRunId = deriveCalloutManifestRunId(manifestValue as CalloutManifest);
  const boundCallout = {
    ...callout,
    file: `runs/${calloutRunId}/p11-q1-x43d074-y486d271.png`,
  };
  manifestValue.callouts = [boundCallout];
  const manifest = artifact(manifestValue);
  const features = artifact({
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: pdfDigest, calloutManifest: manifest.digest },
    inventory: { 300501: syntheticDescriptor() },
    inventorySourceDigests: { 300501: sha256Digest("synthetic-inventory-image") },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    callouts: [{ ...boundCallout, descriptor: syntheticDescriptor() }],
  });
  const derived = derivePartIdentificationMatch(features.value);
  const match = artifact(partIdentificationMatchValue(features.digest, derived));
  const distances = artifact(
    partIdentificationDistancesValue(features.digest, match.digest, derived),
  );
  const cardPng = canonicalCardPng();
  const cardEntries = {
    "card-0000": {
      sha256: sha256Digest(cardPng),
      candidateElementIds: ["300501"],
    },
  } as const;
  const cardRunId = independentCardRunId(features.digest, match.digest, cardEntries);
  const cards = artifact({
    schemaVersion: PART_CARDS_SCHEMA,
    featuresDigest: features.digest,
    matchDigest: match.digest,
    runId: cardRunId,
    imagesFile: `runs/${cardRunId}/images.bin`,
    cards: {
      "card-0000": {
        ...cardEntries["card-0000"],
        file: `runs/${cardRunId}/card-0000.png`,
      },
    },
  });
  const cardImages = cardImageBundleArtifact(
    encodeCardImageBundle(cards.value, { "card-0000": cardPng }),
  );
  const { answersArtifact: answers, traceArtifacts } = syntheticPartIdentificationAnswerClosure({
    cardId: "card-0000",
    image: cardPng,
    cardsDigest: cards.digest,
    matchDigest: match.digest,
    answer: {
      kind: "brick",
      studsLong: 1,
      studsWide: 1,
      colour: "black",
      pick: 1,
      alsoCouldBe: 0,
      differsFromPick: "nothing",
      confidence: 0.9,
    },
  });
  const elementResolution = artifact(elements);
  const pairJudged = artifact({
    schemaVersion: "lego.part-identification-truth/3",
    method: "pair-verification",
    lastStep: 50,
    pairsJudged: 0,
    pairsUnjudgeable: 0,
    verdicts: [],
    unjudgeable: [],
  });
  const compilerInput = {
    manifestBytes: manifest.bytes,
    featuresArtifact: features,
    matchArtifact: match,
    distancesArtifact: distances,
    cardsArtifact: cards,
    cardImagesArtifact: cardImages,
    answersArtifact: answers,
    traceRoot: null,
    traceArtifacts,
    elementsArtifact: elementResolution,
    pairJudgedArtifact: pairJudged,
    source: "adjudicated" as const,
    model: PART_IDENTIFICATION_MODEL_ID,
    assignment: "nearest" as const,
    lastStep: 1,
  };
  const coverageValue = coverageTestOnly.compileBookletCatalogCoverageClosure(
    compilerInput,
    manifestExpectation,
  );
  const coverage = artifact(coverageValue);
  return {
    manifestExpectation,
    input: {
      coverage,
      manifest,
      features,
      match,
      distances,
      cards,
      cardImages,
      answers,
      traceRoot: null,
      traceArtifacts,
      elementResolution,
      pairJudged,
      requestedLastStep: 1,
    },
  };
}

describe("real-build identification closure", () => {
  it("binds the exact retained card-image bytes and digest for adjudicated coverage", () => {
    const fixture = closureFixture();
    const prepared = prepareRealBuildIdentificationClosure(fixture.input);

    expect(prepared.cardImagesArtifact).toEqual(fixture.input.cardImages);
    expect(prepared.traceRoot).toBeNull();
    expect(prepared.traceArtifacts).toBe(fixture.input.traceArtifacts);
    expect(() =>
      coverageTestOnly.verifyBookletCatalogCoverageClosure(prepared, fixture.manifestExpectation),
    ).not.toThrow();
  });

  it.each(["cards", "cardImages", "answers"] as const)(
    "requires the adjudicated %s role together with the other two roles",
    (role) => {
      const fixture = closureFixture();
      expect(() =>
        prepareRealBuildIdentificationClosure({ ...fixture.input, [role]: null }),
      ).toThrow(/requires exact retained.*all three roles/u);
    },
  );

  it("authenticates the generation-local match schema before requiring the /5 proof trace", () => {
    const fixture = closureFixture();
    const legacyMatch = artifact({
      ...(fixture.input.match.value as Record<string, unknown>),
      schemaVersion: "lego.part-identification-match/2",
    });
    const withoutTrace = {
      ...fixture.input,
      traceRoot: null,
      traceArtifacts: null,
    } satisfies RealBuildIdentificationClosureInput;

    expect(() =>
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure({ ...withoutTrace, match: legacyMatch }),
        fixture.manifestExpectation,
      ),
    ).toThrow(
      /Part-identification match must use lego\.part-identification-match\/3[\s\S]*received schemaVersion="lego\.part-identification-match\/2"/u,
    );
    expect(() =>
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure(withoutTrace),
        fixture.manifestExpectation,
      ),
    ).toThrow(/Answer checkpoint lineage requires its exact retained output root/u);
  });

  it.each(["cards", "cardImages", "answers"] as const)(
    "rejects a deterministic closure that smuggles the %s role",
    (role) => {
      const fixture = closureFixture();
      const deterministic = {
        coverage: goldenArtifact("coverage"),
        manifest: goldenArtifact("manifest"),
        features: goldenArtifact("features"),
        match: goldenArtifact("match"),
        distances: goldenArtifact("distances"),
        elementResolution: goldenArtifact("elementResolution"),
        pairJudged: goldenArtifact("pairJudged"),
        requestedLastStep: 1,
        [role]: fixture.input[role],
      } satisfies RealBuildIdentificationClosureInput;
      expect(() => prepareRealBuildIdentificationClosure(deterministic)).toThrow(
        /must omit adjudication card-manifest, card-image, and answer roles/u,
      );
    },
  );

  it("rejects card-image bytes or a digest that does not bind those exact bytes", () => {
    const fixture = closureFixture();
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        cardImages: {
          ...fixture.input.cardImages!,
          bytes: Buffer.concat([Buffer.from(fixture.input.cardImages!.bytes), Buffer.from([0])]),
        },
      }),
    ).toThrow(/Identification card images declares digest.*bounded bytes hash/u);
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        cardImages: { ...fixture.input.cardImages!, digest: sha256Digest("forged") },
      }),
    ).toThrow(/Identification card images declares digest.*bounded bytes hash/u);
  });

  it("keeps the real-build entrypoint pinned to the complete official manifest", () => {
    const fixture = closureFixture();
    expect(() => verifyRealBuildIdentificationClosure(fixture.input)).toThrow(
      /not the independently pinned full-booklet publication/u,
    );
  });

  it.each([
    ["coverage", "coverage"],
    ["features", "features"],
    ["element resolution", "elementResolution"],
  ] as const)("rejects a %s byte edit with independently retained fields", (_label, role) => {
    const fixture = closureFixture();
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        [role]: { ...fixture.input[role], bytes: Buffer.from("{}\n") },
      }),
    ).toThrow(/bounded bytes hash to/u);
  });

  it.each([
    ["coverage", "coverage"],
    ["features", "features"],
    ["element resolution", "elementResolution"],
  ] as const)("rejects an independently forged %s digest", (_label, role) => {
    const fixture = closureFixture();
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        [role]: { ...fixture.input[role], digest: sha256Digest("forged") },
      }),
    ).toThrow(/declares digest.*bounded bytes hash/u);
  });

  it.each([
    ["coverage", "coverage"],
    ["features", "features"],
    ["element resolution", "elementResolution"],
  ] as const)("rejects an independently forged %s parsed value", (_label, role) => {
    const fixture = closureFixture();
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        [role]: { ...fixture.input[role], value: { forged: true } },
      }),
    ).toThrow(/supplied value does not equal the value parsed from its bounded bytes/u);
  });

  it("rejects malformed strict UTF-8 JSON before consulting declared artifact fields", () => {
    const fixture = closureFixture();
    const bytes = Buffer.from([0xff]);
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        features: { bytes, digest: sha256Digest(bytes), value: {} },
      }),
    ).toThrow(/strict UTF-8 JSON/u);
  });

  it("attributes stale /5 match, cards, and prompt bindings to the answer role", () => {
    const fixture = closureFixture();
    const staleAnswers = artifact({
      ...(fixture.input.answers!.value as Record<string, unknown>),
      matchDigest: sha256Digest("stale-match"),
      cardsDigest: sha256Digest("stale-cards"),
      promptDigest: sha256Digest("stale-prompt"),
    });
    let failure: unknown;
    try {
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure({
          ...fixture.input,
          answers: staleAnswers,
        }),
        fixture.manifestExpectation,
      );
    } catch (error) {
      failure = attributeRealBuildIdentificationClosureError(error);
    }
    expect(failure).toBeInstanceOf(RealBuildIdentificationClosureError);
    expect(failure).toMatchObject({ inputRole: "identification-answers" });
    expect((failure as Error).message).toContain(
      `matchDigest observed ${JSON.stringify(staleAnswers.value.matchDigest)} but required ${JSON.stringify(fixture.input.match.digest)}`,
    );
    expect((failure as Error).message).toContain(
      `cardsDigest observed ${JSON.stringify(staleAnswers.value.cardsDigest)} but required ${JSON.stringify(fixture.input.cards!.digest)}`,
    );
    expect((failure as Error).message).toContain(
      `promptDigest observed ${JSON.stringify(staleAnswers.value.promptDigest)} but required ${JSON.stringify(PART_IDENTIFICATION_PROMPT_DIGEST)}`,
    );
  });

  it("rejects a locally rehashed confidence edit", () => {
    const fixture = closureFixture();
    const forgedValue = structuredClone(fixture.input.coverage.value) as {
      byCallout: Record<string, { identificationConfidence: string }>;
    };
    const identity = Object.keys(forgedValue.byCallout)[0]!;
    forgedValue.byCallout[identity]!.identificationConfidence = "self-contradicted";
    expect(() =>
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure({
          ...fixture.input,
          coverage: artifact(forgedValue),
        }),
        fixture.manifestExpectation,
      ),
    ).toThrow(/rehashed confidence or resolution edit/u);
  });

  it.each([
    ["source", { source: "vision" }],
    ["model", { model: null }],
    ["assignment", { assignment: "greedy" }],
    ["compiled prefix", { lastStep: 0 }],
    ["beyond-booklet prefix", { lastStep: 360 }],
    ["unsafe prefix", { lastStep: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects an invalid %s declaration before compiling", (_label, identificationEdit) => {
    const fixture = closureFixture();
    const coverageValue = structuredClone(fixture.input.coverage.value) as {
      identification: Record<string, unknown>;
      lastStep: number;
    };
    if ("lastStep" in identificationEdit) {
      coverageValue.lastStep = identificationEdit.lastStep as number;
    } else {
      Object.assign(coverageValue.identification, identificationEdit);
    }
    expect(() =>
      prepareRealBuildIdentificationClosure({
        ...fixture.input,
        coverage: artifact(coverageValue),
      }),
    ).toThrow(/Coverage must declare a deterministic\/adjudicated source/u);
  });

  it.each([0, 360, Number.MAX_SAFE_INTEGER + 1])(
    "rejects requestedLastStep outside the real 1..359 booklet at %s",
    (requestedLastStep) => {
      const fixture = closureFixture();
      expect(() =>
        prepareRealBuildIdentificationClosure({ ...fixture.input, requestedLastStep }),
      ).toThrow(/Requested identification prefix must be a safe integer from 1 through 359/u);
    },
  );

  it.each([
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    [Number.NEGATIVE_INFINITY, "-Infinity"],
    [1.5, "1.5"],
    ["1", '"1"'],
    [1n, "1n"],
  ])(
    "reports hostile requestedLastStep %s without losing or serializing it",
    (requestedLastStep, expected) => {
      const fixture = closureFixture();
      let message = "";
      try {
        prepareRealBuildIdentificationClosure({
          ...fixture.input,
          requestedLastStep: requestedLastStep as unknown as number,
        });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain(`received ${expected}`);
    },
  );

  it.each([
    [1.5, "1.5"],
    ["1", '"1"'],
    [null, "null"],
    [true, "true"],
    [[], "Array(length=0)"],
    [{ unexpected: true }, "Object(keys=1)"],
  ])("reports hostile compiled-prefix value %s before authentication", (lastStep, expected) => {
    const fixture = closureFixture();
    const coverageValue = structuredClone(fixture.input.coverage.value) as Record<string, unknown>;
    coverageValue.lastStep = lastStep;
    const coverage = artifact(coverageValue);
    let message = "";
    try {
      prepareRealBuildIdentificationClosure({ ...fixture.input, coverage });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain(`lastStep=${expected}`);
  });
});
