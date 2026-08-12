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
import { anchorStepCamera } from "./real-build-step-camera";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "./real-build-farther-report-types";
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
  /**
   * Every complete step-N candidate retained when N+1 cannot settle the step.
   *
   * This is deliberately empty for an ordinary one-panel settlement and for a
   * refusal that happened before complete candidates were scored.  A farther
   * coordinator may consume only this exact set; reconstructing candidates
   * after the refusal would sever the score from the document it judged.
   */
  readonly unresolvedCandidates: readonly DeferredUnresolvedCandidate<D>[];
}

export interface DeferredUnresolvedCandidate<D> {
  readonly candidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
  readonly pieces: readonly FartherPlacementWitness[];
  readonly lookaheadAgreement: number;
  /** Registration applied when measuring the lookahead agreement. */
  readonly lookaheadShiftPx: readonly [number, number];
  /**
   * Exact silhouette render whose pixels produced `lookaheadAgreement`.
   *
   * Null only outside the bounded retained subset. The document/hash/witness
   * row remains authoritative for every candidate; this image exists so a
   * reviewer can inspect the score-bearing production render without causing
   * a fresh render after a later aggregate-budget refusal.
   */
  readonly lookaheadPixels: Uint8Array | null;
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

  // The settling panel's own camera, face and all. `faceCorrectedFit` carries
  // the `upSign` the booklet's rotate-the-model icon implies and this used to
  // drop it, which renders every candidate upright: right on a studs-up panel
  // and the opposite side of the drawing on an underside one. A deferral crosses
  // printed pages by construction, so the settling panel's face is not the
  // deferring step's face and cannot be assumed.
  const corrected = lookahead.evidence.faceCorrectedFit as
    (typeof lookahead.evidence.faceCorrectedFit & { readonly upSign?: 1 | -1 }) | null;
  const view =
    corrected === null
      ? null
      : {
          azimuthDegrees: corrected.azimuthDegrees,
          elevationDegrees: corrected.elevationDegrees,
          pixelsPerUnit: corrected.pixelsPerUnit / options.workFactor,
          upSign: corrected.upSign ?? (1 as const),
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
  // explain.
  //
  // That used to be a refusal, and it is the wrong verdict for the same reason
  // printed step 5's `highlight-reuse-unexplained` was: it is arithmetically
  // correct about a question the panel does not answer. About half of this
  // booklet's contours are open, so a lookahead that can only read a closed one
  // cannot settle the booklet. What the open case changes is not whether the
  // panel is evidence but what the evidence says: `builtMask` is then a superset
  // of what any step-N candidate can draw, so the candidate has to be *contained*
  // in it rather than equal to it, and the term that charges a candidate for
  // pixels no candidate could own is dropped. The separation margin still has to
  // be cleared either way.
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
  const measure: "iou" | "containment" = openHighlight === null ? "iou" : "containment";

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

  const renderer = rendering.createInstructionRenderer({ width, height });
  const renderSilhouetteAt = (
    subject: unknown,
    turnDegrees: number,
  ): { readonly mask: Uint8Array; readonly pixels: Uint8Array } => {
    const scene = rendering.deriveBrickScene(subject, { finish: "instruction" });
    try {
      rendering.setInstructionSilhouetteMode(scene.root, true);
      const camera = rendering.createOrthographicViewCamera(
        {
          ...view,
          azimuthDegrees: view.azimuthDegrees + turnDegrees,
          centerXPx: width / 2,
          centerYPx: height / 2,
        },
        frame,
      );
      const pixels = new Uint8Array(renderer.render(scene.root, camera));
      return {
        mask: instructionSilhouetteMasks(pixels, width, height, 0x923978).all,
        pixels,
      };
    } finally {
      scene.dispose();
    }
  };
  const silhouetteAt = (subject: unknown, turnDegrees: number): Uint8Array =>
    renderSilhouetteAt(subject, turnDegrees).mask;

  // Which quarter turn of the settling panel's fitted azimuth it is actually
  // drawn at. The lattice provably cannot say — a quarter turn permutes the
  // projected basis and spans the same lattice — and this deferral used to
  // assume zero, which is right only while the booklet keeps the model the same
  // way up between the deferring step and the one that settles it.
  //
  // Resolved the way `anchorStepCamera` resolves it on a step's own panel: by
  // registering the prefix that is already settled against the panel's
  // already-built art, outside that panel's own highlight. The prefix is not a
  // candidate and is not being chosen here, so the best-registering turn is a
  // measurement of the panel rather than a decision about the build.
  //
  // With nothing built there is nothing to register, and turn zero is not a
  // guess but a definition: all four turns are equally valid world frames and
  // the branch the first printed step settles into is what fixes which one every
  // later step is relative to.
  const basePartCount = (input.baseDocument as { parts: readonly unknown[] }).parts.length;
  let turnDegrees = 0;
  let turnAnchorIou: number | null = null;
  let turnMargin: number | null = null;
  if (basePartCount > 0) {
    const anchored = anchorStepCamera({
      stepNumber: spec.stepNumber,
      renderModelMask: (turn) => silhouetteAt(input.baseDocument, turn),
      builtMask,
      excludedMask,
      widthPx: width,
      heightPx: height,
    });
    if (anchored.failure !== null || anchored.anchorTurnDegrees === null) {
      renderer.dispose();
      return refused(
        emptyEvidence,
        anchored.failure ?? {
          code: "camera-anchor-failed",
          stage: "camera-registration",
          stepNumber: spec.stepNumber,
          message:
            `Step ${spec.stepNumber} deferred to printed step ${lookahead.spec.stepNumber} and could not ` +
            `resolve which quarter turn that panel is drawn at.`,
        },
      );
    }
    turnDegrees = anchored.anchorTurnDegrees;
    turnAnchorIou = anchored.anchorIou;
    turnMargin =
      anchored.anchorTurnIous.length > 1
        ? anchored.anchorTurnIous[0]!.iou - anchored.anchorTurnIous[1]!.iou
        : null;
  }
  const cameraEvidence = {
    lookaheadUpSign: view.upSign,
    lookaheadMeasure: measure,
    lookaheadTurnDegrees: turnDegrees,
    lookaheadTurnAnchorIou: turnAnchorIou,
    lookaheadTurnMargin: turnMargin,
  } as const;

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
