/**
 * Does the exploded-step reading survive a printed booklet?
 *
 * Two pieces built separately have never met. `camera-fit-lattice` recovers the
 * camera a printed panel was drawn with, from the panel's own stud grid.
 * `exploded-score` reads where a step's part went by differencing that step's
 * panel against the next one's — measured on a synthetic booklet where both
 * panels are rendered through one camera into one raster, so registration is
 * free by construction.
 *
 * A printed booklet does not give it away. Each panel is its own drawing in its
 * own cell of the page, redrawn at whatever zoom the model has grown to and
 * placed wherever the cell has room, and between two steps the booklet may turn
 * the model over entirely. So the first thing measured here is registration:
 * how far apart two consecutive panels' cameras are, whether a scale and a
 * shift can bring them onto one frame, and what is left over when they do. The
 * exploded score is only asked the question afterwards, on the pairs that
 * registered.
 *
 * The whole run lives in one function because `page.evaluate` serialises it.
 * The product logic it drives — keying, isolation, warping, the delta, the
 * score — is imported from the app, never transcribed here.
 */

import type {
  PairReport,
  PanelSpec,
  PanelSummary,
  PlacementReport,
  RealPanelRunOptions,
  RealPanelRunResult,
} from "./real-panel-types";

export const measureRealPanelRegistration = async ({
  pdfjsUrl,
  workerUrl,
  pdfUrl,
  latticeUrl,
  renderingUrl,
  assemblyUrl,
  renderScale,
  panelWidth,
  specs,
}: RealPanelRunOptions): Promise<RealPanelRunResult> => {
  const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
  const lattice = await import(/* @vite-ignore */ latticeUrl);
  const rendering = await import(/* @vite-ignore */ renderingUrl);
  const assembly = await import(/* @vite-ignore */ assemblyUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const started = performance.now();

  const BACKGROUND_HEX = rendering.INSTRUCTION_BACKGROUND_HEX as number;
  const data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
  const document_ = await pdfjs.getDocument({ data }).promise;

  let pageCanvas: HTMLCanvasElement | null = null;
  let pageNumberLoaded = -1;
  const loadPage = async (pageNumber: number): Promise<HTMLCanvasElement> => {
    if (pageCanvas && pageNumberLoaded === pageNumber) return pageCanvas;
    const pdfPage = await document_.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    pageCanvas = canvas;
    pageNumberLoaded = pageNumber;
    return canvas;
  };

  interface Panel {
    readonly spec: PanelSpec;
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8ClampedArray;
    readonly artMask: Uint8Array;
    readonly assemblyMask: Uint8Array;
    readonly highlight: {
      readonly mask: Uint8Array;
      readonly strokeMask: Uint8Array;
      readonly width: number;
      readonly height: number;
      readonly regions: readonly { areaPx: number; enclosedPx: number }[];
    };
    readonly fit: {
      azimuthDegrees: number;
      elevationDegrees: number;
      pixelsPerUnit: number;
      residualPx: number;
    } | null;
    readonly fitFailure: string | null;
    readonly summary: PanelSummary;
  }

  const preparePanel = async (spec: PanelSpec): Promise<Panel> => {
    const page = await loadPage(spec.pageNumber);
    const sourceX = spec.minXPt * renderScale;
    const sourceW = (spec.maxXPt - spec.minXPt) * renderScale;
    const sourceY = page.height - spec.maxYPt * renderScale;
    const sourceH = (spec.maxYPt - spec.minYPt) * renderScale;
    const ratio = panelWidth / sourceW;
    const width = Math.max(1, Math.round(panelWidth));
    const height = Math.max(1, Math.round(sourceH * ratio));
    const crop = document.createElement("canvas");
    crop.width = width;
    crop.height = height;
    const cropContext = crop.getContext("2d", { willReadFrequently: true })!;
    cropContext.imageSmoothingEnabled = true;
    cropContext.drawImage(page, sourceX, sourceY, sourceW, sourceH, 0, 0, width, height);
    const image = cropContext.getImageData(0, 0, width, height);
    const raster = { width, height, pixels: image.data };

    const artMask = assembly.keyPanelArt(raster, {
      backgroundHex: BACKGROUND_HEX,
      toleranceLevels: 10,
    }) as Uint8Array;
    // Everything the booklet prints on white — the callout box, a sub-assembly
    // box, the step number, the progress bar — is furniture, and a sub-assembly
    // box is tied to the model by a leader line, so the largest connected
    // component alone will not shed it.
    const furniture = assembly.keyPrintedBoxes(raster) as Uint8Array;
    for (let pixel = 0; pixel < furniture.length; pixel += 1) {
      if (furniture[pixel] === 1) artMask[pixel] = 0;
    }
    // The PDF's own callout boxes go too. They overlap the white ones above on
    // most pages and not on all, and this list is the authoritative one.
    for (const box of spec.calloutBoxes) {
      const minX = Math.max(0, Math.floor((box.minXPt * renderScale - sourceX) * ratio) - 4);
      const maxX = Math.min(width - 1, Math.ceil((box.maxXPt * renderScale - sourceX) * ratio) + 4);
      const minY = Math.max(
        0,
        Math.floor((page.height - box.maxYPt * renderScale - sourceY) * ratio) - 4,
      );
      const maxY = Math.min(
        height - 1,
        Math.ceil((page.height - box.minYPt * renderScale - sourceY) * ratio) + 4,
      );
      for (let y = minY; y <= maxY; y += 1) artMask.fill(0, y * width + minX, y * width + maxX + 1);
    }

    // No opening. Measured on this booklet at this width, cutting the art at a
    // radius of 3 first fragmented it into over a hundred pieces and left the
    // largest holding a sixth of the drawing, which then fitted a nonsense
    // camera. The plain largest component is what the camera fit was measured
    // with.
    const isolation = assembly.isolateAssembly({ width, height, mask: artMask });
    const highlight = assembly.extractHighlightRegions(image.data, width, height, {
      minimumOutlinePx: 40,
    });
    const field = lattice.buildStudTextureField(image.data, width, height, {
      backgroundHex: BACKGROUND_HEX,
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
    let artPx = 0;
    for (let pixel = 0; pixel < artMask.length; pixel += 1) if (artMask[pixel] === 1) artPx += 1;
    const enclosed = (highlight.regions as readonly { enclosedPx: number }[]).reduce<number>(
      (total, region) => total + region.enclosedPx,
      0,
    );
    const pxPerPoint = width / (spec.maxXPt - spec.minXPt);
    const accepted = fit.failure === null ? fit.solution : null;

    return {
      spec,
      width,
      height,
      pixels: image.data,
      artMask,
      assemblyMask: isolation.mask as Uint8Array,
      highlight,
      fit: accepted,
      fitFailure: fit.failure,
      summary: {
        stepNumber: spec.stepNumber,
        pageNumber: spec.pageNumber,
        widthPx: width,
        heightPx: height,
        pxPerPoint,
        artPx,
        assemblyPx: isolation.areaPx as number,
        assemblyComponents: isolation.componentCount as number,
        assemblyDroppedFraction: isolation.droppedFraction as number,
        highlightRegions: (highlight.regions as readonly unknown[]).length,
        assemblyBounds: isolation.bounds as {
          minXPx: number;
          minYPx: number;
          maxXPx: number;
          maxYPx: number;
        } | null,
        highlightEnclosedPx: enclosed,
        fit: accepted
          ? {
              azimuthDegrees: accepted.azimuthDegrees,
              elevationDegrees: accepted.elevationDegrees,
              pixelsPerUnit: accepted.pixelsPerUnit,
              pointsPerStud: accepted.pixelsPerUnit / pxPerPoint,
              residualPx: accepted.residualPx,
            }
          : null,
        fitFailure: fit.failure,
      },
    };
  };

  const orderedSpecs = [...specs].sort((left, right) => left.stepNumber - right.stepNumber);
  const summaries: PanelSummary[] = [];
  const pairs: PairReport[] = [];
  let previous: Panel | null = null;

  for (const spec of orderedSpecs) {
    let panel: Panel;
    try {
      panel = await preparePanel(spec);
    } catch (error) {
      previous = null;
      pairs.push({
        fromStep: spec.stepNumber - 1,
        toStep: spec.stepNumber,
        failure: `Step ${spec.stepNumber}'s panel could not be prepared: ${String(error)}`,
        bothFitted: false,
        azimuthDeltaDegrees: null,
        elevationDeltaDegrees: null,
        pointsPerStudDeltaFraction: null,
        latticeScaleRatio: null,
        alignment: null,
        shiftPt: null,
        scaleRatioEmpirical: null,
        scaleSource: "searched" as const,
        scaleAtSearchBoundary: false,
        uncoveredFractionOfCurrent: null,
        coverageOfCurrent: null,
        noise: null,
        differenceThresholdPx: null,
        boundary: null,
        delta: null,
        placement: null,
        overlayPng: null,
        placementPng: null,
      });
      continue;
    }
    summaries.push(panel.summary);

    if (previous !== null && previous.spec.stepNumber === spec.stepNumber - 1) {
      pairs.push(measurePair(previous, panel));
    }
    previous = panel;
  }

  function measurePair(current: Panel, next: Panel): PairReport {
    const base = {
      fromStep: current.spec.stepNumber,
      toStep: next.spec.stepNumber,
      bothFitted: current.fit !== null && next.fit !== null,
      azimuthDeltaDegrees:
        current.fit && next.fit ? next.fit.azimuthDegrees - current.fit.azimuthDegrees : null,
      elevationDeltaDegrees:
        current.fit && next.fit ? next.fit.elevationDegrees - current.fit.elevationDegrees : null,
      pointsPerStudDeltaFraction:
        current.summary.fit && next.summary.fit
          ? (next.summary.fit.pointsPerStud - current.summary.fit.pointsPerStud) /
            current.summary.fit.pointsPerStud
          : null,
      latticeScaleRatio:
        current.fit && next.fit ? current.fit.pixelsPerUnit / next.fit.pixelsPerUnit : null,
    };
    try {
      // With no fitted pair the scale is unknown, so the search starts at the
      // ratio of the two crops' own pixels per point — the only scale left that
      // is not invented.
      const scaleGuess =
        base.latticeScaleRatio ?? current.summary.pxPerPoint / next.summary.pxPerPoint;
      // With both cameras fitted the scale is measured, not guessed, and it is
      // held. Searching it is worse than useless here: the model grows between
      // the panels, so the next panel's silhouette contains this one's, and
      // region agreement is then maximised by shrinking the next panel until it
      // stops overhanging. On steps 2 to 3 that pinned the search at the bottom
      // of its range — 0.849 against a measured 0.924 — and produced a
      // confident, wrong registration.
      const alignment = assembly.alignPanelMasks(
        { width: next.width, height: next.height, mask: next.assemblyMask },
        { width: current.width, height: current.height, mask: current.assemblyMask },
        base.latticeScaleRatio === null
          ? { scaleGuess, scaleSpan: 0.08, scaleSteps: 13, coarseStridePx: 4, searchRadiusPx: 220 }
          : { scaleGuess, scaleSpan: 0, scaleSteps: 1, coarseStridePx: 4, searchRadiusPx: 220 },
      );

      const target = { width: current.width, height: current.height };
      const warpedPixels = assembly.warpRaster(
        { width: next.width, height: next.height, pixels: next.pixels },
        target,
        alignment.transform,
        BACKGROUND_HEX,
      ) as Uint8ClampedArray;
      const warpedAssembly = assembly.warpMask(
        { width: next.width, height: next.height, mask: next.assemblyMask },
        target,
        alignment.transform,
      ) as Uint8Array;
      const warpedHighlight = assembly.warpMask(
        { width: next.width, height: next.height, mask: next.highlight.mask },
        target,
        alignment.transform,
      ) as Uint8Array;
      const warpedStroke = assembly.warpMask(
        { width: next.width, height: next.height, mask: next.highlight.strokeMask },
        target,
        alignment.transform,
      ) as Uint8Array;

      const area = current.width * current.height;
      const both = new Uint8Array(area);
      const either = new Uint8Array(area);
      for (let pixel = 0; pixel < area; pixel += 1) {
        const inCurrent = current.assemblyMask[pixel] === 1;
        const inNext = warpedAssembly[pixel] === 1;
        if (inCurrent && inNext) both[pixel] = 1;
        if (inCurrent || inNext) either[pixel] = 1;
      }
      // The noise floor is read inside the model both panels drew, away from
      // its edge: an edge pixel differs because the two drawings' boundaries
      // land a fraction of a pixel apart, and a threshold set from those would
      // be set by the resampler.
      const interior = assembly.erodeMask(both, current.width, current.height, 3) as Uint8Array;
      const noise = assembly.measureDifferenceNoise(
        { width: current.width, height: current.height, pixels: current.pixels },
        { width: current.width, height: current.height, pixels: warpedPixels },
        interior,
      );
      // Fixed, deliberately. Fitting the threshold to the pair's own noise
      // hides the thing being measured: if two panels disagree by 500 over the
      // model they both drew, a threshold of 500 reports a clean difference and
      // says nothing. 24 is three grey levels a channel — clear of a resampled
      // edge on flat art, and two hundred short of the distance from page to
      // ink, which is what emergence turns on.
      const differenceThresholdPx = 24;

      // Everything outside the two assemblies is page furniture — callout box,
      // step number, progress bar, this step's ghost and its arrows — and a
      // difference there is not a placement. Painting it out is what lets the
      // real `panelDelta` run unchanged on a printed pair.
      //
      // Nothing the warped next panel fails to reach is evidence either.
      // `warpRaster` fills what it cannot cover with the page colour, so a
      // current-panel model pixel outside the next panel's footprint reads as
      // the model vanishing when all that happened is that the next panel's
      // crop ends there. On the worst-registered pairs of this booklet that is
      // half the frame.
      const footprint = assembly.warpMask(
        {
          width: next.width,
          height: next.height,
          mask: new Uint8Array(next.width * next.height).fill(1),
        },
        target,
        alignment.transform,
      ) as Uint8Array;
      const reached = rendering.dilateMask(either, current.width, current.height, 6) as Uint8Array;
      const evidence = new Uint8Array(area);
      let uncoveredPx = 0;
      for (let pixel = 0; pixel < area; pixel += 1) {
        if (footprint[pixel] !== 1) {
          if (current.assemblyMask[pixel] === 1) uncoveredPx += 1;
          continue;
        }
        evidence[pixel] = reached[pixel]!;
      }
      const maskedCurrent = new Uint8ClampedArray(current.pixels);
      const maskedNext = new Uint8ClampedArray(warpedPixels);
      for (let pixel = 0; pixel < area; pixel += 1) {
        if (evidence[pixel] === 1) continue;
        for (const buffer of [maskedCurrent, maskedNext]) {
          buffer[pixel * 4] = (BACKGROUND_HEX >> 16) & 0xff;
          buffer[pixel * 4 + 1] = (BACKGROUND_HEX >> 8) & 0xff;
          buffer[pixel * 4 + 2] = BACKGROUND_HEX & 0xff;
          buffer[pixel * 4 + 3] = 255;
        }
      }

      const delta = assembly.panelDelta(
        {
          width: current.width,
          height: current.height,
          pixels: maskedCurrent,
          highlight: current.highlight,
        },
        {
          width: current.width,
          height: current.height,
          pixels: maskedNext,
          highlight: {
            ...next.highlight,
            width: current.width,
            height: current.height,
            mask: warpedHighlight,
            strokeMask: warpedStroke,
          },
        },
        { backgroundHex: BACKGROUND_HEX, differenceThresholdPx },
      );

      const assemblyPx = Math.max(1, current.summary.assemblyPx);
      const enclosed = current.summary.highlightEnclosedPx;
      // How far the drawing sits from the drawing, in the two crops as cropped.
      // This is the registration a synthetic booklet is handed for nothing and a
      // printed one has to be given.
      const shiftPt = alignment.rawCentroidGapPx / current.summary.pxPerPoint;

      const boundaryGap = assembly.boundaryOffset(
        rendering.maskBoundary(current.assemblyMask, current.width, current.height),
        rendering.maskBoundary(warpedAssembly, current.width, current.height),
        current.width,
        current.height,
      );

      const placement = scorePlacement(current, delta);

      return {
        ...base,
        failure: null,
        boundary: {
          samples: boundaryGap.samples,
          medianPx: boundaryGap.medianPx,
          p90Px: boundaryGap.p90Px,
          matchedFraction: boundaryGap.matchedFraction,
          searchRadiusPx: boundaryGap.searchRadiusPx,
          medianStuds:
            current.fit && boundaryGap.medianPx !== null
              ? boundaryGap.medianPx / current.fit.pixelsPerUnit
              : null,
        },
        placement: placement.report,
        placementPng: placement.png,
        alignment: {
          scale: alignment.transform.scale,
          offsetXPx: alignment.transform.offsetXPx,
          offsetYPx: alignment.transform.offsetYPx,
          iou: alignment.iou,
          iouAtCentroids: alignment.iouAtCentroids,
          iouUnregistered: alignment.iouUnregistered,
          scaleCorrectionFraction: alignment.scaleCorrectionFraction,
          centroidCorrectionPx: alignment.centroidCorrectionPx,
          rawCentroidGapPx: alignment.rawCentroidGapPx,
        },
        shiftPt,
        scaleRatioEmpirical: alignment.transform.scale,
        scaleSource: base.latticeScaleRatio === null ? "searched" : "measured",
        scaleAtSearchBoundary: alignment.scaleAtSearchBoundary,
        uncoveredFractionOfCurrent:
          current.summary.assemblyPx === 0 ? null : uncoveredPx / current.summary.assemblyPx,
        coverageOfCurrent: (() => {
          let covered = 0;
          let total = 0;
          for (let pixel = 0; pixel < area; pixel += 1) {
            if (current.assemblyMask[pixel] !== 1) continue;
            total += 1;
            if (warpedAssembly[pixel] === 1) covered += 1;
          }
          return total === 0 ? null : covered / total;
        })(),
        noise,
        differenceThresholdPx,
        delta: {
          emergedPx: delta.emergedPx,
          changedPx: delta.changedPx,
          emergedFractionOfAssembly: delta.emergedPx / assemblyPx,
          changedFractionOfAssembly: delta.changedPx / assemblyPx,
          highlightEnclosedPx: enclosed,
          emergedOverHighlight: enclosed === 0 ? null : delta.emergedPx / enclosed,
        },
        overlayPng: paintOverlay(current, warpedAssembly, delta, alignment),
      };
    } catch (error) {
      return {
        ...base,
        failure: `Steps ${current.spec.stepNumber} to ${next.spec.stepNumber} could not be registered: ${String(error)}`,
        alignment: null,
        shiftPt: null,
        scaleRatioEmpirical: null,
        scaleSource: "searched" as const,
        scaleAtSearchBoundary: false,
        uncoveredFractionOfCurrent: null,
        coverageOfCurrent: null,
        noise: null,
        differenceThresholdPx: null,
        boundary: null,
        delta: null,
        placement: null,
        overlayPng: null,
        placementPng: null,
      };
    }
  }

  /**
   * Does the exploded score pick the right place, on a real panel?
   *
   * The candidate set is the printed silhouette translated across the fitted
   * grid; the score is the app's own `scoreExplodedStep` against the registered
   * delta; and the answer it is checked against is the red arrow the booklet
   * printed, which the score never sees. Everything that makes a step
   * unmeasurable — no arrow, an open highlight, no fitted camera — is reported
   * as a skip with its reason rather than dropped.
   */
  function scorePlacement(
    current: Panel,
    delta: { emergedMask: Uint8Array; changedMask: Uint8Array },
  ): { report: PlacementReport; png: string | null } {
    // A step skipped for a missing camera or an open highlight still printed
    // whatever arrows it printed, and the count of those is a finding in its own
    // right. Reporting zeros here made the census answer "how many steps got all
    // the way through" when the question was "how many steps print an arrow".
    let skipClearances: PlacementReport["clearances"] = [];
    let skipArrowsInsideAssembly = 0;
    let skipShortfallStuds: number | null = null;
    let reading: {
      arrows: readonly { tailXPx: number; tailYPx: number }[];
      rejected: readonly { reason: string }[];
      redPx: number;
      displacementXPx: number | null;
      displacementYPx: number | null;
      displacementSpreadPx: number | null;
      agreedArrows: number;
    } | null = null;
    const blank = (skipped: string): { report: PlacementReport; png: null } => ({
      report: {
        skipped,
        arrows: reading?.arrows.length ?? 0,
        arrowsRejected: reading?.rejected.map((entry) => entry.reason) ?? [],
        referenceEmergenceIou: null,
        referenceChangeIou: null,
        zeroOffsetRank: null,
        arrowTravelStuds: null,
        arrowDisplacementXPx: reading?.displacementXPx ?? null,
        arrowDisplacementYPx: reading?.displacementYPx ?? null,
        arrowSpreadPx: reading?.displacementSpreadPx ?? null,
        agreedArrows: reading?.agreedArrows ?? 0,
        referenceSnapPx: null,
        clearances: skipClearances,
        arrowsInsideAssembly: skipArrowsInsideAssembly,
        arrowShortfallStuds: skipShortfallStuds,
        silhouettePx: 0,
        silhouetteRegions: current.summary.highlightRegions,
        offeredTranslations: 0,
        scoredTranslations: 0,
        rejectedOffFrame: 0,
        rejectedUnsupported: 0,
        ranking: null,
        emergenceRank: null,
        changeRank: null,
        top: [],
      },
      png: null,
    });

    // The arrow has to leave this step's own highlight. Without that the reader
    // hands back a sub-build's internal arrow as the step's answer, which is
    // what step 47 did: three numbered sub-steps drawn on the open page above
    // the model, and the only arrow in the panel two inches from the assembly.
    const arrows = assembly.readDisplacementArrows(
      { width: current.width, height: current.height, pixels: current.pixels },
      {
        originMask: current.highlight.strokeMask,
        // Three stud pitches at this raster: an arrow is drawn clear of the
        // ghost, not touching it.
        originMarginPx: current.fit ? Math.round(3 * current.fit.pixelsPerUnit) : 120,
      },
    );
    reading = arrows;
    // Measured before the skips, not after. A step that prints a perfectly
    // good arrow and then fails for want of a fitted camera still printed it,
    // and reporting the arrow facts only for steps that got all the way
    // through made the census count the wrong thing twice over.
    // How much clearance the artist left at each end. An arrow is drawn from
    // clear of the ghost to clear of the landing surface, so tail-to-head is
    // shorter than the part's travel by the sum of the two gaps — and that sum
    // is the arrow's systematic error, readable off the same page. The tail is
    // measured against this step's own highlight stroke, which rings the ghost;
    // the head against the model that was already there, which is the assembly
    // with this step's highlight taken out of it.
    const alreadyBuilt = new Uint8Array(current.width * current.height);
    const claimed = rendering.dilateMask(
      current.highlight.strokeMask,
      current.width,
      current.height,
      3,
    ) as Uint8Array;
    for (let pixel = 0; pixel < alreadyBuilt.length; pixel += 1) {
      if (
        current.assemblyMask[pixel] === 1 &&
        claimed[pixel] !== 1 &&
        current.highlight.mask[pixel] !== 1
      ) {
        alreadyBuilt[pixel] = 1;
      }
    }
    const toGhost = assembly.distanceToMask(
      current.highlight.strokeMask,
      current.width,
      current.height,
    ) as Float64Array;
    const toBuilt = assembly.distanceToMask(
      alreadyBuilt,
      current.width,
      current.height,
    ) as Float64Array;
    const at = (field: Float64Array, x: number, y: number): number | null => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= current.width || py < 0 || py >= current.height) return null;
      const value = field[py * current.width + px]!;
      return Number.isFinite(value) ? value : null;
    };
    const clearances = (
      arrows.arrows as readonly {
        tailXPx: number;
        tailYPx: number;
        headXPx: number;
        headYPx: number;
        lengthPx: number;
      }[]
    ).map((arrow) => ({
      tailToGhostPx: at(toGhost, arrow.tailXPx, arrow.tailYPx),
      headToBuiltPx: at(toBuilt, arrow.headXPx, arrow.headYPx),
      lengthPx: arrow.lengthPx,
    }));
    const shortfallStuds = (() => {
      const both = clearances.filter(
        (entry) => entry.tailToGhostPx !== null && entry.headToBuiltPx !== null,
      );
      if (both.length === 0 || current.fit === null) return null;
      const total =
        both.reduce((sum, entry) => sum + entry.tailToGhostPx! + entry.headToBuiltPx!, 0) /
        both.length;
      return total / current.fit.pixelsPerUnit;
    })();

    // Whether the arrow is drawn on the model or on a sub-build strip beside it.
    // The origin test was supposed to separate those, and on this booklet it
    // does not: steps 47 and 48 draw their sub-builds as numbered panels above
    // a rule, and ring each sub-step in yellow exactly like a main step, so a
    // sub-build's arrow does start at something "this step highlighted". Where
    // the arrow sits relative to the assembly does separate them.
    const bounds = current.summary.assemblyBounds;
    const arrowsInsideAssembly =
      bounds === null
        ? 0
        : (arrows.arrows as readonly { tailXPx: number; tailYPx: number }[]).filter(
            (arrow) =>
              arrow.tailXPx >= bounds.minXPx - 40 &&
              arrow.tailXPx <= bounds.maxXPx + 40 &&
              arrow.tailYPx >= bounds.minYPx - 40 &&
              arrow.tailYPx <= bounds.maxYPx + 40,
          ).length;
    // Published from here, before any skip. A step that prints an arrow and
    // then fails for want of a camera still printed it, and these two are the
    // census the question is about.
    skipClearances = clearances;
    skipArrowsInsideAssembly = arrowsInsideAssembly;
    skipShortfallStuds = shortfallStuds;

    if (arrows.displacementXPx === null || arrows.displacementYPx === null) {
      return blank(
        `Step ${current.spec.stepNumber} printed ${arrows.redPx}px of red and no arrow survived the shape and origin tests, so there is no independent answer to rank against: ${arrows.rejected.map((entry: { reason: string }) => entry.reason).join("; ") || "no red at all"}`,
      );
    }
    if (current.fit === null) {
      return blank(
        `Step ${current.spec.stepNumber} has arrows but no fitted camera (${current.fitFailure ?? "no failure recorded"}), so the grid a part moves on is unknown and there are no candidates to rank.`,
      );
    }
    if (current.summary.highlightEnclosedPx === 0) {
      return blank(
        `Step ${current.spec.stepNumber} has arrows and a camera but its yellow highlight encloses nothing (${current.summary.highlightRegions} contour(s)), so the part's printed shape is unavailable and there is nothing to translate.`,
      );
    }

    // Half resolution, and this is what it costs. The sweep is a full pass over
    // the raster per candidate and full size is four times the work. What it
    // buys is paid for in resolution: the closest pair of candidate offsets is
    // 4 to 6 full pixels apart on this booklet's larger panels and 2 on its
    // smaller ones, so halving puts a small panel's closest candidates one pixel
    // apart and they stop being separable. Those are the panels whose rank has
    // to be read with the distance to the answer beside it.
    const factor = 2;
    const silhouette = assembly.downsampleMask(
      { width: current.width, height: current.height, mask: current.highlight.mask },
      factor,
    ) as { width: number; height: number; mask: Uint8Array };
    const built = assembly.downsampleMask(
      { width: current.width, height: current.height, mask: current.assemblyMask },
      factor,
    ) as { mask: Uint8Array };
    const smallDelta = {
      ...delta,
      width: silhouette.width,
      height: silhouette.height,
      emergedMask: (
        assembly.downsampleMask(
          { width: current.width, height: current.height, mask: delta.emergedMask },
          factor,
        ) as { mask: Uint8Array }
      ).mask,
      changedMask: (
        assembly.downsampleMask(
          { width: current.width, height: current.height, mask: delta.changedMask },
          factor,
        ) as { mask: Uint8Array }
      ).mask,
      evidenceMask: (
        assembly.downsampleMask(
          {
            width: current.width,
            height: current.height,
            mask: (delta as unknown as { evidenceMask: Uint8Array }).evidenceMask,
          },
          factor,
        ) as { mask: Uint8Array }
      ).mask,
      emergedPx: 0,
    };
    let smallEmerged = 0;
    for (const value of smallDelta.emergedMask) smallEmerged += value;
    smallDelta.emergedPx = smallEmerged;

    const basis = lattice.latticeBasisFromAxonometric(current.fit);
    const plateHeightUnits = 8 / 20;
    const up = {
      xPx: 0,
      yPx:
        (-current.fit.pixelsPerUnit *
          Math.cos((current.fit.elevationDegrees * Math.PI) / 180) *
          plateHeightUnits) /
        factor,
    };
    const translations = assembly.latticeTranslations({
      a: { xPx: basis.a.xPx / factor, yPx: basis.a.yPx / factor },
      b: { xPx: basis.b.xPx / factor, yPx: basis.b.yPx / factor },
      up,
      studRange: 6,
      plateRange: 6,
    }) as readonly { dxPx: number; dyPx: number }[];
    const sweep = assembly.scoreLatticeTranslations(
      silhouette,
      built.mask,
      translations,
      smallDelta,
      { builtContactMarginPx: 3 },
    );
    const ranking = assembly.rankAgainstReference(
      sweep,
      { xPx: arrows.displacementXPx / factor, yPx: arrows.displacementYPx / factor },
      current.fit.pixelsPerUnit / factor,
    );
    const scored = sweep.scored as readonly {
      translation: { dxPx: number; dyPx: number };
      score: { score: number; emergenceIou: number | null; changeIou: number };
    }[];
    const reference =
      ranking === null
        ? undefined
        : scored.find(
            (entry) =>
              entry.translation.dxPx === ranking.referenceDxPx &&
              entry.translation.dyPx === ranking.referenceDyPx,
          );
    const rankBy = (pick: (entry: (typeof scored)[number]) => number): number | null => {
      if (!reference) return null;
      return scored.filter((entry) => pick(entry) > pick(reference) + 1e-9).length;
    };
    const top = [...scored]
      .sort((left, right) => right.score.score - left.score.score)
      .slice(0, 5)
      .map((entry) => ({
        dxPx: entry.translation.dxPx * factor,
        dyPx: entry.translation.dyPx * factor,
        score: entry.score.score,
        emergenceIou: entry.score.emergenceIou,
        changeIou: entry.score.changeIou,
      }));

    return {
      report: {
        skipped: null,
        arrows: arrows.arrows.length,
        arrowsRejected: arrows.rejected.map((entry: { reason: string }) => entry.reason),
        arrowDisplacementXPx: arrows.displacementXPx,
        arrowDisplacementYPx: arrows.displacementYPx,
        arrowSpreadPx: arrows.displacementSpreadPx,
        agreedArrows: arrows.agreedArrows,
        referenceSnapPx: ranking?.referenceSnapPx ?? null,
        clearances,
        arrowsInsideAssembly,
        arrowShortfallStuds: shortfallStuds,
        silhouettePx: current.summary.highlightEnclosedPx,
        silhouetteRegions: current.summary.highlightRegions,
        offeredTranslations: sweep.offered,
        scoredTranslations: scored.length,
        rejectedOffFrame: sweep.rejectedOffFrame,
        rejectedUnsupported: sweep.rejectedUnsupported,
        ranking: ranking
          ? {
              candidates: ranking.candidates,
              bestScore: ranking.bestScore,
              referenceScore: ranking.referenceScore,
              referenceRank: ranking.referenceRank,
              tiedWithReference: ranking.tiedWithReference,
              margin: ranking.margin,
              bestToReferencePx: ranking.bestToReferencePx * factor,
              bestToReferenceStuds: ranking.bestToReferenceStuds,
              bestDxPx: ranking.bestDxPx * factor,
              bestDyPx: ranking.bestDyPx * factor,
              referenceDxPx: ranking.referenceDxPx * factor,
              referenceDyPx: ranking.referenceDyPx * factor,
            }
          : null,
        referenceEmergenceIou: reference?.score.emergenceIou ?? null,
        referenceChangeIou: reference?.score.changeIou ?? null,
        // Null rather than a first place: with nothing emerged every candidate
        // scores zero on that half, and reporting the tie as rank 1 would say the
        // emergence agreed when it had nothing to say.
        emergenceRank:
          smallDelta.emergedPx === 0 ? null : rankBy((entry) => entry.score.emergenceIou ?? 0),
        changeRank: rankBy((entry) => entry.score.changeIou),
        zeroOffsetRank: (() => {
          const zero = scored.find(
            (entry) => entry.translation.dxPx === 0 && entry.translation.dyPx === 0,
          );
          return zero === undefined
            ? null
            : scored.filter((entry) => entry.score.score > zero.score.score + 1e-9).length;
        })(),
        arrowTravelStuds:
          Math.hypot(arrows.displacementXPx, arrows.displacementYPx) / current.fit.pixelsPerUnit,
        top,
      },
      png:
        ranking === null
          ? null
          : paintPlacement(current, delta, arrows, {
              bestDxPx: ranking.bestDxPx * factor,
              bestDyPx: ranking.bestDyPx * factor,
              referenceDxPx: ranking.referenceDxPx * factor,
              referenceDyPx: ranking.referenceDyPx * factor,
              referenceRank: ranking.referenceRank,
              candidates: ranking.candidates,
              margin: ranking.margin,
            }),
    };
  }

  /** The step's picture with the two answers drawn on it, so a human can judge. */
  function paintPlacement(
    current: Panel,
    delta: { emergedMask: Uint8Array },
    arrows: {
      arrows: readonly {
        tailXPx: number;
        tailYPx: number;
        headXPx: number;
        headYPx: number;
      }[];
    },
    verdict: {
      bestDxPx: number;
      bestDyPx: number;
      referenceDxPx: number;
      referenceDyPx: number;
      referenceRank: number;
      candidates: number;
      margin: number;
    },
  ): string {
    const { width, height } = current;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + 46;
    const draw = canvas.getContext("2d")!;
    const out = draw.createImageData(width, height);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const at = pixel * 4;
      const grey = Math.round(
        0.45 *
          (current.pixels[at]! * 0.299 +
            current.pixels[at + 1]! * 0.587 +
            current.pixels[at + 2]! * 0.114),
      );
      out.data[at] = grey;
      out.data[at + 1] = grey;
      out.data[at + 2] = grey + (delta.emergedMask[pixel] === 1 ? 190 : 0);
      out.data[at + 3] = 255;
    }
    draw.putImageData(out, 0, 0);
    const stamp = (dx: number, dy: number, colour: string) => {
      draw.fillStyle = colour;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (current.highlight.mask[y * width + x] !== 1) continue;
          // Outline only: a filled stamp hides the emerged region underneath,
          // which is the thing the reader is being asked to compare it against.
          const edge =
            x === 0 ||
            y === 0 ||
            x === width - 1 ||
            y === height - 1 ||
            current.highlight.mask[y * width + x - 1] !== 1 ||
            current.highlight.mask[y * width + x + 1] !== 1 ||
            current.highlight.mask[(y - 1) * width + x] !== 1 ||
            current.highlight.mask[(y + 1) * width + x] !== 1;
          if (!edge) continue;
          draw.fillRect(x + dx, y + dy, 2, 2);
        }
      }
    };
    stamp(verdict.bestDxPx, verdict.bestDyPx, "rgba(90,230,255,0.95)");
    stamp(verdict.referenceDxPx, verdict.referenceDyPx, "rgba(255,110,200,0.95)");
    draw.strokeStyle = "#ffd23f";
    draw.lineWidth = 2;
    for (const arrow of arrows.arrows) {
      draw.beginPath();
      draw.moveTo(arrow.tailXPx, arrow.tailYPx);
      draw.lineTo(arrow.headXPx, arrow.headYPx);
      draw.stroke();
    }
    draw.fillStyle = "#05070a";
    draw.fillRect(0, height, width, 46);
    draw.font = "13px monospace";
    draw.fillStyle = "#e8f6ff";
    draw.fillText(
      `step ${current.spec.stepNumber}   arrow-implied placement ranked ${verdict.referenceRank + 1} of ${verdict.candidates}   margin ${verdict.margin.toFixed(4)}`,
      10,
      height + 18,
    );
    draw.fillStyle = "#9fd0ff";
    draw.fillText(
      `cyan = top of the exploded score, pink = where the printed arrows point, blue = what emerged between the panels`,
      10,
      height + 36,
    );
    return canvas.toDataURL("image/png");
  }

  function paintOverlay(
    current: Panel,
    warpedAssembly: Uint8Array,
    delta: { emergedMask: Uint8Array; changedMask: Uint8Array; emergedPx: number },
    alignment: { iou: number; transform: { scale: number } },
  ): string {
    const { width, height } = current;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + 46;
    const draw = canvas.getContext("2d")!;
    const out = draw.createImageData(width, height);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const at = pixel * 4;
      const grey = Math.round(
        0.2 *
          (current.pixels[at]! * 0.299 +
            current.pixels[at + 1]! * 0.587 +
            current.pixels[at + 2]! * 0.114),
      );
      // This panel's assembly in red, the next panel's in green: where the two
      // registered, both channels are on and the model reads yellow; where they
      // did not, a red fringe faces a green one and the width of the fringe is
      // the misregistration, in pixels, visible without a number.
      const inCurrent = current.assemblyMask[pixel] === 1;
      const inNext = warpedAssembly[pixel] === 1;
      out.data[at] = grey + (inCurrent ? 150 : 0);
      out.data[at + 1] = grey + (inNext ? 150 : 0);
      out.data[at + 2] = grey + (delta.emergedMask[pixel] === 1 ? 220 : 0);
      out.data[at + 3] = 255;
    }
    draw.putImageData(out, 0, 0);
    draw.fillStyle = "#05070a";
    draw.fillRect(0, height, width, 46);
    draw.font = "13px monospace";
    draw.fillStyle = "#e8f6ff";
    draw.fillText(
      `steps ${current.spec.stepNumber}-${current.spec.stepNumber + 1}   assembly agreement ${(alignment.iou * 100).toFixed(1)}%   scale x${alignment.transform.scale.toFixed(4)}`,
      10,
      height + 18,
    );
    draw.fillStyle = "#9fd0ff";
    draw.fillText(
      `red = step N model, green = step N+1 model warped onto it, blue = emerged (${delta.emergedPx}px)`,
      10,
      height + 36,
    );
    return canvas.toDataURL("image/png");
  }

  await document_.destroy();
  return {
    schemaVersion: "lego.real-panel-registration/1",
    panels: summaries,
    pairs,
    elapsedMs: Math.round(performance.now() - started),
  };
};
