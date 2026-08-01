import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/build-search";
const WIDTH = 560;
const HEIGHT = 420;

/**
 * The closed loop, end to end, on a booklet we generate so the answer is known.
 *
 * Every part is real: real catalog geometry, the real enumerator, the real
 * instruction renderer, the real highlight extractor, the real score, the real
 * beam. Only the booklet is synthetic — each panel is a render of the reference
 * assembly at that step with the step's new part outlined in the booklet's own
 * highlight yellow, which is exactly what a printed panel is. Swapping in a
 * printed one is then a data problem, not an architecture problem.
 *
 * The grade is `compareBuilds` against the reference, per step, by placement
 * rather than by identifier — the structural hash covers part ids, so it cannot
 * decide whether two models are the same.
 *
 * It rebuilds the model exactly: every part in the right place at the right
 * step, nothing extra, with the drawn placement ranked first at every step on
 * scores of 0.92 to 0.97. The scoreboard keeps the per-step trace — was the
 * drawn placement rendered, what did it score, where did it rank — because a
 * total that says 6 of 6 cannot say which step got lucky.
 */
test("rebuilds a model from its own step pictures", async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = await page.evaluate(
    async ({ kernelUrl, renderingUrl, commandsUrl, assemblyUrl, width, height }) => {
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);
      const assembly = await import(/* @vite-ignore */ assemblyUrl);

      const COLOR = "builtin:light-bluish-gray";
      // A colour no reference part uses, so keying it out of a render gives the
      // candidate's visible silhouette in context, occlusion included.
      const PROBE_COLOR = "builtin:magenta";
      const PROBE_HEX = 0x923978;

      const layout = [
        { part: "builtin:plate-6x6", at: [0, 8, 0] },
        { part: "builtin:brick-2x4", at: [-20, -8, -20] },
        { part: "builtin:brick-2x2", at: [20, -8, 20] },
        { part: "builtin:brick-1x6", at: [-50, -8, 0] },
        { part: "builtin:plate-1x2", at: [-10, -24, -40] },
        { part: "builtin:brick-1x1", at: [50, -8, -50] },
      ];

      // The orientation is part of the placement: dropping it turns a candidate
      // found at a quarter turn into an unsupported one at zero.
      //
      // Returns the placed part's id, never its array index. applyBuildOperations
      // does not keep parts in insertion order, so "the last part" is sometimes
      // the base plate — keying a mask that way highlighted the wrong part on
      // about half of all candidates, which is what made two spellings of one
      // placement score 0.38 and 0.96 when they render identically.
      const place = (document: unknown, part: string, transform: unknown, colorId: string) => {
        const transaction = commands.createPlacePartTransaction(document, {
          catalogPartId: part,
          colorId,
          transform,
        });
        return {
          document: kernel.applyBuildOperations(document, transaction.operations),
          partId: transaction.partId as string,
        };
      };
      const upright = (at: number[]) => ({ positionLdu: at, orientationId: "upright-yaw-0" });

      // The reference build, and the state after each of its steps.
      let reference = kernel.createEmptyBrickDocument({ id: "reference", name: "Reference" });
      const states: { document: unknown; newPartId: string }[] = [];
      for (const entry of layout) {
        const placed = place(reference, entry.part, upright(entry.at), COLOR);
        reference = placed.document;
        states.push({ document: reference, newPartId: placed.partId });
      }

      const renderer = rendering.createInstructionRenderer({ width, height });
      // One camera for every panel, as a booklet uses for a run of steps. It is
      // framed on the finished model, which is what fixes the panel's raster.
      const finalScene = rendering.deriveBrickScene(reference, { finish: "instruction" });
      const frame = rendering.instructionViewFrame(finalScene.bounds, width, height);
      finalScene.dispose();
      const panelView = {
        azimuthDegrees: 41,
        elevationDegrees: 26,
        pixelsPerUnit: 52,
        centerXPx: width / 2,
        centerYPx: height * 0.62,
      };
      const panelCamera = rendering.createOrthographicViewCamera(panelView, frame);

      const renderMask = (document: unknown, highlightPartId: string | null) => {
        const parts = (document as { parts: { id: string }[] }).parts;
        const painted = {
          ...(document as object),
          parts: parts.map((part) =>
            part.id === highlightPartId ? { ...part, colorId: PROBE_COLOR } : part,
          ),
        };
        const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
        // Ink off for a mask render. Booklet outlines are drawn on top of the
        // fill, so keying the fill colour with them on leaves the silhouette
        // riddled with one-pixel holes along every edge and stud — panel one
        // reported eighteen highlight regions instead of one.
        scene.root.traverse((object: { userData: { renderRole?: string }; visible: boolean }) => {
          if (object.userData.renderRole === "instruction-outline") object.visible = false;
        });
        const pixels = renderer.render(scene.root, panelCamera);
        const mask = new Uint8Array(width * height);
        for (let index = 0; index < width * height; index += 1) {
          const key =
            (pixels[index * 4] << 16) | (pixels[index * 4 + 1] << 8) | pixels[index * 4 + 2];
          if (key === PROBE_HEX) mask[index] = 1;
        }
        scene.dispose();
        return mask;
      };

      // Each panel: the assembly at that step, with the step's new part
      // outlined in highlight yellow exactly where its visible silhouette ends.
      const panels: { stepNumber: number; highlight: unknown; pixels: Uint8ClampedArray }[] = [];
      for (let step = 0; step < states.length; step += 1) {
        const { document, newPartId } = states[step]!;
        const scene = rendering.deriveBrickScene(document, { finish: "instruction" });
        const art = renderer.render(scene.root, panelCamera).slice();
        scene.dispose();
        const visible = renderMask(document, newPartId);
        const boundary = rendering.maskBoundary(visible, width, height);
        for (let index = 0; index < width * height; index += 1) {
          if (boundary[index] !== 1) continue;
          art[index * 4] = 0xff;
          art[index * 4 + 1] = 0xcc;
          art[index * 4 + 2] = 0x00;
        }
        panels.push({
          stepNumber: step + 1,
          highlight: assembly.extractHighlightRegions(art, width, height, {
            minimumOutlinePx: 40,
          }),
          pixels: art,
        });
      }

      // The search: it knows the part list and the panels, nothing else.
      const tree = new assembly.BuildTree();
      // Diagnostic: was the drawn placement even offered, and where did it rank?
      const scoreLog: { score: number }[] = [];
      const trace: unknown[] = [];
      const candidateLog: { positionLdu: number[]; orientationId: string }[] = [];
      const deps = {
        enumerate: (document: unknown, catalogPartId: string) =>
          assembly.enumeratePlacements(document, catalogPartId, {
            includeBuildPlate: (document as { parts: unknown[] }).parts.length === 0,
          }).candidates,
        projectBounds: (document: unknown, candidate: { transform: unknown }) => {
          const bounds = assembly.projectPartBounds(candidate, panelCamera, width, height);
          void document;
          return bounds;
        },
        renderCandidateMask: (
          document: unknown,
          candidate: { catalogPartId: string; transform: unknown },
        ) => {
          candidateLog.push(
            candidate.transform as { positionLdu: number[]; orientationId: string },
          );
          const applied = place(
            document,
            candidate.catalogPartId,
            candidate.transform,
            PROBE_COLOR,
          );
          return renderMask(applied.document, applied.partId);
        },
        score: (mask: Uint8Array, highlight: unknown) => {
          const scored = assembly.scoreStepDelta(mask, highlight, { tolerancePx: 3 });
          scoreLog.push(scored);
          return scored;
        },
        apply: (
          entry: { document: unknown; nodeId: string | null },
          candidate: { catalogPartId: string; transform: unknown },
          stepNumber: number,
        ) => {
          const { document } = place(
            entry.document,
            candidate.catalogPartId,
            candidate.transform,
            COLOR,
          );
          const node = tree.append(
            entry.nodeId,
            {
              catalogPartId: candidate.catalogPartId,
              colorId: COLOR,
              transform: candidate.transform,
              stepNumber,
            },
            kernel.documentStructuralHash(document),
          );
          return { document, nodeId: node.node.id };
        },
      };

      const seed = {
        nodeId: null,
        document: kernel.createEmptyBrickDocument({ id: "search", name: "Search" }),
        cumulativeScore: 0,
        stepScores: [],
      };
      const started = performance.now();
      const targets = panels.map((panel, index) => ({
        stepNumber: panel.stepNumber,
        catalogPartId: layout[index]!.part,
        colorId: COLOR,
        highlight: panel.highlight,
      }));
      let beam: {
        document: unknown;
        nodeId: string | null;
        cumulativeScore: number;
        stepScores: number[];
      }[] = [seed];
      const outcomes: {
        stepNumber: number;
        enumerated: number;
        rendered: number;
        prunedByProximity: number;
        duplicateSpellings: number;
        bestScore: number;
        failure: string | null;
      }[] = [];
      let failedAtStep: number | null = null;
      for (const target of targets) {
        candidateLog.length = 0;
        scoreLog.length = 0;
        const outcome = assembly.advanceBeam(beam, target, deps, {
          beamWidth: 3,
          proximityMarginPx: 14,
          maxRendersPerBranch: 20,
        });
        const wanted = layout[target.stepNumber - 1]!.at;
        const offeredIndex = candidateLog.findIndex(
          (transform) =>
            transform.positionLdu[0] === wanted[0] &&
            transform.positionLdu[1] === wanted[1] &&
            transform.positionLdu[2] === wanted[2],
        );
        const ranked = scoreLog
          .map((entry, index) => ({ index, score: entry.score }))
          .sort((left, right) => right.score - left.score);
        trace.push({
          stepNumber: target.stepNumber,
          rendered: outcome.rendered,
          drawnPlacementRendered: offeredIndex >= 0,
          drawnPlacementScore: offeredIndex >= 0 ? scoreLog[offeredIndex]!.score : null,
          drawnPlacementRank:
            offeredIndex >= 0 ? ranked.findIndex((entry) => entry.index === offeredIndex) : null,
          bestScore: ranked[0]?.score ?? null,
          bestTransform: ranked[0] ? candidateLog[ranked[0].index] : null,
          wanted,
        });
        outcomes.push(outcome);
        if (outcome.failure !== null) {
          failedAtStep = target.stepNumber;
          break;
        }
        beam = outcome.beam;
      }
      const search = {
        steps: outcomes,
        beam,
        failedAtStep,
        totalEnumerated: outcomes.reduce((sum, step) => sum + step.enumerated, 0),
        totalRendered: outcomes.reduce((sum, step) => sum + step.rendered, 0),
      };
      const elapsedMs = performance.now() - started;

      const best = search.beam[0];
      const comparison = best ? kernel.compareBuilds(reference, best.document) : null;

      // Paint the last panel and the rebuild beside it, to be looked at.
      const paint = (name: string, pixels: Uint8ClampedArray, left: number) => {
        const canvas = document.createElement("canvas");
        canvas.className = `probe probe-${name}`;
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText = `position:fixed;top:0;left:${left}px;z-index:99999`;
        document.body.append(canvas);
        canvas
          .getContext("2d")!
          .putImageData(
            new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height),
            0,
            0,
          );
      };
      document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());
      paint("panel", panels.at(-1)!.pixels, 0);
      if (best) {
        const scene = rendering.deriveBrickScene(best.document, { finish: "instruction" });
        paint("rebuild", renderer.render(scene.root, panelCamera).slice(), width);
        scene.dispose();
      }
      renderer.dispose();

      return {
        steps: layout.length,
        panelContoursClosed: panels.map(
          (panel) => (panel.highlight as { closedContourRate: number }).closedContourRate,
        ),
        failedAtStep: search.failedAtStep,
        totalEnumerated: search.totalEnumerated,
        totalRendered: search.totalRendered,
        perStep: search.steps.map((step) => ({
          stepNumber: step.stepNumber,
          enumerated: step.enumerated,
          prunedByProximity: step.prunedByProximity,
          duplicateSpellings: step.duplicateSpellings,
          rendered: step.rendered,
          bestScore: Math.round(step.bestScore * 1000) / 1000,
        })),
        elapsedMs: Math.round(elapsedMs),
        trace,
        treeNodes: tree.size,
        comparison: comparison
          ? {
              exactSteps: comparison.steps.filter((step: { exact: boolean }) => step.exact).length,
              firstDivergentStepIndex: comparison.firstDivergentStepIndex,
              finalCorrect: comparison.steps.at(-1)!.cumulative.correct,
              finalExpected: comparison.steps.at(-1)!.cumulative.expectedParts,
              finalExtra: comparison.steps.at(-1)!.cumulative.extra,
            }
          : null,
      };
    },
    {
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );

  await page.locator("canvas.probe-panel").screenshot({ path: `${OUT}/panel.png` });
  await page.locator("canvas.probe-rebuild").screenshot({ path: `${OUT}/rebuild.png` });
  writeFileSync(`${OUT}/score.json`, JSON.stringify(result, null, 1));

  // The loop has to reach the end of the booklet: a step that kills the whole
  // beam is a different failure from a step that picks the wrong placement.
  expect(result.failedAtStep).toBeNull();
  expect(result.comparison).not.toBeNull();
  // Every panel's highlight must enclose a region; the synthetic booklet draws
  // closed contours, so anything less is an extraction regression.
  for (const rate of result.panelContoursClosed) expect(rate).toBe(1);
  // The picture has to be doing the pruning, or the loop is not affordable.
  // Measured: 304 renders against 3172 enumerated placements.
  expect(result.totalRendered).toBeLessThan(result.totalEnumerated / 4);
  // Every part of the reference, in the right place, at the right step, with
  // nothing extra: the loop rebuilt the model from its own pictures.
  expect(result.comparison!.finalCorrect).toBe(result.comparison!.finalExpected);
  expect(result.comparison!.finalExtra).toBe(0);
  expect(result.comparison!.firstDivergentStepIndex).toBeNull();
  // Ranked first at every step, not merely first on aggregate — a beam can
  // reach the right answer while the score is only accidentally right.
  for (const step of result.trace) {
    expect(step).toMatchObject({ drawnPlacementRendered: true, drawnPlacementRank: 0 });
  }
});
