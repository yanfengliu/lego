import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { claimsFor } from "./part-identification-score.mjs";
import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  assertV4CalloutManifest,
  authenticateJsonArtifact,
  boundAnswers,
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  jsonArtifactFromBytes,
  readJsonArtifact,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import {
  PAIR_JUDGED_DIFFERENT_CONFIDENCE,
  PAIR_JUDGED_SAME_CONFIDENCE,
  pairJudgedVerdictsByCalloutIndex,
} from "./part-identification-pair-judged.mjs";
import { PART_TRUTH_PATH } from "./part-identification-truth-key.mjs";
import { MAX_JSON_ARTIFACT_BYTES, writeContainedFile } from "./part-identification-io.mjs";
import {
  authenticateCardImageBundle,
  verifyRetainedCardImageClosure,
} from "./part-identification-card-images.mjs";
import {
  resolveElementPart,
  summarizeCatalogCoverage,
} from "../apps/web/src/assembly/element-catalog.ts";

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
const CALLOUTS = "output/callout-thumbnails";
const IDENTIFICATION = "output/part-identification";
const OUT = "output/real-build";
const COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/1";
const FEATURE_BINDING_FIELDS = [
  "identity",
  "file",
  "pageNumber",
  "stepNumber",
  "quantity",
  "sha256",
  "evidenceKind",
];
const IDENTIFICATION_DIGEST_ROLES = new Set([
  "features",
  "match",
  "distances",
  "cards",
  "cardImages",
  "answers",
  "elementResolution",
  // The retained blind pair-judging verdicts. It is last so the six roles that
  // preceded it keep their published key order, and it is a role rather than a
  // pinned constant for the same reason cards and answers are: a trust source
  // that is not in the digests can be swapped without the coverage bytes moving.
  "pairJudged",
]);
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SHORT_CROP_DIGEST = /^sha256:[0-9a-f]{16}$/u;
const PUBLISHED_PART_NUMBER = /^[0-9][0-9a-z]{0,31}$/iu;
const MAX_COVERAGE_CALLOUTS = 4_000;

function requireJsonArtifact(path, recovery, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. ${recovery}`);
  }
  return readJsonArtifact(path, label);
}

function option(argv, name, fallback) {
  const flag = `--${name}`;
  const positions = argv.flatMap((value, index) => (value === flag ? [index] : []));
  if (positions.length > 1) {
    throw new Error(`${flag} may be supplied once; received ${positions.length} occurrences.`);
  }
  if (positions.length === 0) return fallback;
  const at = positions[0];
  if (at === argv.length - 1 || argv[at + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return argv[at + 1];
}

export function bookletCatalogCoverageUsage() {
  return [
    "Usage: node scripts/booklet-catalog-coverage.mjs [options]",
    "",
    "Adjudicated example (requires current card PNGs, their retained images.bin bundle, match-bound manifest, and pinned-model answers):",
    `  node scripts/booklet-catalog-coverage.mjs --source adjudicated --model ${PART_IDENTIFICATION_MODEL_ID} --assign one-to-one --last-step 50`,
    "",
    "Deterministic example (geometry only; no cards or answers are read):",
    "  node scripts/booklet-catalog-coverage.mjs --source deterministic --assign one-to-one --last-step 50",
    "",
    "Required for both modes: output/callout-thumbnails/manifest.json plus raw-byte-bound features, match, distances, and output/part-identification/element-resolution.json.",
    "element-resolution.json is a retained prerequisite; part-identification has no resolve command.",
    `Also required for both modes: the tracked blind pair-judging verdicts at ${PART_TRUTH_PATH}, bound as the pairJudged closure role.`,
    "",
    "Options: --source deterministic|adjudicated  --model <pinned-id>  --assign nearest|one-to-one|quantity-informed  --last-step 1..359  --help",
  ].join("\n");
}

function parseManifest(manifestBytes, expectation) {
  const artifact = jsonArtifactFromBytes(manifestBytes, "Callout manifest");
  return {
    artifact,
    manifest: assertV4CalloutManifest(artifact.value, expectation),
  };
}

function snapshotIdentificationDigests(value) {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      "Identification digests must be an object containing only authenticated closure-role digests.",
    );
  }
  const entries = Object.entries(value);
  const invalid = entries.filter(
    ([role, digest]) =>
      !IDENTIFICATION_DIGEST_ROLES.has(role) ||
      typeof digest !== "string" ||
      !SHA256_DIGEST.test(digest),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Identification digests contain unsupported or malformed roles ${JSON.stringify(invalid.map(([role]) => role))}. Allowed roles are ${JSON.stringify([...IDENTIFICATION_DIGEST_ROLES])}; pdf and calloutManifest are derived only from the retained manifest artifact.`,
    );
  }
  const captured = new Map(entries);
  return Object.fromEntries(
    [...IDENTIFICATION_DIGEST_ROLES]
      .filter((role) => captured.has(role))
      .map((role) => [role, captured.get(role)]),
  );
}

