import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  documentStructuralHash,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import { createOrthographicViewCamera, dilateMask } from "@lego-studio/rendering";

import {
  arrowTravelFamily,
  measureArrowTravelCeiling,
  panelProjectionFromFit,
} from "../src/assembly/arrow-placement";
import { enumeratePlacements, placementOccupancyKey } from "../src/assembly/enumerate-placements";
import {
  decideExplodedGhostPlacement,
  measureGhostContainment,
} from "../src/assembly/ghost-placement";
import { scoreStepDelta } from "../src/assembly/step-score";
import { projectPoint } from "../src/assembly/project-bounds";
import { bodyBoundsLdu } from "../src/placement";
import { createPlacePartTransaction } from "../src/manual-commands";
import { groupPlacementOperationsInPrintedStep } from "../e2e/real-build-safety";
import { createCanonicalPrintedStepPlacer } from "../e2e/real-build-fixed-actions";
import { settleExplodedPrintedStep } from "../e2e/real-build-exploded-step";
import type { ArrowDisplacement, PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

/**
 * The exploded reading driven over real enumerated geometry.
 *
 * The panel is generated from a placement the enumerator actually offers: the
 * highlight is that part's own silhouette, drawn where the booklet would draw it
 * — offset back along the arrow's travel and grown, which is the drawing
 * convention measured on the sample booklet. The question the tests ask is
 * whether the procedure recovers the placement the panel was made from. Nothing
 * asserts a threshold against itself; the only bar in the decision is full
 * containment, which is derived from the two masks.
 */

const WIDTH = 360;
const HEIGHT = 300;
const VIEW = { azimuthDegrees: 55, elevationDegrees: 35, pixelsPerUnit: 20 };
const WORK_FACTOR = 2;
const FRAME = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  target: [0, 0, 0] as [number, number, number],
  sceneRadius: 60,
};
const WEDGE = "builtin:wedge-plate-4x4-cut-corner";
/** Seven plates straight up, which is the travel printed step 2 draws. */
const TRAVEL: ArrowDisplacement = {
  lduX: 0,
  lduY: -56,
  lduZ: 0,
  travelPx: 46.17,
  offLineStuds: 0.003,
};

type Document = ReturnType<typeof createEmptyBrickDocument>;
type Transform = { readonly positionLdu: readonly [number, number, number]; orientationId: string };

/** A candidate's silhouette, as the points its parts actually occupy. */
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
  assembly: {
    enumeratePlacements,
    placementOccupancyKey,
    measureGhostContainment,
    decideExplodedGhostPlacement,
  },
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

function panelSpec(stepNumber: number, catalogPartId: string): RealBuildPanelSpec {
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
      assembledPieces: 1,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
    },
    pieces: [
      {
        identityKey: `identity-${stepNumber}`,
        designId: "design-0",
        materialId: "26",
        catalogPartId,
        colorId: "builtin:black",
        calloutKey: `callout-${stepNumber}`,
        identificationConfidence: "pair-judged-same",
        cropDigest: null,
        identificationInputDigest: null,
        expectedTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      },
    ],
    omittedPieces: [],
    calloutPieces: 1,
    classifiedPhysicalCalloutPieces: 1,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  };
}

/** The two pieces printed step 1 builds, as the panel would draw them. */
function drawnStepOne(): Document {
  const empty = createEmptyBrickDocument({ id: "exploded", name: "exploded", maxParts: 64 });
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
  return place(
    first.document,
    chosen.catalogPartId,
    chosen.transform,
    "builtin:black",
    1,
    first.stepId,
  ).document;
}

const BASE = drawnStepOne();
const OFFERED = (() => {
  const seen = new Set<string>();
  const distinct: Transform[] = [];
  for (const candidate of enumeratePlacements(BASE, WEDGE, {}).candidates) {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(candidate.transform as Transform);
  }
  return distinct;
})();
/** The placement this panel is drawn from — one the enumerator actually offers. */
const DRAWN = OFFERED[Math.floor(OFFERED.length / 3)]!;

/** The step's own part alone, where the booklet floats it: the seat minus the travel. */
function ghostMaskFor(transform: Transform, travel: ArrowDisplacement): Uint8Array {
  const seated = place(BASE, WEDGE, transform, "builtin:black", 2, null);
  const parts = seated.document.parts
    .filter((part) => part.id === seated.partId)
    .map((part) => ({
      ...part,
      transform: {
        ...part.transform,
        positionLdu: [
          part.transform.positionLdu[0] - travel.lduX,
          part.transform.positionLdu[1] - travel.lduY,
          part.transform.positionLdu[2] - travel.lduZ,
        ] as [number, number, number],
      },
    }));
  return rasterise({ ...BASE, parts, steps: [] } as Document);
}

