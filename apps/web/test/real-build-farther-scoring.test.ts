import { describe, expect, it, vi } from "vitest";

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
import { createCanonicalPrintedStepPlacer } from "../e2e/real-build-fixed-actions";
import { scoreFartherDocumentsAgainstPanel } from "../e2e/real-build-farther-step";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import {
  groupPlacementOperationsInPrintedStep,
  type RealBuildPanelSpec,
} from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

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

describe("farther-panel production scoring", () => {
  it("retains every K score render without invoking a second candidate render", () => {
    vi.stubGlobal(
      "ImageData",
      class TestImageData {
        constructor(
          readonly data: Uint8ClampedArray,
          readonly width: number,
          readonly height: number,
        ) {}
      },
    );
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ putImageData: () => {} }),
        toDataURL: () => "data:image/png;base64,test-png",
      }),
    });
    const base = createEmptyBrickDocument({ id: "k-base", name: "k-base", maxParts: 64 });
    const anchored = place(
      base,
      "builtin:corner-plate-5x5-quarter-ring",
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" },
      "builtin:black",
      1,
      null,
    ).document;
    const complete = drawnStepOne().document;
    const evidence = lookaheadEvidence(rasterise(complete), undefined, 3).evidence;
    let renderCalls = 0;
    const rendering = {
      ...modules.rendering,
      createInstructionRenderer: () => ({
        render: (root: Document) => {
          renderCalls += 1;
          return rgbaFromMask(rasterise(root));
        },
        dispose: () => {},
      }),
    };

    const result = (() => {
      try {
        return scoreFartherDocumentsAgainstPanel({
          spec: panelSpec(3, [{ catalogPartId: "builtin:plate-2x2" }]),
          evidence,
          anchorDocument: anchored,
          candidates: [
            { candidateId: "candidate-anchor", document: anchored },
            { candidateId: "candidate-complete", document: complete },
          ],
          reservedPanelRenders: 2,
          subject: "frontier",
          options: { ...completeRealBuildTestOptions(3), workFactor: 2 },
          rendering,
        });
      } finally {
        vi.unstubAllGlobals();
      }
    })();

    expect(result.observation.status).toBe("scored");
    expect(result.candidatePngs.map(({ candidateId }) => candidateId)).toEqual([
      "candidate-anchor",
      "candidate-complete",
    ]);
    expect(result.candidatePngs.every(({ png }) => png === "data:image/png;base64,test-png")).toBe(
      true,
    );
    // Four quarter-turn anchor probes plus one score render per candidate. PNG
    // retention consumes those owned buffers and adds no renderer invocation.
    expect(renderCalls).toBe(6);
  });
});
