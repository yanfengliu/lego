import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  buildBookletCatalogCoverageReport,
  __testOnly,
  compileBookletCatalogCoverageClosure,
  runBookletCatalogCoverageCli,
} from "./booklet-catalog-coverage.mjs";
import {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
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

const digest = (label) => `sha256:${createHash("sha256").update(label).digest("hex")}`;

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 8 + data.length);
  return chunk;
}

function canonicalPng(width = 1, height = 1, fill = 0) {
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

function manifestFor(callouts) {
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

const expectationFor = (manifest) => ({
  sourceHash: manifest.sourceHash,
  pagesCropped: manifest.pagesCropped,
  identityCount: manifest.calloutCount,
  rawQuantity: manifest.accounting.rawNxQuantityTotal,
  identitySetDigest: manifest.conservation.expectedIdentitySetSha256,
  accounting: manifest.accounting,
});

const descriptor = () => ({
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

function fixture() {
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

function build(overrides = {}) {
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

const artifact = (value) =>
  jsonArtifactFromBytes(Buffer.from(JSON.stringify(value)), "coverage fixture artifact");

function closureFixture() {
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
    elementsArtifact: artifact(elements),
    source: "adjudicated",
    model: PART_IDENTIFICATION_MODEL_ID,
    assignment: "nearest",
    lastStep: 1,
  };
}

describe("booklet catalog coverage producer", () => {
  it("prints truthful help without reading stale retained artifacts", () => {
    const output = [];
    expect(runBookletCatalogCoverageCli(["--help"], { stdout: (line) => output.push(line) })).toBe(
      0,
    );
    expect(output.join("\n")).toMatch(/Adjudicated example.*Deterministic example/s);
    expect(output.join("\n")).toMatch(/element-resolution\.json is a retained prerequisite/);
    expect(output.join("\n")).toMatch(/has no resolve command/);
  });

  it("recompiles the complete prompt/model-bound closure and rejects a rehashed confidence edit", () => {
    const closure = closureFixture();
    const { manifestExpectation, ...closureInput } = closure;
    const report = __testOnly.compileBookletCatalogCoverageClosure(
      closureInput,
      manifestExpectation,
    );
    const coverageBytes = Buffer.from(`${JSON.stringify(report, null, 1)}\n`);
    expect(
      __testOnly.verifyBookletCatalogCoverageClosure(
        { ...closureInput, coverageBytes },
        manifestExpectation,
      ),
    ).toEqual(report);

    const forged = structuredClone(report);
    forged.byCallout[Object.keys(forged.byCallout)[0]].identificationConfidence =
      "self-contradicted";
    expect(() =>
      __testOnly.verifyBookletCatalogCoverageClosure(
        {
          ...closureInput,
          coverageBytes: Buffer.from(`${JSON.stringify(forged, null, 1)}\n`),
        },
        manifestExpectation,
      ),
    ).toThrow(/rehashed confidence or resolution edit/u);
    expect(() => compileBookletCatalogCoverageClosure(closure)).toThrow(
      /does not accept a caller-supplied manifestExpectation/,
    );

    const forgedImage = canonicalPng(1, 1, 1);
    const selfRehashedImages = cardImageBundleArtifact(
      encodeCardImageBundle(
        { cards: { "card-0000": { sha256: digest(forgedImage) } } },
        new Map([["card-0000", forgedImage]]),
      ),
    );
    expect(() =>
      __testOnly.compileBookletCatalogCoverageClosure(
        {
          ...closureInput,
          cardImagesArtifact: selfRehashedImages,
        },
        manifestExpectation,
      ),
    ).toThrow(/hashes to .*manifest requires/u);
  });

  it("snapshots every closure input once before validating and publishing its digests", () => {
    const closure = closureFixture();
    const { manifestExpectation, ...closureInput } = closure;
    const arbitraryCardsForAnswers = artifact({ unrelated: "cards-for-answers" });
    const arbitraryCardsForReport = artifact({ unrelated: "cards-for-report" });
    const arbitraryAnswersForReport = artifact({ unrelated: "answers-for-report" });
    const answersForArbitraryCards = artifact({
      ...closureInput.answersArtifact.value,
      cardsDigest: arbitraryCardsForAnswers.digest,
    });
    const reads = Object.create(null);
    const accessorInput = {};

    for (const [field, value] of Object.entries(closureInput)) {
      Object.defineProperty(accessorInput, field, {
        enumerable: true,
        get() {
          reads[field] = (reads[field] ?? 0) + 1;
          if (field === "source") {
            return reads[field] < 4 ? "adjudicated" : "deterministic";
          }
          if (field === "cardsArtifact") {
            return [
              closureInput.cardsArtifact,
              closureInput.cardsArtifact,
              arbitraryCardsForAnswers,
              arbitraryCardsForReport,
            ][Math.min(reads[field] - 1, 3)];
          }
          if (field === "answersArtifact") {
            return [
              closureInput.answersArtifact,
              answersForArbitraryCards,
              arbitraryAnswersForReport,
            ][Math.min(reads[field] - 1, 2)];
          }
          return value;
        },
      });
    }

    const report = __testOnly.compileBookletCatalogCoverageClosure(
      accessorInput,
      manifestExpectation,
    );

    expect(
      Object.fromEntries(Object.keys(closureInput).map((field) => [field, reads[field]])),
    ).toEqual(Object.fromEntries(Object.keys(closureInput).map((field) => [field, 1])));
    expect(report.identification.source).toBe("adjudicated");
    expect(report.inputDigests.cards).toBe(closureInput.cardsArtifact.digest);
    expect(report.inputDigests.answers).toBe(closureInput.answersArtifact.digest);
    expect(report.byCallout[Object.keys(report.byCallout)[0]].elementId).toBe("300501");
  });

  it("cannot validate deterministic inputs and later publish them as adjudicated", () => {
    const closure = closureFixture();
    const { manifestExpectation, ...adjudicatedInput } = closure;
    const deterministicInput = {
      ...adjudicatedInput,
      source: "deterministic",
      model: null,
      cardsArtifact: null,
      cardImagesArtifact: null,
      answersArtifact: null,
    };
    let sourceReads = 0;
    Object.defineProperty(deterministicInput, "source", {
      enumerable: true,
      get() {
        sourceReads += 1;
        return sourceReads < 4 ? "deterministic" : "adjudicated";
      },
    });

    const report = __testOnly.compileBookletCatalogCoverageClosure(
      deterministicInput,
      manifestExpectation,
    );

    expect(sourceReads).toBe(1);
    expect(report.identification).toMatchObject({ source: "deterministic", model: null });
    expect(report.inputDigests).not.toHaveProperty("cards");
    expect(report.inputDigests).not.toHaveProperty("cardImages");
    expect(report.inputDigests).not.toHaveProperty("answers");
  });

  it("requires authenticated feature bytes to bind the exact retained PDF and manifest", () => {
    const closure = closureFixture();
    const { manifestExpectation, ...adjudicatedInput } = closure;
    const cases = [
      ["pdf", digest("unrelated-pdf")],
      ["calloutManifest", digest("unrelated-manifest")],
    ];

    for (const [field, forgedDigest] of cases) {
      const featuresArtifact = artifact({
        ...adjudicatedInput.featuresArtifact.value,
        inputDigests: {
          ...adjudicatedInput.featuresArtifact.value.inputDigests,
          [field]: forgedDigest,
        },
      });
      const matchArtifact = artifact({
        ...adjudicatedInput.matchArtifact.value,
        featuresDigest: featuresArtifact.digest,
      });
      const distancesArtifact = artifact({
        ...adjudicatedInput.distancesArtifact.value,
        featuresDigest: featuresArtifact.digest,
      });

      expect(() =>
        __testOnly.compileBookletCatalogCoverageClosure(
          {
            ...adjudicatedInput,
            source: "deterministic",
            model: null,
            cardsArtifact: null,
            cardImagesArtifact: null,
            answersArtifact: null,
            featuresArtifact,
            matchArtifact,
            distancesArtifact,
          },
          manifestExpectation,
        ),
      ).toThrow(/features bind PDF\/manifest digests/u);
    }
  });

  it("accepts bounded published print, pattern, and assembly design-number spellings", () => {
    const closure = closureFixture();
    const { manifestExpectation, ...adjudicatedInput } = closure;
    const elementsArtifact = artifact({
      ...adjudicatedInput.elementsArtifact.value,
      6313021: {
        partNum: "973c27h27",
        name: "Torso, White Arms and Hands [Plain]",
        colorId: "15",
        quantity: 1,
      },
      6585142: {
        partNum: "4162pr0074",
        name: "Tile 1 x 8 with White print",
        colorId: "0",
        quantity: 1,
      },
      6585143: {
        partNum: "3070bpr9884",
        name: "Tile 1 x 1 with White Star print",
        colorId: "0",
        quantity: 9,
      },
      6601429: {
        partNum: "61406pat0009",
        name: "Plate Special 1 x 2 with patterned extension",
        colorId: "15",
        quantity: 1,
      },
    });

    expect(() =>
      __testOnly.compileBookletCatalogCoverageClosure(
        { ...adjudicatedInput, elementsArtifact },
        manifestExpectation,
      ),
    ).not.toThrow();
  });

  it("binds stable v4 identities and exact PDF, manifest, crop, and claim evidence", () => {
    const input = fixture();
    const report = __testOnly.buildBookletCatalogCoverageReport(
      {
        manifestBytes: input.manifestBytes,
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      },
      input.manifestExpectation,
    );
    const manifestDigest = digest(input.manifestBytes);

    expect(report).toMatchObject({
      schemaVersion: "lego.real-build-catalog-coverage/1",
      inputDigests: {
        pdf: input.manifest.sourceHash,
        calloutManifest: manifestDigest,
      },
      identification: {
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
      },
      lastStep: 1,
      calloutsConsidered: 1,
      calloutsUnidentified: 1,
    });
    expect(Object.keys(report.byCallout)).toEqual(
      input.manifest.callouts.map(({ identity }) => identity),
    );
    expect(report.byCallout[input.manifest.callouts[0].identity]).toMatchObject({
      identity: input.manifest.callouts[0].identity,
      file: input.manifest.callouts[0].file,
      cropDigest: input.manifest.callouts[0].sha256,
      inputDigest: manifestDigest,
      identificationConfidence: "vision-kept",
      elementId: "300501",
      resolution: { catalogPartId: "builtin:brick-1x1", outcome: "exact" },
    });
    expect(report.byCallout[input.manifest.callouts[1].identity]).toMatchObject({
      identity: input.manifest.callouts[1].identity,
      file: input.manifest.callouts[1].file,
      cropDigest: input.manifest.callouts[1].sha256,
      inputDigest: manifestDigest,
      identificationConfidence: "refused",
      elementId: null,
      resolution: null,
    });
  });

  it("retains one manifest byte snapshot and forbids reserved digest overrides", () => {
    const input = fixture();
    const heldBytes = Buffer.from(input.manifestBytes);
    let manifestReads = 0;
    const report = __testOnly.buildBookletCatalogCoverageReport(
      {
        get manifestBytes() {
          manifestReads += 1;
          return manifestReads === 1 ? heldBytes : Buffer.from('{"unrelated":true}');
        },
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      },
      input.manifestExpectation,
    );
    heldBytes.fill(0);

    expect(manifestReads).toBe(1);
    expect(report.inputDigests.calloutManifest).toBe(digest(input.manifestBytes));
    expect(report.byCallout[input.manifest.callouts[0].identity].inputDigest).toBe(
      digest(input.manifestBytes),
    );
    expect(() =>
      build({
        identificationDigests: {
          pdf: digest("forged-pdf"),
          calloutManifest: digest("forged-manifest"),
        },
      }),
    ).toThrow(/pdf and calloutManifest are derived only/u);

    const canonicalRoles = {
      match: digest("match"),
      distances: digest("distances"),
      elementResolution: digest("elements"),
    };
    const reversedRoles = Object.fromEntries(Object.entries(canonicalRoles).reverse());
    const canonicalReport = build({ identificationDigests: canonicalRoles });
    const reversedReport = build({ identificationDigests: reversedRoles });
    expect(JSON.stringify(reversedReport)).toBe(JSON.stringify(canonicalReport));
    expect(Object.keys(canonicalReport.inputDigests)).toEqual([
      "pdf",
      "calloutManifest",
      "match",
      "distances",
      "elementResolution",
    ]);
  });

  it("snapshots callout arrays and every binding field before validation and publication", () => {
    const input = fixture();
    const attacker = {
      ...input.features.callouts[0],
      identity: "p99|q1|x1.000|y1.000",
      file: "runs/ffffffffffffffffffffffff/p99-q1-x1d000-y1d000.png",
      sha256: digest("attacker-crop"),
    };
    let calloutArrayReads = 0;
    const arrayReport = build({
      manifestBytes: input.manifestBytes,
      features: {
        get callouts() {
          calloutArrayReads += 1;
          return calloutArrayReads <= 4
            ? input.features.callouts
            : [attacker, input.features.callouts[1]];
        },
      },
      claims: input.claims,
      elements: input.elements,
    });

    expect(calloutArrayReads).toBe(1);
    expect(Object.hasOwn(arrayReport.byCallout, input.manifest.callouts[0].identity)).toBe(true);
    expect(Object.hasOwn(arrayReport.byCallout, attacker.identity)).toBe(false);

    const bindingFields = [
      "identity",
      "file",
      "pageNumber",
      "stepNumber",
      "quantity",
      "sha256",
      "evidenceKind",
    ];
    const fieldReads = Object.create(null);
    const accessorCallout = Object.fromEntries(bindingFields.map((field) => [field, undefined]));
    for (const field of bindingFields) {
      Object.defineProperty(accessorCallout, field, {
        enumerable: true,
        get() {
          fieldReads[field] = (fieldReads[field] ?? 0) + 1;
          return fieldReads[field] === 1 ? input.features.callouts[0][field] : attacker[field];
        },
      });
    }
    const fieldReport = build({
      manifestBytes: input.manifestBytes,
      features: { callouts: [accessorCallout, input.features.callouts[1]] },
      claims: input.claims,
      elements: input.elements,
    });

    expect(Object.fromEntries(bindingFields.map((field) => [field, fieldReads[field]]))).toEqual(
      Object.fromEntries(bindingFields.map((field) => [field, 1])),
    );
    expect(Object.hasOwn(fieldReport.byCallout, input.manifest.callouts[0].identity)).toBe(true);
    expect(Object.hasOwn(fieldReport.byCallout, attacker.identity)).toBe(false);
  });

  it("rejects stale feature identity, file, ordering, or crop metadata", () => {
    const cases = [
      ["identity", "p11|q1|x44.000|y486.271"],
      ["file", "runs/ffffffffffffffffffffffff/stale.png"],
      ["pageNumber", 12],
      ["stepNumber", 2],
      ["quantity", 2],
      ["sha256", digest("tampered-crop")],
      ["evidenceKind", "assembly-action"],
    ];
    for (const [field, value] of cases) {
      const input = fixture();
      input.features.callouts[0] = { ...input.features.callouts[0], [field]: value };
      expect(() =>
        build({
          manifestBytes: input.manifestBytes,
          features: input.features,
          claims: input.claims,
          elements: input.elements,
        }),
      ).toThrow(new RegExp(`feature callout 0 field ${field}`));
    }

    const reordered = fixture();
    reordered.features.callouts.reverse();
    expect(() =>
      build({
        manifestBytes: reordered.manifestBytes,
        features: reordered.features,
        claims: reordered.claims,
        elements: reordered.elements,
      }),
    ).toThrow(/feature callout 0 field identity/);

    const truncated = fixture();
    truncated.features.callouts.pop();
    expect(() =>
      build({
        manifestBytes: truncated.manifestBytes,
        features: truncated.features,
        claims: truncated.claims,
        elements: truncated.elements,
      }),
    ).toThrow(/features contain 1 callouts, but the exact v4 manifest contains 2/);
  });

  it("keeps semantic multiplier/action identities out of catalog-part coverage", () => {
    const input = fixture();
    const semantic = {
      ...input.manifest.callouts[1],
      identity: "p33|q4|x274.854|y340.077",
      file: "runs/0123456789abcdef01234567/p33-q4-x274d854-y340d077.png",
      pageNumber: 33,
      stepNumber: 29,
      quantity: 4,
      xPt: 274.854,
      yPt: 340.077,
      evidenceKind: "subassembly-repeat",
      sha256: digest("semantic-action"),
    };
    const manifest = manifestFor([...input.manifest.callouts, semantic]);
    const features = {
      callouts: [...input.features.callouts, { ...semantic, descriptor: { pixels: 3 } }],
    };
    const report = build({
      manifestBytes: Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`),
      features,
      manifestExpectation: expectationFor(manifest),
      claims: new Map([...input.claims, [2, { elementId: null, picked: "refused" }]]),
      elements: input.elements,
    });

    expect(report.byCallout[semantic.identity]).toBeUndefined();
    expect(report.calloutsUnidentified).toBe(1);
  });

  it("rejects arbitrary evidence kinds and every stale accounting or conservation field", () => {
    const input = fixture();
    const arbitrary = structuredClone(input.manifest);
    arbitrary.callouts[0].evidenceKind = "attacker-controlled";
    expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(arbitrary)) })).toThrow(
      /fixed evidence contract/,
    );

    for (const section of ["accounting", "conservation"]) {
      for (const field of Object.keys(input.manifest[section])) {
        const stale = structuredClone(input.manifest);
        stale[section][field] =
          typeof stale[section][field] === "number" ? stale[section][field] + 1 : digest(field);
        expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(stale)) })).toThrow(
          /accounting or conservation/,
        );
      }
    }
  });

  it("rejects a self-consistent fragment that calls itself the full pinned booklet", () => {
    const input = fixture();
    const truncated = manifestFor([input.manifest.callouts[0]]);
    truncated.sourceHash = FULL_CALLOUT_MANIFEST_EXPECTATION.sourceHash;
    expect(() =>
      buildBookletCatalogCoverageReport({
        manifestBytes: Buffer.from(JSON.stringify(truncated)),
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      }),
    ).toThrow(/independently pinned full-booklet publication/);
  });

  it("rejects a same-count stable identity substitution with a recomputed published digest", () => {
    const input = fixture();
    const substituted = structuredClone(input.manifest);
    substituted.callouts[0].identity = "p11|q1|x44.000|y486.271";
    substituted.callouts[0].xPt = 44;
    substituted.callouts[0].file = "runs/0123456789abcdef01234567/p11-q1-x44d000-y486d271.png";
    substituted.conservation.publishedIdentitySetSha256 = digest(
      substituted.callouts
        .map(({ identity }) => identity)
        .sort()
        .join("\n"),
    );
    expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(substituted)) })).toThrow(
      /identity-set digests cannot self-certify/,
    );
  });

  it("rejects non-v4, malformed, duplicate, and count-stale manifests", () => {
    const input = fixture();
    const bytes = (manifest) => Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);

    expect(() =>
      build({ manifestBytes: bytes({ ...input.manifest, schemaVersion: "legacy" }) }),
    ).toThrow(/lego\.callout-thumbnails\/4/);
    expect(() => build({ manifestBytes: Buffer.from("not-json") })).toThrow(/not valid JSON/);
    expect(() =>
      build({
        manifestBytes: Buffer.from('{"schemaVersion":"one","schemaVersion":"two"}'),
      }),
    ).toThrow(/repeats key "schemaVersion"/);
    expect(() =>
      build({
        manifestBytes: bytes({
          ...input.manifest,
          callouts: [input.manifest.callouts[0], input.manifest.callouts[0]],
        }),
      }),
    ).toThrow(/unique stable identity/);
    expect(() => build({ manifestBytes: bytes({ ...input.manifest, calloutCount: 3 }) })).toThrow(
      /declared callout count/,
    );
  });
});
