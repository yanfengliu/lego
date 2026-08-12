import { instructionSilhouetteMasks, maskCentroid } from "./real-build-contract";
import {
  createNarrowingRenderBudgetLedger,
  enumerateWholeStepCandidates,
  placementsOwnPanelCannotSeparate,
  registerPrefixAgreement,
  type NarrowingRenderBudgetLedger,
  type WholeStepCandidateBudgetLedger,
  type WholeStepPlacementTransform,
} from "./real-build-deferral";
import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import { runFartherPanelDriver } from "./real-build-farther-driver";
import { findFirstRevealingPanel } from "./real-build-farther-panel";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type {
  FartherRefusal,
  FartherPanelObservationInput,
  FartherParentExpansion,
  FartherPlacementWitness,
} from "./real-build-farther-panel-types";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import { rgbaPngDataUrl, type PreparedRealBuildModules } from "./real-build-browser-preflight";
import { anchorStepCamera, createStepSilhouette } from "./real-build-step-camera";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  RealBuildOptions,
  RealBuildPanelSpec,
  RealBuildPieceReport,
  StepFailure,
} from "./real-build-safety";

type PlacementTransform = WholeStepPlacementTransform;

export interface FartherStepChildMetadata<D> {
  readonly candidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface FartherStepExpansionResult<D> {
  readonly expansion: FartherParentExpansion<D>;
  readonly children: readonly FartherStepChildMetadata<D>[];
  readonly narrowingBudgetExhausted: boolean;
  readonly candidateBudgetExhausted: boolean;
  readonly failure: StepFailure | null;
}

type Place<D> = (
  base: D,
  catalogPartId: string,
  transform: unknown,
  colorId: string,
  printedStepNumber: number,
  targetStepId: string | null,
) => { readonly document: D; readonly partId: string; readonly stepId: string };

const correctedView = (
  evidence: PanelRasterEvidence,
  options: RealBuildOptions,
): {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly upSign: 1 | -1;
} | null => {
  const corrected = evidence.faceCorrectedFit as
    (NonNullable<PanelRasterEvidence["faceCorrectedFit"]> & { readonly upSign?: 1 | -1 }) | null;
  return corrected === null
    ? null
    : {
        azimuthDegrees: corrected.azimuthDegrees,
        elevationDegrees: corrected.elevationDegrees,
        pixelsPerUnit: corrected.pixelsPerUnit / options.workFactor,
        upSign: corrected.upSign ?? 1,
      };
};

const frameFor = (evidence: PanelRasterEvidence) => ({
  widthPx: evidence.width,
  heightPx: evidence.height,
  target: [0, 0, 0] as const,
  sceneRadius: 60,
});

const witnessesFor = (
  spec: RealBuildPanelSpec,
  transforms: readonly PlacementTransform[],
): readonly FartherPlacementWitness[] =>
  Object.freeze(
    spec.pieces.map((piece, index) =>
      Object.freeze({
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        transform: Object.freeze({
          positionLdu: Object.freeze([
            transforms[index]!.positionLdu[0],
            transforms[index]!.positionLdu[1],
            transforms[index]!.positionLdu[2],
          ]) as readonly [number, number, number],
          orientationId: transforms[index]!.orientationId,
        }),
      }),
    ),
  );

const registrationsFor = (
  spec: RealBuildPanelSpec,
  partIds: readonly string[],
): readonly RuntimeBrickIdentity[] =>
  Object.freeze(
    spec.pieces.map((piece, index) =>
      Object.freeze({
        identityKey: piece.identityKey,
        partId: partIds[index]!,
        stepNumber: spec.stepNumber,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
      }),
    ),
  );

/** Expands one exact parent through one complete printed step under a shared live ledger. */
export function expandFartherPrintedStep<D>(input: {
  readonly parentCandidateId: string;
  readonly parentDocument: D;
  readonly parentStepId: string | null;
  readonly spec: RealBuildPanelSpec;
  readonly evidence: PanelRasterEvidence;
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "rendering" | "kernel" | "assembly">;
  readonly ledger: NarrowingRenderBudgetLedger;
  readonly candidateLedger?: WholeStepCandidateBudgetLedger;
  readonly place: Place<D>;
}): FartherStepExpansionResult<D> {
  const { spec, evidence, options, modules } = input;
  const { rendering, kernel, assembly } = modules;
  const view = correctedView(evidence, options);
  const emptyExpansion = (narrowingRenders = 0): FartherParentExpansion<D> => ({
    parentCandidateId: input.parentCandidateId,
    narrowingRenders,
    offeredPerPiece: spec.pieces.map(() => 0),
    carriedPerPiece: spec.pieces.map(() => 0),
    children: [],
  });
  if (view === null) {
    return {
      expansion: emptyExpansion(),
      children: [],
      narrowingBudgetExhausted: false,
      candidateBudgetExhausted: false,
      failure: {
        code: "deferred-panel-unscored",
        stage: "evidence",
        stepNumber: spec.stepNumber,
        message:
          `Step ${spec.stepNumber} cannot expand farther parent ${JSON.stringify(input.parentCandidateId)}: ` +
          `its own panel has no face-corrected camera, so candidate narrowing would compare a different view.`,
      },
    };
  }

  const { width, height, builtMask, highlight } = evidence;
  const frame = frameFor(evidence);
  const renderer = rendering.createInstructionRenderer({ width, height });
  try {
    const silhouetteAtTurn = (turnDegrees: number) =>
      createStepSilhouette({
        rendering,
        renderer,
        view: { ...view, azimuthDegrees: view.azimuthDegrees + turnDegrees },
        frame,
        widthPx: width,
        heightPx: height,
      });
    const excludedMask = assembly.highlightExclusionMask(
      highlight.mask,
      highlight.strokeMask,
      width,
      height,
    ) as Uint8Array;
    const anchored = anchorStepCamera({
      stepNumber: spec.stepNumber,
      renderModelMask: (turnDegrees) =>
        silhouetteAtTurn(turnDegrees)(input.parentDocument, null, [width / 2, height / 2]).all,
      builtMask,
      excludedMask,
      widthPx: width,
      heightPx: height,
    });
    if (anchored.failure !== null || anchored.anchorTurnDegrees === null) {
      return {
        expansion: emptyExpansion(),
        children: [],
        narrowingBudgetExhausted: false,
        candidateBudgetExhausted: false,
        failure: anchored.failure,
      };
    }
    const centre = anchored.centrePx;
    const turnDegrees = anchored.anchorTurnDegrees;
    const silhouette = silhouetteAtTurn(turnDegrees);
    const renderAndScore = (
      document: D,
      stepId: string | null,
      catalogPartId: string,
      transform: PlacementTransform,
    ): number => {
      const probe = input.place(
        document,
        catalogPartId,
        transform,
        "builtin:magenta",
        spec.stepNumber,
        stepId,
      );
      const mask = silhouette(probe.document, probe.partId, centre).probe;
      return assembly.rankStepDelta(
        assembly.scoreStepDelta(mask, highlight, { tolerancePx: 3 }),
      ) as number;
    };

    const reservedBefore = input.ledger.reserved;
    const enumeration = enumerateWholeStepCandidates<D>({
      baseDocument: input.parentDocument,
      stepId: input.parentStepId,
      pieces: spec.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId })),
      enumerateDistinct: (document, catalogPartId) => {
        const offered = assembly.enumeratePlacements(document, catalogPartId, {
          includeBuildPlate:
            (document as { readonly parts: readonly unknown[] }).parts.length === 0,
        }).candidates as readonly {
          readonly catalogPartId: string;
          readonly transform: PlacementTransform;
        }[];
        const distinct = new Map<string, PlacementTransform>();
        for (const candidate of offered) {
          const key = assembly.placementOccupancyKey(
            candidate.catalogPartId,
            candidate.transform,
          ) as string;
          if (!distinct.has(key)) distinct.set(key, candidate.transform);
        }
        return [...distinct.values()];
      },
      narrow: ({ document, stepId, catalogPartId, offered }) =>
        placementsOwnPanelCannotSeparate({
          scored: offered.map((transform) => ({
            candidate: transform,
            score: renderAndScore(document, stepId, catalogPartId, transform),
          })),
          minimumMargin: options.minimumScoreMargin,
        }),
      narrowingRenderBudget: options.deferredNarrowingRenderBudget,
      narrowingRenderBudgetLedger: input.ledger,
      ...(input.candidateLedger === undefined
        ? {}
        : { candidateBudgetLedger: input.candidateLedger }),
      placementKey: (catalogPartId, transform) =>
        assembly.placementOccupancyKey(catalogPartId, transform) as string,
      place: (document, catalogPartId, transform, colorId, stepId) =>
        input.place(document, catalogPartId, transform, colorId, spec.stepNumber, stepId),
      budget: options.deferredCandidateBudget,
    });
    const narrowingRenders = input.ledger.reserved - reservedBefore;
    const offeredPerPiece = spec.pieces.map((_piece, index) => enumeration.perPiece[index] ?? 0);
    const carriedPerPiece = spec.pieces.map(
      (_piece, index) => enumeration.perPieceCarried[index] ?? 0,
    );
    const completeLeaves =
      enumeration.overBudget || enumeration.overNarrowingBudget
        ? enumeration.exploredCandidates
        : enumeration.candidates;
    const children = completeLeaves.map((candidate) => {
      const documentHash = kernel.documentStructuralHash(candidate.document) as string;
      const candidateId = `step-${String(spec.stepNumber).padStart(3, "0")}:${documentHash}`;
      return Object.freeze({
        candidateId,
        document: candidate.document,
        documentHash,
        partIds: Object.freeze([...candidate.partIds]),
        stepId: candidate.stepId,
        registrations: registrationsFor(spec, candidate.partIds),
        pieces: witnessesFor(spec, candidate.transforms),
      });
    });
    return {
      expansion: Object.freeze({
        parentCandidateId: input.parentCandidateId,
        narrowingRenders,
        offeredPerPiece: Object.freeze(offeredPerPiece),
        carriedPerPiece: Object.freeze(carriedPerPiece),
        children: Object.freeze(
          children.map(({ candidateId, document, documentHash, pieces }) =>
            Object.freeze({ candidateId, document, documentHash, pieces }),
          ),
        ),
      }),
      children: Object.freeze(children),
      narrowingBudgetExhausted: enumeration.overNarrowingBudget,
      candidateBudgetExhausted: enumeration.overBudget,
      failure: null,
    };
  } finally {
    renderer.dispose();
  }
}

