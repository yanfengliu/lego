import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  documentStructuralHash,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import { createOrthographicViewCamera } from "@lego-studio/rendering";

import { enumeratePlacements, placementOccupancyKey } from "../src/assembly/enumerate-placements";
import { projectPoint } from "../src/assembly/project-bounds";
import { bodyBoundsLdu } from "../src/placement";
import { createPlacePartTransaction } from "../src/manual-commands";
import { groupPlacementOperationsInPrintedStep } from "../e2e/real-build-safety";
import { createCanonicalPrintedStepPlacer } from "../e2e/real-build-fixed-actions";
import { settleDeferredPrintedStep } from "../e2e/real-build-deferred-step";
import { settleFartherOriginPieceReports } from "../e2e/real-build-farther-step";
import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "../e2e/real-build-farther-report-types";
import {
  DEFERRED_STEP_MINIMUM_AGREEMENT,
  DEFERRED_STEP_MINIMUM_MARGIN,
  ownPanelCannotSeparate,
  summariseDeferrals,
  type DeferralTrigger,
} from "../e2e/real-build-deferral";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

/**
 * The deferral driven over real enumerated geometry.
 *
 * Nothing here asserts the threshold against itself. The masks are projections
 * of the parts the enumerator actually offers, through the repository's own
 * camera and point projection, so which candidate wins and by how much is
 * decided by where the bricks are — not by a number the test also supplies. The
 * threshold appears exactly once, as the run's own option, and what is checked
 * is the *outcome*: the drawn assembly settles, a genuinely symmetric one
 * refuses, and a panel with nothing built refuses.
 */

const WIDTH = 360;
const HEIGHT = 300;
const BOUNDS = { minXPx: 0, minYPx: 0, maxXPx: WIDTH - 1, maxYPx: HEIGHT - 1 };
// One three unit is one stud pitch, so this is 20 pixels per stud — the order
// the booklet's own panel fit reports once the run's work factor is applied.
const VIEW = { azimuthDegrees: 55, elevationDegrees: 35, pixelsPerUnit: 20 };
const FRAME = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  target: [0, 0, 0] as [number, number, number],
  sceneRadius: 60,
};

type Document = ReturnType<typeof createEmptyBrickDocument>;

/**
 * A candidate's silhouette, as the points its parts actually occupy.
 *
 * Every connector position and every body-box corner, projected and splatted.
 * That is deliberately not a bounding box: a quarter ring turned ninety degrees
 * has the same box and a different stud constellation, and telling those apart
 * is the whole question a deferral answers.
 */
function rasterise(document: Document): Uint8Array {
  const camera = createOrthographicViewCamera(
    { ...VIEW, centerXPx: WIDTH / 2, centerYPx: HEIGHT / 2 },
    FRAME,
  );
  const mask = new Uint8Array(WIDTH * HEIGHT);
  const splat = (point: readonly [number, number, number]): void => {
    const projected = projectPoint(point, camera, WIDTH, HEIGHT);
    const centreX = Math.round(projected.xPx);
    const centreY = Math.round(projected.yPx);
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        if (dx * dx + dy * dy > 16) continue;
        const x = centreX + dx;
        const y = centreY + dy;
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
        mask[y * WIDTH + x] = 1;
      }
    }
  };
  for (const part of document.parts) {
    const definition = getPartDefinition(part.catalogPartId)!;
    for (const connector of definition.connectors) {
      splat(transformLduPoint(part.transform, connector.positionLdu));
    }
    const bounds = bodyBoundsLdu(part);
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          splat([x, y, z]);
        }
      }
    }
  }
  return mask;
}

/** Centre of a mask, in pixels, for placing a hand-drawn exclusion region. */
function maskCentroidPx(mask: Uint8Array): { readonly x: number; readonly y: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (mask[y * WIDTH + x] !== 1) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  return { x: sumX / count, y: sumY / count };
}

function rgbaFromMask(mask: Uint8Array): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    const lit = mask[index] === 1;
    pixels[index * 4] = lit ? 0x00 : 0x89;
    pixels[index * 4 + 1] = lit ? 0x00 : 0x90;
    pixels[index * 4 + 2] = lit ? 0x00 : 0x93;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

/**
 * The browser modules the run hands the deferral, backed by real geometry.
 *
 * `createInstructionRenderer` is the only thing a Node test cannot have, so it
 * is replaced by the projection above. Enumeration, occupancy keying, hashing
 * and placement are all the real implementations.
 */
