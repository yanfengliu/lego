import { expect, test } from "@playwright/test";

import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

const DEPTH_NARROWING_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-farther-depth-narrowing.ts",
);
const CONTRACT_MODULE_URL = workspaceModuleUrl("apps/web/e2e/real-build-contract.ts");

test("reuses an isolated real-brick probe while preserving whole-scene masks", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(
    async ({ kernelUrl, commandsUrl, renderingUrl, narrowingUrl, contractUrl }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const narrowing = await import(/* @vite-ignore */ narrowingUrl);
      const contract = await import(/* @vite-ignore */ contractUrl);
      const width = 160;
      const height = 120;
      const view = { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1 };
      const frame = {
        widthPx: width,
        heightPx: height,
        target: [0, 0, 0],
        sceneRadius: 60,
      };
      const centrePx = [width / 2, height / 2] as const;
      const place = (document: unknown, input: unknown) => {
        const transaction = commands.createPlacePartTransaction(document, input);
        return {
          document: kernel.applyBuildOperations(document, transaction.operations),
          partId: transaction.partId,
        };
      };
      let base = kernel.createEmptyBrickDocument({ id: "depth-probe", name: "Depth probe" });
      base = place(base, {
        catalogPartId: "builtin:plate-6x6",
        colorId: "builtin:light-bluish-gray",
        transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
      }).document;
      const alternateBase = { ...base, revision: base.revision + 7 };
      const target = {
        catalogPartId: "builtin:brick-2x2",
        colorId: "builtin:magenta",
        transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-0" },
      };
      const first = place(base, target);
      const second = place(alternateBase, target);
      const renderer = rendering.createInstructionRenderer({ width, height });
      const composer = narrowing.createStepDepthNarrowingComposer({
        rendering,
        renderer,
        view,
        frame,
        centrePx,
        widthPx: width,
        heightPx: height,
      });
      let charges = 0;
      const charge = () => {
        charges += 1;
      };
      const wholeSceneMask = (document: unknown, probePartId: string) => {
        const parts = (document as { parts: { id: string }[] }).parts;
        const painted = {
          ...(document as object),
          parts: parts.map((part) =>
            part.id === probePartId ? { ...part, colorId: "builtin:magenta" } : part,
          ),
        };
        const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
        try {
          rendering.setInstructionSilhouetteMode(scene.root, true);
          const camera = rendering.createOrthographicViewCamera(
            { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
            frame,
          );
          return contract.instructionSilhouetteMasks(
            new Uint8Array(renderer.render(scene.root, camera)),
            width,
            height,
            0x923978,
          ).probe as Uint8Array;
        } finally {
          scene.dispose();
        }
      };
      const run = (
        batchBase: unknown,
        placed: { document: unknown; partId: string },
        key: string,
      ) => {
        composer.beginBatch(batchBase, `prefix:${key}`, charge);
        try {
          return composer.probeMask({
            baseDocument: batchBase,
            placedDocument: placed.document,
            probePartId: placed.partId,
            catalogPartId: target.catalogPartId,
            chargeSubjectRender: charge,
            fallbackWholeSceneMask: () => wholeSceneMask(placed.document, placed.partId),
          });
        } finally {
          composer.endBatch();
        }
      };
      const firstMask = run(base, first, "first");
      const secondMask = run(alternateBase, second, "second");
      const firstReference = wholeSceneMask(first.document, first.partId);
      const secondReference = wholeSceneMask(second.document, second.partId);
      const equal = (left: Uint8Array, right: Uint8Array) =>
        left.length === right.length && left.every((value, index) => value === right[index]);
      const statistics = composer.statistics();
      composer.dispose();
      renderer.dispose();
      return {
        distinctGeneratedIds: first.partId !== second.partId,
        firstExact: equal(firstMask, firstReference),
        secondExact: equal(secondMask, secondReference),
        visiblePixels: firstMask.reduce((sum: number, value: number) => sum + value, 0),
        charges,
        statistics,
      };
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      narrowingUrl: DEPTH_NARROWING_MODULE_URL,
      contractUrl: CONTRACT_MODULE_URL,
    },
  );

  expect(report).toMatchObject({
    distinctGeneratedIds: true,
    firstExact: true,
    secondExact: true,
    charges: 3,
    statistics: {
      logicalRows: 2,
      prefixCaptures: 2,
      probeCaptures: 1,
      fallbackCaptures: 0,
      equalDepthFallbacks: 0,
      subjectRenders: 3,
      depthPackPasses: 3,
      cacheHits: 1,
      cacheMisses: 1,
    },
  });
  expect(report.visiblePixels).toBeGreaterThan(0);
});

