import { existsSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  assertV6CalloutManifest,
  readJsonArtifact,
} from "../../../scripts/part-identification-artifacts.mjs";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import type { CalloutManifest } from "./callout-types";
import type {
  SourceArtReboundBrowserCapture,
  SourceArtReboundBrowserInput,
} from "./callout-source-art-rebound-browser";

const ENABLED = process.env.LEGO_REAL_BUILD_SOURCE_ART_REBOUND === "1";
const MANIFEST_PATH = "output/callout-thumbnails/manifest.json";
const MANIFEST_SHA256 = "sha256:c8d20cfe87ef9d21488725b393b94e61870fcc82b26bb497ea734fc7b97a67bf";
const PDFJS_VERSION = "5.4.149";
const PDF_SHA256 = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const IDENTITIES = [
  "p11|q1|x90.511|y212.112",
  "p11|q1|x506.064|y212.112",
  "p20|q1|x36.320|y430.691",
] as const;
type Identity = (typeof IDENTITIES)[number];
const EXPECTED: Readonly<
  Record<Identity, { readonly pageNumber: number; readonly rgba: string; readonly window: object }>
> = {
  [IDENTITIES[0]]: {
    pageNumber: 11,
    rgba: "sha256:a3abc04c61c61fe67b86825ab9a6630076904c69fbe8cb5f2832f4ab1e573b56",
    window: { bottom: 2664, left: 716, right: 1059, top: 2297 },
  },
  [IDENTITIES[1]]: {
    pageNumber: 11,
    rgba: "sha256:0efabb700e9bad5e00e5175c76c6a402529aea9a518fb233333127ce6c367f01",
    window: { bottom: 2664, left: 4040, right: 4383, top: 2297 },
  },
  [IDENTITIES[2]]: {
    pageNumber: 20,
    rgba: "sha256:36fabceb0dbbd88026fcc0907ae6f14964dfc5a395568d730dda2667da1ee027",
    window: { bottom: 915, left: 282, right: 625, top: 548 },
  },
};

function pngBytes(url: string): Buffer {
  const prefix = "data:image/png;base64,";
  if (!url.startsWith(prefix)) throw new Error("Source-art capture is not a PNG data URL.");
  const bytes = Buffer.from(url.slice(prefix.length), "base64");
  if (bytes.length < 1 || bytes.length > 2 * 1024 * 1024) {
    throw new Error(`Source-art capture has invalid byte length ${bytes.length}.`);
  }
  return bytes;
}

function captureSummary(capture: SourceArtReboundBrowserCapture): object {
  return {
    evidenceRole: capture.evidenceRole,
    fullRgbaSha256: capture.fullRgbaSha256,
    identity: capture.identity,
    isolatedRgbaSha256: capture.isolatedRgbaSha256,
    noOutsidePaintInterference: capture.noOutsidePaintInterference,
    operationClosureCount: capture.operationClosureCount,
    pageNumber: capture.pageNumber,
    pdfjsVersion: capture.pdfjsVersion,
    rendererRole: capture.rendererRole,
    stepWindow: capture.stepWindow,
  };
}

function expectedRoute(
  rendererRole: SourceArtReboundBrowserInput["rendererRole"],
): readonly object[] {
  return IDENTITIES.map((identity) => ({
    evidenceRole: "diagnostic-visual-only-no-native-renderer-equivalence",
    fullRgbaSha256: EXPECTED[identity].rgba,
    identity,
    isolatedRgbaSha256: EXPECTED[identity].rgba,
    noOutsidePaintInterference: true,
    operationClosureCount: 22,
    pageNumber: EXPECTED[identity].pageNumber,
    pdfjsVersion: PDFJS_VERSION,
    rendererRole,
    stepWindow: EXPECTED[identity].window,
  }));
}

