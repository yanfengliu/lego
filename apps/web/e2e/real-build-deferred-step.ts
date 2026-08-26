import { maskCentroid } from "./real-build-contract";
import {
  deferredReachFailure,
  describeDeferralTrigger,
  enumerateWholeStepCandidates,
  registerPrefixAgreement,
  selectDeferredPlacement,
  type DeferralEvidence,
  type DeferralTrigger,
} from "./real-build-deferral";
import {
  prepareDeferredLookahead,
  type DeferredUnresolvedCandidate,
} from "./real-build-deferred-lookahead";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "./real-build-farther-report-types";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type {
  RealBuildOptions,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
  RealBuildPieceReport,
  StepFailure,
} from "./real-build-safety";

/**
 * A printed step settled by the next panel instead of its own.
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
  /**
   * Every complete step-N candidate retained when N+1 cannot settle the step.
   * This is deliberately empty for an ordinary one-panel settlement and for a
   * refusal that happened before complete candidates were scored.  A farther
   * coordinator may consume only this exact set; reconstructing candidates
   * after the refusal would sever the score from the document it judged.
   */
  readonly unresolvedCandidates: readonly DeferredUnresolvedCandidate<D>[];
}

export type { DeferredUnresolvedCandidate } from "./real-build-deferred-lookahead";

type PlacementTransform = {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
};

