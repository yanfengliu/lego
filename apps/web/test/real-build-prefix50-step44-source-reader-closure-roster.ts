import type {
  Step44AllowedIoModule,
  Step44IoCategory,
} from "./real-build-prefix50-step44-source-reader-closure-gate.ts";

function allow(
  file: string,
  reason: string,
  categories: readonly Step44IoCategory[],
): Step44AllowedIoModule {
  return Object.freeze({
    file,
    categories: Object.freeze(
      Object.fromEntries(categories.map((category) => [category, reason])) as Partial<
        Record<Step44IoCategory, string>
      >,
    ),
  });
}

export const EXACT_STEP44_THREE_ROOT_IO_ROSTER: readonly Step44AllowedIoModule[] = Object.freeze([
  allow("apps/web/e2e/booklet-fixture.ts", "PDF.js decodes already supplied booklet bytes.", [
    "pdfjs",
  ]),
  allow(
    "apps/web/e2e/bounded-file-read.ts",
    "Descriptor-bound regular-file reader implementation.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-atomic-write-support.ts",
    "Contained atomic publication verifies directory and descriptor identity.",
    ["filesystem-metadata", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-atomic-write.ts",
    "Contained atomic publication reads its bounded source and commits exact bytes.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-directory-ownership.ts",
    "Contained-directory ownership reads and seals exact marker bytes.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-directory-removal.ts",
    "Task-owned cleanup walks and removes only a verified contained directory.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-directory.ts",
    "Contained directory lifecycle and identity checks.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/contained-directory-live-guard.ts",
    "Zero-share live guard holds and reasserts the exact owned output directory identity.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-bootstrap-source.ts",
    "Bootstrap reads one digest-bound contained source artifact.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-calibration-directory-process.ts",
    "Calibration launches its literal bounded worker and checks directory identity.",
    ["child-process", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-calibration-directory-protocol.ts",
    "Calibration protocol inventories an exact sealed directory.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-calibration-directory-state.ts",
    "Calibration state retains verified real-path identity.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-calibration-directory-transaction.ts",
    "Calibration transaction checks the absent direct-child destination.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-calibration-publication-marker.ts",
    "Calibration marker reopens one bounded sealed publication.",
    ["bounded-source-read", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-camera-only-gate-artifacts.ts",
    "Camera gate reads exact artifact bytes under its outer closure.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-camera-only-gate-manifest.ts",
    "Camera gate manifest uses the common bounded reader.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-camera-only-gate-support.ts",
    "Camera gate support canonicalizes the repository root.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-camera-only-gate-tree.ts",
    "Camera gate recursively binds a bounded evidence tree.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-authority.ts",
    "Capability issuance binds the exact repository real path and performs the sole bounded source read after durable burn.",
    ["bounded-source-read", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-derived-contract.ts",
    "Opaque preparation binds the canonical repository identity without exposing its path.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-derived-raster.ts",
    "Fixed post-burn raster leaf reopens only its guarded owned derived PNG.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-derived-vector.ts",
    "Fixed post-burn vector leaf decodes only the authenticated in-memory PDF prefix.",
    ["pdfjs"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-files.ts",
    "Later-source ledger centralizes canonical repository identity and descriptor-time durable file operations.",
    ["filesystem-metadata", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-seal.ts",
    "Later-source ledger authenticates its fixed DPAPI host/helper and protects its HMAC key.",
    ["child-process", "child-script", "filesystem-metadata", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-step44-real-domain-calibration-publication.ts",
    "Calibration publication verifies the persisted regular file.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts",
    "Review artifact adapter delegates to descriptor-bound reads.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-browser-lifecycle.ts",
    "Owned Playwright lifecycle opens its log and bounded browser process.",
    ["browser", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-browser-worker.ts",
    "Finite bootstrap browser-worker job launches only Playwright's installed headless browser.",
    ["browser"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts",
    "Camera attempt persistence reopens bounded evidence and checks real paths.",
    ["bounded-source-read", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts",
    "Real-domain evidence inventories and materializes its contained run directory.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-refusal-evidence.ts",
    "Refusal evidence reopens one bounded persisted proof.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts",
    "Qualification tree walks and reopens its exact bounded closure.",
    ["bounded-source-read", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate.ts",
    "Qualification gate binds the supplied repository root.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts",
    "Sealed Step-41/42 or one-shot Step-43 authority supplies verified bytes and owns bounded crop output.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts",
    "Persisted calibration case walks and reopens its exact directory.",
    ["bounded-source-read", "filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    "Persisted qualification reopens one bounded proof artifact.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera.ts",
    "Camera production validates its repository and output roots.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-capture.ts",
    "Browser capture writes its task-owned console log.",
    ["filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-contact-sheet-baseline.ts",
    "Contact-sheet baseline reopens bounded evidence and writes a derived image.",
    ["bounded-source-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-contact-sheet-camera-attempt.ts",
    "Contact-sheet attempt reads only bounded camera artifacts.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-contact-sheet-delta.ts",
    "Contact-sheet delta reads only bounded raster artifacts.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-contact-sheet-source.ts",
    "Contact-sheet source adapter reads exact bounded artifacts.",
    ["bounded-source-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-contact-sheet.ts",
    "Contact-sheet orchestration reads bounded inputs and writes task-owned output.",
    ["bounded-source-read", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-harness-input.ts",
    "Harness input reads a direct-child descriptor and claims task-owned output.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler.ts",
    "Shared Poppler boundary authenticates one canonical executable, executes locked bytes, and feeds it only verified stdin bytes.",
    ["child-process", "child-script", "filesystem-metadata", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts",
    "Poppler verifier inventories and authenticates every file in the fixed reviewed toolchain tree.",
    ["filesystem-metadata", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-integrity.ts",
    "Owned-process integrity reopens and hashes each exact bootstrap, table, option, and target file.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-windows.ts",
    "Windows process wrapper owns a literal bounded review child.",
    ["child-process", "child-script"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-bootstrap.ts",
    "Finite job-kind bootstrap selects only its enumerated dependency or recursive local target.",
    ["child-process", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-containment-probe.ts",
    "Test-only finite containment job launches its literal recursively audited grandchild.",
    ["child-process"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-process.ts",
    "Portable process wrapper owns a literal bounded review child.",
    ["child-process"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-static-app-server.ts",
    "Static server authenticates and holds only the reviewed prebuilt app assets before serving them.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-production-materials.ts",
    "Production-material pins reopen exact tracked source text.",
    ["filesystem-read"],
  ),
  allow(
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-transaction.ts",
    "Review transaction writes only its claimed task-owned directory.",
    ["filesystem-write"],
  ),
  allow(
    "apps/web/e2e/windows-alternate-data-streams.ts",
    "Windows containment probe checks alternate streams on verified paths.",
    ["child-process", "filesystem-read"],
  ),
  allow("apps/web/src/instructions/ingest-pdf.ts", "PDF ingestion decodes caller-supplied bytes.", [
    "pdfjs",
  ]),
  allow(
    "scripts/part-identification-bounded-child.mjs",
    "Geometry verifier launches a literal manifest-bound child.",
    ["child-process", "child-script"],
  ),
  allow(
    "scripts/part-identification-contained-path.mjs",
    "Geometry verifier contains and creates only approved directories.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "scripts/part-identification-contained-write.mjs",
    "Geometry verifier atomically writes through descriptor and child checks.",
    ["child-process", "child-script", "filesystem-read", "filesystem-write"],
  ),
  allow(
    "scripts/part-identification-io.mjs",
    "Geometry verifier performs descriptor-bound bounded artifact reads.",
    ["filesystem-read", "filesystem-write"],
  ),
  allow(
    "scripts/part-identification-prefix50-step42-source-geometry-verifier-manifest-check.mjs",
    "Geometry child reopens its exact manifest bytes.",
    ["filesystem-read"],
  ),
  allow(
    "scripts/part-identification-prefix50-verified-projection-step42-source-geometry.mjs",
    "Step-42 geometry verifier reopens exact source authority files.",
    ["filesystem-read"],
  ),
  allow(
    "scripts/part-identification-source-art-images.mjs",
    "Source-art helper decodes caller-supplied PDF bytes.",
    ["pdfjs"],
  ),
  allow(
    "scripts/part-identification-source-art-semantic-rebound-scan.mjs",
    "Semantic rebound scan decodes already bounded PDF bytes.",
    ["pdfjs"],
  ),
  allow(
    "scripts/part-identification-typescript-hooks.mjs",
    "Node 24 hook resolves only extensionless relative TypeScript imports.",
    ["module-loader"],
  ),
]);
