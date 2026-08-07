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
  instructionSilhouetteMasks,
  maskCentroid,
  measureWholeStepMaskEvidence,
  preflightRealBuildOptions,
  selectRequestedPanelPages,
  shiftedMaskIou,
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

      for (const pageNumber of pages) {
        const pdfPage = await pdf.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: options.renderScale });
        document.querySelectorAll("canvas.page-probe").forEach((node) => node.remove());
        const pageCanvas = document.createElement("canvas");
        pageCanvas.className = "page-probe";
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        try {
          const pageContext = pageCanvas.getContext("2d", { willReadFrequently: true })!;
          await pdfPage.render({
            canvas: pageCanvas,
            canvasContext: pageContext,
            viewport,
            background: "#ffffff",
          }).promise;

          const onThisPage = selectedPanels
            .filter((panel) => panel.pageNumber === pageNumber)
            .sort((left, right) => left.stepNumber - right.stepNumber);

          for (const spec of onThisPage) {
            const stepStarted = performance.now();
            const stepBaseDocument = document_;
            try {
              const sourceX = spec.minXPt * options.renderScale;
              const sourceW = (spec.maxXPt - spec.minXPt) * options.renderScale;
              const sourceY = pageCanvas.height - spec.maxYPt * options.renderScale;
              const sourceH = (spec.maxYPt - spec.minYPt) * options.renderScale;
              const ratio = options.panelWidth / sourceW;
              const fitWidth = Math.max(1, Math.round(options.panelWidth));
              const fitHeight = Math.max(1, Math.round(sourceH * ratio));
              const crop = document.createElement("canvas");
              crop.width = fitWidth;
              crop.height = fitHeight;
              const cropContext = crop.getContext("2d", { willReadFrequently: true })!;
              cropContext.imageSmoothingEnabled = true;
              cropContext.drawImage(
                pageCanvas,
                sourceX,
                sourceY,
                sourceW,
                sourceH,
                0,
                0,
                fitWidth,
                fitHeight,
              );
              const fitImage = cropContext.getImageData(0, 0, fitWidth, fitHeight);

              const fitRaster = { width: fitWidth, height: fitHeight, pixels: fitImage.data };
              const artMask = assembly.keyPanelArt(fitRaster, {
                backgroundHex: 0x899093,
                toleranceLevels: 10,
              }) as Uint8Array;
              const furniture = assembly.keyPrintedBoxes(fitRaster) as Uint8Array;
              for (let index = 0; index < artMask.length; index += 1) {
                if (furniture[index] === 1) artMask[index] = 0;
              }
              assembly.clearPdfBoxes(
                artMask,
                {
                  width: fitWidth,
                  height: fitHeight,
                  renderScale: options.renderScale,
                  sourceXPx: sourceX,
                  sourceYPx: sourceY,
                  ratio,
                  pageHeightPx: pageCanvas.height,
                },
                spec.calloutBoxes,
              );
              const isolation = assembly.isolateAssembly({
                width: fitWidth,
                height: fitHeight,
                mask: artMask,
              });

              const field = lattice.buildStudTextureField(fitImage.data, fitWidth, fitHeight, {
                backgroundHex: 0x899093,
                backgroundTolerance: 10,
                highPassRadiusPx: 14,
                includeMask: isolation.mask,
                maxSamples: 18_000,
              });
              const fit = lattice.fitStudLattice(field, {
                minOffsetPx: 8,
                maxOffsetPx: 100,
                maxResidualFraction: 0.02,
              });

              const factor = options.workFactor;
              const work = assembly.downsampleRaster(fitRaster, factor) as {
                width: number;
                height: number;
                pixels: Uint8ClampedArray;
              };
              const width = work.width;
              const height = work.height;
              const highlight = assembly.extractHighlightRegions(work.pixels, width, height, {
                minimumOutlinePx: Math.max(10, Math.round(40 / factor)),
              });
              const workIsolation = assembly.downsampleMask(
                { width: fitWidth, height: fitHeight, mask: isolation.mask },
                factor,
              ) as { mask: Uint8Array };
              const built = assembly.alreadyBuiltMask(
                workIsolation.mask,
                highlight.mask,
                highlight.strokeMask,
                width,
                height,
              ) as Uint8Array;
              const arrows = assembly.readDisplacementArrows(
                { width, height, pixels: work.pixels },
                { originMask: highlight.strokeMask },
              );

              const highlightBox = assembly.highlightBounds(highlight) as {
                minXPx: number;
                minYPx: number;
                maxXPx: number;
                maxYPx: number;
              } | null;

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

              // A detected arrow is not yet a placement; converting it is what
              // makes it one. The booklet draws an exploded step by inking an
              // arrow from clear of the ghost to clear of the landing surface,
              // so the drawn vector is shorter than the travel by both gaps —
              // measured at 0.00 to 0.47 of a stud on this booklet, always the
              // same way. `measureArrowClearances` reads those gaps off the same
              // pixels, `correctArrowForClearance` adds them back, and
              // `arrowDisplacementFamily` returns every whole-grid displacement
              // whose projection matches what is left.
              //
              // The count is the size of that family, not a claim that the
              // family has one member. On this projection several triples agree
              // to within the measurement, which is why the family is handed to
              // the panel-scored search rather than read as an answer; what it
              // establishes is that the arrow constrains the placement at all,
              // which is exactly what the refusal asks for.
              const arrowFamily =
                fit.solution === null ||
                arrows.displacementXPx === null ||
                arrows.displacementYPx === null
                  ? []
                  : (() => {
                      const projection = assembly.panelProjectionFromFit(fit.solution);
                      const clearances = assembly.measureArrowClearances(arrows.arrows, {
                        width,
                        height,
                        ghostStrokeMask: highlight.strokeMask,
                        alreadyBuiltMask: built,
                      }) as readonly {
                        tailToGhostPx: number | null;
                        headToBuiltPx: number | null;
                      }[];
                      const raw = {
                        xPx: arrows.displacementXPx as number,
                        yPx: arrows.displacementYPx as number,
                      };
                      const measured = clearances.filter(
                        (entry) => entry.tailToGhostPx !== null && entry.headToBuiltPx !== null,
                      );
                      // A missing gap is treated as zero rather than guessed,
                      // which under-corrects and leaves the answer where it was.
                      const corrected =
                        measured.length === 0
                          ? raw
                          : (assembly.correctArrowForClearance(raw, {
                              tailToGhostPx:
                                measured.reduce((sum, e) => sum + e.tailToGhostPx!, 0) /
                                measured.length,
                              headToBuiltPx:
                                measured.reduce((sum, e) => sum + e.headToBuiltPx!, 0) /
                                measured.length,
                            }) as { xPx: number; yPx: number });
                      return assembly.arrowDisplacementFamily(projection, corrected) as readonly {
                        lduX: number;
                        lduY: number;
                        lduZ: number;
                        errorStuds: number;
                      }[];
                    })();

              const noSignal = placementSignalFailure({
                stepNumber: spec.stepNumber,
                hasHighlight: highlightBox !== null,
                detectedArrowCount: (arrows.arrows as unknown[]).length,
                usableArrowPlacementCount: arrowFamily.length,
                independentPlacementSignalCount: 0,
              });
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
              } else if (noSignal !== null) {
                failure = noSignal;
              } else {
                const solution = fit.solution as {
                  azimuthDegrees: number;
                  elevationDegrees: number;
                  pixelsPerUnit: number;
                  residualPx: number;
                };
                const view = {
                  azimuthDegrees: solution.azimuthDegrees,
                  elevationDegrees: solution.elevationDegrees,
                  pixelsPerUnit: solution.pixelsPerUnit / factor,
                };
                const frame = {
                  widthPx: width,
                  heightPx: height,
                  target: [0, 0, 0] as [number, number, number],
                  sceneRadius: 60,
                };
                try {
                  const renderer = rendering.createInstructionRenderer({ width, height });
                  try {
                    const silhouette = (
                      subject: typeof document_,
                      highlightPartId: string | readonly string[] | null,
                      centre: [number, number],
                    ) => {
                      const subjectParts = (subject as { parts: { id: string }[] }).parts;
                      const highlighted = new Set(
                        highlightPartId === null
                          ? []
                          : typeof highlightPartId === "string"
                            ? [highlightPartId]
                            : highlightPartId,
                      );
                      const painted = {
                        ...(subject as object),
                        parts: subjectParts.map((part) =>
                          highlighted.has(part.id) ? { ...part, colorId: "builtin:magenta" } : part,
                        ),
                      };
                      const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
                      let pixels: Uint8Array;
                      try {
                        rendering.setInstructionSilhouetteMode(scene.root, true);
                        const camera = rendering.createOrthographicViewCamera(
                          { ...view, centerXPx: centre[0], centerYPx: centre[1] },
                          frame,
                        );
                        pixels = new Uint8Array(renderer.render(scene.root, camera));
                      } finally {
                        scene.dispose();
                      }
                      return instructionSilhouetteMasks(pixels, width, height, 0x923978);
                    };

                    let centre: [number, number] = [width / 2, height / 2];
                    let anchorIou: number | null = null;
                    let anchorShift: [number, number] | null = null;

                    if (!anchorStep) {
                      const trial = silhouette(candidateDocument, null, centre);
                      const from = maskCentroid(trial.all, width, height);
                      const to = maskCentroid(built, width, height);
                      if (from === null || to === null) {
                        failure = {
                          code: "camera-anchor-failed",
                          stage: "camera-registration",
                          message:
                            `Step ${spec.stepNumber} could not anchor its camera: ` +
                            (from === null
                              ? `the model built so far rendered nothing at the panel's fitted angles.`
                              : `the panel's already-built art is empty after the highlight was removed, so there was nothing to register against.`),
                        };
                      } else {
                        const seedX = Math.round(to.x - from.x);
                        const seedY = Math.round(to.y - from.y);
                        const shiftedIou = (dx: number, dy: number) =>
                          shiftedMaskIou({
                            mask: trial.all,
                            target: built,
                            width,
                            height,
                            dx,
                            dy,
                          });
                        let best = { dx: seedX, dy: seedY, iou: shiftedIou(seedX, seedY) };
                        for (const step of [8, 3, 1]) {
                          for (let dy = -4; dy <= 4; dy += 1) {
                            for (let dx = -4; dx <= 4; dx += 1) {
                              const candidate = {
                                dx: best.dx + dx * step,
                                dy: best.dy + dy * step,
                              };
                              const iou = shiftedIou(candidate.dx, candidate.dy);
                              if (iou > best.iou) best = { ...candidate, iou };
                            }
                          }
                        }
                        centre = [width / 2 + best.dx, height / 2 + best.dy];
                        anchorIou = best.iou;
                        anchorShift = [best.dx, best.dy];
                      }
                    }

                    if (failure === null) {
                      const placementMechanism: SuccessfulStepMechanism = anchorStep
                        ? "anchor-orientation"
                        : "highlight";
                      attemptedMechanism = placementMechanism;
                      for (const [pieceIndex, piece] of spec.pieces.entries()) {
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

                      if (failure === null && candidatePlaced === spec.action.assembledPieces) {
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
                      panelPng = rgbaPngDataUrl(work.pixels, width, height);
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

              const fitSolution = fit.solution as {
                azimuthDegrees: number;
                elevationDegrees: number;
                pixelsPerUnit: number;
                residualPx: number;
              } | null;
              reports.push({
                stepNumber: spec.stepNumber,
                pageNumber: spec.pageNumber,
                fit: {
                  azimuthDegrees: fitSolution?.azimuthDegrees ?? null,
                  elevationDegrees: fitSolution?.elevationDegrees ?? null,
                  pixelsPerUnit: fitSolution?.pixelsPerUnit ?? null,
                  residualPx: fitSolution?.residualPx ?? null,
                  coherence: fit.coherence as number,
                  failure: fit.failure as string | null,
                },
                calloutPieces: spec.calloutPieces,
                expectedAssembledPieces: spec.action.assembledPieces,
                attemptedPieces:
                  spec.action.kind === "multi-build-copy"
                    ? spec.action.copies.length
                    : spec.pieces.length + spec.omittedPieces.length,
                placedPieces: placed,
                action: spec.action,
                actionEvidenceDigest: spec.action.evidenceDigest,
                canonicalStepId: outcome.status === "complete" ? printedStepId : null,
                prerequisites,
                outcome,
                validation,
                camera: cameraReport,
                highlight: {
                  regions: highlight.regions.length,
                  closedContourRate: highlight.closedContourRate,
                  strokePx: highlight.keyedPx,
                  boundsPx:
                    highlightBox === null
                      ? null
                      : [
                          highlightBox.minXPx,
                          highlightBox.minYPx,
                          highlightBox.maxXPx,
                          highlightBox.maxYPx,
                        ],
                },
                arrows: {
                  kept: (arrows.arrows as unknown[]).length,
                  redPx: arrows.redPx as number,
                  rejected: (arrows.rejected as unknown[]).length,
                  displacementFamily: arrowFamily.length,
                  displacementFamilyLdu: arrowFamily
                    .slice(0, 8)
                    .map((entry) => [entry.lduX, entry.lduY, entry.lduZ] as const),
                },
                pieces: pieceReports,
                jointVisual,
                documentParts: (document_ as { parts: unknown[] }).parts.length,
                elapsedMs: Math.round(performance.now() - stepStarted),
                panelPng,
                buildPng,
              });
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
          pageCanvas.width = 0;
          pageCanvas.height = 0;
          pageCanvas.remove();
          pdfPage.cleanup?.();
        }
      }

      return {
        schemaVersion: "lego.real-build-browser-output/1",
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
