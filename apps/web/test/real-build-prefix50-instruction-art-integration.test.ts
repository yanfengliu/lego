import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import { getColorDefinition } from "@lego-studio/catalog";
import { instructionFaceTones } from "@lego-studio/rendering";
import { expect, it } from "vitest";

import { seedRealBuildPrefix50DocumentInApp } from "../e2e/real-build-prefix50-subbuild-return-review-camera-app.ts";
import {
  runRealBuildPrefix50Step44BrowserLifecycle,
  realBuildPrefix50Step44BrowserLifecycleError,
} from "../e2e/real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";

// Bound: actual static-app captures of one catalog brick, four views/four scales,
// and exact color-ID masks. No PDF, camera fitting, or first-50 completion claim.
// Reusing the lit presentation scene must fail the pixel palette check.
it("captures real instruction art and masks without changing the presentation viewport", async () => {
  const parent = resolve("output/playwright/instruction-art-integration");
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(resolve(parent, "run-"));
  const base = createEmptyBrickDocument({ id: "instruction-art", name: "Instruction art" });
  const part = createPartInstance({ id: "blue-brick", colorId: "builtin:blue" });
  const document = {
    ...base,
    parts: [part],
    submodels: base.submodels.map((row) => ({ ...row, partIds: [part.id] })),
    steps: base.steps.map((row) => ({ ...row, partIds: [part.id] })),
  };
  const backgroundHex = 0x899093;
  const displayHex = Number.parseInt(getColorDefinition(part.colorId)!.displayHex.slice(1), 16);
  const allowedArtColors = new Set([backgroundHex, ...instructionFaceTones(displayHex)]);
  const result = await runRealBuildPrefix50Step44BrowserLifecycle({
    serverLogPath: resolve(output, "static-app.log"),
    execute: async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await seedRealBuildPrefix50DocumentInApp(page, document, 1, "instruction-art fixture");
      const before = await page.evaluate(() =>
        window.capture_model_views!({ scene: "model-only" }),
      );
      const measurements = [];
      for (const [index, [azimuthDegrees, elevationDegrees, pixelsPerUnit]] of [
        [35, 35, 80],
        [125, 25, 110],
        [220, 60, 75],
        [310, 15, 125],
      ].entries()) {
        const request = {
          scene: "model-only" as const,
          backgroundHex,
          parameters: {
            azimuthDegrees: azimuthDegrees!,
            elevationDegrees: elevationDegrees!,
            pixelsPerUnit: pixelsPerUnit!,
            centerXPx: 360,
            centerYPx: 235,
          },
          frame: { widthPx: 720, heightPx: 470, target: [0, 0.5, 0] as const, sceneRadius: 5 },
        };
        const captures = await page.evaluate(async (input) => {
          const art = await window.capture_instruction_view!({
            ...input,
            renderMode: "instruction-art",
          });
          const mask = await window.capture_instruction_view!({
            ...input,
            renderMode: "semantic-color-id-mask",
            targetColorIds: ["builtin:blue"],
          });
          const repeated = await window.capture_instruction_view!({
            ...input,
            renderMode: "instruction-art",
          });
          return { art, mask, repeated };
        }, request);
        expect(captures.repeated).toEqual(captures.art);
        expect(captures.mask.semanticColorMask).toEqual({
          targetColorIds: ["builtin:blue"],
          targetPartIds: [part.id],
          otherPartIds: [],
        });
        for (const mode of ["art", "mask"] as const) {
          const capture = captures[mode];
          expect(capture.projectionMatrix).toEqual(captures.art.projectionMatrix);
          expect(capture.matrixWorldInverse).toEqual(captures.art.matrixWorldInverse);
          const png = Buffer.from(capture.pngDataUrl.split(",")[1]!, "base64");
          await writeFile(resolve(output, `${index}-${mode}.png`), png);
          const { width, height, rgba } = decodeRealBuildPrefix50Step44ReviewPng(
            png,
            720 * 470,
            "Instruction capture",
          );
          expect([width, height]).toEqual([720, 470]);
          const histogram = new Map<number, number>();
          for (let offset = 0; offset < rgba.length; offset += 4) {
            const color = (rgba[offset]! << 16) | (rgba[offset + 1]! << 8) | rgba[offset + 2]!;
            histogram.set(color, (histogram.get(color) ?? 0) + 1);
          }
          const allowed = mode === "art" ? allowedArtColors : new Set([backgroundHex, 0x00ffff]);
          const offPalette = [...histogram]
            .filter(([color]) => !allowed.has(color))
            .reduce((sum, [, count]) => sum + count, 0);
          const subjectPixels = width * height - (histogram.get(backgroundHex) ?? 0);
          measurements.push({ index, mode, offPalette, subjectPixels, colors: histogram.size });
        }
      }
      await writeFile(resolve(output, "measurements.json"), JSON.stringify(measurements, null, 2));
      expect(
        await page.evaluate(() => window.capture_model_views!({ scene: "model-only" })),
      ).toEqual(before);
      expect(errors).toEqual([]);
      for (const measurement of measurements) {
        expect(measurement.subjectPixels, JSON.stringify(measurement)).toBeGreaterThan(500);
        expect(measurement.subjectPixels).toBeLessThan((720 * 470) / 2);
        expect(measurement.offPalette, JSON.stringify(measurement)).toBe(0);
      }
    },
  });
  if (result.status === "failed") throw realBuildPrefix50Step44BrowserLifecycleError(result);
  expect(result.cleanup).toEqual({
    browserClosed: true,
    browserProcessTreeClosed: true,
    serverClosed: true,
  });
  await rm(output, { recursive: true });
}, 90_000);