const modules = {
  rendering: {
    createInstructionRenderer: () => ({
      render: (root: Document) => rgbaFromMask(rasterise(root)),
      dispose: () => {},
    }),
    deriveBrickScene: (document: Document) => ({ root: document, dispose: () => {} }),
    setInstructionSilhouetteMode: () => {},
    createOrthographicViewCamera,
  },
  kernel: { documentStructuralHash },
  assembly: { enumeratePlacements, placementOccupancyKey },
};

const place = createCanonicalPrintedStepPlacer<Document>({
  createTransaction: (base, piece) =>
    createPlacePartTransaction(base, piece as Parameters<typeof createPlacePartTransaction>[1]),
  groupOperations: (operations, step) =>
    groupPlacementOperationsInPrintedStep(
      operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
      step,
    ),
  applyOperations: (base, operations) =>
    applyBuildOperations(base, operations as Parameters<typeof applyBuildOperations>[1]),
});

function panelSpec(
  stepNumber: number,
  pieces: readonly { readonly catalogPartId: string }[],
): RealBuildPanelSpec {
  return {
    stepNumber,
    pageNumber: 11,
    panelFace: "studs-up",
    minXPt: 0,
    maxXPt: 100,
    minYPt: 0,
    maxYPt: 100,
    calloutBoxes: [],
    mappedCalloutKeys: [],
    action: {
      kind: "place-callouts",
      assembledPieces: pieces.length,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
    },
    pieces: pieces.map((piece, index) => ({
      identityKey: `identity-${stepNumber}-${index}`,
      designId: `design-${index}`,
      materialId: "26",
      catalogPartId: piece.catalogPartId,
      colorId: "builtin:black",
      calloutKey: `callout-${stepNumber}-${index}`,
      identificationConfidence: "pair-judged-same",
      cropDigest: null,
      identificationInputDigest: null,
      expectedTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    })),
    omittedPieces: [],
    calloutPieces: pieces.length,
    classifiedPhysicalCalloutPieces: pieces.length,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  };
}

function lookaheadEvidence(
  builtMask: Uint8Array,
  excludedMask?: Uint8Array,
  lookaheadStepNumber = 2,
  strokeMask?: Uint8Array,
): {
  readonly spec: RealBuildPanelSpec;
  readonly evidence: PanelRasterEvidence;
} {
  const empty = new Uint8Array(WIDTH * HEIGHT);
  return {
    spec: panelSpec(lookaheadStepNumber, [{ catalogPartId: "builtin:plate-2x2" }]),
    evidence: {
      width: WIDTH,
      height: HEIGHT,
      workPixels: new Uint8ClampedArray(WIDTH * HEIGHT * 4),
      fitSolution: { ...VIEW, residualPx: 0 },
      fitFailure: null,
      fitCoherence: 1,
      // The run divides by `workFactor` before rendering, so the fit carries it.
      faceCorrectedFit: { ...VIEW, pixelsPerUnit: VIEW.pixelsPerUnit * 2 },
      highlight: {
        regions: strokeMask === undefined ? [] : [{ bounds: BOUNDS }],
        closedContourRate: 0,
        keyedPx: strokeMask === undefined ? 0 : strokeMask.reduce((total, on) => total + on, 0),
        mask: excludedMask ?? empty,
        strokeMask: strokeMask ?? empty,
        contourStrokeMask: strokeMask ?? empty,
      },
      highlightBox: null,
      builtMask,
      arrows: { arrows: [], rejected: [], redPx: 0 },
      arrowFamily: [],
    },
  };
}