function snapshotCoverageFeatures(value) {
  const callouts = value?.callouts;
  const inputDigestsValue = value?.inputDigests;
  const inputDigests =
    typeof inputDigestsValue === "object" &&
    inputDigestsValue !== null &&
    !Array.isArray(inputDigestsValue)
      ? {
          pdf: inputDigestsValue.pdf,
          calloutManifest: inputDigestsValue.calloutManifest,
        }
      : inputDigestsValue;
  if (!Array.isArray(callouts)) return { callouts, inputDigests };
  const length = callouts.length;
  if (length > MAX_COVERAGE_CALLOUTS) {
    throw new Error(
      `Part-identification features contain ${length} callouts; maximum snapshot size is ${MAX_COVERAGE_CALLOUTS}. Regenerate the bounded identification closure from the exact manifest.`,
    );
  }
  const held = [];
  for (let index = 0; index < length; index += 1) {
    const callout = callouts[index];
    if (typeof callout !== "object" || callout === null) {
      held.push(callout);
      continue;
    }
    held.push(Object.fromEntries(FEATURE_BINDING_FIELDS.map((field) => [field, callout[field]])));
  }
  return { callouts: held, inputDigests };
}

function snapshotCoverageClaims(value, calloutCount) {
  if (!(value instanceof Map)) return value;
  return new Map(
    Array.from({ length: calloutCount }, (_, index) => {
      const claim = value.get(index);
      return [
        index,
        typeof claim === "object" && claim !== null
          ? { elementId: claim.elementId, picked: claim.picked }
          : claim,
      ];
    }),
  );
}

/**
 * Holds the judged verdicts the compiler may read, bounded to exact feature indexes.
 *
 * `undefined` means no judged role was supplied at all, which is a different
 * statement from a supplied role that bound nothing: the first cannot produce a
 * pair-judged confidence anywhere, the second says these exact bytes were in
 * force and none of them matched a current claim.
 */
function snapshotCoverageJudgedVerdicts(value, calloutCount) {
  if (value === undefined || value === null) return null;
  if (!(value instanceof Map)) {
    throw new Error(
      "Pair-judged verdicts must be a Map keyed by exact feature index, so a verdict cannot be attached to a callout by name or position after the fact.",
    );
  }
  const held = new Map();
  for (const [index, entry] of value) {
    if (!Number.isInteger(index) || index < 0 || index >= calloutCount) {
      throw new Error(
        `Pair-judged verdict is keyed by ${JSON.stringify(index)}, which is not a feature index from 0 through ${calloutCount - 1}. Recompute the verdict map from the exact bound features rather than re-keying it.`,
      );
    }
    const verdict = entry?.verdict;
    if (verdict !== "same" && verdict !== "different") {
      throw new Error(
        `Pair-judged verdict for feature index ${index} is ${JSON.stringify(verdict ?? entry)}; a judged pair is exactly "same" or "different". An unjudged pair is absent from the map, not a third verdict value.`,
      );
    }
    if (typeof entry.judgedCrop !== "string" || !SHORT_CROP_DIGEST.test(entry.judgedCrop)) {
      throw new Error(
        `Pair-judged verdict for feature index ${index} names judged crop ${JSON.stringify(entry.judgedCrop ?? "missing")}; a verdict must carry the "sha256:" digest of the drawing that was actually put in front of the rater, so a refusal can name it.`,
      );
    }
    held.set(index, { verdict, judgedCrop: entry.judgedCrop });
  }
  return held;
}

