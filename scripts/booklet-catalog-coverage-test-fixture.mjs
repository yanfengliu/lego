import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
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
import { __testOnly } from "./booklet-catalog-coverage.mjs";

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
  return {
    schemaVersion: "lego.callout-thumbnails/4",
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
    conservation: {
      expectedIdentityCount: callouts.length,
      expectedRawNxQuantityTotal: rawQuantity,
      expectedIdentitySetSha256: identityDigest,
      publishedIdentityCount: callouts.length,
      publishedRawNxQuantityTotal: rawQuantity,
      publishedIdentitySetSha256: identityDigest,
    },
    failures: [],
    callouts,
  };
}

export const expectationFor = (manifest) => ({
  sourceHash: manifest.sourceHash,
  pagesCropped: manifest.pagesCropped,
  identityCount: manifest.calloutCount,
  rawQuantity: manifest.accounting.rawNxQuantityTotal,
  identitySetDigest: manifest.conservation.expectedIdentitySetSha256,
  accounting: manifest.accounting,
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
      evidenceKind: "part-art",
      sha256: digest("crop-one"),
    },
    {
      identity: "p11|q1|x108.908|y486.271",
      file: "runs/0123456789abcdef01234567/p11-q1-x108d908-y486d271.png",
      pageNumber: 11,
      stepNumber: 1,
      quantity: 1,
      xPt: 108.908,
      yPt: 486.271,
      evidenceKind: "part-art",
      sha256: digest("crop-two"),
    },
  ];
  const manifest = manifestFor(callouts);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const features = {
    inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
    callouts: callouts.map((callout, index) => ({
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
    verdicts,
  });

export function closureFixture() {
  const callout = fixture().manifest.callouts[0];
  const manifest = manifestFor([callout]);
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
    callouts: [{ ...callout, descriptor: descriptor() }],
  });
  const matchArtifact = artifact({
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    calloutCount: 1,
    clusterCount: 1,
    clusters: [
      {
        clusterIndex: 0,
        lead: callout.file,
        members: [0],
        pieces: 1,
        candidates: [{ elementId: "300501", total: 0.01 }],
      },
    ],
  });
  const distancesArtifact = artifact({
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    elementIds: ["300501"],
    rows: [[0.01]],
  });
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
