import { instructionSilhouetteMasks, maskCentroid } from "./real-build-contract";
import {
  deferredReachFailure,
  describeDeferralTrigger,
  enumerateWholeStepCandidates,
  registerPrefixAgreement,
  selectDeferredPlacement,
  type DeferralEvidence,
  type DeferralTrigger,
} from "./real-build-deferral";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type {
  RealBuildOptions,
  RealBuildPanelSpec,
  RealBuildPieceReport,
  StepFailure,
} from "./real-build-safety";

/**
 * A printed step settled by the next panel instead of its own.
 *
 * Kept out of `runRealBuild` because it is a different decision procedure, not a
 * variant of the per-piece one: the pieces of a deferred step cannot be settled
 * one at a time, since the second is enumerated on top of the first and neither
 * has any local evidence to be ranked by. The whole step is proposed as one
 * object, and one object is what the lookahead panel scores.
 */

export interface DeferredPlacementResult<D> {
  readonly document: D;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
}

export interface DeferredStepSettlement<D> {
  readonly evidence: DeferralEvidence;
  readonly failure: StepFailure | null;
  readonly pieceReports: readonly RealBuildPieceReport[];
  readonly placement: DeferredPlacementResult<D> | null;
}

type PlacementTransform = {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
};

// The browser probe's modules are untrusted dynamic imports; the typed Node
// finalizer recomputes everything they produce.
type BrowserModule = ReturnType<typeof JSON.parse>;

