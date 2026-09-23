import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

const REVIEWED_BYTES = 651_618;
const REVIEWED_DIGEST = "sha256:47d186212999081a715b8594d40f06fce31b5278d89a84cef8f364619073c756";
const REVIEWED_SCHEMA = "lego.prefix50-official-world-reconciliation/2";
const verifiedArtifacts = new WeakMap();

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactVerificationInput(value) {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(
      "Official-world reconciliation consumer verification requires exact artifact bytes and the independently reproduced artifact.",
    );
  }
  const keys = Reflect.ownKeys(value).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "artifact" ||
    keys[1] !== "artifactBytes" ||
    !(value.artifactBytes instanceof Uint8Array) ||
    typeof value.artifact !== "object" ||
    value.artifact === null
  ) {
    throw new TypeError(
      "Official-world reconciliation consumer verification accepts only exact artifactBytes and artifact fields; caller-supplied tokens or digests carry no authority.",
    );
  }
  return { artifact: value.artifact, bytes: Buffer.from(value.artifactBytes) };
}

/** Independently admits only the exact reviewed reconciliation byte string. */
export function verifyExactReviewedPrefix50OfficialWorldReconciliation(value) {
  const input = exactVerificationInput(value);
  const actualDigest = digest(input.bytes);
  if (input.bytes.length !== REVIEWED_BYTES || actualDigest !== REVIEWED_DIGEST) {
    throw new TypeError(
      `Official-world reconciliation consumer verification requires the reviewed ${REVIEWED_BYTES} bytes at ${REVIEWED_DIGEST}; received ${input.bytes.length} bytes at ${actualDigest}.`,
    );
  }
  const parsed = parseStrictJsonBytes(input.bytes);
  const canonicalBytes = Buffer.from(`${JSON.stringify(parsed, null, 1)}\n`);
  if (!canonicalBytes.equals(input.bytes)) {
    throw new TypeError(
      "Official-world reconciliation consumer verification requires the exact canonical reviewed JSON encoding.",
    );
  }
  if (parsed?.schemaVersion !== REVIEWED_SCHEMA || !isDeepStrictEqual(input.artifact, parsed)) {
    throw new TypeError(
      "Official-world reconciliation consumer verification requires an artifact derived exactly from its reviewed canonical bytes.",
    );
  }
  const token = Object.freeze({});
  verifiedArtifacts.set(token, {
    artifact: deepFreeze(parsed),
    bytes: Buffer.from(input.bytes),
    digest: actualDigest,
  });
  return token;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new TypeError(
      "Official-world reconciliation inspection requires its opaque exact-byte consumer-verifier result.",
    );
  }
  return record;
}

export const isVerifiedPrefix50OfficialWorldReconciliation = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);

export const inspectVerifiedPrefix50OfficialWorldReconciliation = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};

export const bytesFromVerifiedPrefix50OfficialWorldReconciliation = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