function snapshotCoverageElements(value, claims) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  if (!(claims instanceof Map)) return value;
  const held = Object.create(null);
  for (const claim of claims.values()) {
    const elementId = claim?.elementId;
    if (elementId === null || elementId === undefined || Object.hasOwn(held, elementId)) continue;
    const element = value[elementId];
    held[elementId] =
      typeof element === "object" && element !== null
        ? { partNum: element.partNum, name: element.name, colorId: element.colorId }
        : element;
  }
  return held;
}

function rejectManifestExpectationOverride(input) {
  if (Object.prototype.hasOwnProperty.call(input, "manifestExpectation")) {
    throw new Error(
      "Production catalog coverage pins the repository's full callout-manifest expectation and does not accept a caller-supplied manifestExpectation. Synthetic manifests must use the explicit __testOnly seam.",
    );
  }
}

function assertFeaturesBindManifest(features, manifest) {
  if (!Array.isArray(features?.callouts)) {
    throw new Error("Part-identification features have no callouts array.");
  }
  if (features.callouts.length !== manifest.callouts.length) {
    throw new Error(
      `Part-identification features contain ${features.callouts.length} callouts, but the exact v4 manifest contains ${manifest.callouts.length}. Regenerate features and every index-bound identification artifact from this manifest.`,
    );
  }
  for (let index = 0; index < manifest.callouts.length; index += 1) {
    const expected = manifest.callouts[index];
    const actual = features.callouts[index];
    if (typeof actual !== "object" || actual === null) {
      throw new Error(`Part-identification feature callout ${index} is not an object.`);
    }
    for (const field of FEATURE_BINDING_FIELDS) {
      if (actual[field] !== expected[field]) {
        throw new Error(
          `Part-identification feature callout ${index} field ${field} is ${JSON.stringify(actual[field] ?? "missing")}, but the exact v4 manifest binds ${JSON.stringify(expected[field])}. Regenerate features and every index-bound identification artifact from this manifest.`,
        );
      }
    }
  }
}

/**
 * Compiles content-bound catalog coverage without reading or writing the filesystem.
 * Claims stay index-bound only after every identity-bearing feature field has been
 * proven byte-for-byte equivalent to the exact v4 manifest entry at that index.
 */