export function settleDeferredPrintedStep<D>(input: {
  readonly spec: RealBuildPanelSpec;
  readonly trigger: DeferralTrigger;
  /**
   * How far apart the step's own panel put its best two candidates, and the
   * margin it had to clear. Null when the panel gave no local ranking at all.
   */
  readonly ownPanelMargin: number | null;
  readonly ownPanelMinimumMargin: number | null;
  readonly baseDocument: D;
  readonly stepId: string | null;
  /**
   * What the step's own panel can still say about a piece, or null when it can
   * say nothing at all.
   *
   * Given every placement offered on one branch, it returns the ones that panel
   * could not separate from its best. A step deferred for want of any signal has
   * no such function and carries the whole product; a step deferred because its
   * panel could not choose has one, and without it the product is unscoreable —
   * printed step 4's is 240 x 334.
   */
  readonly narrowByOwnPanel:
    | ((input: {
        readonly document: D;
        readonly stepId: string | null;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly offered: readonly PlacementTransform[];
      }) => readonly PlacementTransform[])
    | null;
  readonly lookahead: {
    readonly spec: RealBuildPanelSpec;
    readonly evidence: PanelRasterEvidence;
  } | null;
  readonly options: RealBuildOptions;
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
}): DeferredStepSettlement<D> {
  const { spec, lookahead, options, rendering, kernel, assembly } = input;
  const minimumMargin = options.minimumDeferredAgreementMargin;
  const minimumAgreement = options.minimumDeferredAgreement;
  const reachSteps = lookahead === null ? 0 : lookahead.spec.stepNumber - spec.stepNumber;
  const baseHash = kernel.documentStructuralHash(input.baseDocument) as string;

  const refused = (
    evidence: DeferralEvidence,
    failure: StepFailure,
  ): DeferredStepSettlement<D> => ({
    evidence,
    failure,
    pieceReports: spec.pieces.map((piece, pieceIndex) => ({
      catalogPartId: piece.catalogPartId,
      blind: {
        comparisonPrefixHash: baseHash,
        distinctCandidates: evidence.wholeStepCandidates,
        feasible: !evidence.settled && evidence.wholeStepCandidates > 0,
        rendered: evidence.rendered,
        bestScore: evidence.bestAgreement,
        runnerUpScore: evidence.runnerUpAgreement,
        agreesWithHighlight: null,
        refusal: failure.message,
        elapsedMs: 0,
      },
      enumerated: evidence.wholeStepCandidates,
      afterProximity: evidence.wholeStepCandidates,
      rendered: evidence.rendered,
      bestScore: evidence.bestAgreement,
      runnerUpScore: evidence.runnerUpAgreement,
      placed: false,
      positionLdu: null,
      orientationId: null,
      failure: pieceIndex === 0 ? failure : { ...failure, pieceIndex },
    })),
    placement: null,
  });

  const emptyEvidence: DeferralEvidence = {
    trigger: input.trigger,
    ownPanelMargin: input.ownPanelMargin,
    ownPanelMinimumMargin: input.ownPanelMinimumMargin,
    lookaheadStepNumber: lookahead?.spec.stepNumber ?? null,
    reachSteps,
    wholeStepCandidates: 0,
    rendered: 0,
    lookaheadBuiltPixels: 0,
    bestAgreement: null,
    runnerUpAgreement: null,
    margin: null,
    minimumMargin,
    minimumAgreement,
    settled: false,
  };

  if (lookahead === null) {
    return refused(emptyEvidence, {
      code: "deferred-panel-unscored",
      stage: "evidence",
      stepNumber: spec.stepNumber,
      message:
        `Step ${spec.stepNumber} ${describeDeferralTrigger(input.trigger)}, and no later printed step was ` +
        `requested to settle it against. A one-step lookahead needs panel N+1; extend the requested range ` +
        `rather than accepting the first enumerated placement.`,
    });
  }

  const outOfReach = deferredReachFailure({
    stepNumber: spec.stepNumber,
    lookaheadStepNumber: lookahead.spec.stepNumber,
    reachSteps,
  });
  if (outOfReach !== null) {
    return refused(
      { ...emptyEvidence, lookaheadStepNumber: lookahead.spec.stepNumber },
      outOfReach,
    );
  }

  const view =
    lookahead.evidence.faceCorrectedFit === null
      ? null
      : {
          azimuthDegrees: lookahead.evidence.faceCorrectedFit.azimuthDegrees,
          elevationDegrees: lookahead.evidence.faceCorrectedFit.elevationDegrees,
          pixelsPerUnit: lookahead.evidence.faceCorrectedFit.pixelsPerUnit / options.workFactor,
        };
  if (view === null) {
    return refused(emptyEvidence, {
      code: "deferred-panel-unscored",
      stage: "evidence",
      stepNumber: spec.stepNumber,
      message:
        `Step ${spec.stepNumber} deferred to printed step ${lookahead.spec.stepNumber}, which has no ` +
        `face-corrected camera (fit ${JSON.stringify(lookahead.evidence.fitFailure)}, face ` +
        `${JSON.stringify(lookahead.spec.panelFace)}). A candidate rendered at an unknown angle or face is ` +
        `compared against a different picture than the one printed.`,
    });
  }

  // Whether the lookahead panel can say where it stopped drawing what this step
  // built — asked before anything is enumerated or rendered, because it is a
  // fact about the printed page rather than about any candidate.
  //
  // The agreement this deferral is decided by is defined on panel N+1's art
  // *minus the region its own new pieces occupy*, and that region comes from the
  // filled highlight. A panel whose highlight contour does not close yields a
  // stroke and no filled region, so nothing but a thin outline is removed and
  // the pieces panel N+1 places are left inside the art step N is required to
  // explain. The prefix then cannot reach any bar, and reporting that as a weak
  // agreement would blame the candidate for pixels no candidate could own.
  const openHighlight = (() => {
    const { mask, strokeMask, regions, keyedPx } = lookahead.evidence.highlight;
    if (regions.length === 0 && keyedPx === 0) return null;
    let strokePx = 0;
    let fillPx = 0;
    for (let index = 0; index < strokeMask.length; index += 1) {
      if (strokeMask[index] === 1) strokePx += 1;
      else if (mask[index] === 1) fillPx += 1;
    }
    if (fillPx > 0) return null;
    return { strokePx, regions: regions.length };
  })();
  if (openHighlight !== null) {
    return refused(emptyEvidence, {
      code: "deferred-panel-unscored",
      stage: "evidence",
      stepNumber: spec.stepNumber,
      message:
        `Step ${spec.stepNumber} deferred to printed step ${lookahead.spec.stepNumber}, whose highlight is ` +
        `${openHighlight.regions} open contour(s) — ${openHighlight.strokePx}px of stroke enclosing no filled ` +
        `region. The region a lookahead panel's own new pieces occupy is exactly what has to be excluded ` +
        `before the rest can be attributed to step ${spec.stepNumber}, and an outline that does not close ` +
        `does not give it. Scoring anyway would charge this step's prefix with drawing the pieces step ` +
        `${lookahead.spec.stepNumber} places, which no prefix can do; the ceiling is the panel's contour, ` +
        `not the candidates.`,
    });
  }

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
    narrow: input.narrowByOwnPanel,
    narrowingRenderBudget: options.deferredNarrowingRenderBudget,
    place: (document, catalogPartId, transform, colorId, stepId) =>
      input.place(document, catalogPartId, transform, colorId, spec.stepNumber, stepId),
    budget: options.deferredCandidateBudget,
  });

  // What the first branch offered and what survived this step's own panel, so a
  // budget refusal says whether the product blew up because the step is that
  // open or because its panel could not narrow it.
  const perBranch =
    input.narrowByOwnPanel === null
      ? enumeration.perPiece.join(" x ")
      : enumeration.perPiece
          .map((offered, index) => `${enumeration.perPieceCarried[index] ?? offered} of ${offered}`)
          .join(" x ");
  if (enumeration.overNarrowingBudget) {
    return refused(
      { ...emptyEvidence, wholeStepCandidates: 0 },
      {
        code: "resource-budget-exhausted",
        stage: "budget",
        stepNumber: spec.stepNumber,
        message:
          `Step ${spec.stepNumber} defers to printed step ${lookahead.spec.stepNumber}, and narrowing its ` +
          `candidates against its own panel passed the explicit ${enumeration.narrowingBudget} render budget ` +
          `(${perBranch} placements per piece on the first branch). It was refused rather than truncated: a ` +
          `narrowing that stopped early would carry forward whichever branches it happened to reach first.`,
      },
    );
  }
  if (enumeration.overBudget) {
    return refused(
      { ...emptyEvidence, wholeStepCandidates: enumeration.budget + 1 },
      {
        code: "resource-budget-exhausted",
        stage: "budget",
        stepNumber: spec.stepNumber,
        message:
          `Step ${spec.stepNumber} defers to printed step ${lookahead.spec.stepNumber}, and its whole-step ` +
          `candidate product exceeds the explicit ${enumeration.budget} budget ` +
          `(${perBranch} distinct placements per piece on the first branch). It was ` +
          `refused rather than truncated: a capped product would report the step settled against a set that ` +
          `may never have contained the answer.`,
      },
    );
  }

  const { width, height, builtMask, highlight } = lookahead.evidence;
  const excludedMask = new Uint8Array(width * height);
  let lookaheadBuiltPixels = 0;
  for (let index = 0; index < excludedMask.length; index += 1) {
    excludedMask[index] = highlight.mask[index] === 1 || highlight.strokeMask[index] === 1 ? 1 : 0;
    if (builtMask[index] === 1) lookaheadBuiltPixels += 1;
  }
  const builtCentroid = maskCentroid(builtMask, width, height);

  const frame = {
    widthPx: width,
    heightPx: height,
    target: [0, 0, 0] as [number, number, number],
    sceneRadius: 60,
  };
  const scored: {
    candidate: (typeof enumeration.candidates)[number];
    agreement: number;
  }[] = [];
  let rendered = 0;
  const renderer = rendering.createInstructionRenderer({ width, height });
  try {
    for (const candidate of enumeration.candidates) {
      const scene = rendering.deriveBrickScene(candidate.document, { finish: "instruction" });
      let pixels: Uint8Array;
      try {
        rendering.setInstructionSilhouetteMode(scene.root, true);
        const camera = rendering.createOrthographicViewCamera(
          { ...view, centerXPx: width / 2, centerYPx: height / 2 },
          frame,
        );
        pixels = new Uint8Array(renderer.render(scene.root, camera));
      } finally {
        scene.dispose();
      }
      rendered += 1;
      const candidateMask = instructionSilhouetteMasks(pixels, width, height, 0x923978).all;
      const from = maskCentroid(candidateMask, width, height);
      if (from === null || builtCentroid === null) {
        scored.push({ candidate, agreement: 0 });
        continue;
      }
      const agreement = registerPrefixAgreement({
        candidateMask,
        builtMask,
        excludedMask,
        width,
        height,
        seedPx: [builtCentroid.x - from.x, builtCentroid.y - from.y],
      });
      scored.push({ candidate, agreement: agreement.agreement });
    }
  } finally {
    renderer.dispose();
  }

  const decision = selectDeferredPlacement({
    stepNumber: spec.stepNumber,
    trigger: input.trigger,
    lookaheadStepNumber: lookahead.spec.stepNumber,
    reachSteps,
    lookaheadBuiltPixels,
    scores: scored,
    minimumMargin,
    minimumAgreement,
  });
  const ordered = [...scored].sort((left, right) => right.agreement - left.agreement);
  const evidence: DeferralEvidence = {
    trigger: input.trigger,
    ownPanelMargin: input.ownPanelMargin,
    ownPanelMinimumMargin: input.ownPanelMinimumMargin,
    lookaheadStepNumber: lookahead.spec.stepNumber,
    reachSteps,
    wholeStepCandidates: enumeration.candidates.length,
    rendered,
    lookaheadBuiltPixels,
    bestAgreement: ordered[0]?.agreement ?? null,
    runnerUpAgreement: ordered[1]?.agreement ?? null,
    margin: decision.margin,
    minimumMargin,
    minimumAgreement,
    settled: decision.failure === null,
  };
  if (decision.failure !== null || decision.winner === null) {
    return refused(evidence, decision.failure!);
  }

  const winner = decision.winner.candidate;
  return {
    evidence,
    failure: null,
    pieceReports: spec.pieces.map((piece, pieceIndex) => ({
      catalogPartId: piece.catalogPartId,
      blind: {
        comparisonPrefixHash: baseHash,
        distinctCandidates: enumeration.candidates.length,
        feasible: true,
        rendered,
        bestScore: evidence.bestAgreement,
        runnerUpScore: evidence.runnerUpAgreement,
        agreesWithHighlight: null,
        refusal: null,
        elapsedMs: 0,
      },
      enumerated: enumeration.candidates.length,
      afterProximity: enumeration.candidates.length,
      rendered,
      bestScore: evidence.bestAgreement,
      runnerUpScore: evidence.runnerUpAgreement,
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