export interface FartherPanelScoreResult {
  readonly observation: FartherPanelObservationInput;
  readonly candidatePngs: readonly { readonly candidateId: string; readonly png: string }[];
}

/** Scores exact carried documents against a farther panel using one base-bound quarter turn. */
export function scoreFartherDocumentsAgainstPanel<D>(input: {
  readonly spec: RealBuildPanelSpec;
  readonly evidence: PanelRasterEvidence;
  readonly anchorDocument: D;
  readonly candidates: readonly { readonly candidateId: string; readonly document: D }[];
  readonly reservedPanelRenders: number;
  readonly subject?: "origin" | "frontier";
  readonly options: RealBuildOptions;
  readonly rendering: PreparedRealBuildModules["rendering"];
}): FartherPanelScoreResult {
  const { spec, evidence, rendering } = input;
  if (
    !Number.isSafeInteger(input.reservedPanelRenders) ||
    input.reservedPanelRenders !== input.candidates.length
  ) {
    throw new RangeError(
      `Panel ${spec.stepNumber} reserved ${input.reservedPanelRenders} candidate renders for ` +
        `${input.candidates.length} exact candidates; required one pre-reserved render per score row.`,
    );
  }
  const view = correctedView(evidence, input.options);
  if (view === null) {
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "not-observable",
        reason: "camera-unresolved",
      },
      candidatePngs: [],
    };
  }
  const { width, height, builtMask, highlight } = evidence;
  const builtCentroid = maskCentroid(builtMask, width, height);
  if (builtCentroid === null) {
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "not-observable",
        reason: "no-built-art",
      },
      candidatePngs: [],
    };
  }
  const excludedMask = new Uint8Array(width * height);
  let filledHighlightPixels = 0;
  for (let index = 0; index < excludedMask.length; index += 1) {
    excludedMask[index] = highlight.mask[index] === 1 || highlight.strokeMask[index] === 1 ? 1 : 0;
    if (highlight.mask[index] === 1 && highlight.strokeMask[index] !== 1)
      filledHighlightPixels += 1;
  }
  const measure = filledHighlightPixels === 0 ? "containment" : "iou";
  const frame = frameFor(evidence);
  const renderer = rendering.createInstructionRenderer({ width, height });
  try {
    const renderSilhouetteAt = (
      subject: D,
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
    const anchored = anchorStepCamera({
      stepNumber: spec.stepNumber,
      renderModelMask: (turnDegrees) => renderSilhouetteAt(input.anchorDocument, turnDegrees).mask,
      builtMask,
      excludedMask,
      widthPx: width,
      heightPx: height,
    });
    if (anchored.failure !== null || anchored.anchorTurnDegrees === null) {
      return {
        observation: {
          stepNumber: spec.stepNumber,
          status: "not-observable",
          reason: "camera-unresolved",
        },
        candidatePngs: [],
      };
    }
    const turnDegrees = anchored.anchorTurnDegrees;
    const scores: { candidateId: string; agreement: number }[] = [];
    const candidatePngs: { candidateId: string; png: string }[] = [];
    for (const candidate of input.candidates) {
      const scoreRender = renderSilhouetteAt(candidate.document, turnDegrees);
      const mask = scoreRender.mask;
      const from = maskCentroid(mask, width, height);
      const agreement =
        from === null
          ? { agreement: 0, shiftPx: [0, 0] as const }
          : registerPrefixAgreement({
              candidateMask: mask,
              builtMask,
              excludedMask,
              width,
              height,
              seedPx: [builtCentroid.x - from.x, builtCentroid.y - from.y],
              measure,
            });
      scores.push({ candidateId: candidate.candidateId, agreement: agreement.agreement });
      candidatePngs.push({
        candidateId: candidate.candidateId,
        png: rgbaPngDataUrl(scoreRender.pixels, width, height),
      });
    }
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "scored",
        subject: input.subject ?? "frontier",
        scores: Object.freeze(scores),
      },
      // These are the exact owned RGBA buffers that produced the score masks;
      // retaining them performs no second renderer invocation.
      candidatePngs: Object.freeze(candidatePngs),
    };
  } finally {
    renderer.dispose();
  }
}