test("does not reuse one occupancy key for visually different exact probe transforms", async ({
  page,
}) => {
  await page.goto("/");
  const report = await page.evaluate(
    async ({ kernelUrl, commandsUrl, renderingUrl, narrowingUrl, contractUrl, assemblyUrl }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const narrowing = await import(/* @vite-ignore */ narrowingUrl);
      const contract = await import(/* @vite-ignore */ contractUrl);
      const assembly = await import(/* @vite-ignore */ assemblyUrl);
      const width = 160;
      const height = 120;
      const view = { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1 };
      const frame = { widthPx: width, heightPx: height, target: [0, 0, 0], sceneRadius: 60 };
      const centrePx = [width / 2, height / 2] as const;
      const place = (document: unknown, transform: unknown) => {
        const transaction = commands.createPlacePartTransaction(document, {
          catalogPartId: "builtin:curved-slope-1x2",
          colorId: "builtin:magenta",
          transform,
        });
        return {
          document: kernel.applyBuildOperations(document, transaction.operations),
          partId: transaction.partId,
        };
      };
      const base = kernel.createEmptyBrickDocument({
        id: "depth-occupancy-collision",
        name: "Depth occupancy collision",
      });
      const enumerated = assembly.enumeratePlacements(base, "builtin:curved-slope-1x2", {
        orientationIds: ["upright-yaw-0", "upright-yaw-180"],
      });
      const firstByOccupancy = new Map<string, unknown>();
      let yaw0: unknown = null;
      let yaw180: unknown = null;
      for (const candidate of enumerated.candidates) {
        const key = assembly.placementOccupancyKey("builtin:curved-slope-1x2", candidate.transform);
        const prior = firstByOccupancy.get(key) as { readonly orientationId: string } | undefined;
        if (prior !== undefined && prior.orientationId !== candidate.transform.orientationId) {
          yaw0 = prior;
          yaw180 = candidate.transform;
          break;
        }
        firstByOccupancy.set(key, candidate.transform);
      }
      if (yaw0 === null || yaw180 === null) {
        throw new Error(
          "The curved-slope fixture no longer exposes two exact transforms with one occupancy key.",
        );
      }
      const first = place(base, yaw0);
      const second = place(base, yaw180);
      const renderer = rendering.createInstructionRenderer({ width, height });
      const composer = narrowing.createStepDepthNarrowingComposer({
        rendering,
        renderer,
        view,
        frame,
        centrePx,
        widthPx: width,
        heightPx: height,
      });
      let charges = 0;
      const charge = () => {
        charges += 1;
      };
      const wholeSceneMask = (document: unknown) => {
        const scene = rendering.deriveBrickScene(document, { finish: "instruction" });
        try {
          rendering.setInstructionSilhouetteMode(scene.root, true);
          const camera = rendering.createOrthographicViewCamera(
            { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
            frame,
          );
          return contract.instructionSilhouetteMasks(
            new Uint8Array(renderer.render(scene.root, camera)),
            width,
            height,
            0x923978,
          ).probe as Uint8Array;
        } finally {
          scene.dispose();
        }
      };
      const run = (placed: { document: unknown; partId: string }, label: string) => {
        composer.beginBatch(base, `prefix:${label}`, charge);
        try {
          return composer.probeMask({
            baseDocument: base,
            placedDocument: placed.document,
            probePartId: placed.partId,
            catalogPartId: "builtin:curved-slope-1x2",
            chargeSubjectRender: charge,
            fallbackWholeSceneMask: () => wholeSceneMask(placed.document),
          });
        } finally {
          composer.endBatch();
        }
      };
      const firstMask = run(first, "yaw-0");
      const secondMask = run(second, "yaw-180");
      const firstReference = wholeSceneMask(first.document);
      const secondReference = wholeSceneMask(second.document);
      const equal = (left: Uint8Array, right: Uint8Array) =>
        left.length === right.length && left.every((value, index) => value === right[index]);
      const statistics = composer.statistics();
      const occupancyCollision =
        assembly.placementOccupancyKey("builtin:curved-slope-1x2", yaw0) ===
        assembly.placementOccupancyKey("builtin:curved-slope-1x2", yaw180);
      composer.dispose();
      renderer.dispose();
      return {
        occupancyCollision,
        firstExact: equal(firstMask, firstReference),
        secondExact: equal(secondMask, secondReference),
        masksDiffer: !equal(firstMask, secondMask),
        charges,
        statistics,
      };
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      narrowingUrl: DEPTH_NARROWING_MODULE_URL,
      contractUrl: CONTRACT_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
    },
  );

  expect(report).toMatchObject({
    occupancyCollision: true,
    firstExact: true,
    secondExact: true,
    masksDiffer: true,
    charges: 4,
    statistics: {
      logicalRows: 2,
      prefixCaptures: 2,
      probeCaptures: 2,
      fallbackCaptures: 0,
      subjectRenders: 4,
      cacheHits: 0,
      cacheMisses: 2,
    },
  });
});

test("preserves whole-scene probe semantics when the prefix already contains magenta", async ({
  page,
}) => {
  await page.goto("/");
  const report = await page.evaluate(
    async ({ kernelUrl, commandsUrl, renderingUrl, narrowingUrl, contractUrl }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const narrowing = await import(/* @vite-ignore */ narrowingUrl);
      const contract = await import(/* @vite-ignore */ contractUrl);
      const width = 160;
      const height = 120;
      const view = { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1 };
      const frame = { widthPx: width, heightPx: height, target: [0, 0, 0], sceneRadius: 60 };
      const centrePx = [width / 2, height / 2] as const;
      const place = (document: unknown, input: unknown) => {
        const transaction = commands.createPlacePartTransaction(document, input);
        return {
          document: kernel.applyBuildOperations(document, transaction.operations),
          partId: transaction.partId,
        };
      };
      let base = kernel.createEmptyBrickDocument({
        id: "depth-existing-magenta",
        name: "Depth existing magenta",
      });
      base = place(base, {
        catalogPartId: "builtin:plate-6x6",
        colorId: "builtin:magenta",
        transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
      }).document;
      const target = {
        catalogPartId: "builtin:brick-2x2",
        colorId: "builtin:magenta",
        transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-0" },
      };
      const placed = place(base, target);
      const renderer = rendering.createInstructionRenderer({ width, height });
      const camera = rendering.createOrthographicViewCamera(
        { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
        frame,
      );
      const magentaMask = (document: unknown, probePartId: string, isolated: boolean) => {
        const scene = rendering.deriveBrickScene(document, { finish: "instruction" });
        try {
          rendering.setInstructionSilhouetteMode(scene.root, true);
          if (isolated) {
            for (const [partId, object] of scene.partObjects as Map<string, { visible: boolean }>) {
              object.visible = partId === probePartId;
            }
          }
          return contract.instructionSilhouetteMasks(
            new Uint8Array(renderer.render(scene.root, camera)),
            width,
            height,
            0x923978,
          ).probe as Uint8Array;
        } finally {
          scene.dispose();
        }
      };
      const reference = magentaMask(placed.document, placed.partId, false);
      const isolated = magentaMask(placed.document, placed.partId, true);
      const composer = narrowing.createStepDepthNarrowingComposer({
        rendering,
        renderer,
        view,
        frame,
        centrePx,
        widthPx: width,
        heightPx: height,
      });
      let charges = 0;
      composer.beginBatch(base, "prefix:existing-magenta", () => {
        charges += 1;
      });
      let actual: Uint8Array;
      try {
        actual = composer.probeMask({
          baseDocument: base,
          placedDocument: placed.document,
          probePartId: placed.partId,
          catalogPartId: target.catalogPartId,
          chargeSubjectRender: () => {
            charges += 1;
          },
          fallbackWholeSceneMask: () => reference,
        });
      } finally {
        composer.endBatch();
      }
      const equal = (left: Uint8Array, right: Uint8Array) =>
        left.length === right.length && left.every((value, index) => value === right[index]);
      const pixels = (mask: Uint8Array) =>
        mask.reduce((sum: number, value: number) => sum + value, 0);
      const statistics = composer.statistics();
      composer.dispose();
      renderer.dispose();
      return {
        exact: equal(actual, reference),
        referencePixels: pixels(reference),
        isolatedPixels: pixels(isolated),
        charges,
        statistics,
      };
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      narrowingUrl: DEPTH_NARROWING_MODULE_URL,
      contractUrl: CONTRACT_MODULE_URL,
    },
  );

  expect(report).toMatchObject({
    exact: true,
    charges: 1,
    statistics: {
      logicalRows: 1,
      prefixCaptures: 0,
      probeCaptures: 0,
      fallbackCaptures: 1,
      equalDepthFallbacks: 0,
      subjectRenders: 1,
      depthPackPasses: 0,
      cacheHits: 0,
      cacheMisses: 0,
    },
  });
  expect(report.referencePixels).toBeGreaterThan(report.isolatedPixels);
});
