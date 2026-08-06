import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { assertPublishedQuantityFaces } from "../apps/web/e2e/callout-faces.ts";
import { CALLOUT_RECOVERY_BY_IDENTITY } from "../apps/web/e2e/callout-recovery-fixture.ts";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  MAX_JSON_ARTIFACT_BYTES,
  assertCanonicalRelativePath,
  readBoundedFile,
  readContainedFile,
} from "./part-identification-io.mjs";
import { isPinnedModelIdentity } from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

export const PART_FEATURES_SCHEMA = "lego.part-identification-features/3";
export const PART_MATCH_SCHEMA = "lego.part-identification-match/2";
export const PART_DISTANCES_SCHEMA = "lego.part-identification-distances/2";
export const PART_CARDS_SCHEMA = "lego.part-identification-cards/4";
export const PART_ANSWERS_SCHEMA = "lego.part-identification-answers/3";
export const PART_SCORE_SCHEMA = "lego.part-identification-score/1";
export const PART_SCORE_SUMMARY_SCHEMA = "lego.part-identification-score-summary/1";
export const DESCRIPTOR_GRID_CELLS = 28 * 28;
export const MAX_DESCRIPTOR_COMPARISON_CELLS = 512 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STABLE_IDENTITY = /^p(\d+)\|q(\d+)\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;
const ELEMENT_ID = /^\d{3,12}$/u;
const ANSWER_KINDS = new Set([
  "brick",
  "plate",
  "tile",
  "slope",
  "wedge",
  "arch",
  "round",
  "technic",
  "other",
]);
const ANSWER_FIELDS = ["colour", "confidence", "kind", "pick", "studsLong", "studsWide"];
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
const byteTriplet = (value) => Array.isArray(value) && value.length === 3 && value.every(byte);

function validDescriptor(descriptor) {
  if (
    typeof descriptor !== "object" ||
    descriptor === null ||
    Array.isArray(descriptor) ||
    Object.keys(descriptor).sort().join(",") !== DESCRIPTOR_FIELDS.join(",") ||
    !Array.isArray(descriptor.grid) ||
    descriptor.grid.length !== DESCRIPTOR_GRID_CELLS ||
    !descriptor.grid.every(byte) ||
    !Array.isArray(descriptor.detail) ||
    descriptor.detail.length !== DESCRIPTOR_GRID_CELLS ||
    !descriptor.detail.every(byte) ||
    !Number.isSafeInteger(descriptor.boxWidth) ||
    descriptor.boxWidth < 1 ||
    descriptor.boxWidth > 4_096 ||
    !Number.isSafeInteger(descriptor.boxHeight) ||
    descriptor.boxHeight < 1 ||
    descriptor.boxHeight > 4_096 ||
    !Number.isSafeInteger(descriptor.pixels) ||
    descriptor.pixels < 1 ||
    descriptor.pixels > descriptor.boxWidth * descriptor.boxHeight ||
    !Number.isFinite(descriptor.aspect) ||
    descriptor.aspect !== descriptor.boxWidth / descriptor.boxHeight ||
    !Number.isFinite(descriptor.ink) ||
    descriptor.ink !== descriptor.pixels / (descriptor.boxWidth * descriptor.boxHeight) ||
    !byteTriplet(descriptor.mean) ||
    !byte(descriptor.lightFace) ||
    !Array.isArray(descriptor.colours) ||
    descriptor.colours.length < 1 ||
    descriptor.colours.length > 4
  ) {
    return false;
  }
  return descriptor.colours.every(
    (colour) =>
      typeof colour === "object" &&
      colour !== null &&
      !Array.isArray(colour) &&
      Object.keys(colour).sort().join(",") === "rgb,share" &&
      byteTriplet(colour.rgb) &&
      Number.isFinite(colour.share) &&
      colour.share > 0 &&
      colour.share <= 1,
  );
}

export class PartIdentificationArtifactBindingError extends Error {
  constructor(artifactRole, mismatches) {
    super(
      `${artifactRole} binding failed: ${mismatches.join("; ")}. ` +
        "Archive legacy answers and rerun the bounded vision pass; cluster indexes cannot cross a match or prompt change.",
    );
    this.name = "PartIdentificationArtifactBindingError";
    this.artifactRole = artifactRole;
    this.mismatches = Object.freeze([...mismatches]);
  }
}