test("captures exact step-2/4/16 full and isolated source-art contributions", async ({
  page,
}, testInfo) => {
  test.skip(!ENABLED, "set LEGO_REAL_BUILD_SOURCE_ART_REBOUND=1 for genuine capture");
  test.skip(!hasSampleBooklet || !existsSync(MANIFEST_PATH), "exact PDF or manifest unavailable");

  const manifestArtifact = readJsonArtifact<CalloutManifest>(
    MANIFEST_PATH,
    "source-art rebound manifest",
  );
  expect(manifestArtifact.digest).toBe(MANIFEST_SHA256);
  const manifest = assertV6CalloutManifest(manifestArtifact.value) as CalloutManifest;
  expect(manifest.sourceHash).toBe(PDF_SHA256);
  const manifestRows = IDENTITIES.map((identity) => {
    const row = manifest.callouts.find((candidate) => candidate.identity === identity);
    if (row === undefined || row.sourceComponent === null) {
      throw new Error(`Authenticated manifest has no source component for ${identity}.`);
    }
    return { ...row, sourceComponent: row.sourceComponent };
  });
  const rows = manifestRows.map((row) => ({
    componentBoundsPxAtScale8: row.sourceComponent.boundsPx,
    identity: row.identity,
    pageNumber: row.pageNumber,
    quantity: row.quantity,
    xPt: row.xPt,
    yPt: row.yPt,
  }));
  await page.goto("/");
  const urls = bookletProbeUrls();
  const input: SourceArtReboundBrowserInput = {
    expectedPdfjsVersion: PDFJS_VERSION,
    expectedPdfSha256: PDF_SHA256,
    expectedSourceBytes: urls.expectedSourceBytes,
    pdfjsUrl: urls.pdfjsUrl,
    pdfUrl: urls.pdfUrl,
    rendererRole: "chromium-pdfjs-build",
    targets: rows,
    workerUrl: urls.workerUrl,
  };
  const captureRoute = async (
    browserInput: SourceArtReboundBrowserInput,
  ): Promise<readonly SourceArtReboundBrowserCapture[]> =>
    page.evaluate(
      async ({ moduleUrl, value }) => {
        const module = (await import(/* @vite-ignore */ moduleUrl)) as {
          captureSourceArtRebound(
            inputValue: SourceArtReboundBrowserInput,
          ): Promise<readonly SourceArtReboundBrowserCapture[]>;
        };
        return module.captureSourceArtRebound(value);
      },
      { moduleUrl: "/e2e/callout-source-art-rebound-browser.ts", value: browserInput },
    );
  const modernCaptures = await captureRoute(input);
  const legacyCaptures = await captureRoute({
    ...input,
    pdfjsUrl: urls.pdfjsUrl.replace("/build/pdf.mjs", "/legacy/build/pdf.mjs"),
    rendererRole: "chromium-pdfjs-legacy-build",
    workerUrl: urls.workerUrl.replace("/build/pdf.worker.mjs", "/legacy/build/pdf.worker.mjs"),
  });

  expect(modernCaptures.map(({ identity }) => identity)).toEqual(IDENTITIES);
  expect(legacyCaptures.map(({ identity }) => identity)).toEqual(IDENTITIES);
  for (const capture of modernCaptures) {
    const step = manifest.callouts.find(
      ({ identity }) => identity === capture.identity,
    )!.stepNumber;
    const fullPath = testInfo.outputPath(`step-${step}-full.png`);
    const isolatedPath = testInfo.outputPath(`step-${step}-isolated.png`);
    writeFileSync(fullPath, pngBytes(capture.fullPng), { flag: "wx" });
    writeFileSync(isolatedPath, pngBytes(capture.isolatedPng), { flag: "wx" });
    await testInfo.attach(`step-${step}-full.png`, {
      path: fullPath,
      contentType: "image/png",
    });
    await testInfo.attach(`step-${step}-isolated.png`, {
      path: isolatedPath,
      contentType: "image/png",
    });
  }
  const proofBytes = Buffer.from(
    `${JSON.stringify(
      {
        authority: {
          catalogAdmission: "absent",
          completion: "absent",
          placement: "absent",
          semanticIdentity: "absent",
        },
        browserRendererRole: "diagnostic-visual-only",
        manifestSha256: MANIFEST_SHA256,
        nativeRendererEquivalenceClaimed: false,
        pdfSha256: PDF_SHA256,
        routes: {
          build: modernCaptures.map(captureSummary),
          legacyBuild: legacyCaptures.map(captureSummary),
        },
        sourceCommitments: manifestRows.map((row) => ({
          cropSha256: row.sha256,
          identity: row.identity,
          sourceComponent: row.sourceComponent,
        })),
      },
      null,
      2,
    )}\n`,
  );
  const proofPath = testInfo.outputPath("source-art-rebound-browser-proof.json");
  writeFileSync(proofPath, proofBytes, { flag: "wx" });
  await testInfo.attach("source-art-rebound-browser-proof.json", {
    path: proofPath,
    contentType: "application/json",
  });
  expect(modernCaptures.map(captureSummary)).toEqual(expectedRoute("chromium-pdfjs-build"));
  expect(legacyCaptures.map(captureSummary)).toEqual(expectedRoute("chromium-pdfjs-legacy-build"));
});
