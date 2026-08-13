export const REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION =
  "lego.real-build-source-attestation/1" as const;

export interface RealBuildSourceAttestation {
  readonly schemaVersion: typeof REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION;
  readonly fileCount: number;
  readonly digest: string;
}

/**
 * Canonical source roots that can affect the measured direct-origin shortcut.
 * The wide first-party and dependency roots are deliberate: a hand-maintained
 * import graph is too easy to under-approximate across dynamic browser imports.
 */
export const MEASURED_FARTHER_ORIGIN_SOURCE_PREFIXES = Object.freeze([
  "apps/web/e2e/",
  "apps/web/src/",
  "packages/brick-kernel/",
  "packages/catalog/",
  "packages/protocol/",
  "packages/rendering/",
  "node_modules/",
]);

export const MEASURED_FARTHER_ORIGIN_EXACT_SOURCE_PATHS = Object.freeze([
  "apps/web/index.html",
  "apps/web/package.json",
  "apps/web/vite.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
]);

/** Anchors prove every result-determining slice remained inside the broad closure. */
export const MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS = Object.freeze([
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
  "apps/web/e2e/real-build-lookahead-measure.ts",
  "apps/web/e2e/real-build-panel-arrow-evidence.ts",
  "apps/web/e2e/real-build-panel-camera-branch-budget.ts",
  "apps/web/e2e/real-build-panel-camera-branches.ts",
  "apps/web/e2e/real-build-panel-camera-registration.ts",
  "apps/web/e2e/real-build-panel-raster.ts",
  "apps/web/e2e/real-build-panel-raster-geometry.ts",
  "apps/web/e2e/real-build-run-visual.ts",
  "apps/web/e2e/real-build-run.ts",
  "apps/web/e2e/real-build-step-camera.ts",
  "apps/web/src/assembly/index.ts",
  "apps/web/src/assembly/panel-art-stage-components.ts",
  "apps/web/src/assembly/panel-art-stages.ts",
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
]);

export const MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH =
  "apps/web/e2e/real-build-farther-origin-source-manifest.ts";

/** Workspace-package aliases duplicate canonical package paths and are never attested twice. */
export function isMeasuredFartherOriginSourcePath(path: string): boolean {
  if (
    path === MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH ||
    path.startsWith("node_modules/@lego-studio/") ||
    path.includes("/.vite/")
  ) {
    return false;
  }
  return (
    MEASURED_FARTHER_ORIGIN_EXACT_SOURCE_PATHS.includes(path) ||
    MEASURED_FARTHER_ORIGIN_SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export function isRealBuildSourceAttestation(value: unknown): value is RealBuildSourceAttestation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 3 &&
    candidate.schemaVersion === REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION &&
    Number.isSafeInteger(candidate.fileCount) &&
    (candidate.fileCount as number) > 0 &&
    typeof candidate.digest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(candidate.digest)
  );
}

/** Calibrated after deriving the closure from the exact current captured source map. */
export const MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION: RealBuildSourceAttestation = Object.freeze(
  {
    schemaVersion: REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION,
    fileCount: 3_293,
    digest: "sha256:a1095109068f71d1f23d6d469c7d8e3087c3e4d4bc3efc5317cb053961f100d8",
  },
);
