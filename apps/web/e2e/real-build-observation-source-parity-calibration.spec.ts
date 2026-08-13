import { expect, test } from "@playwright/test";

import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import type { RealBuildSourceParityCalibrationBrowserInput } from "./real-build-observation-source-parity-calibration-browser-input";
import { preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence } from "./real-build-observation-source-parity-calibration-capture";
import { publishRealBuildSourceParityCalibration } from "./real-build-observation-source-parity-calibration-publication";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  type RealBuildSourceParityCalibrationBrowserCaptureWire,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { createRealBuildSourceParityCalibrationContract } from "./real-build-observation-source-parity-calibration-contract";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  realBuildSourceParityPreparedPanelsManifest,
} from "./real-build-observation-source-parity-contract";
import { beginRealBuildSourceParityExecutionClosure } from "./real-build-observation-source-parity-execution";
import type { RealBuildSourceParityProbePanel } from "./real-build-observation-source-parity-types";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH } from "./real-build-served-response-policy";
import { hasSampleBooklet } from "./sample-booklet";
import { workspaceModuleUrl } from "./workspace-module";

const ENABLED = process.env.LEGO_REAL_BUILD_SOURCE_PARITY_CALIBRATION === "1";
const REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";
const CALIBRATION_RUNNER_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-observation-source-parity-calibration-browser-run.ts",
);
const CALIBRATION_CAPTURE_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-observation-source-parity-calibration-browser-capture.ts",
);
const ASSEMBLY_MODULE_URL = workspaceModuleUrl("apps/web/src/assembly/index.ts");
const CANDIDATE_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-observation-source-raster-candidate.ts",
);

test("loads the exact-five calibration runner without invoking measurement", async ({ page }) => {
  await page.goto("/");
  const exportType = await page.evaluate(async (moduleUrl) => {
    const module = await import(/* @vite-ignore */ moduleUrl);
    return typeof module.runRealBuildObservationSourceParityCalibrationInBrowser;
  }, CALIBRATION_RUNNER_MODULE_URL);
  expect(exportType).toBe("function");
});