export interface FartherPrintedStepAttempt<D> {
  readonly evidence: RealBuildFartherEvidence;
  readonly captures: readonly RealBuildFartherCapture[];
  readonly selectedOrigin: DeferredUnresolvedCandidate<D> | null;
  readonly failure: StepFailure | null;
}

/** Rewrites the original deferred refusal rows after a farther panel settles N. */
export function settleFartherOriginPieceReports<D>(
  reports: readonly RealBuildPieceReport[],
  selected: DeferredUnresolvedCandidate<D>,
): readonly RealBuildPieceReport[] {
  if (reports.length !== selected.pieces.length) {
    throw new RangeError(
      `Farther-selected origin ${JSON.stringify(selected.candidateId)} binds ${selected.pieces.length} ` +
        `placement witnesses for ${reports.length} deferred piece reports; required exactly one each.`,
    );
  }
  return reports.map((report, pieceIndex) => {
    const witness = selected.pieces[pieceIndex]!;
    if (report.catalogPartId !== witness.catalogPartId) {
      throw new TypeError(
        `Farther-selected origin ${JSON.stringify(selected.candidateId)} piece ${pieceIndex} is ` +
          `${JSON.stringify(witness.catalogPartId)}; deferred report requires ${JSON.stringify(report.catalogPartId)}.`,
      );
    }
    return Object.freeze({
      ...report,
      blind: Object.freeze({ ...report.blind, refusal: null }),
      placed: true,
      positionLdu: witness.transform.positionLdu,
      orientationId: witness.transform.orientationId,
      failure: null,
    });
  });
}

