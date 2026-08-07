import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

/**
 * One printed panel turned into the raster evidence a step is scored against.
 *
 * Lifted out of `runRealBuild` because the deferral needs a *second* panel's
 * evidence while a step is still open: a step whose own panel prints no
 * highlight has nothing to score against, and the panel that shows what it built
 * is the next one. That panel may sit on a page the main loop has not reached,
 * so the derivation has to be callable out of order — which it cannot be while
 * it lives inside the loop body as two hundred lines of locals.
 *
 * Nothing here decides anything. It reads pixels and returns them; the camera
 * fit, the highlight, the already-built mask and the arrow family are all facts
 * about the printed page rather than about any candidate.
 */

export interface PanelViewSolution {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
}

export interface FittedPanelSolution extends PanelViewSolution {
  readonly residualPx: number;
}

export interface ArrowDisplacement {
  readonly lduX: number;
  readonly lduY: number;
  readonly lduZ: number;
  readonly errorStuds: number;
}

export interface PanelHighlightBox {
  readonly minXPx: number;
  readonly minYPx: number;
  readonly maxXPx: number;
  readonly maxYPx: number;
}

export interface PanelRasterEvidence {
  /** Raster size after `workFactor` downsampling — every mask below is this size. */
  readonly width: number;
  readonly height: number;
  readonly workPixels: Uint8ClampedArray;
  readonly fitSolution: FittedPanelSolution | null;
  readonly fitFailure: string | null;
  readonly fitCoherence: number;
  /** The fit with the printed rotate-the-model icon's sign applied, or null. */
  readonly faceCorrectedFit: PanelViewSolution | null;
  readonly highlight: {
    readonly regions: readonly { readonly bounds: PanelHighlightBox }[];
    readonly closedContourRate: number;
    readonly keyedPx: number;
    readonly mask: Uint8Array;
    readonly strokeMask: Uint8Array;
  };
  readonly highlightBox: PanelHighlightBox | null;
  /** The panel's art minus this step's highlight: everything already built. */
  readonly builtMask: Uint8Array;
  readonly arrows: {
    readonly arrows: readonly unknown[];
    readonly rejected: readonly unknown[];
    readonly redPx: number;
  };
  readonly arrowFamily: readonly ArrowDisplacement[];
}

export type PageCanvas = HTMLCanvasElement;

/** Rasterises one PDF page at the run's render scale. Caller disposes. */
export async function renderRealBuildPageCanvas(
  pdf: PreparedRealBuildModules["pdfjs"],
  pageNumber: number,
  renderScale: number,
): Promise<{ readonly canvas: PageCanvas; readonly dispose: () => void }> {
  const pdfPage = await pdf.getPage(pageNumber);
  const viewport = pdfPage.getViewport({ scale: renderScale });
  const canvas = document.createElement("canvas");
  canvas.className = "page-probe";
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  try {
    const pageContext = canvas.getContext("2d", { willReadFrequently: true })!;
    await pdfPage.render({
      canvas,
      canvasContext: pageContext,
      viewport,
      background: "#ffffff",
    }).promise;
  } catch (error) {
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    pdfPage.cleanup?.();
    throw error;
  }
  return {
    canvas,
    dispose: () => {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
      pdfPage.cleanup?.();
    },
  };
}

