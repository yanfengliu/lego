import {
  benchmarkPrefixFailure,
  groupPlacementOperationsInPrintedStep,
  placementSignalFailure,
  settleAtomicStep,
  stepPrerequisiteFacts,
  stepPrerequisiteFailure,
  type StepFailure,
  type RealBuildOptions,
  type RealBuildPieceReport,
  type RealBuildStepReport,
  type StepOutcome,
  type SuccessfulStepMechanism,
  type WholeStepVisualEvidence,
} from "./real-build-safety";
import type { RealBuildBrowserOutput } from "./real-build-browser-output";
import {
  assessWholeStepVisualEvidence,
  executeCanonicalTransition,
  maskCentroid,
  measureWholeStepMaskEvidence,
  preflightRealBuildOptions,
  selectRequestedPanelPages,
  unexecutedStepReport,
  validateRealBuildCandidate,
} from "./real-build-contract";
import {
  adaptFixedLedgerPlacement,
  canonicalPartsFromDocument,
  createCanonicalPrintedStepPlacer,
  executeFixedLedgerPlacements,
  executeMultiBuildLedgerStep,
  rollbackPlacedPieceReports,
  type RuntimeBrickIdentity,
} from "./real-build-fixed-actions";
import { evaluateSearchBenchmark } from "./real-build-search";
import type { DeferralEvidence } from "./real-build-deferral";
import { settleDeferredPrintedStep } from "./real-build-deferred-step";
import { settleExplodedPrintedStep, type ExplodedGhostEvidence } from "./real-build-exploded-step";
import { anchorStepCamera, createStepSilhouette } from "./real-build-step-camera";
import { composeExecutedStepReport } from "./real-build-step-report";
import {
  derivePanelRasterEvidence,
  renderRealBuildPageCanvas,
  type PanelRasterEvidence,
} from "./real-build-panel-raster";
import {
  BrowserPreparationError,
  failedBrowserOutput,
  prepareDigestBoundPdf,
  prepareRealBuildModules,
  rgbaPngDataUrl,
} from "./real-build-browser-preflight";