function buildBookletCatalogCoverageReportWithExpectation(input, manifestExpectation) {
  const manifestBytes = input.manifestBytes;
  const features = snapshotCoverageFeatures(input.features);
  const claims = snapshotCoverageClaims(
    input.claims,
    Array.isArray(features.callouts) ? features.callouts.length : 0,
  );
  const elements = snapshotCoverageElements(input.elements, claims);
  const judgedVerdicts = snapshotCoverageJudgedVerdicts(
    input.judgedVerdicts,
    Array.isArray(features.callouts) ? features.callouts.length : 0,
  );
  const source = input.source;
  const model = input.model;
  const assignment = input.assignment;
  const lastStep = input.lastStep;
  const identificationDigests = snapshotIdentificationDigests(input.identificationDigests);

  if (!Number.isInteger(lastStep) || lastStep < 1) {
    throw new Error(`lastStep must be a positive integer; received ${JSON.stringify(lastStep)}.`);
  }
  if (!(claims instanceof Map)) {
    throw new Error("Part-identification claims must be a Map keyed by exact feature index.");
  }
  if (typeof elements !== "object" || elements === null || Array.isArray(elements)) {
    throw new Error("Element resolution input must be an object keyed by element id.");
  }
  // A pair-judged confidence is only ever readable as evidence if the bytes that
  // produced it are named in the report's own provenance. Without this edge a
  // caller could hand the compiler verdicts from nowhere and the resulting
  // coverage would look identical to one whose verdicts were retained.
  if (judgedVerdicts !== null && identificationDigests.pairJudged === undefined) {
    throw new Error(
      `Coverage was given ${judgedVerdicts.size} pair-judged verdict(s) but no pairJudged digest, so nothing in the published report would bind the bytes that granted or refused the trust. Compile through the closure, which authenticates ${PART_TRUTH_PATH} and publishes its digest as the pairJudged role.`,
    );
  }

  const { artifact: manifestArtifact, manifest } = parseManifest(
    manifestBytes,
    manifestExpectation,
  );
  assertFeaturesBindManifest(features, manifest);
  const manifestDigest = manifestArtifact.digest;
  // Unconditional: the report publishes inputDigests.pdf out of the manifest, so
  // without this edge a caller that supplies neither a features digest nor
  // feature inputDigests would get a PDF claim no artifact ever asserted.
  const featureInputDigests = features.inputDigests;
  if (
    typeof featureInputDigests !== "object" ||
    featureInputDigests === null ||
    featureInputDigests.pdf !== manifest.sourceHash ||
    featureInputDigests.calloutManifest !== manifestDigest
  ) {
    throw new Error(
      `Part-identification features bind PDF/manifest digests ${JSON.stringify(featureInputDigests ?? "missing")}, but this retained manifest derives ${JSON.stringify({ pdf: manifest.sourceHash, calloutManifest: manifestDigest })}. Every coverage report publishes those two digests as its own provenance, so features must carry an inputDigests object binding both. Regenerate features, match, distances, cards and answers from the exact retained manifest bytes; rebinding only downstream digests cannot cross this source boundary.`,
    );
  }
  const byCallout = Object.create(null);
  const requirements = [];
  let unidentified = 0;

  for (let index = 0; index < features.callouts.length; index += 1) {
    const callout = features.callouts[index];
    if (callout.evidenceKind !== "part-art") continue;
    const claim = claims.get(index);
    const elementId = claim?.elementId ?? null;
    const judgedEntry = judgedVerdicts?.get(index) ?? null;
    const judged = judgedEntry?.verdict ?? null;
    if (judged === "same" && elementId === null) {
      throw new Error(
        `Callout ${callout.identity} carries a pair-judged "same" verdict but the assignment claims no element for it, so there was no right-hand picture to judge. Recompute the verdict map from the exact claims this report is compiled from.`,
      );
    }
    // Judged evidence outranks the vision label in both directions: it says a
    // human-scale question was answered about these two pictures, where the
    // vision label only says the model agreed with itself.
    const identificationConfidence =
      judged === "same"
        ? PAIR_JUDGED_SAME_CONFIDENCE
        : judged === "different"
          ? PAIR_JUDGED_DIFFERENT_CONFIDENCE
          : (claim?.picked ?? null);
    const element = elementId === null ? null : elements[elementId];
    const binding = {
      identity: callout.identity,
      file: callout.file,
      pageNumber: callout.pageNumber,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      cropDigest: callout.sha256,
      inputDigest: manifestDigest,
    };
    if (judged === "different" || element === null || element === undefined) {
      unidentified += 1;
      byCallout[callout.identity] = {
        ...binding,
        elementId,
        identificationConfidence,
        resolution: null,
        unidentifiedBecause:
          judged === "different"
            ? `Blind pair judging refused callout ${callout.identity}: the retained verdict for judged crop ` +
              `${judgedEntry.judgedCrop} claimed to be element ${elementId} says the two drawings are different ` +
              `parts. A judged mismatch is stronger evidence than an absent judgement, so this identity is ` +
              `refused rather than left merely untrusted. Only a different claim for that crop, or a re-cut crop, ` +
              `can satisfy it — re-asserting element ${elementId} cannot.`
            : elementId === null
              ? `Part identification made no claim for callout ${callout.identity}; it is one of the ${features.callouts.length} stable identities the assignment left unmatched.`
              : `Part identification claimed element ${elementId} for callout ${callout.identity}, but the published parts list resolves no design number for it.`,
      };
      continue;
    }
    const resolution = resolveElementPart({
      elementId,
      partNum: element.partNum,
      name: element.name,
      colorId: element.colorId,
    });
    byCallout[callout.identity] = {
      ...binding,
      elementId,
      identificationConfidence,
      resolution,
      unidentifiedBecause: null,
    };
    if (callout.stepNumber >= 1 && callout.stepNumber <= lastStep) {
      requirements.push({
        stepNumber: callout.stepNumber,
        quantity: callout.quantity,
        resolution,
      });
    }
  }

  return {
    schemaVersion: COVERAGE_SCHEMA,
    inputDigests: {
      pdf: manifest.sourceHash,
      calloutManifest: manifestDigest,
      ...identificationDigests,
    },
    what:
      "Whether the pinned catalog holds the parts the real booklet's opening steps place. " +
      "The covered prefix is the number that governs a rebuild: a step whose part is absent cannot be skipped, " +
      "because the step after it has nothing to attach to.",
    identification: {
      source,
      model: source === "deterministic" ? null : model,
      assignment,
    },
    lastStep,
    calloutsConsidered: requirements.length,
    calloutsUnidentified: unidentified,
    coverage: summarizeCatalogCoverage(requirements),
    byCallout,
  };
}

