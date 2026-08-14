import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_FEATURES_SCHEMA,
  deriveCardRunId,
  jsonArtifactFromBytes,
} from "./part-identification-artifacts.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
} from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import {
  cardImageBundleArtifact,
  encodeCardImageBundle,
} from "./part-identification-card-images.mjs";
import { PART_TRUTH_SCHEMA } from "./part-identification-truth-key.mjs";
import {
  derivePartIdentificationMatch,
  partIdentificationDistancesValue,
  partIdentificationMatchValue,
} from "./part-identification-derivation.mjs";
import { chiralCard } from "./part-identification-card-test-fixture.mjs";
import { __testOnly } from "./booklet-catalog-coverage.mjs";
import { deriveCalloutManifestRunId } from "../apps/web/e2e/callout-run-id.ts";

/**
 * The synthetic two-callout booklet both coverage suites are written against.
 *
 * Kept out of any `*.test.mjs` name: vitest only collects test-suffixed files,
 * and a fixture that ran as a suite would re-run once per importer.
 */

export const digest = (label) => `sha256:${createHash("sha256").update(label).digest("hex")}`;

export function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 8 + data.length);
  return chunk;
}

export function canonicalPng(width = 1, height = 1, fill = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    rows.fill(fill, row * (width * 4 + 1) + 1, (row + 1) * (width * 4 + 1));
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function manifestFor(callouts) {
  const rawQuantity = callouts.reduce((total, { quantity }) => total + quantity, 0);
  const physical = callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  const semantic = callouts.filter(({ evidenceKind }) => evidenceKind !== "part-art");
  const identityDigest = digest(
    callouts
      .map(({ identity }) => identity)
      .sort()
      .join("\n"),
  );
  const manifest = {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: digest("booklet"),
    pageSelection: "full booklet",
    pagesCropped: new Set(callouts.map(({ pageNumber }) => pageNumber)).size,
    calloutCount: callouts.length,
    accounting: {
      rawNxIdentityCount: callouts.length,
      rawNxQuantityTotal: rawQuantity,
      physicalPartArtIdentityCount: physical.length,
      physicalPartArtQuantityTotal: physical.reduce((total, { quantity }) => total + quantity, 0),
      semanticIdentityCount: semantic.length,
      semanticQuantityTotal: semantic.reduce((total, { quantity }) => total + quantity, 0),
    },
    recoveryBenchmark: {
      schemaVersion: "lego.callout-recovery-benchmark-result/2",
      fixtureSourceHash: digest("booklet"),
      fixedFailureClassSize: 1,
      observedLegacyFailureIdentities: [callouts[0].identity],
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
          invalidIdentities: [callouts[0].identity],
          points: 0,
        },
      ],
      selected: "evidence-aware",
      winner: "evidence-aware",
      winningMargin: 1_011_111,
    },
    conservation: {
      expectedIdentityCount: callouts.length,
      expectedRawNxQuantityTotal: rawQuantity,
      expectedIdentitySetSha256: identityDigest,
      publishedIdentityCount: callouts.length,
      publishedRawNxQuantityTotal: rawQuantity,
      publishedIdentitySetSha256: identityDigest,
    },
    failures: [],
    callouts: callouts.map((callout) => ({ ...callout })),
  };
  const runId = deriveCalloutManifestRunId(manifest);
  manifest.callouts = manifest.callouts.map((callout) => ({
    ...callout,
    file: `runs/${runId}/${callout.identity.replaceAll("|", "-").replaceAll(".", "d")}.png`,
  }));
  return manifest;
}

export const expectationFor = (manifest) => ({
  sourceHash: manifest.sourceHash,
  pagesCropped: manifest.pagesCropped,
  identityCount: manifest.calloutCount,
  rawQuantity: manifest.accounting.rawNxQuantityTotal,
  identitySetDigest: manifest.conservation.expectedIdentitySetSha256,
  accounting: manifest.accounting,
  recoveryFailureIdentities: manifest.recoveryBenchmark.observedLegacyFailureIdentities,
});

export const descriptor = () => ({
  grid: Array(28 * 28).fill(0),
  detail: Array(28 * 28).fill(0),
  aspect: 1,
  ink: 1,
  pixels: 1,
  boxWidth: 1,
  boxHeight: 1,
  mean: [0, 0, 0],
  lightFace: 0,
  colours: [{ rgb: [0, 0, 0], share: 1 }],
});

