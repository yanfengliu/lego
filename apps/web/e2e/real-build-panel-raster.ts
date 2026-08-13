import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import type { ArrowDisplacement } from "./real-build-panel-camera-registration";
export type { ArrowDisplacement } from "./real-build-panel-camera-registration";
import type { PanelArtStages } from "../src/assembly/panel-art-stages";
import {
  createPanelArrowCameraEvidence,
  createPanelViewSolution,
  createRawPanelArrowMeasurement,
  type PanelArrowCameraEvidence,
  type PanelViewSolution,
} from "./real-build-panel-arrow-evidence";
export type {
  PanelArrowCameraEvidence,
  PanelViewSolution,
  RawPanelArrowMeasurement,
  RealBuildArrowFamilyAssembly,
} from "./real-build-panel-arrow-evidence";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import {
  inspectRealBuildPanelCropGeometry,
  mappedPanelCalloutRectangles,
  type PageCanvas,
} from "./real-build-panel-raster-geometry";
import {
  createRealBuildPanelCalibrationHighRgbaSnapshot,
  type RealBuildPanelCalibrationHighRgbaSnapshot,
} from "./real-build-panel-raster-calibration-snapshot";
export {
  inspectRealBuildPanelCropGeometry,
  mappedPanelCalloutRectangles,
  MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS,
  renderRealBuildPageCanvas,
  type PageCanvas,
} from "./real-build-panel-raster-geometry";

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

export interface FittedPanelSolution extends PanelViewSolution {
  readonly residualPx: number;
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
  /** Caller-requested storage-integrity copy only; it authenticates no source or provenance. */
  readonly calibrationHighRgba?: RealBuildPanelCalibrationHighRgbaSnapshot;
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
    /** Keyed pixels of the contours the extraction kept, without its noise. */
    readonly contourStrokeMask: Uint8Array;
  };
  readonly highlightBox: PanelHighlightBox | null;
  /**
   * Inspection-only high-first/downsample-first source stages. Production always
   * emits them; optional only for legacy hand-built evidence.
   */
  readonly sourceArtStages?: PanelArtStages;
  /**
   * The isolated full assembly at the work raster, before this panel's
   * highlight is removed. Production derivation always retains it; it is
   * optional only for hand-built test evidence that predates source-mask
   * parity measurement.
   */
  readonly assemblyMask?: Uint8Array;
  /** The panel's art minus this step's highlight: everything already built. */
  readonly builtMask: Uint8Array;
  readonly arrows: {
    readonly arrows: readonly unknown[];
    readonly rejected: readonly unknown[];
    readonly redPx: number;
  };
  /**
   * Raw facts retained so a later panel-camera registration can derive its own family.
   * Optional only while hand-built test evidence predating this field remains;
   * production derivation always writes either frozen panel-camera evidence or null.
   */
  readonly panelArrowCameraEvidence?: PanelArrowCameraEvidence | null;
  /** Transitional q0/as-fitted family kept until every consumer is registration-qualified. */
  readonly arrowFamily: readonly ArrowDisplacement[];
}