test("constructs the five-role browser capture from a tiny synthetic raster", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(
    async ({ captureUrl, assemblyUrl, candidateUrl }) => {
      const [capture, assembly, candidateModule] = await Promise.all([
        import(/* @vite-ignore */ captureUrl),
        import(/* @vite-ignore */ assemblyUrl),
        import(/* @vite-ignore */ candidateUrl),
      ]);
      const high = new Uint8ClampedArray(1_000 * 4);
      for (let pixel = 0; pixel < 1_000; pixel += 1) {
        high.set([0x89, 0x90, 0x93, 0xff], pixel * 4);
      }
      for (const [start, end] of [
        [0, 3],
        [101, 105],
      ]) {
        for (let x = start!; x <= end!; x += 1) high.set([0x20, 0x20, 0x20, 0xff], x * 4);
      }
      const stages = assembly.derivePanelArtStages({
        raster: { width: 1_000, height: 1, pixels: high },
        workFactor: 2,
        backgroundHex: 0x899093,
        backgroundToleranceLevels: 10,
        calloutRectangles: [],
      });
      const work = assembly.downsampleRaster({ width: 1_000, height: 1, pixels: high }, 2).pixels;
      const candidate = candidateModule.deriveRealBuildObservationSourceRasterCandidate(
        500,
        1,
        2,
        work,
        0,
        1_000,
        0,
        1,
        new Float64Array(),
      );
      const wMask = candidateModule.unpackRealBuildObservationSourceRasterCandidateMask(
        candidate.assemblyMask,
      );
      const hash = `sha256:${"1".repeat(64)}`;
      const tuples = [
        [90, 79],
        [101, 87],
        [346, 213],
        [358, 218],
        [359, 219],
      ];
      const measurements = tuples.map(([stepNumber, pageNumber]) => ({
        panel: {
          stepNumber,
          pageNumber,
          minXPt: 0,
          maxXPt: 1_000,
          minYPt: 0,
          maxYPt: 1,
          calloutBoxes: [],
          panelEvidenceDigest: hash,
        },
        width: 500,
        height: 1,
        sourceArtStages: stages,
        highRgba: new Uint8ClampedArray(high),
        workRgba: new Uint8ClampedArray(work),
        wMask: new Uint8Array(wMask),
        candidatePolicyDigest: candidate.policyDescriptorDigest,
        candidateDerivationDigest: candidate.derivationDescriptorDigest,
        candidateWorkPixelsDigest: candidate.workPixelsDigest,
      }));
      const wire = capture.createRealBuildSourceParityCalibrationBrowserCapture({
        binding: {
          expectedPdfDigest: hash,
          expectedPdfBytes: 3,
          fullPreparedPanelsDigest: hash,
          calibrationPreparedPanelsDigest: hash,
          calibrationDigest: hash,
        },
        measurements,
      });
      let oversizedByteAccesses = 0;
      const guardedHigh = new Proxy(high, {
        get: () => {
          oversizedByteAccesses += 1;
          throw new Error("oversized high RGBA bytes were accessed");
        },
        getPrototypeOf: () => {
          oversizedByteAccesses += 1;
          throw new Error("oversized high RGBA prototype was accessed");
        },
      });
      let oversizedError = "";
      try {
        capture.createRealBuildSourceParityCalibrationBrowserCapture({
          binding: {
            expectedPdfDigest: hash,
            expectedPdfBytes: 3,
            fullPreparedPanelsDigest: hash,
            calibrationPreparedPanelsDigest: hash,
            calibrationDigest: hash,
          },
          measurements: [
            {
              ...measurements[0],
              highRgba: guardedHigh,
              sourceArtStages: { ...stages, width: 100_000_000 },
            },
            ...measurements.slice(1),
          ],
        });
      } catch (error) {
        oversizedError = error instanceof Error ? error.message : String(error);
      }
      return {
        authority: wire.authority,
        roles: wire.roles.map(
          ({
            role,
            transportEncoding,
            base64,
          }: {
            role: string;
            transportEncoding: string;
            base64: string;
          }) => ({
            role,
            transportEncoding,
            hasBase64: base64.length > 0,
          }),
        ),
        panels: wire.panels.map(({ highPng, workPng, pairwisePdw }: Record<string, unknown>) => ({
          highPng: (highPng as { dataUrl: string }).dataUrl.startsWith("data:image/png;base64,"),
          workPng: (workPng as { dataUrl: string }).dataUrl.startsWith("data:image/png;base64,"),
          pairwise: (pairwisePdw as unknown[]).length,
          nondegenerate:
            (pairwisePdw as { differingPixels: number; unionPixels: number }[]).some(
              ({ differingPixels }) => differingPixels > 0,
            ) &&
            (pairwisePdw as { differingPixels: number; unionPixels: number }[]).every(
              ({ unionPixels }) => unionPixels > 0,
            ),
        })),
        hasExecutionIdentity: Object.hasOwn(wire, "executionIdentityDigest"),
        oversizedError,
        oversizedByteAccesses,
      };
    },
    {
      captureUrl: CALIBRATION_CAPTURE_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      candidateUrl: CANDIDATE_MODULE_URL,
    },
  );
  expect(result.authority).toEqual({
    status: "absent",
    authorized: false,
    reason: "pending-human-review/1",
  });
  expect(result.roles).toEqual(
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.map((role) => ({
      role,
      transportEncoding: "base64/1",
      hasBase64: true,
    })),
  );
  expect(result.panels).toEqual(
    Array.from({ length: 5 }, () => ({
      highPng: true,
      workPng: true,
      pairwise: 3,
      nondegenerate: true,
    })),
  );
  expect(result.hasExecutionIdentity).toBe(false);
  expect(result.oversizedError).toMatch(
    /dimensions require 400000000 bytes; expected 1 through .* before typed-array access/u,
  );
  expect(result.oversizedByteAccesses).toBe(0);
});

