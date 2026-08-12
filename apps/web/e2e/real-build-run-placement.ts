import { ownPanelCannotSeparate } from "./real-build-deferral";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type { PanelHighlightBox } from "./real-build-panel-raster";
import {
  benchmarkPrefixFailure,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildPieceReport,
  type StepFailure,
} from "./real-build-safety";
import { evaluateSearchBenchmark } from "./real-build-search";
import type { RunPlacementCandidate, RunScoredCandidate } from "./real-build-run-visual";

type BrowserModule = ReturnType<typeof JSON.parse>;

type Place<D> = (
  base: D,
  catalogPartId: string,
  transform: unknown,
  colorId: string,
  printedStepNumber: number,
  targetStepId: string | null,
) => { readonly document: D; readonly partId: string; readonly stepId: string };

interface PlacementView {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly upSign: 1 | -1;
}

interface PlacementFrame {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly target: readonly [number, number, number];
  readonly sceneRadius: number;
}

export interface RunDirectPlacementResult<D> {
  readonly document: D;
  readonly printedStepId: string | null;
  readonly centre: [number, number];
  readonly candidatePlaced: number;
  readonly failure: StepFailure | null;
  readonly ownPanelMargin: number | null;
}

/**
 * Enumerates, scores, and applies the directly pictured callout pieces for one step.
 *
 * The caller still owns whole-step atomicity. This function updates only the
 * caller-owned provisional bookkeeping and centre callback; it never commits
 * registrations to the run-wide identity map.
 */
