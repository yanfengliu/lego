import {
  assessWholeStepVisualEvidence,
  maskCentroid,
  measureWholeStepMaskEvidence,
} from "./real-build-contract";
import {
  placementsOwnPanelCannotSeparate,
  type DeferralEvidence,
  type DeferralTrigger,
} from "./real-build-deferral";
import {
  settleDeferredPrintedStep,
  type DeferredPlacementResult,
} from "./real-build-deferred-step";
import {
  attemptFartherPrintedStep,
  settleFartherOriginPieceReports,
} from "./real-build-farther-step";
import {
  derivePanelRasterEvidence,
  renderRealBuildPageCanvas,
  type PageCanvas,
  type PanelRasterEvidence,
} from "./real-build-panel-raster";
import { rgbaPngDataUrl, type PreparedRealBuildModules } from "./real-build-browser-preflight";
import { anchorStepCamera, createStepSilhouette } from "./real-build-step-camera";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  RealBuildOptions,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
  RealBuildPieceReport,
  StepFailure,
  WholeStepVisualEvidence,
} from "./real-build-safety";
import { selectRealBuildDeferredPanelRoles } from "./real-build-run-panel-window";

type BrowserModule = ReturnType<typeof JSON.parse>;

type Place<D> = (
  base: D,
  catalogPartId: string,
  transform: unknown,
  colorId: string,
  printedStepNumber: number,
  targetStepId: string | null,
) => { readonly document: D; readonly partId: string; readonly stepId: string };

type StepView = {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly upSign: 1 | -1;
};

type StepFrame = {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly target: readonly [number, number, number];
  readonly sceneRadius: number;
};

type StepSilhouette<D> = (
  document: D,
  partIds: string | readonly string[] | null,
  centrePx: readonly [number, number],
) => { readonly all: Uint8Array; readonly probe: Uint8Array };

export interface RunPlacementCandidate {
  readonly catalogPartId: string;
  readonly transform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
}

export interface RunScoredCandidate<C> {
  readonly candidate: C;
  readonly score: number;
  readonly centre: [number, number];
}

export interface RunStepCamera<D> {
  readonly failure: StepFailure | null;
  readonly centre: [number, number];
  readonly anchorIou: number | null;
  readonly anchorShift: [number, number] | null;
  readonly anchorTurn: number;
  readonly view: StepView;
  readonly silhouette: StepSilhouette<D>;
}

/**
 * Registers the printed panel once, then returns the exact camera and
 * silhouette function shared by local scoring, deferred narrowing, the joint
 * gate, and the retained build render.
 */
export function prepareRunStepCamera<D>(input: {
  readonly stepNumber: number;
  readonly anchorStep: boolean;
  readonly candidateDocument: D;
  readonly fittedView: StepView;
  readonly frame: StepFrame;
  readonly width: number;
  readonly height: number;
  readonly builtMask: Uint8Array;
  readonly highlight: PanelRasterEvidence["highlight"];
  readonly rendering: BrowserModule;
  readonly assembly: BrowserModule;
  readonly renderer: BrowserModule;
}): RunStepCamera<D> {
  const silhouetteAtTurn = (turnDegrees: number) =>
    createStepSilhouette({
      rendering: input.rendering,
      renderer: input.renderer,
      view: {
        ...input.fittedView,
        azimuthDegrees: input.fittedView.azimuthDegrees + turnDegrees,
      },
      frame: input.frame,
      widthPx: input.width,
      heightPx: input.height,
    }) as StepSilhouette<D>;

  let failure: StepFailure | null = null;
  let centre: [number, number] = [input.width / 2, input.height / 2];
  let anchorIou: number | null = null;
  let anchorShift: [number, number] | null = null;
  let anchorTurn = 0;

  if (!input.anchorStep) {
    const anchored = anchorStepCamera({
      stepNumber: input.stepNumber,
      renderModelMask: (turnDegrees) =>
        silhouetteAtTurn(turnDegrees)(input.candidateDocument, null, [
          input.width / 2,
          input.height / 2,
        ]).all,
      builtMask: input.builtMask,
      // The panel stops reporting what was already built inside its own
      // highlight, because it draws this step's part over it. Scoring the model
      // there measures the drawing's occlusion instead of the registration.
      excludedMask: input.assembly.highlightExclusionMask(
        input.highlight.mask,
        input.highlight.strokeMask,
        input.width,
        input.height,
      ) as Uint8Array,
      widthPx: input.width,
      heightPx: input.height,
    });
    failure = anchored.failure;
    centre = anchored.centrePx;
    anchorIou = anchored.anchorIou;
    anchorShift = anchored.anchorShiftPx;
    anchorTurn = anchored.anchorTurnDegrees ?? 0;
  }

  return {
    failure,
    centre,
    anchorIou,
    anchorShift,
    anchorTurn,
    view: {
      ...input.fittedView,
      azimuthDegrees: input.fittedView.azimuthDegrees + anchorTurn,
    },
    silhouette: silhouetteAtTurn(anchorTurn),
  };
}

