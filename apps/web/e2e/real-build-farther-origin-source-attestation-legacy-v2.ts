import { createHash } from "node:crypto";

import type { RealBuildSourceAttestation } from "./real-build-farther-origin-source-manifest";

const CANONICAL_PATH = /^[A-Za-z0-9._@/-]+$/u;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SCHEMA_VERSION = "lego.real-build-source-attestation/1" as const;
export const LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2: RealBuildSourceAttestation =
  Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    fileCount: 3_064,
    digest: "sha256:17bda111319a9054b0613050850e83c4737ff720d725b16cdaa3b931b8cf87b5",
  });
const MANIFEST_PATH = "apps/web/e2e/real-build-farther-origin-source-manifest.ts";
const PREFIXES = [
  "apps/web/e2e/",
  "apps/web/src/",
  "packages/brick-kernel/",
  "packages/catalog/",
  "packages/protocol/",
  "packages/rendering/",
  "node_modules/",
] as const;
const EXACT_PATHS = [
  "apps/web/index.html",
  "apps/web/package.json",
  "apps/web/vite.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
] as const;

/** Frozen anchors used by the source-attestation producer that wrote run-contract /2 evidence. */
export const LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2 = [
  "apps/web/e2e/real-build-browser-preflight.ts",
  "apps/web/e2e/real-build-contract.ts",
  "apps/web/e2e/real-build-deferral.ts",
  "apps/web/e2e/real-build-deferred-step.ts",
  "apps/web/e2e/real-build-evidence-contract.ts",
  "apps/web/e2e/real-build-farther-driver.ts",
  "apps/web/e2e/real-build-farther-origin-attempt.ts",
  "apps/web/e2e/real-build-farther-origin-policy.ts",
  "apps/web/e2e/real-build-farther-origin-probe.ts",
  "apps/web/e2e/real-build-farther-panel.ts",
  "apps/web/e2e/real-build-farther-scoring.ts",
  "apps/web/e2e/real-build-farther-step.ts",
  "apps/web/e2e/real-build-panel-raster.ts",
  "apps/web/e2e/real-build-run-visual.ts",
  "apps/web/e2e/real-build-run.ts",
  "apps/web/e2e/real-build-step-camera.ts",
  "apps/web/src/assembly/index.ts",
  "apps/web/src/manual-commands.ts",
  "node_modules/@noble/hashes/package.json",
  "node_modules/pdfjs-dist/build/pdf.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.mjs",
  "node_modules/pdfjs-dist/package.json",
  "node_modules/three/build/three.module.js",
  "node_modules/three/package.json",
  "packages/brick-kernel/src/index.ts",
  "packages/catalog/src/index.ts",
  "packages/protocol/src/index.ts",
  "packages/rendering/src/index.ts",
  "packages/rendering/src/camera-fit-lattice.ts",
  "package-lock.json",
] as const;

const selectedByV2 = (path: string): boolean =>
  path !== MANIFEST_PATH &&
  !path.startsWith("node_modules/@lego-studio/") &&
  !path.includes("/.vite/") &&
  (EXACT_PATHS.includes(path as (typeof EXACT_PATHS)[number]) ||
    PREFIXES.some((prefix) => path.startsWith(prefix)));

/**
 * Reproduces generation 2 without importing today's expanded source anchors.
 * This verifier is inspection-only; its result cannot authorize current execution or publication.
 */
export function deriveLegacyMeasuredFartherOriginSourceAttestationV2(
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
        `Legacy measured farther-origin source map contains non-canonical path ${JSON.stringify(path)}.`,
      );
    }
    if (!SHA256_DIGEST.test(digest)) {
      throw new TypeError(
        `Legacy measured farther-origin source ${path} has malformed digest ${JSON.stringify(digest)}.`,
      );
    }
    if (selectedByV2(path)) rows.push({ path, digest });
  }
  const selected = new Set(rows.map(({ path }) => path));
  const missing = LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2.filter(
    (path) => !selected.has(path),
  );
  if (missing.length > 0) {
    throw new TypeError(
      `Legacy measured farther-origin source closure is missing ${missing.length} generation-2 ` +
        `anchor path(s): ${missing.slice(0, 8).join(", ")}.`,
    );
  }
  rows.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    fileCount: rows.length,
    digest: `sha256:${createHash("sha256")
      .update(JSON.stringify({ schemaVersion: SCHEMA_VERSION, files: rows }))
      .digest("hex")}`,
  });
}
