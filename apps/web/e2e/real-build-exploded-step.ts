import { instructionSilhouetteMasks } from "./real-build-contract";
import { enumerateWholeStepCandidates } from "./real-build-deferral";
import type { DeferredPlacementResult } from "./real-build-deferred-step";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type {
  RealBuildOptions,
  RealBuildPanelSpec,
  RealBuildPieceReport,
  StepFailure,
} from "./real-build-safety";

/**
 * A printed step whose highlight rings a ghost rather than a seat.
 *
 * The booklet draws some steps exploded: the new part floats clear of the
 * assembly with red arrows pointing at where it goes. The yellow then outlines
 * the part where it is *drawn*, so the seated placement it means is somewhere
 * else entirely — on printed step 2 of `recipes/6651557.pdf` the seat is almost
 * wholly hidden behind what step 1 built, and scored against that contour it
 * reaches a region IoU of 0.000155. Every seated candidate is being scored
 * against a shape in the wrong place, and the "winner" is whichever wrong seat
 * overlaps the ghost region most.
 *
 * So this is not a variant of the per-piece search, it is a different question:
 * the whole step is proposed as one object, each candidate is redrawn where the
 * booklet would have drawn it — the seat minus the arrow's travel — and compared
 * against the printed contour. `ghost-placement.ts` holds the comparison and the
 * measurements behind it; this file renders the ghosts and decides.
 *
 * Which steps take this road is settled by a signal the run already computes and
 * throws away: printed steps 1, 2 and 3 of the sample booklet keep 2, 2 and 0
 * displacement arrows, and step 3 is the first seated panel. A step that prints
 * a displacement arrow drew its highlight around a ghost.
 *
 * Refusal is the ordinary outcome and is not hidden. The ghost narrows the
 * placement; it does not name one, because every candidate seat lies on the same
 * lattice and a ghost free to sit anywhere on that lattice cannot see the seat.
 * When more than one candidate's ghost fits the printed contour, this says so
 * and places nothing.
 */

export interface ExplodedGhostEvidence {
  /** Distinct arrow displacements the ghosts were drawn back along. */
  readonly displacements: number;
  readonly wholeStepCandidates: number;
  readonly rendered: number;
  /** Pixels the panel's own highlight region covers. */
  readonly printedRegionPx: number;
  /** The winning-or-best candidate's own ghost silhouette, in pixels. */
  readonly ghostSilhouettePx: number;
  /** What a wholly contained ghost of that size scores against this region. */
  readonly containmentCeiling: number;
  readonly bestRegionIou: number | null;
  readonly runnerUpRegionIou: number | null;
  readonly bestOutsideRegionPx: number | null;
  /** Candidates whose ghost lies wholly inside the printed contour. */
  readonly containedCandidates: number;
  readonly settled: boolean;
}

export interface ExplodedStepSettlement<D> {
  readonly evidence: ExplodedGhostEvidence;
  readonly failure: StepFailure | null;
  readonly pieceReports: readonly RealBuildPieceReport[];
  readonly placement: DeferredPlacementResult<D> | null;
}

type PlacementTransform = {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
};

/** The shape `measureGhostContainment` returns through the untrusted module. */
type GhostContainment = {
  readonly ghostPx: number;
  readonly insideRegionPx: number;
  readonly outsideRegionPx: number;
  readonly regionIou: number;
  readonly containmentCeiling: number;
  readonly contained: boolean;
};

// The browser probe's modules are untrusted dynamic imports; the typed Node
// finalizer recomputes everything they produce.
type BrowserModule = ReturnType<typeof JSON.parse>;

/**
 * Which of a seat's two ghosts represents the seat: containment first.
 *
 * `contained` is the hard test the decision turns on — every ghost pixel inside
 * the printed contour, with no threshold in it — and `regionIou` is a soft
 * score. Keeping the largest `regionIou` and then reading *that* member's
 * `contained` flag mixes them: a seat holding a contained member can be recorded
 * as uncontained because some other member's larger silhouette scored higher
 * while spilling outside. So a contained member always represents its seat, and
 * `regionIou` only separates members that agree on containment.
 */
function representsSeat(candidate: GhostContainment, incumbent: GhostContainment): boolean {
  if (candidate.contained !== incumbent.contained) return candidate.contained;
  return candidate.regionIou > incumbent.regionIou;
}

