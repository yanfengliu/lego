import {
  assertV6CalloutManifest,
  jsonArtifactFromBytes,
} from "./part-identification-artifacts.mjs";
import { boundedObserved } from "./bounded-observed-value.mjs";
import {
  PAIR_JUDGED_DIFFERENT_CONFIDENCE,
  PAIR_JUDGED_SAME_CONFIDENCE,
} from "./part-identification-pair-judged.mjs";
import { PART_TRUTH_PATH } from "./part-identification-truth-key.mjs";
import {
  resolveElementPart,
  summarizeCatalogCoverage,
} from "../apps/web/src/assembly/element-catalog.ts";

const COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/3";
const LEGACY_COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/2";
const FULL_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const FEATURE_BINDING_FIELDS = [
  "identity",
  "file",
  "pageNumber",
  "stepNumber",
  "quantity",
  "sha256",
  "evidenceKind",
  // The printed type size travels with evidenceKind, because it is the second
  // independent source for it. Binding only the class would let features carry a
  // face that no longer contradicts a wrong class.
  "heightPt",
];
const IDENTIFICATION_DIGEST_ROLES = new Set([
  "features",
  "match",
  "distances",
  "cards",
  "cardImages",
  "answers",
  "elementResolution",
  // The retained blind pair-judging verdicts. It is last so the seven roles that
  // preceded it keep their published key order, and it is a role rather than a
  // pinned constant for the same reason cards and answers are: a trust source
  // that is not in the digests can be swapped without the coverage bytes moving.
  "pairJudged",
  "sourceArtRebound",
]);
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_COVERAGE_CALLOUTS = 4_000;
const CURRENT_MAXIMUM_BOOKLET_PRINTED_STEP = 50;
const LEGACY_MAXIMUM_BOOKLET_PRINTED_STEP = 359;

function parseManifest(manifestBytes, expectation) {
  const artifact = jsonArtifactFromBytes(manifestBytes, "Callout manifest");
  return {
    artifact,
    manifest: assertV6CalloutManifest(artifact.value, expectation),
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
    if (typeof entry.judgedCrop !== "string" || !FULL_SHA256.test(entry.judgedCrop)) {
      throw new Error(
        `Pair-judged verdict for feature index ${index} names judged crop ${JSON.stringify(entry.judgedCrop ?? "missing")}; a verdict must carry the "sha256:" digest of the drawing that was actually put in front of the rater, so a refusal can name it.`,
      );
    }
    if (typeof entry.judgedElementId !== "string" || entry.judgedElementId.length < 1) {
      throw new Error(
        `Pair-judged verdict for feature index ${index} must retain the exact judged element; received ${JSON.stringify(entry?.judgedElementId)}. Recompute it from the exact bound truth, features, and claims rather than supplying a detached verdict map.`,
      );
    }
    held.set(index, {
      verdict,
      judgedCrop: entry.judgedCrop,
      judgedElementId: entry.judgedElementId,
    });
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

export function rejectManifestExpectationOverride(input) {
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
      `Part-identification features contain ${features.callouts.length} callouts, but the exact v6 manifest contains ${manifest.callouts.length}. Regenerate features and every index-bound identification artifact from this manifest.`,
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
          `Part-identification feature callout ${index} field ${field} is ${JSON.stringify(actual[field] ?? "missing")}, but the exact v6 manifest binds ${JSON.stringify(expected[field])}. Regenerate features and every index-bound identification artifact from this manifest.`,
        );
      }
    }
  }
}

/**
 * Compiles content-bound catalog coverage without reading or writing the filesystem.
 * Claims stay index-bound only after every identity-bearing feature field has been
 * proven byte-for-byte equivalent to the exact v6 manifest entry at that index.
 */