export function buildBookletCatalogCoverageReport(input) {
  rejectManifestExpectationOverride(input);
  return buildBookletCatalogCoverageReportWithExpectation(input, FULL_CALLOUT_MANIFEST_EXPECTATION);
}

/** Rebuilds coverage from the complete bound identification closure, without filesystem trust. */
function compileBookletCatalogCoverageClosureWithExpectation(input, manifestExpectation) {
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
  const pairJudgedArtifactInput = input.pairJudgedArtifact;
  const manifestBytes = input.manifestBytes;
  const lastStep = input.lastStep;

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
    });
  } else if (
    model !== null ||
    cardsArtifactInput !== null ||
    cardImagesArtifactInput != null ||
    answersArtifactInput !== null
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
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
    cards: cards?.cards,
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
  const judgedVerdicts = pairJudgedVerdictsByCalloutIndex({
    truth: pairJudgedArtifact.value,
    features,
    claims,
    label: `Pair-judged truth (${PART_TRUTH_PATH})`,
  });
  return buildBookletCatalogCoverageReportWithExpectation(
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
      },
    },
    manifestExpectation,
  );
}

export function compileBookletCatalogCoverageClosure(input) {
  rejectManifestExpectationOverride(input);
  return compileBookletCatalogCoverageClosureWithExpectation(
    input,
    FULL_CALLOUT_MANIFEST_EXPECTATION,
  );
}

/** Rejects a rehashed coverage edit unless the complete raw closure reproduces its exact bytes. */
export function verifyBookletCatalogCoverageClosure(input) {
  rejectManifestExpectationOverride(input);
  return verifyBookletCatalogCoverageClosureWithExpectation(
    input,
    FULL_CALLOUT_MANIFEST_EXPECTATION,
  );
}

function verifyBookletCatalogCoverageClosureWithExpectation(input, manifestExpectation) {
  const report = compileBookletCatalogCoverageClosureWithExpectation(input, manifestExpectation);
  const expectedBytes = Buffer.from(`${JSON.stringify(report, null, 1)}\n`);
  if (!expectedBytes.equals(Buffer.from(input.coverageBytes))) {
    throw new Error(
      "Catalog coverage bytes do not exactly reproduce from the bound features, match, distances, card manifest, retained card images, " +
        "answers, element resolution, blind pair-judging verdicts, and callout manifest. Recompile coverage; a rehashed confidence or " +
        "resolution edit is not evidence, and neither is a pair-judged confidence the retained verdicts do not reproduce.",
    );
  }
  return report;
}

export const __testOnly = Object.freeze({
  buildBookletCatalogCoverageReport: (input, manifestExpectation) =>
    buildBookletCatalogCoverageReportWithExpectation(input, manifestExpectation),
  compileBookletCatalogCoverageClosure: (input, manifestExpectation) =>
    compileBookletCatalogCoverageClosureWithExpectation(input, manifestExpectation),
  verifyBookletCatalogCoverageClosure: (input, manifestExpectation) =>
    verifyBookletCatalogCoverageClosureWithExpectation(input, manifestExpectation),
});

