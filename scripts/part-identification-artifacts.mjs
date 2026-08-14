import { isDeepStrictEqual } from "node:util";

import { boundedObserved } from "./bounded-observed-value.mjs";
import { assertCanonicalRelativePath } from "./part-identification-io.mjs";
import {
  PART_DISTANCES_SCHEMA,
  PART_MATCH_SCHEMA,
  derivePartIdentificationMatch,
  partIdentificationDistancesValue,
  partIdentificationMatchValue,
} from "./part-identification-derivation.mjs";
import {
  authenticateJsonArtifact,
  expectedEvidenceKind,
  nonClusteredCalloutRecords,
  stableIdentity,
} from "./part-identification-artifact-source.mjs";

export {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  assertV6CalloutManifest,
  authenticateJsonArtifact,
  jsonArtifactFromBytes,
  nonClusteredCalloutRecords,
  readBoundInventoryThumbnail,
  readBoundManifestCrop,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifact-source.mjs";
export {
  ANSWER_FIELDS,
  OPTIONAL_ANSWER_FIELDS,
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PartIdentificationArtifactBindingError,
  answerBundle,
  assertAnswerRecord,
  assertCardsArtifact,
  boundAnswers,
  canonicalAnswerRecord,
  deriveCardRunId,
  hasUsableAnswer,
  usableAnswerCount,
} from "./part-identification-artifact-vision.mjs";

export const PART_FEATURES_SCHEMA = "lego.part-identification-features/3";
export { PART_DISTANCES_SCHEMA, PART_MATCH_SCHEMA };
export const PART_SCORE_SCHEMA = "lego.part-identification-score/2";
export const PART_SCORE_SUMMARY_SCHEMA = "lego.part-identification-score-summary/2";
export const DESCRIPTOR_GRID_CELLS = 28 * 28;
export const MAX_DESCRIPTOR_COMPARISON_CELLS = 512 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STABLE_IDENTITY = /^p(\d+)\|q(\d+)\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;
const ELEMENT_ID = /^\d{3,12}$/u;
const DESCRIPTOR_FIELDS = [
  "aspect",
  "boxHeight",
  "boxWidth",
  "colours",
  "detail",
  "grid",
  "ink",
  "lightFace",
  "mean",
  "pixels",
];

const byte = (value) => Number.isInteger(value) && value >= 0 && value <= 255;

function descriptorIssue(descriptor) {
  if (typeof descriptor !== "object" || descriptor === null || Array.isArray(descriptor)) {
    return `must be an object; received ${boundedObserved(descriptor)}`;
  }
  const keys = Object.keys(descriptor).sort();
  if (keys.join(",") !== DESCRIPTOR_FIELDS.join(",")) {
    return `keys must be exactly ${JSON.stringify(DESCRIPTOR_FIELDS)}; received ${boundedObserved(keys)}`;
  }
  for (const field of ["grid", "detail"]) {
    const values = descriptor[field];
    if (!Array.isArray(values) || values.length !== DESCRIPTOR_GRID_CELLS) {
      return `${field} must contain exactly ${DESCRIPTOR_GRID_CELLS} byte cells; received ${Array.isArray(values) ? `${values.length} cells` : boundedObserved(values)}`;
    }
    const invalidIndex = values.findIndex((value) => !byte(value));
    if (invalidIndex !== -1) {
      return `${field}[${invalidIndex}] must be an integer byte from 0 through 255; received ${boundedObserved(values[invalidIndex])}`;
    }
  }
  for (const field of ["boxWidth", "boxHeight"]) {
    if (
      !Number.isSafeInteger(descriptor[field]) ||
      descriptor[field] < 1 ||
      descriptor[field] > 4_096
    ) {
      return `${field} must be a safe integer from 1 through 4096; received ${boundedObserved(descriptor[field])}`;
    }
  }
  if (
    !Number.isSafeInteger(descriptor.pixels) ||
    descriptor.pixels < 1 ||
    descriptor.pixels > descriptor.boxWidth * descriptor.boxHeight
  ) {
    return `pixels must be a safe integer from 1 through boxWidth * boxHeight (${descriptor.boxWidth * descriptor.boxHeight}); received ${boundedObserved(descriptor.pixels)}`;
  }
  const expectedAspect = descriptor.boxWidth / descriptor.boxHeight;
  if (!Number.isFinite(descriptor.aspect) || descriptor.aspect !== expectedAspect) {
    return `aspect must equal boxWidth / boxHeight (${expectedAspect}); received ${boundedObserved(descriptor.aspect)}`;
  }
  const expectedInk = descriptor.pixels / (descriptor.boxWidth * descriptor.boxHeight);
  if (!Number.isFinite(descriptor.ink) || descriptor.ink !== expectedInk) {
    return `ink must equal pixels / (boxWidth * boxHeight) (${expectedInk}); received ${boundedObserved(descriptor.ink)}`;
  }
  if (!Array.isArray(descriptor.mean) || descriptor.mean.length !== 3) {
    return `mean must contain exactly three integer bytes from 0 through 255; received ${boundedObserved(descriptor.mean)}`;
  }
  const invalidMeanIndex = descriptor.mean.findIndex((value) => !byte(value));
  if (invalidMeanIndex !== -1) {
    return `mean[${invalidMeanIndex}] must be an integer byte from 0 through 255; received ${boundedObserved(descriptor.mean[invalidMeanIndex])}`;
  }
  if (!byte(descriptor.lightFace)) {
    return `lightFace must be an integer byte from 0 through 255; received ${boundedObserved(descriptor.lightFace)}`;
  }
  if (
    !Array.isArray(descriptor.colours) ||
    descriptor.colours.length < 1 ||
    descriptor.colours.length > 4
  ) {
    return `colours must contain 1 through 4 colour records; received ${Array.isArray(descriptor.colours) ? `${descriptor.colours.length} records` : boundedObserved(descriptor.colours)}`;
  }
  for (let index = 0; index < descriptor.colours.length; index += 1) {
    const colour = descriptor.colours[index];
    if (typeof colour !== "object" || colour === null || Array.isArray(colour)) {
      return `colours[${index}] must be an object; received ${boundedObserved(colour)}`;
    }
    const colourKeys = Object.keys(colour).sort();
    if (colourKeys.join(",") !== "rgb,share") {
      return `colours[${index}] keys must be exactly ["rgb","share"]; received ${boundedObserved(colourKeys)}`;
    }
    if (!Array.isArray(colour.rgb) || colour.rgb.length !== 3) {
      return `colours[${index}].rgb must contain exactly three integer bytes from 0 through 255; received ${boundedObserved(colour.rgb)}`;
    }
    const invalidRgbIndex = colour.rgb.findIndex((value) => !byte(value));
    if (invalidRgbIndex !== -1) {
      return `colours[${index}].rgb[${invalidRgbIndex}] must be an integer byte from 0 through 255; received ${boundedObserved(colour.rgb[invalidRgbIndex])}`;
    }
    if (!Number.isFinite(colour.share) || colour.share <= 0 || colour.share > 1) {
      return `colours[${index}].share must be finite and greater than 0 through 1; received ${boundedObserved(colour.share)}`;
    }
  }
  return null;
}

function validDescriptor(descriptor) {
  return descriptorIssue(descriptor) === null;
}

function assertDescriptor(descriptor, path) {
  const issue = descriptorIssue(descriptor);
  if (issue !== null) {
    throw new Error(
      `Part-identification features ${path} ${issue}. Regenerate that descriptor from the exact retained thumbnail bytes.`,
    );
  }
}

export function assertFeaturesArtifact(artifact) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification features");
  const features = boundArtifact.value;
  if (
    !Array.isArray(features?.callouts) ||
    features.callouts.length < 1 ||
    features.callouts.length > 4_000
  ) {
    throw new Error(
      `Part-identification features callouts must contain 1 through 4000 rows; received ${Array.isArray(features?.callouts) ? `${features.callouts.length} rows` : boundedObserved(features?.callouts)}. Regenerate features from the exact current v6 manifest before deriving non-clustered records or descriptor work.`,
    );
  }
  const expectedNonClustered = nonClusteredCalloutRecords(features.callouts);
  const physicalIndexes = [];
  for (let index = 0; index < features.callouts.length; index += 1) {
    if (features.callouts[index]?.evidenceKind === "part-art") physicalIndexes.push(index);
  }
  const nonClusteredValid =
    Array.isArray(features?.nonClusteredCallouts) &&
    features.nonClusteredCallouts.length === expectedNonClustered.length &&
    features.nonClusteredCallouts.every((record, index) => {
      const expected = expectedNonClustered[index];
      return (
        record?.index === expected.index &&
        record.identity === expected.identity &&
        record.file === expected.file &&
        record.evidenceKind === expected.evidenceKind
      );
    });
  const descriptorsValid = Array.isArray(features?.callouts)
    ? features.callouts.every(
        (callout) =>
          typeof callout === "object" &&
          callout !== null &&
          callout.evidenceKind === expectedEvidenceKind(callout.identity) &&
          (callout.evidenceKind === "part-art"
            ? validDescriptor(callout.descriptor)
            : !("descriptor" in callout)),
      )
    : false;
  const calloutBindingsValid = Array.isArray(features?.callouts)
    ? features.callouts.every((callout, index) => {
        if (
          typeof callout !== "object" ||
          callout === null ||
          !STABLE_IDENTITY.test(callout.identity ?? "") ||
          !Number.isSafeInteger(callout.pageNumber) ||
          callout.pageNumber < 1 ||
          callout.pageNumber > 10_000 ||
          !Number.isSafeInteger(callout.stepNumber) ||
          callout.stepNumber < 1 ||
          callout.stepNumber > 10_000 ||
          !Number.isSafeInteger(callout.quantity) ||
          callout.quantity < 1 ||
          callout.quantity > 10_000 ||
          !Number.isFinite(callout.xPt) ||
          !Number.isFinite(callout.yPt) ||
          stableIdentity(callout.pageNumber, callout.quantity, callout.xPt, callout.yPt) !==
            callout.identity ||
          !SHA256.test(callout.sha256 ?? "")
        ) {
          return false;
        }
        const expectedStem = callout.identity.replaceAll("|", "-").replaceAll(".", "d");
        try {
          assertCanonicalRelativePath(callout.file, `Feature callout ${index} file`);
          return new RegExp(`^runs/[0-9a-f]{24}/${expectedStem}\\.png$`, "u").test(callout.file);
        } catch {
          return false;
        }
      })
    : false;
  const inventoryValid =
    typeof features?.inventory === "object" &&
    features.inventory !== null &&
    !Array.isArray(features.inventory) &&
    Object.keys(features.inventory).length > 0 &&
    Object.keys(features.inventory).length <= 4_096 &&
    Object.entries(features.inventory).every(
      ([elementId, descriptor]) => ELEMENT_ID.test(elementId) && validDescriptor(descriptor),
    );
  const inventorySourceDigestsValid =
    inventoryValid &&
    typeof features?.inventorySourceDigests === "object" &&
    features.inventorySourceDigests !== null &&
    !Array.isArray(features.inventorySourceDigests) &&
    Object.keys(features.inventorySourceDigests).sort().join(",") ===
      Object.keys(features.inventory).sort().join(",") &&
    Object.entries(features.inventorySourceDigests).every(
      ([elementId, digest]) => ELEMENT_ID.test(elementId) && SHA256.test(digest),
    );
  const comparisonCells =
    DESCRIPTOR_GRID_CELLS *
    (physicalIndexes.length * Object.keys(features?.inventory ?? {}).length +
      (physicalIndexes.length * Math.max(0, physicalIndexes.length - 1)) / 2 +
      physicalIndexes.length * 32);
  if (Array.isArray(features?.callouts)) {
    features.callouts.forEach((callout, index) => {
      if (callout?.evidenceKind === "part-art") {
        assertDescriptor(callout.descriptor, `callouts[${index}].descriptor`);
      } else if (typeof callout === "object" && callout !== null && "descriptor" in callout) {
        throw new Error(
          `Part-identification features callouts[${index}].descriptor is present for non-part evidence ${boundedObserved(callout.evidenceKind ?? "missing")}. Remove the descriptor and regenerate the explicit non-clustered record from the exact manifest.`,
        );
      }
    });
  }
  if (
    typeof features?.inventory === "object" &&
    features.inventory !== null &&
    !Array.isArray(features.inventory)
  ) {
    for (const [elementId, descriptor] of Object.entries(features.inventory)) {
      assertDescriptor(descriptor, `inventory[${boundedObserved(elementId)}]`);
    }
  }
  if (
    features?.schemaVersion !== PART_FEATURES_SCHEMA ||
    !Array.isArray(features.callouts) ||
    features.callouts.length < 1 ||
    features.callouts.length > 4_000 ||
    typeof features.inputDigests !== "object" ||
    features.inputDigests === null ||
    !SHA256.test(features.inputDigests.pdf ?? "") ||
    !SHA256.test(features.inputDigests.calloutManifest ?? "") ||
    !inventoryValid ||
    !inventorySourceDigestsValid ||
    !calloutBindingsValid ||
    features.manifestCalloutCount !== features.callouts.length ||
    features.calloutCount !== physicalIndexes.length ||
    features.nonClusteredCalloutCount !== expectedNonClustered.length ||
    !nonClusteredValid ||
    !descriptorsValid ||
    !Number.isSafeInteger(comparisonCells) ||
    comparisonCells > MAX_DESCRIPTOR_COMPARISON_CELLS
  ) {
    throw new Error(
      `Part-identification features must use ${PART_FEATURES_SCHEMA}, bind their exact PDF/manifest inputs and every inventory source-image digest, contain exact non-degenerate ${DESCRIPTOR_GRID_CELLS}-cell descriptors and no more than ${MAX_DESCRIPTOR_COMPARISON_CELLS} worst-case descriptor-coordinate positions across independent member-to-inventory totals, one cached physical-pair matrix, and at most 32 retained lead-candidate expansions. Each counted position feeds the bounded grid and detail channels inside thumbnailDistance; this is an allocation and comparison-call cap, not a claim about primitive loop iterations. Observed worst-case work ${comparisonCells}. Retain canonical stable manifest records in order, explicitly exclude every non-part-art record from descriptors and clustering, and regenerate from the exact current v6 manifest and unchanged inventory gallery.`,
    );
  }
  return features;
}