function seatedMaskFor(transform: Transform): Uint8Array {
  const seated = place(BASE, WEDGE, transform, "builtin:black", 2, null);
  const parts = seated.document.parts.filter((part) => part.id === seated.partId);
  return rasterise({ ...BASE, parts, steps: [] } as Document);
}

function boundsOf(mask: Uint8Array) {
  let minXPx = WIDTH;
  let minYPx = HEIGHT;
  let maxXPx = -1;
  let maxYPx = -1;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (mask[y * WIDTH + x] !== 1) continue;
      minXPx = Math.min(minXPx, x);
      maxXPx = Math.max(maxXPx, x);
      minYPx = Math.min(minYPx, y);
      maxYPx = Math.max(maxYPx, y);
    }
  }
  return { minXPx, minYPx, maxXPx, maxYPx };
}

function panelEvidence(input: {
  readonly regionMask: Uint8Array;
  readonly family?: readonly ArrowDisplacement[];
}): PanelRasterEvidence {
  const empty = new Uint8Array(WIDTH * HEIGHT);
  let keyedPx = 0;
  for (let pixel = 0; pixel < input.regionMask.length; pixel += 1) {
    if (input.regionMask[pixel] === 1) keyedPx += 1;
  }
  return {
    width: WIDTH,
    height: HEIGHT,
    workPixels: new Uint8ClampedArray(WIDTH * HEIGHT * 4),
    fitSolution: { ...VIEW, residualPx: 0 },
    fitFailure: null,
    fitCoherence: 1,
    // The run divides by `workFactor` before rendering, so the fit carries it.
    faceCorrectedFit: { ...VIEW, pixelsPerUnit: VIEW.pixelsPerUnit * WORK_FACTOR },
    highlight: {
      regions: [{ bounds: boundsOf(input.regionMask) }],
      closedContourRate: 1,
      keyedPx,
      mask: input.regionMask,
      strokeMask: empty,
    },
    highlightBox: boundsOf(input.regionMask),
    builtMask: rasterise(BASE),
    arrows: { arrows: [{}, {}], rejected: [], redPx: 174 },
    arrowFamily: input.family ?? [TRAVEL],
  };
}

function settle(input: {
  readonly regionMask: Uint8Array;
  readonly family?: readonly ArrowDisplacement[];
  readonly options?: Partial<RealBuildOptions>;
}) {
  return settleExplodedPrintedStep<Document>({
    spec: panelSpec(2, WEDGE),
    baseDocument: BASE,
    stepId: null,
    evidence: panelEvidence(input),
    options: {
      ...completeRealBuildTestOptions(3),
      workFactor: WORK_FACTOR,
      ...input.options,
    },
    view: VIEW,
    centrePx: [WIDTH / 2, HEIGHT / 2],
    rendering: modules.rendering,
    kernel: modules.kernel,
    assembly: modules.assembly,
    place,
  });
}

/** The booklet draws the yellow clear of the part; four pixels here, five there. */
const PRINTED_REGION = dilateMask(ghostMaskFor(DRAWN, TRAVEL), WIDTH, HEIGHT, 4);

