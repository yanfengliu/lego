import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST,
  STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST_COMMITMENT,
} from "./part-identification-prefix50-step42-source-geometry-verifier-manifest.mjs";

const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

export const step42SourceGeometryStableDigest = (value) =>
  digest(Buffer.from(JSON.stringify(stableJson(value)), "utf8"));

export function verifyStep42SourceGeometryVerifierManifest() {
  const manifestCommitment = step42SourceGeometryStableDigest(
    STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST,
  );
  if (manifestCommitment !== STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST_COMMITMENT) {
    throw new TypeError(
      `Step-42 source-geometry verifier manifest commitment drifted to ${manifestCommitment}.`,
    );
  }
  for (const row of STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST.files) {
    const bytes = readFileSync(new URL(`./${row.relativePath}`, import.meta.url));
    const actualDigest = digest(bytes);
    if (bytes.length !== row.bytes || actualDigest !== row.digest) {
      throw new TypeError(
        `Step-42 source-geometry verifier manifest ${row.role} drifted: bytes=${bytes.length}, digest=${actualDigest}.`,
      );
    }
  }
  return STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST;
}
