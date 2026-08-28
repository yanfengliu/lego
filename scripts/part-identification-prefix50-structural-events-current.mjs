import {
  compilePrefix50StructuralEvents,
  encodePrefix50StructuralEvents,
  inspectVerifiedPrefix50StructuralEvents,
  verifyPrefix50StructuralEvents,
} from "./part-identification-prefix50-structural-events.mjs";
import {
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS,
  PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
  PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH,
} from "./part-identification-prefix50-structural-events-source.mjs";
import { verifyCurrentPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation-current.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";
import { sha256Digest } from "./part-identification-legacy-recut-source.mjs";

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

export async function reproduceCurrentPrefix50StructuralEvents() {
  const action = await verifyCurrentPrefix50ActionPreparation();
  const officialModelBytes = pinnedBytes(
    CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.officialModel,
    "Current official Builder model",
  );
  const transitionClassificationBytes = pinnedBytes(
    CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.transitionClassifications,
    "Current transition-classification corroboration",
  );
  const input = {
    actionPreparation: action.verified,
    officialModelBytes,
    transitionClassificationBytes,
  };
  const artifact = await compilePrefix50StructuralEvents(input);
  const bytes = encodePrefix50StructuralEvents(artifact);
  return Object.freeze({ artifact, bytes, input });
}

export async function verifyCurrentPrefix50StructuralEvents() {
  const reproduced = await reproduceCurrentPrefix50StructuralEvents();
  const pin = CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.expectedArtifact;
  if (pin === null) {
    throw new Error("Current prefix-50 structural events have no reviewed byte/digest pin.");
  }
  const artifactBytes = pinnedBytes(
    { path: PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH, ...pin },
    "Current prefix-50 structural-event artifact",
    PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
  );
  const verified = await verifyPrefix50StructuralEvents({
    ...reproduced.input,
    artifactBytes,
  });
  const inspection = inspectVerifiedPrefix50StructuralEvents(verified);
  if (!artifactBytes.equals(reproduced.bytes)) {
    throw new Error(
      "Current prefix-50 structural-event bytes differ from their fresh exact-input/source-bound reproduction.",
    );
  }
  return Object.freeze({ bytes: Buffer.from(artifactBytes), inspection, verified });
}
