import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { CALLOUT_RECOVERY_BY_IDENTITY } from "../apps/web/e2e/callout-recovery-fixture.ts";

export const PART_FEATURES_SCHEMA = "lego.part-identification-features/2";
export const PART_MATCH_SCHEMA = "lego.part-identification-match/2";
export const PART_DISTANCES_SCHEMA = "lego.part-identification-distances/2";
export const PART_CARDS_SCHEMA = "lego.part-identification-cards/1";
export const PART_ANSWERS_SCHEMA = "lego.part-identification-answers/2";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STABLE_IDENTITY = /^p(\d+)\|q(\d+)\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;

export const sha256Digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

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
  accounting: Object.freeze({
    rawNxIdentityCount: 881,
    rawNxQuantityTotal: 1_512,
    physicalPartArtIdentityCount: 878,
    physicalPartArtQuantityTotal: 1_504,
    semanticIdentityCount: 3,
    semanticQuantityTotal: 8,
  }),
});

/** Exact producer contract for the full v4 booklet callout publication. */
export function assertV4CalloutManifest(manifest, expectation = FULL_CALLOUT_MANIFEST_EXPECTATION) {
  if (
    manifest?.schemaVersion !== "lego.callout-thumbnails/4" ||
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
      "Callout features and coverage require one failure-free full-booklet lego.callout-thumbnails/4 manifest with an exact source digest and declared callout count. Regenerate the complete publication from the current PDF.",
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
      !Number.isInteger(callout.pageNumber) ||
      callout.pageNumber < 1 ||
      !Number.isInteger(callout.stepNumber) ||
      callout.stepNumber < 1 ||
      !Number.isInteger(callout.quantity) ||
      callout.quantity < 1 ||
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
        `Callout manifest entry ${index} (${JSON.stringify(callout?.identity ?? "missing identity")}) must have one unique stable identity matching its positive page/quantity/x/y fields, the fixed evidence contract ${JSON.stringify(expectedKind ?? "unresolved")}, a retained file, and a lowercase crop digest. Regenerate the full v4 publication; copied metadata cannot redefine a booklet callout.`,
      );
    }
    identities.add(callout.identity);
  }

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
export async function readBoundManifestCrop(entry, path, decode) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (cause) {
    throw new Error(
      `Callout crop ${JSON.stringify(entry.identity ?? "missing identity")} at ${JSON.stringify(entry.file ?? path)} could not be read. Regenerate the exact v4 callout publication before extracting features.`,
      { cause },
    );
  }
  const actual = sha256Digest(bytes);
  if (actual !== entry.sha256) {
    throw new Error(
      `Callout crop ${JSON.stringify(entry.identity ?? "missing identity")} at ${JSON.stringify(entry.file ?? path)} has digest ${actual}, but the v4 manifest binds ${JSON.stringify(entry.sha256 ?? "missing")}. Regenerate the callout publication; do not compute descriptors from changed crop bytes.`,
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
  const bytes = readFileSync(path);
  try {
    return { bytes, digest: sha256Digest(bytes), value: JSON.parse(bytes.toString("utf8")) };
  } catch (error) {
    throw new Error(
      `${label} at ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}

export function assertFeaturesArtifact(artifact) {
  const features = artifact.value;
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
            ? typeof callout.descriptor === "object" && callout.descriptor !== null
            : !("descriptor" in callout)),
      )
    : false;
  if (
    features?.schemaVersion !== PART_FEATURES_SCHEMA ||
    !Array.isArray(features.callouts) ||
    typeof features.inputDigests !== "object" ||
    features.inputDigests === null ||
    features.manifestCalloutCount !== features.callouts.length ||
    features.calloutCount !== physicalIndexes.length ||
    features.nonClusteredCalloutCount !== expectedNonClustered.length ||
    !nonClusteredValid ||
    !descriptorsValid
  ) {
    throw new Error(
      `Part-identification features must use ${PART_FEATURES_SCHEMA}, bind their inputs, retain every manifest record in order, and explicitly exclude every non-part-art record from descriptors and clustering. Regenerate them from the exact current v4 manifest.`,
    );
  }
  return features;
}

export function assertBoundMatchArtifacts({ featuresArtifact, matchArtifact, distancesArtifact }) {
  const features = assertFeaturesArtifact(featuresArtifact);
  const physicalIndexes = [...features.callouts.keys()].filter(
    (index) => features.callouts[index].evidenceKind === "part-art",
  );
  const match = matchArtifact.value;
  const distances = distancesArtifact.value;
  if (
    match?.schemaVersion !== PART_MATCH_SCHEMA ||
    match.featuresDigest !== featuresArtifact.digest ||
    match.calloutCount !== physicalIndexes.length ||
    match.clusterCount !== match.clusters?.length
  ) {
    throw new Error(
      `Part-identification match must use ${PART_MATCH_SCHEMA} and bind the exact features digest ${featuresArtifact.digest}. Regenerate match and distances after every feature change.`,
    );
  }
  if (
    distances?.schemaVersion !== PART_DISTANCES_SCHEMA ||
    distances.featuresDigest !== featuresArtifact.digest ||
    !Array.isArray(distances.elementIds) ||
    !Array.isArray(distances.rows) ||
    distances.rows.length !== match.clusters.length ||
    distances.rows.some((row) => !Array.isArray(row) || row.length !== distances.elementIds.length)
  ) {
    throw new Error(
      `Part-identification distances must use ${PART_DISTANCES_SCHEMA}, bind the exact features digest ${featuresArtifact.digest}, and contain one complete element row per cluster.`,
    );
  }

  const members = match.clusters.flatMap((cluster) => cluster.members ?? []);
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
    if (!Array.isArray(cluster.candidates) || cluster.candidates.length < 1) return false;
    const expected = distances.rows[rowIndex]
      .map((total, elementIndex) => ({ total, elementId: distances.elementIds[elementIndex] }))
      .sort((left, right) => left.total - right.total)
      .slice(0, cluster.candidates.length);
    return cluster.candidates.every(
      (candidate, candidateIndex) =>
        candidate.elementId === expected[candidateIndex]?.elementId &&
        candidate.total === expected[candidateIndex]?.total,
    );
  });
  if (!candidatesValid) {
    throw new Error(
      "Part-identification candidates must be the exact ranked prefix of the bound all-element distance rows.",
    );
  }
  return { features, match, distances };
}

export function assertCardsArtifact(artifact, { matchDigest, clusterIndexes }) {
  const manifest = artifact?.value;
  const indexes = Array.isArray(clusterIndexes) ? clusterIndexes : [];
  const expectedCards = indexes.map((index) => `card-${String(index).padStart(4, "0")}`).sort();
  const actualCards =
    typeof manifest?.cards === "object" && manifest.cards !== null && !Array.isArray(manifest.cards)
      ? Object.keys(manifest.cards).sort()
      : [];
  if (
    manifest?.schemaVersion !== PART_CARDS_SCHEMA ||
    manifest.matchDigest !== matchDigest ||
    expectedCards.length === 0 ||
    new Set(indexes).size !== indexes.length ||
    !indexes.every((index) => Number.isInteger(index) && index >= 0) ||
    typeof manifest.cards !== "object" ||
    manifest.cards === null ||
    Array.isArray(manifest.cards) ||
    actualCards.length !== expectedCards.length ||
    !actualCards.every((card, index) => card === expectedCards[index]) ||
    Object.values(manifest.cards).some((digest) => !SHA256.test(digest))
  ) {
    throw new Error(
      `Vision cards must use ${PART_CARDS_SCHEMA}, bind exact match digest ${matchDigest}, and contain exactly one canonical card digest for each of ${expectedCards.length} match clusters with no extras. Regenerate tiles and cards after every match change.`,
    );
  }
  return manifest;
}

export function boundAnswers(artifact, { model, matchDigest, cardsDigest, clusterIndexes }) {
  const bundle = artifact?.value;
  const allowed = new Set(Array.isArray(clusterIndexes) ? clusterIndexes : []);
  const answerKeys =
    typeof bundle?.answers === "object" && bundle.answers !== null && !Array.isArray(bundle.answers)
      ? Object.keys(bundle.answers)
      : [];
  if (
    bundle?.schemaVersion !== PART_ANSWERS_SCHEMA ||
    bundle.model !== model ||
    bundle.matchDigest !== matchDigest ||
    !SHA256.test(bundle.cardsDigest ?? "") ||
    bundle.cardsDigest !== cardsDigest ||
    typeof bundle.answers !== "object" ||
    bundle.answers === null ||
    Array.isArray(bundle.answers) ||
    answerKeys.some((key) => !/^(0|[1-9]\d*)$/u.test(key) || !allowed.has(Number(key)))
  ) {
    throw new Error(
      `Vision answers must use ${PART_ANSWERS_SCHEMA} and bind model ${model} to exact match digest ${matchDigest}. Archive legacy answers and rerun the bounded vision pass; cluster indexes cannot cross a match change.`,
    );
  }
  return bundle.answers;
}

export const answerBundle = ({ model, matchDigest, cardsDigest, answers }) => ({
  schemaVersion: PART_ANSWERS_SCHEMA,
  model,
  matchDigest,
  cardsDigest,
  answers,
});
