import {
  compilePrefix50OfficialLdrawWorldProposal,
  encodePrefix50OfficialLdrawWorldProposal,
  inspectVerifiedPrefix50OfficialLdrawWorldProposal,
  verifyPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal.mjs";
import {
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";
import { verifyCurrentPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation-current.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";
import { sha256Digest } from "./part-identification-artifact-source.mjs";

function pinnedBytes(pin, label, maximumBytes = pin.bytes) {
  const bytes = readBoundedFile(pin.path, { label, maxBytes: maximumBytes });
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return bytes;
}

export async function reproduceCurrentPrefix50OfficialLdrawWorldProposal() {
  const action = await verifyCurrentPrefix50ActionPreparation();
  const officialXmlBytes = pinnedBytes(
    PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialXml,
    "Current official XML",
  );
  const officialLdrawBytes = pinnedBytes(
    PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialLdraw,
    "Current official LDraw MPD",
  );
  const input = {
    actionPreparation: action.verified,
    officialLdrawBytes,
    officialXmlBytes,
  };
  const artifact = await compilePrefix50OfficialLdrawWorldProposal(input);
  const bytes = encodePrefix50OfficialLdrawWorldProposal(artifact);
  return Object.freeze({ artifact, bytes, input });
}

export async function verifyCurrentPrefix50OfficialLdrawWorldProposal() {
  const reproduced = await reproduceCurrentPrefix50OfficialLdrawWorldProposal();
  const pin = PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError(
      "Current official XML/LDraw world proposal has no reviewed byte/digest pin.",
    );
  }
  const artifactBytes = pinnedBytes(
    { path: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH, ...pin },
    "Current official XML/LDraw world-proposal artifact",
    PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
  );
  const verified = await verifyPrefix50OfficialLdrawWorldProposal({
    ...reproduced.input,
    artifactBytes,
  });
  const inspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(verified);
  if (!artifactBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Current official XML/LDraw world-proposal bytes differ from their fresh authenticated reproduction.",
    );
  }
  return Object.freeze({ bytes: Buffer.from(artifactBytes), inspection, verified });
}
