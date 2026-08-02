import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { readSampleBooklet, sampleBookletCallouts, sampleBookletPanels } from "./booklet-fixture";
import { measureRealPanelRegistration } from "./real-panel-scoring";
import type { PairReport } from "./real-panel-types";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import { ASSEMBLY_MODULE_URL, RENDERING_MODULE_URL, workspaceModuleUrl } from "./workspace-module";

/**
 * Can two consecutive printed panels be brought onto one frame?
 *
 * `panelDelta` reads where an exploded step's part went by differencing step N's
 * picture against step N+1's, and on the synthetic booklet it was measured on,
 * both panels come out of one camera into one raster. A printed booklet gives
 * nothing of the sort, and the previous session flagged registration as the
 * assumption most likely to break. So it is measured first, on its own, before
 * any score is asked to mean anything.
 *
 * Three numbers come out of it. How far the two panels' fitted cameras are apart
 * — that is the booklet turning the model over, or not. How far the drawing
 * itself moved and rescaled between the pages — that is the shift a synthetic
 * booklet never has. And what is left after the best scale and shift are
 * applied: the agreement of the two assemblies, the distance between their own
 * outlines, and the difference the two panels show on pixels where nothing
 * changed at all, which is the floor any placement signal has to clear.
 *
 * Then, and only on the pairs that registered, the score itself. The candidates
 * are the step's own printed silhouette translated across the fitted stud grid;
 * the score is the app's `scoreExplodedStep`; and the answer it is checked
 * against is the red arrow the booklet printed, which the score never reads.
 * Every step where that question is not well posed — no arrow, an arrow
 * belonging to a sub-build drawn in the same panel, no fitted camera, no closed
 * highlight — is reported as a skip with its reason rather than dropped, because
 * how few steps survive is itself one of the findings.
 */
const OUT = "output/real-panel-scoring";
const LAST_STEP = 50;
/** The same page scale and crop width the camera fit was measured at. */
const RENDER_SCALE = 6;
const PANEL_WIDTH = 1000;

const LATTICE_MODULE_URL = workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts");

