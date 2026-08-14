export const REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION =
  "lego.real-build-source-attestation/1" as const;

export interface RealBuildSourceAttestation {
  readonly schemaVersion: typeof REAL_BUILD_SOURCE_ATTESTATION_SCHEMA_VERSION;
  readonly fileCount: number;
  readonly digest: string;
}

/** E2E modules whose runtime import graph consumes identification evidence. */
export const MEASURED_FARTHER_ORIGIN_VERIFIER_ENTRY_SOURCE_PATHS = Object.freeze([
  "apps/web/e2e/real-build-identification-closure.ts",
  "apps/web/e2e/real-build-input-files.ts",
  "apps/web/e2e/real-build-input-limits.ts",
]);

/** Exact executable script closure reached from the verifier entry modules. */
export const MEASURED_FARTHER_ORIGIN_VERIFIER_SCRIPT_SOURCE_PATHS = Object.freeze([
  "scripts/booklet-catalog-coverage-report.mjs",
  "scripts/booklet-catalog-coverage.mjs",
  "scripts/bounded-observed-value.mjs",
  "scripts/callout-component-ownership.mjs",
  "scripts/callout-manifest-shape.mjs",
  "scripts/part-assignment.mjs",
  "scripts/part-identification-artifact-source.mjs",
  "scripts/part-identification-artifact-vision.mjs",
  "scripts/part-identification-artifacts.mjs",
  "scripts/part-identification-card-images.mjs",
  "scripts/part-identification-claims.mjs",
  "scripts/part-identification-contained-path.mjs",
  "scripts/part-identification-contained-write.mjs",
  "scripts/part-identification-derivation.mjs",
  "scripts/part-identification-handedness.mjs",
  "scripts/part-identification-io.mjs",
  "scripts/part-identification-mirror-pairs.mjs",
  "scripts/part-identification-model.mjs",
  "scripts/part-identification-pair-judged.mjs",
  "scripts/part-identification-prompt.mjs",
  "scripts/part-identification-score-observations.mjs",
  "scripts/part-identification-score-truth.mjs",
  "scripts/part-identification-score.mjs",
  "scripts/part-identification-strict-json.mjs",
  "scripts/part-identification-truth-key.mjs",
  "scripts/part-thumbnail-canvas.mjs",
  "scripts/part-thumbnail-image-guard.mjs",
  "scripts/part-thumbnail-image.mjs",
]);

/**
 * Canonical source roots that can affect the measured direct-origin shortcut.
 * The wide first-party and dependency roots are deliberate: a hand-maintained
 * import graph is too easy to under-approximate across dynamic browser imports.
 * Verifier scripts are the exact exception above, guarded by a static runtime-
 * import closure test so unrelated scripts and task artifacts stay excluded.
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
  ...MEASURED_FARTHER_ORIGIN_VERIFIER_SCRIPT_SOURCE_PATHS,
  "tsconfig.json",
]);

/** Anchors prove every result-determining slice remained inside the broad or exact closure. */
export const MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS = Object.freeze([
  ...MEASURED_FARTHER_ORIGIN_VERIFIER_ENTRY_SOURCE_PATHS,
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
  ...MEASURED_FARTHER_ORIGIN_VERIFIER_SCRIPT_SOURCE_PATHS,
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
    fileCount: 3_384,
    digest: "sha256:b3ee2fe22b22e6c37980c49bb48b12fe1246094e75c17901b124bc6633e303f1",
  },
);