export async function runRealBuild(options: RealBuildOptions): Promise<RealBuildBrowserOutput> {
  const runStarted = performance.now();
  const inputFailures = preflightRealBuildOptions(options);
  if (inputFailures.length > 0) return failedBrowserOutput(inputFailures[0]!, runStarted);
  let modules;
  try {
    modules = await prepareRealBuildModules(options);
  } catch (error) {
    return failedBrowserOutput(
      error instanceof BrowserPreparationError
        ? error.failure
        : {
            code: "dynamic-import-failed",
            stage: "loading",
            message: `Real-build module loading failed unexpectedly: ${String(error)}.`,
          },
      runStarted,
    );
  }
  const { pdfjs, lattice, rendering, kernel, commands, assembly } = modules;
  let preparedPdf;
  try {
    preparedPdf = await prepareDigestBoundPdf(pdfjs, options);
  } catch (error) {
    return failedBrowserOutput(
      error instanceof BrowserPreparationError
        ? error.failure
        : {
            code: "pdf-load-failed",
            stage: "loading",
            inputKey: "pdf",
            message: `Real-build PDF preparation failed unexpectedly: ${String(error)}.`,
          },
      runStarted,
    );
  }
  const { pdf, loadingTask, fetchedPdfDigest } = preparedPdf;
  try {
    try {
      const reports: RealBuildStepReport[] = [];
      let document_ = kernel.createEmptyBrickDocument({
        id: "real-build",
        name: "Real booklet rebuild",
        maxParts: options.maxParts,
      });
      let blockingStep: number | null = null;
      const partIdByIdentity = new Map<string, RuntimeBrickIdentity>();

      const place = createCanonicalPrintedStepPlacer<unknown>({
        createTransaction: (base, piece) => commands.createPlacePartTransaction(base, piece),
        groupOperations: (operations, step) =>
          groupPlacementOperationsInPrintedStep(
            operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
            step,
          ),
        applyOperations: (base, operations) => kernel.applyBuildOperations(base, operations),
      });
      const { panels: selectedPanels, pages } = selectRequestedPanelPages(options);
      const orderedPanels = [...selectedPanels].sort(
        (left, right) => left.stepNumber - right.stepNumber,
      );

      document.querySelectorAll("canvas.page-probe").forEach((node) => node.remove());
      for (const pageNumber of pages) {
        const page = await renderRealBuildPageCanvas(pdf, pageNumber, options.renderScale);
        const pageCanvas = page.canvas;
        try {
          const onThisPage = selectedPanels
            .filter((panel) => panel.pageNumber === pageNumber)
            .sort((left, right) => left.stepNumber - right.stepNumber);

          for (const spec of onThisPage) {
            const stepStarted = performance.now();
            const stepBaseDocument = document_;
            try {
              const evidence = derivePanelRasterEvidence({
                pageCanvas,
                spec,
                options,
                modules: { lattice, assembly },
              });
              const {
                width,
                height,
                highlight,
                highlightBox,
                builtMask: built,
                arrows,
                arrowFamily,
              } = evidence;
              const fit = {
                solution: evidence.fitSolution,
                failure: evidence.fitFailure,
                coherence: evidence.fitCoherence,
              };
              const factor = options.workFactor;

              const pieceReports: RealBuildPieceReport[] = [];
              let candidateDocument = stepBaseDocument;
              let attemptedMechanism: SuccessfulStepMechanism | null = null;
              let failedMechanism: "deferred" | "blocked" = "deferred";
              let failure: StepFailure | null = null;
              let outcome: StepOutcome | null = null;
              let cameraReport: RealBuildStepReport["camera"] = null;
              let panelPng: string | null = null;
              let buildPng: string | null = null;
              let jointVisual: WholeStepVisualEvidence | null = null;
              let candidatePlaced = 0;
              const candidatePartIds: string[] = [];
              const pendingRegistrations: RuntimeBrickIdentity[] = [];
              let placed = 0;
              let printedStepId: string | null = null;
              let validation: RealBuildStepReport["validation"] = {
                attempted: false,
                targetDocumentHash: null,
                truthSnapshotHash: null,
                validatorSetHash: null,
                documentGloballyValid: null,
                blockingIssues: [],
                failure: null,
              };

              const parts = (stepBaseDocument as { parts: unknown[] }).parts;
              const anchorStep = parts.length === 0;

              const noSignal = placementSignalFailure({
                stepNumber: spec.stepNumber,
                hasHighlight: highlightBox !== null,
                detectedArrowCount: (arrows.arrows as unknown[]).length,
                usableArrowPlacementCount: arrowFamily.length,
                independentPlacementSignalCount: 0,
              });

              // A panel that prints no highlight at all cannot score anything:
              // `scoreStepDelta` gets a null region IoU over an empty stroke
              // mask, so every candidate scores exactly zero by construction.
              // That is the first printed step — nothing is built yet to outline
              // — and it is a fact about the booklet rather than a defect.
              //
              // It is also not a dead end. Panel N+1 draws everything placed at
              // step N as already built, so the step carries its candidates one
              // panel forward and is settled there. The lookahead is one step
              // and no further: if that panel does not discriminate either, the
              // deferral refuses by name rather than searching until something
              // wins.
              const localScoringSignal =
                highlight.regions.length > 0 && (highlight.keyedPx as number) > 0;
              const placesCallouts =
                spec.action.kind === "place-callouts" && spec.pieces.length > 0;
              const deferring = !localScoringSignal && placesCallouts;
              // A step that prints a displacement arrow is drawn exploded: the
              // yellow rings the part where the booklet floats it, not where it
              // seats, so a seated candidate is being scored against a shape in
              // the wrong place. The signal costs nothing — it is the same arrow
              // reading the family comes from — and it separates this booklet's
              // first three printed steps 2, 2, 0.
              //
              // Not on an anchor step, where nothing is built and the camera has
              // no registration: that path centres each candidate on the
              // highlight's own centroid, and a ghost free to be shifted onto the
              // contour is contained by construction rather than by being right.
              const exploded =
                !deferring &&
                !anchorStep &&
                placesCallouts &&
                (arrows.arrows as unknown[]).length > 0;
              const deferralTarget = deferring
                ? (orderedPanels.find((panel) => panel.stepNumber > spec.stepNumber) ?? null)
                : null;
              let deferral: DeferralEvidence | null = null;
              let explodedGhost: ExplodedGhostEvidence | null = null;
              const prerequisiteInput = {
                stepNumber: spec.stepNumber,
                actionKind: spec.action.kind,
                blockingStep,
                coverageFailures: spec.coverageFailures,
                unresolvedCallouts: spec.unresolvedCallouts,
                missingDesigns: spec.missingDesigns,
                calloutPieces: spec.calloutPieces,
                expectedAssembledPieces: spec.action.assembledPieces,
                resolvedPieces:
                  spec.action.kind === "multi-build-copy"
                    ? spec.action.copies.length
                    : spec.pieces.length + spec.omittedPieces.length,
              };
              const prerequisites = stepPrerequisiteFacts(prerequisiteInput);
              const prerequisite = stepPrerequisiteFailure(prerequisiteInput);

              if (prerequisite !== null) {
                failedMechanism = prerequisite.mechanism;
                failure = prerequisite.failure;
              } else if (spec.action.kind === "transition") {
                if (spec.action.transition === "unclassified") {
                  failure = {
                    code: "unsupported-instruction-action",
                    stage: "input",
                    message:
                      `Step ${spec.stepNumber} has no physical-piece callout but its transition is unclassified. ` +
                      `Classify the printed panel as rotation, attachment, or final view before treating zero pieces as intentional.`,
                  };
                } else {
                  attemptedMechanism = "instruction-transition";
                  const transitioned = executeCanonicalTransition({
                    baseDocument: stepBaseDocument,
                    printedStepNumber: spec.stepNumber,
                    transition: spec.action.transition,
                    panelEvidenceDigest: spec.action.panelEvidenceDigest!,
                    steps: (
                      stepBaseDocument as {
                        steps: readonly {
                          id: string;
                          index: number;
                          name: string;
                          partIds: readonly string[];
                        }[];
                      }
                    ).steps,
                    applyOperations: (base, operations) =>
                      kernel.applyBuildOperations(base, operations),
                    validate: (document) => kernel.validateBrickDocument(document),
                  });
                  validation = transitioned.validation;
                  failure = transitioned.failure;
                  if (failure === null) {
                    document_ = transitioned.document;
                    printedStepId = transitioned.stepId;
                    outcome = {
                      status: "complete",
                      mechanism: "instruction-transition",
                      failure: null,
                    };
                  }
                }
              } else if (spec.action.kind === "multi-build-copy") {
                attemptedMechanism = "official-ledger";
                const executed = executeMultiBuildLedgerStep({
                  stepNumber: spec.stepNumber,
                  baseDocument: stepBaseDocument,
                  expectedPieces: spec.action.assembledPieces,
                  pieces: spec.action.copies,
                  priorIdentities: partIdByIdentity,
                  getParts: canonicalPartsFromDocument,
                  structuralHash: (subject) => kernel.documentStructuralHash(subject) as string,
                  place: adaptFixedLedgerPlacement(place, spec.stepNumber),
                  assess: (subject) =>
                    validateRealBuildCandidate({
                      stepNumber: spec.stepNumber,
                      document: subject,
                      validate: (document) => kernel.validateBrickDocument(document),
                    }),
                });
                document_ = executed.document;
                printedStepId = executed.stepId;
                pendingRegistrations.push(...executed.registrations);
                pieceReports.push(...executed.reports);
                candidatePlaced = executed.registrations.length;
                placed = executed.placed;
                validation = executed.validation;
                outcome = executed.outcome;
              } else if (fit.failure !== null) {
                failure = {
                  code: "camera-fit-failed",
                  stage: "camera-fit",
                  message: `Step ${spec.stepNumber} has no usable camera fit: ${fit.failure}`,
                };
              } else if (spec.panelFace === null) {
                failure = {
                  code: "panel-face-unknown",
                  stage: "camera-fit",
                  message:
                    `Step ${spec.stepNumber} has no derived panel face, so which side of the model the panel ` +
                    `is drawn from is unknown. This booklet turns the model over mid-build and the face is a ` +
                    `running parity from printed step 1, so it is derivable only over a contiguous prefix of ` +
                    `steps whose rotate-the-model icons have all been read. Rendering the candidate anyway ` +
                    `would score it against the opposite face of the drawing, which no later check reports.`,
                  stepNumber: spec.stepNumber,
                };
              } else if (noSignal !== null) {
                failure = noSignal;
              } else {
                const solution = fit.solution as {
                  azimuthDegrees: number;
                  elevationDegrees: number;
                  pixelsPerUnit: number;
                  residualPx: number;
                };
                // Derived from the solution here rather than reused from
                // `faceCorrectedFit`, so this branch depends on the face alone —
                // which the guard above has established — and not on a coupling
                // between a null solution and a null failure that a reader would
                // have to go and check.
                const corrected = assembly.viewForPanelFace(solution, spec.panelFace) as {
                  azimuthDegrees: number;
                  elevationDegrees: number;
                  pixelsPerUnit: number;
                };
                const view = {
                  azimuthDegrees: corrected.azimuthDegrees,
                  elevationDegrees: corrected.elevationDegrees,
                  pixelsPerUnit: corrected.pixelsPerUnit / factor,
                };
                const frame = {
                  widthPx: width,
                  heightPx: height,
                  target: [0, 0, 0] as [number, number, number],
                  sceneRadius: 60,
                };

                // The lookahead panel's raster, derived while this step is still
                // open. It usually shares this page — printed steps 1 to 4 are
                // all on page 11 — but it need not, so the page is rasterised on
                // demand and released again rather than assumed present.
                let lookahead: {
                  readonly spec: typeof spec;
                  readonly evidence: PanelRasterEvidence;
                } | null = null;
                if (deferralTarget !== null) {
                  const lookaheadPage =
                    deferralTarget.pageNumber === pageNumber
                      ? { canvas: pageCanvas, dispose: () => {} }
                      : await renderRealBuildPageCanvas(
                          pdf,
                          deferralTarget.pageNumber,
                          options.renderScale,
                        );
                  try {
                    lookahead = {
                      spec: deferralTarget,
                      evidence: derivePanelRasterEvidence({
                        pageCanvas: lookaheadPage.canvas,
                        spec: deferralTarget,
                        options,
                        modules: { lattice, assembly },
                      }),
                    };
                  } finally {
                    lookaheadPage.dispose();
                  }
                }
                try {
                  const renderer = rendering.createInstructionRenderer({ width, height });
                  try {
                    const silhouette = createStepSilhouette({
                      rendering,
                      renderer,
                      view,
                      frame,
                      widthPx: width,
                      heightPx: height,
                    });

                    let centre: [number, number] = [width / 2, height / 2];
                    let anchorIou: number | null = null;
                    let anchorShift: [number, number] | null = null;

                    if (!anchorStep) {
                      const anchored = anchorStepCamera({
                        stepNumber: spec.stepNumber,
                        modelMask: silhouette(candidateDocument, null, centre).all,
                        builtMask: built,
                        widthPx: width,
                        heightPx: height,
                      });
                      failure = anchored.failure;
                      centre = anchored.centrePx;
                      anchorIou = anchored.anchorIou;
                      anchorShift = anchored.anchorShiftPx;
                    }

                    if (failure === null) {
                      const placementMechanism: SuccessfulStepMechanism = deferring
                        ? "deferred-lookahead"
                        : exploded
                          ? "exploded-ghost"
                          : anchorStep
                            ? "anchor-orientation"
                            : "highlight";
                      attemptedMechanism = placementMechanism;
                      if (exploded) {
                        const settledExploded = settleExplodedPrintedStep({
                          spec,
                          baseDocument: stepBaseDocument,
                          stepId: printedStepId,
                          evidence,
                          options,
                          view,
                          centrePx: centre,
                          rendering,
                          kernel,
                          assembly,
                          place,
                        });
                        explodedGhost = settledExploded.evidence;
                        failure = settledExploded.failure;
                        pieceReports.push(...settledExploded.pieceReports);
                        if (settledExploded.placement !== null) {
                          candidateDocument = settledExploded.placement.document;
                          candidatePartIds.push(...settledExploded.placement.partIds);
                          printedStepId = settledExploded.placement.stepId;
                          pendingRegistrations.push(...settledExploded.placement.registrations);
                          candidatePlaced += settledExploded.placement.partIds.length;
                        }
                      }
                      if (deferring) {
                        const settledDeferral = settleDeferredPrintedStep({
                          spec,
                          baseDocument: stepBaseDocument,
                          stepId: printedStepId,
                          lookahead,
                          options,
                          rendering,
                          kernel,
                          assembly,
                          place,
                        });
                        deferral = settledDeferral.evidence;
                        failure = settledDeferral.failure;
                        pieceReports.push(...settledDeferral.pieceReports);
                        if (settledDeferral.placement !== null) {
                          candidateDocument = settledDeferral.placement.document;
                          candidatePartIds.push(...settledDeferral.placement.partIds);
                          printedStepId = settledDeferral.placement.stepId;
                          pendingRegistrations.push(...settledDeferral.placement.registrations);
                          candidatePlaced += settledDeferral.placement.partIds.length;
                        }
                      }
                      for (const [pieceIndex, piece] of deferring || exploded
                        ? []
                        : [...spec.pieces.entries()]) {
                        try {
                          const enumeration = assembly.enumeratePlacements(
                            candidateDocument,
                            piece.catalogPartId,
                            {
                              includeBuildPlate:
                                (candidateDocument as { parts: unknown[] }).parts.length === 0,
                            },
                          );
                          const candidates = enumeration.candidates as unknown as {
                            catalogPartId: string;
                            transform: {
                              positionLdu: [number, number, number];
                              orientationId: string;
                            };
                          }[];

                          const seen = new Set<string>();
                          const near: typeof candidates = [];
                          const distinct: typeof candidates = [];
                          const probeCamera = rendering.createOrthographicViewCamera(
                            { ...view, centerXPx: centre[0], centerYPx: centre[1] },
                            frame,
                          );
                          for (const candidate of candidates) {
                            const key = assembly.placementOccupancyKey(
                              candidate.catalogPartId,
                              candidate.transform,
                            ) as string;
                            if (seen.has(key)) continue;
                            seen.add(key);
                            distinct.push(candidate);
                            if (anchorStep || highlightBox === null) {
                              near.push(candidate);
                              continue;
                            }
                            const box = assembly.projectPartBounds(
                              candidate,
                              probeCamera,
                              width,
                              height,
                            ) as {
                              minXPx: number;
                              minYPx: number;
                              maxXPx: number;
                              maxYPx: number;
                            } | null;
                            if (box === null) continue;
                            const margin = options.proximityMarginPx;
                            const overlaps =
                              box.minXPx - margin <= highlightBox.maxXPx &&
                              highlightBox.minXPx - margin <= box.maxXPx &&
                              box.minYPx - margin <= highlightBox.maxYPx &&
                              highlightBox.minYPx - margin <= box.maxYPx;
                            if (overlaps) near.push(candidate);
                          }

                          type Scored = {
                            candidate: (typeof candidates)[number];
                            score: number;
                            centre: [number, number];
                          };
                          const renderAndScore = (
                            prefixDocument: unknown,
                            candidate: (typeof candidates)[number],
                          ): Scored => {
                            const applied = place(
                              prefixDocument,
                              candidate.catalogPartId,
                              candidate.transform,
                              "builtin:magenta",
                              spec.stepNumber,
                              printedStepId,
                            );
                            let candidateCentre = centre;
                            let mask = silhouette(applied.document, applied.partId, centre).probe;
                            if (anchorStep) {
                              const from = maskCentroid(mask, width, height);
                              const to = maskCentroid(highlight.mask as Uint8Array, width, height);
                              if (from !== null && to !== null) {
                                candidateCentre = [
                                  centre[0] + (to.x - from.x),
                                  centre[1] + (to.y - from.y),
                                ];
                                mask = silhouette(
                                  applied.document,
                                  applied.partId,
                                  candidateCentre,
                                ).probe;
                              }
                            }
                            const score = assembly.scoreStepDelta(mask, highlight, {
                              tolerancePx: 3,
                            }) as {
                              score: number;
                            };
                            return { candidate, score: score.score, centre: candidateCentre };
                          };

                          const highlightPrefix = candidateDocument;
                          const blindPrefix = candidateDocument;
                          const highlightPrefixHash = kernel.documentStructuralHash(
                            highlightPrefix,
                          ) as string;
                          const blindPrefixHash = kernel.documentStructuralHash(
                            blindPrefix,
                          ) as string;
                          const prefixFailure = benchmarkPrefixFailure({
                            stepNumber: spec.stepNumber,
                            highlightPrefixHash,
                            blindPrefixHash,
                          });
                          if (prefixFailure !== null) {
                            failure = prefixFailure;
                            break;
                          }

                          const placementKey = (
                            candidate: (typeof candidates)[number] | undefined,
                          ) =>
                            candidate === undefined
                              ? null
                              : `${candidate.transform.positionLdu.join(",")}|${candidate.transform.orientationId}`;
                          const search = evaluateSearchBenchmark({
                            stepNumber: spec.stepNumber,
                            pieceIndex,
                            catalogPartId: piece.catalogPartId,
                            prefixHash: blindPrefixHash,
                            prunedCandidates: near,
                            exhaustiveCandidates: distinct,
                            maxPrunedRenders: options.maxRendersPerPiece,
                            exhaustiveRenderBudget: options.blindRenderBudget,
                            minimumMargin: options.minimumScoreMargin,
                            score: (candidate) => renderAndScore(highlightPrefix, candidate),
                            key: placementKey,
                          });
                          const scored = [...search.prunedScores];
                          const blind = search.blind;
                          const winner = search.winner;
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
                            pieceReports.push({
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
                          const applied = place(
                            candidateDocument,
                            winner.candidate.catalogPartId,
                            winner.candidate.transform,
                            piece.colorId,
                            spec.stepNumber,
                            printedStepId,
                          );
                          candidateDocument = applied.document;
                          candidatePartIds.push(applied.partId);
                          pendingRegistrations.push({
                            identityKey: piece.identityKey,
                            partId: applied.partId,
                            stepNumber: spec.stepNumber,
                            designId: piece.designId,
                            materialId: piece.materialId,
                            catalogPartId: piece.catalogPartId,
                            colorId: piece.colorId,
                          });
                          printedStepId = applied.stepId;
                          centre = winner.centre;
                          candidatePlaced += 1;
                          pieceReports.push({
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
                          const isBudget = /budget|limit|maxParts|maximum|too many parts/iu.test(
                            message,
                          );
                          const pieceFailure: StepFailure = {
                            code: isBudget ? "resource-budget-exhausted" : "placement-error",
                            stage: isBudget ? "budget" : "placement",
                            pieceIndex,
                            catalogPartId: piece.catalogPartId,
                            message:
                              `Step ${spec.stepNumber} could not place ${piece.catalogPartId}: ${message}. ` +
                              `The printed step remains unchanged; an exception is not a placement decision.`,
                          };
                          pieceReports.push({
                            catalogPartId: piece.catalogPartId,
                            blind: {
                              comparisonPrefixHash: kernel.documentStructuralHash(
                                candidateDocument,
                              ) as string,
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

                      if (
                        failure === null &&
                        candidatePlaced === spec.pieces.length &&
                        spec.omittedPieces.length > 0
                      ) {
                        const identitiesIncludingDirect = new Map(partIdByIdentity);
                        for (const registration of pendingRegistrations) {
                          identitiesIncludingDirect.set(registration.identityKey, registration);
                        }
                        const fixed = executeFixedLedgerPlacements({
                          stepNumber: spec.stepNumber,
                          baseDocument: candidateDocument,
                          targetStepId: printedStepId,
                          pieces: spec.omittedPieces,
                          priorIdentities: identitiesIncludingDirect,
                          getParts: canonicalPartsFromDocument,
                          structuralHash: (subject) =>
                            kernel.documentStructuralHash(subject) as string,
                          place: adaptFixedLedgerPlacement(place, spec.stepNumber),
                        });
                        candidateDocument = fixed.document;
                        printedStepId = fixed.stepId;
                        candidatePartIds.push(...fixed.partIds);
                        pendingRegistrations.push(...fixed.registrations);
                        pieceReports.push(...fixed.reports);
                        candidatePlaced += fixed.registrations.length;
                        failure = fixed.failure;
                      }

                      // The joint visual gate measures this step's own printed
                      // highlight against seated silhouettes, and neither a
                      // deferred nor an exploded step can be asked that.
                      //
                      // A deferred step has no highlight at all — union and
                      // exclusive pixel counts are zero by construction, so
                      // running it would refuse every deferred step whatever it
                      // placed. Its evidence is the deferral's own gate instead:
                      // agreement with the lookahead panel's already-built art,
                      // over a margin no measured wrong pick has cleared.
                      //
                      // An exploded step has a highlight, but it rings the ghost
                      // rather than the seat, so a seated union scored against it
                      // is a comparison with a shape in the wrong place — on
                      // printed step 2 the drawn placement reaches region IoU
                      // 0.000155 there. Its evidence is the ghost gate instead.
                      //
                      // Both are reported in their own field and `jointVisual`
                      // stays null, so the report says which gate ran rather than
                      // implying this one passed.
                      if (
                        failure === null &&
                        !deferring &&
                        !exploded &&
                        candidatePlaced === spec.action.assembledPieces
                      ) {
                        const pieceMasks = candidatePartIds.map(
                          (partId) => silhouette(candidateDocument, partId, centre).probe,
                        );
                        const union = silhouette(candidateDocument, candidatePartIds, centre).probe;
                        const jointScore = assembly.scoreStepDelta(union, highlight, {
                          tolerancePx: 3,
                        }) as { score: number };
                        const coverage = measureWholeStepMaskEvidence(
                          pieceMasks,
                          highlight.mask as Uint8Array,
                        );
                        jointVisual = assessWholeStepVisualEvidence({
                          stepNumber: spec.stepNumber,
                          score: jointScore.score,
                          minimumScore: options.minimumWholeStepScore,
                          minimumExclusiveHighlightPixelsPerPiece:
                            options.minimumExclusiveHighlightPixelsPerPiece,
                          calibrationDigest: options.highlightCalibrationDigest,
                          ...coverage,
                        });
                        if (jointVisual.failure !== null) failure = jointVisual.failure;
                      }

                      let hardValidationPassed = false;
                      if (failure === null && candidatePlaced === spec.action.assembledPieces) {
                        const assessed = validateRealBuildCandidate({
                          stepNumber: spec.stepNumber,
                          document: candidateDocument,
                          validate: (document) => kernel.validateBrickDocument(document),
                        });
                        hardValidationPassed = assessed.passed;
                        validation = assessed.validation;
                        failure = assessed.failure;
                      }

                      const settled = settleAtomicStep({
                        stepNumber: spec.stepNumber,
                        baseDocument: stepBaseDocument,
                        candidateDocument,
                        expectedPieces: spec.action.assembledPieces,
                        candidatePieces: candidatePlaced,
                        attemptedMechanism: placementMechanism,
                        firstPieceFailure: failure,
                        hardValidationPassed,
                      });
                      document_ = settled.document;
                      placed = settled.acceptedPieces;
                      outcome = settled.outcome;
                      if (settled.outcome.status === "failed") {
                        rollbackPlacedPieceReports(pieceReports, {
                          stepNumber: spec.stepNumber,
                          reason:
                            `${settled.outcome.failure.code}: ${settled.outcome.failure.message} ` +
                            `The canonical document remains at the step base.`,
                        });
                      }

                      const scene = rendering.deriveBrickScene(document_, {
                        finish: "instruction",
                      });
                      let pixels: Uint8Array;
                      try {
                        const camera = rendering.createOrthographicViewCamera(
                          { ...view, centerXPx: centre[0], centerYPx: centre[1] },
                          frame,
                        );
                        pixels = new Uint8Array(renderer.render(scene.root, camera));
                      } finally {
                        scene.dispose();
                      }
                      buildPng = rgbaPngDataUrl(pixels, width, height);
                      panelPng = rgbaPngDataUrl(evidence.workPixels, width, height);
                    }

                    cameraReport = {
                      azimuthDegrees: solution.azimuthDegrees,
                      elevationDegrees: solution.elevationDegrees,
                      pixelsPerUnit: solution.pixelsPerUnit,
                      residualPx: solution.residualPx,
                      coherence: fit.coherence as number,
                      centerXPx: centre[0],
                      centerYPx: centre[1],
                      anchorIou,
                      anchorShiftPx: anchorShift,
                    };
                  } finally {
                    renderer.dispose();
                  }
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  failure = {
                    code: "rendering-error",
                    stage: "rendering",
                    message:
                      `Step ${spec.stepNumber} could not complete its render/placement evidence: ${message}. ` +
                      `The canonical document was restored to the printed-step base.`,
                  };
                  outcome = null;
                  document_ = stepBaseDocument;
                  placed = 0;
                  rollbackPlacedPieceReports(pieceReports, {
                    stepNumber: spec.stepNumber,
                    reason: `rendering evidence failed: ${message}.`,
                  });
                }
              }

              if (outcome === null) {
                const finalFailure = failure ?? {
                  code: "piece-placement-failed" as const,
                  stage: "placement" as const,
                  message: `Step ${spec.stepNumber} ended without a complete placement result.`,
                };
                outcome = {
                  status: "failed",
                  mechanism: failedMechanism,
                  attemptedMechanism,
                  failure: finalFailure,
                };
                document_ = stepBaseDocument;
                placed = 0;
              }
              if (outcome.status === "complete") {
                for (const registration of pendingRegistrations) {
                  partIdByIdentity.set(registration.identityKey, registration);
                }
              }
              if (outcome.status === "failed" && blockingStep === null) {
                blockingStep = spec.stepNumber;
              }

              reports.push(
                composeExecutedStepReport({
                  spec,
                  evidence,
                  prerequisites,
                  outcome,
                  validation,
                  camera: cameraReport,
                  pieces: pieceReports,
                  jointVisual,
                  deferral,
                  explodedGhost,
                  placedPieces: placed,
                  canonicalStepId: printedStepId,
                  documentParts: (document_ as { parts: unknown[] }).parts.length,
                  elapsedMs: Math.round(performance.now() - stepStarted),
                  panelPng,
                  buildPng,
                }),
              );
            } catch (error) {
              document_ = stepBaseDocument;
              const message = error instanceof Error ? error.message : String(error);
              const failure: StepFailure = {
                code: "rendering-error",
                stage: "rendering",
                stepNumber: spec.stepNumber,
                message:
                  `Step ${spec.stepNumber} failed while preparing or rendering its panel evidence: ${message}. ` +
                  `The exact step base was retained and later printed steps remain in the scoreboard.`,
              };
              reports.push(
                unexecutedStepReport(spec, failure, {
                  blockingStep,
                  documentParts: (document_ as { parts: unknown[] }).parts.length,
                  elapsedMs: Math.round(performance.now() - stepStarted),
                  reason: message,
                }),
              );
              if (blockingStep === null) blockingStep = spec.stepNumber;
            }
          }
        } finally {
          page.dispose();
        }
      }

      return {
        schemaVersion: "lego.real-build-browser-output/2",
        status: "executed",
        reports,
        documentJson: JSON.stringify(document_),
        identityBindings: [...partIdByIdentity.values()],
        fetchedPdfDigest,
        totalElapsedMs: Math.round(performance.now() - runStarted),
      } satisfies RealBuildBrowserOutput;
    } finally {
      await pdf.destroy();
    }
  } catch (error) {
    return failedBrowserOutput(
      error instanceof BrowserPreparationError
        ? error.failure
        : {
            code: "pdf-load-failed",
            stage: "loading",
            inputKey: "pdf",
            message:
              `Real-build PDF preparation failed before a typed step result existed: ` +
              `${error instanceof Error ? error.message : String(error)}.`,
          },
      runStarted,
    );
  } finally {
    await loadingTask.destroy();
  }
}