test("registers consecutive printed panels onto one frame", async ({ page }) => {
  test.setTimeout(3_600_000);
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

  // The dev server is shared with whatever else is being edited in this
  // workspace, and vite's HMR client reloads the page on any module change —
  // which destroys a long-running probe's execution context mid-measurement.
  // Stubbing the socket before the page loads leaves the module graph exactly
  // as it was served and the probe uninterruptible.
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: function StubSocket() {
        return {
          readyState: 3,
          addEventListener: () => {},
          removeEventListener: () => {},
          send: () => {},
          close: () => {},
        };
      },
    });
  });
  await page.goto("/");
  const result = await page.evaluate(measureRealPanelRegistration, {
    ...bookletProbeUrls(),
    latticeUrl: LATTICE_MODULE_URL,
    renderingUrl: RENDERING_MODULE_URL,
    assemblyUrl: ASSEMBLY_MODULE_URL,
    renderScale: RENDER_SCALE,
    panelWidth: PANEL_WIDTH,
    specs: panels.map((panel) => ({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.bounds.minXPt,
      maxXPt: panel.bounds.maxXPt,
      minYPt: panel.bounds.minYPt,
      maxYPt: panel.bounds.maxYPt,
      calloutBoxes: callouts
        .filter(
          (callout) =>
            callout.pageNumber === panel.pageNumber && callout.stepNumber === panel.stepNumber,
        )
        .map(({ box }) => box),
    })),
  });

  for (const pair of result.pairs) {
    const name = `${String(pair.fromStep).padStart(3, "0")}-${String(pair.toStep).padStart(3, "0")}`;
    if (pair.overlayPng !== null) {
      writeFileSync(
        `${OUT}/pair-${name}.png`,
        Buffer.from(pair.overlayPng.split(",")[1]!, "base64"),
      );
    }
    if (pair.placementPng !== null) {
      writeFileSync(
        `${OUT}/placement-${name}.png`,
        Buffer.from(pair.placementPng.split(",")[1]!, "base64"),
      );
    }
  }

  const median = (values: readonly number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)]!;
  };
  const of = <T>(pairs: readonly PairReport[], pick: (pair: PairReport) => T | null | undefined) =>
    pairs.map(pick).filter((value): value is T => value !== null && value !== undefined);

  const registered = result.pairs.filter((pair) => pair.alignment !== null);
  // A camera the booklet held from one step to the next. Beyond three degrees
  // it turned the model over, and no scale and shift can carry one panel onto
  // the other — the pair is unregisterable by construction, not by failure.
  const sameCamera = registered.filter(
    (pair) =>
      pair.bothFitted &&
      Math.abs(pair.azimuthDeltaDegrees!) < 3 &&
      Math.abs(pair.elevationDeltaDegrees!) < 3,
  );
  const turned = registered.filter(
    (pair) =>
      pair.bothFitted &&
      (Math.abs(pair.azimuthDeltaDegrees!) >= 3 || Math.abs(pair.elevationDeltaDegrees!) >= 3),
  );

  // Every pair whose step printed an arrow, fitted a camera and closed a
  // highlight: the ones where the exploded score could be asked the question
  // and checked against something it never saw.
  const scored = result.pairs.filter((pair) => pair.placement?.ranking != null);
  // Every step whose arrow survived the shape and origin tests, whether or not
  // the rest of the question was answerable. This is the population an
  // arrow-reading approach would have to work with, and it is the number to
  // quote rather than the scored three.
  const withArrow = result.pairs.filter(
    (pair) => pair.placement !== null && pair.placement.arrowDisplacementXPx !== null,
  );
  // The subset whose arrow is drawn on the model rather than on a sub-build
  // strip beside it. That is the population an arrow-reading approach actually
  // has, and it is smaller than the count of steps that print an arrow.
  const withModelArrow = withArrow.filter((pair) => pair.placement!.arrowsInsideAssembly > 0);
  const withArrowRejected = result.pairs.filter(
    (pair) =>
      pair.placement?.skipped != null && /printed [1-9]\d*px of red/.test(pair.placement.skipped),
  );
  const rankDistribution = Object.fromEntries(
    [...new Set(scored.map((pair) => pair.placement!.ranking!.referenceRank))]
      .sort((left, right) => left - right)
      .map((rank) => [
        `rank ${rank + 1}`,
        scored.filter((pair) => pair.placement!.ranking!.referenceRank === rank).length,
      ]),
  );

  const score = {
    schemaVersion: result.schemaVersion,
    source: "recipes/6651557.pdf",
    legend: {
      shiftPt:
        "How far apart the two panels draw their model, as their assembly centroids sit in the crops as cropped, in the booklet's own points. It is the registration a synthetic booklet is handed for free and a printed one has to be given; it is measured before any transform, so it is not a residual.",
      scaleRatioEmpirical:
        "What the next panel had to be scaled by to land on this one. One means the booklet drew both steps at the same zoom.",
      iou: "Agreement of the two panels' assembly silhouettes at the best scale and shift. The assembly grew by a part between them, so it cannot reach one.",
      iouUnregistered:
        "The same agreement with no transform at all, which is what `panelDelta` would have got had the panels been handed to it as cropped.",
      noise:
        "How far apart the two panels' pixels are inside the model both drew, three pixels in from its edge. The p99 is what a difference threshold has to clear before a placement can be read out of the difference.",
      displacementFamily:
        "How many whole-grid displacements the arrow admits, against the roughly two thousand a blind sweep of the same grid offers. The tolerance sits under half a plate deliberately: a plate projects to about a third of a stud, so anything wider admits the neighbouring height and the family stops meaning anything.",
      arrowShortfallStuds:
        "How much shorter an arrow is than the travel it describes, as its tail's gap from the ghost's outline plus its head's gap from the model already there, in stud pitches. It is the arrow's systematic error; the spread between arrows on one step is its precision, and the two are different things.",
      referenceRank:
        "Distinct pixel offsets that outscored the one the printed red arrows point at. Zero is a first place. The arrows are the only statement of the answer on the page that the score does not itself read, and they are good to about half a stud.",
      bestToReferenceStuds:
        "How far the top-scoring offset sits from the arrow-implied one, in stud pitches. This is the number that says whether the score was right, because a rank can be first for the wrong reason when candidates are near-duplicates.",
      boundary:
        "How far the two aligned drawings' own outlines sit apart, as a median over the outline of the model both panels drew. The synthetic booklet's score was stress-tested at two pixels of misregistration; this is the printed pair's. Null where the median outline pixel found no counterpart inside the search radius, which is a failure to register rather than a large distance — read matchedFraction beside it.",
      scaleSource:
        "Whether the scale was measured from the two panels' camera fits and held, or searched. A searched scale is biased low: the model grows between the panels, so shrinking the next one raises the overlap, and scaleAtSearchBoundary says when the winner sat on the wall of the range rather than at a turning point.",
      uncoveredFractionOfCurrent:
        "Share of this panel's model the next panel's warped frame does not reach. Those pixels are dropped from the evidence, because a crop that ends is not a part that vanished.",
      agreedArrows:
        "How many arrows the displacement is averaged over. One is a statement by one arrow, not a corroborated one, and its spread is zero either way.",
      referenceSnapPx:
        "How far the arrows' answer sat from the nearest candidate offset before it was snapped to one. A large value means the rank describes a placement nobody proposed.",
      emergedOverHighlight:
        "Emerged pixels over the area this step's own yellow highlight encloses. One part appeared between the panels, so a value far above one is registration fringe rather than a placement.",
    },
    lastStep: LAST_STEP,
    renderScale: RENDER_SCALE,
    panelWidthPx: PANEL_WIDTH,
    elapsedMs: result.elapsedMs,
    panelsPrepared: result.panels.length,
    panelsFitted: result.panels.filter((panel) => panel.fit !== null).length,
    pairsTried: result.pairs.length,
    pairsRegistered: registered.length,
    pairsSameCamera: sameCamera.length,
    pairsCameraTurned: turned.length,
    medianShiftPt: median(of(registered, (pair) => pair.shiftPt)),
    maxShiftPt: Math.max(0, ...of(registered, (pair) => pair.shiftPt)),
    medianScaleRatio: median(of(registered, (pair) => pair.scaleRatioEmpirical)),
    medianIou: median(of(registered, (pair) => pair.alignment!.iou)),
    medianIouUnregistered: median(of(registered, (pair) => pair.alignment!.iouUnregistered)),
    medianIouSameCamera: median(of(sameCamera, (pair) => pair.alignment!.iou)),
    medianIouTurned: median(of(turned, (pair) => pair.alignment!.iou)),
    medianNoiseP99: median(of(registered, (pair) => pair.noise!.p99Distance)),
    // Only over the pairs whose outlines actually found each other. A pair that
    // did not register has no gap, and folding its saturated bucket into the
    // median would report a failure as a distance.
    medianOutlineGapPx: median(of(registered, (pair) => pair.boundary?.medianPx)),
    pairsWithMeasuredOutlineGap: of(registered, (pair) => pair.boundary?.medianPx).length,
    medianUncoveredFraction: median(of(registered, (pair) => pair.uncoveredFractionOfCurrent)),
    pairsWithScaleAtSearchBoundary: registered.filter((pair) => pair.scaleAtSearchBoundary).length,
    pairsWithSearchedScale: registered.filter((pair) => pair.scaleSource === "searched").length,
    medianDifferenceThresholdPx: median(of(registered, (pair) => pair.differenceThresholdPx)),
    medianEmergedOverHighlight: median(
      of(sameCamera, (pair) => pair.delta?.emergedOverHighlight ?? null),
    ),
    medianEmergedFractionOfAssembly: median(
      of(sameCamera, (pair) => pair.delta?.emergedFractionOfAssembly ?? null),
    ),
    panels: result.panels,
    scored,
    rankDistribution,
    medianMargin: median(scored.map((pair) => pair.placement!.ranking!.margin)),
    medianBestToReferenceStuds: median(
      scored.map((pair) => pair.placement!.ranking!.bestToReferenceStuds),
    ),
    stepsWithSurvivingArrow: withArrow.length,
    stepsWithSurvivingArrowList: withArrow.map((pair) => pair.fromStep),
    stepsWithArrowOnTheModel: withModelArrow.length,
    stepsWithArrowOnTheModelList: withModelArrow.map((pair) => pair.fromStep),
    stepsWhoseRedWasAllRejected: withArrowRejected.length,
    medianArrowShortfallStuds: median(of(withArrow, (pair) => pair.placement!.arrowShortfallStuds)),
    medianArrowSpreadPx: median(of(withArrow, (pair) => pair.placement!.arrowSpreadPx)),
    medianDisplacementFamilyRaw: median(
      of(withModelArrow, (pair) => pair.placement!.displacementFamily?.rawSize ?? null),
    ),
    medianDisplacementFamilyCorrected: median(
      of(withModelArrow, (pair) => pair.placement!.displacementFamily?.correctedSize ?? null),
    ),
    firstPlace: scored.filter((pair) => pair.placement!.ranking!.referenceRank === 0).length,
    medianArrowTravelStuds: median(
      scored.map((pair) => pair.placement!.arrowTravelStuds ?? Number.NaN),
    ),
    zeroOffsetWonOn: scored.filter((pair) => pair.placement!.zeroOffsetRank === 0).length,
    withinOneStud: scored.filter((pair) => pair.placement!.ranking!.bestToReferenceStuds <= 1)
      .length,
    skippedPlacements: result.pairs
      .filter((pair) => pair.placement?.skipped != null)
      .map((pair) => ({ step: pair.fromStep, why: pair.placement!.skipped })),
    // The images are written out beside this file; carrying their bytes into
    // the JSON as well would make it unreadable and unopenable.
    pairs: result.pairs.map((pair) => ({
      ...pair,
      overlayPng:
        pair.overlayPng === null
          ? null
          : `pair-${String(pair.fromStep).padStart(3, "0")}-${String(pair.toStep).padStart(3, "0")}.png`,
      placementPng:
        pair.placementPng === null
          ? null
          : `placement-${String(pair.fromStep).padStart(3, "0")}-${String(pair.toStep).padStart(3, "0")}.png`,
    })),
  };
  writeFileSync(`${OUT}/score.json`, JSON.stringify(score, null, 1));

  console.log(
    `panels ${score.panelsPrepared} (${score.panelsFitted} fitted); pairs ${score.pairsRegistered}/${score.pairsTried} registered, ` +
      `${score.pairsSameCamera} same camera, ${score.pairsCameraTurned} turned over`,
  );
  console.log(
    `shift median ${score.medianShiftPt?.toFixed(2) ?? "-"}pt max ${score.maxShiftPt.toFixed(2)}pt; ` +
      `scale median x${score.medianScaleRatio?.toFixed(4) ?? "-"}; ` +
      `assembly agreement ${((score.medianIou ?? 0) * 100).toFixed(1)}% (unregistered ${((score.medianIouUnregistered ?? 0) * 100).toFixed(1)}%); ` +
      `noise p99 ${score.medianNoiseP99 ?? "-"}; ` +
      `outline gap median ${median(of(registered, (pair) => pair.boundary?.medianPx))?.toFixed(1) ?? "-"}px over ${of(registered, (pair) => pair.boundary?.medianPx).length} of ${registered.length} pairs; ` +
      `emerged/highlight ${score.medianEmergedOverHighlight?.toFixed(2) ?? "-"}`,
  );
  console.log(
    `arrows survived shape+origin on ${score.stepsWithSurvivingArrow} step(s): ${score.stepsWithSurvivingArrowList.join(",")}; ` +
      `${score.stepsWithArrowOnTheModel} of those draw it on the model rather than on a sub-build strip (${score.stepsWithArrowOnTheModelList.join(",")}); ` +
      `${score.stepsWhoseRedWasAllRejected} printed red that was all rejected; ` +
      `median arrow shortfall ${score.medianArrowShortfallStuds?.toFixed(2) ?? "-"} studs, spread ${score.medianArrowSpreadPx?.toFixed(1) ?? "-"}px`,
  );
  for (const pair of withArrow) {
    const pl = pair.placement!;
    console.log(
      `  step ${String(pair.fromStep).padStart(2)}: ${pl.agreedArrows}/${pl.arrows} arrows, ${pl.arrowsInsideAssembly} on the model, ` +
        `family ${pl.displacementFamily ? `${pl.displacementFamily.rawSize} raw / ${pl.displacementFamily.correctedSize} corrected of ~2000 blind` : "no camera"}, ` +
        `shortfall ${pl.arrowShortfallStuds?.toFixed(2) ?? "-"} studs, spread ${pl.arrowSpreadPx?.toFixed(1) ?? "-"}px, ` +
        `clearances ${pl.clearances.map((c) => `${c.tailToGhostPx?.toFixed(0) ?? "-"}+${c.headToBuiltPx?.toFixed(0) ?? "-"}/${c.lengthPx.toFixed(0)}`).join(" ")}`,
    );
  }
  console.log(
    `placement scored on ${scored.length} step(s): ${score.firstPlace} ranked the arrow-implied offset first, ` +
      `${score.withinOneStud} put the top offset within a stud of the arrows; ` +
      `median margin ${score.medianMargin?.toFixed(4) ?? "-"}; ` +
      `ranks ${JSON.stringify(rankDistribution)}`,
  );
  for (const pair of scored) {
    const ranking = pair.placement!.ranking!;
    console.log(
      `  step ${String(pair.fromStep).padStart(2)}: rank ${ranking.referenceRank + 1}/${ranking.candidates}  ` +
        `margin ${ranking.margin.toFixed(4)}  top-to-arrow ${ranking.bestToReferenceStuds.toFixed(2)} studs  ` +
        `(emergence rank ${pair.placement!.emergenceRank === null ? "n/a - nothing emerged" : pair.placement!.emergenceRank + 1}, change rank ${(pair.placement!.changeRank ?? -1) + 1}, ` +
        `zero-offset rank ${(pair.placement!.zeroOffsetRank ?? -1) + 1}, arrows travel ${pair.placement!.arrowTravelStuds?.toFixed(1) ?? "-"} studs, ` +
        `${pair.placement!.agreedArrows} of ${pair.placement!.arrows} arrow(s) agreeing, spread ${pair.placement!.arrowSpreadPx?.toFixed(1) ?? "-"}px, ` +
        `snap ${pair.placement!.referenceSnapPx?.toFixed(1) ?? "-"}px, ${pair.placement!.silhouetteRegions} highlight contour(s))`,
    );
  }
  for (const pair of result.pairs.filter((entry) => entry.placement?.skipped != null)) {
    console.log(
      `  step ${String(pair.fromStep).padStart(2)}: not scored - ${pair.placement!.skipped}`,
    );
  }
  for (const pair of result.pairs) {
    console.log(
      `  ${String(pair.fromStep).padStart(2)}->${String(pair.toStep).padStart(2)} ` +
        (pair.failure !== null
          ? `FAILED ${pair.failure.slice(0, 110)}`
          : `daz ${pair.azimuthDeltaDegrees?.toFixed(2) ?? "  -  "} ` +
            `del ${pair.elevationDeltaDegrees?.toFixed(2) ?? "  -  "} ` +
            `scale x${pair.scaleRatioEmpirical?.toFixed(4) ?? "-"} ` +
            `shift ${pair.shiftPt?.toFixed(2) ?? "-"}pt ` +
            `iou ${((pair.alignment?.iou ?? 0) * 100).toFixed(1)}% (raw ${((pair.alignment?.iouUnregistered ?? 0) * 100).toFixed(1)}%) ` +
            `noise99 ${pair.noise?.p99Distance ?? "-"} ` +
            `emerged ${pair.delta?.emergedPx ?? "-"}px = ${pair.delta?.emergedOverHighlight?.toFixed(2) ?? "-"}x highlight`),
    );
  }

  // Nothing below is a target. Every bound is set clear of what was measured, so
  // it catches a regression without pretending the measurement was a threshold.
  expect(result.panels.length).toBe(panels.length);
  expect(registered.length).toBeGreaterThan(20);
  for (const pair of result.pairs) {
    if (pair.placement?.skipped == null) continue;
    expect(pair.placement.skipped.length).toBeGreaterThan(40);
  }
  for (const pair of result.pairs) {
    if (pair.failure === null) continue;
    expect(pair.failure.length).toBeGreaterThan(40);
  }
});