/** Creates the one own-panel comparison used by local ranking and narrowing. */
export const createRunOwnPanelScorer =
  <D>(input: {
    readonly stepNumber: number;
    readonly anchorStep: boolean;
    /** The anchor step recentres after each accepted piece, so read it per score. */
    readonly getCentre: () => [number, number];
    readonly width: number;
    readonly height: number;
    readonly highlight: PanelRasterEvidence["highlight"];
    readonly tolerancePx: number;
    readonly assembly: BrowserModule;
    readonly silhouette: StepSilhouette<D>;
    readonly place: Place<D>;
  }) =>
  <C extends RunPlacementCandidate>(
    prefixDocument: D,
    candidate: C,
    targetStepId: string | null,
  ): RunScoredCandidate<C> => {
    const centre = input.getCentre();
    const applied = input.place(
      prefixDocument,
      candidate.catalogPartId,
      candidate.transform,
      "builtin:magenta",
      input.stepNumber,
      targetStepId,
    );
    let candidateCentre = centre;
    let mask = input.silhouette(applied.document, applied.partId, centre).probe;
    if (input.anchorStep) {
      const from = maskCentroid(mask, input.width, input.height);
      const to = maskCentroid(input.highlight.mask as Uint8Array, input.width, input.height);
      if (from !== null && to !== null) {
        candidateCentre = [centre[0] + (to.x - from.x), centre[1] + (to.y - from.y)];
        mask = input.silhouette(applied.document, applied.partId, candidateCentre).probe;
      }
    }
    // `rankStepDelta`, not `score.score`: on a panel whose contours all stay
    // open the ranking key is the printed line the candidate explains, and the
    // precision term the blend carries would charge it for the boundary the
    // booklet chose not to draw.
    const score = input.assembly.rankStepDelta(
      input.assembly.scoreStepDelta(mask, input.highlight, {
        tolerancePx: input.tolerancePx,
      }),
    ) as number;
    return { candidate, score, centre: candidateCentre };
  };

export interface RunDeferredPanelSettlement<D> {
  readonly deferral: DeferralEvidence;
  readonly farther: RealBuildFartherEvidence | null;
  readonly fartherCaptures: readonly RealBuildFartherCapture[];
  readonly failure: StepFailure | null;
  readonly pieceReports: readonly RealBuildPieceReport[];
  readonly placement: DeferredPlacementResult<D> | null;
}

export interface RunDeferredPanelCoordinator<D> {
  readonly readLookaheadPanel: () => Promise<void>;
  readonly settle: (input: {
    readonly trigger: DeferralTrigger;
    readonly ownPanelMargin: number | null;
    readonly stepId: string | null;
    readonly scoreOwnPanel: (
      document: D,
      stepId: string | null,
      catalogPartId: string,
      transform: RunPlacementCandidate["transform"],
    ) => number;
  }) => Promise<RunDeferredPanelSettlement<D>>;
}

/**
 * Owns the lazy N+1/K page reads and turns one deferred origin into either an
 * exact placement or immutable farther-panel evidence. No page is rasterised
 * until the branch actually needs it.
 */
