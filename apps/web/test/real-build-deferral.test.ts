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
import { DEFERRED_STEP_MINIMUM_MARGIN, summariseDeferrals } from "../e2e/real-build-deferral";
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
): {
  readonly spec: RealBuildPanelSpec;
  readonly evidence: PanelRasterEvidence;
} {
  const empty = new Uint8Array(WIDTH * HEIGHT);
  return {
    spec: panelSpec(2, [{ catalogPartId: "builtin:plate-2x2" }]),
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
        regions: [],
        closedContourRate: 0,
        keyedPx: 0,
        mask: excludedMask ?? empty,
        strokeMask: empty,
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
  readonly options?: Partial<RealBuildOptions>;
}) {
  const base = createEmptyBrickDocument({ id: "deferral", name: "deferral", maxParts: 64 });
  return {
    base,
    settlement: settleDeferredPrintedStep<Document>({
      spec: input.spec,
      baseDocument: base,
      stepId: null,
      lookahead:
        input.builtMask === null ? null : lookaheadEvidence(input.builtMask, input.excludedMask),
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

describe("deferred printed step", () => {
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
    expect(settlement.placement).toBeNull();
  });

  it("keeps the margin bar above every wrong pick the probe measured", () => {
    // From output/build-search/step1-deferral.json (probe 7762ebe): the margins
    // of the four picks that were wrong. The bar is read from the code and
    // compared against numbers measured elsewhere, so raising it silently is
    // safe and lowering it below a recorded wrong answer is not.
    const measuredWrongPickMargins = [0.0212, 0.0365, 0.0168, 0.0878];
    for (const margin of measuredWrongPickMargins) {
      expect(margin).toBeLessThanOrEqual(DEFERRED_STEP_MINIMUM_MARGIN);
    }
    // And below the right pick, at the panel a one-step deferral actually uses.
    expect(DEFERRED_STEP_MINIMUM_MARGIN).toBeLessThan(0.2085);
  });
});
