import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  BRICK_KERNEL_MODULE_URL,
  CATALOG_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/instruction-render";
const WIDTH = 900;
const HEIGHT = 700;

/**
 * The booklet draws flat fills and hard outlines; our renderer draws bevels,
 * clearcoat and shadows. A step render cannot be compared against booklet art
 * until it speaks that dialect, so this drives the instruction finish and
 * measures whether the output really is flat.
 *
 * The number to watch is how much of the render lands on the expected exact
 * palette — the page grey, the ink, and the catalog display hex of each part
 * placed. A lit render spends thousands of colours on shading; a flat one
 * spends none, so any pixel off that palette is a shading or blending leak.
 */
test("renders a model in the booklet's flat dialect", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = await page.evaluate(
    async ({ kernelUrl, catalogUrl, renderingUrl, commandsUrl, width, height }) => {
      interface ValidationIssue {
        readonly severity: string;
        readonly code: string;
        readonly partIds: readonly string[];
      }

      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const catalog = await import(/* @vite-ignore */ catalogUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);

      // A stack, not a slab: parts at three heights so outlines, studs and
      // hidden-line removal all have something to prove.
      const layout = [
        { part: "builtin:plate-6x6", color: "builtin:light-bluish-gray", at: [0, 8, 0] },
        { part: "builtin:brick-2x4", color: "builtin:red", at: [-20, -8, -20] },
        { part: "builtin:brick-2x2", color: "builtin:blue", at: [20, -8, 20] },
        { part: "builtin:plate-1x2", color: "builtin:yellow", at: [-10, -24, -40] },
      ];
      // Built through the editor's own placement command, so the connections
      // and step membership a real build carries are authored rather than
      // faked. A hand-assembled parts array validates as one big collision.
      let brickDocument = kernel.createEmptyBrickDocument({
        id: "instruction-render",
        name: "Dialect probe",
      });
      for (const entry of layout) {
        const transaction = commands.createPlacePartTransaction(brickDocument, {
          catalogPartId: entry.part,
          colorId: entry.color,
          transform: { positionLdu: entry.at, orientationId: "upright-yaw-0" },
        });
        brickDocument = kernel.applyBuildOperations(brickDocument, transaction.operations);
      }

      const projection = rendering.deriveBrickScene(brickDocument, { finish: "instruction" });
      const packet = rendering.createCanonicalViewPacket(projection);
      const renderer = rendering.createInstructionRenderer({ width, height });
      const pixels = renderer.render(
        projection.root,
        rendering.createCameraForView(packet.views[0], width / height),
      );

      const histogram = new Map<number, number>();
      for (let i = 0; i < width * height; i += 1) {
        const key = (pixels[i * 4] << 16) | (pixels[i * 4 + 1] << 8) | pixels[i * 4 + 2];
        histogram.set(key, (histogram.get(key) ?? 0) + 1);
      }

      const expected = new Map<number, string>([
        [rendering.INSTRUCTION_BACKGROUND_HEX, "page"],
        [rendering.INSTRUCTION_EDGE_HEX, "ink"],
      ]);
      for (const entry of layout) {
        const hex = catalog.getColorDefinition(entry.color).displayHex;
        expected.set(Number.parseInt(hex.slice(1), 16), entry.color);
      }
      let onPalette = 0;
      for (const [key, count] of histogram) {
        if (expected.has(key)) onPalette += count;
      }

      document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());
      const canvas = document.createElement("canvas");
      canvas.className = "probe";
      canvas.width = width;
      canvas.height = height;
      canvas.style.cssText = "position:fixed;left:0;top:0;z-index:99999";
      document.body.append(canvas);
      canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0);

      const report = {
        parts: brickDocument.parts.length,
        documentGloballyValid: projection.validationReport.documentGloballyValid,
        blockingIssues: projection.validationReport.issues
          .filter((issue: ValidationIssue) => issue.severity === "blocking")
          .map((issue: ValidationIssue) => `${issue.code}:${issue.partIds.join(",")}`),
        diagnostics: projection.diagnostics.map((entry: { code: string }) => entry.code),
        paletteSize: histogram.size,
        onPaletteShare: onPalette / (width * height),
        expectedPalette: [...expected].map(([key, role]) => ({
          hex: `#${key.toString(16).padStart(6, "0")}`,
          role,
          share: (histogram.get(key) ?? 0) / (width * height),
        })),
        offPaletteTop: [...histogram.entries()]
          .filter(([key]) => !expected.has(key))
          .sort((left, right) => right[1] - left[1])
          .slice(0, 10)
          .map(([key, count]) => ({
            hex: `#${key.toString(16).padStart(6, "0")}`,
            share: count / (width * height),
          })),
      };
      projection.dispose();
      renderer.dispose();
      return report;
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      catalogUrl: CATALOG_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );

  await page.locator("canvas.probe").screenshot({ path: `${OUT}/instruction.png` });
  writeFileSync(`${OUT}/score.json`, JSON.stringify(result, null, 1));

  // The probe model is built through the editor's own command path, so an
  // invalid document here means the probe is wrong, not the renderer.
  expect(result.blockingIssues).toEqual([]);
  expect(result.documentGloballyValid).toBe(true);
  expect(result.diagnostics).toEqual([]);
  // Measured at 6 colours and 1.000 on-palette. The slack is for driver
  // rounding only: reintroduce lighting or antialiasing and this explodes.
  expect(result.paletteSize).toBeLessThanOrEqual(8);
  expect(result.onPaletteShare).toBeGreaterThan(0.999);
});
