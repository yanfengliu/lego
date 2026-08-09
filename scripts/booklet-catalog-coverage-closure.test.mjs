import { describe, expect, it } from "vitest";

import {
  __testOnly,
  compileBookletCatalogCoverageClosure,
  runBookletCatalogCoverageCli,
} from "./booklet-catalog-coverage.mjs";
import {
  cardImageBundleArtifact,
  encodeCardImageBundle,
} from "./part-identification-card-images.mjs";
import {
  artifact,
  canonicalPng,
  chiralClosureFixture,
  closureFixture,
  digest,
} from "./booklet-catalog-coverage-test-fixture.mjs";

describe("booklet catalog coverage closure compiler", () => {
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

  /**
   * The handedness check, exercised through coverage rather than through the scorer.
   *
   * Coverage compiled its claims without the verdicts for as long as the check
   * existed, so every mirror-paired pick came back `handedness-unverified` however
   * the card read, and the two paths disagreed about four callouts of the sealed
   * run. Both directions are asserted here because only one of them can fail
   * unsafely: a compiler that never looks at the card produces the refusal too,
   * and a suite that only checked for a refusal would go green on the blindness it
   * is meant to catch.
   */
  it("decides a mirror-paired pick from the card bytes it already binds", () => {
    const { manifestExpectation, calloutIdentity, ...keptInput } = chiralClosureFixture();
    const kept = __testOnly.compileBookletCatalogCoverageClosure(keptInput, manifestExpectation);

    expect(kept.byCallout[calloutIdentity]).toMatchObject({
      elementId: "6392746",
      identificationConfidence: "vision-kept",
    });

    const swappedInput = chiralClosureFixture({ pick: 2 });
    const swappedExpectation = swappedInput.manifestExpectation;
    delete swappedInput.manifestExpectation;
    delete swappedInput.calloutIdentity;
    const swapped = __testOnly.compileBookletCatalogCoverageClosure(
      swappedInput,
      swappedExpectation,
    );

    expect(swapped.byCallout[calloutIdentity].identificationConfidence).toBe("handedness-refuted");
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
});
