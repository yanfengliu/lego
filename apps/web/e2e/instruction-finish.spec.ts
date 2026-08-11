import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  CATALOG_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/instruction-finish";
const WIDTH = 460;
const HEIGHT = 340;

interface SubjectReport {
  readonly name: string;
  readonly paletteSize: number;
  readonly offPaletteShare: number;
  readonly offPaletteTop: readonly { readonly hex: string; readonly share: number }[];
  readonly toneShares: readonly { readonly hex: string; readonly share: number }[];
  readonly silhouettePx: number;
  readonly inkedSilhouetteShare: number;
}

interface ProbeReport {
  readonly subjects: readonly SubjectReport[];
  /** Catalog colours a shaded face of which keys as printed highlight yellow. */
  readonly colorsKeyingAsHighlight: readonly string[];
  readonly loopColorsKeyingAsHighlight: readonly string[];
}

/**
 * The instruction finish beside the art it imitates.
 *
 * The reference is `output/inventory-thumbnails`, the printed part pictures
 * this set's own booklet carries, so every subject here has one there: a light
 * bluish gray brick, a black one, a white one, at roughly the printed size.
 * Look at the PNGs. The two numbers below only catch what a glance cannot, and
 * both of them were failing before this probe existed.
 *
 * Palette: a shaded render must still land on an enumerable set of tones —
 * the page, each colour's ink, and every per-triangle tone declared by the
 * derived geometry. Anything outside that finite set is a gradient, which is
 * what makes a comparison against printed art tolerate being wrong.
 *
 * Silhouette ink: the outline pass this replaced was broken along 38 to 68% of
 * a part's silhouette, because it fought the fill for the depth buffer and won
 * or lost per pixel. A box silhouette is entirely 90-degree creases, so every
 * pixel of it should carry ink.
 */
