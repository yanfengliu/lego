import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { readSampleBooklet, sampleBookletCallouts, sampleBookletPanels } from "./booklet-fixture";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import {
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

/**
 * Fitting the camera a real printed panel was drawn with, and measuring it.
 *
 * `camera-fit.spec.ts` recovers a camera by rendering geometry we already have.
 * That works from step N of a build we are already following, and it cannot
 * start one: at step 1 nothing is known, and the parts this booklet opens with
 * are a round corner plate and an arch, neither of which the catalog has.
 *
 * So the calibration target is the picture's own stud grid. Every stud in a
 * panel sits on the same 20 LDU square, and its projection fixes azimuth,
 * elevation and pixels per stud with no part identities at all. What it cannot
 * fix is where the model sits — a grid is the same grid one pitch over — and
 * this probe reports that limit rather than papering over it.
 *
 * Nothing here is asserted that was not first measured and looked at. The
 * overlays are the point: `output/camera-fit/overlay-NNN.png` draws the fitted
 * grid over the printed art, so a human can see the marks land on the studs.
 */
const OUT = "output/camera-fit";
const LAST_STEP = 40;
/**
 * Page render scale and panel crop width. Every panel is normalised to the same
 * crop width whatever cell of the page it owns, so the page is rasterised well
 * above that and the crop is always a downsample — which is also what keeps the
 * stud edges smooth. Halving the scale to 3 was tried and it is measurably
 * worse: 8 camera runs found instead of 4, because a coarser raster lets more
 * panels lock onto a repeat that is not the grid and still pass the gate.
 */
const RENDER_SCALE = 6;
const PANEL_WIDTH = 1000;

const LATTICE_MODULE_URL = workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts");
const LATTICE_PHASE_MODULE_URL = workspaceModuleUrl(
  "packages/rendering/src/camera-fit-lattice-phase.ts",
);

interface PanelFitReport {
  stepNumber: number;
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  artPx: number;
  pxPerPoint: number;
  failure: string | null;
  fit: {
    azimuthDegrees: number;
    elevationDegrees: number;
    pixelsPerUnit: number;
    /** The same scale in the booklet's own unit, so panels can be compared. */
    pointsPerStud: number;
    residualPx: number;
    coherence: number;
    aXPx: number;
    aYPx: number;
    bXPx: number;
    bYPx: number;
  } | null;
  /**
   * Spread of the grid's phase across the panel. An upper bound on how far one
   * camera fails to explain it, not a reprojection error: a window holding two
   * plate heights reports a phase between them and that leaks into the total.
   */
  drift: {
    horizontalRmsPx: number;
    horizontalMaxPx: number;
    verticalRmsPx: number;
    verticalMaxPx: number;
    globalCoherence: number;
    windows: number;
    failure: string | null;
  } | null;
  /** Independent check: a correct cell folds to a disc whose rim is at 0.3 of a pitch. */
  studShape: { ringRadiusCells: number; radialContrast: number; contrast: number } | null;
  /**
   * Predicted stud against the ink under it. `rmsPx` alone means nothing — the
   * aperture bounds it, and pure noise scores 0.5px at a hit rate of 1 — and
   * `inkShare` barely clears its own floor because most of a panel's ink is
   * outlines rather than studs. `inkOverAntiPhase` is the control that counts.
   */
  studResiduals: {
    sites: number;
    hitRate: number;
    rmsPx: number;
    maxPx: number;
    rmsAllPx: number;
    rmsPointsPerHit: number;
    rmsFractionOfPitch: number;
    inkShare: number;
    inkShareFloor: number;
    inkOverAntiPhase: number;
  } | null;
  /**
   * Left half against right half, which is where a perspective render would
   * show. Null unless both halves produced an accepted fit: half the art is
   * often too little, and a refused sub-fit's numbers are not a measurement.
   */
  halves: {
    leftAzimuthDegrees: number;
    rightAzimuthDegrees: number;
    leftElevationDegrees: number;
    rightElevationDegrees: number;
    leftPixelsPerUnit: number;
    rightPixelsPerUnit: number;
    basisDisagreementPx: number;
  } | null;
}

test("fits the camera a printed step panel was drawn with", async ({ page }) => {
  test.setTimeout(1_800_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  mkdirSync(OUT, { recursive: true });

  const { bytes, source } = await readSampleBooklet();
  const pages = [
    ...new Set(
      sampleBookletPanels(source)
        .filter((panel) => panel.stepNumber >= 1 && panel.stepNumber <= LAST_STEP)
        .map((panel) => panel.pageNumber),
    ),
  ].sort((left, right) => left - right);
  const callouts = await sampleBookletCallouts(bytes, source, pages);
  const boxesByPage = new Map(
    pages.map((pageNumber) => [
      pageNumber,
      callouts.filter((callout) => callout.pageNumber === pageNumber).map(({ box }) => box),
    ]),
  );
  const panels = sampleBookletPanels(source, boxesByPage)
    .filter((panel) => panel.stepNumber >= 1 && panel.stepNumber <= LAST_STEP)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  expect(panels.length).toBeGreaterThan(0);

  await page.goto("/");
  const reports: PanelFitReport[] = [];

  // One evaluate per booklet page, not one per panel. The page raster and the
  // overlay canvas cannot be left in the DOM between calls: this repo's dev
  // server reloads the page whenever a source file changes, and a concurrent
  // session editing app sources took the overlay out from under the screenshot
  // mid-run with "Element is not attached to the DOM". Everything for a page
  // happens in one call and the pictures come back as bytes.
  for (const pageNumber of pages) {
    const pagePanels = panels.filter((entry) => entry.pageNumber === pageNumber);
    const pageResults = await page.evaluate(
      async ({
        pdfjsUrl,
        workerUrl,
        pdfUrl,
        latticeUrl,
        phaseUrl,
        renderingUrl,
        pageNumber,
        scale,
        panelWidth,
        specs,
      }) => {
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        const lattice = await import(/* @vite-ignore */ latticeUrl);
        const phaseModule = await import(/* @vite-ignore */ phaseUrl);
        const rendering = await import(/* @vite-ignore */ renderingUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        // The previous page's overlays have been read back already, and forty
        // megapixel canvases left in the document is how a browser worker dies.
        document.querySelectorAll("canvas.probe").forEach((node) => node.remove());
        // Fetched once and kept, then re-fetched with a retry if the page was
        // reloaded out from under it. Pulling forty megabytes of PDF over the
        // dev server twelve times is both slow and a flake: one of those fetches
        // failed outright during a full browser-suite run.
        const store = window as unknown as { __cameraFitPdf?: Uint8Array };
        let data = store.__cameraFitPdf;
        for (let attempt = 0; data === undefined && attempt < 3; attempt += 1) {
          try {
            data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
          } catch (cause) {
            if (attempt === 2) throw cause;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        if (data === undefined) throw new Error(`Could not fetch ${pdfUrl} in three tries.`);
        store.__cameraFitPdf = data;
        const document_ = await pdfjs.getDocument({ data: data.slice() }).promise;
        const pdfPage = await document_.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        const pageContext = pageCanvas.getContext("2d", { willReadFrequently: true })!;
        await pdfPage.render({
          canvasContext: pageContext,
          viewport,
          background: "#ffffff",
        }).promise;
        await document_.destroy();

        const fitPanel = (spec: (typeof specs)[number]) => {
          // PDF points are bottom-left origin; canvas pixels are top-left.
          const sourceX = spec.minXPt * scale;
          const sourceW = (spec.maxXPt - spec.minXPt) * scale;
          const sourceY = pageCanvas.height - spec.maxYPt * scale;
          const sourceH = (spec.maxYPt - spec.minYPt) * scale;
          const ratio = panelWidth / sourceW;
          const width = Math.max(1, Math.round(panelWidth));
          const height = Math.max(1, Math.round(sourceH * ratio));
          const crop = document.createElement("canvas");
          crop.width = width;
          crop.height = height;
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
            width,
            height,
          );
          const image = cropContext.getImageData(0, 0, width, height);

          // Everything that is not the page, minus the callout box, whose
          // thumbnails are drawn under their own camera and would contribute a
          // second grid at a second scale.
          const background = rendering.INSTRUCTION_BACKGROUND_HEX;
          const backgroundRed = (background >> 16) & 0xff;
          const backgroundGreen = (background >> 8) & 0xff;
          const backgroundBlue = background & 0xff;
          const keyed = new Uint8Array(width * height);
          for (let index = 0; index < keyed.length; index += 1) {
            const offset = index * 4;
            const near =
              Math.abs(image.data[offset]! - backgroundRed) <= 10 &&
              Math.abs(image.data[offset + 1]! - backgroundGreen) <= 10 &&
              Math.abs(image.data[offset + 2]! - backgroundBlue) <= 10;
            if (!near) keyed[index] = 1;
          }
          for (const box of spec.calloutBoxes) {
            const minX = Math.max(0, Math.floor((box.minXPt * scale - sourceX) * ratio) - 4);
            const maxX = Math.min(width - 1, Math.ceil((box.maxXPt * scale - sourceX) * ratio) + 4);
            const minY = Math.max(
              0,
              Math.floor((pageCanvas.height - box.maxYPt * scale - sourceY) * ratio) - 4,
            );
            const maxY = Math.min(
              height - 1,
              Math.ceil((pageCanvas.height - box.minYPt * scale - sourceY) * ratio) + 4,
            );
            for (let y = minY; y <= maxY; y += 1)
              keyed.fill(0, y * width + minX, y * width + maxX + 1);
          }

          // The assembly is the largest thing on the page that is not the page.
          // Taking its own connected region rather than a box around it drops the
          // step number, the progress bar and the rotation badge for free.
          const label = new Int32Array(width * height).fill(-1);
          const stack: number[] = [];
          let bestLabel = -1;
          let bestSize = 0;
          let nextLabel = 0;
          for (let seed = 0; seed < keyed.length; seed += 1) {
            if (keyed[seed] !== 1 || label[seed] !== -1) continue;
            const current = nextLabel;
            nextLabel += 1;
            let size = 0;
            stack.push(seed);
            label[seed] = current;
            while (stack.length > 0) {
              const index = stack.pop()!;
              size += 1;
              const x = index % width;
              const y = (index - x) / width;
              const neighbours = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
              ];
              for (const neighbour of neighbours) {
                if (neighbour < 0 || keyed[neighbour] !== 1 || label[neighbour] !== -1) continue;
                label[neighbour] = current;
                stack.push(neighbour);
              }
            }
            if (size > bestSize) {
              bestSize = size;
              bestLabel = current;
            }
          }
          const includeMask = new Uint8Array(width * height);
          let minX = width;
          let maxX = -1;
          for (let index = 0; index < includeMask.length; index += 1) {
            if (label[index] !== bestLabel) continue;
            includeMask[index] = 1;
            const x = index % width;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }

          const fieldOptions = {
            backgroundHex: background,
            backgroundTolerance: 10,
            highPassRadiusPx: 14,
            includeMask,
            maxSamples: 18_000,
          };
          const field = lattice.buildStudTextureField(image.data, width, height, fieldOptions);
          // The window has to hold the pitch of the largest panel in the book:
          // a step drawn twice as big has twice the pitch, and a window that
          // stops short locks onto a harmonic and reports half the scale.
          // Measured over the first forty steps of this booklet: every panel
          // that reads as a stud grid lands under 0.008 of a pitch from an
          // axonometric projection, and every panel that does not — a step drawn
          // from underneath, one whose art is a handful of tiles — lands over
          // 0.03. Nothing sits between, so the gate goes in the gap.
          const fitOptions = { minOffsetPx: 8, maxOffsetPx: 100, maxResidualFraction: 0.02 };
          const fit = lattice.fitStudLattice(field, fitOptions);

          // Half against half. A phase measure aliases past half a pitch, so a
          // perspective gradient is caught by re-measuring the grid itself on
          // each side rather than by watching one grid's phase walk.
          const halfMask = (keepLeft: boolean) => {
            const middle = (minX + maxX) / 2;
            const half = new Uint8Array(width * height);
            for (let index = 0; index < half.length; index += 1) {
              if (includeMask[index] !== 1) continue;
              const x = index % width;
              if (keepLeft ? x <= middle : x > middle) half[index] = 1;
            }
            return half;
          };
          const fitHalf = (keepLeft: boolean) =>
            lattice.fitStudLattice(
              lattice.buildStudTextureField(image.data, width, height, {
                ...fieldOptions,
                includeMask: halfMask(keepLeft),
                maxSamples: 8_000,
              }),
              fitOptions,
            );

          const basis = fit.basis;
          const solution = fit.solution;
          const drift = basis
            ? phaseModule.latticeDrift(field, basis, { gridSize: 4, minimumSamples: 500 })
            : null;
          const fold = basis ? phaseModule.foldUnitCell(field, basis, 30) : null;
          const shape = fold ? phaseModule.foldedStudShape(fold) : null;
          // The marks are drawn at the folded ring's own centre, not at the
          // Fourier phase: on this booklet those differ by half a cell, and the
          // first overlay drawn from the Fourier phase put every ellipse
          // squarely in the gaps between the studs.
          const anchor = shape;
          const residuals =
            basis && anchor ? phaseModule.latticeSiteResiduals(field, basis, anchor) : null;
          const left = basis ? fitHalf(true) : null;
          const right = basis ? fitHalf(false) : null;

          // Draw the fit over the art, because an angle in a table cannot say
          // whether the marks land on the studs and a picture can.
          const overlay = document.createElement("canvas");
          overlay.className = `probe probe-overlay-${spec.stepNumber}`;
          overlay.width = width;
          overlay.height = height;
          overlay.style.cssText = "position:fixed;top:0;left:0;z-index:99999";
          document.body.append(overlay);
          const draw = overlay.getContext("2d")!;
          draw.drawImage(crop, 0, 0);
          draw.fillStyle = "rgba(10,12,16,0.42)";
          draw.fillRect(0, 0, width, height);

          if (basis && solution && anchor && field.bounds) {
            const sites = phaseModule.latticeSitesInBox(basis, anchor, field.bounds);
            const radius = 0.3 * solution.pixelsPerUnit;
            const squash = Math.sin((solution.elevationDegrees * Math.PI) / 180);
            // Red when the fit was refused, so a rejected panel's marks cannot
            // be mistaken for an accepted one's at a glance.
            draw.strokeStyle =
              fit.failure === null ? "rgba(80,240,255,0.65)" : "rgba(255,90,90,0.5)";
            draw.lineWidth = 1;
            for (const site of sites) {
              // Only where the model actually is: the art's bounding box runs
              // well past its silhouette, and marks floating on the page make
              // the ones that matter harder to judge.
              const x = Math.round(site.xPx);
              const y = Math.round(site.yPx);
              if (x < 0 || x >= width || y < 0 || y >= height) continue;
              if (includeMask[y * width + x] !== 1) continue;
              draw.beginPath();
              draw.ellipse(site.xPx, site.yPx, radius, radius * squash, 0, 0, Math.PI * 2);
              draw.stroke();
            }
            // The two grid steps, drawn once at the panel's own phase anchor.
            const originSite = sites[Math.floor(sites.length / 2)] ?? { xPx: 0, yPx: 0 };
            for (const [vector, colour] of [
              [basis.a, "#ffd23f"],
              [basis.b, "#ff5f9e"],
            ] as const) {
              draw.strokeStyle = colour;
              draw.lineWidth = 3;
              draw.beginPath();
              draw.moveTo(originSite.xPx, originSite.yPx);
              draw.lineTo(originSite.xPx + vector.xPx * 4, originSite.yPx + vector.yPx * 4);
              draw.stroke();
            }
          }

          // The whole panel folded onto one grid cell, magnified. A grid that is
          // right to a fraction of a pixel folds hundreds of studs into one
          // crisp stud; one that is a percent out folds them into grey.
          if (fold) {
            const zoom = 5;
            const inset = fold.size * zoom;
            const left_ = width - inset - 16;
            const top = 16;
            draw.fillStyle = "#000";
            draw.fillRect(left_ - 4, top - 4, inset + 8, inset + 8);
            // Rolled so the stud sits in the middle of the inset; the fold's
            // own origin is an arbitrary corner of the cell and cuts the ring.
            const rollU = shape ? Math.round(shape.phase1 * fold.size) - fold.size / 2 : 0;
            const rollV = shape ? Math.round(shape.phase2 * fold.size) - fold.size / 2 : 0;
            for (let v = 0; v < fold.size; v += 1) {
              for (let u = 0; u < fold.size; u += 1) {
                const sourceU = (((u + rollU) % fold.size) + fold.size) % fold.size;
                const sourceV = (((v + rollV) % fold.size) + fold.size) % fold.size;
                const value = fold.values[sourceV * fold.size + sourceU];
                const level = Math.round(
                  255 * Math.min(1, Math.max(0, 0.5 + value / (fold.contrast || 1))),
                );
                draw.fillStyle = `rgb(${level},${level},${level})`;
                draw.fillRect(left_ + u * zoom, top + v * zoom, zoom, zoom);
              }
            }
          }

          const accepted = solution !== null && fit.failure === null;
          const caption = accepted
            ? [
                `step ${spec.stepNumber}   azimuth ${solution!.azimuthDegrees.toFixed(2)}   elevation ${solution!.elevationDegrees.toFixed(2)}   ${solution!.pixelsPerUnit.toFixed(2)} px per stud`,
                `residual ${solution!.residualPx.toFixed(3)}px   ${residuals ? `stud ${residuals.rmsPx.toFixed(2)}px over ${residuals.sites} sites, ink ${residuals.inkShare.toFixed(2)} vs ${residuals.inkShareFloor.toFixed(2)} floor` : "stud not measured"}   ring ${shape ? `${shape.ringRadiusCells.toFixed(2)} x${shape.radialContrast.toFixed(1)}` : "-"}`,
              ]
            : [`step ${spec.stepNumber}   REFUSED`, (fit.failure ?? "no grid found").slice(0, 130)];
          draw.font = "14px monospace";
          draw.fillStyle = "rgba(0,0,0,0.82)";
          draw.fillRect(0, height - 40, width, 40);
          draw.fillStyle = accepted ? "#e8f6ff" : "#ffc9c9";
          draw.fillText(caption[0]!, 10, height - 24);
          draw.fillText(caption[1]!, 10, height - 8);

          const basisGap =
            left?.basis && right?.basis && left.failure === null && right.failure === null
              ? Math.max(
                  Math.hypot(
                    left.basis.a.xPx - right.basis.a.xPx,
                    left.basis.a.yPx - right.basis.a.yPx,
                  ),
                  Math.hypot(
                    left.basis.b.xPx - right.basis.b.xPx,
                    left.basis.b.yPx - right.basis.b.yPx,
                  ),
                )
              : null;

          return {
            stepNumber: spec.stepNumber,
            pageNumber: spec.pageNumber,
            widthPx: width,
            heightPx: height,
            artPx: field.artArea,
            failure: fit.failure,
            // Pixels are not comparable between panels: every panel is cropped
            // to the same width whatever cell of the page it owns, so a step
            // drawn in a quarter-page cell comes out at twice the pixels per
            // stud of the same drawing in a full-page one. Points are the
            // booklet's own unit and the only one a run of steps can be
            // compared in.
            pxPerPoint: width / (spec.maxXPt - spec.minXPt),
            fit: solution
              ? {
                  azimuthDegrees: solution.azimuthDegrees,
                  elevationDegrees: solution.elevationDegrees,
                  pixelsPerUnit: solution.pixelsPerUnit,
                  pointsPerStud: solution.pixelsPerUnit / (width / (spec.maxXPt - spec.minXPt)),
                  residualPx: solution.residualPx,
                  coherence: fit.coherence,
                  aXPx: basis!.a.xPx,
                  aYPx: basis!.a.yPx,
                  bXPx: basis!.b.xPx,
                  bYPx: basis!.b.yPx,
                }
              : null,
            drift: drift
              ? {
                  horizontalRmsPx: drift.horizontalRmsPx,
                  horizontalMaxPx: drift.horizontalMaxPx,
                  verticalRmsPx: drift.verticalRmsPx,
                  verticalMaxPx: drift.verticalMaxPx,
                  globalCoherence: drift.globalCoherence,
                  windows: drift.windows.filter((entry: { counted: boolean }) => entry.counted)
                    .length,
                  failure: drift.failure,
                }
              : null,
            studShape: shape
              ? {
                  ringRadiusCells: shape.ringRadiusCells,
                  radialContrast: shape.radialContrast,
                  contrast: fold!.contrast,
                }
              : null,
            studResiduals: residuals
              ? {
                  sites: residuals.sites,
                  hitRate: residuals.hitRate,
                  rmsPx: residuals.rmsPx,
                  maxPx: residuals.maxPx,
                  rmsAllPx: residuals.rmsAllPx,
                  rmsPointsPerHit: residuals.rmsPx / (width / (spec.maxXPt - spec.minXPt)),
                  // Pitch varies four-fold across the booklet's panels, so an
                  // error in pixels cannot be compared between them.
                  rmsFractionOfPitch: solution ? residuals.rmsPx / solution.pixelsPerUnit : 0,
                  inkShare: residuals.inkShare,
                  inkShareFloor: residuals.inkShareFloor,
                  inkOverAntiPhase: residuals.inkOverAntiPhase,
                }
              : null,
            halves:
              left?.solution &&
              right?.solution &&
              left.failure === null &&
              right.failure === null &&
              basisGap !== null
                ? {
                    leftAzimuthDegrees: left.solution.azimuthDegrees,
                    rightAzimuthDegrees: right.solution.azimuthDegrees,
                    leftElevationDegrees: left.solution.elevationDegrees,
                    rightElevationDegrees: right.solution.elevationDegrees,
                    leftPixelsPerUnit: left.solution.pixelsPerUnit,
                    rightPixelsPerUnit: right.solution.pixelsPerUnit,
                    basisDisagreementPx: basisGap,
                  }
                : null,
          } satisfies PanelFitReport;
        };

        return specs.map((spec) => ({
          report: fitPanel(spec),
          overlayPng: (
            document.querySelector(`canvas.probe-overlay-${spec.stepNumber}`) as HTMLCanvasElement
          ).toDataURL("image/png"),
        }));
      },
      {
        ...bookletProbeUrls(),
        latticeUrl: LATTICE_MODULE_URL,
        phaseUrl: LATTICE_PHASE_MODULE_URL,
        renderingUrl: RENDERING_MODULE_URL,
        pageNumber,
        scale: RENDER_SCALE,
        panelWidth: PANEL_WIDTH,
        specs: pagePanels.map((panel) => ({
          stepNumber: panel.stepNumber,
          pageNumber,
          minXPt: panel.bounds.minXPt,
          maxXPt: panel.bounds.maxXPt,
          minYPt: panel.bounds.minYPt,
          maxYPt: panel.bounds.maxYPt,
          calloutBoxes: callouts
            .filter(
              (callout) =>
                callout.pageNumber === pageNumber && callout.stepNumber === panel.stepNumber,
            )
            .map(({ box }) => box),
        })),
      },
    );

    for (const { report, overlayPng } of pageResults) {
      reports.push(report);
      writeFileSync(
        `${OUT}/overlay-${String(report.stepNumber).padStart(3, "0")}.png`,
        Buffer.from(overlayPng.split(",")[1]!, "base64"),
      );
    }
  }

  // How far one step's camera is from the next. A booklet reuses one camera for
  // a run of steps, so a fit that jumps between neighbours is a fit that is
  // measuring something else. The number that matters downstream is not the
  // angle but the pixels: how far a part placed twenty studs from the anchor
  // would land from where the next panel draws it.
  // A panel can produce a solution and still be refused: least squares always
  // returns something, and the residual gate is what separates a measurement
  // from a number. Only the accepted ones are compared.
  const fitted = reports.filter((entry) => entry.fit !== null && entry.failure === null);
  const neighbours: {
    fromStep: number;
    toStep: number;
    azimuthDeltaDegrees: number;
    elevationDeltaDegrees: number;
    pointsPerStudDeltaFraction: number;
    basisDisagreementPt: number;
  }[] = [];
  for (let index = 1; index < fitted.length; index += 1) {
    const previous = fitted[index - 1]!.fit!;
    const current = fitted[index]!.fit!;
    const previousPoints = fitted[index - 1]!.pxPerPoint;
    const currentPoints = fitted[index]!.pxPerPoint;
    neighbours.push({
      fromStep: fitted[index - 1]!.stepNumber,
      toStep: fitted[index]!.stepNumber,
      azimuthDeltaDegrees: current.azimuthDegrees - previous.azimuthDegrees,
      elevationDeltaDegrees: current.elevationDegrees - previous.elevationDegrees,
      pointsPerStudDeltaFraction:
        (current.pointsPerStud - previous.pointsPerStud) / previous.pointsPerStud,
      // One grid step apart, measured in the booklet's own points. This is the
      // number that matters downstream: it is how far a part placed one stud
      // from the anchor would land from where the next panel draws it.
      basisDisagreementPt: Math.max(
        Math.hypot(
          current.aXPx / currentPoints - previous.aXPx / previousPoints,
          current.aYPx / currentPoints - previous.aYPx / previousPoints,
        ),
        Math.hypot(
          current.bXPx / currentPoints - previous.bXPx / previousPoints,
          current.bYPx / currentPoints - previous.bYPx / previousPoints,
        ),
      ),
    });
  }
  const median = (values: readonly number[]): number => {
    if (values.length === 0) return Number.NaN;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)]!;
  };

  // A booklet holds a camera for a run of steps and then turns the model over.
  // Splitting the fitted steps wherever the camera actually jumps is what turns
  // a list of angles into the claim that matters: inside a run the same camera
  // explains every panel, and the spread inside a run is the stability number.
  const runs: {
    fromStep: number;
    toStep: number;
    steps: number[];
    azimuthDegrees: number;
    elevationDegrees: number;
    pointsPerStud: number;
    azimuthSpreadDegrees: number;
    elevationSpreadDegrees: number;
    pointsPerStudSpreadFraction: number;
    worstBasisDisagreementPt: number;
  }[] = [];
  const spread = (values: readonly number[]) => Math.max(...values) - Math.min(...values);
  let group: typeof fitted = [];
  const closeRun = () => {
    if (group.length === 0) return;
    const azimuths = group.map((entry) => entry.fit!.azimuthDegrees);
    const elevations = group.map((entry) => entry.fit!.elevationDegrees);
    const scales = group.map((entry) => entry.fit!.pointsPerStud);
    const gaps = neighbours.filter((entry) =>
      group.some((member, index) => index > 0 && member.stepNumber === entry.toStep),
    );
    runs.push({
      fromStep: group[0]!.stepNumber,
      toStep: group.at(-1)!.stepNumber,
      steps: group.map((entry) => entry.stepNumber),
      azimuthDegrees: median(azimuths),
      elevationDegrees: median(elevations),
      pointsPerStud: median(scales),
      azimuthSpreadDegrees: spread(azimuths),
      elevationSpreadDegrees: spread(elevations),
      pointsPerStudSpreadFraction: spread(scales) / median(scales),
      worstBasisDisagreementPt:
        gaps.length === 0 ? 0 : Math.max(...gaps.map((entry) => entry.basisDisagreementPt)),
    });
    group = [];
  };
  for (const entry of fitted) {
    const previous = group.at(-1);
    // Angles only. Three degrees is an order of magnitude above the largest
    // neighbour step measured inside a run (0.73) and an order below the jump at
    // a rotation (20 and up). Scale is deliberately not a criterion: the booklet
    // rezooms as the model grows, by up to 2.1% between neighbours inside a run,
    // and it changed by only 0.3% at one of the three rotations — so a scale term
    // would split runs that did not change camera and miss ones that did.
    const sameCamera =
      previous !== undefined &&
      Math.abs(entry.fit!.azimuthDegrees - previous.fit!.azimuthDegrees) < 3 &&
      Math.abs(entry.fit!.elevationDegrees - previous.fit!.elevationDegrees) < 3;
    if (previous !== undefined && !sameCamera) closeRun();
    group.push(entry);
  }
  closeRun();
  const angles = fitted.map((entry) => entry.fit!);

  // Round trip through the repo's own camera. The fit is only useful if these
  // numbers mean the same thing to `createOrthographicViewCamera` that they
  // meant to the panel, so render real catalog geometry with them, measure the
  // grid that comes out with the same fitter, and compare. A sign or basis
  // convention that disagreed would show here and nowhere else.
  const selfCheck = await page.evaluate(
    async ({ latticeUrl, renderingUrl, kernelUrl, commandsUrl, requested }) => {
      const lattice = await import(/* @vite-ignore */ latticeUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const commands = await import(/* @vite-ignore */ commandsUrl);

      // A slab of nine 6x6 plates, so the render carries enough grid to fit.
      let document_ = kernel.createEmptyBrickDocument({ id: "camera-self", name: "Self check" });
      for (const x of [-140, 0, 140]) {
        for (const z of [-140, 0, 140]) {
          const transaction = commands.createPlacePartTransaction(document_, {
            catalogPartId: "builtin:plate-6x6",
            colorId: "builtin:light-bluish-gray",
            transform: { positionLdu: [x, 8, z], orientationId: "upright-yaw-0" },
          });
          document_ = kernel.applyBuildOperations(document_, transaction.operations);
        }
      }
      const width = 900;
      const height = 700;
      const projection = rendering.deriveBrickScene(document_, { finish: "instruction" });
      const renderer = rendering.createInstructionRenderer({ width, height });
      const frame = rendering.instructionViewFrame(projection.bounds, width, height);
      const camera = rendering.createOrthographicViewCamera(
        { ...requested, centerXPx: width / 2, centerYPx: height / 2 },
        frame,
      );
      const pixels = renderer.render(projection.root, camera);
      const field = lattice.buildStudTextureField(pixels, width, height, {
        backgroundHex: rendering.INSTRUCTION_BACKGROUND_HEX,
        backgroundTolerance: 2,
        highPassRadiusPx: 14,
        maxSamples: 20_000,
      });
      const fit = lattice.fitStudLattice(field, {
        minOffsetPx: 8,
        maxOffsetPx: 100,
        maxResidualFraction: 0.02,
      });
      const png = (() => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas
          .getContext("2d")!
          .putImageData(
            new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height),
            0,
            0,
          );
        return canvas.toDataURL("image/png");
      })();
      projection.dispose();
      renderer.dispose();
      return {
        requested,
        recovered: fit.solution,
        failure: fit.failure,
        parts: document_.parts.length,
        documentGloballyValid: projection.validationReport.documentGloballyValid,
        png,
      };
    },
    {
      latticeUrl: LATTICE_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      commandsUrl: MANUAL_COMMANDS_MODULE_URL,
      requested: {
        azimuthDegrees: median(angles.map((entry) => entry.azimuthDegrees)),
        elevationDegrees: median(angles.map((entry) => entry.elevationDegrees)),
        pixelsPerUnit: 40,
      },
    },
  );
  writeFileSync(`${OUT}/self-check.png`, Buffer.from(selfCheck.png.split(",")[1]!, "base64"));

  const score = {
    source: "recipes/6651557.pdf",
    // What each number is, because an artifact nobody can read is not evidence.
    legend: {
      residualPx:
        "How far the measured grid sits from the closest upright axonometric projection of a square grid. A fit quality, not a proof: a rhombic grid also reads under 1% of pitch once a change of basis is allowed.",
      studResiduals:
        "Every art pixel within 0.38 of a pitch of a predicted stud is assigned to it; rmsPx is how far that ink's centre sits from the prediction. The aperture bounds the error it can report, so rmsPx and hitRate alone prove nothing — pure noise under an invented grid scores 0.5px at a hit rate of 1.000. inkOverAntiPhase is the control: the same aperture half a cell off the prediction, seeing the same page. Sites whose ink is a stud one layer up are the misses.",
      studShape:
        "A stud is a disc of radius 6 LDU on a 20 LDU pitch, so a correct cell folds to a radial profile whose steepest step is at 0.3 of a pitch. Measured as a profile on purpose: second moments of the folded cell are maximised by having no stud in it at all, so they cannot be a check.",
      drift:
        "Spread of the grid's phase across windows of the panel. An upper bound only: a plate one brick higher shifts its studs on the page, and a window holding two heights reports a phase between them, so a multi-layer panel drifts without the camera changing.",
      pointsPerStud:
        "Scale in the booklet's own unit. It is not constant across a run — the booklet rezooms as the model grows — so it is fitted per panel and only the angles are expected to hold.",
      basisDisagreementPt:
        "One grid step apart, in points: how far a part placed one stud from the anchor would land from where the neighbouring panel draws it.",
    },
    lastStep: LAST_STEP,
    renderScale: RENDER_SCALE,
    panelWidthPx: PANEL_WIDTH,
    panelsTried: reports.length,
    panelsFitted: fitted.length,
    medianAzimuthDegrees: median(angles.map((entry) => entry.azimuthDegrees)),
    medianElevationDegrees: median(angles.map((entry) => entry.elevationDegrees)),
    medianPointsPerStud: median(angles.map((entry) => entry.pointsPerStud)),
    medianResidualPx: median(angles.map((entry) => entry.residualPx)),
    // Every median below is over accepted panels only. Folding the refusals in
    // flattered the headline: they score as well as the accepted panels on the
    // stud statistics, which is exactly why those statistics needed replacing.
    medianDriftRmsPx: median(
      fitted
        .filter((entry) => entry.drift?.failure === null)
        .map((entry) => entry.drift!.horizontalRmsPx),
    ),
    medianStudRingRadiusCells: median(
      fitted
        .filter((entry) => entry.studShape !== null)
        .map((entry) => entry.studShape!.ringRadiusCells),
    ),
    medianStudRadialContrast: median(
      fitted
        .filter((entry) => entry.studShape !== null)
        .map((entry) => entry.studShape!.radialContrast),
    ),
    refusedStudRadialContrast: median(
      reports
        .filter((entry) => entry.failure !== null && entry.studShape !== null)
        .map((entry) => entry.studShape!.radialContrast),
    ),
    medianStudReprojectionPx: median(
      fitted
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.rmsPx),
    ),
    medianStudReprojectionFractionOfPitch: median(
      fitted
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.rmsFractionOfPitch),
    ),
    medianStudHitRate: median(
      fitted
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.hitRate),
    ),
    medianStudInkShare: median(
      fitted
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.inkShare),
    ),
    refusedStudInkShare: median(
      reports
        .filter((entry) => entry.failure !== null && entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.inkShare),
    ),
    // The clearest per-panel signal that came out of the run: the mean
    // autocorrelation of the chosen basis over its harmonics.
    medianCoherence: median(fitted.map((entry) => entry.fit!.coherence)),
    refusedCoherence: median(
      reports
        .filter((entry) => entry.failure !== null && entry.fit !== null)
        .map((entry) => entry.fit!.coherence),
    ),
    medianStudInkOverAntiPhase: median(
      fitted
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.inkOverAntiPhase),
    ),
    refusedStudInkOverAntiPhase: median(
      reports
        .filter((entry) => entry.failure !== null && entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.inkOverAntiPhase),
    ),
    studInkShareFloor:
      fitted.find((entry) => entry.studResiduals !== null)?.studResiduals!.inkShareFloor ??
      Number.NaN,
    halvesMeasured: fitted.filter((entry) => entry.halves !== null).length,
    medianHalfBasisDisagreementPx: median(
      fitted
        .filter((entry) => entry.halves !== null)
        .map((entry) => entry.halves!.basisDisagreementPx),
    ),
    maxHalfBasisDisagreementPx: Math.max(
      0,
      ...fitted
        .filter((entry) => entry.halves !== null)
        .map((entry) => entry.halves!.basisDisagreementPx),
    ),
    medianNeighbourBasisDisagreementPt: median(
      neighbours.map((entry) => entry.basisDisagreementPt),
    ),
    cameraRuns: runs.length,
    runs,
    selfCheck: {
      requested: selfCheck.requested,
      recovered: selfCheck.recovered,
      failure: selfCheck.failure,
      parts: selfCheck.parts,
      documentGloballyValid: selfCheck.documentGloballyValid,
      azimuthErrorDegrees: selfCheck.recovered
        ? selfCheck.recovered.azimuthDegrees - selfCheck.requested.azimuthDegrees
        : null,
      elevationErrorDegrees: selfCheck.recovered
        ? selfCheck.recovered.elevationDegrees - selfCheck.requested.elevationDegrees
        : null,
      pixelsPerUnitErrorFraction: selfCheck.recovered
        ? (selfCheck.recovered.pixelsPerUnit - selfCheck.requested.pixelsPerUnit) /
          selfCheck.requested.pixelsPerUnit
        : null,
    },
    neighbours,
    panels: reports,
  };
  writeFileSync(`${OUT}/score.json`, JSON.stringify(score, null, 1));
  console.log(
    `fitted ${fitted.length}/${reports.length} panels; ` +
      `median az ${score.medianAzimuthDegrees.toFixed(2)} el ${score.medianElevationDegrees.toFixed(2)} pt/stud ${score.medianPointsPerStud.toFixed(3)}; ` +
      `model residual ${score.medianResidualPx.toFixed(3)}px; ` +
      `stud reprojection ${score.medianStudReprojectionPx.toFixed(2)}px (${(score.medianStudReprojectionFractionOfPitch * 100).toFixed(1)}% of pitch) over ${(score.medianStudHitRate * 100).toFixed(0)}% of sites; ` +
      `ink over anti-phase ${score.medianStudInkOverAntiPhase.toFixed(3)} (refused ${score.refusedStudInkOverAntiPhase.toFixed(3)}), share ${score.medianStudInkShare.toFixed(3)} against a floor of ${score.studInkShareFloor.toFixed(3)}; ` +
      `radial contrast ${score.medianStudRadialContrast.toFixed(2)} against ${score.refusedStudRadialContrast.toFixed(2)} refused; ` +
      `coherence ${score.medianCoherence.toFixed(3)} against ${score.refusedCoherence.toFixed(3)} refused; ` +
      `neighbour basis gap ${score.medianNeighbourBasisDisagreementPt.toFixed(3)}pt; ` +
      `${runs.length} camera run(s); ` +
      `self-check az ${score.selfCheck.azimuthErrorDegrees?.toFixed(3) ?? "-"} el ${score.selfCheck.elevationErrorDegrees?.toFixed(3) ?? "-"} scale ${score.selfCheck.pixelsPerUnitErrorFraction?.toFixed(4) ?? "-"}`,
  );
  for (const run of runs) {
    console.log(
      `  run steps ${run.fromStep}-${run.toStep} (${run.steps.length}): az ${run.azimuthDegrees.toFixed(2)} +-${run.azimuthSpreadDegrees.toFixed(2)}  ` +
        `el ${run.elevationDegrees.toFixed(2)} +-${run.elevationSpreadDegrees.toFixed(2)}  ` +
        `pt/stud ${run.pointsPerStud.toFixed(3)} +-${(run.pointsPerStudSpreadFraction * 100).toFixed(2)}%  ` +
        `worst neighbour gap ${run.worstBasisDisagreementPt.toFixed(3)}pt`,
    );
  }

  // Every number below was measured on this booklet before it was asserted, and
  // the bounds sit well clear of what was measured — they are a regression net,
  // not the result. The result is in score.json and in the overlays.
  expect(reports.length).toBe(panels.length);
  // Most of the first forty panels fit. The refusals are panels where the fitter
  // locked onto a repeat that is not the stud grid — their recovered pitch is
  // between a third and twice the booklet's — and each one says so.
  expect(fitted.length).toBeGreaterThanOrEqual(28);

  // Printed step 4, named because it is the panel that blocked the booklet run
  // and the one the candidate ranking was fixed on. It is the booklet's first
  // underside panel and it was refused at 9.11px from the closest axonometric
  // against the 0.02 gate, on a 92.19px pitch — twice what its neighbours
  // measure — while its own grid sat second in the candidate list at 0.5% of a
  // 43.8px pitch, beaten on unit-cell area by a lattice no upright axonometric
  // view can print.
  //
  // Fitting is not the claim; least squares always returns something. The claim
  // is that what it fits is the camera the panels either side of it measured,
  // and the printed pitch is the strongest form of it: the booklet rezooms
  // between panels, but not by 100%.
  const step3 = reports.find((entry) => entry.stepNumber === 3)!;
  const step4 = reports.find((entry) => entry.stepNumber === 4)!;
  const step5 = reports.find((entry) => entry.stepNumber === 5)!;
  expect(step4.failure).toBeNull();
  for (const neighbour of [step3, step5]) {
    expect(neighbour.failure).toBeNull();
    expect(step4.fit!.pointsPerStud).toBeCloseTo(neighbour.fit!.pointsPerStud, 0);
    expect(Math.abs(step4.fit!.elevationDegrees - neighbour.fit!.elevationDegrees)).toBeLessThan(3);
  }
  // And its grid is its neighbours' reflected in x rather than a repeat of it —
  // `a` is their `b` mirrored and `b` is their `a` — which is what an underside
  // panel reads as under a fit that can only report a positive elevation, and
  // why its azimuth lands near 90 minus theirs instead of on top of them.
  //
  // Bounded at 1.5px rather than pinned, and the bound still discriminates: the
  // measured gaps are 0.10, 0.05, 0.42 and 0.16, while the other reading — step
  // 4 drawn on the same grid as step 3 rather than its mirror — puts `a` about
  // 11px away, which is seven times the bound.
  for (const [measured, mirrored] of [
    [step4.fit!.aXPx, -step3.fit!.bXPx],
    [step4.fit!.aYPx, step3.fit!.bYPx],
    [step4.fit!.bXPx, -step3.fit!.aXPx],
    [step4.fit!.bYPx, step3.fit!.aYPx],
  ] as const) {
    expect(Math.abs(measured - mirrored)).toBeLessThan(1.5);
  }
  for (const entry of reports) {
    if (entry.failure === null) continue;
    expect(entry.failure.length).toBeGreaterThan(60);
  }
  // Predicted stud against the ink under it, as a fraction of pitch because the
  // pitch varies four-fold across the booklet's panels.
  expect(score.medianStudReprojectionFractionOfPitch).toBeLessThan(0.1);
  expect(score.medianStudHitRate).toBeGreaterThan(0.9);
  // And the part of that measurement that is not free. The aperture covers 45%
  // of a cell, so any picture scores about 0.45 of the ink by area alone, and
  // the accepted panels sit at 0.474 — barely above, because most of a panel's
  // ink is outlines and plate edges rather than studs. The control is the same
  // aperture half a cell off the prediction: same size, same page. At 1.11 the
  // ink is genuinely on the predictions. It does not separate accepted from
  // refused (1.108 against 1.118), so it is not asserted to.
  expect(score.medianStudInkOverAntiPhase).toBeGreaterThan(1.05);
  // The folded cell was meant to be the independent proof that the picture is a
  // stud grid, and on this booklet it is not one. It has a radial feature where
  // a stud would put one (0.17 of a pitch, against a rim at 0.3 — the high pass
  // is a stud wide, so the profile sees centre-surround rather than an edge),
  // and the accepted panels beat the refused ones on it by 1.52 to 1.17. That
  // is a hint. The per-panel signal that does separate them is the grid's own
  // autocorrelation: 0.26 against 0.11, though the ranges overlap.
  expect(score.medianStudRingRadiusCells).toBeGreaterThan(0.1);
  expect(score.medianStudRingRadiusCells).toBeLessThan(0.45);
  expect(score.medianStudRadialContrast).toBeGreaterThan(score.refusedStudRadialContrast);
  expect(score.medianCoherence).toBeGreaterThan(score.refusedCoherence * 1.5);
  // Half the art against the other half, which is where a perspective render
  // would show. Only counted where both halves produced an accepted fit.
  expect(score.halvesMeasured).toBeGreaterThan(5);
  expect(score.medianHalfBasisDisagreementPx).toBeLessThan(3);
  // Stability: the booklet holds one camera for a run of steps, and the runs the
  // fit finds are 1-3, 4, 5-9, 10-15, 16-34, 36-37 — it turns the model over and
  // back, and printed step 4 is a run of one because it is a single underside
  // panel between two studs-up ones and so reads as the mirror of both.
  // Inside a run the angles hold to a third of a degree of standard deviation.
  expect(runs.length).toBeGreaterThanOrEqual(3);
  for (const run of runs) {
    if (run.steps.length < 4) continue;
    expect(run.azimuthSpreadDegrees).toBeLessThan(3);
    expect(run.elevationSpreadDegrees).toBeLessThan(3);
    expect(run.worstBasisDisagreementPt).toBeLessThan(1);
  }
  // The booklet is drawn very close to true isometric, whose elevation is
  // 35.264 degrees. Measured 35.6 across 32 panels.
  expect(score.medianElevationDegrees).toBeGreaterThan(30);
  expect(score.medianElevationDegrees).toBeLessThan(40);
  // And the fitted numbers mean to our camera what they meant to the panel.
  expect(selfCheck.failure).toBeNull();
  expect(Math.abs(score.selfCheck.azimuthErrorDegrees!)).toBeLessThan(0.5);
  expect(Math.abs(score.selfCheck.elevationErrorDegrees!)).toBeLessThan(0.5);
  expect(Math.abs(score.selfCheck.pixelsPerUnitErrorFraction!)).toBeLessThan(0.01);
});