describe("exploded printed step", () => {
  it("scores the ghost the booklet draws rather than the seat it means", () => {
    // The defect this replaces, measured on this panel rather than asserted:
    // the printed contour rings the ghost, so the drawn placement scored where
    // it seats agrees with it almost not at all, while the same placement drawn
    // back along the arrow reaches the panel's own containment ceiling.
    const highlight = {
      width: WIDTH,
      height: HEIGHT,
      mask: PRINTED_REGION,
      strokeMask: new Uint8Array(WIDTH * HEIGHT),
      regions: [{ leaked: false }],
    } as unknown as Parameters<typeof scoreStepDelta>[1];
    const seated = scoreStepDelta(seatedMaskFor(DRAWN), highlight, { tolerancePx: 3 });
    const ghost = measureGhostContainment(ghostMaskFor(DRAWN, TRAVEL), PRINTED_REGION);
    expect(ghost.contained).toBe(true);
    expect(ghost.regionIou).toBe(ghost.containmentCeiling);
    expect(measureGhostContainment(seatedMaskFor(DRAWN), PRINTED_REGION).contained).toBe(false);
    // Measured here: the seat agrees with the ghost contour at 0.0240 against
    // the ghost's 0.3056, which is this panel's ceiling exactly. The bound is
    // written loosely on purpose — what matters is the order of magnitude, and
    // on the printed panel the same comparison is 0.000155 against 0.5888.
    expect(seated.regionIou).toBeLessThan(ghost.regionIou / 2);
  });

  it("settles on the placement the panel was drawn from", () => {
    const settlement = settle({ regionMask: PRINTED_REGION });
    expect(settlement.failure).toBeNull();
    expect(settlement.evidence.settled).toBe(true);
    expect(settlement.evidence.containedCandidates).toBe(1);
    expect(settlement.placement).not.toBeNull();
    expect(settlement.pieceReports[0]!.positionLdu).toStrictEqual(DRAWN.positionLdu);
    expect(settlement.pieceReports[0]!.orientationId).toBe(DRAWN.orientationId);
    // The bar is the panel's own geometry: a wholly contained ghost scores its
    // own area over the printed region's, and nothing on this panel can score
    // higher.
    expect(settlement.evidence.bestRegionIou).toBe(settlement.evidence.containmentCeiling);
    expect(settlement.evidence.bestOutsideRegionPx).toBe(0);
    expect(settlement.evidence.containmentCeiling).toBeLessThan(1);
    expect(settlement.evidence.rendered).toBe(settlement.evidence.wholeStepCandidates);
  });

  it("refuses a contour loose enough to fit several seats rather than picking one", () => {
    const settlement = settle({
      regionMask: dilateMask(ghostMaskFor(DRAWN, TRAVEL), WIDTH, HEIGHT, 40),
    });
    expect(settlement.evidence.containedCandidates).toBeGreaterThan(1);
    expect(settlement.evidence.settled).toBe(false);
    expect(settlement.placement).toBeNull();
    expect(settlement.failure?.code).toBe("ambiguous-exploded-ghost");
    expect(settlement.failure?.message).toMatch(/lie wholly inside it/);
  });

  it("refuses, naming the shortfall, when the travel puts no ghost inside the contour", () => {
    // The arrow reads short: the family says one plate where the drawing means
    // seven. Nothing lands inside the printed contour, and the refusal says how
    // far outside the best of them fell.
    const settlement = settle({
      regionMask: PRINTED_REGION,
      family: [{ lduX: 0, lduY: -8, lduZ: 0, travelPx: 6.6, offLineStuds: 0.004 }],
    });
    expect(settlement.evidence.containedCandidates).toBe(0);
    expect(settlement.evidence.settled).toBe(false);
    expect(settlement.placement).toBeNull();
    expect(settlement.failure?.code).toBe("whole-step-score-too-low");
    expect(settlement.evidence.bestOutsideRegionPx).toBeGreaterThan(0);
    expect(settlement.evidence.bestRegionIou).toBeLessThan(settlement.evidence.containmentCeiling);
    expect(settlement.failure?.message).toMatch(/No candidate's ghost lies wholly inside/);
  });

  it("settles from an arrow inked short of the travel it means", () => {
    // The whole chain, from the ink to the placement, on an arrow drawn the way
    // this booklet draws one: from a point inside the ghost to a point inside
    // the model, so it stops at the model's visible surface while the seat is
    // behind it. Panel 2 inks 33.50px of a 46.17px travel; the same fraction is
    // applied here so the shortfall is the booklet's rather than a number
    // chosen to pass.
    const projection = panelProjectionFromFit(VIEW);
    const trueTravelPx = {
      xPx:
        (TRAVEL.lduX / 20) * projection.a.xPx +
        (TRAVEL.lduZ / 20) * projection.b.xPx +
        (-TRAVEL.lduY / 8) * projection.up.xPx,
      yPx:
        (TRAVEL.lduX / 20) * projection.a.yPx +
        (TRAVEL.lduZ / 20) * projection.b.yPx +
        (-TRAVEL.lduY / 8) * projection.up.yPx,
    };
    const inkedFraction = 33.50220230104512 / 46.16553563437847;
    const inked = { xPx: trueTravelPx.xPx * inkedFraction, yPx: trueTravelPx.yPx * inkedFraction };

    // The tail is inside the ghost, which is where this booklet puts it: the
    // ghost's own centroid stands in for it.
    const ghost = ghostMaskFor(DRAWN, TRAVEL);
    let sumX = 0;
    let sumY = 0;
    let ghostPx = 0;
    for (let pixel = 0; pixel < ghost.length; pixel += 1) {
      if (ghost[pixel] !== 1) continue;
      sumX += pixel % WIDTH;
      sumY += Math.floor(pixel / WIDTH);
      ghostPx += 1;
    }
    const tail = { tailXPx: sumX / ghostPx, tailYPx: sumY / ghostPx };

    const ceiling = measureArrowTravelCeiling([tail], inked, {
      width: WIDTH,
      height: HEIGHT,
      mask: rasterise(BASE),
    });
    const family = arrowTravelFamily(projection, inked, ceiling.ceilingPx);

    // What the ink alone would have said, stated as geometry rather than as a
    // threshold: its endpoint is more than a plate of travel from the truth's,
    // so a family drawn as a disc around it cannot hold the answer at any
    // radius that still separates one plate from the next.
    const gapStuds =
      Math.hypot(trueTravelPx.xPx - inked.xPx, trueTravelPx.yPx - inked.yPx) /
      projection.pixelsPerStud;
    expect(gapStuds).toBeGreaterThan(Math.abs(projection.up.yPx) / projection.pixelsPerStud);
    expect(
      family.some(
        (entry) =>
          entry.lduX === TRAVEL.lduX && entry.lduY === TRAVEL.lduY && entry.lduZ === TRAVEL.lduZ,
      ),
    ).toBe(true);

    // And the same panel read the superseded way, written out rather than
    // named: the whole-grid triple whose projection lands nearest the ink's
    // endpoint, which is what a family drawn as a disc around that endpoint
    // leads with. Nothing on the panel fits it.
    let nearest: ArrowDisplacement | null = null;
    let nearestPx = Number.POSITIVE_INFINITY;
    for (let plates = -12; plates <= 12; plates += 1) {
      for (let studsB = -8; studsB <= 8; studsB += 1) {
        for (let studsA = -8; studsA <= 8; studsA += 1) {
          const xPx =
            studsA * projection.a.xPx + studsB * projection.b.xPx + plates * projection.up.xPx;
          const yPx =
            studsA * projection.a.yPx + studsB * projection.b.yPx + plates * projection.up.yPx;
          const offPx = Math.hypot(xPx - inked.xPx, yPx - inked.yPx);
          if (offPx >= nearestPx) continue;
          nearestPx = offPx;
          nearest = {
            lduX: studsA * 20,
            lduY: -plates * 8,
            lduZ: studsB * 20,
            travelPx: Math.hypot(xPx, yPx),
            offLineStuds: 0,
          };
        }
      }
    }
    expect(nearest!.lduY).not.toBe(TRAVEL.lduY);
    const throughTheInk = measureGhostContainment(ghostMaskFor(DRAWN, nearest!), PRINTED_REGION);
    expect(throughTheInk.contained).toBe(false);
    expect(throughTheInk.outsideRegionPx).toBeGreaterThan(0);

    // Through the family the ink's own line admits, the same placement's ghost
    // lands inside the printed contour exactly. That is the whole difference,
    // and the decision above turns on nothing else: `settleExplodedPrintedStep`
    // settles when one candidate is contained and refuses when none is.
    const member = family.find((entry) => entry.lduY === TRAVEL.lduY)!;
    const throughTheLine = measureGhostContainment(ghostMaskFor(DRAWN, member), PRINTED_REGION);
    expect(throughTheLine.contained).toBe(true);
    expect(throughTheLine.outsideRegionPx).toBe(0);
    expect(throughTheLine.regionIou).toBe(throughTheLine.containmentCeiling);
  });

  it("refuses a panel whose arrows converted to nothing rather than scoring the seat", () => {
    const settlement = settle({ regionMask: PRINTED_REGION, family: [] });
    expect(settlement.failure?.code).toBe("no-placement-signal");
    expect(settlement.evidence.rendered).toBe(0);
    expect(settlement.placement).toBeNull();
  });

  it("refuses over its render budget rather than truncating the field", () => {
    const settlement = settle({
      regionMask: PRINTED_REGION,
      options: { explodedGhostRenderBudget: 4 },
    });
    expect(settlement.failure?.code).toBe("resource-budget-exhausted");
    expect(settlement.placement).toBeNull();
  });
});
