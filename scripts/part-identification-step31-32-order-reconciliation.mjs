import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import { sha256Digest } from "./part-identification-legacy-recut-source.mjs";
import {
  STEP31_32_ORDER_RECONCILIATION_AUTHORITY,
  assertExactStep31_32ReconciliationShape,
  deriveStep31_32OrderReconciliation,
} from "./part-identification-step31-32-order-reconciliation-derive.mjs";
import {
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS,
  STEP31_32_ORDER_RECONCILIATION_MAX_ARTIFACT_BYTES,
  authenticateStep31_32Manifest,
  authenticateStep31_32OfficialModel,
} from "./part-identification-step31-32-order-reconciliation-source.mjs";

export {
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS,
  REVIEWED_STEP31_32_SEMANTIC_MAP,
} from "./part-identification-step31-32-order-reconciliation-source.mjs";

const COMPILE_KEYS = ["currentManifestBytes", "officialModelBytes"];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  return {
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Step-31/32 reconciliation artifact bytes",
            minimumBytes: 1,
            maximumBytes: STEP31_32_ORDER_RECONCILIATION_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
    currentManifestBytes: snapshotBoundedUint8Array(roles.currentManifestBytes, {
      label: "Step-31/32 current manifest bytes",
      minimumBytes: 1,
      maximumBytes: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.currentManifest.bytes,
    }),
    officialModelBytes: snapshotBoundedUint8Array(roles.officialModelBytes, {
      label: "Step-31/32 official model bytes",
      minimumBytes: 1,
      maximumBytes: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel.bytes,
    }),
  };
}

async function compileWithPins(input) {
  const manifestEvidence = authenticateStep31_32Manifest(input.currentManifestBytes);
  const official = await authenticateStep31_32OfficialModel(input.officialModelBytes);
  return deriveStep31_32OrderReconciliation(manifestEvidence, official);
}

export async function compileStep31_32OrderReconciliation(input) {
  const snapshot = snapshotInput(input, COMPILE_KEYS, "Step-31/32 reconciliation compiler input");
  await Promise.resolve();
  return compileWithPins(snapshot);
}

export const encodeStep31_32OrderReconciliation = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyStep31_32OrderReconciliation(input) {
  const snapshot = snapshotInput(input, VERIFY_KEYS, "Step-31/32 reconciliation verifier input");
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Step-31/32 reconciliation artifact",
  );
  const expected = await compileWithPins({
    currentManifestBytes: snapshot.currentManifestBytes,
    officialModelBytes: snapshot.officialModelBytes,
  });
  const expectedBytes = encodeStep31_32OrderReconciliation(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedArtifact;
  if (pin !== null && (pin.bytes !== expectedBytes.length || pin.digest !== expectedDigest)) {
    throw new Error(
      `Step-31/32 reconciliation reproduced ${expectedBytes.length} bytes at ${expectedDigest}, not its reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new Error(
      "Step-31/32 reconciliation artifact does not exactly reproduce from the pinned full manifest, official XML, and reviewed semantic map.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest: expectedDigest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error(
      "Step-31/32 reconciliation publication requires its opaque independent-verifier result.",
    );
  }
  return record;
}

export const isVerifiedStep31_32OrderReconciliation = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const bytesFromVerifiedStep31_32OrderReconciliation = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
export const inspectVerifiedStep31_32OrderReconciliation = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};

export const __testOnly = Object.freeze({
  AUTHORITY: STEP31_32_ORDER_RECONCILIATION_AUTHORITY,
  assertExactPublishedShape: assertExactStep31_32ReconciliationShape,
  authenticateStep31_32Manifest,
  authenticateStep31_32OfficialModel,
  deriveStep31_32OrderReconciliation,
});