export function runBookletCatalogCoverageCli(argv = process.argv.slice(2), context = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    (context.stdout ?? console.log)(bookletCatalogCoverageUsage());
    return 0;
  }
  const source = option(argv, "source", "adjudicated");
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const assignment = option(argv, "assign", "one-to-one");
  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `--source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (!["nearest", "one-to-one", "quantity-informed"].includes(assignment)) {
    throw new Error(
      `--assign must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(assignment)}.`,
    );
  }
  const lastStepValue = option(argv, "last-step", "50");
  const lastStep = Number(lastStepValue);
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > 359) {
    throw new Error(
      `--last-step must be an integer from 1 through 359; received ${JSON.stringify(lastStepValue)}.`,
    );
  }

  const manifestPath = join(CALLOUTS, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing ${manifestPath}. Produce the full v4 manifest with: CALLOUT_PAGE_LIMIT=0 npx playwright test callout-thumbnails.`,
    );
  }
  const manifestArtifact = readJsonArtifact(manifestPath, "callout manifest");
  const manifestBytes = manifestArtifact.bytes;
  const featuresPath = join(IDENTIFICATION, "features.json");
  const matchPath = join(IDENTIFICATION, "match.json");
  const distancesPath = join(IDENTIFICATION, "distances.json");
  for (const [path, produce] of [
    [featuresPath, "node scripts/part-identification.mjs features"],
    [matchPath, "node scripts/part-identification.mjs match"],
    [distancesPath, "node scripts/part-identification.mjs match"],
  ]) {
    if (!existsSync(path)) throw new Error(`Missing ${path}. Produce it with: ${produce}`);
  }
  const featuresArtifact = readJsonArtifact(featuresPath, "part-identification features");
  const matchArtifact = readJsonArtifact(matchPath, "part-identification match");
  const distancesArtifact = readJsonArtifact(distancesPath, "part-identification distances");
  const elementsPath = join(IDENTIFICATION, "element-resolution.json");
  const elementsArtifact = requireJsonArtifact(
    elementsPath,
    "Restore or reproduce the retained element-resolution artifact from its pinned source; part-identification has no resolve command.",
    "part-identification element resolution",
  );
  const answersPath = join(IDENTIFICATION, `answers-${model}.json`);
  if (source !== "deterministic" && !existsSync(answersPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} needs vision answers at ${answersPath}. ` +
        `Produce them with: node scripts/part-identification.mjs ask --model ${model}. ` +
        `Or pass --source deterministic to score geometry alone, which is measurably worse on the first fifty steps.`,
    );
  }
  const cardsPath = join(IDENTIFICATION, "cards", "manifest.json");
  if (source !== "deterministic" && !existsSync(cardsPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} needs a feature/match-bound cards manifest at ${cardsPath}. Regenerate cards from the exact unchanged feature galleries.`,
    );
  }
  const cardsArtifact =
    source === "deterministic" ? null : readJsonArtifact(cardsPath, "part-identification cards");
  const cardsRoot = join(IDENTIFICATION, "cards");
  const cardImagesArtifact =
    source === "deterministic"
      ? null
      : verifyRetainedCardImageClosure(cardsRoot, cardsArtifact.value);
  const answersArtifact =
    source !== "deterministic" && existsSync(answersPath)
      ? readJsonArtifact(answersPath, `vision answers for ${model}`)
      : null;
  const pairJudgedArtifact = requireJsonArtifact(
    PART_TRUTH_PATH,
    `The blind pair-judging verdicts are a tracked repository input, not a regenerable output: restore ${PART_TRUTH_PATH} from Git rather than compiling coverage without the trust source.`,
    "part-identification pair-judged truth",
  );
  const report = compileBookletCatalogCoverageClosure({
    manifestBytes,
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
    cardsArtifact,
    cardImagesArtifact,
    answersArtifact,
    pairJudgedArtifact,
    elementsArtifact,
    source,
    model: source === "deterministic" ? null : model,
    assignment,
    lastStep,
  });

  mkdirSync(OUT, { recursive: true });
  writeContainedFile(OUT, "catalog-coverage.json", `${JSON.stringify(report, null, 1)}\n`, {
    label: "Catalog coverage report",
    pathLabel: "Catalog coverage report path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
  console.log(
    [
      `steps covered ${report.coverage.stepsCovered}/${report.coverage.stepsTotal}`,
      `covered prefix ${report.coverage.coveredPrefixLength}`,
      `first covered step ${report.coverage.firstCoveredStep ?? "none"}`,
      `pieces placeable ${report.coverage.piecesPlaceable}/${report.coverage.piecesTotal}`,
      `designs missing ${report.coverage.missingDesigns.length}`,
    ].join(" | "),
  );
  for (const design of report.coverage.missingDesigns.slice(0, 12)) {
    console.log(
      `  ${design.partNum.padEnd(12)} ${String(design.pieces).padStart(3)} pieces  steps ${design.steps.join(",")}  ${design.name}`,
    );
  }
  return report;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) runBookletCatalogCoverageCli();