function settle(input: {
  readonly spec: RealBuildPanelSpec;
  readonly builtMask: Uint8Array | null;
  readonly excludedMask?: Uint8Array;
  readonly strokeMask?: Uint8Array;
  readonly lookaheadStepNumber?: number;
  readonly trigger?: DeferralTrigger;
  readonly ownPanelMargin?: number | null;
  readonly narrowByOwnPanel?: Parameters<
    typeof settleDeferredPrintedStep<Document>
  >[0]["narrowByOwnPanel"];
  readonly options?: Partial<RealBuildOptions>;
}) {
  const base = createEmptyBrickDocument({ id: "deferral", name: "deferral", maxParts: 64 });
  const ownPanelMargin = input.ownPanelMargin ?? null;
  return {
    base,
    settlement: settleDeferredPrintedStep<Document>({
      spec: input.spec,
      trigger: input.trigger ?? "no-local-signal",
      ownPanelMargin,
      ownPanelMinimumMargin: ownPanelMargin === null ? null : 0.01,
      baseDocument: base,
      stepId: null,
      narrowByOwnPanel: input.narrowByOwnPanel ?? null,
      lookahead:
        input.builtMask === null
          ? null
          : lookaheadEvidence(
              input.builtMask,
              input.excludedMask,
              input.lookaheadStepNumber,
              input.strokeMask,
            ),
      options: { ...completeRealBuildTestOptions(2), workFactor: 2, ...input.options },
      rendering: modules.rendering,
      kernel: modules.kernel,
      assembly: modules.assembly,
      place,
    }),
  };
}