export function derivePanelRasterEvidence(input: {
  readonly pageCanvas: PageCanvas;
  readonly spec: RealBuildPanelSpec;
  readonly options: Pick<
    RealBuildOptions,
    "renderScale" | "panelWidth" | "workFactor" | "proximityMarginPx"
  >;
  readonly modules: Pick<PreparedRealBuildModules, "lattice" | "assembly">;
  readonly retainCalibrationHighRgba?: boolean;
}): PanelRasterEvidence {
  const { pageCanvas, spec, options, modules, retainCalibrationHighRgba } = input;
  if (retainCalibrationHighRgba !== undefined && typeof retainCalibrationHighRgba !== "boolean") {
    throw new TypeError(
      "Panel-raster retainCalibrationHighRgba must be an exact boolean when calibration requests the high RGBA snapshot.",
    );
  }
  const { lattice, assembly } = modules;
  const {
    stepNumber,
    panelFace,
    sourceX,
    sourceW,
    sourceY,
    sourceH,
    ratio,
    fitWidth,
    fitHeight,
    renderScale,
    workFactor,
    pageHeight,
    calloutBoxes,
  } = inspectRealBuildPanelCropGeometry(pageCanvas.width, pageCanvas.height, spec, options);
  const derivePanelArtStages = assembly.derivePanelArtStages as unknown;
  if (typeof derivePanelArtStages !== "function") {
    throw new TypeError(
      "Prepared real-build assembly module must expose derivePanelArtStages before panel raster evidence can retain inspection-only source stages.",
    );
  }
  const crop = document.createElement("canvas");
  try {
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
    const calibrationHighRgba =
      retainCalibrationHighRgba === true
        ? createRealBuildPanelCalibrationHighRgbaSnapshot(fitImage.data, fitWidth, fitHeight)
        : undefined;

    const fitRaster = { width: fitWidth, height: fitHeight, pixels: fitImage.data };
    const sourceArtStages = derivePanelArtStages({
      raster: fitRaster,
      workFactor,
      backgroundHex: 0x899093,
      backgroundToleranceLevels: 10,
      calloutRectangles: mappedPanelCalloutRectangles({
        width: fitWidth,
        height: fitHeight,
        renderScale,
        sourceXPx: sourceX,
        sourceYPx: sourceY,
        ratio,
        pageHeightPx: pageHeight,
        boxes: calloutBoxes,
      }),
    }) as PanelArtStages;
    const isolation = { mask: sourceArtStages.highLegacySelectedMask } as const;

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

    const factor = workFactor;
    const work = assembly.downsampleRaster(fitRaster, factor) as {
      width: number;
      height: number;
      pixels: Uint8ClampedArray;
    };
    const width = work.width;
    const height = work.height;
    const highlight = assembly.extractHighlightRegions(work.pixels, width, height, {
      minimumOutlinePx: Math.max(10, Math.round(40 / factor)),
      maximumAggregateCandidateMaskPixels: 64 * width * height,
    });
    // The inspection trace is intentionally mutable byte data. Do not let a
    // later trace consumer mutate the production assembly/built-mask input.
    const workIsolation = {
      mask: new Uint8Array(sourceArtStages.isolateThenDownsampleMask),
    } as const;
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
    // These are accessors on an untrusted runtime module result. Retain the two
    // scalars together before `highlightBounds`, `viewForPanelFace`, projection,
    // or ceiling callbacks can change what a second read would mean.
    const arrowDisplacementXPx = arrows.displacementXPx as unknown;
    const arrowDisplacementYPx = arrows.displacementYPx as unknown;
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
      fit.solution === null || panelFace === null
        ? null
        : createPanelViewSolution(assembly.viewForPanelFace(fit.solution, panelFace));

    // A detected arrow is not yet a placement; converting it is what makes it
    // one. The arrow states a line and a floor rather than a vector: its two ends
    // are inked *inside* the ghost and *inside* the model — measured on panel 2 of
    // this booklet, where both tails sit in the highlight region and both heads in
    // the already-built art — so it stops at the model's visible surface while the
    // seat it heads for is behind it. What bounds the travel above is measured off
    // the same panel by `measureArrowTravelCeiling`: the part cannot pass clean
    // through the model it is joining. `arrowTravelFamily` returns every
    // whole-grid displacement inside that window.
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
    const arrowDerivation =
      faceCorrectedFit === null || arrowDisplacementXPx === null || arrowDisplacementYPx === null
        ? null
        : (() => {
            const arrowVector = createRawPanelArrowMeasurement({
              displacementXPx: arrowDisplacementXPx,
              displacementYPx: arrowDisplacementYPx,
              // A temporary upper bound validates and snapshots the vector before
              // callbacks. Negative infinity is the real empty-built-mask sentinel,
              // so the measurement contract deliberately admits it.
              travelCeilingPx: Number.NEGATIVE_INFINITY,
              workFactor: factor,
            });
            // Preserve the legacy callback order while retaining the inputs: the
            // q0 projection was built before the ceiling was measured.
            const projection = assembly.panelProjectionForWorkRaster(faceCorrectedFit, factor);
            const drawn = Object.freeze({
              xPx: arrowVector.displacementXPx,
              yPx: arrowVector.displacementYPx,
            });
            const ceiling = assembly.measureArrowTravelCeiling(arrows.arrows, drawn, {
              width,
              height,
              mask: built,
            }) as { ceilingPx: number };
            return {
              drawn,
              projection,
              measurement: createRawPanelArrowMeasurement({
                displacementXPx: drawn.xPx,
                displacementYPx: drawn.yPx,
                travelCeilingPx: ceiling.ceilingPx,
                workFactor: factor,
              }),
            };
          })();
    const panelArrowCameraEvidence =
      arrowDerivation === null
        ? null
        : createPanelArrowCameraEvidence({
            panelStepNumber: stepNumber,
            faceCorrectedFit,
            measurement: arrowDerivation.measurement,
          });

    // Keep the existing q0/as-fitted family byte-for-byte in place while the
    // candidate, lookahead, and farther-panel paths migrate together. New code
    // derives from the panel-bound evidence only after selecting its registration.
    const arrowFamily =
      arrowDerivation === null
        ? []
        : (assembly.arrowTravelFamily(
            arrowDerivation.projection,
            arrowDerivation.drawn,
            arrowDerivation.measurement.travelCeilingPx,
          ) as readonly ArrowDisplacement[]);

    return {
      width,
      height,
      workPixels: new Uint8ClampedArray(work.pixels),
      ...(calibrationHighRgba === undefined ? {} : { calibrationHighRgba }),
      fitSolution: (fit.solution as FittedPanelSolution | null) ?? null,
      fitFailure: fit.failure as string | null,
      fitCoherence: fit.coherence as number,
      faceCorrectedFit,
      highlight: {
        ...highlight,
        mask: new Uint8Array(highlight.mask),
        strokeMask: new Uint8Array(highlight.strokeMask),
        contourStrokeMask: new Uint8Array(highlight.contourStrokeMask),
      },
      highlightBox,
      sourceArtStages,
      assemblyMask: workIsolation.mask,
      builtMask: new Uint8Array(built),
      arrows,
      panelArrowCameraEvidence,
      arrowFamily,
    };
  } finally {
    crop.width = 0;
    crop.height = 0;
    crop.remove();
  }
}
