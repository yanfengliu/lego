import {
  compilePrefix50OfficialWorldReconciliation,
  encodePrefix50OfficialWorldReconciliation,
  inspectVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";
import {
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";
import { verifyCurrentPrefix50LdrawCatalogFrames } from "./part-identification-prefix50-ldraw-catalog-frames-current.mjs";
import { verifyCurrentPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation-current.mjs";
import { verifyCurrentPrefix50OfficialLdrawWorldProposal } from "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs";
import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";

export async function reproduceCurrentPrefix50OfficialWorldReconciliation() {
  const proposal = await verifyCurrentPrefix50OfficialLdrawWorldProposal();
  const frameRegistry = await verifyCurrentPrefix50LdrawCatalogFrames();
  const actionPreparation = await verifyCurrentPrefix50ActionPreparation();
  const input = {
    proposal: proposal.verified,
    frameRegistry: frameRegistry.verified,
    actionPreparation: actionPreparation.verified,
  };
  const artifact = await compilePrefix50OfficialWorldReconciliation(input);
  const bytes = encodePrefix50OfficialWorldReconciliation(artifact);
  return Object.freeze({ artifact, bytes, input });
}

export async function verifyCurrentPrefix50OfficialWorldReconciliation() {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const pin = PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError("Current official-world reconciliation has no reviewed byte/digest pin.");
  }
  const artifactBytes = readBoundedFile(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH, {
    label: "Current official-world reconciliation artifact",
    maxBytes: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
  });
  const digest = sha256Digest(artifactBytes);
  if (artifactBytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `Current official-world reconciliation must be the reviewed ${pin.bytes}-byte artifact at ${pin.digest}; received ${artifactBytes.length} bytes at ${digest}.`,
    );
  }
  const verified = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes,
  });
  const inspection = inspectVerifiedPrefix50OfficialWorldReconciliation(verified);
  if (!artifactBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Current official-world reconciliation bytes differ from their fresh opaque-input reproduction.",
    );
  }
  return Object.freeze({ bytes: Buffer.from(artifactBytes), inspection, verified });
}
