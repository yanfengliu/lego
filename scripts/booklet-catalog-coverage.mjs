import { pathToFileURL } from "node:url";

import { claimsFor } from "./part-identification-score.mjs";
import {
  inspectVerifiedPartIdentificationSourceArtRebound,
  verifyPartIdentificationSourceArtReboundClosure,
} from "./part-identification-source-art-rebound.mjs";
import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  authenticateJsonArtifact,
  boundAnswers,
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  jsonArtifactFromBytes,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { pairJudgedVerdictsByCalloutIndexFromParsedJson } from "./part-identification-pair-judged.mjs";
import { PART_TRUTH_PATH } from "./part-identification-truth-key.mjs";
import {
  bookletCatalogCoverageUsage,
  runBookletCatalogCoverageCliWithCompiler,
} from "./booklet-catalog-coverage-cli.mjs";
import {
  buildBookletCatalogCoverageReportWithExpectation,
  buildBookletCatalogCoverageReportV2WithExpectation,
  rejectManifestExpectationOverride,
} from "./booklet-catalog-coverage-report.mjs";
import { applyVerifiedSourceArtReboundToCoverage } from "./booklet-catalog-coverage-source-art-rebound.mjs";
import { authenticateCardImageBundle } from "./part-identification-card-images.mjs";
import { handednessVerdicts } from "./part-identification-handedness.mjs";
import { mirrorPairedPicks } from "./part-identification-mirror-pairs.mjs";

/**
 * How much of the booklet's opening this catalog could place, if it were asked.
 *
 * Part identification answers a callout with an element id, and the published
 * parts list turns that into a design number. Neither is a thing the enumerator
 * can place. This walks the whole chain — callout, element, design number,
 * catalog part — and reports where it breaks, per step and per design.
 *
 * It is the measurement that has to come before any attempt to rebuild the set,
 * because a build cannot skip a step: the step after a missing part has nothing
 * to attach to. So the number that matters is not how many steps are covered
 * but how long the covered prefix is.
 *
 * Reads only what earlier passes already wrote; runs no model and no browser.
 */
const PUBLISHED_PART_NUMBER = /^[0-9][0-9a-z]{0,31}$/iu;

export { bookletCatalogCoverageUsage };

/** Rebuilds coverage from the complete bound identification closure, without filesystem trust. */
const PRODUCTION_SOURCE_ART_REBOUND = Object.freeze({
  inspect: inspectVerifiedPartIdentificationSourceArtRebound,
  verify: verifyPartIdentificationSourceArtReboundClosure,
});