test.describe("opt-in exact-five source-parity calibration capture", () => {
  test.skip(
    !ENABLED,
    "set LEGO_REAL_BUILD_SOURCE_PARITY_CALIBRATION=1 and LEGO_REAL_BUILD_REQUIRED=1 to capture exactly five calibration panels",
  );
  test.skip(
    !REQUIRED,
    "calibration capture requires LEGO_REAL_BUILD_REQUIRED=1 so Playwright owns an authenticated pre-discovery source lock",
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  test("captures only the fixed five panels inside the source execution closure", async ({
    page,
    browserName,
  }) => {
    test.setTimeout(600_000);
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
    const panels: RealBuildSourceParityProbePanel[] = orderedPanels.map((panel) => ({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      ...panel.bounds,
      calloutBoxes: evidence.calloutBoxesByStep[panel.stepNumber] ?? [],
      panelEvidenceDigest: evidence.panelEvidenceByStep[panel.stepNumber]!.digest,
    }));
    const fullPreparedPanelsManifestBytes = new TextEncoder().encode(
      JSON.stringify(realBuildSourceParityPreparedPanelsManifest(expectedPdfDigest, panels)),
    );
    const fullPreparedPanelsDigest = sha256Digest(fullPreparedPanelsManifestBytes);
    const contract = createRealBuildSourceParityCalibrationContract({
      pdfDigest: expectedPdfDigest,
      fullPreparedPanelsDigest,
      panels,
    });
    const calibrationPanels = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(
      ({ stepNumber }) => panels[stepNumber - 1]!,
    );
    const execution = await beginRealBuildSourceParityExecutionClosure({
      page,
      browserName,
      repoRoot: beforeLock.repoRoot,
      bootstrap,
      bootstrapLock: beforeLock,
      pdfBytes: bytes,
      expectedPreparedPanelsDigest: fullPreparedPanelsDigest,
    });
    try {
      await page.goto(REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH);
      const input: RealBuildSourceParityCalibrationBrowserInput = {
        urls: execution.urls,
        expectedPdfDigest,
        expectedPdfBytes: bytes.length,
        fullPreparedPanelsDigest,
        calibrationPreparedPanelsDigest: contract.calibrationPreparedPanelsDigest,
        calibrationDigest: contract.calibrationDigest,
        panels: calibrationPanels,
      };
      const browserCapture = await page.evaluate<
        RealBuildSourceParityCalibrationBrowserCaptureWire,
        {
          readonly moduleUrl: string;
          readonly input: RealBuildSourceParityCalibrationBrowserInput;
        }
      >(
        async ({ moduleUrl, input }) => {
          const module = (await import(/* @vite-ignore */ moduleUrl)) as {
            readonly runRealBuildObservationSourceParityCalibrationInBrowser: (
              value: RealBuildSourceParityCalibrationBrowserInput,
            ) => Promise<RealBuildSourceParityCalibrationBrowserCaptureWire>;
          };
          return module.runRealBuildObservationSourceParityCalibrationInBrowser(input);
        },
        { moduleUrl: execution.calibrationRunnerUrl, input },
      );
      execution.assertHeld();
      const preflight =
        preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(browserCapture);
      const closure = await execution.finish({
        browserResultDigest: preflight.browserCaptureDigest,
        browserResultBytes: preflight.browserCaptureBytes.length,
      });
      expect(browserCapture.fullPreparedPanelsDigest).toBe(fullPreparedPanelsDigest);
      expect(browserCapture.calibrationPreparedPanelsDigest).toBe(
        contract.calibrationPreparedPanelsDigest,
      );
      expect(browserCapture.calibrationDigest).toBe(contract.calibrationDigest);
      expect(browserCapture.roles.map(({ role }) => role)).toEqual(
        REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
      );
      expect(
        browserCapture.panels.map(({ stepNumber, pageNumber }) => [stepNumber, pageNumber]),
      ).toEqual(
        REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(({ stepNumber, pageNumber }) => [
          stepNumber,
          pageNumber,
        ]),
      );
      expect(closure.sourceSnapshot.preparedPanelsDigest).toBe(fullPreparedPanelsDigest);
      const published = publishRealBuildSourceParityCalibration({
        repoRoot: beforeLock.repoRoot,
        capture: browserCapture,
        fullPreparedPanelsManifestBytes,
        sourceSnapshot: closure.sourceSnapshot,
        provenance: closure.provenance,
      });
      expect(published.summary.authority.authorized).toBe(false);
      expect(published.summary.reviewState).toBe("pending-unreviewed");
      expect(assertRealBuildBootstrapSourceLockHeld()).toEqual(beforeLock);
    } finally {
      await execution.dispose();
    }
  });
});
