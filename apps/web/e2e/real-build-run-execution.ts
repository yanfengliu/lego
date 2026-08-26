import { expect, type Page } from "@playwright/test";

import {
  beginAtomicRun,
  createRealBuildRunContract,
  createRealBuildScore,
  enumerateRealBuildCodeRoots,
  planAtomicRunDirectory,
  sha256Digest,
  snapshotRealBuildCodeRoots,
  validateRealBuildArtifactFilePlan,
  writeRealBuildArtifactManifest,
} from "./real-build-artifacts";
import { assertRealBuildBootstrapSourceLockHeld } from "./real-build-bootstrap-source";
import {
  decodeRealBuildPngCapture,
  type RealBuildBrowserOutput,
} from "./real-build-browser-output";
import { realBuildStepCensus } from "./real-build-census";
import {
  inputRejectedRealBuildResult,
  OFFICIAL_REAL_BUILD_ACCOUNTING,
} from "./real-build-contract";
import { REAL_BUILD_DIAGNOSTIC_PREFIX_FILE } from "./real-build-diagnostic-prefix";
import { encodeCanonicalRealBuildJson } from "./real-build-json-admission";
import { summariseDeferrals } from "./real-build-deferral";
import { finalizeExecutedRealBuildResult, realBuildExecutionFailure } from "./real-build-finalize";
import { deriveMeasuredFartherOriginSourceAttestation } from "./real-build-farther-origin-source-attestation";
import { captureHighlightExclusivityRenderCases } from "./real-build-highlight-browser";
import {
  assertHighlightRendererCasesReproduced,
  contractFailure,
  HIGHLIGHT_RENDERER_CASES_PATH,
} from "./real-build-input-files";
import { expectMeasuredFartherOriginDecision } from "./real-build-measured-farther-assertions";
import { REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS as EXPECTED_PRINTED_STEPS } from "./real-build-production-policy";
import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  planRealBuildSourceMirrorBundle,
  resolveRealBuildPath,
  sourceDriftFailures,
  writeRealBuildReplayClosure,
} from "./real-build-replay";
import { realBuildFartherCapturePath } from "./real-build-score";
import { encodeRealBuildPreparedRunInput } from "./real-build-prepared-run-input-parser";
import { encodeRealBuildRetainedPanelSource } from "./real-build-replay-panel-source";
import type { PreparedRealBuildPanelPlan } from "./real-build-run-panel-plan";
import {
  assertRealBuildRetainedActionPrefix,
  encodeCurrentRealBuildRunContract,
  REAL_BUILD_PANEL_SOURCE_ROLE,
  realBuildRunBudgets,
  realBuildRunThresholds,
  selectRealBuildExecutablePanels,
} from "./real-build-run-contract";
import {
  isAtomicStepComplete,
  type RealBuildOptions,
  type RealBuildResult,
} from "./real-build-safety";
import { createRealBuildServedResponseRecorder } from "./real-build-served-responses";
import { acquireRealBuildSourceLock } from "./real-build-source-lock";
import { REAL_BUILD_SOURCE_ROOTS } from "./real-build-source-roots";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";

