import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import type {
  RealBuildExactThreeSourceBrowserInput,
  captureRealBuildExactThreeSourceInBrowser,
} from "./real-build-exact-three-source-browser";
import { deriveScopedRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import { ASSEMBLY_MODULE_URL, workspaceModuleUrl } from "./workspace-module";

const ENABLED = process.env.LEGO_REAL_BUILD_EXACT_THREE_SOURCE === "1";
const RUNNER_URL = workspaceModuleUrl("apps/web/e2e/real-build-exact-three-source-browser.ts");
const LATTICE_URL = workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts");
const PANEL_RASTER_URL = workspaceModuleUrl("apps/web/e2e/real-build-panel-raster.ts");
const OUTPUT = "output/playwright/real-build-exact-three-source";
const STEPS = [2, 3, 4] as const;
const EXPECTED_PANEL_DIGESTS = [
  "sha256:5e5bee4479b9ca1a5037c0c255a793c677766f46b5d2686b4d698c0668ddc717",
  "sha256:685bc60dff569cf15354b53593da3bd4042a3eb56cea43d2917f3ef5b4b4fa71",
  "sha256:808b0ac770e15a04a047ce090a0b08ad0e42e01bd23c7c2133030af45ca0e49b",
] as const;

type ExactThreeCapture = Awaited<ReturnType<typeof captureRealBuildExactThreeSourceInBrowser>>;

test("loads the exact-three source capture without reading the real PDF", async ({ page }) => {
  await page.goto("/");
  const exportType = await page.evaluate(async (runnerUrl) => {
    const runner = await import(/* @vite-ignore */ runnerUrl);
    return typeof runner.captureRealBuildExactThreeSourceInBrowser;
  }, RUNNER_URL);
  expect(exportType).toBe("function");
});

test("refuses an accessor-bearing panel before importing caller module URLs", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (runnerUrl) => {
    const runner = await import(/* @vite-ignore */ runnerUrl);
    const digest = `sha256:${"0".repeat(64)}`;
    let accessorReads = 0;
    const panel = {
      stepNumber: 2,
      pageNumber: 11,
      get minXPt() {
        accessorReads += 1;
        return 0;
      },
      maxXPt: 100,
      minYPt: 0,
      maxYPt: 100,
      calloutBoxes: [],
      panelEvidenceDigest: digest,
    };
    const other = (stepNumber: number) => ({
      stepNumber,
      pageNumber: 11,
      minXPt: 0,
      maxXPt: 100,
      minYPt: 0,
      maxYPt: 100,
      calloutBoxes: [],
      panelEvidenceDigest: digest,
    });
    let message = "";
    try {
      await runner.captureRealBuildExactThreeSourceInBrowser({
        urls: {
          pdfjsUrl: "/must-not-import-pdfjs.mjs",
          workerUrl: "/must-not-load-worker.mjs",
          pdfUrl: "/must-not-fetch.pdf",
          latticeUrl: "/must-not-import-lattice.mjs",
          assemblyUrl: "/must-not-import-assembly.mjs",
          panelRasterUrl: "/must-not-import-panel-raster.mjs",
        },
        expectedPdfDigest: digest,
        expectedPdfBytes: 1,
        panels: [panel, other(3), other(4)],
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    return { message, accessorReads };
  }, RUNNER_URL);
  expect(result.accessorReads).toBe(0);
  expect(result.message).toMatch(/panels\[0\]\.minXPt must be one enumerable own data field/u);
  expect(result.message).not.toMatch(/import|fetch|404/u);
});

test("snapshots inputs before await and closes its exact browser resources", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (runnerUrl) => {
    const runner = await import(/* @vite-ignore */ runnerUrl);
    const moduleUrl = (source: string) =>
      `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
    const counters = {
      getDocument: 0,
      render: 0,
      dispose: 0,
      pdfDestroy: 0,
      taskDestroy: 0,
      steps: [] as number[],
      maxX: [] as number[],
      callouts: [] as number[],
    };
    (
      globalThis as typeof globalThis & { __exactThreeCounters?: typeof counters }
    ).__exactThreeCounters = counters;
    const pdfjsUrl = moduleUrl(`
      export const GlobalWorkerOptions = { workerSrc: "" };
      export function getDocument() {
        const counters = globalThis.__exactThreeCounters;
        counters.getDocument += 1;
        return {
          promise: Promise.resolve({ destroy() { counters.pdfDestroy += 1; } }),
          destroy() { counters.taskDestroy += 1; },
        };
      }
    `);
    const panelRasterUrl = moduleUrl(`
      export async function renderRealBuildPageCanvas() {
        const counters = globalThis.__exactThreeCounters;
        counters.render += 1;
        const canvas = document.createElement("canvas");
        document.body.append(canvas);
        return { canvas, dispose() { counters.dispose += 1; canvas.remove(); } };
      }
      export function derivePanelRasterEvidence({ spec }) {
        const counters = globalThis.__exactThreeCounters;
        counters.steps.push(spec.stepNumber);
        counters.maxX.push(spec.maxXPt);
        counters.callouts.push(spec.calloutBoxes.length);
        return {
          calibrationHighRgba: { stepNumber: spec.stepNumber },
          workPixels: new Uint8ClampedArray([spec.stepNumber, 0, 0, 255]),
        };
      }
      export function copyRealBuildPanelCalibrationHighRgba(snapshot) {
        return new Uint8ClampedArray([snapshot.stepNumber, 0, 0, 255]);
      }
    `);
    const emptyModuleUrl = moduleUrl("export const exactThreeStub = true;");
    const digest = `sha256:${"0".repeat(64)}`;
    const panel = (stepNumber: number) => ({
      stepNumber,
      pageNumber: 11,
      minXPt: 0,
      maxXPt: 100,
      minYPt: 0,
      maxYPt: 100,
      calloutBoxes: [] as Record<string, number>[],
      panelEvidenceDigest: digest,
    });
    const input = {
      urls: {
        pdfjsUrl,
        workerUrl: "/unused-exact-three-worker.mjs",
        pdfUrl: "data:application/pdf;base64,QQ==",
        latticeUrl: emptyModuleUrl,
        assemblyUrl: emptyModuleUrl,
        panelRasterUrl,
      },
      expectedPdfDigest: "sha256:559aead08264d5795d3909718cdd05abd49572e84fe55590eef31a88a08fdffd",
      expectedPdfBytes: 1,
      panels: [panel(2), panel(3), panel(4)],
    };
    const pending = runner.captureRealBuildExactThreeSourceInBrowser(input);
    input.panels[0]!.maxXPt = 999;
    input.panels[0]!.calloutBoxes.push({ minXPt: 1, maxXPt: 2, minYPt: 1, maxYPt: 2 });
    input.panels.reverse();
    const capture = (await pending) as ExactThreeCapture;
    delete (globalThis as typeof globalThis & { __exactThreeCounters?: typeof counters })
      .__exactThreeCounters;
    return {
      authority: capture.authority,
      metrics: capture.metrics,
      rows: capture.rows.map(({ highRgba, workRgba }) => ({
        high: Array.from(highRgba),
        work: Array.from(workRgba),
      })),
      counters,
    };
  }, RUNNER_URL);
  expect(result.authority).toEqual({
    sourceExecution: "absent",
    preparedRun: "absent",
    placement: "absent",
    completion: "absent",
  });
  expect(result.metrics).toMatchObject({
    pageRenderCount: 1,
    pageDisposeCount: 1,
    pdfDestroyCount: 1,
    loadingTaskDestroyCount: 1,
  });
  expect(result.rows).toEqual([
    { high: [2, 0, 0, 255], work: [2, 0, 0, 255] },
    { high: [3, 0, 0, 255], work: [3, 0, 0, 255] },
    { high: [4, 0, 0, 255], work: [4, 0, 0, 255] },
  ]);
  expect(result.counters).toEqual({
    getDocument: 1,
    render: 1,
    dispose: 1,
    pdfDestroy: 1,
    taskDestroy: 1,
    steps: [2, 3, 4],
    maxX: [100, 100, 100],
    callouts: [0, 0, 0],
  });
});

test("captures fresh page-11 RGBA for exact panels 2, 3 and 4", async ({ page }) => {
  test.setTimeout(600_000);
  test.skip(
    !ENABLED,
    "set LEGO_REAL_BUILD_EXACT_THREE_SOURCE=1 to run the genuine exact-three browser capture",
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const { bytes, source } = await readSampleBooklet();
  const pdfDigest = sha256Digest(bytes);
  const scoped = await deriveScopedRealBuildPanelEvidence({
    pdfBytes: bytes,
    source,
    pdfDigest,
    stepNumbers: STEPS,
  });
  const panels = STEPS.map((stepNumber) => {
    const panel = scoped.panels.find((entry) => entry.stepNumber === stepNumber);
    const commitment = scoped.callerSourcePanelCommitmentByStep[stepNumber];
    if (panel === undefined || commitment === undefined) {
      throw new Error(`Scoped genuine source omitted exact panel ${stepNumber}.`);
    }
    return {
      stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.bounds.minXPt,
      maxXPt: panel.bounds.maxXPt,
      minYPt: panel.bounds.minYPt,
      maxYPt: panel.bounds.maxYPt,
      calloutBoxes: scoped.calloutBoxesByStep[stepNumber] ?? [],
      panelEvidenceDigest: commitment.commitmentDigest,
    };
  });
  expect(panels.map(({ stepNumber }) => stepNumber)).toEqual(STEPS);
  expect(panels.map(({ pageNumber }) => pageNumber)).toEqual([11, 11, 11]);
  expect(panels.map(({ panelEvidenceDigest }) => panelEvidenceDigest)).toEqual(
    EXPECTED_PANEL_DIGESTS,
  );
  expect(scoped.authority).toEqual({
    sourceText: "caller-supplied-unverified",
    preparedRun: "absent",
    placement: "absent",
    completion: "absent",
  });

  const booklet = bookletProbeUrls();
  const input: RealBuildExactThreeSourceBrowserInput = {
    urls: {
      pdfjsUrl: booklet.pdfjsUrl,
      workerUrl: booklet.workerUrl,
      pdfUrl: booklet.pdfUrl,
      latticeUrl: LATTICE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      panelRasterUrl: PANEL_RASTER_URL,
    },
    expectedPdfDigest: pdfDigest,
    expectedPdfBytes: bytes.byteLength,
    panels: panels as unknown as RealBuildExactThreeSourceBrowserInput["panels"],
  };

  await page.goto("/");
  const wire = await page.evaluate(
    async ({ runnerUrl, captureInput }) => {
      const runner = await import(/* @vite-ignore */ runnerUrl);
      const capture = (await runner.captureRealBuildExactThreeSourceInBrowser(
        captureInput,
      )) as ExactThreeCapture;
      const base64 = (bytes: Uint8ClampedArray): string => {
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 32_768) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
        }
        return btoa(binary);
      };
      for (let index = 0; index < capture.rows.length; index += 1) {
        const stepNumber = index + 2;
        for (const [scale, width, rgba] of [
          ["high", 1_000, capture.rows[index]!.highRgba],
          ["work", 500, capture.rows[index]!.workRgba],
        ] as const) {
          const height = rgba.byteLength / (width * 4);
          if (!Number.isSafeInteger(height) || height < 1) {
            throw new RangeError(`Exact-three step ${stepNumber} ${scale} RGBA is malformed.`);
          }
          const canvas = document.createElement("canvas");
          canvas.dataset.exactThreeStep = String(stepNumber);
          canvas.dataset.exactThreeScale = scale;
          canvas.width = width;
          canvas.height = height;
          canvas
            .getContext("2d")!
            .putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
          document.body.append(canvas);
        }
      }
      return {
        schemaVersion: capture.schemaVersion,
        authority: capture.authority,
        pdfDigest: capture.pdfDigest,
        pdfBytes: capture.pdfBytes,
        metrics: capture.metrics,
        rows: capture.rows.map((row) => ({
          highRgba: base64(row.highRgba),
          workRgba: base64(row.workRgba),
        })),
      };
    },
    { runnerUrl: RUNNER_URL, captureInput: input },
  );

  try {
    expect(wire.schemaVersion).toBe("lego.real-build-exact-three-source-browser/1");
    expect(wire.authority).toEqual({
      sourceExecution: "absent",
      preparedRun: "absent",
      placement: "absent",
      completion: "absent",
    });
    expect(wire.pdfDigest).toBe(pdfDigest);
    expect(wire.pdfBytes).toBe(bytes.byteLength);
    expect(wire.rows).toHaveLength(3);
    expect(wire.metrics).toMatchObject({
      requestedPanelCount: 3,
      returnedPanelCount: 3,
      distinctPageCount: 1,
      pageNumber: 11,
      moduleImportCount: 4,
      pdfFetchCount: 1,
      pageRenderCount: 1,
      pageDisposeCount: 1,
      pdfDestroyCount: 1,
      loadingTaskDestroyCount: 1,
    });
    expect(wire).not.toHaveProperty("publication");
    expect(wire).not.toHaveProperty("preparedRun");
    expect(wire).not.toHaveProperty("placement");

    const [{ createRealBuildBrowserOutputV4SourceEvidencePanel }, packetWriter, packetReader] =
      await Promise.all([
        import("./real-build-browser-output-v4-source-evidence-panel-writer"),
        import("./real-build-exact-three-source-packet-writer"),
        import("./real-build-exact-three-source-packet-reader"),
      ]);
    const artifacts = wire.rows.map((row, index) => {
      const high = Buffer.from(row.highRgba, "base64");
      const work = Buffer.from(row.workRgba, "base64");
      return createRealBuildBrowserOutputV4SourceEvidencePanel({
        pdfDigest,
        panel: panels[index],
        highRgba: new Uint8ClampedArray(high),
        workRgba: new Uint8ClampedArray(work),
      });
    });
    expect(artifacts.map(({ descriptor }) => descriptor.stepNumber)).toEqual(STEPS);
    expect(artifacts.map(({ descriptor }) => descriptor.pageNumber)).toEqual([11, 11, 11]);
    expect(artifacts.map(({ descriptor }) => descriptor.panelEvidenceDigest)).toEqual(
      EXPECTED_PANEL_DIGESTS,
    );
    expect(artifacts.reduce((sum, artifact) => sum + artifact.highRgbaBytes.byteLength, 0)).toBe(
      wire.metrics.highRgbaBytes,
    );
    expect(artifacts.reduce((sum, artifact) => sum + artifact.workRgbaBytes.byteLength, 0)).toBe(
      wire.metrics.workRgbaBytes,
    );

    const packet = packetWriter.createRealBuildExactThreeSourcePacket({
      scopedPanelEvidence: scoped,
      sourcePanels: artifacts,
    });
    const packetBytes = packetWriter.readRealBuildExactThreeSourcePacketBytes(packet);
    const inspection = packetReader.readRealBuildExactThreeSourcePacket(packetBytes);
    expect(packet.authority).toEqual({
      sourceText: "caller-supplied-unverified",
      sourceExecution: "absent",
      preparedRun: "absent",
      physicalFrame: "absent",
      placement: "absent",
      completion: "absent",
    });
    expect(packet.acceptedDocument).toBeNull();
    expect(packet.manifestDigest).toBe(sha256Digest(packetBytes.manifestBytes));
    expect(inspection).toMatchObject({
      reproducible: true,
      sourceExecutionAuthority: "absent",
      preparedRunAuthority: "absent",
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: "absent",
      acceptedDocument: null,
    });
    expect(inspection.manifest.authority).toEqual(packet.authority);
    expect(inspection.manifest.scope).toMatchObject({
      placementStepNumbers: [1, 2, 3],
      registrationPanelStepNumbers: [2, 3, 4],
      calloutProbePageNumbers: [11],
      indexedStepLabelCount: 359,
      materializedPagePanelCount: 4,
      emittedPanelCount: 3,
    });
    expect(
      inspection.manifest.panels.map(
        ({ placementStepNumber, registrationPanelStepNumber, pageNumber }) => ({
          placementStepNumber,
          registrationPanelStepNumber,
          pageNumber,
        }),
      ),
    ).toEqual([
      { placementStepNumber: 1, registrationPanelStepNumber: 2, pageNumber: 11 },
      { placementStepNumber: 2, registrationPanelStepNumber: 3, pageNumber: 11 },
      { placementStepNumber: 3, registrationPanelStepNumber: 4, pageNumber: 11 },
    ]);
    expect(
      inspection.manifest.panels.map(
        ({ callerSourcePanelCommitmentDigest }) => callerSourcePanelCommitmentDigest,
      ),
    ).toEqual(EXPECTED_PANEL_DIGESTS);
    const retainedRoles = [
      packetBytes.highRgbaRoleBytes,
      packetBytes.workRgbaRoleBytes,
      packetBytes.maskRoleBytes,
    ] as const;
    for (let roleIndex = 0; roleIndex < retainedRoles.length; roleIndex += 1) {
      const role = inspection.manifest.roles[roleIndex]!;
      expect(role.byteLength).toBe(retainedRoles[roleIndex]!.byteLength);
      expect(role.digest).toBe(sha256Digest(retainedRoles[roleIndex]!));
      let offset = 0;
      for (const panel of inspection.manifest.panels) {
        const slice = panel.roleSlices[roleIndex]!;
        expect(slice.role).toBe(role.role);
        expect(slice.offset).toBe(offset);
        offset += slice.byteLength;
      }
      expect(offset).toBe(role.byteLength);
    }
    process.stdout.write(
      `Exact-three packet ${packet.manifestDigest}: manifest ${packetBytes.manifestBytes.byteLength} bytes, ` +
        `high/work/masks ${retainedRoles.map(({ byteLength }) => byteLength).join("/")} bytes; authority absent.\n`,
    );

    mkdirSync(OUTPUT, { recursive: true });
    for (const stepNumber of STEPS) {
      for (const scale of ["high", "work"] as const) {
        await page
          .locator(
            `canvas[data-exact-three-step="${stepNumber}"][data-exact-three-scale="${scale}"]`,
          )
          .screenshot({ path: `${OUTPUT}/step-${stepNumber}-${scale}.png` });
      }
    }
  } finally {
    await page.evaluate(() => {
      document
        .querySelectorAll("canvas[data-exact-three-step]")
        .forEach((canvas) => canvas.remove());
    });
  }
});