export const sha256Digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function parseJsonBytes(bytes, label) {
  try {
    return parseStrictJsonBytes(bytes);
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}

/** The byte string is the sole authority for both digest and parsed value. */
export function jsonArtifactFromBytes(bytes, label = "JSON artifact") {
  const held = Buffer.from(bytes);
  if (held.length > MAX_JSON_ARTIFACT_BYTES) {
    throw new Error(
      `${label} is ${held.length} bytes, above the ${MAX_JSON_ARTIFACT_BYTES}-byte JSON artifact limit.`,
    );
  }
  return {
    bytes: held,
    digest: sha256Digest(held),
    value: parseJsonBytes(held, label),
  };
}

/** Rejects caller-supplied value/digest views that do not derive from the supplied raw bytes. */
export function authenticateJsonArtifact(artifact, label = "JSON artifact") {
  const bytes = artifact?.bytes;
  const declaredDigest = artifact?.digest;
  const declaredValue = artifact?.value;
  if (typeof artifact !== "object" || artifact === null || !(bytes instanceof Uint8Array)) {
    throw new Error(
      `${label} must carry its raw bytes; digest/value-only objects cannot prove what was parsed. Read or construct the artifact from one bounded byte string.`,
    );
  }
  const derived = jsonArtifactFromBytes(bytes, label);
  if (declaredDigest !== undefined && declaredDigest !== derived.digest) {
    throw new Error(
      `${label} declares digest ${JSON.stringify(declaredDigest)}, but its raw bytes derive ${derived.digest}. Re-read the artifact from one immutable byte string.`,
    );
  }
  if (declaredValue !== undefined && !isDeepStrictEqual(declaredValue, derived.value)) {
    throw new Error(
      `${label} declares a parsed value that does not derive from its raw bytes. Discard the detached value and re-read the artifact.`,
    );
  }
  return derived;
}

const stableIdentity = (pageNumber, quantity, xPt, yPt) =>
  `p${pageNumber}|q${quantity}|x${xPt.toFixed(3)}|y${yPt.toFixed(3)}`;
const expectedEvidenceKind = (identity) =>
  CALLOUT_RECOVERY_BY_IDENTITY.get(identity)?.evidenceKind ?? "part-art";

export const FULL_CALLOUT_MANIFEST_EXPECTATION = Object.freeze({
  sourceHash: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  pagesCropped: 196,
  identityCount: 881,
  rawQuantity: 1_512,
  identitySetDigest: "sha256:618c1815980af3d82ecd96f1697558b8a1976169517448039cff58430e4bf982",
  // Must equal FULL_BOOKLET_CALLOUT_ACCOUNTING in
  // apps/web/e2e/callout-recovery-fixture.ts, which is the classification's own
  // source. callout-contract.test.ts asserts the two agree; a third private copy
  // of these numbers is how the last 26-piece drift went unseen.
  accounting: Object.freeze({
    rawNxIdentityCount: 881,
    rawNxQuantityTotal: 1_512,
    physicalPartArtIdentityCount: 859,
    physicalPartArtQuantityTotal: 1_464,
    semanticIdentityCount: 22,
    semanticQuantityTotal: 48,
  }),
});

/** Exact producer contract for the full v5 booklet callout publication. */
export function assertV5CalloutManifest(manifest, expectation = FULL_CALLOUT_MANIFEST_EXPECTATION) {
  if (
    manifest?.schemaVersion !== "lego.callout-thumbnails/5" ||
    !SHA256.test(manifest.sourceHash ?? "") ||
    manifest.pageSelection !== "full booklet" ||
    !Number.isInteger(manifest.pagesCropped) ||
    manifest.pagesCropped < 1 ||
    !Array.isArray(manifest.callouts) ||
    manifest.callouts.length === 0 ||
    manifest.calloutCount !== manifest.callouts.length ||
    !Array.isArray(manifest.failures) ||
    manifest.failures.length !== 0
  ) {
    throw new Error(
      "Callout features and coverage require one failure-free full-booklet lego.callout-thumbnails/5 manifest with an exact source digest and declared callout count. Regenerate the complete publication from the current PDF.",
    );
  }
  if (
    manifest.sourceHash !== expectation.sourceHash ||
    manifest.pagesCropped !== expectation.pagesCropped ||
    manifest.calloutCount !== expectation.identityCount
  ) {
    throw new Error(
      `Callout manifest is not the independently pinned full-booklet publication. Expected source/pages/identities ` +
        `${expectation.sourceHash}/${expectation.pagesCropped}/${expectation.identityCount}, received ` +
        `${manifest.sourceHash}/${manifest.pagesCropped}/${manifest.calloutCount}. A truncated publication cannot ` +
        `define its own expected totals; regenerate all callout pages from the pinned PDF.`,
    );
  }

  const identities = new Set();
  for (const [index, callout] of manifest.callouts.entries()) {
    const match =
      typeof callout?.identity === "string" ? STABLE_IDENTITY.exec(callout.identity) : null;
    const expectedKind = match === null ? null : expectedEvidenceKind(callout.identity);
    if (
      match === null ||
      identities.has(callout.identity) ||
      typeof callout.file !== "string" ||
      callout.file.length === 0 ||
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
      Number(match[1]) !== callout.pageNumber ||
      Number(match[2]) !== callout.quantity ||
      callout.evidenceKind !== expectedKind ||
      !SHA256.test(callout.sha256 ?? "")
    ) {
      throw new Error(
        `Callout manifest entry ${index} (${JSON.stringify(callout?.identity ?? "missing identity")}) must have one unique stable identity matching its positive page/quantity/x/y fields, the fixed evidence contract ${JSON.stringify(expectedKind ?? "unresolved")}, a retained file, and a lowercase crop digest. Regenerate the full v5 publication; copied metadata cannot redefine a booklet callout.`,
      );
    }
    const expectedStem = callout.identity.replaceAll("|", "-").replaceAll(".", "d");
    let canonicalFile;
    try {
      assertCanonicalRelativePath(callout.file, `Callout manifest entry ${index} file`);
      canonicalFile = new RegExp(`^runs/[0-9a-f]{24}/${expectedStem}\\.png$`, "u").test(
        callout.file,
      );
    } catch {
      canonicalFile = false;
    }
    if (!canonicalFile) {
      throw new Error(
        `Callout manifest entry ${index} file ${JSON.stringify(callout.file)} must be the canonical runs/<24 lowercase hex>/${expectedStem}.png child. Parent paths, links, alternate names, and absolute paths cannot select crop evidence.`,
      );
    }
    identities.add(callout.identity);
  }
  // The second, independent source for the same classification: the type size
  // the booklet printed the label at. The preregistered fixture above cannot see
  // a multiplier nobody registered; this can.
  assertPublishedQuantityFaces(manifest.callouts);

  const physical = manifest.callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  const semantic = manifest.callouts.filter(({ evidenceKind }) => evidenceKind !== "part-art");
  const rawQuantity = manifest.callouts.reduce((total, { quantity }) => total + quantity, 0);
  const physicalQuantity = physical.reduce((total, { quantity }) => total + quantity, 0);
  const semanticQuantity = semantic.reduce((total, { quantity }) => total + quantity, 0);
  const accounting = {
    rawNxIdentityCount: manifest.callouts.length,
    rawNxQuantityTotal: rawQuantity,
    physicalPartArtIdentityCount: physical.length,
    physicalPartArtQuantityTotal: physicalQuantity,
    semanticIdentityCount: semantic.length,
    semanticQuantityTotal: semanticQuantity,
  };
  const identitySetDigest = sha256Digest([...identities].sort().join("\n"));
  const conservation = {
    expectedIdentityCount: expectation.identityCount,
    expectedRawNxQuantityTotal: expectation.rawQuantity,
    expectedIdentitySetSha256: expectation.identitySetDigest,
    publishedIdentityCount: manifest.callouts.length,
    publishedRawNxQuantityTotal: rawQuantity,
    publishedIdentitySetSha256: identitySetDigest,
  };
  const exactFields = (actual, expected) =>
    typeof actual === "object" &&
    actual !== null &&
    Object.entries(expected).every(([key, value]) => actual[key] === value);
  if (
    identitySetDigest !== expectation.identitySetDigest ||
    !exactFields(accounting, expectation.accounting) ||
    !exactFields(manifest.accounting, expectation.accounting) ||
    !exactFields(manifest.conservation, conservation)
  ) {
    throw new Error(
      `Callout manifest accounting or conservation does not recompute from its ${manifest.callouts.length} unique records. Expected ${JSON.stringify(accounting)} and ${JSON.stringify(conservation)}. Regenerate the publication; declared totals and identity-set digests cannot self-certify.`,
    );
  }
  return manifest;
}

/**
 * Read and authenticate the exact crop bytes that a manifest entry names.
 * The decoder receives the hashed Buffer, so it cannot reopen a changed path.
 */
export async function readBoundManifestCrop(entry, root, decode) {
  let bytes;
  try {
    bytes = readContainedFile(root, entry.file, {
      label: `Callout crop ${JSON.stringify(entry.identity ?? "missing identity")}`,
      pathLabel: "Callout manifest file",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
  } catch (cause) {
    throw new Error(
      `Callout crop ${JSON.stringify(entry.identity ?? "missing identity")} at ${JSON.stringify(entry.file ?? "missing file")} could not be read. Regenerate the exact v5 callout publication before extracting features.`,
      { cause },
    );
  }
  const actual = sha256Digest(bytes);
  if (actual !== entry.sha256) {
    throw new Error(
      `Callout crop ${JSON.stringify(entry.identity ?? "missing identity")} at ${JSON.stringify(entry.file ?? "missing file")} has digest ${actual}, but the v5 manifest binds ${JSON.stringify(entry.sha256 ?? "missing")}. Regenerate the callout publication; do not compute descriptors from changed crop bytes.`,
    );
  }
  return decode(bytes);
}

/** Read one inventory thumbnail from the same exact bytes that produced its descriptor. */
export async function readBoundInventoryThumbnail(elementId, expectedDigest, root, decode) {
  const relativePath = `${elementId}.png`;
  let bytes;
  try {
    bytes = readContainedFile(root, relativePath, {
      label: `Inventory thumbnail ${JSON.stringify(elementId)}`,
      pathLabel: "Inventory feature file",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
  } catch (cause) {
    throw new Error(
      `Inventory thumbnail ${JSON.stringify(elementId)} at ${JSON.stringify(relativePath)} could not be read. Regenerate features from the exact inventory gallery before producing tiles or cards.`,
      { cause },
    );
  }
  const actual = sha256Digest(bytes);
  if (actual !== expectedDigest) {
    throw new Error(
      `Inventory thumbnail ${JSON.stringify(elementId)} at ${JSON.stringify(relativePath)} has digest ${actual}, but features bind ${JSON.stringify(expectedDigest ?? "missing")}. Regenerate features, match and every derived image from one unchanged inventory gallery; a same-path replacement cannot inherit the prior descriptor.`,
    );
  }
  return decode(bytes);
}

/** Semantic booklet instructions retained for provenance, never for part assignment. */
export function nonClusteredCalloutRecords(callouts) {
  return callouts.flatMap((callout, index) =>
    callout?.evidenceKind === "part-art"
      ? []
      : [
          {
            index,
            identity: callout?.identity,
            file: callout?.file,
            evidenceKind: callout?.evidenceKind,
          },
        ],
  );
}

export function readJsonArtifact(path, label) {
  const bytes = readBoundedFile(path, { label, maxBytes: MAX_JSON_ARTIFACT_BYTES });
  return jsonArtifactFromBytes(bytes, `${label} at ${path}`);
}

export function assertFeaturesArtifact(artifact) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification features");
  const features = boundArtifact.value;
  const expectedNonClustered = Array.isArray(features?.callouts)
    ? nonClusteredCalloutRecords(features.callouts)
    : [];
  const physicalIndexes = Array.isArray(features?.callouts)
    ? [...features.callouts.keys()].filter(
        (index) => features.callouts[index]?.evidenceKind === "part-art",
      )
    : [];
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
      (physicalIndexes.length * Math.max(0, physicalIndexes.length - 1)) / 2);
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
      `Part-identification features must use ${PART_FEATURES_SCHEMA}, bind their exact PDF/manifest inputs and every inventory source-image digest, contain exact non-degenerate ${DESCRIPTOR_GRID_CELLS}-cell descriptors and no more than ${MAX_DESCRIPTOR_COMPARISON_CELLS} worst-case descriptor-cell comparisons, retain canonical stable manifest records in order, and explicitly exclude every non-part-art record from descriptors and clustering. Observed worst-case work ${comparisonCells}. Regenerate them from the exact current v5 manifest and unchanged inventory gallery.`,
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
  const physicalIndexes = [...features.callouts.keys()].filter(
    (index) => features.callouts[index].evidenceKind === "part-art",
  );
  const match = boundMatchArtifact.value;
  const distances = boundDistancesArtifact.value;
  if (
    match?.schemaVersion !== PART_MATCH_SCHEMA ||
    match.featuresDigest !== boundFeaturesArtifact.digest ||
    match.calloutCount !== physicalIndexes.length ||
    !Array.isArray(match.clusters) ||
    match.clusters.length < 1 ||
    match.clusters.length > physicalIndexes.length ||
    match.clusterCount !== match.clusters?.length
  ) {
    throw new Error(
      `Part-identification match must use ${PART_MATCH_SCHEMA} and bind the exact features digest ${boundFeaturesArtifact.digest}. Regenerate match and distances after every feature change.`,
    );
  }
  if (
    distances?.schemaVersion !== PART_DISTANCES_SCHEMA ||
    distances.featuresDigest !== boundFeaturesArtifact.digest ||
    !Array.isArray(distances.elementIds) ||
    distances.elementIds.length < 1 ||
    distances.elementIds.length > 4_096 ||
    !Array.isArray(distances.rows) ||
    distances.rows.length !== match.clusters.length ||
    distances.rows.some((row) => !Array.isArray(row) || row.length !== distances.elementIds.length)
  ) {
    throw new Error(
      `Part-identification distances must use ${PART_DISTANCES_SCHEMA}, bind the exact features digest ${boundFeaturesArtifact.digest}, and contain one complete element row per cluster.`,
    );
  }

  const members = match.clusters.flatMap((cluster) =>
    Array.isArray(cluster?.members) ? cluster.members : [],
  );
  const uniqueMembers = new Set(members);
  const clusterIndexes = match.clusters.map(({ clusterIndex }) => clusterIndex);
  const membersValid =
    members.length === physicalIndexes.length &&
    uniqueMembers.size === members.length &&
    physicalIndexes.every((member) => uniqueMembers.has(member)) &&
    new Set(clusterIndexes).size === clusterIndexes.length &&
    members.every(
      (member) => Number.isInteger(member) && member >= 0 && member < features.callouts.length,
    ) &&
    match.clusters.every(
      (cluster, rowIndex) =>
        typeof cluster === "object" &&
        cluster !== null &&
        Array.isArray(cluster.members) &&
        cluster.members.length > 0 &&
        cluster.clusterIndex === rowIndex &&
        cluster.members.some((member) => features.callouts[member]?.file === cluster.lead) &&
        cluster.pieces ===
          cluster.members.reduce((total, member) => total + features.callouts[member].quantity, 0),
    );
  if (!membersValid) {
    throw new Error(
      "Part-identification clusters must partition every physical part-art feature index exactly once, exclude every explicit non-clustered semantic index, and bind each lead to one member file.",
    );
  }
  const candidatesValid = match.clusters.every((cluster, rowIndex) => {
    if (
      !Array.isArray(cluster.candidates) ||
      cluster.candidates.length < 1 ||
      cluster.candidates.length > 32
    )
      return false;
    const expected = distances.rows[rowIndex]
      .map((total, elementIndex) => ({ total, elementId: distances.elementIds[elementIndex] }))
      .sort((left, right) => left.total - right.total)
      .slice(0, cluster.candidates.length);
    return cluster.candidates.every(
      (candidate, candidateIndex) =>
        typeof candidate === "object" &&
        candidate !== null &&
        ELEMENT_ID.test(candidate.elementId ?? "") &&
        Number.isFinite(candidate.total) &&
        candidate.total >= 0 &&
        candidate.elementId === expected[candidateIndex]?.elementId &&
        candidate.total === expected[candidateIndex]?.total,
    );
  });
  if (!candidatesValid) {
    throw new Error(
      "Part-identification candidates must be the exact ranked prefix of the bound all-element distance rows.",
    );
  }
  if (
    new Set(distances.elementIds).size !== distances.elementIds.length ||
    distances.elementIds.some((elementId) => !ELEMENT_ID.test(elementId)) ||
    distances.rows.some((row) => row.some((value) => !Number.isFinite(value) || value < 0))
  ) {
    throw new Error(
      "Part-identification distances require unique decimal element ids and finite non-negative distance values.",
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

export function deriveCardRunId(featuresDigest, matchDigest, cards) {
  const canonicalCards = Object.fromEntries(
    Object.entries(cards ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([cardId, entry]) => [
        cardId,
        {
          sha256: entry?.sha256,
          candidateElementIds: Array.isArray(entry?.candidateElementIds)
            ? [...entry.candidateElementIds]
            : entry?.candidateElementIds,
        },
      ]),
  );
  return sha256Digest(JSON.stringify({ featuresDigest, matchDigest, cards: canonicalCards })).slice(
    "sha256:".length,
    "sha256:".length + 24,
  );
}

export function assertCardsArtifact(artifact, { featuresDigest, matchDigest, clusters }) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification cards");
  const manifest = boundArtifact.value;
  const boundClusters = Array.isArray(clusters) ? clusters : [];
  const indexes = boundClusters.map((cluster) => cluster?.clusterIndex);
  const expectedCards = indexes.map((index) => `card-${String(index).padStart(4, "0")}`).sort();
  const actualCards =
    typeof manifest?.cards === "object" && manifest.cards !== null && !Array.isArray(manifest.cards)
      ? Object.keys(manifest.cards).sort()
      : [];
  const expectedRunId = deriveCardRunId(featuresDigest, matchDigest, manifest?.cards);
  if (
    manifest?.schemaVersion !== PART_CARDS_SCHEMA ||
    manifest.featuresDigest !== featuresDigest ||
    manifest.matchDigest !== matchDigest ||
    manifest.runId !== expectedRunId ||
    manifest.imagesFile !== `runs/${expectedRunId}/images.bin` ||
    expectedCards.length === 0 ||
    new Set(indexes).size !== indexes.length ||
    !indexes.every((index) => Number.isInteger(index) && index >= 0) ||
    typeof manifest.cards !== "object" ||
    manifest.cards === null ||
    Array.isArray(manifest.cards) ||
    actualCards.length !== expectedCards.length ||
    !actualCards.every((card, index) => card === expectedCards[index]) ||
    Object.keys(manifest).sort().join(",") !==
      "cards,featuresDigest,imagesFile,matchDigest,runId,schemaVersion" ||
    boundClusters.some((cluster) => {
      const cardId = `card-${String(cluster?.clusterIndex).padStart(4, "0")}`;
      const entry = manifest.cards[cardId];
      const ids = entry?.candidateElementIds;
      return (
        !Array.isArray(cluster?.candidates) ||
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry) ||
        Object.keys(entry).sort().join(",") !== "candidateElementIds,file,sha256" ||
        entry.file !== `runs/${expectedRunId}/${cardId}.png` ||
        !SHA256.test(entry.sha256 ?? "") ||
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > cluster.candidates.length ||
        new Set(ids).size !== ids.length ||
        ids.some(
          (elementId, candidateIndex) =>
            !ELEMENT_ID.test(elementId) ||
            elementId !== cluster.candidates[candidateIndex]?.elementId,
        )
      );
    })
  ) {
    throw new Error(
      `Vision cards must use ${PART_CARDS_SCHEMA}, bind exact features/match digests ${featuresDigest}/${matchDigest}, derive one canonical 24-hex immutable run, and contain exactly one run-contained card digest/file plus the exact displayed ordered candidate prefix for each of ${expectedCards.length} match clusters with no extras. Regenerate cards from the unchanged feature galleries after every feature, match, or display-count change; never repair a pointer by rebinding partial files.`,
    );
  }
  return manifest;
}

export function boundAnswers(
  artifact,
  { model, matchDigest, cardsDigest, promptDigest, clusters, cards },
) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification answers");
  const bundle = boundArtifact.value;
  const allowed = new Set(
    Array.isArray(clusters) ? clusters.map(({ clusterIndex }) => clusterIndex) : [],
  );
  const answerKeys =
    typeof bundle?.answers === "object" && bundle.answers !== null && !Array.isArray(bundle.answers)
      ? Object.keys(bundle.answers)
      : [];
  const mismatches = [];
  if (bundle?.schemaVersion !== PART_ANSWERS_SCHEMA) {
    mismatches.push(
      `schemaVersion observed ${JSON.stringify(bundle?.schemaVersion)} but required ${JSON.stringify(PART_ANSWERS_SCHEMA)}`,
    );
  }
  if (bundle?.model !== model) {
    mismatches.push(
      `model observed ${JSON.stringify(bundle?.model)} but required ${JSON.stringify(model)}`,
    );
  }
  if (!isPinnedModelIdentity(bundle?.modelIdentity, model)) {
    mismatches.push(
      `modelIdentity did not reproduce the pinned identity for ${JSON.stringify(model)}`,
    );
  }
  if (bundle?.matchDigest !== matchDigest) {
    mismatches.push(
      `matchDigest observed ${JSON.stringify(bundle?.matchDigest)} but required ${JSON.stringify(matchDigest)}`,
    );
  }
  if (!SHA256.test(bundle?.cardsDigest ?? "") || bundle?.cardsDigest !== cardsDigest) {
    mismatches.push(
      `cardsDigest observed ${JSON.stringify(bundle?.cardsDigest)} but required ${JSON.stringify(cardsDigest)}`,
    );
  }
  if (!SHA256.test(bundle?.promptDigest ?? "") || bundle?.promptDigest !== promptDigest) {
    mismatches.push(
      `promptDigest observed ${JSON.stringify(bundle?.promptDigest)} but required ${JSON.stringify(promptDigest)}`,
    );
  }
  if (
    typeof bundle?.answers !== "object" ||
    bundle.answers === null ||
    Array.isArray(bundle.answers)
  ) {
    mismatches.push(
      `answers observed ${Array.isArray(bundle?.answers) ? "an array" : typeof bundle?.answers} but required an object keyed by cluster index`,
    );
  }
  const invalidAnswerKeys = answerKeys.filter(
    (key) => !/^(0|[1-9]\d*)$/u.test(key) || !allowed.has(Number(key)),
  );
  if (invalidAnswerKeys.length > 0) {
    mismatches.push(
      `answer cluster indexes ${JSON.stringify(invalidAnswerKeys)} were absent from the required match clusters ${JSON.stringify([...allowed].sort((left, right) => left - right))}`,
    );
  }
  const invalidAnswers = answerKeys.filter((key) => !validAnswerRecord(bundle.answers[key]));
  if (invalidAnswers.length > 0) {
    mismatches.push(
      `answer records ${JSON.stringify(invalidAnswers)} were not null or exact bounded description/pick/confidence objects`,
    );
  }
  const unseenPicks = answerKeys.filter((key) => {
    const answer = bundle.answers[key];
    if (answer === null || !validAnswerRecord(answer) || answer.pick === 0) return false;
    const cardId = `card-${String(Number(key)).padStart(4, "0")}`;
    const displayed = cards?.[cardId]?.candidateElementIds;
    return !Array.isArray(displayed) || answer.pick > displayed.length;
  });
  if (unseenPicks.length > 0) {
    mismatches.push(
      `answer records ${JSON.stringify(unseenPicks)} picked candidates that their exact bound cards did not display`,
    );
  }
  if (mismatches.length > 0) {
    throw new PartIdentificationArtifactBindingError("identification-answers", mismatches);
  }
  return bundle.answers;
}

function validAnswerRecord(answer) {
  if (answer === null) return true;
  if (typeof answer !== "object" || Array.isArray(answer)) return false;
  if (Object.keys(answer).sort().join(",") !== ANSWER_FIELDS.join(",")) return false;
  return (
    ANSWER_KINDS.has(answer.kind) &&
    Number.isInteger(answer.studsLong) &&
    answer.studsLong >= 0 &&
    answer.studsLong <= 64 &&
    Number.isInteger(answer.studsWide) &&
    answer.studsWide >= 0 &&
    answer.studsWide <= 64 &&
    typeof answer.colour === "string" &&
    answer.colour.length >= 1 &&
    answer.colour.length <= 64 &&
    Number.isInteger(answer.pick) &&
    answer.pick >= 0 &&
    answer.pick <= 64 &&
    Number.isFinite(answer.confidence) &&
    answer.confidence >= 0 &&
    answer.confidence <= 1
  );
}

export function assertAnswerRecord(answer, label = "Part-identification answer") {
  if (!validAnswerRecord(answer)) {
    throw new Error(
      `${label} must be null or an exact bounded kind/studsLong/studsWide/colour/pick/confidence object.`,
    );
  }
  return answer;
}

export const answerBundle = ({
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  answers,
}) => ({
  schemaVersion: PART_ANSWERS_SCHEMA,
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  answers,
});