export function createRunDeferredPanelCoordinator<D>(input: {
  readonly spec: RealBuildPanelSpec;
  readonly deferralTarget: RealBuildPanelRasterSpec | null;
  readonly executionPanels: readonly RealBuildPanelSpec[];
  readonly observationPanels: readonly RealBuildPanelRasterSpec[];
  readonly currentPageNumber: number;
  readonly currentPageCanvas: PageCanvas;
  readonly pdf: PreparedRealBuildModules["pdfjs"];
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "lattice" | "rendering" | "kernel" | "assembly">;
  readonly baseDocument: D;
  readonly place: Place<D>;
}): RunDeferredPanelCoordinator<D> {
  let lookahead: {
    readonly spec: RealBuildPanelRasterSpec;
    readonly evidence: PanelRasterEvidence;
  } | null = null;

  const loadPanelEvidence = async (
    spec: RealBuildPanelRasterSpec,
  ): Promise<PanelRasterEvidence> => {
    const page =
      spec.pageNumber === input.currentPageNumber
        ? { canvas: input.currentPageCanvas, dispose: () => {} }
        : await renderRealBuildPageCanvas(input.pdf, spec.pageNumber, input.options.renderScale);
    try {
      return derivePanelRasterEvidence({
        pageCanvas: page.canvas,
        spec,
        options: input.options,
        modules: input.modules,
      });
    } finally {
      page.dispose();
    }
  };

  const readLookaheadPanel = async (): Promise<void> => {
    if (lookahead !== null || input.deferralTarget === null) return;
    lookahead = {
      spec: input.deferralTarget,
      evidence: await loadPanelEvidence(input.deferralTarget),
    };
  };

  const settle = async (
    settlementInput: Parameters<RunDeferredPanelCoordinator<D>["settle"]>[0],
  ): Promise<RunDeferredPanelSettlement<D>> => {
    await readLookaheadPanel();
    const settledDeferral = settleDeferredPrintedStep({
      spec: input.spec,
      trigger: settlementInput.trigger,
      ownPanelMargin: settlementInput.ownPanelMargin,
      ownPanelMinimumMargin:
        settlementInput.ownPanelMargin === null ? null : input.options.minimumScoreMargin,
      baseDocument: input.baseDocument,
      stepId: settlementInput.stepId,
      // A step deferred for want of any signal has no panel to narrow against;
      // one deferred because its panel could not choose has the panel that
      // could not.
      narrowByOwnPanel:
        settlementInput.trigger === "no-local-signal"
          ? null
          : ({ document, stepId, catalogPartId, offered }) =>
              placementsOwnPanelCannotSeparate({
                scored: offered.map((transform) => ({
                  candidate: transform,
                  score: settlementInput.scoreOwnPanel(document, stepId, catalogPartId, transform),
                })),
                minimumMargin: input.options.minimumScoreMargin,
              }),
      lookahead,
      options: input.options,
      rendering: input.modules.rendering,
      kernel: input.modules.kernel,
      assembly: input.modules.assembly,
      place: input.place,
    });

    if (settledDeferral.placement !== null || settledDeferral.unresolvedCandidates.length < 2) {
      return {
        deferral: settledDeferral.evidence,
        farther: null,
        fartherCaptures: [],
        failure: settledDeferral.failure,
        pieceReports: settledDeferral.pieceReports,
        placement: settledDeferral.placement,
      };
    }

    const intervening = lookahead;
    if (intervening === null) {
      return {
        deferral: settledDeferral.evidence,
        farther: null,
        fartherCaptures: [],
        failure: settledDeferral.failure,
        pieceReports: settledDeferral.pieceReports,
        placement: null,
      };
    }
    const roles = selectRealBuildDeferredPanelRoles({
      interveningRasterPanel: intervening.spec,
      executionPanels: input.executionPanels,
      observationPanels: input.observationPanels,
    });
    if (roles.interveningExecutionPanel === null) {
      // The passive suffix may settle the final requested step from source art,
      // but its own action is outside the requested execution prefix. Do not
      // expand it, emit a report for it, or let it mutate any candidate document.
      return {
        deferral: settledDeferral.evidence,
        farther: null,
        fartherCaptures: [],
        failure: settledDeferral.failure,
        pieceReports: settledDeferral.pieceReports,
        placement: null,
      };
    }
    const fartherAttempt = await attemptFartherPrintedStep({
      originSpec: input.spec,
      originStatus:
        settlementInput.trigger === "no-local-signal" ? "no-local-signal" : "unseparated",
      originMargin: settlementInput.ownPanelMargin,
      originMinimumMargin:
        settlementInput.ownPanelMargin === null ? null : input.options.minimumScoreMargin,
      baseDocument: input.baseDocument,
      origins: settledDeferral.unresolvedCandidates,
      interveningSpec: roles.interveningExecutionPanel,
      interveningEvidence: intervening.evidence,
      fartherSpec: roles.fartherExecutionPanel,
      fartherRasterSpec: roles.fartherRasterPanel,
      loadFartherEvidence:
        roles.fartherRasterPanel === null
          ? null
          : async () => loadPanelEvidence(roles.fartherRasterPanel!),
      options: input.options,
      modules: input.modules,
      place: input.place,
    });
    const selected = fartherAttempt.failure === null ? fartherAttempt.selectedOrigin : null;
    return {
      deferral: settledDeferral.evidence,
      farther: fartherAttempt.evidence,
      fartherCaptures: fartherAttempt.captures,
      failure: fartherAttempt.failure,
      pieceReports:
        selected === null
          ? settledDeferral.pieceReports
          : settleFartherOriginPieceReports(settledDeferral.pieceReports, selected),
      placement: selected,
    };
  };

  return { readLookaheadPanel, settle };
}

