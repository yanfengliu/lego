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
/** Page render scale; the panel crop is near native at this, so studs stay sharp. */
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
  /** Reprojection error: how far the panel's own regions disagree about the grid. */
  drift: {
    horizontalRmsPx: number;
    horizontalMaxPx: number;
    verticalRmsPx: number;
    verticalMaxPx: number;
    globalCoherence: number;
    windows: number;
    failure: string | null;
  } | null;
  /** Independent check: the drawn stud has to fold back to a circle 0.3 pitch across. */
  studShape: { radiusCells: number; circularity: number; contrast: number } | null;
  /** The reprojection error proper: predicted stud against the ink under it. */
  studResiduals: {
    sites: number;
    hitRate: number;
    rmsPx: number;
    maxPx: number;
    rmsAllPx: number;
    rmsPointsPerHit: number;
  } | null;
  /** Left half against right half, which is where a perspective render would show. */
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
        const data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const document_ = await pdfjs.getDocument({ data }).promise;
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
                `model residual ${solution!.residualPx.toFixed(3)}px   stud reprojection ${residuals ? `${residuals.rmsPx.toFixed(2)}px rms over ${(residuals.hitRate * 100).toFixed(0)}% of ${residuals.sites} sites` : "not measured"}`,
              ]
            : [`step ${spec.stepNumber}   REFUSED`, (fit.failure ?? "no grid found").slice(0, 130)];
          draw.font = "14px monospace";
          draw.fillStyle = "rgba(0,0,0,0.82)";
          draw.fillRect(0, height - 40, width, 40);
          draw.fillStyle = accepted ? "#e8f6ff" : "#ffc9c9";
          draw.fillText(caption[0]!, 10, height - 24);
          draw.fillText(caption[1]!, 10, height - 8);

          const basisGap =
            left?.basis && right?.basis
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
                  radiusCells: shape.radiusCells,
                  circularity: shape.circularity,
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
                }
              : null,
            halves:
              left?.solution && right?.solution && basisGap !== null
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
    // Three degrees and three percent: an order of magnitude above the spread
    // measured inside a run and an order below the jump at a rotation.
    const sameCamera =
      previous !== undefined &&
      Math.abs(entry.fit!.azimuthDegrees - previous.fit!.azimuthDegrees) < 3 &&
      Math.abs(entry.fit!.elevationDegrees - previous.fit!.elevationDegrees) < 3 &&
      Math.abs(entry.fit!.pointsPerStud - previous.fit!.pointsPerStud) <
        previous.fit!.pointsPerStud * 0.03;
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
        "The reprojection error. Every art pixel within 0.38 of a pitch of a predicted stud is assigned to it; rmsPx is how far the ink's centre sits from the prediction. Sites whose ink is a stud one layer up are the misses, and hitRate says how much of the panel is on the layer the phase was taken from.",
      studShape:
        "The independent check. A stud is a circle of radius 6 LDU on a 20 LDU pitch, so folded onto a correct cell it comes back circular and 0.3 of a pitch across, whatever the elevation.",
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
    medianDriftRmsPx: median(
      reports
        .filter((entry) => entry.drift?.failure === null)
        .map((entry) => entry.drift!.horizontalRmsPx),
    ),
    medianStudCircularity: median(
      reports
        .filter((entry) => entry.studShape !== null)
        .map((entry) => entry.studShape!.circularity),
    ),
    medianStudRadiusCells: median(
      reports
        .filter((entry) => entry.studShape !== null)
        .map((entry) => entry.studShape!.radiusCells),
    ),
    medianStudReprojectionPx: median(
      reports
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.rmsPx),
    ),
    medianStudReprojectionPt: median(
      reports
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.rmsPointsPerHit),
    ),
    medianStudHitRate: median(
      reports
        .filter((entry) => entry.studResiduals !== null)
        .map((entry) => entry.studResiduals!.hitRate),
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
      `stud reprojection ${score.medianStudReprojectionPx.toFixed(2)}px over ${(score.medianStudHitRate * 100).toFixed(0)}% of sites; ` +
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
  // 32 of the first 40 panels fitted. The eight refusals are steps drawn from
  // underneath or too small to carry a grid, and each says so.
  expect(fitted.length).toBeGreaterThanOrEqual(28);
  for (const entry of reports) {
    if (entry.failure === null) continue;
    expect(entry.failure.length).toBeGreaterThan(60);
  }
  // The reprojection error: predicted stud against the ink under it. Measured
  // at 0.96px of a roughly 40px pitch, over 99% of grid sites.
  expect(score.medianStudReprojectionPx).toBeLessThan(2);
  expect(score.medianStudHitRate).toBeGreaterThan(0.9);
  // The independent check on the grid itself. A stud is a circle of radius 6 LDU
  // on a 20 LDU pitch, so folded onto the fitted cell it has to come back round
  // and 0.3 of a pitch across whatever the elevation. Measured 0.93 and 0.39.
  expect(score.medianStudCircularity).toBeGreaterThan(0.8);
  expect(score.medianStudRadiusCells).toBeGreaterThan(0.3);
  expect(score.medianStudRadiusCells).toBeLessThan(0.5);
  // Stability: the booklet holds one camera for a run of steps, and the runs the
  // fit finds are 1-9, 10-15, 16-34, 36-37 — it turns the model over and back.
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