export function executeRunDirectPlacements<D>(input: {
  readonly stepNumber: number;
  readonly pieces: RealBuildPanelSpec["pieces"];
  readonly skip: boolean;
  readonly initialDocument: D;
  readonly initialStepId: string | null;
  readonly initialCentre: [number, number];
  /** Keeps the scorer's caller-owned centre closure current between pieces. */
  readonly updateCentre: (centre: [number, number]) => void;
  readonly initialCandidatePlaced: number;
  readonly initialFailure: StepFailure | null;
  readonly candidatePartIds: string[];
  readonly pendingRegistrations: RuntimeBrickIdentity[];
  readonly pieceReports: RealBuildPieceReport[];
  readonly anchorStep: boolean;
  readonly highlightBox: PanelHighlightBox | null;
  readonly width: number;
  readonly height: number;
  readonly view: PlacementView;
  readonly frame: PlacementFrame;
  readonly options: Pick<
    RealBuildOptions,
    "proximityMarginPx" | "maxRendersPerPiece" | "blindRenderBudget" | "minimumScoreMargin"
  >;
  readonly assembly: BrowserModule;
  readonly rendering: BrowserModule;
  readonly kernel: BrowserModule;
  readonly renderAndScore: (
    prefixDocument: D,
    candidate: RunPlacementCandidate,
    targetStepId: string | null,
  ) => RunScoredCandidate<RunPlacementCandidate>;
  readonly place: Place<D>;
}): RunDirectPlacementResult<D> {
  let candidateDocument = input.initialDocument;
  let printedStepId = input.initialStepId;
  let centre = input.initialCentre;
  let candidatePlaced = input.initialCandidatePlaced;
  let failure = input.initialFailure;
  let ownPanelMargin: number | null = null;

  for (const [pieceIndex, piece] of input.skip ? [] : [...input.pieces.entries()]) {
    try {
      const enumeration = input.assembly.enumeratePlacements(
        candidateDocument,
        piece.catalogPartId,
        {
          includeBuildPlate: (candidateDocument as { parts: unknown[] }).parts.length === 0,
        },
      );
      const candidates = enumeration.candidates as RunPlacementCandidate[];

      const seen = new Set<string>();
      const near: RunPlacementCandidate[] = [];
      const distinct: RunPlacementCandidate[] = [];
      const probeCamera = input.rendering.createOrthographicViewCamera(
        { ...input.view, centerXPx: centre[0], centerYPx: centre[1] },
        input.frame,
      );
      for (const candidate of candidates) {
        const key = input.assembly.placementOccupancyKey(
          candidate.catalogPartId,
          candidate.transform,
        ) as string;
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push(candidate);
        if (input.anchorStep || input.highlightBox === null) {
          near.push(candidate);
          continue;
        }
        const box = input.assembly.projectPartBounds(
          candidate,
          probeCamera,
          input.width,
          input.height,
        ) as PanelHighlightBox | null;
        if (box === null) continue;
        const margin = input.options.proximityMarginPx;
        const overlaps =
          box.minXPx - margin <= input.highlightBox.maxXPx &&
          input.highlightBox.minXPx - margin <= box.maxXPx &&
          box.minYPx - margin <= input.highlightBox.maxYPx &&
          input.highlightBox.minYPx - margin <= box.maxYPx;
        if (overlaps) near.push(candidate);
      }

      const highlightPrefix = candidateDocument;
      const blindPrefix = candidateDocument;
      const highlightPrefixHash = input.kernel.documentStructuralHash(highlightPrefix) as string;
      const blindPrefixHash = input.kernel.documentStructuralHash(blindPrefix) as string;
      const prefixFailure = benchmarkPrefixFailure({
        stepNumber: input.stepNumber,
        highlightPrefixHash,
        blindPrefixHash,
      });
      if (prefixFailure !== null) {
        failure = prefixFailure;
        break;
      }

      const placementKey = (candidate: RunPlacementCandidate | undefined) =>
        candidate === undefined
          ? null
          : `${candidate.transform.positionLdu.join(",")}|${candidate.transform.orientationId}`;
      const search = evaluateSearchBenchmark({
        stepNumber: input.stepNumber,
        pieceIndex,
        catalogPartId: piece.catalogPartId,
        prefixHash: blindPrefixHash,
        prunedCandidates: near,
        exhaustiveCandidates: distinct,
        maxPrunedRenders: input.options.maxRendersPerPiece,
        exhaustiveRenderBudget: input.options.blindRenderBudget,
        minimumMargin: input.options.minimumScoreMargin,
        score: (candidate) => input.renderAndScore(highlightPrefix, candidate, printedStepId),
        key: placementKey,
      });
      const scored = [...search.prunedScores];
      const blind = search.blind;
      const winner = search.winner;
      // Ask the pruned decision rather than the benchmark verdict: only the
      // pruned half scored against this panel, so only it can report that the
      // drawing itself failed to distinguish two placements.
      if (
        ownPanelCannotSeparate({
          failure: search.prunedFailure,
          scores: scored.map(({ score }) => score),
          minimumMargin: input.options.minimumScoreMargin,
        })
      ) {
        ownPanelMargin = scored[0]!.score - scored[1]!.score;
      }
      if (winner === null || search.failure !== null) {
        const pieceFailure =
          search.failure ??
          ({
            code: "no-placement-candidate",
            stage: "placement",
            pieceIndex,
            catalogPartId: piece.catalogPartId,
            message:
              `No placement of ${piece.catalogPartId} survived to be rendered: ${candidates.length} were enumerated ` +
              `on a ${(candidateDocument as { parts: unknown[] }).parts.length}-part assembly and ${candidates.length - near.length} ` +
              `projected away from the step's highlight box. Either the step base has diverged, or the identified ` +
              `part is not the one this printed step places.`,
          } satisfies StepFailure);
        input.pieceReports.push({
          catalogPartId: piece.catalogPartId,
          blind,
          enumerated: candidates.length,
          afterProximity: near.length,
          rendered: scored.length,
          bestScore: scored[0]?.score ?? null,
          runnerUpScore: scored[1]?.score ?? null,
          placed: false,
          positionLdu: null,
          orientationId: null,
          failure: pieceFailure,
        });
        failure = pieceFailure;
        break;
      }
      const applied = input.place(
        candidateDocument,
        winner.candidate.catalogPartId,
        winner.candidate.transform,
        piece.colorId,
        input.stepNumber,
        printedStepId,
      );
      candidateDocument = applied.document;
      input.candidatePartIds.push(applied.partId);
      input.pendingRegistrations.push({
        identityKey: piece.identityKey,
        partId: applied.partId,
        stepNumber: input.stepNumber,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
      });
      printedStepId = applied.stepId;
      centre = winner.centre;
      input.updateCentre(centre);
      candidatePlaced += 1;
      input.pieceReports.push({
        catalogPartId: piece.catalogPartId,
        blind,
        enumerated: candidates.length,
        afterProximity: near.length,
        rendered: scored.length,
        bestScore: winner.score,
        runnerUpScore: scored[1]?.score ?? null,
        placed: true,
        positionLdu: winner.candidate.transform.positionLdu,
        orientationId: winner.candidate.transform.orientationId,
        failure: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isBudget = /budget|limit|maxParts|maximum|too many parts/iu.test(message);
      const pieceFailure: StepFailure = {
        code: isBudget ? "resource-budget-exhausted" : "placement-error",
        stage: isBudget ? "budget" : "placement",
        pieceIndex,
        catalogPartId: piece.catalogPartId,
        message:
          `Step ${input.stepNumber} could not place ${piece.catalogPartId}: ${message}. ` +
          `The printed step remains unchanged; an exception is not a placement decision.`,
      };
      input.pieceReports.push({
        catalogPartId: piece.catalogPartId,
        blind: {
          comparisonPrefixHash: input.kernel.documentStructuralHash(candidateDocument) as string,
          distinctCandidates: 0,
          feasible: false,
          rendered: 0,
          bestScore: null,
          runnerUpScore: null,
          agreesWithHighlight: null,
          refusal: pieceFailure.message,
          elapsedMs: 0,
        },
        enumerated: 0,
        afterProximity: 0,
        rendered: 0,
        bestScore: null,
        runnerUpScore: null,
        placed: false,
        positionLdu: null,
        orientationId: null,
        failure: pieceFailure,
      });
      failure = pieceFailure;
      break;
    }
  }

  return {
    document: candidateDocument,
    printedStepId,
    centre,
    candidatePlaced,
    failure,
    ownPanelMargin,
  };
}
