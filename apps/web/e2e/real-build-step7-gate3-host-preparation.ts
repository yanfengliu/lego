import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";
import {
  applyBuildOperations,
  canonicalDigest,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import {
  assertRealBuildDiagnosticPrefixDocument,
  isRealBuildDiagnosticPrefixSummary,
} from "./real-build-diagnostic-prefix";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files";
import {
  STEP7_GATE3_CANDIDATE_LIMIT,
  STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
  type Step7Gate3BrowserInput,
} from "./real-build-step7-gate3-diagnostic-browser";
import { projectHistoricalStep7Control } from "./real-build-step7-gate3-diagnostic-analysis";
import {
  canonicalTraceDigest,
  EXPECTED,
  isRecord,
  projectOrigins,
  projectPanel,
  readPinnedFile,
  snapshotBlankRunnerState,
  SOURCE_RUN,
} from "./real-build-step7-gate3-diagnostic-fixture";
import {
  reconstructStep7Gate3ParentsInNode,
  reconstructStep7Gate3ParentsMigrateFirstForNegativeControl,
} from "./real-build-step7-gate3-diagnostic-node-replay";
import {
  createStep7Gate3SourceExecutionBoundary,
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
} from "./real-build-step7-gate3-diagnostic-source";
import { applyReviewedAdditiveLegacyBuildOperations } from "./real-build-reviewed-additive-legacy-operations";
import { bookletProbeUrls } from "./sample-booklet";
import { parseFatalUtf8Json } from "./strict-json";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

export async function prepareStep7Gate3HostRun(input: {
  readonly page: Page;
  readonly baseURL: string | undefined;
  readonly prewarm: boolean;
  readonly parentOnly: boolean;
}) {
  const { page, baseURL, prewarm, parentOnly } = input;
  if (baseURL === undefined) {
    throw new TypeError("Gate-3 source execution requires Playwright's configured Vite base URL.");
  }
  const expectedViteOrigin = new URL(baseURL).origin;
  const bootstrapBefore = readRequiredRealBuildBootstrapSourceManifest();
  const sourceLockBefore = assertRealBuildBootstrapSourceLockHeld();
  const sourceBoundaryInput = {
    page,
    expectedOrigin: expectedViteOrigin,
    repoRoot: sourceLockBefore.repoRoot,
    bootstrapSourceManifestDigest: bootstrapBefore.manifestDigest,
    allowedSourcePaths: bootstrapBefore.files.map(({ path }) => path),
    forbiddenUrlFragments: [SOURCE_RUN, "/cas/"],
  } as const;

  const driverUrl = workspaceModuleUrl("apps/web/e2e/real-build-step7-gate3-diagnostic-browser.ts");
  if (prewarm) {
    const sourceExecutionBoundary = createStep7Gate3SourceExecutionBoundary({
      ...sourceBoundaryInput,
      requiredEntryUrls: [driverUrl],
      requiredPdfUrl: null,
      requiredWorkerUrl: null,
      requiredCloseTimeControlUrl: null,
    });
    await sourceExecutionBoundary.install();
    try {
      const runnerResponse = await page.goto("/__real_build_runner__");
      expect(runnerResponse?.headers()["content-security-policy"]).toBe(
        STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
      );
      const blankRunnerBefore = await snapshotBlankRunnerState(page);
      expect(blankRunnerBefore).toEqual({
        title: "LEGO Gate-3 Blank Runner",
        scriptCount: 0,
        indexedDbNames: [],
        localStorageKeys: [],
        sessionStorageKeys: [],
        cacheNames: [],
        cookie: "",
        serviceWorkerScopes: [],
      });
      const exported = await page.evaluate(async (moduleUrl) => {
        const driver = await import(/* @vite-ignore */ moduleUrl);
        return {
          diagnosticType: typeof driver.runStep7Gate3Diagnostic,
          moduleInitializationEvalBlocked: driver.STEP7_GATE3_MODULE_INITIALIZATION_EVAL_BLOCKED,
        };
      }, driverUrl);
      expect(exported).toEqual({
        diagnosticType: "function",
        moduleInitializationEvalBlocked: true,
      });
      expect(await snapshotBlankRunnerState(page)).toEqual(blankRunnerBefore);
      await sourceExecutionBoundary.quiesce();
      const sourceExecution = await sourceExecutionBoundary.finish();
      expect(sourceExecution.expectedOrigin).toBe(expectedViteOrigin);
      expect(sourceExecution.blockedRequests).toBe(0);
      expect(sourceExecution.redirectResponses).toBe(0);
      return { status: "done" as const };
    } finally {
      await sourceExecutionBoundary.dispose();
    }
  }

  const runRoot = resolve(
    process.cwd(),
    normalizeRealBuildRelativePath(SOURCE_RUN, "Gate-3 source run"),
  );
  const artifactManifestBytes = readPinnedFile(
    runRoot,
    "artifact-manifest.json",
    EXPECTED.artifactManifest,
  );
  const scoreBytes = readPinnedFile(runRoot, "score.json", EXPECTED.score);
  const diagnosticPrefixBytes = readPinnedFile(
    runRoot,
    "diagnostic-prefix.json",
    EXPECTED.diagnosticPrefix,
  );
  const replayClosureBytes = readPinnedFile(runRoot, "replay-closure.json", EXPECTED.replayClosure);
  const artifactManifest = parseFatalUtf8Json<Record<string, unknown>>(
    artifactManifestBytes,
    "pinned Gate-3 artifact manifest",
  );
  const replayClosure = parseFatalUtf8Json<Record<string, unknown>>(
    replayClosureBytes,
    "pinned Gate-3 replay closure",
  );
  const { manifestDigest, ...replayBase } = replayClosure;
  if (
    artifactManifest.schemaVersion !== "lego.real-build-artifact-manifest/3" ||
    replayClosure.schemaVersion !== "lego.real-build-replay-closure/3" ||
    manifestDigest !== EXPECTED.replayClosure.manifestDigest ||
    canonicalTraceDigest(replayBase) !== manifestDigest ||
    !Array.isArray(artifactManifest.artifacts) ||
    !artifactManifest.artifacts.some(
      (entry) =>
        isRecord(entry) &&
        entry.file === "score.json" &&
        entry.bytes === EXPECTED.score.bytes &&
        entry.digest === EXPECTED.score.digest,
    ) ||
    !artifactManifest.artifacts.some(
      (entry) =>
        isRecord(entry) &&
        entry.file === "diagnostic-prefix.json" &&
        entry.bytes === EXPECTED.diagnosticPrefix.bytes &&
        entry.digest === EXPECTED.diagnosticPrefix.digest,
    )
  ) {
    throw new TypeError("Pinned Gate-3 artifacts do not reproduce their exact byte bindings.");
  }
  const replaySummary = isRecord(artifactManifest.replayClosure)
    ? artifactManifest.replayClosure
    : null;
  if (replaySummary?.manifestDigest !== manifestDigest || !Array.isArray(replayClosure.roles)) {
    throw new TypeError("Pinned artifact manifest does not bind the pinned replay closure.");
  }
  const preparedRole = replayClosure.roles.find(
    (role): role is Record<string, unknown> => isRecord(role) && role.role === "prepared-options",
  );
  const pdfRole = replayClosure.roles.find(
    (role): role is Record<string, unknown> => isRecord(role) && role.role === "pdf",
  );
  if (
    preparedRole?.bytes !== EXPECTED.preparedOptions.bytes ||
    preparedRole.digest !== EXPECTED.preparedOptions.digest ||
    typeof preparedRole.casPath !== "string" ||
    pdfRole?.bytes !== EXPECTED.pdf.bytes ||
    pdfRole.digest !== EXPECTED.pdf.digest
  ) {
    throw new TypeError("Pinned replay closure does not bind the exact prepared options and PDF.");
  }
  const preparedOptionsBytes = readPinnedFile(
    runRoot,
    preparedRole.casPath,
    EXPECTED.preparedOptions,
  );
  const preparedOptions = parseFatalUtf8Json<unknown>(
    preparedOptionsBytes,
    "pinned Gate-3 prepared options",
  );
  const score = parseFatalUtf8Json<Record<string, unknown>>(scoreBytes, "pinned Gate-3 score");
  if (!isRealBuildDiagnosticPrefixSummary(score.diagnosticPrefix)) {
    throw new TypeError("Pinned Gate-3 score has no valid diagnostic-prefix summary.");
  }
  assertRealBuildDiagnosticPrefixDocument(diagnosticPrefixBytes, score.diagnosticPrefix);
  const baseDocument = parseFatalUtf8Json<unknown>(
    diagnosticPrefixBytes,
    "pinned Gate-3 diagnostic prefix",
  );
  if (
    !validateBrickDocumentV1(baseDocument) ||
    score.diagnosticPrefix.structuralHash !== EXPECTED.baseDocumentHash
  ) {
    throw new TypeError("Pinned Gate-3 diagnostic prefix is not the exact step-5 BrickDocument.");
  }
  const historicalControl = projectHistoricalStep7Control(score, EXPECTED.orderedParentIds);
  const origins = projectOrigins(score);
  const projected = projectPanel(preparedOptions);
  const urls = bookletProbeUrls();
  if (urls.expectedSourceBytes !== EXPECTED.pdf.bytes) {
    throw new TypeError(
      `Live booklet has ${urls.expectedSourceBytes} bytes; the pinned control requires ${EXPECTED.pdf.bytes}.`,
    );
  }
  const browserInput: Step7Gate3BrowserInput = Object.freeze({
    schemaVersion: "lego.step7-gate3-diagnostic-input/1",
    observationMode: "current-migrated",
    baseDocument: baseDocument as BrickDocumentV1,
    baseDocumentHash: EXPECTED.baseDocumentHash,
    origins,
    panel: projected.panel,
    options: Object.freeze({
      ...urls,
      latticeUrl: workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts"),
      renderingUrl: RENDERING_MODULE_URL,
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      ...projected.numeric,
      deferredCandidateBudget: STEP7_GATE3_CANDIDATE_LIMIT,
      deferredNarrowingRenderBudget: STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
      inputDigests: Object.freeze({ pdf: EXPECTED.pdf.digest }),
    }),
  });
  const { expectedSourceBytes: _expectedSourceBytes, ...runtimeOptions } =
    browserInput.options as Step7Gate3BrowserInput["options"] & {
      readonly expectedSourceBytes?: number;
    };
  void _expectedSourceBytes;
  const exactBrowserInput: Step7Gate3BrowserInput = Object.freeze({
    ...browserInput,
    options: Object.freeze(runtimeOptions),
  });
  const currentModuleEntryUrls = Object.freeze([
    driverUrl,
    exactBrowserInput.options.pdfjsUrl,
    exactBrowserInput.options.latticeUrl,
    exactBrowserInput.options.renderingUrl,
    exactBrowserInput.options.kernelUrl,
    exactBrowserInput.options.commandsUrl,
    exactBrowserInput.options.assemblyUrl,
  ]);
  if (parentOnly) {
    const parentOnlyInputDigest = canonicalTraceDigest(exactBrowserInput);
    const sourceExecutionBoundary = createStep7Gate3SourceExecutionBoundary({
      ...sourceBoundaryInput,
      requiredEntryUrls: currentModuleEntryUrls,
      requiredPdfUrl: null,
      requiredWorkerUrl: null,
      requiredCloseTimeControlUrl: null,
    });
    await sourceExecutionBoundary.install();
    try {
      const runnerResponse = await page.goto("/__real_build_runner__");
      expect(runnerResponse?.headers()["content-security-policy"]).toBe(
        STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
      );
      const browserParents = await page.evaluate(
        async ({ moduleUrl, input, expectedInputDigest }) => {
          const driver = await import(/* @vite-ignore */ moduleUrl);
          return driver.reconstructStep7Gate3ParentsOnly(input, expectedInputDigest);
        },
        {
          moduleUrl: driverUrl,
          input: exactBrowserInput,
          expectedInputDigest: parentOnlyInputDigest,
        },
      );
      const nodeParents = reconstructStep7Gate3ParentsInNode({
        baseDocument: baseDocument as BrickDocumentV1,
        origins,
      });
      expect(browserParents.sourceParentIds).toEqual(EXPECTED.orderedParentIds);
      expect(browserParents.currentParentIds).toEqual(
        nodeParents.parents.map(({ candidateId }) => candidateId),
      );
      expect(browserParents.migrationReport).toEqual(nodeParents.migrationReport);
      expect(browserParents.inputFrozen).toBe(true);
      expect(browserParents.browserInputDigestBefore).toBe(parentOnlyInputDigest);
      expect(browserParents.browserInputDigestAfter).toBe(parentOnlyInputDigest);
      await sourceExecutionBoundary.quiesce();
      const sourceExecution = await sourceExecutionBoundary.finish();
      expect(sourceExecution.expectedOrigin).toBe(expectedViteOrigin);
      expect(sourceExecution.blockedRequests).toBe(0);
      expect(sourceExecution.redirectResponses).toBe(0);

      const migrateFirstHashes = reconstructStep7Gate3ParentsMigrateFirstForNegativeControl({
        baseDocument: baseDocument as BrickDocumentV1,
        origins,
      });
      expect(migrateFirstHashes).toHaveLength(origins.length);
      expect(migrateFirstHashes.every((hash, index) => hash !== origins[index]!.documentHash)).toBe(
        true,
      );
      const currentParent = nodeParents.parents[0]!.document;
      expect(() =>
        applyReviewedAdditiveLegacyBuildOperations(currentParent, [], {
          truthDigest: canonicalDigest,
          migrateDocumentTruth,
          applyBuildOperations: (document, operations) =>
            applyBuildOperations(
              document,
              operations as Parameters<typeof applyBuildOperations>[1],
            ),
        }),
      ).toThrow(/builtin\.basic-parts\/13|exact \/13/u);
      expect(() => applyBuildOperations(currentParent, [])).not.toThrow();
      return { status: "done" as const };
    } finally {
      await sourceExecutionBoundary.dispose();
    }
  }
  return {
    status: "ready" as const,
    page,
    expectedViteOrigin,
    bootstrapBefore,
    sourceBoundaryInput,
    driverUrl,
    artifactManifest,
    historicalControl,
    baseDocument: baseDocument as BrickDocumentV1,
    origins,
    exactBrowserInput,
    currentModuleEntryUrls,
    browserInputDigest: canonicalTraceDigest(exactBrowserInput),
  };
}

export type PreparedStep7Gate3HostRun = Extract<
  Awaited<ReturnType<typeof prepareStep7Gate3HostRun>>,
  { readonly status: "ready" }
>;
