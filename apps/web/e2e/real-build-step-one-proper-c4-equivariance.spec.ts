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
const BOUNDARY_MODULE_URL: string = "/e2e/real-build-panel-camera-resolver-boundary.ts";
const EQUIVARIANCE_MODULE_URL: string = "/e2e/real-build-step-one-proper-c4-camera-equivariance.ts";
const REDUCTION_MODULE_URL: string = "/e2e/real-build-step-one-proper-c4-render-reduction.ts";
const SCREENSHOT = "output/playwright/step-one-proper-c4-equivariance.png";

test("proper-C4 rotation is exactly equivariant across the real D4 renderer", async ({ page }) => {
  await page.goto("/");
  mkdirSync("output/playwright", { recursive: true });
  const report = await page.evaluate(
    async (input) => {
      const kernel = await import(/* @vite-ignore */ input.kernelUrl);
      const commands = await import(/* @vite-ignore */ input.commandsUrl);
      const rendering = await import(/* @vite-ignore */ input.renderingUrl);
      const adapter = await import(/* @vite-ignore */ input.adapterUrl);
      const boundary = await import(/* @vite-ignore */ input.boundaryUrl);
      const equivariance = await import(/* @vite-ignore */ input.equivarianceUrl);
      const reduction = await import(/* @vite-ignore */ input.reductionUrl);
      const turns = [0, 90, 180, 270] as const;
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
      ] as const;
      const rotatePosition = (
        position: readonly [number, number, number],
        turn: (typeof turns)[number],
      ) => {
        const [x, y, z] = position;
        return turn === 0
          ? [x, y, z]
          : turn === 90
            ? [z, y, -x]
            : turn === 180
              ? [-x, y, -z]
              : [-z, y, x];
      };
      const documents = turns.map((turn) => {
        let document_ = kernel.createEmptyBrickDocument({
          id: `proper-c4-q${turn}`,
          name: `Proper C4 q${turn}`,
          maxParts: 16,
        });
        for (const entry of layout) {
          const transaction = commands.createPlacePartTransaction(document_, {
            ...entry,
            transform: {
              positionLdu: rotatePosition(entry.transform.positionLdu, turn),
              orientationId: `upright-yaw-${turn}`,
            },
          });
          document_ = kernel.applyBuildOperations(document_, transaction.operations);
        }
        return document_;
      });
      const renderer = rendering.createInstructionRenderer({
        width: input.width,
        height: input.height,
      });
      try {
        const counts = { derives: 0, disposals: 0, renders: 0 };
        const instrument = {
          deriveBrickScene(document_: unknown, options: unknown) {
            counts.derives += 1;
            const scene = rendering.deriveBrickScene(document_, options);
            let disposed = false;
            return {
              root: scene.root,
              dispose() {
                if (!disposed) {
                  disposed = true;
                  counts.disposals += 1;
                }
                scene.dispose();
              },
            };
          },
          setInstructionSilhouetteMode: rendering.setInstructionSilhouetteMode,
          createOrthographicViewCamera: rendering.createOrthographicViewCamera,
        };
        const fittedView = { azimuthDegrees: 37, elevationDegrees: 29, pixelsPerUnit: 30 };
        const frame = {
          widthPx: input.width,
          heightPx: input.height,
          target: [0, 0, 0] as const,
          sceneRadius: 60,
        };
        const hypotheses = boundary.PANEL_CAMERA_ANGULAR_HYPOTHESES;
        const factory = adapter.createRealBuildStepOneSilhouetteRendererFactory({
          rendering: instrument,
          renderer,
          fittedView,
          frame,
          centrePx: [input.width / 2, input.height / 2],
          widthPx: input.width,
          heightPx: input.height,
          registrationPanelStepNumber: 2,
        });
        const masks: Uint8Array[][] = [];
        for (const [index, document_] of documents.entries()) {
          const prepared = factory({
            candidateId: `proper-c4-q${turns[index]!}`,
            document: document_,
          });
          const memberMasks: Uint8Array[] = [];
          try {
            for (const hypothesis of hypotheses) {
              counts.renders += 1;
              memberMasks.push(prepared.render(hypothesis));
            }
          } finally {
            prepared.dispose();
          }
          masks.push(memberMasks);
        }
        const key = (hypothesis: (typeof hypotheses)[number]) =>
          `${hypothesis.latticeHand}/${hypothesis.latticeDeterminant}/${hypothesis.turnDegrees}`;
        const digests = masks.map((memberMasks) =>
          memberMasks.map((mask) => `sha256:${kernel.sha256Hex(mask)}`),
        );
        const areas = masks.map((memberMasks) =>
          memberMasks.map((mask) => mask.reduce((sum, value) => sum + value, 0)),
        );
        let exactParity = true;
        for (let memberIndex = 0; memberIndex < turns.length; memberIndex += 1) {
          for (let hypothesisIndex = 0; hypothesisIndex < hypotheses.length; hypothesisIndex += 1) {
            const representative =
              equivariance.mapRealBuildStepOneProperC4MemberCameraToRepresentative(
                hypotheses[hypothesisIndex]!,
                turns[memberIndex]!,
              );
            const representativeIndex = hypotheses.findIndex(
              (candidate: (typeof hypotheses)[number]) => key(candidate) === key(representative),
            );
            exactParity &&=
              representativeIndex >= 0 &&
              digests[memberIndex]![hypothesisIndex] === digests[0]![representativeIndex];
          }
        }
        const canvas = document.createElement("canvas");
        canvas.className = "proper-c4-equivariance-contact-sheet";
        canvas.width = input.width * turns.length;
        canvas.height = input.height * hypotheses.length;
        document.body.replaceChildren(canvas);
        const context = canvas.getContext("2d")!;
        for (
          let representativeIndex = 0;
          representativeIndex < hypotheses.length;
          representativeIndex += 1
        ) {
          for (let memberIndex = 0; memberIndex < turns.length; memberIndex += 1) {
            const member = equivariance.mapRealBuildStepOneProperC4RepresentativeCameraToMember(
              hypotheses[representativeIndex]!,
              turns[memberIndex]!,
            );
            const memberHypothesisIndex = hypotheses.findIndex(
              (candidate: (typeof hypotheses)[number]) => key(candidate) === key(member),
            );
            const mask = masks[memberIndex]![memberHypothesisIndex]!;
            const pixels = new Uint8ClampedArray(input.width * input.height * 4);
            for (let pixel = 0; pixel < mask.length; pixel += 1) {
              const value = mask[pixel] === 1 ? 20 : 245;
              pixels[pixel * 4] = value;
              pixels[pixel * 4 + 1] = value;
              pixels[pixel * 4 + 2] = value;
              pixels[pixel * 4 + 3] = 255;
            }
            context.putImageData(
              new ImageData(pixels, input.width, input.height),
              memberIndex * input.width,
              representativeIndex * input.height,
            );
          }
        }
        return {
          counts,
          digests,
          areas,
          exactParity,
          frame,
          reductionBrowserLoaded:
            typeof reduction.runRealBuildStepOneProperC4RenderReduction === "function",
        };
      } finally {
        renderer.dispose();
      }
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      adapterUrl: ADAPTER_MODULE_URL,
      boundaryUrl: BOUNDARY_MODULE_URL,
      equivarianceUrl: EQUIVARIANCE_MODULE_URL,
      reductionUrl: REDUCTION_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );
  await page.locator("canvas.proper-c4-equivariance-contact-sheet").screenshot({
    path: SCREENSHOT,
  });
  expect(report.frame).toMatchObject({ target: [0, 0, 0], sceneRadius: 60 });
  expect(report.counts).toEqual({ derives: 4, disposals: 4, renders: 32 });
  expect(report.exactParity).toBe(true);
  expect(report.reductionBrowserLoaded).toBe(true);
  expect(new Set(report.digests[0]).size).toBe(8);
  expect(report.areas.flat().every((area) => area > 100)).toBe(true);
});
