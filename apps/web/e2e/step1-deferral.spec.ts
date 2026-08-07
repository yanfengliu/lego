import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { readSampleBooklet, sampleBookletPageShapes } from "./booklet-fixture";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { deriveTransitionPanelFeatures } from "./real-build-transition-features";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import { sha256Digest } from "./real-build-artifacts";
import { applyBuilderCanonicalCalibration } from "./real-build-builder-calibration";
import { parseOfficialModelIndex } from "./real-build-official";
import {
  ACTION_LEDGER_PATH,
  BUILDER_CALIBRATION_PATH,
  BUILDER_GEOMETRY_PATH,
  OFFICIAL_MODEL_PATH,
} from "./real-build-input-files";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

/**
 * What the next printed panel says about the step before it.
 *
 * Diagnostic, not a gate: it drives the real panel processing, enumerator,
 * renderer, highlight extractor and score over printed steps 1 to 3 outside the
 * sealed run, so the deferral the design argues for can be measured before it
 * is built. It takes no source lock and asserts nothing about the booklet.
 */
const OUT = "output/build-search";
const REQUIRED = process.env.LEGO_DEFERRAL_PROBE === "1";

test("what step 2 says about step 1's candidates", async ({ page }) => {
  test.setTimeout(1_800_000);
  test.skip(!REQUIRED, "set LEGO_DEFERRAL_PROBE=1 to run the deferral probe");
  test.skip(!hasSampleBooklet, "no sample booklet");

  const { bytes: pdfBytes, source } = await readSampleBooklet();
  const pdfDigest = sha256Digest(pdfBytes);
  const { panels, calloutBoxesByStep, panelEvidenceByStep } = await deriveRealBuildPanelEvidence({
    pdfBytes,
    source,
    pdfDigest,
  });
  const lastStep = 3;
  const facePanels = panels.filter(({ stepNumber }) => stepNumber <= lastStep);
  const faceFeatures = deriveTransitionPanelFeatures({
    panels: facePanels,
    calloutBoxesByStep,
    panelEvidenceByStep,
    shapesByPage: await sampleBookletPageShapes(
      pdfBytes,
      facePanels.map(({ pageNumber }) => pageNumber),
    ),
    expectedPrintedSteps: 359,
  });
  const facesByStep = new Map(faceFeatures.map((entry) => [entry.stepNumber, entry.panelFace]));

  const ledger = JSON.parse(readFileSync(ACTION_LEDGER_PATH, "utf8")) as {
    readonly steps: readonly {
      readonly stepNumber: number;
      readonly action: {
        readonly kind: string;
        readonly pieces?: readonly {
          readonly brickRef: string;
          readonly designId: string;
          readonly catalogPartId: string;
          readonly colorId: string;
        }[];
      };
    }[];
  };
  const calibrationBytes = readFileSync(BUILDER_CALIBRATION_PATH);
  const geometryBytes = readFileSync(BUILDER_GEOMETRY_PATH);
  const official = applyBuilderCanonicalCalibration(
    parseOfficialModelIndex(readFileSync(OFFICIAL_MODEL_PATH)),
    calibrationBytes,
    sha256Digest(calibrationBytes),
    geometryBytes,
    sha256Digest(geometryBytes),
  );

  const specs = [1, 2, 3].map((stepNumber) => {
    const panel = panels.find((entry) => entry.stepNumber === stepNumber)!;
    const step = ledger.steps.find((entry) => entry.stepNumber === stepNumber)!;
    return {
      stepNumber,
      pageNumber: panel.pageNumber,
      panelFace: facesByStep.get(stepNumber) ?? null,
      minXPt: panel.bounds.minXPt,
      maxXPt: panel.bounds.maxXPt,
      minYPt: panel.bounds.minYPt,
      maxYPt: panel.bounds.maxYPt,
      calloutBoxes: calloutBoxesByStep[stepNumber] ?? [],
      pieces: (step.action.pieces ?? []).map((piece) => ({
        designId: piece.designId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        truth: official.bricks[piece.brickRef]?.canonicalTransform ?? null,
      })),
    };
  });

  await page.goto("/");
  const result = await page.evaluate(
    async (input) => {
      const pdfjs = await import(/* @vite-ignore */ input.pdfjsUrl);
      const lattice = await import(/* @vite-ignore */ input.latticeUrl);
      const rendering = await import(/* @vite-ignore */ input.renderingUrl);
      const kernel = await import(/* @vite-ignore */ input.kernelUrl);
      const commands = await import(/* @vite-ignore */ input.commandsUrl);
      const assembly = await import(/* @vite-ignore */ input.assemblyUrl);
      pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
      const pdfData = new Uint8Array(await (await fetch(input.pdfUrl)).arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

      const PROBE_HEX = 0x923978;
      const renderScale = 6;
      const panelWidth = 1_000;
      const factor = 2;
      const proximityMarginPx = 14;
      const maxRenders = 24;

      const place = (document_: unknown, part: string, transform: unknown, colorId: string) => {
        const transaction = commands.createPlacePartTransaction(document_, {
          catalogPartId: part,
          colorId,
          transform,
        });
        return {
          document: kernel.applyBuildOperations(document_, transaction.operations),
          partId: transaction.partId as string,
        };
      };
      const centroid = (mask: Uint8Array, width: number, height: number) => {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (mask[y * width + x] !== 1) continue;
            sumX += x;
            sumY += y;
            count += 1;
          }
        }
        return count === 0 ? null : { x: sumX / count, y: sumY / count };
      };
      const shiftedIou = (
        mask: Uint8Array,
        target: Uint8Array,
        width: number,
        height: number,
        dx: number,
        dy: number,
      ) => {
        let intersection = 0;
        let union = 0;
        for (let y = 0; y < height; y += 1) {
          const sourceY = y - dy;
          for (let x = 0; x < width; x += 1) {
            const sourceX = x - dx;
            const here =
              sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height
                ? 0
                : mask[sourceY * width + sourceX]!;
            const there = target[y * width + x]!;
            if (here === 1 && there === 1) intersection += 1;
            if (here === 1 || there === 1) union += 1;
          }
        }
        return union === 0 ? 0 : intersection / union;
      };
      /**
       * How much of the panel's already-built art the model explains.
       *
       * Not IoU, and the difference decides a step: panel N+1 draws the new
       * part over some of what N built, and `alreadyBuiltMask` removes exactly
       * that region, so the printed built art is the model minus a bite. IoU
       * charges the correct model for the missing bite and rewards a wrong one
       * that happens to sit inside what is left.
       */
      const shiftedRecall = (
        mask: Uint8Array,
        target: Uint8Array,
        width: number,
        height: number,
        dx: number,
        dy: number,
      ) => {
        let intersection = 0;
        let targetCount = 0;
        for (let y = 0; y < height; y += 1) {
          const sourceY = y - dy;
          for (let x = 0; x < width; x += 1) {
            const sourceX = x - dx;
            const here =
              sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height
                ? 0
                : mask[sourceY * width + sourceX]!;
            const there = target[y * width + x]!;
            if (there === 1) targetCount += 1;
            if (here === 1 && there === 1) intersection += 1;
          }
        }
        return targetCount === 0 ? 0 : intersection / targetCount;
      };

      // One printed panel, processed exactly as `real-build-run.ts` does it.
      const preparePanel = async (spec: (typeof input.specs)[number]) => {
        const pdfPage = await pdf.getPage(spec.pageNumber);
        const viewport = pdfPage.getViewport({ scale: renderScale });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        const pageContext = pageCanvas.getContext("2d", { willReadFrequently: true })!;
        await pdfPage.render({
          canvas: pageCanvas,
          canvasContext: pageContext,
          viewport,
          background: "#ffffff",
        }).promise;

        const sourceX = spec.minXPt * renderScale;
        const sourceW = (spec.maxXPt - spec.minXPt) * renderScale;
        const sourceY = pageCanvas.height - spec.maxYPt * renderScale;
        const sourceH = (spec.maxYPt - spec.minYPt) * renderScale;
        const ratio = panelWidth / sourceW;
        const fitWidth = Math.max(1, Math.round(panelWidth));
        const fitHeight = Math.max(1, Math.round(sourceH * ratio));
        const crop = document.createElement("canvas");
        crop.width = fitWidth;
        crop.height = fitHeight;
        const cropContext = crop.getContext("2d", { willReadFrequently: true })!;
        cropContext.imageSmoothingEnabled = true;
        cropContext.drawImage(
          pageCanvas,
          sourceX,
          sourceY,
          sourceW,
          sourceH,
          0,
          0,
          fitWidth,
          fitHeight,
        );
        const fitImage = cropContext.getImageData(0, 0, fitWidth, fitHeight);
        const fitRaster = { width: fitWidth, height: fitHeight, pixels: fitImage.data };
        const artMask = assembly.keyPanelArt(fitRaster, {
          backgroundHex: 0x899093,
          toleranceLevels: 10,
        }) as Uint8Array;
        const furniture = assembly.keyPrintedBoxes(fitRaster) as Uint8Array;
        for (let index = 0; index < artMask.length; index += 1) {
          if (furniture[index] === 1) artMask[index] = 0;
        }
        assembly.clearPdfBoxes(
          artMask,
          {
            width: fitWidth,
            height: fitHeight,
            renderScale,
            sourceXPx: sourceX,
            sourceYPx: sourceY,
            ratio,
            pageHeightPx: pageCanvas.height,
          },
          spec.calloutBoxes,
        );
        const isolation = assembly.isolateAssembly({
          width: fitWidth,
          height: fitHeight,
          mask: artMask,
        });
        const field = lattice.buildStudTextureField(fitImage.data, fitWidth, fitHeight, {
          backgroundHex: 0x899093,
          backgroundTolerance: 10,
          highPassRadiusPx: 14,
          includeMask: isolation.mask,
          maxSamples: 18_000,
        });
        const fit = lattice.fitStudLattice(field, {
          minOffsetPx: 8,
          maxOffsetPx: 100,
          maxResidualFraction: 0.02,
        });
        const work = assembly.downsampleRaster(fitRaster, factor) as {
          width: number;
          height: number;
          pixels: Uint8ClampedArray;
        };
        const width = work.width;
        const height = work.height;
        const highlight = assembly.extractHighlightRegions(work.pixels, width, height, {
          minimumOutlinePx: Math.max(10, Math.round(40 / factor)),
        });
        const workIsolation = assembly.downsampleMask(
          { width: fitWidth, height: fitHeight, mask: isolation.mask },
          factor,
        ) as { mask: Uint8Array };
        const built = assembly.alreadyBuiltMask(
          workIsolation.mask,
          highlight.mask,
          highlight.strokeMask,
          width,
          height,
        ) as Uint8Array;
        const arrows = assembly.readDisplacementArrows(
          { width, height, pixels: work.pixels },
          { originMask: highlight.strokeMask },
        );
        const highlightBox = assembly.highlightBounds(highlight) as {
          minXPx: number;
          minYPx: number;
          maxXPx: number;
          maxYPx: number;
        } | null;
        const corrected =
          fit.solution === null || spec.panelFace === null
            ? null
            : (assembly.viewForPanelFace(fit.solution, spec.panelFace) as {
                azimuthDegrees: number;
                elevationDegrees: number;
                pixelsPerUnit: number;
              });
        let family: readonly {
          lduX: number;
          lduY: number;
          lduZ: number;
          travelPx: number;
          offLineStuds: number;
        }[] = [];
        if (
          corrected !== null &&
          arrows.displacementXPx !== null &&
          arrows.displacementYPx !== null &&
          (arrows.arrows as readonly unknown[]).length > 0
        ) {
          // At the raster the arrows were read on: `readDisplacementArrows`
          // above is handed `work.pixels`, and `corrected.pixelsPerUnit` is the
          // fit over the full-resolution crop.
          const projection = assembly.panelProjectionForWorkRaster(corrected, factor);
          const drawn = {
            xPx: arrows.displacementXPx as number,
            yPx: arrows.displacementYPx as number,
          };
          const ceiling = assembly.measureArrowTravelCeiling(arrows.arrows, drawn, {
            width,
            height,
            mask: built,
          }) as { ceilingPx: number };
          family = assembly.arrowTravelFamily(
            projection,
            drawn,
            ceiling.ceilingPx,
          ) as typeof family;
        }
        return {
          spec,
          width,
          height,
          pixels: work.pixels,
          highlight,
          built,
          highlightBox,
          fitSolution: fit.solution,
          fitFailure: fit.failure,
          corrected,
          arrows: {
            kept: (arrows.arrows as unknown[]).length,
            displacementXPx: arrows.displacementXPx,
            displacementYPx: arrows.displacementYPx,
          },
          family,
          view:
            corrected === null
              ? null
              : {
                  azimuthDegrees: corrected.azimuthDegrees,
                  elevationDegrees: corrected.elevationDegrees,
                  pixelsPerUnit: corrected.pixelsPerUnit / factor,
                },
        };
      };

      const prepared: Awaited<ReturnType<typeof preparePanel>>[] = [];
      for (const spec of input.specs) prepared.push(await preparePanel(spec));

      // Every render below goes through this, exactly as the run does: silhouette
      // mode, one flat pass, the probe colour keyed out of the result.
      const renderers = new Map<string, unknown>();
      const silhouette = (
        panel: (typeof prepared)[number],
        subject: unknown,
        highlightPartId: string | null,
        centre: [number, number],
        azimuthOverride?: number,
      ) => {
        const key = `${panel.width}x${panel.height}`;
        if (!renderers.has(key)) {
          renderers.set(
            key,
            rendering.createInstructionRenderer({ width: panel.width, height: panel.height }),
          );
        }
        const renderer = renderers.get(key) as {
          render: (root: unknown, camera: unknown) => Uint8Array;
        };
        const parts = (subject as { parts: { id: string }[] }).parts;
        const painted = {
          ...(subject as object),
          parts: parts.map((part) =>
            part.id === highlightPartId ? { ...part, colorId: "builtin:magenta" } : part,
          ),
        };
        const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
        let pixels: Uint8Array;
        try {
          rendering.setInstructionSilhouetteMode(scene.root, true);
          const camera = rendering.createOrthographicViewCamera(
            {
              azimuthDegrees: azimuthOverride ?? panel.view!.azimuthDegrees,
              elevationDegrees: panel.view!.elevationDegrees,
              pixelsPerUnit: panel.view!.pixelsPerUnit,
              centerXPx: centre[0],
              centerYPx: centre[1],
            },
            {
              widthPx: panel.width,
              heightPx: panel.height,
              target: [0, 0, 0],
              sceneRadius: 60,
            },
          );
          pixels = new Uint8Array(renderer.render(scene.root, camera));
        } finally {
          scene.dispose();
        }
        const all = new Uint8Array(panel.width * panel.height);
        const probe = new Uint8Array(panel.width * panel.height);
        for (let index = 0; index < panel.width * panel.height; index += 1) {
          const red = pixels[index * 4]!;
          const green = pixels[index * 4 + 1]!;
          const blue = pixels[index * 4 + 2]!;
          const isBackground =
            Math.abs(red - 0x89) <= 6 && Math.abs(green - 0x90) <= 6 && Math.abs(blue - 0x93) <= 6;
          if (!isBackground) all[index] = 1;
          if (((red << 16) | (green << 8) | blue) === PROBE_HEX) probe[index] = 1;
        }
        return { all, probe };
      };

      const panel1 = prepared[0]!;
      const panel2 = prepared[1]!;
      const panel3 = prepared[2]!;
      const empty = kernel.createEmptyBrickDocument({ id: "probe", name: "Probe" });

      // Step 1, first piece: what the run actually renders and scores.
      const firstPiece = panel1.spec.pieces[0]!;
      const secondPiece = panel1.spec.pieces[1]!;
      const firstEnumeration = assembly.enumeratePlacements(empty, firstPiece.catalogPartId, {
        includeBuildPlate: true,
      });
      const firstSeen = new Set<string>();
      const firstCandidates: {
        catalogPartId: string;
        transform: { positionLdu: [number, number, number]; orientationId: string };
      }[] = [];
      for (const candidate of firstEnumeration.candidates as typeof firstCandidates) {
        const key = assembly.placementOccupancyKey(
          candidate.catalogPartId,
          candidate.transform,
        ) as string;
        if (firstSeen.has(key)) continue;
        firstSeen.add(key);
        firstCandidates.push(candidate);
      }
      const centre1: [number, number] = [panel1.width / 2, panel1.height / 2];
      const step1Scores = firstCandidates.map((candidate) => {
        const applied = place(empty, candidate.catalogPartId, candidate.transform, "builtin:black");
        const mask = silhouette(panel1, applied.document, applied.partId, centre1).probe;
        const score = assembly.scoreStepDelta(mask, panel1.highlight, { tolerancePx: 3 }) as {
          score: number;
          regionIou: number | null;
          strokeF1: number;
          basis: string;
        };
        return {
          positionLdu: candidate.transform.positionLdu,
          orientationId: candidate.transform.orientationId,
          score: score.score,
          regionIou: score.regionIou,
          basis: score.basis,
        };
      });

      // The four branches carried forward, each completed with the step-1 pair
      // the official model records, rotated into that branch. The branch's own
      // completion is found by rendering: the correct one reproduces branch 0's
      // picture when the camera turns with it.
      let truthRefusal: string | null = null;
      const branchOfTruth = () => {
        try {
          const base = place(
            empty,
            firstPiece.catalogPartId,
            {
              positionLdu: firstPiece.truth!.positionLdu,
              orientationId: firstPiece.truth!.orientationId,
            },
            "builtin:black",
          );
          const full = place(
            base.document,
            secondPiece.catalogPartId,
            {
              positionLdu: secondPiece.truth!.positionLdu,
              orientationId: secondPiece.truth!.orientationId,
            },
            "builtin:black",
          );
          return full.document;
        } catch (error) {
          truthRefusal = error instanceof Error ? error.message : String(error);
          return null;
        }
      };
      const truthDocument = branchOfTruth();
      const truthMask =
        truthDocument === null
          ? new Uint8Array(panel1.width * panel1.height)
          : silhouette(panel1, truthDocument, null, centre1).all;

      // A quarter turn of the whole model about the Y axis through the origin,
      // which is where the first piece sits. The four step-1 candidates are that
      // rotation's orbit, so every later truth has an image on every branch.
      const yawOf = (orientationId: string) => Number(/-yaw-(\d+)$/u.exec(orientationId)![1]);
      const rotate = (
        transform: { positionLdu: readonly number[]; orientationId: string },
        quarterTurns: number,
      ) => {
        let position = [...transform.positionLdu];
        for (let turn = 0; turn < ((quarterTurns % 4) + 4) % 4; turn += 1) {
          position = [position[2]!, position[1]!, -position[0]!];
        }
        const yaw = (yawOf(transform.orientationId) + quarterTurns * 90 + 360) % 360;
        return {
          positionLdu: position as [number, number, number],
          orientationId: `upright-yaw-${yaw}`,
        };
      };

      const branches: {
        index: number;
        quarterTurns: number;
        firstTransform: unknown;
        secondTransform: unknown;
        secondEnumerated: number;
        secondTruthEnumerated: boolean;
        gaugeIou: number;
        connections: number;
        document: unknown;
      }[] = [];
      for (const [index, candidate] of firstCandidates.entries()) {
        const quarterTurns = yawOf(candidate.transform.orientationId) / 90;
        const base = place(empty, candidate.catalogPartId, candidate.transform, "builtin:black");
        const enumeration = assembly.enumeratePlacements(
          base.document,
          secondPiece.catalogPartId,
          {},
        );
        const seen = new Set<string>();
        const distinct: {
          catalogPartId: string;
          transform: { positionLdu: [number, number, number]; orientationId: string };
          connections: readonly unknown[];
        }[] = [];
        for (const entry of enumeration.candidates as typeof distinct) {
          const key = assembly.placementOccupancyKey(
            entry.catalogPartId,
            entry.transform,
          ) as string;
          if (seen.has(key)) continue;
          seen.add(key);
          distinct.push(entry);
        }
        const wanted = rotate(secondPiece.truth!, quarterTurns);
        const found = distinct.find(
          (entry) =>
            entry.transform.orientationId === wanted.orientationId &&
            entry.transform.positionLdu.every((value, axis) => value === wanted.positionLdu[axis]),
        );
        const completed = place(base.document, secondPiece.catalogPartId, wanted, "builtin:black");
        // The gauge claim, checked rather than asserted: turn the camera by the
        // same quarter turn and the branch must reproduce branch 0's picture.
        const rotatedMask = silhouette(
          panel1,
          completed.document,
          null,
          centre1,
          panel1.view!.azimuthDegrees + quarterTurns * 90,
        ).all;
        branches.push({
          index,
          quarterTurns,
          firstTransform: candidate.transform,
          secondTransform: wanted,
          secondEnumerated: distinct.length,
          secondTruthEnumerated: found !== undefined,
          gaugeIou: shiftedIou(rotatedMask, truthMask, panel1.width, panel1.height, 0, 0),
          connections: found?.connections.length ?? -1,
          document: completed.document,
        });
      }

      // Advance each branch to a later panel and score it there.
      const advance = (
        panel: (typeof prepared)[number],
        branchDocument: unknown,
        quarterTurns: number,
      ) => {
        const piece = panel.spec.pieces[0]!;
        const wanted = rotate(piece.truth!, quarterTurns);
        // Register the camera on what the panel already shows as built.
        const trial = silhouette(panel, branchDocument, null, [
          panel.width / 2,
          panel.height / 2,
        ]).all;
        const from = centroid(trial, panel.width, panel.height);
        const to = centroid(panel.built, panel.width, panel.height);
        if (from === null || to === null) return null;
        let bestShift = {
          dx: Math.round(to.x - from.x),
          dy: Math.round(to.y - from.y),
          iou: 0,
        };
        bestShift.iou = shiftedIou(
          trial,
          panel.built,
          panel.width,
          panel.height,
          bestShift.dx,
          bestShift.dy,
        );
        for (const step of [8, 3, 1]) {
          for (let dy = -4; dy <= 4; dy += 1) {
            for (let dx = -4; dx <= 4; dx += 1) {
              const candidate = { dx: bestShift.dx + dx * step, dy: bestShift.dy + dy * step };
              const iou = shiftedIou(
                trial,
                panel.built,
                panel.width,
                panel.height,
                candidate.dx,
                candidate.dy,
              );
              if (iou > bestShift.iou) bestShift = { ...candidate, iou };
            }
          }
        }
        // The same search under the asymmetric objective, so the two can be
        // compared on one panel rather than argued about.
        let bestRecall = {
          dx: Math.round(to.x - from.x),
          dy: Math.round(to.y - from.y),
          value: 0,
        };
        bestRecall.value = shiftedRecall(
          trial,
          panel.built,
          panel.width,
          panel.height,
          bestRecall.dx,
          bestRecall.dy,
        );
        for (const step of [8, 3, 1]) {
          for (let dy = -4; dy <= 4; dy += 1) {
            for (let dx = -4; dx <= 4; dx += 1) {
              const candidate = { dx: bestRecall.dx + dx * step, dy: bestRecall.dy + dy * step };
              const value = shiftedRecall(
                trial,
                panel.built,
                panel.width,
                panel.height,
                candidate.dx,
                candidate.dy,
              );
              if (value > bestRecall.value) bestRecall = { ...candidate, value };
            }
          }
        }
        // The same comparison restricted to where the panel still shows built
        // art: the highlight's own region is where N+1 drew the new part over
        // what N built, so neither side is defined there. Outside it, IoU is
        // honest again.
        const highlightMask = panel.highlight.mask as Uint8Array;
        const strokeMask = panel.highlight.strokeMask as Uint8Array;
        const excluded = new Uint8Array(panel.width * panel.height);
        for (let index = 0; index < excluded.length; index += 1) {
          excluded[index] = highlightMask[index] === 1 || strokeMask[index] === 1 ? 1 : 0;
        }
        // Panel space, not model space: the exclusion is a fact about where the
        // page stopped showing built art, so it is applied after the shift.
        const definedIouAt = (dx: number, dy: number) => {
          let intersection = 0;
          let union = 0;
          for (let y = 0; y < panel.height; y += 1) {
            const sourceY = y - dy;
            for (let x = 0; x < panel.width; x += 1) {
              const index = y * panel.width + x;
              if (excluded[index] === 1) continue;
              const sourceX = x - dx;
              const here =
                sourceX < 0 || sourceX >= panel.width || sourceY < 0 || sourceY >= panel.height
                  ? 0
                  : trial[sourceY * panel.width + sourceX]!;
              const there = panel.built[index]!;
              if (here === 1 && there === 1) intersection += 1;
              if (here === 1 || there === 1) union += 1;
            }
          }
          return union === 0 ? 0 : intersection / union;
        };
        let bestDefined = {
          dx: Math.round(to.x - from.x),
          dy: Math.round(to.y - from.y),
          value: 0,
        };
        bestDefined.value = definedIouAt(bestDefined.dx, bestDefined.dy);
        for (const step of [8, 3, 1]) {
          for (let dy = -4; dy <= 4; dy += 1) {
            for (let dx = -4; dx <= 4; dx += 1) {
              const candidate = { dx: bestDefined.dx + dx * step, dy: bestDefined.dy + dy * step };
              const value = definedIouAt(candidate.dx, candidate.dy);
              if (value > bestDefined.value) bestDefined = { ...candidate, value };
            }
          }
        }
        const recallAtIouShift = shiftedRecall(
          trial,
          panel.built,
          panel.width,
          panel.height,
          bestShift.dx,
          bestShift.dy,
        );
        const centre: [number, number] = [
          panel.width / 2 + bestShift.dx,
          panel.height / 2 + bestShift.dy,
        ];
        const enumeration = assembly.enumeratePlacements(branchDocument, piece.catalogPartId, {});
        const probeCamera = rendering.createOrthographicViewCamera(
          {
            azimuthDegrees: panel.view!.azimuthDegrees,
            elevationDegrees: panel.view!.elevationDegrees,
            pixelsPerUnit: panel.view!.pixelsPerUnit,
            centerXPx: centre[0],
            centerYPx: centre[1],
          },
          { widthPx: panel.width, heightPx: panel.height, target: [0, 0, 0], sceneRadius: 60 },
        );
        const seen = new Set<string>();
        const near: {
          catalogPartId: string;
          transform: { positionLdu: [number, number, number]; orientationId: string };
        }[] = [];
        let distinct = 0;
        for (const entry of enumeration.candidates as typeof near) {
          const key = assembly.placementOccupancyKey(
            entry.catalogPartId,
            entry.transform,
          ) as string;
          if (seen.has(key)) continue;
          seen.add(key);
          distinct += 1;
          if (panel.highlightBox === null) {
            near.push(entry);
            continue;
          }
          const box = assembly.projectPartBounds(entry, probeCamera, panel.width, panel.height) as {
            minXPx: number;
            minYPx: number;
            maxXPx: number;
            maxYPx: number;
          } | null;
          if (box === null) continue;
          const overlaps =
            box.minXPx - proximityMarginPx <= panel.highlightBox.maxXPx &&
            panel.highlightBox.minXPx - proximityMarginPx <= box.maxXPx &&
            box.minYPx - proximityMarginPx <= panel.highlightBox.maxYPx &&
            panel.highlightBox.minYPx - proximityMarginPx <= box.maxYPx;
          if (overlaps) near.push(entry);
        }
        // Every proximity-surviving candidate is rendered, not the run's first
        // 24: a truncated set cannot say whether the drawn placement would have
        // won, and that is the question.
        const scored = near.map((entry) => {
          const applied = place(
            branchDocument,
            entry.catalogPartId,
            entry.transform,
            "builtin:black",
          );
          const mask = silhouette(panel, applied.document, applied.partId, centre).probe;
          const score = assembly.scoreStepDelta(mask, panel.highlight, { tolerancePx: 3 }) as {
            score: number;
            regionIou: number | null;
            strokeF1: number;
          };
          return { entry, score: score.score, regionIou: score.regionIou, applied };
        });
        scored.sort((left, right) => right.score - left.score);
        const isWanted = (entry: (typeof near)[number]) =>
          entry.transform.orientationId === wanted.orientationId &&
          entry.transform.positionLdu.every((value, axis) => value === wanted.positionLdu[axis]);
        const truthRank = scored.findIndex((entry) => isWanted(entry.entry));
        // The editor is the arbiter of whether the drawn placement is legal at
        // all. If it accepts what the enumerator never offered, the gap is in
        // the enumeration rather than in the target.
        let truthDocument: unknown = null;
        let truthRefusal: string | null = null;
        let truthConnections = -1;
        try {
          const applied = place(branchDocument, piece.catalogPartId, wanted, "builtin:black");
          truthDocument = applied.document;
          truthConnections =
            (applied.document as { connections: unknown[] }).connections.length -
            (branchDocument as { connections: unknown[] }).connections.length;
        } catch (error) {
          truthRefusal = error instanceof Error ? error.message : String(error);
        }
        const levels: Record<string, number> = {};
        for (const entry of near) {
          const key = String(entry.transform.positionLdu[1]);
          levels[key] = (levels[key] ?? 0) + 1;
        }
        return {
          anchorIou: bestShift.iou,
          anchorRecall: recallAtIouShift,
          definedIou: bestDefined.value,
          definedShift: [bestDefined.dx, bestDefined.dy] as [number, number],
          bestRecall: bestRecall.value,
          bestRecallShift: [bestRecall.dx, bestRecall.dy] as [number, number],
          builtPx: panel.built.reduce((total: number, value: number) => total + value, 0),
          modelPx: trial.reduce((total: number, value: number) => total + value, 0),
          anchorShift: [bestShift.dx, bestShift.dy] as [number, number],
          enumerated: enumeration.candidates.length,
          distinct,
          afterProximity: near.length,
          rendered: scored.length,
          overBudget: near.length > maxRenders,
          bestScore: scored[0]?.score ?? null,
          runnerUpScore: scored[1]?.score ?? null,
          bestTransform: scored[0]?.entry.transform ?? null,
          truthTransform: wanted,
          truthEnumerated: [...seen].some(
            (key) =>
              key === (assembly.placementOccupancyKey(piece.catalogPartId, wanted) as string),
          ),
          truthNear: near.some(isWanted),
          truthRank,
          truthScore: truthRank >= 0 ? scored[truthRank]!.score : null,
          truthRefusal,
          truthConnections,
          candidateYLevels: levels,
          truthY: wanted.positionLdu[1],
          truthDocument,
          registration: { centre, mask: silhouette(panel, branchDocument, null, centre).all },
          topScores: scored.slice(0, 5).map((entry) => ({
            positionLdu: entry.entry.transform.positionLdu,
            orientationId: entry.entry.transform.orientationId,
            score: entry.score,
          })),
        };
      };

      const atStep2 = branches.map((branch) =>
        advance(panel2, branch.document, branch.quarterTurns),
      );
      const atStep3 = branches.map((branch, index) => {
        const second = atStep2[index];
        if (second === null || second === undefined || second.truthDocument === null) return null;
        return advance(panel3, second.truthDocument, branch.quarterTurns);
      });

      // Painted so the numbers can be looked at: the printed panel, what the
      // run treats as already built, and each branch's prefix registered onto
      // it. A registration IoU is a claim about two pictures.
      const images: { name: string; dataUrl: string }[] = [];
      const paint = (
        name: string,
        draw: (pixels: Uint8ClampedArray) => void,
        panel: {
          width: number;
          height: number;
        },
      ) => {
        const canvas = document.createElement("canvas");
        canvas.width = panel.width;
        canvas.height = panel.height;
        const pixels = new Uint8ClampedArray(panel.width * panel.height * 4);
        pixels.fill(255);
        draw(pixels);
        canvas
          .getContext("2d")!
          .putImageData(
            new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, panel.width, panel.height),
            0,
            0,
          );
        images.push({ name, dataUrl: canvas.toDataURL("image/png") });
      };
      const overlay =
        (panel: (typeof prepared)[number], branchMask: Uint8Array, shift: [number, number]) =>
        (pixels: Uint8ClampedArray) => {
          for (let y = 0; y < panel.height; y += 1) {
            for (let x = 0; x < panel.width; x += 1) {
              const index = y * panel.width + x;
              const sourceX = x - shift[0];
              const sourceY = y - shift[1];
              const rendered =
                sourceX < 0 || sourceX >= panel.width || sourceY < 0 || sourceY >= panel.height
                  ? 0
                  : branchMask[sourceY * panel.width + sourceX]!;
              const built = panel.built[index]!;
              pixels[index * 4] = built === 1 ? 40 : 255;
              pixels[index * 4 + 1] = rendered === 1 ? 40 : 255;
              pixels[index * 4 + 2] = 255;
            }
          }
        };
      for (const [index, entry] of atStep2.entries()) {
        if (entry === null) continue;
        // The stored mask was already rendered at the anchored centre, so the
        // overlay applies no further shift.
        paint(`step2-branch${index}`, overlay(panel2, entry.registration.mask, [0, 0]), panel2);
      }
      for (const [index, entry] of atStep3.entries()) {
        if (entry === null) continue;
        paint(`step3-branch${index}`, overlay(panel3, entry.registration.mask, [0, 0]), panel3);
      }
      for (const panel of [panel1, panel2, panel3]) {
        paint(
          `step${panel.spec.stepNumber}-panel`,
          (pixels) => {
            const source = panel.pixels;
            for (let index = 0; index < panel.width * panel.height; index += 1) {
              pixels[index * 4] = source[index * 4]!;
              pixels[index * 4 + 1] = source[index * 4 + 1]!;
              pixels[index * 4 + 2] = source[index * 4 + 2]!;
            }
          },
          panel,
        );
        paint(
          `step${panel.spec.stepNumber}-built`,
          (pixels) => {
            for (let index = 0; index < panel.width * panel.height; index += 1) {
              const value = panel.built[index] === 1 ? 40 : 255;
              pixels[index * 4] = value;
              pixels[index * 4 + 1] = value;
              pixels[index * 4 + 2] = 255;
            }
          },
          panel,
        );
      }

      for (const renderer of renderers.values()) {
        (renderer as { dispose: () => void }).dispose();
      }

      const strip = (entry: ReturnType<typeof advance>) =>
        entry === null
          ? null
          : {
              anchorIou: entry.anchorIou,
              anchorRecall: entry.anchorRecall,
              definedIou: entry.definedIou,
              definedShift: entry.definedShift,
              bestRecall: entry.bestRecall,
              bestRecallShift: entry.bestRecallShift,
              builtPx: entry.builtPx,
              modelPx: entry.modelPx,
              anchorShift: entry.anchorShift,
              enumerated: entry.enumerated,
              distinct: entry.distinct,
              afterProximity: entry.afterProximity,
              rendered: entry.rendered,
              overBudget: entry.overBudget,
              bestScore: entry.bestScore,
              runnerUpScore: entry.runnerUpScore,
              bestTransform: entry.bestTransform,
              truthTransform: entry.truthTransform,
              truthEnumerated: entry.truthEnumerated,
              truthNear: entry.truthNear,
              truthRank: entry.truthRank,
              truthScore: entry.truthScore,
              truthRefusal: entry.truthRefusal,
              truthConnections: entry.truthConnections,
              truthY: entry.truthY,
              candidateYLevels: entry.candidateYLevels,
              topScores: entry.topScores,
            };

      return {
        panels: prepared.map((panel) => ({
          stepNumber: panel.spec.stepNumber,
          panelFace: panel.spec.panelFace,
          width: panel.width,
          height: panel.height,
          regions: panel.highlight.regions.length,
          closedContourRate: panel.highlight.closedContourRate,
          strokePx: (panel.highlight.strokeMask as Uint8Array).reduce(
            (total: number, value: number) => total + value,
            0,
          ),
          highlightAreaPx: (panel.highlight.mask as Uint8Array).reduce(
            (total: number, value: number) => total + value,
            0,
          ),
          builtPx: panel.built.reduce((total: number, value: number) => total + value, 0),
          highlightBox: panel.highlightBox,
          fitSolution: panel.fitSolution,
          fitFailure: panel.fitFailure,
          view: panel.view,
          arrows: panel.arrows,
          family: panel.family,
          pieces: panel.spec.pieces,
        })),
        firstEnumeration: {
          enumerated: firstEnumeration.candidates.length,
          distinct: firstCandidates.length,
        },
        truthRefusal,
        truthPx: truthMask.reduce((total: number, value: number) => total + value, 0),
        step1Scores,
        branches: branches.map((branch) => ({
          index: branch.index,
          firstTransform: branch.firstTransform,
          secondTransform: branch.secondTransform,
          secondEnumerated: branch.secondEnumerated,
          gaugeIou: branch.gaugeIou,
          connections: branch.connections,
        })),
        atStep2: atStep2.map(strip),
        atStep3: atStep3.map(strip),
        images,
      };
    },
    {
      ...bookletProbeUrls(),
      latticeUrl: workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts"),
      renderingUrl: RENDERING_MODULE_URL,
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      assemblyUrl: ASSEMBLY_MODULE_URL,
      specs,
    },
  );

  mkdirSync(OUT, { recursive: true });
  for (const image of result.images) {
    writeFileSync(
      `${OUT}/step1-deferral-${image.name}.png`,
      Buffer.from(image.dataUrl.slice("data:image/png;base64,".length), "base64"),
    );
  }
  const report = { ...result, images: result.images.map(({ name }) => name) };
  writeFileSync(`${OUT}/step1-deferral.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  expect(result.panels.length).toBe(3);
});
