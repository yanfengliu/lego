import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/camera-fit";
const WIDTH = 640;
const HEIGHT = 480;

/**
 * The unit tests fit a point cloud through an analytic projection. This drives
 * the same fitter against real catalog geometry through the real rasteriser,
 * and paints the result so it can be looked at rather than only scored: the
 * target region, the fitted region, and where they disagree.
 *
 * The "panel" here is a render of the same model from a view the fitter is
 * never told, which is the honest synthetic stand-in for a booklet panel. It
 * proves the mechanism; it does not prove the booklet's projection is
 * orthographic, which only a real panel can.
 */
test("recovers the view a model was drawn from", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = await page.evaluate(
    async ({ kernelUrl, renderingUrl, commandsUrl, width, height }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);

      // Wide enough that the shape reads differently from every direction, so a
      // wrong azimuth cannot score well by symmetry.
      const layout = [
        { part: "builtin:plate-6x6", color: "builtin:light-bluish-gray", at: [0, 8, 0] },
        { part: "builtin:brick-2x4", color: "builtin:red", at: [-20, -8, -20] },
        { part: "builtin:brick-2x2", color: "builtin:blue", at: [20, -8, 20] },
        { part: "builtin:plate-1x2", color: "builtin:yellow", at: [-10, -24, -40] },
        { part: "builtin:brick-1x6", color: "builtin:green", at: [-50, -8, 0] },
        { part: "builtin:brick-1x1", color: "builtin:white", at: [50, -8, -50] },
      ];
      let brickDocument = kernel.createEmptyBrickDocument({ id: "camera-fit", name: "Fit probe" });
      for (const entry of layout) {
        const transaction = commands.createPlacePartTransaction(brickDocument, {
          catalogPartId: entry.part,
          colorId: entry.color,
          transform: { positionLdu: entry.at, orientationId: "upright-yaw-0" },
        });
        brickDocument = kernel.applyBuildOperations(brickDocument, transaction.operations);
      }

      const projection = rendering.deriveBrickScene(brickDocument, { finish: "instruction" });
      const renderer = rendering.createInstructionRenderer({ width, height });
      const frame = rendering.instructionViewFrame(projection.bounds, width, height);

      const renderSilhouette = (parameters: unknown) => {
        const camera = rendering.createOrthographicViewCamera(parameters, frame);
        const pixels = renderer.render(projection.root, camera);
        return rendering.silhouetteFromPixels(pixels, width, height, {
          backgroundHex: rendering.INSTRUCTION_BACKGROUND_HEX,
        });
      };

      // A view the fitter is never told, at a scale and offset that are not the
      // seed's, standing in for the panel it has to recover.
      const truth = {
        azimuthDegrees: 41,
        elevationDegrees: 26,
        pixelsPerUnit: 74,
        centerXPx: 352,
        centerYPx: 212,
      };
      const truthCamera = rendering.createOrthographicViewCamera(truth, frame);
      const targetPixels = renderer.render(projection.root, truthCamera).slice();
      const target = rendering.silhouetteFromPixels(targetPixels, width, height, {
        backgroundHex: rendering.INSTRUCTION_BACKGROUND_HEX,
      });

      const started = performance.now();
      const fit = rendering.fitOrthographicView(renderSilhouette, target, {
        pixelsPerUnit: 40,
        centerXPx: width / 2,
        centerYPx: height / 2,
      });
      const elapsedMs = performance.now() - started;

      const fittedPixels = fit.best
        ? renderer
            .render(projection.root, rendering.createOrthographicViewCamera(fit.best, frame))
            .slice()
        : null;
      const fitted = fittedPixels
        ? rendering.silhouetteFromPixels(fittedPixels, width, height, {
            backgroundHex: rendering.INSTRUCTION_BACKGROUND_HEX,
          })
        : null;

      // Paint the disagreement, because an IoU cannot say which way it is wrong.
      const composite = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < width * height; index += 1) {
        const inTarget = target.mask[index] === 1;
        const inFit = fitted !== null && fitted.mask[index] === 1;
        const color =
          inTarget && inFit
            ? [245, 245, 245]
            : inTarget
              ? [220, 40, 160]
              : inFit
                ? [40, 200, 110]
                : [28, 30, 32];
        composite[index * 4] = color[0]!;
        composite[index * 4 + 1] = color[1]!;
        composite[index * 4 + 2] = color[2]!;
        composite[index * 4 + 3] = 255;
      }

      // Laid out side by side, not stacked: three canvases at the same
      // position screenshot as three copies of whichever one is on top.
      const paint = (
        name: string,
        pixels: Uint8ClampedArray<ArrayBuffer>,
        left: number,
        top: number,
      ) => {
        const canvas = document.createElement("canvas");
        canvas.className = `probe probe-${name}`;
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText = `position:fixed;top:${top}px;left:${left}px;z-index:99999`;
        document.body.append(canvas);
        canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0);
      };
      document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());
      paint("target", targetPixels, 0, 0);
      if (fittedPixels) paint("fitted", fittedPixels, width, 0);
      paint("overlap", composite, 0, height);

      const report = {
        parts: brickDocument.parts.length,
        documentGloballyValid: projection.validationReport.documentGloballyValid,
        truth,
        best: fit.best,
        failure: fit.failure,
        renders: fit.renders,
        elapsedMs: Math.round(elapsedMs),
        targetAreaPx: target.area,
        error: fit.best
          ? {
              azimuthDegrees: fit.best.azimuthDegrees - truth.azimuthDegrees,
              elevationDegrees: fit.best.elevationDegrees - truth.elevationDegrees,
              pixelsPerUnit: fit.best.pixelsPerUnit - truth.pixelsPerUnit,
              centerXPx: fit.best.centerXPx - truth.centerXPx,
              centerYPx: fit.best.centerYPx - truth.centerYPx,
            }
          : null,
        runnerUp: fit.ranked[1] ?? null,
      };
      projection.dispose();
      renderer.dispose();
      return report;
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );

  await page.locator("canvas.probe-target").screenshot({ path: `${OUT}/target.png` });
  await page.locator("canvas.probe-fitted").screenshot({ path: `${OUT}/fitted.png` });
  await page.locator("canvas.probe-overlap").screenshot({ path: `${OUT}/overlap.png` });
  // Not `score.json`: `camera-panel-fit.spec.ts` owns that name for the fit
  // against a real printed panel, and two probes writing one path means the
  // file says whatever ran last.
  writeFileSync(`${OUT}/synthetic-score.json`, JSON.stringify(result, null, 1));

  expect(result.documentGloballyValid).toBe(true);
  expect(result.failure).toBeNull();
  expect(result.best!.iou).toBeGreaterThan(0.98);
  expect(Math.abs(result.error!.azimuthDegrees)).toBeLessThan(0.5);
  expect(Math.abs(result.error!.elevationDegrees)).toBeLessThan(0.5);
});