export function fixture() {
  const callouts = [
    {
      identity: "p11|q1|x43.074|y486.271",
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
        absoluteForegroundSha256: digest("component-group-one"),
      },
      sha256: digest("crop-one"),
      byteLength: 1,
    },
    {
      identity: "p11|q1|x108.908|y486.271",
      file: "runs/0123456789abcdef01234567/p11-q1-x108d908-y486d271.png",
      pageNumber: 11,
      stepNumber: 1,
      quantity: 1,
      xPt: 108.908,
      yPt: 486.271,
      heightPt: 8,
      boxMethod: "vector-smallest",
      box: { minXPt: 100, minYPt: 480, maxXPt: 140, maxYPt: 510 },
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
      cropRectPx: { left: 10, top: 0, right: 10, bottom: 0 },
      boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
      sourceComponent: {
        rasterScale: 8,
        boundsPx: { left: 10, top: 0, right: 10, bottom: 0 },
        foregroundPixels: 1,
        rawComponentCount: 1,
        absoluteForegroundSha256: digest("component-group-two"),
      },
      sha256: digest("crop-two"),
      byteLength: 1,
    },
  ];
  const manifest = manifestFor(callouts);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const features = {
    inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
    callouts: manifest.callouts.map((callout, index) => ({
      ...callout,
      descriptor: descriptor(index),
    })),
  };
  const claims = new Map([
    [0, { elementId: "300501", clusterIndex: 0, picked: "vision-kept" }],
    [1, { elementId: null, clusterIndex: 1, picked: "refused" }],
  ]);
  const elements = {
    300501: {
      quantity: 1,
      partNum: "3005",
      name: "Brick 1 x 1",
      colorId: 0,
    },
  };
  return {
    manifest,
    manifestBytes,
    manifestExpectation: expectationFor(manifest),
    features,
    claims,
    elements,
  };
}

export function build(overrides = {}) {
  const base = fixture();
  const manifestExpectation = overrides.manifestExpectation ?? base.manifestExpectation;
  const input = { ...overrides };
  delete input.manifestExpectation;
  return __testOnly.buildBookletCatalogCoverageReport(
    {
      manifestBytes: base.manifestBytes,
      features: base.features,
      claims: base.claims,
      elements: base.elements,
      source: "adjudicated",
      model: "fixture-model",
      assignment: "one-to-one",
      lastStep: 1,
      ...input,
    },
    manifestExpectation,
  );
}

export const artifact = (value) =>
  jsonArtifactFromBytes(Buffer.from(JSON.stringify(value)), "coverage fixture artifact");

/** Exact /3 match-distance closure for one already-authenticated feature fixture. */
export function identificationArtifactsFor(featuresArtifact, candidateLimit = 6) {
  const derived = derivePartIdentificationMatch(featuresArtifact.value, candidateLimit);
  const matchArtifact = artifact(partIdentificationMatchValue(featuresArtifact.digest, derived));
  return {
    matchArtifact,
    distancesArtifact: artifact(
      partIdentificationDistancesValue(featuresArtifact.digest, matchArtifact.digest, derived),
    ),
  };
}

/**
 * Judged verdicts for the synthetic closure, keyed exactly as the real ones are.
 *
 * `verdicts` defaults to none, so a suite that says nothing about judging gets a
 * bound role that binds nothing — which is the state every existing closure
 * assertion was written against.
 */
export const pairJudgedArtifactFor = (verdicts = []) =>
  artifact({
    schemaVersion: PART_TRUTH_SCHEMA,
    method: "pair-verification",
    lastStep: 50,
    pairsJudged: verdicts.length,
    pairsUnjudgeable: 0,
    verdicts,
    unjudgeable: [],
  });

