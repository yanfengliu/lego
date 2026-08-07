import { instructionSilhouetteMasks, maskCentroid } from "./real-build-contract";
import {
  deferredReachFailure,
  enumerateWholeStepCandidates,
  registerPrefixAgreement,
  selectDeferredPlacement,
  type DeferralEvidence,
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
  readonly baseDocument: D;
  readonly stepId: string | null;
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
        `Step ${spec.stepNumber} printed no highlight, so nothing local can score its candidates, and no ` +
        `later printed step was requested to settle it against. A one-step lookahead needs panel N+1; ` +
        `extend the requested range rather than accepting the first enumerated placement.`,
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
    budget: options.deferredCandidateBudget,
  });

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
          `(${enumeration.perPiece.join(" x ")} distinct placements per piece on the first branch). It was ` +
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
    lookaheadStepNumber: lookahead.spec.stepNumber,
    reachSteps,
    lookaheadBuiltPixels,
    scores: scored,
    minimumMargin,
    minimumAgreement,
  });
  const ordered = [...scored].sort((left, right) => right.agreement - left.agreement);
  const evidence: DeferralEvidence = {
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