export function assertBoundMatchArtifacts({ featuresArtifact, matchArtifact, distancesArtifact }) {
  const boundFeaturesArtifact = authenticateJsonArtifact(
    featuresArtifact,
    "part-identification features",
  );
  const boundMatchArtifact = authenticateJsonArtifact(matchArtifact, "part-identification match");
  const boundDistancesArtifact = authenticateJsonArtifact(
    distancesArtifact,
    "part-identification distances",
  );
  const features = assertFeaturesArtifact(boundFeaturesArtifact);
  const match = boundMatchArtifact.value;
  const distances = boundDistancesArtifact.value;
  if (
    match?.schemaVersion !== PART_MATCH_SCHEMA ||
    match.featuresDigest !== boundFeaturesArtifact.digest ||
    !Number.isSafeInteger(match.candidateLimit) ||
    match.candidateLimit < 1 ||
    match.candidateLimit > 32
  ) {
    throw new Error(
      `Part-identification match must use ${PART_MATCH_SCHEMA}, bind exact features digest ${boundFeaturesArtifact.digest}, and declare candidateLimit 1..32; received schemaVersion=${boundedObserved(match?.schemaVersion)}, featuresDigest=${boundedObserved(match?.featuresDigest)}, candidateLimit=${boundedObserved(match?.candidateLimit)}. Regenerate match and distances from the exact feature descriptors.`,
    );
  }
  const derived = derivePartIdentificationMatch(features, match.candidateLimit);
  const expectedMatch = partIdentificationMatchValue(boundFeaturesArtifact.digest, derived);
  if (!isDeepStrictEqual(match, expectedMatch)) {
    throw new Error(
      `Part-identification match does not equal the bounded deterministic ${PART_MATCH_SCHEMA} derivation from ${boundFeaturesArtifact.digest}. It must reproduce the legacy distance-only base partition, refine only within each base cluster, and permit inheritance only for the same unique inventory minimum within the direct distance guard; tied minima stay singleton. Regenerate the complete match; coherent caller-supplied clusters are not evidence.`,
    );
  }
  if (
    distances?.schemaVersion !== PART_DISTANCES_SCHEMA ||
    distances.featuresDigest !== boundFeaturesArtifact.digest ||
    distances.matchDigest !== boundMatchArtifact.digest
  ) {
    throw new Error(
      `Part-identification distances must use ${PART_DISTANCES_SCHEMA} and bind exact features/match digests ${boundFeaturesArtifact.digest}/${boundMatchArtifact.digest}; received schemaVersion=${boundedObserved(distances?.schemaVersion)}, featuresDigest=${boundedObserved(distances?.featuresDigest)}, matchDigest=${boundedObserved(distances?.matchDigest)}. Regenerate distances after every match change.`,
    );
  }
  const expectedDistances = partIdentificationDistancesValue(
    boundFeaturesArtifact.digest,
    boundMatchArtifact.digest,
    derived,
  );
  if (!isDeepStrictEqual(distances, expectedDistances)) {
    throw new Error(
      `Part-identification distances do not equal the complete canonical lead-by-element rows re-derived from ${boundFeaturesArtifact.digest} and match ${boundMatchArtifact.digest}. Regenerate the artifact; caller-supplied distance matrices cannot certify their own clusters or candidates.`,
    );
  }
  return {
    features,
    match,
    distances,
    artifacts: {
      features: boundFeaturesArtifact,
      match: boundMatchArtifact,
      distances: boundDistancesArtifact,
    },
  };
}