export function closureFixture() {
  const callout = fixture().manifest.callouts[0];
  const manifest = manifestFor([callout]);
  const publishedCallout = manifest.callouts[0];
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const featuresArtifact = artifact({
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    inventory: { 300501: descriptor() },
    inventorySourceDigests: { 300501: digest("inventory") },
    callouts: [{ ...publishedCallout, descriptor: descriptor() }],
  });
  const { matchArtifact, distancesArtifact } = identificationArtifactsFor(featuresArtifact);
  const cardImage = canonicalPng();
  const cardEntries = {
    "card-0000": {
      sha256: digest(cardImage),
      candidateElementIds: ["300501"],
    },
  };
  const cardRunId = deriveCardRunId(featuresArtifact.digest, matchArtifact.digest, cardEntries);
  const cardsArtifact = artifact({
    schemaVersion: PART_CARDS_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    matchDigest: matchArtifact.digest,
    runId: cardRunId,
    imagesFile: `runs/${cardRunId}/images.bin`,
    cards: {
      "card-0000": {
        ...cardEntries["card-0000"],
        file: `runs/${cardRunId}/card-0000.png`,
      },
    },
  });
  const cardImagesArtifact = cardImageBundleArtifact(
    encodeCardImageBundle(cardsArtifact.value, new Map([["card-0000", cardImage]])),
  );
  const answersArtifact = artifact({
    schemaVersion: PART_ANSWERS_SCHEMA,
    model: PART_IDENTIFICATION_MODEL_ID,
    modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    matchDigest: matchArtifact.digest,
    cardsDigest: cardsArtifact.digest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    answers: {
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
  });
  const elements = {
    300501: { quantity: 1, partNum: "3005", name: "Brick 1 x 1", colorId: 0 },
  };
  return {
    manifestBytes,
    manifestExpectation: expectationFor(manifest),
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
    cardsArtifact,
    cardImagesArtifact,
    answersArtifact,
    pairJudgedArtifact: pairJudgedArtifactFor(),
    elementsArtifact: artifact(elements),
    source: "adjudicated",
    model: PART_IDENTIFICATION_MODEL_ID,
    assignment: "nearest",
    lastStep: 1,
  };
}

/**
 * The same closure, over a card that displays both hands of one part.
 *
 * The two candidates are a left and a right wedge plate in one colour, which is
 * the exact configuration the description check provably cannot separate — "wedge
 * 6x2 White" agrees equally well with either name — so the pick may only be kept
 * when the card's own pixels say which hand the query is. The card is drawn with
 * a genuinely chiral shape, so a compiler that reads it decides, and a compiler
 * that does not read it refuses.
 *
 * `pick` selects the answer's candidate number: 1 is the hand the query is drawn
 * as, 2 is the swap that the note check could not catch.
 */
export function chiralClosureFixture({ pick = 1 } = {}) {
  const callout = fixture().manifest.callouts[0];
  const manifest = manifestFor([callout]);
  const publishedCallout = manifest.callouts[0];
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const featuresArtifact = artifact({
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    inventory: { 6392746: descriptor(), 6392747: descriptor() },
    inventorySourceDigests: {
      6392746: digest("inventory-right"),
      6392747: digest("inventory-left"),
    },
    callouts: [{ ...publishedCallout, descriptor: descriptor() }],
  });
  const { matchArtifact, distancesArtifact } = identificationArtifactsFor(featuresArtifact);
  const cardImage = chiralCard();
  const cardEntries = {
    "card-0000": {
      sha256: digest(cardImage),
      candidateElementIds: ["6392746", "6392747"],
    },
  };
  const cardRunId = deriveCardRunId(featuresArtifact.digest, matchArtifact.digest, cardEntries);
  const cardsArtifact = artifact({
    schemaVersion: PART_CARDS_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    matchDigest: matchArtifact.digest,
    runId: cardRunId,
    imagesFile: `runs/${cardRunId}/images.bin`,
    cards: {
      "card-0000": {
        ...cardEntries["card-0000"],
        file: `runs/${cardRunId}/card-0000.png`,
      },
    },
  });
  const cardImagesArtifact = cardImageBundleArtifact(
    encodeCardImageBundle(cardsArtifact.value, new Map([["card-0000", cardImage]])),
  );
  const answersArtifact = artifact({
    schemaVersion: PART_ANSWERS_SCHEMA,
    model: PART_IDENTIFICATION_MODEL_ID,
    modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    matchDigest: matchArtifact.digest,
    cardsDigest: cardsArtifact.digest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    answers: {
      0: {
        kind: "wedge",
        studsLong: 6,
        studsWide: 2,
        colour: "White",
        pick,
        alsoCouldBe: 0,
        differsFromPick: "nothing",
        confidence: 0.9,
      },
    },
  });
  const elements = {
    6392746: { quantity: 1, partNum: "78444", name: "Wedge Plate 6 x 2 Right", colorId: "15" },
    6392747: { quantity: 1, partNum: "78443", name: "Wedge Plate 6 x 2 Left", colorId: "15" },
  };
  return {
    calloutIdentity: publishedCallout.identity,
    manifestBytes,
    manifestExpectation: expectationFor(manifest),
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
    cardsArtifact,
    cardImagesArtifact,
    answersArtifact,
    pairJudgedArtifact: pairJudgedArtifactFor(),
    elementsArtifact: artifact(elements),
    source: "adjudicated",
    model: PART_IDENTIFICATION_MODEL_ID,
    assignment: "nearest",
    lastStep: 1,
  };
}
