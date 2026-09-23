import { createHash } from "node:crypto";

import { expect, type Page, type TestInfo } from "@playwright/test";
import { canonicalBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { decodeRealBuildPngCapture } from "./real-build-png-capture";
import { appObservation, expectPrimaryProjectExact } from "./real-build-prefix50-ui-replay-support";

const CANONICAL_VIEW_NAMES = [
  "back",
  "front",
  "isometric",
  "left",
  "right",
  "top",
  "underside",
] as const;

interface ModelCaptureStat {
  readonly view: string;
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundPixels: number;
  readonly bounds: readonly [number, number, number, number];
}

function canonicalDocumentDigest(document: BrickDocumentV1): string {
  return `sha256:${createHash("sha256").update(canonicalBrickDocument(document)).digest("hex")}`;
}

async function inspectModelOnlyCaptures(
  page: Page,
  captures: Readonly<Record<string, string>>,
): Promise<readonly ModelCaptureStat[]> {
  return page.evaluate(async (captureUrls) => {
    const rows: ModelCaptureStat[] = [];
    for (const [view, dataUrl] of Object.entries(captureUrls)) {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error(`Could not inspect ${view} model-only capture.`);
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const background = [rgba[0]!, rgba[1]!, rgba[2]!] as const;
      let nonBackgroundPixels = 0;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;
      for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
        const offset = pixel * 4;
        if (
          Math.abs(rgba[offset]! - background[0]) +
            Math.abs(rgba[offset + 1]! - background[1]) +
            Math.abs(rgba[offset + 2]! - background[2]) <=
          12
        ) {
          continue;
        }
        nonBackgroundPixels += 1;
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      rows.push({
        view,
        width: canvas.width,
        height: canvas.height,
        nonBackgroundPixels,
        bounds: [minX, minY, maxX, maxY],
      });
    }
    return rows;
  }, captures);
}

function sha256Bytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function captureSceneEvidence(input: {
  readonly page: Page;
  readonly testInfo: TestInfo;
  readonly label: "combined" | "parent" | "child";
  readonly document: BrickDocumentV1;
  readonly generation: number;
}): Promise<void> {
  const { page, testInfo, label, document, generation } = input;
  const expectedHash = documentStructuralHash(document);
  const observation = await appObservation(page);
  expect(observation.playback).toBeNull();
  expect(observation.documentHash).toBe(expectedHash);
  expect(observation.document.parts).toHaveLength(document.parts.length);
  expect(observation.renderer).toMatchObject({
    contextLost: false,
    viewPacket: { documentHash: expectedHash },
  });
  expect(observation.renderer?.viewPacket).not.toBeNull();
  await expectPrimaryProjectExact(page, document, generation, `${label} visual evidence`);

  const fullPageDefault = await page.screenshot({ fullPage: true, animations: "disabled" });
  const canvas = page.locator(".brick-canvas");
  await expect(canvas).toBeVisible();
  const presentationCaptures = await page.evaluate(() =>
    window.capture_model_views!({ scene: "presentation" }),
  );
  const modelOnlyCaptures = await page.evaluate(() =>
    window.capture_model_views!({ scene: "model-only" }),
  );
  expect(Object.keys(presentationCaptures).sort()).toEqual(CANONICAL_VIEW_NAMES);
  expect(Object.keys(modelOnlyCaptures).sort()).toEqual(CANONICAL_VIEW_NAMES);
  const modelStats = await inspectModelOnlyCaptures(page, modelOnlyCaptures);
  expect(modelStats).toHaveLength(CANONICAL_VIEW_NAMES.length);
  for (const stat of modelStats) {
    expect(stat, `${label} ${stat.view} model-only pixels`).toMatchObject({
      width: 640,
      height: 480,
    });
    expect(stat.nonBackgroundPixels, `${label} ${stat.view} model pixels`).toBeGreaterThan(1_000);
    const [minX, minY, maxX, maxY] = stat.bounds;
    expect(maxX - minX, `${label} ${stat.view} visible model width`).toBeGreaterThan(20);
    expect(maxY - minY, `${label} ${stat.view} visible model height`).toBeGreaterThan(20);
    expect(minX, `${label} ${stat.view} left framing`).toBeGreaterThan(0);
    expect(minY, `${label} ${stat.view} top framing`).toBeGreaterThan(0);
    expect(maxX, `${label} ${stat.view} right framing`).toBeLessThan(639);
    expect(maxY, `${label} ${stat.view} bottom framing`).toBeLessThan(479);
  }
  const viewportDefault = await canvas.screenshot({ animations: "disabled" });

  await testInfo.attach(`prefix50-${label}-full-page-default.png`, {
    body: fullPageDefault,
    contentType: "image/png",
  });
  await testInfo.attach(`prefix50-${label}-viewport-default.png`, {
    body: viewportDefault,
    contentType: "image/png",
  });
  const canonicalDigests: Record<string, { presentation: string; modelOnly: string }> = {};
  for (const view of CANONICAL_VIEW_NAMES) {
    const presentation = decodeRealBuildPngCapture(presentationCaptures[view]!);
    const modelOnly = decodeRealBuildPngCapture(modelOnlyCaptures[view]!);
    canonicalDigests[view] = {
      presentation: sha256Bytes(presentation),
      modelOnly: sha256Bytes(modelOnly),
    };
    await testInfo.attach(`prefix50-${label}-${view}.png`, {
      body: presentation,
      contentType: "image/png",
    });
    await testInfo.attach(`prefix50-${label}-${view}-model-only.png`, {
      body: modelOnly,
      contentType: "image/png",
    });
  }

  await canvas.hover();
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(120);
  const viewportClose = await canvas.screenshot({ animations: "disabled" });
  expect(sha256Bytes(viewportClose), `${label} close zoom changed the viewport`).not.toBe(
    sha256Bytes(viewportDefault),
  );
  expect((await appObservation(page)).renderer?.viewPacket?.documentHash).toBe(expectedHash);
  await testInfo.attach(`prefix50-${label}-viewport-close.png`, {
    body: viewportClose,
    contentType: "image/png",
  });
  await testInfo.attach(`prefix50-${label}-evidence.json`, {
    body: Buffer.from(
      JSON.stringify(
        {
          schemaVersion: "lego.real-build-prefix50-ui-evidence/1",
          label,
          generation,
          partCount: document.parts.length,
          documentHash: expectedHash,
          canonicalDocumentDigest: canonicalDocumentDigest(document),
          rendererDocumentHash: observation.renderer?.viewPacket?.documentHash ?? null,
          screenshots: {
            fullPageDefault: sha256Bytes(fullPageDefault),
            viewportDefault: sha256Bytes(viewportDefault),
            viewportClose: sha256Bytes(viewportClose),
          },
          canonicalDigests,
          modelStats,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
}
