import { expect, test } from "@playwright/test";

import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  realBuildSourceParityPreparedPanelsManifest,
} from "./real-build-observation-source-parity-contract";
import type { RealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-run";
import { realBuildSourceParityBrowserResultEvidence } from "./real-build-observation-source-parity-browser-result";
import { beginRealBuildSourceParityExecutionClosure } from "./real-build-observation-source-parity-execution";
import { publishRealBuildObservationSourceParity } from "./real-build-observation-source-parity-output";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityBrowserResult,
  type RealBuildSourceParityProbePanel,
  type RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH } from "./real-build-served-response-policy";
import { hasSampleBooklet } from "./sample-booklet";
import { workspaceModuleUrl } from "./workspace-module";

const ENABLED = process.env.LEGO_REAL_BUILD_SOURCE_PARITY === "1";
const REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";
const BROWSER_RUN_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-observation-source-parity-browser-run.ts",
);
const CANDIDATE_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-observation-source-raster-candidate.ts",
);

test("loads the served source-parity runner and candidate modules without starting the probe", async ({
  page,
}) => {
  await page.goto("/");
  const exportTypes = await page.evaluate(
    async ({ runnerUrl, candidateUrl }) => {
      const [runner, candidate] = await Promise.all([
        import(/* @vite-ignore */ runnerUrl),
        import(/* @vite-ignore */ candidateUrl),
      ]);
      return [
        typeof runner.runRealBuildObservationSourceParityInBrowser,
        typeof candidate.deriveRealBuildObservationSourceRasterCandidate,
        typeof candidate.unpackRealBuildObservationSourceRasterCandidateMask,
      ];
    },
    { runnerUrl: BROWSER_RUN_MODULE_URL, candidateUrl: CANDIDATE_MODULE_URL },
  );
  expect(exportTypes).toEqual(["function", "function", "function"]);
});

test("measures work-raster observation-source parity across the real booklet", async ({
  page,
  browserName,
}) => {
  test.setTimeout(1_800_000);
  test.skip(
    !ENABLED,
    "set LEGO_REAL_BUILD_SOURCE_PARITY=1 and LEGO_REAL_BUILD_REQUIRED=1 to run the 359-step parity probe",
  );
  test.skip(
    !REQUIRED,
    "source-parity opt-in requires LEGO_REAL_BUILD_REQUIRED=1 so Playwright owns an authenticated pre-discovery source lock",
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const bootstrap = readRequiredRealBuildBootstrapSourceManifest();
  const beforeLock = assertRealBuildBootstrapSourceLockHeld();
  const { bytes, source } = await readSampleBooklet();
  const expectedPdfDigest = sha256Digest(bytes);
  const evidence = await deriveRealBuildPanelEvidence({
    pdfBytes: bytes,
    source,
    pdfDigest: expectedPdfDigest,
  });
  const orderedPanels = [...evidence.panels].sort(
    (left, right) => left.stepNumber - right.stepNumber,
  );
  expect(orderedPanels).toHaveLength(REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS);
  expect(orderedPanels.map(({ stepNumber }) => stepNumber)).toEqual(
    Array.from({ length: REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS }, (_, index) => index + 1),
  );
  const panels: RealBuildSourceParityProbePanel[] = orderedPanels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    ...panel.bounds,
    calloutBoxes: evidence.calloutBoxesByStep[panel.stepNumber] ?? [],
    panelEvidenceDigest: evidence.panelEvidenceByStep[panel.stepNumber]!.digest,
  }));
  const preparedPanelsDigest = sha256Digest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(expectedPdfDigest, panels)),
  );

  const execution = await beginRealBuildSourceParityExecutionClosure({
    page,
    browserName,
    repoRoot: beforeLock.repoRoot,
    bootstrap,
    bootstrapLock: beforeLock,
    pdfBytes: bytes,
  });
  try {
    await page.goto(REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH);
    const browserInput: RealBuildSourceParityBrowserInput = {
      urls: execution.urls,
      expectedPdfDigest,
      expectedPdfBytes: bytes.length,
      preparedPanelsDigest,
      panels,
    };
    const browserResult = await page.evaluate<
      RealBuildSourceParityBrowserResult,
      { readonly moduleUrl: string; readonly input: RealBuildSourceParityBrowserInput }
    >(
      async ({ moduleUrl, input }) => {
        const module = (await import(/* @vite-ignore */ moduleUrl)) as {
          readonly runRealBuildObservationSourceParityInBrowser: (
            value: RealBuildSourceParityBrowserInput,
          ) => Promise<RealBuildSourceParityBrowserResult>;
        };
        return module.runRealBuildObservationSourceParityInBrowser(input);
      },
      { moduleUrl: execution.runnerUrl, input: browserInput },
    );
    execution.assertHeld();
    const browserResultEvidence = realBuildSourceParityBrowserResultEvidence(browserResult);
    const closure = await execution.finish({
      browserResultDigest: browserResultEvidence.digest,
      browserResultBytes: browserResultEvidence.bytes,
      preparedPanelsDigest,
    });
    expect(assertRealBuildBootstrapSourceLockHeld()).toEqual(beforeLock);

    const result: RealBuildSourceParityProbeResult = {
      ...browserResult,
      sourceSnapshot: closure.sourceSnapshot,
    };
    expect(result.pdfDigest).toBe(expectedPdfDigest);
    expect(result.preparedPanelsDigest).toBe(preparedPanelsDigest);
    expect(result.steps.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS }, (_, index) => index + 1),
    );
    expect(result.steps.map(({ pageNumber }) => pageNumber)).toEqual(
      panels.map(({ pageNumber }) => pageNumber),
    );
    for (const step of result.steps) {
      expect(step.comparisons.map(({ sourceClass }) => sourceClass)).toEqual(
        REAL_BUILD_SOURCE_PARITY_CLASSES,
      );
    }
    expect(result.aggregate.map(({ sourceClass }) => sourceClass)).toEqual(
      REAL_BUILD_SOURCE_PARITY_CLASSES,
    );

    execution.assertHeld();
    const published = publishRealBuildObservationSourceParity({
      repoRoot: beforeLock.repoRoot,
      result,
      provenance: closure.provenance,
    });
    execution.assertHeld();
    process.stdout.write(
      `${published.summaryPath}: ${result.steps.length} dense steps, ` +
        `${published.captureBytes} capture bytes, ${published.packedEvidenceBytes} packed evidence bytes, ` +
        `${published.provenanceBytes} provenance bytes\n`,
    );
  } finally {
    await execution.dispose();
  }
});