/** The assembly printed step 1 actually builds, as the panel would draw it. */
function drawnStepOne(): {
  readonly document: Document;
  readonly transforms: readonly { positionLdu: readonly number[]; orientationId: string }[];
} {
  const empty = createEmptyBrickDocument({ id: "drawn", name: "drawn", maxParts: 64 });
  const first = place(
    empty,
    "builtin:corner-plate-5x5-quarter-ring",
    { positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" },
    "builtin:black",
    1,
    null,
  );
  const offered = enumeratePlacements(first.document, "builtin:corner-plate-4x4-round", {});
  const chosen = offered.candidates[Math.floor(offered.candidates.length / 3)]!;
  const second = place(
    first.document,
    chosen.catalogPartId,
    chosen.transform,
    "builtin:black",
    1,
    first.stepId,
  );
  return {
    document: second.document,
    transforms: [{ positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" }, chosen.transform],
  };
}

// Settling a step rasterises every candidate against a printed panel - step 1
// is a 400-candidate product - which is the most expensive work any unit test
// here does. Measured inside a full `vitest run` with the ceiling lifted:
// 4787ms to settle step 1 and 3484ms to report the depth reached, against
// Vitest's 5000ms default. That is 96% of the budget, so the suite failed on
// roughly three runs in four - always by timeout, and on whichever of the two
// the scheduler happened to slow, which reads as a flaky assertion rather than
// as a ceiling set too close to the work. Alone the same test takes 2279ms, so
// the load multiplier is what needs room: 30000ms is a bit over 6x the loaded
// measurement, still low enough that a genuine hang fails the run rather than
// hanging it. The clock is what moves here; nothing either test asserts does.
//
// The ceiling belongs to the suite rather than to one test, because the second
// measurement above is the one that crossed first on some runs.
describe("deferred printed step", { timeout: 30_000 }, () => {
  const stepOne = panelSpec(1, [
    { catalogPartId: "builtin:corner-plate-5x5-quarter-ring" },
    { catalogPartId: "builtin:corner-plate-4x4-round" },
  ]);

  it("settles printed step 1 on the panel that shows what it built", () => {
    const drawn = drawnStepOne();
    const { settlement } = settle({ spec: stepOne, builtMask: rasterise(drawn.document) });

    expect(settlement.failure).toBeNull();
    expect(settlement.evidence.settled).toBe(true);
    expect(settlement.placement).not.toBeNull();
    expect(settlement.placement!.partIds).toHaveLength(2);
    // The whole point: the assembly the panel draws is the one that is placed,
    // and it is chosen out of the full product rather than seeded into it.
    expect(settlement.evidence.wholeStepCandidates).toBeGreaterThan(50);
    expect(
      settlement.pieceReports.map(({ positionLdu, orientationId }) => ({
        positionLdu,
        orientationId,
      })),
    ).toEqual(
      drawn.transforms.map(({ positionLdu, orientationId }) => ({ positionLdu, orientationId })),
    );
    expect(settlement.evidence.reachSteps).toBe(1);
    expect(settlement.pieceReports.every(({ placed }) => placed)).toBe(true);
  });

  it("reports how many steps deferred and how deep the settlement reached", () => {
    const drawn = drawnStepOne();
    const settled = settle({ spec: stepOne, builtMask: rasterise(drawn.document) }).settlement;
    const refused = settle({ spec: stepOne, builtMask: new Uint8Array(WIDTH * HEIGHT) }).settlement;

    expect(
      summariseDeferrals([
        { deferral: settled.evidence },
        { deferral: refused.evidence },
        { deferral: null },
      ]),
    ).toEqual({
      deferredSteps: 2,
      settledByLookahead: 1,
      deepestSettlementReachSteps: 1,
    });
  });

  it("refuses a step whose candidates the lookahead panel cannot separate", () => {
    // The panel's highlight is drawn over everything the candidates disagree
    // about — the second piece and the space around it — leaving only the first
    // piece defined. Every candidate that shares that first placement then
    // agrees exactly, so the margin is zero because of what the picture shows
    // rather than because of a number this test supplied.
    const drawn = drawnStepOne();
    const firstOnly = place(
      createEmptyBrickDocument({ id: "first", name: "first", maxParts: 64 }),
      "builtin:corner-plate-5x5-quarter-ring",
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" },
      "builtin:black",
      1,
      null,
    );
    const defined = rasterise(firstOnly.document);
    const excluded = new Uint8Array(WIDTH * HEIGHT);
    for (let index = 0; index < excluded.length; index += 1) {
      excluded[index] = defined[index] === 1 ? 0 : 1;
    }
    const { settlement } = settle({
      spec: stepOne,
      builtMask: rasterise(drawn.document),
      excludedMask: excluded,
    });

    expect(settlement.placement).toBeNull();
    expect(settlement.evidence.settled).toBe(false);
    expect(settlement.failure?.code).toBe("ambiguous-deferred-placement");
    expect(settlement.evidence.margin).toBe(0);
    expect(settlement.unresolvedCandidates.length).toBeGreaterThan(1);
    expect(
      settlement.unresolvedCandidates.filter(({ lookaheadPixels }) => lookaheadPixels !== null),
    ).toHaveLength(
      Math.min(settlement.unresolvedCandidates.length, MAXIMUM_REAL_BUILD_FARTHER_CAPTURES - 2),
    );
    expect(
      settlement.unresolvedCandidates
        .filter(({ lookaheadPixels }) => lookaheadPixels !== null)
        .every(({ lookaheadPixels }) => lookaheadPixels!.length === WIDTH * HEIGHT * 4),
    ).toBe(true);
    const settledReports = settleFartherOriginPieceReports(
      settlement.pieceReports,
      settlement.unresolvedCandidates[0]!,
    );
    expect(settledReports).toEqual(
      settlement.pieceReports.map((report, pieceIndex) =>
        expect.objectContaining({
          catalogPartId: report.catalogPartId,
          placed: true,
          positionLdu:
            settlement.unresolvedCandidates[0]!.pieces[pieceIndex]!.transform.positionLdu,
          orientationId:
            settlement.unresolvedCandidates[0]!.pieces[pieceIndex]!.transform.orientationId,
          failure: null,
          blind: expect.objectContaining({ refusal: null }),
        }),
      ),
    );
  });

  /**
   * A lookahead panel whose highlight encloses nothing is still evidence, and
   * this used to refuse it.
   *
   * Printed step 5 of this booklet outlines two pieces that run under the
   * assembly, and neither contour closes: 1429px of stroke and no filled region.
   * Printed step 7 draws two more, 1338px enclosing nothing, and that is where it
   * bit — printed step 6 defers to it. Without a filled region nothing but the
   * outline is excluded, so what panel N+1 shows is what step N built *plus* the
   * pieces panel N+1 places: a superset of anything a step-N candidate can draw.
   * Equality is then the wrong question, so the measure becomes containment and
   * the term charging a candidate for ink no candidate could own is dropped —
   * the same correction `rankStepDelta` makes on an open contour.
   *
   * What must not be dropped with it is falsifiability, which is the second half
   * of this test: a candidate whose pieces sit outside the panel's built art
   * still loses, because containment is what it fails.
   */
  it("scores a lookahead panel whose highlight encloses no region by containment", () => {
    const drawn = drawnStepOne();
    const built = rasterise(drawn.document);
    const stroke = new Uint8Array(WIDTH * HEIGHT);
    const centre = maskCentroidPx(built);
    for (let index = 0; index < stroke.length; index += 1) {
      const x = index % WIDTH;
      const y = Math.floor(index / WIDTH);
      // An open contour: a bare arc, enclosing nothing.
      const radius = Math.hypot(x - centre.x, y - centre.y);
      if (radius > 40 && radius < 43 && x > centre.x) stroke[index] = 1;
    }
    const { settlement } = settle({
      spec: stepOne,
      builtMask: built,
      strokeMask: stroke,
      trigger: "unseparated-by-own-panel",
      ownPanelMargin: 0.0011,
    });

    expect(settlement.evidence.lookaheadMeasure).toBe("containment");
    expect(settlement.evidence.rendered).toBeGreaterThan(0);
    expect(settlement.evidence.bestAgreement).not.toBeNull();
    expect(settlement.failure).toBeNull();
    expect(settlement.placement).not.toBeNull();

    // And the same open contour settles nothing when the panel stops being a
    // picture of this prefix. Displacing the drawn art is what the registration
    // is allowed to undo — it maximises over translation — so the control is not
    // that the best candidate falls: it is that the *separation* does. The
    // correct drawing tells the candidates apart; a displaced one lets several
    // slide into it equally and the margin gate refuses.
    const elsewhere = new Uint8Array(WIDTH * HEIGHT);
    for (let index = 0; index < built.length; index += 1) {
      const x = index % WIDTH;
      const shifted = index - x + ((x + WIDTH / 2) % WIDTH);
      if (built[index] === 1) elsewhere[shifted] = 1;
    }
    const displaced = settle({
      spec: stepOne,
      builtMask: elsewhere,
      strokeMask: stroke,
      trigger: "unseparated-by-own-panel",
      ownPanelMargin: 0.0011,
    }).settlement;
    expect(displaced.evidence.lookaheadMeasure).toBe("containment");
    expect(displaced.placement).toBeNull();
    expect(displaced.evidence.settled).toBe(false);
    // Named, so this cannot pass because the panel went blank or the candidates
    // never rendered: the same candidates were scored and the drawing could not
    // separate them.
    expect(displaced.failure?.code).toBe("ambiguous-deferred-placement");
    expect(displaced.evidence.rendered).toBe(settlement.evidence.rendered);
    expect(displaced.evidence.margin!).toBeLessThanOrEqual(displaced.evidence.minimumMargin);
    expect(settlement.evidence.margin!).toBeGreaterThan(settlement.evidence.minimumMargin);
  });

  it("refuses when the panel it defers to has nothing built drawn on it", () => {
    const { settlement } = settle({ spec: stepOne, builtMask: new Uint8Array(WIDTH * HEIGHT) });

    expect(settlement.failure?.code).toBe("deferred-panel-unscored");
    expect(settlement.evidence.settled).toBe(false);
    expect(settlement.placement).toBeNull();
  });

  it("refuses when no later printed step was requested to settle it against", () => {
    const { settlement } = settle({ spec: stepOne, builtMask: null });

    expect(settlement.failure?.code).toBe("deferred-panel-unscored");
    expect(settlement.evidence.lookaheadStepNumber).toBeNull();
  });

  it("refuses a candidate product over its explicit budget rather than truncating", () => {
    const drawn = drawnStepOne();
    const { settlement } = settle({
      spec: stepOne,
      builtMask: rasterise(drawn.document),
      options: { deferredCandidateBudget: 8 },
    });

    expect(settlement.failure?.code).toBe("resource-budget-exhausted");
    expect(settlement.failure?.message).toContain("refused rather than truncated");
    expect(settlement.evidence.wholeStepCandidates).toBe(0);
    expect(settlement.placement).toBeNull();
  });

  /**
   * A panel that shows more than the step could have built.
   *
   * The lookahead art here is the drawn assembly plus a piece this printed step
   * does not place, which is what a panel two steps ahead — or one carrying a
   * sub-assembly box — actually looks like. The best candidate is still the
   * clear winner of its field and beats the runner-up by a wide margin, and it
   * still only explains part of the picture. The deferral must refuse: a margin
   * says which candidate is least bad, not that any of them is the drawn one.
   */
  it("refuses a winner the panel does not corroborate, however far it beat the runner-up", () => {
    const drawn = drawnStepOne();
    const alsoDrawn = place(
      drawn.document,
      "builtin:plate-2x2",
      { positionLdu: [140, 8, 140], orientationId: "upright-yaw-0" },
      "builtin:black",
      2,
      null,
    );

    const { settlement } = settle({ spec: stepOne, builtMask: rasterise(alsoDrawn.document) });

    expect(settlement.failure?.code).toBe("weak-deferred-agreement");
    expect(settlement.placement).toBeNull();
    expect(settlement.evidence.settled).toBe(false);
    // The margin is not the reason. It is larger here than the one the printed
    // booklet produced for the pick this loop actually made (0.2085), and larger
    // than the superseded bar of 0.0878 that would have admitted it.
    expect(settlement.evidence.margin).toBeGreaterThan(0.0878);
    expect(settlement.evidence.bestAgreement).toBeGreaterThan(
      settlement.evidence.runnerUpAgreement!,
    );
  });

  /**
   * The same decision with the two questions the other way round.
   *
   * The panel's highlight is drawn over most of where the candidates disagree,
   * leaving a sliver. The winner matches what is left exactly, so the picture
   * corroborates it; the runner-up is close behind, so the margin is small. This
   * is the case the superseded 0.0878 refused, and refusing it is a false
   * refusal — the panel does show which candidate is right.
   */
  it("settles a step whose winner the panel corroborates by a small margin", () => {
    const drawn = drawnStepOne();
    const secondPieceOnly = rasterise({
      ...drawn.document,
      parts: drawn.document.parts.filter(
        (part) => part.catalogPartId === "builtin:corner-plate-4x4-round",
      ),
    } as Document);
    const centre = maskCentroidPx(secondPieceOnly);
    const excluded = new Uint8Array(WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const dx = x - centre.x;
        const dy = y - centre.y;
        if (dx * dx + dy * dy <= 34 * 34) excluded[y * WIDTH + x] = 1;
      }
    }

    const { settlement } = settle({
      spec: stepOne,
      builtMask: rasterise(drawn.document),
      excludedMask: excluded,
    });

    expect(settlement.failure).toBeNull();
    expect(settlement.evidence.settled).toBe(true);
    expect(
      settlement.pieceReports.map(({ positionLdu, orientationId }) => ({
        positionLdu,
        orientationId,
      })),
    ).toEqual(
      drawn.transforms.map(({ positionLdu, orientationId }) => ({ positionLdu, orientationId })),
    );
    // Under the superseded bar this margin was a refusal.
    expect(settlement.evidence.margin).toBeLessThan(0.0878);
  });

  it("refuses to look further forward than the reach that has been measured", () => {
    const drawn = drawnStepOne();
    const { settlement } = settle({
      spec: stepOne,
      builtMask: rasterise(drawn.document),
      lookaheadStepNumber: 3,
    });

    expect(settlement.failure?.code).toBe("deferred-reach-unmeasured");
    expect(settlement.failure?.message).toContain("Request the intervening printed step");
    expect(settlement.placement).toBeNull();
    // Refused before anything was rendered, so no margin or agreement is
    // published for a reach nothing calibrates.
    expect(settlement.evidence.rendered).toBe(0);
    expect(settlement.evidence.bestAgreement).toBeNull();
  });

  /**
   * The two constants, against observations in the metric they gate.
   *
   * Every number below is `definedIou` from `output/build-search/step1-deferral.json`
   * (probe 7762ebe) — the same quantity `registerPrefixAgreement` returns, over
   * the same masks, which is what the superseded calibration got wrong: it
   * maximised over `bestScore` and `anchorIou` margins instead, and those order
   * the branches differently at every panel.
   */
  it("keeps both gates inside what the gated metric actually measured", () => {
    // Right picks: branch 3's agreement at panels 2 and 3.
    for (const rightPick of [0.903118, 0.889836]) {
      expect(DEFERRED_STEP_MINIMUM_AGREEMENT).toBeLessThanOrEqual(rightPick);
    }
    // The best candidate of the same field with the right branch deleted, which
    // is what a set that does not contain the answer looks like.
    for (const bestWrong of [0.694576, 0.827593]) {
      expect(DEFERRED_STEP_MINIMUM_AGREEMENT).toBeGreaterThan(bestWrong);
    }
    // The margin is a noise floor, so it is bounded on both sides by
    // measurements rather than set between right and wrong answers: at least the
    // error two independently registered agreements can carry (the stride-4
    // search reports up to 0.009916 below its own stride-1 optimum), and under
    // every right-pick margin recorded, including the shallowest.
    expect(DEFERRED_STEP_MINIMUM_MARGIN).toBeGreaterThanOrEqual(2 * 0.009916);
    for (const rightPickMargin of [0.2085413294, 0.0622428487]) {
      expect(DEFERRED_STEP_MINIMUM_MARGIN).toBeLessThan(rightPickMargin);
    }
  });

  /**
   * A step deferred because its own panel could not separate its candidates.
   *
   * The lookahead procedure is the same one either way — what changes is what
   * the settlement records about why it left its own panel, and that record has
   * to survive into the report or a reader cannot tell an unreadable panel from
   * a readable one that drew two seats the same.
   */
  it("records the local margin that sent an unseparated step to the next panel", () => {
    const drawn = drawnStepOne();
    const { settlement } = settle({
      spec: stepOne,
      builtMask: rasterise(drawn.document),
      trigger: "unseparated-by-own-panel",
      ownPanelMargin: 0.0010802020828231118,
    });

    expect(settlement.failure).toBeNull();
    expect(settlement.evidence.trigger).toBe("unseparated-by-own-panel");
    expect(settlement.evidence.ownPanelMargin).toBe(0.0010802020828231118);
    expect(settlement.evidence.ownPanelMinimumMargin).toBe(0.01);
    // The lookahead's own numbers are a different measurement and stay separate
    // from the local one that triggered the deferral.
    expect(settlement.evidence.margin).not.toBe(settlement.evidence.ownPanelMargin);
  });

  it("says which panel could not answer when no later step was requested", () => {
    const unreadable = settle({ spec: stepOne, builtMask: null }).settlement;
    const unseparated = settle({
      spec: stepOne,
      builtMask: null,
      trigger: "unseparated-by-own-panel",
      ownPanelMargin: 0.0011,
    }).settlement;

    expect(unreadable.failure?.message).toContain("has no scoring signal of its own");
    expect(unseparated.failure?.message).toContain("could not separate the best two");
    expect(unseparated.failure?.message).not.toContain("has no scoring signal of its own");
  });
});

/**
 * Which local refusals earn a look at the next panel.
 *
 * The predicate is the whole extension of the rule from step 1's blank outline
 * to step 4's indistinguishable seats, so what it excludes matters as much as
 * what it admits: every other way a step can fail to choose is a defect in how
 * it was looked at, and a defect that deferred would be a defect that reached a
 * later panel and settled there.
 */
describe("own-panel separation", () => {
  const scores = [0.2734538947219428, 0.272373692639];
  const failure = (code: string) =>
    ({ code, stage: "evidence", message: `step 4: ${code}` }) as Parameters<
      typeof ownPanelCannotSeparate
    >[0]["failure"];

  it("admits a panel that scored its candidates and could not tell the best two apart", () => {
    for (const code of ["ambiguous-placement-score", "tied-placement-score"]) {
      expect(ownPanelCannotSeparate({ failure: failure(code), scores, minimumMargin: 0.01 })).toBe(
        true,
      );
    }
  });

  it("refuses every failure that is not the drawing failing to distinguish two seats", () => {
    for (const code of [
      "zero-placement-score",
      "no-placement-candidate",
      "incomplete-placement-scoring",
      "resource-budget-exhausted",
      "benchmark-disagreement",
      "camera-fit-failed",
    ]) {
      expect(ownPanelCannotSeparate({ failure: failure(code), scores, minimumMargin: 0.01 })).toBe(
        false,
      );
    }
    expect(ownPanelCannotSeparate({ failure: null, scores, minimumMargin: 0.01 })).toBe(false);
  });

  /**
   * `selectUniquePlacementScore` spends `ambiguous-placement-score` on a margin
   * below the minimum *and* on non-finite scoring evidence or an invalid
   * minimum. Only the first is a fact about the drawing.
   */
  it("refuses the same code when it reports malformed evidence rather than a close call", () => {
    const ambiguous = failure("ambiguous-placement-score");
    expect(
      ownPanelCannotSeparate({
        failure: ambiguous,
        scores: [Number.NaN, 0.2],
        minimumMargin: 0.01,
      }),
    ).toBe(false);
    expect(ownPanelCannotSeparate({ failure: ambiguous, scores, minimumMargin: Number.NaN })).toBe(
      false,
    );
    expect(ownPanelCannotSeparate({ failure: ambiguous, scores, minimumMargin: -1 })).toBe(false);
    // One score cannot be close to a runner-up that does not exist.
    expect(
      ownPanelCannotSeparate({ failure: ambiguous, scores: [0.27], minimumMargin: 0.01 }),
    ).toBe(false);
  });
});
