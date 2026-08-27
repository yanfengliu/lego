import {
  compilePrefix50ActionPreparation,
  encodePrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  verifyPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import {
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS,
  PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";
import { sha256Digest } from "./part-identification-legacy-recut-source.mjs";
import { verifyCurrentPrefix50SemanticClosure } from "./part-identification-prefix50-semantic-closure-current.mjs";
import {
  compileStep31_32OrderReconciliation,
  encodeStep31_32OrderReconciliation,
  verifyStep31_32OrderReconciliation,
} from "./part-identification-step31-32-order-reconciliation.mjs";

function pinnedBytes(pin, label, maximumBytes = pin.bytes) {
  const bytes = readBoundedFile(pin.path, { label, maxBytes: maximumBytes });
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return bytes;
}

export async function reproduceCurrentPrefix50ActionPreparation() {
  const semantic = await verifyCurrentPrefix50SemanticClosure();
  const coverageBytes = pinnedBytes(
    CURRENT_PREFIX50_ACTION_PREPARATION_PINS.semanticCoverage,
    "Current semantic coverage /4",
  );
  const officialModelBytes = pinnedBytes(
    CURRENT_PREFIX50_ACTION_PREPARATION_PINS.officialModel,
    "Current official Builder model",
  );
  const orderArtifact = await compileStep31_32OrderReconciliation({
    currentManifestBytes: semantic.manifestBytes,
    officialModelBytes,
  });
  const orderBytes = encodeStep31_32OrderReconciliation(orderArtifact);
  const orderReconciliation = await verifyStep31_32OrderReconciliation({
    artifactBytes: orderBytes,
    currentManifestBytes: semantic.manifestBytes,
    officialModelBytes,
  });
  const input = {
    coverageBytes,
    elementResolutionBytes: semantic.elementResolutionBytes,
    manifestBytes: semantic.manifestBytes,
    officialModelBytes,
    orderReconciliation,
    semanticClosure: semantic.verified,
  };
  const artifact = await compilePrefix50ActionPreparation(input);
  const bytes = encodePrefix50ActionPreparation(artifact);
  return Object.freeze({ artifact, bytes, input });
}

export async function verifyCurrentPrefix50ActionPreparation() {
  const reproduced = await reproduceCurrentPrefix50ActionPreparation();
  const pin = CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact;
  if (pin === null) {
    throw new Error("Current prefix-50 action preparation has no reviewed byte/digest pin.");
  }
  const artifactBytes = pinnedBytes(
    { path: PREFIX50_ACTION_PREPARATION_OUTPUT_PATH, ...pin },
    "Current prefix-50 action-preparation artifact",
    PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  );
  const verified = await verifyPrefix50ActionPreparation({
    ...reproduced.input,
    artifactBytes,
  });
  const inspection = inspectVerifiedPrefix50ActionPreparation(verified);
  if (!artifactBytes.equals(reproduced.bytes)) {
    throw new Error(
      "Current prefix-50 action-preparation bytes differ from their fresh authenticated reproduction.",
    );
  }
  return Object.freeze({ bytes: Buffer.from(artifactBytes), inspection, verified });
}
