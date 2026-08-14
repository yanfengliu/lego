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
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STABLE_IDENTITY = /^p(\d+)\|q(\d+)\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;

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

export const stableIdentity = (pageNumber, quantity, xPt, yPt) =>
  `p${pageNumber}|q${quantity}|x${xPt.toFixed(3)}|y${yPt.toFixed(3)}`;
export const expectedEvidenceKind = (identity) =>
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