/** Measures the complete seated step against the exact highlight it claims. */
export function assessRunWholeStepVisualEvidence<D>(input: {
  readonly stepNumber: number;
  readonly document: D;
  readonly partIds: readonly string[];
  readonly centre: [number, number];
  readonly width: number;
  readonly height: number;
  readonly highlight: PanelRasterEvidence["highlight"];
  readonly tolerancePx: number;
  readonly options: RealBuildOptions;
  readonly rendering: BrowserModule;
  readonly assembly: BrowserModule;
  readonly silhouette: StepSilhouette<D>;
}): WholeStepVisualEvidence {
  const pieceMasks = input.partIds.map(
    (partId) => input.silhouette(input.document, partId, input.centre).probe,
  );
  const union = input.silhouette(input.document, input.partIds, input.centre).probe;
  const jointScore = input.assembly.scoreStepDelta(union, input.highlight, {
    tolerancePx: input.tolerancePx,
  }) as { score: number; basis: "region" | "stroke" };
  const evidenceKind = jointScore.basis;
  const printedEvidence = (
    evidenceKind === "stroke" ? input.highlight.contourStrokeMask : input.highlight.mask
  ) as Uint8Array;
  const pieceClaims =
    evidenceKind === "stroke"
      ? pieceMasks.map(
          (mask) =>
            input.rendering.dilateMask(
              input.rendering.maskBoundary(mask, input.width, input.height),
              input.width,
              input.height,
              input.tolerancePx,
            ) as Uint8Array,
        )
      : pieceMasks;
  const coverage = measureWholeStepMaskEvidence(pieceClaims, printedEvidence, input.width);
  return assessWholeStepVisualEvidence({
    stepNumber: input.stepNumber,
    score: jointScore.score,
    minimumScore: input.options.minimumWholeStepScore,
    minimumExclusiveHighlightPixelsPerPiece: input.options.minimumExclusiveHighlightPixelsPerPiece,
    calibrationDigest: input.options.highlightCalibrationDigest,
    evidenceKind,
    printedEvidencePixels: printedEvidence.reduce((total, value) => total + value, 0),
    ...coverage,
  });
}

/** Renders the canonical post-settlement document for retained visual evidence. */
export function renderRunBuildPng<D>(input: {
  readonly document: D;
  readonly view: StepView;
  readonly centre: [number, number];
  readonly frame: StepFrame;
  readonly width: number;
  readonly height: number;
  readonly rendering: BrowserModule;
  readonly renderer: BrowserModule;
}): string {
  const scene = input.rendering.deriveBrickScene(input.document, { finish: "instruction" });
  let pixels: Uint8Array;
  try {
    const camera = input.rendering.createOrthographicViewCamera(
      { ...input.view, centerXPx: input.centre[0], centerYPx: input.centre[1] },
      input.frame,
    );
    pixels = new Uint8Array(input.renderer.render(scene.root, camera));
  } finally {
    scene.dispose();
  }
  return rgbaPngDataUrl(pixels, input.width, input.height);
}