export function settleExplodedPrintedStep<D>(input: {
  readonly spec: RealBuildPanelSpec;
  readonly baseDocument: D;
  readonly stepId: string | null;
  readonly evidence: PanelRasterEvidence;
  readonly options: RealBuildOptions;
  readonly view: {
    readonly azimuthDegrees: number;
    readonly elevationDegrees: number;
    readonly pixelsPerUnit: number;
  };
  readonly centrePx: readonly [number, number];
  readonly rendering: BrowserModule;
  readonly kernel: BrowserModule;
  readonly assembly: BrowserModule;
  readonly place: (
    base: D,
    catalogPartId: string,
    transform: unknown,
    colorId: string,
    printedStepNumber: number,
    targetStepId: string | null,
  ) => { readonly document: D; readonly partId: string; readonly stepId: string };
}): ExplodedStepSettlement<D> {
  const { spec, evidence, options, rendering, kernel, assembly } = input;
  const { width, height, highlight } = evidence;
  const baseHash = kernel.documentStructuralHash(input.baseDocument) as string;

  let printedRegionPx = 0;
  for (let pixel = 0; pixel < highlight.mask.length; pixel += 1) {
    if (highlight.mask[pixel] === 1) printedRegionPx += 1;
  }

  const emptyEvidence: ExplodedGhostEvidence = {
    displacements: 0,
    wholeStepCandidates: 0,
    rendered: 0,
    printedRegionPx,
    ghostSilhouettePx: 0,
    containmentCeiling: 0,
    bestRegionIou: null,
    runnerUpRegionIou: null,
    bestOutsideRegionPx: null,
    containedCandidates: 0,
    settled: false,
  };

  const refused = (
    ghostEvidence: ExplodedGhostEvidence,
    failure: StepFailure,
  ): ExplodedStepSettlement<D> => ({
    evidence: ghostEvidence,
    failure,
    pieceReports: spec.pieces.map((piece, pieceIndex) => ({
      catalogPartId: piece.catalogPartId,
      blind: {
        comparisonPrefixHash: baseHash,
        distinctCandidates: ghostEvidence.wholeStepCandidates,
        feasible: ghostEvidence.wholeStepCandidates > 0,
        rendered: ghostEvidence.rendered,
        bestScore: ghostEvidence.bestRegionIou,
        runnerUpScore: ghostEvidence.runnerUpRegionIou,
        agreesWithHighlight: null,
        refusal: failure.message,
        elapsedMs: 0,
      },
      enumerated: ghostEvidence.wholeStepCandidates,
      afterProximity: ghostEvidence.wholeStepCandidates,
      rendered: ghostEvidence.rendered,
      bestScore: ghostEvidence.bestRegionIou,
      runnerUpScore: ghostEvidence.runnerUpRegionIou,
      placed: false,
      positionLdu: null,
      orientationId: null,
      failure: pieceIndex === 0 ? failure : { ...failure, pieceIndex },
    })),
    placement: null,
  });

  if (printedRegionPx === 0 || highlight.regions.length === 0) {
    return refused(emptyEvidence, {
      code: "no-placement-signal",
      stage: "evidence",
      stepNumber: spec.stepNumber,
      message:
        `Step ${spec.stepNumber} prints displacement arrows, so its highlight rings a ghost rather than a ` +
        `seat, but that highlight encloses ${printedRegionPx}px over ${highlight.regions.length} region(s). ` +
        `A ghost is compared by area against the contour drawn round it, and an unenclosed contour supplies no area.`,
    });
  }
  if (evidence.arrowFamily.length === 0) {
    return refused(emptyEvidence, {
      code: "no-placement-signal",
      stage: "evidence",
      stepNumber: spec.stepNumber,
      message:
        `Step ${spec.stepNumber} draws ${(evidence.arrows.arrows as unknown[]).length} displacement arrow(s), ` +
        `so its highlight rings a ghost, but no whole-grid displacement matches them through this panel's ` +
        `projection. Without the travel there is nothing to draw the candidate back along, and scoring it ` +
        `where it seats would measure it against a contour the booklet put somewhere else.`,
    });
  }

  const displacements = evidence.arrowFamily;

  const enumeration = enumerateWholeStepCandidates<D>({
    baseDocument: input.baseDocument,
    stepId: input.stepId,
    pieces: spec.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId })),
    enumerateDistinct: (document, catalogPartId) => {
      const enumerated = assembly.enumeratePlacements(document, catalogPartId, {
        includeBuildPlate: (document as { parts: unknown[] }).parts.length === 0,
      });
      const seen = new Set<string>();
      const distinct: PlacementTransform[] = [];
      for (const candidate of enumerated.candidates as readonly {
        catalogPartId: string;
        transform: PlacementTransform;
      }[]) {
        const key = assembly.placementOccupancyKey(
          candidate.catalogPartId,
          candidate.transform,
        ) as string;
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push(candidate.transform);
      }
      return distinct;
    },
    place: (document, catalogPartId, transform, colorId, stepId) =>
      input.place(document, catalogPartId, transform, colorId, spec.stepNumber, stepId),
    // An exploded step's highlight rings the ghost rather than the seat, so
    // this panel cannot narrow a seated placement at all: the ghost gate is
    // where its own art gets read.
    narrow: null,
    narrowingRenderBudget: options.deferredNarrowingRenderBudget,
    budget: options.deferredCandidateBudget,
  });

  const renders = enumeration.candidates.length * displacements.length;
  if (enumeration.overBudget || renders > options.explodedGhostRenderBudget) {
    return refused(
      {
        ...emptyEvidence,
        displacements: displacements.length,
        wholeStepCandidates: enumeration.overBudget
          ? enumeration.budget + 1
          : enumeration.candidates.length,
      },
      {
        code: "resource-budget-exhausted",
        stage: "budget",
        stepNumber: spec.stepNumber,
        message:
          `Step ${spec.stepNumber} is drawn exploded, and redrawing its ${enumeration.candidates.length} ` +
          `whole-step candidates back along ${displacements.length} distinct arrow displacement(s) needs ` +
          `${renders} renders against the explicit ${options.explodedGhostRenderBudget} budget ` +
          `(${enumeration.perPiece.join(" x ")} distinct placements per piece on the first branch). It was ` +
          `refused rather than truncated: a capped product would report the step settled against a set that ` +
          `may never have contained the answer.`,
      },
    );
  }

  const frame = {
    widthPx: width,
    heightPx: height,
    target: [0, 0, 0] as [number, number, number],
    sceneRadius: 60,
  };
  const scored: {
    candidate: (typeof enumeration.candidates)[number];
    containment: GhostContainment;
  }[] = [];
  let rendered = 0;
  const renderer = rendering.createInstructionRenderer({ width, height });
  try {
    for (const candidate of enumeration.candidates) {
      const placedParts = (
        candidate.document as {
          parts: readonly { readonly id: string; readonly transform: PlacementTransform }[];
        }
      ).parts;
      const belongsToStep = new Set(candidate.partIds);
      let best: GhostContainment | null = null;
      for (const displacement of displacements) {
        // The ghost is a render-only derived artifact: never validated, never
        // handed to a command, never a candidate. Only the seat is ever placed.
        // `deriveBrickScene` reads `parts`, so this is the step's own pieces
        // alone — which is what the booklet draws, clear of the assembly, and
        // what makes the prediction unoccluded.
        const ghostDocument = {
          ...(input.baseDocument as object),
          parts: placedParts
            .filter((part) => belongsToStep.has(part.id))
            .map((part) => ({
              ...part,
              transform: {
                ...part.transform,
                positionLdu: [
                  part.transform.positionLdu[0] - displacement.lduX,
                  part.transform.positionLdu[1] - displacement.lduY,
                  part.transform.positionLdu[2] - displacement.lduZ,
                ] as [number, number, number],
              },
            })),
          steps: [],
        };
        const scene = rendering.deriveBrickScene(ghostDocument, { finish: "instruction" });
        let pixels: Uint8Array;
        try {
          rendering.setInstructionSilhouetteMode(scene.root, true);
          const camera = rendering.createOrthographicViewCamera(
            { ...input.view, centerXPx: input.centrePx[0], centerYPx: input.centrePx[1] },
            frame,
          );
          pixels = new Uint8Array(renderer.render(scene.root, camera));
        } finally {
          scene.dispose();
        }
        rendered += 1;
        const ghostMask = instructionSilhouetteMasks(pixels, width, height, 0x923978).all;
        // Predicting the ghost unoccluded assumes the booklet drew it clear of
        // the assembly, and the containment test enforces that for free rather
        // than needing a second guard: `alreadyBuiltMask` removes the highlight
        // region from the panel's art, so a ghost wholly inside that region
        // cannot overlap the already-built art at all.
        const containment = assembly.measureGhostContainment(
          ghostMask,
          highlight.mask as Uint8Array,
        ) as GhostContainment;
        // Containment decides, `regionIou` only orders — see `representsSeat`.
        // Measured on printed panel 2 no seat of 105 changes hands, so this
        // moves no current outcome; it is what makes the set handed to
        // `decideExplodedGhostPlacement` exactly "seats with a contained
        // member" rather than a sample of it.
        if (best === null || representsSeat(containment, best)) best = containment;
      }
      if (best !== null) scored.push({ candidate, containment: best });
    }
  } finally {
    renderer.dispose();
  }

  const decision = assembly.decideExplodedGhostPlacement(scored) as {
    best: (typeof scored)[number] | null;
    runnerUp: (typeof scored)[number] | null;
    containedCount: number;
    winner: (typeof scored)[number] | null;
  };
  const ghostEvidence: ExplodedGhostEvidence = {
    displacements: displacements.length,
    wholeStepCandidates: enumeration.candidates.length,
    rendered,
    printedRegionPx,
    ghostSilhouettePx: decision.best?.containment.ghostPx ?? 0,
    containmentCeiling: decision.best?.containment.containmentCeiling ?? 0,
    bestRegionIou: decision.best?.containment.regionIou ?? null,
    runnerUpRegionIou: decision.runnerUp?.containment.regionIou ?? null,
    bestOutsideRegionPx: decision.best?.containment.outsideRegionPx ?? null,
    containedCandidates: decision.containedCount,
    settled: decision.winner !== null,
  };

  if (decision.winner === null) {
    const shared =
      `Step ${spec.stepNumber} is drawn exploded: its ${printedRegionPx}px highlight region outlines the ghost, ` +
      `and each of ${enumeration.candidates.length} whole-step candidates was redrawn back along ` +
      `${displacements.length} arrow displacement(s) and compared against it. `;
    return refused(
      ghostEvidence,
      decision.containedCount === 0
        ? {
            code: "whole-step-score-too-low",
            stage: "evidence",
            stepNumber: spec.stepNumber,
            message:
              shared +
              `No candidate's ghost lies wholly inside that contour. The best reaches region agreement ` +
              `${ghostEvidence.bestRegionIou} with ${ghostEvidence.bestOutsideRegionPx}px of ` +
              `${ghostEvidence.ghostSilhouettePx} outside it, against the ${ghostEvidence.containmentCeiling} ` +
              `a contained ghost of that size would score on this panel. The booklet draws the yellow clear ` +
              `of the part, so a correct ghost has no pixel outside it; the shortfall is in the travel, not ` +
              `in the bar.`,
          }
        : {
            code: "ambiguous-exploded-ghost",
            stage: "evidence",
            stepNumber: spec.stepNumber,
            message:
              shared +
              `${decision.containedCount} of them lie wholly inside it, scoring ` +
              `${ghostEvidence.bestRegionIou} and ${ghostEvidence.runnerUpRegionIou} against a containment ` +
              `ceiling of ${ghostEvidence.containmentCeiling}. Every candidate seat sits on the same lattice, ` +
              `so a ghost that fits says the part is drawn there and not which seat it came from. The step is ` +
              `refused rather than settled on a picture that does not separate them.`,
          },
    );
  }

  const winner = decision.winner.candidate;
  return {
    evidence: ghostEvidence,
    failure: null,
    pieceReports: spec.pieces.map((piece, pieceIndex) => ({
      catalogPartId: piece.catalogPartId,
      blind: {
        comparisonPrefixHash: baseHash,
        distinctCandidates: enumeration.candidates.length,
        feasible: true,
        rendered,
        bestScore: ghostEvidence.bestRegionIou,
        runnerUpScore: ghostEvidence.runnerUpRegionIou,
        agreesWithHighlight: true,
        refusal: null,
        elapsedMs: 0,
      },
      enumerated: enumeration.candidates.length,
      afterProximity: enumeration.candidates.length,
      rendered,
      bestScore: ghostEvidence.bestRegionIou,
      runnerUpScore: ghostEvidence.runnerUpRegionIou,
      placed: true,
      positionLdu: winner.transforms[pieceIndex]!.positionLdu,
      orientationId: winner.transforms[pieceIndex]!.orientationId,
      failure: null,
    })),
    placement: {
      document: winner.document,
      partIds: winner.partIds,
      stepId: winner.stepId,
      registrations: spec.pieces.map((piece, pieceIndex) => ({
        identityKey: piece.identityKey,
        partId: winner.partIds[pieceIndex]!,
        stepNumber: spec.stepNumber,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
      })),
    },
  };
}