// Dynamic browser imports are untrusted; the typed Node finalizer recomputes their output.
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
    readonly spec: RealBuildPanelRasterSpec;
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
    unresolvedCandidates: readonly DeferredUnresolvedCandidate<D>[] = [],
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
    unresolvedCandidates,
  });

  const emptyEvidence: DeferralEvidence = {
    trigger: input.trigger,
    ownPanelMargin: input.ownPanelMargin,
    ownPanelMinimumMargin: input.ownPanelMinimumMargin,
    lookaheadStepNumber: lookahead?.spec.stepNumber ?? null,
    reachSteps,
    lookaheadUpSign: null,
    lookaheadMeasure: null,
    lookaheadTurnDegrees: null,
    lookaheadTurnAnchorIou: null,
    lookaheadTurnMargin: null,
    wholeStepCandidates: 0,
    narrowingRenders: 0,
    offeredPerPiece: [],
    carriedPerPiece: [],
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

  const lookaheadPreparation = prepareDeferredLookahead({
    spec,
    lookahead,
    options,
    baseDocument: input.baseDocument,
    rendering,
  });
  if (!lookaheadPreparation.ready) {
    return refused(emptyEvidence, lookaheadPreparation.failure);
  }
  const {
    builtCentroid,
    builtMask,
    cameraEvidence,
    excludedMask,
    height,
    lookaheadBuiltPixels,
    measure,
    renderer,
    renderSilhouetteAt,
    turnDegrees,
    width,
  } = lookaheadPreparation;

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
    placementKey: (catalogPartId, transform) =>
      assembly.placementOccupancyKey(catalogPartId, transform) as string,
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
    renderer.dispose();
    return refused(
      {
        ...emptyEvidence,
        ...cameraEvidence,
        wholeStepCandidates: 0,
        narrowingRenders: enumeration.narrowingRenders,
        offeredPerPiece: enumeration.perPiece,
        carriedPerPiece: enumeration.perPieceCarried,
      },
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
    renderer.dispose();
    return refused(
      {
        ...emptyEvidence,
        ...cameraEvidence,
        // No complete candidate set was admitted or scored. Keep this at zero
        // rather than using `budget + 1` as an overloaded sentinel: a nonzero
        // count means exact complete candidates exist and therefore makes the
        // bounded farther path mandatory at the hostile report boundary.
        wholeStepCandidates: 0,
        narrowingRenders: enumeration.narrowingRenders,
        offeredPerPiece: enumeration.perPiece,
        carriedPerPiece: enumeration.perPieceCarried,
      },
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

  const scored: {
    candidate: (typeof enumeration.candidates)[number];
    agreement: number;
    lookaheadShiftPx: readonly [number, number];
  }[] = [];
  // A later farther-panel row needs one source capture for N+1 and one for K.
  // Reserve those two slots here, then keep every N+1 render that can fit under
  // the separately bounded farther-panel render contract without rerendering.
  const originCaptureLimit = Math.max(1, MAXIMUM_REAL_BUILD_FARTHER_CAPTURES - 2);
  const retainedScorePixels: {
    candidate: (typeof enumeration.candidates)[number];
    agreement: number;
    order: number;
    pixels: Uint8Array;
  }[] = [];
  let rendered = 0;
  try {
    for (const [order, candidate] of enumeration.candidates.entries()) {
      const scoreRender = renderSilhouetteAt(candidate.document, turnDegrees);
      const candidateMask = scoreRender.mask;
      rendered += 1;
      const from = maskCentroid(candidateMask, width, height);
      if (from === null || builtCentroid === null) {
        scored.push({ candidate, agreement: 0, lookaheadShiftPx: [0, 0] });
        retainedScorePixels.push({ candidate, agreement: 0, order, pixels: scoreRender.pixels });
      } else {
        const agreement = registerPrefixAgreement({
          candidateMask,
          builtMask,
          excludedMask,
          width,
          height,
          seedPx: [builtCentroid.x - from.x, builtCentroid.y - from.y],
          measure,
        });
        scored.push({
          candidate,
          agreement: agreement.agreement,
          lookaheadShiftPx: agreement.shiftPx,
        });
        retainedScorePixels.push({
          candidate,
          agreement: agreement.agreement,
          order,
          pixels: scoreRender.pixels,
        });
      }
      retainedScorePixels.sort(
        (left, right) => right.agreement - left.agreement || left.order - right.order,
      );
      if (retainedScorePixels.length > originCaptureLimit) retainedScorePixels.pop();
    }
  } finally {
    renderer.dispose();
  }
  const lookaheadPixelsByCandidate = new Map(
    retainedScorePixels.map(({ candidate, pixels }) => [candidate, pixels]),
  );

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
    ...cameraEvidence,
    wholeStepCandidates: enumeration.candidates.length,
    narrowingRenders: enumeration.narrowingRenders,
    offeredPerPiece: enumeration.perPiece,
    carriedPerPiece: enumeration.perPieceCarried,
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
    const unresolvedCandidates = scored.map(({ candidate, agreement, lookaheadShiftPx }) => {
      const documentHash = kernel.documentStructuralHash(candidate.document) as string;
      return Object.freeze({
        candidateId: `step-${String(spec.stepNumber).padStart(3, "0")}:${documentHash}`,
        document: candidate.document,
        documentHash,
        partIds: Object.freeze([...candidate.partIds]),
        stepId: candidate.stepId,
        registrations: Object.freeze(
          spec.pieces.map((piece, pieceIndex) =>
            Object.freeze({
              identityKey: piece.identityKey,
              partId: candidate.partIds[pieceIndex]!,
              stepNumber: spec.stepNumber,
              designId: piece.designId,
              materialId: piece.materialId,
              catalogPartId: piece.catalogPartId,
              colorId: piece.colorId,
            }),
          ),
        ),
        pieces: Object.freeze(
          spec.pieces.map((piece, pieceIndex) =>
            Object.freeze({
              catalogPartId: piece.catalogPartId,
              colorId: piece.colorId,
              transform: Object.freeze({
                positionLdu: Object.freeze([
                  candidate.transforms[pieceIndex]!.positionLdu[0],
                  candidate.transforms[pieceIndex]!.positionLdu[1],
                  candidate.transforms[pieceIndex]!.positionLdu[2],
                ]) as readonly [number, number, number],
                orientationId: candidate.transforms[pieceIndex]!.orientationId,
              }),
            }),
          ),
        ),
        lookaheadAgreement: agreement,
        lookaheadShiftPx: Object.freeze([...lookaheadShiftPx]) as readonly [number, number],
        lookaheadPixels: lookaheadPixelsByCandidate.get(candidate) ?? null,
      });
    });
    return refused(evidence, decision.failure!, Object.freeze(unresolvedCandidates));
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
    unresolvedCandidates: [],
  };
}
