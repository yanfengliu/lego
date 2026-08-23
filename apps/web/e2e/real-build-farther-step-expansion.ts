import {
  enumerateWholeStepCandidates,
  placementsOwnPanelCannotSeparate,
  type NarrowingRenderBudgetLedger,
  type NarrowingSubjectRenderBudgetLedger,
  type WholeStepCandidateBudgetLedger,
  type WholeStepPlacementTransform,
} from "./real-build-deferral";
import {
  createFartherNarrowingObservationCoordinator,
  type FartherNarrowingObserver,
} from "./real-build-farther-narrowing-observer";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type {
  FartherParentExpansion,
  FartherPlacementWitness,
} from "./real-build-farther-panel-types";
import {
  createStepDepthNarrowingComposer,
  type DepthNarrowingStatistics,
  type StepDepthNarrowingComposer,
} from "./real-build-farther-depth-narrowing";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import { anchorStepCamera, createStepSilhouette } from "./real-build-step-camera";
import type { RealBuildOptions, RealBuildPanelSpec, StepFailure } from "./real-build-safety";

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
  readonly depthNarrowing: DepthNarrowingStatistics | null;
  readonly failure: StepFailure | null;
}

export type FartherStepPlace<D> = (
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
  /** Opts this parent into physical depth-layer accounting; the historical ledger stays untouched. */
  readonly depthNarrowingLedger?: NarrowingSubjectRenderBudgetLedger;
  readonly candidateLedger?: WholeStepCandidateBudgetLedger;
  readonly narrowingObserver?: FartherNarrowingObserver;
  readonly place: FartherStepPlace<D>;
}): FartherStepExpansionResult<D> {
  const { spec, evidence, options, modules } = input;
  const { rendering, kernel, assembly } = modules;
  const narrowingObservations = createFartherNarrowingObservationCoordinator<D>({
    ...(input.narrowingObserver === undefined ? {} : { observer: input.narrowingObserver }),
    parentCandidateId: input.parentCandidateId,
    documentStructuralHash: (document) => kernel.documentStructuralHash(document) as string,
    sha256Hex: (bytes) => kernel.sha256Hex(bytes) as string,
  });
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
      depthNarrowing: null,
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
  let depthComposer: StepDepthNarrowingComposer<D> | null = null;
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
        depthNarrowing: null,
        failure: anchored.failure,
      };
    }
    const centre = anchored.centrePx;
    const silhouette = silhouetteAtTurn(anchored.anchorTurnDegrees);
    if (input.depthNarrowingLedger !== undefined) {
      depthComposer = createStepDepthNarrowingComposer<D>({
        rendering,
        renderer,
        view: { ...view, azimuthDegrees: view.azimuthDegrees + anchored.anchorTurnDegrees },
        frame,
        centrePx: centre,
        widthPx: width,
        heightPx: height,
      });
    }
    const renderAndScore = (
      document: D,
      stepId: string | null,
      catalogPartId: string,
      transform: PlacementTransform,
      observation: ReturnType<(typeof narrowingObservations)["beginBatch"]>,
      rowIndex: number,
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
      return narrowingObservations.score({
        token: observation,
        rowIndex,
        transform,
        mask,
        highlight,
        scoreStepDelta: (probeMask, panelHighlight) =>
          assembly.scoreStepDelta(probeMask, panelHighlight, { tolerancePx: 3 }),
        rankStepDelta: (score) => assembly.rankStepDelta(score) as number,
      });
    };

    const reservedBefore = input.depthNarrowingLedger?.committed ?? input.ledger.reserved;
    const legacyNarrow = ({
      document,
      stepId,
      catalogPartId,
      colorId,
      offered,
    }: {
      readonly document: D;
      readonly stepId: string | null;
      readonly catalogPartId: string;
      readonly colorId: string;
      readonly offered: readonly PlacementTransform[];
    }): readonly PlacementTransform[] => {
      const observation = narrowingObservations.beginBatch(
        document,
        catalogPartId,
        colorId,
        offered.length,
      );
      const carried = placementsOwnPanelCannotSeparate({
        scored: offered.map((transform, rowIndex) => ({
          candidate: transform,
          score: renderAndScore(document, stepId, catalogPartId, transform, observation, rowIndex),
        })),
        minimumMargin: options.minimumScoreMargin,
      });
      narrowingObservations.endBatch(observation, offered, carried);
      return carried;
    };
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
      narrow: input.depthNarrowingLedger === undefined ? legacyNarrow : null,
      ...(input.depthNarrowingLedger === undefined || depthComposer === null
        ? {}
        : {
            narrowingSubjectRenderBudgetLedger: input.depthNarrowingLedger,
            prepareNarrowing: ({ document, stepId, catalogPartId, colorId, offered }) => ({
              maximumSubjectRenders: depthComposer!.maximumSubjectRenders(offered.length),
              execute: (lease) => {
                const observation = narrowingObservations.beginBatch(
                  document,
                  catalogPartId,
                  colorId,
                  offered.length,
                );
                const chargeSubjectRender = () => lease.charge(1);
                depthComposer!.beginBatch(
                  document,
                  `${input.parentCandidateId}\u0000${kernel.documentStructuralHash(document) as string}\u0000${catalogPartId}`,
                  chargeSubjectRender,
                );
                try {
                  const carried = placementsOwnPanelCannotSeparate({
                    scored: offered.map((transform, rowIndex) => {
                      const probe = input.place(
                        document,
                        catalogPartId,
                        transform,
                        "builtin:magenta",
                        spec.stepNumber,
                        stepId,
                      );
                      const mask = depthComposer!.probeMask({
                        baseDocument: document,
                        placedDocument: probe.document,
                        probePartId: probe.partId,
                        catalogPartId,
                        chargeSubjectRender,
                        fallbackWholeSceneMask: () =>
                          silhouette(probe.document, probe.partId, centre).probe,
                      });
                      return {
                        candidate: transform,
                        score: narrowingObservations.score({
                          token: observation,
                          rowIndex,
                          transform,
                          mask,
                          highlight,
                          scoreStepDelta: (probeMask, panelHighlight) =>
                            assembly.scoreStepDelta(probeMask, panelHighlight, {
                              tolerancePx: 3,
                            }),
                          rankStepDelta: (score) => assembly.rankStepDelta(score) as number,
                        }),
                      };
                    }),
                    minimumMargin: options.minimumScoreMargin,
                  });
                  narrowingObservations.endBatch(observation, offered, carried);
                  return carried;
                } finally {
                  depthComposer!.endBatch();
                }
              },
            }),
          }),
      narrowingRenderBudget: options.deferredNarrowingRenderBudget,
      ...(input.depthNarrowingLedger === undefined
        ? { narrowingRenderBudgetLedger: input.ledger }
        : {}),
      ...(input.candidateLedger === undefined
        ? {}
        : { candidateBudgetLedger: input.candidateLedger }),
      placementKey: (catalogPartId, transform) =>
        assembly.placementOccupancyKey(catalogPartId, transform) as string,
      place: (document, catalogPartId, transform, colorId, stepId) =>
        input.place(document, catalogPartId, transform, colorId, spec.stepNumber, stepId),
      budget: options.deferredCandidateBudget,
    });
    const narrowingRenders =
      (input.depthNarrowingLedger?.committed ?? input.ledger.reserved) - reservedBefore;
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
      depthNarrowing: depthComposer?.statistics() ?? null,
      failure: null,
    };
  } finally {
    depthComposer?.dispose();
    renderer.dispose();
  }
}
