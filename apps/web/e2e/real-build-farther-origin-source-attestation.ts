import { createHash } from "node:crypto";

import {
  isMeasuredFartherOriginSourcePath,
  MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_VERIFIER_SCRIPT_SOURCE_PATHS,
  REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION,
  type RealBuildSourceAttestation,
} from "./real-build-farther-origin-source-manifest.ts";

const CANONICAL_PATH = /^[A-Za-z0-9._@/-]+$/u;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

/**
 * Derives the portable attestation from the exact source map already captured
 * for run-contract /3. It reads no files and admits no generated Vite cache.
 */
export function deriveMeasuredFartherOriginSourceAttestation(
  codeSnapshots: Readonly<Record<string, string>>,
): RealBuildSourceAttestation {
  const rows: { readonly path: string; readonly digest: string }[] = [];
  for (const [path, digest] of Object.entries(codeSnapshots)) {
    if (
      path.length === 0 ||
      path.includes("\\") ||
      path.startsWith("/") ||
      path.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
      !CANONICAL_PATH.test(path)
    ) {
      throw new TypeError(
        `Measured farther-origin source map contains a non-canonical path: ${JSON.stringify(path)}.`,
      );
    }
    if (!SHA256_DIGEST.test(digest)) {
      throw new TypeError(
        `Measured farther-origin source ${path} has malformed digest ${JSON.stringify(digest)}.`,
      );
    }
    if (isMeasuredFartherOriginSourcePath(path)) rows.push({ path, digest });
  }
  const selected = new Set(rows.map(({ path }) => path));
  const missingVerifierScripts = MEASURED_FARTHER_ORIGIN_VERIFIER_SCRIPT_SOURCE_PATHS.filter(
    (path) => !selected.has(path),
  );
  if (missingVerifierScripts.length > 0) {
    throw new TypeError(
      `Measured farther-origin source closure is missing ${missingVerifierScripts.length} ` +
        `result-determining verifier script path(s): ${missingVerifierScripts.slice(0, 8).join(", ")}.`,
    );
  }
  const missing = MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS.filter(
    (path) => !selected.has(path),
  );
  if (missing.length > 0) {
    throw new TypeError(
      `Measured farther-origin source closure is missing ${missing.length} required canonical ` +
        `path(s): ${missing.slice(0, 8).join(", ")}.`,
    );
  }
  rows.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const schemaVersion = REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION;
  return Object.freeze({
    schemaVersion,
    fileCount: rows.length,
    digest: sha256(JSON.stringify({ schemaVersion, files: rows })),
  });
}