async function compileBookletCatalogCoverageClosureWithExpectation(
  input,
  manifestExpectation,
  sourceArtReboundVerifier = PRODUCTION_SOURCE_ART_REBOUND,
  legacyV2 = false,
) {
  const source = input.source;
  const assignment = input.assignment;
  const model = input.model;
  const featuresArtifactInput = input.featuresArtifact;
  const matchArtifactInput = input.matchArtifact;
  const distancesArtifactInput = input.distancesArtifact;
  const elementsArtifactInput = input.elementsArtifact;
  const cardsArtifactInput = input.cardsArtifact;
  const cardImagesArtifactInput = input.cardImagesArtifact;
  const answersArtifactInput = input.answersArtifact;
  const traceRoot = input.traceRoot;
  const traceArtifacts = input.traceArtifacts;
  const pairJudgedArtifactInput = input.pairJudgedArtifact;
  const sourceArtReboundArtifactInput = legacyV2 ? null : input.sourceArtReboundArtifact;
  const manifestBytes = Buffer.from(input.manifestBytes ?? []);
  const pdfBytesInput = legacyV2 ? null : input.pdfBytes;
  const pdfBytes =
    pdfBytesInput instanceof Uint8Array ? Uint8Array.from(pdfBytesInput) : pdfBytesInput;
  const lastStep = input.lastStep;

  if (!legacyV2 && (!(pdfBytes instanceof Uint8Array) || pdfBytes.byteLength < 1)) {
    throw new Error(
      "Catalog coverage requires nonempty retained PDF bytes so the source-art relation can be independently replayed before it affects confidence.",
    );
  }

  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `Coverage source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (
    assignment !== "nearest" &&
    assignment !== "one-to-one" &&
    assignment !== "quantity-informed"
  ) {
    throw new Error(
      `Coverage assignment must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(assignment)}.`,
    );
  }
  const { features, match, distances, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact: featuresArtifactInput,
    matchArtifact: matchArtifactInput,
    distancesArtifact: distancesArtifactInput,
  });
  const elementsArtifact = authenticateJsonArtifact(
    elementsArtifactInput,
    "part-identification element resolution",
  );
  const elements = elementsArtifact.value;
  let cards = null;
  let cardImages = null;
  let answers = null;
  let cardsArtifact = null;
  let answersArtifact = null;
  if (source === "adjudicated") {
    if (model !== PART_IDENTIFICATION_MODEL_ID) {
      throw new Error(
        `Adjudicated coverage requires pinned model ${PART_IDENTIFICATION_MODEL_ID}; received ${JSON.stringify(model)}.`,
      );
    }
    if (
      cardsArtifactInput === null ||
      cardImagesArtifactInput == null ||
      answersArtifactInput === null
    ) {
      throw new Error(
        "Adjudicated coverage requires exact match-bound card manifest, retained card-image bytes, and prompt/model-bound answers artifacts.",
      );
    }
    cardsArtifact = authenticateJsonArtifact(cardsArtifactInput, "part-identification cards");
    cards = assertCardsArtifact(cardsArtifact, {
      featuresDigest: artifacts.features.digest,
      matchDigest: artifacts.match.digest,
      clusters: match.clusters,
    });
    cardImages = authenticateCardImageBundle(cardImagesArtifactInput, cards);
    answersArtifact = authenticateJsonArtifact(answersArtifactInput, "part-identification answers");
    answers = boundAnswers(answersArtifact, {
      model,
      matchDigest: artifacts.match.digest,
      cardsDigest: cardsArtifact.digest,
      promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
      clusters: match.clusters,
      cards: cards.cards,
      cardImages: cardImages.images,
      traceRoot,
      traceArtifacts,
    });
  } else if (
    model !== null ||
    cardsArtifactInput !== null ||
    cardImagesArtifactInput != null ||
    answersArtifactInput !== null ||
    traceRoot != null ||
    traceArtifacts != null
  ) {
    throw new Error(
      "Deterministic coverage must not smuggle model, card-image, or answer artifacts into its closure.",
    );
  }
  if (
    typeof elements !== "object" ||
    elements === null ||
    Array.isArray(elements) ||
    Object.entries(elements).length === 0 ||
    Object.entries(elements).length > 4_096 ||
    Object.entries(elements).some(
      ([elementId, entry]) =>
        !/^\d{3,12}$/u.test(elementId) ||
        typeof entry !== "object" ||
        entry === null ||
        Object.keys(entry).some(
          (key) => !["colorId", "name", "partNum", "quantity"].includes(key),
        ) ||
        !Number.isInteger(entry.quantity) ||
        entry.quantity < 1 ||
        entry.quantity > 10_000 ||
        typeof entry.partNum !== "string" ||
        !PUBLISHED_PART_NUMBER.test(entry.partNum) ||
        typeof entry.name !== "string" ||
        entry.name.length < 1 ||
        entry.name.length > 512 ||
        !(typeof entry.colorId === "string" || Number.isInteger(entry.colorId)),
    ) ||
    Object.values(elements).some(
      (entry) =>
        typeof entry.colorId === "string" &&
        (entry.colorId.length > 32 || !/^-?\d+$/u.test(entry.colorId)),
    )
  ) {
    throw new Error(
      "Element-resolution closure must contain positive integer quantities and explicit part numbers/names.",
    );
  }
  const held = new Map(
    Object.entries(elements).map(([elementId, entry]) => [elementId, entry.quantity]),
  );
  const names = new Map(Object.entries(elements));
  // The hand is read off the card's own pixels here, on the same terms as the
  // scorer. Coverage used to call `claimsFor` without this argument, and the
  // absence of a verdict is not permission, so every mirror-paired pick came back
  // `handedness-unverified` no matter what the pixels said — four of them in the
  // sealed run, each with a decided verdict that upheld the pick, two of them
  // inside the prefix the rebuild is trying to reach. There was never an
  // evidence-availability reason for it: the bytes the check needs are already a
  // bound role of this closure, authenticated above and published as the
  // cardImages digest, so withholding a pick the pixels verified was blindness
  // that happened to fail safe rather than a stricter standard.
  //
  // Deterministic coverage has no answer to check and therefore no mirror
  // question, and it reaches here with no cards, no answers, and no card images.
  const handedness = handednessVerdicts(
    source === "deterministic" || answers === null
      ? []
      : mirrorPairedPicks(match, answers, names, cards?.cards),
    cardImages?.images,
  );
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
    cards: cards?.cards,
    handedness,
  });
  // Mandatory, not conditional. A coverage report has to say which judged bytes
  // were in force even when none of them bind, because "no judged role" and "a
  // judged role that bound nothing" are the same report otherwise, and the first
  // is what dropping the trust source to move a number looks like.
  if (pairJudgedArtifactInput === null || pairJudgedArtifactInput === undefined) {
    throw new Error(
      `Coverage requires the retained blind pair-judging verdicts as a bound closure role; none was supplied. Pass the exact bytes of ${PART_TRUTH_PATH}, which the compiler authenticates and publishes as the pairJudged input digest.`,
    );
  }
  const pairJudgedArtifact = authenticateJsonArtifact(
    pairJudgedArtifactInput,
    "part-identification pair-judged truth",
  );
  const judgedVerdicts = pairJudgedVerdictsByCalloutIndexFromParsedJson({
    truth: pairJudgedArtifact.value,
    features,
    claims,
    label: `Pair-judged truth (${PART_TRUTH_PATH})`,
  });
  if (legacyV2) {
    return buildBookletCatalogCoverageReportV2WithExpectation(
      {
        manifestBytes,
        features,
        claims,
        judgedVerdicts,
        elements,
        source,
        model,
        assignment,
        lastStep,
        identificationDigests: {
          features: artifacts.features.digest,
          match: artifacts.match.digest,
          distances: artifacts.distances.digest,
          ...(cards === null ? {} : { cards: cardsArtifact.digest }),
          ...(cardImages === null ? {} : { cardImages: cardImages.digest }),
          ...(answers === null ? {} : { answers: answersArtifact.digest }),
          elementResolution: elementsArtifact.digest,
          pairJudged: pairJudgedArtifact.digest,
        },
      },
      manifestExpectation,
    );
  }
  if (sourceArtReboundArtifactInput === null || sourceArtReboundArtifactInput === undefined) {
    throw new Error(
      "Coverage/3 requires the retained source-art-rebound artifact as a bound closure role; none was supplied. Restore output/part-identification/source-art-rebound.json and replay it from the exact PDF and manifest bytes.",
    );
  }
  const sourceArtReboundArtifact = authenticateJsonArtifact(
    sourceArtReboundArtifactInput,
    "part-identification source-art rebound",
  );
  if (
    typeof sourceArtReboundVerifier?.verify !== "function" ||
    typeof sourceArtReboundVerifier?.inspect !== "function"
  ) {
    throw new Error(
      "Catalog coverage source-art rebound verifier must provide the paired private-brand verifier and inspector.",
    );
  }
  const verifiedSourceArtRebound = await sourceArtReboundVerifier.verify({
    artifactBytes: sourceArtReboundArtifact.bytes,
    pdfBytes,
    manifestBytes,
  });
  const inspectedSourceArtRebound = sourceArtReboundVerifier.inspect(verifiedSourceArtRebound);
  if (inspectedSourceArtRebound?.artifactSha256 !== sourceArtReboundArtifact.digest) {
    throw new Error(
      `Verified source-art rebound reports artifact digest ${JSON.stringify(inspectedSourceArtRebound?.artifactSha256 ?? "missing")}, but the retained raw bytes hash to ${sourceArtReboundArtifact.digest}. The private verifier and published role must describe one generation.`,
    );
  }
  const report = buildBookletCatalogCoverageReportWithExpectation(
    {
      manifestBytes,
      features,
      claims,
      judgedVerdicts,
      elements,
      source,
      model,
      assignment,
      lastStep,
      identificationDigests: {
        features: artifacts.features.digest,
        match: artifacts.match.digest,
        distances: artifacts.distances.digest,
        ...(cards === null
          ? {}
          : {
              cards: cardsArtifact.digest,
            }),
        ...(cardImages === null ? {} : { cardImages: cardImages.digest }),
        ...(answers === null
          ? {}
          : {
              answers: answersArtifact.digest,
            }),
        elementResolution: elementsArtifact.digest,
        pairJudged: pairJudgedArtifact.digest,
        sourceArtRebound: sourceArtReboundArtifact.digest,
      },
    },
    manifestExpectation,
  );
  return applyVerifiedSourceArtReboundToCoverage({
    report,
    inspectedRebound: inspectedSourceArtRebound,
    pairJudgedTruth: pairJudgedArtifact.value,
    lastStep,
  });
}

export async function compileBookletCatalogCoverageClosure(input) {
  rejectManifestExpectationOverride(input);
  return compileBookletCatalogCoverageClosureWithExpectation(
    input,
    FULL_CALLOUT_MANIFEST_EXPECTATION,
  );
}

/** Rejects a rehashed coverage edit unless the complete raw closure reproduces its exact bytes. */
export async function verifyBookletCatalogCoverageClosure(input) {
  rejectManifestExpectationOverride(input);
  return verifyBookletCatalogCoverageClosureWithExpectation(
    input,
    FULL_CALLOUT_MANIFEST_EXPECTATION,
  );
}

/** Exact replay only for immutable retained coverage/2 generations. */
export async function verifyBookletCatalogCoverageClosureV2(input) {
  rejectManifestExpectationOverride(input);
  return verifyBookletCatalogCoverageClosureWithExpectation(
    input,
    FULL_CALLOUT_MANIFEST_EXPECTATION,
    PRODUCTION_SOURCE_ART_REBOUND,
    true,
  );
}

async function verifyBookletCatalogCoverageClosureWithExpectation(
  input,
  manifestExpectation,
  sourceArtReboundVerifier = PRODUCTION_SOURCE_ART_REBOUND,
  forceLegacyV2 = false,
) {
  const coverageBytes = Buffer.from(input.coverageBytes ?? []);
  const retainedSchema = jsonArtifactFromBytes(coverageBytes, "Retained catalog coverage").value
    ?.schemaVersion;
  const legacyV2 = forceLegacyV2 || retainedSchema === "lego.real-build-catalog-coverage/2";
  if (
    retainedSchema !== "lego.real-build-catalog-coverage/3" &&
    retainedSchema !== "lego.real-build-catalog-coverage/2"
  ) {
    throw new Error(
      `Catalog coverage declares schema ${JSON.stringify(retainedSchema ?? "missing")}; exact replay accepts current lego.real-build-catalog-coverage/3 or frozen legacy lego.real-build-catalog-coverage/2 bytes only.`,
    );
  }
  if (forceLegacyV2 && retainedSchema !== "lego.real-build-catalog-coverage/2") {
    throw new Error(
      `Frozen coverage/2 replay received ${JSON.stringify(retainedSchema)}. It cannot reinterpret a current or unrelated generation as legacy bytes.`,
    );
  }
  const report = await compileBookletCatalogCoverageClosureWithExpectation(
    input,
    manifestExpectation,
    sourceArtReboundVerifier,
    legacyV2,
  );
  const expectedBytes = Buffer.from(`${JSON.stringify(report, null, 1)}\n`);
  if (!expectedBytes.equals(coverageBytes)) {
    throw new Error(
      "Catalog coverage bytes do not exactly reproduce from the bound features, match, distances, card manifest, retained card images, " +
        "answers, element resolution, blind pair-judging verdicts, verified source-art rebound, PDF, and callout manifest. Recompile coverage; a rehashed confidence or " +
        "resolution edit is not evidence, and neither is a pair-judged confidence the retained verdicts do not reproduce.",
    );
  }
  return report;
}

export const __testOnly = Object.freeze({
  // The raw builder accepts already-derived claims and verdict maps, so it is
  // intentionally test-only. Production callers must use the closure compiler,
  // which authenticates the truth bytes and derives the exact verdict map.
  buildBookletCatalogCoverageReport: (input, manifestExpectation) =>
    buildBookletCatalogCoverageReportWithExpectation(input, manifestExpectation),
  compileBookletCatalogCoverageClosure: (input, manifestExpectation, verifier) =>
    compileBookletCatalogCoverageClosureWithExpectation(
      input,
      manifestExpectation,
      verifier ?? input.__testOnlySourceArtReboundVerifier,
    ),
  compileBookletCatalogCoverageClosureV2: (input, manifestExpectation) =>
    compileBookletCatalogCoverageClosureWithExpectation(
      input,
      manifestExpectation,
      PRODUCTION_SOURCE_ART_REBOUND,
      true,
    ),
  verifyBookletCatalogCoverageClosure: (input, manifestExpectation, verifier) =>
    verifyBookletCatalogCoverageClosureWithExpectation(
      input,
      manifestExpectation,
      verifier ?? input.__testOnlySourceArtReboundVerifier,
    ),
  verifyBookletCatalogCoverageClosureV2: (input, manifestExpectation) =>
    verifyBookletCatalogCoverageClosureWithExpectation(
      input,
      manifestExpectation,
      PRODUCTION_SOURCE_ART_REBOUND,
      true,
    ),
});

export async function runBookletCatalogCoverageCli(argv = process.argv.slice(2), context = {}) {
  return runBookletCatalogCoverageCliWithCompiler(
    compileBookletCatalogCoverageClosure,
    argv,
    context,
  );
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runBookletCatalogCoverageCli();