export async function executeAndPublishRealBuildPlan(input: {
  readonly page: Page;
  readonly browserName: string;
  readonly prepared: PreparedRealBuildPanelPlan;
}): Promise<void> {
  const { page, browserName } = input;
  const {
    inputFailures,
    bootstrapSource,
    inputDigests,
    identificationClosureDigests,
    source,
    panelFaceSourcePageShapes,
    specs,
    options,
    effectiveOutputRoot,
    pdfBytes,
    highlightCasesInput,
    manifestInput,
    coverageInput,
    officialModelBytes,
    ledgerInput,
    highlightCompatibilityRoleBytes,
    builderCalibrationInput,
    builderGeometryBytes,
    transitionInput,
    identificationFeaturesInput,
    identificationMatchInput,
    identificationDistancesInput,
    elementResolutionInput,
    pairJudgedTruthInput,
    sourceArtReboundInput,
    identificationMode,
    identificationCardsInput,
    identificationCardImagesInput,
    identificationAnswersInput,
  } = input.prepared;
  const sourceFiles = enumerateRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
  const preImportSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
  const bootstrapDrift = sourceDriftFailures(bootstrapSource.files, preImportSourceBundle);
  if (bootstrapDrift.length > 0) {
    throw new TypeError(
      `Pre-discovery locked source differs from the test-time source capture: ${bootstrapDrift.slice(0, 8).join("; ")}.`,
    );
  }
  const originalCodeSnapshots = Object.fromEntries(
    preImportSourceBundle.map(({ path, digest }) => [path, digest]),
  );
  const executionSourceBundle = planRealBuildSourceMirrorBundle({
    sourceFiles: preImportSourceBundle,
    fixedInputs: [
      { path: "inputs/booklet.pdf", digest: sha256Digest(pdfBytes), bytes: pdfBytes.length },
    ],
  });
  const codeSnapshots = Object.fromEntries(
    executionSourceBundle.map(({ path, digest }) => [path, digest]),
  );
  const measuredFartherOriginSourceAttestation =
    deriveMeasuredFartherOriginSourceAttestation(codeSnapshots);
  const executableSpecs = selectRealBuildExecutablePanels(specs, options.lastStep);
  const panelSourceBytes = encodeRealBuildRetainedPanelSource({
    pdfBytes,
    source,
    requestedLastStep: options.lastStep,
    pageShapes: panelFaceSourcePageShapes,
  });
  const runContract = createRealBuildRunContract({
    inputDigests,
    identificationClosure: identificationClosureDigests,
    panelSourceDigest: sha256Digest(panelSourceBytes),
    panels: executableSpecs,
    passivePanels: options.passivePanels,
    budgets: realBuildRunBudgets(options),
    thresholds: realBuildRunThresholds(options),
    codeSnapshots,
  });
  const plan = planAtomicRunDirectory({
    outputRoot: effectiveOutputRoot,
    inputDigests,
    runContractDigest: runContract.contractDigest,
  });
  const run = beginAtomicRun(plan);
  const sourceMirror = materializeRealBuildSourceMirror({
    directory: run.directory,
    repoRoot: process.cwd(),
    sourceFiles,
    fixedInputs: [{ path: "inputs/booklet.pdf", bytes: pdfBytes }],
  });
  const initialMirrorDrift = sourceDriftFailures(executionSourceBundle, sourceMirror.files);
  if (initialMirrorDrift.length > 0) {
    throw new TypeError(
      `Real-build source mirror differs from its exact pre-import bundle: ${initialMirrorDrift.slice(0, 8).join("; ")}.`,
    );
  }
  const sourceLock = await acquireRealBuildSourceLock(sourceMirror);
  const servedResponses = createRealBuildServedResponseRecorder({
    page,
    mirror: sourceMirror,
    sourceLock,
    repoRoot: process.cwd(),
  });
  let result!: RealBuildResult;
  try {
    await servedResponses.install();
    sourceLock.assertHeld();
    const mirrorUrl = (path: string): string => {
      const resolved = resolveRealBuildPath(sourceMirror.root, path, {
        mustExist: true,
        label: "materialized real-build module",
      });
      return `/@fs/${resolved.replaceAll("\\", "/")}`;
    };
    const executionOptions: RealBuildOptions = {
      ...options,
      panels: executableSpecs,
      measuredFartherOriginSourceAttestation,
      pdfjsUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.mjs"),
      workerUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.worker.mjs"),
      pdfUrl: mirrorUrl("inputs/booklet.pdf"),
      latticeUrl: mirrorUrl("packages/rendering/src/camera-fit-lattice.ts"),
      renderingUrl: mirrorUrl("packages/rendering/src/index.ts"),
      kernelUrl: mirrorUrl("packages/brick-kernel/src/index.ts"),
      commandsUrl: mirrorUrl("apps/web/src/manual-commands.ts"),
      assemblyUrl: mirrorUrl("apps/web/src/assembly/index.ts"),
    };
    assertRealBuildRetainedActionPrefix({ contract: runContract, options: executionOptions });
    const executionDriverUrl = mirrorUrl("apps/web/e2e/real-build-run.ts");

    let retainedBrowserOutput: RealBuildBrowserOutput | null = null;
    if (inputFailures.length === 0) {
      await page.addInitScript(() => {
        Object.defineProperty(window, "WebSocket", { value: class {}, writable: true });
      });
      try {
        await page.goto("/__real_build_runner__");
        const reproducedHighlightCases = await captureHighlightExclusivityRenderCases(page, {
          contractUrl: mirrorUrl("apps/web/e2e/real-build-contract.ts"),
          kernelUrl: mirrorUrl("packages/brick-kernel/src/index.ts"),
          commandsUrl: mirrorUrl("apps/web/src/manual-commands.ts"),
          renderingUrl: mirrorUrl("packages/rendering/src/index.ts"),
        });
        assertHighlightRendererCasesReproduced(highlightCasesInput.bytes, reproducedHighlightCases);
      } catch (error) {
        inputFailures.push(
          contractFailure(
            HIGHLIGHT_RENDERER_CASES_PATH,
            `The materialized source-mirror renderer did not independently reproduce the bounded raw ` +
              `highlight compatibility cases: ${error instanceof Error ? error.message : String(error)}. ` +
              `This refuses renderer/source incompatibility; it does not authenticate the instruction PDF, ` +
              `the checkout's origin, or visual correctness.`,
          ),
        );
      }
    }
    if (inputFailures.length > 0) {
      result = inputRejectedRealBuildResult(executionOptions, inputFailures);
    } else {
      let browserOutput: RealBuildBrowserOutput;
      try {
        browserOutput = (await page.evaluate(
          async ({ driverUrl, driverOptions }) => {
            const driver = await import(/* @vite-ignore */ driverUrl);
            return driver.runRealBuild(driverOptions);
          },
          { driverUrl: executionDriverUrl, driverOptions: executionOptions },
        )) as RealBuildBrowserOutput;
      } catch (error) {
        browserOutput = {
          schemaVersion: "lego.real-build-browser-output/3",
          status: "failed",
          reports: [],
          documentJson: null,
          identityBindings: [],
          fetchedPdfDigest: null,
          failure: {
            code: "dynamic-import-failed",
            stage: "loading",
            inputKey: "browser-driver",
            message:
              `Playwright could not load and invoke the digest-bound real-build browser driver: ` +
              `${error instanceof Error ? error.message : String(error)}.`,
          },
          totalElapsedMs: 0,
        };
      }
      const postRunSnapshots = snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
      const postRunSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
      const mirrorPostRunBundle = captureRealBuildSourceBundle(
        sourceMirror.root,
        sourceMirror.files.map(({ path }) => path),
      );
      // The snapshot comparison used to be a bare JSON.stringify inequality, so
      // when it fired alone the message fell back to "digest map changed" and
      // named nothing. Both halves of this check now say which path moved and
      // what it moved from, which is the difference between a two-minute run
      // that tells you the answer and one that starts a search.
      const snapshotDrift = [
        ...Object.entries(originalCodeSnapshots).flatMap(([path, digest]) => {
          const observed = postRunSnapshots[path];
          return observed === digest
            ? []
            : [`${path}: captured ${digest}, observed ${observed ?? "missing"}`];
        }),
        ...Object.keys(postRunSnapshots)
          .filter((path) => originalCodeSnapshots[path] === undefined)
          .map((path) => `${path}: appeared during the run`),
      ];
      const drift = [
        ...snapshotDrift,
        ...sourceDriftFailures(preImportSourceBundle, postRunSourceBundle),
        ...sourceDriftFailures(executionSourceBundle, mirrorPostRunBundle),
      ];
      if (drift.length > 0) {
        browserOutput = {
          schemaVersion: "lego.real-build-browser-output/3",
          status: "failed",
          reports: browserOutput.reports,
          documentJson: browserOutput.documentJson,
          identityBindings: browserOutput.identityBindings,
          fetchedPdfDigest: browserOutput.fetchedPdfDigest,
          failure: {
            code: "source-drift-detected",
            stage: "replay",
            inputKey: "codeSnapshots",
            message:
              `Result-determining source changed between immutable pre-import capture, execution mirror, and ` +
              `post-run verification (${drift.length} entr${drift.length === 1 ? "y" : "ies"}): ` +
              `${drift.slice(0, 8).join("; ")}. The browser output is retained diagnostically but cannot be finalized.`,
          },
          totalElapsedMs: browserOutput.totalElapsedMs,
        };
      }
      retainedBrowserOutput = browserOutput;
      result = finalizeExecutedRealBuildResult({ options: executionOptions, browserOutput });
    }

    // The deferral's own measurable, printed as soon as a result exists rather
    // than with the rest of the summary at the end. Everything after this point —
    // the artifact plan, the replay closure, the manifest — can refuse a
    // partially-complete prefix and throw, and a number that only prints on runs
    // that did not need it is not a measurement.
    const deferrals = summariseDeferrals(result.steps);
    console.log(
      `deferral: ${deferrals.deferredSteps} printed step(s) had no scoring signal of their own, ` +
        `${deferrals.settledByLookahead} settled by a later panel, deepest settlement reach ` +
        `${deferrals.deepestSettlementReachSteps} printed step(s); ` +
        `${result.steps.reduce((total, step) => total + step.placedPieces, 0)} piece(s) placed.`,
    );

    // The census, printed as soon as a result exists and for the same reason the
    // deferral line is: everything downstream can throw, and a run that says only
    // "it failed" costs a whole run to learn one blocker. One line per requested
    // printed step, naming the refusal, the numbers that refusal quotes, and the
    // evidence the step had to work from — so fifty steps' worth of refusal
    // classes come out of one run instead of fifty.
    console.log(realBuildStepCensus(result));

    const servedResponseEvidence = await servedResponses.writeEvidence(run.directory);
    sourceLock.assertHeld();
    const stepArtifactFiles = result.steps.flatMap((step) => {
      const tag = String(step.stepNumber).padStart(3, "0");
      return [
        ...(step.panelPng === null ? [] : [`step-${tag}-panel.png`]),
        ...(step.buildPng === null ? [] : [`step-${tag}-build.png`]),
        ...step.fartherCaptures.map((capture) =>
          realBuildFartherCapturePath(step.stepNumber, capture),
        ),
      ];
    });
    const artifactFiles = validateRealBuildArtifactFilePlan([
      ...servedResponseEvidence.files,
      ...stepArtifactFiles,
      ...(result.documentJson === null || result.structuralHash === null ? [] : ["document.json"]),
      ...(result.diagnosticPrefix === null ? [] : [REAL_BUILD_DIAGNOSTIC_PREFIX_FILE]),
      "score.json",
    ]);
    for (const step of result.steps) {
      const tag = String(step.stepNumber).padStart(3, "0");
      for (const [kind, png] of [
        ["panel", step.panelPng],
        ["build", step.buildPng],
      ] as const) {
        if (png !== null) {
          const file = `step-${tag}-${kind}.png`;
          writeContainedRegularFileAtomic(run.directory, file, decodeRealBuildPngCapture(png), {
            label: "real-build step capture",
          });
        }
      }
      for (const capture of step.fartherCaptures) {
        const file = realBuildFartherCapturePath(step.stepNumber, capture);
        writeContainedRegularFileAtomic(
          run.directory,
          file,
          decodeRealBuildPngCapture(capture.png),
          { label: "real-build farther-panel capture" },
        );
      }
    }
    if (result.documentJson !== null && result.structuralHash !== null) {
      writeContainedRegularFileAtomic(run.directory, "document.json", result.documentJson, {
        label: "real-build document",
      });
    }
    if (result.diagnosticPrefix !== null) {
      writeContainedRegularFileAtomic(
        run.directory,
        REAL_BUILD_DIAGNOSTIC_PREFIX_FILE,
        result.diagnosticPrefix.documentJson,
        { label: "real-build diagnostic prefix" },
      );
    }
    const score = createRealBuildScore({
      runId: plan.runId,
      result,
      accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
      lastStep: options.lastStep,
    });
    writeContainedRegularFileAtomic(
      run.directory,
      "score.json",
      encodeCanonicalRealBuildJson(score, "pretty-one-space-line"),
      { label: "real-build score" },
    );
    const replayRoles = [
      { role: "pdf", bytes: pdfBytes },
      { role: REAL_BUILD_PANEL_SOURCE_ROLE, bytes: panelSourceBytes },
      { role: "callout-manifest", bytes: manifestInput.bytes },
      { role: "coverage", bytes: coverageInput.bytes },
      { role: "official-model", bytes: officialModelBytes },
      { role: "action-ledger", bytes: ledgerInput.bytes },
      { role: "highlight-calibration", bytes: highlightCompatibilityRoleBytes },
      { role: "builder-calibration", bytes: builderCalibrationInput.bytes },
      { role: "builder-geometry", bytes: builderGeometryBytes },
      { role: "transition-classifications", bytes: transitionInput.bytes },
      { role: "identification-features", bytes: identificationFeaturesInput.bytes },
      { role: "identification-match", bytes: identificationMatchInput.bytes },
      { role: "identification-distances", bytes: identificationDistancesInput.bytes },
      { role: "element-resolution", bytes: elementResolutionInput.bytes },
      { role: "pair-judged-truth", bytes: pairJudgedTruthInput.bytes },
      { role: "source-art-rebound", bytes: sourceArtReboundInput.bytes },
      ...(identificationMode?.source === "adjudicated" &&
      identificationCardsInput !== null &&
      identificationCardImagesInput !== null &&
      identificationAnswersInput !== null
        ? [
            { role: "identification-cards", bytes: identificationCardsInput.bytes },
            {
              role: "identification-card-images",
              bytes: identificationCardImagesInput.bytes,
            },
            { role: "identification-answers", bytes: identificationAnswersInput.bytes },
          ]
        : []),
      { role: "run-contract", bytes: encodeCurrentRealBuildRunContract(runContract) },
      { role: "prepared-options", bytes: encodeRealBuildPreparedRunInput(executionOptions) },
      ...(retainedBrowserOutput === null
        ? []
        : [
            {
              role: "browser-output",
              bytes: encodeCanonicalRealBuildJson(retainedBrowserOutput),
            },
          ]),
    ];
    sourceLock.assertHeld();
    const replayClosure = await writeRealBuildReplayClosure({
      directory: run.directory,
      repoRoot: sourceMirror.root,
      roles: replayRoles,
      sourceFiles: sourceMirror.files.map(({ path }) => path),
      environment: {
        schemaVersion: "lego.real-build-environment/1",
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        browser: {
          name: browserName,
          version: page.context().browser()?.version() ?? "unavailable",
        },
        playwright: "@playwright/test (exact package bytes retained in source bundle)",
        replayProtocol: 1,
        bootstrapSourceManifestDigest: bootstrapSource.manifestDigest,
        runContractDigest: runContract.contractDigest,
        servedResponseManifestDigest: servedResponseEvidence.manifestDigest,
      },
      browserOutputRetained: retainedBrowserOutput !== null,
    });
    writeRealBuildArtifactManifest({
      directory: run.directory,
      runId: plan.runId,
      runContract,
      result,
      artifactFiles,
      replayClosure,
    });
    sourceLock.assertHeld();
  } finally {
    try {
      await servedResponses.dispose();
    } finally {
      await sourceLock.release();
    }
  }
  assertRealBuildBootstrapSourceLockHeld();
  await run.preparePublication();
  const published = run.publish();
  console.log(
    `${result.authority.kind}/${result.status}: ${result.steps.filter(isAtomicStepComplete).length}/${result.steps.length} steps complete; ` +
      `${result.steps.reduce((total, step) => total + step.placedPieces, 0)} piece(s) placed; ` +
      `retained unauthenticated evidence ${published}`,
  );

  expect(result.schemaVersion).toBe("lego.real-build-result/5");
  expect(result.inputDigests).toEqual(inputDigests);
  if (result.status === "completed") {
    const executionFailure = realBuildExecutionFailure(result);
    expect(executionFailure, executionFailure?.message).toBeNull();
    expect(options.lastStep).toBe(EXPECTED_PRINTED_STEPS);
    expect(result.steps).toHaveLength(EXPECTED_PRINTED_STEPS);
    expect(result.finalParts).toBe(OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces);
    expect(result.documentJson).not.toBeNull();
    for (const step of result.steps) {
      expect(isAtomicStepComplete(step)).toBe(true);
      expect(step.validation.documentGloballyValid).toBe(true);
    }
  } else if (result.status === "prefix-complete") {
    expect(options.lastStep).toBeLessThan(EXPECTED_PRINTED_STEPS);
    expect(result.steps).toHaveLength(options.lastStep);
    expect(result.steps.every(isAtomicStepComplete)).toBe(true);
    const executionFailure = realBuildExecutionFailure(result);
    expect(executionFailure, executionFailure?.message).toBeNull();
  } else {
    expect(result.status).toBe("incomplete");
    expect(result.steps).toHaveLength(options.lastStep);
    const executionFailure = realBuildExecutionFailure(result);
    expect(executionFailure).toMatchObject({ code: "run-incomplete", stage: "validation" });
  }
  if (options.lastStep >= 7) {
    expectMeasuredFartherOriginDecision(result);
  }
}
