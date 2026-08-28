import {
  bytesFromVerifiedPrefix50LdrawCatalogFrames,
  compilePrefix50LdrawCatalogFrames,
  encodePrefix50LdrawCatalogFrames,
  inspectVerifiedPrefix50LdrawCatalogFrames,
  verifyPrefix50LdrawCatalogFrames,
} from "./part-identification-prefix50-ldraw-catalog-frames.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";
import { verifyCurrentPrefix50OfficialLdrawWorldProposal } from "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";
import { sha256Digest } from "./part-identification-artifact-source.mjs";

function pinnedArchiveBytes() {
  const pin = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.officialArchive;
  const bytes = readBoundedFile(pin.path, {
    label: "Current official LDraw archive",
    maxBytes: pin.bytes,
  });
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `Current official LDraw archive must be the exact ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return bytes;
}

function pinnedBuilderGeometryBytes() {
  const pin = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.builderGeometry;
  const bytes = readBoundedFile(pin.path, {
    label: "Current Builder/LDraw geometry-proof bundle",
    maxBytes: pin.bytes,
  });
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `Current Builder/LDraw geometry-proof bundle must be ${pin.bytes} bytes at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return bytes;
}

async function currentInputs() {
  const proposal = await verifyCurrentPrefix50OfficialLdrawWorldProposal();
  return {
    officialWorldProposal: proposal.verified,
    officialArchiveBytes: pinnedArchiveBytes(),
    builderGeometryBytes: pinnedBuilderGeometryBytes(),
  };
}

export async function reproduceCurrentPrefix50LdrawCatalogFrames() {
  const input = await currentInputs();
  const artifact = await compilePrefix50LdrawCatalogFrames(input);
  const bytes = encodePrefix50LdrawCatalogFrames(artifact);
  return Object.freeze({ artifact, bytes, input });
}

export async function verifyCurrentPrefix50LdrawCatalogFrames() {
  const input = await currentInputs();
  const pin = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError("Current prefix-50 LDraw/catalog frame registry has no reviewed pin.");
  }
  const artifactBytes = readBoundedFile(PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH, {
    label: "Current prefix-50 LDraw/catalog frame artifact",
    maxBytes: PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
  });
  if (artifactBytes.length !== pin.bytes || sha256Digest(artifactBytes) !== pin.digest) {
    throw new TypeError(
      `Current prefix-50 LDraw/catalog frame artifact must be ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  const verified = await verifyPrefix50LdrawCatalogFrames({ ...input, artifactBytes });
  if (!artifactBytes.equals(bytesFromVerifiedPrefix50LdrawCatalogFrames(verified))) {
    throw new TypeError("Current frame-registry bytes differ from their opaque verified bytes.");
  }
  return Object.freeze({
    bytes: Buffer.from(artifactBytes),
    inspection: inspectVerifiedPrefix50LdrawCatalogFrames(verified),
    verified,
  });
}