const fartherFailure = (
  originStepNumber: number,
  refusal: RealBuildFartherEvidence["refusal"],
): StepFailure | null =>
  refusal === null
    ? null
    : {
        code: refusal.stage === "budget" ? "resource-budget-exhausted" : "deferred-panel-unscored",
        stage: refusal.stage === "input" ? "evidence" : refusal.stage,
        stepNumber: originStepNumber,
        message: refusal.message,
      };

/**
 * Browser binding for the first complete N/N+1/K farther search.
 *
 * It deliberately admits one intervening atomic step. The generic coordinator
 * owns deeper lineage; this adapter owns production rendering, placement and
 * capture bytes for the booklet driver. Every parent uses one shared narrowing
 * ledger, and an over-limit batch is rejected before its scoring callback runs.
 */
export async function attemptFartherPrintedStep<D>(input: {
  readonly originSpec: RealBuildPanelSpec;
  readonly originStatus: "no-local-signal" | "unseparated";
  readonly originMargin: number | null;
  readonly originMinimumMargin: number | null;
  readonly baseDocument: D;
  readonly origins: readonly DeferredUnresolvedCandidate<D>[];
  readonly interveningSpec: RealBuildPanelSpec;
  readonly interveningEvidence: PanelRasterEvidence;
  readonly fartherSpec: RealBuildPanelSpec | null;
  readonly loadFartherEvidence: (() => Promise<PanelRasterEvidence>) | null;
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "rendering" | "kernel" | "assembly">;
  readonly place: Place<D>;
}): Promise<FartherPrintedStepAttempt<D>> {
  const { originSpec, interveningSpec, options, modules } = input;
  // The asynchronous K loader is outside the deterministic driver. Snapshot
  // every origin field it could otherwise rewrite while preserving the exact
  // document object whose structural hash is rechecked around the await.
  const origins = Object.freeze(
    input.origins.map((origin) =>
      Object.freeze({
        ...origin,
        partIds: Object.freeze([...origin.partIds]),
        registrations: Object.freeze(
          origin.registrations.map((registration) => Object.freeze({ ...registration })),
        ),
        pieces: Object.freeze(
          origin.pieces.map((piece) =>
            Object.freeze({
              ...piece,
              transform: Object.freeze({
                ...piece.transform,
                positionLdu: Object.freeze([...piece.transform.positionLdu]) as readonly [
                  number,
                  number,
                  number,
                ],
              }),
            }),
          ),
        ),
        lookaheadShiftPx: Object.freeze([...origin.lookaheadShiftPx]) as readonly [number, number],
        lookaheadPixels:
          origin.lookaheadPixels === null ? null : new Uint8Array(origin.lookaheadPixels),
      }),
    ),
  );
  const baseDocumentHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
  const originEvidence = Object.freeze({
    stepNumber: originSpec.stepNumber,
    status: input.originStatus,
    margin: input.originMargin,
    minimumMargin: input.originMinimumMargin,
  });
  // K is deliberately not loaded here. The synchronous coordinator first
  // completes every intervening parent and reserves the exact K score rows;
  // only its continuation callback can authorize the asynchronous PDF load.
  let fartherEvidence: PanelRasterEvidence | null = null;
  const ledger = createNarrowingRenderBudgetLedger(options.deferredNarrowingRenderBudget);
  // N+1 was already scored by `settleDeferredPrintedStep`; use those exact
  // document-bound numbers and score-bearing renders instead of repeating the
  // work. They remain inspectable even if aggregate carry refuses before the
  // coordinator reaches its observation callback.
  const originScores = Object.freeze(
    origins.map(({ candidateId, lookaheadAgreement }) => ({
      candidateId,
      agreement: lookaheadAgreement,
    })),
  );
  const interveningScore: FartherPanelScoreResult = {
    observation: {
      stepNumber: interveningSpec.stepNumber,
      status: "scored",
      subject: "origin",
      scores: originScores,
    },
    candidatePngs: Object.freeze(
      origins.flatMap(({ candidateId, lookaheadPixels }) =>
        lookaheadPixels === null
          ? []
          : [
              {
                candidateId,
                png: rgbaPngDataUrl(
                  lookaheadPixels,
                  input.interveningEvidence.width,
                  input.interveningEvidence.height,
                ),
              },
            ],
      ),
    ),
  };
  let fartherScore: FartherPanelScoreResult | null = null;
  type PendingK = {
    readonly alternatives: readonly {
      readonly candidateId: string;
      readonly parentCandidateId: string;
      readonly originCandidateId: string;
      readonly document: D;
      readonly documentHash: string;
      readonly lineage: readonly {
        readonly stepNumber: number;
        readonly documentHash: string;
        readonly pieces: readonly FartherPlacementWitness[];
      }[];
    }[];
    readonly reservedPanelRenders: number;
  };
  const pendingK: { value: PendingK | null } = { value: null };
  const lazyKContinuation = new Error("farther K evidence awaits asynchronous continuation");
  const driven = runFartherPanelDriver<
    D,
    DeferredUnresolvedCandidate<D>,
    FartherStepChildMetadata<D>
  >({
    originStepNumber: originSpec.stepNumber,
    origins,
    originEvidence,
    interveningStepNumber: interveningSpec.stepNumber,
    expectedAtomicPieces: interveningSpec.pieces.map(({ catalogPartId, colorId }) => ({
      catalogPartId,
      colorId,
    })),
    maximumCandidates: options.deferredCandidateBudget,
    narrowingLedger: ledger,
    minimumAgreement: options.minimumDeferredAgreement,
    minimumMargin: options.minimumDeferredAgreementMargin,
    maximumPanelRenders: options.fartherPanelRenderBudget,
    maximumReachSteps: options.fartherPanelMaximumReachSteps,
    fartherPanelsAvailableAfterK: false,
    hashDocument: (document) => modules.kernel.documentStructuralHash(document) as string,
    expandParent: ({ parent, ledger: sharedLedger, candidateLedger }) =>
      expandFartherPrintedStep<D>({
        parentCandidateId: parent.candidateId,
        parentDocument: parent.document,
        // The parent owns printed step N. Passing its stepId here would append
        // the intervening pieces to N; null makes the first placement open the
        // distinct atomic N+1 step that this lineage edge claims to represent.
        parentStepId: null,
        spec: interveningSpec,
        evidence: input.interveningEvidence,
        options,
        modules,
        ledger: sharedLedger,
        candidateLedger,
        place: input.place,
      }),
    originPanelObservation: interveningScore.observation,
    scoreFrontierPanel:
      input.fartherSpec === null || input.loadFartherEvidence === null
        ? null
        : ({ alternatives, reservation }) => {
            pendingK.value = {
              alternatives,
              reservedPanelRenders: reservation.reservedForPanel,
            };
            throw lazyKContinuation;
          },
  });
  type ReportDecision = NonNullable<RealBuildFartherEvidence["decision"]>;
  let resolvedPanels = driven.evidence.panels;
  let resolvedRefusal: FartherRefusal | null = driven.refusal;
  let resolvedDecision: ReportDecision | null =
    driven.decision === null
      ? null
      : {
          originCandidateId: driven.decision.originCandidateId,
          revealingStepNumber: driven.decision.revealingStepNumber,
          survivingCandidateIds: driven.decision.survivingCandidateIds,
          rejectedCandidateIds: driven.decision.rejectedCandidateIds,
          descendantSettled: driven.decision.descendantSettled,
        };
  const continuation = pendingK.value;
  if (continuation !== null && input.fartherSpec !== null && input.loadFartherEvidence !== null) {
    const describeThrown = (error: unknown): string => {
      try {
        return error instanceof Error ? error.message : String(error);
      } catch {
        return "an uninspectable thrown value";
      }
    };
    const verifyKnownDocuments = (): string | null => {
      let actualBaseHash: string;
      try {
        actualBaseHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
      } catch (error) {
        return `The base document could not be hashed after K continuation: ${describeThrown(error)}.`;
      }
      if (actualBaseHash !== baseDocumentHash) {
        return (
          `The K scoring anchor declares base document hash ${JSON.stringify(baseDocumentHash)}, but ` +
          `documentStructuralHash returned ${JSON.stringify(actualBaseHash)} after K continuation.`
        );
      }
      for (const candidate of origins) {
        let actual: string;
        try {
          actual = modules.kernel.documentStructuralHash(candidate.document) as string;
        } catch (error) {
          return `Candidate ${JSON.stringify(candidate.candidateId)} could not be hashed after K continuation: ${describeThrown(error)}.`;
        }
        if (actual !== candidate.documentHash) {
          return (
            `Candidate ${JSON.stringify(candidate.candidateId)} declares document hash ` +
            `${JSON.stringify(candidate.documentHash)}, but documentStructuralHash returned ${JSON.stringify(actual)} after K continuation.`
          );
        }
      }
      for (const alternative of continuation.alternatives) {
        let actual: string;
        try {
          actual = modules.kernel.documentStructuralHash(alternative.document) as string;
        } catch (error) {
          return `Candidate ${JSON.stringify(alternative.candidateId)} could not be hashed after K continuation: ${describeThrown(error)}.`;
        }
        if (actual !== alternative.documentHash) {
          return (
            `Candidate ${JSON.stringify(alternative.candidateId)} declares document hash ` +
            `${JSON.stringify(alternative.documentHash)}, but documentStructuralHash returned ${JSON.stringify(actual)} after K continuation.`
          );
        }
      }
      return null;
    };
    const inputRefusal = (message: string): FartherRefusal =>
      Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: input.fartherSpec!.stepNumber,
        message,
      });
    const incompletePanelRefusal = (phase: "loading" | "scoring", error: unknown): FartherRefusal =>
      Object.freeze({
        code: "incomplete-panel-evidence",
        stage: "evidence",
        stepNumber: input.fartherSpec!.stepNumber,
        message:
          `Panel ${input.fartherSpec!.stepNumber} ${phase} callback threw: ${describeThrown(error)}. ` +
          `Required one complete raster and exactly one finite agreement score for each of the ` +
          `${continuation.reservedPanelRenders} reserved frontier candidates; prior N+1 and carry evidence ` +
          `were retained and no partial K panel was admitted.`,
      });
    const beforeLoadHashError = verifyKnownDocuments();
    if (beforeLoadHashError !== null) {
      resolvedRefusal = inputRefusal(beforeLoadHashError);
      resolvedDecision = null;
    } else {
      let phase: "loading" | "scoring" = "loading";
      let continuationInputRefusal: FartherRefusal | null = null;
      try {
        fartherEvidence = await input.loadFartherEvidence();
        const afterLoadHashError = verifyKnownDocuments();
        if (afterLoadHashError !== null) {
          continuationInputRefusal = inputRefusal(afterLoadHashError);
          throw lazyKContinuation;
        }
        phase = "scoring";
        fartherScore = scoreFartherDocumentsAgainstPanel({
          spec: input.fartherSpec,
          evidence: fartherEvidence,
          anchorDocument: input.baseDocument,
          candidates: continuation.alternatives,
          reservedPanelRenders: continuation.reservedPanelRenders,
          subject: "frontier",
          options,
          rendering: modules.rendering,
        });
        const afterScoreHashError = verifyKnownDocuments();
        if (afterScoreHashError !== null) {
          continuationInputRefusal = inputRefusal(afterScoreHashError);
          throw lazyKContinuation;
        }
        const continuedFrontier = Object.freeze({
          originStepNumber: originSpec.stepNumber,
          throughStepNumber: interveningSpec.stepNumber,
          candidates: Object.freeze(
            continuation.alternatives.map((alternative) =>
              Object.freeze({
                candidateId: alternative.candidateId,
                parentCandidateId: alternative.parentCandidateId,
                originCandidateId: alternative.originCandidateId,
                document: alternative.document,
                lineage: alternative.lineage,
              }),
            ),
          ),
        });
        const continued = findFirstRevealingPanel({
          frontier: continuedFrontier,
          originEvidence,
          panels: [interveningScore.observation, fartherScore.observation],
          minimumAgreement: options.minimumDeferredAgreement,
          minimumMargin: options.minimumDeferredAgreementMargin,
          maximumPanelRenders: options.fartherPanelRenderBudget,
          maximumReachSteps: options.fartherPanelMaximumReachSteps,
          fartherPanelsAvailable: false,
        });
        resolvedPanels = continued.evidence;
        resolvedRefusal = continued.refusal;
        resolvedDecision =
          continued.decision === null
            ? null
            : {
                originCandidateId: continued.decision.originCandidateId,
                revealingStepNumber: continued.decision.revealingStepNumber,
                survivingCandidateIds: continued.decision.survivingCandidateIds,
                rejectedCandidateIds: continued.decision.rejectedCandidateIds,
                descendantSettled: continued.decision.descendantSettled,
              };
      } catch (error) {
        const afterFailureHashError = verifyKnownDocuments();
        if (afterFailureHashError !== null) {
          resolvedRefusal = inputRefusal(afterFailureHashError);
        } else if (continuationInputRefusal !== null) {
          resolvedRefusal = continuationInputRefusal;
        } else {
          resolvedRefusal = incompletePanelRefusal(phase, error);
        }
        resolvedDecision = null;
      }
    }
  }
  const originCandidateReports = origins.map(
    ({ candidateId, documentHash, pieces, lookaheadAgreement, lookaheadShiftPx }) => ({
      candidateId,
      documentHash,
      pieces,
      lookaheadAgreement,
      lookaheadShiftPx,
    }),
  );
  const captures: RealBuildFartherCapture[] = [];
  const pushCapture = (
    role: RealBuildFartherCapture["role"],
    panelStepNumber: number,
    candidateId: string | null,
    png: string,
  ) => captures.push({ captureId: captures.length, role, panelStepNumber, candidateId, png });
  const addScoreCaptures = (
    score: FartherPanelScoreResult | null,
    panelEvidence: PanelRasterEvidence,
    retainEveryCandidate: boolean,
  ) => {
    if (score === null) return;
    pushCapture(
      "source-panel",
      score.observation.stepNumber,
      null,
      rgbaPngDataUrl(panelEvidence.workPixels, panelEvidence.width, panelEvidence.height),
    );
    const retained = retainEveryCandidate ? score.candidatePngs : score.candidatePngs.slice(0, 1);
    for (const candidate of retained) {
      pushCapture(
        "candidate-render",
        score.observation.stepNumber,
        candidate.candidateId,
        candidate.png,
      );
    }
  };
  const admittedPanelSteps = new Set(
    resolvedPanels?.panels.map(({ stepNumber }) => stepNumber) ?? [],
  );
  if (admittedPanelSteps.has(interveningSpec.stepNumber)) {
    addScoreCaptures(interveningScore, input.interveningEvidence, true);
  }
  if (
    fartherEvidence !== null &&
    input.fartherSpec !== null &&
    admittedPanelSteps.has(input.fartherSpec.stepNumber)
  ) {
    addScoreCaptures(fartherScore, fartherEvidence, true);
  }

  const carry = driven.evidence.carry;
  const orderedOriginScores = [...originScores].sort(
    (left, right) => right.agreement - left.agreement,
  );
  const originBest = orderedOriginScores[0]?.agreement ?? 0;
  const originFamilyMargin =
    orderedOriginScores.length < 2
      ? 0
      : originBest - (orderedOriginScores[1]?.agreement ?? originBest);
  const originRevealing =
    originBest >= options.minimumDeferredAgreement &&
    originFamilyMargin > options.minimumDeferredAgreementMargin;
  const retainedPanels =
    resolvedPanels?.panels ??
    Object.freeze([
      {
        stepNumber: interveningSpec.stepNumber,
        reachSteps: interveningSpec.stepNumber - originSpec.stepNumber,
        status: originRevealing ? ("revealing" as const) : ("unrevealing" as const),
        reason: originRevealing
          ? null
          : originBest < options.minimumDeferredAgreement
            ? ("weak-agreement" as const)
            : ("ambiguous-family" as const),
        scores: originScores,
        bestAgreement: originBest,
        familyMargin: originFamilyMargin,
        descendantMargin: null,
      },
    ]);
  const decision = resolvedDecision;
  const refusal = resolvedRefusal;
  const evidence: RealBuildFartherEvidence = {
    origin: { evidence: originEvidence, candidates: originCandidateReports },
    carries: carry === null ? [] : [{ ...carry, stepNumber: interveningSpec.stepNumber }],
    panels: retainedPanels,
    budgets: {
      offeredCandidates: driven.evidence.candidateLedger.reserved,
      maximumCandidates: options.deferredCandidateBudget,
      narrowingRenders: driven.evidence.narrowingLedger.reserved,
      maximumNarrowingRenders: options.deferredNarrowingRenderBudget,
      panelRenders: retainedPanels.reduce((total, panel) => total + panel.scores.length, 0),
      maximumPanelRenders: options.fartherPanelRenderBudget,
      reachSteps: Math.max(carry === null ? 0 : 1, retainedPanels.at(-1)?.reachSteps ?? 0),
      maximumReachSteps: options.fartherPanelMaximumReachSteps,
      refusedReservation: driven.evidence.narrowingLedger.refusedReservation,
      failedNarrowingReservation: driven.evidence.narrowingLedger.failedReservation,
      candidateRefusedReservation: driven.evidence.candidateLedger.refusedReservation,
      failedCandidateReservation: driven.evidence.candidateLedger.failedReservation,
    },
    refusal,
    decision,
  };
  return {
    evidence,
    captures,
    selectedOrigin:
      decision === null
        ? null
        : (origins.find(({ candidateId }) => candidateId === decision.originCandidateId) ?? null),
    failure: fartherFailure(originSpec.stepNumber, refusal),
  };
}
