import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const WIDTH = 320;
const HEIGHT = 192;
const ADAPTER_MODULE_URL: string = "/e2e/real-build-step-one-silhouette-renderer.ts";
const REGISTRATION_MODULE_URL: string = "/e2e/real-build-panel-camera-registration.ts";
const BOUNDARY_MODULE_URL: string = "/e2e/real-build-panel-camera-resolver-boundary.ts";
const CONTRACT_MODULE_URL: string = "/e2e/real-build-contract.ts";
const SCREENSHOT = "output/playwright/step-one-scene-reuse.png";

test("reuses one real scene across the exact eight camera hypotheses", async ({ page }) => {
  await page.goto("/");
  mkdirSync("output/playwright", { recursive: true });
  const report = await page.evaluate(
    async (input) => {
      const kernel = await import(/* @vite-ignore */ input.kernelUrl);
      const commands = await import(/* @vite-ignore */ input.commandsUrl);
      const rendering = await import(/* @vite-ignore */ input.renderingUrl);
      const adapter = await import(/* @vite-ignore */ input.adapterUrl);
      const registrationModule = await import(/* @vite-ignore */ input.registrationUrl);
      const boundary = await import(/* @vite-ignore */ input.boundaryUrl);
      const contract = await import(/* @vite-ignore */ input.contractUrl);

      const layout = [
        {
          catalogPartId: "builtin:plate-6x6",
          colorId: "builtin:light-bluish-gray",
          transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
        },
        {
          catalogPartId: "builtin:brick-2x4",
          colorId: "builtin:red",
          transform: { positionLdu: [-20, -8, -20], orientationId: "upright-yaw-0" },
        },
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:white",
          transform: { positionLdu: [50, -8, -50], orientationId: "upright-yaw-0" },
        },
      ];
      let brickDocument = kernel.createEmptyBrickDocument({
        id: "step-one-scene-reuse",
        name: "Scene reuse control",
        maxParts: 16,
      });
      for (const entry of layout) {
        const transaction = commands.createPlacePartTransaction(brickDocument, entry);
        brickDocument = kernel.applyBuildOperations(brickDocument, transaction.operations);
      }

      const framingScene = rendering.deriveBrickScene(brickDocument, { finish: "instruction" });
      let frame: unknown;
      try {
        frame = rendering.instructionViewFrame(framingScene.bounds, input.width, input.height);
      } finally {
        framingScene.dispose();
      }
      const renderer = rendering.createInstructionRenderer({
        width: input.width,
        height: input.height,
      });
      try {
        const counts = {
          preparedDerives: 0,
          preparedDisposals: 0,
          legacyDerives: 0,
          legacyDisposals: 0,
        };
        const instrument = (route: "prepared" | "legacy") => ({
          deriveBrickScene(document_: unknown, options: unknown) {
            counts[route === "prepared" ? "preparedDerives" : "legacyDerives"] += 1;
            const scene = rendering.deriveBrickScene(document_, options);
            let disposed = false;
            return {
              root: scene.root,
              dispose() {
                if (!disposed) {
                  disposed = true;
                  counts[route === "prepared" ? "preparedDisposals" : "legacyDisposals"] += 1;
                }
                scene.dispose();
              },
            };
          },
          setInstructionSilhouetteMode: rendering.setInstructionSilhouetteMode,
          createOrthographicViewCamera: rendering.createOrthographicViewCamera,
        });
        const fittedView = {
          azimuthDegrees: 37,
          elevationDegrees: 29,
          pixelsPerUnit: 30,
        };
        const centrePx: [number, number] = [input.width / 2, input.height / 2];
        const hypotheses = boundary.PANEL_CAMERA_ANGULAR_HYPOTHESES;
        const factory = adapter.createRealBuildStepOneSilhouetteRendererFactory({
          rendering: instrument("prepared"),
          renderer,
          fittedView,
          frame,
          centrePx,
          widthPx: input.width,
          heightPx: input.height,
          registrationPanelStepNumber: 2,
        });
        const prepared = factory({ candidateId: "scene-reuse-control", document: brickDocument });
        const preparedMasks: Uint8Array[] = [];
        try {
          for (const hypothesis of hypotheses) preparedMasks.push(prepared.render(hypothesis));
        } finally {
          prepared.dispose();
        }

        const legacyMasks: Uint8Array[] = hypotheses.map(
          (hypothesis: (typeof hypotheses)[number]) => {
            const registration = registrationModule.createRealBuildPanelCameraRegistration({
              ...hypothesis,
              registrationPanelStepNumber: 2,
              shiftPx: [0, 0],
            });
            const view = registrationModule.viewForRealBuildPanelCameraRegistration(
              fittedView,
              registration,
            );
            const legacyRendering = instrument("legacy");
            const painted = {
              ...brickDocument,
              parts: brickDocument.parts.map((part: unknown) => part),
            };
            const scene = legacyRendering.deriveBrickScene(painted, { finish: "instruction" });
            try {
              legacyRendering.setInstructionSilhouetteMode(scene.root, true);
              const camera = legacyRendering.createOrthographicViewCamera(
                { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
                frame,
              );
              const pixels = new Uint8Array(renderer.render(scene.root, camera));
              return contract.instructionSilhouetteMasks(
                pixels,
                input.width,
                input.height,
                0x923978,
              ).all as Uint8Array;
            } finally {
              scene.dispose();
            }
          },
        );
        const preparedDigests = preparedMasks.map((mask) => `sha256:${kernel.sha256Hex(mask)}`);
        const legacyDigests = legacyMasks.map((mask) => `sha256:${kernel.sha256Hex(mask)}`);
        const areas = preparedMasks.map((mask) => mask.reduce((sum, value) => sum + value, 0));

        const canvas = document.createElement("canvas");
        canvas.className = "scene-reuse-contact-sheet";
        canvas.width = input.width * 4;
        canvas.height = input.height * 2;
        document.body.replaceChildren(canvas);
        const context = canvas.getContext("2d")!;
        for (let index = 0; index < preparedMasks.length; index += 1) {
          const pixels = new Uint8ClampedArray(input.width * input.height * 4);
          for (let pixel = 0; pixel < preparedMasks[index]!.length; pixel += 1) {
            const value = preparedMasks[index]![pixel] === 1 ? 20 : 245;
            pixels[pixel * 4] = value;
            pixels[pixel * 4 + 1] = value;
            pixels[pixel * 4 + 2] = value;
            pixels[pixel * 4 + 3] = 255;
          }
          context.putImageData(
            new ImageData(pixels, input.width, input.height),
            (index % 4) * input.width,
            Math.floor(index / 4) * input.height,
          );
        }
        return { counts, preparedDigests, legacyDigests, areas };
      } finally {
        renderer.dispose();
      }
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      adapterUrl: ADAPTER_MODULE_URL,
      registrationUrl: REGISTRATION_MODULE_URL,
      boundaryUrl: BOUNDARY_MODULE_URL,
      contractUrl: CONTRACT_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );

  await page.locator("canvas.scene-reuse-contact-sheet").screenshot({ path: SCREENSHOT });
  expect(report.counts).toEqual({
    preparedDerives: 1,
    preparedDisposals: 1,
    legacyDerives: 8,
    legacyDisposals: 8,
  });
  expect(report.preparedDigests).toEqual(report.legacyDigests);
  expect(new Set(report.preparedDigests).size).toBe(8);
  expect(report.areas.every((area) => area > 100)).toBe(true);
});