export function derivePanelRasterEvidence(input: {
  readonly pageCanvas: PageCanvas;
  readonly spec: RealBuildPanelSpec;
  readonly options: Pick<
    RealBuildOptions,
    "renderScale" | "panelWidth" | "workFactor" | "proximityMarginPx"
  >;
  readonly modules: Pick<PreparedRealBuildModules, "lattice" | "assembly">;
}): PanelRasterEvidence {
  const { pageCanvas, spec, options, modules } = input;
  const { lattice, assembly } = modules;

  const sourceX = spec.minXPt * options.renderScale;
  const sourceW = (spec.maxXPt - spec.minXPt) * options.renderScale;
  const sourceY = pageCanvas.height - spec.maxYPt * options.renderScale;
  const sourceH = (spec.maxYPt - spec.minYPt) * options.renderScale;
  const ratio = options.panelWidth / sourceW;
  const fitWidth = Math.max(1, Math.round(options.panelWidth));
  const fitHeight = Math.max(1, Math.round(sourceH * ratio));
  const crop = document.createElement("canvas");
  crop.width = fitWidth;
  crop.height = fitHeight;
  const cropContext = crop.getContext("2d", { willReadFrequently: true })!;
  cropContext.imageSmoothingEnabled = true;
  cropContext.drawImage(pageCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, fitWidth, fitHeight);
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
      renderScale: options.renderScale,
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

  const factor = options.workFactor;
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
  const highlightBox = assembly.highlightBounds(highlight) as PanelHighlightBox | null;

  // The camera fit reads azimuth, scale and phase off the panel's own stud
  // grid, and it cannot read the face: a projected square lattice is identical
  // from above and below, so the fitter returns the positive-elevation twin on
  // every panel including the flipped ones. The booklet's rotate-the-model icon
  // supplies that missing sign, and `viewForPanelFace` applies it.
  //
  // Both consumers of the fit take the corrected view, not just the renderer:
  // the arrow family is resolved against this projection too, so a face-blind
  // projection would convert the printed arrows into the wrong displacements
  // before any render happened.
  const faceCorrectedFit =
    fit.solution === null || spec.panelFace === null
      ? null
      : (assembly.viewForPanelFace(fit.solution, spec.panelFace) as PanelViewSolution);

  // A detected arrow is not yet a placement; converting it is what makes it
  // one. The booklet draws an exploded step by inking an arrow from clear of the
  // ghost to clear of the landing surface, so the drawn vector is shorter than
  // the travel by both gaps — measured at 0.00 to 0.47 of a stud on this
  // booklet, always the same way. `measureArrowClearances` reads those gaps off
  // the same pixels, `correctArrowForClearance` adds them back, and
  // `arrowDisplacementFamily` returns every whole-grid displacement whose
  // projection matches what is left.
  //
  // The count is the size of that family, not a claim that the family has one
  // member. On this projection several triples agree to within the measurement,
  // which is why the family is handed to the panel-scored search rather than
  // read as an answer; what it establishes is that the arrow constrains the
  // placement at all, which is exactly what the refusal asks for.
  //
  // The projection is built at the raster the arrow was measured on. The fit
  // above reads the stud lattice off the full-resolution crop, while
  // `readDisplacementArrows` reads `work.pixels` — the same crop downsampled by
  // `factor` — and every mask returned here is that size. Inverting a work-pixel
  // displacement through the full-resolution projection reported exactly
  // `factor` times too little travel; the renderer divides the same number
  // (`real-build-run.ts` and `real-build-deferred-step.ts` both build their view
  // at `pixelsPerUnit / workFactor`) and this path did not.
  const arrowFamily =
    faceCorrectedFit === null || arrows.displacementXPx === null || arrows.displacementYPx === null
      ? []
      : (() => {
          const projection = assembly.panelProjectionForWorkRaster(faceCorrectedFit, factor);
          const clearances = assembly.measureArrowClearances(arrows.arrows, {
            width,
            height,
            ghostStrokeMask: highlight.strokeMask,
            alreadyBuiltMask: built,
          }) as readonly {
            tailToGhostPx: number | null;
            headToBuiltPx: number | null;
          }[];
          const raw = {
            xPx: arrows.displacementXPx as number,
            yPx: arrows.displacementYPx as number,
          };
          const measured = clearances.filter(
            (entry) => entry.tailToGhostPx !== null && entry.headToBuiltPx !== null,
          );
          // A missing gap is treated as zero rather than guessed, which
          // under-corrects and leaves the answer where it was.
          const corrected =
            measured.length === 0
              ? raw
              : (assembly.correctArrowForClearance(raw, {
                  tailToGhostPx:
                    measured.reduce((sum, entry) => sum + entry.tailToGhostPx!, 0) /
                    measured.length,
                  headToBuiltPx:
                    measured.reduce((sum, entry) => sum + entry.headToBuiltPx!, 0) /
                    measured.length,
                }) as { xPx: number; yPx: number });
          return assembly.arrowDisplacementFamily(
            projection,
            corrected,
          ) as readonly ArrowDisplacement[];
        })();

  crop.width = 0;
  crop.height = 0;

  return {
    width,
    height,
    workPixels: work.pixels,
    fitSolution: (fit.solution as FittedPanelSolution | null) ?? null,
    fitFailure: fit.failure as string | null,
    fitCoherence: fit.coherence as number,
    faceCorrectedFit,
    highlight,
    highlightBox,
    builtMask: built,
    arrows,
    arrowFamily,
  };
}