test("prints a brick in the booklet's shaded dialect", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = (await page.evaluate(
    async ({ kernelUrl, catalogUrl, renderingUrl, commandsUrl, assemblyUrl, width, height }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const catalog = await import(/* @vite-ignore */ catalogUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);
      const assembly = await import(/* @vite-ignore */ assemblyUrl);

      const place = (document_: unknown, part: string, at: number[], colorId: string) => {
        const transaction = commands.createPlacePartTransaction(document_, {
          catalogPartId: part,
          colorId,
          transform: { positionLdu: at, orientationId: "upright-yaw-0" },
        });
        return kernel.applyBuildOperations(document_, transaction.operations);
      };
      const displayHexOf = (colorId: string): number =>
        Number.parseInt(catalog.getColorDefinition(colorId).displayHex.slice(1), 16);

      // The build plate's surface, in LDU, with -Y up.
      const GROUND_Y = 12;
      const definitionOf = (part: string) => {
        const definition = catalog.getPartDefinition(part) as
          | {
              boundsLdu: { min: number[]; max: number[] };
              collision: { primitives: { tag: string; minLdu?: number[] }[] };
            }
          | undefined;
        if (!definition) throw new Error(`Probe subject ${part} is not in the catalog`);
        return definition;
      };
      /**
       * Where a part's origin goes so that it rests on a surface.
       *
       * A part's origin is not half its height above its base: an arch and a
       * two-plate cheese slope are staircases of boxes and sit at their own
       * offsets. Reading the part's own bounds is what keeps a probe from
       * quietly floating a piece the placement command then refuses.
       */
      const restingY = (part: string, surfaceY: number): number =>
        surfaceY - definitionOf(part).boundsLdu.max[1]!;
      /**
       * The face a part already placed at `originY` offers to the next one.
       *
       * Its body, not its bounds: a plate's bounding box reaches four LDU above
       * the plate because the studs stick out of it, and a part rested on the
       * top of a stud is a part floating over the plate.
       */
      const surfaceOf = (part: string, originY: number): number =>
        originY +
        Math.min(
          ...definitionOf(part)
            .collision.primitives.filter(
              (primitive) => primitive.tag === "body" && primitive.minLdu !== undefined,
            )
            .map((primitive) => primitive.minLdu![1]!),
        );

      const BASE = "builtin:plate-6x6";
      const baseY = restingY(BASE, GROUND_Y);
      const deckY = surfaceOf(BASE, baseY);
      const alone = (part: string, color: string) => ({
        name: "",
        parts: [{ part, at: [0, restingY(part, GROUND_Y), 0], color }],
      });
      const onDeck = (part: string, x: number, z: number, color: string) => ({
        part,
        at: [x, restingY(part, deckY), z],
        color,
      });
      const base = { part: BASE, at: [0, baseY, 0], color: "builtin:light-bluish-gray" };

      const subjects = [
        { ...alone("builtin:brick-2x4", "builtin:light-bluish-gray"), name: "gray-2x4" },
        { ...alone("builtin:brick-1x4", "builtin:black"), name: "black-1x4" },
        { ...alone("builtin:brick-2x2", "builtin:white"), name: "white-2x2" },
        {
          // An arch and two slopes whose admitted meshes include normals away
          // from the six box axes. They must retain their moulded face bands
          // without introducing a continuously interpolated gradient.
          name: "compound",
          parts: [
            base,
            onDeck("builtin:arch-1x4", -30, -20, "builtin:light-bluish-gray"),
            onDeck("builtin:curved-slope-1x4", 30, 20, "builtin:black"),
            onDeck("builtin:cheese-slope-1x1", -10, 50, "builtin:red"),
          ],
        },
        {
          name: "stack",
          parts: [
            base,
            onDeck("builtin:brick-2x4", -20, -20, "builtin:light-bluish-gray"),
            onDeck("builtin:brick-2x2", 20, 20, "builtin:red"),
            onDeck("builtin:brick-1x6", -50, 0, "builtin:black"),
            onDeck("builtin:brick-1x1", 50, -50, "builtin:blue"),
          ],
        },
      ];

      const renderer = rendering.createInstructionRenderer({ width, height });
      const background = rendering.INSTRUCTION_BACKGROUND_HEX;
      const report: unknown[] = [];
      document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());

      for (const [subjectIndex, subject] of subjects.entries()) {
        let brickDocument = kernel.createEmptyBrickDocument({
          id: subject.name,
          name: subject.name,
        });
        for (const entry of subject.parts) {
          brickDocument = place(brickDocument, entry.part, entry.at, entry.color);
        }
        const scene = rendering.deriveBrickScene(brickDocument, { finish: "instruction" });
        const frame = rendering.instructionViewFrame(scene.bounds, width, height);
        const span = Math.max(
          scene.bounds.max.x - scene.bounds.min.x,
          scene.bounds.max.z - scene.bounds.min.z,
          0.4,
        );
        const camera = rendering.createOrthographicViewCamera(
          {
            azimuthDegrees: 41,
            elevationDegrees: 26,
            pixelsPerUnit: Math.min(120, (width * 0.6) / span),
            centerXPx: width / 2,
            centerYPx: height / 2,
          },
          frame,
        );
        const pixels = renderer.render(scene.root, camera).slice();

        // Every tone this derived scene declares, and the subset that is ink.
        // Vertex colours are stored in Three's linear working space; convert
        // them back to sRGB bytes exactly as the unlit renderer does. Every
        // triangle has one repeated colour at all three corners, so any raster
        // colour outside this set is an interpolated gradient or contamination.
        const allowed = new Set<number>([background]);
        const ink = new Set<number>();
        const linearToSrgbByte = (value: number): number =>
          Math.round(
            255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055),
          );
        scene.root.traverse(
          (object: {
            geometry?: {
              getAttribute(name: string):
                | {
                    readonly count: number;
                    getX(index: number): number;
                    getY(index: number): number;
                    getZ(index: number): number;
                  }
                | undefined;
            };
          }) => {
            const colors = object.geometry?.getAttribute("color");
            if (!colors) return;
            for (let index = 0; index < colors.count; index += 1) {
              allowed.add(
                (linearToSrgbByte(colors.getX(index)) << 16) |
                  (linearToSrgbByte(colors.getY(index)) << 8) |
                  linearToSrgbByte(colors.getZ(index)),
              );
            }
          },
        );
        for (const colorId of new Set(subject.parts.map((entry) => entry.color))) {
          const displayHex = displayHexOf(colorId);
          const edge = rendering.instructionEdgeHex(displayHex);
          allowed.add(edge);
          ink.add(edge);
        }

        const keyAt = (index: number) =>
          (pixels[index * 4]! << 16) | (pixels[index * 4 + 1]! << 8) | pixels[index * 4 + 2]!;
        const histogram = new Map<number, number>();
        for (let index = 0; index < width * height; index += 1) {
          const key = keyAt(index);
          histogram.set(key, (histogram.get(key) ?? 0) + 1);
        }
        const area = width * height;
        let offPalette = 0;
        for (const [key, count] of histogram) if (!allowed.has(key)) offPalette += count;

        // The outer boundary of the model, and how much of it carries ink.
        let silhouettePx = 0;
        let inkedSilhouettePx = 0;
        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = y * width + x;
            if (keyAt(index) === background) continue;
            const onEdge =
              keyAt(index - 1) === background ||
              keyAt(index + 1) === background ||
              keyAt(index - width) === background ||
              keyAt(index + width) === background;
            if (!onEdge) continue;
            silhouettePx += 1;
            if (ink.has(keyAt(index))) inkedSilhouettePx += 1;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.className = `probe probe-${subject.name}`;
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText =
          `position:fixed;z-index:99999;` +
          `left:${(subjectIndex % 2) * width}px;top:${Math.floor(subjectIndex / 2) * height}px`;
        document.body.append(canvas);
        canvas
          .getContext("2d")!
          .putImageData(
            new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height),
            0,
            0,
          );

        report.push({
          name: subject.name,
          paletteSize: histogram.size,
          offPaletteShare: offPalette / area,
          offPaletteTop: [...histogram.entries()]
            .filter(([key]) => !allowed.has(key))
            .sort((left, right) => right[1] - left[1])
            .slice(0, 6)
            .map(([key, count]) => ({
              hex: `#${key.toString(16).padStart(6, "0")}`,
              share: count / area,
            })),
          toneShares: [...allowed]
            .map((key) => ({
              hex: `#${key.toString(16).padStart(6, "0")}`,
              share: (histogram.get(key) ?? 0) / area,
            }))
            .filter((entry) => entry.share > 0)
            .sort((left, right) => right.share - left.share),
          silhouettePx,
          inkedSilhouetteShare: silhouettePx === 0 ? 0 : inkedSilhouettePx / silhouettePx,
        });
        scene.dispose();
      }
      renderer.dispose();

      // A synthetic booklet marks a step by stroking it in the highlight yellow
      // `extractHighlightRegions` keys back out. A shaded face that happens to
      // satisfy that key would register as a highlight region the size of a
      // brick, and the step's target would be whatever that face covers. Some
      // catalog colours already key at their flat hex — yellow, lime, nougat —
      // so the list is reported rather than asserted empty; what must hold is
      // that the two colours the closed loop paints with stay out of it.
      const keying: string[] = [];
      for (const color of catalog.COLOR_DEFINITIONS as { id: string; displayHex: string }[]) {
        const displayHex = Number.parseInt(color.displayHex.slice(1), 16);
        const keys = (rendering.instructionFaceTones(displayHex) as number[]).some((tone) =>
          assembly.isHighlightPixel((tone >> 16) & 0xff, (tone >> 8) & 0xff, tone & 0xff),
        );
        if (keys) keying.push(color.id);
      }

      return {
        subjects: report,
        colorsKeyingAsHighlight: keying,
        loopColorsKeyingAsHighlight: keying.filter((id) =>
          ["builtin:light-bluish-gray", "builtin:magenta"].includes(id),
        ),
      };
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      catalogUrl: CATALOG_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  )) as ProbeReport;

  for (const subject of result.subjects) {
    await page
      .locator(`canvas.probe-${subject.name}`)
      .screenshot({ path: `${OUT}/${subject.name}.png` });
  }
  writeFileSync(`${OUT}/score.json`, JSON.stringify(result, null, 1));

  for (const subject of result.subjects) {
    // Shaded, not lit: every pixel is the page, one exact per-triangle tone, or
    // ink. Mesh faces can point away from the six box axes, but their declared
    // tones remain finite and flat; no tolerance is needed for a gradient.
    expect.soft(subject.offPaletteShare, `${subject.name} off-palette`).toBe(0);
    expect
      .soft(subject.inkedSilhouetteShare, `${subject.name} inked silhouette`)
      .toBeGreaterThan(0.97);
  }
  // Paint a step in one of these and its own fill keys as its own highlight.
  expect(result.loopColorsKeyingAsHighlight).toEqual([]);
});
