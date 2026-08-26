import { readBoundedFile } from "./part-identification-io.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  sha256Digest,
} from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";
import {
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS,
  verifyPartIdentificationSourceArtSemanticRebound,
} from "./part-identification-source-art-semantic-rebound.mjs";
import {
  compilePartIdentificationPrefix50SemanticClosure,
  encodePartIdentificationPrefix50SemanticClosure,
  inspectVerifiedPartIdentificationPrefix50SemanticClosure,
  verifyPartIdentificationPrefix50SemanticClosure,
} from "./part-identification-prefix50-semantic-closure.mjs";
import { CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS } from "./part-identification-prefix50-semantic-closure-source.mjs";

export const PREFIX50_SEMANTIC_CLOSURE_OUTPUT_PATH =
  "output/part-identification/prefix50-semantic-closure.json";

const LEGACY_SEMANTIC_PATH = "output/part-identification/legacy-recut-semantic.json";
const SOURCE_ART_SEMANTIC_PATH = "output/part-identification/source-art-semantic-rebound.json";

function pinnedBytes(pin, label) {
  const bytes = readBoundedFile(pin.path, { label, maxBytes: pin.bytes });
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}. Restore the reviewed input instead of substituting a current lookalike.`,
    );
  }
  return bytes;
}

function artifactBytes(path, pin, label) {
  return pinnedBytes({ path, bytes: pin.bytes, digest: pin.digest }, label);
}

/**
 * Replays the complete current identity chain and returns only its opaque verified result.
 * Every filesystem path and byte commitment is module-owned; no model or browser is invoked.
 */
export async function verifyCurrentPrefix50SemanticClosure() {
  const currentManifestBytes = pinnedBytes(
    CURRENT_LEGACY_RECUT_PINS.currentManifest,
    "Current full-booklet callout manifest",
  );
  const legacyManifestBytes = pinnedBytes(
    CURRENT_LEGACY_RECUT_PINS.legacyManifest,
    "Frozen legacy full-booklet callout manifest",
  );
  const truthBytes = pinnedBytes(CURRENT_LEGACY_RECUT_PINS.truth, "Legacy recut truth");
  const legacyRecutArtifactBytes = pinnedBytes(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut,
    "Legacy recut artifact",
  );
  const officialModelBytes = pinnedBytes(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel,
    "Official Builder model",
  );
  const legacySemanticArtifactBytes = artifactBytes(
    LEGACY_SEMANTIC_PATH,
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedArtifact,
    "Legacy recut semantic artifact",
  );
  const pdfBytes = pinnedBytes(
    CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf,
    "Official instruction PDF",
  );
  const sourceArtSemanticArtifactBytes = artifactBytes(
    SOURCE_ART_SEMANTIC_PATH,
    CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.expectedArtifact,
    "Source-art semantic artifact",
  );
  const inventoryManifestBytes = pinnedBytes(
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest,
    "Inventory thumbnail manifest",
  );
  const elementResolutionBytes = pinnedBytes(
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution,
    "Element resolution",
  );
  const review57Bytes = pinnedBytes(
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57,
    "Reviewed 57-row semantic roster",
  );
  const review3Bytes = pinnedBytes(
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3,
    "Reviewed three-row semantic roster",
  );
  const reviewOutcomesBytes = pinnedBytes(
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes,
    "Prefix-50 semantic review outcomes",
  );

  const semantic = await verifyPartIdentificationLegacyRecutSemantic({
    calloutRoot: "output/callout-thumbnails",
    currentManifestBytes,
    legacyManifestBytes,
    legacyRecutArtifactBytes,
    officialModelBytes,
    truthBytes,
    artifactBytes: legacySemanticArtifactBytes,
  });
  const source = await verifyPartIdentificationSourceArtSemanticRebound({
    manifestBytes: currentManifestBytes,
    officialModelBytes,
    pdfBytes,
    semantic,
    artifactBytes: sourceArtSemanticArtifactBytes,
  });
  const input = {
    calloutManifestBytes: currentManifestBytes,
    calloutRoot: "output/callout-thumbnails",
    elementResolutionBytes,
    inventoryManifestBytes,
    inventoryRoot: "output/inventory-thumbnails",
    officialModelBytes,
    review3Bytes,
    review57Bytes,
    reviewOutcomesBytes,
    source,
  };
  const compiled = await compilePartIdentificationPrefix50SemanticClosure(input);
  const bytes = encodePartIdentificationPrefix50SemanticClosure(compiled);
  const verified = await verifyPartIdentificationPrefix50SemanticClosure({
    ...input,
    artifactBytes: bytes,
  });
  const inspection = inspectVerifiedPartIdentificationPrefix50SemanticClosure(verified);
  return Object.freeze({
    bytes: Buffer.from(bytes),
    elementResolutionBytes: Buffer.from(elementResolutionBytes),
    inspection,
    manifestBytes: Buffer.from(currentManifestBytes),
    verified,
  });
}