function buildBookletCatalogCoverageReportInternal(
  input,
  manifestExpectation,
  { maximumLastStep, prefixScopedClaims, schemaVersion, sourceArtReboundRequired },
) {
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

  if (!Number.isSafeInteger(lastStep) || lastStep < 1 || lastStep > maximumLastStep) {
    throw new Error(
      `lastStep must be a safe integer from 1 through ${maximumLastStep}; received ${boundedObserved(lastStep)}. Recompile coverage for the authorized printed-booklet prefix.`,
    );
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
  if (sourceArtReboundRequired && identificationDigests.sourceArtRebound === undefined) {
    throw new Error(
      "Coverage/3 requires the verified source-art-rebound artifact digest even when the requested prefix ends before its step-4 anchor. Compile through the raw PDF/manifest verifier; omitting the role cannot disable relation counterevidence or change the report generation.",
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
      `Part-identification features bind PDF/manifest digests ${JSON.stringify(featureInputDigests ?? "missing")}, but this retained manifest derives ${JSON.stringify({ pdf: manifest.sourceHash, calloutManifest: manifestDigest })}. Every coverage report publishes those two digests as its own provenance, so features must carry an inputDigests object binding both. Regenerate features, match, distances, cards, card images, and answers from the exact retained manifest bytes; rebinding only downstream digests cannot cross this source boundary.`,
    );
  }
  const byCallout = Object.create(null);
  const requirements = [];
  let unidentified = 0;

  for (let index = 0; index < features.callouts.length; index += 1) {
    const callout = features.callouts[index];
    if (callout.evidenceKind !== "part-art") continue;
    const binding = {
      identity: callout.identity,
      file: callout.file,
      pageNumber: callout.pageNumber,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      cropDigest: callout.sha256,
      inputDigest: manifestDigest,
    };
    const insideRequestedPrefix = callout.stepNumber >= 1 && callout.stepNumber <= lastStep;
    if (prefixScopedClaims && !insideRequestedPrefix) {
      // Coverage/3 retains the complete 359-step source/index closure, but a
      // row outside the requested prefix is indexing only. In particular, a
      // full-booklet assignment cannot leak element, confidence, catalog, or
      // placement-like authority into steps the reconstruction did not ask for.
      byCallout[callout.identity] = {
        ...binding,
        elementId: null,
        identificationConfidence: null,
        resolution: null,
        unidentifiedBecause: null,
      };
      continue;
    }
    const claim = claims.get(index);
    const elementId = claim?.elementId ?? null;
    const judgedEntry = judgedVerdicts?.get(index) ?? null;
    const judged = judgedEntry?.verdict ?? null;
    if (
      judgedEntry !== null &&
      (judgedEntry.judgedCrop !== callout.sha256 || judgedEntry.judgedElementId !== elementId)
    ) {
      throw new Error(
        `Pair-judged verdict for callout ${callout.identity} binds crop/element ${JSON.stringify({ crop: judgedEntry.judgedCrop, elementId: judgedEntry.judgedElementId })}, but this exact feature and claim bind ${JSON.stringify({ crop: callout.sha256, elementId })}. Recompute the verdict map from this coverage input; a digest role alone cannot attach a judgement to different evidence.`,
      );
    }
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
    if (insideRequestedPrefix) {
      requirements.push({
        stepNumber: callout.stepNumber,
        quantity: callout.quantity,
        resolution,
      });
    }
  }

  return {
    schemaVersion,
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

export function buildBookletCatalogCoverageReportWithExpectation(input, manifestExpectation) {
  return buildBookletCatalogCoverageReportInternal(input, manifestExpectation, {
    maximumLastStep: CURRENT_MAXIMUM_BOOKLET_PRINTED_STEP,
    prefixScopedClaims: true,
    schemaVersion: COVERAGE_SCHEMA,
    sourceArtReboundRequired: true,
  });
}

/** Frozen report-shape seam for exact replay of retained coverage/2 bytes only. */
export function buildBookletCatalogCoverageReportV2WithExpectation(input, manifestExpectation) {
  return buildBookletCatalogCoverageReportInternal(input, manifestExpectation, {
    maximumLastStep: LEGACY_MAXIMUM_BOOKLET_PRINTED_STEP,
    prefixScopedClaims: false,
    schemaVersion: LEGACY_COVERAGE_SCHEMA,
    sourceArtReboundRequired: false,
  });
}
